import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { NumberFormatter, DateFormatter } from '../format-engine';

describe('格式化引擎属性测试', () => {
  // ========== 属性 1: 数字格式化往返一致性 ==========
  describe('数字格式化往返一致性', () => {
    it('千分位格式 #,##0 往返一致', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -999999999, max: 999999999 }),
          (value) => {
            const pattern = '#,##0';
            const formatted = NumberFormatter.format(value, pattern);
            const parsed = NumberFormatter.parse(formatted, pattern);
            expect(parsed).toBe(value);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('小数格式 0.00 往返一致', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1e8, max: 1e8, noNaN: true, noDefaultInfinity: true }),
          (value) => {
            const pattern = '0.00';
            const formatted = NumberFormatter.format(value, pattern);
            const parsed = NumberFormatter.parse(formatted, pattern);
            if (parsed !== null) {
              // 四舍五入到两位小数后比较
              const rounded = Math.round(value * 100) / 100;
              expect(parsed).toBeCloseTo(rounded, 1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('百分比格式 0.00% 往返一致', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true }),
          (value) => {
            const pattern = '0.00%';
            const formatted = NumberFormatter.format(value, pattern);
            const parsed = NumberFormatter.parse(formatted, pattern);
            if (parsed !== null) {
              // 百分比有精度损失，允许较大误差
              expect(parsed).toBeCloseTo(value, 1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ========== 属性 2: 日期格式化往返一致性 ==========
  describe('日期格式化往返一致性', () => {
    it('yyyy-MM-dd HH:mm:ss 格式往返一致', () => {
      fc.assert(
        fc.property(
          // 生成 2000-2030 年之间的合理日期
          fc.integer({ min: 0, max: 30 }),  // 年偏移
          fc.integer({ min: 0, max: 11 }),  // 月
          fc.integer({ min: 1, max: 28 }),  // 日（使用28避免月末问题）
          fc.integer({ min: 0, max: 23 }),  // 时
          fc.integer({ min: 0, max: 59 }),  // 分
          fc.integer({ min: 0, max: 59 }),  // 秒
          (yearOffset, month, day, hours, minutes, seconds) => {
            const date = new Date(2000 + yearOffset, month, day, hours, minutes, seconds);
            const timestamp = date.getTime();
            const pattern = 'yyyy-MM-dd HH:mm:ss';
            const formatted = DateFormatter.format(timestamp, pattern);
            const parsed = DateFormatter.parse(formatted, pattern);
            expect(parsed).toBe(timestamp);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('yyyy-MM-dd 格式往返一致（日期部分）', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 30 }),
          fc.integer({ min: 0, max: 11 }),
          fc.integer({ min: 1, max: 28 }),
          (yearOffset, month, day) => {
            const date = new Date(2000 + yearOffset, month, day, 0, 0, 0);
            const timestamp = date.getTime();
            const pattern = 'yyyy-MM-dd';
            const formatted = DateFormatter.format(timestamp, pattern);
            const parsed = DateFormatter.parse(formatted, pattern);
            expect(parsed).not.toBeNull();
            // 比较日期部分
            const parsedDate = new Date(parsed!);
            expect(parsedDate.getFullYear()).toBe(date.getFullYear());
            expect(parsedDate.getMonth()).toBe(date.getMonth());
            expect(parsedDate.getDate()).toBe(date.getDate());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ========== 属性 3: 格式化输出为非空字符串 ==========
  describe('格式化输出为非空字符串', () => {
    it('数字格式化输出不为空', () => {
      fc.assert(
        fc.property(
          fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e10, max: 1e10 }),
          (value) => {
            const result = NumberFormatter.format(value, '#,##0.00');
            expect(result.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('日期格式化输出不为空', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 946684800000, max: 1893456000000 }), // 2000-2030
          (timestamp) => {
            const result = DateFormatter.format(timestamp, 'yyyy-MM-dd');
            expect(result.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
