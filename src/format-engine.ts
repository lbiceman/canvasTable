// ============================================================
// 格式化引擎 — 数字格式化器
// ============================================================

/**
 * 解析后的数字格式模式结构
 */
interface ParsedNumberPattern {
  prefix: string;           // 前缀（如 "¥"）
  suffix: string;           // 后缀（如 "%"）
  integerPart: string;      // 整数部分占位符（如 "#,##0"）
  decimalPart: string;      // 小数部分占位符（如 "00"）
  useThousands: boolean;    // 是否使用千分位分隔符
  isPercentage: boolean;    // 是否为百分比格式
  isScientific: boolean;    // 是否为科学计数法
  scientificDigits: number; // 科学计数法指数位数
}

/**
 * 数字格式化器
 * 支持 Excel 兼容的数字格式模式，包括千分位、百分比、货币、科学计数法等
 */
export class NumberFormatter {
  /**
   * 按格式模式格式化数值
   * @param value 数值
   * @param pattern 格式模式字符串，如 "#,##0.00"、"0.00%"、"¥#,##0.00"
   * @returns 格式化后的字符串
   */
  static format(value: number, pattern: string): string {
    // 非有效数值直接返回原始字符串
    if (!isFinite(value) || isNaN(value)) {
      return String(value);
    }

    const parsed = NumberFormatter.parsePattern(pattern);

    // 百分比模式：数值乘以 100
    let num = parsed.isPercentage ? value * 100 : value;

    // 科学计数法模式
    if (parsed.isScientific) {
      return NumberFormatter.formatScientificByPattern(num, parsed);
    }

    // 处理负数
    const isNegative = num < 0;
    num = Math.abs(num);

    // 确定小数位数
    const decimalDigits = parsed.decimalPart.length;

    // 四舍五入到指定小数位
    const rounded = NumberFormatter.roundToDecimals(num, decimalDigits);

    // 拆分整数和小数部分
    const [intStr, decStr] = NumberFormatter.splitNumber(rounded, decimalDigits);

    // 格式化整数部分
    const formattedInt = NumberFormatter.formatIntegerPart(intStr, parsed.integerPart, parsed.useThousands);

    // 格式化小数部分
    const formattedDec = NumberFormatter.formatDecimalPart(decStr, parsed.decimalPart);

    // 拼接结果
    let result = formattedInt;
    if (formattedDec.length > 0) {
      result += '.' + formattedDec;
    }

    // 添加负号
    if (isNegative && rounded !== 0) {
      result = '-' + result;
    }

    // 拼接前缀和后缀
    return parsed.prefix + result + parsed.suffix;
  }

  /**
   * 将格式化字符串解析回数值
   * @param text 格式化后的字符串
   * @param pattern 格式模式字符串
   * @returns 解析后的数值，无法解析时返回 null
   */
  static parse(text: string, pattern: string): number | null {
    if (text === '' || text === null || text === undefined) {
      return null;
    }

    const parsed = NumberFormatter.parsePattern(pattern);

    // 移除前缀和后缀
    let cleaned = text;
    if (parsed.prefix && cleaned.startsWith(parsed.prefix)) {
      cleaned = cleaned.slice(parsed.prefix.length);
    }
    if (parsed.suffix && cleaned.endsWith(parsed.suffix)) {
      cleaned = cleaned.slice(0, -parsed.suffix.length);
    }

    // 处理科学计数法
    if (parsed.isScientific) {
      // 匹配科学计数法格式：数字E+数字 或 数字E-数字
      const sciMatch = cleaned.match(/^(-?\d+\.?\d*)[Ee]([+-]?\d+)$/);
      if (!sciMatch) {
        return null;
      }
      const result = parseFloat(cleaned);
      return isNaN(result) ? null : result;
    }

    // 移除千分位分隔符
    cleaned = cleaned.replace(/,/g, '');

    // 尝试解析为数值
    const num = parseFloat(cleaned);
    if (isNaN(num)) {
      return null;
    }

    // 百分比模式：数值除以 100
    if (parsed.isPercentage) {
      return num / 100;
    }

    return num;
  }

  /**
   * 货币格式化快捷方法
   * @param value 数值
   * @param symbol 货币符号，默认 "¥"
   * @returns 格式化后的货币字符串，如 "¥1,234.56"
   */
  static formatCurrency(value: number, symbol: string = '¥'): string {
    return NumberFormatter.format(value, `${symbol}#,##0.00`);
  }

