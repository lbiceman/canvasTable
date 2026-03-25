// ============================================================
// FormulaWorker - Web Worker 线程入口
// 在独立线程中执行公式求值，避免阻塞主线程 UI
// 复用 FormulaEngine 的纯计算管线：Tokenizer → Parser → Evaluator
// 需求：2.1, 2.8
// ============================================================

import { Tokenizer } from './formula/tokenizer';
import { Parser } from './formula/parser';
import { Evaluator, isError, makeError } from './formula/evaluator';
import { FunctionRegistry } from './formula/function-registry';
import { registerMathFunctions } from './formula/functions/math';
import { registerStatisticsFunctions } from './formula/functions/statistics';
import { registerTextFunctions } from './formula/functions/text';
import { registerLogicFunctions } from './formula/functions/logic';
import { registerLookupFunctions } from './formula/functions/lookup';
import { registerDateFunctions } from './formula/functions/date';
import type {
  FormulaValue,
  EvaluationContext,
  RangeReferenceNode,
  FunctionCategory,
} from './formula/types';

// ============================================================
// Worker 消息协议类型定义
// ============================================================

/** 主线程 → Worker 的请求消息 */
interface WorkerRequest {
  id: string;
  type: 'evaluate' | 'batch';
  formulas: Array<{
    formula: string;
    row: number;
    col: number;
    dependencies: Record<string, string>; // "row-col" -> 单元格内容
  }>;
}

/** Worker → 主线程的响应消息 */
interface WorkerResponse {
  id: string;
  results: Array<{
    row: number;
    col: number;
    value: string;
    error?: string;
  }>;
}

// ============================================================
// 初始化公式计算管线（Worker 启动时执行一次）
// ============================================================

const tokenizer = new Tokenizer();
const parser = new Parser();
const functionRegistry = new FunctionRegistry();

/** 注册所有公式函数（与 FormulaEngine 保持一致） */
function registerAllFunctions(): void {
  // 注册六大函数类别
  registerMathFunctions(functionRegistry);
  registerStatisticsFunctions(functionRegistry);
  registerTextFunctions(functionRegistry);
  registerLogicFunctions(functionRegistry);
  registerLookupFunctions(functionRegistry);
  registerDateFunctions(functionRegistry);

  // 注册 SUM（与 FormulaEngine 中的实现一致）
  functionRegistry.register({
    name: 'SUM',
    category: 'math' as FunctionCategory,
    description: '对所有参数求和',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'values', description: '数值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      let sum = 0;
      for (const arg of args) {
        if (isError(arg)) continue;
        if (typeof arg === 'number') {
          sum += arg;
        } else if (typeof arg === 'boolean') {
          sum += arg ? 1 : 0;
        } else if (typeof arg === 'string') {
          const num = Number(arg);
          if (!isNaN(num) && arg.trim() !== '') {
            sum += num;
          }
        } else if (Array.isArray(arg)) {
          for (const row of arg as FormulaValue[][]) {
            for (const cell of row) {
              if (typeof cell === 'number') {
                sum += cell;
              }
            }
          }
        }
      }
      return sum;
    },
  });

  // 注册 SUBTRACT（与 FormulaEngine 中的实现一致）
  functionRegistry.register({
    name: 'SUBTRACT',
    category: 'math' as FunctionCategory,
    description: '从第一个参数中减去后续参数',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'values', description: '数值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = flattenArgsToNumbers(args);
      if (numbers.length === 0) {
        return makeError('#VALUE!', '减法运算至少需要一个数值');
      }
      let result = numbers[0];
      for (let i = 1; i < numbers.length; i++) {
        result -= numbers[i];
      }
      return result;
    },
  });

  // 注册 MULTIPLY（与 FormulaEngine 中的实现一致）
  functionRegistry.register({
    name: 'MULTIPLY',
    category: 'math' as FunctionCategory,
    description: '将所有参数相乘',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'values', description: '数值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = flattenArgsToNumbers(args);
      if (numbers.length === 0) {
        return makeError('#VALUE!', '乘法运算至少需要一个数值');
      }
      let result = numbers[0];
      for (let i = 1; i < numbers.length; i++) {
        result *= numbers[i];
      }
      return result;
    },
  });

  // 注册 DIVIDE（与 FormulaEngine 中的实现一致）
  functionRegistry.register({
    name: 'DIVIDE',
    category: 'math' as FunctionCategory,
    description: '将第一个参数除以后续参数',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'values', description: '数值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = flattenArgsToNumbers(args);
      if (numbers.length === 0) {
        return makeError('#VALUE!', '除法运算至少需要一个数值');
      }
      for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] === 0) {
          return makeError('#DIV/0!', '除数不能为零');
        }
      }
      let result = numbers[0];
      for (let i = 1; i < numbers.length; i++) {
        result /= numbers[i];
      }
      return result;
    },
  });
}

