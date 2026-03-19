// ============================================================
// 图表编辑面板 — 提供图表属性配置的 DOM 面板
// ============================================================

import type { ChartConfig, ChartType } from './types';
import { ChartModel } from './chart-model';

// 图表类型中文标签映射
const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: '柱状图',
  line: '折线图',
  pie: '饼图',
  scatter: '散点图',
  area: '面积图',
};

// 图例位置选项
const LEGEND_POSITIONS = ['top', 'bottom', 'left', 'right'] as const;
const LEGEND_POSITION_LABELS: Record<string, string> = {
  top: '顶部',
  bottom: '底部',
  left: '左侧',
  right: '右侧',
};

// 数据标签内容选项
const DATA_LABEL_CONTENTS = ['value', 'percentage', 'category'] as const;
const DATA_LABEL_CONTENT_LABELS: Record<string, string> = {
  value: '数值',
  percentage: '百分比',
  category: '类别名称',
};

// 标题位置选项
const TITLE_POSITIONS = ['top', 'bottom'] as const;
const TITLE_POSITION_LABELS: Record<string, string> = {
  top: '顶部',
  bottom: '底部',
};

// 防抖延迟（毫秒）
const DEBOUNCE_DELAY = 200;

// 标题字体大小范围
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 24;

/**
 * 图表编辑面板
 *
 * 提供图表属性配置的 DOM 面板，允许用户修改标题、图例、坐标轴、数据标签等。
 * 配置变更通过 200ms 防抖后更新 ChartModel 并触发重绘。
 */
export class ChartEditor {
  // 面板 DOM 元素
  private panel: HTMLDivElement | null = null;

  // 遮罩层 DOM 元素
  private backdrop: HTMLDivElement | null = null;

  // 图表数据模型引用
  private chartModel: ChartModel;

  // 当前编辑的图表 ID
  private currentChartId: string | null = null;

  // 防抖定时器
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // 重绘回调
  private onRender: () => void;

  constructor(chartModel: ChartModel, onRender: () => void) {
    this.chartModel = chartModel;
    this.onRender = onRender;
  }

  /**
   * 打开编辑面板
   *
   * 构建 DOM 面板，显示当前图表配置。
   */
  open(chartId: string): void {
    const config = this.chartModel.getChart(chartId);
    if (!config) {
      return;
    }

    // 如果已有面板打开，先关闭
    if (this.panel) {
      this.close();
    }

    this.currentChartId = chartId;
    this.buildPanel();
    this.updatePanelValues(config);
  }

