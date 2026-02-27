import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateReconnectDelay, WebSocketClient } from '../websocket-client';
import { CellEditOp } from '../types';

// ============================================================
// calculateReconnectDelay 单元测试
// ============================================================

describe('calculateReconnectDelay', () => {
  it('第 0 次尝试返回 1000ms', () => {
    expect(calculateReconnectDelay(0)).toBe(1000);
  });

  it('第 1 次尝试返回 2000ms', () => {
    expect(calculateReconnectDelay(1)).toBe(2000);
  });

  it('第 2 次尝试返回 4000ms', () => {
    expect(calculateReconnectDelay(2)).toBe(4000);
  });

  it('第 3 次尝试返回 8000ms', () => {
    expect(calculateReconnectDelay(3)).toBe(8000);
  });

  it('第 4 次尝试返回 16000ms', () => {
    expect(calculateReconnectDelay(4)).toBe(16000);
  });

  it('超大尝试次数不超过 30000ms', () => {
    expect(calculateReconnectDelay(10)).toBe(30000);
    expect(calculateReconnectDelay(100)).toBe(30000);
  });
});

// ============================================================
// Mock WebSocket
// ============================================================

interface MockWebSocketInstance {
  url: string;
  readyState: number;
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

let mockWsInstances: MockWebSocketInstance[] = [];

class MockWebSocket implements MockWebSocketInstance {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  });

  constructor(url: string) {
    this.url = url;
    mockWsInstances.push(this);
  }

  // 模拟连接成功
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  // 模拟收到消息
  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  // 模拟连接关闭（非主动）
  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

// ============================================================
// WebSocketClient 单元测试
// ============================================================

