import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import { CHART_COLORS_LIGHT } from '../chart/types';
import type { ChartType, DataRange } from '../chart/types';

/**
 * Property 7: 多系列图表颜色唯一性
 *
 * 对于任意包含多个数据系列的图表数据（系列数量不超过配色数组长度），
 * 每个系列分配的颜色应互不相同。
 *
 * **Validates: Requirements 2.3, 2.4**
 */

// 图表类型生成器（柱状图和折线图支持多系列）
const multiSeriesChartTypeArb: fc.Arbitrary<ChartType> = fc.constantFrom(
  'bar' as const,
  'line' as const,
  'area' as const
);

// 生成有限范围的数值
const numericValueArb: fc.Arbitrary<number> = fc.double({
  min: -1000,
  max: 1000,
  noNaN: true,
  noDefaultInfinity: true,
});

// 配色数组长度
const maxUniqueColors = CHART_COLORS_LIGHT.length;

// 生成多系列数据参数：系列数 2~maxUniqueColors，行数 2~10
// 数据区域至少 2 行 2 列（第一行为系列名称，第一列为类别标签）
const multiSeriesParamsArb = fc
  .tuple(
    fc.integer({ min: 2, max: maxUniqueColors }), // 系列数（不超过配色数组长度）
    fc.integer({ min: 2, max: 10 }) // 数据行数（不含标题行）
  )
  .chain(([seriesCount, dataRows]) => {
    // 总列数 = 1（类别列）+ seriesCount
    const totalCols = 1 + seriesCount;
    // 总行数 = 1（标题行）+ dataRows
    const totalRows = 1 + dataRows;

    // 生成数值矩阵（dataRows × seriesCount）
    const valuesArb = fc.array(
      fc.array(numericValueArb, {
        minLength: seriesCount,
        maxLength: seriesCount,
      }),
      { minLength: dataRows, maxLength: dataRows }
    );

    return fc.tuple(
      fc.constant(seriesCount),
      fc.constant(dataRows),
      fc.constant(totalRows),
      fc.constant(totalCols),
      valuesArb
    );
  });

describe('Feature: chart-visualization, Property 7: 多系列图表颜色唯一性', () => {
  it('当系列数量不超过配色数组长度时，每个系列的颜色应互不相同', () => {
    fc.assert(
      fc.property(
        multiSeriesParamsArb,
        multiSeriesChartTypeArb,
        ([seriesCount, dataRows, totalRows, totalCols, values], chartType) => {
          // 创建足够大的表格
          const model = new SpreadsheetModel(totalRows + 5, totalCols + 5);
          const chartModel = new ChartModel(model);

          // 填充标题行（第 0 行）：第 0 列为空（类别列标题），后续列为系列名称
          for (let col = 1; col < totalCols; col++) {
            model.setCellContent(0, col, `系列${col}`);
          }

          // 填充类别列（第 0 列，从第 1 行开始）
          for (let row = 1; row < totalRows; row++) {
            model.setCellContent(row, 0, `类别${row}`);
          }

          // 填充数值数据（从第 1 行第 1 列开始）
          for (let row = 0; row < dataRows; row++) {
            for (let col = 0; col < seriesCount; col++) {
              model.setCellContent(row + 1, col + 1, String(values[row][col]));
            }
          }

          // 创建图表
          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: totalRows - 1,
            endCol: totalCols - 1,
          };
          const chartId = chartModel.createChart(
            chartType,
            dataRange,
            { x: 0, y: 0 }
          );

          expect(chartId).not.toBeNull();

          // 解析图表数据
          const chartData = chartModel.resolveChartData(chartId!);

          // 验证系列数量正确
          expect(chartData.series.length).toBe(seriesCount);

          // 核心属性：提取所有系列颜色，验证互不相同
          const colors = chartData.series.map((s) => s.color);
          const uniqueColors = new Set(colors);
          expect(uniqueColors.size).toBe(colors.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('每个系列的颜色应来自 CHART_COLORS_LIGHT 配色数组', () => {
    fc.assert(
      fc.property(
        multiSeriesParamsArb,
        multiSeriesChartTypeArb,
        ([seriesCount, dataRows, totalRows, totalCols, values], chartType) => {
          const model = new SpreadsheetModel(totalRows + 5, totalCols + 5);
          const chartModel = new ChartModel(model);

          // 填充标题行
          for (let col = 1; col < totalCols; col++) {
            model.setCellContent(0, col, `系列${col}`);
          }

          // 填充类别列
          for (let row = 1; row < totalRows; row++) {
            model.setCellContent(row, 0, `类别${row}`);
          }

          // 填充数值数据
          for (let row = 0; row < dataRows; row++) {
            for (let col = 0; col < seriesCount; col++) {
              model.setCellContent(row + 1, col + 1, String(values[row][col]));
            }
          }

          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: totalRows - 1,
            endCol: totalCols - 1,
          };
          const chartId = chartModel.createChart(
            chartType,
            dataRange,
            { x: 0, y: 0 }
          );

          expect(chartId).not.toBeNull();

          const chartData = chartModel.resolveChartData(chartId!);

          // 验证每个系列颜色都来自配色数组
          for (const series of chartData.series) {
            expect(CHART_COLORS_LIGHT).toContain(series.color);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('系列颜色应按配色数组顺序依次分配', () => {
    fc.assert(
      fc.property(
        multiSeriesParamsArb,
        multiSeriesChartTypeArb,
        ([seriesCount, dataRows, totalRows, totalCols, values], chartType) => {
          const model = new SpreadsheetModel(totalRows + 5, totalCols + 5);
          const chartModel = new ChartModel(model);

          // 填充标题行
          for (let col = 1; col < totalCols; col++) {
            model.setCellContent(0, col, `系列${col}`);
          }

          // 填充类别列
          for (let row = 1; row < totalRows; row++) {
            model.setCellContent(row, 0, `类别${row}`);
          }

          // 填充数值数据
          for (let row = 0; row < dataRows; row++) {
            for (let col = 0; col < seriesCount; col++) {
              model.setCellContent(row + 1, col + 1, String(values[row][col]));
            }
          }

          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: totalRows - 1,
            endCol: totalCols - 1,
          };
          const chartId = chartModel.createChart(
            chartType,
            dataRange,
            { x: 0, y: 0 }
          );

          expect(chartId).not.toBeNull();

          const chartData = chartModel.resolveChartData(chartId!);

          // 验证颜色按顺序分配
          for (let i = 0; i < chartData.series.length; i++) {
            const expectedColor =
              CHART_COLORS_LIGHT[i % CHART_COLORS_LIGHT.length];
            expect(chartData.series[i].color).toBe(expectedColor);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
