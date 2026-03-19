// ============================================================
// 图表浮动层 — 管理图表定位、选中、拖拽移动和缩放交互
// ============================================================

import type { ChartConfig, DataRange, ChartType } from './types';
import type { Viewport } from '../types';
import { ChartModel } from './chart-model';
import { ChartEngine } from './chart-engine';

// 缩放手柄方向类型
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

// 缩放手柄尺寸（像素）
const HANDLE_SIZE = 8;

// 图表最小尺寸约束
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

// 选中边框颜色
const SELECTION_COLOR = '#4285F4';

// 图表类型中文标签映射
const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: '柱状图',
  line: '折线图',
  pie: '饼图',
  scatter: '散点图',
  area: '面积图',
};

// 缩放手柄对应的光标样式
const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nw-resize',
  n: 'n-resize',
  ne: 'ne-resize',
  e: 'e-resize',
  se: 'se-resize',
  s: 's-resize',
  sw: 'sw-resize',
  w: 'w-resize',
};

/**
 * 图表浮动层
 *
 * 负责管理图表在电子表格上方的定位、选中状态、拖拽移动和缩放交互。
 * 在主渲染流程中调用 renderAll() 绘制所有图表及选中状态。
 */
export class ChartOverlay {
  private chartModel: ChartModel;
  private chartEngine: ChartEngine;

  // 当前选中的图表 ID
  private selectedChartId: string | null = null;

  // 拖拽状态
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOriginalX = 0;
  private dragOriginalY = 0;

  // 缩放状态
  private isResizing = false;
  private resizeHandle: ResizeHandle | null = null;
  private resizeOriginalX = 0;
  private resizeOriginalY = 0;
  private resizeOriginalWidth = 0;
  private resizeOriginalHeight = 0;
  private resizeStartMouseX = 0;
  private resizeStartMouseY = 0;

  // 类型选择面板引用
  private typeSelectorPanel: HTMLDivElement | null = null;

  constructor(chartModel: ChartModel, chartEngine: ChartEngine) {
    this.chartModel = chartModel;
    this.chartEngine = chartEngine;
  }

  /**
   * 命中测试：判断坐标是否在某个图表区域内
   *
   * 优先检测选中图表的缩放手柄，再检测图表主体区域。
   * 坐标为相对于数据区域左上角的像素坐标（已减去滚动偏移）。
   *
   * @param x 鼠标 X 坐标
   * @param y 鼠标 Y 坐标
   * @returns 命中结果，包含图表 ID 和手柄方向；未命中返回 null
   */
  hitTest(x: number, y: number): { chartId: string; handle: ResizeHandle | null } | null {
    // 优先检测选中图表的缩放手柄
    if (this.selectedChartId) {
      const selectedChart = this.chartModel.getChart(this.selectedChartId);
      if (selectedChart) {
        const handle = this.hitTestHandles(x, y, selectedChart);
        if (handle) {
          return { chartId: this.selectedChartId, handle };
        }
      }
    }

    // 检测图表主体区域（从后往前遍历，后绘制的在上层）
    const charts = this.chartModel.getAllCharts();
    for (let i = charts.length - 1; i >= 0; i--) {
      const chart = charts[i];
      const { position, size } = chart;
      if (
        x >= position.x &&
        x <= position.x + size.width &&
        y >= position.y &&
        y <= position.y + size.height
      ) {
        return { chartId: chart.id, handle: null };
      }
    }

    return null;
  }

  /**
   * 处理鼠标按下事件
   *
   * 根据命中测试结果决定是否开始拖拽或缩放操作。
   * 返回 true 表示事件已被图表层消费，应阻止正常电子表格交互。
   */
  handleMouseDown(x: number, y: number): boolean {
    const hit = this.hitTest(x, y);

    if (!hit) {
      // 点击图表外部，取消选中
      this.deselectChart();
      return false;
    }

    // 选中图表
    this.selectChart(hit.chartId);

    const chart = this.chartModel.getChart(hit.chartId);
    if (!chart) {
      return true;
    }

    if (hit.handle) {
      // 开始缩放
      this.isResizing = true;
      this.resizeHandle = hit.handle;
      this.resizeStartMouseX = x;
      this.resizeStartMouseY = y;
      this.resizeOriginalX = chart.position.x;
      this.resizeOriginalY = chart.position.y;
      this.resizeOriginalWidth = chart.size.width;
      this.resizeOriginalHeight = chart.size.height;
    } else {
      // 开始拖拽
      this.isDragging = true;
      this.dragStartX = x;
      this.dragStartY = y;
      this.dragOriginalX = chart.position.x;
      this.dragOriginalY = chart.position.y;
    }

    return true;
  }

  /**
   * 处理鼠标移动事件
   *
   * 拖拽时更新图表位置，缩放时更新图表尺寸。
   * 返回光标样式字符串，null 表示不需要改变光标。
   */
  handleMouseMove(x: number, y: number): string | null {
    // 拖拽移动中
    if (this.isDragging && this.selectedChartId) {
      const chart = this.chartModel.getChart(this.selectedChartId);
      if (chart) {
        const dx = x - this.dragStartX;
        const dy = y - this.dragStartY;

        let newX = this.dragOriginalX + dx;
        let newY = this.dragOriginalY + dy;

        // 钳制位置到可视区域边界内
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);

        this.chartModel.updateChart(this.selectedChartId, {
          position: { x: newX, y: newY },
        });
      }
      return 'move';
    }

