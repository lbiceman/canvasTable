import type { FillPattern, FillDirection } from './types';

// ============================================================
// 预定义序列常量
// ============================================================

/** 已知序列定义 */
interface KnownSequence {
  pattern: RegExp;
  values: string[];
}

/** 预定义序列表（星期、月份、季度等） */
const KNOWN_SEQUENCES: KnownSequence[] = [
  // 中文星期（完整）
  { pattern: /^星期[一二三四五六日]$/, values: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'] },
  // 中文星期（简写）
  { pattern: /^周[一二三四五六日]$/, values: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
  // 中文月份
  { pattern: /^(一|二|三|四|五|六|七|八|九|十|十一|十二)月$/, values: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'] },
  // 数字月份
  { pattern: /^(1|2|3|4|5|6|7|8|9|10|11|12)月$/, values: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] },
  // 英文星期（完整）
  { pattern: /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i, values: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
  // 英文星期（缩写）
  { pattern: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i, values: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
  // 英文月份（完整）
  { pattern: /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i, values: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] },
  // 英文月份（缩写）
  { pattern: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i, values: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  // 季度
  { pattern: /^Q[1-4]$/, values: ['Q1', 'Q2', 'Q3', 'Q4'] },
  // 中文季度
  { pattern: /^第[一二三四]季度$/, values: ['第一季度', '第二季度', '第三季度', '第四季度'] },
];

// ============================================================
// 日期格式与工具函数
// ============================================================

/**
 * 日期格式定义
 * format: 正则表达式匹配模式
 * parse: 从匹配结果中解析出 Date 对象
 * formatFn: 将 Date 对象格式化为对应格式的字符串
 */
interface DateFormat {
  format: RegExp;
  parse: (match: RegExpMatchArray) => Date;
  formatFn: (date: Date) => string;
}

/** 补零工具函数 */
const pad = (n: number): string => n.toString().padStart(2, '0');

/** 支持的日期格式列表 */
const DATE_FORMATS: DateFormat[] = [
  {
    // yyyy-MM-dd
    format: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    parse: (m) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])),
    formatFn: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  },
  {
    // yyyy/MM/dd
    format: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    parse: (m) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])),
    formatFn: (d) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`,
  },
  {
    // MM/dd/yyyy
    format: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parse: (m) => new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2])),
    formatFn: (d) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`,
  },
];

/** 一天的毫秒数 */
const MS_PER_DAY = 86400000;

/**
 * 按月增加日期（正确处理月末）
 * 例如：2024-01-31 + 1月 = 2024-02-29（闰年）
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // 处理月末溢出：如 1月31日 + 1月 → 3月3日，需要回退到2月最后一天
  const expectedMonth = ((date.getMonth() + months) % 12 + 12) % 12;
  if (result.getMonth() !== expectedMonth) {
    // 回退到上个月的最后一天
    result.setDate(0);
  }
  return result;
}

/**
 * 按年增加日期（正确处理闰年2月29日）
 * 例如：2024-02-29 + 1年 = 2025-02-28
 */
function addYears(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  result.setFullYear(result.getFullYear() + years);
  // 处理闰年2月29日 → 非闰年溢出到3月
  if (date.getMonth() === 1 && date.getDate() === 29 && result.getMonth() !== 1) {
    result.setDate(0); // 回退到2月最后一天
  }
  return result;
}

/**
 * 计算两个日期之间的月份差
 * 返回整数月份差，如果不是整月则返回 null
 */
function monthsBetween(a: Date, b: Date): number | null {
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  // 验证：从 a 加上 months 个月后是否等于 b
  const check = addMonths(a, months);
  if (check.getDate() === b.getDate() ||
      // 月末特殊情况：两个日期都是各自月份的最后一天
      (isLastDayOfMonth(a) && isLastDayOfMonth(b))) {
    return months;
  }
  return null;
}

/**
 * 计算两个日期之间的年份差
 * 返回整数年份差，如果不是整年则返回 null
 */
function yearsBetween(a: Date, b: Date): number | null {
  const years = b.getFullYear() - a.getFullYear();
  if (a.getMonth() !== b.getMonth()) return null;
  if (a.getDate() === b.getDate() ||
      (isLastDayOfMonth(a) && isLastDayOfMonth(b))) {
    return years;
  }
  return null;
}

/** 判断日期是否是当月最后一天 */
function isLastDayOfMonth(date: Date): boolean {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return date.getDate() === next.getDate();
}

