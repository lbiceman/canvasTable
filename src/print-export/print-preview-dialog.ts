// ============================================================
// 打印预览对话框 — 全屏模态对话框，提供分页预览、页面设置和打印触发
// ============================================================

import type { Cell } from '../types';
import type {
  PaperSize,
  Orientation,
  PageBreakResult,
  PageData,
  HeaderFooterContext,
} from './types';
import { PAPER_DIMENSIONS } from './types';
import { PageConfig } from './page-config';
import { PrintArea } from './print-area';
import { HeaderFooter } from './header-footer';

/**
 * SpreadsheetModel 的最小接口，避免循环依赖。
 */
interface SpreadsheetModelLike {
  cells: Cell[][];
  getRowCount(): number;
  getColCount(): number;
  getRowHeight(row: number): number;
  getColWidth(col: number): number;
}

/**
 * SheetManager 的最小接口，避免循环依赖。
 */
interface SheetManagerLike {
  getActiveSheetName(): string;
}

/** 纸张大小选项列表 */
const PAPER_SIZE_OPTIONS: ReadonlyArray<{ value: PaperSize; label: string }> = [
  { value: 'A4', label: 'A4 (210×297mm)' },
  { value: 'A3', label: 'A3 (297×420mm)' },
  { value: 'Letter', label: 'Letter (216×279mm)' },
  { value: 'Legal', label: 'Legal (216×356mm)' },
];

/** 防抖延迟（毫秒） */
const DEBOUNCE_DELAY = 500;

/** 预览区域内边距（像素） */
const PREVIEW_PADDING = 20;

/**
 * PrintPreviewDialog — 打印预览对话框
 *
 * 全屏模态对话框，提供：
 * - 左侧面板：页面设置（纸张大小、方向、边距）、页眉页脚编辑
 * - 右侧面板：Canvas 分页预览、翻页导航
 * - 底部栏：打印/取消按钮
 */
export class PrintPreviewDialog {
  private model: SpreadsheetModelLike;
  private sheetManager: SheetManagerLike | null;
  private pageConfig: PageConfig;
  private printArea: PrintArea;
  private headerFooter: HeaderFooter;