describe('WebSocketClient', () => {
  let client: WebSocketClient;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWsInstances = [];
    // 替换全局 WebSocket
    vi.stubGlobal('WebSocket', MockWebSocket);
    client = new WebSocketClient();
  });

  afterEach(() => {
    client.disconnect();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // 辅助函数：创建测试操作
  const makeEditOp = (userId = 'user-a', row = 0, col = 0): CellEditOp => ({
    type: 'cellEdit',
    userId,
    timestamp: Date.now(),
    revision: 1,
    row,
    col,
    content: '测试',
    previousContent: '',
  });

  // 辅助函数：获取最新的 mock WebSocket 实例
  const getLatestWs = (): MockWebSocketInstance => mockWsInstances[mockWsInstances.length - 1];

  describe('connect / disconnect', () => {
    it('连接后状态变为 connecting', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      expect(client.getStatus()).toBe('connecting');
    });

    it('WebSocket 打开后状态变为 connected', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      (getLatestWs() as MockWebSocket).simulateOpen();
      expect(client.isConnected()).toBe(true);
      expect(client.getStatus()).toBe('connected');
    });

    it('连接成功后发送 join 消息', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      const ws = getLatestWs();
      (ws as MockWebSocket).simulateOpen();

      expect(ws.send).toHaveBeenCalledTimes(1);
      const joinMsg = JSON.parse(ws.send.mock.calls[0][0] as string);
      expect(joinMsg.type).toBe('join');
      expect(joinMsg.payload.roomId).toBe('room-1');
      expect(joinMsg.payload.userId).toBe('user-a');
    });

    it('disconnect 后状态变为 disconnected', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      (getLatestWs() as MockWebSocket).simulateOpen();
      client.disconnect();
      expect(client.getStatus()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('disconnect 后不触发重连', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      (getLatestWs() as MockWebSocket).simulateOpen();
      client.disconnect();

      // 推进时间，不应有新的 WebSocket 实例
      const countBefore = mockWsInstances.length;
      vi.advanceTimersByTime(60000);
      expect(mockWsInstances.length).toBe(countBefore);
    });
  });

  describe('sendOperation - 离线缓冲', () => {
    it('连接状态下直接发送操作', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      const ws = getLatestWs();
      (ws as MockWebSocket).simulateOpen();

      const op = makeEditOp();
      client.sendOperation(op);

      // join 消息 + operation 消息
      expect(ws.send).toHaveBeenCalledTimes(2);
      const msg = JSON.parse(ws.send.mock.calls[1][0] as string);
      expect(msg.type).toBe('operation');
    });

    it('断线时操作缓存到离线队列', () => {
      // 不连接，直接发送
      const op1 = makeEditOp('user-a', 0, 0);
      const op2 = makeEditOp('user-a', 1, 1);
      client.sendOperation(op1);
      client.sendOperation(op2);

      expect(client.getOfflineQueueLength()).toBe(2);
    });

    it('重连后按 FIFO 顺序刷新离线队列', () => {
      // 先缓存操作
      const op1 = makeEditOp('user-a', 0, 0);
      const op2 = makeEditOp('user-a', 1, 1);
      client.sendOperation(op1);
      client.sendOperation(op2);
      expect(client.getOfflineQueueLength()).toBe(2);

      // 连接
      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      const ws = getLatestWs();
      (ws as MockWebSocket).simulateOpen();

      // join 消息 + 2 个缓冲操作
      expect(ws.send).toHaveBeenCalledTimes(3);
      expect(client.getOfflineQueueLength()).toBe(0);

      // 验证发送顺序：join, op1, op2
      const msg1 = JSON.parse(ws.send.mock.calls[1][0] as string);
      const msg2 = JSON.parse(ws.send.mock.calls[2][0] as string);
      expect(msg1.type).toBe('operation');
      expect(msg2.type).toBe('operation');
    });
  });

  describe('sendCursor', () => {
    it('连接状态下发送光标信息', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      const ws = getLatestWs();
      (ws as MockWebSocket).simulateOpen();

      client.sendCursor({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });

      // join + cursor
      expect(ws.send).toHaveBeenCalledTimes(2);
      const msg = JSON.parse(ws.send.mock.calls[1][0] as string);
      expect(msg.type).toBe('cursor');
    });

    it('断线时丢弃光标信息（不缓存）', () => {
      client.sendCursor({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
      // 光标信息不应进入离线队列
      expect(client.getOfflineQueueLength()).toBe(0);
    });
  });

  describe('onMessage - 消息路由', () => {
    it('收到消息时调用对应的处理器', () => {
      const handler = vi.fn();
      client.onMessage('ack', handler);

      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      const ws = getLatestWs() as MockWebSocket;
      ws.simulateOpen();

      const ackMsg = JSON.stringify({ type: 'ack', payload: { revision: 5 } });
      ws.simulateMessage(ackMsg);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ revision: 5 });
    });

    it('同一类型可注册多个处理器', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      client.onMessage('remote_op', handler1);
      client.onMessage('remote_op', handler2);

      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      const ws = getLatestWs() as MockWebSocket;
      ws.simulateOpen();

      ws.simulateMessage(JSON.stringify({ type: 'remote_op', payload: { data: 1 } }));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('无效 JSON 消息不抛出异常', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      const ws = getLatestWs() as MockWebSocket;
      ws.simulateOpen();

      expect(() => ws.simulateMessage('not json')).not.toThrow();
    });
  });

  describe('指数退避重连', () => {
    it('连接断开后自动尝试重连', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');
      const ws = getLatestWs() as MockWebSocket;
      ws.simulateOpen();

      const countBefore = mockWsInstances.length;
      // 模拟非主动断开
      ws.simulateClose();

      // 推进 1 秒（第 0 次重连间隔）
      vi.advanceTimersByTime(1000);
      expect(mockWsInstances.length).toBe(countBefore + 1);
    });

    it('重连间隔按指数退避增长', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');

      // 第一次连接失败
      (getLatestWs() as MockWebSocket).simulateClose();
      expect(client.getReconnectAttempts()).toBe(1);

      // 推进 1s，触发第 1 次重连
      vi.advanceTimersByTime(1000);
      const ws2 = getLatestWs() as MockWebSocket;
      ws2.simulateClose();
      expect(client.getReconnectAttempts()).toBe(2);

      // 推进 2s，触发第 2 次重连
      vi.advanceTimersByTime(2000);
      const ws3 = getLatestWs() as MockWebSocket;
      ws3.simulateClose();
      expect(client.getReconnectAttempts()).toBe(3);
    });

    it('超过 5 次重连后停止尝试', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');

      // 初始连接失败 + 5 次重连失败 = 共 6 次关闭
      // 初始连接失败触发第 1 次重连调度
      (getLatestWs() as MockWebSocket).simulateClose();
      vi.advanceTimersByTime(1000); // 第 0 次重连

      for (let i = 1; i < 5; i++) {
        (getLatestWs() as MockWebSocket).simulateClose();
        vi.advanceTimersByTime(30000);
      }

      // 第 5 次重连的 WebSocket 也失败
      (getLatestWs() as MockWebSocket).simulateClose();

      const countAfterMax = mockWsInstances.length;
      // 再推进很长时间，不应有新的连接尝试
      vi.advanceTimersByTime(120000);
      expect(mockWsInstances.length).toBe(countAfterMax);
      expect(client.getStatus()).toBe('disconnected');
    });

    it('重连成功后重置尝试次数', () => {
      client.connect('ws://localhost:8080', 'room-1', 'user-a');

      // 第一次连接失败
      (getLatestWs() as MockWebSocket).simulateClose();
      vi.advanceTimersByTime(1000);

      // 第二次连接成功
      (getLatestWs() as MockWebSocket).simulateOpen();
      expect(client.getReconnectAttempts()).toBe(0);
      expect(client.isConnected()).toBe(true);
    });
  });
});