/** 将参数列表展平为数字数组（用于旧版函数） */
function flattenArgsToNumbers(args: FormulaValue[]): number[] {
  const result: number[] = [];
  for (const arg of args) {
    if (isError(arg)) continue;
    if (typeof arg === 'number') {
      result.push(arg);
    } else if (typeof arg === 'boolean') {
      result.push(arg ? 1 : 0);
    } else if (typeof arg === 'string') {
      const num = Number(arg);
      if (!isNaN(num) && arg.trim() !== '') {
        result.push(num);
      }
    } else if (Array.isArray(arg)) {
      for (const row of arg as FormulaValue[][]) {
        for (const cell of row) {
          if (typeof cell === 'number') {
            result.push(cell);
          }
        }
      }
    }
  }
  return result;
}

// 执行函数注册
registerAllFunctions();

// ============================================================
// 公式求值核心逻辑
// ============================================================

/**
 * 将单元格内容字符串解析为 FormulaValue
 * 尝试转换为数字、布尔值，否则保持字符串
 */
function parseCellContent(content: string): FormulaValue {
  if (content === '') return '';

  // 尝试转为数字
  const num = Number(content);
  if (!isNaN(num) && content.trim() !== '') {
    return num;
  }

  // 布尔值
  const upper = content.toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;

  return content;
}

/**
 * 创建基于 dependencies 数据快照的求值上下文
 * Worker 线程无法访问主线程的 Model，所有单元格数据通过 dependencies 提供
 */
function createWorkerEvaluationContext(
  row: number,
  col: number,
  dependencies: Record<string, string>
): EvaluationContext {
  return {
    row,
    col,
    getCellValue: (r: number, c: number, _sheetName?: string): FormulaValue => {
      // Worker 不支持跨 Sheet 引用，跨 Sheet 引用返回 #REF! 错误
      if (_sheetName) {
        return makeError('#REF!', 'Worker 线程不支持跨工作表引用');
      }
      const key = `${r}-${c}`;
      const content = dependencies[key];
      if (content === undefined) {
        // 依赖数据中不存在该单元格，返回空字符串（等同于空单元格）
        return '';
      }
      // 如果内容是公式，递归求值
      if (content.startsWith('=')) {
        return evaluateFormula(content, r, c, dependencies);
      }
      return parseCellContent(content);
    },
    getRangeValues: (range: RangeReferenceNode): FormulaValue[][] => {
      // 命名范围在 Worker 中不支持
      if (range.startRow === -1) {
        return [[makeError('#NAME?', 'Worker 线程不支持命名范围')]];
      }
      const result: FormulaValue[][] = [];
      for (let r = range.startRow; r <= range.endRow; r++) {
        const rowValues: FormulaValue[] = [];
        for (let c = range.startCol; c <= range.endCol; c++) {
          const key = `${r}-${c}`;
          const content = dependencies[key];
          if (content === undefined) {
            rowValues.push('');
          } else if (content.startsWith('=')) {
            rowValues.push(evaluateFormula(content, r, c, dependencies));
          } else {
            rowValues.push(parseCellContent(content));
          }
        }
        result.push(rowValues);
      }
      return result;
    },
    resolveNamedRange: (_name: string): RangeReferenceNode | null => {
      // Worker 线程不支持命名范围解析
      return null;
    },
  };
}

/**
 * 在 Worker 线程中求值单个公式
 * 复用 Tokenizer → Parser → Evaluator 管线
 */
function evaluateFormula(
  formula: string,
  row: number,
  col: number,
  dependencies: Record<string, string>
): FormulaValue {
  if (!formula.startsWith('=')) {
    return parseCellContent(formula);
  }

  const expression = formula.substring(1).trim();
  if (expression === '') {
    return '';
  }

  try {
    const tokens = tokenizer.tokenize(expression);
    const ast = parser.parse(tokens);
    const context = createWorkerEvaluationContext(row, col, dependencies);
    const evaluator = new Evaluator(context, functionRegistry);
    return evaluator.evaluate(ast);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '公式计算错误';
    return makeError('#VALUE!', message);
  }
}

/**
 * 将 FormulaValue 转换为显示字符串
 */
function formatResult(value: FormulaValue): { value: string; error?: string } {
  if (isError(value)) {
    return { value: value.type, error: value.message };
  }
  if (typeof value === 'boolean') {
    return { value: value ? 'TRUE' : 'FALSE' };
  }
  if (typeof value === 'number') {
    return { value: String(value) };
  }
  if (typeof value === 'string') {
    return { value };
  }
  // 数组结果：取左上角值
  if (Array.isArray(value) && value.length > 0) {
    const firstRow = value[0] as FormulaValue[];
    if (Array.isArray(firstRow) && firstRow.length > 0) {
      return formatResult(firstRow[0]);
    }
  }
  return { value: String(value) };
}

// ============================================================
// Worker 消息监听入口
// ============================================================

self.onmessage = (event: MessageEvent<WorkerRequest>): void => {
  const { id, formulas } = event.data;

  const results: WorkerResponse['results'] = formulas.map(({ formula, row, col, dependencies }) => {
    try {
      const rawResult = evaluateFormula(formula, row, col, dependencies);
      const formatted = formatResult(rawResult);
      return {
        row,
        col,
        value: formatted.value,
        error: formatted.error,
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知计算错误';
      return {
        row,
        col,
        value: '#ERROR!',
        error: message,
      };
    }
  });

  const response: WorkerResponse = { id, results };
  self.postMessage(response);
};
