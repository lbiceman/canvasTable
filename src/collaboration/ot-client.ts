import { CollabOperation } from './types';
import { transform } from './ot';

// ============================================================
// OT 客户端状态机
// ============================================================

// 客户端状态类型
export type ClientState = 'synchronized' | 'awaitingConfirm' | 'awaitingWithBuffer';

/**
 * OT 客户端回调接口
 * 用于将操作发送到服务器和应用到本地模型
 */
export interface OTClientCallbacks {
  // 将操作发送到服务器
  sendToServer: (revision: number, op: CollabOperation) => void;
  // 将远程操作应用到本地模型
  applyOperation: (op: CollabOperation) => void;
}

/**
 * OT 客户端状态机
 *
 * 采用经典的三状态模型管理客户端与服务器之间的操作同步：
 * - synchronized：无待确认操作，本地与服务器同步
 * - awaitingConfirm：有一个操作已发送到服务器，等待确认
 * - awaitingWithBuffer：等待确认的同时，本地又有新操作缓冲
 *
 * 状态转换：
 * synchronized + 本地操作 → awaitingConfirm（发送到服务器）
 * awaitingConfirm + 服务器确认 → synchronized
 * awaitingConfirm + 本地操作 → awaitingWithBuffer（缓冲操作）
 * awaitingWithBuffer + 服务器确认 → awaitingConfirm（发送缓冲）
 * awaitingWithBuffer + 本地操作 → awaitingWithBuffer（合并到缓冲）
 *
 * 远程操作在任何状态下都需要对 pending/buffer 执行转换后再应用
 */
export class OTClient {
  // 当前状态
  state: ClientState = 'synchronized';
  // 当前修订号（与服务器同步的最新修订号）
  revision: number;
  // 等待服务器确认的操作
  pending: CollabOperation | null = null;
  // 缓冲区中的操作（在等待确认期间产生的新操作）
  buffer: CollabOperation | null = null;

  private readonly callbacks: OTClientCallbacks;

  constructor(revision: number, callbacks: OTClientCallbacks) {
    this.revision = revision;
    this.callbacks = callbacks;
  }

  /**
   * 本地操作：用户执行了编辑
   *
   * - synchronized 状态：发送操作到服务器，进入 awaitingConfirm
   * - awaitingConfirm 状态：将操作放入缓冲区，进入 awaitingWithBuffer
   * - awaitingWithBuffer 状态：将操作合并到缓冲区（保留最新操作）
   */
  applyLocal(op: CollabOperation): void {
    switch (this.state) {
      case 'synchronized': {
        // 发送操作到服务器
        this.callbacks.sendToServer(this.revision, op);
        this.pending = op;
        this.state = 'awaitingConfirm';
        break;
      }
      case 'awaitingConfirm': {
        // 缓冲操作
        this.buffer = op;
        this.state = 'awaitingWithBuffer';
        break;
      }
      case 'awaitingWithBuffer': {
        // 将新操作合并到缓冲区（保留最新操作替换旧缓冲）
        this.buffer = op;
        break;
      }
    }
  }

  /**
   * 服务器确认：收到自己操作的确认
   *
   * - awaitingConfirm 状态：清除 pending，回到 synchronized
   * - awaitingWithBuffer 状态：发送缓冲操作，进入 awaitingConfirm
   */
  serverAck(revision: number): void {
    this.revision = revision;

    switch (this.state) {
      case 'synchronized': {
        // 不应该在 synchronized 状态收到确认，忽略
        break;
      }
      case 'awaitingConfirm': {
        // 操作已确认，回到同步状态
        this.pending = null;
        this.state = 'synchronized';
        break;
      }
      case 'awaitingWithBuffer': {
        // 发送缓冲区中的操作
        const bufferedOp = this.buffer!;
        this.callbacks.sendToServer(this.revision, bufferedOp);
        this.pending = bufferedOp;
        this.buffer = null;
        this.state = 'awaitingConfirm';
        break;
      }
    }
  }

  /**
   * 远程操作：收到其他用户的操作
   *
   * - synchronized 状态：直接应用远程操作
   * - awaitingConfirm 状态：对 pending 和远程操作执行转换
   * - awaitingWithBuffer 状态：对 pending、buffer 和远程操作执行转换
   *
   * 转换确保本地状态与服务器状态保持一致
   */
  applyRemote(remoteOp: CollabOperation): void {
    this.revision++;

    switch (this.state) {
      case 'synchronized': {
        // 直接应用远程操作
        this.callbacks.applyOperation(remoteOp);
        break;
      }
      case 'awaitingConfirm': {
        // 对 pending 和远程操作执行转换
        // transform(pending, remoteOp) → [pending', remoteOp']
        const [pendingPrime, remotePrime] = transform(this.pending!, remoteOp);
        this.pending = pendingPrime;
        // 应用转换后的远程操作
        if (remotePrime !== null) {
          this.callbacks.applyOperation(remotePrime);
        }
        break;
      }
      case 'awaitingWithBuffer': {
        // 先对 pending 和远程操作执行转换
        const [pendingPrime, remotePrime1] = transform(this.pending!, remoteOp);
        this.pending = pendingPrime;

        // 再对 buffer 和转换后的远程操作执行转换
        if (remotePrime1 !== null) {
          const [bufferPrime, remotePrime2] = transform(this.buffer!, remotePrime1);
          this.buffer = bufferPrime;
          // 应用最终转换后的远程操作
          if (remotePrime2 !== null) {
            this.callbacks.applyOperation(remotePrime2);
          }
        } else {
          // 远程操作被消除，不需要应用
          // buffer 保持不变
        }
        break;
      }
    }
  }
}
