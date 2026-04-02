// ============================================================
// 文本函数：LEFT, RIGHT, MID, LEN, TRIM, UPPER, LOWER,
//           CONCATENATE, SUBSTITUTE, FIND, SEARCH, TEXT
// ============================================================

import type { FunctionRegistry } from '../function-registry';
import type { FormulaValue, FormulaError } from '../types';
import { isError, makeError } from '../evaluator';

// ============================================================
// 内部辅助函数
// ============================================================

/** 将 FormulaValue 转换为字符串，错误值直接返回 */
function toText(value: FormulaValue): string | FormulaError {
  if (isError(value)) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return makeError('#VALUE!', '无法将数组转换为文本');
}

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

// ============================================================
// TEXT 函数格式化辅助
// ============================================================

/** 根据格式字符串格式化数值 */
function formatNumber(value: number, formatText: string): string {
  // 百分比格式：如 "0%", "0.00%"
  if (formatText.endsWith('%')) {
    const pattern = formatText.slice(0, -1);
    const pctValue = value * 100;
    const decimalMatch = pattern.match(/\.(0+)$/);
    const decimals = decimalMatch ? decimalMatch[1].length : 0;
    return `${pctValue.toFixed(decimals)}%`;
  }

  // 千分位格式：如 "#,##0.00", "#,##0"
  if (formatText.includes(',')) {
    const decimalMatch = formatText.match(/\.(0+)$/);
    const decimals = decimalMatch ? decimalMatch[1].length : 0;
    const fixed = Math.abs(value).toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    // 添加千分位分隔符
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const sign = value < 0 ? '-' : '';
    return decPart ? `${sign}${withCommas}.${decPart}` : `${sign}${withCommas}`;
  }

  // 固定小数位格式：如 "0.00", "0.0"
  const decimalMatch = formatText.match(/\.(0+)$/);
  if (decimalMatch) {
    const decimals = decimalMatch[1].length;
    return value.toFixed(decimals);
  }

  // 其他格式：简单转为字符串
  return String(value);
}

// ============================================================
// 注册函数
// ============================================================

