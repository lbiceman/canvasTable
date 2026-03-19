// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import { ChartEditor } from '../chart/chart-editor';
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
 * 辅助函数：创建测试用图表并返回 ID
 */
function createTestChart(
  chartModel: ChartModel,
  spreadsheetModel: SpreadsheetModel
): string {
  fillNumericData(spreadsheetModel, 0, 0, 4, 3);
  const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 4, endCol: 3 };
  const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 });
  return id!;
}

describe('ChartEditor', () => {
  let spreadsheetModel: SpreadsheetModel;
  let chartModel: ChartModel;
  let renderSpy: (() => void) & { mock: { calls: unknown[][] } };
  let editor: ChartEditor;

  beforeEach(() => {
    spreadsheetModel = new SpreadsheetModel(20, 10);
    chartModel = new ChartModel(spreadsheetModel);
    const fn = vi.fn();
    renderSpy = fn as typeof renderSpy;
    editor = new ChartEditor(chartModel, renderSpy);
    vi.useFakeTimers();
  });

  afterEach(() => {
    // 确保面板关闭，清理 DOM
    editor.close();
    vi.useRealTimers();
  });

  describe('open', () => {
    it('应创建面板 DOM 并添加到 document.body', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const panel = document.querySelector('.chart-editor-panel');
      expect(panel).not.toBeNull();
    });

    it('应创建遮罩层 DOM', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const backdrop = document.querySelector('.chart-editor-backdrop');
      expect(backdrop).not.toBeNull();
    });

    it('应设置当前编辑的图表 ID', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      expect(editor.getCurrentChartId()).toBe(chartId);
    });

    it('图表不存在时不应创建面板', () => {
      editor.open('non-existent-id');

      const panel = document.querySelector('.chart-editor-panel');
      expect(panel).toBeNull();
      expect(editor.getCurrentChartId()).toBeNull();
    });

    it('面板应包含图表设置标题', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const panel = document.querySelector('.chart-editor-panel');
      expect(panel?.textContent).toContain('图表设置');
    });

    it('面板应包含确定按钮', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const closeBtn = document.querySelector('.chart-editor-close-btn');
      expect(closeBtn).not.toBeNull();
      expect(closeBtn?.textContent).toBe('确定');
    });

    it('面板应包含所有配置分区', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const panel = document.querySelector('.chart-editor-panel');
      const text = panel?.textContent ?? '';
      expect(text).toContain('图表类型');
      expect(text).toContain('标题');
      expect(text).toContain('图例');
      expect(text).toContain('坐标轴');
      expect(text).toContain('数据标签');
    });

    it('重复打开应先关闭旧面板', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);
      editor.open(chartId);

      const panels = document.querySelectorAll('.chart-editor-panel');
      expect(panels.length).toBe(1);
    });
  });

  describe('close', () => {
    it('应移除面板和遮罩层 DOM', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);
      editor.close();

      expect(document.querySelector('.chart-editor-panel')).toBeNull();
      expect(document.querySelector('.chart-editor-backdrop')).toBeNull();
    });

    it('应清除当前编辑的图表 ID', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);
      editor.close();

      expect(editor.getCurrentChartId()).toBeNull();
    });

    it('点击确定按钮应关闭面板', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const closeBtn = document.querySelector<HTMLButtonElement>('.chart-editor-close-btn');
      closeBtn?.click();

      expect(document.querySelector('.chart-editor-panel')).toBeNull();
    });

    it('点击遮罩层应关闭面板', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const backdrop = document.querySelector<HTMLDivElement>('.chart-editor-backdrop');
      backdrop?.click();

      expect(document.querySelector('.chart-editor-panel')).toBeNull();
    });
  });

  describe('applyChange（防抖）', () => {
    it('修改图表类型后 200ms 应更新 ChartModel', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      // 点击折线图按钮
      const typeButtons = document.querySelectorAll<HTMLButtonElement>('.chart-editor-type-btn');
      const lineBtn = Array.from(typeButtons).find((btn) => btn.dataset.chartType === 'line');
      lineBtn?.click();

      // 200ms 前不应更新
      vi.advanceTimersByTime(100);
      expect(chartModel.getChart(chartId)?.type).toBe('bar');

      // 200ms 后应更新
      vi.advanceTimersByTime(100);
      expect(chartModel.getChart(chartId)?.type).toBe('line');
      expect(renderSpy).toHaveBeenCalled();
    });

    it('图表类型切换应保留 dataRange', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      const originalRange = { ...chartModel.getChart(chartId)!.dataRange };
      editor.open(chartId);

      // 切换到饼图
      const typeButtons = document.querySelectorAll<HTMLButtonElement>('.chart-editor-type-btn');
      const pieBtn = Array.from(typeButtons).find((btn) => btn.dataset.chartType === 'pie');
      pieBtn?.click();

      vi.advanceTimersByTime(200);

      const updatedChart = chartModel.getChart(chartId)!;
      expect(updatedChart.type).toBe('pie');
      expect(updatedChart.dataRange).toEqual(originalRange);
    });

    it('修改标题文本应通过防抖更新', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const titleInput = document.querySelector<HTMLInputElement>('#chart-editor-title-text');
      expect(titleInput).not.toBeNull();

      titleInput!.value = '测试标题';
      titleInput!.dispatchEvent(new Event('input'));

      vi.advanceTimersByTime(200);

      const chart = chartModel.getChart(chartId)!;
      expect(chart.title.text).toBe('测试标题');
    });

    it('修改标题字体大小应被钳制到 12-24 范围', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const fontSizeInput = document.querySelector<HTMLInputElement>('#chart-editor-title-fontSize');
      expect(fontSizeInput).not.toBeNull();

      // 设置超出范围的值
      fontSizeInput!.value = '30';
      fontSizeInput!.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(200);

      // ChartModel.updateChart 会钳制到 24
      expect(chartModel.getChart(chartId)!.title.fontSize).toBe(24);
    });

    it('修改图例显示状态应更新', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const legendVisible = document.querySelector<HTMLInputElement>('#chart-editor-legend-visible');
      expect(legendVisible).not.toBeNull();

      legendVisible!.checked = false;
      legendVisible!.dispatchEvent(new Event('change'));
      vi.advanceTimersByTime(200);

      expect(chartModel.getChart(chartId)!.legend.visible).toBe(false);
    });

    it('修改图例位置应更新', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const legendPosition = document.querySelector<HTMLSelectElement>('#chart-editor-legend-position');
      expect(legendPosition).not.toBeNull();

      legendPosition!.value = 'right';
      legendPosition!.dispatchEvent(new Event('change'));
      vi.advanceTimersByTime(200);

      expect(chartModel.getChart(chartId)!.legend.position).toBe('right');
    });

    it('修改数据标签显示状态应更新', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const dataLabelVisible = document.querySelector<HTMLInputElement>('#chart-editor-dataLabels-visible');
      expect(dataLabelVisible).not.toBeNull();

      dataLabelVisible!.checked = true;
      dataLabelVisible!.dispatchEvent(new Event('change'));
      vi.advanceTimersByTime(200);

      expect(chartModel.getChart(chartId)!.dataLabels.visible).toBe(true);
    });

    it('修改数据标签内容类型应更新', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const dataLabelContent = document.querySelector<HTMLSelectElement>('#chart-editor-dataLabels-content');
      expect(dataLabelContent).not.toBeNull();

      dataLabelContent!.value = 'percentage';
      dataLabelContent!.dispatchEvent(new Event('change'));
      vi.advanceTimersByTime(200);

      expect(chartModel.getChart(chartId)!.dataLabels.content).toBe('percentage');
    });

    it('修改 Y 轴标题应更新', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const yAxisTitle = document.querySelector<HTMLInputElement>('#chart-editor-axes-yAxis-title');
      expect(yAxisTitle).not.toBeNull();

      yAxisTitle!.value = '销售额';
      yAxisTitle!.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(200);

      expect(chartModel.getChart(chartId)!.axes.yAxis.title).toBe('销售额');
    });

    it('修改 X 轴网格线显示应更新', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const xGridLines = document.querySelector<HTMLInputElement>('#chart-editor-axes-xAxis-showGridLines');
      expect(xGridLines).not.toBeNull();

      xGridLines!.checked = true;
      xGridLines!.dispatchEvent(new Event('change'));
      vi.advanceTimersByTime(200);

      expect(chartModel.getChart(chartId)!.axes.xAxis.showGridLines).toBe(true);
    });

    it('快速连续修改应只触发一次更新（防抖合并）', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const titleInput = document.querySelector<HTMLInputElement>('#chart-editor-title-text');

      titleInput!.value = '标';
      titleInput!.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(100);

      titleInput!.value = '标题';
      titleInput!.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(100);

      titleInput!.value = '标题测试';
      titleInput!.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(200);

      // 只有最后一次值被应用
      expect(chartModel.getChart(chartId)!.title.text).toBe('标题测试');
      // renderSpy 只被调用一次（最后的防抖触发）
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('updatePanelValues', () => {
    it('面板应正确显示当前图表类型的选中状态', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      // 默认是 bar 类型
      const typeButtons = document.querySelectorAll<HTMLButtonElement>('.chart-editor-type-btn');
      const barBtn = Array.from(typeButtons).find((btn) => btn.dataset.chartType === 'bar');
      // jsdom 将 hex 颜色标准化为 rgb 格式
      expect(barBtn?.style.background).toBe('rgb(66, 133, 244)');
    });

    it('面板应正确显示图例默认配置', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const legendVisible = document.querySelector<HTMLInputElement>('#chart-editor-legend-visible');
      const legendPosition = document.querySelector<HTMLSelectElement>('#chart-editor-legend-position');

      expect(legendVisible?.checked).toBe(true);
      expect(legendPosition?.value).toBe('bottom');
    });

    it('面板应正确显示 Y 轴默认网格线配置', () => {
      const chartId = createTestChart(chartModel, spreadsheetModel);
      editor.open(chartId);

      const yGridLines = document.querySelector<HTMLInputElement>('#chart-editor-axes-yAxis-showGridLines');
      expect(yGridLines?.checked).toBe(true);
    });
  });
});
