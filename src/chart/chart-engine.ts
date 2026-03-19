// ============================================================
// 图表渲染引擎 — 将图表配置和数据转换为 Canvas 2D 绘制指令
// ============================================================

import type {
  ChartConfig,
  ChartData,
  ChartArea,
  ChartType,
  AxesConfig,
  LegendConfig,
  TitleConfig,
  DataLabelConfig,
  ThemeColors,
  DataPoint,
  SeriesInfo,
  SeriesData,
} from './types';
import { CHART_COLORS_LIGHT } from './types';

// 图表内边距常量
const PADDING_TOP = 10;
const PADDING_RIGHT = 15;
const PADDING_BOTTOM = 10;
const PADDING_LEFT = 15;

// 标题区域高度
const TITLE_HEIGHT = 30;

// 图例区域高度/宽度
const LEGEND_HEIGHT = 25;
const LEGEND_WIDTH = 80;

// 坐标轴标签区域
const AXIS_LABEL_HEIGHT = 25;
const AXIS_LABEL_WIDTH = 45;

/**
 * 图表渲染引擎
 *
 * 负责将 ChartConfig + ChartData 转换为 Canvas 2D 绘制指令。
 * 按绘制顺序：背景 → 网格线 → 坐标轴 → 数据图形 → 数据标签 → 图例 → 标题
 */
