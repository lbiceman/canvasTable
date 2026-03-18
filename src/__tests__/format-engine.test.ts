import { describe, it, expect } from 'vitest';
import { NumberFormatter } from '../format-engine';

describe('NumberFormatter', () => {
  // ========== format() 方法 ==========
  describe('format()', () => {
    // --- 千分位格式 ---
    it('千分位格式 #,##0：整数', () => {
      expect(NumberFormatter.format(1234567, '#,##0')).toBe('1,234,567');
    });

    it('千分位格式 #,##0：小数被四舍五入', () => {
      expect(NumberFormatter.format(1234.56, '#,##0')).toBe('1,235');
    });

    it('千分位格式 #,##0：零', () => {
      expect(NumberFormatter.format(0, '#,##0')).toBe('0');
    });

    it('千分位格式 #,##0：负数', () => {
      expect(NumberFormatter.format(-9876, '#,##0')).toBe('-9,876');
    });

    // --- 小数格式 ---
    it('小数格式 #,##0.00：保留两位小数', () => {
      expect(NumberFormatter.format(1234.5, '#,##0.00')).toBe('1,234.50');
    });

    it('小数格式 #,##0.00：整数补零', () => {
      expect(NumberFormatter.format(100, '#,##0.00')).toBe('100.00');
    });

    it('小数格式 0.00：小数值', () => {
      expect(NumberFormatter.format(0.5, '0.00')).toBe('0.50');
    });

    // --- 百分比格式 ---
    it('百分比格式 0.00%：小数转百分比', () => {
      expect(NumberFormatter.format(0.12, '0.00%')).toBe('12.00%');
    });

    it('百分比格式 0.00%：零', () => {
      expect(NumberFormatter.format(0, '0.00%')).toBe('0.00%');
    });

    it('百分比格式 0.00%：负数', () => {
      expect(NumberFormatter.format(-0.05, '0.00%')).toBe('-5.00%');
    });

    it('百分比格式 0%：无小数', () => {
      expect(NumberFormatter.format(0.75, '0%')).toBe('75%');
    });

    // --- 科学计数法格式 ---
    it('科学计数法 0.00E+0：正数', () => {
      expect(NumberFormatter.format(12345, '0.00E+0')).toBe('1.23E+4');
    });

    it('科学计数法 0.00E+0：小数', () => {
      expect(NumberFormatter.format(0.00123, '0.00E+0')).toBe('1.23E-3');
    });

    it('科学计数法 0.00E+0：负数', () => {
      expect(NumberFormatter.format(-5678, '0.00E+0')).toBe('-5.68E+3');
    });

    it('科学计数法 0.00E+0：零', () => {
      expect(NumberFormatter.format(0, '0.00E+0')).toBe('0.00E+0');
    });

    // --- 边界情况 ---
    it('NaN 返回 "NaN"', () => {
      expect(NumberFormatter.format(NaN, '#,##0')).toBe('NaN');
    });

    it('Infinity 返回 "Infinity"', () => {
      expect(NumberFormatter.format(Infinity, '#,##0')).toBe('Infinity');
    });

    it('-Infinity 返回 "-Infinity"', () => {
      expect(NumberFormatter.format(-Infinity, '#,##0')).toBe('-Infinity');
    });

    it('极大数正确格式化', () => {
      expect(NumberFormatter.format(1000000000, '#,##0')).toBe('1,000,000,000');
    });

    it('极小正数正确格式化', () => {
      expect(NumberFormatter.format(0.001, '0.000')).toBe('0.001');
    });

    it('负零显示为 0', () => {
      expect(NumberFormatter.format(-0, '#,##0')).toBe('0');
    });
  });

  // ========== parse() 方法 ==========
  describe('parse()', () => {
    it('解析千分位格式字符串', () => {
      expect(NumberFormatter.parse('1,234,567', '#,##0')).toBe(1234567);
    });

    it('解析小数格式字符串', () => {
      expect(NumberFormatter.parse('1,234.50', '#,##0.00')).toBe(1234.5);
    });

    it('解析百分比格式字符串', () => {
      expect(NumberFormatter.parse('12.00%', '0.00%')).toBeCloseTo(0.12);
    });

    it('解析科学计数法字符串', () => {
      expect(NumberFormatter.parse('1.23E+4', '0.00E+0')).toBe(12300);
    });

    it('空字符串返回 null', () => {
      expect(NumberFormatter.parse('', '#,##0')).toBeNull();
    });

    it('非数值字符串返回 null', () => {
      expect(NumberFormatter.parse('abc', '#,##0')).toBeNull();
    });

    it('解析货币格式字符串', () => {
      expect(NumberFormatter.parse('¥1,234.56', '¥#,##0.00')).toBe(1234.56);
    });
  });

  // ========== formatCurrency() ==========
  describe('formatCurrency()', () => {
    it('默认人民币符号 ¥', () => {
      expect(NumberFormatter.formatCurrency(1234.56)).toBe('¥1,234.56');
    });

    it('自定义美元符号 $', () => {
      expect(NumberFormatter.formatCurrency(50, '$')).toBe('$50.00');
    });

    it('零值', () => {
      expect(NumberFormatter.formatCurrency(0)).toBe('¥0.00');
    });

    it('负数', () => {
      expect(NumberFormatter.formatCurrency(-99.9)).toBe('¥-99.90');
    });
  });

  // ========== formatPercentage() ==========
  describe('formatPercentage()', () => {
    it('小数转百分比显示', () => {
      expect(NumberFormatter.formatPercentage(0.12)).toBe('12.00%');
    });

    it('零值', () => {
      expect(NumberFormatter.formatPercentage(0)).toBe('0.00%');
    });

    it('100%', () => {
      expect(NumberFormatter.formatPercentage(1)).toBe('100.00%');
    });

    it('自定义小数位数', () => {
      expect(NumberFormatter.formatPercentage(0.1234, 1)).toBe('12.3%');
    });
  });

  // ========== formatThousands() ==========
  describe('formatThousands()', () => {
    it('整数千分位', () => {
      expect(NumberFormatter.formatThousands(1234567)).toBe('1,234,567');
    });

    it('带小数位', () => {
      expect(NumberFormatter.formatThousands(1234.5, 2)).toBe('1,234.50');
    });
  });

  // ========== formatScientific() ==========
  describe('formatScientific()', () => {
    it('正数科学计数法', () => {
      expect(NumberFormatter.formatScientific(12345)).toBe('1.23E+4');
    });

    it('小数科学计数法', () => {
      expect(NumberFormatter.formatScientific(0.00456)).toBe('4.56E-3');
    });

    it('自定义小数位数', () => {
      expect(NumberFormatter.formatScientific(12345, 1)).toBe('1.2E+4');
    });
  });

  // ========== 非数值输入保持原始文本 ==========
  describe('非数值输入', () => {
    it('NaN 保持原始文本', () => {
      expect(NumberFormatter.format(NaN, '0.00')).toBe('NaN');
    });

    it('Infinity 保持原始文本', () => {
      expect(NumberFormatter.format(Infinity, '0.00')).toBe('Infinity');
    });
  });
});
