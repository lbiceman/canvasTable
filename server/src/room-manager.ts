/**
 * 房间管理模块
 * 创建/加入/离开房间、文档状态存储、用户列表管理
 *
 * 需求: 4.3, 4.4
 */
import { WebSocket } from 'ws';
import {
  Room,
  ClientConnection,
  RemoteUser,
  SpreadsheetData,
  CollabOperation,
  USER_COLORS,
} from './types.ts';
import { createOTServer, OTServerState, receiveOperation, getOperationsSince, ReceiveResult } from './ot-server.ts';
import { saveRoom, loadRoom } from './database.ts';

// 默认行列数
const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26;
const DEFAULT_ROW_HEIGHT = 28;
const DEFAULT_COL_WIDTH = 100;

// 保存防抖间隔（毫秒）
const SAVE_DEBOUNCE_MS = 2000;

/**
 * 创建空白文档
 */
const createEmptyDocument = (): SpreadsheetData => {
  const cells = Array.from({ length: DEFAULT_ROWS }, () =>
    Array.from({ length: DEFAULT_COLS }, () => ({
      content: '',
      rowSpan: 1,
      colSpan: 1,
      isMerged: false,
    }))
  );
  const rowHeights = Array.from({ length: DEFAULT_ROWS }, () => DEFAULT_ROW_HEIGHT);
  const colWidths = Array.from({ length: DEFAULT_COLS }, () => DEFAULT_COL_WIDTH);
  return { cells, rowHeights, colWidths };
};

/**
 * 将操作应用到文档快照上，保持文档状态与操作历史同步
 */
const applyOperationToDocument = (doc: SpreadsheetData, op: CollabOperation): void => {
  const { cells, rowHeights, colWidths } = doc;

  switch (op.type) {
    case 'cellEdit': {
      if (op.row < cells.length && op.col < cells[0].length) {
        cells[op.row][op.col].content = op.content;
      }
      break;
    }
    case 'cellMerge': {
      const { startRow, startCol, endRow, endCol } = op;
      for (let r = startRow; r <= endRow && r < cells.length; r++) {
        for (let c = startCol; c <= endCol && c < cells[0].length; c++) {
          if (r === startRow && c === startCol) {
            cells[r][c].rowSpan = endRow - startRow + 1;
            cells[r][c].colSpan = endCol - startCol + 1;
            cells[r][c].isMerged = false;
          } else {
            cells[r][c].isMerged = true;
            cells[r][c].mergeParent = { row: startRow, col: startCol };
            cells[r][c].rowSpan = 1;
            cells[r][c].colSpan = 1;
          }
        }
      }
      break;
    }
    case 'cellSplit': {
      const cell = cells[op.row]?.[op.col];
      if (!cell) break;
      const rs = cell.rowSpan;
      const cs = cell.colSpan;
      for (let r = op.row; r < op.row + rs && r < cells.length; r++) {
        for (let c = op.col; c < op.col + cs && c < cells[0].length; c++) {
          cells[r][c].rowSpan = 1;
          cells[r][c].colSpan = 1;
          cells[r][c].isMerged = false;
          delete cells[r][c].mergeParent;
        }
      }
      break;
    }
    case 'rowInsert': {
      const colCount = cells[0]?.length ?? DEFAULT_COLS;
      const newRows = Array.from({ length: op.count }, () =>
        Array.from({ length: colCount }, () => ({
          content: '',
          rowSpan: 1,
          colSpan: 1,
          isMerged: false,
        }))
      );
      cells.splice(op.rowIndex, 0, ...newRows);
      const newHeights = Array.from({ length: op.count }, () => DEFAULT_ROW_HEIGHT);
      rowHeights.splice(op.rowIndex, 0, ...newHeights);
      break;
    }
    case 'rowDelete': {
      cells.splice(op.rowIndex, op.count);
      rowHeights.splice(op.rowIndex, op.count);
      break;
    }
    case 'rowResize': {
      if (op.rowIndex < rowHeights.length) {
        rowHeights[op.rowIndex] = op.height;
      }
      break;
    }
    case 'colResize': {
      if (op.colIndex < colWidths.length) {
        colWidths[op.colIndex] = op.width;
      }
      break;
    }
    case 'fontColor': {
      if (op.row < cells.length && op.col < cells[0].length) {
        cells[op.row][op.col].fontColor = op.color;
      }
      break;
    }
    case 'bgColor': {
      if (op.row < cells.length && op.col < cells[0].length) {
        cells[op.row][op.col].bgColor = op.color;
      }
      break;
    }
    case 'fontSize': {
      // 字体大小是单元格级别设置
      if (op.row < cells.length && op.col < cells[0].length) {
        cells[op.row][op.col].fontSize = op.size;
      }
      break;
    }
    case 'fontBold': {
      // 字体加粗是单元格级别设置
      if (op.row < cells.length && op.col < cells[0].length) {
        cells[op.row][op.col].fontBold = op.bold;
      }
      break;
    }
    case 'fontItalic': {
      // 字体斜体是单元格级别设置
      if (op.row < cells.length && op.col < cells[0].length) {
        cells[op.row][op.col].fontItalic = op.italic;
      }
      break;
    }
    case 'fontUnderline': {
      // 字体下划线是单元格级别设置
      if (op.row < cells.length && op.col < cells[0].length) {
        cells[op.row][op.col].fontUnderline = op.underline;
      }
      break;
    }
    case 'fontAlign': {
      // 字体对齐是单元格级别设置
      if (op.row < cells.length && op.col < cells[0].length) {
        cells[op.row][op.col].fontAlign = op.align;
      }
      break;
    }
  }
};

