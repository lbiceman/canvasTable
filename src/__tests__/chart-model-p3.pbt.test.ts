import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import type { ChartType, DataRange } from '../chart/types';

/**
 * Property 3: 非数值数据区域拒绝创建图表
 *
 * 对于任意不包含数值数据的单元格区域，调用 createChart 应返回 null，
 * 且 ChartModel 中的图表数量不变。
 *
 * **Validates: Requirements 1.4**
 */

// 生成不可解析为数值的字符串
// 使用纯字母字符确保 parseFloat 无法解析为数字
const nonNumericStringArb: fc.Arbitrary<string> = fc.constantFrom(
  'hello', 'world', 'foo', 'bar', 'abc', 'xyz',
  '测试', '中文', '数据', '文本',
  'text', 'label', 'name', 'title',
  'true', 'false', 'null', 'undefined',
  '#REF!', 'N/A', '---', '***'
);

// 图表类型生成器
const chartTypeArb: fc.Arbitrary<ChartType> = fc.constantFrom(
  'bar' as const, 'line' as const, 'pie' as const, 'scatter' as const, 'area' as const
);

// 生成矩阵维度（行数和列数）
const dimensionArb = fc.record({
  rows: fc.integer({ min: 1, max: 5 }),
  cols: fc.integer({ min: 1, max: 5 }),
});

// 生成非数值字符串矩阵
const nonNumericMatrixArb = dimensionArb.chain(({ rows, cols }) =>
  fc.tuple(
    fc.constant({ rows, cols }),
    fc.array(
      fc.array(nonNumericStringArb, { minLength: cols, maxLength: cols }),
      { minLength: rows, maxLength: rows }
    )
  )
);

describe('Feature: chart-visualization, Property 3: 非数值数据区域拒绝创建图表', () => {
  it('不含数值的单元格矩阵应导致 createChart 返回 null 且 charts 数量不变', () => {
    fc.assert(
      fc.property(
        nonNumericMatrixArb,
        chartTypeArb,
        ([dim, matrix], chartType) => {
          const { rows, cols } = dim;

          // 创建足够大的表格
          const model = new SpreadsheetModel(rows + 5, cols + 5);
          const chartModel = new ChartModel(model);

          // 填充非数值字符串到表格
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              model.setCellContent(r, c, matrix[r][c]);
            }
          }

          // 记录创建前的图表数量
          const chartsBefore = chartModel.getAllCharts().length;

          // 尝试创建图表
          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: rows - 1,
            endCol: cols - 1,
          };
          const result = chartModel.createChart(chartType, dataRange, { x: 0, y: 0 });

          // 验证：返回 null
          expect(result).toBeNull();

          // 验证：图表数量不变
          expect(chartModel.getAllCharts().length).toBe(chartsBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('全部为空字符串的单元格矩阵应导致 createChart 返回 null', () => {
    fc.assert(
      fc.property(
        dimensionArb,
        chartTypeArb,
        (dim, chartType) => {
          const { rows, cols } = dim;

          const model = new SpreadsheetModel(rows + 5, cols + 5);
          const chartModel = new ChartModel(model);

          // 所有单元格保持默认空字符串，不需要额外填充

          const chartsBefore = chartModel.getAllCharts().length;

          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: rows - 1,
            endCol: cols - 1,
          };
          const result = chartModel.createChart(chartType, dataRange, { x: 0, y: 0 });

          expect(result).toBeNull();
          expect(chartModel.getAllCharts().length).toBe(chartsBefore);
        }
      ),
      { numRuns: 100 }
    );
  });
});
