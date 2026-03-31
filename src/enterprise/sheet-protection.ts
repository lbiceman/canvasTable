// ============================================================
// ICE Excel 企业版 - 工作表保护
// ============================================================

import { SheetProtection, LockedRange } from './types';

/** 工作表保护管理器 */
export class SheetProtectionManager {
  /** 每个 Sheet 的保护配置 */
  private protections: Map<string, SheetProtection> = new Map();
  private onProtectionChange: ((sheetId: string, protection: SheetProtection) => void) | null = null;

  /** 注册保护状态变更回调 */
  setOnProtectionChange(callback: (sheetId: string, protection: SheetProtection) => void): void {
    this.onProtectionChange = callback;
  }

  /** 获取 Sheet 保护配置 */
  getProtection(sheetId: string): SheetProtection | undefined {
    return this.protections.get(sheetId);
  }

  /** Sheet 是否受保护 */
  isProtected(sheetId: string): boolean {
    return this.protections.get(sheetId)?.enabled === true;
  }

  /** 启用工作表保护 */
  enableProtection(sheetId: string, config: Partial<SheetProtection>, password?: string): void {
    const protection: SheetProtection = {
      enabled: true,
      passwordHash: password ? this.hashPassword(password) : undefined,
      allowEditCells: config.allowEditCells ?? false,
      allowFormatCells: config.allowFormatCells ?? false,
      allowInsertRows: config.allowInsertRows ?? false,
      allowUndoRedo: config.allowUndoRedo ?? true,
      lockedRanges: config.lockedRanges ?? [],
    };
    this.protections.set(sheetId, protection);
    this.onProtectionChange?.(sheetId, protection);
  }

  /** 解除工作表保护 */
  disableProtection(sheetId: string, password?: string): boolean {
    const protection = this.protections.get(sheetId);
    if (!protection) return true;

    // 如果设置了密码，需要验证
    if (protection.passwordHash && password) {
      if (this.hashPassword(password) !== protection.passwordHash) {
        return false; // 密码错误
      }
    } else if (protection.passwordHash && !password) {
      return false; // 需要密码但未提供
    }

    protection.enabled = false;
    this.protections.set(sheetId, protection);
    this.onProtectionChange?.(sheetId, protection);
    return true;
  }

  /** 检查单元格是否被锁定 */
  isCellLocked(sheetId: string, row: number, col: number): boolean {
    const protection = this.protections.get(sheetId);
    if (!protection?.enabled) return false;

    // 如果有锁定区域，检查单元格是否在锁定区域内
    if (protection.lockedRanges.length > 0) {
      return protection.lockedRanges.some(range =>
        row >= range.startRow && row <= range.endRow &&
        col >= range.startCol && col <= range.endCol
      );
    }

    // 没有指定锁定区域时，默认所有单元格都锁定
    return true;
  }

  /** 检查是否允许编辑操作 */
  canEditCell(sheetId: string, row: number, col: number): boolean {
    const protection = this.protections.get(sheetId);
    if (!protection?.enabled) return true;
    if (protection.allowEditCells) return true;
    return !this.isCellLocked(sheetId, row, col);
  }

  /** 检查是否允许格式化操作 */
  canFormatCell(sheetId: string): boolean {
    const protection = this.protections.get(sheetId);
    if (!protection?.enabled) return true;
    return protection.allowFormatCells;
  }

  /** 检查是否允许插入行列 */
  canInsertRows(sheetId: string): boolean {
    const protection = this.protections.get(sheetId);
    if (!protection?.enabled) return true;
    return protection.allowInsertRows;
  }

  /** 添加锁定区域 */
  addLockedRange(sheetId: string, range: LockedRange): void {
    const protection = this.protections.get(sheetId);
    if (protection) {
      protection.lockedRanges.push(range);
      this.onProtectionChange?.(sheetId, protection);
    }
  }

  /** 移除锁定区域 */
  removeLockedRange(sheetId: string, index: number): void {
    const protection = this.protections.get(sheetId);
    if (protection && index >= 0 && index < protection.lockedRanges.length) {
      protection.lockedRanges.splice(index, 1);
      this.onProtectionChange?.(sheetId, protection);
    }
  }

  /** 加载保护配置（从服务端） */
  loadProtections(data: Record<string, SheetProtection>): void {
    this.protections.clear();
    for (const [sheetId, protection] of Object.entries(data)) {
      this.protections.set(sheetId, protection);
    }
  }

  /** 导出保护配置 */
  exportProtections(): Record<string, SheetProtection> {
    const result: Record<string, SheetProtection> = {};
    for (const [sheetId, protection] of this.protections) {
      result[sheetId] = protection;
    }
    return result;
  }

  /** 简单哈希（生产环境应使用 PBKDF2） */
  private hashPassword(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转为 32 位整数
    }
    return `pbkdf2:${Math.abs(hash).toString(16)}`;
  }
}
