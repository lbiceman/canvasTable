// ============================================================
// 逻辑函数：IF, AND, OR, NOT, IFERROR, IFS, SWITCH
// ============================================================

import type { FunctionRegistry } from '../function-registry';
import type { FormulaValue, FormulaError } from '../types';
import { isError, makeError, toBoolean } from '../evaluator';

// ============================================================
// 内部辅助函数
// ============================================================

/**
 * 将参数列表展平为一维布尔值数组
 * 区域引用传入的是 FormulaValue[][]，需要递归展开
 * 跳过错误值，将数值和字符串隐式转换为布尔值
 */
function flattenToBooleans(args: FormulaValue[]): (boolean | FormulaError)[] {
  const result: (boolean | FormulaError)[] = [];
  for (const arg of args) {
    if (isError(arg)) {
      result.push(arg);
    } else if (Array.isArray(arg)) {
      // 二维数组（区域引用）
      for (const row of arg as FormulaValue[][]) {
        for (const cell of row) {
          if (isError(cell)) {
            result.push(cell);
          } else {
            result.push(toBoolean(cell));
          }
        }
      }
    } else {
      result.push(toBoolean(arg));
    }
  }
  return result;
}

// ============================================================
// 注册函数
// ============================================================

/** 将所有逻辑函数注册到 FunctionRegistry */
export function registerLogicFunctions(registry: FunctionRegistry): void {

  // IF - 条件分支
  registry.register({
    name: 'IF',
    category: 'logic',
    description: '根据条件返回不同的值',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'logical_test', description: '条件表达式', type: 'boolean' },
      { name: 'value_if_true', description: '条件为真时返回的值', type: 'any' },
      { name: 'value_if_false', description: '条件为假时返回的值', type: 'any', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const condition = args[0];
      // 如果条件本身是错误值，直接返回错误
      if (isError(condition)) return condition;
      // 隐式布尔转换：非零数值为 TRUE，零和空字符串为 FALSE
      const condBool = toBoolean(condition);
      if (condBool) {
        return args[1];
      }
      // 第三个参数可选，默认返回 false
      return args.length >= 3 ? args[2] : false;
    },
  });

  // AND - 逻辑与
  registry.register({
    name: 'AND',
    category: 'logic',
    description: '所有参数均为真时返回 TRUE',
    minArgs: 1,
    maxArgs: -1,
    params: [
      { name: 'logical', description: '逻辑值或表达式', type: 'boolean' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const booleans = flattenToBooleans(args);
      for (const val of booleans) {
        // 遇到错误值直接传播
        if (isError(val)) return val;
        if (!val) return false;
      }
      return true;
    },
  });

  // OR - 逻辑或
  registry.register({
    name: 'OR',
    category: 'logic',
    description: '任一参数为真时返回 TRUE',
    minArgs: 1,
    maxArgs: -1,
    params: [
      { name: 'logical', description: '逻辑值或表达式', type: 'boolean' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const booleans = flattenToBooleans(args);
      let hasError: FormulaError | null = null;
      for (const val of booleans) {
        if (isError(val)) {
          // 记录第一个错误，但继续检查是否有 true
          if (!hasError) hasError = val;
          continue;
        }
        if (val) return true;
      }
      // 如果有错误且没有找到 true，返回错误
      if (hasError) return hasError;
      return false;
    },
  });

  // NOT - 逻辑取反
  registry.register({
    name: 'NOT',
    category: 'logic',
    description: '返回参数的逻辑取反',
    minArgs: 1,
    maxArgs: 1,
    params: [
      { name: 'logical', description: '需要取反的逻辑值', type: 'boolean' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const value = args[0];
      if (isError(value)) return value;
      return !toBoolean(value);
    },
  });

  // IFERROR - 错误拦截
  registry.register({
    name: 'IFERROR',
    category: 'logic',
    description: '如果第一个参数是错误值则返回第二个参数',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'value', description: '需要检查的值', type: 'any' },
      { name: 'value_if_error', description: '出错时返回的值', type: 'any' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const value = args[0];
      // 如果第一个参数是错误值，返回备选值
      if (isError(value)) return args[1];
      return value;
    },
  });

  // IFS - 多条件分支
  registry.register({
    name: 'IFS',
    category: 'logic',
    description: '按顺序评估条件-值对，返回第一个为真的条件对应的值',
    minArgs: 2,
    maxArgs: -1,
    params: [
      { name: 'condition', description: '条件表达式', type: 'boolean' },
      { name: 'value', description: '条件为真时返回的值', type: 'any' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      // 参数必须成对出现
      if (args.length % 2 !== 0) {
        return makeError('#VALUE!', 'IFS 函数的参数必须成对出现');
      }
      // 按顺序评估条件-值对
      for (let i = 0; i < args.length; i += 2) {
        const condition = args[i];
        // 条件为错误值时传播错误
        if (isError(condition)) return condition;
        if (toBoolean(condition)) {
          return args[i + 1];
        }
      }
      // 无条件为真，返回 #N/A
      return makeError('#N/A', 'IFS 函数没有任何条件为真');
    },
  });

  // IFNA - 仅拦截 #N/A 错误
  registry.register({
    name: 'IFNA',
    category: 'logic',
    description: '如果第一个参数是 #N/A 错误则返回第二个参数',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'value', description: '需要检查的值', type: 'any' },
      { name: 'value_if_na', description: '#N/A 时返回的值', type: 'any' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const value = args[0];
      // 仅拦截 #N/A，其他错误原样传播
      if (isError(value) && value.type === '#N/A') return args[1];
      return value;
    },
  });

  // SWITCH - 表达式匹配
  registry.register({
    name: 'SWITCH',
    category: 'logic',
    description: '将表达式与值-结果对匹配，返回匹配的结果值或默认值',
    minArgs: 3,
    maxArgs: -1,
    params: [
      { name: 'expression', description: '要匹配的表达式', type: 'any' },
      { name: 'value', description: '匹配值', type: 'any' },
      { name: 'result', description: '匹配时返回的结果', type: 'any' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const expression = args[0];
      // 如果表达式是错误值，直接传播
      if (isError(expression)) return expression;

      // 除去 expression 后的剩余参数
      const rest = args.slice(1);

      // 判断是否有默认值：
      // 剩余参数为奇数个时，最后一个是默认值
      const hasDefault = rest.length % 2 === 1;
      const pairCount = Math.floor(rest.length / 2);

      // 遍历 value-result 对
      for (let i = 0; i < pairCount; i++) {
        const matchValue = rest[i * 2];
        const resultValue = rest[i * 2 + 1];
        // 匹配值为错误时跳过
        if (isError(matchValue)) continue;
        // 比较：使用严格相等（类型和值都相同）
        if (expression === matchValue) {
          return resultValue;
        }
      }

      // 无匹配，检查默认值
      if (hasDefault) {
        return rest[rest.length - 1];
      }

      // 无匹配且无默认值，返回 #N/A
      return makeError('#N/A', 'SWITCH 函数没有匹配值且未提供默认值');
    },
  });
}
