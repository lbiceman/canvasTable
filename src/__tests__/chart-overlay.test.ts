import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import { ChartEngine } from '../chart/chart-engine';
import { ChartOverlay } from '../chart/chart-overlay';
import type { DataRange } from '../chart/types';

/**
 * 辅助函数：在 SpreadsheetModel 中填充数值数据
 */
function fillNumericData(
  model: SpreadsheetModel,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): void {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      model.setCellContent(r, c, String((r + 1) * 10 + c));
    }
  }
}

/**
 * 创建模拟的 CanvasRenderingContext2D
 */
function createMockCtx(): CanvasRenderingContext2D {
  const canvas = {
    width: 1200,
    height: 800,
  };
  return {
    canvas,
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
    translate: vi.fn(),
    rotate: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
    set fillStyle(_v: string) { /* 忽略 */ },
    set strokeStyle(_v: string) { /* 忽略 */ },
    set lineWidth(_v: number) { /* 忽略 */ },
    set font(_v: string) { /* 忽略 */ },
    set textAlign(_v: string) { /* 忽略 */ },
    set textBaseline(_v: string) { /* 忽略 */ },
  } as unknown as CanvasRenderingContext2D;
}

describe('ChartOverlay', () => {
  let spreadsheetModel: SpreadsheetModel;
  let chartModel: ChartModel;
  let chartEngine: ChartEngine;
  let overlay: ChartOverlay;
  let mockCtx: CanvasRenderingContext2D;
  const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };

  beforeEach(() => {
    spreadsheetModel = new SpreadsheetModel(20, 10);
    chartModel = new ChartModel(spreadsheetModel);
    mockCtx = createMockCtx();
    chartEngine = new ChartEngine(mockCtx);
    overlay = new ChartOverlay(chartModel, chartEngine);
    fillNumericData(spreadsheetModel, 0, 0, 3, 3);
  });

  // ========== hitTest ==========
  describe('hitTest', () => {
    it('点击图表区域内应返回图表 ID', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 });
      expect(id).not.toBeNull();

      const result = overlay.hitTest(200, 200);
      expect(result).not.toBeNull();
      expect(result!.chartId).toBe(id);
      expect(result!.handle).toBeNull();
    });

    it('点击图表区域外应返回 null', () => {
      chartModel.createChart('bar', dataRange, { x: 100, y: 100 });

      const result = overlay.hitTest(50, 50);
      expect(result).toBeNull();
    });

    it('选中图表后点击缩放手柄应返回手柄方向', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 })!;
      overlay.selectChart(id);

      // 点击左上角手柄 (nw)，位置在 (100, 100)
      const result = overlay.hitTest(100, 100);
      expect(result).not.toBeNull();
      expect(result!.chartId).toBe(id);
      expect(result!.handle).toBe('nw');
    });

    it('未选中图表时不应检测缩放手柄', () => {
      chartModel.createChart('bar', dataRange, { x: 100, y: 100 });

      // 点击左上角位置，应命中图表主体而非手柄
      const result = overlay.hitTest(100, 100);
      expect(result).not.toBeNull();
      expect(result!.handle).toBeNull();
    });

    it('多个图表重叠时应命中最后创建的图表', () => {
      const id1 = chartModel.createChart('bar', dataRange, { x: 100, y: 100 });
      const id2 = chartModel.createChart('line', dataRange, { x: 150, y: 150 });

      // 重叠区域应命中后创建的图表
      const result = overlay.hitTest(200, 200);
      expect(result).not.toBeNull();
      expect(result!.chartId).toBe(id2);
      expect(result!.chartId).not.toBe(id1);
    });
  });

  // ========== selectChart / deselectChart ==========
  describe('selectChart / deselectChart', () => {
    it('selectChart 应设置选中状态', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 })!;
      overlay.selectChart(id);
      expect(overlay.getSelectedChartId()).toBe(id);
    });

    it('deselectChart 应清除选中状态', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 })!;
      overlay.selectChart(id);
      overlay.deselectChart();
      expect(overlay.getSelectedChartId()).toBeNull();
    });
  });

  // ========== deleteSelectedChart ==========
  describe('deleteSelectedChart', () => {
    it('应删除选中的图表', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 })!;
      overlay.selectChart(id);
      overlay.deleteSelectedChart();

      expect(chartModel.getChart(id)).toBeNull();
      expect(overlay.getSelectedChartId()).toBeNull();
    });

    it('未选中图表时调用不应报错', () => {
      expect(() => overlay.deleteSelectedChart()).not.toThrow();
    });
  });

  // ========== handleMouseDown ==========
  describe('handleMouseDown', () => {
    it('点击图表应选中并返回 true', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 })!;

      const consumed = overlay.handleMouseDown(200, 200);
      expect(consumed).toBe(true);
      expect(overlay.getSelectedChartId()).toBe(id);
    });

    it('点击图表外部应取消选中并返回 false', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 })!;
      overlay.selectChart(id);

      const consumed = overlay.handleMouseDown(50, 50);
      expect(consumed).toBe(false);
      expect(overlay.getSelectedChartId()).toBeNull();
    });
  });

  // ========== 拖拽移动 ==========
  describe('拖拽移动', () => {
    it('拖拽应更新图表位置', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 })!;

      overlay.handleMouseDown(200, 200);
      overlay.handleMouseMove(250, 230);

      const chart = chartModel.getChart(id)!;
      expect(chart.position.x).toBe(150);
      expect(chart.position.y).toBe(130);
    });

    it('拖拽时位置不应小于 0', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 50, y: 50 })!;

      overlay.handleMouseDown(100, 100);
      // 向左上方大幅拖拽
      overlay.handleMouseMove(0, 0);

      const chart = chartModel.getChart(id)!;
      expect(chart.position.x).toBeGreaterThanOrEqual(0);
      expect(chart.position.y).toBeGreaterThanOrEqual(0);
    });

    it('handleMouseUp 应结束拖拽', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 })!;

      overlay.handleMouseDown(200, 200);
      overlay.handleMouseMove(250, 230);
      overlay.handleMouseUp();

      // 再次移动不应改变位置
      overlay.handleMouseMove(300, 300);
      const chart = chartModel.getChart(id)!;
      expect(chart.position.x).toBe(150);
      expect(chart.position.y).toBe(130);
    });
  });

  // ========== 缩放 ==========
  describe('缩放', () => {
    it('拖拽 se 手柄应增大图表尺寸', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 }, { width: 400, height: 300 })!;
      overlay.selectChart(id);

      // 点击 se 手柄位置 (500, 400)
      overlay.handleMouseDown(500, 400);
      overlay.handleMouseMove(550, 450);

      const chart = chartModel.getChart(id)!;
      expect(chart.size.width).toBe(450);
      expect(chart.size.height).toBe(350);
    });

    it('缩放不应小于最小尺寸 200×150', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 }, { width: 400, height: 300 })!;
      overlay.selectChart(id);

      // 点击 se 手柄并大幅向左上缩小
      overlay.handleMouseDown(500, 400);
      overlay.handleMouseMove(150, 150);

      const chart = chartModel.getChart(id)!;
      expect(chart.size.width).toBeGreaterThanOrEqual(200);
      expect(chart.size.height).toBeGreaterThanOrEqual(150);
    });

    it('从 nw 手柄缩放时应同时调整位置', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 }, { width: 400, height: 300 })!;
      overlay.selectChart(id);

      // 点击 nw 手柄位置 (100, 100)
      overlay.handleMouseDown(100, 100);
      overlay.handleMouseMove(150, 130);

      const chart = chartModel.getChart(id)!;
      // 位置应向右下移动
      expect(chart.position.x).toBe(150);
      expect(chart.position.y).toBe(130);
      // 尺寸应缩小
      expect(chart.size.width).toBe(350);
      expect(chart.size.height).toBe(270);
    });
  });

  // ========== handleMouseMove 光标样式 ==========
  describe('handleMouseMove 光标样式', () => {
    it('悬停在图表上应返回 move 光标', () => {
      chartModel.createChart('bar', dataRange, { x: 100, y: 100 });

      const cursor = overlay.handleMouseMove(200, 200);
      expect(cursor).toBe('move');
    });

    it('悬停在缩放手柄上应返回对应光标', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 }, { width: 400, height: 300 })!;
      overlay.selectChart(id);

      // 悬停在 se 手柄 (500, 400)
      const cursor = overlay.handleMouseMove(500, 400);
      expect(cursor).toBe('se-resize');
    });

    it('悬停在图表外部应返回 null', () => {
      chartModel.createChart('bar', dataRange, { x: 100, y: 100 });

      const cursor = overlay.handleMouseMove(50, 50);
      expect(cursor).toBeNull();
    });
  });

  // ========== renderAll ==========
  describe('renderAll', () => {
    it('应调用 ChartEngine.render 绘制图表', () => {
      chartModel.createChart('bar', dataRange, { x: 100, y: 100 });
      const renderSpy = vi.spyOn(chartEngine, 'render');

      const viewport = {
        startRow: 0, startCol: 0, endRow: 20, endCol: 10,
        offsetX: 0, offsetY: 0, scrollX: 0, scrollY: 0,
      };

      overlay.renderAll(mockCtx, viewport, 0, 0);
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('选中图表时应绘制选中边框和手柄', () => {
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 })!;
      overlay.selectChart(id);

      const viewport = {
        startRow: 0, startCol: 0, endRow: 20, endCol: 10,
        offsetX: 0, offsetY: 0, scrollX: 0, scrollY: 0,
      };

      overlay.renderAll(mockCtx, viewport, 0, 0);

      // 验证 strokeRect 被调用（边框 + 8 个手柄 = 至少 9 次）
      const strokeRectCalls = (mockCtx.strokeRect as ReturnType<typeof vi.fn>).mock.calls;
      expect(strokeRectCalls.length).toBeGreaterThanOrEqual(9);
    });

    it('完全不在视口内的图表应被跳过', () => {
      chartModel.createChart('bar', dataRange, { x: 2000, y: 2000 });
      const renderSpy = vi.spyOn(chartEngine, 'render');

      const viewport = {
        startRow: 0, startCol: 0, endRow: 20, endCol: 10,
        offsetX: 0, offsetY: 0, scrollX: 0, scrollY: 0,
      };

      overlay.renderAll(mockCtx, viewport, 0, 0);
      expect(renderSpy).not.toHaveBeenCalled();
    });
  });
});
