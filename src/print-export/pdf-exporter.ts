// ============================================================
// PDF 导出模块 — 基于 jsPDF 库
// 支持分页、页眉页脚、打印区域过滤、边框样式、中文字符
// ============================================================

import { jsPDF } from 'jspdf';
import type { Cell, BorderSide } from '../types';
import type { PageData, HeaderFooterSection } from './types';
import { PAPER_DIMENSIONS } from './types';
import type { PageConfig } from './page-config';
import type { HeaderFooter } from './header-footer';
import type { PrintArea } from './print-area';

// ============================================================
// 最小接口定义 — 避免循环依赖
// ============================================================

/** SpreadsheetModel 最小接口 */
interface SpreadsheetModelLike {
  cells: Cell[][];
  getRowCount(): number;
  getColCount(): number;
  getRowHeight(row: number): number;
  getColWidth(col: number): number;
}

// ============================================================
// 常量
// ============================================================

/** 像素到毫米的转换系数（基于 96 DPI） */
const PX_TO_MM = 25.4 / 96;

/** 页眉页脚字体大小（pt） */
const HEADER_FOOTER_FONT_SIZE = 9;

/** 页眉页脚区域高度（mm） */
const HEADER_FOOTER_HEIGHT = 8;

/** 默认单元格字体大小（pt） */
const DEFAULT_FONT_SIZE = 11;

/** 单元格内边距（mm） */
const CELL_PADDING = 1;

// ============================================================
// 辅助函数
// ============================================================

/**
 * 解析 CSS 颜色字符串为 RGB 数组
 *
 * 支持格式：#RGB、#RRGGBB、rgb(r,g,b)、rgba(r,g,b,a)
 *
 * @returns [r, g, b] 数组（0-255），无法解析时返回 undefined
 */
function parseCssColor(cssColor: string): [number, number, number] | undefined {
  if (!cssColor) return undefined;
  const trimmed = cssColor.trim();

  // #RRGGBB 格式
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return [
      parseInt(trimmed.slice(1, 3), 16),
      parseInt(trimmed.slice(3, 5), 16),
      parseInt(trimmed.slice(5, 7), 16),
    ];
  }

  // #RGB 简写格式
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return [
      parseInt(`${r}${r}`, 16),
      parseInt(`${g}${g}`, 16),
      parseInt(`${b}${b}`, 16),
    ];
  }

  // rgb(r, g, b) 格式
  const rgbMatch = trimmed.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1], 10),
      parseInt(rgbMatch[2], 10),
      parseInt(rgbMatch[3], 10),
    ];
  }

  // rgba(r, g, b, a) 格式
  const rgbaMatch = trimmed.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/i);
  if (rgbaMatch) {
    return [
      parseInt(rgbaMatch[1], 10),
      parseInt(rgbaMatch[2], 10),
      parseInt(rgbaMatch[3], 10),
    ];
  }

  return undefined;
}

/**
 * 获取单元格的格式化显示值
 *
 * 处理逻辑：
 * 1. 合并单元格的非左上角位置 → 空字符串
 * 2. 有 format 和 rawValue → 简单格式化
 * 3. 其他情况 → 返回 cell.content
 */
function getDisplayValue(cell: Cell): string {
  // 合并单元格的非左上角位置输出空字符串
  if (cell.isMerged && cell.mergeParent) {
    return '';
  }

  // 有格式和原始数值时，进行简单格式化
  if (cell.format && cell.rawValue !== undefined) {
    return formatValue(cell.rawValue, cell.format);
  }

  return cell.content;
}

/**
 * 简单数值格式化
 */
function formatValue(
  rawValue: number,
  format: { category: string; pattern: string; currencySymbol?: string }
): string {
  const { category, pattern, currencySymbol } = format;

  switch (category) {
    case 'percentage': {
      const decimals = getDecimalPlaces(pattern);
      return `${(rawValue * 100).toFixed(decimals)}%`;
    }
    case 'currency': {
      const symbol = currencySymbol ?? '¥';
      const decimals = getDecimalPlaces(pattern);
      return `${symbol}${rawValue.toFixed(decimals)}`;
    }
    case 'number': {
      const decimals = getDecimalPlaces(pattern);
      return rawValue.toFixed(decimals);
    }
    case 'date':
    case 'time':
    case 'datetime': {
      return formatDate(rawValue, pattern);
    }
    case 'scientific': {
      const decimals = getDecimalPlaces(pattern);
      return rawValue.toExponential(decimals);
    }
    default:
      return String(rawValue);
  }
}

