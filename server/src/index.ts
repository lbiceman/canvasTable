/**
 * WebSocket 协同编辑服务器入口
 * 处理连接、消息路由、广播逻辑
 *
 * 需求: 4.3, 4.4
 */
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './room-manager.ts';
import { WebSocketMessage, CollabOperation } from './types.ts';

const PORT = Number(process.env.PORT) || 8080;

const roomManager = new RoomManager();

/**
 * 向指定 WebSocket 发送 JSON 消息
 */
const sendMessage = (ws: WebSocket, message: WebSocketMessage): void => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
};

/**
 * 向房间内其他客户端广播消息
 */
const broadcastToOthers = (
  roomId: string,
  excludeUserId: string,
  message: WebSocketMessage
): void => {
  const clients = roomManager.getOtherClients(roomId, excludeUserId);
  const data = JSON.stringify(message);
  for (const client of clients) {
    const ws = client.ws as WebSocket;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
};

// ============================================================
// 消息处理器
// ============================================================

/**
 * 处理加入房间请求
 */
const handleJoin = (
  ws: WebSocket,
  payload: { roomId: string; userId: string; userName: string }
): void => {
  const { roomId, userId, userName } = payload;
  const { color, room } = roomManager.joinRoom(roomId, userId, userName, ws);

  // 发送当前文档状态给新加入的客户端
  sendMessage(ws, {
    type: 'state',
    payload: {
      document: room.document,
      revision: roomManager.getRevision(roomId),
      users: roomManager.getAllUsers(roomId),
    },
  });

  // 通知房间内其他用户有新用户加入
  broadcastToOthers(roomId, userId, {
    type: 'user_join',
    payload: {
      user: {
        userId,
        userName,
        color,
        selection: null,
        lastActive: Date.now(),
      },
    },
  });

  console.log(`用户 ${userName}(${userId}) 加入房间 ${roomId}`);
};

/**
 * 处理操作消息
 */
const handleOperation = (
  ws: WebSocket,
  roomId: string,
  userId: string,
  payload: { revision: number; operation: CollabOperation }
): void => {
  const { revision, operation } = payload;

  const result = roomManager.receiveOperation(roomId, revision, operation);

  if (result) {
    // 向发送者确认操作
    sendMessage(ws, {
      type: 'ack',
      payload: { revision: result.revision },
    });

    // 向其他客户端广播转换后的操作
    broadcastToOthers(roomId, userId, {
      type: 'remote_op',
      payload: {
        revision: result.revision,
        operation: result.transformedOp,
        userId,
      },
    });
  } else {
    // 操作被消除（例如编辑的行被删除），仍然发送确认
    sendMessage(ws, {
      type: 'ack',
      payload: { revision: roomManager.getRevision(roomId) },
    });
  }
};

/**
 * 处理光标更新消息
 */
const handleCursor = (
  roomId: string,
  userId: string,
  payload: { selection: unknown }
): void => {
  broadcastToOthers(roomId, userId, {
    type: 'cursor',
    payload: {
      userId,
      selection: payload.selection,
    },
  });
};

/**
 * 处理同步请求（客户端重连后请求缺失的操作）
 */
const handleSync = (
  ws: WebSocket,
  roomId: string,
  payload: { sinceRevision: number }
): void => {
  const { sinceRevision } = payload;
  const currentRevision = roomManager.getRevision(roomId);

  // 如果差距超过 100，发送完整文档快照
  if (currentRevision - sinceRevision > 100) {
    const document = roomManager.getDocument(roomId);
    sendMessage(ws, {
      type: 'state',
      payload: {
        document,
        revision: currentRevision,
        users: roomManager.getAllUsers(roomId),
      },
    });
  } else {
    // 发送缺失的操作
    const ops = roomManager.getOperationsSince(roomId, sinceRevision);
    for (const op of ops) {
      sendMessage(ws, {
        type: 'remote_op',
        payload: {
          revision: op.revision,
          operation: op,
          userId: op.userId,
        },
      });
    }
  }
};

/**
 * 处理客户端断开连接
 */
const handleDisconnect = (ws: WebSocket): void => {
  const clientInfo = roomManager.findClientByWs(ws);
  if (!clientInfo) return;

  const { roomId, userId } = clientInfo;
  roomManager.leaveRoom(roomId, userId);

  // 通知其他用户
  broadcastToOthers(roomId, userId, {
    type: 'user_leave',
    payload: { userId },
  });

  console.log(`用户 ${userId} 离开房间 ${roomId}`);
};

// ============================================================
// WebSocket 服务器
// ============================================================

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws: WebSocket) => {
  console.log('新客户端连接');

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      const { type, payload } = message;

      if (type === 'join') {
        const joinPayload = payload as { roomId: string; userId: string; userName: string };
        handleJoin(ws, joinPayload);
        return;
      }

      // 其他消息需要先找到客户端所在的房间
      const clientInfo = roomManager.findClientByWs(ws);
      if (!clientInfo) {
        console.warn('收到未加入房间的客户端消息，忽略');
        return;
      }

      const { roomId, userId } = clientInfo;

      switch (type) {
        case 'operation':
          handleOperation(
            ws,
            roomId,
            userId,
            payload as { revision: number; operation: CollabOperation }
          );
          break;

        case 'cursor':
          handleCursor(roomId, userId, payload as { selection: unknown });
          break;

        case 'sync':
          handleSync(ws, roomId, payload as { sinceRevision: number });
          break;

        case 'leave':
          handleDisconnect(ws);
          break;

        default:
          console.warn(`未知消息类型: ${type}`);
      }
    } catch (error) {
      console.error('消息处理错误:', error);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws);
    console.log('客户端断开连接');
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket 错误:', error.message);
  });
});

console.log(`协同编辑服务器已启动，端口: ${PORT}`);

export { wss, roomManager };
