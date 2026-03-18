import { describe, it, expect } from 'vitest';
import { DateFormatter } from '../format-engine';

describe('DateFormatter', () => {
  // 创建固定日期用于测试：2024-01-15 14:30:45
  const testDate = new Date(2024, 0, 15, 14, 30, 45);
  const testTimestamp = testDate.getTime();

  // 上午时间：2024-03-20 09:05:30
  const morningDate = new Date(2024, 2, 20, 9, 5, 30);
  const morningTimestamp = morningDate.getTime();

  // ========== format() 方法 ==========
  describe('format()', () => {
    it('yyyy-MM-dd 格式', () => {
      expect(DateFormatter.format(testTimestamp, 'yyyy-MM-dd')).toBe('2024-01-15');
    });

    it('yyyy/MM/dd 格式', () => {
      expect(DateFormatter.format(testTimestamp, 'yyyy/MM/dd')).toBe('2024/01/15');
    });

    it('yyyy年MM月dd日 格式', () => {
      expect(DateFormatter.format(testTimestamp, 'yyyy年MM月dd日')).toBe('2024年01月15日');
    });

    it('HH:mm:ss 24小时制', () => {
      expect(DateFormatter.format(testTimestamp, 'HH:mm:ss')).toBe('14:30:45');
    });

    it('hh:mm:ss A 12小时制（下午）', () => {
      expect(DateFormatter.format(testTimestamp, 'hh:mm:ss A')).toBe('02:30:45 PM');
    });

    it('hh:mm:ss A 12小时制（上午）', () => {
      expect(DateFormatter.format(morningTimestamp, 'hh:mm:ss A')).toBe('09:05:30 AM');
    });

    it('日期时间组合格式 yyyy-MM-dd HH:mm:ss', () => {
      expect(DateFormatter.format(testTimestamp, 'yyyy-MM-dd HH:mm:ss')).toBe('2024-01-15 14:30:45');
    });

    it('NaN 返回 "NaN"', () => {
      expect(DateFormatter.format(NaN, 'yyyy-MM-dd')).toBe('NaN');
    });

    it('Infinity 返回 "Infinity"', () => {
      expect(DateFormatter.format(Infinity, 'yyyy-MM-dd')).toBe('Infinity');
    });
  });

  // ========== parse() 方法 ==========
  describe('parse()', () => {
    it('解析 yyyy-MM-dd 格式', () => {
      const result = DateFormatter.parse('2024-01-15', 'yyyy-MM-dd');
      expect(result).not.toBeNull();
      const date = new Date(result!);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
    });

    it('解析 yyyy/MM/dd 格式', () => {
      const result = DateFormatter.parse('2024/01/15', 'yyyy/MM/dd');
      expect(result).not.toBeNull();
      const date = new Date(result!);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
    });

    it('解析 yyyy年MM月dd日 格式', () => {
      const result = DateFormatter.parse('2024年01月15日', 'yyyy年MM月dd日');
      expect(result).not.toBeNull();
      const date = new Date(result!);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getDate()).toBe(15);
    });

    it('解析 yyyy-MM-dd HH:mm:ss 格式', () => {
      const result = DateFormatter.parse('2024-01-15 14:30:45', 'yyyy-MM-dd HH:mm:ss');
      expect(result).not.toBeNull();
      const date = new Date(result!);
      expect(date.getHours()).toBe(14);
      expect(date.getMinutes()).toBe(30);
      expect(date.getSeconds()).toBe(45);
    });

    it('解析 hh:mm:ss A 12小时制', () => {
      const result = DateFormatter.parse('02:30:45 PM', 'hh:mm:ss A');
      expect(result).not.toBeNull();
      const date = new Date(result!);
      expect(date.getHours()).toBe(14);
    });

    it('无法解析的日期文本返回 null', () => {
      expect(DateFormatter.parse('not-a-date', 'yyyy-MM-dd')).toBeNull();
    });

    it('空字符串返回 null', () => {
      expect(DateFormatter.parse('', 'yyyy-MM-dd')).toBeNull();
    });

    it('无效日期（2月30日）返回 null', () => {
      expect(DateFormatter.parse('2024-02-30', 'yyyy-MM-dd')).toBeNull();
    });

    it('无效月份（13月）返回 null', () => {
      expect(DateFormatter.parse('2024-13-01', 'yyyy-MM-dd')).toBeNull();
    });
  });

  // ========== autoParse() 方法 ==========
  describe('autoParse()', () => {
    it('自动识别 yyyy-MM-dd 格式', () => {
      const result = DateFormatter.autoParse('2024-01-15');
      expect(result).not.toBeNull();
      const date = new Date(result!);
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
    });

    it('自动识别 yyyy/MM/dd 格式', () => {
      const result = DateFormatter.autoParse('2024/01/15');
      expect(result).not.toBeNull();
    });

    it('自动识别 yyyy年MM月dd日 格式', () => {
      const result = DateFormatter.autoParse('2024年01月15日');
      expect(result).not.toBeNull();
    });

    it('自动识别 yyyy-MM-dd HH:mm:ss 格式', () => {
      const result = DateFormatter.autoParse('2024-01-15 14:30:45');
      expect(result).not.toBeNull();
      const date = new Date(result!);
      expect(date.getHours()).toBe(14);
    });

    it('无法识别的文本返回 null', () => {
      expect(DateFormatter.autoParse('hello world')).toBeNull();
    });

    it('空字符串返回 null', () => {
      expect(DateFormatter.autoParse('')).toBeNull();
    });

    it('纯数字不被识别为日期', () => {
      expect(DateFormatter.autoParse('12345')).toBeNull();
    });
  });

  // ========== format + parse 往返一致性 ==========
  describe('往返一致性', () => {
    it('yyyy-MM-dd 格式往返一致', () => {
      const pattern = 'yyyy-MM-dd';
      // 使用零时分秒的日期确保往返一致
      const date = new Date(2024, 5, 15, 0, 0, 0);
      const ts = date.getTime();
      const formatted = DateFormatter.format(ts, pattern);
      const parsed = DateFormatter.parse(formatted, pattern);
      expect(parsed).not.toBeNull();
      // 比较日期部分
      const parsedDate = new Date(parsed!);
      expect(parsedDate.getFullYear()).toBe(date.getFullYear());
      expect(parsedDate.getMonth()).toBe(date.getMonth());
      expect(parsedDate.getDate()).toBe(date.getDate());
    });

    it('yyyy-MM-dd HH:mm:ss 格式往返一致', () => {
      const pattern = 'yyyy-MM-dd HH:mm:ss';
      const formatted = DateFormatter.format(testTimestamp, pattern);
      const parsed = DateFormatter.parse(formatted, pattern);
      expect(parsed).toBe(testTimestamp);
    });
  });
});
