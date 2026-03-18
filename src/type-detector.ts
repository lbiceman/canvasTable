// ============================================================
// 数据类型检测器
// 自动识别用户输入内容的数据类型，按优先级依次检测
// ============================================================

import { DataType, CellFormat } from './types';
import { DateFormatter } from './format-engine';

/**
 * 类型检测结果
 */
export interface DetectionResult {
  dataType: DataType;
  rawValue?: number;
  format?: CellFormat;
}

// 百分比匹配正则：如 "12%"、"-3.5%"
const PERCENTAGE_REGEX = /^-?\d+(\.\d+)?%$/;

// 货币匹配正则：如 "¥100"、"$1,234.56"、"€ 99.99"
const CURRENCY_REGEX = /^([¥$€£])\s?-?\d+(,\d{3})*(\.\d+)?$/;

// 纯数字匹配正则：如 "1234"、"-56.78"、"1,234,567.89"
const NUMBER_REGEX = /^-?\d+(,\d{3})*(\.\d+)?$/;

/**
 * 数据类型检测器
 * 按优先级自动识别输入内容的数据类型：
 * 空字符串 → 公式 → 百分比 → 货币 → 日期 → 纯数字 → 文本
 */
export class DataTypeDetector {
  /**
   * 检测输入内容的数据类型
   * @param input 用户输入的原始字符串
   * @returns 检测结果，包含 dataType、rawValue、format
   */
  static detect(input: string): DetectionResult {
    // 1. 空字符串 → text
    if (input === '') {
      return { dataType: 'text' };
    }

    // 2. 公式前缀（以 = 开头）→ 跳过，返回 text
    if (input.startsWith('=')) {
      return { dataType: 'text' };
    }

    // 3. 百分比匹配
    if (PERCENTAGE_REGEX.test(input)) {
      // 去除 % 后缀，解析为小数值
      const numStr = input.slice(0, -1);
      const rawValue = parseFloat(numStr) / 100;
      return {
        dataType: 'percentage',
        rawValue,
        format: {
          category: 'percentage',
          pattern: '0.##%',
        },
      };
    }

    // 4. 货币匹配
    const currencyMatch = input.match(CURRENCY_REGEX);
    if (currencyMatch) {
      const symbol = currencyMatch[1];
      // 去除货币符号、空格和千分位分隔符，解析为纯数值
      const numStr = input.slice(symbol.length).trim().replace(/,/g, '');
      const rawValue = parseFloat(numStr);
      if (!isNaN(rawValue)) {
        return {
          dataType: 'currency',
          rawValue,
          format: {
            category: 'currency',
            pattern: `${symbol}#,##0.00`,
            currencySymbol: symbol,
          },
        };
      }
    }

    // 5. 日期匹配：尝试 DateFormatter.autoParse()
    const dateTimestamp = DateFormatter.autoParse(input);
    if (dateTimestamp !== null) {
      return {
        dataType: 'date',
        rawValue: dateTimestamp,
        format: {
          category: 'date',
          pattern: 'yyyy-MM-dd',
        },
      };
    }

    // 6. 纯数字匹配
    if (NUMBER_REGEX.test(input)) {
      // 去除千分位分隔符后解析
      const numStr = input.replace(/,/g, '');
      const rawValue = parseFloat(numStr);
      if (!isNaN(rawValue)) {
        return {
          dataType: 'number',
          rawValue,
          format: {
            category: 'number',
            pattern: '#,##0.##',
          },
        };
      }
    }

    // 7. 以上均不匹配 → text
    return { dataType: 'text' };
  }
}
