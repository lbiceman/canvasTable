// ============================================================
// 日期函数：TODAY, NOW, DATE, YEAR, MONTH, DAY, DATEDIF,
//           EDATE, EOMONTH
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
 * 将 FormulaValue 解析为 Date 对象
 * 支持字符串（如 "2024-01-15"）和数字（尝试作为字符串解析）
 * 解析失败返回 null，调用方负责生成错误
 */
function parseDate(value: FormulaValue): Date | null {
  if (isError(value)) return null;
  let dateStr: string;
  if (typeof value === 'string') {
    dateStr = value;
  } else if (typeof value === 'number') {
    // 数字直接转字符串尝试解析
    dateStr = String(value);
  } else {
    return null;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/** 解析日期参数，失败返回 #VALUE! 错误 */
function parseDateOrError(value: FormulaValue): Date | FormulaError {
  if (isError(value)) return value;
  const date = parseDate(value);
  if (date === null) {
    const display = typeof value === 'string' ? value : String(value);
    return makeError('#VALUE!', `无法将 "${display}" 解析为日期`);
  }
  return date;
}

/** 类型守卫：判断 Date | FormulaError 是否为 FormulaError */
function isDateError(value: Date | FormulaError): value is FormulaError {
  return !(value instanceof Date);
}

/** 将数字补零到两位 */
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 格式化日期为 yyyy-MM-dd */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}-${m}-${d}`;
}

/** 格式化日期时间为 yyyy-MM-dd HH:mm:ss */
function formatDateTime(date: Date): string {
  const datePart = formatDate(date);
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${datePart} ${h}:${min}:${s}`;
}

/**
 * 获取指定月份的最后一天
 * month 为 0-based（0=一月, 11=十二月）
 */
function getLastDayOfMonth(year: number, month: number): number {
  // 下个月的第 0 天 = 当月最后一天
  return new Date(year, month + 1, 0).getDate();
}

// ============================================================
// 注册函数
// ============================================================