    // 缩放中
    if (this.isResizing && this.selectedChartId && this.resizeHandle) {
      this.applyResize(x, y);
      return HANDLE_CURSORS[this.resizeHandle];
    }

    // 非拖拽/缩放状态，检测悬停光标
    const hit = this.hitTest(x, y);
    if (hit) {
      if (hit.handle) {
        return HANDLE_CURSORS[hit.handle];
      }
      return 'move';
    }

    return null;
  }

  /**
   * 处理鼠标释放事件
   *
   * 结束拖拽或缩放操作。
   */
  handleMouseUp(): void {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
  }

  /**
   * 选中图表
   */
  selectChart(chartId: string): void {
    this.selectedChartId = chartId;
  }

  /**
   * 取消选中
   */
  deselectChart(): void {
    this.selectedChartId = null;
  }

  /**
   * 获取当前选中的图表 ID
   */
  getSelectedChartId(): string | null {
    return this.selectedChartId;
  }

  /**
   * 删除选中的图表
   */
  deleteSelectedChart(): void {
    if (this.selectedChartId) {
      this.chartModel.deleteChart(this.selectedChartId);
      this.selectedChartId = null;
    }
  }

  /**
   * 渲染所有图表
   *
   * 遍历所有图表，调用 ChartEngine.render() 绘制。
   * 选中图表额外绘制蓝色边框和八个缩放手柄。
   *
   * @param ctx Canvas 2D 上下文
   * @param viewport 当前视口信息
   * @param scrollX 水平滚动偏移
   * @param scrollY 垂直滚动偏移
   */
  renderAll(
    ctx: CanvasRenderingContext2D,
    _viewport: Viewport,
    scrollX: number,
    scrollY: number
  ): void {
    const charts = this.chartModel.getAllCharts();

    for (const chart of charts) {
      // 计算图表在 Canvas 上的绘制位置（减去滚动偏移）
      const renderX = chart.position.x - scrollX;
      const renderY = chart.position.y - scrollY;
      const { width, height } = chart.size;

      // 简单可见性检测：跳过完全不在视口内的图表
      if (
        renderX + width < 0 ||
        renderY + height < 0 ||
        renderX > ctx.canvas.width ||
        renderY > ctx.canvas.height
      ) {
        continue;
      }

      // 解析图表数据
      const data = this.chartModel.resolveChartData(chart.id);

      // 调用 ChartEngine 绘制图表
      this.chartEngine.render(chart, data, renderX, renderY, width, height);

      // 选中图表绘制蓝色边框和缩放手柄
      if (chart.id === this.selectedChartId) {
        this.renderSelection(ctx, renderX, renderY, width, height);
      }
    }
  }

  /**
   * 显示图表类型选择面板
   *
   * 在指定位置创建 DOM 弹出面板，列出五种图表类型供用户选择。
   * 选择后创建对应类型的图表并关闭面板。
   *
   * @param x 面板显示的 X 坐标
   * @param y 面板显示的 Y 坐标
   * @param dataRange 数据范围
   */
  showTypeSelector(x: number, y: number, dataRange: DataRange, chartPosition: { x: number; y: number }): void {
    // 移除已有面板
    this.removeTypeSelector();

    const panel = document.createElement('div');
    panel.className = 'chart-type-selector';
    panel.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      background: #fff;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 8px 0;
      z-index: 10000;
      min-width: 140px;
      font-family: sans-serif;
      font-size: 13px;
    `;

    const chartTypes: ChartType[] = ['bar', 'line', 'pie', 'scatter', 'area'];

    for (const type of chartTypes) {
      const item = document.createElement('div');
      item.textContent = CHART_TYPE_LABELS[type];
      item.style.cssText = `
        padding: 6px 16px;
        cursor: pointer;
        color: #333;
      `;
      item.addEventListener('mouseenter', () => {
        item.style.background = '#e8f0fe';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });
      item.addEventListener('click', () => {
        // 创建图表，位置基于数据区域计算
        const position = { x: Math.max(0, chartPosition.x), y: Math.max(0, chartPosition.y) };
        const chartId = this.chartModel.createChart(type, dataRange, position);
        if (chartId) {
          this.selectChart(chartId);
        }
        this.removeTypeSelector();
      });
      panel.appendChild(item);
    }

    document.body.appendChild(panel);
    this.typeSelectorPanel = panel;

    // 点击面板外部关闭
    const closeHandler = (e: MouseEvent) => {
      if (!panel.contains(e.target as Node)) {
        this.removeTypeSelector();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    // 延迟注册，避免当前点击立即触发关闭
    setTimeout(() => {
      document.addEventListener('mousedown', closeHandler);
    }, 0);
  }

  // ============================================================
  // 私有辅助方法
  // ============================================================

  /**
   * 移除图表类型选择面板
   */
  private removeTypeSelector(): void {
    if (this.typeSelectorPanel) {
      this.typeSelectorPanel.remove();
      this.typeSelectorPanel = null;
    }
  }

  /**
   * 检测坐标是否命中选中图表的缩放手柄
   *
   * 返回命中的手柄方向，未命中返回 null。
   */
  private hitTestHandles(x: number, y: number, chart: ChartConfig): ResizeHandle | null {
    const handles = this.getHandlePositions(chart);

    for (const [handle, hx, hy] of handles) {
      const halfSize = HANDLE_SIZE / 2;
      if (
        x >= hx - halfSize &&
        x <= hx + halfSize &&
        y >= hy - halfSize &&
        y <= hy + halfSize
      ) {
        return handle;
      }
    }

    return null;
  }

  /**
   * 获取图表八个缩放手柄的位置坐标
   *
   * 返回 [手柄方向, x, y] 的数组。
   */
  private getHandlePositions(chart: ChartConfig): Array<[ResizeHandle, number, number]> {
    const { x, y } = chart.position;
    const { width, height } = chart.size;
    const midX = x + width / 2;
    const midY = y + height / 2;

    return [
      ['nw', x, y],
      ['n', midX, y],
      ['ne', x + width, y],
      ['e', x + width, midY],
      ['se', x + width, y + height],
      ['s', midX, y + height],
      ['sw', x, y + height],
      ['w', x, midY],
    ];
  }

  /**
   * 应用缩放操作
   *
   * 根据当前拖拽的手柄方向计算新的位置和尺寸，
   * 并钳制最小尺寸为 200×150 像素。
   */
  private applyResize(mouseX: number, mouseY: number): void {
    if (!this.selectedChartId || !this.resizeHandle) {
      return;
    }

    const dx = mouseX - this.resizeStartMouseX;
    const dy = mouseY - this.resizeStartMouseY;

    let newX = this.resizeOriginalX;
    let newY = this.resizeOriginalY;
    let newWidth = this.resizeOriginalWidth;
    let newHeight = this.resizeOriginalHeight;

    const handle = this.resizeHandle;

    // 根据手柄方向调整位置和尺寸
    // 西侧手柄：左边界移动
    if (handle === 'nw' || handle === 'w' || handle === 'sw') {
      newX = this.resizeOriginalX + dx;
      newWidth = this.resizeOriginalWidth - dx;
    }
    // 东侧手柄：右边界移动
    if (handle === 'ne' || handle === 'e' || handle === 'se') {
      newWidth = this.resizeOriginalWidth + dx;
    }
    // 北侧手柄：上边界移动
    if (handle === 'nw' || handle === 'n' || handle === 'ne') {
      newY = this.resizeOriginalY + dy;
      newHeight = this.resizeOriginalHeight - dy;
    }
    // 南侧手柄：下边界移动
    if (handle === 'sw' || handle === 's' || handle === 'se') {
      newHeight = this.resizeOriginalHeight + dy;
    }

    // 钳制最小尺寸
    if (newWidth < MIN_WIDTH) {
      // 如果是从左侧缩放，需要调整 X 坐标
      if (handle === 'nw' || handle === 'w' || handle === 'sw') {
        newX = this.resizeOriginalX + this.resizeOriginalWidth - MIN_WIDTH;
      }
      newWidth = MIN_WIDTH;
    }
    if (newHeight < MIN_HEIGHT) {
      // 如果是从上侧缩放，需要调整 Y 坐标
      if (handle === 'nw' || handle === 'n' || handle === 'ne') {
        newY = this.resizeOriginalY + this.resizeOriginalHeight - MIN_HEIGHT;
      }
      newHeight = MIN_HEIGHT;
    }

    // 钳制位置到可视区域边界内
    newX = Math.max(0, newX);
    newY = Math.max(0, newY);

    this.chartModel.updateChart(this.selectedChartId, {
      position: { x: newX, y: newY },
      size: { width: newWidth, height: newHeight },
    });
  }

  /**
   * 绘制选中状态：蓝色边框和八个缩放手柄
   */
  private renderSelection(
    ctx: CanvasRenderingContext2D,
    renderX: number,
    renderY: number,
    width: number,
    height: number
  ): void {
    ctx.save();

    // 绘制蓝色边框
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(renderX, renderY, width, height);

    // 绘制八个缩放手柄（小方块）
    const midX = renderX + width / 2;
    const midY = renderY + height / 2;

    const handlePositions: Array<[number, number]> = [
      [renderX, renderY],                   // nw
      [midX, renderY],                      // n
      [renderX + width, renderY],           // ne
      [renderX + width, midY],              // e
      [renderX + width, renderY + height],  // se
      [midX, renderY + height],             // s
      [renderX, renderY + height],          // sw
      [renderX, midY],                      // w
    ];

    const halfHandle = HANDLE_SIZE / 2;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1;

    for (const [hx, hy] of handlePositions) {
      ctx.fillRect(hx - halfHandle, hy - halfHandle, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(hx - halfHandle, hy - halfHandle, HANDLE_SIZE, HANDLE_SIZE);
    }

    ctx.restore();
  }
}
