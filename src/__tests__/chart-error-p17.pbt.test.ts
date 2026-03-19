import { describe, it, expect, vi } from 'vitest';
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
 * Property 17: 无效图表 JSON 优雅处理
 *
 * 对于任意格式无效的图表 JSON 数据（如缺少必要字段、类型错误），
 * 反序列化操作应跳过无效条目而不抛出异常，且不影响其余有效数据的加载。
 *
 * **Validates: Requirements 7.6**
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

// 数据范围生成器
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

// 尺寸生成器
const sizeArb: fc.Arbitrary<Size> = fc.record({
  width: fc.integer({ min: 200, max: 1200 }),
  height: fc.integer({ min: 150, max: 900 }),
});

// 标题配置生成器
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

// 完整有效 ChartConfig 生成器
const validChartConfigArb: fc.Arbitrary<ChartConfig> = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 20 }).map((s) => `chart-${s}`),
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
// 无效条目生成器
// ============================================================

// 生成各种无效的图表条目
// 策略 1: 非对象类型（null, 数字, 字符串, 数组, 布尔值）
const nonObjectArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.string(),
  fc.boolean(),
  fc.array(fc.integer(), { maxLength: 3 })
);

// 策略 2: 缺少必要字段的对象
const missingFieldsArb: fc.Arbitrary<Record<string, unknown>> = fc.oneof(
  // 缺少 id
  fc.record({
    type: fc.constantFrom('bar', 'line', 'pie'),
    dataRange: fc.constant({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 }),
    position: fc.constant({ x: 0, y: 0 }),
    size: fc.constant({ width: 400, height: 300 }),
  }),
  // 缺少 type
  fc.record({
    id: fc.constant('chart-missing-type'),
    dataRange: fc.constant({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 }),
    position: fc.constant({ x: 0, y: 0 }),
    size: fc.constant({ width: 400, height: 300 }),
  }),
  // 缺少 dataRange
  fc.record({
    id: fc.constant('chart-missing-range'),
    type: fc.constantFrom('bar', 'line'),
    position: fc.constant({ x: 0, y: 0 }),
    size: fc.constant({ width: 400, height: 300 }),
  }),
  // 缺少 position
  fc.record({
    id: fc.constant('chart-missing-pos'),
    type: fc.constantFrom('bar', 'line'),
    dataRange: fc.constant({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 }),
    size: fc.constant({ width: 400, height: 300 }),
  }),
  // 缺少 size
  fc.record({
    id: fc.constant('chart-missing-size'),
    type: fc.constantFrom('bar', 'line'),
    dataRange: fc.constant({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 }),
    position: fc.constant({ x: 0, y: 0 }),
  }),
  // 空对象
  fc.constant({})
);

// 策略 3: 字段类型错误的对象
const wrongTypeFieldsArb: fc.Arbitrary<Record<string, unknown>> = fc.oneof(
  // id 不是字符串
  fc.record({
    id: fc.integer(),
    type: fc.constantFrom('bar', 'line'),
    dataRange: fc.constant({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 }),
    position: fc.constant({ x: 0, y: 0 }),
    size: fc.constant({ width: 400, height: 300 }),
  }),
  // type 不是有效的图表类型
  fc.record({
    id: fc.constant('chart-wrong-type'),
    type: fc.constantFrom('invalid', 'unknown', 'donut', 'radar', ''),
    dataRange: fc.constant({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 }),
    position: fc.constant({ x: 0, y: 0 }),
    size: fc.constant({ width: 400, height: 300 }),
  }),
  // dataRange 字段类型错误
  fc.record({
    id: fc.constant('chart-wrong-range'),
    type: fc.constantFrom('bar', 'line'),
    dataRange: fc.constant({ startRow: 'a', startCol: 'b', endRow: 'c', endCol: 'd' }),
    position: fc.constant({ x: 0, y: 0 }),
    size: fc.constant({ width: 400, height: 300 }),
  }),
  // position 字段类型错误
  fc.record({
    id: fc.constant('chart-wrong-pos'),
    type: fc.constantFrom('bar', 'line'),
    dataRange: fc.constant({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 }),
    position: fc.constant({ x: 'abc', y: 'def' }),
    size: fc.constant({ width: 400, height: 300 }),
  }),
  // size 字段类型错误
  fc.record({
    id: fc.constant('chart-wrong-size'),
    type: fc.constantFrom('bar', 'line'),
    dataRange: fc.constant({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 }),
    position: fc.constant({ x: 0, y: 0 }),
    size: fc.constant({ width: 'big', height: 'tall' }),
  })
);

