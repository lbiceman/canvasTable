// ============================================================
// 数组公式管理器
// 管理数组公式的注册、查询、删除和区域重叠检测
// 支持动态溢出（Spill）行为
// Requirements: 8.1-8.7
// ============================================================

import { CellPosition, Selection } from '../types';
import { ArrayFormulaInfo, CellGetter, FormulaValue } from './types';

/** 溢出信息 */
export interface SpillInfo {
  originRow: number;
  originCol: number;
  formula: string;
  range: { startRow: number; startCol: number; endRow: number; endCol: number };
  isSpill: true;  // 标记为动态溢出（区别于 CSE 数组公式）
}

/**
 * 数组公式管理器
 * - 以 "row-col" 字符串为键存储数组公式信息
 * - 支持注册、查询、删除和区域重叠检测
 * - 支持动态溢出（Spill）管理
 */
export class ArrayFormulaManager {
  /** 内部存储：key 为 "originRow-originCol" */
  private formulas: Map<string, ArrayFormulaInfo> = new Map();
  /** 溢出公式存储：key 为 "originRow-originCol" */
  private spillFormulas: Map<string, SpillInfo> = new Map();
  /** 溢出单元格反向索引：key 为 "row-col"，value 为溢出源的 key */
  private spillCellIndex: Map<string, string> = new Map();

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

  // ============================================================
  // 动态溢出（Spill）管理
  // ============================================================

  /**
   * 注册溢出公式
   * @param origin 溢出源单元格
   * @param formula 公式字符串
   * @param resultRange 溢出结果区域
   */
  registerSpill(origin: CellPosition, formula: string, resultRange: Selection): void {
    const key = this.makeKey(origin.row, origin.col);
    const info: SpillInfo = {
      originRow: origin.row,
      originCol: origin.col,
      formula,
      range: {
        startRow: resultRange.startRow,
        startCol: resultRange.startCol,
        endRow: resultRange.endRow,
        endCol: resultRange.endCol,
      },
      isSpill: true,
    };
    // 先清除旧的溢出索引
    this.clearSpillIndex(key);
    this.spillFormulas.set(key, info);
    // 建立反向索引
    for (let r = resultRange.startRow; r <= resultRange.endRow; r++) {
      for (let c = resultRange.startCol; c <= resultRange.endCol; c++) {
        // 跳过源单元格自身
        if (r === origin.row && c === origin.col) continue;
        this.spillCellIndex.set(this.makeKey(r, c), key);
      }
    }
  }

  /**
   * 删除溢出公式
   */
  deleteSpill(originRow: number, originCol: number): void {
    const key = this.makeKey(originRow, originCol);
    this.clearSpillIndex(key);
    this.spillFormulas.delete(key);
  }

  /**
   * 清除溢出反向索引
   */
  private clearSpillIndex(originKey: string): void {
    const info = this.spillFormulas.get(originKey);
    if (!info) return;
    for (let r = info.range.startRow; r <= info.range.endRow; r++) {
      for (let c = info.range.startCol; c <= info.range.endCol; c++) {
        const cellKey = this.makeKey(r, c);
        if (this.spillCellIndex.get(cellKey) === originKey) {
          this.spillCellIndex.delete(cellKey);
        }
      }
    }
  }

  /**
   * 检查单元格是否是溢出单元格（非源单元格）
   */
  isSpillCell(row: number, col: number): boolean {
    return this.spillCellIndex.has(this.makeKey(row, col));
  }

  /**
   * 获取溢出源信息（通过溢出单元格查找）
   */
  getSpillSource(row: number, col: number): SpillInfo | null {
    const key = this.makeKey(row, col);
    // 先检查是否是溢出源
    const directSpill = this.spillFormulas.get(key);
    if (directSpill) return directSpill;
    // 再检查是否是溢出单元格
    const originKey = this.spillCellIndex.get(key);
    if (originKey) {
      return this.spillFormulas.get(originKey) ?? null;
    }
    return null;
  }

  /**
   * 检查溢出区域是否有阻挡（非空非溢出单元格）
   * @returns 阻挡的单元格位置数组，空数组表示无阻挡
   */
  checkSpillBlocked(
    origin: CellPosition,
    rows: number,
    cols: number,
    cellGetter: CellGetter
  ): CellPosition[] {
    const blocked: CellPosition[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const targetRow = origin.row + r;
        const targetCol = origin.col + c;
        // 跳过源单元格
        if (r === 0 && c === 0) continue;
        // 检查是否已被其他溢出占用
        const existingSpill = this.getSpillSource(targetRow, targetCol);
        if (existingSpill && existingSpill.originRow !== origin.row || existingSpill && existingSpill.originCol !== origin.col) {
          blocked.push({ row: targetRow, col: targetCol });
          continue;
        }
        // 检查是否有非空内容
        const value = cellGetter(targetRow, targetCol);
        if (this.isNonEmpty(value)) {
          blocked.push({ row: targetRow, col: targetCol });
        }
      }
    }
    return blocked;
  }

  /**
   * 获取所有溢出公式
   */
  getAllSpills(): SpillInfo[] {
    return Array.from(this.spillFormulas.values());
  }

  /**
   * 检查单元格是否在溢出区域内（包括源单元格）
   */
  isInSpillRange(row: number, col: number): boolean {
    // 检查是否是溢出源
    if (this.spillFormulas.has(this.makeKey(row, col))) return true;
    // 检查是否是溢出单元格
    return this.spillCellIndex.has(this.makeKey(row, col));
  }
}
