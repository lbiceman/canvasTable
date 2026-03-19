// ============================================================
// 排序筛选数据模型 - 管理排序规则、筛选条件和行索引映射
// ============================================================

import type { Cell } from '../types';
import type {
  SortRule,
  SortDirection,
  ColumnFilter,
  ColumnFilterSerialized,
  SortFilterSnapshot,
} from './types';
import { SortEngine } from './sort-engine';
import { FilterEngine } from './filter-engine';

// 宿主模型接口（避免直接依赖 SpreadsheetModel，防止循环引用）
export interface SortFilterModelHost {
  getCell(row: number, col: number): Cell | null;
  getRowCount(): number;
}

export class SortFilterModel {
  // 排序规则列表
  private sortRules: SortRule[] = [];
  // 筛选条件（列索引 → 列筛选条件）
  private filterConditions: Map<number, ColumnFilter> = new Map();
  // 行索引映射：displayRow → dataRow
  private rowIndexMap: number[] = [];
  // 反向映射：dataRow → displayRow（隐藏行为 -1）
  private reverseMap: Map<number, number> = new Map();
  // 映射变化回调
  private onMapChange: (() => void) | null = null;
  // 宿主模型引用
  private host: SortFilterModelHost;

  constructor(host: SortFilterModelHost) {
    this.host = host;
    // 初始化为恒等映射
    this.buildIdentityMap();
  }

  // ============================================================
  // 排序操作
  // ============================================================

  /** 设置单列排序（清除已有规则，设置新规则） */
  setSingleSort(colIndex: number, direction: SortDirection): void {
    this.sortRules = [{ colIndex, direction, dataType: 'auto' }];
    this.recalculate();
  }

  /** 添加排序规则（追加到列表末尾） */
  addSortRule(rule: SortRule): void {
    // 如果已有同列规则，先移除
    this.sortRules = this.sortRules.filter((r) => r.colIndex !== rule.colIndex);
    this.sortRules.push(rule);
    this.recalculate();
  }

  /** 移除指定列的排序规则 */
  removeSortRule(colIndex: number): void {
    this.sortRules = this.sortRules.filter((r) => r.colIndex !== colIndex);
    this.recalculate();
  }

  /** 清除所有排序规则 */
  clearSort(): void {
    this.sortRules = [];
    this.recalculate();
  }

  /** 获取当前排序规则（只读） */
  getSortRules(): ReadonlyArray<SortRule> {
    return this.sortRules;
  }

  /** 是否有活跃的排序 */
  hasActiveSort(): boolean {
    return this.sortRules.length > 0;
  }

  // ============================================================
  // 筛选操作
  // ============================================================

  /** 设置列筛选条件 */
  setColumnFilter(colIndex: number, filter: ColumnFilter): void {
    this.filterConditions.set(colIndex, filter);
    this.recalculate();
  }

  /** 清除指定列的筛选条件 */
  clearColumnFilter(colIndex: number): void {
    this.filterConditions.delete(colIndex);
    this.recalculate();
  }

  /** 清除所有筛选条件 */
  clearAllFilters(): void {
    this.filterConditions.clear();
    this.recalculate();
  }

  /** 获取指定列的筛选条件 */
  getColumnFilter(colIndex: number): ColumnFilter | undefined {
    return this.filterConditions.get(colIndex);
  }

  /** 获取所有筛选条件（只读） */
  getAllFilters(): ReadonlyMap<number, ColumnFilter> {
    return this.filterConditions;
  }

  /** 指定列是否有活跃筛选 */
  hasActiveFilter(colIndex: number): boolean {
    return this.filterConditions.has(colIndex);
  }

  /** 是否有任何活跃筛选 */
  hasActiveFilters(): boolean {
    return this.filterConditions.size > 0;
  }

  // ============================================================
  // 行索引映射
  // ============================================================

  /** 将显示行号转换为实际数据行号，越界返回 -1 */
  getDataRowIndex(displayRow: number): number {
    if (displayRow < 0 || displayRow >= this.rowIndexMap.length) {
      return -1;
    }
    return this.rowIndexMap[displayRow];
  }

  /** 将实际数据行号转换为显示行号，隐藏行或越界返回 -1 */
  getDisplayRowIndex(dataRow: number): number {
    const displayRow = this.reverseMap.get(dataRow);
    return displayRow !== undefined ? displayRow : -1;
  }

