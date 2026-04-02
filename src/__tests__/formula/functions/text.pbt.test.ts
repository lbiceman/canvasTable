import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { FunctionRegistry } from '../../../formula/function-registry';
import { registerTextFunctions } from '../../../formula/functions/text';
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
  registerTextFunctions(registry);
});

// ============================================================
// Property 3: TEXTJOIN 分隔符连接与空值处理
// Feature: formula-functions-p1, Property 3: TEXTJOIN 分隔符连接与空值处理
// **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
// ============================================================

describe('Property 3: TEXTJOIN 分隔符连接与空值处理', () => {
  it('ignore_empty=TRUE 时结果等于过滤空字符串后用分隔符连接', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 5 }),
        fc.array(fc.string({ maxLength: 10 }), { minLength: 1, maxLength: 10 }),
        (delim, texts) => {
          // 构造参数：delimiter, ignore_empty=true, ...texts
          const args: FormulaValue[] = [delim, true, ...texts];
          const result = callFn('TEXTJOIN', args);

          // 期望结果：过滤空字符串后用分隔符连接
          const filtered = texts.filter((t) => t !== '');
          const expected = filtered.join(delim);
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ignore_empty=FALSE 时结果等于所有文本用分隔符连接', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 5 }),
        fc.array(fc.string({ maxLength: 10 }), { minLength: 1, maxLength: 10 }),
        (delim, texts) => {
          // 构造参数：delimiter, ignore_empty=false, ...texts
          const args: FormulaValue[] = [delim, false, ...texts];
          const result = callFn('TEXTJOIN', args);

          // 期望结果：所有文本（包括空字符串）用分隔符连接
          const expected = texts.join(delim);
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
