import { describe, it, expect } from 'vitest';
import { DataTypeDetector } from '../type-detector';

describe('DataTypeDetector', () => {
  // ========== 纯数字检测 ==========
  describe('纯数字检测', () => {
    it('"1234" → number', () => {
      const result = DataTypeDetector.detect('1234');
      expect(result.dataType).toBe('number');
      expect(result.rawValue).toBe(1234);
    });

    it('"-56.78" → number', () => {
      const result = DataTypeDetector.detect('-56.78');
      expect(result.dataType).toBe('number');
      expect(result.rawValue).toBe(-56.78);
    });

    it('"0" → number', () => {
      const result = DataTypeDetector.detect('0');
      expect(result.dataType).toBe('number');
      expect(result.rawValue).toBe(0);
    });

    it('"1,234,567" → number（带千分位）', () => {
      const result = DataTypeDetector.detect('1,234,567');
      expect(result.dataType).toBe('number');
      expect(result.rawValue).toBe(1234567);
    });

    it('"1,234.56" → number（千分位+小数）', () => {
      const result = DataTypeDetector.detect('1,234.56');
      expect(result.dataType).toBe('number');
      expect(result.rawValue).toBe(1234.56);
    });

    it('数字格式包含 category 和 pattern', () => {
      const result = DataTypeDetector.detect('1234');
      expect(result.format).toBeDefined();
      expect(result.format!.category).toBe('number');
    });
  });

  // ========== 百分比检测 ==========
  describe('百分比检测', () => {
    it('"12%" → percentage，rawValue=0.12', () => {
      const result = DataTypeDetector.detect('12%');
      expect(result.dataType).toBe('percentage');
      expect(result.rawValue).toBeCloseTo(0.12);
    });

    it('"-3.5%" → percentage，rawValue=-0.035', () => {
      const result = DataTypeDetector.detect('-3.5%');
      expect(result.dataType).toBe('percentage');
      expect(result.rawValue).toBeCloseTo(-0.035);
    });

    it('"100%" → percentage，rawValue=1', () => {
      const result = DataTypeDetector.detect('100%');
      expect(result.dataType).toBe('percentage');
      expect(result.rawValue).toBe(1);
    });

    it('百分比格式包含 category=percentage', () => {
      const result = DataTypeDetector.detect('50%');
      expect(result.format).toBeDefined();
      expect(result.format!.category).toBe('percentage');
    });
  });

  // ========== 货币检测 ==========
  describe('货币检测', () => {
    it('"¥100" → currency', () => {
      const result = DataTypeDetector.detect('¥100');
      expect(result.dataType).toBe('currency');
      expect(result.rawValue).toBe(100);
    });

    it('"$50.00" → currency', () => {
      const result = DataTypeDetector.detect('$50.00');
      expect(result.dataType).toBe('currency');
      expect(result.rawValue).toBe(50);
    });

    it('"€1,234.56" → currency', () => {
      const result = DataTypeDetector.detect('€1,234.56');
      expect(result.dataType).toBe('currency');
      expect(result.rawValue).toBe(1234.56);
    });

    it('货币格式包含 currencySymbol', () => {
      const result = DataTypeDetector.detect('¥100');
      expect(result.format).toBeDefined();
      expect(result.format!.currencySymbol).toBe('¥');
    });
  });

  // ========== 日期检测 ==========
  describe('日期检测', () => {
    it('"2024-01-15" → date', () => {
      const result = DataTypeDetector.detect('2024-01-15');
      expect(result.dataType).toBe('date');
      expect(result.rawValue).toBeDefined();
      const date = new Date(result.rawValue!);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
    });

    it('"2024/01/15" → date', () => {
      const result = DataTypeDetector.detect('2024/01/15');
      expect(result.dataType).toBe('date');
    });

    it('日期格式包含 category=date', () => {
      const result = DataTypeDetector.detect('2024-01-15');
      expect(result.format).toBeDefined();
      expect(result.format!.category).toBe('date');
    });
  });

  // ========== 文本检测 ==========
  describe('文本检测', () => {
    it('"hello" → text', () => {
      const result = DataTypeDetector.detect('hello');
      expect(result.dataType).toBe('text');
    });

    it('"你好世界" → text', () => {
      const result = DataTypeDetector.detect('你好世界');
      expect(result.dataType).toBe('text');
    });

    it('文本类型无 rawValue', () => {
      const result = DataTypeDetector.detect('hello');
      expect(result.rawValue).toBeUndefined();
    });

    it('文本类型无 format', () => {
      const result = DataTypeDetector.detect('hello');
      expect(result.format).toBeUndefined();
    });
  });

  // ========== 空字符串和公式前缀 ==========
  describe('空字符串和公式前缀', () => {
    it('空字符串 → text', () => {
      const result = DataTypeDetector.detect('');
      expect(result.dataType).toBe('text');
    });

    it('"=SUM(A1:A10)" → text（公式前缀跳过）', () => {
      const result = DataTypeDetector.detect('=SUM(A1:A10)');
      expect(result.dataType).toBe('text');
    });

    it('"=1+2" → text（公式前缀跳过）', () => {
      const result = DataTypeDetector.detect('=1+2');
      expect(result.dataType).toBe('text');
    });
  });

  // ========== 优先级测试 ==========
  describe('检测优先级', () => {
    it('百分比优先于纯数字（"12%" 不会被识别为数字）', () => {
      const result = DataTypeDetector.detect('12%');
      expect(result.dataType).toBe('percentage');
    });

    it('货币优先于纯数字（"¥100" 不会被识别为数字）', () => {
      const result = DataTypeDetector.detect('¥100');
      expect(result.dataType).toBe('currency');
    });
  });
});
