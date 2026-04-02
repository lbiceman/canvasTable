// ============================================================
// AST 求值器（Evaluator）
// 递归遍历 AST 节点求值，支持单元格引用、区域引用、命名范围、
// 函数调用和错误传播机制
// ============================================================

import type {
  ASTNode,
  FormulaValue,
  FormulaError,
  EvaluationContext,
  ErrorType,
  RangeReferenceNode,
  FunctionDefinition,
  CellReferenceNode,
} from './types';
import type { FunctionRegistry } from './function-registry';

// ============================================================
// 导出的辅助函数
// ============================================================

/** 类型守卫：判断值是否为 FormulaError */
export function isError(value: FormulaValue): value is FormulaError {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'type' in value &&
    'message' in value
  );
}

/** 创建 FormulaError 对象 */
export function makeError(type: ErrorType, message: string): FormulaError {
  return { type, message };
}

// ============================================================
// 内部辅助函数
// ============================================================

/** 将 FormulaValue 转换为数字，失败时返回 FormulaError */
function toNumber(value: FormulaValue): number | FormulaError {
  if (isError(value)) return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    if (value.trim() === '') return 0;
    const num = Number(value);
    if (isNaN(num)) {
      return makeError('#VALUE!', `无法将 "${value}" 转换为数字`);
    }
    return num;
  }
  return makeError('#VALUE!', '无法将数组转换为数字');
}

/** 将 FormulaValue 转换为字符串（用于显示和连接） */
function toString(value: FormulaValue): string {
  if (isError(value)) return value.type;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') return value;
  return '';
}

/** 将 FormulaValue 转换为布尔值（用于逻辑运算） */
export function toBoolean(value: FormulaValue): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value !== '';
  return false;
}

// ============================================================
// 不传播错误的特殊函数集合（这些函数自行处理错误参数）
// ============================================================
const ERROR_HANDLING_FUNCTIONS = new Set(['IFERROR', 'IFNA', 'IF', 'IFS', 'SWITCH']);

// ============================================================
// Evaluator 类
// ============================================================

/**
 * AST 求值器
 * 递归遍历 AST 节点计算公式结果
 */
export class Evaluator {
  private readonly context: EvaluationContext;
  private readonly functionRegistry: FunctionRegistry;

  constructor(context: EvaluationContext, functionRegistry: FunctionRegistry) {
    this.context = context;
    this.functionRegistry = functionRegistry;
  }

  /** 求值 AST 节点，返回计算结果 */
  evaluate(node: ASTNode): FormulaValue {
    switch (node.type) {
      case 'NumberLiteral':
        return node.value;

      case 'StringLiteral':
        return node.value;

      case 'BooleanLiteral':
        return node.value;

      case 'CellReference':
        return this.context.getCellValue(node.row, node.col, node.sheetName);

      case 'RangeReference':
        return this.evaluateRangeReference(node);

      case 'FunctionCall':
        return this.evaluateFunctionCall(node);

      case 'BinaryExpression':
        return this.evaluateBinaryExpression(node);

      case 'UnaryExpression':
        return this.evaluateUnaryExpression(node);

      case 'ArrayLiteral':
        return this.evaluateArrayLiteral(node);
    }
  }

  // ============================================================
  // 各节点类型的求值方法
  // ============================================================

  /** 求值区域引用节点 */
  private evaluateRangeReference(node: RangeReferenceNode): FormulaValue {
    // startRow === -1 表示命名范围（由 Parser 约定）
    if (node.startRow === -1) {
      const resolved = this.context.resolveNamedRange(node.sheetName!);
      if (resolved === null) {
        return makeError('#NAME?', `未定义的命名范围: ${node.sheetName}`);
      }
      return this.context.getRangeValues(resolved);
    }
    return this.context.getRangeValues(node);
  }

