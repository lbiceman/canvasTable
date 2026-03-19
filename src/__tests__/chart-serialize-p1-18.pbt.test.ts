import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import type {
  ChartType,
  ChartConfig,
  DataRange,
  Position,
  Size,
  TitleConfig,
  LegendConfig,
  AxesConfig,
  AxisConfig,
  DataLabelConfig,
} from '../chart/types';

/**
 * Property 1: ChartConfig 序列化往返一致性
 *
 * 对于任意有效的 ChartConfig 对象，通过 ChartModel 创建图表后，
 * 调用 serialize() → deserialize() 应产生与原始配置等价的 ChartConfig。
 *
 * Property 18: 序列化 ChartConfig 包含所有必要字段
 *
 * 对于任意有效的 ChartConfig 对象，其 serialize() 输出的 JSON 应包含
 * 以下所有字段：id, type, dataRange, position, size, title, legend, axes, dataLabels。
 *
 * **Validates: Requirements 1.3, 7.1, 7.3, 7.4, 7.5**
 */

// ============================================================
// 生成器定义
// ============================================================

// 图表类型生成器
const chartTypeArb: fc.Arbitrary<ChartType> = fc.constantFrom(
  'bar' as const,
  'line' as const,
  'pie' as const,
  'scatter' as const,
  'area' as const
);

// 数据范围生成器：确保 endRow >= startRow, endCol >= startCol
// 范围限制在较小区域内，避免创建过大的 SpreadsheetModel
const dataRangeArb: fc.Arbitrary<DataRange> = fc
  .record({
    startRow: fc.integer({ min: 0, max: 10 }),
    startCol: fc.integer({ min: 0, max: 10 }),
    rowSpan: fc.integer({ min: 1, max: 5 }),
    colSpan: fc.integer({ min: 1, max: 5 }),
  })
  .map(({ startRow, startCol, rowSpan, colSpan }) => ({
    startRow,
    startCol,
    endRow: startRow + rowSpan,
    endCol: startCol + colSpan,
  }));

// 位置生成器
const positionArb: fc.Arbitrary<Position> = fc.record({
  x: fc.integer({ min: 0, max: 2000 }),
  y: fc.integer({ min: 0, max: 2000 }),
});

// 尺寸生成器：满足最小尺寸约束 200×150
const sizeArb: fc.Arbitrary<Size> = fc.record({
  width: fc.integer({ min: 200, max: 1200 }),
  height: fc.integer({ min: 150, max: 900 }),
});

// 标题配置生成器：字体大小限制在 12-24
const titleConfigArb: fc.Arbitrary<TitleConfig> = fc.record({
  text: fc.string({ minLength: 0, maxLength: 20 }),
  fontSize: fc.integer({ min: 12, max: 24 }),
  position: fc.constantFrom('top' as const, 'bottom' as const),
  visible: fc.boolean(),
});

// 图例配置生成器
const legendConfigArb: fc.Arbitrary<LegendConfig> = fc.record({
  visible: fc.boolean(),
  position: fc.constantFrom(
    'top' as const,
    'bottom' as const,
    'left' as const,
    'right' as const
  ),
});

// 单个坐标轴配置生成器
const axisConfigArb: fc.Arbitrary<AxisConfig> = fc.record({
  title: fc.string({ minLength: 0, maxLength: 15 }),
  autoRange: fc.boolean(),
  showGridLines: fc.boolean(),
});

// 坐标轴组合配置生成器
const axesConfigArb: fc.Arbitrary<AxesConfig> = fc.record({
  xAxis: axisConfigArb,
  yAxis: axisConfigArb,
});

// 数据标签配置生成器
const dataLabelConfigArb: fc.Arbitrary<DataLabelConfig> = fc.record({
  visible: fc.boolean(),
  content: fc.constantFrom(
    'value' as const,
    'percentage' as const,
    'category' as const
  ),
});

// 完整 ChartConfig 生成器（不含 id，id 由 ChartModel 生成）
const chartConfigPartsArb = fc.record({
  type: chartTypeArb,
  dataRange: dataRangeArb,
  position: positionArb,
  size: sizeArb,
  title: titleConfigArb,
  legend: legendConfigArb,
  axes: axesConfigArb,
  dataLabels: dataLabelConfigArb,
});

// ============================================================
// 辅助函数
// ============================================================

/**
 * 创建一个填充了数值数据的 SpreadsheetModel，
 * 确保指定数据范围内有足够的数值数据以通过 createChart 验证。
 */
function createModelWithData(dataRange: DataRange): SpreadsheetModel {
  const rows = Math.max(dataRange.endRow + 5, 20);
  const cols = Math.max(dataRange.endCol + 5, 20);
  const model = new SpreadsheetModel(rows, cols);

  // 在数据范围内填充数值数据
  for (let r = dataRange.startRow; r <= dataRange.endRow; r++) {
    for (let c = dataRange.startCol; c <= dataRange.endCol; c++) {
      model.setCellContent(r, c, String((r + 1) * 10 + c));
    }
  }

  return model;
}

