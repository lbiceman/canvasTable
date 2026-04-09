// ============================================================
// 日期函数：TODAY, NOW, DATE, YEAR, MONTH, DAY, DATEDIF,
//           EDATE, EOMONTH, HOUR, MINUTE, SECOND, TIME,
//           WEEKDAY, WEEKNUM, NETWORKDAYS, WORKDAY
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

  // HOUR - 提取小时
  registry.register({
    name: 'HOUR',
    category: 'date',
    description: '返回时间值的小时部分（0-23）',
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'serial_number', description: '时间值或日期时间字符串', type: 'string' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const date = parseDateOrError(args[0]);
      if (isDateError(date)) return date;
      return date.getHours();
    },
  });

  // MINUTE - 提取分钟
  registry.register({
    name: 'MINUTE',
    category: 'date',
    description: '返回时间值的分钟部分（0-59）',
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'serial_number', description: '时间值或日期时间字符串', type: 'string' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const date = parseDateOrError(args[0]);
      if (isDateError(date)) return date;
      return date.getMinutes();
    },
  });

  // SECOND - 提取秒
  registry.register({
    name: 'SECOND',
    category: 'date',
    description: '返回时间值的秒部分（0-59）',
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'serial_number', description: '时间值或日期时间字符串', type: 'string' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const date = parseDateOrError(args[0]);
      if (isDateError(date)) return date;
      return date.getSeconds();
    },
  });

  // TIME - 根据时分秒构造时间值
  registry.register({
    name: 'TIME',
    category: 'date',
    description: '根据时、分、秒构造时间字符串',
    minArgs: 3,
    maxArgs: 3,
    params: [
      { name: 'hour', description: '小时（0-23）', type: 'number' },
      { name: 'minute', description: '分钟（0-59）', type: 'number' },
      { name: 'second', description: '秒（0-59）', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const hour = toNumber(args[0]);
      if (isError(hour)) return hour;
      const minute = toNumber(args[1]);
      if (isError(minute)) return minute;
      const second = toNumber(args[2]);
      if (isError(second)) return second;
      // 允许溢出自动进位（与 Excel 行为一致）
      const totalSeconds = Math.floor(hour) * 3600 + Math.floor(minute) * 60 + Math.floor(second);
      const h = Math.floor((totalSeconds % 86400) / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    },
  });

  // WEEKDAY - 返回星期几（1-7）
  registry.register({
    name: 'WEEKDAY',
    category: 'date',
    description: '返回日期对应的星期几（默认 1=周日, 7=周六）',
    minArgs: 1,
    maxArgs: 2,
    params: [
      { name: 'serial_number', description: '日期值', type: 'string' },
      { name: 'return_type', description: '返回类型（1=周日起始，2=周一起始，3=从0开始周一起始）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const date = parseDateOrError(args[0]);
      if (isDateError(date)) return date;
      const returnType = args.length >= 2 ? toNumber(args[1]) : 1;
      if (isError(returnType)) return returnType;
      const day = date.getDay(); // 0=周日, 6=周六
      switch (Math.floor(returnType)) {
        case 1: return day + 1;           // 1=周日, 7=周六
        case 2: return day === 0 ? 7 : day; // 1=周一, 7=周日
        case 3: return day === 0 ? 6 : day - 1; // 0=周一, 6=周日
        default: return makeError('#NUM!', `WEEKDAY 无效的 return_type: ${returnType}`);
      }
    },
  });

  // WEEKNUM - 返回一年中的第几周
  registry.register({
    name: 'WEEKNUM',
    category: 'date',
    description: '返回日期在一年中的第几周',
    minArgs: 1,
    maxArgs: 2,
    params: [
      { name: 'serial_number', description: '日期值', type: 'string' },
      { name: 'return_type', description: '1=周日起始（默认），2=周一起始', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const date = parseDateOrError(args[0]);
      if (isDateError(date)) return date;
      const returnType = args.length >= 2 ? toNumber(args[1]) : 1;
      if (isError(returnType)) return returnType;

      // 计算该年第一天
      const yearStart = new Date(date.getFullYear(), 0, 1);
      const weekStart = Math.floor(returnType) === 2 ? 1 : 0; // 0=周日, 1=周一

      // 计算从年初到当前日期的天数
      const diffMs = date.getTime() - yearStart.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // 调整年初第一天的星期偏移
      const yearStartDay = yearStart.getDay();
      const offset = (yearStartDay - weekStart + 7) % 7;

      return Math.floor((diffDays + offset) / 7) + 1;
    },
  });

  // NETWORKDAYS - 计算两个日期之间的工作日数
  registry.register({
    name: 'NETWORKDAYS',
    category: 'date',
    description: '计算两个日期之间的工作日数（排除周末）',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'start_date', description: '开始日期', type: 'string' },
      { name: 'end_date', description: '结束日期', type: 'string' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const startDate = parseDateOrError(args[0]);
      if (isDateError(startDate)) return startDate;
      const endDate = parseDateOrError(args[1]);
      if (isDateError(endDate)) return endDate;

      // 确定方向
      const forward = startDate.getTime() <= endDate.getTime();
      const from = forward ? new Date(startDate) : new Date(endDate);
      const to = forward ? new Date(endDate) : new Date(startDate);

      let count = 0;
      const current = new Date(from);
      while (current.getTime() <= to.getTime()) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }

      return forward ? count : -count;
    },
  });

  // WORKDAY - 返回指定工作日数后的日期
  registry.register({
    name: 'WORKDAY',
    category: 'date',
    description: '返回从开始日期起经过指定工作日数后的日期',
    minArgs: 2,
    maxArgs: 2,
    params: [
      { name: 'start_date', description: '开始日期', type: 'string' },
      { name: 'days', description: '工作日数（正数向后，负数向前）', type: 'number' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const startDate = parseDateOrError(args[0]);
      if (isDateError(startDate)) return startDate;
      const days = toNumber(args[1]);
      if (isError(days)) return days;

      const daysInt = Math.floor(days);
      if (daysInt === 0) return formatDate(startDate);

      const direction = daysInt > 0 ? 1 : -1;
      let remaining = Math.abs(daysInt);
      const current = new Date(startDate);

      while (remaining > 0) {
        current.setDate(current.getDate() + direction);
        const day = current.getDay();
        if (day !== 0 && day !== 6) {
          remaining--;
        }
      }

      return formatDate(current);
    },
  });
}
