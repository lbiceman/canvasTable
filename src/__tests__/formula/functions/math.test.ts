import { describe, it, expect, beforeEach } from 'vitest';
import { FunctionRegistry } from '../../../formula/function-registry';
import { registerMathFunctions } from '../../../formula/functions/math';
import { isError } from '../../../formula/evaluator';
import type { FormulaValue, EvaluationContext } from '../../../formula/types';

// ============================================================
// 测试辅助工具
// ============================================================

/** 空的求值上下文（数学函数不需要上下文） */
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
  registerMathFunctions(registry);
});

// ============================================================
// ABS 函数测试
// ============================================================

describe('ABS', () => {
  it('应返回负数的绝对值', () => {
    expect(callFn('ABS', [-5])).toBe(5);
  });

  it('应返回正数本身', () => {
    expect(callFn('ABS', [3])).toBe(3);
  });

  it('应返回零', () => {
    expect(callFn('ABS', [0])).toBe(0);
  });

  it('非数值参数应返回 #VALUE!', () => {
    const result = callFn('ABS', ['abc']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});


// ============================================================
// ROUND 函数测试
// ============================================================

describe('ROUND', () => {
  it('应四舍五入到指定小数位', () => {
    expect(callFn('ROUND', [3.456, 2])).toBe(3.46);
  });

  it('应四舍五入 3.444 到 2 位', () => {
    expect(callFn('ROUND', [3.444, 2])).toBe(3.44);
  });

  it('应四舍五入到整数', () => {
    expect(callFn('ROUND', [3.5, 0])).toBe(4);
  });

  it('非数值参数应返回 #VALUE!', () => {
    const result = callFn('ROUND', ['abc', 2]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// CEILING 函数测试
// ============================================================

describe('CEILING', () => {
  it('应向上舍入到最近倍数', () => {
    expect(callFn('CEILING', [4.2, 1])).toBe(5);
  });

  it('应向上舍入到 0.5 的倍数', () => {
    expect(callFn('CEILING', [4.8, 0.5])).toBe(5);
  });

  it('负数应向上舍入（趋向零）', () => {
    expect(callFn('CEILING', [-2.5, 1])).toBe(-2);
  });

  it('significance 为 0 应返回 0', () => {
    expect(callFn('CEILING', [4.2, 0])).toBe(0);
  });

  it('非数值参数应返回 #VALUE!', () => {
    const result = callFn('CEILING', ['abc', 1]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// FLOOR 函数测试
// ============================================================

describe('FLOOR', () => {
  it('应向下舍入到最近倍数', () => {
    expect(callFn('FLOOR', [4.8, 1])).toBe(4);
  });

  it('应向下舍入到 0.5 的倍数', () => {
    expect(callFn('FLOOR', [4.2, 0.5])).toBe(4);
  });

  it('负数应向下舍入（远离零）', () => {
    expect(callFn('FLOOR', [-2.5, 1])).toBe(-3);
  });

  it('非数值参数应返回 #VALUE!', () => {
    const result = callFn('FLOOR', ['abc', 1]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// MOD 函数测试
// ============================================================

describe('MOD', () => {
  it('应返回余数', () => {
    expect(callFn('MOD', [10, 3])).toBe(1);
  });

  it('整除应返回 0', () => {
    expect(callFn('MOD', [10, 5])).toBe(0);
  });

  it('除数为零应返回 #DIV/0!', () => {
    const result = callFn('MOD', [10, 0]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#DIV/0!');
  });

  it('非数值参数应返回 #VALUE!', () => {
    const result = callFn('MOD', ['abc', 3]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// POWER 函数测试
// ============================================================

describe('POWER', () => {
  it('应返回幂运算结果', () => {
    expect(callFn('POWER', [2, 3])).toBe(8);
  });

  it('零次幂应返回 1', () => {
    expect(callFn('POWER', [5, 0])).toBe(1);
  });

  it('0.5 次幂应等于平方根', () => {
    expect(callFn('POWER', [9, 0.5])).toBe(3);
  });

  it('非数值参数应返回 #VALUE!', () => {
    const result = callFn('POWER', ['abc', 2]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// SQRT 函数测试
// ============================================================

describe('SQRT', () => {
  it('应返回平方根', () => {
    expect(callFn('SQRT', [16])).toBe(4);
  });

  it('零的平方根应为 0', () => {
    expect(callFn('SQRT', [0])).toBe(0);
  });

  it('负数应返回 #NUM!', () => {
    const result = callFn('SQRT', [-1]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#NUM!');
  });

  it('非数值参数应返回 #VALUE!', () => {
    const result = callFn('SQRT', ['abc']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});


// ============================================================
// MAX 函数测试
// ============================================================

describe('MAX', () => {
  it('应返回多个参数中的最大值', () => {
    expect(callFn('MAX', [10, 20, 5])).toBe(20);
  });

  it('应支持区域引用（二维数组）', () => {
    const range: FormulaValue = [[3, 1], [4, 1], [5, 9]];
    expect(callFn('MAX', [range])).toBe(9);
  });

  it('应支持混合参数（数值 + 区域）', () => {
    const range: FormulaValue = [[1, 2], [3, 4]];
    expect(callFn('MAX', [range, 10])).toBe(10);
  });

  it('无数值时应返回 0', () => {
    expect(callFn('MAX', [['abc'] as unknown as FormulaValue])).toBe(0);
  });
});

// ============================================================
// MIN 函数测试
// ============================================================

describe('MIN', () => {
  it('应返回多个参数中的最小值', () => {
    expect(callFn('MIN', [10, 20, 5])).toBe(5);
  });

  it('应支持区域引用（二维数组）', () => {
    const range: FormulaValue = [[3, 1], [4, 1], [5, 9]];
    expect(callFn('MIN', [range])).toBe(1);
  });

  it('应支持混合参数（数值 + 区域）', () => {
    const range: FormulaValue = [[10, 20], [30, 40]];
    expect(callFn('MIN', [range, 5])).toBe(5);
  });

  it('无数值时应返回 0', () => {
    expect(callFn('MIN', [['abc'] as unknown as FormulaValue])).toBe(0);
  });
});

// ============================================================
// AVERAGE 函数测试
// ============================================================

describe('AVERAGE', () => {
  it('应返回多个参数的平均值', () => {
    expect(callFn('AVERAGE', [2, 4, 6])).toBe(4);
  });

  it('应支持区域引用（二维数组）', () => {
    const range: FormulaValue = [[10, 20], [30, 40], [50, 0]];
    // 10+20+30+40+50+0 = 150, 150/6 = 25
    expect(callFn('AVERAGE', [range])).toBe(25);
  });

  it('应支持混合参数', () => {
    const range: FormulaValue = [[10, 20, 30, 40, 50]];
    expect(callFn('AVERAGE', [range])).toBe(30);
  });

  it('无数值时应返回 #DIV/0!', () => {
    const result = callFn('AVERAGE', [['abc'] as unknown as FormulaValue]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#DIV/0!');
  });
});

// ============================================================
// 函数注册验证
// ============================================================

describe('registerMathFunctions', () => {
  it('应注册全部 10 个数学函数', () => {
    const names = ['ABS', 'ROUND', 'CEILING', 'FLOOR', 'MOD', 'POWER', 'SQRT', 'MAX', 'MIN', 'AVERAGE'];
    for (const name of names) {
      expect(registry.get(name)).toBeDefined();
    }
  });

  it('每个函数应有正确的 category', () => {
    const names = ['ABS', 'ROUND', 'CEILING', 'FLOOR', 'MOD', 'POWER', 'SQRT', 'MAX', 'MIN', 'AVERAGE'];
    for (const name of names) {
      expect(registry.get(name)?.category).toBe('math');
    }
  });
});
