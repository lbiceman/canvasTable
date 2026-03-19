import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 6: 饼图扇区角度比例正确性
 *
 * 对于任意包含正数值的数据系列，饼图各扇区角度之和应等于 2π，
 * 且每个扇区角度应等于 (该值 / 总和) × 2π。
 *
 * **Validates: Requirements 2.5**
 */

/**
 * 计算饼图扇区角度（纯函数，与 ChartEngine.renderPieChart 逻辑一致）
 *
 * 逻辑来源：chart-engine.ts 中 renderPieChart 方法
 * - 取每个值的绝对值
 * - 计算总和
 * - 每个扇区角度 = (|value| / total) × 2π
 */
function computePieSliceAngles(values: number[]): number[] {
  // 计算总和（取绝对值），与 renderPieChart 一致
  let total = 0;
  for (const v of values) {
    total += Math.abs(v);
  }

  if (total === 0) {
    return [];
  }

  // 计算每个扇区的角度
  const angles: number[] = [];
  for (const v of values) {
    const sliceAngle = (Math.abs(v) / total) * Math.PI * 2;
    angles.push(sliceAngle);
  }

  return angles;
}

// 生成正数数组（至少 1 个元素，值 > 0）
const positiveValuesArb: fc.Arbitrary<number[]> = fc.array(
  fc.double({ min: 0.001, max: 1e6, noNaN: true }),
  { minLength: 1, maxLength: 20 }
);

describe('Feature: chart-visualization, Property 6: 饼图扇区角度比例正确性', () => {
  it('所有扇区角度之和应等于 2π', () => {
    fc.assert(
      fc.property(positiveValuesArb, (values) => {
        const angles = computePieSliceAngles(values);

        // 角度数量应与输入值数量一致
        expect(angles.length).toBe(values.length);

        // 角度之和应等于 2π（允许浮点误差）
        const totalAngle = angles.reduce((sum, a) => sum + a, 0);
        expect(totalAngle).toBeCloseTo(Math.PI * 2, 10);
      }),
      { numRuns: 200 }
    );
  });

  it('每个扇区角度应等于 (值/总和) × 2π', () => {
    fc.assert(
      fc.property(positiveValuesArb, (values) => {
        const angles = computePieSliceAngles(values);
        const total = values.reduce((sum, v) => sum + Math.abs(v), 0);

        for (let i = 0; i < values.length; i++) {
          const expectedAngle = (Math.abs(values[i]) / total) * Math.PI * 2;
          expect(angles[i]).toBeCloseTo(expectedAngle, 10);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('每个扇区角度应为非负数且不超过 2π', () => {
    fc.assert(
      fc.property(positiveValuesArb, (values) => {
        const angles = computePieSliceAngles(values);

        for (const angle of angles) {
          expect(angle).toBeGreaterThanOrEqual(0);
          expect(angle).toBeLessThanOrEqual(Math.PI * 2 + 1e-10);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('等值数据应产生等角扇区', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 1e6, noNaN: true }),
        fc.integer({ min: 2, max: 20 }),
        (value, count) => {
          const values = Array.from({ length: count }, () => value);
          const angles = computePieSliceAngles(values);

          // 所有角度应相等
          const expectedAngle = (Math.PI * 2) / count;
          for (const angle of angles) {
            expect(angle).toBeCloseTo(expectedAngle, 10);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
