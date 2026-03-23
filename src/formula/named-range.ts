// ============================================================
// 命名范围管理器
// 管理命名范围的 CRUD 操作、名称验证和行列变化自动调整
// Requirements: 9.1-9.8
// ============================================================

import {
  NamedRange,
  NamedRangeResult,
  NameValidationResult,
  RangeReferenceNode,
} from './types';

/** 单元格引用正则：匹配 A1、B2、AA100、XFD1048576 等格式 */
const CELL_REF_PATTERN = /^[A-Z]{1,3}\d+$/;

/** 保留字列表（不区分大小写） */
const RESERVED_WORDS = new Set(['TRUE', 'FALSE']);

/**
 * 命名范围管理器
 * - 名称存储和查找不区分大小写（内部统一转为大写存储）
 * - 支持创建、更新、删除、解析、获取全部、名称验证
 * - 支持行列插入/删除时自动调整命名范围坐标
 */
export class NamedRangeManager {
  /** 内部存储：key 为大写名称 */
  private ranges: Map<string, NamedRange> = new Map();

  /**
   * 创建命名范围
   * @param name 命名范围名称
   * @param range 区域引用（不含 name 字段）
   * @returns 操作结果
   */
  create(name: string, range: Omit<NamedRange, 'name'>): NamedRangeResult {
    // 验证名称合法性
    const validation = this.validateName(name);
    if (!validation.valid) {
      return { success: false, error: 'invalid_name', message: validation.error };
    }

    // 检查重复名称
    const key = name.toUpperCase();
    if (this.ranges.has(key)) {
      return { success: false, error: 'duplicate', message: `名称 "${name}" 已存在` };
    }

    // 存储命名范围
    const namedRange: NamedRange = {
      name,
      ...range,
    };
    this.ranges.set(key, namedRange);

    return { success: true };
  }

  /**
   * 更新命名范围的区域引用
   * @param name 已有命名范围名称
   * @param range 新的区域引用
   * @returns 操作结果
   */
  update(name: string, range: Omit<NamedRange, 'name'>): NamedRangeResult {
    const key = name.toUpperCase();
    const existing = this.ranges.get(key);
    if (!existing) {
      return { success: false, error: 'invalid_name', message: `名称 "${name}" 不存在` };
    }

    // 更新区域引用，保留原始名称
    const updated: NamedRange = {
      name: existing.name,
      ...range,
    };
    this.ranges.set(key, updated);

    return { success: true };
  }

  /**
   * 删除命名范围
   * @param name 命名范围名称
   * @returns 是否删除成功
   */
  delete(name: string): boolean {
    const key = name.toUpperCase();
    return this.ranges.delete(key);
  }

  /**
   * 根据名称解析命名范围
   * 名称不区分大小写
   * @param name 命名范围名称
   * @returns 命名范围对象或 null
   */
  resolve(name: string): NamedRange | null {
    const key = name.toUpperCase();
    return this.ranges.get(key) ?? null;
  }

  /**
   * 获取所有命名范围
   * @returns 所有命名范围的数组
   */
  getAll(): NamedRange[] {
    return Array.from(this.ranges.values());
  }

  /**
   * 验证名称是否合法
   * 规则：
   * 1. 以字母或下划线开头
   * 2. 只包含字母、数字、下划线、点号
   * 3. 不能与单元格引用冲突（如 A1, B2, AA100）
   * 4. 不能是保留字（TRUE, FALSE）
   * @param name 待验证的名称
   * @returns 验证结果
   */
  validateName(name: string): NameValidationResult {
    // 空名称
    if (!name || name.trim().length === 0) {
      return { valid: false, error: '名称不能为空' };
    }

    // 检查首字符：必须以字母或下划线开头
    const firstChar = name[0];
    if (!/^[a-zA-Z_]$/.test(firstChar)) {
      return { valid: false, error: '名称必须以字母或下划线开头' };
    }

    // 检查所有字符：只允许字母、数字、下划线、点号
    if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name)) {
      return { valid: false, error: '名称只能包含字母、数字、下划线和点号' };
    }

    // 检查是否与单元格引用冲突
    const upper = name.toUpperCase();
    if (CELL_REF_PATTERN.test(upper)) {
      return { valid: false, error: `名称 "${name}" 与单元格引用冲突` };
    }

    // 检查保留字
    if (RESERVED_WORDS.has(upper)) {
      return { valid: false, error: `名称 "${name}" 是保留字` };
    }

    return { valid: true };
  }

  /**
   * 行列插入/删除时自动调整所有命名范围的坐标
   * @param type 操作类型
   * @param index 操作位置（行号或列号，从 0 开始）
   */
  adjustForRowColChange(
    type: 'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol',
    index: number
  ): void {
    for (const [key, namedRange] of this.ranges) {
      const range = namedRange.range;
      const adjusted = this.adjustRange(range, type, index);
      if (adjusted) {
        this.ranges.set(key, { ...namedRange, range: adjusted });
      } else {
        // 删除操作导致范围完全失效时，移除该命名范围
        this.ranges.delete(key);
      }
    }
  }

  /**
   * 调整单个区域引用的坐标
   * @returns 调整后的区域引用，如果范围完全失效则返回 null
   */
  private adjustRange(
    range: RangeReferenceNode,
    type: 'insertRow' | 'deleteRow' | 'insertCol' | 'deleteCol',
    index: number
  ): RangeReferenceNode | null {
    let { startRow, startCol, endRow, endCol } = range;

    switch (type) {
      case 'insertRow':
        // 在 index 处插入行：index 及之后的行号 +1
        if (startRow >= index) startRow++;
        if (endRow >= index) endRow++;
        break;

      case 'deleteRow':
        // 删除 index 行
        // 如果整个范围都在被删除的行上
        if (startRow === index && endRow === index) {
          return null;
        }
        if (startRow > index) startRow--;
        if (endRow >= index && endRow > startRow) {
          endRow--;
        } else if (endRow === index && startRow < index) {
          endRow--;
        }
        break;

      case 'insertCol':
        // 在 index 处插入列：index 及之后的列号 +1
        if (startCol >= index) startCol++;
        if (endCol >= index) endCol++;
        break;

      case 'deleteCol':
        // 删除 index 列
        if (startCol === index && endCol === index) {
          return null;
        }
        if (startCol > index) startCol--;
        if (endCol >= index && endCol > startCol) {
          endCol--;
        } else if (endCol === index && startCol < index) {
          endCol--;
        }
        break;
    }

    return {
      ...range,
      startRow,
      startCol,
      endRow,
      endCol,
    };
  }
}