/**
 * 尝试将字符串解析为日期
 * @returns 解析结果，包含 Date 对象和对应的格式化函数；解析失败返回 null
 */
function tryParseDate(value: string): { date: Date; formatFn: (d: Date) => string } | null {
  const trimmed = value.trim();
  for (const df of DATE_FORMATS) {
    const match = trimmed.match(df.format);
    if (match) {
      const date = df.parse(match);
      // 验证日期有效性（排除 Invalid Date）
      if (!isNaN(date.getTime())) {
        return { date, formatFn: df.formatFn };
      }
    }
  }
  return null;
}

/**
 * 计算两个日期之间的天数差
 */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * 给日期增加指定天数
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 填充序列引擎
 * 负责推断源数据的填充模式并生成填充数据
 */
export class FillSeriesEngine {
  /**
   * 推断源数据的填充模式
   * 优先级：
   * 1. 预定义序列匹配（星期、月份、季度等）
   * 2. 带数字后缀的文本模式（如"第1季度"、"Item1"）
   * 3. 全部为数字 → 计算等差 → 数字递增/递减
   * 4. 全部为日期 → 计算日期间隔 → 日期递增/递减
   * 5. 其他 → 文本复制模式
   */
  public static inferPattern(values: string[]): FillPattern {
    // 空数组：返回文本复制模式
    if (values.length === 0) {
      return { type: 'text', step: 0, values: [] };
    }

    // 1. 尝试预定义序列匹配
    const seqMatch = FillSeriesEngine.matchKnownSequence(values);
    if (seqMatch) {
      return {
        type: 'sequence',
        step: 1,
        values,
        sequenceValues: seqMatch.values,
      };
    }

    // 2. 尝试带数字后缀的文本模式
    const textNumMatch = FillSeriesEngine.matchTextNumber(values);
    if (textNumMatch) {
      return textNumMatch;
    }

    // 3. 尝试数字模式
    if (FillSeriesEngine.isAllNumbers(values)) {
      const nums = values.map(Number);
      const step = FillSeriesEngine.calcNumberStep(nums);
      return { type: 'number', step, values };
    }

    // 4. 尝试日期模式
    if (FillSeriesEngine.isAllDates(values)) {
      const { step, unit } = FillSeriesEngine.calcDateStep(values);
      return { type: 'date', step, values, dateUnit: unit };
    }

    // 5. 文本复制模式
    return { type: 'text', step: 0, values };
  }

  /**
   * 根据模式和方向生成填充数据
   * @param pattern 填充模式
   * @param count 生成数量
   * @param direction 填充方向
   * @returns 生成的填充数据数组
   */
  public static generate(
    pattern: FillPattern,
    count: number,
    direction: FillDirection
  ): string[] {
    if (count <= 0 || pattern.values.length === 0) {
      return [];
    }

    switch (pattern.type) {
      case 'number':
        return FillSeriesEngine.generateNumbers(pattern, count, direction);
      case 'date':
        return FillSeriesEngine.generateDates(pattern, count, direction);
      case 'sequence':
        return FillSeriesEngine.generateSequence(pattern, count, direction);
      case 'textNumber':
        return FillSeriesEngine.generateTextNumber(pattern, count, direction);
      case 'text':
        return FillSeriesEngine.generateText(pattern, count);
    }
  }

  /**
   * 检查所有源值是否匹配同一预定义序列
   * @returns 匹配的序列定义，未匹配返回 null
   */
  private static matchKnownSequence(values: string[]): KnownSequence | null {
    for (const seq of KNOWN_SEQUENCES) {
      if (values.every((v) => seq.pattern.test(v.trim()))) {
        return seq;
      }
    }
    return null;
  }

  /**
   * 检查所有源值是否为带数字后缀的文本模式
   * 匹配格式：前缀文本 + 数字 + 可选后缀文本（如"Item1"、"第1季度"）
   * 注意：排除纯数字和日期格式，避免误匹配
   * @returns 匹配的 FillPattern，未匹配返回 null
   */
  private static matchTextNumber(values: string[]): FillPattern | null {
    // 如果所有值都是数字或日期，不应匹配 textNumber
    if (FillSeriesEngine.isAllNumbers(values) || FillSeriesEngine.isAllDates(values)) {
      return null;
    }

    const regex = /^(.+?)(\d+)(.*)$/;
    const matches = values.map((v) => v.trim().match(regex));

    // 所有值都必须匹配
    if (matches.some((m) => m === null)) {
      return null;
    }

    // 所有值的前缀和后缀必须一致
    const prefix = matches[0]![1];
    const suffix = matches[0]![3];
    if (!matches.every((m) => m![1] === prefix && m![3] === suffix)) {
      return null;
    }

    // 计算数字步长
    const nums = matches.map((m) => parseInt(m![2], 10));
    let step = 1;
    if (nums.length >= 2) {
      const firstDiff = nums[1] - nums[0];
      const isConstant = nums.every((_, i) => {
        if (i === 0) return true;
        return nums[i] - nums[i - 1] === firstDiff;
      });
      step = isConstant ? firstDiff : 1;
    }

    return {
      type: 'textNumber',
      step,
      values,
      textPrefix: prefix,
      textSuffix: suffix,
    };
  }