  /** 对话框根元素 */
  private overlay: HTMLDivElement | null = null;
  /** 预览 Canvas 元素 */
  private canvas: HTMLCanvasElement | null = null;
  /** 当前页码（从 0 开始） */
  private currentPage = 0;
  /** 分页计算结果 */
  private pageBreakResult: PageBreakResult = { pages: [], totalPages: 0 };
  /** 页码显示元素 */
  private pageIndicator: HTMLSpanElement | null = null;
  /** 上一页按钮 */
  private prevBtn: HTMLButtonElement | null = null;
  /** 下一页按钮 */
  private nextBtn: HTMLButtonElement | null = null;
  /** 防抖定时器 */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    model: SpreadsheetModelLike,
    sheetManager: SheetManagerLike | null,
    pageConfig: PageConfig,
    printArea: PrintArea,
    headerFooter: HeaderFooter
  ) {
    this.model = model;
    this.sheetManager = sheetManager;
    this.pageConfig = pageConfig;
    this.printArea = printArea;
    this.headerFooter = headerFooter;
  }

  /**
   * 打开打印预览对话框
   */
  open(): void {
    // 防止重复打开
    if (this.overlay) return;

    this.overlay = this.createOverlay();
    document.body.appendChild(this.overlay);

    // 初始计算分页并渲染
    this.calculatePages();
    this.renderPage(this.currentPage);
  }

  /**
   * 关闭对话框
   */
  close(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.overlay) {
      document.body.removeChild(this.overlay);
      this.overlay = null;
      this.canvas = null;
      this.pageIndicator = null;
      this.prevBtn = null;
      this.nextBtn = null;
    }
  }

  /**
   * 执行打印（调用 window.print）
   */
  print(): void {
    // 创建打印专用内容容器
    const printContainer = this.createPrintContent();
    document.body.appendChild(printContainer);

    window.print();

    // 打印完成后移除打印内容
    document.body.removeChild(printContainer);
  }

  // ============================================================
  // 私有方法 — 分页计算
  // ============================================================

  /**
   * 计算分页断点
   */
  private calculatePages(): void {
    const range = this.printArea.getEffectiveRange(
      this.model as unknown as Parameters<PrintArea['getEffectiveRange']>[0]
    );

    const rowHeights: number[] = [];
    const colWidths: number[] = [];

    for (let r = 0; r < this.model.getRowCount(); r++) {
      rowHeights.push(this.model.getRowHeight(r));
    }
    for (let c = 0; c < this.model.getColCount(); c++) {
      colWidths.push(this.model.getColWidth(c));
    }

    this.pageBreakResult = this.pageConfig.calculatePageBreaks(
      rowHeights,
      colWidths,
      range.startRow,
      range.endRow,
      range.startCol,
      range.endCol
    );

    // 确保当前页码在有效范围内
    if (this.currentPage >= this.pageBreakResult.totalPages) {
      this.currentPage = Math.max(0, this.pageBreakResult.totalPages - 1);
    }
  }

  /**
   * 参数变更后重新计算分页（500ms 防抖）
   */
  private refreshPreview(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.calculatePages();
      this.renderPage(this.currentPage);
      this.updateNavigation();
    }, DEBOUNCE_DELAY);
  }

  // ============================================================
  // 私有方法 — Canvas 预览渲染
  // ============================================================

  /**
   * 渲染指定页到预览 Canvas
   */
  private renderPage(pageIndex: number): void {
    if (!this.canvas) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const { pages, totalPages } = this.pageBreakResult;
    if (totalPages === 0 || pageIndex < 0 || pageIndex >= totalPages) {
      // 无页面时清空画布
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    const page = pages[pageIndex];
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    // 获取纸张尺寸（mm）
    const paperDim = PAPER_DIMENSIONS[this.pageConfig.paperSize];
    const paperW = this.pageConfig.orientation === 'landscape' ? paperDim.height : paperDim.width;
    const paperH = this.pageConfig.orientation === 'landscape' ? paperDim.width : paperDim.height;

    // 计算缩放比例，使纸张适配预览区域
    const scaleX = (canvasW - PREVIEW_PADDING * 2) / paperW;
    const scaleY = (canvasH - PREVIEW_PADDING * 2) / paperH;
    const scale = Math.min(scaleX, scaleY);

    const drawW = paperW * scale;
    const drawH = paperH * scale;
    const offsetX = (canvasW - drawW) / 2;
    const offsetY = (canvasH - drawH) / 2;

    // 清空画布
    ctx.clearRect(0, 0, canvasW, canvasH);

    // 绘制纸张阴影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(offsetX + 4, offsetY + 4, drawW, drawH);

    // 绘制纸张白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(offsetX, offsetY, drawW, drawH);

    // 绘制纸张边框
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, drawW, drawH);

    // 计算边距区域（mm → 像素）
    const margins = this.pageConfig.margins;
    const marginLeft = margins.left * scale;
    const marginTop = margins.top * scale;
    const marginRight = margins.right * scale;
    const marginBottom = margins.bottom * scale;

    const contentX = offsetX + marginLeft;
    const contentY = offsetY + marginTop;
    const contentW = drawW - marginLeft - marginRight;
    const contentH = drawH - marginTop - marginBottom;

    // 绘制边距虚线框
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#e0e0e0';
    ctx.strokeRect(contentX, contentY, contentW, contentH);
    ctx.setLineDash([]);

    // 渲染页眉页脚
    this.renderHeaderFooterOnCanvas(ctx, offsetX, offsetY, drawW, drawH, scale, pageIndex, totalPages);

    // 渲染表格内容
    this.renderTableContent(ctx, page, contentX, contentY, contentW, contentH);
  }

  /**
   * 在 Canvas 上渲染页眉页脚
   */
  private renderHeaderFooterOnCanvas(
    ctx: CanvasRenderingContext2D,
    paperX: number,
    paperY: number,
    paperW: number,
    paperH: number,
    scale: number,
    pageIndex: number,
    totalPages: number
  ): void {
    if (this.headerFooter.isEmpty()) return;

    const context = this.createHeaderFooterContext(pageIndex, totalPages);
    const headerSection = this.headerFooter.renderHeader(context);
    const footerSection = this.headerFooter.renderFooter(context);

    const fontSize = Math.max(8, 10 * scale * 0.4);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = '#666666';

    const marginLeft = this.pageConfig.margins.left * scale;
    const marginRight = this.pageConfig.margins.right * scale;
    const headerY = paperY + this.pageConfig.margins.top * scale * 0.5;
    const footerY = paperY + paperH - this.pageConfig.margins.bottom * scale * 0.4;

    // 页眉
    if (headerSection.left) {
      ctx.textAlign = 'left';
      ctx.fillText(headerSection.left, paperX + marginLeft, headerY);
    }
    if (headerSection.center) {
      ctx.textAlign = 'center';
      ctx.fillText(headerSection.center, paperX + paperW / 2, headerY);
    }
    if (headerSection.right) {
      ctx.textAlign = 'right';
      ctx.fillText(headerSection.right, paperX + paperW - marginRight, headerY);
    }

    // 页脚
    if (footerSection.left) {
      ctx.textAlign = 'left';
      ctx.fillText(footerSection.left, paperX + marginLeft, footerY);
    }
    if (footerSection.center) {
      ctx.textAlign = 'center';
      ctx.fillText(footerSection.center, paperX + paperW / 2, footerY);
    }
    if (footerSection.right) {
      ctx.textAlign = 'right';
      ctx.fillText(footerSection.right, paperX + paperW - marginRight, footerY);
    }

    // 重置对齐
    ctx.textAlign = 'left';
  }

  /**
   * 渲染表格内容到 Canvas 内容区域
   */
  private renderTableContent(
    ctx: CanvasRenderingContext2D,
    page: PageData,
    contentX: number,
    contentY: number,
    contentW: number,
    contentH: number
  ): void {
    const { rowStart, rowEnd, colStart, colEnd } = page;

    // 计算总行高和总列宽（像素）
    let totalRowPx = 0;
    let totalColPx = 0;
    for (let r = rowStart; r <= rowEnd; r++) {
      totalRowPx += this.model.getRowHeight(r);
    }
    for (let c = colStart; c <= colEnd; c++) {
      totalColPx += this.model.getColWidth(c);
    }

    if (totalRowPx === 0 || totalColPx === 0) return;

    // 计算缩放比例使表格适配内容区域
    const scaleX = contentW / totalColPx;
    const scaleY = contentH / totalRowPx;
    const tableScale = Math.min(scaleX, scaleY, 1);

    const tableW = totalColPx * tableScale;
    const tableH = totalRowPx * tableScale;

    // 居中绘制
    const tableX = contentX + (contentW - tableW) / 2;
    const tableY = contentY + (contentH - tableH) / 2;

    // 绘制网格线和单元格内容
    ctx.save();
    ctx.beginPath();
    ctx.rect(contentX, contentY, contentW, contentH);
    ctx.clip();

    let y = tableY;
    for (let r = rowStart; r <= rowEnd; r++) {
      const rowH = this.model.getRowHeight(r) * tableScale;
      let x = tableX;

      for (let c = colStart; c <= colEnd; c++) {
        const colW = this.model.getColWidth(c) * tableScale;
        const cell = this.model.cells[r]?.[c];

        // 绘制单元格背景
        if (cell?.bgColor) {
          ctx.fillStyle = cell.bgColor;
          ctx.fillRect(x, y, colW, rowH);
        }

        // 绘制网格线
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, colW, rowH);

        // 绘制单元格文本
        if (cell && cell.content && !cell.isMerged) {
          const fontSize = Math.max(6, (cell.fontSize ?? 12) * tableScale * 0.8);
          const fontStyle = `${cell.fontBold ? 'bold ' : ''}${cell.fontItalic ? 'italic ' : ''}`;
          ctx.font = `${fontStyle}${fontSize}px sans-serif`;
          ctx.fillStyle = cell.fontColor ?? '#333333';

          // 文本对齐
          const padding = 2 * tableScale;
          let textX = x + padding;
          ctx.textAlign = 'left';
          if (cell.fontAlign === 'center') {
            textX = x + colW / 2;
            ctx.textAlign = 'center';
          } else if (cell.fontAlign === 'right') {
            textX = x + colW - padding;
            ctx.textAlign = 'right';
          }

          ctx.textBaseline = 'middle';
          const textY = y + rowH / 2;

          // 裁剪文本到单元格范围
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, colW, rowH);
          ctx.clip();
          ctx.fillText(cell.content, textX, textY);
          ctx.restore();
        }

        x += colW;
      }
      y += rowH;
    }

    ctx.restore();
  }

  // ============================================================
  // 私有方法 — DOM 构建
  // ============================================================

  /**
   * 创建对话框遮罩层和主体结构
   */
  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'print-preview-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'print-preview-dialog';

    // 标题栏
    const titleBar = document.createElement('div');
    titleBar.className = 'print-preview-title-bar';
    titleBar.textContent = '打印预览';
    dialog.appendChild(titleBar);

    // 主体区域（左侧设置 + 右侧预览）
    const body = document.createElement('div');
    body.className = 'print-preview-body';

    body.appendChild(this.createSettingsPanel());
    body.appendChild(this.createPreviewPanel());

    dialog.appendChild(body);

    // 底部按钮栏
    dialog.appendChild(this.createBottomBar());

    overlay.appendChild(dialog);
    return overlay;
  }

  /**
   * 创建左侧设置面板
   */
  private createSettingsPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'print-preview-settings';

    // 纸张大小
    panel.appendChild(this.createSectionTitle('纸张大小'));
    const paperSelect = this.createSelect(
      PAPER_SIZE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      this.pageConfig.paperSize,
      (value) => {
        this.pageConfig.paperSize = value as PaperSize;
        this.refreshPreview();
      }
    );
    panel.appendChild(paperSelect);

    // 页面方向
    panel.appendChild(this.createSectionTitle('页面方向'));
    const orientationGroup = this.createRadioGroup(
      'orientation',
      [
        { value: 'portrait', label: '纵向' },
        { value: 'landscape', label: '横向' },
      ],
      this.pageConfig.orientation,
      (value) => {
        this.pageConfig.orientation = value as Orientation;
        this.refreshPreview();
      }
    );
    panel.appendChild(orientationGroup);

    // 边距
    panel.appendChild(this.createSectionTitle('边距 (mm)'));
    const marginsGrid = document.createElement('div');
    marginsGrid.className = 'print-preview-margins-grid';

    const marginFields: Array<{ key: 'top' | 'bottom' | 'left' | 'right'; label: string }> = [
      { key: 'top', label: '上' },
      { key: 'bottom', label: '下' },
      { key: 'left', label: '左' },
      { key: 'right', label: '右' },
    ];

    for (const { key, label } of marginFields) {
      const wrapper = document.createElement('div');
      wrapper.className = 'print-preview-margin-field';

      const lbl = document.createElement('label');
      lbl.textContent = label;
      wrapper.appendChild(lbl);

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '100';
      input.value = String(this.pageConfig.margins[key]);
      input.className = 'print-preview-input';
      input.addEventListener('input', () => {
        const val = Math.min(100, Math.max(0, Number(input.value) || 0));
        this.pageConfig.margins[key] = val;
        this.refreshPreview();
      });
      wrapper.appendChild(input);
      marginsGrid.appendChild(wrapper);
    }
    panel.appendChild(marginsGrid);

    // 页眉
    panel.appendChild(this.createSectionTitle('页眉'));
    panel.appendChild(this.createHeaderFooterInputs('header'));

    // 页脚
    panel.appendChild(this.createSectionTitle('页脚'));
    panel.appendChild(this.createHeaderFooterInputs('footer'));

    // 占位符提示
    const hint = document.createElement('div');
    hint.className = 'print-preview-hint';
    hint.textContent = '占位符: {page}, {pages}, {date}, {time}, {sheetName}';
    panel.appendChild(hint);

    return panel;
  }

  /**
   * 创建右侧预览面板
   */
  private createPreviewPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'print-preview-preview';

    // Canvas 预览区域
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'print-preview-canvas-container';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'print-preview-canvas';
    this.canvas.width = 600;
    this.canvas.height = 800;
    canvasContainer.appendChild(this.canvas);
    panel.appendChild(canvasContainer);

    // 翻页导航
    const nav = document.createElement('div');
    nav.className = 'print-preview-nav';

    this.prevBtn = document.createElement('button');
    this.prevBtn.className = 'print-preview-nav-btn';
    this.prevBtn.textContent = '‹';
    this.prevBtn.title = '上一页';
    this.prevBtn.addEventListener('click', () => {
      if (this.currentPage > 0) {
        this.currentPage--;
        this.renderPage(this.currentPage);
        this.updateNavigation();
      }
    });
    nav.appendChild(this.prevBtn);

    this.pageIndicator = document.createElement('span');
    this.pageIndicator.className = 'print-preview-page-indicator';
    nav.appendChild(this.pageIndicator);

    this.nextBtn = document.createElement('button');
    this.nextBtn.className = 'print-preview-nav-btn';
    this.nextBtn.textContent = '›';
    this.nextBtn.title = '下一页';
    this.nextBtn.addEventListener('click', () => {
      if (this.currentPage < this.pageBreakResult.totalPages - 1) {
        this.currentPage++;
        this.renderPage(this.currentPage);
        this.updateNavigation();
      }
    });
    nav.appendChild(this.nextBtn);

    panel.appendChild(nav);

    // 初始化导航状态
    this.updateNavigation();

    return panel;
  }

  /**
   * 创建底部按钮栏
   */
  private createBottomBar(): HTMLDivElement {
    const bar = document.createElement('div');
    bar.className = 'print-preview-bottom-bar';

    const printBtn = document.createElement('button');
    printBtn.className = 'print-preview-btn print-preview-btn-primary';
    printBtn.textContent = '打印';
    printBtn.addEventListener('click', () => this.print());
    bar.appendChild(printBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'print-preview-btn print-preview-btn-secondary';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => this.close());
    bar.appendChild(cancelBtn);

    return bar;
  }

  // ============================================================
  // 私有方法 — UI 辅助组件
  // ============================================================

  /**
   * 创建区段标题
   */
  private createSectionTitle(text: string): HTMLDivElement {
    const title = document.createElement('div');
    title.className = 'print-preview-section-title';
    title.textContent = text;
    return title;
  }

  /**
   * 创建下拉选择框
   */
  private createSelect(
    options: ReadonlyArray<{ value: string; label: string }>,
    currentValue: string,
    onChange: (value: string) => void
  ): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'print-preview-select';

    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === currentValue) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener('change', () => onChange(select.value));
    return select;
  }

  /**
   * 创建单选按钮组
   */
  private createRadioGroup(
    name: string,
    options: ReadonlyArray<{ value: string; label: string }>,
    currentValue: string,
    onChange: (value: string) => void
  ): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'print-preview-radio-group';

    for (const opt of options) {
      const label = document.createElement('label');
      label.className = 'print-preview-radio-label';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = name;
      radio.value = opt.value;
      radio.checked = opt.value === currentValue;
      radio.addEventListener('change', () => {
        if (radio.checked) onChange(radio.value);
      });

      label.appendChild(radio);
      label.appendChild(document.createTextNode(` ${opt.label}`));
      group.appendChild(label);
    }

    return group;
  }

  /**
   * 创建页眉/页脚输入组（左/居中/右）
   */
  private createHeaderFooterInputs(type: 'header' | 'footer'): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'print-preview-hf-inputs';

    const fields: Array<{ key: 'left' | 'center' | 'right'; label: string }> = [
      { key: 'left', label: '左' },
      { key: 'center', label: '居中' },
      { key: 'right', label: '右' },
    ];

    for (const { key, label } of fields) {
      const wrapper = document.createElement('div');
      wrapper.className = 'print-preview-hf-field';

      const lbl = document.createElement('label');
      lbl.textContent = label;
      wrapper.appendChild(lbl);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'print-preview-input';
      input.placeholder = '{page}, {date}...';
      input.value = this.headerFooter[type][key];
      input.addEventListener('input', () => {
        this.headerFooter[type][key] = input.value;
        this.refreshPreview();
      });
      wrapper.appendChild(input);
      container.appendChild(wrapper);
    }

    return container;
  }

  // ============================================================
  // 私有方法 — 导航与上下文
  // ============================================================

  /**
   * 更新翻页导航状态
   */
  private updateNavigation(): void {
    const { totalPages } = this.pageBreakResult;

    if (this.pageIndicator) {
      this.pageIndicator.textContent = totalPages > 0
        ? `${this.currentPage + 1} / ${totalPages}`
        : '0 / 0';
    }

    if (this.prevBtn) {
      this.prevBtn.disabled = this.currentPage <= 0;
    }
    if (this.nextBtn) {
      this.nextBtn.disabled = this.currentPage >= totalPages - 1;
    }
  }

  /**
   * 创建页眉页脚渲染上下文
   */
  private createHeaderFooterContext(pageIndex: number, totalPages: number): HeaderFooterContext {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');

    return {
      page: pageIndex + 1,
      pages: totalPages,
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      sheetName: this.sheetManager?.getActiveSheetName() ?? 'Sheet1',
    };
  }

  // ============================================================
  // 私有方法 — 打印内容生成
  // ============================================================

  /**
   * 创建打印专用 HTML 内容（用于 window.print）
   */
  private createPrintContent(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'print-content';
    container.className = 'print-content';

    const { pages, totalPages } = this.pageBreakResult;
    const paperDim = PAPER_DIMENSIONS[this.pageConfig.paperSize];
    const isLandscape = this.pageConfig.orientation === 'landscape';
    const paperW = isLandscape ? paperDim.height : paperDim.width;
    const paperH = isLandscape ? paperDim.width : paperDim.height;

    for (let p = 0; p < totalPages; p++) {
      const page = pages[p];
      const pageDiv = document.createElement('div');
      pageDiv.className = 'print-page';
      pageDiv.style.width = `${paperW}mm`;
      pageDiv.style.height = `${paperH}mm`;
      pageDiv.style.padding = `${this.pageConfig.margins.top}mm ${this.pageConfig.margins.right}mm ${this.pageConfig.margins.bottom}mm ${this.pageConfig.margins.left}mm`;

      // 页眉
      if (!this.headerFooter.isEmpty()) {
        const context = this.createHeaderFooterContext(p, totalPages);
        const headerSection = this.headerFooter.renderHeader(context);
        const headerDiv = document.createElement('div');
        headerDiv.className = 'print-header';
        headerDiv.innerHTML = `<span>${this.escapeHtml(headerSection.left)}</span><span>${this.escapeHtml(headerSection.center)}</span><span>${this.escapeHtml(headerSection.right)}</span>`;
        pageDiv.appendChild(headerDiv);
      }

      // 表格内容
      const table = this.createPageTable(page);
      pageDiv.appendChild(table);

      // 页脚
      if (!this.headerFooter.isEmpty()) {
        const context = this.createHeaderFooterContext(p, totalPages);
        const footerSection = this.headerFooter.renderFooter(context);
        const footerDiv = document.createElement('div');
        footerDiv.className = 'print-footer';
        footerDiv.innerHTML = `<span>${this.escapeHtml(footerSection.left)}</span><span>${this.escapeHtml(footerSection.center)}</span><span>${this.escapeHtml(footerSection.right)}</span>`;
        pageDiv.appendChild(footerDiv);
      }

      container.appendChild(pageDiv);
    }

    return container;
  }

  /**
   * 为单页创建 HTML 表格
   */
  private createPageTable(page: PageData): HTMLTableElement {
    const table = document.createElement('table');
    table.className = 'print-table';

    const { rowStart, rowEnd, colStart, colEnd } = page;

    for (let r = rowStart; r <= rowEnd; r++) {
      const tr = document.createElement('tr');

      for (let c = colStart; c <= colEnd; c++) {
        const cell = this.model.cells[r]?.[c];
        if (!cell || cell.isMerged) continue;

        const td = document.createElement('td');

        // 合并单元格属性
        if (cell.rowSpan > 1) td.rowSpan = Math.min(cell.rowSpan, rowEnd - r + 1);
        if (cell.colSpan > 1) td.colSpan = Math.min(cell.colSpan, colEnd - c + 1);

        // 样式
        const styles: string[] = [];
        if (cell.fontBold) styles.push('font-weight:bold');
        if (cell.fontItalic) styles.push('font-style:italic');
        if (cell.fontUnderline) styles.push('text-decoration:underline');
        if (cell.fontSize) styles.push(`font-size:${cell.fontSize}px`);
        if (cell.fontColor) styles.push(`color:${cell.fontColor}`);
        if (cell.bgColor) styles.push(`background-color:${cell.bgColor}`);
        if (cell.fontAlign) styles.push(`text-align:${cell.fontAlign}`);
        if (cell.verticalAlign) styles.push(`vertical-align:${cell.verticalAlign}`);

        if (styles.length > 0) {
          td.style.cssText = styles.join(';');
        }

        td.textContent = cell.content;
        tr.appendChild(td);
      }

      table.appendChild(tr);
    }

    return table;
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 获取活动工作表名称（供外部使用）
   */
  getActiveSheetName(): string {
    return this.sheetManager?.getActiveSheetName() ?? 'Sheet1';
  }
}
