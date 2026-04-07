import { CollabOperation } from './types';
import { transformAgainst } from './ot';

/**
 * 离线操作缓冲管理器
 *
 * 在 WebSocket 断开期间缓存本地操作，重连后通过 OT 转换
 * 将离线操作与服务器最新状态合并，确保数据一致性。
 *
 * 工作流程：
 * 1. 断网后，本地操作通过 buffer() 缓存
 * 2. 重连后，收到服务器最新状态和 revision
 * 3. 调用 rebase() 将缓存的操作针对服务器操作进行 OT 转换
 * 4. 转换后的操作按序发送到服务器
 */
export class OfflineBuffer {
  // 离线期间缓存的操作列表
  private operations: CollabOperation[] = [];

  /**
   * 缓存一个离线操作
   */
  buffer(op: CollabOperation): void {
    this.operations.push(op);
  }

  /**
   * 获取缓存的操作数量
   */
  size(): number {
    return this.operations.length;
  }

  /**
   * 是否有缓存的操作
   */
  hasOperations(): boolean {
    return this.operations.length > 0;
  }

  /**
   * 将缓存的操作针对服务器操作列表进行 OT 转换（rebase）
   *
   * 类似 git rebase：将本地操作"变基"到服务器最新状态之上。
   * 转换后的操作可以安全地应用到服务器最新状态。
   *
   * @param serverOps 断线期间服务器上发生的操作列表
   * @returns 转换后的操作列表（已过滤掉被消除的操作）
   */
  rebase(serverOps: CollabOperation[]): CollabOperation[] {
    const rebased: CollabOperation[] = [];

    for (const localOp of this.operations) {
      const transformed = transformAgainst(localOp, serverOps);
      if (transformed !== null) {
        rebased.push(transformed);
      }
    }

    return rebased;
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.operations = [];
  }

  /**
   * 获取所有缓存的操作（只读）
   */
  getOperations(): ReadonlyArray<CollabOperation> {
    return this.operations;
  }

  /**
   * 弹出所有缓存的操作并清空缓冲区
   */
  flush(): CollabOperation[] {
    const ops = this.operations;
    this.operations = [];
    return ops;
  }
}
