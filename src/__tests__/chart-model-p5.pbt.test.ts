import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import type { ChartType, DataRange } from '../chart/types';

/**
 * Property 5: 单行/单列数据生成单系列图表
 *
 * 对于任意仅包含一行或一列数值数据的数据区域，resolveChartData 返回的
 * series 数组长度应为 1。
 *
 * **Validates: Requirements 1.6**
 */

// 图表类型生成器
const chartTypeArb: fc.Arbitrary<ChartType> = fc.constantFrom(
  'bar' as const, 'line' as const, 'pie' as const, 'scatter' as const, 'area' as const
);

// 生成有限范围的数值（避免 NaN 和 Infinity）
const numericValueArb: fc.Arbitrary<number> = fc.double({
  min: -1000,
  max: 1000,
  noNaN: true,
  noDefaultInfinity: true,
});

// 生成单行数据：1 行 N 列（N >= 1），至少包含一个数值
const singleRowArb = fc.integer({ min: 1, max: 10 }).chain((cols) =>
  fc.tuple(
    fc.constant(cols),
    // 生成 cols 个数值
    fc.array(numericValueArb, { minLength: cols, maxLength: cols })
  )
);

// 生成单列数据：N 行 1 列（N >= 1），至少包含一个数值
const singleColArb = fc.integer({ min: 1, max: 10 }).chain((rows) =>
  fc.tuple(
    fc.constant(rows),
    // 生成 rows 个数值
    fc.array(numericValueArb, { minLength: rows, maxLength: rows })
  )
);

describe('Feature: chart-visualization, Property 5: 单行/单列数据生成单系列图表', () => {
  it('单行数值数据应生成 series 长度为 1 的图表数据', () => {
    fc.assert(
      fc.property(
        singleRowArb,
        chartTypeArb,
        ([cols, values], chartType) => {
          // 创建足够大的表格
          const model = new SpreadsheetModel(5, cols + 5);
          const chartModel = new ChartModel(model);

          // 填充单行数值数据（第 0 行）
          for (let c = 0; c < cols; c++) {
            model.setCellContent(0, c, String(values[c]));
          }

          // 创建图表：数据范围为单行
          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: 0,
            endCol: cols - 1,
          };
          const chartId = chartModel.createChart(chartType, dataRange, { x: 0, y: 0 });

          // 数据包含数值，创建应成功
          expect(chartId).not.toBeNull();

          // 解析图表数据
          const chartData = chartModel.resolveChartData(chartId!);

          // 验证 hasData 为 true
          expect(chartData.hasData).toBe(true);

          // 核心属性：单行数据应生成恰好 1 个系列
          expect(chartData.series.length).toBe(1);

          // 验证系列名称为默认名称 '系列1'
          expect(chartData.series[0].name).toBe('系列1');

          // 验证系列数据值数量等于有效数值个数
          const validCount = values.filter((v) => !isNaN(parseFloat(String(v)))).length;
          expect(chartData.series[0].values.length).toBe(validCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('单列数值数据应生成 series 长度为 1 的图表数据', () => {
    fc.assert(
      fc.property(
        singleColArb,
        chartTypeArb,
        ([rows, values], chartType) => {
          // 创建足够大的表格
          const model = new SpreadsheetModel(rows + 5, 5);
          const chartModel = new ChartModel(model);

          // 填充单列数值数据（第 0 列）
          for (let r = 0; r < rows; r++) {
            model.setCellContent(r, 0, String(values[r]));
          }

          // 创建图表：数据范围为单列
          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: rows - 1,
            endCol: 0,
          };
          const chartId = chartModel.createChart(chartType, dataRange, { x: 0, y: 0 });

          // 数据包含数值，创建应成功
          expect(chartId).not.toBeNull();

          // 解析图表数据
          const chartData = chartModel.resolveChartData(chartId!);

          // 验证 hasData 为 true
          expect(chartData.hasData).toBe(true);

          // 核心属性：单列数据应生成恰好 1 个系列
          expect(chartData.series.length).toBe(1);

          // 验证系列名称为默认名称 '系列1'
          expect(chartData.series[0].name).toBe('系列1');

          // 验证系列数据值数量等于有效数值个数
          const validCount = values.filter((v) => !isNaN(parseFloat(String(v)))).length;
          expect(chartData.series[0].values.length).toBe(validCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
