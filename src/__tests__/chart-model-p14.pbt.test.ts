import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import type { ChartType, DataRange } from '../chart/types';

/**
 * Property 14: 行列操作后数据范围自动调整
 *
 * 对于任意图表数据范围和行列插入操作：
 * - 在数据范围之前插入行/列时，范围整体向下/向右偏移
 * - 在数据范围之后插入行/列时，范围不变
 * - 在数据范围内部插入行/列时，范围扩展
 *
 * **Validates: Requirements 5.2**
 */

// 图表类型生成器
const chartTypeArb: fc.Arbitrary<ChartType> = fc.constantFrom(
  'bar' as const, 'line' as const, 'pie' as const, 'scatter' as const, 'area' as const
);

// 生成有效的数据范围（确保 startRow <= endRow, startCol <= endCol）
// 范围起始位置留出足够空间用于"之前插入"测试
const dataRangeArb: fc.Arbitrary<DataRange> = fc.record({
  startRow: fc.integer({ min: 2, max: 10 }),
  startCol: fc.integer({ min: 2, max: 10 }),
  rowSpan: fc.integer({ min: 1, max: 5 }),
  colSpan: fc.integer({ min: 1, max: 5 }),
}).map(({ startRow, startCol, rowSpan, colSpan }) => ({
  startRow,
  startCol,
  endRow: startRow + rowSpan - 1,
  endCol: startCol + colSpan - 1,
}));

// 插入数量生成器
const insertCountArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 5 });

/**
 * 辅助函数：创建带有数值数据的 ChartModel，并创建一个图表
 * 返回 chartModel 和 chartId
 */
function setupChartWithRange(
  dataRange: DataRange,
  chartType: ChartType
): { model: SpreadsheetModel; chartModel: ChartModel; chartId: string } {
  // 创建足够大的表格（范围 + 额外空间）
  const totalRows = dataRange.endRow + 20;
  const totalCols = dataRange.endCol + 20;
  const model = new SpreadsheetModel(totalRows, totalCols);
  const chartModel = new ChartModel(model);

  // 在数据范围内填充数值数据
  for (let r = dataRange.startRow; r <= dataRange.endRow; r++) {
    for (let c = dataRange.startCol; c <= dataRange.endCol; c++) {
      model.setCellContent(r, c, String((r + 1) * 10 + c + 1));
    }
  }

  // 创建图表
  const chartId = chartModel.createChart(chartType, dataRange, { x: 0, y: 0 });
  if (chartId === null) {
    throw new Error('图表创建失败，数据范围内应包含数值数据');
  }

  return { model, chartModel, chartId };
}

