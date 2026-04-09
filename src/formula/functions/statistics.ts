// ============================================================
// 统计函数：COUNT, COUNTA, COUNTIF, COUNTIFS, SUMIF, SUMIFS,
//           AVERAGEIF, MEDIAN, STDEV, VAR, LARGE, SMALL,
//           RANK, PERCENTILE
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
 * 从参数列表中收集所有数值（用于 MEDIAN、STDEV 等聚合统计函数）
 * 区域引用中的非数值被忽略，直接传入的字符串尝试转数字
 */
function collectNumbers(args: FormulaValue[]): number[] {
  const result: number[] = [];
  for (const arg of args) {
    if (isError(arg)) continue;
    if (typeof arg === 'number') {
      result.push(arg);
    } else if (typeof arg === 'boolean') {
      result.push(arg ? 1 : 0);
    } else if (typeof arg === 'string') {
      const num = Number(arg);
      if (arg.trim() !== '' && !isNaN(num)) {
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

  // MEDIAN - 返回中位数
  registry.register({
    name: 'MEDIAN',
    category: 'statistics',
    description: '返回一组数值的中位数',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'value1', description: '数值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = collectNumbers(args);
      if (numbers.length === 0) {
        return makeError('#NUM!', 'MEDIAN 没有可用的数值');
      }
      numbers.sort((a, b) => a - b);
      const mid = Math.floor(numbers.length / 2);
      if (numbers.length % 2 === 0) {
        return (numbers[mid - 1] + numbers[mid]) / 2;
      }
      return numbers[mid];
    },
  });

  // STDEV - 返回样本标准差
  registry.register({
    name: 'STDEV',
    category: 'statistics',
    description: '返回样本标准差',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'value1', description: '数值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = collectNumbers(args);
      if (numbers.length < 2) {
        return makeError('#DIV/0!', 'STDEV 至少需要 2 个数值');
      }
      const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
      const sumSqDiff = numbers.reduce((acc, n) => acc + (n - mean) ** 2, 0);
      return Math.sqrt(sumSqDiff / (numbers.length - 1));
    },
  });

  // VAR - 返回样本方差
  registry.register({
    name: 'VAR',
    category: 'statistics',
    description: '返回样本方差',
    minArgs: 1,
    maxArgs: -1,
    params: [{ name: 'value1', description: '数值或区域', type: 'any' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = collectNumbers(args);
      if (numbers.length < 2) {
        return makeError('#DIV/0!', 'VAR 至少需要 2 个数值');
      }
      const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
      const sumSqDiff = numbers.reduce((acc, n) => acc + (n - mean) ** 2, 0);
      return sumSqDiff / (numbers.length - 1);
    },
  });

  // LARGE - 返回第 k 个最大值
  registry.register({
    name: 'LARGE',
    category: 'statistics',
    description: '返回数据集中第 k 个最大值',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'array', description: '数据区域', type: 'range' },
      { name: 'k', description: '排名位置', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = collectNumbers([args[0]]);
      const kRaw = args[1];
      if (isError(kRaw)) return kRaw;
      const k = typeof kRaw === 'number' ? kRaw : Number(kRaw);
      if (isNaN(k) || k < 1 || k > numbers.length) {
        return makeError('#NUM!', `LARGE 的 k 值 ${k} 超出范围`);
      }
      numbers.sort((a, b) => b - a);
      return numbers[Math.floor(k) - 1];
    },
  });

  // SMALL - 返回第 k 个最小值
  registry.register({
    name: 'SMALL',
    category: 'statistics',
    description: '返回数据集中第 k 个最小值',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'array', description: '数据区域', type: 'range' },
      { name: 'k', description: '排名位置', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = collectNumbers([args[0]]);
      const kRaw = args[1];
      if (isError(kRaw)) return kRaw;
      const k = typeof kRaw === 'number' ? kRaw : Number(kRaw);
      if (isNaN(k) || k < 1 || k > numbers.length) {
        return makeError('#NUM!', `SMALL 的 k 值 ${k} 超出范围`);
      }
      numbers.sort((a, b) => a - b);
      return numbers[Math.floor(k) - 1];
    },
  });

  // RANK - 返回数值在列表中的排名
  registry.register({
    name: 'RANK',
    category: 'statistics',
    description: '返回数值在列表中的排名',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'number', description: '要排名的数值', type: 'number' },
      { name: 'ref', description: '数据区域', type: 'range' },
      { name: 'order', description: '0=降序排名（默认），1=升序排名', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numRaw = args[0];
      if (isError(numRaw)) return numRaw;
      const num = typeof numRaw === 'number' ? numRaw : Number(numRaw);
      if (isNaN(num)) return makeError('#VALUE!', 'RANK 的第一个参数必须是数值');

      const numbers = collectNumbers([args[1]]);
      if (numbers.length === 0) {
        return makeError('#N/A', 'RANK 数据区域为空');
      }

      const orderRaw = args.length >= 3 ? args[2] : 0;
      const order = typeof orderRaw === 'number' ? orderRaw : Number(orderRaw);
      const ascending = order !== 0;

      // 计算排名：比当前值大（降序）或小（升序）的数量 + 1
      let rank = 1;
      for (const n of numbers) {
        if (ascending ? n < num : n > num) {
          rank++;
        }
      }

      // 检查数值是否在列表中
      if (!numbers.includes(num)) {
        return makeError('#N/A', 'RANK 的数值不在数据区域中');
      }

      return rank;
    },
  });

  // PERCENTILE - 返回第 k 百分位数
  registry.register({
    name: 'PERCENTILE',
    category: 'statistics',
    description: '返回数据集中第 k 百分位数',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'array', description: '数据区域', type: 'range' },
      { name: 'k', description: '百分位值（0 到 1 之间）', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const numbers = collectNumbers([args[0]]);
      if (numbers.length === 0) {
        return makeError('#NUM!', 'PERCENTILE 数据区域为空');
      }
      const kRaw = args[1];
      if (isError(kRaw)) return kRaw;
      const k = typeof kRaw === 'number' ? kRaw : Number(kRaw);
      if (isNaN(k) || k < 0 || k > 1) {
        return makeError('#NUM!', 'PERCENTILE 的 k 值必须在 0 到 1 之间');
      }
      numbers.sort((a, b) => a - b);
      const n = numbers.length;
      if (k === 0) return numbers[0];
      if (k === 1) return numbers[n - 1];
      // 线性插值
      const index = k * (n - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const fraction = index - lower;
      return numbers[lower] + fraction * (numbers[upper] - numbers[lower]);
    },
  });
}
