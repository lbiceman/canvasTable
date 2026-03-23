import { describe, it, expect, beforeEach } from 'vitest';
import { FunctionRegistry } from '../../../formula/function-registry';
import { registerLookupFunctions } from '../../../formula/functions/lookup';
import { isError } from '../../../formula/evaluator';
import type { FormulaValue, FormulaError, EvaluationContext } from '../../../formula/types';

// ============================================================
// 测试辅助工具
// ============================================================

/** 创建带有模拟单元格数据的求值上下文 */
function createContext(
  cellData: Record<string, FormulaValue> = {},
  row = 0,
  col = 0
): EvaluationContext {
  return {
    row,
    col,
    getCellValue: (r: number, c: number) => {
      const key = `${r},${c}`;
      return cellData[key] ?? 0;
    },
    getRangeValues: () => [],
    resolveNamedRange: () => null,
  };
}

/** 空的求值上下文 */
const dummyContext = createContext();

let registry: FunctionRegistry;

/** 调用已注册函数的辅助方法 */
function callFn(name: string, args: FormulaValue[], context: EvaluationContext = dummyContext): FormulaValue {
  const def = registry.get(name);
  if (!def) throw new Error(`函数 ${name} 未注册`);
  return def.handler(args, context);
}

beforeEach(() => {
  registry = new FunctionRegistry();
  registerLookupFunctions(registry);
});

// ============================================================
// VLOOKUP 函数测试
// ============================================================

describe('VLOOKUP', () => {
  // 测试数据表：姓名 | 部门 | 工资
  const table: FormulaValue = [
    ['张三', '销售', 5000],
    ['李四', '技术', 8000],
    ['王五', '销售', 6000],
    ['赵六', '财务', 7000],
  ];

  it('精确匹配应返回正确的值', () => {
    expect(callFn('VLOOKUP', ['李四', table, 3, false])).toBe(8000);
  });

  it('精确匹配应返回第一个匹配行的值', () => {
    expect(callFn('VLOOKUP', ['张三', table, 2, false])).toBe('销售');
  });

  it('精确匹配未找到应返回 #N/A', () => {
    const result = callFn('VLOOKUP', ['不存在', table, 3, false]);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#N/A');
  });

  it('列号越界应返回 #REF!', () => {
    const result = callFn('VLOOKUP', ['张三', table, 5, false]);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#REF!');
  });

  it('列号小于 1 应返回 #REF!', () => {
    const result = callFn('VLOOKUP', ['张三', table, 0, false]);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#REF!');
  });

  it('近似匹配应找到小于等于目标值的最大值', () => {
    const sortedTable: FormulaValue = [
      [10, 'A'],
      [20, 'B'],
      [30, 'C'],
      [40, 'D'],
    ];
    expect(callFn('VLOOKUP', [25, sortedTable, 2, true])).toBe('B');
  });

  it('近似匹配精确命中应返回该行的值', () => {
    const sortedTable: FormulaValue = [
      [10, 'A'],
      [20, 'B'],
      [30, 'C'],
    ];
    expect(callFn('VLOOKUP', [20, sortedTable, 2, true])).toBe('B');
  });

  it('近似匹配目标值小于所有值应返回 #N/A', () => {
    const sortedTable: FormulaValue = [
      [10, 'A'],
      [20, 'B'],
    ];
    const result = callFn('VLOOKUP', [5, sortedTable, 2, true]);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#N/A');
  });

  it('默认应使用近似匹配', () => {
    const sortedTable: FormulaValue = [
      [10, 'A'],
      [20, 'B'],
      [30, 'C'],
    ];
    // 不传第四个参数，默认近似匹配
    expect(callFn('VLOOKUP', [25, sortedTable, 2])).toBe('B');
  });

  it('字符串精确匹配不区分大小写', () => {
    const strTable: FormulaValue = [
      ['Apple', 100],
      ['Banana', 200],
    ];
    expect(callFn('VLOOKUP', ['apple', strTable, 2, false])).toBe(100);
  });
});

// ============================================================
// HLOOKUP 函数测试
// ============================================================

