import {
  CollabOperation,
  MessageType,
  WebSocketMessage,
} from './types';
import { serializeOperation } from './operations';
import { Selection } from '../types';

// ============================================================
// 重连配置常量
// ============================================================

/** 初始重连间隔（毫秒） */
const INITIAL_RECONNECT_DELAY = 1000;
/** 最大重连间隔（毫秒） */
const MAX_RECONNECT_DELAY = 30000;
/** 最大重连尝试次数 */
const MAX_RECONNECT_ATTEMPTS = 5;

// ============================================================
// 连接状态类型
// ============================================================

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/**
 * 计算指数退避重连间隔
 * 公式：min(initialDelay * 2^attempt, maxDelay)
 */
export const calculateReconnectDelay = (attempt: number): number => {
  const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, attempt);
  return Math.min(delay, MAX_RECONNECT_DELAY);
};

// ============================================================
// 消息处理器类型
// ============================================================

type MessageHandler = (payload: unknown) => void;

// ============================================================
// WebSocket 客户端
// ============================================================

/**
 * WebSocket 通信客户端
 *
 * 负责与协同服务器的 WebSocket 连接管理，包括：
 * - 连接建立与断开
 * - 指数退避自动重连（1s 起步，最大 30s，最多 5 次）
 * - 离线操作缓冲队列（断线期间缓存操作，重连后按序发送）
 * - 消息收发与路由
 */
export class WebSocketClient {
  // 当前 WebSocket 实例
  private ws: WebSocket | null = null;
  // 连接状态
  private status: ConnectionStatus = 'disconnected';
  // 连接参数
  private url = '';
  private roomId = '';
  private userId = '';
  // 重连相关
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  // 消息处理器注册表
  private handlers: Map<MessageType, MessageHandler[]> = new Map();
  // 离线操作缓冲队列
  private offlineQueue: string[] = [];
  // 重连成功回调
  private reconnectCallback: (() => void) | null = null;
  // 连接状态变化回调
  private statusChangeCallback: ((status: ConnectionStatus) => void) | null = null;

  /**
   * 连接到协同服务器
   */
  connect(url: string, roomId: string, userId: string): void {
    this.url = url;
    this.roomId = roomId;
    this.userId = userId;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  /**
   * 主动断开连接（不触发重连）
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status = 'disconnected';
  }

  /**
   * 发送协同操作
   * 如果当前已连接，立即发送；否则缓存到离线队列
   */
  sendOperation(op: CollabOperation): void {
    const message: WebSocketMessage = {
      type: 'operation',
      payload: {
        revision: op.revision,
        operation: JSON.parse(serializeOperation(op)) as CollabOperation,
      },
    };
    const raw = JSON.stringify(message);

    if (this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    } else {
      this.offlineQueue.push(raw);
    }
  }

  /**
   * 发送光标/选择区域信息
   * 仅在连接状态下发送，断线时丢弃（光标信息是瞬时的，无需缓存）
   */
  sendCursor(selection: Selection | null): void {
    if (this.status !== 'connected' || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const message: WebSocketMessage = {
      type: 'cursor',
      payload: {
        userId: this.userId,
        selection,
      },
    };
    this.ws.send(JSON.stringify(message));
  }

  /**
   * 注册消息处理器
   * 同一消息类型可注册多个处理器
   */
  onMessage(type: MessageType, handler: MessageHandler): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  /**
   * 获取当前连接状态
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * 获取连接状态
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 获取离线缓冲队列长度（用于测试和状态显示）
   */
  getOfflineQueueLength(): number {
    return this.offlineQueue.length;
  }

  /**
   * 获取当前重连尝试次数（用于测试）
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * 注册重连成功回调
   * 当 WebSocket 从断开状态重新连接成功时触发
   */
  onReconnect(callback: () => void): void {
    this.reconnectCallback = callback;
  }

  /**
   * 注册连接状态变化回调
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusChangeCallback = callback;
  }

  // ============================================================
  // 内部方法
  // ============================================================

  /**
   * 执行实际的 WebSocket 连接
   */
  private doConnect(): void {
    this.status = 'connecting';

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.handleReconnect();
      return;
    }

    this.ws.onopen = () => {
      // 判断是否为重连（之前有过连接尝试）
      const isReconnect = this.reconnectAttempts > 0;

      this.status = 'connected';
      this.reconnectAttempts = 0;

      // 通知连接状态变化
      this.statusChangeCallback?.('connected');

      // 发送加入房间消息
      const joinMessage: WebSocketMessage = {
        type: 'join',
        payload: {
          roomId: this.roomId,
          userId: this.userId,
          userName: this.userId, // 默认使用 userId 作为显示名
        },
      };
      this.ws!.send(JSON.stringify(joinMessage));

      // 重连成功时触发回调（在 join 消息发送后）
      if (isReconnect && this.reconnectCallback) {
        this.reconnectCallback();
      }

      // 刷新离线缓冲队列
      this.flushOfflineQueue();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data as string);
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.intentionalClose) {
        this.status = 'disconnected';
        this.statusChangeCallback?.('disconnected');
        this.handleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onerror 之后通常会触发 onclose，重连逻辑在 onclose 中处理
    };
  }

  /**
   * 处理收到的 WebSocket 消息
   */
  private handleMessage(raw: string): void {
    try {
      const message = JSON.parse(raw) as WebSocketMessage;
      const handlers = this.handlers.get(message.type);
      if (handlers) {
        for (const handler of handlers) {
          handler(message.payload);
        }
      }
    } catch {
      // 无效消息格式，忽略
    }
  }

  /**
   * 处理重连逻辑
   * 使用指数退避策略：1s, 2s, 4s, 8s, 16s（上限 30s）
   * 最多尝试 5 次
   */
  private handleReconnect(): void {
    if (this.intentionalClose) {
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      // 超过最大重连次数，通知上层
      this.status = 'disconnected';
      // 触发连接失败的处理器（如果有注册）
      const handlers = this.handlers.get('leave');
      if (handlers) {
        for (const handler of handlers) {
          handler({ reason: 'max_reconnect_exceeded' });
        }
      }
      return;
    }

    const delay = calculateReconnectDelay(this.reconnectAttempts);
    this.reconnectAttempts++;
    this.status = 'connecting';
    this.statusChangeCallback?.('connecting');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  /**
   * 刷新离线缓冲队列
   * 按 FIFO 顺序将缓存的操作发送到服务器
   */
  private flushOfflineQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    while (this.offlineQueue.length > 0) {
      const raw = this.offlineQueue.shift()!;
      this.ws.send(raw);
    }
  }

  /**
   * 清除重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