// ============================================================
// Property 1: ChartConfig 序列化往返一致性
// ============================================================

describe('Feature: chart-visualization, Property 1: ChartConfig 序列化往返一致性', () => {
  it('通过 ChartModel 创建图表 → serialize → deserialize → 验证图表配置与原始一致', () => {
    fc.assert(
      fc.property(chartConfigPartsArb, (parts) => {
        // 创建包含数值数据的模型
        const model = createModelWithData(parts.dataRange);
        const chartModel = new ChartModel(model);

        // 创建图表
        const chartId = chartModel.createChart(
          parts.type,
          parts.dataRange,
          parts.position,
          parts.size
        );
        expect(chartId).not.toBeNull();

        // 更新图表配置（设置标题、图例、坐标轴、数据标签）
        chartModel.updateChart(chartId!, {
          title: parts.title,
          legend: parts.legend,
          axes: parts.axes,
          dataLabels: parts.dataLabels,
        });

        // 获取更新后的原始配置
        const originalConfig = chartModel.getChart(chartId!);
        expect(originalConfig).not.toBeNull();

        // 序列化
        const serialized = chartModel.serialize();

        // 在新的 ChartModel 中反序列化
        const model2 = createModelWithData(parts.dataRange);
        const chartModel2 = new ChartModel(model2);
        chartModel2.deserialize(serialized);

        // 获取反序列化后的配置
        const restoredConfig = chartModel2.getChart(chartId!);
        expect(restoredConfig).not.toBeNull();

        // 验证往返一致性：逐字段比较
        expect(restoredConfig!.id).toBe(originalConfig!.id);
        expect(restoredConfig!.type).toBe(originalConfig!.type);
        expect(restoredConfig!.dataRange).toEqual(originalConfig!.dataRange);
        expect(restoredConfig!.position).toEqual(originalConfig!.position);
        expect(restoredConfig!.size).toEqual(originalConfig!.size);
        expect(restoredConfig!.title).toEqual(originalConfig!.title);
        expect(restoredConfig!.legend).toEqual(originalConfig!.legend);
        expect(restoredConfig!.axes).toEqual(originalConfig!.axes);
        expect(restoredConfig!.dataLabels).toEqual(originalConfig!.dataLabels);
      }),
      { numRuns: 200 }
    );
  });

  it('多个图表同时序列化和反序列化后保持一致', () => {
    fc.assert(
      fc.property(
        fc.array(chartConfigPartsArb, { minLength: 1, maxLength: 5 }),
        (partsArray) => {
          // 计算所有数据范围的最大边界
          let maxRow = 20;
          let maxCol = 20;
          for (const parts of partsArray) {
            maxRow = Math.max(maxRow, parts.dataRange.endRow + 5);
            maxCol = Math.max(maxCol, parts.dataRange.endCol + 5);
          }

          const model = new SpreadsheetModel(maxRow, maxCol);
          const chartModel = new ChartModel(model);

          // 填充数值数据覆盖所有数据范围
          for (const parts of partsArray) {
            const { startRow, startCol, endRow, endCol } = parts.dataRange;
            for (let r = startRow; r <= endRow; r++) {
              for (let c = startCol; c <= endCol; c++) {
                model.setCellContent(r, c, String((r + 1) * 10 + c));
              }
            }
          }

          // 创建多个图表并记录原始配置
          const originalConfigs: ChartConfig[] = [];
          for (const parts of partsArray) {
            const chartId = chartModel.createChart(
              parts.type,
              parts.dataRange,
              parts.position,
              parts.size
            );
            if (chartId) {
              chartModel.updateChart(chartId, {
                title: parts.title,
                legend: parts.legend,
                axes: parts.axes,
                dataLabels: parts.dataLabels,
              });
              const config = chartModel.getChart(chartId);
              if (config) {
                originalConfigs.push(config);
              }
            }
          }

          // 序列化
          const serialized = chartModel.serialize();

          // 反序列化到新模型
          const model2 = new SpreadsheetModel(maxRow, maxCol);
          const chartModel2 = new ChartModel(model2);
          chartModel2.deserialize(serialized);

          // 验证图表数量一致
          const restoredCharts = chartModel2.getAllCharts();
          expect(restoredCharts.length).toBe(originalConfigs.length);

          // 验证每个图表配置一致
          for (const original of originalConfigs) {
            const restored = chartModel2.getChart(original.id);
            expect(restored).not.toBeNull();
            expect(restored!.type).toBe(original.type);
            expect(restored!.dataRange).toEqual(original.dataRange);
            expect(restored!.position).toEqual(original.position);
            expect(restored!.size).toEqual(original.size);
            expect(restored!.title).toEqual(original.title);
            expect(restored!.legend).toEqual(original.legend);
            expect(restored!.axes).toEqual(original.axes);
            expect(restored!.dataLabels).toEqual(original.dataLabels);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 18: 序列化 ChartConfig 包含所有必要字段
// ============================================================

describe('Feature: chart-visualization, Property 18: 序列化 ChartConfig 包含所有必要字段', () => {
  it('serialize 输出的每个对象应包含 id, type, dataRange, position, size, title, legend, axes, dataLabels', () => {
    fc.assert(
      fc.property(chartConfigPartsArb, (parts) => {
        // 创建包含数值数据的模型
        const model = createModelWithData(parts.dataRange);
        const chartModel = new ChartModel(model);

        // 创建图表
        const chartId = chartModel.createChart(
          parts.type,
          parts.dataRange,
          parts.position,
          parts.size
        );
        expect(chartId).not.toBeNull();

        // 更新配置
        chartModel.updateChart(chartId!, {
          title: parts.title,
          legend: parts.legend,
          axes: parts.axes,
          dataLabels: parts.dataLabels,
        });

        // 序列化
        const serialized = chartModel.serialize();
        expect(serialized.length).toBeGreaterThanOrEqual(1);

        // 验证每个序列化对象包含所有必要字段
        for (const item of serialized) {
          // 必要字段存在性检查
          expect(item).toHaveProperty('id');
          expect(item).toHaveProperty('type');
          expect(item).toHaveProperty('dataRange');
          expect(item).toHaveProperty('position');
          expect(item).toHaveProperty('size');
          expect(item).toHaveProperty('title');
          expect(item).toHaveProperty('legend');
          expect(item).toHaveProperty('axes');
          expect(item).toHaveProperty('dataLabels');

          // 字段类型检查
          expect(typeof item.id).toBe('string');
          expect(typeof item.type).toBe('string');
          expect(['bar', 'line', 'pie', 'scatter', 'area']).toContain(item.type);

          // dataRange 子字段检查
          expect(typeof item.dataRange.startRow).toBe('number');
          expect(typeof item.dataRange.startCol).toBe('number');
          expect(typeof item.dataRange.endRow).toBe('number');
          expect(typeof item.dataRange.endCol).toBe('number');

          // position 子字段检查
          expect(typeof item.position.x).toBe('number');
          expect(typeof item.position.y).toBe('number');

          // size 子字段检查
          expect(typeof item.size.width).toBe('number');
          expect(typeof item.size.height).toBe('number');

          // title 子字段检查
          expect(typeof item.title.text).toBe('string');
          expect(typeof item.title.fontSize).toBe('number');
          expect(['top', 'bottom']).toContain(item.title.position);
          expect(typeof item.title.visible).toBe('boolean');

          // legend 子字段检查
          expect(typeof item.legend.visible).toBe('boolean');
          expect(['top', 'bottom', 'left', 'right']).toContain(item.legend.position);

          // axes 子字段检查
          expect(item.axes).toHaveProperty('xAxis');
          expect(item.axes).toHaveProperty('yAxis');
          expect(typeof item.axes.xAxis.title).toBe('string');
          expect(typeof item.axes.xAxis.autoRange).toBe('boolean');
          expect(typeof item.axes.xAxis.showGridLines).toBe('boolean');
          expect(typeof item.axes.yAxis.title).toBe('string');
          expect(typeof item.axes.yAxis.autoRange).toBe('boolean');
          expect(typeof item.axes.yAxis.showGridLines).toBe('boolean');

          // dataLabels 子字段检查
          expect(typeof item.dataLabels.visible).toBe('boolean');
          expect(['value', 'percentage', 'category']).toContain(item.dataLabels.content);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('序列化输出经 JSON.stringify → JSON.parse 后仍包含所有必要字段', () => {
    fc.assert(
      fc.property(chartConfigPartsArb, (parts) => {
        const model = createModelWithData(parts.dataRange);
        const chartModel = new ChartModel(model);

        const chartId = chartModel.createChart(
          parts.type,
          parts.dataRange,
          parts.position,
          parts.size
        );
        expect(chartId).not.toBeNull();

        chartModel.updateChart(chartId!, {
          title: parts.title,
          legend: parts.legend,
          axes: parts.axes,
          dataLabels: parts.dataLabels,
        });

        // 序列化 → JSON 字符串 → 解析
        const serialized = chartModel.serialize();
        const jsonStr = JSON.stringify(serialized);
        const parsed = JSON.parse(jsonStr) as ChartConfig[];

        expect(parsed.length).toBe(serialized.length);

        for (let i = 0; i < parsed.length; i++) {
          const original = serialized[i];
          const restored = parsed[i];

          // 验证 JSON 往返后所有字段保持一致
          expect(restored.id).toBe(original.id);
          expect(restored.type).toBe(original.type);
          expect(restored.dataRange).toEqual(original.dataRange);
          expect(restored.position).toEqual(original.position);
          expect(restored.size).toEqual(original.size);
          expect(restored.title).toEqual(original.title);
          expect(restored.legend).toEqual(original.legend);
          expect(restored.axes).toEqual(original.axes);
          expect(restored.dataLabels).toEqual(original.dataLabels);
        }
      }),
      { numRuns: 200 }
    );
  });
});
