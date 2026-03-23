import { describe, it, expect } from 'vitest';
import { Tokenizer } from '../../formula/tokenizer';
import type { Token } from '../../formula/types';

/** 辅助函数：提取 token 类型和值（忽略 position） */
const typesAndValues = (tokens: Token[]): Array<[string, string]> =>
  tokens.map((t) => [t.type, t.value]);

describe('Tokenizer', () => {
  const tokenizer = new Tokenizer();

  // ============================================================
  // 数字字面量
  // ============================================================
  describe('数字字面量', () => {
    it('整数', () => {
      const tokens = tokenizer.tokenize('42');
      expect(typesAndValues(tokens)).toEqual([
        ['Number', '42'],
        ['EOF', ''],
      ]);
    });

    it('小数', () => {
      const tokens = tokenizer.tokenize('3.14');
      expect(typesAndValues(tokens)).toEqual([
        ['Number', '3.14'],
        ['EOF', ''],
      ]);
    });

    it('以小数点开头的小数', () => {
      const tokens = tokenizer.tokenize('.5');
      expect(typesAndValues(tokens)).toEqual([
        ['Number', '.5'],
        ['EOF', ''],
      ]);
    });

    it('记录正确的 position', () => {
      const tokens = tokenizer.tokenize('1+2');
      expect(tokens[0].position).toBe(0);
      expect(tokens[1].position).toBe(1);
      expect(tokens[2].position).toBe(2);
    });
  });


  // ============================================================
  // 字符串字面量
  // ============================================================
  describe('字符串字面量', () => {
    it('普通字符串', () => {
      const tokens = tokenizer.tokenize('"Hello"');
      expect(typesAndValues(tokens)).toEqual([
        ['String', 'Hello'],
        ['EOF', ''],
      ]);
    });

    it('空字符串', () => {
      const tokens = tokenizer.tokenize('""');
      expect(typesAndValues(tokens)).toEqual([
        ['String', ''],
        ['EOF', ''],
      ]);
    });

    it('包含转义双引号的字符串', () => {
      const tokens = tokenizer.tokenize('"He said ""hi"""');
      expect(typesAndValues(tokens)).toEqual([
        ['String', 'He said "hi"'],
        ['EOF', ''],
      ]);
    });
  });

  // ============================================================
  // 布尔字面量
  // ============================================================
  describe('布尔字面量', () => {
    it('TRUE（大写）', () => {
      const tokens = tokenizer.tokenize('TRUE');
      expect(typesAndValues(tokens)).toEqual([
        ['Boolean', 'TRUE'],
        ['EOF', ''],
      ]);
    });

    it('FALSE（大写）', () => {
      const tokens = tokenizer.tokenize('FALSE');
      expect(typesAndValues(tokens)).toEqual([
        ['Boolean', 'FALSE'],
        ['EOF', ''],
      ]);
    });

    it('true（小写，应转为大写）', () => {
      const tokens = tokenizer.tokenize('true');
      expect(typesAndValues(tokens)).toEqual([
        ['Boolean', 'TRUE'],
        ['EOF', ''],
      ]);
    });

    it('false（小写，应转为大写）', () => {
      const tokens = tokenizer.tokenize('false');
      expect(typesAndValues(tokens)).toEqual([
        ['Boolean', 'FALSE'],
        ['EOF', ''],
      ]);
    });
  });

  // ============================================================
  // 单元格引用
  // ============================================================
  describe('单元格引用', () => {
    it('简单引用 A1', () => {
      const tokens = tokenizer.tokenize('A1');
      expect(typesAndValues(tokens)).toEqual([
        ['CellRef', 'A1'],
        ['EOF', ''],
      ]);
    });

    it('绝对引用 $A$1', () => {
      const tokens = tokenizer.tokenize('$A$1');
      expect(typesAndValues(tokens)).toEqual([
        ['CellRef', '$A$1'],
        ['EOF', ''],
      ]);
    });

    it('混合引用 $A1', () => {
      const tokens = tokenizer.tokenize('$A1');
      expect(typesAndValues(tokens)).toEqual([
        ['CellRef', '$A1'],
        ['EOF', ''],
      ]);
    });

    it('混合引用 A$1', () => {
      const tokens = tokenizer.tokenize('A$1');
      expect(typesAndValues(tokens)).toEqual([
        ['CellRef', 'A$1'],
        ['EOF', ''],
      ]);
    });

    it('多字母列 AB12', () => {
      const tokens = tokenizer.tokenize('AB12');
      expect(typesAndValues(tokens)).toEqual([
        ['CellRef', 'AB12'],
        ['EOF', ''],
      ]);
    });

    it('三字母列 XFD1', () => {
      const tokens = tokenizer.tokenize('XFD1');
      expect(typesAndValues(tokens)).toEqual([
        ['CellRef', 'XFD1'],
        ['EOF', ''],
      ]);
    });
  });


  // ============================================================
  // Sheet 引用
  // ============================================================
  describe('Sheet 引用', () => {
    it('Sheet1!A1', () => {
      const tokens = tokenizer.tokenize('Sheet1!A1');
      expect(typesAndValues(tokens)).toEqual([
        ['SheetRef', 'Sheet1!A1'],
        ['EOF', ''],
      ]);
    });

    it('Sheet1!$A$1（绝对引用）', () => {
      const tokens = tokenizer.tokenize('Sheet1!$A$1');
      expect(typesAndValues(tokens)).toEqual([
        ['SheetRef', 'Sheet1!$A$1'],
        ['EOF', ''],
      ]);
    });
  });

  // ============================================================
  // 运算符
  // ============================================================
  describe('运算符', () => {
    it('算术运算符 + - * /', () => {
      const tokens = tokenizer.tokenize('1+2-3*4/5');
      const ops = tokens.filter((t) => t.type === 'Operator').map((t) => t.value);
      expect(ops).toEqual(['+', '-', '*', '/']);
    });

    it('比较运算符 > < = >= <= <>', () => {
      const tokens = tokenizer.tokenize('A1>B1<C1=D1>=E1<=F1<>G1');
      const ops = tokens.filter((t) => t.type === 'Operator').map((t) => t.value);
      expect(ops).toEqual(['>', '<', '=', '>=', '<=', '<>']);
    });

    it('字符串连接运算符 &', () => {
      const tokens = tokenizer.tokenize('A1&B1');
      const ops = tokens.filter((t) => t.type === 'Operator').map((t) => t.value);
      expect(ops).toEqual(['&']);
    });
  });

  // ============================================================
  // 函数名
  // ============================================================
  describe('函数名', () => {
    it('SUM(', () => {
      const tokens = tokenizer.tokenize('SUM(A1)');
      expect(tokens[0].type).toBe('Function');
      expect(tokens[0].value).toBe('SUM');
    });

    it('函数名后有空格再跟左括号', () => {
      const tokens = tokenizer.tokenize('SUM (A1)');
      expect(tokens[0].type).toBe('Function');
      expect(tokens[0].value).toBe('SUM');
    });

    it('嵌套函数', () => {
      const tokens = tokenizer.tokenize('IF(SUM(A1:A10)>0,TRUE,FALSE)');
      const funcs = tokens.filter((t) => t.type === 'Function').map((t) => t.value);
      expect(funcs).toEqual(['IF', 'SUM']);
    });
  });

  // ============================================================
  // 括号和分隔符
  // ============================================================
  describe('括号和分隔符', () => {
    it('括号', () => {
      const tokens = tokenizer.tokenize('(1+2)');
      expect(tokens[0].type).toBe('LeftParen');
      expect(tokens[4].type).toBe('RightParen');
    });

    it('花括号', () => {
      const tokens = tokenizer.tokenize('{1,2}');
      expect(tokens[0].type).toBe('LeftBrace');
      expect(tokens[4].type).toBe('RightBrace');
    });

    it('逗号', () => {
      const tokens = tokenizer.tokenize('SUM(1,2,3)');
      const commas = tokens.filter((t) => t.type === 'Comma');
      expect(commas.length).toBe(2);
    });

    it('冒号（区域分隔符）', () => {
      const tokens = tokenizer.tokenize('A1:B10');
      expect(typesAndValues(tokens)).toEqual([
        ['CellRef', 'A1'],
        ['Colon', ':'],
        ['CellRef', 'B10'],
        ['EOF', ''],
      ]);
    });
  });

  // ============================================================
  // 区域引用（CellRef + Colon + CellRef）
  // ============================================================
  describe('区域引用', () => {
    it('A1:B10 拆分为三个 token', () => {
      const tokens = tokenizer.tokenize('A1:B10');
      expect(tokens[0]).toMatchObject({ type: 'CellRef', value: 'A1' });
      expect(tokens[1]).toMatchObject({ type: 'Colon', value: ':' });
      expect(tokens[2]).toMatchObject({ type: 'CellRef', value: 'B10' });
    });

    it('$A$1:$B$10 绝对引用区域', () => {
      const tokens = tokenizer.tokenize('$A$1:$B$10');
      expect(tokens[0]).toMatchObject({ type: 'CellRef', value: '$A$1' });
      expect(tokens[1]).toMatchObject({ type: 'Colon', value: ':' });
      expect(tokens[2]).toMatchObject({ type: 'CellRef', value: '$B$10' });
    });
  });

  // ============================================================
  // 空白处理
  // ============================================================
  describe('空白处理', () => {
    it('跳过空格', () => {
      const tokens = tokenizer.tokenize('1 + 2');
      expect(typesAndValues(tokens)).toEqual([
        ['Number', '1'],
        ['Operator', '+'],
        ['Number', '2'],
        ['EOF', ''],
      ]);
    });

    it('跳过制表符和换行', () => {
      const tokens = tokenizer.tokenize("1\t+\n2");
      expect(typesAndValues(tokens)).toEqual([
        ['Number', '1'],
        ['Operator', '+'],
        ['Number', '2'],
        ['EOF', ''],
      ]);
    });
  });

  // ============================================================
  // EOF
  // ============================================================
  describe('EOF', () => {
    it('空字符串只返回 EOF', () => {
      const tokens = tokenizer.tokenize('');
      expect(typesAndValues(tokens)).toEqual([['EOF', '']]);
    });

    it('最后一个 token 始终是 EOF', () => {
      const tokens = tokenizer.tokenize('1+2');
      expect(tokens[tokens.length - 1].type).toBe('EOF');
    });
  });

  // ============================================================
  // 复杂公式
  // ============================================================
  describe('复杂公式', () => {
    it('IF(SUM(A1:A10)>0,"正","负")', () => {
      const tokens = tokenizer.tokenize('IF(SUM(A1:A10)>0,"正","负")');
      const types = tokens.map((t) => t.type);
      expect(types).toEqual([
        'Function',    // IF
        'LeftParen',   // (
        'Function',    // SUM
        'LeftParen',   // (
        'CellRef',     // A1
        'Colon',       // :
        'CellRef',     // A10
        'RightParen',  // )
        'Operator',    // >
        'Number',      // 0
        'Comma',       // ,
        'String',      // 正
        'Comma',       // ,
        'String',      // 负
        'RightParen',  // )
        'EOF',
      ]);
    });

    it('VLOOKUP(A1,Sheet1!B1:D10,3,FALSE)', () => {
      const tokens = tokenizer.tokenize('VLOOKUP(A1,Sheet1!B1:D10,3,FALSE)');
      const types = tokens.map((t) => t.type);
      expect(types).toEqual([
        'Function',    // VLOOKUP
        'LeftParen',   // (
        'CellRef',     // A1
        'Comma',       // ,
        'SheetRef',    // Sheet1!B1
        'Colon',       // :
        'CellRef',     // D10
        'Comma',       // ,
        'Number',      // 3
        'Comma',       // ,
        'Boolean',     // FALSE
        'RightParen',  // )
        'EOF',
      ]);
    });

    it('命名范围在公式中', () => {
      const tokens = tokenizer.tokenize('SUM(Sales)');
      expect(typesAndValues(tokens)).toEqual([
        ['Function', 'SUM'],
        ['LeftParen', '('],
        ['NamedRange', 'Sales'],
        ['RightParen', ')'],
        ['EOF', ''],
      ]);
    });

    it('position 正确记录每个 token 的起始位置', () => {
      // "A1+B2"
      const tokens = tokenizer.tokenize('A1+B2');
      expect(tokens[0].position).toBe(0); // A1
      expect(tokens[1].position).toBe(2); // +
      expect(tokens[2].position).toBe(3); // B2
    });
  });
});
