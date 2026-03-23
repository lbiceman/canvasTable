// ============================================================
// 递归下降解析器（Parser）
// 将 Token 序列解析为抽象语法树（AST）
// 运算符优先级（从低到高）：
//   1. 比较运算符：=, <>, <, >, <=, >=
//   2. 字符串连接：&
//   3. 加减：+, -
//   4. 乘除：*, /
//   5. 一元运算：-（负号）
// ============================================================

import type {
  Token,
  ASTNode,
  NumberLiteralNode,
  StringLiteralNode,
  BooleanLiteralNode,
  CellReferenceNode,
  RangeReferenceNode,
  FunctionCallNode,
  BinaryExpressionNode,
  UnaryExpressionNode,
} from './types';

// ============================================================
// 辅助函数
// ============================================================

/**
 * 将列字母转换为 0 基索引
 * A=0, B=1, ..., Z=25, AA=26, AB=27, ...
 */
export function colLetterToIndex(letters: string): number {
  let index = 0;
  const upper = letters.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64); // A=1
  }
  return index - 1; // 转为 0 基
}

/** 单元格引用解析结果 */
interface CellRefInfo {
  row: number;
  col: number;
  absoluteRow: boolean;
  absoluteCol: boolean;
  sheetName?: string;
}

/**
 * 解析单元格引用字符串（如 "A1"、"$A$1"、"A$1"、"$A1"）
 * 返回 0 基的行列号和绝对引用标记
 */
export function parseCellRefString(ref: string): CellRefInfo {
  let i = 0;

  // 可选 $ 前缀（列绝对引用）
  let absoluteCol = false;
  if (i < ref.length && ref[i] === '$') {
    absoluteCol = true;
    i++;
  }

  // 列字母部分
  let colLetters = '';
  while (i < ref.length && /[A-Za-z]/.test(ref[i])) {
    colLetters += ref[i];
    i++;
  }

  // 可选 $ 前缀（行绝对引用）
  let absoluteRow = false;
  if (i < ref.length && ref[i] === '$') {
    absoluteRow = true;
    i++;
  }

  // 行数字部分
  let rowStr = '';
  while (i < ref.length && ref[i] >= '0' && ref[i] <= '9') {
    rowStr += ref[i];
    i++;
  }

  const col = colLetterToIndex(colLetters);
  const row = parseInt(rowStr, 10) - 1; // 转为 0 基

  return { row, col, absoluteRow, absoluteCol };
}

/**
 * 解析 Sheet 引用字符串（如 "Sheet1!A1"、"Sheet1!$A$1"）
 * 返回 sheetName 和单元格引用信息
 */
export function parseSheetRefString(ref: string): CellRefInfo {
  const bangIndex = ref.indexOf('!');
  if (bangIndex === -1) {
    throw new Error(`无效的 Sheet 引用: ${ref}`);
  }

  const sheetName = ref.slice(0, bangIndex);
  const cellPart = ref.slice(bangIndex + 1);
  const cellInfo = parseCellRefString(cellPart);

  return { ...cellInfo, sheetName };
}

// ============================================================
// 比较运算符集合
// ============================================================
const COMPARISON_OPS = new Set(['=', '<>', '<', '>', '<=', '>=']);

// ============================================================
// Parser 类
// ============================================================

/**
 * 递归下降解析器
 * 将 Token 数组解析为 AST 根节点
 */
export class Parser {
  private tokens: Token[] = [];
  private pos = 0;

  /** 将 Token 数组解析为 AST 根节点 */
  parse(tokens: Token[]): ASTNode {
    this.tokens = tokens;
    this.pos = 0;

    const node = this.parseComparison();

    // 确保所有 token 都已消费（除了 EOF）
    if (this.current().type !== 'EOF') {
      throw new Error(`解析错误: 位置 ${this.current().position} 处存在意外的 token "${this.current().value}"`);
    }

    return node;
  }

  // ============================================================
  // Token 访问辅助方法
  // ============================================================

  /** 获取当前 token */
  private current(): Token {
    return this.tokens[this.pos] ?? { type: 'EOF', value: '', position: -1 };
  }

