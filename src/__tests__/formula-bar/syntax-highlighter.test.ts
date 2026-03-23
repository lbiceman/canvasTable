// ============================================================
// 语法高亮器单元测试
// ============================================================

import { describe, it, expect } from 'vitest';
import { SyntaxHighlighter } from '../../formula-bar/syntax-highlighter';
import type { HighlightToken } from '../../formula-bar/syntax-highlighter';

describe('SyntaxHighlighter', () => {
  const highlighter = new SyntaxHighlighter();

  /**
   * 辅助函数：验证所有 token 的 text 拼接等于原始公式
   */
  function expectConcatenationEquals(tokens: HighlightToken[], formula: string): void {
    const concatenated = tokens.map((t) => t.text).join('');
    expect(concatenated).toBe(formula);
  }

  /**
   * 辅助函数：按 type 提取 token 的 text
   */
  function textsOfType(tokens: HighlightToken[], type: string): string[] {
    return tokens.filter((t) => t.type === type).map((t) => t.text);
  }

  describe('基本公式高亮', () => {
    it('应正确高亮 =SUM(A1:B10)', () => {
      const formula = '=SUM(A1:B10)';
      const tokens = highlighter.highlight(formula);

      expectConcatenationEquals(tokens, formula);

      // = 是 operator
      expect(tokens[0]).toMatchObject({ text: '=', type: 'operator' });
      // SUM 是 function
      expect(tokens[1]).toMatchObject({ text: 'SUM', type: 'function' });
      // ( 是 paren
      expect(tokens[2]).toMatchObject({ text: '(', type: 'paren' });
      // A1 是 cellRef
      expect(tokens[3]).toMatchObject({ text: 'A1', type: 'cellRef' });
      // : 是 operator
      expect(tokens[4]).toMatchObject({ text: ':', type: 'operator' });
      // B10 是 cellRef
      expect(tokens[5]).toMatchObject({ text: 'B10', type: 'cellRef' });
      // ) 是 paren
      expect(tokens[6]).toMatchObject({ text: ')', type: 'paren' });
    });
  });

  describe('字符串字面量高亮', () => {
    it('应将 "Hello" 标记为 string 类型', () => {
      const formula = '=LEFT("Hello", 3)';
      const tokens = highlighter.highlight(formula);

      expectConcatenationEquals(tokens, formula);

      const stringTokens = tokens.filter((t) => t.type === 'string');
      expect(stringTokens).toHaveLength(1);
      expect(stringTokens[0].text).toBe('"Hello"');
    });
  });

  describe('数字高亮', () => {
    it('应将 3.14 和 2 标记为 number 类型', () => {
      const formula = '=ROUND(3.14, 2)';
      const tokens = highlighter.highlight(formula);

      expectConcatenationEquals(tokens, formula);

      const numberTexts = textsOfType(tokens, 'number');
      expect(numberTexts).toContain('3.14');
      expect(numberTexts).toContain('2');
    });
  });

  describe('运算符高亮', () => {
    it('应将 + 和 * 标记为 operator 类型', () => {
      const formula = '=A1+B1*C1';
      const tokens = highlighter.highlight(formula);

      expectConcatenationEquals(tokens, formula);

      const operatorTexts = textsOfType(tokens, 'operator');
      expect(operatorTexts).toContain('+');
      expect(operatorTexts).toContain('*');
    });
  });

  describe('单元格引用高亮', () => {
    it('应将 A1 标记为 cellRef 类型', () => {
      const formula = '=A1';
      const tokens = highlighter.highlight(formula);

      expectConcatenationEquals(tokens, formula);

      expect(tokens[1]).toMatchObject({ text: 'A1', type: 'cellRef' });
    });
  });

  describe('空公式', () => {
    it('仅有 = 时应返回单个 operator token', () => {
      const formula = '=';
      const tokens = highlighter.highlight(formula);

      expectConcatenationEquals(tokens, formula);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ text: '=', type: 'operator' });
    });
  });

  describe('空字符串', () => {
    it('空字符串应返回空数组', () => {
      const tokens = highlighter.highlight('');
      expect(tokens).toHaveLength(0);
    });
  });

  describe('无效公式容错', () => {
    it('不以 = 开头的普通文本应作为 text 处理', () => {
      const formula = 'Hello World';
      const tokens = highlighter.highlight(formula);

      expectConcatenationEquals(tokens, formula);
      // 应该有 token 输出（命名范围等），且拼接还原
    });
  });

  describe('token 拼接还原', () => {
    const formulas = [
      '=SUM(A1:B10)',
      '=LEFT("Hello", 3)',
      '=ROUND(3.14, 2)',
      '=A1+B1*C1',
      '=IF(A1>10, "大", "小")',
      '=VLOOKUP(A1, B1:D10, 3, FALSE)',
      '=A1 + B1',
      '=',
      '=SUM( A1 : B10 )',
    ];

    formulas.forEach((formula) => {
      it(`拼接所有 token text 应等于原始公式: ${formula}`, () => {
        const tokens = highlighter.highlight(formula);
        expectConcatenationEquals(tokens, formula);
      });
    });
  });

  describe('start/end 位置正确性', () => {
    it('每个 token 的 start/end 应与 text 长度一致', () => {
      const formula = '=SUM(A1:B10)';
      const tokens = highlighter.highlight(formula);

      for (const token of tokens) {
        expect(token.end - token.start).toBe(token.text.length);
      }
    });

    it('token 应按位置连续排列', () => {
      const formula = '=SUM(A1:B10)';
      const tokens = highlighter.highlight(formula);

      for (let i = 1; i < tokens.length; i++) {
        expect(tokens[i].start).toBe(tokens[i - 1].end);
      }
    });
  });

  describe('含空格的公式', () => {
    it('空格应作为 text token 保留', () => {
      const formula = '=A1 + B1';
      const tokens = highlighter.highlight(formula);

      expectConcatenationEquals(tokens, formula);

      // 空格应该被保留为 text token
      const textTokens = tokens.filter((t) => t.type === 'text' && t.text.trim() === '');
      expect(textTokens.length).toBeGreaterThan(0);
    });
  });

  describe('布尔值高亮', () => {
    it('TRUE 和 FALSE 应标记为 text 类型', () => {
      const formula = '=IF(TRUE, FALSE, 0)';
      const tokens = highlighter.highlight(formula);

      expectConcatenationEquals(tokens, formula);

      const textTokens = tokens.filter((t) => t.type === 'text');
      const textValues = textTokens.map((t) => t.text);
      expect(textValues).toContain('TRUE');
      expect(textValues).toContain('FALSE');
    });
  });

  describe('比较运算符高亮', () => {
    it('>=、<=、<> 应标记为 operator 类型', () => {
      const formula = '=IF(A1>=10, B1<=5, C1<>0)';
      const tokens = highlighter.highlight(formula);

      expectConcatenationEquals(tokens, formula);

      const operatorTexts = textsOfType(tokens, 'operator');
      expect(operatorTexts).toContain('>=');
      expect(operatorTexts).toContain('<=');
      expect(operatorTexts).toContain('<>');
    });
  });
});
