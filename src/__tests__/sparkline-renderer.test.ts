import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SparklineRenderer } from '../chart/sparkline-renderer';
import type { SparklineConfig, ThemeColors } from '../chart/types';

// 默认主题色
const defaultTheme: ThemeColors = {
  background: '#ffffff',
  foreground: '#000000',
  gridLine: '#e0e0e0',
  chartColors: ['#4285F4', '#EA4335', '#FBBC04', '#34A853'],
};

/**
 * 创建模拟的 CanvasRenderingContext2D，记录所有绘制调用
 */
function createMockCtx(): CanvasRenderingContext2D {
  return {
    canvas: { width: 800, height: 600 },
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    set fillStyle(_v: string) { /* 忽略 */ },
    set strokeStyle(_v: string) { /* 忽略 */ },
    set lineWidth(_v: number) { /* 忽略 */ },
    set lineJoin(_v: string) { /* 忽略 */ },
    set font(_v: string) { /* 忽略 */ },
    set textAlign(_v: string) { /* 忽略 */ },
    set textBaseline(_v: string) { /* 忽略 */ },
  } as unknown as CanvasRenderingContext2D;
}

describe('SparklineRenderer', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  // ========== 空数据处理 ==========

  describe('空数据处理', () => {
    it('空数据数组不进行任何绘制', () => {
      const config: SparklineConfig = {
        type: 'line',
        dataRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 5 },
      };
      SparklineRenderer.render(ctx, config, [], 0, 0, 100, 30, defaultTheme);
      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.beginPath).not.toHaveBeenCalled();
    });
  });

  // ========== 折线迷你图 ==========

  describe('折线迷你图 (line)', () => {
    const lineConfig: SparklineConfig = {
      type: 'line',
      dataRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 4 },
    };

    it('绘制折线连接所有数据点', () => {
      SparklineRenderer.render(ctx, lineConfig, [1, 3, 2, 5, 4], 0, 0, 100, 30, defaultTheme);
      // 应调用 moveTo 一次（起点）和 lineTo 四次（后续点）
      expect(ctx.moveTo).toHaveBeenCalledTimes(1);
      expect(ctx.lineTo).toHaveBeenCalledTimes(4);
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('单个数据点绘制在中心', () => {
      SparklineRenderer.render(ctx, lineConfig, [42], 0, 0, 100, 30, defaultTheme);
      expect(ctx.moveTo).toHaveBeenCalledTimes(1);
      // 单点时 X 在中心：0 + 2 + (100 - 4) / 2 = 50
      expect(ctx.lineTo).not.toHaveBeenCalled();
    });

    it('所有值相同时绘制水平线', () => {
      SparklineRenderer.render(ctx, lineConfig, [5, 5, 5], 0, 0, 100, 30, defaultTheme);
      expect(ctx.moveTo).toHaveBeenCalledTimes(1);
      expect(ctx.lineTo).toHaveBeenCalledTimes(2);
      // 所有 Y 坐标应相同（中间位置）
      const moveCall = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
      const lineCall1 = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls[0];
      const lineCall2 = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(moveCall[1]).toBe(lineCall1[1]);
      expect(moveCall[1]).toBe(lineCall2[1]);
    });

    it('highlightMax 为 true 时绘制红色最大值标记', () => {
      const config: SparklineConfig = {
        ...lineConfig,
        highlightMax: true,
      };
      SparklineRenderer.render(ctx, config, [1, 5, 3], 0, 0, 100, 30, defaultTheme);
      // arc 应被调用一次（最大值标记）
      expect(ctx.arc).toHaveBeenCalledTimes(1);
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('highlightMin 为 true 时绘制蓝色最小值标记', () => {
      const config: SparklineConfig = {
        ...lineConfig,
        highlightMin: true,
      };
      SparklineRenderer.render(ctx, config, [3, 1, 5], 0, 0, 100, 30, defaultTheme);
      expect(ctx.arc).toHaveBeenCalledTimes(1);
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('同时高亮最大值和最小值时绘制两个标记', () => {
      const config: SparklineConfig = {
        ...lineConfig,
        highlightMax: true,
        highlightMin: true,
      };
      SparklineRenderer.render(ctx, config, [1, 5, 3], 0, 0, 100, 30, defaultTheme);
      expect(ctx.arc).toHaveBeenCalledTimes(2);
      expect(ctx.fill).toHaveBeenCalledTimes(2);
    });

    it('使用自定义颜色覆盖主题色', () => {
      const config: SparklineConfig = {
        ...lineConfig,
        color: '#FF0000',
      };
      // 不抛异常即可，颜色通过 setter 设置
      SparklineRenderer.render(ctx, config, [1, 2, 3], 0, 0, 100, 30, defaultTheme);
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  // ========== 柱状迷你图 ==========

  describe('柱状迷你图 (bar)', () => {
    const barConfig: SparklineConfig = {
      type: 'bar',
      dataRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 4 },
    };

    it('为每个数据点绘制一根柱子', () => {
      SparklineRenderer.render(ctx, barConfig, [1, 2, 3, 4, 5], 0, 0, 100, 30, defaultTheme);
      expect(ctx.fillRect).toHaveBeenCalledTimes(5);
    });

    it('正值柱子向上绘制', () => {
      SparklineRenderer.render(ctx, barConfig, [3], 0, 0, 100, 30, defaultTheme);
      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    });

    it('混合正负值时正值向上负值向下', () => {
      SparklineRenderer.render(ctx, barConfig, [3, -2, 1, -4], 0, 0, 100, 30, defaultTheme);
      expect(ctx.fillRect).toHaveBeenCalledTimes(4);
    });

    it('全部为零时绘制细线', () => {
      SparklineRenderer.render(ctx, barConfig, [0, 0, 0], 0, 0, 100, 30, defaultTheme);
      expect(ctx.fillRect).toHaveBeenCalledTimes(3);
    });
  });

  // ========== 盈亏迷你图 ==========

  describe('盈亏迷你图 (winLoss)', () => {
    const winLossConfig: SparklineConfig = {
      type: 'winLoss',
      dataRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 4 },
    };

    it('正值绘制上方色块', () => {
      SparklineRenderer.render(ctx, winLossConfig, [1, 2, 3], 0, 0, 100, 30, defaultTheme);
      expect(ctx.fillRect).toHaveBeenCalledTimes(3);
    });

    it('负值绘制下方色块', () => {
      SparklineRenderer.render(ctx, winLossConfig, [-1, -2, -3], 0, 0, 100, 30, defaultTheme);
      expect(ctx.fillRect).toHaveBeenCalledTimes(3);
    });

    it('零值不绘制色块', () => {
      SparklineRenderer.render(ctx, winLossConfig, [0, 0, 0], 0, 0, 100, 30, defaultTheme);
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('混合正负零值正确绘制', () => {
      SparklineRenderer.render(ctx, winLossConfig, [1, -1, 0, 2, -3], 0, 0, 100, 30, defaultTheme);
      // 正值 2 个 + 负值 2 个 = 4 个色块（零值跳过）
      expect(ctx.fillRect).toHaveBeenCalledTimes(4);
    });
  });

  // ========== 边界情况 ==========

  describe('边界情况', () => {
    it('宽度过小（<= 4px 内边距）时不绘制', () => {
      const config: SparklineConfig = {
        type: 'line',
        dataRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 2 },
      };
      SparklineRenderer.render(ctx, config, [1, 2, 3], 0, 0, 4, 30, defaultTheme);
      expect(ctx.save).not.toHaveBeenCalled();
    });

    it('高度过小（<= 4px 内边距）时不绘制', () => {
      const config: SparklineConfig = {
        type: 'bar',
        dataRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 2 },
      };
      SparklineRenderer.render(ctx, config, [1, 2, 3], 0, 0, 100, 4, defaultTheme);
      expect(ctx.save).not.toHaveBeenCalled();
    });

    it('保留 2px 内边距', () => {
      const config: SparklineConfig = {
        type: 'line',
        dataRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 1 },
      };
      SparklineRenderer.render(ctx, config, [1, 5], 10, 20, 100, 30, defaultTheme);
      // moveTo 的 X 坐标应从 10 + 2 = 12 开始
      const moveCall = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(moveCall[0]).toBe(12); // x + PADDING
    });
  });
});
