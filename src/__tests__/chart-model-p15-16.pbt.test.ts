import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import type { ChartType, DataRange } from '../chart/types';

/**
 * Property 15: 空数据范围显示无数据状态
 *
 * 对于任意图表，当其数据源范围内所有单元格均为空时，
 * 图表状态应为 'noData'。
 *
 * Property 16: 无效数据范围显示失效状态
 *
 * 对于任意图表，当删除行/列导致其数据范围超出表格边界时，
 * 图表状态应为 'invalidSource'。
 *
 * **Validates: Requirements 5.5, 5.6**
 */

// 图表类型生成器
const chartTypeArb: fc.Arbitrary<ChartType> = fc.constantFrom(
  'bar' as const, 'line' as const, 'pie' as const, 'scatter' as const, 'area' as const
);

// 生成有效的数据范围（确保 startRow <= endRow, startCol <= endCol）
// 起始位置从 1 开始，留出空间给行列删除操作
const dataRangeArb: fc.Arbitrary<DataRange> = fc.record({
  startRow: fc.integer({ min: 1, max: 5 }),
  startCol: fc.integer({ min: 1, max: 5 }),
  rowSpan: fc.integer({ min: 1, max: 4 }),
  colSpan: fc.integer({ min: 1, max: 4 }),
}).map(({ startRow, startCol, rowSpan, colSpan }) => ({
  startRow,
  startCol,
  endRow: startRow + rowSpan - 1,
  endCol: startCol + colSpan - 1,
}));

/**
 * 辅助函数：创建带有数值数据的表格和图表
 * 返回 model、chartModel 和 chartId
 */