// 综合无效条目生成器
const invalidEntryArb: fc.Arbitrary<unknown> = fc.oneof(
  nonObjectArb,
  missingFieldsArb,
  wrongTypeFieldsArb
);

// ============================================================
// 测试
// ============================================================

describe('Feature: chart-visualization, Property 17: 无效图表 JSON 优雅处理', () => {
  it('纯无效条目数组：deserialize 不抛异常且不加载任何图表', () => {
    fc.assert(
      fc.property(
        fc.array(invalidEntryArb, { minLength: 1, maxLength: 10 }),
        (invalidEntries) => {
          const model = new SpreadsheetModel(20, 20);
          const chartModel = new ChartModel(model);

          // 抑制 console.warn 输出
          const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

          // deserialize 不应抛出异常
          expect(() => {
            chartModel.deserialize(invalidEntries as unknown[]);
          }).not.toThrow();

          // 无效条目不应被加载
          expect(chartModel.getAllCharts().length).toBe(0);

          // 应有 console.warn 被调用（每个无效条目一次）
          expect(warnSpy).toHaveBeenCalled();

          warnSpy.mockRestore();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('混合有效和无效条目：有效条目被正确恢复，无效条目被跳过', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(validChartConfigArb, { minLength: 1, maxLength: 5 }),
          fc.array(invalidEntryArb, { minLength: 1, maxLength: 5 })
        ),
        ([validConfigs, invalidEntries]) => {
          const model = new SpreadsheetModel(30, 30);
          const chartModel = new ChartModel(model);

          // 确保有效配置的 id 唯一
          const uniqueValidConfigs = validConfigs.reduce<ChartConfig[]>((acc, config, idx) => {
            const uniqueConfig = { ...config, id: `valid-chart-${idx}` };
            acc.push(uniqueConfig);
            return acc;
          }, []);

          // 构建混合数组：交替插入有效和无效条目
          const mixedData: unknown[] = [];
          const maxLen = Math.max(uniqueValidConfigs.length, invalidEntries.length);
          for (let i = 0; i < maxLen; i++) {
            if (i < invalidEntries.length) {
              mixedData.push(invalidEntries[i]);
            }
            if (i < uniqueValidConfigs.length) {
              mixedData.push(uniqueValidConfigs[i]);
            }
          }

          // 抑制 console.warn 输出
          const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

          // deserialize 不应抛出异常
          expect(() => {
            chartModel.deserialize(mixedData);
          }).not.toThrow();

          // 验证有效条目被正确恢复
          const allCharts = chartModel.getAllCharts();
          expect(allCharts.length).toBe(uniqueValidConfigs.length);

          // 验证每个有效条目的关键字段
          for (const validConfig of uniqueValidConfigs) {
            const restored = chartModel.getChart(validConfig.id);
            expect(restored).not.toBeNull();
            expect(restored!.id).toBe(validConfig.id);
            expect(restored!.type).toBe(validConfig.type);
            expect(restored!.dataRange).toEqual(validConfig.dataRange);
            expect(restored!.position).toEqual(validConfig.position);
            expect(restored!.size).toEqual(validConfig.size);
          }

          // 应有 console.warn 被调用（无效条目触发）
          expect(warnSpy).toHaveBeenCalled();

          warnSpy.mockRestore();
        }
      ),
      { numRuns: 200 }
    );
  });

  it('空数组：deserialize 不抛异常且图表列表为空', () => {
    const model = new SpreadsheetModel(20, 20);
    const chartModel = new ChartModel(model);

    expect(() => {
      chartModel.deserialize([]);
    }).not.toThrow();

    expect(chartModel.getAllCharts().length).toBe(0);
  });
});
