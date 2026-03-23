// ============================================================
// 数组公式管理器
// 管理数组公式的注册、查询、删除和区域重叠检测
// Requirements: 8.1-8.7
// ============================================================

import { CellPosition, Selection } from '../types';
import { ArrayFormulaInfo, CellGetter, FormulaValue } from './types';

/**
 * 数组公式管理器
 * - 以 "row-col" 字符串为键存储数组公式信息
 * - 支持注册、查询、删除和区域重叠检测
 */
export class ArrayFormulaManager {
  /** 内部存储：key 为 "originRow-originCol" */
  private formulas: Map<string, ArrayFormulaInfo> = new Map();

  /**
   * 生成存储键
   */
  private makeKey(row: number, col: number): string {
    return `${row}-${col}`;
  }

  /**
   * 注册数组公式
   * @param origin 数组公式的起始单元格位置
   * @param formula 公式字符串
   * @param resultRange 结果填充区域
   */
  register(origin: CellPosition, formula: string, resultRange: Selection): void {
    const key = this.makeKey(origin.row, origin.col);
    const info: ArrayFormulaInfo = {
      originRow: origin.row,
      originCol: origin.col,
      formula,
      range: {
        startRow: resultRange.startRow,
        startCol: resultRange.startCol,
        endRow: resultRange.endRow,
        endCol: resultRange.endCol,
      },
    };
    this.formulas.set(key, info);
  }

  /**
   * 检查单元格是否属于某个数组公式区域
   * @param row 行号
   * @param col 列号
   * @returns 是否在数组公式区域内
   */
  isInArrayFormula(row: number, col: number): boolean {
    for (const info of this.formulas.values()) {
      if (
        row >= info.range.startRow &&
        row <= info.range.endRow &&
        col >= info.range.startCol &&
        col <= info.range.endCol
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取单元格所属的数组公式信息
   * @param row 行号
   * @param col 列号
   * @returns 数组公式信息，不在任何数组公式区域内则返回 null
   */
  getArrayFormula(row: number, col: number): ArrayFormulaInfo | null {
    for (const info of this.formulas.values()) {
      if (
        row >= info.range.startRow &&
        row <= info.range.endRow &&
        col >= info.range.startCol &&
        col <= info.range.endCol
      ) {
        return info;
      }
    }
    return null;
  }

  /**
   * 删除数组公式
   * @param originRow 起始单元格行号
   * @param originCol 起始单元格列号
   */
  delete(originRow: number, originCol: number): void {
    const key = this.makeKey(originRow, originCol);
    this.formulas.delete(key);
  }

  /**
   * 检查结果区域是否与已有非空数据重叠
   * 遍历区域内每个单元格，通过 cellGetter 获取值，非空则记录位置
   * @param range 待检查的区域
   * @param cellGetter 单元格值获取器
   * @returns 有非空内容的单元格位置数组
   */
  checkOverlap(range: Selection, cellGetter: CellGetter): CellPosition[] {
    const overlapping: CellPosition[] = [];

    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        const value: FormulaValue = cellGetter(row, col);
        if (this.isNonEmpty(value)) {
          overlapping.push({ row, col });
        }
      }
    }

    return overlapping;
  }

  /**
   * 判断公式值是否为非空
   */
  private isNonEmpty(value: FormulaValue): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return value !== '';
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return true;
    }
    // FormulaError 对象
    if (typeof value === 'object' && !Array.isArray(value) && 'type' in value) {
      return true;
    }
    // 二维数组
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return false;
  }
}