  /**
   * 关闭编辑面板并保存配置
   */
  close(): void {
    // 清除防抖定时器
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }

    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }

    this.currentChartId = null;
  }

  /**
   * 获取当前编辑的图表 ID
   */
  getCurrentChartId(): string | null {
    return this.currentChartId;
  }

  /**
   * 应用配置变更（200ms 防抖后更新 ChartModel 并触发重绘）
   */
  private applyChange(updates: Partial<ChartConfig>): void {
    if (!this.currentChartId) {
      return;
    }

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    const chartId = this.currentChartId;

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.chartModel.updateChart(chartId, updates);
      this.onRender();
    }, DEBOUNCE_DELAY);
  }

  /**
   * 构建面板 DOM 结构
   */
  private buildPanel(): void {
    // 创建遮罩层（点击关闭面板）
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'chart-editor-backdrop';
    this.backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9998;
    `;
    this.backdrop.addEventListener('click', () => {
      this.close();
    });
    document.body.appendChild(this.backdrop);

    // 创建面板
    this.panel = document.createElement('div');
    this.panel.className = 'chart-editor-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 320px;
      height: 100%;
      background: var(--theme-background, #ffffff);
      color: var(--theme-foreground, #333333);
      border-left: 1px solid var(--theme-grid-line, #e0e0e0);
      box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      overflow-y: auto;
      font-family: var(--font-sans, sans-serif);
      font-size: 13px;
    `;

    // 面板头部
    const header = this.createHeader();
    this.panel.appendChild(header);

    // 图表类型切换
    const typeSection = this.createSection('图表类型');
    typeSection.appendChild(this.createTypeSelector());
    this.panel.appendChild(typeSection);

    // 标题配置
    const titleSection = this.createSection('标题');
    titleSection.appendChild(this.createTitleConfig());
    this.panel.appendChild(titleSection);

    // 图例配置
    const legendSection = this.createSection('图例');
    legendSection.appendChild(this.createLegendConfig());
    this.panel.appendChild(legendSection);

    // 坐标轴配置
    const axesSection = this.createSection('坐标轴');
    axesSection.appendChild(this.createAxesConfig());
    this.panel.appendChild(axesSection);

    // 数据标签配置
    const dataLabelSection = this.createSection('数据标签');
    dataLabelSection.appendChild(this.createDataLabelConfig());
    this.panel.appendChild(dataLabelSection);

    document.body.appendChild(this.panel);
  }

  /**
   * 创建面板头部（标题 + 关闭按钮）
   */
  private createHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--theme-grid-line, #e0e0e0);
    `;

    const title = document.createElement('span');
    title.textContent = '图表设置';
    title.style.cssText = `font-size: 15px; font-weight: 600;`;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '确定';
    closeBtn.className = 'chart-editor-close-btn';
    closeBtn.style.cssText = `
      padding: 4px 16px;
      border: 1px solid var(--theme-button-border, #666);
      border-radius: 4px;
      background: var(--theme-button-bg, #fff);
      color: var(--theme-button-text, #333);
      cursor: pointer;
      font-size: 13px;
    `;
    closeBtn.addEventListener('click', () => {
      this.close();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    return header;
  }

  /**
   * 创建配置分区容器
   */
  private createSection(label: string): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'chart-editor-section';
    section.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid var(--theme-grid-line, #e0e0e0);
    `;

    const sectionTitle = document.createElement('div');
    sectionTitle.textContent = label;
    sectionTitle.style.cssText = `
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--theme-foreground, #333);
    `;
    section.appendChild(sectionTitle);

    return section;
  }

  /**
   * 创建图表类型选择器
   */
  private createTypeSelector(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `display: flex; gap: 4px; flex-wrap: wrap;`;

    const chartTypes: ChartType[] = ['bar', 'line', 'pie', 'scatter', 'area'];

    for (const type of chartTypes) {
      const btn = document.createElement('button');
      btn.textContent = CHART_TYPE_LABELS[type];
      btn.dataset.chartType = type;
      btn.className = 'chart-editor-type-btn';
      btn.style.cssText = `
        padding: 4px 10px;
        border: 1px solid var(--theme-button-border, #666);
        border-radius: 4px;
        background: var(--theme-button-bg, #fff);
        color: var(--theme-button-text, #333);
        cursor: pointer;
        font-size: 12px;
      `;
      btn.addEventListener('click', () => {
        // 切换类型时保留 dataRange
        this.applyChange({ type });
        // 更新按钮选中状态
        this.updateTypeButtonStates(type);
      });
      container.appendChild(btn);
    }

    return container;
  }

  /**
   * 更新类型按钮的选中状态
   */
  private updateTypeButtonStates(activeType: ChartType): void {
    if (!this.panel) return;
    const buttons = this.panel.querySelectorAll<HTMLButtonElement>('.chart-editor-type-btn');
    for (const btn of buttons) {
      const isActive = btn.dataset.chartType === activeType;
      btn.style.background = isActive ? '#4285F4' : 'var(--theme-button-bg, #fff)';
      btn.style.color = isActive ? '#fff' : 'var(--theme-button-text, #333)';
      btn.style.borderColor = isActive ? '#4285F4' : 'var(--theme-button-border, #666)';
    }
  }

  /**
   * 创建标题配置区域
   */
  private createTitleConfig(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `display: flex; flex-direction: column; gap: 8px;`;

    // 显示/隐藏
    const visibleRow = this.createCheckboxRow('title-visible', '显示标题');
    visibleRow.input.addEventListener('change', () => {
      this.applyChange({ title: { text: '', fontSize: 16, position: 'top', visible: visibleRow.input.checked } });
    });
    container.appendChild(visibleRow.row);

    // 标题文本
    const textRow = this.createInputRow('title-text', '标题文本', 'text');
    textRow.input.addEventListener('input', () => {
      this.applyChange({ title: { text: textRow.input.value, fontSize: 16, position: 'top', visible: true } });
    });
    container.appendChild(textRow.row);

    // 字体大小（12-24px）
    const fontSizeRow = this.createInputRow('title-fontSize', '字体大小', 'number');
    fontSizeRow.input.min = String(MIN_FONT_SIZE);
    fontSizeRow.input.max = String(MAX_FONT_SIZE);
    fontSizeRow.input.addEventListener('input', () => {
      const val = parseInt(fontSizeRow.input.value, 10);
      if (!isNaN(val)) {
        // ChartModel.updateChart 会自动钳制到 12-24
        this.applyChange({ title: { text: '', fontSize: val, position: 'top', visible: true } });
      }
    });
    container.appendChild(fontSizeRow.row);

    // 位置
    const positionRow = this.createSelectRow('title-position', '位置', TITLE_POSITIONS, TITLE_POSITION_LABELS);
    positionRow.select.addEventListener('change', () => {
      this.applyChange({ title: { text: '', fontSize: 16, position: positionRow.select.value as 'top' | 'bottom', visible: true } });
    });
    container.appendChild(positionRow.row);

    return container;
  }

  /**
   * 创建图例配置区域
   */
  private createLegendConfig(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `display: flex; flex-direction: column; gap: 8px;`;

    // 显示/隐藏
    const visibleRow = this.createCheckboxRow('legend-visible', '显示图例');
    visibleRow.input.addEventListener('change', () => {
      this.applyChange({ legend: { visible: visibleRow.input.checked, position: 'bottom' } });
    });
    container.appendChild(visibleRow.row);

    // 位置
    const positionRow = this.createSelectRow('legend-position', '位置', LEGEND_POSITIONS, LEGEND_POSITION_LABELS);
    positionRow.select.addEventListener('change', () => {
      this.applyChange({ legend: { visible: true, position: positionRow.select.value as 'top' | 'bottom' | 'left' | 'right' } });
    });
    container.appendChild(positionRow.row);

    return container;
  }

  /**
   * 创建坐标轴配置区域
   */
  private createAxesConfig(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `display: flex; flex-direction: column; gap: 12px;`;

    // X 轴配置
    const xAxisGroup = document.createElement('div');
    xAxisGroup.style.cssText = `display: flex; flex-direction: column; gap: 6px;`;
    const xLabel = document.createElement('div');
    xLabel.textContent = 'X 轴';
    xLabel.style.cssText = `font-size: 12px; font-weight: 500; color: var(--theme-status-text, #737373);`;
    xAxisGroup.appendChild(xLabel);

    const xTitleRow = this.createInputRow('axes-xAxis-title', '标题', 'text');
    xTitleRow.input.addEventListener('input', () => {
      this.applyChangeForAxis('xAxis', 'title', xTitleRow.input.value);
    });
    xAxisGroup.appendChild(xTitleRow.row);

    const xGridRow = this.createCheckboxRow('axes-xAxis-showGridLines', '显示网格线');
    xGridRow.input.addEventListener('change', () => {
      this.applyChangeForAxis('xAxis', 'showGridLines', xGridRow.input.checked);
    });
    xAxisGroup.appendChild(xGridRow.row);

    const xAutoRangeRow = this.createCheckboxRow('axes-xAxis-autoRange', '自动范围');
    xAutoRangeRow.input.addEventListener('change', () => {
      this.applyChangeForAxis('xAxis', 'autoRange', xAutoRangeRow.input.checked);
    });
    xAxisGroup.appendChild(xAutoRangeRow.row);

    const xMinRow = this.createInputRow('axes-xAxis-min', '最小值', 'number');
    xMinRow.input.addEventListener('input', () => {
      const val = parseFloat(xMinRow.input.value);
      if (!isNaN(val)) {
        this.applyChangeForAxis('xAxis', 'min', val);
      }
    });
    xAxisGroup.appendChild(xMinRow.row);

    const xMaxRow = this.createInputRow('axes-xAxis-max', '最大值', 'number');
    xMaxRow.input.addEventListener('input', () => {
      const val = parseFloat(xMaxRow.input.value);
      if (!isNaN(val)) {
        this.applyChangeForAxis('xAxis', 'max', val);
      }
    });
    xAxisGroup.appendChild(xMaxRow.row);

    container.appendChild(xAxisGroup);

    // Y 轴配置
    const yAxisGroup = document.createElement('div');
    yAxisGroup.style.cssText = `display: flex; flex-direction: column; gap: 6px;`;
    const yLabel = document.createElement('div');
    yLabel.textContent = 'Y 轴';
    yLabel.style.cssText = `font-size: 12px; font-weight: 500; color: var(--theme-status-text, #737373);`;
    yAxisGroup.appendChild(yLabel);

    const yTitleRow = this.createInputRow('axes-yAxis-title', '标题', 'text');
    yTitleRow.input.addEventListener('input', () => {
      this.applyChangeForAxis('yAxis', 'title', yTitleRow.input.value);
    });
    yAxisGroup.appendChild(yTitleRow.row);

    const yGridRow = this.createCheckboxRow('axes-yAxis-showGridLines', '显示网格线');
    yGridRow.input.addEventListener('change', () => {
      this.applyChangeForAxis('yAxis', 'showGridLines', yGridRow.input.checked);
    });
    yAxisGroup.appendChild(yGridRow.row);

    const yAutoRangeRow = this.createCheckboxRow('axes-yAxis-autoRange', '自动范围');
    yAutoRangeRow.input.addEventListener('change', () => {
      this.applyChangeForAxis('yAxis', 'autoRange', yAutoRangeRow.input.checked);
    });
    yAxisGroup.appendChild(yAutoRangeRow.row);

    const yMinRow = this.createInputRow('axes-yAxis-min', '最小值', 'number');
    yMinRow.input.addEventListener('input', () => {
      const val = parseFloat(yMinRow.input.value);
      if (!isNaN(val)) {
        this.applyChangeForAxis('yAxis', 'min', val);
      }
    });
    yAxisGroup.appendChild(yMinRow.row);

    const yMaxRow = this.createInputRow('axes-yAxis-max', '最大值', 'number');
    yMaxRow.input.addEventListener('input', () => {
      const val = parseFloat(yMaxRow.input.value);
      if (!isNaN(val)) {
        this.applyChangeForAxis('yAxis', 'max', val);
      }
    });
    yAxisGroup.appendChild(yMaxRow.row);

    container.appendChild(yAxisGroup);

    return container;
  }

  /**
   * 坐标轴变更辅助方法
   *
   * 只更新指定轴的指定字段，避免覆盖其他轴的配置。
   */
  private applyChangeForAxis(
    axis: 'xAxis' | 'yAxis',
    field: string,
    value: string | number | boolean
  ): void {
    if (!this.currentChartId) return;

    const config = this.chartModel.getChart(this.currentChartId);
    if (!config) return;

    // 基于当前配置构建更新，只修改目标字段
    const currentAxis = { ...config.axes[axis] };
    (currentAxis as Record<string, unknown>)[field] = value;

    const axesUpdate: Partial<ChartConfig> = {
      axes: {
        xAxis: axis === 'xAxis' ? currentAxis : config.axes.xAxis,
        yAxis: axis === 'yAxis' ? currentAxis : config.axes.yAxis,
      },
    };

    this.applyChange(axesUpdate);
  }

  /**
   * 创建数据标签配置区域
   */
  private createDataLabelConfig(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `display: flex; flex-direction: column; gap: 8px;`;

    // 显示/隐藏
    const visibleRow = this.createCheckboxRow('dataLabels-visible', '显示数据标签');
    visibleRow.input.addEventListener('change', () => {
      this.applyChange({ dataLabels: { visible: visibleRow.input.checked, content: 'value' } });
    });
    container.appendChild(visibleRow.row);

    // 内容类型
    const contentRow = this.createSelectRow('dataLabels-content', '显示内容', DATA_LABEL_CONTENTS, DATA_LABEL_CONTENT_LABELS);
    contentRow.select.addEventListener('change', () => {
      this.applyChange({ dataLabels: { visible: true, content: contentRow.select.value as 'value' | 'percentage' | 'category' } });
    });
    container.appendChild(contentRow.row);

    return container;
  }

  /**
   * 更新面板显示值（反映当前图表配置）
   */
  private updatePanelValues(config: ChartConfig): void {
    if (!this.panel) return;

    // 图表类型
    this.updateTypeButtonStates(config.type);

    // 标题配置
    this.setCheckboxValue('title-visible', config.title.visible);
    this.setInputValue('title-text', config.title.text);
    this.setInputValue('title-fontSize', String(config.title.fontSize));
    this.setSelectValue('title-position', config.title.position);

    // 图例配置
    this.setCheckboxValue('legend-visible', config.legend.visible);
    this.setSelectValue('legend-position', config.legend.position);

    // X 轴配置
    this.setInputValue('axes-xAxis-title', config.axes.xAxis.title);
    this.setCheckboxValue('axes-xAxis-showGridLines', config.axes.xAxis.showGridLines);
    this.setCheckboxValue('axes-xAxis-autoRange', config.axes.xAxis.autoRange);
    this.setInputValue('axes-xAxis-min', config.axes.xAxis.min !== undefined ? String(config.axes.xAxis.min) : '');
    this.setInputValue('axes-xAxis-max', config.axes.xAxis.max !== undefined ? String(config.axes.xAxis.max) : '');

    // Y 轴配置
    this.setInputValue('axes-yAxis-title', config.axes.yAxis.title);
    this.setCheckboxValue('axes-yAxis-showGridLines', config.axes.yAxis.showGridLines);
    this.setCheckboxValue('axes-yAxis-autoRange', config.axes.yAxis.autoRange);
    this.setInputValue('axes-yAxis-min', config.axes.yAxis.min !== undefined ? String(config.axes.yAxis.min) : '');
    this.setInputValue('axes-yAxis-max', config.axes.yAxis.max !== undefined ? String(config.axes.yAxis.max) : '');

    // 数据标签配置
    this.setCheckboxValue('dataLabels-visible', config.dataLabels.visible);
    this.setSelectValue('dataLabels-content', config.dataLabels.content);
  }

  // ============================================================
  // DOM 辅助方法
  // ============================================================

  /**
   * 创建带标签的文本/数字输入行
   */
  private createInputRow(
    id: string,
    label: string,
    type: 'text' | 'number'
  ): { row: HTMLDivElement; input: HTMLInputElement } {
    const row = document.createElement('div');
    row.style.cssText = `display: flex; align-items: center; justify-content: space-between;`;

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.htmlFor = `chart-editor-${id}`;
    labelEl.style.cssText = `font-size: 12px; color: var(--theme-foreground, #333);`;

    const input = document.createElement('input');
    input.type = type;
    input.id = `chart-editor-${id}`;
    input.dataset.field = id;
    input.style.cssText = `
      width: 140px;
      padding: 3px 6px;
      border: 1px solid var(--theme-input-border, #666);
      border-radius: 3px;
      background: var(--theme-input-bg, #fff);
      color: var(--theme-foreground, #333);
      font-size: 12px;
      outline: none;
    `;

    row.appendChild(labelEl);
    row.appendChild(input);
    return { row, input };
  }

  /**
   * 创建带标签的复选框行
   */
  private createCheckboxRow(
    id: string,
    label: string
  ): { row: HTMLDivElement; input: HTMLInputElement } {
    const row = document.createElement('div');
    row.style.cssText = `display: flex; align-items: center; gap: 8px;`;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `chart-editor-${id}`;
    input.dataset.field = id;

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.htmlFor = `chart-editor-${id}`;
    labelEl.style.cssText = `font-size: 12px; color: var(--theme-foreground, #333); cursor: pointer;`;

    row.appendChild(input);
    row.appendChild(labelEl);
    return { row, input };
  }

  /**
   * 创建带标签的下拉选择行
   */
  private createSelectRow(
    id: string,
    label: string,
    options: readonly string[],
    labels: Record<string, string>
  ): { row: HTMLDivElement; select: HTMLSelectElement } {
    const row = document.createElement('div');
    row.style.cssText = `display: flex; align-items: center; justify-content: space-between;`;

    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.htmlFor = `chart-editor-${id}`;
    labelEl.style.cssText = `font-size: 12px; color: var(--theme-foreground, #333);`;

    const select = document.createElement('select');
    select.id = `chart-editor-${id}`;
    select.dataset.field = id;
    select.style.cssText = `
      width: 140px;
      padding: 3px 6px;
      border: 1px solid var(--theme-input-border, #666);
      border-radius: 3px;
      background: var(--theme-input-bg, #fff);
      color: var(--theme-foreground, #333);
      font-size: 12px;
      outline: none;
    `;

    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = labels[opt] ?? opt;
      select.appendChild(option);
    }

    row.appendChild(labelEl);
    row.appendChild(select);
    return { row, select };
  }

  /**
   * 设置输入框的值
   */
  private setInputValue(fieldId: string, value: string): void {
    const input = this.panel?.querySelector<HTMLInputElement>(`#chart-editor-${fieldId}`);
    if (input) {
      input.value = value;
    }
  }

  /**
   * 设置复选框的值
   */
  private setCheckboxValue(fieldId: string, checked: boolean): void {
    const input = this.panel?.querySelector<HTMLInputElement>(`#chart-editor-${fieldId}`);
    if (input) {
      input.checked = checked;
    }
  }

  /**
   * 设置下拉选择框的值
   */
  private setSelectValue(fieldId: string, value: string): void {
    const select = this.panel?.querySelector<HTMLSelectElement>(`#chart-editor-${fieldId}`);
    if (select) {
      select.value = value;
    }
  }
}