  /** 求值函数调用节点 */
  private evaluateFunctionCall(node: { name: string; args: ASTNode[] }): FormulaValue {
    const funcName = node.name.toUpperCase();
    const funcDef: FunctionDefinition | undefined = this.functionRegistry.get(funcName);

    // 函数未注册
    if (!funcDef) {
      return makeError('#NAME?', `未知函数: ${funcName}`);
    }

    // 参数数量检查
    const argCount = node.args.length;
    if (argCount < funcDef.minArgs) {
      return makeError('#VALUE!', `${funcName} 至少需要 ${funcDef.minArgs} 个参数，实际传入 ${argCount} 个`);
    }
    if (funcDef.maxArgs !== -1 && argCount > funcDef.maxArgs) {
      return makeError('#VALUE!', `${funcName} 最多接受 ${funcDef.maxArgs} 个参数，实际传入 ${argCount} 个`);
    }

    // OFFSET 特殊处理：从第一个参数 AST 节点提取基准单元格坐标，注入到 context
    if (funcName === 'OFFSET' && node.args.length >= 1) {
      return this.evaluateOffset(node.args);
    }

    // 求值每个参数
    const evaluatedArgs: FormulaValue[] = [];
    for (const argNode of node.args) {
      // 区域引用参数：直接获取二维数组传给函数处理器
      if (argNode.type === 'RangeReference') {
        const rangeValue = this.evaluateRangeReference(argNode);
        if (isError(rangeValue)) {
          // 错误传播（除非是特殊函数）
          if (!ERROR_HANDLING_FUNCTIONS.has(funcName)) {
            return rangeValue;
          }
        }
        evaluatedArgs.push(rangeValue);
      } else {
        const argValue = this.evaluate(argNode);
        // 错误传播：非特殊函数遇到错误参数直接返回错误
        if (isError(argValue) && !ERROR_HANDLING_FUNCTIONS.has(funcName)) {
          return argValue;
        }
        evaluatedArgs.push(argValue);
      }
    }

    // 调用函数处理器
    return funcDef.handler(evaluatedArgs, this.context);
  }

  /**
   * OFFSET 特殊求值：从第一个参数 AST 节点提取基准单元格坐标，
   * 构造带有正确基准位置的临时 context 传给 OFFSET handler
   */
  private evaluateOffset(args: ASTNode[]): FormulaValue {
    const funcDef = this.functionRegistry.get('OFFSET');
    if (!funcDef) return makeError('#NAME?', '未知函数: OFFSET');

    // 提取基准单元格坐标
    let baseRow = this.context.row;
    let baseCol = this.context.col;
    const firstArg = args[0];
    if (firstArg.type === 'CellReference') {
      const cellRef = firstArg as CellReferenceNode;
      baseRow = cellRef.row;
      baseCol = cellRef.col;
    }

    // 构造临时 context，row/col 指向基准单元格
    const offsetContext: typeof this.context = {
      ...this.context,
      row: baseRow,
      col: baseCol,
    };

    // 求值剩余参数（跳过第一个，OFFSET handler 不使用 args[0] 的值）
    const evaluatedArgs: FormulaValue[] = [0]; // placeholder for reference arg
    for (let i = 1; i < args.length; i++) {
      const argValue = this.evaluate(args[i]);
      if (isError(argValue)) return argValue;
      evaluatedArgs.push(argValue);
    }

    return funcDef.handler(evaluatedArgs, offsetContext);
  }

  /** 求值二元表达式节点 */
  private evaluateBinaryExpression(node: {
    operator: string;
    left: ASTNode;
    right: ASTNode;
  }): FormulaValue {
    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);

    // 错误传播
    if (isError(left)) return left;
    if (isError(right)) return right;

    // 数组逐元素运算：当任一操作数为二维数组时，执行逐元素运算
    const leftIsArray = Array.isArray(left);
    const rightIsArray = Array.isArray(right);
    if (leftIsArray || rightIsArray) {
      return this.evaluateArrayBinaryOp(
        left as FormulaValue | FormulaValue[][],
        right as FormulaValue | FormulaValue[][],
        node.operator
      );
    }

    const { operator } = node;

    // 字符串连接运算符
    if (operator === '&') {
      return toString(left) + toString(right);
    }

    // 比较运算符
    if (['=', '<>', '<', '>', '<=', '>='].includes(operator)) {
      return this.compareValues(left, right, operator);
    }

    // 算术运算符：将两侧转换为数字
    const leftNum = toNumber(left);
    if (isError(leftNum)) return leftNum;

    const rightNum = toNumber(right);
    if (isError(rightNum)) return rightNum;

