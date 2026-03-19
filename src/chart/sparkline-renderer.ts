// ============================================================
// 迷你图渲染器 — 在单元格内绘制小型图表
// ============================================================

import type { SparklineConfig, ThemeColors } from './types';

// 迷你图绘制区域（去除内边距后的实际绘制区域）
interface SparklineArea {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;          // 主色
  highlightMax: boolean;  // 是否高亮最大值
  highlightMin: boolean;  // 是否高亮最小值
}

// 内边距（像素）
const PADDING = 2;

/**
 * 迷你图渲染器
 * 所有方法均为静态，在 renderCells 阶段被调用
 */
export class SparklineRenderer {
  /**
   * 渲染迷你图到指定单元格区域
   * 根据 SparklineConfig.type 分发到对应的绘制方法
   */
  static render(
    ctx: CanvasRenderingContext2D,
    config: SparklineConfig,
    data: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    themeColors: ThemeColors
  ): void {
    // 空数据不绘制
    if (data.length === 0) {
      return;
    }

    // 确定主色：优先使用自定义颜色，否则使用主题色
    const color = config.color ?? themeColors.chartColors[0] ?? '#4285F4';

    // 计算去除 2px 内边距后的绘制区域
    const area: SparklineArea = {
      x: x + PADDING,
      y: y + PADDING,
      width: Math.max(width - PADDING * 2, 0),
      height: Math.max(height - PADDING * 2, 0),
      color,
      highlightMax: config.highlightMax ?? false,
      highlightMin: config.highlightMin ?? false,
    };

    // 绘制区域过小则跳过
    if (area.width <= 0 || area.height <= 0) {
      return;
    }

    // 根据类型分发绘制
    switch (config.type) {
      case 'line':
        SparklineRenderer.renderLineSparkline(ctx, data, area);
        break;
      case 'bar':
        SparklineRenderer.renderBarSparkline(ctx, data, area);
        break;
      case 'winLoss':
        SparklineRenderer.renderWinLossSparkline(ctx, data, area);
        break;
    }
  }

  /**
   * 折线迷你图：连接数据点的折线，可选高亮最大值/最小值
   */
  private static renderLineSparkline(
    ctx: CanvasRenderingContext2D,
    data: number[],
    area: SparklineArea
  ): void {
    const { x, y, width, height, color, highlightMax, highlightMin } = area;
    const count = data.length;

    // 计算数据范围
    let minVal = data[0];
    let maxVal = data[0];
    for (let i = 1; i < count; i++) {
      if (data[i] < minVal) minVal = data[i];
      if (data[i] > maxVal) maxVal = data[i];
    }
    const range = maxVal - minVal;

    // 将数据值映射到绘制区域的 Y 坐标
    const mapY = (val: number): number => {
      if (range === 0) {
        // 所有值相同时，绘制在中间
        return y + height / 2;
      }
      return y + height - ((val - minVal) / range) * height;
    };

    // 计算每个数据点的 X 坐标
    const mapX = (index: number): number => {
      if (count === 1) {
        return x + width / 2;
      }
      return x + (index / (count - 1)) * width;
    };

    // 绘制折线
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';

    for (let i = 0; i < count; i++) {
      const px = mapX(i);
      const py = mapY(data[i]);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // 高亮最大值（红色圆点）
    if (highlightMax) {
      // 找到第一个最大值的索引
      let maxIdx = 0;
      for (let i = 1; i < count; i++) {
        if (data[i] > data[maxIdx]) maxIdx = i;
      }
      ctx.beginPath();
      ctx.arc(mapX(maxIdx), mapY(data[maxIdx]), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#EA4335';
      ctx.fill();
    }

    // 高亮最小值（蓝色圆点）
    if (highlightMin) {
      // 找到第一个最小值的索引
      let minIdx = 0;
      for (let i = 1; i < count; i++) {
        if (data[i] < data[minIdx]) minIdx = i;
      }
      ctx.beginPath();
      ctx.arc(mapX(minIdx), mapY(data[minIdx]), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#4285F4';
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * 柱状迷你图：等宽柱子，正值向上负值向下，零线基准
   */
  private static renderBarSparkline(
    ctx: CanvasRenderingContext2D,
    data: number[],
    area: SparklineArea
  ): void {
    const { x, y, width, height, color } = area;
    const count = data.length;

    // 计算数据范围
    let minVal = data[0];
    let maxVal = data[0];
    for (let i = 1; i < count; i++) {
      if (data[i] < minVal) minVal = data[i];
      if (data[i] > maxVal) maxVal = data[i];
    }

    // 确定零线位置：需要同时容纳正值和负值
    // 如果全部为正值，零线在底部；全部为负值，零线在顶部
    const effectiveMin = Math.min(minVal, 0);
    const effectiveMax = Math.max(maxVal, 0);
    const totalRange = effectiveMax - effectiveMin;

    // 零线的 Y 坐标
    const zeroY = totalRange === 0
      ? y + height / 2
      : y + (effectiveMax / totalRange) * height;

    // 每根柱子的宽度（留 1px 间距）
    const barWidth = Math.max((width / count) - 1, 1);
    const gap = 1;

    ctx.save();
    ctx.fillStyle = color;

    for (let i = 0; i < count; i++) {
      const barX = x + i * (barWidth + gap);
      const val = data[i];

      if (totalRange === 0) {
        // 所有值相同且为 0，绘制一条细线
        ctx.fillRect(barX, zeroY - 0.5, barWidth, 1);
        continue;
      }

      const barHeight = (Math.abs(val) / totalRange) * height;

      if (val >= 0) {
        // 正值：从零线向上
        ctx.fillRect(barX, zeroY - barHeight, barWidth, barHeight);
      } else {
        // 负值：从零线向下
        ctx.fillRect(barX, zeroY, barWidth, barHeight);
      }
    }

    ctx.restore();
  }

  /**
   * 盈亏迷你图：正值上方等高色块、负值下方等高色块
   */
  private static renderWinLossSparkline(
    ctx: CanvasRenderingContext2D,
    data: number[],
    area: SparklineArea
  ): void {
    const { x, y, width, height, color } = area;
    const count = data.length;

    // 中线将区域分为上下两半
    const midY = y + height / 2;
    const halfHeight = height / 2;

    // 每个色块的宽度（留 1px 间距）
    const blockWidth = Math.max((width / count) - 1, 1);
    const gap = 1;

    // 色块高度为半区域高度的 80%，留一点视觉间距
    const blockHeight = halfHeight * 0.8;

    ctx.save();

    for (let i = 0; i < count; i++) {
      const blockX = x + i * (blockWidth + gap);
      const val = data[i];

      if (val > 0) {
        // 正值：上方色块（主色）
        ctx.fillStyle = color;
        ctx.fillRect(blockX, midY - blockHeight, blockWidth, blockHeight);
      } else if (val < 0) {
        // 负值：下方色块（使用较浅的红色区分）
        ctx.fillStyle = '#EA4335';
        ctx.fillRect(blockX, midY, blockWidth, blockHeight);
      }
      // 零值不绘制
    }

    ctx.restore();
  }
}
