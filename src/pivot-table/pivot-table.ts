// 数据透视表引擎 - 负责分组、聚合与汇总计算

import { SpreadsheetModel } from '../model';
import type { Selection } from '../types';

// ============================================================
// 类型定义
// ============================================================

/** 聚合方式 */
export type AggregateFunction = 'sum' | 'count' | 'average' | 'max' | 'min';

/** 透视表字段配置 */
export interface PivotFieldConfig {
  fieldIndex: number;       // 源数据列索引（相对于 sourceRange）
  fieldName: string;        // 字段名（表头文本）
}

/** 值字段配置 */
export interface PivotValueConfig extends PivotFieldConfig {
  aggregateFunc: AggregateFunction;
}

/** 筛选字段配置 */
export interface PivotFilterConfig extends PivotFieldConfig {
  selectedValues: Set<string>;  // 勾选的值
}

/** 透视表完整配置 */
export interface PivotConfig {
  sourceRange: { startRow: number; startCol: number; endRow: number; endCol: number };
  rowFields: PivotFieldConfig[];
  colFields: PivotFieldConfig[];
  valueFields: PivotValueConfig[];
  filterFields: PivotFilterConfig[];
}

/** 透视表计算结果 */
export interface PivotResult {
  headers: string[];          // 列标题
  rows: PivotResultRow[];     // 数据行（含小计行）
  grandTotal: (number | string)[];  // 总计行
}

/** 透视表结果行 */
export interface PivotResultRow {
  labels: string[];           // 行标签
  values: (number | string)[];// 聚合值
  isSubtotal: boolean;        // 是否为小计行
}

// ============================================================
// PivotTable 引擎类
// ============================================================

export class PivotTable {
  private model: SpreadsheetModel;

  constructor(model: SpreadsheetModel) {
    this.model = model;
  }

  /**
   * 验证源数据区域是否有效（非空且包含表头）
   * 至少需要 2 行（1 行表头 + 1 行数据），且表头行有非空单元格
   */
  validateSourceRange(range: Selection): { valid: boolean; error?: string } {
    const { startRow, startCol, endRow, endCol } = range;

    // 检查区域至少包含 2 行（表头 + 数据）
    if (endRow - startRow < 1) {
      return { valid: false, error: '请选择包含表头的非空数据区域' };
    }

    // 检查表头行是否有非空单元格
    let hasHeader = false;
    for (let col = startCol; col <= endCol; col++) {
      const cell = this.model.getCell(startRow, col);
      const content = cell?.content?.trim() ?? '';
      if (content !== '') {
        hasHeader = true;
        break;
      }
    }

    if (!hasHeader) {
      return { valid: false, error: '请选择包含表头的非空数据区域' };
    }

    return { valid: true };
  }

  /**
   * 从源数据区域提取可用字段列表
   * 读取第一行作为字段名，fieldIndex 为相对于 range 的列偏移
   */
  extractFields(range: Selection): PivotFieldConfig[] {
    const fields: PivotFieldConfig[] = [];
    const { startRow, startCol, endCol } = range;

    for (let col = startCol; col <= endCol; col++) {
      const cell = this.model.getCell(startRow, col);
      const content = cell?.content?.trim() ?? '';
      if (content !== '') {
        fields.push({
          fieldIndex: col - startCol,
          fieldName: content,
        });
      }
    }

    return fields;
  }

  /**
   * 执行聚合运算
   * 对数值数组按指定聚合方式计算结果
   */
  aggregate(values: number[], func: AggregateFunction): number {
    switch (func) {
      case 'sum':
        return values.reduce((acc, v) => acc + v, 0);

      case 'count':
        return values.length;

      case 'average':
        if (values.length === 0) return 0;
        return values.reduce((acc, v) => acc + v, 0) / values.length;

      case 'max':
        if (values.length === 0) return 0;
        return Math.max(...values);

      case 'min':
        if (values.length === 0) return 0;
        return Math.min(...values);

      default:
        return 0;
    }
  }

