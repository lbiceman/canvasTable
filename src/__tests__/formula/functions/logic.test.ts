import { describe, it, expect, beforeEach } from 'vitest';
import { FunctionRegistry } from '../../../formula/function-registry';
import { registerLogicFunctions } from '../../../formula/functions/logic';
import { isError } from '../../../formula/evaluator';
import type { FormulaValue, EvaluationContext, FormulaError } from '../../../formula/types';

// ============================================================
// 测试辅助工具
// ============================================================

/** 空的求值上下文（逻辑函数不需要上下文） */
const dummyContext: EvaluationContext = {
  row: 0,
  col: 0,
  getCellValue: () => 0,
  getRangeValues: () => [],
  resolveNamedRange: () => null,
};

let registry: FunctionRegistry;

/** 调用已注册函数的辅助方法 */
function callFn(name: string, args: FormulaValue[]): FormulaValue {
  const def = registry.get(name);
  if (!def) throw new Error(`函数 ${name} 未注册`);
  return def.handler(args, dummyContext);
}

/** 创建错误值的辅助方法 */
function makeErr(type: string, message: string): FormulaError {
  return { type: type as FormulaError['type'], message };
}

beforeEach(() => {
  registry = new FunctionRegistry();
  registerLogicFunctions(registry);
});

// ============================================================
// IF 函数测试
// ============================================================

