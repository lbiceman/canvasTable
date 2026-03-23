// ============================================================
// 公式模块类型定义
// 包含 Token、AST 节点、公式值、错误类型、函数定义、求值上下文等
// ============================================================

// ============================================================
// 词法分析器（Tokenizer）相关类型
// ============================================================

/** Token 类型 */
export type TokenType =
  | 'Number'
  | 'String'
  | 'Boolean'
  | 'CellRef'
  | 'RangeRef'
  | 'SheetRef'
  | 'NamedRange'
  | 'Function'
  | 'Operator'
  | 'LeftParen'
  | 'RightParen'
  | 'LeftBrace'
  | 'RightBrace'
  | 'Comma'
  | 'Colon'
  | 'EOF';

/** 词法 Token */
export interface Token {
  type: TokenType;
  value: string;
  position: number;  // 在原始字符串中的起始位置
}

// ============================================================
// 解析器（Parser）相关类型 - AST 节点
// ============================================================

/** AST 节点类型 */
export type ASTNodeType =
  | 'NumberLiteral'
  | 'StringLiteral'
  | 'BooleanLiteral'
  | 'CellReference'
  | 'RangeReference'
  | 'FunctionCall'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'ArrayLiteral';

/** AST 节点基类 */
export interface ASTNodeBase {
  type: ASTNodeType;
}

/** 数字字面量节点 */
export interface NumberLiteralNode extends ASTNodeBase {
  type: 'NumberLiteral';
  value: number;
}

/** 字符串字面量节点 */
export interface StringLiteralNode extends ASTNodeBase {
  type: 'StringLiteral';
  value: string;
}

/** 布尔字面量节点 */
export interface BooleanLiteralNode extends ASTNodeBase {
  type: 'BooleanLiteral';
  value: boolean;
}

/** 单元格引用节点 */
export interface CellReferenceNode extends ASTNodeBase {
  type: 'CellReference';
  row: number;
  col: number;
  sheetName?: string;
  absolute: { row: boolean; col: boolean };
}

/** 区域引用节点 */
export interface RangeReferenceNode extends ASTNodeBase {
  type: 'RangeReference';
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  sheetName?: string;
}

/** 函数调用节点 */
export interface FunctionCallNode extends ASTNodeBase {
  type: 'FunctionCall';
  name: string;
  args: ASTNode[];
}

/** 二元表达式节点 */
export interface BinaryExpressionNode extends ASTNodeBase {
  type: 'BinaryExpression';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

/** 一元表达式节点 */
export interface UnaryExpressionNode extends ASTNodeBase {
  type: 'UnaryExpression';
  operator: string;
  operand: ASTNode;
}

/** 数组字面量节点 */
export interface ArrayLiteralNode extends ASTNodeBase {
  type: 'ArrayLiteral';
  elements: ASTNode[][];
}

/** AST 节点联合类型 */
export type ASTNode =
  | NumberLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | CellReferenceNode
  | RangeReferenceNode
  | FunctionCallNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | ArrayLiteralNode;

// ============================================================
// 公式值与错误类型
// ============================================================

/** 公式值类型（递归支持二维数组） */
export type FormulaValue = number | string | boolean | FormulaError | FormulaValue[][];

/** 错误类型代码 */
export type ErrorType =
  | '#VALUE!'
  | '#REF!'
  | '#DIV/0!'
  | '#NAME?'
  | '#NUM!'
  | '#N/A'
  | '#NULL!';

/** 公式错误 */
export interface FormulaError {
  type: ErrorType;
  message: string;
}

// ============================================================
// 函数注册表相关类型
// ============================================================

/** 函数类别 */
export type FunctionCategory = 'math' | 'statistics' | 'text' | 'logic' | 'lookup' | 'date';

/** 函数参数定义 */
export interface FunctionParam {
  name: string;
  description: string;
  type: 'number' | 'string' | 'boolean' | 'range' | 'any';
  optional?: boolean;
}

/** 函数处理器类型 */
export type FunctionHandler = (args: FormulaValue[], context: EvaluationContext) => FormulaValue;

/** 函数定义 */
export interface FunctionDefinition {
  name: string;
  category: FunctionCategory;
  description: string;
  minArgs: number;
  maxArgs: number;          // -1 表示不限
  params: FunctionParam[];
  handler: FunctionHandler;
}

// ============================================================
// 求值上下文
// ============================================================

/** 求值上下文，提供单元格值获取、区域值获取和命名范围解析能力 */
export interface EvaluationContext {
  row: number;
  col: number;
  getCellValue: (row: number, col: number, sheetName?: string) => FormulaValue;
  getRangeValues: (range: RangeReferenceNode) => FormulaValue[][];
  resolveNamedRange: (name: string) => RangeReferenceNode | null;
  /** 解析单元格引用节点，返回行列坐标（用于 OFFSET 等需要位置信息的函数） */
  resolveCellRef?: (row: number, col: number) => { row: number; col: number };
}

/** 单元格值获取器类型 */
export type CellGetter = (row: number, col: number, sheetName?: string) => FormulaValue;

// ============================================================
// 命名范围相关类型
// ============================================================

/** 命名范围 */
export interface NamedRange {
  name: string;
  range: RangeReferenceNode;
  sheetScope?: string;  // 作用域限定到特定工作表，undefined 表示全局
}

/** 命名范围操作结果 */
export interface NamedRangeResult {
  success: boolean;
  error?: 'duplicate' | 'invalid_name' | 'invalid_range';
  message?: string;
}

/** 名称验证结果 */
export interface NameValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================
// 数组公式相关类型
// ============================================================

/** 数组公式信息 */
export interface ArrayFormulaInfo {
  originRow: number;
  originCol: number;
  formula: string;
  range: { startRow: number; startCol: number; endRow: number; endCol: number };
}
