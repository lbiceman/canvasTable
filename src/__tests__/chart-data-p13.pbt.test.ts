import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import type { ChartType, DataRange } from '../chart/types';

/**
 * Property 13: 数据变更传播到图表
 *
 * 对于任意图表及其数据源范围内的单元格，修改该单元格的数值后，
 * resolveChartData 返回的数据应反映新值。
 *
 * **Validates: Requirements 5.1, 5.3**
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



describe('Feature: chart-visualization, Property 13: 数据变更传播到图表', () => {
  /**
   * 测试多行多列场景：修改数据区域内的数值单元格后，
   * resolveChartData 返回的系列数据应反映新值。
   */
  it('多行多列：修改数据范围内单元格后 resolveChartData 应反映新值', () => {
    fc.assert(
      fc.property(
        // 生成矩阵维度（至少 2 行 2 列，含标题行和标签列）
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 2, max: 6 }),
        chartTypeArb,
        numericValueArb,
        (totalRows, totalCols, chartType, newValue) => {
          const dataRows = totalRows - 1; // 数据行数（不含标题行）
          const dataCols = totalCols - 1; // 数据列数（不含标签列）

          // 创建表格并填充初始数据
          const model = new SpreadsheetModel(totalRows + 5, totalCols + 5);
          const chartModel = new ChartModel(model);

          // 填充标题行（第一行，从第二列开始）
          for (let c = 0; c < dataCols; c++) {
            model.setCellContent(0, c + 1, `系列${c + 1}`);
          }

          // 填充标签列（第一列，从第二行开始）
          for (let r = 0; r < dataRows; r++) {
            model.setCellContent(r + 1, 0, `类别${r + 1}`);
          }

          // 填充初始数值数据（从 (1,1) 开始）
          for (let r = 0; r < dataRows; r++) {
            for (let c = 0; c < dataCols; c++) {
              model.setCellContent(r + 1, c + 1, String(r * 10 + c));
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
          expect(chartId).not.toBeNull();

          // 选择一个随机的数据单元格进行修改（数据区域从 (1,1) 开始）
          const targetDataRow = (Math.abs(Math.round(newValue * 7)) % dataRows);
          const targetDataCol = (Math.abs(Math.round(newValue * 13)) % dataCols);
          const targetRow = targetDataRow + 1;
          const targetCol = targetDataCol + 1;

          // 修改单元格值
          model.setCellContent(targetRow, targetCol, String(newValue));

          // 调用 resolveChartData 验证数据反映了新值
          const chartData = chartModel.resolveChartData(chartId!);

          expect(chartData.hasData).toBe(true);
          expect(chartData.series.length).toBe(dataCols);

          // 验证被修改的单元格值已传播
          const actualValue = chartData.series[targetDataCol].values[targetDataRow];
          expect(actualValue).toBeCloseTo(newValue, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 测试单行场景：修改单行数据范围内的单元格后，
   * resolveChartData 返回的单系列数据应反映新值。
   */
  it('单行：修改数据范围内单元格后 resolveChartData 应反映新值', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }), // 列数
        chartTypeArb,
        numericValueArb,
        (cols, chartType, newValue) => {
          const model = new SpreadsheetModel(10, cols + 5);
          const chartModel = new ChartModel(model);

          // 填充单行初始数值数据
          for (let c = 0; c < cols; c++) {
            model.setCellContent(0, c, String(c + 1));
          }

          // 创建图表（单行数据范围）
          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: 0,
            endCol: cols - 1,
          };
          const chartId = chartModel.createChart(chartType, dataRange, { x: 0, y: 0 });
          expect(chartId).not.toBeNull();

          // 选择一个随机列进行修改
          const targetCol = Math.abs(Math.round(newValue * 7)) % cols;

          // 修改单元格值
          model.setCellContent(0, targetCol, String(newValue));

          // 调用 resolveChartData 验证
          const chartData = chartModel.resolveChartData(chartId!);

          expect(chartData.hasData).toBe(true);
          expect(chartData.series.length).toBe(1);

          // 单行模式下，values 包含该行所有可解析为数值的值
          // 找到 newValue 在 values 中的位置并验证
          // 由于 resolveSingleRow 只收集可解析为数值的值，
          // 我们需要重新构建预期的 values 数组
          const expectedValues: number[] = [];
          for (let c = 0; c < cols; c++) {
            const cell = model.getCell(0, c);
            const content = cell?.content ?? '';
            const num = parseFloat(content);
            if (!isNaN(num)) {
              expectedValues.push(num);
            }
          }

          expect(chartData.series[0].values.length).toBe(expectedValues.length);
          for (let i = 0; i < expectedValues.length; i++) {
            expect(chartData.series[0].values[i]).toBeCloseTo(expectedValues[i], 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 测试单列场景：修改单列数据范围内的单元格后，
   * resolveChartData 返回的单系列数据应反映新值。
   */
  it('单列：修改数据范围内单元格后 resolveChartData 应反映新值', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }), // 行数
        chartTypeArb,
        numericValueArb,
        (rows, chartType, newValue) => {
          const model = new SpreadsheetModel(rows + 5, 10);
          const chartModel = new ChartModel(model);

          // 填充单列初始数值数据
          for (let r = 0; r < rows; r++) {
            model.setCellContent(r, 0, String(r + 1));
          }

          // 创建图表（单列数据范围）
          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: rows - 1,
            endCol: 0,
          };
          const chartId = chartModel.createChart(chartType, dataRange, { x: 0, y: 0 });
          expect(chartId).not.toBeNull();

          // 选择一个随机行进行修改
          const targetRow = Math.abs(Math.round(newValue * 7)) % rows;

          // 修改单元格值
          model.setCellContent(targetRow, 0, String(newValue));

          // 调用 resolveChartData 验证
          const chartData = chartModel.resolveChartData(chartId!);

          expect(chartData.hasData).toBe(true);
          expect(chartData.series.length).toBe(1);

          // 单列模式下，重新构建预期的 values 数组
          const expectedValues: number[] = [];
          for (let r = 0; r < rows; r++) {
            const cell = model.getCell(r, 0);
            const content = cell?.content ?? '';
            const num = parseFloat(content);
            if (!isNaN(num)) {
              expectedValues.push(num);
            }
          }

          expect(chartData.series[0].values.length).toBe(expectedValues.length);
          for (let i = 0; i < expectedValues.length; i++) {
            expect(chartData.series[0].values[i]).toBeCloseTo(expectedValues[i], 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 测试多次连续修改：对数据范围内多个单元格连续修改后，
   * resolveChartData 应反映所有最新值。
   */
  it('多次连续修改后 resolveChartData 应反映所有最新值', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 6 }), // totalRows
        fc.integer({ min: 3, max: 6 }), // totalCols
        chartTypeArb,
        // 生成多个修改操作：每个操作包含 [dataRowOffset, dataColOffset, newValue]
        fc.array(
          fc.tuple(
            fc.integer({ min: 0, max: 4 }),
            fc.integer({ min: 0, max: 4 }),
            numericValueArb
          ),
          { minLength: 2, maxLength: 5 }
        ),
        (totalRows, totalCols, chartType, modifications) => {
          const dataRows = totalRows - 1;
          const dataCols = totalCols - 1;

          const model = new SpreadsheetModel(totalRows + 5, totalCols + 5);
          const chartModel = new ChartModel(model);

          // 填充标题行
          for (let c = 0; c < dataCols; c++) {
            model.setCellContent(0, c + 1, `S${c + 1}`);
          }

          // 填充标签列
          for (let r = 0; r < dataRows; r++) {
            model.setCellContent(r + 1, 0, `C${r + 1}`);
          }

          // 填充初始数值数据
          for (let r = 0; r < dataRows; r++) {
            for (let c = 0; c < dataCols; c++) {
              model.setCellContent(r + 1, c + 1, String(100 + r * 10 + c));
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
          expect(chartId).not.toBeNull();

          // 执行多次修改（将偏移量限制在有效范围内）
          for (const [rowOff, colOff, newVal] of modifications) {
            const r = (rowOff % dataRows) + 1;
            const c = (colOff % dataCols) + 1;
            model.setCellContent(r, c, String(newVal));
          }

          // 调用 resolveChartData 验证所有值
          const chartData = chartModel.resolveChartData(chartId!);

          expect(chartData.hasData).toBe(true);
          expect(chartData.series.length).toBe(dataCols);

          // 逐个验证每个数据单元格的值与模型中的值一致
          for (let c = 0; c < dataCols; c++) {
            for (let r = 0; r < dataRows; r++) {
              const cell = model.getCell(r + 1, c + 1);
              const content = cell?.content ?? '';
              const expectedNum = parseFloat(content);
              const expected = isNaN(expectedNum) ? 0 : expectedNum;
              expect(chartData.series[c].values[r]).toBeCloseTo(expected, 5);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