/** 从格式模式字符串中提取小数位数 */
function getDecimalPlaces(pattern: string): number {
  const dotIndex = pattern.indexOf('.');
  if (dotIndex === -1) return 0;
  const afterDot = pattern.slice(dotIndex + 1);
  let count = 0;
  for (const ch of afterDot) {
    if (ch === '0' || ch === '#') count++;
    else break;
  }
  return count;
}

/** 简单日期格式化 */
function formatDate(rawValue: number, pattern: string): string {
  let date: Date;
  if (rawValue < 100000 && rawValue > 0) {
    const excelEpoch = new Date(1899, 11, 30);
    date = new Date(excelEpoch.getTime() + rawValue * 86400000);
  } else {
    date = new Date(rawValue);
  }

  if (isNaN(date.getTime())) return String(rawValue);

  const yyyy = String(date.getFullYear());
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  let result = pattern;
  result = result.replace(/yyyy/g, yyyy);
  result = result.replace(/yy/g, yyyy.slice(2));
  result = result.replace(/MM/g, MM);
  result = result.replace(/dd/g, dd);
  result = result.replace(/HH/g, HH);
  result = result.replace(/mm/g, mm);
  result = result.replace(/ss/g, ss);
  return result;
}


// ============================================================
// PdfExporter 类
// ============================================================

/**
 * PdfExporter — PDF 导出器
 *
 * 使用 jsPDF 将电子表格渲染为 PDF 文件，支持：
 * - 按 PageConfig 纸张大小和方向分页
 * - 单元格内容渲染（文本、字体样式、背景色、边框、对齐）
 * - 页眉页脚渲染（左/中/右三区段，支持占位符替换）
 * - PrintArea 打印区域过滤
 * - 中文字符渲染（回退到默认字体并显示警告）
 * - 错误处理（库加载失败、字体加载失败、内存不足）
 */
export class PdfExporter {
  private model: SpreadsheetModelLike;
  private pageConfig: PageConfig;
  private headerFooter: HeaderFooter;
  private printArea: PrintArea;

  constructor(
    model: SpreadsheetModelLike,
    pageConfig: PageConfig,
    headerFooter: HeaderFooter,
    printArea: PrintArea
  ) {
    this.model = model;
    this.pageConfig = pageConfig;
    this.headerFooter = headerFooter;
    this.printArea = printArea;
  }

  /**
   * 导出为 PDF 并触发浏览器下载
   *
   * @param filename - 自定义文件名（可选），默认为 `{工作簿名称}-{日期}.pdf`
   */
  async export(filename?: string): Promise<void> {
    try {
      // 获取纸张尺寸
      const paper = PAPER_DIMENSIONS[this.pageConfig.paperSize];
      const isLandscape = this.pageConfig.orientation === 'landscape';

      // 创建 jsPDF 实例
      const doc = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [paper.width, paper.height],
      });

      // 尝试设置支持中文的字体
      this.setupChineseFont(doc);

      // 获取有效打印范围
      const range = this.printArea.getEffectiveRange(this.model);

      // 收集行高和列宽数组
      const rowHeights: number[] = [];
      const colWidths: number[] = [];
      for (let r = range.startRow; r <= range.endRow; r++) {
        rowHeights.push(this.model.getRowHeight(r));
      }
      for (let c = range.startCol; c <= range.endCol; c++) {
        colWidths.push(this.model.getColWidth(c));
      }

      // 计算分页
      const pageBreaks = this.pageConfig.calculatePageBreaks(
        rowHeights,
        colWidths,
        range.startRow,
        range.endRow,
        range.startCol,
        range.endCol
      );

      const { pages, totalPages } = pageBreaks;

      // 如果没有页面数据，创建一个空页面
      if (totalPages === 0) {
        this.renderHeaderFooter(doc, 0, 1);
        this.triggerDownload(doc, filename);
        return;
      }