describe('HLOOKUP', () => {
  // 横向数据表
  const table: FormulaValue = [
    ['姓名', '张三', '李四', '王五'],
    ['部门', '销售', '技术', '销售'],
    ['工资', 5000, 8000, 6000],
  ];

  it('精确匹配应返回正确的值', () => {
    expect(callFn('HLOOKUP', ['李四', table, 3, false])).toBe(8000);
  });

  it('精确匹配未找到应返回 #N/A', () => {
    const result = callFn('HLOOKUP', ['不存在', table, 2, false]);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#N/A');
  });

  it('行号越界应返回 #REF!', () => {
    const result = callFn('HLOOKUP', ['张三', table, 5, false]);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#REF!');
  });

  it('近似匹配应找到小于等于目标值的最大值', () => {
    const sortedTable: FormulaValue = [
      [10, 20, 30, 40],
      ['A', 'B', 'C', 'D'],
    ];
    expect(callFn('HLOOKUP', [25, sortedTable, 2, true])).toBe('B');
  });

  it('近似匹配精确命中应返回该列的值', () => {
    const sortedTable: FormulaValue = [
      [10, 20, 30],
      ['A', 'B', 'C'],
    ];
    expect(callFn('HLOOKUP', [20, sortedTable, 2, true])).toBe('B');
  });

  it('默认应使用近似匹配', () => {
    const sortedTable: FormulaValue = [
      [10, 20, 30],
      ['A', 'B', 'C'],
    ];
    expect(callFn('HLOOKUP', [25, sortedTable, 2])).toBe('B');
  });
});

// ============================================================
// INDEX 函数测试
// ============================================================

describe('INDEX', () => {
  const arr: FormulaValue = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];

  it('应返回指定行列的值', () => {
    expect(callFn('INDEX', [arr, 2, 3])).toBe(6);
  });

  it('应返回第一行第一列的值', () => {
    expect(callFn('INDEX', [arr, 1, 1])).toBe(1);
  });

  it('应返回最后一行最后一列的值', () => {
    expect(callFn('INDEX', [arr, 3, 3])).toBe(9);
  });

  it('行号越界应返回 #REF!', () => {
    const result = callFn('INDEX', [arr, 4, 1]);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#REF!');
  });

  it('列号越界应返回 #REF!', () => {
    const result = callFn('INDEX', [arr, 1, 4]);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#REF!');
  });

  it('行号为 0 应返回整列', () => {
    const result = callFn('INDEX', [arr, 0, 2]);
    expect(result).toEqual([[2], [5], [8]]);
  });

  it('列号为 0 应返回整行', () => {
    const result = callFn('INDEX', [arr, 2, 0]);
    expect(result).toEqual([[4, 5, 6]]);
  });

  it('省略列号时默认为 1', () => {
    expect(callFn('INDEX', [arr, 2])).toBe(4);
  });
});

// ============================================================
// MATCH 函数测试
// ============================================================

describe('MATCH', () => {
  it('精确匹配应返回 1-based 位置', () => {
    const arr: FormulaValue = [['张三'], ['李四'], ['王五'], ['赵六']];
    expect(callFn('MATCH', ['王五', arr, 0])).toBe(3);
  });

  it('精确匹配未找到应返回 #N/A', () => {
    const arr: FormulaValue = [['张三'], ['李四'], ['王五']];
    const result = callFn('MATCH', ['不存在', arr, 0]);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#N/A');
  });

  it('精确匹配数字应返回正确位置', () => {
    const arr: FormulaValue = [[10], [20], [30], [40]];
    expect(callFn('MATCH', [30, arr, 0])).toBe(3);
  });

  it('小于等于匹配（match_type=1）应返回正确位置', () => {
    const arr: FormulaValue = [[10], [20], [30], [40]];
    expect(callFn('MATCH', [25, arr, 1])).toBe(2);
  });

  it('大于等于匹配（match_type=-1）应返回正确位置', () => {
    const arr: FormulaValue = [[40], [30], [20], [10]];
    expect(callFn('MATCH', [25, arr, -1])).toBe(2);
  });

  it('默认 match_type 应为 1', () => {
    const arr: FormulaValue = [[10], [20], [30]];
    expect(callFn('MATCH', [25, arr])).toBe(2);
  });

  it('单行区域应正确处理', () => {
    const arr: FormulaValue = [[10, 20, 30, 40]];
    expect(callFn('MATCH', [30, arr, 0])).toBe(3);
  });

  it('精确匹配字符串不区分大小写', () => {
    const arr: FormulaValue = [['Apple'], ['Banana'], ['Cherry']];
    expect(callFn('MATCH', ['banana', arr, 0])).toBe(2);
  });
});

