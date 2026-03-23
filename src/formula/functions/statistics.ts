// ============================================================
// 统计函数：COUNT, COUNTA, COUNTIF, COUNTIFS, SUMIF, SUMIFS,
//           AVERAGEIF
// ============================================================

import type { FunctionRegistry } from '../function-registry';
import type { FormulaValue } from '../types';
import { isError, makeError } from '../evaluator';

// ============================================================
// 内部辅助函数
// ============================================================

/** 将二维数组（区域引用）展平为一维数组 */
function flattenRange(value: FormulaValue): FormulaValue[] {
  if (Array.isArray(value)) {
    const result: FormulaValue[] = [];
    for (const row of value as FormulaValue[][]) {
      for (const cell of row) {
        result.push(cell);
      }
    }
    return result;
  }
  return [value];
}

/**
 * 条件匹配引擎
 * 解析条件字符串，返回一个判断函数
 * 支持比较运算符前缀（">5", "<10", ">=3", "<=7", "=5", "<>0"）
 * 支持通配符匹配（* 匹配任意字符序列，? 匹配单个字符）
 * 无运算符前缀时默认为精确匹配（=）
 */
function parseCriteria(criteria: FormulaValue): (value: FormulaValue) => boolean {
  // 数值条件：精确匹配该数值
  if (typeof criteria === 'number') {
    return (value: FormulaValue) => typeof value === 'number' && value === criteria;
  }

  // 布尔条件：精确匹配该布尔值
  if (typeof criteria === 'boolean') {
    return (value: FormulaValue) => typeof value === 'boolean' && value === criteria;
  }

  // 字符串条件：解析运算符和通配符
  if (typeof criteria === 'string') {
    // 尝试解析比较运算符前缀
    const operatorMatch = criteria.match(/^(>=|<=|<>|>|<|=)(.*)$/);

    if (operatorMatch) {
      const [, operator, operand] = operatorMatch;
      const numOperand = Number(operand);
      const isNumericOperand = operand.trim() !== '' && !isNaN(numOperand);

      return (value: FormulaValue) => {
        // 跳过错误值
        if (isError(value)) return false;

        if (isNumericOperand) {
          // 数值比较
          const numValue = typeof value === 'number' ? value
            : typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)) ? Number(value)
            : null;
          if (numValue === null) return false;
          return compareNumbers(numValue, numOperand, operator);
        }
        // 字符串比较
        const strValue = String(value).toLowerCase();
        const strOperand = operand.toLowerCase();
        return compareStrings(strValue, strOperand, operator);
      };
    }

    // 无运算符前缀：检查是否包含通配符
    if (criteria.includes('*') || criteria.includes('?')) {
      return buildWildcardMatcher(criteria);
    }

    // 纯字符串精确匹配（不区分大小写）
    // 如果字符串可以解析为数字，也尝试数值匹配
    const numCriteria = Number(criteria);
    if (criteria.trim() !== '' && !isNaN(numCriteria)) {
      return (value: FormulaValue) => {
        if (typeof value === 'number') return value === numCriteria;
        if (typeof value === 'string') return value.toLowerCase() === criteria.toLowerCase();
        return false;
      };
    }

    const lowerCriteria = criteria.toLowerCase();
    return (value: FormulaValue) => {
      if (isError(value)) return false;
      return String(value).toLowerCase() === lowerCriteria;
    };
  }

  // 其他类型：不匹配任何值
  return () => false;
}

/** 数值比较 */
function compareNumbers(a: number, b: number, operator: string): boolean {
  switch (operator) {
    case '>':  return a > b;
    case '<':  return a < b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '=':  return a === b;
    case '<>': return a !== b;
    default:   return false;
  }
}

/** 字符串比较 */
function compareStrings(a: string, b: string, operator: string): boolean {
  switch (operator) {
    case '>':  return a > b;
    case '<':  return a < b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '=':  return a === b;
    case '<>': return a !== b;
    default:   return false;
  }
}

/**
 * 构建通配符匹配函数
 * * 匹配任意字符序列（包括空字符串）
 * ? 匹配单个字符
 * 匹配不区分大小写
 */
