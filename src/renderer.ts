import { SpreadsheetModel } from './model';
import { Viewport, Selection, RenderConfig, CellPosition } from './types';

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

  constructor(
    canvas: HTMLCanvasElement,
    model: SpreadsheetModel,
    config: RenderConfig
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.model = model;
    this.config = config;
    
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
    
    // 根据滚动位置计算起始行
    let startRow = this.model.getRowAtY(scrollY);
    let offsetY = this.model.getRowY(startRow) - scrollY;
    
    // 根据滚动位置计算起始列
    let startCol = this.model.getColAtX(scrollX);
    let offsetX = this.model.getColX(startCol) - scrollX;
    
    // 计算可见行数
    let currentY = headerHeight + offsetY;
    let endRow = startRow;
    
    while (currentY < this.canvasHeight && endRow < this.model.getRowCount() - 1) {
      currentY += this.model.getRowHeight(endRow);
      endRow++;
    }
    
    // 计算可见列数
    let currentX = headerWidth + offsetX;
    let endCol = startCol;
    
    while (currentX < this.canvasWidth && endCol < this.model.getColCount() - 1) {
      currentX += this.model.getColWidth(endCol);
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
    
    // 绘制选择区域
    if (this.selection) {
      this.renderSelection();
    }
    
    // 绘制行标题（在单元格之上）
    this.renderRowHeaders();
    
    // 绘制列标题（在单元格之上）
    this.renderColHeaders();
    
    // 绘制左上角空白区域
    this.renderCorner();
  }

  // 绘制高亮行背景
  private renderHighlightedRow(): void {
    if (this.highlightedRow === null) return;
    
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
    
    let currentY = headerHeight + offsetY;
    
    // 绘制行标题
    for (let row = this.viewport.startRow; row <= this.viewport.endRow; row++) {
      const rowHeight = this.model.getRowHeight(row);
      
      // 只绘制可见部分
      if (currentY + rowHeight > headerHeight && currentY < this.canvasHeight) {
        // 绘制行号背景（高亮行使用深色背景）
        if (this.highlightedRow === row) {
          this.ctx.fillStyle = this.themeColors.highlightHeaderBackground;
        } else {
          this.ctx.fillStyle = this.themeColors.headerBackground;
        }
        this.ctx.fillRect(0, Math.max(headerHeight, currentY), headerWidth, rowHeight);
        
        // 绘制行号
        this.ctx.fillStyle = this.themeColors.headerText;
        const textY = Math.max(headerHeight + rowHeight / 2, currentY + rowHeight / 2);
        if (textY > headerHeight && textY < this.canvasHeight) {
          this.ctx.fillText(
            (row + 1).toString(),
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
    
    // 绘制右边框
    this.ctx.strokeStyle = this.themeColors.gridLine;
    this.ctx.beginPath();
    this.ctx.moveTo(headerWidth, headerHeight);
    this.ctx.lineTo(headerWidth, this.canvasHeight);
    this.ctx.stroke();
  }

  // 绘制列标题
  private renderColHeaders(): void {
    const { headerWidth, headerHeight, fontSize, fontFamily } = this.config;
    const { offsetX } = this.viewport;
    
    // 绘制背景
    this.ctx.fillStyle = this.themeColors.headerBackground;
    this.ctx.fillRect(headerWidth, 0, this.canvasWidth - headerWidth, headerHeight);
    
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    let currentX = headerWidth + offsetX;
    
    // 绘制列标题
    for (let col = this.viewport.startCol; col <= this.viewport.endCol; col++) {
      const colWidth = this.model.getColWidth(col);
      
      // 只绘制可见部分
      if (currentX + colWidth > headerWidth && currentX < this.canvasWidth) {
        // 绘制列号背景（高亮列使用深色背景）
        if (this.highlightedCol === col) {
          this.ctx.fillStyle = this.themeColors.highlightHeaderBackground;
        } else {
          this.ctx.fillStyle = this.themeColors.headerBackground;
        }
        this.ctx.fillRect(Math.max(headerWidth, currentX), 0, colWidth, headerHeight);
        
        // 绘制列号
        this.ctx.fillStyle = this.themeColors.headerText;
        const textX = currentX + colWidth / 2;
        if (textX > headerWidth && textX < this.canvasWidth) {
          this.ctx.fillText(
            this.columnIndexToLetter(col),
            textX,
            headerHeight / 2
          );
        }
        
        // 绘制边框
        this.ctx.strokeStyle = this.themeColors.gridLine;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(currentX + colWidth, 0);
        this.ctx.lineTo(currentX + colWidth, headerHeight);
        this.ctx.stroke();
      }
      
      currentX += colWidth;
    }
    
    // 绘制底边框
    this.ctx.strokeStyle = this.themeColors.gridLine;
    this.ctx.beginPath();
    this.ctx.moveTo(headerWidth, headerHeight);
    this.ctx.lineTo(this.canvasWidth, headerHeight);
    this.ctx.stroke();
  }

  // 绘制单元格
  private renderCells(): void {
    const { headerWidth, headerHeight, cellPadding, fontSize, fontFamily } = this.config;
    const { offsetX, offsetY } = this.viewport;
    
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    
    let currentY = headerHeight + offsetY;
    
    // 遍历可见行
    for (let row = this.viewport.startRow; row <= this.viewport.endRow; row++) {
      const rowHeight = this.model.getRowHeight(row);
      let currentX = headerWidth + offsetX;
      
      // 遍历可见列
      for (let col = this.viewport.startCol; col <= this.viewport.endCol; col++) {
        const colWidth = this.model.getColWidth(col);
        
        // 获取单元格信息（考虑合并单元格）
        const cellInfo = this.model.getMergedCellInfo(row, col);
        
        if (cellInfo && (cellInfo.row === row && cellInfo.col === col)) {
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
          
          // 绘制背景颜色
          if (cellInfo.bgColor) {
            this.ctx.fillStyle = cellInfo.bgColor;
            this.ctx.fillRect(currentX, currentY, totalWidth, totalHeight);
          }
          
          // 绘制单元格内容
          if (cellInfo.content) {
            // 文本截断处理
            const maxTextWidth = totalWidth - 2 * cellPadding;
            let text = cellInfo.content;
            let textWidth = this.ctx.measureText(text).width;
            
            if (textWidth > maxTextWidth) {
              while (text.length > 0 && textWidth > maxTextWidth) {
                text = text.slice(0, -1);
                textWidth = this.ctx.measureText(text + '...').width;
              }
              text += '...';
            }
            
            // 使用单元格的字体颜色，如果没有设置则使用主题默认颜色
            this.ctx.fillStyle = cellInfo.fontColor || this.themeColors.cellText;
            this.ctx.fillText(
              text,
              currentX + cellPadding,
              currentY + totalHeight / 2
            );
          }
          
          this.ctx.restore();
        }
        
        currentX += colWidth;
      }
      
      currentY += rowHeight;
    }
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
      const rowHeight = this.model.getRowHeight(row);
      let currentX = headerWidth + offsetX;
      
      for (let col = this.viewport.startCol; col <= this.viewport.endCol; col++) {
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
    
    const { headerWidth, headerHeight } = this.config;
    const { scrollX, scrollY } = this.viewport;
    
    const { startRow, startCol, endRow, endCol } = this.selection;
    
    // 计算选择区域与视口的交集
    const visibleStartRow = Math.max(startRow, this.viewport.startRow);
    const visibleEndRow = Math.min(endRow, this.viewport.endRow);
    const visibleStartCol = Math.max(startCol, this.viewport.startCol);
    const visibleEndCol = Math.min(endCol, this.viewport.endCol);
    
    if (visibleEndRow < visibleStartRow || visibleEndCol < visibleStartCol) {
      return;
    }
    
    // 计算选择区域的起始坐标（考虑滚动偏移）
    let startX = headerWidth + this.model.getColX(visibleStartCol) - scrollX;
    let startY = headerHeight + this.model.getRowY(visibleStartRow) - scrollY;
    
    // 计算宽度和高度
    let width = 0;
    for (let col = visibleStartCol; col <= visibleEndCol; col++) {
      width += this.model.getColWidth(col);
    }
    
    let height = 0;
    for (let row = visibleStartRow; row <= visibleEndRow; row++) {
      height += this.model.getRowHeight(row);
    }
    
    // 裁剪到可见区域
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(headerWidth, headerHeight, this.canvasWidth - headerWidth, this.canvasHeight - headerHeight);
    this.ctx.clip();
    
    // 绘制选择区域背景
    this.ctx.fillStyle = this.themeColors.selectionBackground;
    this.ctx.fillRect(startX, startY, width, height);
    
    // 绘制选择区域边框
    this.ctx.strokeStyle = this.themeColors.selectionBorder;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(startX, startY, width, height);
    
    this.ctx.restore();
  }

  // 设置选择区域
  public setSelection(startRow: number, startCol: number, endRow: number, endCol: number): void {
    this.selection = { startRow, startCol, endRow, endCol };
    this.render();
  }

  // 清除选择区域
  public clearSelection(): void {
    this.selection = null;
    this.render();
  }

  // 调整画布大小
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
    const row = this.model.getRowAtY(dataY);
    const col = this.model.getColAtX(dataX);
    
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
    const row = this.model.getRowAtY(dataY);
    
    if (row >= 0 && row < this.model.getRowCount()) {
      return row;
    }
    
    return null;
  }

  // 获取点击列号区域对应的列索引
  public getColHeaderAtPosition(x: number, y: number): number | null {
    const { headerWidth, headerHeight } = this.config;
    const { scrollX } = this.viewport;
    
    // 检查是否在列号区域内
    if (x <= headerWidth || y > headerHeight) {
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
    
    // 计算单元格的位置（考虑滚动偏移）
    const x = headerWidth + this.model.getColX(col) - scrollX;
    const y = headerHeight + this.model.getRowY(row) - scrollY;
    
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
    
    const cellX = this.model.getColX(col);
    const cellY = this.model.getRowY(row);
    const cellWidth = this.model.getColWidth(col);
    const cellHeight = this.model.getRowHeight(row);
    
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
}