  /**
   * 根据配置计算透视表结果
   * 1. 读取源数据（跳过表头行）
   * 2. 应用筛选字段过滤
   * 3. 按行字段分组
   * 4. 对每组计算值字段聚合
   * 5. 如有列字段，展开列维度
   * 6. 生成小计行和总计行
   */
  compute(config: PivotConfig): PivotResult {
    const { sourceRange, rowFields, colFields, valueFields, filterFields } = config;
    const { startRow, startCol, endRow, endCol } = sourceRange;

    // 1. 读取源数据行（跳过表头行）
    const dataRows: string[][] = [];
    for (let row = startRow + 1; row <= endRow; row++) {
      const rowData: string[] = [];
      for (let col = startCol; col <= endCol; col++) {
        const cell = this.model.getCell(row, col);
        rowData.push(cell?.content ?? '');
      }
      dataRows.push(rowData);
    }

    // 2. 应用筛选字段过滤
    const filteredRows = dataRows.filter((rowData) => {
      return filterFields.every((filter) => {
        const cellValue = rowData[filter.fieldIndex] ?? '';
        return filter.selectedValues.has(cellValue);
      });
    });

    // 无列字段时的简单模式
    if (colFields.length === 0) {
      return this.computeWithoutColFields(filteredRows, rowFields, valueFields);
    }

    // 有列字段时的展开模式
    return this.computeWithColFields(filteredRows, rowFields, colFields, valueFields);
  }

  /**
   * 无列字段时的计算逻辑
   * 按行字段分组，直接聚合值字段
   */
  private computeWithoutColFields(
    dataRows: string[][],
    rowFields: PivotFieldConfig[],
    valueFields: PivotValueConfig[]
  ): PivotResult {
    // 构建列标题：行字段名 + 值字段名（含聚合方式）
    const headers: string[] = [
      ...rowFields.map((f) => f.fieldName),
      ...valueFields.map((v) => `${v.fieldName}(${this.getAggregateFuncLabel(v.aggregateFunc)})`),
    ];

    // 按行字段分组
    const groups = this.groupByRowFields(dataRows, rowFields);

    const rows: PivotResultRow[] = [];
    const grandTotalValues: number[][] = valueFields.map(() => []);

    // 获取排序后的分组键
    const groupKeys = Array.from(groups.keys());

    // 按第一个行字段值分组，用于生成小计行
    const firstFieldGroups = new Map<string, string[]>();
    if (rowFields.length > 1) {
      for (const key of groupKeys) {
        const firstLabel = key.split('\x00')[0];
        if (!firstFieldGroups.has(firstLabel)) {
          firstFieldGroups.set(firstLabel, []);
        }
        firstFieldGroups.get(firstLabel)!.push(key);
      }
    }

    // 遍历分组生成数据行
    let currentFirstLabel = '';
    const subtotalAccumulators: number[][] = valueFields.map(() => []);

    for (const key of groupKeys) {
      const groupRows = groups.get(key)!;
      const labels = key.split('\x00');
      const firstLabel = labels[0] ?? '';

      // 检测第一个行字段值变化，输出上一组的小计行
      if (rowFields.length > 1 && currentFirstLabel !== '' && firstLabel !== currentFirstLabel) {
        rows.push(this.createSubtotalRow(
          currentFirstLabel,
          rowFields.length,
          subtotalAccumulators,
          valueFields
        ));
        // 重置小计累加器
        subtotalAccumulators.forEach((arr) => arr.length = 0);
      }
      currentFirstLabel = firstLabel;

      // 计算每个值字段的聚合结果
      const values: (number | string)[] = [];
      for (let vi = 0; vi < valueFields.length; vi++) {
        const vf = valueFields[vi];
        const rawValues = this.extractNumericValues(groupRows, vf.fieldIndex, vf.aggregateFunc);

        if (vf.aggregateFunc === 'count') {
          // count 计算所有值（包括非数值）
          const countVal = groupRows.length;
          values.push(countVal);
          grandTotalValues[vi].push(...groupRows.map(() => 1));
          subtotalAccumulators[vi].push(...groupRows.map(() => 1));
        } else {
          const result = this.aggregate(rawValues, vf.aggregateFunc);
          values.push(result);
          grandTotalValues[vi].push(...rawValues);
          subtotalAccumulators[vi].push(...rawValues);
        }
      }

      rows.push({ labels, values, isSubtotal: false });
    }

    // 输出最后一组的小计行
    if (rowFields.length > 1 && currentFirstLabel !== '') {
      rows.push(this.createSubtotalRow(
        currentFirstLabel,
        rowFields.length,
        subtotalAccumulators,
        valueFields
      ));
    }

    // 单行字段时也生成小计行（每个分组末尾）
    if (rowFields.length === 1 && groupKeys.length > 0) {
      // 单行字段模式下，每个分组本身就是最终行，小计行在所有行之后作为总计
      // 不需要额外小计行
    }

    // 计算总计行
    const grandTotal: (number | string)[] = valueFields.map((vf, vi) => {
      if (vf.aggregateFunc === 'count') {
        return grandTotalValues[vi].length;
      }
      return this.aggregate(grandTotalValues[vi], vf.aggregateFunc);
    });

    return { headers, rows, grandTotal };
  }