  /**
   * 百分比格式化快捷方法
   * @param value 数值（小数形式，如 0.12 表示 12%）
   * @param decimals 小数位数，默认 2
   * @returns 格式化后的百分比字符串，如 "12.00%"
   */
  static formatPercentage(value: number, decimals: number = 2): string {
    const decimalPattern = decimals > 0 ? '.' + '0'.repeat(decimals) : '';
    return NumberFormatter.format(value, `0${decimalPattern}%`);
  }

  /**
   * 千分位格式化快捷方法
   * @param value 数值
   * @param decimals 小数位数，默认 0
   * @returns 格式化后的千分位字符串，如 "1,234,567"
   */
  static formatThousands(value: number, decimals: number = 0): string {
    const decimalPattern = decimals > 0 ? '.' + '0'.repeat(decimals) : '';
    return NumberFormatter.format(value, `#,##0${decimalPattern}`);
  }

  /**
   * 科学计数法格式化快捷方法
   * @param value 数值
   * @param decimals 小数位数，默认 2
   * @returns 格式化后的科学计数法字符串，如 "1.23E+4"
   */
  static formatScientific(value: number, decimals: number = 2): string {
    const decimalPattern = decimals > 0 ? '.' + '0'.repeat(decimals) : '';
    return NumberFormatter.format(value, `0${decimalPattern}E+0`);
  }

  // ============================================================
  // 私有辅助方法
  // ============================================================

