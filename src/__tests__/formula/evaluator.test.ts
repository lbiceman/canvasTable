import { describe, it, expect } from 'vitest';
import { Evaluator, isError, makeError } from '../../formula/evaluator';
import { FunctionRegistry } from '../../formula/function-registry';
import type {
  ASTNode,
  EvaluationContext,
  FormulaValue,
  RangeReferenceNode,
  FunctionDefinition,
} from '../../formula/types';

// ============================================================
// 测试辅助工具
// ============================================================

/** 创建基础求值上下文 */
function createContext(
  cells: Record<string, FormulaValue> = {},
  namedRanges: Record<string, RangeReferenceNode> = {}
): EvaluationContext {
  return {
    row: 0,
    col: 0,
    getCellValue: (row: number, col: number, _sheetName?: string): FormulaValue => {
      const key = `${row},${col}`;
      return cells[key] ?? 0;
    },
    getRangeValues: (range: RangeReferenceNode): FormulaValue[][] => {
      const result: FormulaValue[][] = [];
      for (let r = range.startRow; r <= range.endRow; r++) {
        const row: FormulaValue[] = [];
        for (let c = range.startCol; c <= range.endCol; c++) {
          const key = `${r},${c}`;
          row.push(cells[key] ?? 0);
        }
        result.push(row);
      }
      return result;
    },
    resolveNamedRange: (name: string): RangeReferenceNode | null => {
      return namedRanges[name] ?? null;
    },
  };
}

/** 创建带 SUM 函数的注册表（用于函数调用测试） */
function createRegistryWithSUM(): FunctionRegistry {
  const registry = new FunctionRegistry();
  const sumDef: FunctionDefinition = {
    name: 'SUM',
    category: 'math',
    description: '求和',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'values', description: '求和值', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      let total = 0;
      for (const arg of args) {
        if (isError(arg)) return arg;
        if (typeof arg === 'number') {
          total += arg;
        } else if (Array.isArray(arg)) {
          for (const row of arg as FormulaValue[][]) {
            for (const cell of row) {
              if (typeof cell === 'number') total += cell;
            }
          }
        }
      }
      return total;
    },
  };
  registry.register(sumDef);
  return registry;
}

// ============================================================
// 辅助函数测试
// ============================================================

describe('isError', () => {
  it('应识别 FormulaError 对象', () => {
    expect(isError(makeError('#VALUE!', '测试'))).toBe(true);
    expect(isError(makeError('#DIV/0!', '除零'))).toBe(true);
  });

  it('应排除非错误值', () => {
    expect(isError(42)).toBe(false);
    expect(isError('hello')).toBe(false);
    expect(isError(true)).toBe(false);
    expect(isError([[1, 2]])).toBe(false);
  });
});

describe('makeError', () => {
  it('应创建正确的错误对象', () => {
    const err = makeError('#NAME?', '未知函数');
    expect(err.type).toBe('#NAME?');
    expect(err.message).toBe('未知函数');
  });
});

// ============================================================
// 字面量节点求值
// ============================================================

describe('Evaluator - 字面量节点', () => {
  const ctx = createContext();
  const registry = new FunctionRegistry();
  const evaluator = new Evaluator(ctx, registry);

  it('应求值数字字面量', () => {
    const node: ASTNode = { type: 'NumberLiteral', value: 42 };
    expect(evaluator.evaluate(node)).toBe(42);
  });

  it('应求值字符串字面量', () => {
    const node: ASTNode = { type: 'StringLiteral', value: 'hello' };
    expect(evaluator.evaluate(node)).toBe('hello');
  });

  it('应求值布尔字面量', () => {
    expect(evaluator.evaluate({ type: 'BooleanLiteral', value: true })).toBe(true);
    expect(evaluator.evaluate({ type: 'BooleanLiteral', value: false })).toBe(false);
  });
});

// ============================================================
// 单元格引用求值
// ============================================================

describe('Evaluator - 单元格引用', () => {
  it('应获取单元格值', () => {
    const ctx = createContext({ '0,0': 100, '1,2': 'text' });
    const evaluator = new Evaluator(ctx, new FunctionRegistry());

    const node: ASTNode = {
      type: 'CellReference',
      row: 0,
      col: 0,
      absolute: { row: false, col: false },
    };
    expect(evaluator.evaluate(node)).toBe(100);
  });

  it('空单元格应返回默认值 0', () => {
    const ctx = createContext();
    const evaluator = new Evaluator(ctx, new FunctionRegistry());

    const node: ASTNode = {
      type: 'CellReference',
      row: 5,
      col: 5,
      absolute: { row: false, col: false },
    };
    expect(evaluator.evaluate(node)).toBe(0);
  });
});

// ============================================================
// 区域引用求值
// ============================================================

