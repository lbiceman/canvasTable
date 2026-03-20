import type { FillPattern, FillDirection } from './types';

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
   * 1. 全部为数字 → 计算等差 → 数字递增/递减
   * 2. 全部为日期 → 计算日期间隔 → 日期递增/递减
   * 3. 其他 → 文本复制模式
   */
  public static inferPattern(values: string[]): FillPattern {
    // 空数组：返回文本复制模式
    if (values.length === 0) {
      return { type: 'text', step: 0, values: [] };
    }

    // 尝试数字模式
    if (FillSeriesEngine.isAllNumbers(values)) {
      const nums = values.map(Number);
      const step = FillSeriesEngine.calcNumberStep(nums);
      return { type: 'number', step, values };
    }

    // 尝试日期模式
    if (FillSeriesEngine.isAllDates(values)) {
      const step = FillSeriesEngine.calcDateStep(values);
      return { type: 'date', step, values };
    }

    // 文本复制模式
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
      case 'text':
        return FillSeriesEngine.generateText(pattern, count);
    }
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
   * 计算日期序列的步长（天数）
   * - 单个日期：步长为 1 天
   * - 两个及以上：如果间隔恒定则为该间隔，否则为 1 天
   */
  private static calcDateStep(values: string[]): number {
    if (values.length === 1) {
      return 1;
    }

    const dates = values.map((v) => tryParseDate(v)!.date);
    const firstDiff = daysBetween(dates[0], dates[1]);
    const isConstant = dates.every((_, i) => {
      if (i === 0) return true;
      return daysBetween(dates[i - 1], dates[i]) === firstDiff;
    });

    return isConstant ? firstDiff : 1;
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
   * - down/right：从最后一个日期开始递增
   * - up/left：从第一个日期开始递减
   */
  private static generateDates(
    pattern: FillPattern,
    count: number,
    direction: FillDirection
  ): string[] {
    const { step, values } = pattern;
    const result: string[] = [];

    // 使用第一个值的格式作为输出格式
    const formatInfo = tryParseDate(values[0]);
    if (!formatInfo) return [];
    const { formatFn } = formatInfo;

    if (direction === 'down' || direction === 'right') {
      const lastDateInfo = tryParseDate(values[values.length - 1]);
      if (!lastDateInfo) return [];
      const baseDate = lastDateInfo.date;

      for (let i = 1; i <= count; i++) {
        const newDate = addDays(baseDate, step * i);
        result.push(formatFn(newDate));
      }
    } else {
      // up/left：从第一个日期开始递减
      const firstDateInfo = tryParseDate(values[0]);
      if (!firstDateInfo) return [];
      const baseDate = firstDateInfo.date;

      for (let i = 1; i <= count; i++) {
        const newDate = addDays(baseDate, -step * i);
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
