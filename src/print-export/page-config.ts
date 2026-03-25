// ============================================================
// 页面配置模块 — 管理打印页面参数与分页计算
// ============================================================

import type {
  PaperSize,
  Orientation,
  PageMargins,
  PageConfigData,
  PageBreakResult,
  PageData,
} from './types';
import { PAPER_DIMENSIONS } from './types';

/** 像素到毫米的转换系数（基于 96 DPI：1px ≈ 0.2646mm） */
const PX_TO_MM = 25.4 / 96;

/** 边距最小值（mm） */
const MARGIN_MIN = 0;

/** 边距最大值（mm） */
const MARGIN_MAX = 100;

/**
 * 将数值钳制到 [min, max] 范围内
 */
const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * 钳制边距值到有效范围 [0, 100]
 */
const clampMargins = (margins: PageMargins): PageMargins => ({
  top: clamp(margins.top, MARGIN_MIN, MARGIN_MAX),
  bottom: clamp(margins.bottom, MARGIN_MIN, MARGIN_MAX),
  left: clamp(margins.left, MARGIN_MIN, MARGIN_MAX),
  right: clamp(margins.right, MARGIN_MIN, MARGIN_MAX),
});

/**
 * PageConfig — 页面配置类
 *
 * 负责管理打印页面参数（纸张大小、方向、边距），
 * 提供内容区域计算和分页断点计算能力。
 */
export class PageConfig {
  paperSize: PaperSize;
  orientation: Orientation;
  margins: PageMargins;

  constructor(
    paperSize: PaperSize = 'A4',
    orientation: Orientation = 'portrait',
    margins: PageMargins = { top: 20, bottom: 20, left: 15, right: 15 }
  ) {
    this.paperSize = paperSize;
    this.orientation = orientation;
    // 构造时即钳制边距值
    this.margins = clampMargins(margins);
  }

  /**
   * 获取可用打印区域尺寸（扣除边距后），单位 mm。
   *
   * 横向模式下纸张宽高互换，边距也随之旋转：
   * - 纵向的 top/bottom 对应横向的 left/right
   * - 纵向的 left/right 对应横向的 top/bottom
   *
   * 这保证了：portrait.contentWidth === landscape.contentHeight，
   * portrait.contentHeight === landscape.contentWidth（属性 1）。
   */
  getContentArea(): { width: number; height: number } {
    const paper = PAPER_DIMENSIONS[this.paperSize];

    if (this.orientation === 'landscape') {
      // 横向：纸张宽高互换，边距也旋转
      const width = paper.height - this.margins.top - this.margins.bottom;
      const height = paper.width - this.margins.left - this.margins.right;
      return { width, height };
    }

    // 纵向：标准布局
    const width = paper.width - this.margins.left - this.margins.right;
    const height = paper.height - this.margins.top - this.margins.bottom;
    return { width, height };
  }

  /**
   * 根据行高/列宽计算分页断点。
   *
   * 行高和列宽单位为像素，内部转换为毫米后与内容区域比较。
   * 确保每页的行高之和 ≤ 内容区域高度，列宽之和 ≤ 内容区域宽度。
   *
   * @param rowHeights - 每行的高度数组（px）
   * @param colWidths  - 每列的宽度数组（px）
   * @param startRow   - 起始行索引
   * @param endRow     - 结束行索引（包含）
   * @param startCol   - 起始列索引
   * @param endCol     - 结束列索引（包含）
   */
  calculatePageBreaks(
    rowHeights: number[],
    colWidths: number[],
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number
  ): PageBreakResult {
    const { width: contentWidth, height: contentHeight } = this.getContentArea();

    // 计算列分页断点（列索引数组，每个元素是该页的起始列）
    const colBreaks = this.calculateBreaks(
      colWidths,
      startCol,
      endCol,
      contentWidth
    );

    // 计算行分页断点
    const rowBreaks = this.calculateBreaks(
      rowHeights,
      startRow,
      endRow,
      contentHeight
    );

    // 组合行列分页，生成页面数据
    const pages: PageData[] = [];
    for (const rowRange of rowBreaks) {
      for (const colRange of colBreaks) {
        pages.push({
          rowStart: rowRange.start,
          rowEnd: rowRange.end,
          colStart: colRange.start,
          colEnd: colRange.end,
        });
      }
    }

    return {
      pages,
      totalPages: pages.length,
    };
  }

  /**
   * 序列化为 JSON（用于持久化）
   */
  serialize(): PageConfigData {
    return {
      paperSize: this.paperSize,
      orientation: this.orientation,
      margins: { ...this.margins },
    };
  }

  /**
   * 从 JSON 反序列化
   */
  static deserialize(data: PageConfigData): PageConfig {
    return new PageConfig(data.paperSize, data.orientation, data.margins);
  }

  /**
   * 计算单维度（行或列）的分页断点。
   *
   * 贪心算法：从起始索引开始累加尺寸（px → mm），
   * 当累加值超过可用空间时产生分页断点。
   * 如果单个元素超过可用空间，仍将其单独放在一页中。
   *
   * @param sizes       - 尺寸数组（px）
   * @param startIndex  - 起始索引
   * @param endIndex    - 结束索引（包含）
   * @param limitMm     - 可用空间（mm）
   * @returns 每页的起止索引范围数组
   */
  private calculateBreaks(
    sizes: number[],
    startIndex: number,
    endIndex: number,
    limitMm: number
  ): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];

    // 无有效范围时返回空
    if (startIndex > endIndex) {
      return ranges;
    }

    let pageStart = startIndex;
    let accumulatedMm = 0;

    for (let i = startIndex; i <= endIndex; i++) {
      const sizePx = sizes[i] ?? 0;
      const sizeMm = sizePx * PX_TO_MM;

      // 如果加上当前元素会超出限制
      if (accumulatedMm + sizeMm > limitMm && i > pageStart) {
        // 当前页到前一个元素为止
        ranges.push({ start: pageStart, end: i - 1 });
        pageStart = i;
        accumulatedMm = sizeMm;
      } else {
        accumulatedMm += sizeMm;
      }
    }

    // 最后一页
    if (pageStart <= endIndex) {
      ranges.push({ start: pageStart, end: endIndex });
    }

    return ranges;
  }
}
