// ============================================================
// 数学函数：ABS, ROUND, ROUNDUP, ROUNDDOWN, CEILING, FLOOR,
//           MOD, POWER, SQRT, MAX, MIN, AVERAGE, INT, TRUNC
// ============================================================

import type { FunctionRegistry } from '../function-registry';
import type { FormulaValue, FormulaError } from '../types';
import { isError, makeError } from '../evaluator';

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

/**
 * 将参数列表展平为一维数字数组
 * 区域引用传入的是 FormulaValue[][]，需要递归展开
 * 忽略非数值（字符串、布尔值在聚合函数中被跳过）
 */
function flattenToNumbers(args: FormulaValue[]): number[] {
  const result: number[] = [];
  for (const arg of args) {
    if (isError(arg)) continue;
    if (typeof arg === 'number') {
      result.push(arg);
    } else if (typeof arg === 'boolean') {
      // 直接传入的布尔值参与计算
      result.push(arg ? 1 : 0);
    } else if (typeof arg === 'string') {
      // 直接传入的字符串尝试转数字
      const num = Number(arg);
      if (!isNaN(num) && arg.trim() !== '') {
        result.push(num);
      }
      // 区域中的字符串被忽略
    } else if (Array.isArray(arg)) {
      // 二维数组（区域引用）
      for (const row of arg as FormulaValue[][]) {
        for (const cell of row) {
          if (typeof cell === 'number') {
            result.push(cell);
          }
          // 区域中的字符串、布尔值、错误值被忽略
        }
      }
    }
  }
  return result;
}

// ============================================================
// 注册函数
// ============================================================

