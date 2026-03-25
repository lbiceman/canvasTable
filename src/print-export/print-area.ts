// ============================================================
// 打印区域管理模块 — 管理用户自定义的打印范围
// ============================================================

import type { Cell } from '../types';
import type { CellRange } from './types';

/**
 * SpreadsheetModel 的最小接口，避免循环依赖。
 * 仅需要访问单元格数据和行列数即可检测数据范围。
 */
interface SpreadsheetModelLike {
  cells: Cell[][];
  getRowCount(): number;
  getColCount(): number;
}

/**
 * 判断单元格是否包含有效数据（非空）。
 *
 * 以下情况视为有数据：
 * - content 不为空字符串
 * - 存在 rawValue（数值型数据）
 * - 存在 formulaContent（公式）
 */
const isCellNonEmpty = (cell: Cell | undefined | null): boolean => {
  if (!cell) return false;
  if (cell.content !== '') return true;
  if (cell.rawValue !== undefined) return true;
  if (cell.formulaContent !== undefined && cell.formulaContent !== '') return true;
  return false;
};

/**
 * PrintArea — 打印区域管理类
 *
 * 管理用户自定义的打印范围。支持设置、清除、查询状态，
 * 以及在未设置时自动检测数据范围作为默认打印区域。
 */
export class PrintArea {
  /** 用户设置的打印区域，null 表示未设置 */
  private range: CellRange | null = null;

  /**
   * 设置打印区域
   *
   * @param range - 用户选中的单元格范围
   */
  set(range: CellRange): void {
    this.range = { ...range };
  }

  /**
   * 清除打印区域，恢复为默认（打印所有数据）
   */
  clear(): void {
    this.range = null;
  }

  /**
   * 是否已设置自定义打印区域
   */
  isSet(): boolean {
    return this.range !== null;
  }

  /**
   * 获取有效打印范围。
   *
   * - 已设置打印区域时，返回用户设置的范围
   * - 未设置时，自动检测模型中所有非空单元格的边界范围
   * - 如果模型中没有任何数据，返回 (0,0)-(0,0) 的最小范围
   *
   * @param model - 电子表格数据模型（使用最小接口避免循环依赖）
   */
  getEffectiveRange(model: SpreadsheetModelLike): CellRange {
    if (this.range !== null) {
      return { ...this.range };
    }

    return PrintArea.detectDataRange(model);
  }

  /**
   * 序列化为 JSON（用于持久化）。
   * 未设置时返回 null。
   */
  serialize(): CellRange | null {
    if (this.range === null) return null;
    return { ...this.range };
  }

  /**
   * 从 JSON 反序列化，创建 PrintArea 实例。
   *
   * @param data - 序列化数据，null 表示未设置打印区域
   */
  static deserialize(data: CellRange | null): PrintArea {
    const printArea = new PrintArea();
    if (data !== null) {
      printArea.set(data);
    }
    return printArea;
  }

  /**
   * 检测模型中所有非空单元格的边界范围。
   *
   * 遍历 model.cells 二维数组，找到包含所有非空单元格的最小矩形。
   * 如果没有任何非空单元格，返回 (0,0)-(0,0) 的最小范围。
   */
  private static detectDataRange(model: SpreadsheetModelLike): CellRange {
    const rowCount = model.getRowCount();
    const colCount = model.getColCount();

    let minRow = Infinity;
    let minCol = Infinity;
    let maxRow = -Infinity;
    let maxCol = -Infinity;

    for (let r = 0; r < rowCount; r++) {
      const row = model.cells[r];
      if (!row) continue;

      for (let c = 0; c < colCount; c++) {
        if (isCellNonEmpty(row[c])) {
          if (r < minRow) minRow = r;
          if (r > maxRow) maxRow = r;
          if (c < minCol) minCol = c;
          if (c > maxCol) maxCol = c;
        }
      }
    }

    // 没有任何非空单元格时，返回最小范围
    if (minRow === Infinity) {
      return { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
    }

    return {
      startRow: minRow,
      startCol: minCol,
      endRow: maxRow,
      endCol: maxCol,
    };
  }
}