    switch (operator) {
      case '+':
        return leftNum + rightNum;
      case '-':
        return leftNum - rightNum;
      case '*':
        return leftNum * rightNum;
      case '/':
        if (rightNum === 0) {
          return makeError('#DIV/0!', '除数不能为零');
        }
        return leftNum / rightNum;
      default:
        return makeError('#VALUE!', `未知运算符: ${operator}`);
    }
  }

  /**
   * 数组逐元素二元运算
   * 当任一操作数为二维数组时，对每个元素执行标量运算
   */
  private evaluateArrayBinaryOp(
    left: FormulaValue | FormulaValue[][],
    right: FormulaValue | FormulaValue[][],
    operator: string
  ): FormulaValue {
    const leftArr = Array.isArray(left) ? left as FormulaValue[][] : null;
    const rightArr = Array.isArray(right) ? right as FormulaValue[][] : null;

    // 确定结果维度
    const rows = Math.max(leftArr ? leftArr.length : 1, rightArr ? rightArr.length : 1);
    const cols = Math.max(
      leftArr && leftArr[0] ? leftArr[0].length : 1,
      rightArr && rightArr[0] ? rightArr[0].length : 1
    );

    const result: FormulaValue[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: FormulaValue[] = [];
      for (let c = 0; c < cols; c++) {
        const lVal = leftArr
          ? (leftArr[r] && leftArr[r][c] !== undefined ? leftArr[r][c] : 0)
          : left as FormulaValue;
        const rVal = rightArr
          ? (rightArr[r] && rightArr[r][c] !== undefined ? rightArr[r][c] : 0)
          : right as FormulaValue;
        row.push(this.scalarBinaryOp(lVal, rVal, operator));
      }
      result.push(row);
    }
    // 返回二维数组作为 FormulaValue（数组公式结果）
    return result as unknown as FormulaValue;
  }

  /** 标量二元运算（不含数组处理） */
  private scalarBinaryOp(left: FormulaValue, right: FormulaValue, operator: string): FormulaValue {
    if (isError(left)) return left;
    if (isError(right)) return right;

    if (operator === '&') {
      return toString(left) + toString(right);
    }
    if (['=', '<>', '<', '>', '<=', '>='].includes(operator)) {
      return this.compareValues(left, right, operator);
    }

    const leftNum = toNumber(left);
    if (isError(leftNum)) return leftNum;
    const rightNum = toNumber(right);
    if (isError(rightNum)) return rightNum;

    switch (operator) {
      case '+': return leftNum + rightNum;
      case '-': return leftNum - rightNum;
      case '*': return leftNum * rightNum;
      case '/':
        if (rightNum === 0) return makeError('#DIV/0!', '除数不能为零');
        return leftNum / rightNum;
      default:
        return makeError('#VALUE!', `未知运算符: ${operator}`);
    }
  }

  /** 比较两个值，返回布尔结果 */
  private compareValues(
    left: FormulaValue,
    right: FormulaValue,
    operator: string
  ): boolean {
    // 同类型比较
    if (typeof left === 'number' && typeof right === 'number') {
      return this.numericCompare(left, right, operator);
    }
    if (typeof left === 'string' && typeof right === 'string') {
      return this.stringCompare(left, right, operator);
    }
    if (typeof left === 'boolean' && typeof right === 'boolean') {
      return this.numericCompare(left ? 1 : 0, right ? 1 : 0, operator);
    }

    // 混合类型：尝试转换为数字比较
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    if (!isError(leftNum) && !isError(rightNum)) {
      return this.numericCompare(leftNum, rightNum, operator);
    }

    // 无法比较时，转为字符串比较
    return this.stringCompare(toString(left), toString(right), operator);
  }

  /** 数值比较 */
  private numericCompare(a: number, b: number, operator: string): boolean {
    switch (operator) {
      case '=':  return a === b;
      case '<>': return a !== b;
      case '<':  return a < b;
      case '>':  return a > b;
      case '<=': return a <= b;
      case '>=': return a >= b;
      default:   return false;
    }
  }

  /** 字符串比较（不区分大小写） */
  private stringCompare(a: string, b: string, operator: string): boolean {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    switch (operator) {
      case '=':  return la === lb;
      case '<>': return la !== lb;
      case '<':  return la < lb;
      case '>':  return la > lb;
      case '<=': return la <= lb;
      case '>=': return la >= lb;
      default:   return false;
    }
  }

  /** 求值一元表达式节点 */
  private evaluateUnaryExpression(node: {
    operator: string;
    operand: ASTNode;
  }): FormulaValue {
    const operand = this.evaluate(node.operand);

    // 错误传播
    if (isError(operand)) return operand;

    if (node.operator === '-') {
      const num = toNumber(operand);
      if (isError(num)) return num;
      return -num;
    }

    return makeError('#VALUE!', `未知一元运算符: ${node.operator}`);
  }

  /** 求值数组字面量节点 */
  private evaluateArrayLiteral(node: {
    elements: ASTNode[][];
  }): FormulaValue {
    const result: FormulaValue[][] = [];
    for (const row of node.elements) {
      const evaluatedRow: FormulaValue[] = [];
      for (const element of row) {
        evaluatedRow.push(this.evaluate(element));
      }
      result.push(evaluatedRow as FormulaValue[]);
    }
    return result;
  }
}