/** 将所有日期函数注册到 FunctionRegistry */
export function registerDateFunctions(registry: FunctionRegistry): void {

  // TODAY - 返回当前日期
  registry.register({
    name: 'TODAY',
    category: 'date',
    description: '返回当前日期（格式 yyyy-MM-dd）',
    minArgs: 0,
    maxArgs: 0,
    params: [],
    handler: (): FormulaValue => {
      return formatDate(new Date());
    },
  });

  // NOW - 返回当前日期时间
  registry.register({
    name: 'NOW',
    category: 'date',
    description: '返回当前日期和时间（格式 yyyy-MM-dd HH:mm:ss）',
    minArgs: 0,
    maxArgs: 0,
    params: [],
    handler: (): FormulaValue => {
      return formatDateTime(new Date());
    },
  });

  // DATE - 构造日期
  registry.register({
    name: 'DATE',
    category: 'date',
    description: '根据年、月、日构造日期值',
    minArgs: 3,
    maxArgs: 3,
    params: [
      { name: 'year', description: '年份', type: 'number' },
      { name: 'month', description: '月份（1-12，支持溢出自动进位）', type: 'number' },
      { name: 'day', description: '日（1-31，支持溢出自动进位）', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const year = toNumber(args[0]);
      if (isError(year)) return year;
      const month = toNumber(args[1]);
      if (isError(month)) return month;
      const day = toNumber(args[2]);
      if (isError(day)) return day;

      // Date 构造函数的 month 是 0-based，自动处理溢出
      const date = new Date(year, month - 1, day);
      // 修正两位数年份（Date 会将 0-99 映射到 1900-1999）
      if (year >= 0 && year < 100) {
        date.setFullYear(year);
      }
      return formatDate(date);
    },
  });

  // YEAR - 提取年份
  registry.register({
    name: 'YEAR',
    category: 'date',
    description: '返回日期的年份部分',
    minArgs: 1,
    maxArgs: 1,
    params: [
      { name: 'date_text', description: '日期字符串或 DATE 函数返回值', type: 'string' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const date = parseDateOrError(args[0]);
      if (isDateError(date)) return date;
      return date.getFullYear();
    },
  });

  // MONTH - 提取月份
  registry.register({
    name: 'MONTH',
    category: 'date',
    description: '返回日期的月份部分（1-12）',
    minArgs: 1,
    maxArgs: 1,
    params: [
      { name: 'date_text', description: '日期字符串或 DATE 函数返回值', type: 'string' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const date = parseDateOrError(args[0]);
      if (isDateError(date)) return date;
      return date.getMonth() + 1;
    },
  });

  // DAY - 提取日
  registry.register({
    name: 'DAY',
    category: 'date',
    description: '返回日期的日部分（1-31）',
    minArgs: 1,
    maxArgs: 1,
    params: [
      { name: 'date_text', description: '日期字符串或 DATE 函数返回值', type: 'string' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const date = parseDateOrError(args[0]);
      if (isDateError(date)) return date;
      return date.getDate();
    },
  });

  // DATEDIF - 计算日期差值
  registry.register({
    name: 'DATEDIF',
    category: 'date',
    description: '计算两个日期之间的差值（按年、月或天）',
    minArgs: 3,
    maxArgs: 3,
    params: [
      { name: 'start_date', description: '开始日期', type: 'string' },
      { name: 'end_date', description: '结束日期', type: 'string' },
      { name: 'unit', description: '单位："Y"=年, "M"=月, "D"=天', type: 'string' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const startDate = parseDateOrError(args[0]);
      if (isDateError(startDate)) return startDate;
      const endDate = parseDateOrError(args[1]);
      if (isDateError(endDate)) return endDate;

      // 验证单位参数
      const unitRaw = args[2];
      if (isError(unitRaw)) return unitRaw;
      const unit = String(unitRaw).toUpperCase();
      if (unit !== 'Y' && unit !== 'M' && unit !== 'D') {
        return makeError('#NUM!', `DATEDIF 无效单位: "${unit}"，仅支持 "Y"、"M"、"D"`);
      }

      // 开始日期不能晚于结束日期
      if (startDate.getTime() > endDate.getTime()) {
        return makeError('#NUM!', 'DATEDIF 的开始日期不能晚于结束日期');
      }

      switch (unit) {
        case 'D': {
          // 天数差
          const diffMs = endDate.getTime() - startDate.getTime();
          return Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
        case 'M': {
          // 完整月数差
          let months = (endDate.getFullYear() - startDate.getFullYear()) * 12
            + (endDate.getMonth() - startDate.getMonth());
          // 如果结束日的日期小于开始日的日期，减去一个月
          if (endDate.getDate() < startDate.getDate()) {
            months -= 1;
          }
          return Math.max(0, months);
        }
        case 'Y': {
          // 完整年数差
          let years = endDate.getFullYear() - startDate.getFullYear();
          // 检查是否已过完整年
          const monthDiff = endDate.getMonth() - startDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < startDate.getDate())) {
            years -= 1;
          }
          return Math.max(0, years);
        }
        default:
          return makeError('#NUM!', `DATEDIF 无效单位: "${unit}"`);
      }
    },
  });

  // EDATE - 指定月数后的日期
  registry.register({
    name: 'EDATE',
    category: 'date',
    description: '返回指定月数之后（或之前）的日期',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'start_date', description: '开始日期', type: 'string' },
      { name: 'months', description: '月数偏移（正数向后，负数向前）', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const startDate = parseDateOrError(args[0]);
      if (isDateError(startDate)) return startDate;
      const months = toNumber(args[1]);
      if (isError(months)) return months;

      const monthsInt = Math.floor(months);
      const year = startDate.getFullYear();
      const month = startDate.getMonth() + monthsInt;
      const day = startDate.getDate();

      // 计算目标年月
      const targetDate = new Date(year, month, 1);
      const lastDay = getLastDayOfMonth(targetDate.getFullYear(), targetDate.getMonth());
      // 如果原始日期的天数超过目标月份的最大天数，调整到月末
      targetDate.setDate(Math.min(day, lastDay));

      return formatDate(targetDate);
    },
  });

  // EOMONTH - 指定月数后的月末日期
  registry.register({
    name: 'EOMONTH',
    category: 'date',
    description: '返回指定月数之后所在月份的最后一天',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'start_date', description: '开始日期', type: 'string' },
      { name: 'months', description: '月数偏移（正数向后，负数向前）', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const startDate = parseDateOrError(args[0]);
      if (isDateError(startDate)) return startDate;
      const months = toNumber(args[1]);
      if (isError(months)) return months;

      const monthsInt = Math.floor(months);
      const year = startDate.getFullYear();
      const month = startDate.getMonth() + monthsInt;

      // 目标月份的最后一天
      const targetDate = new Date(year, month + 1, 0);
      return formatDate(targetDate);
    },
  });
}
