import {
  CollabOperation,
  RemoteUser,
  StateMessage,
  AckMessage,
  RemoteOpMessage,
  CursorMessage,
  UserJoinMessage,
  UserLeaveMessage,
} from './types';
import { OTClient, OTClientCallbacks } from './ot-client';
import { WebSocketClient, ConnectionStatus } from './websocket-client';
import { CursorAwareness } from './cursor-awareness';
import { invertOperation, ModelReader } from './ot';
import { SpreadsheetModel } from '../model';
import { Selection, SpreadsheetData } from '../types';

// ============================================================
// 操作应用器接口
// ============================================================

/**
 * 将协同操作应用到本地模型的函数
 * 由外部（SpreadsheetApp）提供具体实现
 */
export type OperationApplier = (op: CollabOperation, model: SpreadsheetModel) => void;

/**
 * 状态变化回调，用于通知 UI 层更新
 */
export interface CollaborationCallbacks {
  // 远程操作被应用后的回调（用于触发重新渲染）
  onRemoteOperation?: (op: CollabOperation) => void;
  // 连接状态变化回调
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  // 用户加入回调
  onUserJoin?: (user: RemoteUser) => void;
  // 用户离开回调
  onUserLeave?: (userId: string) => void;
  // 文档状态同步完成回调
  onDocumentSync?: (data: SpreadsheetData) => void;
  // 同步状态变化回调（有无未确认操作）
  onSyncStatusChange?: (pendingCount: number) => void;
  // 远程光标更新回调（用于触发重绘）
  onCursorUpdate?: () => void;
}

// ============================================================
// 协同历史管理器
// ============================================================

/**
 * 协同模式下的历史管理器
 * 维护每个用户独立的操作历史栈，撤销仅影响自己的操作
 */
class CollabHistoryManager {
  // 本用户的撤销栈
  private undoStack: CollabOperation[] = [];
  // 本用户的重做栈
  private redoStack: CollabOperation[] = [];
  // 最大历史记录数
  private readonly maxHistory = 100;

  /**
   * 记录本地操作
   */
  pushLocal(op: CollabOperation): void {
    this.undoStack.push(op);
    // 新操作清空重做栈
    this.redoStack = [];
    // 限制历史记录数量
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }

  /**
   * 撤销：弹出最近操作，生成反向操作
   */
  undo(modelReader: ModelReader): CollabOperation | null {
    const op = this.undoStack.pop();
    if (!op) return null;
    const inverseOp = invertOperation(op, modelReader);
    this.redoStack.push(op);
    return inverseOp;
  }

  /**
   * 重做：弹出重做栈，返回原始操作
   */
  redo(): CollabOperation | null {
    const op = this.redoStack.pop();
    if (!op) return null;
    this.undoStack.push(op);
    return op;
  }

  /**
   * 是否可以撤销
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * 是否可以重做
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// ============================================================
// 协同引擎
// ============================================================

/**
 * 协同引擎 - 总协调器
 *
 * 整合 OTClient、WebSocketClient、CursorAwareness，
 * 提供统一的协同编辑接口。
 *
 * 职责：
 * - 初始化和销毁协同会话
 * - 将本地操作提交到 OT 客户端并通过 WebSocket 发送
 * - 接收远程操作并应用到本地模型
 * - 管理消息路由（操作确认、远程操作、光标更新、用户加入/离开）
 * - 维护协同模式下的独立历史栈
 */
export class CollaborationEngine {
  private otClient: OTClient | null = null;
  private wsClient: WebSocketClient;
  private cursorAwareness: CursorAwareness;
  private historyManager: CollabHistoryManager;

  private model: SpreadsheetModel | null = null;
  private applyOperation: OperationApplier | null = null;
  private callbacks: CollaborationCallbacks = {};

  private userId = '';
  private selfColor = '';
  private initialized = false;

  constructor() {
    this.wsClient = new WebSocketClient();
    this.cursorAwareness = new CursorAwareness();
    this.historyManager = new CollabHistoryManager();
  }