  /**
   * 生成预定义序列填充数据
   * 从序列中找到最后一个（或第一个）源值的位置，按步长循环生成
   * - down/right：从最后一个源值位置向后循环
   * - up/left：从第一个源值位置向前循环（逆序）
   */
  private static generateSequence(
    pattern: FillPattern,
    count: number,
    direction: FillDirection
  ): string[] {
    const seqValues = pattern.sequenceValues!;
    const seqLen = seqValues.length;
    const result: string[] = [];

    if (direction === 'down' || direction === 'right') {
      // 找到最后一个源值在序列中的位置
      const lastValue = pattern.values[pattern.values.length - 1].trim();
      const lastIndex = seqValues.indexOf(lastValue);
      if (lastIndex === -1) return FillSeriesEngine.generateText(pattern, count);

      for (let i = 1; i <= count; i++) {
        const idx = (lastIndex + i) % seqLen;
        result.push(seqValues[idx]);
      }
    } else {
      // up/left：从第一个源值位置向前循环
      const firstValue = pattern.values[0].trim();
      const firstIndex = seqValues.indexOf(firstValue);
      if (firstIndex === -1) return FillSeriesEngine.generateText(pattern, count);

      for (let i = 1; i <= count; i++) {
        const idx = ((firstIndex - i) % seqLen + seqLen) % seqLen;
        result.push(seqValues[idx]);
      }
      // 反转使得离源数据最近的值在数组末尾
      result.reverse();
    }

    return result;
  }

  /**
   * 生成文本+数字递增填充数据
   * 保持文本前缀/后缀不变，数字部分按步长递增或递减
   * - down/right：从最后一个源值的数字部分递增
   * - up/left：从第一个源值的数字部分递减
   */
  private static generateTextNumber(
    pattern: FillPattern,
    count: number,
    direction: FillDirection
  ): string[] {
    const { step, values, textPrefix, textSuffix } = pattern;
    const regex = /^(.+?)(\d+)(.*)$/;
    const result: string[] = [];

    if (direction === 'down' || direction === 'right') {
      const lastMatch = values[values.length - 1].trim().match(regex);
      if (!lastMatch) return [];
      const lastNum = parseInt(lastMatch[2], 10);

      for (let i = 1; i <= count; i++) {
        result.push(`${textPrefix}${lastNum + step * i}${textSuffix}`);
      }
    } else {
      // up/left：从第一个值的数字部分递减
      const firstMatch = values[0].trim().match(regex);
      if (!firstMatch) return [];
      const firstNum = parseInt(firstMatch[2], 10);

      for (let i = 1; i <= count; i++) {
        result.push(`${textPrefix}${firstNum - step * i}${textSuffix}`);
      }
      // 反转使得离源数据最近的值在数组末尾
      result.reverse();
    }

    return result;
  }

  /** 判断所有值是否都是有效数字 */
  private static isAllNumbers(values: string[]): boolean {
    return values.every((v) => {
      const trimmed = v.trim();
      return trimmed !== '' && !isNaN(Number(trimmed)) && isFinite(Number(trimmed));
    });
  }

  /** 判断所有值是否都是有效日期 */
  private static isAllDates(values: string[]): boolean {
    return values.every((v) => tryParseDate(v) !== null);
  }

  /**
   * 计算数字序列的步长
   * - 单个数字：步长为 1
   * - 两个及以上：如果差值恒定则为该差值，否则为 1
   */
  private static calcNumberStep(nums: number[]): number {
    if (nums.length === 1) {
      return 1;
    }

    const firstDiff = nums[1] - nums[0];
    const isConstant = nums.every((_, i) => {
      if (i === 0) return true;
      return nums[i] - nums[i - 1] === firstDiff;
    });

    return isConstant ? firstDiff : 1;
  }

