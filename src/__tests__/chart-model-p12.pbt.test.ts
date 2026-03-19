import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import type { ChartType, DataRange } from '../chart/types';

/**
 * Property 12: 删除图表从模型中移除
 *
 * 对于任意已创建的图表，执行删除操作后，ChartModel.getChart(chartId) 应返回 null，
 * 且 getAllCharts() 的长度应减少 1。
 *
 * **Validates: Requirements 4.5**
 */

// 图表类型生成器
const chartTypeArb: fc.Arbitrary<ChartType> = fc.constantFrom(
  'bar' as const, 'line' as const, 'pie' as const, 'scatter' as const, 'area' as const
);

// 生成数值数据（用于填充单元格，确保 createChart 成功）
const numericValueArb: fc.Arbitrary<number> = fc.double({
  min: 1,
  max: 1000,
  noNaN: true,
  noDefaultInfinity: true,
});

// 生成数据矩阵维度
const dimensionArb = fc.record({
  rows: fc.integer({ min: 1, max: 5 }),
  cols: fc.integer({ min: 1, max: 5 }),
});

// 生成单个图表的配置参数：类型 + 数据矩阵维度 + 数值矩阵
const singleChartArb = fc.tuple(
  chartTypeArb,
  dimensionArb,
).chain(([chartType, dim]) =>
  fc.tuple(
    fc.constant(chartType),
    fc.constant(dim),
    fc.array(
      fc.array(numericValueArb, { minLength: dim.cols, maxLength: dim.cols }),
      { minLength: dim.rows, maxLength: dim.rows }
    ),
  )
);

describe('Feature: chart-visualization, Property 12: 删除图表从模型中移除', () => {
  it('创建图表后删除，getChart 应返回 null 且 getAllCharts 长度减 1', () => {
    fc.assert(
      fc.property(
        singleChartArb,
        ([chartType, dim, matrix]) => {
          const { rows, cols } = dim;

          // 创建足够大的表格
          const model = new SpreadsheetModel(rows + 10, cols + 10);
          const chartModel = new ChartModel(model);

          // 填充数值数据到表格
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              model.setCellContent(r, c, String(matrix[r][c]));
            }
          }

          // 创建图表
          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: rows - 1,
            endCol: cols - 1,
          };
          const chartId = chartModel.createChart(chartType, dataRange, { x: 0, y: 0 });

          // 确保创建成功
          expect(chartId).not.toBeNull();

          // 记录删除前的图表数量
          const countBefore = chartModel.getAllCharts().length;
          expect(countBefore).toBeGreaterThanOrEqual(1);

          // 验证删除前 getChart 返回非 null
          expect(chartModel.getChart(chartId!)).not.toBeNull();

          // 执行删除
          chartModel.deleteChart(chartId!);

          // 验证：getChart 返回 null
          expect(chartModel.getChart(chartId!)).toBeNull();

          // 验证：getAllCharts 长度减 1
          expect(chartModel.getAllCharts().length).toBe(countBefore - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('创建多个图表后删除其中一个，仅该图表被移除，其余图表不受影响', () => {
    fc.assert(
      fc.property(
        // 生成 2-5 个图表配置
        fc.integer({ min: 2, max: 5 }).chain((count) =>
          fc.tuple(
            fc.constant(count),
            fc.array(chartTypeArb, { minLength: count, maxLength: count }),
            // 选择要删除的图表索引
            fc.integer({ min: 0, max: count - 1 }),
          )
        ),
        dimensionArb,
        ([count, chartTypes, deleteIndex], dim) => {
          const { rows, cols } = dim;

          // 创建足够大的表格
          const model = new SpreadsheetModel(rows + 10, cols + 10);
          const chartModel = new ChartModel(model);

          // 填充数值数据
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              model.setCellContent(r, c, String((r + 1) * 10 + c + 1));
            }
          }

          const dataRange: DataRange = {
            startRow: 0,
            startCol: 0,
            endRow: rows - 1,
            endCol: cols - 1,
          };

          // 创建多个图表
          const chartIds: string[] = [];
          for (let i = 0; i < count; i++) {
            const id = chartModel.createChart(chartTypes[i], dataRange, { x: i * 50, y: i * 50 });
            expect(id).not.toBeNull();
            chartIds.push(id!);
          }

          // 记录删除前的图表数量
          const countBefore = chartModel.getAllCharts().length;
          expect(countBefore).toBe(count);

          // 选择要删除的图表
          const targetId = chartIds[deleteIndex];

          // 执行删除
          chartModel.deleteChart(targetId);

          // 验证：被删除的图表 getChart 返回 null
          expect(chartModel.getChart(targetId)).toBeNull();

          // 验证：getAllCharts 长度减 1
          expect(chartModel.getAllCharts().length).toBe(countBefore - 1);

          // 验证：其余图表仍然存在
          for (let i = 0; i < count; i++) {
            if (i !== deleteIndex) {
              expect(chartModel.getChart(chartIds[i])).not.toBeNull();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
