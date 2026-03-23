import { SpreadsheetModel } from './model';
import { Viewport, Selection, RenderConfig, CellPosition, CellFormat, Cell, DataBarParams, IconInfo, RichTextSegment } from './types';
import type { RowColumnGroup } from './types';
import { CursorAwareness } from './collaboration/cursor-awareness';
import { NumberFormatter, DateFormatter } from './format-engine';
import { ConditionalFormatEngine } from './conditional-format';
import { SparklineRenderer } from './chart/sparkline-renderer';
import type { ThemeColors } from './chart/types';
import { CHART_COLORS_LIGHT, CHART_COLORS_DARK } from './chart/types';
import type { ChartOverlay } from './chart/chart-overlay';
import type { SortFilterModel } from './sort-filter/sort-filter-model';
import { ColumnHeaderIndicator } from './sort-filter/column-header-indicator';

export class SpreadsheetRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private model: SpreadsheetModel;
  private viewport: Viewport;
  private selection: Selection | null = null;
  private config: RenderConfig;
  private canvasWidth: number;
  private canvasHeight: number;

  // 高亮行
  private highlightedRow: number | null = null;
  // 高亮列
  private highlightedCol: number | null = null;

  // 多选区数据
  private multiSelections: Selection[] = [];
  private activeSelectionIndex: number = -1;

  // 是否高亮所有行列标题（全选状态）
  private highlightAllHeaders: boolean = false;

  // 填充柄拖拽预览区域
  private fillDragPreview: Selection | null = null;

  // 拖拽移动预览区域
  private dragMovePreview: Selection | null = null;

  // 光标感知模块（协同编辑时设置）
  private cursorAwareness: CursorAwareness | null = null;

  // 图表浮动层（图表模块初始化后设置）
  private chartOverlay: ChartOverlay | null = null;

  // 排序筛选模型（排序筛选模块初始化后设置）
  private sortFilterModel: SortFilterModel | null = null;

  // 主题颜色
  private themeColors: {
    background: string;
    foreground: string;
    headerBackground: string;
    headerText: string;
    gridLine: string;
    cellBackground: string;
    cellText: string;
    selectionBackground: string;
    selectionBorder: string;
    highlightBackground: string;
    highlightHeaderBackground: string;
  } = {
    background: '#ffffff',
    foreground: '#333333',
    headerBackground: '#f5f5f5',
    headerText: '#333333',
    gridLine: '#e0e0e0',
    cellBackground: '#ffffff',
    cellText: '#333333',
    selectionBackground: 'rgba(0, 0, 0, 0.05)',
    selectionBorder: '#808080',
    highlightBackground: '#e8e8e8',
    highlightHeaderBackground: '#d0d0d0'
  };

  // 滚动相关回调
  private onScrollChange?: (scrollX: number, scrollY: number, maxScrollX: number, maxScrollY: number) => void;

  // 单元格内容字体大小（独立于标题字体大小）
  private cellFontSize: number;

  constructor(
    canvas: HTMLCanvasElement,
    model: SpreadsheetModel,
    config: RenderConfig
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.model = model;
    this.config = config;
    this.cellFontSize = config.fontSize; // 初始值与配置一致

    // 初始化视口
    this.viewport = {
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 0,
      offsetX: 0,
      offsetY: 0,
      scrollX: 0,
      scrollY: 0
    };

    // 设置画布大小
    this.canvasWidth = window.innerWidth;
    this.canvasHeight = window.innerHeight - (config.headerHeight + 44 + 24);
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;

    // 计算初始视口范围
    this.updateViewport();
  }

  // 设置滚动变化回调
  public setScrollChangeCallback(callback: (scrollX: number, scrollY: number, maxScrollX: number, maxScrollY: number) => void): void {
    this.onScrollChange = callback;
  }

  // 设置主题颜色
  public setThemeColors(colors: any): void {
    this.themeColors = {
      background: colors.background || '#ffffff',
      foreground: colors.foreground || '#333333',
      headerBackground: colors.headerBackground || '#f5f5f5',
      headerText: colors.headerText || '#333333',
      gridLine: colors.gridLine || '#e0e0e0',
      cellBackground: colors.cellBackground || '#ffffff',
      cellText: colors.cellText || '#333333',
      selectionBackground: colors.selectionBackground || 'rgba(0, 0, 0, 0.05)',
      selectionBorder: colors.selectionBorder || '#808080',
      highlightBackground: colors.highlightBackground || '#e8e8e8',
      highlightHeaderBackground: colors.highlightHeaderBackground || '#d0d0d0'
    };
  }

  // 设置光标感知模块
  public setCursorAwareness(cursorAwareness: CursorAwareness | null): void {
    this.cursorAwareness = cursorAwareness;
  }

  // 设置图表浮动层
  public setChartOverlay(chartOverlay: ChartOverlay | null): void {
    this.chartOverlay = chartOverlay;
  }

  // 设置排序筛选模型引用
  public setSortFilterModel(model: SortFilterModel | null): void {
    this.sortFilterModel = model;
  }

  // 滚动到指定位置
  public scrollTo(scrollX: number, scrollY: number): void {
    const { headerWidth, headerHeight } = this.config;

    // 计算最大滚动范围
    const totalWidth = this.model.getTotalWidth();
    const totalHeight = this.model.getTotalHeight();
    const maxScrollX = Math.max(0, totalWidth - (this.canvasWidth - headerWidth));
    const maxScrollY = Math.max(0, totalHeight - (this.canvasHeight - headerHeight));

    // 限制滚动范围
    this.viewport.scrollX = Math.max(0, Math.min(scrollX, maxScrollX));
    this.viewport.scrollY = Math.max(0, Math.min(scrollY, maxScrollY));

    // 更新视口
    this.updateViewport();

    // 触发回调
    if (this.onScrollChange) {
      this.onScrollChange(this.viewport.scrollX, this.viewport.scrollY, maxScrollX, maxScrollY);
    }

    // 重新渲染
    this.render();
  }

  // 滚动指定偏移量
  public scrollBy(deltaX: number, deltaY: number): void {
    this.scrollTo(
      this.viewport.scrollX + deltaX,
      this.viewport.scrollY + deltaY
    );
  }

  // 更新视口范围
  public updateViewport(): void {
    const { headerHeight, headerWidth } = this.config;
    const { scrollX, scrollY } = this.viewport;

    // 根据滚动位置计算起始行（跳过隐藏行）
    let startRow = this.model.getRowAtY(scrollY);
    while (startRow < this.model.getRowCount() - 1 && this.model.isRowHidden(startRow)) {
      startRow++;
    }
    let offsetY = this.model.getRowY(startRow) - scrollY;

    // 根据滚动位置计算起始列（跳过隐藏列）
    let startCol = this.model.getColAtX(scrollX);
    while (startCol < this.model.getColCount() - 1 && this.model.isColHidden(startCol)) {
      startCol++;
    }
    let offsetX = this.model.getColX(startCol) - scrollX;

    // 计算可见行数（跳过隐藏行）
    let currentY = headerHeight + offsetY;
    let endRow = startRow;

    while (currentY < this.canvasHeight && endRow < this.model.getRowCount() - 1) {
      if (!this.model.isRowHidden(endRow)) {
        currentY += this.model.getRowHeight(endRow);
      }
      endRow++;
    }

    // 计算可见列数（跳过隐藏列）
    let currentX = headerWidth + offsetX;
    let endCol = startCol;

    while (currentX < this.canvasWidth && endCol < this.model.getColCount() - 1) {
      if (!this.model.isColHidden(endCol)) {
        currentX += this.model.getColWidth(endCol);
      }
      endCol++;
    }

    // 更新视口
    this.viewport.startRow = startRow;
    this.viewport.startCol = startCol;
    this.viewport.endRow = Math.min(endRow + 1, this.model.getRowCount() - 1);
    this.viewport.endCol = Math.min(endCol + 1, this.model.getColCount() - 1);
    this.viewport.offsetX = offsetX;
    this.viewport.offsetY = offsetY;

    // 检查是否需要扩展数据
    this.checkAndExpandData();
  }

  // 检查并扩展数据（实现无限滚动）
  private checkAndExpandData(): void {
    const { endRow, endCol } = this.viewport;
    const rowCount = this.model.getRowCount();
    const colCount = this.model.getColCount();

    // 如果接近边界，扩展数据
    if (endRow >= rowCount - 50) {
      this.model.expandRows(rowCount + 500);
    }

    if (endCol >= colCount - 10) {
      this.model.expandCols(colCount + 50);
    }
  }

  // 获取最大滚动范围
  public getMaxScroll(): { maxScrollX: number; maxScrollY: number } {
    const { headerWidth, headerHeight } = this.config;
    const totalWidth = this.model.getTotalWidth();
    const totalHeight = this.model.getTotalHeight();

    return {
      maxScrollX: Math.max(0, totalWidth - (this.canvasWidth - headerWidth)),
      maxScrollY: Math.max(0, totalHeight - (this.canvasHeight - headerHeight))
    };
  }

  // 渲染表格
  public render(): void {
    // 清除画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 绘制背景
    this.ctx.fillStyle = this.themeColors.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 绘制高亮行背景
    this.renderHighlightedRow();

    // 绘制高亮列背景
    this.renderHighlightedCol();

    // 绘制单元格
    this.renderCells();

    // 绘制网格线
    this.renderGrid();

    // 绘制选择区域（多选区或单选区）
    if (this.multiSelections.length > 0) {
      this.renderMultiSelection();
    } else if (this.selection) {
      this.renderSelection();
    }

    // 绘制填充柄（活动选区右下角方块）
    this.renderFillHandle();

    // 绘制填充柄拖拽预览（虚线边框）
    this.renderFillDragPreview();

    // 绘制拖拽移动预览（半透明背景 + 虚线边框）
    this.renderDragMovePreview();

    // 绘制远程用户光标（协同编辑）
    if (this.cursorAwareness) {
      this.cursorAwareness.renderCursors(this.ctx, this.viewport, this.model, this.config);
    }

    // 绘制图表浮动层（在选区之后、行列标题之前）
    if (this.chartOverlay) {
      const { headerWidth, headerHeight } = this.config;
      this.chartOverlay.renderAll(
        this.ctx,
        this.viewport,
        this.viewport.scrollX - headerWidth,
        this.viewport.scrollY - headerHeight
      );
    }

    // 绘制冻结窗格（在行列标题之前，覆盖滚动区域的单元格）
    this.renderFrozenPanes();

    // 绘制行标题（在单元格之上）
    this.renderRowHeaders();

    // 绘制列标题（在单元格之上）
    this.renderColHeaders();

    // 绘制行分组指示区域（在行标题左侧）
    this.renderRowGroupIndicators();

    // 绘制列分组指示区域（在列标题上方）
    this.renderColGroupIndicators();

    // 绘制左上角空白区域
    this.renderCorner();

    // 排序筛选激活时，在状态栏显示筛选摘要
    if (this.sortFilterModel && this.sortFilterModel.hasActiveFilters()) {
      this.renderFilterStatusBar();
    }
  }

  // 绘制高亮行背景
  private renderHighlightedRow(): void {
    if (this.highlightedRow === null) return;

    // 隐藏行不绘制高亮
    if (this.model.isRowHidden(this.highlightedRow)) return;

    const { headerWidth, headerHeight } = this.config;
    const { scrollY } = this.viewport;

    // 检查高亮行是否在可见范围内
    if (this.highlightedRow < this.viewport.startRow || this.highlightedRow > this.viewport.endRow) {
      return;
    }

    // 计算高亮行的Y坐标
    const rowY = headerHeight + this.model.getRowY(this.highlightedRow) - scrollY;
    const rowHeight = this.model.getRowHeight(this.highlightedRow);

    // 绘制高亮背景
    this.ctx.fillStyle = this.themeColors.highlightBackground;
    this.ctx.fillRect(headerWidth, rowY, this.canvasWidth - headerWidth, rowHeight);
  }

  // 绘制高亮列背景
  private renderHighlightedCol(): void {
    if (this.highlightedCol === null) return;

    // 隐藏列不绘制高亮
    if (this.model.isColHidden(this.highlightedCol)) return;

    const { headerWidth, headerHeight } = this.config;
    const { scrollX } = this.viewport;

    // 检查高亮列是否在可见范围内
    if (this.highlightedCol < this.viewport.startCol || this.highlightedCol > this.viewport.endCol) {
      return;
    }

    // 计算高亮列的X坐标
    const colX = headerWidth + this.model.getColX(this.highlightedCol) - scrollX;
    const colWidth = this.model.getColWidth(this.highlightedCol);

    // 绘制高亮背景
    this.ctx.fillStyle = this.themeColors.highlightBackground;
    this.ctx.fillRect(colX, headerHeight, colWidth, this.canvasHeight - headerHeight);
  }

  // 设置高亮行
  public setHighlightedRow(row: number | null): void {
    this.highlightedRow = row;
    this.highlightedCol = null; // 清除列高亮
    this.render();
  }

  // 设置高亮列
  public setHighlightedCol(col: number | null): void {
    this.highlightedCol = col;
    this.highlightedRow = null; // 清除行高亮
    this.render();
  }

  // 获取高亮行
  public getHighlightedRow(): number | null {
    return this.highlightedRow;
  }

  // 获取高亮列
  public getHighlightedCol(): number | null {
    return this.highlightedCol;
  }

  // 清除所有高亮
  public clearHighlight(): void {
    this.highlightedRow = null;
    this.highlightedCol = null;
    this.render();
  }

  // 绘制左上角空白区域
  private renderCorner(): void {
    const { headerWidth, headerHeight } = this.config;

    this.ctx.fillStyle = this.themeColors.headerBackground;
    this.ctx.fillRect(0, 0, headerWidth, headerHeight);

    // 绘制边框
    this.ctx.strokeStyle = this.themeColors.gridLine;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(0, 0, headerWidth, headerHeight);
  }

  // 筛选激活时在画布底部显示筛选摘要信息
  private renderFilterStatusBar(): void {
    if (!this.sortFilterModel) return;
    const visible = this.sortFilterModel.getVisibleRowCount();
    const total = this.sortFilterModel.getTotalRowCount();
    const text = `显示 ${visible} / ${total} 行`;
    const { fontFamily } = this.config;

    this.ctx.save();
    this.ctx.font = `12px ${fontFamily}`;
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillStyle = this.themeColors.headerText;
    this.ctx.fillText(text, this.canvasWidth - 10, this.canvasHeight - 4);
    this.ctx.restore();
  }

  /**
   * 冻结窗格渲染
   * 将画布分为最多 4 个区域：
   * - 左上角（冻结行+冻结列交叉区域）
   * - 顶部（冻结行，水平滚动）
   * - 左侧（冻结列，垂直滚动）
   * - 正常滚动区域（已由 renderCells 处理）
   * 冻结区域的单元格在固定位置重新绘制，不受对应方向的滚动影响
   */
  private renderFrozenPanes(): void {
    const freezeRows = this.model.getFreezeRows();
    const freezeCols = this.model.getFreezeCols();
    if (freezeRows === 0 && freezeCols === 0) return;

    const { headerWidth, headerHeight, cellPadding, fontFamily } = this.config;

    // 计算冻结区域的像素尺寸
    let frozenRowHeight = 0;
    for (let r = 0; r < freezeRows; r++) {
      frozenRowHeight += this.model.getRowHeight(r);
    }
    let frozenColWidth = 0;
    for (let c = 0; c < freezeCols; c++) {
      frozenColWidth += this.model.getColWidth(c);
    }

    // 获取条件格式引擎
    const cfEngine = this.model.getConditionalFormatEngine();

    // 辅助方法：渲染单个冻结单元格
    const renderFrozenCell = (row: number, col: number, cellX: number, cellY: number): void => {
      const cellInfo = this.model.getMergedCellInfo(row, col);
      if (!cellInfo || cellInfo.row !== row || cellInfo.col !== col) return;

      const colWidth = this.model.getColWidth(col);
      const rowHeight = this.model.getRowHeight(row);

      // 绘制背景（先用默认背景覆盖滚动区域的内容）
      this.ctx.fillStyle = this.themeColors.background;
      this.ctx.fillRect(cellX, cellY, colWidth, rowHeight);

      // 条件格式
      const rawCell = this.model.getCell(row, col);
      const cfResult = rawCell ? cfEngine.evaluate(row, col, rawCell) : null;
      const effectiveBgColor = cfResult?.bgColor || cellInfo.bgColor;
      if (effectiveBgColor) {
        this.ctx.fillStyle = effectiveBgColor;
        this.ctx.fillRect(cellX, cellY, colWidth, rowHeight);
      }

      // 显示文本
      const displayText = this.getFormattedDisplayText(cellInfo);
      if (!displayText) return;

      const fontWeight = cellInfo.fontBold ? 'bold ' : '';
      let fontStyle = cellInfo.fontItalic ? 'italic ' : '';
      if (cellInfo.formulaContent) fontStyle = 'italic ';
      const fontSize = cellInfo.fontSize || this.cellFontSize;
      this.ctx.font = `${fontStyle}${fontWeight}${fontSize}px ${fontFamily}`;

      const effectiveFontColor = cfResult?.fontColor || cellInfo.fontColor || this.themeColors.cellText;
      const align = cellInfo.fontAlign || 'left';
      const verticalAlign = cellInfo.verticalAlign || 'middle';

      // 裁剪到单元格区域
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(cellX, cellY, colWidth, rowHeight);
      this.ctx.clip();

      // 计算文本位置
      this.ctx.textAlign = align;
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = effectiveFontColor;

      let textX: number;
      switch (align) {
        case 'center': textX = cellX + colWidth / 2; break;
        case 'right': textX = cellX + colWidth - cellPadding; break;
        default: textX = cellX + cellPadding;
      }

      let textY: number;
      switch (verticalAlign) {
        case 'top': textY = cellY + fontSize / 2 + cellPadding; break;
        case 'bottom': textY = cellY + rowHeight - fontSize / 2 - cellPadding; break;
        default: textY = cellY + rowHeight / 2;
      }

      this.ctx.fillText(displayText, textX, textY);

      // 下划线
      if (cellInfo.fontUnderline) {
        const textWidth = this.ctx.measureText(displayText).width;
        const underlineY = textY + 2;
        this.ctx.beginPath();
        this.ctx.moveTo(cellX + cellPadding, underlineY);
        this.ctx.lineTo(cellX + cellPadding + textWidth, underlineY);
        this.ctx.strokeStyle = effectiveFontColor;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }

      this.ctx.restore();

      // 绘制网格线
      this.ctx.strokeStyle = this.themeColors.gridLine;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(cellX + colWidth, cellY);
      this.ctx.lineTo(cellX + colWidth, cellY + rowHeight);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(cellX, cellY + rowHeight);
      this.ctx.lineTo(cellX + colWidth, cellY + rowHeight);
      this.ctx.stroke();
    };

    // === 1. 渲染冻结行区域（顶部，水平随滚动，垂直固定） ===
    if (freezeRows > 0) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(headerWidth, headerHeight, this.canvasWidth - headerWidth, frozenRowHeight);
      this.ctx.clip();

      // 先用背景色清除该区域
      this.ctx.fillStyle = this.themeColors.background;
      this.ctx.fillRect(headerWidth, headerHeight, this.canvasWidth - headerWidth, frozenRowHeight);

      let cellY = headerHeight;
      for (let row = 0; row < freezeRows; row++) {
        const rowHeight = this.model.getRowHeight(row);
        let cellX = headerWidth + this.viewport.offsetX;
        for (let col = this.viewport.startCol; col <= this.viewport.endCol; col++) {
          if (this.model.isColHidden(col)) continue;
          // 跳过冻结列区域（由左上角交叉区域处理）
          if (col < freezeCols) {
            cellX += this.model.getColWidth(col);
            continue;
          }
          renderFrozenCell(row, col, cellX, cellY);
          cellX += this.model.getColWidth(col);
        }
        cellY += rowHeight;
      }

      this.ctx.restore();
    }

    // === 2. 渲染冻结列区域（左侧，垂直随滚动，水平固定） ===
    if (freezeCols > 0) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(headerWidth, headerHeight, frozenColWidth, this.canvasHeight - headerHeight);
      this.ctx.clip();

      // 先用背景色清除该区域
      this.ctx.fillStyle = this.themeColors.background;
      this.ctx.fillRect(headerWidth, headerHeight, frozenColWidth, this.canvasHeight - headerHeight);

      let cellY = headerHeight + this.viewport.offsetY;
      for (let row = this.viewport.startRow; row <= this.viewport.endRow; row++) {
        if (this.model.isRowHidden(row)) continue;
        // 跳过冻结行区域（由左上角交叉区域处理）
        if (row < freezeRows) {
          cellY += this.model.getRowHeight(row);
          continue;
        }
        const rowHeight = this.model.getRowHeight(row);
        let cellX = headerWidth;
        for (let col = 0; col < freezeCols; col++) {
          if (this.model.isColHidden(col)) continue;
          renderFrozenCell(row, col, cellX, cellY);
          cellX += this.model.getColWidth(col);
        }
        cellY += rowHeight;
      }

      this.ctx.restore();
    }

    // === 3. 渲染左上角交叉区域（行列都固定） ===
    if (freezeRows > 0 && freezeCols > 0) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(headerWidth, headerHeight, frozenColWidth, frozenRowHeight);
      this.ctx.clip();

      // 先用背景色清除该区域
      this.ctx.fillStyle = this.themeColors.background;
      this.ctx.fillRect(headerWidth, headerHeight, frozenColWidth, frozenRowHeight);

      let cellY = headerHeight;
      for (let row = 0; row < freezeRows; row++) {
        const rowHeight = this.model.getRowHeight(row);
        let cellX = headerWidth;
        for (let col = 0; col < freezeCols; col++) {
          if (this.model.isColHidden(col)) continue;
          renderFrozenCell(row, col, cellX, cellY);
          cellX += this.model.getColWidth(col);
        }
        cellY += rowHeight;
      }

      this.ctx.restore();
    }

    // === 4. 绘制冻结分隔线 ===
    this.ctx.save();
    this.ctx.strokeStyle = '#4a86c8';
    this.ctx.lineWidth = 2;

    // 水平冻结线（冻结行下方）
    if (freezeRows > 0) {
      const freezeLineY = headerHeight + frozenRowHeight;
      this.ctx.beginPath();
      this.ctx.moveTo(headerWidth, freezeLineY);
      this.ctx.lineTo(this.canvasWidth, freezeLineY);
      this.ctx.stroke();
    }

    // 垂直冻结线（冻结列右侧）
    if (freezeCols > 0) {
      const freezeLineX = headerWidth + frozenColWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(freezeLineX, headerHeight);
      this.ctx.lineTo(freezeLineX, this.canvasHeight);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  // 绘制行标题
  private renderRowHeaders(): void {
    const { headerWidth, headerHeight, fontSize, fontFamily } = this.config;
    const { offsetY } = this.viewport;

    // 绘制背景
    this.ctx.fillStyle = this.themeColors.headerBackground;
    this.ctx.fillRect(0, headerHeight, headerWidth, this.canvas.height - headerHeight);

    this.ctx.font = `${fontSize}px ${fontFamily}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // 排序筛选是否激活
    const sfActive = this.sortFilterModel && this.sortFilterModel.isActive();

    let currentY = headerHeight + offsetY;

    // 绘制行标题
    for (let row = this.viewport.startRow; row <= this.viewport.endRow; row++) {
      // 跳过隐藏行，但检查是否需要绘制隐藏指示符
      if (this.model.isRowHidden(row)) {
        // 检查该隐藏行是否是一段连续隐藏区域的起始位置，绘制双线指示符
        if (row === this.viewport.startRow || !this.model.isRowHidden(row - 1)) {
          this.renderHiddenRowIndicator(currentY);
        }
        continue;
      }

      // 排序筛选激活时，映射到数据行
      const dataRow = sfActive ? this.sortFilterModel!.getDataRowIndex(row) : row;
      if (dataRow === -1) {
        currentY += this.model.getRowHeight(row);
        continue;
      }

      const rowHeight = this.model.getRowHeight(dataRow);

      // 只绘制可见部分
      if (currentY + rowHeight > headerHeight && currentY < this.canvasHeight) {
        // 绘制行号背景（高亮行或全选状态使用深色背景）
        if (this.highlightedRow === row || this.highlightAllHeaders) {
          this.ctx.fillStyle = this.themeColors.highlightHeaderBackground;
        } else {
          this.ctx.fillStyle = this.themeColors.headerBackground;
        }
        this.ctx.fillRect(0, Math.max(headerHeight, currentY), headerWidth, rowHeight);

        // 绘制行号：排序筛选激活时显示实际数据行号
        this.ctx.fillStyle = this.themeColors.headerText;
        const textY = Math.max(headerHeight + rowHeight / 2, currentY + rowHeight / 2);
        if (textY > headerHeight && textY < this.canvasHeight) {
          this.ctx.fillText(
            (dataRow + 1).toString(),
            headerWidth / 2,
            currentY + rowHeight / 2
          );
        }

        // 绘制边框
        this.ctx.strokeStyle = this.themeColors.gridLine;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, currentY + rowHeight);
        this.ctx.lineTo(headerWidth, currentY + rowHeight);
        this.ctx.stroke();
      }

      currentY += rowHeight;
    }

    // === 冻结行的行头：在固定位置覆盖绘制（在滚动行头之后） ===
    const freezeRows = this.model.getFreezeRows();
    if (freezeRows > 0) {
      let frozenY = headerHeight;
      for (let row = 0; row < freezeRows; row++) {
        if (this.model.isRowHidden(row)) continue;
        const rowHeight = this.model.getRowHeight(row);

        if (frozenY + rowHeight > headerHeight && frozenY < this.canvasHeight) {
          // 绘制行号背景
          if (this.highlightedRow === row || this.highlightAllHeaders) {
            this.ctx.fillStyle = this.themeColors.highlightHeaderBackground;
          } else {
            this.ctx.fillStyle = this.themeColors.headerBackground;
          }
          this.ctx.fillRect(0, frozenY, headerWidth, rowHeight);

          // 绘制行号
          this.ctx.fillStyle = this.themeColors.headerText;
          this.ctx.fillText((row + 1).toString(), headerWidth / 2, frozenY + rowHeight / 2);

          // 绘制边框
          this.ctx.strokeStyle = this.themeColors.gridLine;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(0, frozenY + rowHeight);
          this.ctx.lineTo(headerWidth, frozenY + rowHeight);
          this.ctx.stroke();
        }
        frozenY += rowHeight;
      }
    }

    // 绘制右边框
    this.ctx.strokeStyle = this.themeColors.gridLine;
    this.ctx.beginPath();
    this.ctx.moveTo(headerWidth, headerHeight);
    this.ctx.lineTo(headerWidth, this.canvasHeight);
    this.ctx.stroke();
  }

  /**
   * 在行标题区域绘制隐藏行双线指示符
   * 两条平行细线，间距 2px，提示用户此处存在隐藏行
   */
  private renderHiddenRowIndicator(y: number): void {
    const { headerWidth } = this.config;

    this.ctx.save();
    this.ctx.strokeStyle = this.themeColors.headerText;
    this.ctx.lineWidth = 1;

    // 绘制两条平行水平线，间距 2px
    this.ctx.beginPath();
    this.ctx.moveTo(0, y - 1);
    this.ctx.lineTo(headerWidth, y - 1);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(0, y + 1);
    this.ctx.lineTo(headerWidth, y + 1);
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * 在列标题区域绘制隐藏列双线指示符
   * 两条平行细线，间距 2px，提示用户此处存在隐藏列
   */
  private renderHiddenColIndicator(x: number): void {
    const { headerHeight } = this.config;
    const colGroupHeight = this.getColGroupAreaHeight();

    this.ctx.save();
    this.ctx.strokeStyle = this.themeColors.headerText;
    this.ctx.lineWidth = 1;

    // 绘制两条平行垂直线，间距 2px
    this.ctx.beginPath();
    this.ctx.moveTo(x - 1, colGroupHeight);
    this.ctx.lineTo(x - 1, colGroupHeight + headerHeight);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(x + 1, colGroupHeight);
    this.ctx.lineTo(x + 1, colGroupHeight + headerHeight);
    this.ctx.stroke();

    this.ctx.restore();
  }

  // 绘制列标题
  private renderColHeaders(): void {
    const { headerWidth, headerHeight, fontSize, fontFamily } = this.config;
    const { offsetX } = this.viewport;
    
    // 列分组区域高度，列标题需要绘制在分组区域下方
    const colGroupHeight = this.getColGroupAreaHeight();

    // 绘制背景
    this.ctx.fillStyle = this.themeColors.headerBackground;
    this.ctx.fillRect(headerWidth, colGroupHeight, this.canvasWidth - headerWidth, headerHeight);

    this.ctx.font = `${fontSize}px ${fontFamily}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // === 冻结列的列头：在固定位置绘制 ===
    const freezeCols = this.model.getFreezeCols();

    let currentX = headerWidth + offsetX;

    // 绘制列标题
    for (let col = this.viewport.startCol; col <= this.viewport.endCol; col++) {
      // 跳过隐藏列，但检查是否需要绘制隐藏指示符
      if (this.model.isColHidden(col)) {
        // 检查该隐藏列是否是一段连续隐藏区域的起始位置，绘制双线指示符
        if (col === this.viewport.startCol || !this.model.isColHidden(col - 1)) {
          this.renderHiddenColIndicator(currentX);
        }
        continue;
      }

      const colWidth = this.model.getColWidth(col);

      // 只绘制可见部分
      if (currentX + colWidth > headerWidth && currentX < this.canvasWidth) {
        // 绘制列号背景（高亮列或全选状态使用深色背景）
        if (this.highlightedCol === col || this.highlightAllHeaders) {
          this.ctx.fillStyle = this.themeColors.highlightHeaderBackground;
        } else {
          this.ctx.fillStyle = this.themeColors.headerBackground;
        }
        this.ctx.fillRect(Math.max(headerWidth, currentX), colGroupHeight, colWidth, headerHeight);

        // 绘制列号
        this.ctx.fillStyle = this.themeColors.headerText;
        const textX = currentX + colWidth / 2;
        if (textX > headerWidth && textX < this.canvasWidth) {
          this.ctx.fillText(
            this.columnIndexToLetter(col),
            textX,
            colGroupHeight + headerHeight / 2
          );
        }

        // 排序筛选指示器：在列头绘制排序箭头和筛选图标
        if (this.sortFilterModel) {
          // 检查该列是否有排序规则
          const sortRules = this.sortFilterModel.getSortRules();
          const sortRule = sortRules.find((r) => r.colIndex === col);
          if (sortRule) {
            ColumnHeaderIndicator.renderSortArrow(
              this.ctx, currentX, colGroupHeight, colWidth, headerHeight, sortRule.direction
            );
          }

          // 仅在该列有活跃筛选时显示高亮图标
          const hasFilter = this.sortFilterModel.hasActiveFilter(col);
          if (hasFilter) {
            ColumnHeaderIndicator.renderFilterIcon(
              this.ctx, currentX, colGroupHeight, colWidth, headerHeight, true
            );
          }
        }

        // 绘制边框
        this.ctx.strokeStyle = this.themeColors.gridLine;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(currentX + colWidth, colGroupHeight);
        this.ctx.lineTo(currentX + colWidth, colGroupHeight + headerHeight);
        this.ctx.stroke();
      }

      currentX += colWidth;
    }

    // 冻结列的列头覆盖绘制（在固定位置，覆盖滚动的列头）
    if (freezeCols > 0) {
      let frozenX = headerWidth;
      for (let col = 0; col < freezeCols; col++) {
        if (this.model.isColHidden(col)) continue;
        const colWidth = this.model.getColWidth(col);

        // 绘制列号背景
        if (this.highlightedCol === col || this.highlightAllHeaders) {
          this.ctx.fillStyle = this.themeColors.highlightHeaderBackground;
        } else {
          this.ctx.fillStyle = this.themeColors.headerBackground;
        }
        this.ctx.fillRect(frozenX, colGroupHeight, colWidth, headerHeight);

        // 绘制列号
        this.ctx.fillStyle = this.themeColors.headerText;
        this.ctx.fillText(
          this.columnIndexToLetter(col),
          frozenX + colWidth / 2,
          colGroupHeight + headerHeight / 2
        );

        // 绘制边框
        this.ctx.strokeStyle = this.themeColors.gridLine;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(frozenX + colWidth, colGroupHeight);
        this.ctx.lineTo(frozenX + colWidth, colGroupHeight + headerHeight);
        this.ctx.stroke();

        frozenX += colWidth;
      }
    }

    // 绘制底边框
    this.ctx.strokeStyle = this.themeColors.gridLine;
    this.ctx.beginPath();
    this.ctx.moveTo(headerWidth, colGroupHeight + headerHeight);
    this.ctx.lineTo(this.canvasWidth, colGroupHeight + headerHeight);
    this.ctx.stroke();
  }

  // 根据单元格格式信息获取格式化后的显示文本
  private getFormattedDisplayText(cellInfo: {
    content: string;
    format?: CellFormat;
    rawValue?: number;
  }): string {
    const { format, rawValue, content } = cellInfo;

    // 有 format + rawValue 时，调用对应格式化引擎
    if (format && rawValue !== undefined) {
      const { category, pattern } = format;

      // 数字/货币/百分比/科学计数法 → NumberFormatter
      if (category === 'number' || category === 'currency' || category === 'percentage' || category === 'scientific') {
        return NumberFormatter.format(rawValue, pattern);
      }

      // 日期/时间/日期时间 → DateFormatter
      if (category === 'date' || category === 'time' || category === 'datetime') {
        return DateFormatter.format(rawValue, pattern);
      }
    }

    // 无格式或通用格式 → 使用原始 content
    return content;
  }

  /**
   * 渲染自动换行文本
   * 按 \n 分割段落，每段按单元格宽度自动换行，根据 verticalAlign 定位多行文本
   */
  private renderWrappedText(
    text: string,
    x: number, y: number,
    cellWidth: number, cellHeight: number,
    fontSize: number,
    align: string, verticalAlign: string,
    fontColor: string,
    iconOffset: number
  ): void {
    const { cellPadding } = this.config;
    const lineHeight = fontSize * 1.4;
    const maxTextWidth = cellWidth - 2 * cellPadding - iconOffset;

    if (maxTextWidth <= 0) return;

    // 1. 按 \n 分割为段落
    const paragraphs = text.split('\n');

    // 2. 每段按单元格宽度进行自动换行（逐字测量）
    const lines: string[] = [];
    for (const paragraph of paragraphs) {
      if (paragraph === '') {
        // 空段落也占一行
        lines.push('');
        continue;
      }

      let currentLine = '';
      for (let i = 0; i < paragraph.length; i++) {
        const char = paragraph[i];
        const testLine = currentLine + char;
        const testWidth = this.ctx.measureText(testLine).width;

        if (testWidth > maxTextWidth && currentLine.length > 0) {
          // 当前行已满，换行
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }
      // 段落最后一行
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
    }

    if (lines.length === 0) return;

    // 3. 计算总高度
    const totalTextHeight = lines.length * lineHeight;

    // 4. 根据 verticalAlign 计算起始 Y
    let startY: number;
    switch (verticalAlign) {
      case 'top':
        startY = y + cellPadding + fontSize / 2;
        break;
      case 'bottom':
        startY = y + cellHeight - cellPadding - totalTextHeight + fontSize / 2;
        break;
      default: // middle
        startY = y + (cellHeight - totalTextHeight) / 2 + fontSize / 2;
        break;
    }

    // 5. 设置裁剪区域，防止文本溢出单元格
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, cellWidth, cellHeight);
    this.ctx.clip();

    this.ctx.fillStyle = fontColor;
    this.ctx.textBaseline = 'middle';

    // 6. 逐行绘制
    for (let i = 0; i < lines.length; i++) {
      const lineY = startY + i * lineHeight;

      // 计算文本 X 坐标（根据对齐方式）
      let textX: number;
      this.ctx.textAlign = align as CanvasTextAlign;
      switch (align) {
        case 'center':
          textX = x + cellWidth / 2 + iconOffset / 2;
          break;
        case 'right':
          textX = x + cellWidth - cellPadding;
          break;
        default: // left
          textX = x + cellPadding + iconOffset;
          break;
      }

      this.ctx.fillText(lines[i], textX, lineY);
    }

    this.ctx.restore();
  }

  /**
   * 渲染富文本内容
   * 逐段测量宽度，根据 textAlign 计算起始位置，逐段设置字体样式并绘制
   * 支持加粗、斜体、下划线、字体颜色、字号
   */
  private renderRichText(
    segments: RichTextSegment[],
    x: number, y: number,
    cellWidth: number, cellHeight: number,
    defaultFontSize: number,
    textAlign: string,
    verticalAlign: string,
    defaultFontColor: string,
    iconOffset: number
  ): void {
    const { cellPadding, fontFamily } = this.config;
    const maxTextWidth = cellWidth - 2 * cellPadding - iconOffset;

    if (maxTextWidth <= 0 || segments.length === 0) return;

    // 设置裁剪区域，防止文本溢出单元格
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, cellWidth, cellHeight);
    this.ctx.clip();

    // 1. 逐段测量宽度，计算总宽度
    interface SegmentMeasure {
      segment: RichTextSegment;
      width: number;
      font: string;
      fontSize: number;
    }

    const measures: SegmentMeasure[] = [];
    let totalWidth = 0;

    for (const segment of segments) {
      const fontSize = segment.fontSize || defaultFontSize;
      const fontWeight = segment.fontBold ? 'bold ' : '';
      const fontStyle = segment.fontItalic ? 'italic ' : '';
      const font = `${fontStyle}${fontWeight}${fontSize}px ${fontFamily}`;

      this.ctx.font = font;
      const width = this.ctx.measureText(segment.text).width;

      measures.push({ segment, width, font, fontSize });
      totalWidth += width;
    }

    // 2. 根据 textAlign 计算起始 X 位置
    let startX: number;
    switch (textAlign) {
      case 'center':
        startX = x + cellPadding + iconOffset + (maxTextWidth - totalWidth) / 2;
        break;
      case 'right':
        startX = x + cellWidth - cellPadding - totalWidth;
        break;
      default: // left
        startX = x + cellPadding + iconOffset;
        break;
    }

    // 3. 根据 verticalAlign 计算文本 Y 坐标
    // 使用最大字号来确定行高
    let maxFontSize = defaultFontSize;
    for (const m of measures) {
      if (m.fontSize > maxFontSize) {
        maxFontSize = m.fontSize;
      }
    }

    let textY: number;
    switch (verticalAlign) {
      case 'top':
        textY = y + maxFontSize / 2 + cellPadding;
        break;
      case 'bottom':
        textY = y + cellHeight - maxFontSize / 2 - cellPadding;
        break;
      default: // middle
        textY = y + cellHeight / 2;
        break;
    }

    // 4. 逐段设置字体样式并绘制
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    let currentX = startX;

    for (const { segment, width, font, fontSize } of measures) {
      this.ctx.font = font;
      this.ctx.fillStyle = segment.fontColor || defaultFontColor;

      this.ctx.fillText(segment.text, currentX, textY);

      // 5. 处理下划线绘制
      if (segment.fontUnderline) {
        const underlineY = textY + fontSize / 2 + 1;
        this.ctx.beginPath();
        this.ctx.moveTo(currentX, underlineY);
        this.ctx.lineTo(currentX + width, underlineY);
        this.ctx.strokeStyle = segment.fontColor || defaultFontColor;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }

      currentX += width;
    }

    this.ctx.restore();
  }

  /**
   * 计算文本溢出可用宽度
   * 从当前单元格右侧开始，检查相邻空单元格，累加其宽度
   * 直到文本完全容纳或遇到非空单元格
   */
  private calculateOverflowWidth(
    row: number, col: number, textWidth: number, cellWidth: number
  ): number {
    // 如果文本已经在单元格内，无需溢出
    if (textWidth <= cellWidth) {
      return cellWidth;
    }

    let availableWidth = cellWidth;
    const totalCols = this.model.getColCount();

    // 从右侧相邻列开始检查
    for (let c = col + 1; c < totalCols; c++) {
      // 检查右侧单元格是否为空
      const adjacentCell = this.model.getCell(row, c);
      if (adjacentCell && adjacentCell.content !== '') {
        // 遇到非空单元格，停止扩展
        break;
      }

      // 累加空单元格的宽度
      availableWidth += this.model.getColWidth(c);

      // 如果已经足够容纳文本，停止扩展
      if (availableWidth >= textWidth) {
        break;
      }
    }

    return availableWidth;
  }


  // 绘制单元格
  private renderCells(): void {
    const { headerWidth, headerHeight, cellPadding, fontFamily } = this.config;
    const { offsetX, offsetY } = this.viewport;

    this.ctx.font = `${this.cellFontSize}px ${fontFamily}`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    // 获取条件格式引擎（在循环外获取，避免重复调用）
    const cfEngine = this.model.getConditionalFormatEngine();

    // 排序筛选激活时：检查是否所有行被筛选隐藏
    const sfActive = this.sortFilterModel && this.sortFilterModel.isActive();
    if (sfActive && this.sortFilterModel!.getVisibleRowCount() === 0 && this.sortFilterModel!.hasActiveFilters()) {
      // 所有行被筛选隐藏，显示"无匹配结果"提示
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(headerWidth, headerHeight, this.canvasWidth - headerWidth, this.canvasHeight - headerHeight);
      this.ctx.clip();
      this.ctx.fillStyle = this.themeColors.cellText;
      this.ctx.font = `14px ${fontFamily}`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        '无匹配结果',
        headerWidth + (this.canvasWidth - headerWidth) / 2,
        headerHeight + (this.canvasHeight - headerHeight) / 2
      );
      this.ctx.restore();
      return;
    }

    let currentY = headerHeight + offsetY;

    // 遍历可见行
    for (let row = this.viewport.startRow; row <= this.viewport.endRow; row++) {
      // 跳过隐藏行
      if (this.model.isRowHidden(row)) {
        continue;
      }

      // 排序筛选激活时，将显示行映射到数据行
      const dataRow = sfActive ? this.sortFilterModel!.getDataRowIndex(row) : row;
      if (dataRow === -1) {
        // 超出可见行范围，跳过
        currentY += this.model.getRowHeight(row);
        continue;
      }

      const rowHeight = this.model.getRowHeight(dataRow);
      let currentX = headerWidth + offsetX;

      // 遍历可见列
      for (let col = this.viewport.startCol; col <= this.viewport.endCol; col++) {
        // 跳过隐藏列
        if (this.model.isColHidden(col)) {
          continue;
        }

        const colWidth = this.model.getColWidth(col);

        // 获取单元格信息（考虑合并单元格），使用数据行索引
        const cellInfo = this.model.getMergedCellInfo(dataRow, col);

        if (cellInfo && (cellInfo.row === dataRow && cellInfo.col === col)) {
          // 计算合并单元格的总宽度和高度
          let totalWidth = 0;
          for (let c = 0; c < cellInfo.colSpan; c++) {
            totalWidth += this.model.getColWidth(col + c);
          }

          let totalHeight = 0;
          for (let r = 0; r < cellInfo.rowSpan; r++) {
            totalHeight += this.model.getRowHeight(row + r);
          }

          // 裁剪区域，避免绘制到标题区域
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.rect(headerWidth, headerHeight, this.canvasWidth - headerWidth, this.canvasHeight - headerHeight);
          this.ctx.clip();

          // save/restore 会重置字体，需要重新设置
          const fontWeight = cellInfo.fontBold ? 'bold ' : '';
          let fontStyle = cellInfo.fontItalic ? 'italic ' : '';
          if (cellInfo.formulaContent) {
            fontStyle = 'italic ';
          }
          this.ctx.font = `${fontStyle}${fontWeight}${cellInfo.fontSize || this.cellFontSize}px ${fontFamily}`;

          // 记录是否需要绘制下划线
          const needUnderline = cellInfo.fontUnderline;

          // 【条件格式】评估条件格式规则，获取样式覆盖和可视化效果
          const rawCell = this.model.getCell(cellInfo.row, cellInfo.col);
          const cfResult = rawCell ? cfEngine.evaluate(cellInfo.row, cellInfo.col, rawCell) : null;
          const cfVisuals = rawCell ? this.getConditionalFormatVisuals(cfEngine, cellInfo.row, cellInfo.col, rawCell) : null;

          // 确定最终背景色：条件格式覆盖 > 单元格自定义颜色
          const effectiveBgColor = cfResult?.bgColor || cellInfo.bgColor;

          // 绘制背景颜色
          if (effectiveBgColor) {
            this.ctx.fillStyle = effectiveBgColor;
            this.ctx.fillRect(currentX, currentY, totalWidth, totalHeight);
          }

          // 【条件格式】绘制数据条背景
          if (cfVisuals?.dataBar) {
            this.renderDataBar(cfVisuals.dataBar, currentX, currentY, totalWidth, totalHeight);
          }

          // 确定显示文本：有 format + rawValue 时调用格式化引擎，否则使用 content
          const displayText = this.getFormattedDisplayText(cellInfo);

          // 确定最终字体颜色：条件格式覆盖 > 单元格自定义颜色 > 主题默认颜色
          const effectiveFontColor = cfResult?.fontColor || cellInfo.fontColor || this.themeColors.cellText;

          // 【富文本】优先使用 richText 渲染（需求 6.5：richText 优先于 content）
          if (cellInfo.richText && cellInfo.richText.length > 0) {
            const iconOffset = cfVisuals?.icon ? 18 : 0;
            const align = cellInfo.fontAlign || 'left';
            const verticalAlign = cellInfo.verticalAlign || 'middle';
            const fontSize = cellInfo.fontSize || this.cellFontSize;
            this.renderRichText(
              cellInfo.richText,
              currentX, currentY,
              totalWidth, totalHeight,
              fontSize,
              align, verticalAlign,
              effectiveFontColor,
              iconOffset
            );
          } else if (displayText) {
            // 如果有图标集，为图标预留左侧空间
            const iconOffset = cfVisuals?.icon ? 18 : 0;

            // 判断是否需要换行渲染：wrapText=true 或内容包含 \n
            const needWrap = cellInfo.wrapText || displayText.includes('\n');

            if (needWrap) {
              // 使用换行渲染路径
              const align = cellInfo.fontAlign || 'left';
              const verticalAlign = cellInfo.verticalAlign || 'middle';
              const fontSize = cellInfo.fontSize || this.cellFontSize;
              this.renderWrappedText(
                displayText,
                currentX, currentY,
                totalWidth, totalHeight,
                fontSize,
                align, verticalAlign,
                effectiveFontColor,
                iconOffset
              );
            } else {
            // 单行文本处理（含溢出逻辑）
            const align = cellInfo.fontAlign || 'left';
            const maxTextWidth = totalWidth - 2 * cellPadding - iconOffset;
            let text = displayText;
            const fullTextWidth = this.ctx.measureText(text).width;
            let textWidth = fullTextWidth;

            // 【文本溢出】仅对左对齐且非换行的单元格启用向右溢出
            const canOverflow = align === 'left' && !cellInfo.wrapText && fullTextWidth > maxTextWidth;
            let overflowWidth = 0;

            if (canOverflow) {
              // 计算溢出可用宽度（含 padding）
              const overflowAvailable = this.calculateOverflowWidth(
                cellInfo.row, cellInfo.col, fullTextWidth + 2 * cellPadding + iconOffset, totalWidth
              );
              const overflowMaxTextWidth = overflowAvailable - 2 * cellPadding - iconOffset;

              if (fullTextWidth <= overflowMaxTextWidth) {
                // 溢出区域足够容纳完整文本，不截断
                overflowWidth = overflowAvailable - totalWidth;
                text = displayText;
                textWidth = fullTextWidth;
              } else {
                // 溢出区域仍不够，在溢出宽度内截断
                overflowWidth = overflowAvailable - totalWidth;
                const truncMaxWidth = overflowAvailable - 2 * cellPadding - iconOffset;
                while (text.length > 0 && textWidth > truncMaxWidth) {
                  text = text.slice(0, -1);
                  textWidth = this.ctx.measureText(text + '...').width;
                }
                text += '...';
              }
            } else if (fullTextWidth > maxTextWidth) {
              // 非溢出场景的常规截断
              while (text.length > 0 && textWidth > maxTextWidth) {
                text = text.slice(0, -1);
                textWidth = this.ctx.measureText(text + '...').width;
              }
              text += '...';
            }

            // 如果有溢出，扩展裁剪区域以覆盖溢出部分
            if (overflowWidth > 0) {
              this.ctx.save();
              this.ctx.beginPath();
              this.ctx.rect(
                currentX, currentY,
                totalWidth + overflowWidth, totalHeight
              );
              this.ctx.clip();
            }

            // 设置文本对齐方式
            this.ctx.textAlign = align;
            
            // 计算文本X坐标（图标集时左对齐需偏移）
            let textX: number;
            switch (align) {
              case 'center':
                textX = currentX + totalWidth / 2 + iconOffset / 2;
                break;
              case 'right':
                textX = currentX + totalWidth - cellPadding;
                break;
              default: // left
                textX = currentX + cellPadding + iconOffset;
            }

            // 根据垂直对齐方式计算文本Y坐标
            const verticalAlign = cellInfo.verticalAlign || 'middle';
            const fontSize = cellInfo.fontSize || this.cellFontSize;
            let textY: number;
            switch (verticalAlign) {
              case 'top':
                textY = currentY + fontSize / 2 + cellPadding;
                break;
              case 'bottom':
                textY = currentY + totalHeight - fontSize / 2 - cellPadding;
                break;
              default: // middle
                textY = currentY + totalHeight / 2;
            }

            // 使用最终确定的字体颜色
            this.ctx.fillStyle = effectiveFontColor;
            this.ctx.fillText(
              text,
              textX,
              textY
            );

            // 绘制下划线
            if (needUnderline) {
              const underlineY = textY + 2;
              this.ctx.beginPath();
              this.ctx.moveTo(currentX + cellPadding + iconOffset, underlineY);
              this.ctx.lineTo(currentX + cellPadding + iconOffset + textWidth, underlineY);
              this.ctx.strokeStyle = effectiveFontColor;
              this.ctx.lineWidth = 1;
              this.ctx.stroke();
            }

            // 恢复溢出裁剪区域
            if (overflowWidth > 0) {
              this.ctx.restore();
            }
            }
          }

          // 【条件格式】绘制图标集图标（在文本之后绘制，位于单元格左侧）
          if (cfVisuals?.icon) {
            this.renderConditionalIcon(cfVisuals.icon, currentX + cellPadding, currentY, totalHeight);
          }

          // 【数据验证】对有 dropdown 验证的单元格绘制 ▼ 下拉箭头图标
          if (cellInfo.validation?.type === 'dropdown') {
            this.renderDropdownArrow(currentX, currentY, totalWidth, totalHeight);
          }

          // 【迷你图】检查单元格是否有 sparkline 配置，有则绘制迷你图
          if (cellInfo.sparkline) {
            const sparklineData = this.resolveSparklineData(cellInfo.sparkline.dataRange);
            if (sparklineData.length > 0) {
              const sparklineTheme = this.getSparklineThemeColors();
              SparklineRenderer.render(
                this.ctx,
                cellInfo.sparkline,
                sparklineData,
                currentX, currentY,
                totalWidth, totalHeight,
                sparklineTheme
              );
            }
          }

          this.ctx.restore();
        }

        currentX += colWidth;
      }

      currentY += rowHeight;
    }
  }

  /**
   * 获取单元格的条件格式可视化效果（数据条、图标集）
   * 这些效果由专门的方法处理，不通过 evaluate() 返回
   */
  private getConditionalFormatVisuals(
    cfEngine: ConditionalFormatEngine,
    row: number,
    col: number,
    cell: Cell
  ): { dataBar?: DataBarParams; icon?: IconInfo } | null {
    const rules = cfEngine.getRules();
    let dataBar: DataBarParams | undefined;
    let icon: IconInfo | undefined;

    for (const rule of rules) {
      // 检查单元格是否在规则范围内
      const { startRow, startCol, endRow, endCol } = rule.range;
      if (row < startRow || row > endRow || col < startCol || col > endCol) {
        continue;
      }

      // 数据条效果
      if (rule.condition.type === 'dataBar' && !dataBar) {
        const params = cfEngine.getDataBarParams(row, col, cell, rule);
        if (params) {
          dataBar = params;
        }
      }

      // 图标集效果
      if (rule.condition.type === 'iconSet' && !icon) {
        const iconInfo = cfEngine.getIconSetIcon(row, col, cell, rule);
        if (iconInfo) {
          icon = iconInfo;
        }
      }
    }

    if (!dataBar && !icon) {
      return null;
    }

    return { dataBar, icon };
  }

  /**
   * 从模型中读取迷你图数据范围内的数值
   * 遍历 dataRange 内的所有单元格，提取数值数据
   */
  private resolveSparklineData(dataRange: { startRow: number; startCol: number; endRow: number; endCol: number }): number[] {
    const data: number[] = [];
    const { startRow, startCol, endRow, endCol } = dataRange;

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = this.model.getCell(r, c);
        if (cell) {
          // 优先使用 rawValue，否则尝试解析 content
          if (cell.rawValue !== undefined) {
            data.push(cell.rawValue);
          } else {
            const num = parseFloat(cell.content);
            if (!isNaN(num)) {
              data.push(num);
            }
          }
        }
      }
    }

    return data;
  }

  /**
   * 获取迷你图使用的主题颜色配置
   * 从当前渲染器主题颜色构建 ThemeColors 对象
   */
  private getSparklineThemeColors(): ThemeColors {
    const isDark = this.themeColors.background !== '#ffffff';
    return {
      background: this.themeColors.background,
      foreground: this.themeColors.foreground,
      gridLine: this.themeColors.gridLine,
      chartColors: isDark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT,
    };
  }

  /**
   * 绘制数据条背景（水平条形图）
   * 在单元格内绘制与数值成比例的半透明水平条
   */
  private renderDataBar(
    dataBar: DataBarParams,
    x: number,
    y: number,
    cellWidth: number,
    cellHeight: number
  ): void {
    const barPadding = 2;
    const barHeight = cellHeight - 2 * barPadding;
    const barWidth = (cellWidth - 2 * barPadding) * dataBar.percentage;

    if (barWidth <= 0) return;

    this.ctx.save();
    // 使用半透明颜色绘制数据条，避免遮挡文本
    this.ctx.globalAlpha = 0.3;
    this.ctx.fillStyle = dataBar.color;
    this.ctx.fillRect(x + barPadding, y + barPadding, barWidth, barHeight);
    this.ctx.restore();
  }

  /**
   * 绘制条件格式图标（箭头、圆点、旗帜）
   * 图标绘制在单元格左侧，文本内容向右偏移
   */
  private renderConditionalIcon(
    icon: IconInfo,
    x: number,
    y: number,
    cellHeight: number
  ): void {
    const iconSize = 12;
    const iconY = y + (cellHeight - iconSize) / 2;

    this.ctx.save();

    switch (icon.type) {
      case 'arrows':
        this.renderArrowIcon(x, iconY, iconSize, icon.index);
        break;
      case 'circles':
        this.renderCircleIcon(x, iconY, iconSize, icon.index);
        break;
      case 'flags':
        this.renderFlagIcon(x, iconY, iconSize, icon.index);
        break;
    }

    this.ctx.restore();
  }

  /**
   * 绘制箭头图标
   * index: 0=红色下箭头, 1=黄色横箭头, 2=绿色上箭头
   */
  private renderArrowIcon(x: number, y: number, size: number, index: number): void {
    const colors = ['#ff4444', '#ffaa00', '#44bb44'];
    const color = colors[index] || colors[0];
    const cx = x + size / 2;
    const cy = y + size / 2;

    this.ctx.fillStyle = color;
    this.ctx.beginPath();

    if (index === 2) {
      // 上箭头 ▲
      this.ctx.moveTo(cx, y);
      this.ctx.lineTo(x + size, y + size);
      this.ctx.lineTo(x, y + size);
    } else if (index === 0) {
      // 下箭头 ▼
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + size, y);
      this.ctx.lineTo(cx, y + size);
    } else {
      // 横箭头 ►
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + size, cy);
      this.ctx.lineTo(x, y + size);
    }

    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * 绘制圆点图标
   * index: 0=红色, 1=黄色, 2=绿色
   */
  private renderCircleIcon(x: number, y: number, size: number, index: number): void {
    const colors = ['#ff4444', '#ffaa00', '#44bb44'];
    const color = colors[index] || colors[0];
    const radius = size / 2;

    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * 绘制旗帜图标
   * index: 0=红色, 1=黄色, 2=绿色
   */
  private renderFlagIcon(x: number, y: number, size: number, index: number): void {
    const colors = ['#ff4444', '#ffaa00', '#44bb44'];
    const color = colors[index] || colors[0];

    // 旗杆
    this.ctx.strokeStyle = this.themeColors.cellText;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 1, y);
    this.ctx.lineTo(x + 1, y + size);
    this.ctx.stroke();

    // 旗面（三角形）
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 2, y);
    this.ctx.lineTo(x + size, y + size * 0.3);
    this.ctx.lineTo(x + 2, y + size * 0.6);
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * 绘制下拉验证箭头图标 ▼
   * 在单元格右侧绘制一个小三角形，指示该单元格有下拉列表验证
   */
  private renderDropdownArrow(cellX: number, cellY: number, cellWidth: number, cellHeight: number): void {
    const arrowSize = 8;
    const padding = 4;
    // 箭头位于单元格右侧居中
    const arrowX = cellX + cellWidth - arrowSize - padding;
    const arrowY = cellY + (cellHeight - arrowSize / 2) / 2;

    this.ctx.save();
    this.ctx.fillStyle = this.themeColors.cellText;
    this.ctx.globalAlpha = 0.6;
    this.ctx.beginPath();
    // 绘制向下的三角形 ▼
    this.ctx.moveTo(arrowX, arrowY);
    this.ctx.lineTo(arrowX + arrowSize, arrowY);
    this.ctx.lineTo(arrowX + arrowSize / 2, arrowY + arrowSize / 2);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  // 绘制网格线
  private renderGrid(): void {
    const { headerWidth, headerHeight } = this.config;
    const { offsetX, offsetY } = this.viewport;

    this.ctx.strokeStyle = this.themeColors.gridLine;
    this.ctx.lineWidth = 1;

    // 裁剪区域
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(headerWidth, headerHeight, this.canvasWidth - headerWidth, this.canvasHeight - headerHeight);
    this.ctx.clip();

    // 创建边界数组
    const horizontalBorders: boolean[][] = [];
    const verticalBorders: boolean[][] = [];

    for (let row = this.viewport.startRow; row <= this.viewport.endRow + 1; row++) {
      horizontalBorders[row] = [];
      verticalBorders[row] = [];
      for (let col = this.viewport.startCol; col <= this.viewport.endCol + 1; col++) {
        horizontalBorders[row][col] = true;
        verticalBorders[row][col] = true;
      }
    }

    // 处理合并单元格的边界
    for (let row = this.viewport.startRow; row <= this.viewport.endRow; row++) {
      for (let col = this.viewport.startCol; col <= this.viewport.endCol; col++) {
        const cellInfo = this.model.getMergedCellInfo(row, col);

        if (cellInfo && (cellInfo.rowSpan > 1 || cellInfo.colSpan > 1)) {
          const { row: startRow, col: startCol, rowSpan, colSpan } = cellInfo;

          for (let r = startRow; r < startRow + rowSpan; r++) {
            for (let c = startCol; c < startCol + colSpan - 1; c++) {
              if (r >= this.viewport.startRow && r <= this.viewport.endRow &&
                  c >= this.viewport.startCol && c <= this.viewport.endCol) {
                verticalBorders[r][c] = false;
              }
            }
          }

          for (let r = startRow; r < startRow + rowSpan - 1; r++) {
            for (let c = startCol; c < startCol + colSpan; c++) {
              if (r >= this.viewport.startRow && r <= this.viewport.endRow &&
                  c >= this.viewport.startCol && c <= this.viewport.endCol) {
                horizontalBorders[r][c] = false;
              }
            }
          }
        }
      }
    }

    // 绘制网格线
    let currentY = headerHeight + offsetY;

    for (let row = this.viewport.startRow; row <= this.viewport.endRow; row++) {
      // 跳过隐藏行
      if (this.model.isRowHidden(row)) {
        continue;
      }

      const rowHeight = this.model.getRowHeight(row);
      let currentX = headerWidth + offsetX;

      for (let col = this.viewport.startCol; col <= this.viewport.endCol; col++) {
        // 跳过隐藏列
        if (this.model.isColHidden(col)) {
          continue;
        }

        const colWidth = this.model.getColWidth(col);

        if (horizontalBorders[row][col]) {
          this.ctx.beginPath();
          this.ctx.moveTo(currentX, currentY + rowHeight);
          this.ctx.lineTo(currentX + colWidth, currentY + rowHeight);
          this.ctx.stroke();
        }

        if (verticalBorders[row][col]) {
          this.ctx.beginPath();
          this.ctx.moveTo(currentX + colWidth, currentY);
          this.ctx.lineTo(currentX + colWidth, currentY + rowHeight);
          this.ctx.stroke();
        }

        currentX += colWidth;
      }

      currentY += rowHeight;
    }

    // 绘制表格外边框
    this.ctx.beginPath();
    this.ctx.moveTo(headerWidth, headerHeight);
    this.ctx.lineTo(this.canvasWidth, headerHeight);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(headerWidth, headerHeight);
    this.ctx.lineTo(headerWidth, this.canvasHeight);
    this.ctx.stroke();

    this.ctx.restore();
  }

  // 绘制选择区域
  private renderSelection(): void {
    if (!this.selection) return;
    // 单选区使用活动选区颜色绘制
    this.renderSingleSelection(this.selection, true);
  }

  /** 渲染多选区：遍历所有选区分别绘制背景和边框 */
  private renderMultiSelection(): void {
    for (let i = 0; i < this.multiSelections.length; i++) {
      const isActive = i === this.activeSelectionIndex;
      this.renderSingleSelection(this.multiSelections[i], isActive);
    }
  }

  /**
   * 渲染单个选区的背景和边框
   * @param sel 选区对象
   * @param isActive 是否为活动选区（决定边框颜色）
   */
  private renderSingleSelection(sel: Selection, isActive: boolean): void {
    const { headerWidth, headerHeight } = this.config;
    const { scrollX, scrollY } = this.viewport;

    let { startRow, startCol, endRow, endCol } = sel;

    // 排序筛选激活时，将数据行转换为显示行
    const sfActive = this.sortFilterModel && this.sortFilterModel.isActive();
    if (sfActive) {
      const displayStartRow = this.sortFilterModel!.getDisplayRowIndex(startRow);
      const displayEndRow = this.sortFilterModel!.getDisplayRowIndex(endRow);
      if (displayStartRow === -1 || displayEndRow === -1) {
        // 选区行被筛选隐藏，不渲染
        return;
      }
      startRow = displayStartRow;
      endRow = displayEndRow;
    }

    // 计算选择区域与视口的交集
    const visibleStartRow = Math.max(startRow, this.viewport.startRow);
    const visibleEndRow = Math.min(endRow, this.viewport.endRow);
    const visibleStartCol = Math.max(startCol, this.viewport.startCol);
    const visibleEndCol = Math.min(endCol, this.viewport.endCol);

    if (visibleEndRow < visibleStartRow || visibleEndCol < visibleStartCol) {
      return;
    }

    // 计算选择区域的起始坐标（考虑滚动偏移）
    const startX = headerWidth + this.model.getColX(visibleStartCol) - scrollX;
    const startY = headerHeight + this.model.getRowY(visibleStartRow) - scrollY;

    // 计算宽度和高度（跳过隐藏行列）
    let width = 0;
    for (let col = visibleStartCol; col <= visibleEndCol; col++) {
      if (!this.model.isColHidden(col)) {
        width += this.model.getColWidth(col);
      }
    }

    let height = 0;
    for (let row = visibleStartRow; row <= visibleEndRow; row++) {
      if (!this.model.isRowHidden(row)) {
        height += this.model.getRowHeight(row);
      }
    }

    // 裁剪到可见区域
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(headerWidth, headerHeight, this.canvasWidth - headerWidth, this.canvasHeight - headerHeight);
    this.ctx.clip();

    // 绘制选择区域背景
    this.ctx.fillStyle = this.themeColors.selectionBackground;
    this.ctx.fillRect(startX, startY, width, height);

    // 绘制选择区域边框：活动选区使用主题色，非活动选区使用半透明变体
    if (isActive) {
      this.ctx.strokeStyle = this.themeColors.selectionBorder;
    } else {
      this.ctx.strokeStyle = this.getInactiveSelectionBorderColor();
    }
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(startX, startY, width, height);

    this.ctx.restore();
  }

  /**
   * 渲染填充柄（活动选区右下角的 6×6 像素方块）
   */
  private renderFillHandle(): void {
    // 获取活动选区
    const activeSelection = this.multiSelections.length > 0
      ? this.multiSelections[this.activeSelectionIndex]
      : this.selection;

    if (!activeSelection) return;

    const { headerWidth, headerHeight } = this.config;
    const { scrollX, scrollY } = this.viewport;

    // 计算活动选区右下角的屏幕坐标
    const endRow = Math.max(activeSelection.startRow, activeSelection.endRow);
    const endCol = Math.max(activeSelection.startCol, activeSelection.endCol);

    const endX = headerWidth + this.model.getColX(endCol) - scrollX + this.model.getColWidth(endCol);
    const endY = headerHeight + this.model.getRowY(endRow) - scrollY + this.model.getRowHeight(endRow);

    // 检查填充柄是否在可见区域内
    if (endX < headerWidth || endY < headerHeight) return;
    if (endX > this.canvasWidth || endY > this.canvasHeight) return;

    const handleSize = 6;
    const halfSize = handleSize / 2;

    this.ctx.save();
    this.ctx.fillStyle = this.themeColors.selectionBorder;
    this.ctx.fillRect(endX - halfSize, endY - halfSize, handleSize, handleSize);
    this.ctx.restore();
  }

  /**
   * 判断指定坐标是否在填充柄区域内（±4px 容差）
   */
  public isOnFillHandle(x: number, y: number): boolean {
    const activeSelection = this.multiSelections.length > 0
      ? this.multiSelections[this.activeSelectionIndex]
      : this.selection;

    if (!activeSelection) return false;

    const { headerWidth, headerHeight } = this.config;
    const { scrollX, scrollY } = this.viewport;

    const endRow = Math.max(activeSelection.startRow, activeSelection.endRow);
    const endCol = Math.max(activeSelection.startCol, activeSelection.endCol);

    const endX = headerWidth + this.model.getColX(endCol) - scrollX + this.model.getColWidth(endCol);
    const endY = headerHeight + this.model.getRowY(endRow) - scrollY + this.model.getRowHeight(endRow);

    const tolerance = 4;
    return Math.abs(x - endX) <= tolerance && Math.abs(y - endY) <= tolerance;
  }

  /**
   * 设置填充柄拖拽预览区域
   * 传入 null 清除预览
   */
  public setFillDragPreview(preview: Selection | null): void {
    this.fillDragPreview = preview;
  }

  /**
   * 渲染填充柄拖拽预览（虚线边框）
   * 在拖拽过程中显示目标填充区域的虚线边框
   */
  private renderFillDragPreview(): void {
    if (!this.fillDragPreview) return;

    const { headerWidth, headerHeight } = this.config;
    const { scrollX, scrollY } = this.viewport;

    const { startRow, startCol, endRow, endCol } = this.fillDragPreview;

    // 计算预览区域的屏幕坐标
    const x = headerWidth + this.model.getColX(startCol) - scrollX;
    const y = headerHeight + this.model.getRowY(startRow) - scrollY;

    // 计算宽度和高度（跳过隐藏行列）
    let width = 0;
    for (let col = startCol; col <= endCol; col++) {
      if (!this.model.isColHidden(col)) {
        width += this.model.getColWidth(col);
      }
    }

    let height = 0;
    for (let row = startRow; row <= endRow; row++) {
      if (!this.model.isRowHidden(row)) {
        height += this.model.getRowHeight(row);
      }
    }

    // 裁剪到数据区域
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(headerWidth, headerHeight, this.canvasWidth - headerWidth, this.canvasHeight - headerHeight);
    this.ctx.clip();

    // 绘制虚线边框
    this.ctx.strokeStyle = this.themeColors.selectionBorder;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 3]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);

    this.ctx.restore();
  }

  /**
   * 获取活动选区的屏幕坐标矩形
   * 用于拖拽移动时的边框命中检测
   */
  public getSelectionRect(): { x: number; y: number; width: number; height: number } | null {
    const activeSelection = this.multiSelections.length > 0
      ? this.multiSelections[this.activeSelectionIndex]
      : this.selection;

    if (!activeSelection) return null;

    const { headerWidth, headerHeight } = this.config;
    const { scrollX, scrollY } = this.viewport;

    const minRow = Math.min(activeSelection.startRow, activeSelection.endRow);
    const maxRow = Math.max(activeSelection.startRow, activeSelection.endRow);
    const minCol = Math.min(activeSelection.startCol, activeSelection.endCol);
    const maxCol = Math.max(activeSelection.startCol, activeSelection.endCol);

    const rectX = headerWidth + this.model.getColX(minCol) - scrollX;
    const rectY = headerHeight + this.model.getRowY(minRow) - scrollY;

    // 计算宽度和高度（跳过隐藏行列）
    let width = 0;
    for (let col = minCol; col <= maxCol; col++) {
      if (!this.model.isColHidden(col)) {
        width += this.model.getColWidth(col);
      }
    }

    let height = 0;
    for (let row = minRow; row <= maxRow; row++) {
      if (!this.model.isRowHidden(row)) {
        height += this.model.getRowHeight(row);
      }
    }

    return { x: rectX, y: rectY, width, height };
  }

  /**
   * 设置拖拽移动预览区域
   * 传入 null 清除预览
   */
  public setDragMovePreview(preview: Selection | null): void {
    this.dragMovePreview = preview;
  }

  /**
   * 渲染拖拽移动预览（半透明背景 + 虚线边框）
   * 在拖拽过程中显示目标移动区域
   */
  private renderDragMovePreview(): void {
    if (!this.dragMovePreview) return;

    const { headerWidth, headerHeight } = this.config;
    const { scrollX, scrollY } = this.viewport;

    const { startRow, startCol, endRow, endCol } = this.dragMovePreview;

    // 计算预览区域的屏幕坐标
    const x = headerWidth + this.model.getColX(startCol) - scrollX;
    const y = headerHeight + this.model.getRowY(startRow) - scrollY;

    // 计算宽度和高度（跳过隐藏行列）
    let width = 0;
    for (let col = startCol; col <= endCol; col++) {
      if (!this.model.isColHidden(col)) {
        width += this.model.getColWidth(col);
      }
    }

    let height = 0;
    for (let row = startRow; row <= endRow; row++) {
      if (!this.model.isRowHidden(row)) {
        height += this.model.getRowHeight(row);
      }
    }

    // 裁剪到数据区域
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(headerWidth, headerHeight, this.canvasWidth - headerWidth, this.canvasHeight - headerHeight);
    this.ctx.clip();

    // 绘制半透明背景
    this.ctx.fillStyle = this.themeColors.selectionBackground;
    this.ctx.fillRect(x, y, width, height);

    // 绘制虚线边框
    this.ctx.strokeStyle = this.themeColors.selectionBorder;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 3]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);

    this.ctx.restore();
  }

  /**
   * 获取非活动选区的半透明边框颜色
   * 将 selectionBorder 颜色转换为 alpha=0.3 的半透明变体
   */
  private getInactiveSelectionBorderColor(): string {
    const border = this.themeColors.selectionBorder;
    // 处理 #RRGGBB 格式
    if (border.startsWith('#') && border.length === 7) {
      const r = parseInt(border.slice(1, 3), 16);
      const g = parseInt(border.slice(3, 5), 16);
      const b = parseInt(border.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, 0.3)`;
    }
    // 处理 rgb(...) 格式
    if (border.startsWith('rgb(')) {
      return border.replace('rgb(', 'rgba(').replace(')', ', 0.3)');
    }
    // 处理 rgba(...) 格式，替换 alpha 值
    if (border.startsWith('rgba(')) {
      return border.replace(/,\s*[\d.]+\)$/, ', 0.3)');
    }
    // 回退：直接返回原色
    return border;
  }

  /**
   * 设置选择区域
   * @deprecated 请使用 setMultiSelection() 代替。此方法保留仅为向后兼容，
   * 内部已委托到 setMultiSelection()，不再直接操作 this.selection。
   */
  public setSelection(startRow: number, startCol: number, endRow: number, endCol: number): void {
    // 委托到 setMultiSelection()，由其统一管理选区状态和渲染
    this.setMultiSelection([{ startRow, startCol, endRow, endCol }], 0);
  }

  /** 设置多选区数据 */
  public setMultiSelection(selections: Selection[], activeIndex: number): void {
    this.multiSelections = selections;
    this.activeSelectionIndex = activeIndex;
    // 清除旧的单选区状态，确保 multiSelections 为唯一选区数据源
    this.selection = null;
    // 触发重绘，使 setMultiSelection() 成为选区更新的唯一渲染入口
    this.render();
  }

  /** 设置是否高亮所有行列标题（全选状态） */
  public setHighlightAll(highlight: boolean): void {
    this.highlightAllHeaders = highlight;
  }

  /** 获取是否处于全选高亮状态 */
  public getHighlightAll(): boolean {
    return this.highlightAllHeaders;
  }

  // 清除选择区域
  public clearSelection(): void {
    this.selection = null;
    this.render();
  }

  // 调整画布大小
  /**
   * 切换绑定的 SpreadsheetModel 数据源
   * 工作表切换时由 SheetManager 调用
   */
  public setModel(model: SpreadsheetModel): void {
    this.model = model;
    this.updateViewport();
    this.render();
  }

  public resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.canvas.width = width;
    this.canvas.height = height;

    this.updateViewport();
    this.render();
  }

  // 获取当前视口信息
  public getViewport(): Viewport {
    return { ...this.viewport };
  }

  // 获取渲染配置
  public getConfig(): RenderConfig {
    return { ...this.config };
  }

  // 设置单元格内容字体大小（不影响行列标题）
  public setFontSize(size: number): void {
    this.cellFontSize = size;
  }

  // 将列索引转换为字母
  private columnIndexToLetter(index: number): string {
    let result = '';
    let temp = index + 1;

    while (temp > 0) {
      const remainder = (temp - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      temp = Math.floor((temp - 1) / 26);
    }

    return result;
  }

  // 获取指定坐标对应的单元格位置
  public getCellAtPosition(x: number, y: number): CellPosition | null {
    const { headerWidth, headerHeight } = this.config;
    const { scrollX, scrollY } = this.viewport;

    if (x <= headerWidth || y <= headerHeight) {
      return null;
    }

    // 将屏幕坐标转换为数据坐标
    const dataX = x - headerWidth + scrollX;
    const dataY = y - headerHeight + scrollY;

    // 获取行列索引
    // 注意：getRowAtY 返回的是基于原始数据布局的行索引
    // 当排序筛选激活时，需要先计算显示行索引，再映射到数据行
    let row: number;
    const col = this.model.getColAtX(dataX);

    if (this.sortFilterModel && this.sortFilterModel.isActive()) {
      // 排序筛选激活时，dataY 对应的是显示行的位置
      // 需要找到该位置对应的显示行索引，然后映射到数据行
      const displayRow = this.model.getRowAtY(dataY);
      row = this.sortFilterModel.getDataRowIndex(displayRow);
      if (row === -1) {
        return null;
      }
    } else {
      row = this.model.getRowAtY(dataY);
    }

    if (row >= 0 && row < this.model.getRowCount() &&
        col >= 0 && col < this.model.getColCount()) {
      return { row, col };
    }

    return null;
  }

  // 获取点击行号区域对应的行索引
  public getRowHeaderAtPosition(x: number, y: number): number | null {
    const { headerWidth, headerHeight } = this.config;
    const { scrollY } = this.viewport;

    // 检查是否在行号区域内
    if (x > headerWidth || y <= headerHeight) {
      return null;
    }

    // 将屏幕Y坐标转换为数据Y坐标
    const dataY = y - headerHeight + scrollY;

    // 获取行索引
    let row: number;

    if (this.sortFilterModel && this.sortFilterModel.isActive()) {
      // 排序筛选激活时，需要将显示行映射到数据行
      const displayRow = this.model.getRowAtY(dataY);
      row = this.sortFilterModel.getDataRowIndex(displayRow);
      if (row === -1) {
        return null;
      }
    } else {
      row = this.model.getRowAtY(dataY);
    }

    if (row >= 0 && row < this.model.getRowCount()) {
      return row;
    }

    return null;
  }

  // 获取点击列号区域对应的列索引
  public getColHeaderAtPosition(x: number, y: number): number | null {
    const { headerWidth, headerHeight } = this.config;
    const { scrollX } = this.viewport;
    const colGroupHeight = this.getColGroupAreaHeight();

    // 检查是否在列号区域内（考虑列分组区域高度）
    if (x <= headerWidth || y < colGroupHeight || y > colGroupHeight + headerHeight) {
      return null;
    }

    // 将屏幕X坐标转换为数据X坐标
    const dataX = x - headerWidth + scrollX;

    // 获取列索引
    const col = this.model.getColAtX(dataX);

    if (col >= 0 && col < this.model.getColCount()) {
      return col;
    }

    return null;
  }

  // 获取指定单元格的矩形区域
  public getCellRect(row: number, col: number): {x: number, y: number, width: number, height: number} | null {
    const { headerWidth, headerHeight } = this.config;
    const { scrollX, scrollY } = this.viewport;

    if (row < 0 || row >= this.model.getRowCount() ||
        col < 0 || col >= this.model.getColCount()) {
      return null;
    }

    // 排序筛选激活时，将数据行转换为显示行
    let displayRow = row;
    if (this.sortFilterModel && this.sortFilterModel.isActive()) {
      displayRow = this.sortFilterModel.getDisplayRowIndex(row);
      if (displayRow === -1) {
        // 该行被筛选隐藏
        return null;
      }
    }

    // 计算单元格的位置（考虑滚动偏移）
    const x = headerWidth + this.model.getColX(col) - scrollX;
    const y = headerHeight + this.model.getRowY(displayRow) - scrollY;

    // 获取单元格信息
    const cellInfo = this.model.getMergedCellInfo(row, col);

    if (!cellInfo) {
      return null;
    }

    // 计算宽度和高度
    let width = 0;
    for (let c = 0; c < cellInfo.colSpan; c++) {
      width += this.model.getColWidth(cellInfo.col + c);
    }

    let height = 0;
    for (let r = 0; r < cellInfo.rowSpan; r++) {
      height += this.model.getRowHeight(cellInfo.row + r);
    }

    return { x, y, width, height };
  }

  // 滚动到指定单元格
  public scrollToCell(row: number, col: number): void {
    const { headerWidth, headerHeight } = this.config;

    // 排序筛选激活时，需要将数据行转换为显示行来计算位置
    let displayRow = row;
    if (this.sortFilterModel && this.sortFilterModel.isActive()) {
      displayRow = this.sortFilterModel.getDisplayRowIndex(row);
      if (displayRow === -1) {
        // 该行被筛选隐藏，无法滚动到
        return;
      }
    }

    const cellX = this.model.getColX(col);
    const cellY = this.model.getRowY(displayRow);
    const cellWidth = this.model.getColWidth(col);
    const cellHeight = this.model.getRowHeight(displayRow);

    const viewWidth = this.canvasWidth - headerWidth;
    const viewHeight = this.canvasHeight - headerHeight;

    let newScrollX = this.viewport.scrollX;
    let newScrollY = this.viewport.scrollY;

    // 检查是否需要水平滚动
    if (cellX < this.viewport.scrollX) {
      newScrollX = cellX;
    } else if (cellX + cellWidth > this.viewport.scrollX + viewWidth) {
      newScrollX = cellX + cellWidth - viewWidth;
    }

    // 检查是否需要垂直滚动
    if (cellY < this.viewport.scrollY) {
      newScrollY = cellY;
    } else if (cellY + cellHeight > this.viewport.scrollY + viewHeight) {
      newScrollY = cellY + cellHeight - viewHeight;
    }

    if (newScrollX !== this.viewport.scrollX || newScrollY !== this.viewport.scrollY) {
      this.scrollTo(newScrollX, newScrollY);
    }
  }

  // 检测是否在行高调整区域（行号底部边框附近）
  public getRowResizeAtPosition(x: number, y: number): number | null {
    const { headerWidth, headerHeight } = this.config;
    const resizeThreshold = 5; // 检测范围（像素）

    // 必须在行号区域内
    if (x > headerWidth || y <= headerHeight) {
      return null;
    }

    // 遍历可见行，检查是否在某行的底部边框附近
    let currentY = headerHeight + this.viewport.offsetY;

    for (let row = this.viewport.startRow; row <= this.viewport.endRow; row++) {
      const rowHeight = this.model.getRowHeight(row);
      const borderY = currentY + rowHeight;

      // 检查是否在边框附近
      if (Math.abs(y - borderY) <= resizeThreshold) {
        return row;
      }

      currentY += rowHeight;
    }

    return null;
  }

  // ============================================================
  // 分组折叠按钮渲染
  // ============================================================

  /**
   * 获取行分组指示区域宽度
   * 宽度 = maxLevel × 16px，无分组时返回 0
   */
  public getRowGroupAreaWidth(): number {
    const maxLevel = this.model.getMaxGroupLevel('row');
    return maxLevel * 16;
  }

  /**
   * 获取列分组指示区域高度
   * 高度 = maxLevel × 16px，无分组时返回 0
   */
  public getColGroupAreaHeight(): number {
    const maxLevel = this.model.getMaxGroupLevel('col');
    return maxLevel * 16;
  }

  /**
   * 绘制行分组指示区域
   * 在行标题左侧绘制层级指示线和折叠/展开按钮
   */
  private renderRowGroupIndicators(): void {
    const rowGroupWidth = this.getRowGroupAreaWidth();
    if (rowGroupWidth === 0) return;

    const { headerHeight } = this.config;
    const { scrollY } = this.viewport;
    const rowGroups = this.model.getRowGroups();

    // 绘制分组指示区域背景
    this.ctx.fillStyle = this.themeColors.headerBackground;
    this.ctx.fillRect(0, headerHeight, rowGroupWidth, this.canvasHeight - headerHeight);

    // 绘制右边框
    this.ctx.strokeStyle = this.themeColors.gridLine;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(rowGroupWidth, headerHeight);
    this.ctx.lineTo(rowGroupWidth, this.canvasHeight);
    this.ctx.stroke();

    // 裁剪到分组指示区域，防止绘制溢出
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, headerHeight, rowGroupWidth, this.canvasHeight - headerHeight);
    this.ctx.clip();

    // 遍历所有行分组，绘制层级指示线和按钮
    for (const group of rowGroups) {
      this.renderSingleRowGroup(group, headerHeight, scrollY);
    }

    this.ctx.restore();
  }

  /**
   * 绘制单个行分组的指示线和折叠/展开按钮
   */
  private renderSingleRowGroup(
    group: RowColumnGroup,
    headerHeight: number,
    scrollY: number
  ): void {
    const levelWidth = 16;
    // 层级列的 X 中心位置（level 1 在最左侧）
    const levelX = (group.level - 1) * levelWidth + levelWidth / 2;

    // 计算分组起始行和结束行的屏幕 Y 坐标
    const startY = headerHeight + this.model.getRowY(group.start) - scrollY;
    const endRowBottom = headerHeight + this.model.getRowY(group.end) - scrollY
      + this.model.getRowHeight(group.end);

    // 检查分组是否在可见范围内
    if (endRowBottom < headerHeight || startY > this.canvasHeight) return;

    const buttonSize = 12;
    // 按钮绘制在分组末尾行的中心位置
    const buttonY = endRowBottom - buttonSize - 2;
    const buttonX = levelX - buttonSize / 2;

    // 绘制竖线：从分组起始行到按钮顶部
    this.ctx.strokeStyle = this.themeColors.headerText;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(levelX, Math.max(headerHeight, startY));
    this.ctx.lineTo(levelX, Math.max(headerHeight, buttonY));
    this.ctx.stroke();

    // 绘制横线：从竖线连接到分组起始行右侧
    const rowGroupWidth = this.getRowGroupAreaWidth();
    this.ctx.beginPath();
    this.ctx.moveTo(levelX, Math.max(headerHeight, startY));
    this.ctx.lineTo(rowGroupWidth, Math.max(headerHeight, startY));
    this.ctx.stroke();

    // 绘制折叠/展开按钮（12×12px）
    this.renderGroupButton(buttonX, buttonY, buttonSize, group.collapsed);
  }

  /**
   * 绘制列分组指示区域
   * 在列标题上方绘制层级指示线和折叠/展开按钮
   */
  private renderColGroupIndicators(): void {
    const colGroupHeight = this.getColGroupAreaHeight();
    if (colGroupHeight === 0) return;

    const { headerWidth } = this.config;
    const { scrollX } = this.viewport;
    const colGroups = this.model.getColGroups();

    // 绘制分组指示区域背景
    this.ctx.fillStyle = this.themeColors.headerBackground;
    this.ctx.fillRect(headerWidth, 0, this.canvasWidth - headerWidth, colGroupHeight);

    // 绘制底边框
    this.ctx.strokeStyle = this.themeColors.gridLine;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(headerWidth, colGroupHeight);
    this.ctx.lineTo(this.canvasWidth, colGroupHeight);
    this.ctx.stroke();

    // 裁剪到分组指示区域，防止绘制溢出
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(headerWidth, 0, this.canvasWidth - headerWidth, colGroupHeight);
    this.ctx.clip();

    // 遍历所有列分组，绘制层级指示线和按钮
    for (const group of colGroups) {
      this.renderSingleColGroup(group, headerWidth, scrollX);
    }

    this.ctx.restore();
  }

  /**
   * 绘制单个列分组的指示线和折叠/展开按钮
   */
  private renderSingleColGroup(
    group: RowColumnGroup,
    headerWidth: number,
    scrollX: number
  ): void {
    const levelHeight = 16;
    // 层级行的 Y 中心位置（level 1 在最上方）
    const levelY = (group.level - 1) * levelHeight + levelHeight / 2;

    // 计算分组起始列和结束列的屏幕 X 坐标
    const startX = headerWidth + this.model.getColX(group.start) - scrollX;
    const endColRight = headerWidth + this.model.getColX(group.end) - scrollX
      + this.model.getColWidth(group.end);

    // 检查分组是否在可见范围内
    if (endColRight < headerWidth || startX > this.canvasWidth) return;

    const buttonSize = 12;
    // 按钮绘制在分组末尾列的中心位置
    const buttonX = endColRight - buttonSize - 2;
    const buttonY = levelY - buttonSize / 2;

    // 绘制横线：从分组起始列到按钮左侧
    this.ctx.strokeStyle = this.themeColors.headerText;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(Math.max(headerWidth, startX), levelY);
    this.ctx.lineTo(Math.max(headerWidth, buttonX), levelY);
    this.ctx.stroke();

    // 绘制竖线：从横线连接到分组起始列下方
    const colGroupHeight = this.getColGroupAreaHeight();
    this.ctx.beginPath();
    this.ctx.moveTo(Math.max(headerWidth, startX), levelY);
    this.ctx.lineTo(Math.max(headerWidth, startX), colGroupHeight);
    this.ctx.stroke();

    // 绘制折叠/展开按钮（12×12px）
    this.renderGroupButton(buttonX, buttonY, buttonSize, group.collapsed);
  }

  /**
   * 绘制分组折叠/展开按钮
   * 折叠状态显示 "+"，展开状态显示 "-"
   * @param x 按钮左上角 X 坐标
   * @param y 按钮左上角 Y 坐标
   * @param size 按钮尺寸（12px）
   * @param collapsed 是否处于折叠状态
   */
  private renderGroupButton(x: number, y: number, size: number, collapsed: boolean): void {
    // 绘制按钮背景
    this.ctx.fillStyle = this.themeColors.headerBackground;
    this.ctx.fillRect(x, y, size, size);

    // 绘制按钮边框
    this.ctx.strokeStyle = this.themeColors.headerText;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, size, size);

    // 绘制 +/- 图标
    const cx = x + size / 2;
    const cy = y + size / 2;
    const iconPadding = 3;

    this.ctx.beginPath();
    // 横线（- 和 + 都有）
    this.ctx.moveTo(x + iconPadding, cy);
    this.ctx.lineTo(x + size - iconPadding, cy);
    this.ctx.stroke();

    if (collapsed) {
      // 折叠状态：额外绘制竖线形成 "+"
      this.ctx.beginPath();
      this.ctx.moveTo(cx, y + iconPadding);
      this.ctx.lineTo(cx, y + size - iconPadding);
      this.ctx.stroke();
    }
  }

  /**
   * 检测指定坐标是否点击了行分组的折叠/展开按钮
   * 返回匹配的分组信息，未命中返回 null
   */
  public getRowGroupButtonAtPosition(x: number, y: number): RowColumnGroup | null {
    const rowGroupWidth = this.getRowGroupAreaWidth();
    if (rowGroupWidth === 0) return null;

    const { headerHeight } = this.config;
    const { scrollY } = this.viewport;

    // 检查是否在行分组指示区域内
    if (x > rowGroupWidth || y <= headerHeight) return null;

    const rowGroups = this.model.getRowGroups();
    const buttonSize = 12;

    for (const group of rowGroups) {
      const levelWidth = 16;
      const levelX = (group.level - 1) * levelWidth + levelWidth / 2;
      const endRowBottom = headerHeight + this.model.getRowY(group.end) - scrollY
        + this.model.getRowHeight(group.end);

      const buttonX = levelX - buttonSize / 2;
      const buttonY = endRowBottom - buttonSize - 2;

      if (x >= buttonX && x <= buttonX + buttonSize &&
          y >= buttonY && y <= buttonY + buttonSize) {
        return group;
      }
    }

    return null;
  }

  /**
   * 检测指定坐标是否点击了列分组的折叠/展开按钮
   * 返回匹配的分组信息，未命中返回 null
   */
  public getColGroupButtonAtPosition(x: number, y: number): RowColumnGroup | null {
    const colGroupHeight = this.getColGroupAreaHeight();
    if (colGroupHeight === 0) return null;

    const { headerWidth } = this.config;
    const { scrollX } = this.viewport;

    // 检查是否在列分组指示区域内
    if (x <= headerWidth || y > colGroupHeight) return null;

    const colGroups = this.model.getColGroups();
    const buttonSize = 12;

    for (const group of colGroups) {
      const levelHeight = 16;
      const levelY = (group.level - 1) * levelHeight + levelHeight / 2;
      const endColRight = headerWidth + this.model.getColX(group.end) - scrollX
        + this.model.getColWidth(group.end);

      const buttonX = endColRight - buttonSize - 2;
      const buttonY = levelY - buttonSize / 2;

      if (x >= buttonX && x <= buttonX + buttonSize &&
          y >= buttonY && y <= buttonY + buttonSize) {
        return group;
      }
    }

    return null;
  }

  // 检测是否在列宽调整区域（列号右侧边框附近）
  public getColResizeAtPosition(x: number, y: number): number | null {
    const { headerWidth, headerHeight } = this.config;
    const resizeThreshold = 5; // 检测范围（像素）
    const colGroupHeight = this.getColGroupAreaHeight();

    // 必须在列号区域内（考虑列分组区域高度）
    if (x <= headerWidth || y < colGroupHeight || y > colGroupHeight + headerHeight) {
      return null;
    }

    // 遍历可见列，检查是否在某列的右侧边框附近
    let currentX = headerWidth + this.viewport.offsetX;

    for (let col = this.viewport.startCol; col <= this.viewport.endCol; col++) {
      const colWidth = this.model.getColWidth(col);
      const borderX = currentX + colWidth;

      // 检查是否在边框附近
      if (Math.abs(x - borderX) <= resizeThreshold) {
        return col;
      }

      currentX += colWidth;
    }

    return null;
  }
}
