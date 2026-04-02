// ============================================================
// 词法分析器（Tokenizer）
// 将公式字符串（不含前导 =）分解为 Token 序列
// ============================================================

import type { Token } from './types';

/** 多字符运算符列表 */
const MULTI_CHAR_OPS: ReadonlyArray<string> = ['>=', '<=', '<>'];

/** 单字符运算符集合 */
const SINGLE_CHAR_OPS = new Set(['+', '-', '*', '/', '>', '<', '=', '&']);

/** 判断字符是否为字母或下划线 */
const isAlpha = (ch: string): boolean => /[A-Za-z_]/.test(ch);

/** 判断字符是否为数字 */
const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

/** 判断字符是否为标识符字符（字母、数字、下划线、句点） */
const isIdentChar = (ch: string): boolean => /[A-Za-z0-9_.]/.test(ch);

/** 判断字符是否为空白 */
const isWhitespace = (ch: string): boolean =>
  ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';

/** 判断字符是否为列名字母 */
const isColLetter = (ch: string): boolean => /[A-Za-z]/.test(ch);

/**
 * 从指定位置尝试匹配单元格引用模式
 * 支持 A1、$A$1、$A1、A$1 等格式
 * @returns 匹配的字符数，不匹配返回 0
 */
function matchCellRef(input: string, pos: number): number {
  let i = pos;
  const len = input.length;

  // 可选 $ 前缀（列绝对引用）
  if (i < len && input[i] === '$') i++;

  // 列字母部分（1-3 个大写/小写字母）
  const colStart = i;
  while (i < len && isColLetter(input[i])) i++;
  const colLen = i - colStart;
  if (colLen === 0 || colLen > 3) return 0;

  // 可选 $ 前缀（行绝对引用）
  if (i < len && input[i] === '$') i++;

  // 行数字部分（至少 1 位）
  const rowStart = i;
  while (i < len && isDigit(input[i])) i++;
  if (i === rowStart) return 0;

  // 后面不能紧跟标识符字符（避免把 SUM1x 的前缀误判为单元格引用）
  if (i < len && isIdentChar(input[i])) return 0;

  return i - pos;
}

/**
 * 跳过空白字符，返回新位置
 */
function skipWhitespace(input: string, pos: number): number {
  while (pos < input.length && isWhitespace(input[pos])) pos++;
  return pos;
}

/**
 * 词法分析器
 * 将公式字符串（不含前导 =）转为 Token 数组
 */
export class Tokenizer {
  /** 将公式字符串（不含前导 =）转为 Token 数组 */
  tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let pos = 0;
    const len = input.length;

    while (pos < len) {
      const ch = input[pos];

      // 跳过空白字符
      if (isWhitespace(ch)) {
        pos++;
        continue;
      }

      // 字符串字面量（双引号包裹）
      if (ch === '"') {
        pos = this.readString(input, pos, tokens);
        continue;
      }

      // 数字字面量（整数和小数，如 3.14、.5）
      if (isDigit(ch) || (ch === '.' && pos + 1 < len && isDigit(input[pos + 1]))) {
        pos = this.readNumber(input, pos, tokens);
        continue;
      }

      // 多字符运算符（>=、<=、<>）— 必须在单字符运算符之前检查
      if (pos + 1 < len) {
        const twoChar = input[pos] + input[pos + 1];
        if (MULTI_CHAR_OPS.includes(twoChar)) {
          tokens.push({ type: 'Operator', value: twoChar, position: pos });
          pos += 2;
          continue;
        }
      }

      // 单字符运算符
      if (SINGLE_CHAR_OPS.has(ch)) {
        tokens.push({ type: 'Operator', value: ch, position: pos });
        pos++;
        continue;
      }

      // 括号
      if (ch === '(') { tokens.push({ type: 'LeftParen', value: '(', position: pos }); pos++; continue; }
      if (ch === ')') { tokens.push({ type: 'RightParen', value: ')', position: pos }); pos++; continue; }

      // 花括号
      if (ch === '{') { tokens.push({ type: 'LeftBrace', value: '{', position: pos }); pos++; continue; }
      if (ch === '}') { tokens.push({ type: 'RightBrace', value: '}', position: pos }); pos++; continue; }

      // 逗号
      if (ch === ',') { tokens.push({ type: 'Comma', value: ',', position: pos }); pos++; continue; }

      // 冒号（区域分隔符，如 A1:B10 中的 :）
      if (ch === ':') { tokens.push({ type: 'Colon', value: ':', position: pos }); pos++; continue; }

      // 以 $ 开头 — 可能是绝对单元格引用（$A$1、$A1）
      if (ch === '$') {
        const cellLen = matchCellRef(input, pos);
        if (cellLen > 0) {
          tokens.push({ type: 'CellRef', value: input.slice(pos, pos + cellLen), position: pos });
          pos += cellLen;
          continue;
        }
        // 无法识别的 $，跳过
        pos++;
        continue;
      }

      // 单引号开头 — 可能是带引号的 Sheet 引用（如 'Sheet 1'!A1）
      if (ch === "'") {
        pos = this.readQuotedSheetRef(input, pos, tokens);
        continue;
      }

      // 字母开头 — 可能是布尔值、单元格引用、Sheet 引用、函数名或命名范围
      if (isAlpha(ch)) {
        pos = this.readIdentifier(input, pos, tokens);
        continue;
      }

      // 未识别字符，跳过
      pos++;
    }

