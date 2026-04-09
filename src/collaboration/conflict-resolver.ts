// ============================================================
// 协同冲突解决模块
// 检测操作冲突，提供可视化提示和接受/拒绝选项
// ============================================================

import type { CollabOperation } from './types';

/** 冲突信息 */
export interface ConflictInfo {
  localOp: CollabOperation;
  remoteOp: CollabOperation;
  cellKey: string;           // 冲突单元格标识 "row-col"
  timestamp: number;
}

/** 冲突解决回调 */
export interface ConflictResolverCallbacks {
  onConflictDetected: (conflict: ConflictInfo) => void;
  onConflictResolved: (conflict: ConflictInfo, accepted: boolean) => void;
}

/**
 * 协同冲突解决器
 * 检测同一单元格的并发编辑冲突，弹出提示让用户选择
 */
export class ConflictResolver {
  private pendingConflicts: Map<string, ConflictInfo> = new Map();
  private callbacks: ConflictResolverCallbacks | null = null;
  private notificationContainer: HTMLDivElement | null = null;

  /** 设置回调 */
  setCallbacks(callbacks: ConflictResolverCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 检测操作是否与本地待确认操作冲突
   * 当远程操作修改了本地正在编辑的同一单元格时触发冲突
   */
  checkConflict(
    localOp: CollabOperation,
    remoteOp: CollabOperation
  ): ConflictInfo | null {
    // 只检测单元格编辑冲突
    if (localOp.type !== 'cellEdit' || remoteOp.type !== 'cellEdit') return null;

    const localKey = `${localOp.row}-${localOp.col}`;
    const remoteKey = `${remoteOp.row}-${remoteOp.col}`;

    if (localKey !== remoteKey) return null;

    const conflict: ConflictInfo = {
      localOp,
      remoteOp,
      cellKey: localKey,
      timestamp: Date.now(),
    };

    this.pendingConflicts.set(localKey, conflict);
    this.callbacks?.onConflictDetected(conflict);
    return conflict;
  }

  /**
   * 显示冲突提示通知
   */
  showConflictNotification(conflict: ConflictInfo): void {
    this.ensureContainer();

    const notification = document.createElement('div');
    notification.className = 'conflict-notification';

    const message = document.createElement('div');
    message.className = 'conflict-message';
    message.textContent = `单元格 ${conflict.cellKey} 被其他用户同时编辑`;
    notification.appendChild(message);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'conflict-btn-group';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'conflict-accept-btn';
    acceptBtn.textContent = '接受远程修改';
    acceptBtn.addEventListener('click', () => {
      this.resolveConflict(conflict, true);
      notification.remove();
    });

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'conflict-reject-btn';
    rejectBtn.textContent = '保留本地修改';
    rejectBtn.addEventListener('click', () => {
      this.resolveConflict(conflict, false);
      notification.remove();
    });

    btnGroup.appendChild(acceptBtn);
    btnGroup.appendChild(rejectBtn);
    notification.appendChild(btnGroup);

    this.notificationContainer!.appendChild(notification);

    // 10 秒后自动接受远程修改
    setTimeout(() => {
      if (notification.parentNode) {
        this.resolveConflict(conflict, true);
        notification.remove();
      }
    }, 10000);
  }

  /** 解决冲突 */
  private resolveConflict(conflict: ConflictInfo, accepted: boolean): void {
    this.pendingConflicts.delete(conflict.cellKey);
    this.callbacks?.onConflictResolved(conflict, accepted);
  }

  /** 获取待处理冲突数量 */
  getPendingCount(): number {
    return this.pendingConflicts.size;
  }

  /** 确保通知容器存在 */
  private ensureContainer(): void {
    if (!this.notificationContainer) {
      this.notificationContainer = document.createElement('div');
      this.notificationContainer.className = 'conflict-notification-container';
      document.body.appendChild(this.notificationContainer);
    }
  }
}