      // 渲染每一页
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          doc.addPage([paper.width, paper.height], isLandscape ? 'landscape' : 'portrait');
        }

        this.renderPage(doc, pages[i], i, totalPages);
        this.renderHeaderFooter(doc, i, totalPages);
      }

      // 触发下载
      this.triggerDownload(doc, filename);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '未知错误';

      // 检测内存不足错误
      if (message.includes('memory') || message.includes('allocation')) {
        window.alert('PDF 导出失败：内存不足，请尝试缩小打印区域后重试');
        return;
      }

      window.alert(`PDF 导出失败：${message}`);
    }
  }

  /**
   * 渲染单页表格内容到 PDF
   *
   * 遍历页面范围内的每个单元格，依次绘制：
   * 1. 背景色（填充矩形）
   * 2. 边框线条
   * 3. 文本内容（含字体样式和对齐）
   *
   * @param doc - jsPDF 文档实例
   * @param pageData - 当前页的行列范围
   * @param _pageIndex - 当前页索引（0-based）
   * @param _totalPages - 总页数
   */
  private renderPage(
    doc: jsPDF,
    pageData: PageData,
    _pageIndex: number,
    _totalPages: number
  ): void {
    const margins = this.pageConfig.margins;
    const isLandscape = this.pageConfig.orientation === 'landscape';

    // 内容起始位置（考虑边距和页眉区域）
    const contentStartX = isLandscape ? margins.top : margins.left;
    const contentStartY = isLandscape ? margins.left : margins.top;

    // 计算每行每列在页面上的位置
    let currentY = contentStartY;

    for (let r = pageData.rowStart; r <= pageData.rowEnd; r++) {
      const rowHeightPx = this.model.getRowHeight(r);
      const rowHeightMm = rowHeightPx * PX_TO_MM;
      let currentX = contentStartX;

      for (let c = pageData.colStart; c <= pageData.colEnd; c++) {
        const colWidthPx = this.model.getColWidth(c);
        const colWidthMm = colWidthPx * PX_TO_MM;

        const cell = this.model.cells[r]?.[c];

        if (cell) {
          // 跳过被合并的子单元格（非左上角）
          if (cell.isMerged && cell.mergeParent) {
            currentX += colWidthMm;
            continue;
          }

          // 计算合并单元格的实际尺寸
          const { cellWidth, cellHeight } = this.getMergedCellSize(
            cell, r, c, pageData, colWidthMm, rowHeightMm
          );

          // 1. 绘制背景色
          this.drawCellBackground(doc, cell, currentX, currentY, cellWidth, cellHeight);

          // 2. 绘制边框
          this.drawCellBorders(doc, cell, currentX, currentY, cellWidth, cellHeight);

          // 3. 绘制文本
          this.drawCellText(doc, cell, currentX, currentY, cellWidth, cellHeight);
        }

        currentX += colWidthMm;
      }

      currentY += rowHeightMm;
    }
  }

  /**
   * 渲染页眉页脚
   *
   * 在页面顶部边距区域渲染页眉，底部边距区域渲染页脚。
   * 每个区段支持左/中/右三个对齐位置。
   *
   * @param doc - jsPDF 文档实例
   * @param pageIndex - 当前页索引（0-based）
   * @param totalPages - 总页数
   */
  private renderHeaderFooter(
    doc: jsPDF,
    pageIndex: number,
    totalPages: number
  ): void {
    if (this.headerFooter.isEmpty()) return;

    const now = new Date();
    const context = {
      page: pageIndex + 1,
      pages: totalPages,
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      sheetName: 'Sheet1',
    };

    const paper = PAPER_DIMENSIONS[this.pageConfig.paperSize];
    const isLandscape = this.pageConfig.orientation === 'landscape';
    const pageWidth = isLandscape ? paper.height : paper.width;
    const pageHeight = isLandscape ? paper.width : paper.height;
    const margins = this.pageConfig.margins;
    const leftMargin = isLandscape ? margins.top : margins.left;
    const rightMargin = isLandscape ? margins.bottom : margins.right;

    // 设置页眉页脚字体
    doc.setFontSize(HEADER_FOOTER_FONT_SIZE);
    doc.setTextColor(100, 100, 100);

    // 渲染页眉
    const headerSection = this.headerFooter.renderHeader(context);
    const headerY = (isLandscape ? margins.left : margins.top) / 2 + HEADER_FOOTER_HEIGHT / 2;
    this.drawSection(doc, headerSection, headerY, leftMargin, pageWidth - rightMargin);

    // 渲染页脚
    const footerSection = this.headerFooter.renderFooter(context);
    const footerY = pageHeight - (isLandscape ? margins.right : margins.bottom) / 2;
    this.drawSection(doc, footerSection, footerY, leftMargin, pageWidth - rightMargin);

    // 恢复默认文本颜色
    doc.setTextColor(0, 0, 0);
  }

  // ============================================================
  // 私有辅助方法
  // ============================================================

  /**
   * 尝试设置支持中文的字体
   *
   * jsPDF 默认字体不支持中文字符。
   * 当前策略：使用默认字体，中文字符可能无法正确显示。
   * 如果需要完整中文支持，需要嵌入中文字体文件。
   */
  private setupChineseFont(doc: jsPDF): void {
    try {
      // 检查是否有可用的中文字体
      const fontList = doc.getFontList();

      // 尝试使用常见中文字体
      const chineseFonts = ['SimSun', 'SimHei', 'Microsoft YaHei', 'STSong', 'STHeiti'];
      for (const fontName of chineseFonts) {
        if (fontList[fontName]) {
          doc.setFont(fontName);
          return;
        }
      }

      // 没有找到中文字体，使用默认字体并发出警告
      console.warn('PDF 导出：未找到中文字体，中文字符可能无法正确显示');
    } catch {
      // 字体加载失败，回退到默认字体
      console.warn('PDF 导出：字体加载失败，回退到默认字体');
    }
  }

  /**
   * 计算合并单元格的实际渲染尺寸
   */
  private getMergedCellSize(
    cell: Cell,
    row: number,
    col: number,
    pageData: PageData,
    defaultWidth: number,
    defaultHeight: number
  ): { cellWidth: number; cellHeight: number } {
    if (cell.colSpan <= 1 && cell.rowSpan <= 1) {
      return { cellWidth: defaultWidth, cellHeight: defaultHeight };
    }

    // 计算合并后的宽度（限制在当前页范围内）
    let cellWidth = 0;
    const colEnd = Math.min(col + cell.colSpan - 1, pageData.colEnd);
    for (let c = col; c <= colEnd; c++) {
      cellWidth += this.model.getColWidth(c) * PX_TO_MM;
    }

    // 计算合并后的高度（限制在当前页范围内）
    let cellHeight = 0;
    const rowEnd = Math.min(row + cell.rowSpan - 1, pageData.rowEnd);
    for (let r = row; r <= rowEnd; r++) {
      cellHeight += this.model.getRowHeight(r) * PX_TO_MM;
    }

    return { cellWidth, cellHeight };
  }

  /**
   * 绘制单元格背景色
   */
  private drawCellBackground(
    doc: jsPDF,
    cell: Cell,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (!cell.bgColor) return;

    const rgb = parseCssColor(cell.bgColor);
    if (!rgb) return;

    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.rect(x, y, width, height, 'F');
  }

  /**
   * 绘制单元格边框
   */
  private drawCellBorders(
    doc: jsPDF,
    cell: Cell,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (!cell.border) return;

    const { border } = cell;

    if (border.top) {
      this.drawBorderLine(doc, border.top, x, y, x + width, y);
    }
    if (border.bottom) {
      this.drawBorderLine(doc, border.bottom, x, y + height, x + width, y + height);
    }
    if (border.left) {
      this.drawBorderLine(doc, border.left, x, y, x, y + height);
    }
    if (border.right) {
      this.drawBorderLine(doc, border.right, x + width, y, x + width, y + height);
    }
  }

  /**
   * 绘制单条边框线
   *
   * 根据边框样式设置线型：
   * - solid → 实线
   * - dashed → 虚线
   * - dotted → 点线
   * - double → 两条平行线
   */
  private drawBorderLine(
    doc: jsPDF,
    side: BorderSide,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): void {
    // 设置线条颜色
    const rgb = parseCssColor(side.color);
    if (rgb) {
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    } else {
      doc.setDrawColor(0, 0, 0);
    }

    // 设置线宽（像素转毫米）
    const lineWidthMm = Math.max(side.width * PX_TO_MM, 0.1);
    doc.setLineWidth(lineWidthMm);

    // 根据边框样式设置线型
    switch (side.style) {
      case 'dashed':
        doc.setLineDashPattern([2, 1.5], 0);
        doc.line(x1, y1, x2, y2);
        doc.setLineDashPattern([], 0);
        break;

      case 'dotted':
        doc.setLineDashPattern([0.5, 0.8], 0);
        doc.line(x1, y1, x2, y2);
        doc.setLineDashPattern([], 0);
        break;

      case 'double': {
        // 双线：绘制两条平行线，间距为线宽的 2 倍
        const offset = lineWidthMm * 2;
        // 判断是水平线还是垂直线
        if (Math.abs(y1 - y2) < 0.01) {
          // 水平线
          doc.line(x1, y1 - offset / 2, x2, y2 - offset / 2);
          doc.line(x1, y1 + offset / 2, x2, y2 + offset / 2);
        } else {
          // 垂直线
          doc.line(x1 - offset / 2, y1, x2 - offset / 2, y2);
          doc.line(x1 + offset / 2, y1, x2 + offset / 2, y2);
        }
        break;
      }

      case 'solid':
      default:
        doc.line(x1, y1, x2, y2);
        break;
    }
  }

  /**
   * 绘制单元格文本
   *
   * 根据单元格的字体样式和对齐方式渲染文本内容。
   */
  private drawCellText(
    doc: jsPDF,
    cell: Cell,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const text = getDisplayValue(cell);
    if (!text) return;

    // 设置字体大小
    const fontSize = cell.fontSize ?? DEFAULT_FONT_SIZE;
    doc.setFontSize(fontSize);

    // 设置字体样式
    let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
    if (cell.fontBold && cell.fontItalic) {
      fontStyle = 'bolditalic';
    } else if (cell.fontBold) {
      fontStyle = 'bold';
    } else if (cell.fontItalic) {
      fontStyle = 'italic';
    }

    const currentFont = doc.getFont();
    doc.setFont(currentFont.fontName, fontStyle);

    // 设置文本颜色
    if (cell.fontColor) {
      const rgb = parseCssColor(cell.fontColor);
      if (rgb) {
        doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      } else {
        doc.setTextColor(0, 0, 0);
      }
    } else {
      doc.setTextColor(0, 0, 0);
    }

    // 计算文本位置（考虑对齐和内边距）
    const align = cell.fontAlign ?? 'left';
    let textX: number;

    switch (align) {
      case 'center':
        textX = x + width / 2;
        break;
      case 'right':
        textX = x + width - CELL_PADDING;
        break;
      case 'left':
      default:
        textX = x + CELL_PADDING;
        break;
    }

    // 垂直对齐
    const verticalAlign = cell.verticalAlign ?? 'middle';
    let textY: number;
    // 字体高度近似值（pt 转 mm：1pt ≈ 0.353mm）
    const fontHeightMm = fontSize * 0.353;

    switch (verticalAlign) {
      case 'top':
        textY = y + CELL_PADDING + fontHeightMm;
        break;
      case 'bottom':
        textY = y + height - CELL_PADDING;
        break;
      case 'middle':
      default:
        textY = y + height / 2 + fontHeightMm / 3;
        break;
    }

    // 截断超出单元格宽度的文本
    const maxWidth = width - CELL_PADDING * 2;
    if (maxWidth <= 0) return;

    doc.text(text, textX, textY, {
      align,
      maxWidth,
    });
  }

  /**
   * 绘制页眉/页脚区段（左/中/右）
   */
  private drawSection(
    doc: jsPDF,
    section: HeaderFooterSection,
    y: number,
    leftX: number,
    rightX: number
  ): void {
    const centerX = (leftX + rightX) / 2;

    if (section.left) {
      doc.text(section.left, leftX, y, { align: 'left' });
    }
    if (section.center) {
      doc.text(section.center, centerX, y, { align: 'center' });
    }
    if (section.right) {
      doc.text(section.right, rightX, y, { align: 'right' });
    }
  }

  /**
   * 触发浏览器文件下载
   */
  private triggerDownload(doc: jsPDF, filename?: string): void {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const defaultName = `工作簿-${dateStr}.pdf`;
    const finalFilename = filename ?? defaultName;

    doc.save(finalFilename);
  }
}
