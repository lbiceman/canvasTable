import { describe, it, expect } from 'vitest';
import { Parser, colLetterToIndex, parseCellRefString, parseSheetRefString } from '../../formula/parser';
import { Tokenizer } from '../../formula/tokenizer';
import type { ASTNode } from '../../formula/types';

/** 辅助函数：将公式字符串解析为 AST */
const parse = (formula: string): ASTNode => {
  const tokenizer = new Tokenizer();
  const tokens = tokenizer.tokenize(formula);
  const parser = new Parser();
  return parser.parse(tokens);
};

// ============================================================
// 辅助函数测试
// ============================================================
describe('colLetterToIndex', () => {
  it('A = 0', () => expect(colLetterToIndex('A')).toBe(0));
  it('B = 1', () => expect(colLetterToIndex('B')).toBe(1));
  it('Z = 25', () => expect(colLetterToIndex('Z')).toBe(25));
  it('AA = 26', () => expect(colLetterToIndex('AA')).toBe(26));
  it('AB = 27', () => expect(colLetterToIndex('AB')).toBe(27));
  it('AZ = 51', () => expect(colLetterToIndex('AZ')).toBe(51));
  it('小写 a = 0', () => expect(colLetterToIndex('a')).toBe(0));
});

describe('parseCellRefString', () => {
  it('A1 → row=0, col=0, 非绝对引用', () => {
    const info = parseCellRefString('A1');
    expect(info).toEqual({ row: 0, col: 0, absoluteRow: false, absoluteCol: false });
  });

  it('$A$1 → row=0, col=0, 全绝对引用', () => {
    const info = parseCellRefString('$A$1');
    expect(info).toEqual({ row: 0, col: 0, absoluteRow: true, absoluteCol: true });
  });

  it('$A1 → 列绝对、行相对', () => {
    const info = parseCellRefString('$A1');
    expect(info).toEqual({ row: 0, col: 0, absoluteRow: false, absoluteCol: true });
  });

  it('A$1 → 列相对、行绝对', () => {
    const info = parseCellRefString('A$1');
    expect(info).toEqual({ row: 0, col: 0, absoluteRow: true, absoluteCol: false });
  });

  it('B2 → row=1, col=1', () => {
    const info = parseCellRefString('B2');
    expect(info).toEqual({ row: 1, col: 1, absoluteRow: false, absoluteCol: false });
  });

  it('AB12 → row=11, col=27', () => {
    const info = parseCellRefString('AB12');
    expect(info).toEqual({ row: 11, col: 27, absoluteRow: false, absoluteCol: false });
  });
});

describe('parseSheetRefString', () => {
  it('Sheet1!A1', () => {
    const info = parseSheetRefString('Sheet1!A1');
    expect(info).toEqual({
      row: 0, col: 0,
      absoluteRow: false, absoluteCol: false,
      sheetName: 'Sheet1',
    });
  });

  it('Sheet1!$B$3', () => {
    const info = parseSheetRefString('Sheet1!$B$3');
    expect(info).toEqual({
      row: 2, col: 1,
      absoluteRow: true, absoluteCol: true,
      sheetName: 'Sheet1',
    });
  });
});

