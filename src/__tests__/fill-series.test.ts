import { describe, it, expect } from 'vitest';
import { FillSeriesEngine } from '../fill-series';

describe('FillSeriesEngine', () => {
  describe('inferPattern', () => {
    it('空数组返回文本复制模式', () => {
      const pattern = FillSeriesEngine.inferPattern([]);
      expect(pattern.type).toBe('text');
      expect(pattern.step).toBe(0);
      expect(pattern.values).toEqual([]);
    });

    it('单个数字推断为数字模式，步长为 1', () => {
      const pattern = FillSeriesEngine.inferPattern(['5']);
      expect(pattern.type).toBe('number');
      expect(pattern.step).toBe(1);
    });

    it('两个数字等差推断步长', () => {
      const pattern = FillSeriesEngine.inferPattern(['2', '4']);
      expect(pattern.type).toBe('number');
      expect(pattern.step).toBe(2);
    });

    it('多个数字等差推断步长', () => {
      const pattern = FillSeriesEngine.inferPattern(['1', '3', '5', '7']);
      expect(pattern.type).toBe('number');
      expect(pattern.step).toBe(2);
    });

    it('非等差数字序列步长为 1', () => {
      const pattern = FillSeriesEngine.inferPattern(['1', '3', '8']);
      expect(pattern.type).toBe('number');
      expect(pattern.step).toBe(1);
    });

    it('负数步长', () => {
      const pattern = FillSeriesEngine.inferPattern(['10', '7', '4']);
      expect(pattern.type).toBe('number');
      expect(pattern.step).toBe(-3);
    });

    it('单个日期推断为日期模式，步长为 1 天', () => {
      const pattern = FillSeriesEngine.inferPattern(['2024-01-15']);
      expect(pattern.type).toBe('date');
      expect(pattern.step).toBe(1);
    });

    it('两个日期推断间隔天数', () => {
      const pattern = FillSeriesEngine.inferPattern(['2024-01-01', '2024-01-08']);
      expect(pattern.type).toBe('date');
      expect(pattern.step).toBe(7);
    });

    it('yyyy/MM/dd 格式日期', () => {
      const pattern = FillSeriesEngine.inferPattern(['2024/03/01', '2024/03/04']);
      expect(pattern.type).toBe('date');
      expect(pattern.step).toBe(3);
    });

    it('MM/dd/yyyy 格式日期', () => {
      const pattern = FillSeriesEngine.inferPattern(['01/10/2024', '01/15/2024']);
      expect(pattern.type).toBe('date');
      expect(pattern.step).toBe(5);
    });

    it('非等间隔日期步长为 1', () => {
      const pattern = FillSeriesEngine.inferPattern(['2024-01-01', '2024-01-03', '2024-01-10']);
      expect(pattern.type).toBe('date');
      expect(pattern.step).toBe(1);
    });

    it('纯文本推断为文本复制模式', () => {
      const pattern = FillSeriesEngine.inferPattern(['hello', 'world']);
      expect(pattern.type).toBe('text');
      expect(pattern.step).toBe(0);
      expect(pattern.values).toEqual(['hello', 'world']);
    });

    it('混合内容推断为文本复制模式', () => {
      const pattern = FillSeriesEngine.inferPattern(['1', 'abc', '3']);
      expect(pattern.type).toBe('text');
    });
  });

  describe('generate', () => {
    it('count 为 0 返回空数组', () => {
      const pattern = FillSeriesEngine.inferPattern(['1', '2', '3']);
      expect(FillSeriesEngine.generate(pattern, 0, 'down')).toEqual([]);
    });

    it('空 values 返回空数组', () => {
      const pattern = { type: 'number' as const, step: 1, values: [] };
      expect(FillSeriesEngine.generate(pattern, 5, 'down')).toEqual([]);
    });

    // 数字填充
    it('数字向下填充', () => {
      const pattern = FillSeriesEngine.inferPattern(['1', '2', '3']);
      const result = FillSeriesEngine.generate(pattern, 3, 'down');
      expect(result).toEqual(['4', '5', '6']);
    });

    it('数字向右填充', () => {
      const pattern = FillSeriesEngine.inferPattern(['10', '20']);
      const result = FillSeriesEngine.generate(pattern, 2, 'right');
      expect(result).toEqual(['30', '40']);
    });

    it('数字向上填充', () => {
      const pattern = FillSeriesEngine.inferPattern(['3', '4', '5']);
      const result = FillSeriesEngine.generate(pattern, 3, 'up');
      // 从第一个值 3 开始递减：2, 1, 0，反转后为 [0, 1, 2]
      expect(result).toEqual(['0', '1', '2']);
    });

    it('数字向左填充', () => {
      const pattern = FillSeriesEngine.inferPattern(['5', '10']);
      const result = FillSeriesEngine.generate(pattern, 2, 'left');
      // 从第一个值 5 开始递减步长 5：0, -5，反转后为 [-5, 0]
      expect(result).toEqual(['-5', '0']);
    });

    it('单个数字向下填充步长为 1', () => {
      const pattern = FillSeriesEngine.inferPattern(['7']);
      const result = FillSeriesEngine.generate(pattern, 3, 'down');
      expect(result).toEqual(['8', '9', '10']);
    });

    // 日期填充
    it('日期向下填充', () => {
      const pattern = FillSeriesEngine.inferPattern(['2024-01-01', '2024-01-03']);
      const result = FillSeriesEngine.generate(pattern, 3, 'down');
      expect(result).toEqual(['2024-01-05', '2024-01-07', '2024-01-09']);
    });

    it('日期向上填充', () => {
      const pattern = FillSeriesEngine.inferPattern(['2024-01-10', '2024-01-15']);
      const result = FillSeriesEngine.generate(pattern, 2, 'up');
      // 从第一个日期 01-10 递减步长 5：12-31, 01-05，反转后为 [12-31, 01-05]
      expect(result).toEqual(['2023-12-31', '2024-01-05']);
    });

    it('日期保持输入格式', () => {
      const pattern = FillSeriesEngine.inferPattern(['2024/06/01']);
      const result = FillSeriesEngine.generate(pattern, 2, 'down');
      expect(result).toEqual(['2024/06/02', '2024/06/03']);
    });

    // 文本填充
    it('文本循环复制', () => {
      const pattern = FillSeriesEngine.inferPattern(['A', 'B', 'C']);
      const result = FillSeriesEngine.generate(pattern, 5, 'down');
      expect(result).toEqual(['A', 'B', 'C', 'A', 'B']);
    });

    it('单个文本重复', () => {
      const pattern = FillSeriesEngine.inferPattern(['hello']);
      const result = FillSeriesEngine.generate(pattern, 3, 'down');
      expect(result).toEqual(['hello', 'hello', 'hello']);
    });
  });
});
