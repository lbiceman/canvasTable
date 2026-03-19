// ============================================================
// 排序引擎 - 根据排序规则对行索引数组排序
// ============================================================

import type { Cell } from '../types';
import type { SortRule, SortDirection } from './types';

// 推断的数据类型
type InferredDataType = 'number' | 'date' | 'text' | 'empty';

export class SortEngine {
  /**
   * 根据排序规则对行索引数组排序
   * 空单元格始终排在末尾，多列排序按规则列表顺序依次比较
   */
  static sort(
    rows: number[],
    rules: ReadonlyArray<SortRule>,
    cellGetter: (row: number, col: number) => Cell | null
  ): number[] {
    if (rules.length === 0 || rows.length === 0) {
      return [...rows];
    }

    const sorted = [...rows];
    sorted.sort((rowA, rowB) => {
      for (const rule of rules) {
        const cellA = cellGetter(rowA, rule.colIndex);
        const cellB = cellGetter(rowB, rule.colIndex);
        const cmp = SortEngine.compareCellValues(cellA, cellB, rule.direction);
        if (cmp !== 0) return cmp;
      }
      // 所有规则比较相等时保持原始顺序
      return 0;
    });

    return sorted;
  }

  /**
   * 比较两个单元格的值
   * 空单元格始终排在末尾（无论升序或降序）
   * 数字按数值比较，日期按时间戳比较，文本按 Unicode 比较
   */
  static compareCellValues(
    a: Cell | null,
    b: Cell | null,
    direction: SortDirection
  ): number {
    const typeA = SortEngine.inferDataType(a);
    const typeB = SortEngine.inferDataType(b);

    // 空单元格始终排末尾
    if (typeA === 'empty' && typeB === 'empty') return 0;
    if (typeA === 'empty') return 1;
    if (typeB === 'empty') return -1;

    const multiplier = direction === 'asc' ? 1 : -1;

    // 两个都是数字类型（包括日期，因为日期有 rawValue）
    const rawA = a?.rawValue;
    const rawB = b?.rawValue;

    if (rawA !== undefined && rawB !== undefined) {
      if (rawA < rawB) return -1 * multiplier;
      if (rawA > rawB) return 1 * multiplier;
      return 0;
    }

    // 一个有 rawValue 一个没有，有 rawValue 的排前面
    if (rawA !== undefined && rawB === undefined) return -1 * multiplier;
    if (rawA === undefined && rawB !== undefined) return 1 * multiplier;

    // 都是文本，按 Unicode 比较
    const contentA = a?.content ?? '';
    const contentB = b?.content ?? '';
    const cmp = contentA.localeCompare(contentB);
    return cmp * multiplier;
  }

  /**
   * 推断单元格的比较类型
   * 使用 cell.dataType 和 cell.rawValue 判断
   */
  static inferDataType(cell: Cell | null): InferredDataType {
    if (!cell || cell.content === '' || cell.content === undefined) {
      return 'empty';
    }

    const { dataType } = cell;

    if (dataType === 'number' || dataType === 'currency' || dataType === 'percentage') {
      return 'number';
    }

    if (dataType === 'date') {
      return 'date';
    }

    // 没有明确 dataType 但有 rawValue 的情况
    if (cell.rawValue !== undefined) {
      return 'number';
    }

    return 'text';
  }
}
