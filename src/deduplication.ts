// ============================================================
// 去重功能
// 选区内去除重复行，支持选择比较列
// ============================================================

import type { SpreadsheetModel } from './model';

/** 去重选项 */
export interface DeduplicationOptions {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  compareColumns?: number[];  // 用于比较的列索引，为空则比较所有列
}

/** 去重结果 */
export interface DeduplicationResult {
  removedCount: number;       // 删除的重复行数
  uniqueCount: number;        // 保留的唯一行数
  removedRows: number[];      // 被删除的行索引
}

/**
 * 去重引擎
 */
export class DeduplicationEngine {
  /**
   * 查找重复行（不修改数据）
   */
  static findDuplicates(
    model: SpreadsheetModel,
    options: DeduplicationOptions
  ): number[] {
    const { startRow, startCol, endRow, endCol, compareColumns } = options;
    const cols = compareColumns ?? this.getColumnRange(startCol, endCol);
    const seen = new Set<string>();
    const duplicateRows: number[] = [];

    for (let row = startRow; row <= endRow; row++) {
      const key = cols.map(col => {
        const cell = model.getCell(row, col);
        return cell?.content ?? '';
      }).join('\x00');

      if (seen.has(key)) {
        duplicateRows.push(row);
      } else {
        seen.add(key);
      }
    }

    return duplicateRows;
  }

  /**
   * 执行去重：清除重复行的内容
   */
  static execute(
    model: SpreadsheetModel,
    options: DeduplicationOptions
  ): DeduplicationResult {
    const duplicateRows = this.findDuplicates(model, options);
    const { startCol, endCol } = options;

    // 从后往前清除，避免行号偏移
    for (const row of duplicateRows.reverse()) {
      for (let col = startCol; col <= endCol; col++) {
        model.setCellContent(row, col, '');
      }
    }

    return {
      removedCount: duplicateRows.length,
      uniqueCount: (options.endRow - options.startRow + 1) - duplicateRows.length,
      removedRows: duplicateRows,
    };
  }

  /** 生成列范围数组 */
  private static getColumnRange(startCol: number, endCol: number): number[] {
    const cols: number[] = [];
    for (let c = startCol; c <= endCol; c++) {
      cols.push(c);
    }
    return cols;
  }
}
