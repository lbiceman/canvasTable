// ============================================================
// 筛选引擎 - 根据筛选条件计算可见行索引
// ============================================================

import type { Cell } from '../types';
import type { ColumnFilter, FilterCriterion } from './types';

export class FilterEngine {
  /**
   * 根据筛选条件返回可见行索引数组
   * 多列筛选之间使用 AND 逻辑组合
   */
  static filterRows(
    totalRows: number,
    filters: ReadonlyMap<number, ColumnFilter>,
    cellGetter: (row: number, col: number) => Cell | null
  ): number[] {
    if (filters.size === 0) {
      // 无筛选条件，返回所有行
      const result: number[] = [];
      for (let i = 0; i < totalRows; i++) {
        result.push(i);
      }
      return result;
    }

    const result: number[] = [];
    for (let row = 0; row < totalRows; row++) {
      let visible = true;
      // 多列筛选使用 AND 逻辑
      for (const [colIndex, filter] of filters) {
        const cell = cellGetter(row, colIndex);
        const cellValue = cell?.content ?? '';
        const rawValue = cell?.rawValue;
        const dataType = cell?.dataType;
        if (!FilterEngine.evaluateColumnFilter(cellValue, rawValue, dataType, filter)) {
          visible = false;
          break;
        }
      }
      if (visible) {
        result.push(row);
      }
    }
    return result;
  }

  /**
   * 评估单个筛选条件
   */
  static evaluateCondition(
    cellValue: string,
    rawValue: number | undefined,
    dataType: string | undefined,
    condition: FilterCriterion
  ): boolean {
    switch (condition.type) {
      case 'text':
        return FilterEngine.evaluateTextCondition(cellValue, condition.operator, condition.value);
      case 'number':
        return FilterEngine.evaluateNumberCondition(rawValue, cellValue, condition.operator, condition.value, condition.value2);
      case 'date':
        return FilterEngine.evaluateDateCondition(rawValue, dataType, condition.operator, condition.value, condition.value2);
      default:
        return true;
    }
  }

  /**
   * 评估列的复合筛选条件（AND/OR 逻辑）
   * 如果 selectedValues 存在，检查成员关系
   * 如果 criteria 存在，按 logic 评估
   */
  static evaluateColumnFilter(
    cellValue: string,
    rawValue: number | undefined,
    dataType: string | undefined,
    filter: ColumnFilter
  ): boolean {
    // 值筛选：检查单元格值是否在选中值集合中
    if (filter.selectedValues !== undefined) {
      if (!filter.selectedValues.has(cellValue)) {
        return false;
      }
    }

    // 条件筛选
    if (filter.criteria && filter.criteria.length > 0) {
      const logic = filter.logic ?? 'and';
      if (logic === 'and') {
        // AND：所有条件都满足
        for (const criterion of filter.criteria) {
          if (!FilterEngine.evaluateCondition(cellValue, rawValue, dataType, criterion)) {
            return false;
          }
        }
        return true;
      } else {
        // OR：至少一个条件满足
        for (const criterion of filter.criteria) {
          if (FilterEngine.evaluateCondition(cellValue, rawValue, dataType, criterion)) {
            return true;
          }
        }
        return false;
      }
    }

    return true;
  }

  /**
   * 推断列数据的筛选类型
   * 全部可解析为数字 → 'number'，全部可解析为日期 → 'date'，否则 → 'text'
   */
  static inferFilterType(values: string[]): 'text' | 'number' | 'date' {
    if (values.length === 0) return 'text';

    const nonEmpty = values.filter((v) => v.trim() !== '');
    if (nonEmpty.length === 0) return 'text';

    // 检查是否全部为数字
    const allNumbers = nonEmpty.every((v) => !isNaN(Number(v)) && v.trim() !== '');
    if (allNumbers) return 'number';

    // 检查是否全部为日期
    const allDates = nonEmpty.every((v) => {
      const ts = Date.parse(v);
      return !isNaN(ts);
    });
    if (allDates) return 'date';

    return 'text';
  }

  /**
   * 获取列的唯一值列表（去重、非空）
   */
  static getUniqueValues(
    colIndex: number,
    totalRows: number,
    cellGetter: (row: number, col: number) => Cell | null
  ): string[] {
    const valueSet = new Set<string>();
    for (let row = 0; row < totalRows; row++) {
      const cell = cellGetter(row, colIndex);
      const content = cell?.content ?? '';
      if (content !== '') {
        valueSet.add(content);
      }
    }
    return Array.from(valueSet);
  }

  // ============================================================
  // 私有辅助方法
  // ============================================================

  /**
   * 评估文本筛选条件
   */
  private static evaluateTextCondition(
    cellValue: string,
    operator: string,
    filterValue: string
  ): boolean {
    const lower = cellValue.toLowerCase();
    const filterLower = filterValue.toLowerCase();

    switch (operator) {
      case 'contains':
        return lower.includes(filterLower);
      case 'notContains':
        return !lower.includes(filterLower);
      case 'equals':
        return lower === filterLower;
      case 'startsWith':
        return lower.startsWith(filterLower);
      case 'endsWith':
        return lower.endsWith(filterLower);
      default:
        return true;
    }
  }

  /**
   * 评估数字筛选条件
   */
  private static evaluateNumberCondition(
    rawValue: number | undefined,
    cellValue: string,
    operator: string,
    filterValue: number,
    filterValue2?: number
  ): boolean {
    // 优先使用 rawValue，否则尝试解析 cellValue
    const numValue = rawValue ?? Number(cellValue);
    if (isNaN(numValue)) return false;

    switch (operator) {
      case 'equals':
        return numValue === filterValue;
      case 'notEquals':
        return numValue !== filterValue;
      case 'greaterThan':
        return numValue > filterValue;
      case 'greaterOrEqual':
        return numValue >= filterValue;
      case 'lessThan':
        return numValue < filterValue;
      case 'lessOrEqual':
        return numValue <= filterValue;
      case 'between': {
        if (filterValue2 === undefined) return false;
        // 自动交换：如果 value > value2
        const min = Math.min(filterValue, filterValue2);
        const max = Math.max(filterValue, filterValue2);
        return numValue >= min && numValue <= max;
      }
      default:
        return true;
    }
  }

  /**
   * 评估日期筛选条件
   */
  private static evaluateDateCondition(
    rawValue: number | undefined,
    _dataType: string | undefined,
    operator: string,
    filterValue: number,
    filterValue2?: number
  ): boolean {
    // 日期使用时间戳比较
    const dateValue = rawValue;
    if (dateValue === undefined) return false;

    switch (operator) {
      case 'equals':
        return dateValue === filterValue;
      case 'before':
        return dateValue < filterValue;
      case 'after':
        return dateValue > filterValue;
      case 'between': {
        if (filterValue2 === undefined) return false;
        // 自动交换
        const min = Math.min(filterValue, filterValue2);
        const max = Math.max(filterValue, filterValue2);
        return dateValue >= min && dateValue <= max;
      }
      default:
        return true;
    }
  }
}
