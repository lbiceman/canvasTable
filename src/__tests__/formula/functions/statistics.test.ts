import { describe, it, expect, beforeEach } from 'vitest';
import { FunctionRegistry } from '../../../formula/function-registry';
import { registerStatisticsFunctions } from '../../../formula/functions/statistics';
import { isError } from '../../../formula/evaluator';
import type { FormulaValue, EvaluationContext } from '../../../formula/types';

// ============================================================
// 测试辅助工具
// ============================================================

/** 空的求值上下文（统计函数不需要上下文） */
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

beforeEach(() => {
  registry = new FunctionRegistry();
  registerStatisticsFunctions(registry);
});

// ============================================================
// COUNT 函数测试
// ============================================================

describe('COUNT', () => {
  it('应计数区域中的数值单元格', () => {
    const range: FormulaValue = [[1, 'text', 3, '', 5]];
    expect(callFn('COUNT', [range])).toBe(3);
  });

  it('应忽略区域中的布尔值和字符串', () => {
    const range: FormulaValue = [[true, false, 'hello', 42]];
    expect(callFn('COUNT', [range])).toBe(1);
  });

  it('直接传入的布尔值应计为数值', () => {
    expect(callFn('COUNT', [1, true, 'abc', 3])).toBe(3);
  });

  it('直接传入的数字字符串应计数', () => {
    expect(callFn('COUNT', ['5', 'abc', 3])).toBe(2);
  });

  it('空区域应返回 0', () => {
    const range: FormulaValue = [['', '', '']];
    expect(callFn('COUNT', [range])).toBe(0);
  });
});

// ============================================================
// COUNTA 函数测试
// ============================================================

describe('COUNTA', () => {
  it('应计数区域中的非空单元格', () => {
    const range: FormulaValue = [[1, 'text', 3, '', 5]];
    expect(callFn('COUNTA', [range])).toBe(4);
  });

  it('应计数布尔值', () => {
    const range: FormulaValue = [[true, false, '', 42]];
    expect(callFn('COUNTA', [range])).toBe(3);
  });

  it('直接传入的非空参数都应计数', () => {
    expect(callFn('COUNTA', [1, 'hello', true, ''])).toBe(3);
  });

  it('全空区域应返回 0', () => {
    const range: FormulaValue = [['', '', '']];
    expect(callFn('COUNTA', [range])).toBe(0);
  });
});

// ============================================================
// COUNTIF 函数测试
// ============================================================

describe('COUNTIF', () => {
  it('应使用 > 运算符计数', () => {
    const range: FormulaValue = [[1, 5, 8, 3, 10]];
    expect(callFn('COUNTIF', [range, '>5'])).toBe(2);
  });

  it('应使用 < 运算符计数', () => {
    const range: FormulaValue = [[1, 5, 8, 3, 10]];
    expect(callFn('COUNTIF', [range, '<5'])).toBe(2);
  });

  it('应使用 >= 运算符计数', () => {
    const range: FormulaValue = [[1, 5, 8, 3, 10]];
    expect(callFn('COUNTIF', [range, '>=5'])).toBe(3);
  });

  it('应使用 <= 运算符计数', () => {
    const range: FormulaValue = [[1, 5, 8, 3, 10]];
    expect(callFn('COUNTIF', [range, '<=5'])).toBe(3);
  });

  it('应使用 = 运算符精确匹配', () => {
    const range: FormulaValue = [[1, 5, 8, 5, 10]];
    expect(callFn('COUNTIF', [range, '=5'])).toBe(2);
  });

  it('应使用 <> 运算符计数不等于', () => {
    const range: FormulaValue = [[1, 5, 8, 3, 10]];
    expect(callFn('COUNTIF', [range, '<>5'])).toBe(4);
  });

  it('应支持数值条件精确匹配', () => {
    const range: FormulaValue = [[1, 5, 8, 5, 10]];
    expect(callFn('COUNTIF', [range, 5])).toBe(2);
  });

  it('应支持通配符 * 匹配', () => {
    const range: FormulaValue = [['Apple', 'Banana', 'Avocado']];
    expect(callFn('COUNTIF', [range, 'A*'])).toBe(2);
  });

  it('应支持通配符 ? 匹配', () => {
    const range: FormulaValue = [['cat', 'car', 'cab', 'can', 'cape']];
    expect(callFn('COUNTIF', [range, 'ca?'])).toBe(4);
  });

  it('应支持字符串精确匹配（不区分大小写）', () => {
    const range: FormulaValue = [['Apple', 'apple', 'APPLE', 'Banana']];
    expect(callFn('COUNTIF', [range, 'apple'])).toBe(3);
  });
});