describe('Feature: chart-visualization, Property 14: 行列操作后数据范围自动调整', () => {
  // ============================================================
  // 行插入测试
  // ============================================================

  it('在数据范围之前插入行时，范围整体向下偏移', () => {
    fc.assert(
      fc.property(
        dataRangeArb,
        chartTypeArb,
        insertCountArb,
        (dataRange, chartType, count) => {
          const { chartModel, chartId } = setupChartWithRange(dataRange, chartType);

          // 记录原始范围
          const originalStartRow = dataRange.startRow;
          const originalEndRow = dataRange.endRow;
          const originalStartCol = dataRange.startCol;
          const originalEndCol = dataRange.endCol;

          // 在数据范围之前插入行（index < startRow）
          const insertIndex = fc.sample(
            fc.integer({ min: 0, max: originalStartRow }),
            1
          )[0];

          chartModel.adjustDataRanges('rowInsert', insertIndex, count);

          // 获取调整后的图表配置
          const chart = chartModel.getChart(chartId);
          expect(chart).not.toBeNull();

          // 验证：startRow 和 endRow 都向下偏移 count
          expect(chart!.dataRange.startRow).toBe(originalStartRow + count);
          expect(chart!.dataRange.endRow).toBe(originalEndRow + count);

          // 验证：列范围不变
          expect(chart!.dataRange.startCol).toBe(originalStartCol);
          expect(chart!.dataRange.endCol).toBe(originalEndCol);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('在数据范围之后插入行时，范围不变', () => {
    fc.assert(
      fc.property(
        dataRangeArb,
        chartTypeArb,
        insertCountArb,
        (dataRange, chartType, count) => {
          const { chartModel, chartId } = setupChartWithRange(dataRange, chartType);

          // 记录原始范围
          const originalStartRow = dataRange.startRow;
          const originalEndRow = dataRange.endRow;
          const originalStartCol = dataRange.startCol;
          const originalEndCol = dataRange.endCol;

          // 在数据范围之后插入行（index > endRow）
          const insertIndex = originalEndRow + 1;

          chartModel.adjustDataRanges('rowInsert', insertIndex, count);

          // 获取调整后的图表配置
          const chart = chartModel.getChart(chartId);
          expect(chart).not.toBeNull();

          // 验证：范围完全不变
          expect(chart!.dataRange.startRow).toBe(originalStartRow);
          expect(chart!.dataRange.endRow).toBe(originalEndRow);
          expect(chart!.dataRange.startCol).toBe(originalStartCol);
          expect(chart!.dataRange.endCol).toBe(originalEndCol);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('在数据范围内部插入行时，范围扩展（endRow 增加）', () => {
    fc.assert(
      fc.property(
        // 确保范围至少有 2 行，这样内部才有空间插入
        fc.record({
          startRow: fc.integer({ min: 2, max: 10 }),
          startCol: fc.integer({ min: 2, max: 10 }),
          rowSpan: fc.integer({ min: 2, max: 5 }),
          colSpan: fc.integer({ min: 1, max: 5 }),
        }).map(({ startRow, startCol, rowSpan, colSpan }) => ({
          startRow,
          startCol,
          endRow: startRow + rowSpan - 1,
          endCol: startCol + colSpan - 1,
        })),
        chartTypeArb,
        insertCountArb,
        (dataRange, chartType, count) => {
          const { chartModel, chartId } = setupChartWithRange(dataRange, chartType);

          // 记录原始范围
          const originalStartRow = dataRange.startRow;
          const originalEndRow = dataRange.endRow;

          // 在数据范围内部插入行（startRow < index <= endRow）
          const insertIndex = fc.sample(
            fc.integer({ min: originalStartRow + 1, max: originalEndRow }),
            1
          )[0];

          chartModel.adjustDataRanges('rowInsert', insertIndex, count);

          // 获取调整后的图表配置
          const chart = chartModel.getChart(chartId);
          expect(chart).not.toBeNull();

          // 验证：startRow 不变，endRow 扩展
          expect(chart!.dataRange.startRow).toBe(originalStartRow);
          expect(chart!.dataRange.endRow).toBe(originalEndRow + count);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================
  // 列插入测试
  // ============================================================

  it('在数据范围之前插入列时，范围整体向右偏移', () => {
    fc.assert(
      fc.property(
        dataRangeArb,
        chartTypeArb,
        insertCountArb,
        (dataRange, chartType, count) => {
          const { chartModel, chartId } = setupChartWithRange(dataRange, chartType);

          // 记录原始范围
          const originalStartRow = dataRange.startRow;
          const originalEndRow = dataRange.endRow;
          const originalStartCol = dataRange.startCol;
          const originalEndCol = dataRange.endCol;

          // 在数据范围之前插入列（index <= startCol）
          const insertIndex = fc.sample(
            fc.integer({ min: 0, max: originalStartCol }),
            1
          )[0];

          chartModel.adjustDataRanges('colInsert', insertIndex, count);

          // 获取调整后的图表配置
          const chart = chartModel.getChart(chartId);
          expect(chart).not.toBeNull();

          // 验证：startCol 和 endCol 都向右偏移 count
          expect(chart!.dataRange.startCol).toBe(originalStartCol + count);
          expect(chart!.dataRange.endCol).toBe(originalEndCol + count);

          // 验证：行范围不变
          expect(chart!.dataRange.startRow).toBe(originalStartRow);
          expect(chart!.dataRange.endRow).toBe(originalEndRow);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('在数据范围之后插入列时，范围不变', () => {
    fc.assert(
      fc.property(
        dataRangeArb,
        chartTypeArb,
        insertCountArb,
        (dataRange, chartType, count) => {
          const { chartModel, chartId } = setupChartWithRange(dataRange, chartType);

          // 记录原始范围
          const originalStartRow = dataRange.startRow;
          const originalEndRow = dataRange.endRow;
          const originalStartCol = dataRange.startCol;
          const originalEndCol = dataRange.endCol;

          // 在数据范围之后插入列（index > endCol）
          const insertIndex = originalEndCol + 1;

          chartModel.adjustDataRanges('colInsert', insertIndex, count);

          // 获取调整后的图表配置
          const chart = chartModel.getChart(chartId);
          expect(chart).not.toBeNull();

          // 验证：范围完全不变
          expect(chart!.dataRange.startRow).toBe(originalStartRow);
          expect(chart!.dataRange.endRow).toBe(originalEndRow);
          expect(chart!.dataRange.startCol).toBe(originalStartCol);
          expect(chart!.dataRange.endCol).toBe(originalEndCol);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('在数据范围内部插入列时，范围扩展（endCol 增加）', () => {
    fc.assert(
      fc.property(
        // 确保范围至少有 2 列，这样内部才有空间插入
        fc.record({
          startRow: fc.integer({ min: 2, max: 10 }),
          startCol: fc.integer({ min: 2, max: 10 }),
          rowSpan: fc.integer({ min: 1, max: 5 }),
          colSpan: fc.integer({ min: 2, max: 5 }),
        }).map(({ startRow, startCol, rowSpan, colSpan }) => ({
          startRow,
          startCol,
          endRow: startRow + rowSpan - 1,
          endCol: startCol + colSpan - 1,
        })),
        chartTypeArb,
        insertCountArb,
        (dataRange, chartType, count) => {
          const { chartModel, chartId } = setupChartWithRange(dataRange, chartType);

          // 记录原始范围
          const originalStartCol = dataRange.startCol;
          const originalEndCol = dataRange.endCol;

          // 在数据范围内部插入列（startCol < index <= endCol）
          const insertIndex = fc.sample(
            fc.integer({ min: originalStartCol + 1, max: originalEndCol }),
            1
          )[0];

          chartModel.adjustDataRanges('colInsert', insertIndex, count);

          // 获取调整后的图表配置
          const chart = chartModel.getChart(chartId);
          expect(chart).not.toBeNull();

          // 验证：startCol 不变，endCol 扩展
          expect(chart!.dataRange.startCol).toBe(originalStartCol);
          expect(chart!.dataRange.endCol).toBe(originalEndCol + count);
        }
      ),
      { numRuns: 100 }
    );
  });
});
