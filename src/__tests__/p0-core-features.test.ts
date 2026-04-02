import { describe, it, expect } from 'vitest';
import { FillSeriesEngine } from '../fill-series';

/**
 * P0 核心功能自动化测试
 * 覆盖：拖拽填充智能序列、状态栏统计计算逻辑
 */

// ============================================================
// 辅助函数：模拟状态栏统计计算逻辑
// 与 app.ts 中 computeSelectionStats() 的核心算法一致
// ============================================================

interface SelectionStats {
  sum: number;
  average: number;
  count: number;
  min: number;
  max: number;
  totalCells: number;
}

/**
 * 从单元格值数组中计算统计信息
 * 模拟 SpreadsheetApp.computeSelectionStats() 的核心逻辑
 */
function computeStats(cellValues: Array<{ content: string; rawValue?: number }>): SelectionStats | null {
  if (cellValues.length <= 1) return null;

  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const cell of cellValues) {
    let numValue: number | undefined;

    // 优先使用 rawValue
    if (cell.rawValue !== undefined && cell.rawValue !== null) {
      numValue = cell.rawValue;
    } else if (cell.content !== '' && cell.content !== undefined) {
      const parsed = Number(cell.content);
      if (!isNaN(parsed) && cell.content.trim() !== '') {
        numValue = parsed;
      }
    }

    if (numValue !== undefined && isFinite(numValue)) {
      sum += numValue;
      count++;
      if (numValue < min) min = numValue;
      if (numValue > max) max = numValue;
    }
  }

  if (count === 0) return null;

  return {
    sum,
    average: sum / count,
    count,
    min,
    max,
    totalCells: cellValues.length,
  };
}

// ============================================================
// 1. 拖拽填充智能序列 - 补充边界测试
// ============================================================

describe('拖拽填充智能序列 - 边界场景', () => {
  describe('序列循环完整性', () => {
    it('星期序列填充 7 个值应包含完整一周', () => {
      const pattern = FillSeriesEngine.inferPattern(['星期一']);
      const result = FillSeriesEngine.generate(pattern, 7, 'down');
      expect(result).toEqual(['星期二', '星期三', '星期四', '星期五', '星期六', '星期日', '星期一']);
    });

    it('月份序列填充 12 个值应包含完整一年', () => {
      const pattern = FillSeriesEngine.inferPattern(['一月']);
      const result = FillSeriesEngine.generate(pattern, 12, 'down');
      expect(result[0]).toBe('二月');
      expect(result[11]).toBe('一月');
      // 验证每个月份恰好出现一次
      const unique = new Set(result);
      expect(unique.size).toBe(12);
    });

    it('季度序列填充 8 个值应循环两次', () => {
      const pattern = FillSeriesEngine.inferPattern(['Q1']);
      const result = FillSeriesEngine.generate(pattern, 8, 'down');
      expect(result).toEqual(['Q2', 'Q3', 'Q4', 'Q1', 'Q2', 'Q3', 'Q4', 'Q1']);
    });
  });

  describe('逆向填充对称性', () => {
    it('从周三向右 3 个 + 向左 3 个应覆盖完整一周', () => {
      const patternRight = FillSeriesEngine.inferPattern(['周三']);
      const right = FillSeriesEngine.generate(patternRight, 3, 'right');

      const patternLeft = FillSeriesEngine.inferPattern(['周三']);
      const left = FillSeriesEngine.generate(patternLeft, 3, 'left');

      // 合并：left + 源值 + right
      const all = [...left, '周三', ...right];
      expect(all.length).toBe(7);
      // 应包含所有星期
      const weekdays = new Set(['周一', '周二', '周三', '周四', '周五', '周六', '周日']);
      expect(new Set(all)).toEqual(weekdays);
    });
  });

  describe('textNumber 边界', () => {
    it('单个 textNumber 值步长为 1', () => {
      const pattern = FillSeriesEngine.inferPattern(['Item5']);
      expect(pattern.type).toBe('textNumber');
      expect(pattern.step).toBe(1);
      const result = FillSeriesEngine.generate(pattern, 3, 'down');
      expect(result).toEqual(['Item6', 'Item7', 'Item8']);
    });

    it('textNumber 递减到负数', () => {
      const pattern = FillSeriesEngine.inferPattern(['Item2']);
      const result = FillSeriesEngine.generate(pattern, 5, 'up');
      // 从 Item2 向上递减：Item1, Item0, Item-1, Item-2, Item-3
      // 反转后：[Item-3, Item-2, Item-1, Item0, Item1]
      expect(result).toEqual(['Item-3', 'Item-2', 'Item-1', 'Item0', 'Item1']);
    });

    it('中文前缀+数字+中文后缀', () => {
      const pattern = FillSeriesEngine.inferPattern(['第1课', '第2课', '第3课']);
      expect(pattern.type).toBe('textNumber');
      expect(pattern.textPrefix).toBe('第');
      expect(pattern.textSuffix).toBe('课');
      const result = FillSeriesEngine.generate(pattern, 2, 'down');
      expect(result).toEqual(['第4课', '第5课']);
    });
  });

  describe('大量填充', () => {
    it('数字填充 1000 个值', () => {
      const pattern = FillSeriesEngine.inferPattern(['1', '2']);
      const result = FillSeriesEngine.generate(pattern, 1000, 'down');
      expect(result.length).toBe(1000);
      expect(result[0]).toBe('3');
      expect(result[999]).toBe('1002');
    });

    it('序列填充 100 个值应正确循环', () => {
      const pattern = FillSeriesEngine.inferPattern(['Q1']);
      const result = FillSeriesEngine.generate(pattern, 100, 'down');
      expect(result.length).toBe(100);
      // 每 4 个一循环：Q2, Q3, Q4, Q1, Q2, ...
      expect(result[0]).toBe('Q2');
      expect(result[3]).toBe('Q1');
      // 索引 99: (1 + 99) % 4 = 0 → Q1
      expect(result[99]).toBe('Q1');
    });
  });
});

