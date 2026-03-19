import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import type { ChartType, DataRange } from '../chart/types';

/**
 * Property 8: 图表类型切换保留数据范围
 *
 * 对于任意已创建的图表和任意目标图表类型，通过 updateChart 切换图表类型后，
 * 图表的 dataRange 应与切换前完全相同。
 *
 * **Validates: Requirements 3.2, 3.8**
 */

/**
 * Property 9: 图表配置值约束
 *
 * 对于任意图表配置更新操作，标题字体大小应被限制在 12-24px 范围内。
 *
 * **Validates: Requirements 3.2, 3.3**
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

// 生成有效的数据范围和对应的数值矩阵
const validChartSetupArb = fc.record({
  rows: fc.integer({ min: 1, max: 8 }),
  cols: fc.integer({ min: 1, max: 8 }),
}).chain(({ rows, cols }) =>
  fc.tuple(
    fc.constant({ rows, cols }),
    fc.array(
      fc.array(numericValueArb, { minLength: cols, maxLength: cols }),
      { minLength: rows, maxLength: rows }
    )
  )
);

// 生成任意字体大小（包括超出范围的值）
const fontSizeArb: fc.Arbitrary<number> = fc.oneof(
  // 正常范围内
  fc.integer({ min: 12, max: 24 }),
  // 低于最小值
  fc.integer({ min: -100, max: 11 }),
  // 高于最大值
  fc.integer({ min: 25, max: 200 }),
  // 浮点数
  fc.double({ min: -100, max: 200, noNaN: true, noDefaultInfinity: true })
);

/**
 * 辅助函数：创建一个包含数值数据的图表模型，返回 chartModel 和 chartId
 */
function setupChartWithData(
  rows: number,
  cols: number,
  matrix: number[][],
  chartType: ChartType
): { model: SpreadsheetModel; chartModel: ChartModel; chartId: string; dataRange: DataRange } {
  const model = new SpreadsheetModel(rows + 5, cols + 5);
  const chartModel = new ChartModel(model);

  // 填充数值数据
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      model.setCellContent(r, c, String(matrix[r][c]));
    }
  }

  const dataRange: DataRange = {
    startRow: 0,
    startCol: 0,
    endRow: rows - 1,
    endCol: cols - 1,
  };

  const chartId = chartModel.createChart(chartType, dataRange, { x: 0, y: 0 });
  // 数据包含数值，创建应成功
  if (chartId === null) {
    throw new Error('图表创建失败：数据区域应包含数值');
  }

  return { model, chartModel, chartId, dataRange };
}

