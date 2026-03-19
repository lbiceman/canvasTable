// ============================================================
// 排序与筛选类型定义
// ============================================================

// 排序方向
export type SortDirection = 'asc' | 'desc';

// 排序数据类型
export type SortDataType = 'text' | 'number' | 'date' | 'auto';

// 排序规则
export interface SortRule {
  colIndex: number;
  direction: SortDirection;
  dataType: SortDataType;
}

// 文本筛选操作符
export type TextFilterOperator = 'contains' | 'notContains' | 'equals' | 'startsWith' | 'endsWith';

// 数字筛选操作符
export type NumberFilterOperator = 'equals' | 'notEquals' | 'greaterThan' | 'greaterOrEqual' | 'lessThan' | 'lessOrEqual' | 'between';

// 日期筛选操作符
export type DateFilterOperator = 'equals' | 'before' | 'after' | 'between';

// 筛选条件（联合类型：文本/数字/日期三种变体）
export type FilterCriterion =
  | { type: 'text'; operator: TextFilterOperator; value: string }
  | { type: 'number'; operator: NumberFilterOperator; value: number; value2?: number }
  | { type: 'date'; operator: DateFilterOperator; value: number; value2?: number };

// 筛选逻辑组合方式
export type FilterLogic = 'and' | 'or';

// 列筛选条件
export interface ColumnFilter {
  selectedValues?: Set<string>;
  criteria?: FilterCriterion[];
  logic?: FilterLogic;
}

// 列筛选条件序列化格式（Set 转为 Array）
export interface ColumnFilterSerialized {
  selectedValues?: string[];
  criteria?: FilterCriterion[];
  logic?: FilterLogic;
}

// 排序筛选快照（用于撤销/重做）
export interface SortFilterSnapshot {
  sortRules: SortRule[];
  filterConditions: Array<[number, ColumnFilterSerialized]>;
}