// ============================================================
// COUNTIFS 函数测试
// ============================================================

describe('COUNTIFS', () => {
  it('应计数同时满足多个条件的单元格', () => {
    const rangeA: FormulaValue = [[1, 5, 8, 3, 10]];
    const rangeB: FormulaValue = [[10, 20, 30, 40, 50]];
    expect(callFn('COUNTIFS', [rangeA, '>3', rangeB, '<40'])).toBe(2);
  });

  it('应支持两对条件', () => {
    const rangeA: FormulaValue = [[1, 5, 8, 3, 10]];
    const rangeB: FormulaValue = [[10, 20, 30, 40, 50]];
    expect(callFn('COUNTIFS', [rangeA, '>=5', rangeB, '>=20'])).toBe(3);
  });

  it('条件区域大小不一致应返回 #VALUE!', () => {
    const rangeA: FormulaValue = [[1, 2, 3]];
    const rangeB: FormulaValue = [[1, 2]];
    const result = callFn('COUNTIFS', [rangeA, '>0', rangeB, '>0']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });

  it('参数不成对应返回 #VALUE!', () => {
    const range: FormulaValue = [[1, 2, 3]];
    const result = callFn('COUNTIFS', [range, '>0', range]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// SUMIF 函数测试
// ============================================================

describe('SUMIF', () => {
  it('应对满足条件的对应求和区域求和', () => {
    const criteriaRange: FormulaValue = [[1, 5, 8, 3, 10]];
    const sumRange: FormulaValue = [[100, 200, 300, 400, 500]];
    expect(callFn('SUMIF', [criteriaRange, '>5', sumRange])).toBe(800);
  });

  it('无 sum_range 时应对条件区域自身求和', () => {
    const range: FormulaValue = [[1, 5, 8, 3, 10]];
    expect(callFn('SUMIF', [range, '>5'])).toBe(18);
  });

  it('无匹配时应返回 0', () => {
    const range: FormulaValue = [[1, 2, 3]];
    expect(callFn('SUMIF', [range, '>100'])).toBe(0);
  });

  it('应支持精确匹配条件', () => {
    const criteriaRange: FormulaValue = [['A', 'B', 'A', 'C']];
    const sumRange: FormulaValue = [[10, 20, 30, 40]];
    expect(callFn('SUMIF', [criteriaRange, 'A', sumRange])).toBe(40);
  });
});

// ============================================================
// SUMIFS 函数测试
// ============================================================

describe('SUMIFS', () => {
  it('应对同时满足所有条件的对应求和区域求和', () => {
    const sumRange: FormulaValue = [[100, 200, 300]];
    const rangeA: FormulaValue = [[10, 20, 30]];
    const rangeB: FormulaValue = [[1, 2, 3]];
    expect(callFn('SUMIFS', [sumRange, rangeA, '>10', rangeB, '>1'])).toBe(500);
  });

  it('无匹配时应返回 0', () => {
    const sumRange: FormulaValue = [[100, 200, 300]];
    const rangeA: FormulaValue = [[10, 20, 30]];
    expect(callFn('SUMIFS', [sumRange, rangeA, '>100'])).toBe(0);
  });

  it('条件区域大小不一致应返回 #VALUE!', () => {
    const sumRange: FormulaValue = [[100, 200, 300]];
    const rangeA: FormulaValue = [[10, 20, 30]];
    const rangeB: FormulaValue = [[1, 2]];
    const result = callFn('SUMIFS', [sumRange, rangeA, '>0', rangeB, '>0']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// AVERAGEIF 函数测试
// ============================================================

describe('AVERAGEIF', () => {
  it('应返回满足条件的对应区域的平均值', () => {
    const criteriaRange: FormulaValue = [[1, 5, 8, 3, 10]];
    const avgRange: FormulaValue = [[100, 200, 300, 400, 500]];
    // 满足 >5 的是 8 和 10，对应 300 和 500，平均 400
    expect(callFn('AVERAGEIF', [criteriaRange, '>5', avgRange])).toBe(400);
  });

  it('无 average_range 时应对条件区域自身求平均', () => {
    const range: FormulaValue = [[1, 5, 8, 3, 10]];
    // 满足 >5 的是 8 和 10，平均 9
    expect(callFn('AVERAGEIF', [range, '>5'])).toBe(9);
  });

  it('无匹配时应返回 #DIV/0!', () => {
    const range: FormulaValue = [[1, 2, 3]];
    const result = callFn('AVERAGEIF', [range, '>100']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#DIV/0!');
  });

  it('应支持字符串条件匹配', () => {
    const criteriaRange: FormulaValue = [['A', 'B', 'A', 'C']];
    const avgRange: FormulaValue = [[10, 20, 30, 40]];
    // 匹配 'A' 的对应值为 10 和 30，平均 20
    expect(callFn('AVERAGEIF', [criteriaRange, 'A', avgRange])).toBe(20);
  });
});

// ============================================================
// 条件匹配引擎测试
// ============================================================

describe('条件匹配引擎', () => {
  it('应支持通配符 * 在中间位置', () => {
    const range: FormulaValue = [['Hello World', 'Hello', 'Hi World']];
    expect(callFn('COUNTIF', [range, 'Hello*'])).toBe(2);
  });

  it('应支持通配符 ? 精确匹配单个字符', () => {
    const range: FormulaValue = [['ab', 'abc', 'abcd']];
    expect(callFn('COUNTIF', [range, 'ab?'])).toBe(1);
  });

  it('应支持混合通配符', () => {
    const range: FormulaValue = [['test1', 'test22', 'best1', 'test']];
    expect(callFn('COUNTIF', [range, 'test*'])).toBe(3);
  });

  it('错误值不应匹配任何条件', () => {
    const errorVal = { type: '#VALUE!' as const, message: '错误' };
    const range: FormulaValue = [[errorVal, 1, 2]];
    expect(callFn('COUNTIF', [range, '>0'])).toBe(2);
  });

  it('布尔条件应精确匹配布尔值', () => {
    const range: FormulaValue = [[true, false, true, 1]];
    expect(callFn('COUNTIF', [range, true])).toBe(2);
  });
});

// ============================================================
// 二维区域测试
// ============================================================

describe('二维区域处理', () => {
  it('COUNT 应正确处理二维区域', () => {
    const range: FormulaValue = [[1, 2], [3, 'text'], [5, '']];
    expect(callFn('COUNT', [range])).toBe(4);
  });

  it('COUNTA 应正确处理二维区域', () => {
    const range: FormulaValue = [[1, 2], [3, 'text'], [5, '']];
    expect(callFn('COUNTA', [range])).toBe(5);
  });

  it('COUNTIF 应正确展平二维区域', () => {
    const range: FormulaValue = [[1, 5], [8, 3], [10, 2]];
    expect(callFn('COUNTIF', [range, '>5'])).toBe(2);
  });
});

// ============================================================
// 函数注册验证
// ============================================================

describe('registerStatisticsFunctions', () => {
  it('应注册全部 7 个统计函数', () => {
    const names = ['COUNT', 'COUNTA', 'COUNTIF', 'COUNTIFS', 'SUMIF', 'SUMIFS', 'AVERAGEIF'];
    for (const name of names) {
      expect(registry.get(name)).toBeDefined();
    }
  });

  it('每个函数应有正确的 category', () => {
    const names = ['COUNT', 'COUNTA', 'COUNTIF', 'COUNTIFS', 'SUMIF', 'SUMIFS', 'AVERAGEIF'];
    for (const name of names) {
      expect(registry.get(name)?.category).toBe('statistics');
    }
  });
});
