/**
 * DirtyRegionTracker - 脏区域追踪器
 *
 * 负责收集数据变更产生的脏区域（需要重绘的 Canvas 矩形区域），
 * 在 requestAnimationFrame 中批量处理，实现增量渲染。
 *
 * 核心逻辑：
 * - 单元格内容或样式变更时，将对应矩形区域加入脏区域队列
 * - 合并单元格变更时，将整个合并区域作为一个脏区域
 * - 脏区域总面积超过 Canvas 面积 50% 或处于滚动状态时，回退为全量重绘
 * - 使用 requestAnimationFrame 调度重绘，避免同一帧内多次重绘
 *
 * 需求：3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

/** 脏区域矩形（像素坐标） */
export interface DirtyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class DirtyRegionTracker {
  /** 待重绘的脏区域队列 */
  private dirtyRects: DirtyRect[];

  /** 当前是否处于滚动状态（滚动时强制全量重绘） */
  private isScrolling: boolean;

  /** Canvas 总面积（像素），用于判断是否需要全量重绘 */
  private canvasArea: number;

  /** requestAnimationFrame 返回的 ID，用于取消调度 */
  private rafId: number | null;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.dirtyRects = [];
    this.isScrolling = false;
    this.canvasArea = canvasWidth * canvasHeight;
    this.rafId = null;
  }

  /**
   * 标记单元格为脏区域
   * 将单元格对应的矩形区域加入脏区域队列，等待下一帧重绘
   *
   * @param _row - 单元格行索引（用于标识，不参与矩形计算）
   * @param _col - 单元格列索引（用于标识，不参与矩形计算）
   * @param x - 脏区域左上角 X 坐标（Canvas 像素）
   * @param y - 脏区域左上角 Y 坐标（Canvas 像素）
   * @param width - 脏区域宽度
   * @param height - 脏区域高度
   */
  markDirty(
    _row: number,
    _col: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    this.dirtyRects.push({ x, y, width, height });
  }

  /**
   * 标记合并单元格为脏区域
   * 将整个合并区域作为一个脏区域矩形加入队列
   *
   * @param _startRow - 合并区域起始行（用于标识，不参与矩形计算）
   * @param _startCol - 合并区域起始列（用于标识，不参与矩形计算）
   * @param x - 合并区域左上角 X 坐标（Canvas 像素）
   * @param y - 合并区域左上角 Y 坐标（Canvas 像素）
   * @param width - 合并区域总宽度
   * @param height - 合并区域总高度
   */
  markMergedDirty(
    _startRow: number,
    _startCol: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    this.dirtyRects.push({ x, y, width, height });
  }

  /**
   * 设置滚动状态
   * 滚动时强制使用全量重绘，增量渲染仅适用于非滚动场景
   *
   * @param scrolling - 是否正在滚动
   */
  setScrolling(scrolling: boolean): void {
    this.isScrolling = scrolling;
  }

  /**
   * 判断是否应该全量重绘
   *
   * 满足以下任一条件时返回 true：
   * - 当前处于滚动状态
   * - 脏区域总面积超过 Canvas 面积的 50%
   *
   * @returns 是否需要全量重绘
   */
  shouldFullRedraw(): boolean {
    // 滚动状态下始终全量重绘
    if (this.isScrolling) {
      return true;
    }

    // 计算脏区域总面积
    let totalDirtyArea = 0;
    for (const rect of this.dirtyRects) {
      totalDirtyArea += rect.width * rect.height;
    }

    // 脏区域面积超过 Canvas 面积 50% 时全量重绘
    return totalDirtyArea > this.canvasArea * 0.5;
  }

  /**
   * 获取并清空脏区域队列
   * 返回当前所有待重绘的脏区域矩形，同时清空内部队列
   *
   * @returns 当前脏区域矩形数组
   */
  flush(): DirtyRect[] {
    const rects = this.dirtyRects;
    this.dirtyRects = [];
    return rects;
  }

  /**
   * 调度下一帧重绘
   * 使用 requestAnimationFrame 确保在下一个渲染帧中执行回调，
   * 避免同一帧内多次重绘。如果已有调度中的重绘，先取消再重新调度。
   *
   * @param callback - 重绘回调函数
   */
  scheduleRedraw(callback: () => void): void {
    // 取消已有的调度，确保只有最新的回调被执行
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      callback();
    });
  }

  /**
   * 更新 Canvas 尺寸
   * 窗口缩放或 DPR 变化时调用，重新计算 Canvas 总面积
   *
   * @param width - Canvas 宽度（CSS 像素）
   * @param height - Canvas 高度（CSS 像素）
   */
  updateCanvasSize(width: number, height: number): void {
    this.canvasArea = width * height;
  }
}