/** 将所有数学函数注册到 FunctionRegistry */
export function registerMathFunctions(registry: FunctionRegistry): void {

  // ABS - 绝对值
  registry.register({
    name: 'ABS',
    category: 'math',
    description: '返回数值的绝对值',
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'number', description: '需要取绝对值的数值', type: 'number' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const num = toNumber(args[0]);
      if (isError(num)) return num;
      return Math.abs(num);
    },
  });

  // ROUND - 四舍五入
  registry.register({
    name: 'ROUND',
    category: 'math',
    description: '将数值四舍五入到指定小数位数',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'number', description: '需要四舍五入的数值', type: 'number' },
      { name: 'num_digits', description: '小数位数', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const num = toNumber(args[0]);
      if (isError(num)) return num;
      const digits = toNumber(args[1]);
      if (isError(digits)) return digits;
      const factor = Math.pow(10, digits);
      return Math.round(num * factor) / factor;
    },
  });

  // CEILING - 向上舍入到最近倍数
  registry.register({
    name: 'CEILING',
    category: 'math',
    description: '将数值向上舍入到最近的指定倍数',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'number', description: '需要舍入的数值', type: 'number' },
      { name: 'significance', description: '舍入倍数', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const num = toNumber(args[0]);
      if (isError(num)) return num;
      const sig = toNumber(args[1]);
      if (isError(sig)) return sig;
      if (sig === 0) return 0;
      return Math.ceil(num / sig) * sig;
    },
  });

  // FLOOR - 向下舍入到最近倍数
  registry.register({
    name: 'FLOOR',
    category: 'math',
    description: '将数值向下舍入到最近的指定倍数',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'number', description: '需要舍入的数值', type: 'number' },
      { name: 'significance', description: '舍入倍数', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const num = toNumber(args[0]);
      if (isError(num)) return num;
      const sig = toNumber(args[1]);
      if (isError(sig)) return sig;
      if (sig === 0) return 0;
      return Math.floor(num / sig) * sig;
    },
  });

  // MOD - 取余
  registry.register({
    name: 'MOD',
    category: 'math',
    description: '返回两数相除的余数',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'number', description: '被除数', type: 'number' },
      { name: 'divisor', description: '除数', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const num = toNumber(args[0]);
      if (isError(num)) return num;
      const divisor = toNumber(args[1]);
      if (isError(divisor)) return divisor;
      if (divisor === 0) {
        return makeError('#DIV/0!', 'MOD 函数的除数不能为零');
      }
      // Excel 的 MOD 行为：结果符号与除数相同
      const result = num - Math.floor(num / divisor) * divisor;
      return result;
    },
  });

  // POWER - 幂运算
  registry.register({
    name: 'POWER',
    category: 'math',
    description: '返回数值的指定次幂',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'number', description: '底数', type: 'number' },
      { name: 'power', description: '指数', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const base = toNumber(args[0]);
      if (isError(base)) return base;
      const exp = toNumber(args[1]);
      if (isError(exp)) return exp;
      const result = Math.pow(base, exp);
      if (!isFinite(result)) {
        return makeError('#NUM!', '幂运算结果超出范围');
      }
      return result;
    },
  });

  // SQRT - 平方根
  registry.register({
    name: 'SQRT',
    category: 'math',
    description: '返回数值的平方根',
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'number', description: '需要取平方根的数值', type: 'number' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const num = toNumber(args[0]);
      if (isError(num)) return num;
      if (num < 0) {
        return makeError('#NUM!', 'SQRT 函数的参数不能为负数');
      }
      return Math.sqrt(num);
    },
  });

  // MAX - 最大值
  registry.register({
    name: 'MAX',
    category: 'math',
    description: '返回参数中的最大数值',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'values', description: '数值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = flattenToNumbers(args);
      if (numbers.length === 0) return 0;
      return Math.max(...numbers);
    },
  });

  // MIN - 最小值
  registry.register({
    name: 'MIN',
    category: 'math',
    description: '返回参数中的最小数值',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'values', description: '数值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = flattenToNumbers(args);
      if (numbers.length === 0) return 0;
      return Math.min(...numbers);
    },
  });

  // AVERAGE - 算术平均值
  registry.register({
    name: 'AVERAGE',
    category: 'math',
    description: '返回参数的算术平均值',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'values', description: '数值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = flattenToNumbers(args);
      if (numbers.length === 0) {
        return makeError('#DIV/0!', 'AVERAGE 函数没有可用的数值');
      }
      const sum = numbers.reduce((acc, n) => acc + n, 0);
      return sum / numbers.length;
    },
  });

  // ROUNDUP - 向远离零方向舍入
  registry.register({
    name: 'ROUNDUP',
    category: 'math',
    description: '将数值向远离零的方向舍入到指定小数位数',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'number', description: '需要舍入的数值', type: 'number' },
      { name: 'num_digits', description: '小数位数', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const num = toNumber(args[0]);
      if (isError(num)) return num;
      const digits = toNumber(args[1]);
      if (isError(digits)) return digits;
      if (num === 0) return 0;
      const factor = Math.pow(10, digits);
      return Math.sign(num) * Math.ceil(Math.abs(num) * factor) / factor;
    },
  });

  // ROUNDDOWN - 向接近零方向舍入
  registry.register({
    name: 'ROUNDDOWN',
    category: 'math',
    description: '将数值向接近零的方向舍入到指定小数位数',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'number', description: '需要舍入的数值', type: 'number' },
      { name: 'num_digits', description: '小数位数', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const num = toNumber(args[0]);
      if (isError(num)) return num;
      const digits = toNumber(args[1]);
      if (isError(digits)) return digits;
      if (num === 0) return 0;
      const factor = Math.pow(10, digits);
      return Math.sign(num) * Math.floor(Math.abs(num) * factor) / factor;
    },
  });

  // INT - 向负无穷取整
  registry.register({
    name: 'INT',
    category: 'math',
    description: '返回小于或等于参数的最大整数',
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'number', description: '需要取整的数值', type: 'number' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const num = toNumber(args[0]);
      if (isError(num)) return num;
      return Math.floor(num);
    },
  });

  // TRUNC - 截断小数部分（向零方向）
  registry.register({
    name: 'TRUNC',
    category: 'math',
    description: '截断数值的小数部分',
    minArgs: 1,
    maxArgs: 2,
    params: [
      { name: 'number', description: '需要截断的数值', type: 'number' },
      { name: 'num_digits', description: '保留的小数位数，默认为 0', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const num = toNumber(args[0]);
      if (isError(num)) return num;
      // num_digits 默认为 0
      const digits = args.length > 1 ? toNumber(args[1]) : 0;
      if (isError(digits)) return digits;
      if (num === 0) return 0;
      const factor = Math.pow(10, digits);
      return Math.sign(num) * Math.floor(Math.abs(num) * factor) / factor;
    },
  });
}