function buildWildcardMatcher(pattern: string): (value: FormulaValue) => boolean {
  // 将通配符模式转换为正则表达式
  const regexStr = pattern
    .toLowerCase()
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // 转义正则特殊字符（不含 * 和 ?）
    .replace(/\*/g, '.*')                    // * → .*
    .replace(/\?/g, '.');                    // ? → .

  const regex = new RegExp(`^${regexStr}$`, 'i');

  return (value: FormulaValue) => {
    if (isError(value)) return false;
    return regex.test(String(value));
  };
}

// ============================================================
// 注册函数
// ============================================================

/** 将所有统计函数注册到 FunctionRegistry */
export function registerStatisticsFunctions(registry: FunctionRegistry): void {

  // COUNT - 计数数值参数（忽略文本、布尔、空值）
  registry.register({
    name: 'COUNT',
    category: 'statistics',
    description: '计算参数中包含数值的单元格数量',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'value1', description: '要计数的值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      let count = 0;
      for (const arg of args) {
        if (Array.isArray(arg)) {
          // 区域引用：仅计数数值类型的单元格
          for (const row of arg as FormulaValue[][]) {
            for (const cell of row) {
              if (typeof cell === 'number') {
                count++;
              }
            }
          }
        } else if (typeof arg === 'number') {
          count++;
        } else if (typeof arg === 'string') {
          // 直接传入的字符串如果可转为数字也计数
          if (arg.trim() !== '' && !isNaN(Number(arg))) {
            count++;
          }
        } else if (typeof arg === 'boolean') {
          // 直接传入的布尔值计为数值
          count++;
        }
      }
      return count;
    },
  });

  // COUNTA - 计数非空参数
  registry.register({
    name: 'COUNTA',
    category: 'statistics',
    description: '计算参数中非空单元格的数量',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'value1', description: '要计数的值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      let count = 0;
      for (const arg of args) {
        if (Array.isArray(arg)) {
          // 区域引用：计数非空单元格
          for (const row of arg as FormulaValue[][]) {
            for (const cell of row) {
              if (cell !== '' && cell !== null && cell !== undefined) {
                count++;
              }
            }
          }
        } else {
          // 直接传入的参数：非空即计数
          if (arg !== '' && arg !== null && arg !== undefined) {
            count++;
          }
        }
      }
      return count;
    },
  });

  // COUNTIF - 单条件计数
  registry.register({
    name: 'COUNTIF',
    category: 'statistics',
    description: '计算满足单个条件的单元格数量',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'range', description: '要计数的区域', type: 'range' },
      { name: 'criteria', description: '条件', type: 'any' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const range = flattenRange(args[0]);
      const matcher = parseCriteria(args[1]);

      let count = 0;
      for (const cell of range) {
        if (matcher(cell)) {
          count++;
        }
      }
      return count;
    },
  });

  // COUNTIFS - 多条件计数
  registry.register({
    name: 'COUNTIFS',
    category: 'statistics',
    description: '计算同时满足所有条件的单元格数量',
    minArgs: 2,
    maxArgs: -1,
    params: [
      { name: 'criteria_range1', description: '第一个条件区域', type: 'range' },
      { name: 'criteria1', description: '第一个条件', type: 'any' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      // 参数必须成对出现
      if (args.length % 2 !== 0) {
        return makeError('#VALUE!', 'COUNTIFS 参数必须成对出现');
      }

      const pairCount = args.length / 2;
      const flatRanges: FormulaValue[][] = [];
      const matchers: ((value: FormulaValue) => boolean)[] = [];

      for (let i = 0; i < pairCount; i++) {
        const range = flattenRange(args[i * 2]);
        flatRanges.push(range);
        matchers.push(parseCriteria(args[i * 2 + 1]));
      }

      // 检查所有条件区域大小是否一致
      const size = flatRanges[0].length;
      for (let i = 1; i < flatRanges.length; i++) {
        if (flatRanges[i].length !== size) {
          return makeError('#VALUE!', 'COUNTIFS 条件区域大小不一致');
        }
      }

      let count = 0;
      for (let j = 0; j < size; j++) {
        let allMatch = true;
        for (let i = 0; i < pairCount; i++) {
          if (!matchers[i](flatRanges[i][j])) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          count++;
        }
      }
      return count;
    },
  });

  // SUMIF - 单条件求和
  registry.register({
    name: 'SUMIF',
    category: 'statistics',
    description: '对满足条件的对应区域单元格求和',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'range', description: '条件判断区域', type: 'range' },
      { name: 'criteria', description: '条件', type: 'any' },
      { name: 'sum_range', description: '求和区域（可选，默认与 range 相同）', type: 'range', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const criteriaRange = flattenRange(args[0]);
      const matcher = parseCriteria(args[1]);
      const sumRange = args.length >= 3 ? flattenRange(args[2]) : criteriaRange;

      let sum = 0;
      for (let i = 0; i < criteriaRange.length; i++) {
        if (matcher(criteriaRange[i])) {
          const sumValue = i < sumRange.length ? sumRange[i] : 0;
          if (typeof sumValue === 'number') {
            sum += sumValue;
          }
        }
      }
      return sum;
    },
  });

  // SUMIFS - 多条件求和
  registry.register({
    name: 'SUMIFS',
    category: 'statistics',
    description: '对同时满足所有条件的对应求和区域单元格求和',
    minArgs: 3,
    maxArgs: -1,
    params: [
      { name: 'sum_range', description: '求和区域', type: 'range' },
      { name: 'criteria_range1', description: '第一个条件区域', type: 'range' },
      { name: 'criteria1', description: '第一个条件', type: 'any' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      // 参数：sum_range, criteria_range1, criteria1, [criteria_range2, criteria2], ...
      // 条件对从 args[1] 开始，必须成对
      if ((args.length - 1) % 2 !== 0) {
        return makeError('#VALUE!', 'SUMIFS 条件参数必须成对出现');
      }

      const sumRange = flattenRange(args[0]);
      const pairCount = (args.length - 1) / 2;
      const flatRanges: FormulaValue[][] = [];
      const matchers: ((value: FormulaValue) => boolean)[] = [];

      for (let i = 0; i < pairCount; i++) {
        const range = flattenRange(args[1 + i * 2]);
        flatRanges.push(range);
        matchers.push(parseCriteria(args[2 + i * 2]));
      }

      // 检查所有条件区域大小是否一致
      const size = flatRanges[0].length;
      for (let i = 1; i < flatRanges.length; i++) {
        if (flatRanges[i].length !== size) {
          return makeError('#VALUE!', 'SUMIFS 条件区域大小不一致');
        }
      }

      let sum = 0;
      for (let j = 0; j < size; j++) {
        let allMatch = true;
        for (let i = 0; i < pairCount; i++) {
          if (!matchers[i](flatRanges[i][j])) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          const sumValue = j < sumRange.length ? sumRange[j] : 0;
          if (typeof sumValue === 'number') {
            sum += sumValue;
          }
        }
      }
      return sum;
    },
  });


  // AVERAGEIF - 单条件平均
  registry.register({
    name: 'AVERAGEIF',
    category: 'statistics',
    description: '返回满足条件的对应区域单元格的算术平均值',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'range', description: '条件判断区域', type: 'range' },
      { name: 'criteria', description: '条件', type: 'any' },
      { name: 'average_range', description: '求平均区域（可选，默认与 range 相同）', type: 'range', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const criteriaRange = flattenRange(args[0]);
      const matcher = parseCriteria(args[1]);
      const avgRange = args.length >= 3 ? flattenRange(args[2]) : criteriaRange;

      let sum = 0;
      let count = 0;
      for (let i = 0; i < criteriaRange.length; i++) {
        if (matcher(criteriaRange[i])) {
          const avgValue = i < avgRange.length ? avgRange[i] : 0;
          if (typeof avgValue === 'number') {
            sum += avgValue;
            count++;
          }
        }
      }

      if (count === 0) {
        return makeError('#DIV/0!', 'AVERAGEIF 没有满足条件的单元格');
      }
      return sum / count;
    },
  });
}