// ============================================================
// Parser 测试
// ============================================================
describe('Parser', () => {
  // ============================================================
  // 字面量
  // ============================================================
  describe('字面量', () => {
    it('数字字面量', () => {
      const ast = parse('42');
      expect(ast).toEqual({ type: 'NumberLiteral', value: 42 });
    });

    it('小数字面量', () => {
      const ast = parse('3.14');
      expect(ast).toEqual({ type: 'NumberLiteral', value: 3.14 });
    });

    it('字符串字面量', () => {
      const ast = parse('"Hello"');
      expect(ast).toEqual({ type: 'StringLiteral', value: 'Hello' });
    });

    it('布尔字面量 TRUE', () => {
      const ast = parse('TRUE');
      expect(ast).toEqual({ type: 'BooleanLiteral', value: true });
    });

    it('布尔字面量 FALSE', () => {
      const ast = parse('FALSE');
      expect(ast).toEqual({ type: 'BooleanLiteral', value: false });
    });
  });

  // ============================================================
  // 单元格引用
  // ============================================================
  describe('单元格引用', () => {
    it('简单引用 A1', () => {
      const ast = parse('A1');
      expect(ast).toEqual({
        type: 'CellReference',
        row: 0, col: 0,
        absolute: { row: false, col: false },
      });
    });

    it('绝对引用 $A$1', () => {
      const ast = parse('$A$1');
      expect(ast).toEqual({
        type: 'CellReference',
        row: 0, col: 0,
        absolute: { row: true, col: true },
      });
    });

    it('混合引用 B$2', () => {
      const ast = parse('B$2');
      expect(ast).toEqual({
        type: 'CellReference',
        row: 1, col: 1,
        absolute: { row: true, col: false },
      });
    });
  });

  // ============================================================
  // 区域引用
  // ============================================================
  describe('区域引用', () => {
    it('A1:B10', () => {
      const ast = parse('A1:B10');
      expect(ast).toEqual({
        type: 'RangeReference',
        startRow: 0, startCol: 0,
        endRow: 9, endCol: 1,
      });
    });

    it('$A$1:$C$5 绝对引用区域', () => {
      const ast = parse('$A$1:$C$5');
      expect(ast).toEqual({
        type: 'RangeReference',
        startRow: 0, startCol: 0,
        endRow: 4, endCol: 2,
      });
    });
  });

  // ============================================================
  // Sheet 引用
  // ============================================================
  describe('Sheet 引用', () => {
    it('Sheet1!A1 → CellReferenceNode 带 sheetName', () => {
      const ast = parse('Sheet1!A1');
      expect(ast).toEqual({
        type: 'CellReference',
        row: 0, col: 0,
        sheetName: 'Sheet1',
        absolute: { row: false, col: false },
      });
    });

    it('Sheet1!A1:B10 → RangeReferenceNode 带 sheetName', () => {
      const ast = parse('Sheet1!A1:B10');
      expect(ast).toEqual({
        type: 'RangeReference',
        startRow: 0, startCol: 0,
        endRow: 9, endCol: 1,
        sheetName: 'Sheet1',
      });
    });
  });

  // ============================================================
  // 算术运算
  // ============================================================
  describe('算术运算', () => {
    it('1 + 2', () => {
      const ast = parse('1+2');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'NumberLiteral', value: 1 },
        right: { type: 'NumberLiteral', value: 2 },
      });
    });

    it('3 * 4 + 5 → 乘法优先级高于加法', () => {
      const ast = parse('3*4+5');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '+',
        left: {
          type: 'BinaryExpression',
          operator: '*',
          left: { type: 'NumberLiteral', value: 3 },
          right: { type: 'NumberLiteral', value: 4 },
        },
        right: { type: 'NumberLiteral', value: 5 },
      });
    });

    it('1 + 2 * 3 → 乘法优先级高于加法', () => {
      const ast = parse('1+2*3');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'NumberLiteral', value: 1 },
        right: {
          type: 'BinaryExpression',
          operator: '*',
          left: { type: 'NumberLiteral', value: 2 },
          right: { type: 'NumberLiteral', value: 3 },
        },
      });
    });

    it('10 / 2 - 3', () => {
      const ast = parse('10/2-3');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '-',
        left: {
          type: 'BinaryExpression',
          operator: '/',
          left: { type: 'NumberLiteral', value: 10 },
          right: { type: 'NumberLiteral', value: 2 },
        },
        right: { type: 'NumberLiteral', value: 3 },
      });
    });
  });

  // ============================================================
  // 一元运算
  // ============================================================
  describe('一元运算', () => {
    it('-5 → 一元负号', () => {
      const ast = parse('-5');
      expect(ast).toEqual({
        type: 'UnaryExpression',
        operator: '-',
        operand: { type: 'NumberLiteral', value: 5 },
      });
    });

    it('--5 → 双重负号', () => {
      const ast = parse('--5');
      expect(ast).toEqual({
        type: 'UnaryExpression',
        operator: '-',
        operand: {
          type: 'UnaryExpression',
          operator: '-',
          operand: { type: 'NumberLiteral', value: 5 },
        },
      });
    });

    it('+5 → 正号被忽略', () => {
      const ast = parse('+5');
      expect(ast).toEqual({ type: 'NumberLiteral', value: 5 });
    });

    it('-A1 → 一元负号应用于单元格引用', () => {
      const ast = parse('-A1');
      expect(ast.type).toBe('UnaryExpression');
    });
  });

  // ============================================================
  // 比较运算
  // ============================================================
  describe('比较运算', () => {
    it('A1 > 10', () => {
      const ast = parse('A1>10');
      expect(ast.type).toBe('BinaryExpression');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('>');
        expect(ast.left.type).toBe('CellReference');
        expect(ast.right).toEqual({ type: 'NumberLiteral', value: 10 });
      }
    });

    it('1 + 2 > 3 → 加法优先级高于比较', () => {
      const ast = parse('1+2>3');
      expect(ast.type).toBe('BinaryExpression');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('>');
        expect(ast.left.type).toBe('BinaryExpression');
      }
    });

    it('<> 运算符', () => {
      const ast = parse('A1<>B1');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('<>');
      }
    });

    it('>= 运算符', () => {
      const ast = parse('A1>=10');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('>=');
      }
    });

    it('<= 运算符', () => {
      const ast = parse('A1<=10');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('<=');
      }
    });

    it('= 运算符', () => {
      const ast = parse('A1=B1');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('=');
      }
    });
  });

  // ============================================================
  // 字符串连接
  // ============================================================
  describe('字符串连接', () => {
    it('"A" & "B"', () => {
      const ast = parse('"A"&"B"');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '&',
        left: { type: 'StringLiteral', value: 'A' },
        right: { type: 'StringLiteral', value: 'B' },
      });
    });

    it('& 优先级低于 +', () => {
      // 1 + 2 & 3 应解析为 (1+2) & 3
      const ast = parse('1+2&3');
      expect(ast.type).toBe('BinaryExpression');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('&');
        expect(ast.left.type).toBe('BinaryExpression');
      }
    });
  });

  // ============================================================
  // 括号表达式
  // ============================================================
  describe('括号表达式', () => {
    it('(1 + 2) * 3', () => {
      const ast = parse('(1+2)*3');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '*',
        left: {
          type: 'BinaryExpression',
          operator: '+',
          left: { type: 'NumberLiteral', value: 1 },
          right: { type: 'NumberLiteral', value: 2 },
        },
        right: { type: 'NumberLiteral', value: 3 },
      });
    });

    it('嵌套括号 ((1 + 2))', () => {
      const ast = parse('((1+2))');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'NumberLiteral', value: 1 },
        right: { type: 'NumberLiteral', value: 2 },
      });
    });
  });

  // ============================================================
  // 函数调用
  // ============================================================
  describe('函数调用', () => {
    it('SUM(1, 2, 3)', () => {
      const ast = parse('SUM(1,2,3)');
      expect(ast).toEqual({
        type: 'FunctionCall',
        name: 'SUM',
        args: [
          { type: 'NumberLiteral', value: 1 },
          { type: 'NumberLiteral', value: 2 },
          { type: 'NumberLiteral', value: 3 },
        ],
      });
    });

    it('ABS(-5) → 函数内含一元运算', () => {
      const ast = parse('ABS(-5)');
      expect(ast).toEqual({
        type: 'FunctionCall',
        name: 'ABS',
        args: [
          {
            type: 'UnaryExpression',
            operator: '-',
            operand: { type: 'NumberLiteral', value: 5 },
          },
        ],
      });
    });

    it('SUM(A1:A10) → 函数参数为区域引用', () => {
      const ast = parse('SUM(A1:A10)');
      expect(ast.type).toBe('FunctionCall');
      if (ast.type === 'FunctionCall') {
        expect(ast.name).toBe('SUM');
        expect(ast.args.length).toBe(1);
        expect(ast.args[0].type).toBe('RangeReference');
      }
    });

    it('无参数函数 TODAY()', () => {
      const ast = parse('TODAY()');
      expect(ast).toEqual({
        type: 'FunctionCall',
        name: 'TODAY',
        args: [],
      });
    });

    it('嵌套函数 IF(SUM(A1:A10)>0, 1, 0)', () => {
      const ast = parse('IF(SUM(A1:A10)>0,1,0)');
      expect(ast.type).toBe('FunctionCall');
      if (ast.type === 'FunctionCall') {
        expect(ast.name).toBe('IF');
        expect(ast.args.length).toBe(3);
        // 第一个参数是比较表达式
        expect(ast.args[0].type).toBe('BinaryExpression');
        // 比较表达式的左侧是 SUM 函数调用
        if (ast.args[0].type === 'BinaryExpression') {
          expect(ast.args[0].left.type).toBe('FunctionCall');
        }
      }
    });

    it('函数名大小写不敏感（统一转大写）', () => {
      const ast = parse('sum(1,2)');
      if (ast.type === 'FunctionCall') {
        expect(ast.name).toBe('SUM');
      }
    });
  });

  // ============================================================
  // 命名范围
  // ============================================================
  describe('命名范围', () => {
    it('SUM(Sales) → 命名范围作为函数参数', () => {
      const ast = parse('SUM(Sales)');
      expect(ast.type).toBe('FunctionCall');
      if (ast.type === 'FunctionCall') {
        expect(ast.args.length).toBe(1);
        const arg = ast.args[0];
        // 命名范围用 RangeReferenceNode 表示，坐标全为 -1
        expect(arg.type).toBe('RangeReference');
        if (arg.type === 'RangeReference') {
          expect(arg.startRow).toBe(-1);
          expect(arg.startCol).toBe(-1);
          expect(arg.endRow).toBe(-1);
          expect(arg.endCol).toBe(-1);
          expect(arg.sheetName).toBe('Sales');
        }
      }
    });
  });

  // ============================================================
  // 运算符优先级综合测试
  // ============================================================
  describe('运算符优先级', () => {
    it('比较 < 连接 < 加减 < 乘除 < 一元', () => {
      // -1 * 2 + 3 & "x" > 5
      // 应解析为: ((((-1) * 2) + 3) & "x") > 5
      const ast = parse('-1*2+3&"x">5');
      expect(ast.type).toBe('BinaryExpression');
      if (ast.type === 'BinaryExpression') {
        // 最外层是比较 >
        expect(ast.operator).toBe('>');
        expect(ast.right).toEqual({ type: 'NumberLiteral', value: 5 });
        // 左侧是连接 &
        expect(ast.left.type).toBe('BinaryExpression');
        if (ast.left.type === 'BinaryExpression') {
          expect(ast.left.operator).toBe('&');
        }
      }
    });

    it('1 + 2 > 3 - 1 → 两侧都是加减表达式', () => {
      const ast = parse('1+2>3-1');
      expect(ast.type).toBe('BinaryExpression');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('>');
        expect(ast.left.type).toBe('BinaryExpression');
        expect(ast.right.type).toBe('BinaryExpression');
      }
    });
  });

  // ============================================================
  // 复杂公式
  // ============================================================
  describe('复杂公式', () => {
    it('IF(A1>10, SUM(B1:B5), 0)', () => {
      const ast = parse('IF(A1>10,SUM(B1:B5),0)');
      expect(ast.type).toBe('FunctionCall');
      if (ast.type === 'FunctionCall') {
        expect(ast.name).toBe('IF');
        expect(ast.args.length).toBe(3);
      }
    });

    it('VLOOKUP(A1, Sheet1!B1:D10, 3, FALSE)', () => {
      const ast = parse('VLOOKUP(A1,Sheet1!B1:D10,3,FALSE)');
      expect(ast.type).toBe('FunctionCall');
      if (ast.type === 'FunctionCall') {
        expect(ast.name).toBe('VLOOKUP');
        expect(ast.args.length).toBe(4);
        // 第二个参数是跨 Sheet 区域引用
        expect(ast.args[1].type).toBe('RangeReference');
        if (ast.args[1].type === 'RangeReference') {
          expect(ast.args[1].sheetName).toBe('Sheet1');
        }
      }
    });

    it('A1 & " " & B1 → 多重字符串连接', () => {
      const ast = parse('A1&" "&B1');
      expect(ast.type).toBe('BinaryExpression');
      if (ast.type === 'BinaryExpression') {
        expect(ast.operator).toBe('&');
        // 左侧也是连接
        expect(ast.left.type).toBe('BinaryExpression');
      }
    });

    it('IFERROR(1/0, "错误")', () => {
      const ast = parse('IFERROR(1/0,"错误")');
      expect(ast.type).toBe('FunctionCall');
      if (ast.type === 'FunctionCall') {
        expect(ast.name).toBe('IFERROR');
        expect(ast.args.length).toBe(2);
        expect(ast.args[0].type).toBe('BinaryExpression');
      }
    });
  });

  // ============================================================
  // 错误处理
  // ============================================================
  describe('错误处理', () => {
    it('未闭合的括号应抛出错误', () => {
      expect(() => parse('(1+2')).toThrow();
    });

    it('多余的右括号应抛出错误', () => {
      expect(() => parse('1+2)')).toThrow();
    });

    it('空的函数参数列表中多余逗号应抛出错误', () => {
      expect(() => parse('SUM(,)')).toThrow();
    });
  });
});