  /**
   * 计算日期序列的步长和单位
   * 优先检测按月/按年递增，最后回退到按天
   * - 单个日期：步长为 1 天
   * - 两个及以上：检测月/年/天间隔
   */
  private static calcDateStep(values: string[]): { step: number; unit: 'day' | 'month' | 'year' } {
    if (values.length === 1) {
      return { step: 1, unit: 'day' };
    }

    const dates = values.map((v) => tryParseDate(v)!.date);

    // 尝试按年检测
    if (dates.length >= 2) {
      const firstYearDiff = yearsBetween(dates[0], dates[1]);
      if (firstYearDiff !== null && firstYearDiff !== 0) {
        const allYearConsistent = dates.every((_, i) => {
          if (i === 0) return true;
          const diff = yearsBetween(dates[i - 1], dates[i]);
          return diff === firstYearDiff;
        });
        if (allYearConsistent) {
          return { step: firstYearDiff, unit: 'year' };
        }
      }
    }

    // 尝试按月检测
    if (dates.length >= 2) {
      const firstMonthDiff = monthsBetween(dates[0], dates[1]);
      if (firstMonthDiff !== null && firstMonthDiff !== 0) {
        const allMonthConsistent = dates.every((_, i) => {
          if (i === 0) return true;
          const diff = monthsBetween(dates[i - 1], dates[i]);
          return diff === firstMonthDiff;
        });
        if (allMonthConsistent) {
          return { step: firstMonthDiff, unit: 'month' };
        }
      }
    }

    // 回退到按天
    const firstDiff = daysBetween(dates[0], dates[1]);
    const isConstant = dates.every((_, i) => {
      if (i === 0) return true;
      return daysBetween(dates[i - 1], dates[i]) === firstDiff;
    });

    return { step: isConstant ? firstDiff : 1, unit: 'day' };
  }

  /**
   * 生成数字填充序列
   * - down/right：从最后一个值开始递增
   * - up/left：从第一个值开始递减
   */
  private static generateNumbers(
    pattern: FillPattern,
    count: number,
    direction: FillDirection
  ): string[] {
    const { step, values } = pattern;
    const result: string[] = [];

    if (direction === 'down' || direction === 'right') {
      const lastValue = Number(values[values.length - 1]);
      for (let i = 1; i <= count; i++) {
        result.push(String(lastValue + step * i));
      }
    } else {
      // up/left：从第一个值开始递减
      const firstValue = Number(values[0]);
      for (let i = 1; i <= count; i++) {
        result.push(String(firstValue - step * i));
      }
      // 反转使得离源数据最近的值在数组末尾
      result.reverse();
    }

    return result;
  }

  /**
   * 生成日期填充序列
   * 支持按天、按月、按年递增
   * - down/right：从最后一个日期开始递增
   * - up/left：从第一个日期开始递减
   */
  private static generateDates(
    pattern: FillPattern,
    count: number,
    direction: FillDirection
  ): string[] {
    const { step, values, dateUnit = 'day' } = pattern;
    const result: string[] = [];

    // 使用第一个值的格式作为输出格式
    const formatInfo = tryParseDate(values[0]);
    if (!formatInfo) return [];
    const { formatFn } = formatInfo;

    /** 根据单位增加日期 */
    const addDate = (base: Date, amount: number): Date => {
      switch (dateUnit) {
        case 'month': return addMonths(base, amount);
        case 'year': return addYears(base, amount);
        default: return addDays(base, amount);
      }
    };

    if (direction === 'down' || direction === 'right') {
      const lastDateInfo = tryParseDate(values[values.length - 1]);
      if (!lastDateInfo) return [];
      const baseDate = lastDateInfo.date;

      for (let i = 1; i <= count; i++) {
        const newDate = addDate(baseDate, step * i);
        result.push(formatFn(newDate));
      }
    } else {
      // up/left：从第一个日期开始递减
      const firstDateInfo = tryParseDate(values[0]);
      if (!firstDateInfo) return [];
      const baseDate = firstDateInfo.date;

      for (let i = 1; i <= count; i++) {
        const newDate = addDate(baseDate, -step * i);
        result.push(formatFn(newDate));
      }
      // 反转使得离源数据最近的值在数组末尾
      result.reverse();
    }

    return result;
  }

  /**
   * 生成文本填充序列（循环复制源值）
   */
  private static generateText(pattern: FillPattern, count: number): string[] {
    const { values } = pattern;
    const result: string[] = [];

    for (let i = 0; i < count; i++) {
      result.push(values[i % values.length]);
    }

    return result;
  }
}
