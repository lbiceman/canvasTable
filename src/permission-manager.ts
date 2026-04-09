// ============================================================
// 操作权限控制模块
// 支持只读/可编辑权限区分，锁定特定单元格区域
// ============================================================

/** 权限级别 */
export type PermissionLevel = 'readonly' | 'editable';

/** 锁定区域 */
export interface LockedRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  password?: string;  // 可选密码保护
  label?: string;     // 区域标签
}

/**
 * 权限管理器
 * 管理文档级别的只读/可编辑权限和单元格区域锁定
 */
export class PermissionManager {
  private permission: PermissionLevel = 'editable';
  private lockedRanges: LockedRange[] = [];
  private onPermissionChange: ((level: PermissionLevel) => void) | null = null;

  /** 设置文档权限级别 */
  setPermission(level: PermissionLevel): void {
    this.permission = level;
    this.onPermissionChange?.(level);
  }

  /** 获取当前权限级别 */
  getPermission(): PermissionLevel {
    return this.permission;
  }

  /** 是否为只读模式 */
  isReadOnly(): boolean {
    return this.permission === 'readonly';
  }

  /** 设置权限变更回调 */
  setOnPermissionChange(callback: (level: PermissionLevel) => void): void {
    this.onPermissionChange = callback;
  }

  /**
   * 锁定单元格区域
   */
  lockRange(range: LockedRange): void {
    // 检查是否与已有锁定区域重叠
    this.lockedRanges.push(range);
  }

  /**
   * 解锁单元格区域
   */
  unlockRange(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    const index = this.lockedRanges.findIndex(r =>
      r.startRow === startRow && r.startCol === startCol &&
      r.endRow === endRow && r.endCol === endCol
    );
    if (index === -1) return false;
    this.lockedRanges.splice(index, 1);
    return true;
  }

  /**
   * 检查单元格是否可编辑
   * 只读模式下所有单元格不可编辑
   * 可编辑模式下检查是否在锁定区域内
   */
  canEdit(row: number, col: number): boolean {
    if (this.isReadOnly()) return false;

    for (const range of this.lockedRanges) {
      if (row >= range.startRow && row <= range.endRow &&
          col >= range.startCol && col <= range.endCol) {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查区域是否可编辑（区域内所有单元格都可编辑才返回 true）
   */
  canEditRange(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    if (this.isReadOnly()) return false;

    for (const range of this.lockedRanges) {
      // 检查两个区域是否有交集
      const hasOverlap =
        startRow <= range.endRow && endRow >= range.startRow &&
        startCol <= range.endCol && endCol >= range.startCol;
      if (hasOverlap) return false;
    }

    return true;
  }

  /** 获取所有锁定区域 */
  getLockedRanges(): LockedRange[] {
    return [...this.lockedRanges];
  }

  /** 清除所有锁定区域 */
  clearLockedRanges(): void {
    this.lockedRanges = [];
  }

  /** 序列化 */
  serialize(): { permission: PermissionLevel; lockedRanges: LockedRange[] } {
    return {
      permission: this.permission,
      lockedRanges: [...this.lockedRanges],
    };
  }

  /** 反序列化 */
  deserialize(data: { permission: PermissionLevel; lockedRanges: LockedRange[] }): void {
    this.permission = data.permission;
    this.lockedRanges = [...data.lockedRanges];
  }
}