  /**
   * 有列字段时的计算逻辑
   * 按行字段分组，按列字段展开，交叉聚合值字段
   */
  private computeWithColFields(
    dataRows: string[][],
    rowFields: PivotFieldConfig[],
    colFields: PivotFieldConfig[],
    valueFields: PivotValueConfig[]
  ): PivotResult {
    // 收集列字段的唯一值（用于展开列标题）
    const colUniqueValues = this.getUniqueColValues(dataRows, colFields);

    // 构建列标题：行字段名 + (列值 × 值字段名)
    const headers: string[] = [...rowFields.map((f) => f.fieldName)];
    for (const colVal of colUniqueValues) {
      for (const vf of valueFields) {
        headers.push(`${colVal} - ${vf.fieldName}(${this.getAggregateFuncLabel(vf.aggregateFunc)})`);
      }
    }

    // 按行字段分组
    const groups = this.groupByRowFields(dataRows, rowFields);
    const groupKeys = Array.from(groups.keys());

    const rows: PivotResultRow[] = [];
    // 总计累加器：colUniqueValues.length * valueFields.length
    const grandTotalAccumulators: number[][][] = colUniqueValues.map(() =>
      valueFields.map(() => [])
    );
    const grandTotalCountAccumulators: number[][] = colUniqueValues.map(() =>
      valueFields.map(() => 0)
    );

    // 小计追踪
    let currentFirstLabel = '';
    const subtotalAccumulators: number[][][] = colUniqueValues.map(() =>
      valueFields.map(() => [])
    );
    const subtotalCountAccumulators: number[][] = colUniqueValues.map(() =>
      valueFields.map(() => 0)
    );

    for (const key of groupKeys) {
      const groupRows = groups.get(key)!;
      const labels = key.split('\x00');
      const firstLabel = labels[0] ?? '';

      // 检测第一个行字段值变化，输出小计行
      if (rowFields.length > 1 && currentFirstLabel !== '' && firstLabel !== currentFirstLabel) {
        rows.push(this.createColSubtotalRow(
          currentFirstLabel, rowFields.length, colUniqueValues, valueFields,
          subtotalAccumulators, subtotalCountAccumulators
        ));
        this.resetAccumulators(subtotalAccumulators, subtotalCountAccumulators);
      }
      currentFirstLabel = firstLabel;

      // 按列字段值分桶
      const colBuckets = new Map<string, string[][]>();
      for (const row of groupRows) {
        const colKey = colFields.map((cf) => row[cf.fieldIndex] ?? '').join('\x00');
        if (!colBuckets.has(colKey)) {
          colBuckets.set(colKey, []);
        }
        colBuckets.get(colKey)!.push(row);
      }

      // 计算每个列值 × 值字段的聚合结果
      const values: (number | string)[] = [];
      for (let ci = 0; ci < colUniqueValues.length; ci++) {
        const colKey = colUniqueValues[ci];
        const bucketRows = colBuckets.get(colKey) ?? [];

        for (let vi = 0; vi < valueFields.length; vi++) {
          const vf = valueFields[vi];
          if (vf.aggregateFunc === 'count') {
            const countVal = bucketRows.length;
            values.push(countVal);
            grandTotalCountAccumulators[ci][vi] += countVal;
            subtotalCountAccumulators[ci][vi] += countVal;
          } else {
            const rawValues = this.extractNumericValues(bucketRows, vf.fieldIndex, vf.aggregateFunc);
            const result = this.aggregate(rawValues, vf.aggregateFunc);
            values.push(bucketRows.length > 0 ? result : 0);
            grandTotalAccumulators[ci][vi].push(...rawValues);
            subtotalAccumulators[ci][vi].push(...rawValues);
          }
        }
      }

      rows.push({ labels, values, isSubtotal: false });
    }

    // 输出最后一组的小计行
    if (rowFields.length > 1 && currentFirstLabel !== '') {
      rows.push(this.createColSubtotalRow(
        currentFirstLabel, rowFields.length, colUniqueValues, valueFields,
        subtotalAccumulators, subtotalCountAccumulators
      ));
    }

    // 计算总计行
    const grandTotal: (number | string)[] = [];
    for (let ci = 0; ci < colUniqueValues.length; ci++) {
      for (let vi = 0; vi < valueFields.length; vi++) {
        const vf = valueFields[vi];
        if (vf.aggregateFunc === 'count') {
          grandTotal.push(grandTotalCountAccumulators[ci][vi]);
        } else {
          grandTotal.push(this.aggregate(grandTotalAccumulators[ci][vi], vf.aggregateFunc));
        }
      }
    }

    return { headers, rows, grandTotal };
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 按行字段分组数据行
   * 返回 Map<组合键, 数据行数组>，组合键用 \x00 分隔
   */
  private groupByRowFields(
    dataRows: string[][],
    rowFields: PivotFieldConfig[]
  ): Map<string, string[][]> {
    const groups = new Map<string, string[][]>();

    for (const row of dataRows) {
      const key = rowFields.map((f) => row[f.fieldIndex] ?? '').join('\x00');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    return groups;
  }

  /**
   * 从数据行中提取指定字段的数值
   * 非数值数据在 sum/average/max/min 时忽略
   * count 模式不调用此方法（直接计数）
   */
  private extractNumericValues(
    rows: string[][],
    fieldIndex: number,
    _func: AggregateFunction
  ): number[] {
    const values: number[] = [];
    for (const row of rows) {
      const raw = row[fieldIndex] ?? '';
      const num = Number(raw);
      if (!isNaN(num) && raw.trim() !== '') {
        values.push(num);
      }
    }
    return values;
  }

  /**
   * 获取列字段的唯一值组合（用于展开列标题）
   * 多个列字段时用 \x00 连接
   */
  private getUniqueColValues(
    dataRows: string[][],
    colFields: PivotFieldConfig[]
  ): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const row of dataRows) {
      const key = colFields.map((cf) => row[cf.fieldIndex] ?? '').join('\x00');
      if (!seen.has(key)) {
        seen.add(key);
        result.push(key);
      }
    }

    return result;
  }

