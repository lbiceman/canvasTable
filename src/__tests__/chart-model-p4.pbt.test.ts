import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import type { ChartType, DataRange } from '../chart/types';
import { CHART_COLORS_LIGHT } from '../chart/types';

/**
 * Property 4: 数据区域标题解析
 *
 * 对于任意包含至少 2 行 2 列数值数据的数据区域，resolveChartData 应将
 * 第一行内容作为系列名称、第一列内容作为类别标签，且系列数据不包含标题行
 * 和标题列的值。
 *
 * **Validates: Requirements 1.5**
 */

// 图表类型生成器
const chartTypeArb: fc.Arbitrary<ChartType> = fc.constantFrom(
  'bar' as const, 'line' as const, 'pie' as const, 'scatter' as const, 'area' as const
);

// 生成矩阵维度（至少 2 行 2 列，含标题行和标题列）
// totalRows >= 2, totalCols >= 2，其中第一行为标题、第一列为标签
const dimensionArb = fc.record({
  totalRows: fc.integer({ min: 2, max: 6 }),
  totalCols: fc.integer({ min: 2, max: 6 }),
});

// 生成系列名称（第一行标题，不可解析为数字的字符串）
const headerStringArb: fc.Arbitrary<string> = fc.constantFrom(
  '销售额', '利润', '成本', '收入', '支出',
  'Q1', 'Q2', 'Q3', 'Q4',
  '产品A', '产品B', '产品C', '产品D',
  '一月', '二月', '三月', '四月'
);

// 生成类别标签（第一列标签）
const categoryStringArb: fc.Arbitrary<string> = fc.constantFrom(
  '北京', '上海', '广州', '深圳', '杭州',
  '2021', '2022', '2023', '2024',
  '部门A', '部门B', '部门C', '部门D'
);

// 生成数值数据（数据区域内的数值）
const numericValueArb: fc.Arbitrary<number> = fc.double({
  min: -1000,
  max: 1000,
  noNaN: true,
  noDefaultInfinity: true,
});

// 生成完整的数据矩阵：标题行 + 标签列 + 数值数据
// 返回 { totalRows, totalCols, headers, categories, dataValues, cornerLabel }
const dataMatrixArb = dimensionArb.chain(({ totalRows, totalCols }) => {
  const dataRows = totalRows - 1; // 去掉标题行
  const dataCols = totalCols - 1; // 去掉标签列

  return fc.tuple(
    fc.constant({ totalRows, totalCols }),
    // 左上角单元格（通常为空或描述性文字）
    fc.constantFrom('', '类别', '项目'),
    // 系列名称（第一行，从第二列开始）
    fc.array(headerStringArb, { minLength: dataCols, maxLength: dataCols }),
    // 类别标签（第一列，从第二行开始）
    fc.array(categoryStringArb, { minLength: dataRows, maxLength: dataRows }),
    // 数值数据矩阵（dataRows × dataCols）
    fc.array(
      fc.array(numericValueArb, { minLength: dataCols, maxLength: dataCols }),
      { minLength: dataRows, maxLength: dataRows }
    )
  );
});

describe('Feature: chart-visualization, Property 4: 数据区域标题解析', () => {
  it('至少 2 行 2 列的数据矩阵应正确分离标题行和标签列', () => {
    fc.assert(
      fc.property(
        dataMatrixArb,
        chartTypeArb,
        ([dim, cornerLabel, headers, categories, dataValues], chartType) => {
          const { totalRows, totalCols } = dim;

          // 创建足够大的表格
          const model = new SpreadsheetModel(totalRows + 5, totalCols + 5);
          const chartModel = new ChartModel(model);

          // 填充左上角单元格
          model.setCellContent(0, 0, cornerLabel);

          // 填充第一行标题（系列名称）
          for (let c = 0; c < headers.length; c++) {
            model.setCellContent(0, c + 1, headers[c]);
          }

          // 填充第一列标签（类别标签）
          for (let r = 0; r < categories.length; r++) {
            model.setCellContent(r + 1, 0, categories[r]);
          }

          // 填充数值数据
          for (let r = 0; r < dataValues.length; r++) {
            for (let c = 0; c < dataValues[r].length; c++) {
              model.setCellContent(r + 1, c + 1, String(dataValues[r][c]));
            }
          }

          // 创建图表
          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: totalRows - 1,
            endCol: totalCols - 1,
          };
          const chartId = chartModel.createChart(chartType, dataRange, { x: 0, y: 0 });

          // 数据区域包含数值，创建应成功
          expect(chartId).not.toBeNull();

          // 解析图表数据
          const chartData = chartModel.resolveChartData(chartId!);

          // 验证 hasData 标志
          expect(chartData.hasData).toBe(true);

          // 验证类别标签数量 = 数据行数（不含标题行）
          const expectedDataRows = totalRows - 1;
          expect(chartData.categories.length).toBe(expectedDataRows);

          // 验证类别标签内容 = 第一列从第二行开始的值
          for (let r = 0; r < expectedDataRows; r++) {
            expect(chartData.categories[r]).toBe(categories[r]);
          }

          // 验证系列数量 = 数据列数（不含标签列）
          const expectedDataCols = totalCols - 1;
          expect(chartData.series.length).toBe(expectedDataCols);

          // 验证每个系列的名称 = 第一行对应列的值
          for (let c = 0; c < expectedDataCols; c++) {
            expect(chartData.series[c].name).toBe(headers[c]);
          }

          // 验证每个系列的数据值数量 = 数据行数
          for (let c = 0; c < expectedDataCols; c++) {
            expect(chartData.series[c].values.length).toBe(expectedDataRows);
          }

          // 验证系列数据值与原始数值矩阵一致
          for (let c = 0; c < expectedDataCols; c++) {
            for (let r = 0; r < expectedDataRows; r++) {
              const expected = dataValues[r][c];
              const actual = chartData.series[c].values[r];
              // parseFloat 解析后的值应与原始值一致
              expect(actual).toBeCloseTo(expected, 5);
            }
          }

          // 验证系列颜色使用 CHART_COLORS_LIGHT 循环分配
          for (let c = 0; c < expectedDataCols; c++) {
            const expectedColor = CHART_COLORS_LIGHT[c % CHART_COLORS_LIGHT.length];
            expect(chartData.series[c].color).toBe(expectedColor);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
