import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { FunctionRegistry } from '../../../formula/function-registry';
import { registerMathFunctions } from '../../../formula/functions/math';
import type { FormulaValue, EvaluationContext } from '../../../formula/types';

// ============================================================
// 测试辅助工具
// ============================================================

const dummyContext: EvaluationContext = {
  row: 0,
  col: 0,
  getCellValue: () => 0,
  getRangeValues: () => [],
  resolveNamedRange: () => null,
};

let registry: FunctionRegistry;

function callFn(name: string, args: FormulaValue[]): FormulaValue {
  const def = registry.get(name);
  if (!def) throw new Error(`函数 ${name} 未注册`);
  return def.handler(args, dummyContext);
}

beforeEach(() => {
  registry = new FunctionRegistry();
  registerMathFunctions(registry);
});

/** 生成有限浮点数（排除 NaN、Infinity、-0） */
const arbFiniteNumber = fc.double({
  min: -1e10,
  max: 1e10,
  noNaN: true,
}).filter((n) => isFinite(n) && (n !== 0 || Object.is(n, 0)));

/** 生成非负整数小数位数 */
const arbDigits = fc.integer({ min: 0, max: 10 });

// ============================================================
// Property 4: ROUNDUP 向远离零方向舍入
// Feature: formula-functions-p1, Property 4: ROUNDUP 向远离零方向舍入
// **Validates: Requirements 3.1, 3.2**
// ============================================================

describe('Property 4: ROUNDUP 向远离零方向舍入', () => {
  it('ROUNDUP 结果的绝对值不小于原值绝对值', () => {
    fc.assert(
      fc.property(
        arbFiniteNumber,
        arbDigits,
        (num, digits) => {
          const result = callFn('ROUNDUP', [num, digits]);
          if (typeof result !== 'number') return; // 跳过非数值结果
          // |result| >= |num|（考虑浮点精度）
          expect(Math.abs(result)).toBeGreaterThanOrEqual(Math.abs(num) - 1e-12);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ROUNDUP 结果与原值同号（或零）', () => {
    fc.assert(
      fc.property(
        arbFiniteNumber,
        arbDigits,
        (num, digits) => {
          const result = callFn('ROUNDUP', [num, digits]);
          if (typeof result !== 'number') return;
          if (num === 0) {
            expect(result).toBe(0);
          } else if (num > 0) {
            expect(result).toBeGreaterThanOrEqual(0);
          } else {
            expect(result).toBeLessThanOrEqual(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 5: ROUNDDOWN 向接近零方向舍入
// Feature: formula-functions-p1, Property 5: ROUNDDOWN 向接近零方向舍入
// **Validates: Requirements 3.3, 3.4**
// ============================================================

describe('Property 5: ROUNDDOWN 向接近零方向舍入', () => {
  it('ROUNDDOWN 结果的绝对值不大于原值绝对值', () => {
    fc.assert(
      fc.property(
        arbFiniteNumber,
        arbDigits,
        (num, digits) => {
          const result = callFn('ROUNDDOWN', [num, digits]);
          if (typeof result !== 'number') return;
          // |result| <= |num|（考虑浮点精度）
          expect(Math.abs(result)).toBeLessThanOrEqual(Math.abs(num) + 1e-12);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ROUNDDOWN 结果与原值同号（或零）', () => {
    fc.assert(
      fc.property(
        arbFiniteNumber,
        arbDigits,
        (num, digits) => {
          const result = callFn('ROUNDDOWN', [num, digits]);
          if (typeof result !== 'number') return;
          if (num === 0) {
            expect(result).toBe(0);
          } else if (num > 0) {
            expect(result).toBeGreaterThanOrEqual(0);
          } else {
            expect(result).toBeLessThanOrEqual(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 6: INT 等价于 Math.floor
// Feature: formula-functions-p1, Property 6: INT 等价于 Math.floor
// **Validates: Requirements 3.5, 3.6**
// ============================================================

describe('Property 6: INT 等价于 Math.floor', () => {
  it('INT(n) 应等于 Math.floor(n)', () => {
    fc.assert(
      fc.property(
        arbFiniteNumber,
        (num) => {
          const result = callFn('INT', [num]);
          expect(result).toBe(Math.floor(num));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 7: TRUNC 向零方向截断
// Feature: formula-functions-p1, Property 7: TRUNC 向零方向截断
// **Validates: Requirements 3.7, 3.8, 3.9**
// ============================================================

describe('Property 7: TRUNC 向零方向截断', () => {
  it('TRUNC 结果的绝对值不大于原值绝对值', () => {
    fc.assert(
      fc.property(
        arbFiniteNumber,
        arbDigits,
        (num, digits) => {
          const result = callFn('TRUNC', [num, digits]);
          if (typeof result !== 'number') return;
          // |result| <= |num|（考虑浮点精度）
          expect(Math.abs(result)).toBeLessThanOrEqual(Math.abs(num) + 1e-12);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('TRUNC 结果与原值的差的绝对值小于 10^(-digits)', () => {
    fc.assert(
      fc.property(
        arbFiniteNumber,
        fc.integer({ min: 0, max: 8 }),
        (num, digits) => {
          const result = callFn('TRUNC', [num, digits]);
          if (typeof result !== 'number') return;
          const maxDiff = Math.pow(10, -digits);
          expect(Math.abs(result - num)).toBeLessThan(maxDiff + 1e-12);
        },
      ),
      { numRuns: 100 },
    );
  });
});