  /**
   * 获取聚合方式的中文标签
   */
  private getAggregateFuncLabel(func: AggregateFunction): string {
    const labels: Record<AggregateFunction, string> = {
      sum: '求和',
      count: '计数',
      average: '平均值',
      max: '最大值',
      min: '最小值',
    };
    return labels[func];
  }

  /**
   * 创建小计行（无列字段模式）
   */
  private createSubtotalRow(
    firstLabel: string,
    rowFieldCount: number,
    accumulators: number[][],
    valueFields: PivotValueConfig[]
  ): PivotResultRow {
    const labels = [firstLabel + ' 小计'];
    // 填充剩余行标签为空
    for (let i = 1; i < rowFieldCount; i++) {
      labels.push('');
    }

    const values: (number | string)[] = valueFields.map((vf, vi) => {
      if (vf.aggregateFunc === 'count') {
        return accumulators[vi].length;
      }
      return this.aggregate(accumulators[vi], vf.aggregateFunc);
    });

    return { labels, values, isSubtotal: true };
  }

  /**
   * 创建小计行（有列字段模式）
   */
  private createColSubtotalRow(
    firstLabel: string,
    rowFieldCount: number,
    colUniqueValues: string[],
    valueFields: PivotValueConfig[],
    accumulators: number[][][],
    countAccumulators: number[][]
  ): PivotResultRow {
    const labels = [firstLabel + ' 小计'];
    for (let i = 1; i < rowFieldCount; i++) {
      labels.push('');
    }

    const values: (number | string)[] = [];
    for (let ci = 0; ci < colUniqueValues.length; ci++) {
      for (let vi = 0; vi < valueFields.length; vi++) {
        const vf = valueFields[vi];
        if (vf.aggregateFunc === 'count') {
          values.push(countAccumulators[ci][vi]);
        } else {
          values.push(this.aggregate(accumulators[ci][vi], vf.aggregateFunc));
        }
      }
    }

    return { labels, values, isSubtotal: true };
  }

  /**
   * 重置累加器（小计行输出后清零）
   */
  private resetAccumulators(
    accumulators: number[][][],
    countAccumulators: number[][]
  ): void {
    for (let ci = 0; ci < accumulators.length; ci++) {
      for (let vi = 0; vi < accumulators[ci].length; vi++) {
        accumulators[ci][vi] = [];
        countAccumulators[ci][vi] = 0;
      }
    }
  }
}