/**
 * 房间管理器
 */
export class RoomManager {
  // 所有房间
  private rooms: Map<string, Room> = new Map();
  // 每个房间的 OT 服务端状态
  private otStates: Map<string, OTServerState> = new Map();
  // 保存防抖定时器
  private saveTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * 获取或创建房间
   * 优先从数据库加载已有数据，不存在则创建空白文档
   */
  getOrCreateRoom(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      // 尝试从数据库加载
      const persisted = loadRoom(roomId);
      if (persisted) {
        room = {
          roomId,
          document: persisted.document,
          operations: persisted.operations,
          revision: persisted.revision,
          clients: new Map(),
        };
        // 恢复 OT 状态
        const otState = createOTServer();
        otState.operations = persisted.operations;
        otState.revision = persisted.revision;
        this.otStates.set(roomId, otState);
        console.log(`从数据库恢复房间 ${roomId}，修订号: ${persisted.revision}`);
      } else {
        room = {
          roomId,
          document: createEmptyDocument(),
          operations: [],
          revision: 0,
          clients: new Map(),
        };
        this.otStates.set(roomId, createOTServer());
      }
      this.rooms.set(roomId, room);
    }
    return room;
  }

  /**
   * 防抖保存房间数据到数据库
   * 避免每次操作都写磁盘，合并短时间内的多次写入
   */
  private scheduleSave(roomId: string): void {
    const existing = this.saveTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.saveTimers.delete(roomId);
      this.persistRoom(roomId);
    }, SAVE_DEBOUNCE_MS);
    this.saveTimers.set(roomId, timer);
  }

  /**
   * 立即保存房间数据到数据库
   */
  private persistRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    const otState = this.otStates.get(roomId);
    if (!room || !otState) return;

    saveRoom(roomId, room.document, otState.revision, otState.operations);
    console.log(`房间 ${roomId} 数据已保存，修订号: ${otState.revision}`);
  }

  /**
   * 用户加入房间
   * 返回分配给用户的颜色和当前房间状态
   */
  joinRoom(
    roomId: string,
    userId: string,
    userName: string,
    ws: WebSocket
  ): { color: string; room: Room } {
    const room = this.getOrCreateRoom(roomId);

    // 分配颜色：从颜色池中选择未被使用的颜色
    const usedColors = new Set(
      Array.from(room.clients.values()).map((c) => c.color)
    );
    const availableColor = USER_COLORS.find((c) => !usedColors.has(c)) ?? USER_COLORS[room.clients.size % USER_COLORS.length];

    const client: ClientConnection = {
      userId,
      userName,
      color: availableColor,
      ws,
    };
    room.clients.set(userId, client);

    return { color: availableColor, room };
  }

  /**
   * 用户离开房间
   * 返回 true 如果房间仍有用户，false 如果房间已空
   */
  leaveRoom(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.clients.delete(userId);

    // 如果房间为空，立即保存数据到数据库
    if (room.clients.size === 0) {
      // 取消防抖定时器，立即保存
      const timer = this.saveTimers.get(roomId);
      if (timer) {
        clearTimeout(timer);
        this.saveTimers.delete(roomId);
      }
      this.persistRoom(roomId);
    }

    return room.clients.size > 0;
  }

  /**
   * 获取房间内的远程用户列表
   */
  getRemoteUsers(roomId: string, excludeUserId?: string): RemoteUser[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const users: RemoteUser[] = [];
    for (const client of room.clients.values()) {
      if (excludeUserId && client.userId === excludeUserId) continue;
      users.push({
        userId: client.userId,
        userName: client.userName,
        color: client.color,
        selection: null,
        lastActive: Date.now(),
      });
    }
    return users;
  }

  /**
   * 获取房间内所有用户列表（包括自己）
   */
  getAllUsers(roomId: string): RemoteUser[] {
    return this.getRemoteUsers(roomId);
  }

  /**
   * 接收并处理操作
   */
  receiveOperation(
    roomId: string,
    clientRevision: number,
    op: CollabOperation
  ): ReceiveResult | null {
    const otState = this.otStates.get(roomId);
    if (!otState) return null;

    const result = receiveOperation(otState, clientRevision, op);
    if (result) {
      // 同步房间的修订号和操作历史
      const room = this.rooms.get(roomId);
      if (room) {
        room.revision = result.revision;
        room.operations.push(result.transformedOp);
        // 将操作应用到文档快照，保持文档状态最新
        applyOperationToDocument(room.document, result.transformedOp);
      }
      // 防抖保存到数据库
      this.scheduleSave(roomId);
    }
    return result;
  }

  /**
   * 获取指定修订号之后的操作（用于重连同步）
   */
  getOperationsSince(roomId: string, sinceRevision: number): CollabOperation[] {
    const otState = this.otStates.get(roomId);
    if (!otState) return [];
    return getOperationsSince(otState, sinceRevision);
  }

  /**
   * 获取房间当前修订号
   */
  getRevision(roomId: string): number {
    const otState = this.otStates.get(roomId);
    return otState?.revision ?? 0;
  }

  /**
   * 获取房间的文档状态
   */
  getDocument(roomId: string): SpreadsheetData | null {
    const room = this.rooms.get(roomId);
    return room?.document ?? null;
  }

  /**
   * 获取房间内指定用户的 WebSocket 连接
   */
  getClientWs(roomId: string, userId: string): WebSocket | undefined {
    const room = this.rooms.get(roomId);
    return room?.clients.get(userId)?.ws as WebSocket | undefined;
  }

  /**
   * 获取房间内所有客户端连接（可排除指定用户）
   */
  getOtherClients(roomId: string, excludeUserId: string): ClientConnection[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const clients: ClientConnection[] = [];
    for (const client of room.clients.values()) {
      if (client.userId !== excludeUserId) {
        clients.push(client);
      }
    }
    return clients;
  }

  /**
   * 通过 WebSocket 实例查找用户所在的房间和用户 ID
   */
  findClientByWs(ws: WebSocket): { roomId: string; userId: string } | null {
    for (const [roomId, room] of this.rooms) {
      for (const [userId, client] of room.clients) {
        if (client.ws === ws) {
          return { roomId, userId };
        }
      }
    }
    return null;
  }

  /**
   * 检查房间是否存在
   */
  hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  /**
   * 保存所有房间数据（用于服务器关闭时）
   */
  saveAll(): void {
    for (const roomId of this.rooms.keys()) {
      // 取消防抖定时器
      const timer = this.saveTimers.get(roomId);
      if (timer) {
        clearTimeout(timer);
        this.saveTimers.delete(roomId);
      }
      this.persistRoom(roomId);
    }
  }
}