// ============================================================
// OFFSET 函数测试
// ============================================================

describe('OFFSET', () => {
  it('应返回偏移后单元格的值', () => {
    const cellData: Record<string, FormulaValue> = {
      '2,3': 42,
    };
    const ctx = createContext(cellData, 0, 0);
    // OFFSET(A1, 2, 3) -> 获取 (0+2, 0+3) = (2, 3) 的值
    expect(callFn('OFFSET', [0, 2, 3], ctx)).toBe(42);
  });

  it('应支持负偏移', () => {
    const cellData: Record<string, FormulaValue> = {
      '0,0': 100,
    };
    const ctx = createContext(cellData, 2, 2);
    expect(callFn('OFFSET', [0, -2, -2], ctx)).toBe(100);
  });

  it('偏移到负坐标应返回 #REF!', () => {
    const ctx = createContext({}, 0, 0);
    const result = callFn('OFFSET', [0, -1, 0], ctx);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#REF!');
  });

  it('指定 height 和 width 应返回区域', () => {
    const cellData: Record<string, FormulaValue> = {
      '1,1': 10, '1,2': 20,
      '2,1': 30, '2,2': 40,
    };
    const ctx = createContext(cellData, 0, 0);
    const result = callFn('OFFSET', [0, 1, 1, 2, 2], ctx);
    expect(result).toEqual([[10, 20], [30, 40]]);
  });

  it('height 小于 1 应返回 #REF!', () => {
    const ctx = createContext({}, 0, 0);
    const result = callFn('OFFSET', [0, 0, 0, 0, 1], ctx);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#REF!');
  });
});

// ============================================================
// INDIRECT 函数测试
// ============================================================

describe('INDIRECT', () => {
  it('应解析 A1 引用并返回单元格值', () => {
    const cellData: Record<string, FormulaValue> = {
      '0,0': 42,
    };
    const ctx = createContext(cellData);
    expect(callFn('INDIRECT', ['A1'], ctx)).toBe(42);
  });

  it('应解析 B2 引用', () => {
    const cellData: Record<string, FormulaValue> = {
      '1,1': 'hello',
    };
    const ctx = createContext(cellData);
    expect(callFn('INDIRECT', ['B2'], ctx)).toBe('hello');
  });

  it('应解析带 $ 的绝对引用', () => {
    const cellData: Record<string, FormulaValue> = {
      '0,0': 99,
    };
    const ctx = createContext(cellData);
    expect(callFn('INDIRECT', ['$A$1'], ctx)).toBe(99);
  });

  it('应解析多字母列引用（如 AA1）', () => {
    const cellData: Record<string, FormulaValue> = {
      '0,26': 'AA列',
    };
    const ctx = createContext(cellData);
    expect(callFn('INDIRECT', ['AA1'], ctx)).toBe('AA列');
  });

  it('无效引用应返回 #REF!', () => {
    const result = callFn('INDIRECT', ['无效引用']);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#REF!');
  });

  it('空字符串应返回 #REF!', () => {
    const result = callFn('INDIRECT', ['']);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#REF!');
  });

  it('非字符串参数应返回 #REF!', () => {
    const result = callFn('INDIRECT', [123]);
    expect(isError(result)).toBe(true);
    expect((result as FormulaError).type).toBe('#REF!');
  });

  it('不区分大小写', () => {
    const cellData: Record<string, FormulaValue> = {
      '0,0': 'test',
    };
    const ctx = createContext(cellData);
    expect(callFn('INDIRECT', ['a1'], ctx)).toBe('test');
  });
});

// ============================================================
// 函数注册验证
// ============================================================

describe('registerLookupFunctions', () => {
  it('应注册全部 6 个查找引用函数', () => {
    const names = ['VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'OFFSET', 'INDIRECT'];
    for (const name of names) {
      expect(registry.get(name)).toBeDefined();
    }
  });

  it('每个函数应有正确的 category', () => {
    const names = ['VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'OFFSET', 'INDIRECT'];
    for (const name of names) {
      expect(registry.get(name)?.category).toBe('lookup');
    }
  });
});