describe('Feature: chart-visualization, Property 8: 图表类型切换保留数据范围', () => {
  it('切换图表类型后 dataRange 应与切换前完全相同', () => {
    fc.assert(
      fc.property(
        validChartSetupArb,
        chartTypeArb,
        chartTypeArb,
        ([dim, matrix], initialType, targetType) => {
          const { chartModel, chartId, dataRange } = setupChartWithData(
            dim.rows, dim.cols, matrix, initialType
          );

          // 记录切换前的 dataRange
          const configBefore = chartModel.getChart(chartId);
          expect(configBefore).not.toBeNull();
          const dataRangeBefore = { ...configBefore!.dataRange };

          // 通过 updateChart 切换图表类型
          chartModel.updateChart(chartId, { type: targetType });

          // 获取切换后的配置
          const configAfter = chartModel.getChart(chartId);
          expect(configAfter).not.toBeNull();

          // 核心属性：dataRange 应完全不变
          expect(configAfter!.dataRange.startRow).toBe(dataRangeBefore.startRow);
          expect(configAfter!.dataRange.startCol).toBe(dataRangeBefore.startCol);
          expect(configAfter!.dataRange.endRow).toBe(dataRangeBefore.endRow);
          expect(configAfter!.dataRange.endCol).toBe(dataRangeBefore.endCol);

          // 验证类型确实已切换
          expect(configAfter!.type).toBe(targetType);

          // 验证 dataRange 与原始创建时的范围一致
          expect(configAfter!.dataRange.startRow).toBe(dataRange.startRow);
          expect(configAfter!.dataRange.startCol).toBe(dataRange.startCol);
          expect(configAfter!.dataRange.endRow).toBe(dataRange.endRow);
          expect(configAfter!.dataRange.endCol).toBe(dataRange.endCol);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('连续多次切换类型后 dataRange 仍保持不变', () => {
    fc.assert(
      fc.property(
        validChartSetupArb,
        chartTypeArb,
        fc.array(chartTypeArb, { minLength: 2, maxLength: 10 }),
        ([dim, matrix], initialType, typeSequence) => {
          const { chartModel, chartId, dataRange } = setupChartWithData(
            dim.rows, dim.cols, matrix, initialType
          );

          // 记录初始 dataRange
          const originalDataRange = { ...dataRange };

          // 连续切换多次类型
          for (const newType of typeSequence) {
            chartModel.updateChart(chartId, { type: newType });
          }

          // 获取最终配置
          const configFinal = chartModel.getChart(chartId);
          expect(configFinal).not.toBeNull();

          // 核心属性：经过多次类型切换后 dataRange 仍然不变
          expect(configFinal!.dataRange.startRow).toBe(originalDataRange.startRow);
          expect(configFinal!.dataRange.startCol).toBe(originalDataRange.startCol);
          expect(configFinal!.dataRange.endRow).toBe(originalDataRange.endRow);
          expect(configFinal!.dataRange.endCol).toBe(originalDataRange.endCol);

          // 验证最终类型为序列中最后一个
          expect(configFinal!.type).toBe(typeSequence[typeSequence.length - 1]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: chart-visualization, Property 9: 图表配置值约束', () => {
  it('通过 updateChart 设置任意字体大小后，结果应被钳制到 12-24px 范围', () => {
    fc.assert(
      fc.property(
        validChartSetupArb,
        chartTypeArb,
        fontSizeArb,
        ([dim, matrix], chartType, fontSize) => {
          const { chartModel, chartId } = setupChartWithData(
            dim.rows, dim.cols, matrix, chartType
          );

          // 通过 updateChart 设置标题字体大小
          chartModel.updateChart(chartId, {
            title: {
              text: '测试标题',
              fontSize,
              position: 'top',
              visible: true,
            },
          });

          // 获取更新后的配置
          const config = chartModel.getChart(chartId);
          expect(config).not.toBeNull();

          // 核心属性：字体大小应被钳制到 12-24 范围
          expect(config!.title.fontSize).toBeGreaterThanOrEqual(12);
          expect(config!.title.fontSize).toBeLessThanOrEqual(24);

          // 验证钳制逻辑的精确行为
          const expectedFontSize = Math.min(24, Math.max(12, fontSize));
          expect(config!.title.fontSize).toBe(expectedFontSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('多次更新字体大小后，最终值仍在 12-24px 范围内', () => {
    fc.assert(
      fc.property(
        validChartSetupArb,
        chartTypeArb,
        fc.array(fontSizeArb, { minLength: 1, maxLength: 10 }),
        ([dim, matrix], chartType, fontSizes) => {
          const { chartModel, chartId } = setupChartWithData(
            dim.rows, dim.cols, matrix, chartType
          );

          // 连续多次更新字体大小
          for (const fs of fontSizes) {
            chartModel.updateChart(chartId, {
              title: {
                text: '测试',
                fontSize: fs,
                position: 'top',
                visible: true,
              },
            });
          }

          // 获取最终配置
          const config = chartModel.getChart(chartId);
          expect(config).not.toBeNull();

          // 核心属性：无论经过多少次更新，字体大小始终在有效范围内
          expect(config!.title.fontSize).toBeGreaterThanOrEqual(12);
          expect(config!.title.fontSize).toBeLessThanOrEqual(24);
        }
      ),
      { numRuns: 100 }
    );
  });
});
