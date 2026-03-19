// ============================================================
// 列头指示器 - 在列头区域绘制排序/筛选状态图标
// ============================================================

import type { SortDirection } from './types';

// 筛选图标尺寸常量
const ICON_SIZE = 14;
const ICON_PADDING = 4;

export class ColumnHeaderIndicator {
  /**
   * 绘制筛选漏斗图标
   * 激活时使用高亮色，未激活时使用灰色
   */
  static renderFilterIcon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    isActive: boolean
  ): void {
    const iconX = x + width - ICON_SIZE - ICON_PADDING;
    const iconY = y + (height - ICON_SIZE) / 2;
    const s = ICON_SIZE;

    ctx.save();
    ctx.beginPath();
    // 漏斗形状：上宽下窄
    ctx.moveTo(iconX + 1, iconY + 2);
    ctx.lineTo(iconX + s - 1, iconY + 2);
    ctx.lineTo(iconX + s * 0.6, iconY + s * 0.5);
    ctx.lineTo(iconX + s * 0.6, iconY + s - 2);
    ctx.lineTo(iconX + s * 0.4, iconY + s - 2);
    ctx.lineTo(iconX + s * 0.4, iconY + s * 0.5);
    ctx.closePath();

    ctx.fillStyle = isActive ? '#4285f4' : '#999999';
    ctx.fill();
    ctx.restore();
  }

  /**
   * 绘制排序方向箭头
   * 升序向上，降序向下
   */
  static renderSortArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    direction: SortDirection
  ): void {
    // 箭头绘制在筛选图标左侧
    const arrowSize = 8;
    const arrowX = x + width - ICON_SIZE - ICON_PADDING - arrowSize - 4;
    const arrowY = y + (height - arrowSize) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = '#4285f4';

    if (direction === 'asc') {
      // 向上箭头
      ctx.moveTo(arrowX + arrowSize / 2, arrowY);
      ctx.lineTo(arrowX + arrowSize, arrowY + arrowSize);
      ctx.lineTo(arrowX, arrowY + arrowSize);
    } else {
      // 向下箭头
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX + arrowSize, arrowY);
      ctx.lineTo(arrowX + arrowSize / 2, arrowY + arrowSize);
    }

    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * 检测点击是否命中筛选图标区域（列头右侧 ~16x16 区域）
   */
  static hitTestFilterIcon(
    clickX: number,
    clickY: number,
    colX: number,
    colY: number,
    colWidth: number,
    headerHeight: number
  ): boolean {
    const iconX = colX + colWidth - ICON_SIZE - ICON_PADDING;
    const iconY = colY + (headerHeight - ICON_SIZE) / 2;

    return (
      clickX >= iconX &&
      clickX <= iconX + ICON_SIZE + ICON_PADDING &&
      clickY >= iconY &&
      clickY <= iconY + ICON_SIZE
    );
  }
}