// ============================================================
// 2. 状态栏统计计算
// ============================================================

describe('状态栏统计计算', () => {
  describe('基本统计', () => {
    it('纯数值单元格计算正确', () => {
      const cells = [
        { content: '10' },
        { content: '20' },
        { content: '30' },
      ];
      const stats = computeStats(cells);
      expect(stats).not.toBeNull();
      expect(stats!.sum).toBe(60);
      expect(stats!.average).toBe(20);
      expect(stats!.count).toBe(3);
      expect(stats!.min).toBe(10);
      expect(stats!.max).toBe(30);
    });

    it('包含小数的统计', () => {
      const cells = [
        { content: '1.5' },
        { content: '2.5' },
        { content: '3.0' },
      ];
      const stats = computeStats(cells);
      expect(stats!.sum).toBe(7);
      expect(stats!.average).toBeCloseTo(7 / 3);
      expect(stats!.min).toBe(1.5);
      expect(stats!.max).toBe(3.0);
    });

    it('包含负数的统计', () => {
      const cells = [
        { content: '-10' },
        { content: '5' },
        { content: '15' },
      ];
      const stats = computeStats(cells);
      expect(stats!.sum).toBe(10);
      expect(stats!.average).toBeCloseTo(10 / 3);
      expect(stats!.min).toBe(-10);
      expect(stats!.max).toBe(15);
    });
  });

  describe('rawValue 优先级', () => {
    it('rawValue 优先于 content 解析', () => {
      const cells = [
        { content: '¥100.00', rawValue: 100 },
        { content: '¥200.00', rawValue: 200 },
      ];
      const stats = computeStats(cells);
      expect(stats!.sum).toBe(300);
      expect(stats!.count).toBe(2);
    });

    it('rawValue 为 0 时应被统计', () => {
      const cells = [
        { content: '0', rawValue: 0 },
        { content: '10', rawValue: 10 },
      ];
      const stats = computeStats(cells);
      expect(stats!.sum).toBe(10);
      expect(stats!.count).toBe(2);
      expect(stats!.min).toBe(0);
    });
  });

  describe('非数值过滤', () => {
    it('忽略空单元格', () => {
      const cells = [
        { content: '' },
        { content: '10' },
        { content: '' },
        { content: '20' },
      ];
      const stats = computeStats(cells);
      expect(stats!.count).toBe(2);
      expect(stats!.sum).toBe(30);
    });

    it('忽略纯文本单元格', () => {
      const cells = [
        { content: 'hello' },
        { content: '10' },
        { content: 'world' },
        { content: '20' },
      ];
      const stats = computeStats(cells);
      expect(stats!.count).toBe(2);
      expect(stats!.sum).toBe(30);
    });

    it('全部为文本时返回 null', () => {
      const cells = [
        { content: 'hello' },
        { content: 'world' },
      ];
      const stats = computeStats(cells);
      expect(stats).toBeNull();
    });

    it('全部为空时返回 null', () => {
      const cells = [
        { content: '' },
        { content: '' },
      ];
      const stats = computeStats(cells);
      expect(stats).toBeNull();
    });
  });

  describe('边界情况', () => {
    it('单个单元格返回 null（不显示统计）', () => {
      const cells = [{ content: '42' }];
      const stats = computeStats(cells);
      expect(stats).toBeNull();
    });

    it('两个单元格应显示统计', () => {
      const cells = [
        { content: '10' },
        { content: '20' },
      ];
      const stats = computeStats(cells);
      expect(stats).not.toBeNull();
      expect(stats!.sum).toBe(30);
      expect(stats!.average).toBe(15);
    });

    it('所有值相同时 min === max', () => {
      const cells = [
        { content: '5' },
        { content: '5' },
        { content: '5' },
      ];
      const stats = computeStats(cells);
      expect(stats!.min).toBe(5);
      expect(stats!.max).toBe(5);
      expect(stats!.average).toBe(5);
    });

    it('大数值不溢出', () => {
      const cells = [
        { content: '999999999999' },
        { content: '1' },
      ];
      const stats = computeStats(cells);
      expect(stats!.sum).toBe(1000000000000);
    });
  });

  describe('与标准数学库一致性', () => {
    it('随机数值统计与 reduce/Math 计算一致', () => {
      // 生成固定的"随机"数值
      const values = [3.14, -2.71, 100, 0, -50, 42.5, 7.77, 99.99, -0.01, 1000];
      const cells = values.map((v) => ({ content: String(v) }));

      const stats = computeStats(cells);

      // 标准计算
      const expectedSum = values.reduce((a, b) => a + b, 0);
      const expectedAvg = expectedSum / values.length;
      const expectedMin = Math.min(...values);
      const expectedMax = Math.max(...values);

      expect(stats!.sum).toBeCloseTo(expectedSum, 10);
      expect(stats!.average).toBeCloseTo(expectedAvg, 10);
      expect(stats!.count).toBe(values.length);
      expect(stats!.min).toBe(expectedMin);
      expect(stats!.max).toBe(expectedMax);
    });
  });
});