  /** 获取当前 token 并前进 */
  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  /** 如果当前 token 类型匹配则消费并返回，否则抛出错误 */
  private expect(type: Token['type'], value?: string): Token {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(
        `解析错误: 期望 ${type}${value ? ` "${value}"` : ''}，但在位置 ${token.position} 处遇到 ${token.type} "${token.value}"`
      );
    }
    return this.advance();
  }

  // ============================================================
  // 优先级层级解析方法
  // ============================================================

  /**
   * 第 1 层（最低优先级）：比较运算符
   * =, <>, <, >, <=, >=
   */
  private parseComparison(): ASTNode {
    let left = this.parseConcatenation();

    while (
      this.current().type === 'Operator' &&
      COMPARISON_OPS.has(this.current().value)
    ) {
      const operator = this.advance().value;
      const right = this.parseConcatenation();
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
      } as BinaryExpressionNode;
    }

    return left;
  }

  /**
   * 第 2 层：字符串连接运算符
   * &
   */
  private parseConcatenation(): ASTNode {
    let left = this.parseAddition();

    while (
      this.current().type === 'Operator' &&
      this.current().value === '&'
    ) {
      const operator = this.advance().value;
      const right = this.parseAddition();
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
      } as BinaryExpressionNode;
    }

    return left;
  }

  /**
   * 第 3 层：加减运算符
   * +, -
   */
  private parseAddition(): ASTNode {
    let left = this.parseMultiplication();

    while (
      this.current().type === 'Operator' &&
      (this.current().value === '+' || this.current().value === '-')
    ) {
      const operator = this.advance().value;
      const right = this.parseMultiplication();
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
      } as BinaryExpressionNode;
    }

    return left;
  }

  /**
   * 第 4 层：乘除运算符
   * *, /
   */
  private parseMultiplication(): ASTNode {
    let left = this.parseUnary();

    while (
      this.current().type === 'Operator' &&
      (this.current().value === '*' || this.current().value === '/')
    ) {
      const operator = this.advance().value;
      const right = this.parseUnary();
      left = {
        type: 'BinaryExpression',
        operator,
        left,
        right,
      } as BinaryExpressionNode;
    }

    return left;
  }

  /**
   * 第 5 层（最高优先级）：一元运算符
   * -（负号）
   */
  private parseUnary(): ASTNode {
    if (
      this.current().type === 'Operator' &&
      this.current().value === '-'
    ) {
      this.advance(); // 消费 '-'
      const operand = this.parseUnary(); // 递归处理连续负号
      return {
        type: 'UnaryExpression',
        operator: '-',
        operand,
      } as UnaryExpressionNode;
    }

    // 正号直接忽略
    if (
      this.current().type === 'Operator' &&
      this.current().value === '+'
    ) {
      this.advance();
      return this.parseUnary();
    }

    return this.parsePrimary();
  }

  // ============================================================
  // 基本表达式（原子）
  // ============================================================

  /** 解析基本表达式（原子） */
  private parsePrimary(): ASTNode {
    const token = this.current();

    switch (token.type) {
      // 数字字面量
      case 'Number':
        return this.parseNumberLiteral();

      // 字符串字面量
      case 'String':
        return this.parseStringLiteral();

      // 布尔字面量
      case 'Boolean':
        return this.parseBooleanLiteral();

      // 单元格引用（可能后跟 : 构成区域引用）
      case 'CellRef':
        return this.parseCellRefOrRange();

      // Sheet 引用（可能后跟 : 构成跨 Sheet 区域引用）
      case 'SheetRef':
        return this.parseSheetRefOrRange();

      // 函数调用
      case 'Function':
        return this.parseFunctionCall();

      // 命名范围
      case 'NamedRange':
        return this.parseNamedRange();

      // 括号表达式
      case 'LeftParen':
        return this.parseParenExpression();

      default:
        throw new Error(
          `解析错误: 位置 ${token.position} 处存在意外的 token ${token.type} "${token.value}"`
        );
    }
  }

  /** 解析数字字面量 */
  private parseNumberLiteral(): NumberLiteralNode {
    const token = this.advance();
    return {
      type: 'NumberLiteral',
      value: parseFloat(token.value),
    };
  }

  /** 解析字符串字面量 */
  private parseStringLiteral(): StringLiteralNode {
    const token = this.advance();
    return {
      type: 'StringLiteral',
      value: token.value,
    };
  }

  /** 解析布尔字面量 */
  private parseBooleanLiteral(): BooleanLiteralNode {
    const token = this.advance();
    return {
      type: 'BooleanLiteral',
      value: token.value === 'TRUE',
    };
  }

  /**
   * 解析单元格引用，可能后跟 : 构成区域引用
   * CellRef → CellReferenceNode
   * CellRef : CellRef → RangeReferenceNode
   */
  private parseCellRefOrRange(): CellReferenceNode | RangeReferenceNode {
    const token = this.advance();
    const startInfo = parseCellRefString(token.value);

    // 检查是否后跟冒号（区域引用）
    if (this.current().type === 'Colon') {
      this.advance(); // 消费 ':'
      const endToken = this.expect('CellRef');
      const endInfo = parseCellRefString(endToken.value);

      return {
        type: 'RangeReference',
        startRow: startInfo.row,
        startCol: startInfo.col,
        endRow: endInfo.row,
        endCol: endInfo.col,
      } as RangeReferenceNode;
    }

    // 普通单元格引用
    return {
      type: 'CellReference',
      row: startInfo.row,
      col: startInfo.col,
      absolute: { row: startInfo.absoluteRow, col: startInfo.absoluteCol },
    } as CellReferenceNode;
  }

  /**
   * 解析 Sheet 引用，可能后跟 : 构成跨 Sheet 区域引用
   * SheetRef → CellReferenceNode（带 sheetName）
   * SheetRef : CellRef → RangeReferenceNode（带 sheetName）
   */
  private parseSheetRefOrRange(): CellReferenceNode | RangeReferenceNode {
    const token = this.advance();
    const startInfo = parseSheetRefString(token.value);

    // 检查是否后跟冒号（跨 Sheet 区域引用）
    if (this.current().type === 'Colon') {
      this.advance(); // 消费 ':'
      const endToken = this.expect('CellRef');
      const endInfo = parseCellRefString(endToken.value);

      return {
        type: 'RangeReference',
        startRow: startInfo.row,
        startCol: startInfo.col,
        endRow: endInfo.row,
        endCol: endInfo.col,
        sheetName: startInfo.sheetName,
      } as RangeReferenceNode;
    }

    // 普通跨 Sheet 单元格引用
    return {
      type: 'CellReference',
      row: startInfo.row,
      col: startInfo.col,
      sheetName: startInfo.sheetName,
      absolute: { row: startInfo.absoluteRow, col: startInfo.absoluteCol },
    } as CellReferenceNode;
  }

  /**
   * 解析函数调用
   * Function LeftParen [arg [, arg]*] RightParen
   */
  private parseFunctionCall(): FunctionCallNode {
    const nameToken = this.advance(); // 消费函数名
    this.expect('LeftParen');         // 消费 '('

    const args: ASTNode[] = [];

    // 解析参数列表（可能为空）
    if (this.current().type !== 'RightParen') {
      args.push(this.parseComparison());

      while (this.current().type === 'Comma') {
        this.advance(); // 消费 ','
        args.push(this.parseComparison());
      }
    }

    this.expect('RightParen'); // 消费 ')'

    return {
      type: 'FunctionCall',
      name: nameToken.value.toUpperCase(),
      args,
    };
  }

  /**
   * 解析命名范围
   * 使用 RangeReferenceNode 表示，所有坐标设为 -1，
   * sheetName 字段存储命名范围名称。
   * 求值器通过检查 startRow === -1 来识别命名范围并调用 resolveNamedRange 解析。
   */
  private parseNamedRange(): RangeReferenceNode {
    const token = this.advance();
    return {
      type: 'RangeReference',
      startRow: -1,
      startCol: -1,
      endRow: -1,
      endCol: -1,
      sheetName: token.value, // 存储命名范围名称
    };
  }

  /**
   * 解析括号表达式
   * LeftParen expr RightParen
   */
  private parseParenExpression(): ASTNode {
    this.advance(); // 消费 '('
    const node = this.parseComparison();
    this.expect('RightParen'); // 消费 ')'
    return node;
  }
}
