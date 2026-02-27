import { describe, it, expect } from 'vitest';
import { OTClient, OTClientCallbacks } from '../ot-client';
import { CellEditOp, CollabOperation } from '../types';

// 辅助函数：创建测试用的 CellEditOp
const makeEditOp = (
  userId: string,
  row: number,
  col: number,
  content: string,
  previousContent = ''
): CellEditOp => ({
  type: 'cellEdit',
  userId,
  timestamp: Date.now(),
  revision: 0,
  row,
  col,
  content,
  previousContent,
});

// 辅助函数：创建带 mock 回调的 OTClient
const createClient = (revision = 0) => {
  const sent: Array<{ revision: number; op: CollabOperation }> = [];
  const applied: CollabOperation[] = [];

  const callbacks: OTClientCallbacks = {
    sendToServer: (rev, op) => sent.push({ revision: rev, op }),
    applyOperation: (op) => applied.push(op),
  };

  const client = new OTClient(revision, callbacks);
  return { client, sent, applied };
};

describe('OTClient - 初始状态', () => {
  it('初始状态为 synchronized', () => {
    const { client } = createClient();
    expect(client.state).toBe('synchronized');
    expect(client.pending).toBeNull();
    expect(client.buffer).toBeNull();
  });

  it('初始修订号与构造参数一致', () => {
    const { client } = createClient(5);
    expect(client.revision).toBe(5);
  });
});

describe('OTClient - applyLocal', () => {
  it('synchronized 状态下发送操作并进入 awaitingConfirm', () => {
    const { client, sent } = createClient(3);
    const op = makeEditOp('user-a', 0, 0, 'hello');

    client.applyLocal(op);

    expect(client.state).toBe('awaitingConfirm');
    expect(client.pending).toBe(op);
    expect(sent).toHaveLength(1);
    expect(sent[0].revision).toBe(3);
    expect(sent[0].op).toBe(op);
  });

  it('awaitingConfirm 状态下缓冲操作并进入 awaitingWithBuffer', () => {
    const { client } = createClient();
    const op1 = makeEditOp('user-a', 0, 0, 'first');
    const op2 = makeEditOp('user-a', 1, 0, 'second');

    client.applyLocal(op1);
    client.applyLocal(op2);

    expect(client.state).toBe('awaitingWithBuffer');
    expect(client.pending).toBe(op1);
    expect(client.buffer).toBe(op2);
  });

  it('awaitingWithBuffer 状态下替换缓冲操作', () => {
    const { client } = createClient();
    const op1 = makeEditOp('user-a', 0, 0, 'first');
    const op2 = makeEditOp('user-a', 1, 0, 'second');
    const op3 = makeEditOp('user-a', 2, 0, 'third');

    client.applyLocal(op1);
    client.applyLocal(op2);
    client.applyLocal(op3);

    expect(client.state).toBe('awaitingWithBuffer');
    expect(client.pending).toBe(op1);
    expect(client.buffer).toBe(op3);
  });
});

describe('OTClient - serverAck', () => {
  it('awaitingConfirm 状态下确认后回到 synchronized', () => {
    const { client } = createClient(0);
    client.applyLocal(makeEditOp('user-a', 0, 0, 'hello'));

    client.serverAck(1);

    expect(client.state).toBe('synchronized');
    expect(client.pending).toBeNull();
    expect(client.revision).toBe(1);
  });

  it('awaitingWithBuffer 状态下确认后发送缓冲并进入 awaitingConfirm', () => {
    const { client, sent } = createClient(0);
    const op1 = makeEditOp('user-a', 0, 0, 'first');
    const op2 = makeEditOp('user-a', 1, 0, 'second');

    client.applyLocal(op1);
    client.applyLocal(op2);
    expect(sent).toHaveLength(1); // 只发送了 op1

    client.serverAck(1);

    expect(client.state).toBe('awaitingConfirm');
    expect(client.pending).toBe(op2);
    expect(client.buffer).toBeNull();
    expect(client.revision).toBe(1);
    expect(sent).toHaveLength(2); // 现在发送了 op2
    expect(sent[1].revision).toBe(1);
  });
});

describe('OTClient - applyRemote', () => {
  it('synchronized 状态下直接应用远程操作', () => {
    const { client, applied } = createClient(0);
    const remoteOp = makeEditOp('user-b', 5, 5, 'remote');

    client.applyRemote(remoteOp);

    expect(client.state).toBe('synchronized');
    expect(applied).toHaveLength(1);
    expect(applied[0]).toBe(remoteOp);
    expect(client.revision).toBe(1);
  });

  it('awaitingConfirm 状态下转换 pending 并应用远程操作', () => {
    const { client, applied } = createClient(0);
    // 本地编辑 (0,0)
    const localOp = makeEditOp('user-a', 0, 0, 'local');
    client.applyLocal(localOp);

    // 远程编辑不同单元格 (5,5)
    const remoteOp = makeEditOp('user-b', 5, 5, 'remote');
    client.applyRemote(remoteOp);

    expect(client.state).toBe('awaitingConfirm');
    expect(applied).toHaveLength(1);
    expect(client.revision).toBe(1);
    // pending 应该被转换（不同单元格，不受影响）
    expect(client.pending).not.toBeNull();
  });

  it('awaitingWithBuffer 状态下转换 pending 和 buffer 并应用远程操作', () => {
    const { client, applied } = createClient(0);
    // 本地编辑两个不同单元格
    client.applyLocal(makeEditOp('user-a', 0, 0, 'first'));
    client.applyLocal(makeEditOp('user-a', 1, 0, 'second'));

    // 远程编辑不同单元格
    const remoteOp = makeEditOp('user-b', 5, 5, 'remote');
    client.applyRemote(remoteOp);

    expect(client.state).toBe('awaitingWithBuffer');
    expect(applied).toHaveLength(1);
    expect(client.revision).toBe(1);
    expect(client.pending).not.toBeNull();
    expect(client.buffer).not.toBeNull();
  });
});

describe('OTClient - 完整流程', () => {
  it('本地操作 → 远程操作 → 确认 的完整流程', () => {
    const { client, applied } = createClient(0);

    // 1. 本地编辑
    const localOp = makeEditOp('user-a', 0, 0, 'local');
    client.applyLocal(localOp);
    expect(client.state).toBe('awaitingConfirm');

    // 2. 收到远程操作
    const remoteOp = makeEditOp('user-b', 3, 3, 'remote');
    client.applyRemote(remoteOp);
    expect(client.state).toBe('awaitingConfirm');
    expect(applied).toHaveLength(1);

    // 3. 收到确认
    client.serverAck(2);
    expect(client.state).toBe('synchronized');
    expect(client.revision).toBe(2);
  });

  it('多次本地操作和远程操作交错的流程', () => {
    const { client, sent, applied } = createClient(0);

    // 本地操作 1
    client.applyLocal(makeEditOp('user-a', 0, 0, 'a1'));
    expect(client.state).toBe('awaitingConfirm');

    // 本地操作 2（缓冲）
    client.applyLocal(makeEditOp('user-a', 1, 0, 'a2'));
    expect(client.state).toBe('awaitingWithBuffer');

    // 远程操作
    client.applyRemote(makeEditOp('user-b', 5, 5, 'b1'));
    expect(applied).toHaveLength(1);

    // 确认操作 1 → 发送缓冲的操作 2
    client.serverAck(2);
    expect(client.state).toBe('awaitingConfirm');
    expect(sent).toHaveLength(2);

    // 确认操作 2
    client.serverAck(3);
    expect(client.state).toBe('synchronized');
    expect(client.revision).toBe(3);
  });
});