function setupChartWithNumericData(
  dataRange: DataRange,
  chartType: ChartType
): { model: SpreadsheetModel; chartModel: ChartModel; chartId: string } {
  // 创建足够大的表格（数据范围 + 额外空间）
  const totalRows = dataRange.endRow + 10;
  const totalCols = dataRange.endCol + 10;
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

describe('Feature: chart-visualization, Property 15: 空数据范围显示无数据状态', () => {
  it('清空数据范围内所有单元格后，图表状态应为 noData', () => {
    fc.assert(
      fc.property(
        dataRangeArb,
        chartTypeArb,
        (dataRange, chartType) => {
          const { model, chartModel, chartId } = setupChartWithNumericData(dataRange, chartType);

          // 验证创建后状态为 active
          const instanceBefore = chartModel.getChartInstance(chartId);
          expect(instanceBefore).not.toBeNull();
          expect(instanceBefore!.status).toBe('active');

          // 清空数据范围内所有单元格
          for (let r = dataRange.startRow; r <= dataRange.endRow; r++) {
            for (let c = dataRange.startCol; c <= dataRange.endCol; c++) {
              model.setCellContent(r, c, '');
            }
          }

          // 手动触发状态检查（setCellContent 内部会调用 notifyChartDataChange）
          // 但 notifyChartDataChange 是通过 SpreadsheetModel 内部调用的，
          // 这里直接调用 checkChartStatus 确保状态更新
          chartModel.checkChartStatus(chartId);

          // 验证图表状态变为 noData
          const instanceAfter = chartModel.getChartInstance(chartId);
          expect(instanceAfter).not.toBeNull();
          expect(instanceAfter!.status).toBe('noData');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('部分清空数据范围（保留至少一个数值）后，图表状态应保持 active', () => {
    fc.assert(
      fc.property(
        // 确保范围至少有 2 个单元格，这样可以清空部分保留部分
        fc.record({
          startRow: fc.integer({ min: 1, max: 5 }),
          startCol: fc.integer({ min: 1, max: 5 }),
          rowSpan: fc.integer({ min: 1, max: 4 }),
          colSpan: fc.integer({ min: 1, max: 4 }),
        }).filter(({ rowSpan, colSpan }) => rowSpan * colSpan >= 2)
          .map(({ startRow, startCol, rowSpan, colSpan }) => ({
            startRow,
            startCol,
            endRow: startRow + rowSpan - 1,
            endCol: startCol + colSpan - 1,
          })),
        chartTypeArb,
        (dataRange, chartType) => {
          const { model, chartModel, chartId } = setupChartWithNumericData(dataRange, chartType);

          // 清空除最后一个单元格外的所有单元格
          for (let r = dataRange.startRow; r <= dataRange.endRow; r++) {
            for (let c = dataRange.startCol; c <= dataRange.endCol; c++) {
              // 保留最后一个单元格的数值
              if (r === dataRange.endRow && c === dataRange.endCol) {
                continue;
              }
              model.setCellContent(r, c, '');
            }
          }

          // 触发状态检查
          chartModel.checkChartStatus(chartId);

          // 验证图表状态仍为 active（因为还有一个数值单元格）
          const instance = chartModel.getChartInstance(chartId);
          expect(instance).not.toBeNull();
          expect(instance!.status).toBe('active');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: chart-visualization, Property 16: 无效数据范围显示失效状态', () => {
  it('行删除完全覆盖数据范围时，图表状态应为 invalidSource', () => {
    fc.assert(
      fc.property(
        dataRangeArb,
        chartTypeArb,
        (dataRange, chartType) => {
          const { chartModel, chartId } = setupChartWithNumericData(dataRange, chartType);

          // 验证创建后状态为 active
          const instanceBefore = chartModel.getChartInstance(chartId);
          expect(instanceBefore).not.toBeNull();
          expect(instanceBefore!.status).toBe('active');

          // 删除完全覆盖数据范围的行
          // 从 startRow 开始删除，数量覆盖整个范围
          const deleteCount = dataRange.endRow - dataRange.startRow + 1;
          chartModel.adjustDataRanges('rowDelete', dataRange.startRow, deleteCount);

          // 验证图表状态变为 invalidSource
          const instanceAfter = chartModel.getChartInstance(chartId);
          expect(instanceAfter).not.toBeNull();
          expect(instanceAfter!.status).toBe('invalidSource');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('列删除完全覆盖数据范围时，图表状态应为 invalidSource', () => {
    fc.assert(
      fc.property(
        dataRangeArb,
        chartTypeArb,
        (dataRange, chartType) => {
          const { chartModel, chartId } = setupChartWithNumericData(dataRange, chartType);

          // 验证创建后状态为 active
          const instanceBefore = chartModel.getChartInstance(chartId);
          expect(instanceBefore).not.toBeNull();
          expect(instanceBefore!.status).toBe('active');

          // 删除完全覆盖数据范围的列
          const deleteCount = dataRange.endCol - dataRange.startCol + 1;
          chartModel.adjustDataRanges('colDelete', dataRange.startCol, deleteCount);

          // 验证图表状态变为 invalidSource
          const instanceAfter = chartModel.getChartInstance(chartId);
          expect(instanceAfter).not.toBeNull();
          expect(instanceAfter!.status).toBe('invalidSource');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('行删除从范围之前开始并覆盖整个范围时，图表状态应为 invalidSource', () => {
    fc.assert(
      fc.property(
        // 确保 startRow >= 1，这样可以从更前面开始删除
        fc.record({
          startRow: fc.integer({ min: 2, max: 5 }),
          startCol: fc.integer({ min: 1, max: 5 }),
          rowSpan: fc.integer({ min: 1, max: 3 }),
          colSpan: fc.integer({ min: 1, max: 4 }),
        }).map(({ startRow, startCol, rowSpan, colSpan }) => ({
          startRow,
          startCol,
          endRow: startRow + rowSpan - 1,
          endCol: startCol + colSpan - 1,
        })),
        chartTypeArb,
        (dataRange, chartType) => {
          const { chartModel, chartId } = setupChartWithNumericData(dataRange, chartType);

          // 从 startRow - 1 开始删除，覆盖整个数据范围及之前一行
          const deleteStart = dataRange.startRow - 1;
          const deleteCount = dataRange.endRow - deleteStart + 1;
          chartModel.adjustDataRanges('rowDelete', deleteStart, deleteCount);

          // 验证图表状态变为 invalidSource
          const instanceAfter = chartModel.getChartInstance(chartId);
          expect(instanceAfter).not.toBeNull();
          expect(instanceAfter!.status).toBe('invalidSource');
        }
      ),
      { numRuns: 100 }
    );
  });
});
