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

// 默认行列数
const DEFAULT_ROWS = 50;
const DEFAULT_COLS = 26;
const DEFAULT_ROW_HEIGHT = 28;
const DEFAULT_COL_WIDTH = 100;

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
 * 房间管理器
 */
export class RoomManager {
  // 所有房间
  private rooms: Map<string, Room> = new Map();
  // 每个房间的 OT 服务端状态
  private otStates: Map<string, OTServerState> = new Map();

  /**
   * 获取或创建房间
   */
  getOrCreateRoom(roomId: string): Room {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        document: createEmptyDocument(),
        operations: [],
        revision: 0,
        clients: new Map(),
      };
      this.rooms.set(roomId, room);
      this.otStates.set(roomId, createOTServer());
    }
    return room;
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

    // 如果房间为空，保留房间数据（不立即清理，以便重连）
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
      }
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
}