  /**
   * 初始化协同模式
   *
   * @param serverUrl WebSocket 服务器地址
   * @param roomId 房间 ID
   * @param userName 用户显示名称
   * @param model 电子表格模型实例
   * @param applyOp 操作应用函数
   * @param callbacks 状态变化回调
   */
  init(
    serverUrl: string,
    roomId: string,
    userName: string,
    model: SpreadsheetModel,
    applyOp: OperationApplier,
    callbacks: CollaborationCallbacks = {}
  ): void {
    if (this.initialized) {
      this.destroy();
    }

    this.model = model;
    this.applyOperation = applyOp;
    this.callbacks = callbacks;
    this.userId = `${userName}-${Date.now()}`;

    // 注册 WebSocket 消息处理器
    this.registerMessageHandlers();

    // 连接到服务器
    this.wsClient.connect(serverUrl, roomId, this.userId);

    this.initialized = true;
  }

  /**
   * 关闭协同模式，释放所有资源
   */
  destroy(): void {
    if (!this.initialized) return;

    this.wsClient.disconnect();
    this.cursorAwareness.destroy();
    this.historyManager.clear();
    this.otClient = null;
    this.model = null;
    this.applyOperation = null;
    this.callbacks = {};
    this.initialized = false;
  }

  /**
   * 提交本地操作
   * 由 SpreadsheetApp 在用户执行编辑时调用
   */
  submitOperation(op: CollabOperation): void {
    if (!this.initialized || !this.otClient) return;

    // 设置操作的用户信息
    const taggedOp: CollabOperation = {
      ...op,
      userId: this.userId,
      timestamp: Date.now(),
    };

    // 记录到协同历史栈
    this.historyManager.pushLocal(taggedOp);

    // 提交到 OT 客户端（会自动发送到服务器或缓冲）
    this.otClient.applyLocal(taggedOp);

    // 通知同步状态变化
    this.callbacks.onSyncStatusChange?.(this.getPendingCount());
  }

  /**
   * 协同模式下的撤销
   * 仅撤销当前用户自己的最近操作
   */
  undo(): CollabOperation | null {
    if (!this.initialized || !this.model) return null;

    // 创建 ModelReader 适配器
    const modelReader = this.createModelReader();
    const inverseOp = this.historyManager.undo(modelReader);

    if (inverseOp) {
      // 将反向操作作为新操作提交到协同通道
      this.submitUndoRedoOperation(inverseOp);
    }

    return inverseOp;
  }

  /**
   * 协同模式下的重做
   */
  redo(): CollabOperation | null {
    if (!this.initialized) return null;

    const op = this.historyManager.redo();

    if (op) {
      // 将原始操作重新提交到协同通道
      this.submitUndoRedoOperation(op);
    }

    return op;
  }

  /**
   * 发送光标/选择区域信息
   */
  sendCursor(selection: Selection | null): void {
    if (!this.initialized) return;
    this.wsClient.sendCursor(selection);
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): ConnectionStatus {
    return this.wsClient.getStatus();
  }

  /**
   * 获取在线用户列表
   */
  getOnlineUsers(): RemoteUser[] {
    return this.cursorAwareness.getRemoteUsers();
  }

  /**
   * 获取未确认操作数
   */
  getPendingCount(): number {
    if (!this.otClient) return 0;
    let count = 0;
    if (this.otClient.pending) count++;
    if (this.otClient.buffer) count++;
    return count;
  }

  /**
   * 获取光标感知模块（供渲染器调用）
   */
  getCursorAwareness(): CursorAwareness {
    return this.cursorAwareness;
  }

  /**
   * 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取当前用户 ID
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * 获取当前用户的颜色（由服务端分配）
   */
  getSelfColor(): string {
    return this.selfColor;
  }

  /**
   * 是否可以撤销
   */
  canUndo(): boolean {
    return this.historyManager.canUndo();
  }

  /**
   * 是否可以重做
   */
  canRedo(): boolean {
    return this.historyManager.canRedo();
  }

  // ============================================================
  // 内部方法
  // ============================================================

  /**
   * 注册 WebSocket 消息处理器
   */
  private registerMessageHandlers(): void {
    // 文档状态同步（加入房间后收到）
    this.wsClient.onMessage('state', (payload: unknown) => {
      this.handleStateMessage(payload as StateMessage['payload']);
    });

    // 操作确认
    this.wsClient.onMessage('ack', (payload: unknown) => {
      this.handleAckMessage(payload as AckMessage['payload']);
    });

    // 远程操作
    this.wsClient.onMessage('remote_op', (payload: unknown) => {
      this.handleRemoteOpMessage(payload as RemoteOpMessage['payload']);
    });

    // 光标更新
    this.wsClient.onMessage('cursor', (payload: unknown) => {
      this.handleCursorMessage(payload as CursorMessage['payload']);
    });

    // 用户加入
    this.wsClient.onMessage('user_join', (payload: unknown) => {
      this.handleUserJoinMessage(payload as UserJoinMessage['payload']);
    });

    // 用户离开
    this.wsClient.onMessage('user_leave', (payload: unknown) => {
      this.handleUserLeaveMessage(payload as UserLeaveMessage['payload']);
    });
  }

