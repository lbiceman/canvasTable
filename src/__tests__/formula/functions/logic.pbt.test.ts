import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { FunctionRegistry } from '../../../formula/function-registry';
import { registerLogicFunctions } from '../../../formula/functions/logic';
import { isError } from '../../../formula/evaluator';
import type { FormulaValue, FormulaError, EvaluationContext, ErrorType } from '../../../formula/types';

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

/** 创建 FormulaError 的辅助方法 */
function makeErr(type: ErrorType, message: string): FormulaError {
  return { type, message };
}

beforeEach(() => {
  registry = new FunctionRegistry();
  registerLogicFunctions(registry);
});

// ============================================================
// 生成器
// ============================================================

/** 生成非错误的 FormulaValue */
const arbNonErrorValue: fc.Arbitrary<FormulaValue> = fc.oneof(
  fc.integer({ min: -1e9, max: 1e9 }),
  fc.string({ maxLength: 50 }),
  fc.boolean(),
);

/** 生成非 #N/A 的错误类型 */
const nonNAErrorTypes: ErrorType[] = ['#VALUE!', '#REF!', '#DIV/0!', '#NAME?', '#NUM!', '#NULL!'];
const arbNonNAErrorType: fc.Arbitrary<ErrorType> = fc.constantFrom(...nonNAErrorTypes);

// ============================================================
// Property 1: IFNA 选择性错误拦截
// Feature: formula-functions-p1, Property 1: IFNA 选择性错误拦截
// **Validates: Requirements 1.1, 1.3**
// ============================================================

describe('Property 1: IFNA 选择性错误拦截', () => {
  it('当值为 #N/A 错误时，IFNA 应返回替代值', () => {
    fc.assert(
      fc.property(
        arbNonErrorValue,
        (alt) => {
          const naErr = makeErr('#N/A', '不可用');
          const result = callFn('IFNA', [naErr, alt]);
          // 应返回替代值
          expect(result).toEqual(alt);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('当值不是错误时，IFNA 应返回原值', () => {
    fc.assert(
      fc.property(
        arbNonErrorValue,
        arbNonErrorValue,
        (value, alt) => {
          const result = callFn('IFNA', [value, alt]);
          // 应返回原值
          expect(result).toEqual(value);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 2: IFNA 非 #N/A 错误传播
// Feature: formula-functions-p1, Property 2: IFNA 非 #N/A 错误传播
// **Validates: Requirements 1.2**
// ============================================================

describe('Property 2: IFNA 非 #N/A 错误传播', () => {
  it('非 #N/A 类型的错误应原样传播', () => {
    fc.assert(
      fc.property(
        arbNonNAErrorType,
        fc.string({ maxLength: 50 }),
        arbNonErrorValue,
        (errType, errMsg, alt) => {
          const err = makeErr(errType, errMsg);
          const result = callFn('IFNA', [err, alt]);
          // 应返回原始错误
          expect(isError(result)).toBe(true);
          if (isError(result)) {
            expect(result.type).toBe(errType);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