/** 将所有文本函数注册到 FunctionRegistry */
export function registerTextFunctions(registry: FunctionRegistry): void {

  // LEFT - 从左侧提取字符
  registry.register({
    name: 'LEFT',
    category: 'text',
    description: '从文本左侧返回指定数量的字符',
    minArgs: 1,
    maxArgs: 2,
    params: [
      { name: 'text', description: '源文本', type: 'string' },
      { name: 'num_chars', description: '要提取的字符数（默认 1）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const text = toText(args[0]);
      if (isError(text)) return text;

      let numChars = 1;
      if (args.length >= 2) {
        const n = toNumber(args[1]);
        if (isError(n)) return n;
        if (n < 0) return makeError('#VALUE!', 'LEFT 的 num_chars 不能为负数');
        numChars = Math.floor(n);
      }

      return text.substring(0, numChars);
    },
  });

  // RIGHT - 从右侧提取字符
  registry.register({
    name: 'RIGHT',
    category: 'text',
    description: '从文本右侧返回指定数量的字符',
    minArgs: 1,
    maxArgs: 2,
    params: [
      { name: 'text', description: '源文本', type: 'string' },
      { name: 'num_chars', description: '要提取的字符数（默认 1）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const text = toText(args[0]);
      if (isError(text)) return text;

      let numChars = 1;
      if (args.length >= 2) {
        const n = toNumber(args[1]);
        if (isError(n)) return n;
        if (n < 0) return makeError('#VALUE!', 'RIGHT 的 num_chars 不能为负数');
        numChars = Math.floor(n);
      }

      if (numChars >= text.length) return text;
      return text.substring(text.length - numChars);
    },
  });

  // MID - 从指定位置提取字符
  registry.register({
    name: 'MID',
    category: 'text',
    description: '从文本的指定位置开始返回指定数量的字符',
    minArgs: 3,
    maxArgs: 3,
    params: [
      { name: 'text', description: '源文本', type: 'string' },
      { name: 'start_num', description: '起始位置（从 1 开始）', type: 'number' },
      { name: 'num_chars', description: '要提取的字符数', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const text = toText(args[0]);
      if (isError(text)) return text;

      const startNum = toNumber(args[1]);
      if (isError(startNum)) return startNum;

      const numChars = toNumber(args[2]);
      if (isError(numChars)) return numChars;

      // 起始位置无效返回空字符串
      if (startNum < 1 || startNum > text.length) return '';
      if (numChars < 0) return makeError('#VALUE!', 'MID 的 num_chars 不能为负数');

      // start_num 从 1 开始，转为 0-based 索引
      const startIndex = Math.floor(startNum) - 1;
      return text.substring(startIndex, startIndex + Math.floor(numChars));
    },
  });

  // LEN - 返回字符串长度
  registry.register({
    name: 'LEN',
    category: 'text',
    description: '返回文本的字符数',
    minArgs: 1,
    maxArgs: 1,
    params: [
      { name: 'text', description: '要计算长度的文本', type: 'string' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const text = toText(args[0]);
      if (isError(text)) return text;
      return text.length;
    },
  });

  // TRIM - 去除首尾空格和连续空格
  registry.register({
    name: 'TRIM',
    category: 'text',
    description: '去除文本首尾空格并将中间多个连续空格缩减为单个空格',
    minArgs: 1,
    maxArgs: 1,
    params: [
      { name: 'text', description: '要修剪的文本', type: 'string' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const text = toText(args[0]);
      if (isError(text)) return text;
      return text.trim().replace(/\s+/g, ' ');
    },
  });

  // UPPER - 转大写
  registry.register({
    name: 'UPPER',
    category: 'text',
    description: '将文本转换为全大写',
    minArgs: 1,
    maxArgs: 1,
    params: [
      { name: 'text', description: '要转换的文本', type: 'string' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const text = toText(args[0]);
      if (isError(text)) return text;
      return text.toUpperCase();
    },
  });

  // LOWER - 转小写
  registry.register({
    name: 'LOWER',
    category: 'text',
    description: '将文本转换为全小写',
    minArgs: 1,
    maxArgs: 1,
    params: [
      { name: 'text', description: '要转换的文本', type: 'string' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const text = toText(args[0]);
      if (isError(text)) return text;
      return text.toLowerCase();
    },
  });

  // CONCATENATE - 连接字符串
  registry.register({
    name: 'CONCATENATE',
    category: 'text',
    description: '将所有参数连接为一个字符串',
    minArgs: 1,
    maxArgs: -1,
    params: [
      { name: 'text1', description: '第一个文本', type: 'string' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      let result = '';
      for (const arg of args) {
        const text = toText(arg);
        if (isError(text)) return text;
        result += text;
      }
      return result;
    },
  });

  // SUBSTITUTE - 替换文本
  registry.register({
    name: 'SUBSTITUTE',
    category: 'text',
    description: '将文本中的指定子串替换为新子串',
    minArgs: 3,
    maxArgs: 4,
    params: [
      { name: 'text', description: '源文本', type: 'string' },
      { name: 'old_text', description: '要替换的旧文本', type: 'string' },
      { name: 'new_text', description: '替换后的新文本', type: 'string' },
      { name: 'instance_num', description: '指定替换第几次出现（可选，省略则替换全部）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const text = toText(args[0]);
      if (isError(text)) return text;

      const oldText = toText(args[1]);
      if (isError(oldText)) return oldText;

      const newText = toText(args[2]);
      if (isError(newText)) return newText;

      // 旧文本为空则直接返回原文本
      if (oldText === '') return text;

      // 指定替换第 N 次出现
      if (args.length >= 4) {
        const instanceNum = toNumber(args[3]);
        if (isError(instanceNum)) return instanceNum;
        if (instanceNum < 1) return makeError('#VALUE!', 'SUBSTITUTE 的 instance_num 必须大于 0');

        let count = 0;
        let startIndex = 0;
        while (startIndex < text.length) {
          const foundIndex = text.indexOf(oldText, startIndex);
          if (foundIndex === -1) break;
          count++;
          if (count === Math.floor(instanceNum)) {
            return text.substring(0, foundIndex) + newText + text.substring(foundIndex + oldText.length);
          }
          startIndex = foundIndex + 1;
        }
        // 未找到第 N 次出现，返回原文本
        return text;
      }

      // 替换全部出现
      return text.split(oldText).join(newText);
    },
  });

  // FIND - 区分大小写查找
  registry.register({
    name: 'FIND',
    category: 'text',
    description: '在文本中查找子串的位置（区分大小写）',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'find_text', description: '要查找的文本', type: 'string' },
      { name: 'within_text', description: '被搜索的文本', type: 'string' },
      { name: 'start_num', description: '起始搜索位置（从 1 开始，可选）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const findText = toText(args[0]);
      if (isError(findText)) return findText;

      const withinText = toText(args[1]);
      if (isError(withinText)) return withinText;

      let startNum = 1;
      if (args.length >= 3) {
        const n = toNumber(args[2]);
        if (isError(n)) return n;
        if (n < 1) return makeError('#VALUE!', 'FIND 的 start_num 必须大于 0');
        startNum = Math.floor(n);
      }

      // start_num 从 1 开始，转为 0-based 索引
      const startIndex = startNum - 1;
      const foundIndex = withinText.indexOf(findText, startIndex);

      if (foundIndex === -1) {
        return makeError('#VALUE!', `FIND 未找到 "${findText}"`);
      }

      // 返回 1-based 位置
      return foundIndex + 1;
    },
  });

  // SEARCH - 不区分大小写查找
  registry.register({
    name: 'SEARCH',
    category: 'text',
    description: '在文本中查找子串的位置（不区分大小写）',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'find_text', description: '要查找的文本', type: 'string' },
      { name: 'within_text', description: '被搜索的文本', type: 'string' },
      { name: 'start_num', description: '起始搜索位置（从 1 开始，可选）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const findText = toText(args[0]);
      if (isError(findText)) return findText;

      const withinText = toText(args[1]);
      if (isError(withinText)) return withinText;

      let startNum = 1;
      if (args.length >= 3) {
        const n = toNumber(args[2]);
        if (isError(n)) return n;
        if (n < 1) return makeError('#VALUE!', 'SEARCH 的 start_num 必须大于 0');
        startNum = Math.floor(n);
      }

      // 不区分大小写：转为小写后查找
      const startIndex = startNum - 1;
      const foundIndex = withinText.toLowerCase().indexOf(findText.toLowerCase(), startIndex);

      if (foundIndex === -1) {
        return makeError('#VALUE!', `SEARCH 未找到 "${findText}"`);
      }

      // 返回 1-based 位置
      return foundIndex + 1;
    },
  });

  // TEXTJOIN - 使用分隔符连接多个文本值
  registry.register({
    name: 'TEXTJOIN',
    category: 'text',
    description: '使用分隔符连接多个文本值，支持忽略空值',
    minArgs: 3,
    maxArgs: -1,
    params: [
      { name: 'delimiter', description: '分隔符', type: 'string' },
      { name: 'ignore_empty', description: '是否忽略空值', type: 'boolean' },
      { name: 'text1', description: '要连接的文本', type: 'any' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      // 提取分隔符
      const delimiter = toText(args[0]);
      if (isError(delimiter)) return delimiter;

      // 提取 ignore_empty 参数
      const ignoreEmptyRaw = args[1];
      if (isError(ignoreEmptyRaw)) return ignoreEmptyRaw;
      const ignoreEmpty = Boolean(ignoreEmptyRaw);

      // 从第 3 个参数开始，展平区域引用为一维字符串数组
      const texts: string[] = [];
      for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        if (Array.isArray(arg)) {
          // 区域引用：逐行逐列展平
          for (const row of arg as FormulaValue[][]) {
            for (const cell of row) {
              if (isError(cell)) return cell;
              const cellText = toText(cell);
              if (isError(cellText)) return cellText;
              texts.push(cellText);
            }
          }
        } else {
          if (isError(arg)) return arg;
          const text = toText(arg);
          if (isError(text)) return text;
          texts.push(text);
        }
      }

      // 根据 ignore_empty 决定是否跳过空字符串
      const filtered = ignoreEmpty ? texts.filter((t) => t !== '') : texts;

      return filtered.join(delimiter);
    },
  });

  // TEXT - 将数值格式化为文本
  registry.register({
    name: 'TEXT',
    category: 'text',
    description: '将数值按指定格式模式转换为格式化文本',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'value', description: '要格式化的数值', type: 'number' },
      { name: 'format_text', description: '格式模式字符串', type: 'string' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const value = toNumber(args[0]);
      if (isError(value)) return value;

      const formatText = toText(args[1]);
      if (isError(formatText)) return formatText;

      return formatNumber(value, formatText);
    },
  });
}