  /** 获取可见行数 */
  getVisibleRowCount(): number {
    return this.rowIndexMap.length;
  }

  /** 获取总行数 */
  getTotalRowCount(): number {
    return this.host.getRowCount();
  }

  /** 获取行索引映射数组（只读） */
  getRowIndexMap(): readonly number[] {
    return this.rowIndexMap;
  }

  /** 排序或筛选是否激活 */
  isActive(): boolean {
    return this.hasActiveSort() || this.hasActiveFilters();
  }

  // ============================================================
  // 重算与映射构建
  // ============================================================

  /** 重新计算行索引映射：先筛选确定可见行，再对可见行排序 */
  recalculate(): void {
    const totalRows = this.host.getRowCount();

    if (!this.hasActiveSort() && !this.hasActiveFilters()) {
      // 无排序筛选，恒等映射
      this.buildIdentityMap();
      if (this.onMapChange) this.onMapChange();
      return;
    }

    // 第一步：筛选确定可见行
    let visibleRows: number[];
    if (this.hasActiveFilters()) {
      visibleRows = FilterEngine.filterRows(
        totalRows,
        this.filterConditions,
        (row, col) => this.host.getCell(row, col)
      );
    } else {
      visibleRows = [];
      for (let i = 0; i < totalRows; i++) {
        visibleRows.push(i);
      }
    }

    // 第二步：对可见行排序
    if (this.hasActiveSort()) {
      visibleRows = SortEngine.sort(
        visibleRows,
        this.sortRules,
        (row, col) => this.host.getCell(row, col)
      );
    }

    // 构建映射
    this.rowIndexMap = visibleRows;
    this.reverseMap = new Map();
    for (let displayRow = 0; displayRow < visibleRows.length; displayRow++) {
      this.reverseMap.set(visibleRows[displayRow], displayRow);
    }

    if (this.onMapChange) this.onMapChange();
  }

  // ============================================================
  // 快照（撤销/重做）
  // ============================================================

  /** 获取当前状态快照（序列化 Set 为 Array） */
  getSnapshot(): SortFilterSnapshot {
    const filterConditions: Array<[number, ColumnFilterSerialized]> = [];
    for (const [colIndex, filter] of this.filterConditions) {
      const serialized: ColumnFilterSerialized = {};
      if (filter.selectedValues !== undefined) {
        serialized.selectedValues = Array.from(filter.selectedValues);
      }
      if (filter.criteria !== undefined) {
        serialized.criteria = [...filter.criteria];
      }
      if (filter.logic !== undefined) {
        serialized.logic = filter.logic;
      }
      filterConditions.push([colIndex, serialized]);
    }

    return {
      sortRules: [...this.sortRules],
      filterConditions,
    };
  }

  /** 从快照恢复状态（反序列化 Array 为 Set） */
  restoreSnapshot(snapshot: SortFilterSnapshot): void {
    this.sortRules = [...snapshot.sortRules];
    this.filterConditions = new Map();
    for (const [colIndex, serialized] of snapshot.filterConditions) {
      const filter: ColumnFilter = {};
      if (serialized.selectedValues !== undefined) {
        filter.selectedValues = new Set(serialized.selectedValues);
      }
      if (serialized.criteria !== undefined) {
        filter.criteria = [...serialized.criteria];
      }
      if (serialized.logic !== undefined) {
        filter.logic = serialized.logic;
      }
      this.filterConditions.set(colIndex, filter);
    }
    this.recalculate();
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /** 获取列的唯一值列表（供 FilterDropdown 使用） */
  getUniqueValues(colIndex: number): string[] {
    return FilterEngine.getUniqueValues(
      colIndex,
      this.host.getRowCount(),
      (row, col) => this.host.getCell(row, col)
    );
  }

  /** 设置映射变化回调 */
  setOnMapChange(callback: () => void): void {
    this.onMapChange = callback;
  }

  /** 构建恒等映射 */
  private buildIdentityMap(): void {
    const totalRows = this.host.getRowCount();
    this.rowIndexMap = [];
    this.reverseMap = new Map();
    for (let i = 0; i < totalRows; i++) {
      this.rowIndexMap.push(i);
      this.reverseMap.set(i, i);
    }
  }
}
