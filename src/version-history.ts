// ============================================================
// 编辑历史/版本回溯模块
// 保存历史版本快照，支持查看和恢复到指定版本
// ============================================================

/** 版本快照 */
export interface VersionSnapshot {
  id: string;
  timestamp: number;
  label: string;
  data: string;  // JSON 序列化的表格数据
}

/**
 * 版本历史管理器
 * 定期保存数据快照，支持查看和恢复到指定版本
 */
export class VersionHistory {
  private snapshots: VersionSnapshot[] = [];
  private maxSnapshots: number;
  private storageKey: string;

  constructor(maxSnapshots: number = 50, storageKey: string = 'spreadsheet-versions') {
    this.maxSnapshots = maxSnapshots;
    this.storageKey = storageKey;
    this.loadFromStorage();
  }

  /**
   * 保存当前版本快照
   * @param data JSON 序列化的表格数据
   * @param label 版本标签（可选）
   */
  saveSnapshot(data: string, label?: string): VersionSnapshot {
    const snapshot: VersionSnapshot = {
      id: this.generateId(),
      timestamp: Date.now(),
      label: label ?? `版本 ${this.snapshots.length + 1}`,
      data,
    };

    this.snapshots.push(snapshot);

    // 超过最大数量时删除最旧的
    while (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    this.saveToStorage();
    return snapshot;
  }

  /** 获取所有版本快照（按时间倒序） */
  getSnapshots(): VersionSnapshot[] {
    return [...this.snapshots].reverse();
  }

  /** 获取指定版本的数据 */
  getSnapshot(id: string): VersionSnapshot | undefined {
    return this.snapshots.find(s => s.id === id);
  }

  /** 删除指定版本 */
  deleteSnapshot(id: string): boolean {
    const index = this.snapshots.findIndex(s => s.id === id);
    if (index === -1) return false;
    this.snapshots.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  /** 获取版本数量 */
  getCount(): number {
    return this.snapshots.length;
  }

  /** 清空所有版本 */
  clear(): void {
    this.snapshots = [];
    this.saveToStorage();
  }

  /** 生成唯一 ID */
  private generateId(): string {
    return `v_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /** 保存到 localStorage */
  private saveToStorage(): void {
    try {
      // 只保存元数据，数据体太大时截断
      const meta = this.snapshots.map(s => ({
        id: s.id,
        timestamp: s.timestamp,
        label: s.label,
        data: s.data,
      }));
      localStorage.setItem(this.storageKey, JSON.stringify(meta));
    } catch {
      // localStorage 空间不足时清理旧版本
      while (this.snapshots.length > 5) {
        this.snapshots.shift();
      }
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.snapshots));
      } catch {
        // 仍然失败则放弃持久化
      }
    }
  }

  /** 从 localStorage 加载 */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.snapshots = JSON.parse(stored);
      }
    } catch {
      this.snapshots = [];
    }
  }
}