export class ChartEngine {
  private ctx: CanvasRenderingContext2D;
  private themeColors: ThemeColors;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    // 默认使用亮色主题
    this.themeColors = {
      background: '#ffffff',
      foreground: '#333333',
      gridLine: '#e0e0e0',
      chartColors: CHART_COLORS_LIGHT,
    };
  }

  /**
   * 设置主题颜色
   */
  setThemeColors(colors: ThemeColors): void {
    this.themeColors = colors;
  }

  /**
   * 渲染单个图表（入口方法）
   *
   * 计算绘制区域，按顺序调用各绘制方法：
   * 背景 → 网格线 → 坐标轴 → 数据图形 → 数据标签 → 图例 → 标题
   */
  render(
    config: ChartConfig,
    data: ChartData,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const { ctx } = this;

    ctx.save();

    // 计算图表绘制区域（含内边距和各组件占位）
    const area = this.calculateChartArea(config, x, y, width, height);

    // 1. 绘制背景
    this.renderBackground(x, y, width, height);

    // 如果没有有效数据，显示占位提示
    if (!data.hasData) {
      this.renderNoDataPlaceholder(area);
      ctx.restore();
      return;
    }

    // 2. 绘制网格线
    this.renderGridLines(area, config.axes);

    // 3. 绘制坐标轴
    this.renderAxes(area, config.axes);

    // 4. 根据图表类型分发到对应绘制方法
    const dataPoints = this.dispatchRender(config.type, data, area);

    // 5. 绘制数据标签
    if (config.dataLabels.visible) {
      this.renderDataLabels(area, dataPoints, config.dataLabels);
    }

    // 6. 绘制图例
    if (config.legend.visible) {
      const seriesInfos: SeriesInfo[] = data.series.map((s) => ({
        name: s.name,
        color: s.color,
      }));
      this.renderLegend(area, seriesInfos, config.legend);
    }

    // 7. 绘制标题
    if (config.title.visible) {
      this.renderTitle(area, config.title);
    }

    ctx.restore();
  }

  // ============================================================
  // 图表类型分发和具体绘制方法（桩方法，后续任务实现）
  // ============================================================

  /**
   * 根据图表类型分发到对应绘制方法
   * 返回数据点数组，用于后续数据标签绘制
   */
  private dispatchRender(
    type: ChartType,
    data: ChartData,
    area: ChartArea
  ): DataPoint[] {
    switch (type) {
      case 'bar':
        return this.renderBarChart(data, area);
      case 'line':
        return this.renderLineChart(data, area);
      case 'pie':
        return this.renderPieChart(data, area);
      case 'scatter':
        return this.renderScatterChart(data, area);
      case 'area':
        return this.renderAreaChart(data, area);
    }
  }

  /**
   * 绘制柱状图
   *
   * 多系列并排排列，每系列使用不同颜色区分。
   * 同一类别的柱子紧邻排列，类别之间留有间距。
   */
  private renderBarChart(data: ChartData, area: ChartArea): DataPoint[] {
    const { ctx } = this;
    const { plotX, plotY, plotWidth, plotHeight } = area;
    const { categories, series } = data;
    const dataPoints: DataPoint[] = [];

    if (categories.length === 0 || series.length === 0) {
      return dataPoints;
    }

    // 计算数据范围（Y 轴）
    const { minVal, maxVal } = this.computeValueRange(series);

    // 类别间距和柱子宽度
    const categoryCount = categories.length;
    const seriesCount = series.length;
    const categoryWidth = plotWidth / categoryCount;
    const groupPadding = categoryWidth * 0.2; // 类别间距占 20%
    const groupWidth = categoryWidth - groupPadding;
    const barWidth = groupWidth / seriesCount;
    const barGap = 1; // 柱子间 1px 间隙

    ctx.save();

    for (let si = 0; si < seriesCount; si++) {
      const s = series[si];
      ctx.fillStyle = s.color;

      for (let ci = 0; ci < categories.length; ci++) {
        const value = ci < s.values.length ? s.values[ci] : 0;

        // 柱子 X 坐标
        const barX = plotX + ci * categoryWidth + groupPadding / 2 + si * barWidth + barGap / 2;
        const actualBarWidth = barWidth - barGap;

        // 柱子高度（按比例映射到绘图区域）
        const ratio = maxVal === minVal ? 0.5 : (value - minVal) / (maxVal - minVal);
        const barHeight = ratio * plotHeight;
        const barY = plotY + plotHeight - barHeight;

        ctx.fillRect(barX, barY, actualBarWidth, barHeight);

        // 记录数据点（柱子顶部中心）
        dataPoints.push({
          x: barX + actualBarWidth / 2,
          y: barY,
          value,
          category: categories[ci],
          seriesName: s.name,
        });
      }
    }

    ctx.restore();
    return dataPoints;
  }

  /**
   * 绘制折线图
   *
   * 多系列使用不同颜色，在数据点处绘制圆形标记。
   */
  private renderLineChart(data: ChartData, area: ChartArea): DataPoint[] {
    const { ctx } = this;
    const { plotX, plotY, plotWidth, plotHeight } = area;
    const { categories, series } = data;
    const dataPoints: DataPoint[] = [];

    if (categories.length === 0 || series.length === 0) {
      return dataPoints;
    }

    // 计算数据范围（Y 轴）
    const { minVal, maxVal } = this.computeValueRange(series);
    const categoryCount = categories.length;
    const pointRadius = 3;

    ctx.save();

    for (const s of series) {
      const points: Array<{ px: number; py: number }> = [];

      // 计算每个数据点的像素坐标
      for (let ci = 0; ci < categoryCount; ci++) {
        const value = ci < s.values.length ? s.values[ci] : 0;
        const px = plotX + (ci + 0.5) * (plotWidth / categoryCount);
        const ratio = maxVal === minVal ? 0.5 : (value - minVal) / (maxVal - minVal);
        const py = plotY + plotHeight - ratio * plotHeight;
        points.push({ px, py });

        dataPoints.push({
          x: px,
          y: py,
          value,
          category: categories[ci],
          seriesName: s.name,
        });
      }

      // 绘制折线
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const { px, py } = points[i];
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      // 绘制数据点标记（圆形）
      ctx.fillStyle = s.color;
      for (const { px, py } of points) {
        ctx.beginPath();
        ctx.arc(px, py, pointRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
    return dataPoints;
  }

  /**
   * 绘制饼图
   *
   * 按数据值比例计算每个扇区角度，不同颜色填充。
   * 仅使用第一个系列的数据。
   */
  private renderPieChart(data: ChartData, area: ChartArea): DataPoint[] {
    const { ctx } = this;
    const { plotX, plotY, plotWidth, plotHeight } = area;
    const { categories, series } = data;
    const dataPoints: DataPoint[] = [];

    if (series.length === 0 || series[0].values.length === 0) {
      return dataPoints;
    }

    const values = series[0].values;
    const colors = this.themeColors.chartColors;

    // 计算总和（取绝对值）
    let total = 0;
    for (const v of values) {
      total += Math.abs(v);
    }

    if (total === 0) {
      return dataPoints;
    }

    // 饼图中心和半径
    const centerX = plotX + plotWidth / 2;
    const centerY = plotY + plotHeight / 2;
    const radius = Math.min(plotWidth, plotHeight) / 2 * 0.85;

    ctx.save();

    let startAngle = -Math.PI / 2; // 从顶部开始

    for (let i = 0; i < values.length; i++) {
      const value = Math.abs(values[i]);
      const sliceAngle = (value / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;

      // 绘制扇区
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();

      // 绘制扇区边框
      ctx.strokeStyle = this.themeColors.background;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 数据点位于扇区中心角方向、半径 2/3 处
      const midAngle = startAngle + sliceAngle / 2;
      const labelRadius = radius * 0.67;
      const px = centerX + Math.cos(midAngle) * labelRadius;
      const py = centerY + Math.sin(midAngle) * labelRadius;

      dataPoints.push({
        x: px,
        y: py,
        value: values[i],
        category: i < categories.length ? categories[i] : `${i + 1}`,
        seriesName: series[0].name,
      });

      startAngle = endAngle;
    }

    ctx.restore();
    return dataPoints;
  }

  /**
   * 绘制散点图
   *
   * 圆形标记，X/Y 轴分别对应前两列数值。
   * 如果只有一个系列，X 为类别索引，Y 为值。
   */
  private renderScatterChart(data: ChartData, area: ChartArea): DataPoint[] {
    const { ctx } = this;
    const { plotX, plotY, plotWidth, plotHeight } = area;
    const { categories, series } = data;
    const dataPoints: DataPoint[] = [];
    const dotRadius = 4;

    if (series.length === 0) {
      return dataPoints;
    }

    ctx.save();

    // 如果有至少两个系列，第一个系列为 X 值，第二个为 Y 值
    if (series.length >= 2) {
      const xSeries = series[0];
      const ySeries = series[1];
      const count = Math.min(xSeries.values.length, ySeries.values.length);

      // 计算 X/Y 范围
      let xMin = Infinity, xMax = -Infinity;
      let yMin = Infinity, yMax = -Infinity;
      for (let i = 0; i < count; i++) {
        const xv = xSeries.values[i];
        const yv = ySeries.values[i];
        if (xv < xMin) xMin = xv;
        if (xv > xMax) xMax = xv;
        if (yv < yMin) yMin = yv;
        if (yv > yMax) yMax = yv;
      }
      if (xMin === xMax) { xMin -= 1; xMax += 1; }
      if (yMin === yMax) { yMin -= 1; yMax += 1; }

      ctx.fillStyle = ySeries.color;

      for (let i = 0; i < count; i++) {
        const xv = xSeries.values[i];
        const yv = ySeries.values[i];
        const px = plotX + ((xv - xMin) / (xMax - xMin)) * plotWidth;
        const py = plotY + plotHeight - ((yv - yMin) / (yMax - yMin)) * plotHeight;

        ctx.beginPath();
        ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        dataPoints.push({
          x: px,
          y: py,
          value: yv,
          category: i < categories.length ? categories[i] : `${i + 1}`,
          seriesName: ySeries.name,
        });
      }
    } else {
      // 单系列：X 为类别索引，Y 为值
      const s = series[0];
      const { minVal, maxVal } = this.computeValueRange(series);

      ctx.fillStyle = s.color;

      for (let i = 0; i < s.values.length; i++) {
        const value = s.values[i];
        const px = plotX + (i + 0.5) * (plotWidth / s.values.length);
        const ratio = maxVal === minVal ? 0.5 : (value - minVal) / (maxVal - minVal);
        const py = plotY + plotHeight - ratio * plotHeight;

        ctx.beginPath();
        ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        dataPoints.push({
          x: px,
          y: py,
          value,
          category: i < categories.length ? categories[i] : `${i + 1}`,
          seriesName: s.name,
        });
      }
    }

    ctx.restore();
    return dataPoints;
  }

  /**
   * 绘制面积图
   *
   * 折线下方填充半透明颜色区域，多系列叠加显示。
   */
  private renderAreaChart(data: ChartData, area: ChartArea): DataPoint[] {
    const { ctx } = this;
    const { plotX, plotY, plotWidth, plotHeight } = area;
    const { categories, series } = data;
    const dataPoints: DataPoint[] = [];

    if (categories.length === 0 || series.length === 0) {
      return dataPoints;
    }

    const { minVal, maxVal } = this.computeValueRange(series);
    const categoryCount = categories.length;
    const baselineY = plotY + plotHeight;

    ctx.save();

    for (const s of series) {
      const points: Array<{ px: number; py: number }> = [];

      // 计算每个数据点的像素坐标
      for (let ci = 0; ci < categoryCount; ci++) {
        const value = ci < s.values.length ? s.values[ci] : 0;
        const px = plotX + (ci + 0.5) * (plotWidth / categoryCount);
        const ratio = maxVal === minVal ? 0.5 : (value - minVal) / (maxVal - minVal);
        const py = plotY + plotHeight - ratio * plotHeight;
        points.push({ px, py });

        dataPoints.push({
          x: px,
          y: py,
          value,
          category: categories[ci],
          seriesName: s.name,
        });
      }

      // 绘制半透明填充区域
      ctx.fillStyle = this.hexToRgba(s.color, 0.3);
      ctx.beginPath();
      ctx.moveTo(points[0].px, baselineY);
      for (const { px, py } of points) {
        ctx.lineTo(px, py);
      }
      ctx.lineTo(points[points.length - 1].px, baselineY);
      ctx.closePath();
      ctx.fill();

      // 绘制折线
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const { px, py } = points[i];
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }

    ctx.restore();
    return dataPoints;
  }

  /**
   * 将十六进制颜色转换为 rgba 格式
   */
  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ============================================================
  // 公共辅助绘制方法
  // ============================================================

  /**
   * 计算所有系列的数值范围
   *
   * 遍历所有系列的所有值，返回最小值和最大值。
   * 如果最小值大于 0，则将最小值设为 0（使柱状图从零开始）。
   */
  private computeValueRange(series: SeriesData[]): { minVal: number; maxVal: number } {
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const s of series) {
      for (const v of s.values) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
    }

    // 如果所有值相同或无数据，设置默认范围
    if (!isFinite(minVal) || !isFinite(maxVal)) {
      return { minVal: 0, maxVal: 1 };
    }

    // 最小值大于 0 时从零开始
    if (minVal > 0) {
      minVal = 0;
    }

    // 最大值等于最小值时扩展范围
    if (maxVal === minVal) {
      maxVal = minVal + 1;
    }

    return { minVal, maxVal };
  }

  /**
   * 计算图表绘制区域
   *
   * 根据标题、图例、坐标轴的可见性和位置，计算出实际绑图区域（plotArea）。
   */
  private calculateChartArea(
    config: ChartConfig,
    x: number,
    y: number,
    width: number,
    height: number
  ): ChartArea {
    let plotX = x + PADDING_LEFT + AXIS_LABEL_WIDTH;
    let plotY = y + PADDING_TOP;
    let plotWidth = width - PADDING_LEFT - PADDING_RIGHT - AXIS_LABEL_WIDTH;
    let plotHeight = height - PADDING_TOP - PADDING_BOTTOM - AXIS_LABEL_HEIGHT;

    // 标题占位
    if (config.title.visible) {
      if (config.title.position === 'top') {
        plotY += TITLE_HEIGHT;
        plotHeight -= TITLE_HEIGHT;
      } else {
        plotHeight -= TITLE_HEIGHT;
      }
    }

    // 图例占位
    if (config.legend.visible) {
      const { position } = config.legend;
      if (position === 'top') {
        plotY += LEGEND_HEIGHT;
        plotHeight -= LEGEND_HEIGHT;
      } else if (position === 'bottom') {
        plotHeight -= LEGEND_HEIGHT;
      } else if (position === 'left') {
        plotX += LEGEND_WIDTH;
        plotWidth -= LEGEND_WIDTH;
      } else if (position === 'right') {
        plotWidth -= LEGEND_WIDTH;
      }
    }

    // 确保绘图区域不为负值
    plotWidth = Math.max(plotWidth, 0);
    plotHeight = Math.max(plotHeight, 0);

    return { x, y, width, height, plotX, plotY, plotWidth, plotHeight };
  }

  /**
   * 绘制图表背景
   */
  private renderBackground(
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const { ctx, themeColors } = this;
    ctx.fillStyle = themeColors.background;
    ctx.fillRect(x, y, width, height);

    // 绘制边框
    ctx.strokeStyle = themeColors.gridLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }

  /**
   * 绘制"暂无数据"占位提示
   */
  private renderNoDataPlaceholder(area: ChartArea): void {
    const { ctx, themeColors } = this;
    ctx.fillStyle = themeColors.foreground;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '暂无数据',
      area.plotX + area.plotWidth / 2,
      area.plotY + area.plotHeight / 2
    );
  }

  /**
   * 绘制网格线
   *
   * 根据 AxesConfig 中 xAxis/yAxis 的 showGridLines 设置绘制水平和垂直网格线。
   */
  private renderGridLines(area: ChartArea, config: AxesConfig): void {
    const { ctx, themeColors } = this;
    const { plotX, plotY, plotWidth, plotHeight } = area;
    const gridCount = 5; // 默认 5 条网格线

    ctx.save();
    ctx.strokeStyle = themeColors.gridLine;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);

    // 水平网格线（Y 轴方向）
    if (config.yAxis.showGridLines) {
      for (let i = 1; i < gridCount; i++) {
        const y = plotY + (plotHeight * i) / gridCount;
        ctx.beginPath();
        ctx.moveTo(plotX, y);
        ctx.lineTo(plotX + plotWidth, y);
        ctx.stroke();
      }
    }

    // 垂直网格线（X 轴方向）
    if (config.xAxis.showGridLines) {
      for (let i = 1; i < gridCount; i++) {
        const x = plotX + (plotWidth * i) / gridCount;
        ctx.beginPath();
        ctx.moveTo(x, plotY);
        ctx.lineTo(x, plotY + plotHeight);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * 绘制坐标轴
   *
   * 绘制 X 轴和 Y 轴的轴线、刻度标记和轴标题。
   */
  private renderAxes(area: ChartArea, config: AxesConfig): void {
    const { ctx, themeColors } = this;
    const { plotX, plotY, plotWidth, plotHeight } = area;

    ctx.save();
    ctx.strokeStyle = themeColors.foreground;
    ctx.fillStyle = themeColors.foreground;
    ctx.lineWidth = 1;

    // Y 轴线
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotHeight);
    ctx.stroke();

    // X 轴线
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotHeight);
    ctx.lineTo(plotX + plotWidth, plotY + plotHeight);
    ctx.stroke();

    // Y 轴刻度标记和标签
    const yTickCount = 5;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= yTickCount; i++) {
      const y = plotY + plotHeight - (plotHeight * i) / yTickCount;
      // 刻度线
      ctx.beginPath();
      ctx.moveTo(plotX - 4, y);
      ctx.lineTo(plotX, y);
      ctx.stroke();
    }

    // X 轴刻度线
    const xTickCount = 5;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= xTickCount; i++) {
      const x = plotX + (plotWidth * i) / xTickCount;
      ctx.beginPath();
      ctx.moveTo(x, plotY + plotHeight);
      ctx.lineTo(x, plotY + plotHeight + 4);
      ctx.stroke();
    }

    // Y 轴标题
    if (config.yAxis.title) {
      ctx.save();
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(area.x + 12, plotY + plotHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(config.yAxis.title, 0, 0);
      ctx.restore();
    }

    // X 轴标题
    if (config.xAxis.title) {
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        config.xAxis.title,
        plotX + plotWidth / 2,
        plotY + plotHeight + AXIS_LABEL_HEIGHT - 10
      );
    }

    ctx.restore();
  }

  /**
   * 绘制标题
   *
   * 根据 TitleConfig 在图表顶部或底部绘制标题文本。
   */
  private renderTitle(area: ChartArea, config: TitleConfig): void {
    if (!config.text) {
      return;
    }

    const { ctx, themeColors } = this;

    ctx.save();
    ctx.fillStyle = themeColors.foreground;
    ctx.font = `bold ${config.fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let titleY: number;
    if (config.position === 'top') {
      titleY = area.y + PADDING_TOP + TITLE_HEIGHT / 2;
    } else {
      titleY = area.y + area.height - PADDING_BOTTOM - TITLE_HEIGHT / 2;
    }

    ctx.fillText(config.text, area.x + area.width / 2, titleY);
    ctx.restore();
  }

  /**
   * 绘制图例
   *
   * 根据 LegendConfig 在指定位置绘制系列名称和颜色标记。
   */
  private renderLegend(
    area: ChartArea,
    series: SeriesInfo[],
    config: LegendConfig
  ): void {
    if (series.length === 0) {
      return;
    }

    const { ctx, themeColors } = this;
    const itemHeight = 16;
    const colorBoxSize = 10;
    const itemGap = 15;

    ctx.save();
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';

    const { position } = config;

    if (position === 'top' || position === 'bottom') {
      // 水平排列图例
      // 计算总宽度以居中
      let totalWidth = 0;
      const itemWidths: number[] = [];
      for (const s of series) {
        const textWidth = ctx.measureText(s.name).width;
        const w = colorBoxSize + 4 + textWidth;
        itemWidths.push(w);
        totalWidth += w;
      }
      totalWidth += (series.length - 1) * itemGap;

      let legendY: number;
      if (position === 'top') {
        legendY = area.plotY - LEGEND_HEIGHT + (LEGEND_HEIGHT - itemHeight) / 2 + itemHeight / 2;
      } else {
        legendY = area.plotY + area.plotHeight + AXIS_LABEL_HEIGHT + (LEGEND_HEIGHT - itemHeight) / 2 + itemHeight / 2;
      }

      let currentX = area.plotX + (area.plotWidth - totalWidth) / 2;

      for (let i = 0; i < series.length; i++) {
        const s = series[i];
        // 颜色方块
        ctx.fillStyle = s.color;
        ctx.fillRect(currentX, legendY - colorBoxSize / 2, colorBoxSize, colorBoxSize);
        // 系列名称
        ctx.fillStyle = themeColors.foreground;
        ctx.textAlign = 'left';
        ctx.fillText(s.name, currentX + colorBoxSize + 4, legendY);
        currentX += itemWidths[i] + itemGap;
      }
    } else {
      // 垂直排列图例（left / right）
      let legendX: number;
      if (position === 'left') {
        legendX = area.x + PADDING_LEFT;
      } else {
        legendX = area.plotX + area.plotWidth + 10;
      }

      let currentY = area.plotY + 5;

      for (const s of series) {
        // 颜色方块
        ctx.fillStyle = s.color;
        ctx.fillRect(legendX, currentY, colorBoxSize, colorBoxSize);
        // 系列名称
        ctx.fillStyle = themeColors.foreground;
        ctx.textAlign = 'left';
        ctx.fillText(s.name, legendX + colorBoxSize + 4, currentY + colorBoxSize / 2);
        currentY += itemHeight;
      }
    }

    ctx.restore();
  }

  /**
   * 绘制数据标签
   *
   * 在每个数据点位置上方绘制对应的标签文本。
   */
  private renderDataLabels(
    _area: ChartArea,
    points: DataPoint[],
    config: DataLabelConfig
  ): void {
    if (points.length === 0) {
      return;
    }

    const { ctx, themeColors } = this;

    ctx.save();
    ctx.fillStyle = themeColors.foreground;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // 计算所有数据点的总和（用于百分比计算）
    let total = 0;
    if (config.content === 'percentage') {
      for (const p of points) {
        total += Math.abs(p.value);
      }
    }

    for (const point of points) {
      let labelText: string;
      switch (config.content) {
        case 'value':
          labelText = String(point.value);
          break;
        case 'percentage':
          labelText = total > 0
            ? `${((Math.abs(point.value) / total) * 100).toFixed(1)}%`
            : '0%';
          break;
        case 'category':
          labelText = point.category;
          break;
      }

      ctx.fillText(labelText, point.x, point.y - 4);
    }

    ctx.restore();
  }
}