describe('IF', () => {
  it('条件为 TRUE 时应返回第二个参数', () => {
    expect(callFn('IF', [true, '是', '否'])).toBe('是');
  });

  it('条件为 FALSE 时应返回第三个参数', () => {
    expect(callFn('IF', [false, '是', '否'])).toBe('否');
  });

  it('省略第三个参数时，条件为 FALSE 应返回 false', () => {
    expect(callFn('IF', [false, '是'])).toBe(false);
  });

  it('隐式布尔转换：非零数值应视为 TRUE', () => {
    expect(callFn('IF', [5, '真', '假'])).toBe('真');
    expect(callFn('IF', [-1, '真', '假'])).toBe('真');
  });

  it('隐式布尔转换：零应视为 FALSE', () => {
    expect(callFn('IF', [0, '真', '假'])).toBe('假');
  });

  it('隐式布尔转换：非空字符串应视为 TRUE', () => {
    expect(callFn('IF', ['hello', '真', '假'])).toBe('真');
  });

  it('隐式布尔转换：空字符串应视为 FALSE', () => {
    expect(callFn('IF', ['', '真', '假'])).toBe('假');
  });

  it('条件为错误值时应传播错误', () => {
    const err = makeErr('#VALUE!', '测试错误');
    const result = callFn('IF', [err, '是', '否']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// AND 函数测试
// ============================================================

describe('AND', () => {
  it('所有参数为 TRUE 时应返回 TRUE', () => {
    expect(callFn('AND', [true, true, true])).toBe(true);
  });

  it('任一参数为 FALSE 时应返回 FALSE', () => {
    expect(callFn('AND', [true, false, true])).toBe(false);
  });

  it('单个 TRUE 参数应返回 TRUE', () => {
    expect(callFn('AND', [true])).toBe(true);
  });

  it('单个 FALSE 参数应返回 FALSE', () => {
    expect(callFn('AND', [false])).toBe(false);
  });

  it('隐式布尔转换：非零数值应视为 TRUE', () => {
    expect(callFn('AND', [1, 2, 3])).toBe(true);
  });

  it('隐式布尔转换：零应视为 FALSE', () => {
    expect(callFn('AND', [1, 0, 3])).toBe(false);
  });

  it('应支持区域引用（二维数组）', () => {
    const range: FormulaValue = [[true, true], [true, true]];
    expect(callFn('AND', [range])).toBe(true);
  });

  it('区域引用中有 FALSE 应返回 FALSE', () => {
    const range: FormulaValue = [[true, false], [true, true]];
    expect(callFn('AND', [range])).toBe(false);
  });

  it('遇到错误值应传播错误', () => {
    const err = makeErr('#VALUE!', '测试错误');
    const result = callFn('AND', [true, err]);
    expect(isError(result)).toBe(true);
  });
});

// ============================================================
// OR 函数测试
// ============================================================

describe('OR', () => {
  it('任一参数为 TRUE 时应返回 TRUE', () => {
    expect(callFn('OR', [false, true, false])).toBe(true);
  });

  it('所有参数为 FALSE 时应返回 FALSE', () => {
    expect(callFn('OR', [false, false, false])).toBe(false);
  });

  it('单个 TRUE 参数应返回 TRUE', () => {
    expect(callFn('OR', [true])).toBe(true);
  });

  it('单个 FALSE 参数应返回 FALSE', () => {
    expect(callFn('OR', [false])).toBe(false);
  });

  it('隐式布尔转换：非零数值应视为 TRUE', () => {
    expect(callFn('OR', [0, 0, 5])).toBe(true);
  });

  it('隐式布尔转换：全零应返回 FALSE', () => {
    expect(callFn('OR', [0, 0, 0])).toBe(false);
  });

  it('应支持区域引用（二维数组）', () => {
    const range: FormulaValue = [[false, false], [false, true]];
    expect(callFn('OR', [range])).toBe(true);
  });

  it('有 true 值时即使有错误也应返回 TRUE', () => {
    const err = makeErr('#VALUE!', '测试错误');
    expect(callFn('OR', [err, true])).toBe(true);
  });

  it('全 false 且有错误时应传播错误', () => {
    const err = makeErr('#VALUE!', '测试错误');
    const result = callFn('OR', [false, err]);
    expect(isError(result)).toBe(true);
  });
});

// ============================================================
// NOT 函数测试
// ============================================================

describe('NOT', () => {
  it('TRUE 应返回 FALSE', () => {
    expect(callFn('NOT', [true])).toBe(false);
  });

  it('FALSE 应返回 TRUE', () => {
    expect(callFn('NOT', [false])).toBe(true);
  });

  it('隐式布尔转换：0 应返回 TRUE', () => {
    expect(callFn('NOT', [0])).toBe(true);
  });

  it('隐式布尔转换：非零数值应返回 FALSE', () => {
    expect(callFn('NOT', [5])).toBe(false);
  });

  it('隐式布尔转换：空字符串应返回 TRUE', () => {
    expect(callFn('NOT', [''])).toBe(true);
  });

  it('隐式布尔转换：非空字符串应返回 FALSE', () => {
    expect(callFn('NOT', ['hello'])).toBe(false);
  });

  it('错误值应传播', () => {
    const err = makeErr('#REF!', '测试错误');
    const result = callFn('NOT', [err]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#REF!');
  });
});

// ============================================================
// IFERROR 函数测试
// ============================================================

describe('IFERROR', () => {
  it('非错误值应返回原值', () => {
    expect(callFn('IFERROR', [10, '错误'])).toBe(10);
  });

  it('字符串非错误值应返回原值', () => {
    expect(callFn('IFERROR', ['hello', '错误'])).toBe('hello');
  });

  it('布尔非错误值应返回原值', () => {
    expect(callFn('IFERROR', [true, '错误'])).toBe(true);
  });

  it('#VALUE! 错误应返回备选值', () => {
    const err = makeErr('#VALUE!', '值错误');
    expect(callFn('IFERROR', [err, '已处理'])).toBe('已处理');
  });

  it('#DIV/0! 错误应返回备选值', () => {
    const err = makeErr('#DIV/0!', '除零错误');
    expect(callFn('IFERROR', [err, 0])).toBe(0);
  });

  it('#REF! 错误应返回备选值', () => {
    const err = makeErr('#REF!', '引用错误');
    expect(callFn('IFERROR', [err, '默认'])).toBe('默认');
  });

  it('#N/A 错误应返回备选值', () => {
    const err = makeErr('#N/A', '不可用');
    expect(callFn('IFERROR', [err, '未找到'])).toBe('未找到');
  });

  it('#NUM! 错误应返回备选值', () => {
    const err = makeErr('#NUM!', '数值错误');
    expect(callFn('IFERROR', [err, -1])).toBe(-1);
  });
});

// ============================================================
// IFS 函数测试
// ============================================================

describe('IFS', () => {
  it('第一个条件为真时应返回对应值', () => {
    expect(callFn('IFS', [true, 'A', false, 'B'])).toBe('A');
  });

  it('第二个条件为真时应返回对应值', () => {
    expect(callFn('IFS', [false, 'A', true, 'B'])).toBe('B');
  });

  it('多个条件为真时应返回第一个为真的对应值', () => {
    expect(callFn('IFS', [false, 'A', true, 'B', true, 'C'])).toBe('B');
  });

  it('无条件为真时应返回 #N/A', () => {
    const result = callFn('IFS', [false, 'A', false, 'B']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#N/A');
  });

  it('隐式布尔转换：非零数值条件应视为 TRUE', () => {
    expect(callFn('IFS', [0, 'A', 5, 'B'])).toBe('B');
  });

  it('参数数量为奇数时应返回 #VALUE!', () => {
    const result = callFn('IFS', [true, 'A', false]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });

  it('条件为错误值时应传播错误', () => {
    const err = makeErr('#REF!', '引用错误');
    const result = callFn('IFS', [err, 'A']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#REF!');
  });
});

// ============================================================
// SWITCH 函数测试
// ============================================================

describe('SWITCH', () => {
  it('匹配第一个值时应返回对应结果', () => {
    expect(callFn('SWITCH', [1, 1, '一', 2, '二', '其他'])).toBe('一');
  });

  it('匹配第二个值时应返回对应结果', () => {
    expect(callFn('SWITCH', [2, 1, '一', 2, '二', '其他'])).toBe('二');
  });

  it('无匹配时应返回默认值', () => {
    expect(callFn('SWITCH', [9, 1, '一', 2, '二', '其他'])).toBe('其他');
  });

  it('无匹配且无默认值时应返回 #N/A', () => {
    const result = callFn('SWITCH', [9, 1, '一', 2, '二']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#N/A');
  });

  it('应支持字符串匹配', () => {
    expect(callFn('SWITCH', ['b', 'a', 1, 'b', 2, 'c', 3])).toBe(2);
  });

  it('应支持数值匹配', () => {
    expect(callFn('SWITCH', [3.14, 1, 'one', 3.14, 'pi'])).toBe('pi');
  });

  it('应支持布尔值匹配', () => {
    expect(callFn('SWITCH', [true, false, '假', true, '真'])).toBe('真');
  });

  it('表达式为错误值时应传播错误', () => {
    const err = makeErr('#VALUE!', '值错误');
    const result = callFn('SWITCH', [err, 1, '一']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });

  it('单个匹配对匹配成功时应返回结果', () => {
    // SWITCH(1, 1, "一") => expression=1, value=1, result="一"
    expect(callFn('SWITCH', [1, 1, '一'])).toBe('一');
  });

  it('单个匹配对不匹配时应返回 #N/A', () => {
    // SWITCH(3, 1, "一") => expression=3, value=1, result="一", 不匹配且无默认值
    const result = callFn('SWITCH', [3, 1, '一']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#N/A');
  });
});

// ============================================================
// 函数注册验证
// ============================================================

describe('registerLogicFunctions', () => {
  it('应注册全部 7 个逻辑函数', () => {
    const names = ['IF', 'AND', 'OR', 'NOT', 'IFERROR', 'IFS', 'SWITCH'];
    for (const name of names) {
      expect(registry.get(name)).toBeDefined();
    }
  });

  it('每个函数应有正确的 category', () => {
    const names = ['IF', 'AND', 'OR', 'NOT', 'IFERROR', 'IFS', 'SWITCH'];
    for (const name of names) {
      expect(registry.get(name)?.category).toBe('logic');
    }
  });
});
