import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { SparklineConfig, SparklineType, DataRange } from '../chart/types';

/**
 * Property 2: SparklineConfig 序列化往返一致性
 *
 * 对于任意有效的 SparklineConfig 对象，将其序列化为 JSON 字符串后再反序列化，
 * 应产生与原始对象等价的 SparklineConfig。
 *
 * **Validates: Requirements 6.7, 6.8**
 */

// 迷你图类型生成器
const sparklineTypeArb: fc.Arbitrary<SparklineType> = fc.constantFrom(
  'line' as const,
  'bar' as const,
  'winLoss' as const
);

// 数据范围生成器：确保 endRow >= startRow, endCol >= startCol
const dataRangeArb: fc.Arbitrary<DataRange> = fc
  .record({
    startRow: fc.integer({ min: 0, max: 999 }),
    startCol: fc.integer({ min: 0, max: 255 }),
    rowSpan: fc.integer({ min: 0, max: 100 }),
    colSpan: fc.integer({ min: 0, max: 100 }),
  })
  .map(({ startRow, startCol, rowSpan, colSpan }) => ({
    startRow,
    startCol,
    endRow: startRow + rowSpan,
    endCol: startCol + colSpan,
  }));

// 十六进制颜色字符串生成器
const hexColorArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom('0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'), { minLength: 6, maxLength: 6 })
  .map((chars) => `#${chars.join('')}`);

// 可选颜色生成器：undefined 或有效的十六进制颜色字符串
const optionalColorArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  hexColorArb
);

// 可选布尔值生成器
const optionalBoolArb: fc.Arbitrary<boolean | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.boolean()
);

// SparklineConfig 生成器
const sparklineConfigArb: fc.Arbitrary<SparklineConfig> = fc
  .record({
    type: sparklineTypeArb,
    dataRange: dataRangeArb,
    color: optionalColorArb,
    highlightMax: optionalBoolArb,
    highlightMin: optionalBoolArb,
  })
  .map((raw) => {
    // 移除值为 undefined 的可选字段，模拟真实场景
    const config: SparklineConfig = {
      type: raw.type,
      dataRange: raw.dataRange,
    };
    if (raw.color !== undefined) {
      config.color = raw.color;
    }
    if (raw.highlightMax !== undefined) {
      config.highlightMax = raw.highlightMax;
    }
    if (raw.highlightMin !== undefined) {
      config.highlightMin = raw.highlightMin;
    }
    return config;
  });

describe('Feature: chart-visualization, Property 2: SparklineConfig 序列化往返一致性', () => {
  it('任意有效 SparklineConfig 经 JSON.stringify → JSON.parse 往返后应与原始对象深度相等', () => {
    fc.assert(
      fc.property(sparklineConfigArb, (config: SparklineConfig) => {
        // 序列化
        const json = JSON.stringify(config);

        // 反序列化
        const parsed: SparklineConfig = JSON.parse(json) as SparklineConfig;

        // 验证往返一致性
        expect(parsed).toEqual(config);
      }),
      { numRuns: 200 }
    );
  });

  it('包含所有可选字段的 SparklineConfig 往返一致', () => {
    // 生成必定包含所有可选字段的配置
    const fullConfigArb: fc.Arbitrary<SparklineConfig> = fc.record({
      type: sparklineTypeArb,
      dataRange: dataRangeArb,
      color: hexColorArb,
      highlightMax: fc.boolean(),
      highlightMin: fc.boolean(),
    });

    fc.assert(
      fc.property(fullConfigArb, (config: SparklineConfig) => {
        const json = JSON.stringify(config);
        const parsed: SparklineConfig = JSON.parse(json) as SparklineConfig;

        // 验证所有字段都保留
        expect(parsed.type).toBe(config.type);
        expect(parsed.dataRange).toEqual(config.dataRange);
        expect(parsed.color).toBe(config.color);
        expect(parsed.highlightMax).toBe(config.highlightMax);
        expect(parsed.highlightMin).toBe(config.highlightMin);
      }),
      { numRuns: 200 }
    );
  });

  it('仅包含必填字段的 SparklineConfig 往返一致', () => {
    // 生成仅包含必填字段的配置
    const minimalConfigArb: fc.Arbitrary<SparklineConfig> = fc.record({
      type: sparklineTypeArb,
      dataRange: dataRangeArb,
    });

    fc.assert(
      fc.property(minimalConfigArb, (config: SparklineConfig) => {
        const json = JSON.stringify(config);
        const parsed: SparklineConfig = JSON.parse(json) as SparklineConfig;

        expect(parsed).toEqual(config);
        // 确认可选字段不存在
        expect(parsed.color).toBeUndefined();
        expect(parsed.highlightMax).toBeUndefined();
        expect(parsed.highlightMin).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });
});