    // 添加 EOF token
    tokens.push({ type: 'EOF', value: '', position: pos });
    return tokens;
  }

  /**
   * 读取字符串字面量（双引号包裹）
   * 支持 "" 转义为单个 "
   */
  private readString(input: string, pos: number, tokens: Token[]): number {
    const start = pos;
    pos++; // 跳过开头 "
    let value = '';
    while (pos < input.length) {
      if (input[pos] === '"') {
        // 检查是否为转义双引号 ""
        if (pos + 1 < input.length && input[pos + 1] === '"') {
          value += '"';
          pos += 2;
        } else {
          pos++; // 跳过结尾 "
          break;
        }
      } else {
        value += input[pos];
        pos++;
      }
    }
    tokens.push({ type: 'String', value, position: start });
    return pos;
  }

  /**
   * 读取数字字面量（整数和小数）
   */
  private readNumber(input: string, pos: number, tokens: Token[]): number {
    const start = pos;
    while (pos < input.length && isDigit(input[pos])) pos++;
    // 小数部分
    if (pos < input.length && input[pos] === '.') {
      pos++;
      while (pos < input.length && isDigit(input[pos])) pos++;
    }
    tokens.push({ type: 'Number', value: input.slice(start, pos), position: start });
    return pos;
  }

  /**
   * 读取标识符（字母开头）
   * 区分布尔值、单元格引用、Sheet 引用、函数名、命名范围
   */
  private readIdentifier(input: string, pos: number, tokens: Token[]): number {
    const start = pos;

    // 先尝试匹配单元格引用（如 A1、A$1）
    const cellLen = matchCellRef(input, pos);

    if (cellLen > 0) {
      const refText = input.slice(pos, pos + cellLen);
      const afterRef = pos + cellLen;

      // 检查是否为 Sheet 引用（单元格引用格式的名称后跟 !）
      if (afterRef < input.length && input[afterRef] === '!') {
        return this.readSheetRef(input, pos, tokens);
      }

      // 检查是否为布尔值 TRUE / FALSE
      const upper = refText.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'Boolean', value: upper, position: start });
        return afterRef;
      }

      // 普通单元格引用
      tokens.push({ type: 'CellRef', value: refText, position: start });
      return afterRef;
    }

    // 不是单元格引用，读取完整标识符
    let i = pos;
    while (i < input.length && isIdentChar(input[i])) i++;
    const word = input.slice(pos, i);
    const upper = word.toUpperCase();

    // 布尔值
    if (upper === 'TRUE' || upper === 'FALSE') {
      tokens.push({ type: 'Boolean', value: upper, position: start });
      return i;
    }

    // Sheet 引用（标识符后跟 !）
    if (i < input.length && input[i] === '!') {
      return this.readSheetRef(input, pos, tokens);
    }

    // 函数名（标识符后跟左括号，允许中间有空格）
    const lookAhead = skipWhitespace(input, i);
    if (lookAhead < input.length && input[lookAhead] === '(') {
      tokens.push({ type: 'Function', value: word, position: start });
      return i;
    }

    // 命名范围或其他标识符
    tokens.push({ type: 'NamedRange', value: word, position: start });
    return i;
  }

  /**
   * 读取 Sheet 引用（如 Sheet1!A1、Sheet1!$A$1）
   * token value 格式为 "Sheet1!A1"（包含 !）
   */
  private readSheetRef(input: string, pos: number, tokens: Token[]): number {
    const start = pos;
    let i = pos;

    // 读取 Sheet 名称部分（直到 !）
    while (i < input.length && input[i] !== '!') i++;

    // 跳过 !
    if (i < input.length) i++;

    // 读取后面的单元格引用
    const cellLen = matchCellRef(input, i);
    if (cellLen > 0) {
      i += cellLen;
    }

    tokens.push({ type: 'SheetRef', value: input.slice(start, i), position: start });
    return i;
  }

  /**
   * 读取单引号包裹的 Sheet 引用（如 'Sheet 1'!A1、'My Sheet'!$B$2）
   * 从 ' 读取到匹配的 '，然后期望 !，再读取单元格引用
   * token value 格式为 "Sheet 1!A1"（Sheet 名称不包含外层单引号）
   */
  private readQuotedSheetRef(input: string, pos: number, tokens: Token[]): number {
    const start = pos;
    let i = pos + 1; // 跳过开头的单引号

    // 读取 Sheet 名称（直到匹配的闭合单引号）
    let sheetName = '';
    while (i < input.length) {
      if (input[i] === "'") {
        // 检查是否为转义单引号 ''（两个连续单引号表示一个字面单引号）
        if (i + 1 < input.length && input[i + 1] === "'") {
          sheetName += "'";
          i += 2;
        } else {
          // 闭合单引号
          i++; // 跳过闭合单引号
          break;
        }
      } else {
        sheetName += input[i];
        i++;
      }
    }

    // 期望 ! 分隔符
    if (i < input.length && input[i] === '!') {
      i++; // 跳过 !

      // 读取后面的单元格引用
      const cellLen = matchCellRef(input, i);
      if (cellLen > 0) {
        const cellRef = input.slice(i, i + cellLen);
        i += cellLen;
        // value 格式为 "SheetName!CellRef"，不包含外层单引号
        tokens.push({ type: 'SheetRef', value: `${sheetName}!${cellRef}`, position: start });
        return i;
      }
    }

    // 解析失败（单引号未闭合或缺少 !），跳过整段
    tokens.push({ type: 'SheetRef', value: `${sheetName}!`, position: start });
    return i;
  }
}