  /**
   * 处理文档状态同步消息
   * 在加入房间或重连时收到完整文档状态
   */
  private handleStateMessage(payload: StateMessage['payload']): void {
    const { revision, users } = payload;

    // 初始化 OT 客户端
    const otCallbacks: OTClientCallbacks = {
      sendToServer: (rev: number, op: CollabOperation) => {
        this.wsClient.sendOperation({ ...op, revision: rev });
      },
      applyOperation: (op: CollabOperation) => {
        if (this.model && this.applyOperation) {
          this.applyOperation(op, this.model);
          this.callbacks.onRemoteOperation?.(op);
        }
      },
    };

    this.otClient = new OTClient(revision, otCallbacks);

    // 添加已有的远程用户
    for (const user of users) {
      if (user.userId === this.userId) {
        // 保存服务端分配给自己的颜色
        this.selfColor = user.color;
      } else {
        this.cursorAwareness.addUser(user);
      }
    }

    // 通知文档同步完成
    this.callbacks.onDocumentSync?.(payload.document);
    this.callbacks.onConnectionStatusChange?.('connected');
  }

  /**
   * 处理操作确认消息
   */
  private handleAckMessage(payload: AckMessage['payload']): void {
    if (!this.otClient) return;
    this.otClient.serverAck(payload.revision);
    this.callbacks.onSyncStatusChange?.(this.getPendingCount());
  }

  /**
   * 处理远程操作消息
   */
  private handleRemoteOpMessage(payload: RemoteOpMessage['payload']): void {
    if (!this.otClient) return;
    this.otClient.applyRemote(payload.operation);
    this.callbacks.onSyncStatusChange?.(this.getPendingCount());
  }

  /**
   * 处理光标更新消息
   */
  private handleCursorMessage(payload: CursorMessage['payload']): void {
    if (payload.userId !== this.userId) {
      this.cursorAwareness.updateRemoteCursor(payload.userId, payload.selection);
      // 收到远程光标更新后触发重绘
      this.callbacks.onCursorUpdate?.();
    }
  }

  /**
   * 处理用户加入消息
   */
  private handleUserJoinMessage(payload: UserJoinMessage['payload']): void {
    const { user } = payload;
    if (user.userId !== this.userId) {
      this.cursorAwareness.addUser(user);
      this.callbacks.onUserJoin?.(user);
    }
  }

  /**
   * 处理用户离开消息
   */
  private handleUserLeaveMessage(payload: UserLeaveMessage['payload']): void {
    const { userId } = payload;
    if (userId !== this.userId) {
      this.cursorAwareness.removeUser(userId);
      this.callbacks.onUserLeave?.(userId);
    }
  }

  /**
   * 提交撤销/重做产生的操作（不记录到历史栈）
   */
  private submitUndoRedoOperation(op: CollabOperation): void {
    if (!this.otClient) return;

    const taggedOp: CollabOperation = {
      ...op,
      userId: this.userId,
      timestamp: Date.now(),
    };

    this.otClient.applyLocal(taggedOp);
    this.callbacks.onSyncStatusChange?.(this.getPendingCount());
  }

  /**
   * 创建 ModelReader 适配器
   */
  private createModelReader(): ModelReader {
    const model = this.model!;
    return {
      getCell(row: number, col: number) {
        const cell = model.getCell(row, col);
        if (!cell) return null;
        return {
          content: cell.content,
          rowSpan: cell.rowSpan,
          colSpan: cell.colSpan,
          fontColor: cell.fontColor,
          bgColor: cell.bgColor,
          fontSize: cell.fontSize,
          fontBold: cell.fontBold,
          fontItalic: cell.fontItalic,
          fontUnderline: cell.fontUnderline,
          verticalAlign: cell.verticalAlign,
        };
      },
      getRowHeight(row: number) {
        return model.getRowHeight(row);
      },
      getColWidth(col: number) {
        return model.getColWidth(col);
      },
    };
  }
}