describe('Evaluator - 区域引用', () => {
  it('应返回区域的二维数组', () => {
    const ctx = createContext({ '0,0': 1, '0,1': 2, '1,0': 3, '1,1': 4 });
    const evaluator = new Evaluator(ctx, new FunctionRegistry());

    const node: ASTNode = {
      type: 'RangeReference',
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1,
    };
    expect(evaluator.evaluate(node)).toEqual([[1, 2], [3, 4]]);
  });

  it('命名范围应解析后返回区域值', () => {
    const rangeNode: RangeReferenceNode = {
      type: 'RangeReference',
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 2,
    };
    const ctx = createContext(
      { '0,0': 10, '0,1': 20, '0,2': 30 },
      { Sales: rangeNode }
    );
    const evaluator = new Evaluator(ctx, new FunctionRegistry());

    // 命名范围节点（startRow === -1，sheetName 存储名称）
    const namedNode: ASTNode = {
      type: 'RangeReference',
      startRow: -1,
      startCol: -1,
      endRow: -1,
      endCol: -1,
      sheetName: 'Sales',
    };
    expect(evaluator.evaluate(namedNode)).toEqual([[10, 20, 30]]);
  });

  it('未定义的命名范围应返回 #NAME? 错误', () => {
    const ctx = createContext();
    const evaluator = new Evaluator(ctx, new FunctionRegistry());

    const node: ASTNode = {
      type: 'RangeReference',
      startRow: -1,
      startCol: -1,
      endRow: -1,
      endCol: -1,
      sheetName: 'Unknown',
    };
    const result = evaluator.evaluate(node);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.type).toBe('#NAME?');
    }
  });
});

// ============================================================
// 二元表达式求值
// ============================================================

describe('Evaluator - 二元表达式', () => {
  const ctx = createContext();
  const evaluator = new Evaluator(ctx, new FunctionRegistry());

  it('应计算加法', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '+',
      left: { type: 'NumberLiteral', value: 3 },
      right: { type: 'NumberLiteral', value: 4 },
    };
    expect(evaluator.evaluate(node)).toBe(7);
  });

  it('应计算减法', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '-',
      left: { type: 'NumberLiteral', value: 10 },
      right: { type: 'NumberLiteral', value: 3 },
    };
    expect(evaluator.evaluate(node)).toBe(7);
  });

  it('应计算乘法', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '*',
      left: { type: 'NumberLiteral', value: 5 },
      right: { type: 'NumberLiteral', value: 6 },
    };
    expect(evaluator.evaluate(node)).toBe(30);
  });

  it('应计算除法', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '/',
      left: { type: 'NumberLiteral', value: 15 },
      right: { type: 'NumberLiteral', value: 3 },
    };
    expect(evaluator.evaluate(node)).toBe(5);
  });

  it('除以零应返回 #DIV/0! 错误', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '/',
      left: { type: 'NumberLiteral', value: 10 },
      right: { type: 'NumberLiteral', value: 0 },
    };
    const result = evaluator.evaluate(node);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.type).toBe('#DIV/0!');
    }
  });

  it('应计算字符串连接', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '&',
      left: { type: 'StringLiteral', value: 'Hello' },
      right: { type: 'StringLiteral', value: ' World' },
    };
    expect(evaluator.evaluate(node)).toBe('Hello World');
  });

  it('& 运算符应将数字转为字符串', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '&',
      left: { type: 'StringLiteral', value: 'Value: ' },
      right: { type: 'NumberLiteral', value: 42 },
    };
    expect(evaluator.evaluate(node)).toBe('Value: 42');
  });

  it('应计算比较运算符 =', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '=',
      left: { type: 'NumberLiteral', value: 5 },
      right: { type: 'NumberLiteral', value: 5 },
    };
    expect(evaluator.evaluate(node)).toBe(true);
  });

  it('应计算比较运算符 <>', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '<>',
      left: { type: 'NumberLiteral', value: 5 },
      right: { type: 'NumberLiteral', value: 3 },
    };
    expect(evaluator.evaluate(node)).toBe(true);
  });

  it('应计算比较运算符 >', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '>',
      left: { type: 'NumberLiteral', value: 10 },
      right: { type: 'NumberLiteral', value: 5 },
    };
    expect(evaluator.evaluate(node)).toBe(true);
  });

  it('应计算比较运算符 <=', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '<=',
      left: { type: 'NumberLiteral', value: 5 },
      right: { type: 'NumberLiteral', value: 5 },
    };
    expect(evaluator.evaluate(node)).toBe(true);
  });

  it('错误值应向上传播', () => {
    const node: ASTNode = {
      type: 'BinaryExpression',
      operator: '+',
      left: { type: 'NumberLiteral', value: 1 },
      right: {
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'NumberLiteral', value: 1 },
        right: { type: 'NumberLiteral', value: 0 },
      },
    };
    const result = evaluator.evaluate(node);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.type).toBe('#DIV/0!');
    }
  });
});

// ============================================================
// 一元表达式求值
// ============================================================