  /**
   * 解析格式模式字符串为结构化对象
   */
  private static parsePattern(pattern: string): ParsedNumberPattern {
    let prefix = '';
    let suffix = '';
    let integerPart = '';
    let decimalPart = '';
    let useThousands = false;
    let isPercentage = false;
    let isScientific = false;
    let scientificDigits = 0;

    // 检测科学计数法模式
    const sciMatch = pattern.match(/^(.*?)([\d#0,]+(?:\.[\d#0]+)?)[Ee]\+([0#]+)(.*?)$/);
    if (sciMatch) {
      isScientific = true;
      prefix = sciMatch[1];
      const numPart = sciMatch[2];
      scientificDigits = sciMatch[3].length;
      suffix = sciMatch[4];

      // 解析数字部分
      const dotIndex = numPart.indexOf('.');
      if (dotIndex >= 0) {
        integerPart = numPart.slice(0, dotIndex);
        decimalPart = numPart.slice(dotIndex + 1);
      } else {
        integerPart = numPart;
      }

      return { prefix, suffix, integerPart, decimalPart, useThousands, isPercentage, isScientific, scientificDigits };
    }

    // 检测百分比后缀
    if (pattern.endsWith('%')) {
      isPercentage = true;
      suffix = '%';
      pattern = pattern.slice(0, -1);
    }

    // 提取前缀：从开头到第一个格式字符（#、0、.）
    let formatStart = -1;
    for (let i = 0; i < pattern.length; i++) {
      if ('#0.,'.includes(pattern[i])) {
        formatStart = i;
        break;
      }
    }

    if (formatStart < 0) {
      // 没有格式字符，整个 pattern 作为前缀
      prefix = pattern;
      integerPart = '0';
      return { prefix, suffix, integerPart, decimalPart, useThousands, isPercentage, isScientific, scientificDigits };
    }

    prefix = pattern.slice(0, formatStart);

    // 提取后缀：从最后一个格式字符之后到末尾
    let formatEnd = -1;
    for (let i = pattern.length - 1; i >= formatStart; i--) {
      if ('#0.,'.includes(pattern[i])) {
        formatEnd = i;
        break;
      }
    }

    if (formatEnd < pattern.length - 1) {
      suffix = pattern.slice(formatEnd + 1) + suffix;
    }

    // 提取格式主体
    const formatBody = pattern.slice(formatStart, formatEnd + 1);

    // 检测千分位
    useThousands = formatBody.includes(',');

    // 按小数点分割
    const dotIndex = formatBody.indexOf('.');
    if (dotIndex >= 0) {
      integerPart = formatBody.slice(0, dotIndex).replace(/,/g, '');
      decimalPart = formatBody.slice(dotIndex + 1).replace(/,/g, '');
    } else {
      integerPart = formatBody.replace(/,/g, '');
    }

    // 确保整数部分至少有一个占位符
    if (integerPart.length === 0) {
      integerPart = '0';
    }

    return { prefix, suffix, integerPart, decimalPart, useThousands, isPercentage, isScientific, scientificDigits };
  }


  /**
   * 将数值四舍五入到指定小数位数
   */
  private static roundToDecimals(value: number, decimals: number): number {
    if (decimals <= 0) {
      return Math.round(value);
    }
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * 将数值拆分为整数字符串和小数字符串
   */
  private static splitNumber(value: number, decimalDigits: number): [string, string] {
    if (decimalDigits <= 0) {
      return [String(Math.round(value)), ''];
    }

    // 使用 toFixed 确保精确的小数位数
    const fixed = value.toFixed(decimalDigits);
    const dotIndex = fixed.indexOf('.');
    if (dotIndex < 0) {
      return [fixed, ''];
    }
    return [fixed.slice(0, dotIndex), fixed.slice(dotIndex + 1)];
  }

  /**
   * 按占位符规则格式化整数部分
   * - '0' 占位符：必填数字位，不足时补零
   * - '#' 占位符：可选数字位，不足时不显示
   */
  private static formatIntegerPart(intStr: string, intPattern: string, useThousands: boolean): string {
    // 确保整数部分至少满足 '0' 占位符的最小位数
    const minDigits = (intPattern.match(/0/g) || []).length;
    let digits = intStr;

    // 补零到最小位数
    while (digits.length < minDigits) {
      digits = '0' + digits;
    }

    // 插入千分位分隔符
    if (useThousands && digits.length > 3) {
      const parts: string[] = [];
      let count = 0;
      for (let i = digits.length - 1; i >= 0; i--) {
        parts.unshift(digits[i]);
        count++;
        if (count % 3 === 0 && i > 0) {
          parts.unshift(',');
        }
      }
      digits = parts.join('');
    }

    return digits;
  }

  /**
   * 按占位符规则格式化小数部分
   * - '0' 占位符：必填数字位，不足时补零
   * - '#' 占位符：可选数字位，末尾零可省略
   */
  private static formatDecimalPart(decStr: string, decPattern: string): string {
    if (decPattern.length === 0) {
      return '';
    }

    // 确保小数字符串长度与模式一致
    let result = decStr;
    while (result.length < decPattern.length) {
      result += '0';
    }

    // 从右向左移除 '#' 占位符对应的末尾零
    let trimEnd = result.length;
    for (let i = decPattern.length - 1; i >= 0; i--) {
      if (decPattern[i] === '#' && trimEnd > 0 && result[trimEnd - 1] === '0') {
        trimEnd--;
      } else {
        break;
      }
    }

    return result.slice(0, trimEnd);
  }

  /**
   * 按科学计数法模式格式化数值
   */
  private static formatScientificByPattern(value: number, parsed: ParsedNumberPattern): string {
    const isNegative = value < 0;
    let absValue = Math.abs(value);

    // 计算指数
    let exponent = 0;
    if (absValue !== 0) {
      exponent = Math.floor(Math.log10(absValue));
      absValue = absValue / Math.pow(10, exponent);
    }

    // 格式化尾数部分
    const decimalDigits = parsed.decimalPart.length;
    const rounded = NumberFormatter.roundToDecimals(absValue, decimalDigits);

    // 处理四舍五入后尾数进位的情况（如 9.999 → 10.00）
    let mantissa = rounded;
    if (mantissa >= 10) {
      mantissa = mantissa / 10;
      exponent += 1;
    }

    const [intStr, decStr] = NumberFormatter.splitNumber(mantissa, decimalDigits);

    let result = intStr;
    if (decStr.length > 0) {
      const formattedDec = NumberFormatter.formatDecimalPart(decStr, parsed.decimalPart);
      if (formattedDec.length > 0) {
        result += '.' + formattedDec;
      }
    }

    // 格式化指数部分
    const expSign = exponent >= 0 ? '+' : '-';
    let expStr = String(Math.abs(exponent));
    while (expStr.length < parsed.scientificDigits) {
      expStr = '0' + expStr;
    }

    if (isNegative && rounded !== 0) {
      result = '-' + result;
    }

    return `${parsed.prefix}${result}E${expSign}${expStr}${parsed.suffix}`;
  }
}


// ============================================================
// 格式化引擎 — 日期格式化器
// ============================================================

/**
 * 日期格式化器
 * 支持常见日期/时间格式模式，包括中文日期、12小时制等
 *
 * 支持的占位符：
 * - yyyy: 四位年份
 * - MM: 两位月份（01-12）
 * - dd: 两位日期（01-31）
 * - HH: 24小时制小时（00-23）
 * - mm: 分钟（00-59）
 * - ss: 秒（00-59）
 * - hh: 12小时制小时（01-12）
 * - A: 上午/下午标记（AM/PM）
 */
export class DateFormatter {
  /**
   * 按格式模式格式化日期
   * @param timestamp Unix 时间戳毫秒数
   * @param pattern 格式模式字符串，如 "yyyy-MM-dd"、"HH:mm:ss"
   * @returns 格式化后的日期字符串
   */
  static format(timestamp: number, pattern: string): string {
    if (!isFinite(timestamp) || isNaN(timestamp)) {
      return String(timestamp);
    }

    const date = new Date(timestamp);

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours24 = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    // 12小时制转换
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const ampm = hours24 < 12 ? 'AM' : 'PM';

    // 补零辅助函数
    const pad = (n: number): string => n < 10 ? `0${n}` : String(n);

    // 按占位符替换（注意替换顺序：先替换长占位符，避免部分匹配）
    let result = pattern;
    result = result.replace(/yyyy/g, String(year));
    result = result.replace(/MM/g, pad(month));
    result = result.replace(/dd/g, pad(day));
    // 先替换 hh（12小时制），再替换 HH（24小时制），避免冲突
    // 使用临时标记避免 hh 和 HH 互相干扰
    result = result.replace(/HH/g, '\x00H');
    result = result.replace(/hh/g, '\x00h');
    result = result.replace(/\x00H/g, pad(hours24));
    result = result.replace(/\x00h/g, pad(hours12));
    result = result.replace(/mm/g, pad(minutes));
    result = result.replace(/ss/g, pad(seconds));
    result = result.replace(/A/g, ampm);

    return result;
  }

  /**
   * 将日期字符串按指定格式模式解析为时间戳
   * @param text 日期字符串
   * @param pattern 格式模式字符串
   * @returns Unix 时间戳毫秒数，无法解析时返回 null
   */
  static parse(text: string, pattern: string): number | null {
    if (!text || !pattern) {
      return null;
    }

    // 将 pattern 转换为正则表达式，提取各部分的值
    const tokenMap: Record<string, string> = {
      'yyyy': '(?<year>\\d{4})',
      'MM': '(?<month>\\d{2})',
      'dd': '(?<day>\\d{2})',
      'HH': '(?<hours24>\\d{2})',
      'hh': '(?<hours12>\\d{2})',
      'mm': '(?<minutes>\\d{2})',
      'ss': '(?<seconds>\\d{2})',
      'A': '(?<ampm>AM|PM)',
    };

    // 按 token 长度降序排列，确保长 token 优先匹配
    const tokens = Object.keys(tokenMap).sort((a, b) => b.length - a.length);

    let regexStr = DateFormatter.escapeRegex(pattern);
    for (const token of tokens) {
      regexStr = regexStr.replace(DateFormatter.escapeRegex(token), tokenMap[token]);
    }

    const regex = new RegExp(`^${regexStr}$`);
    const match = text.match(regex);
    if (!match || !match.groups) {
      return null;
    }

    const groups = match.groups;
    const year = groups['year'] ? parseInt(groups['year'], 10) : 1970;
    const month = groups['month'] ? parseInt(groups['month'], 10) : 1;
    const day = groups['day'] ? parseInt(groups['day'], 10) : 1;
    let hours = 0;
    const minutes = groups['minutes'] ? parseInt(groups['minutes'], 10) : 0;
    const seconds = groups['seconds'] ? parseInt(groups['seconds'], 10) : 0;

    // 处理小时
    if (groups['hours24'] !== undefined) {
      hours = parseInt(groups['hours24'], 10);
    } else if (groups['hours12'] !== undefined) {
      hours = parseInt(groups['hours12'], 10);
      const ampm = groups['ampm'];
      if (ampm === 'PM' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }
    }

    // 验证日期各部分的有效性
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    if (hours < 0 || hours > 23) return null;
    if (minutes < 0 || minutes > 59) return null;
    if (seconds < 0 || seconds > 59) return null;

    // 进一步验证日期有效性（如2月30日等）
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date.getTime();
  }

  /**
   * 尝试多种日期模式自动解析文本
   * @param text 日期字符串
   * @returns Unix 时间戳毫秒数，无法解析时返回 null
   */
  static autoParse(text: string): number | null {
    if (!text || text.trim() === '') {
      return null;
    }

    const trimmed = text.trim();

    // 按优先级尝试的日期模式列表
    const patterns: string[] = [
      'yyyy-MM-dd HH:mm:ss',
      'yyyy-MM-dd',
      'yyyy/MM/dd',
      'yyyy年MM月dd日',
      'MM/dd/yyyy',
      'dd/MM/yyyy',
    ];

    for (const pattern of patterns) {
      const result = DateFormatter.parse(trimmed, pattern);
      if (result !== null) {
        return result;
      }
    }

    return null;
  }

  // ============================================================
  // 私有辅助方法
  // ============================================================

  /**
   * 转义正则表达式特殊字符
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
