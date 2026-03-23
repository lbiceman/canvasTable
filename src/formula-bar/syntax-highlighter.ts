// ============================================================
// 语法高亮器（SyntaxHighlighter）
// 将公式字符串转为带颜色标记的 HighlightToken 序列
// 复用 Tokenizer 进行词法分析，为不同类型的 Token 分配颜色类型
// ============================================================

import { Tokenizer } from '../formula/tokenizer';
import type { Token, TokenType } from '../formula/types';

/** 高亮 Token 类型 */
export type HighlightType =
  | 'function'
  | 'cellRef'
  | 'rangeRef'
  | 'number'
  | 'string'
  | 'operator'
  | 'paren'
  | 'text';

/** 高亮 Token */
export interface HighlightToken {
  text: string;
  type: HighlightType;
  start: number;
  end: number;
}

/** TokenType 到 HighlightType 的映射表 */
const TOKEN_TYPE_MAP: Record<string, HighlightType> = {
  Function: 'function',
  CellRef: 'cellRef',
  RangeRef: 'rangeRef',
  Number: 'number',
  String: 'string',
  Operator: 'operator',
  LeftParen: 'paren',
  RightParen: 'paren',
  Comma: 'operator',
  Colon: 'operator',
  Boolean: 'text',
  SheetRef: 'cellRef',
  NamedRange: 'cellRef',
  LeftBrace: 'paren',
  RightBrace: 'paren',
};

/**
 * 根据 TokenType 获取对应的 HighlightType
 */
function mapTokenType(tokenType: TokenType): HighlightType {
  return TOKEN_TYPE_MAP[tokenType] ?? 'text';
}

/**
 * 计算 Token 在原始输入中实际占用的结束位置
 * 对于字符串 Token，value 不含引号，需要从原始输入中计算实际长度
 */
function getTokenEndInInput(token: Token, input: string): number {
  const pos = token.position;

  if (token.type === 'String') {
    // 字符串 Token 的 value 不含引号，需要从原始输入重新扫描
    // 从 position 开始（指向开头 "），找到匹配的结尾 "
    let i = pos + 1; // 跳过开头 "
    while (i < input.length) {
      if (input[i] === '"') {
        if (i + 1 < input.length && input[i + 1] === '"') {
          i += 2; // 跳过转义双引号 ""
        } else {
          i++; // 跳过结尾 "
          break;
        }
      } else {
        i++;
      }
    }
    return i;
  }

  // 其他 Token 类型，value 就是原始文本
  return pos + token.value.length;
}

/**
 * 语法高亮器
 * 将公式字符串转为带颜色标记的 HighlightToken 序列
 */
export class SyntaxHighlighter {
  private tokenizer = new Tokenizer();

  /**
   * 将公式字符串转为带颜色标记的 HighlightToken 序列
   * @param formula 公式字符串（可包含前导 =）
   * @returns HighlightToken 数组，拼接所有 text 可还原原始公式
   */
  highlight(formula: string): HighlightToken[] {
    if (formula.length === 0) {
      return [];
    }

    const result: HighlightToken[] = [];
    let offset = 0;       // 公式中的当前处理位置
    let inputForTokenizer: string;

    // 处理前导 =
    if (formula.startsWith('=')) {
      result.push({ text: '=', type: 'operator', start: 0, end: 1 });
      offset = 1;
      inputForTokenizer = formula.slice(1);
    } else {
      inputForTokenizer = formula;
    }

    // 尝试词法分析
    let tokens: Token[];
    try {
      tokens = this.tokenizer.tokenize(inputForTokenizer);
    } catch {
      // 词法分析失败，返回整个公式作为单个 text token
      return [{ text: formula, type: 'text', start: 0, end: formula.length }];
    }

    // 当前在原始公式中的位置
    let cursor = offset;

    for (const token of tokens) {
      // 跳过 EOF
      if (token.type === 'EOF') break;

      // Token 在原始公式中的实际起始位置
      const tokenStart = token.position + offset;
      const tokenEnd = getTokenEndInInput(token, inputForTokenizer) + offset;

      // 如果 cursor 和 tokenStart 之间有间隙（空白或被跳过的字符），插入 text token
      if (tokenStart > cursor) {
        result.push({
          text: formula.slice(cursor, tokenStart),
          type: 'text',
          start: cursor,
          end: tokenStart,
        });
      }

      // 添加当前 token
      result.push({
        text: formula.slice(tokenStart, tokenEnd),
        type: mapTokenType(token.type),
        start: tokenStart,
        end: tokenEnd,
      });

      cursor = tokenEnd;
    }

    // 处理尾部剩余字符（如果有）
    if (cursor < formula.length) {
      result.push({
        text: formula.slice(cursor),
        type: 'text',
        start: cursor,
        end: formula.length,
      });
    }

    return result;
  }
}