describe('Evaluator - 一元表达式', () => {
  const ctx = createContext();
  const evaluator = new Evaluator(ctx, new FunctionRegistry());

  it('应计算负号', () => {
    const node: ASTNode = {
      type: 'UnaryExpression',
      operator: '-',
      operand: { type: 'NumberLiteral', value: 5 },
    };
    expect(evaluator.evaluate(node)).toBe(-5);
  });

  it('双重负号应还原', () => {
    const node: ASTNode = {
      type: 'UnaryExpression',
      operator: '-',
      operand: {
        type: 'UnaryExpression',
        operator: '-',
        operand: { type: 'NumberLiteral', value: 7 },
      },
    };
    expect(evaluator.evaluate(node)).toBe(7);
  });

  it('错误值应向上传播', () => {
    const node: ASTNode = {
      type: 'UnaryExpression',
      operator: '-',
      operand: {
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'NumberLiteral', value: 1 },
        right: { type: 'NumberLiteral', value: 0 },
      },
    };
    const result = evaluator.evaluate(node);
    expect(isError(result)).toBe(true);
  });
});

// ============================================================
// 函数调用求值
// ============================================================

describe('Evaluator - 函数调用', () => {
  it('应调用已注册函数', () => {
    const ctx = createContext({ '0,0': 10, '0,1': 20, '0,2': 30 });
    const registry = createRegistryWithSUM();
    const evaluator = new Evaluator(ctx, registry);

    const node: ASTNode = {
      type: 'FunctionCall',
      name: 'SUM',
      args: [
        {
          type: 'RangeReference',
          startRow: 0,
          startCol: 0,
          endRow: 0,
          endCol: 2,
        },
      ],
    };
    expect(evaluator.evaluate(node)).toBe(60);
  });

  it('未注册函数应返回 #NAME? 错误', () => {
    const ctx = createContext();
    const evaluator = new Evaluator(ctx, new FunctionRegistry());

    const node: ASTNode = {
      type: 'FunctionCall',
      name: 'UNKNOWN',
      args: [],
    };
    const result = evaluator.evaluate(node);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.type).toBe('#NAME?');
    }
  });

  it('参数不足应返回 #VALUE! 错误', () => {
    const ctx = createContext();
    const registry = createRegistryWithSUM();
    const evaluator = new Evaluator(ctx, registry);

    const node: ASTNode = {
      type: 'FunctionCall',
      name: 'SUM',
      args: [],
    };
    const result = evaluator.evaluate(node);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.type).toBe('#VALUE!');
    }
  });

  it('错误参数应向上传播（非特殊函数）', () => {
    const ctx = createContext();
    const registry = createRegistryWithSUM();
    const evaluator = new Evaluator(ctx, registry);

    // SUM 的参数中包含除零错误
    const node: ASTNode = {
      type: 'FunctionCall',
      name: 'SUM',
      args: [
        {
          type: 'BinaryExpression',
          operator: '/',
          left: { type: 'NumberLiteral', value: 1 },
          right: { type: 'NumberLiteral', value: 0 },
        },
      ],
    };
    const result = evaluator.evaluate(node);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.type).toBe('#DIV/0!');
    }
  });

  it('IFERROR 应拦截错误', () => {
    const ctx = createContext();
    const registry = new FunctionRegistry();
    // 注册 IFERROR
    registry.register({
      name: 'IFERROR',
      category: 'logic',
      description: '错误拦截',
      minArgs: 2,
      maxArgs: 2,
      params: [
        { name: 'value', description: '值', type: 'any' },
        { name: 'value_if_error', description: '错误时的替代值', type: 'any' },
      ],
      handler: (args: FormulaValue[]): FormulaValue => {
        return isError(args[0]) ? args[1] : args[0];
      },
    });
    const evaluator = new Evaluator(ctx, registry);

    const node: ASTNode = {
      type: 'FunctionCall',
      name: 'IFERROR',
      args: [
        {
          type: 'BinaryExpression',
          operator: '/',
          left: { type: 'NumberLiteral', value: 1 },
          right: { type: 'NumberLiteral', value: 0 },
        },
        { type: 'StringLiteral', value: '错误' },
      ],
    };
    expect(evaluator.evaluate(node)).toBe('错误');
  });
});

// ============================================================
// 数组字面量求值
// ============================================================

describe('Evaluator - 数组字面量', () => {
  it('应求值数组字面量', () => {
    const ctx = createContext();
    const evaluator = new Evaluator(ctx, new FunctionRegistry());

    const node: ASTNode = {
      type: 'ArrayLiteral',
      elements: [
        [
          { type: 'NumberLiteral', value: 1 },
          { type: 'NumberLiteral', value: 2 },
        ],
        [
          { type: 'NumberLiteral', value: 3 },
          { type: 'NumberLiteral', value: 4 },
        ],
      ],
    };
    expect(evaluator.evaluate(node)).toEqual([[1, 2], [3, 4]]);
  });
});
