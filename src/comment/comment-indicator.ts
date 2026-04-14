// ============================================================
// 评论指示器渲染
// 在有评论的单元格右上角绘制三角形标记
// ============================================================

import type { CommentModel } from './comment-model';
import type { Viewport, RenderConfig } from '../types';
import type { SpreadsheetModel } from '../model';

/** 评论指示器颜色 */
const COMMENT_COLOR = '#7C3AED';         // 紫色（未解决）
const COMMENT_RESOLVED_COLOR = '#9CA3AF'; // 灰色（已解决）
const TRIANGLE_SIZE = 8;                  // 三角形边长（像素）

/**
 * 评论指示器渲染器
 * 在 Canvas 上绘制评论标记三角形
 */
export class CommentIndicator {
  private commentModel: CommentModel;

  constructor(commentModel: CommentModel) {
    this.commentModel = commentModel;
  }

  /**
   * 渲染所有可见的评论指示器
   */
  public render(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    model: SpreadsheetModel,
    config: RenderConfig
  ): void {
    const { headerWidth, headerHeight } = config;
    const { scrollX, scrollY } = viewport;

    const commentedCells = this.commentModel.getCommentedCells();
    if (commentedCells.length === 0) return;

    ctx.save();

    for (const { row, col, resolved } of commentedCells) {
      // 检查是否在视口内
      if (row < viewport.startRow || row > viewport.endRow) continue;
      if (col < viewport.startCol || col > viewport.endCol) continue;

      // 计算单元格右上角坐标
      const cellX = headerWidth + model.getColX(col) - scrollX;
      const cellWidth = model.getColWidth(col);
      const cellY = headerHeight + model.getRowY(row) - scrollY;

      const triangleX = cellX + cellWidth;
      const triangleY = cellY;

      // 绘制三角形
      ctx.fillStyle = resolved ? COMMENT_RESOLVED_COLOR : COMMENT_COLOR;
      ctx.beginPath();
      ctx.moveTo(triangleX - TRIANGLE_SIZE, triangleY);
      ctx.lineTo(triangleX, triangleY);
      ctx.lineTo(triangleX, triangleY + TRIANGLE_SIZE);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
