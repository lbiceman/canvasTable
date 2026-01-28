import { Cell, SpreadsheetData, CellPosition } from './types';
import { HistoryManager } from './history-manager';

// 默认行列数 - 支持无限滚动
const DEFAULT_ROWS = 1000; // 初始行数
const DEFAULT_COLS = 100;  // 初始列数
const MAX_ROWS = 1000000;  // 最大行数
const MAX_COLS = 16384;    // 最大列数（类似Excel）

// 默认单元格宽高
const DEFAULT_ROW_HEIGHT = 25;
const DEFAULT_COL_WIDTH = 100;

// 缓存相关常量
const CACHE_SIZE_LIMIT = 100;
const BATCH_SIZE = 100;

export class SpreadsheetModel {
  private data: SpreadsheetData;
  private mergeCache: { [key: string]: any } = {}; // 合并操作缓存
  private contentCache: { [key: string]: string } = {}; // 内容缓存
  private isDirty: boolean = false; // 数据变更标记
  private historyManager: HistoryManager;

  constructor(rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
    // 初始化历史管理器
    this.historyManager = new HistoryManager();
    
    // 初始化表格数据
    this.data = {
      cells: [],
      rowHeights: [],
      colWidths: []
    };

    // 初始化单元格
    for (let i = 0; i < rows; i++) {
      this.data.cells[i] = [];
      this.data.rowHeights[i] = DEFAULT_ROW_HEIGHT;
      
      for (let j = 0; j < cols; j++) {
        this.data.cells[i][j] = {
          content: '',
          rowSpan: 1,
          colSpan: 1,
          isMerged: false
        };
      }
    }

    // 初始化列宽
    for (let j = 0; j < cols; j++) {
      this.data.colWidths[j] = DEFAULT_COL_WIDTH;
    }
  }

  // 获取单元格数据
  public getCell(row: number, col: number): Cell | null {
    if (this.isValidPosition(row, col)) {
      return this.data.cells[row][col];
    }
    return null;
  }

  // 设置单元格内容
  public setCellContent(row: number, col: number, content: string): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cacheKey = `${row}-${col}`;
    const cell = this.data.cells[row][col];
    
    // 获取旧内容用于撤销
    let oldContent = '';
    let targetRow = row;
    let targetCol = col;
    
    // 如果是被合并的单元格，则设置合并父单元格的内容
    if (cell.isMerged && cell.mergeParent) {
      targetRow = cell.mergeParent.row;
      targetCol = cell.mergeParent.col;
      oldContent = this.data.cells[targetRow][targetCol].content;
    } else {
      oldContent = cell.content;
    }
    
    // 如果内容没有变化，直接返回
    if (oldContent === content) {
      return;
    }
    
    // 记录历史
    this.historyManager.record({
      type: 'setCellContent',
      data: { row: targetRow, col: targetCol, content },
      undoData: { row: targetRow, col: targetCol, content: oldContent }
    });
    
    // 设置内容
    if (cell.isMerged && cell.mergeParent) {
      this.data.cells[targetRow][targetCol].content = content;
      this.contentCache[`${targetRow}-${targetCol}`] = content;
    } else {
      cell.content = content;
      this.contentCache[cacheKey] = content;
    }
    
    this.isDirty = true;
    this.clearCacheIfNeeded();
  }
  
  // 设置单元格内容（不记录历史，用于撤销/重做）
  public setCellContentNoHistory(row: number, col: number, content: string): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }
    
    const cell = this.data.cells[row][col];
    cell.content = content;
    this.contentCache[`${row}-${col}`] = content;
    this.isDirty = true;
  }

  // 设置单元格字体颜色
  public setCellFontColor(row: number, col: number, color: string): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];
    
    // 如果是被合并的单元格，则设置合并父单元格的字体颜色
    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      this.data.cells[parentRow][parentCol].fontColor = color;
    } else {
      cell.fontColor = color;
    }
    
    this.isDirty = true;
  }

  // 批量设置单元格字体颜色
  public setRangeFontColor(startRow: number, startCol: number, endRow: number, endCol: number, color: string): void {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];
        
        // 如果是被合并的单元格，设置其父单元格的颜色
        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            this.data.cells[parentRow][parentCol].fontColor = color;
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            cell.fontColor = color;
            processedCells.add(key);
          }
        }
      }
    }
    
    this.isDirty = true;
  }

  // 设置单元格背景颜色
  public setCellBgColor(row: number, col: number, color: string): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];
    
    // 如果是被合并的单元格，则设置合并父单元格的背景颜色
    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      this.data.cells[parentRow][parentCol].bgColor = color;
    } else {
      cell.bgColor = color;
    }
    
    this.isDirty = true;
  }

  // 批量设置单元格背景颜色
  public setRangeBgColor(startRow: number, startCol: number, endRow: number, endCol: number, color: string): void {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];
        
        // 如果是被合并的单元格，设置其父单元格的颜色
        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            this.data.cells[parentRow][parentCol].bgColor = color;
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            cell.bgColor = color;
            processedCells.add(key);
          }
        }
      }
    }
    
    this.isDirty = true;
  }

  // 合并单元格 - 简化版本，专注解决扩展合并问题
  public mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    // 验证范围
    if (!this.isValidRange(startRow, startCol, endRow, endCol)) {
      return false;
    }
    
    // 如果只选择了一个单元格，不执行合并操作
    if (startRow === endRow && startCol === endCol) {
      return false;
    }

    console.log(`尝试合并区域: (${startRow},${startCol}) 到 (${endRow},${endCol})`);

    // 第一步：拆分选择区域内的所有合并单元格
    for (let i = startRow; i <= endRow; i++) {
      for (let j = startCol; j <= endCol; j++) {
        const cell = this.data.cells[i][j];
        
        // 如果是合并单元格的父单元格，直接拆分
        if (cell.rowSpan > 1 || cell.colSpan > 1) {
          console.log(`拆分现有合并单元格: (${i},${j})`);
          this.splitCell(i, j);
        }
        // 如果是被合并的单元格，拆分其父单元格
        else if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          console.log(`拆分父合并单元格: (${parentRow},${parentCol})`);
          this.splitCell(parentRow, parentCol);
        }
      }
    }

    // 第二步：收集内容（优先使用左上角的内容）
    let content = '';
    for (let i = startRow; i <= endRow && !content; i++) {
      for (let j = startCol; j <= endCol && !content; j++) {
        const cell = this.data.cells[i][j];
        if (cell.content) {
          content = cell.content;
        }
      }
    }

    // 第三步：执行新的合并
    const rowSpan = endRow - startRow + 1;
    const colSpan = endCol - startCol + 1;
    
    // 设置合并父单元格
    const parentCell = this.data.cells[startRow][startCol];
    parentCell.rowSpan = rowSpan;
    parentCell.colSpan = colSpan;
    parentCell.content = content;
    parentCell.isMerged = false;
    delete parentCell.mergeParent;
    
    // 标记被合并的单元格
    for (let i = startRow; i <= endRow; i++) {
      for (let j = startCol; j <= endCol; j++) {
        if (i !== startRow || j !== startCol) {
          this.data.cells[i][j].isMerged = true;
          this.data.cells[i][j].mergeParent = { row: startRow, col: startCol };
          this.data.cells[i][j].content = '';
        }
      }
    }
    
    // 清理缓存并标记数据变更
    this.clearAllCache();
    this.isDirty = true;
    
    console.log(`合并成功: (${startRow},${startCol}) 到 (${endRow},${endCol}), 内容: "${content}"`);
    return true;
  }

  /**
   * 拆分单元格 - 完全参考Excel的实现
   * 
   * Excel中的拆分单元格逻辑：
   * 1. 只有合并单元格才能被拆分
   * 2. 拆分后，只有左上角单元格保留内容
   * 3. 拆分后，所有单元格恢复为默认大小
   * 4. 拆分操作不会影响其他合并单元格
   * 5. 可以通过菜单或快捷键拆分单元格
   * 
   * @param row 要拆分的单元格行索引
   * @param col 要拆分的单元格列索引
   * @returns 是否成功拆分
   */
  public splitCell(row: number, col: number): boolean {
    // 验证位置是否有效
    if (!this.isValidPosition(row, col)) {
      return false;
    }

    const cell = this.data.cells[row][col];
    let parentRow = row;
    let parentCol = col;

    // 如果是被合并的单元格，找到合并父单元格
    if (cell.isMerged && cell.mergeParent) {
      parentRow = cell.mergeParent.row;
      parentCol = cell.mergeParent.col;
    }

    const parentCell = this.data.cells[parentRow][parentCol];
    
    // 检查是否是合并单元格
    if (parentCell.rowSpan === 1 && parentCell.colSpan === 1) {
      return false; // 不是合并单元格，无需拆分
    }

    // 保存原始内容和范围
    const content = parentCell.content;
    const rowSpan = parentCell.rowSpan;
    const colSpan = parentCell.colSpan;
    const endRow = parentRow + rowSpan - 1;
    const endCol = parentCol + colSpan - 1;

    // 记录操作前的状态，用于撤销功能（如果需要）
    const originalState = {
      parentRow,
      parentCol,
      rowSpan,
      colSpan,
      content,
      cells: [] as {row: number; col: number; isMerged: boolean; mergeParent?: CellPosition}[]
    };

    // 保存所有受影响单元格的原始状态
    for (let i = parentRow; i <= endRow; i++) {
      for (let j = parentCol; j <= endCol; j++) {
        const affectedCell = this.data.cells[i][j];
        originalState.cells.push({
          row: i,
          col: j,
          isMerged: affectedCell.isMerged,
          mergeParent: affectedCell.mergeParent
        });
      }
    }

    // 重置所有被合并的单元格
    for (let i = parentRow; i <= endRow; i++) {
      for (let j = parentCol; j <= endCol; j++) {
        // 在Excel中，拆分后只有左上角单元格保留内容
        this.data.cells[i][j] = {
          content: i === parentRow && j === parentCol ? content : '',
          rowSpan: 1,
          colSpan: 1,
          isMerged: false,
          mergeParent: undefined
        };
      }
    }

    // 返回拆分成功
    return true;
  }

  // 获取行高
  public getRowHeight(row: number): number {
    if (row >= 0 && row < this.data.rowHeights.length) {
      return this.data.rowHeights[row];
    }
    return DEFAULT_ROW_HEIGHT;
  }

  // 获取列宽
  public getColWidth(col: number): number {
    if (col >= 0 && col < this.data.colWidths.length) {
      return this.data.colWidths[col];
    }
    return DEFAULT_COL_WIDTH;
  }

  // 设置行高
  public setRowHeight(row: number, height: number): void {
    if (row >= 0 && row < this.data.rowHeights.length) {
      this.data.rowHeights[row] = height;
    }
  }

  // 设置列宽
  public setColWidth(col: number, width: number): void {
    if (col >= 0 && col < this.data.colWidths.length) {
      this.data.colWidths[col] = width;
    }
  }

  // 获取行数
  public getRowCount(): number {
    return this.data.cells.length;
  }

  // 获取列数
  public getColCount(): number {
    return this.data.cells[0].length;
  }
  
  // 在指定位置插入行
  public insertRows(rowIndex: number, count: number): boolean {
    if (rowIndex < 0 || rowIndex > this.getRowCount() || count <= 0) {
      return false;
    }

    // 检查是否超过最大行数
    if (this.getRowCount() + count > MAX_ROWS) {
      return false;
    }

    const colCount = this.getColCount();

    // 创建新行
    const newRows: Cell[][] = [];
    const newHeights: number[] = [];
    for (let i = 0; i < count; i++) {
      const row: Cell[] = [];
      for (let j = 0; j < colCount; j++) {
        row.push({
          content: '',
          rowSpan: 1,
          colSpan: 1,
          isMerged: false
        });
      }
      newRows.push(row);
      newHeights.push(DEFAULT_ROW_HEIGHT);
    }

    // 插入新行
    this.data.cells.splice(rowIndex, 0, ...newRows);
    this.data.rowHeights.splice(rowIndex, 0, ...newHeights);

    // 更新合并单元格的引用
    this.updateMergeReferencesAfterInsertRows(rowIndex, count);

    this.clearAllCache();
    this.isDirty = true;
    return true;
  }

  // 删除指定行
  public deleteRows(rowIndex: number, count: number): boolean {
    if (rowIndex < 0 || rowIndex >= this.getRowCount() || count <= 0) {
      return false;
    }

    // 确保不会删除所有行
    const actualCount = Math.min(count, this.getRowCount() - rowIndex);
    if (this.getRowCount() - actualCount < 1) {
      return false;
    }

    // 先拆分受影响的合并单元格
    this.splitMergedCellsInRows(rowIndex, actualCount);

    // 删除行
    this.data.cells.splice(rowIndex, actualCount);
    this.data.rowHeights.splice(rowIndex, actualCount);

    // 更新合并单元格的引用
    this.updateMergeReferencesAfterDeleteRows(rowIndex, actualCount);

    this.clearAllCache();
    this.isDirty = true;
    return true;
  }

  // 插入行后更新合并单元格引用
  private updateMergeReferencesAfterInsertRows(insertIndex: number, count: number): void {
    for (let i = 0; i < this.getRowCount(); i++) {
      for (let j = 0; j < this.getColCount(); j++) {
        const cell = this.data.cells[i][j];
        if (cell.isMerged && cell.mergeParent) {
          // 如果父单元格在插入位置之前或等于，需要更新引用
          if (cell.mergeParent.row >= insertIndex && i >= insertIndex + count) {
            // 不需要更新，因为父单元格也被移动了
          } else if (cell.mergeParent.row >= insertIndex) {
            cell.mergeParent.row += count;
          }
        }
      }
    }
  }

  // 删除行后更新合并单元格引用
  private updateMergeReferencesAfterDeleteRows(deleteIndex: number, count: number): void {
    for (let i = 0; i < this.getRowCount(); i++) {
      for (let j = 0; j < this.getColCount(); j++) {
        const cell = this.data.cells[i][j];
        if (cell.isMerged && cell.mergeParent) {
          if (cell.mergeParent.row >= deleteIndex + count) {
            cell.mergeParent.row -= count;
          }
        }
      }
    }
  }

  // 拆分指定行范围内的合并单元格
  private splitMergedCellsInRows(startRow: number, count: number): void {
    const endRow = startRow + count - 1;
    const processedCells = new Set<string>();

    for (let i = startRow; i <= endRow; i++) {
      for (let j = 0; j < this.getColCount(); j++) {
        const cell = this.data.cells[i][j];
        
        // 如果是合并单元格的父单元格
        if ((cell.rowSpan > 1 || cell.colSpan > 1) && !processedCells.has(`${i},${j}`)) {
          this.splitCell(i, j);
          processedCells.add(`${i},${j}`);
        }
        // 如果是被合并的单元格
        else if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          if (!processedCells.has(`${parentRow},${parentCol}`)) {
            this.splitCell(parentRow, parentCol);
            processedCells.add(`${parentRow},${parentCol}`);
          }
        }
      }
    }
  }

  // 动态扩展行数
  public expandRows(newRowCount: number): void {
    const currentRowCount = this.getRowCount();
    const colCount = this.getColCount();
    
    // 限制最大行数
    newRowCount = Math.min(newRowCount, MAX_ROWS);
    
    if (newRowCount <= currentRowCount) {
      return; // 无需扩展
    }
    
    // 添加新行
    for (let i = currentRowCount; i < newRowCount; i++) {
      this.data.cells[i] = [];
      this.data.rowHeights[i] = DEFAULT_ROW_HEIGHT;
      
      for (let j = 0; j < colCount; j++) {
        this.data.cells[i][j] = {
          content: '',
          rowSpan: 1,
          colSpan: 1,
          isMerged: false
        };
      }
    }
  }

  // 动态扩展列数
  public expandCols(newColCount: number): void {
    const rowCount = this.getRowCount();
    const currentColCount = this.getColCount();
    
    // 限制最大列数
    newColCount = Math.min(newColCount, MAX_COLS);
    
    if (newColCount <= currentColCount) {
      return; // 无需扩展
    }
    
    // 添加新列
    for (let j = currentColCount; j < newColCount; j++) {
      this.data.colWidths[j] = DEFAULT_COL_WIDTH;
    }
    
    // 为每行添加新单元格
    for (let i = 0; i < rowCount; i++) {
      for (let j = currentColCount; j < newColCount; j++) {
        this.data.cells[i][j] = {
          content: '',
          rowSpan: 1,
          colSpan: 1,
          isMerged: false
        };
      }
    }
  }

  // 获取总内容高度（用于滚动计算）
  public getTotalHeight(): number {
    let total = 0;
    for (let i = 0; i < this.data.rowHeights.length; i++) {
      total += this.data.rowHeights[i];
    }
    return total;
  }

  // 获取总内容宽度（用于滚动计算）
  public getTotalWidth(): number {
    let total = 0;
    for (let i = 0; i < this.data.colWidths.length; i++) {
      total += this.data.colWidths[i];
    }
    return total;
  }

  // 根据Y坐标获取行索引
  public getRowAtY(y: number): number {
    let currentY = 0;
    for (let i = 0; i < this.getRowCount(); i++) {
      currentY += this.data.rowHeights[i];
      if (currentY > y) {
        return i;
      }
    }
    return this.getRowCount() - 1;
  }

  // 根据X坐标获取列索引
  public getColAtX(x: number): number {
    let currentX = 0;
    for (let i = 0; i < this.getColCount(); i++) {
      currentX += this.data.colWidths[i];
      if (currentX > x) {
        return i;
      }
    }
    return this.getColCount() - 1;
  }

  // 获取行的Y坐标
  public getRowY(row: number): number {
    let y = 0;
    for (let i = 0; i < row && i < this.getRowCount(); i++) {
      y += this.data.rowHeights[i];
    }
    return y;
  }

  // 获取列的X坐标
  public getColX(col: number): number {
    let x = 0;
    for (let i = 0; i < col && i < this.getColCount(); i++) {
      x += this.data.colWidths[i];
    }
    return x;
  }

  // 验证位置是否有效
  private isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this.data.cells.length && 
           col >= 0 && col < this.data.cells[0].length;
  }

  // 验证范围是否有效
  private isValidRange(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    return this.isValidPosition(startRow, startCol) && 
           this.isValidPosition(endRow, endCol) &&
           startRow <= endRow && startCol <= endCol;
  }

  // 获取合并单元格的实际位置和大小
  public getMergedCellInfo(row: number, col: number): { 
    row: number; 
    col: number; 
    rowSpan: number; 
    colSpan: number; 
    content: string;
    fontColor?: string;
    bgColor?: string;
  } | null {
    if (!this.isValidPosition(row, col)) {
      return null;
    }

    const cell = this.data.cells[row][col];
    
    // 如果是被合并的单元格，返回合并父单元格的信息
    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      const parentCell = this.data.cells[parentRow][parentCol];
      return {
        row: parentRow,
        col: parentCol,
        rowSpan: parentCell.rowSpan,
        colSpan: parentCell.colSpan,
        content: parentCell.content,
        fontColor: parentCell.fontColor,
        bgColor: parentCell.bgColor
      };
    }
    
    // 如果是合并父单元格或普通单元格
    return {
      row,
      col,
      rowSpan: cell.rowSpan,
      colSpan: cell.colSpan,
      content: cell.content,
      fontColor: cell.fontColor,
      bgColor: cell.bgColor
    };
  }

  // 清理缓存
  private clearCacheIfNeeded(): void {
    const contentKeys = Object.keys(this.contentCache);
    if (contentKeys.length > CACHE_SIZE_LIMIT) {
      // 保留最近使用的一半缓存
      const keepCount = Math.floor(CACHE_SIZE_LIMIT / 2);
      const keysToKeep = contentKeys.slice(-keepCount);
      
      const newCache: { [key: string]: string } = {};
      keysToKeep.forEach(key => {
        newCache[key] = this.contentCache[key];
      });
      this.contentCache = newCache;
    }
    
    const mergeKeys = Object.keys(this.mergeCache);
    if (mergeKeys.length > CACHE_SIZE_LIMIT) {
      this.mergeCache = {};
    }
  }

  // 批量设置单元格内容
  public setBatchCellContent(updates: Array<{row: number, col: number, content: string}>): void {
    const batchSize = Math.min(updates.length, BATCH_SIZE);
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      batch.forEach(({row, col, content}) => {
        this.setCellContent(row, col, content);
      });
    }
  }

  // 获取数据变更状态
  public isDirtyData(): boolean {
    return this.isDirty;
  }

  // 标记数据为已保存
  public markClean(): void {
    this.isDirty = false;
  }

  // 清空所有缓存
  public clearAllCache(): void {
    this.contentCache = {};
    this.mergeCache = {};
  }

  // 获取指定范围内的所有单元格内容
  public getRangeContent(startRow: number, startCol: number, endRow: number, endCol: number): string[][] {
    if (!this.isValidRange(startRow, startCol, endRow, endCol)) {
      return [];
    }

    const result: string[][] = [];
    for (let i = startRow; i <= endRow; i++) {
      const row: string[] = [];
      for (let j = startCol; j <= endCol; j++) {
        const cell = this.getCell(i, j);
        row.push(cell?.content || '');
      }
      result.push(row);
    }
    return result;
  }

  // 复制指定范围的单元格
  public copyRange(startRow: number, startCol: number, endRow: number, endCol: number): any {
    if (!this.isValidRange(startRow, startCol, endRow, endCol)) {
      return null;
    }

    const copiedData = {
      startRow,
      startCol,
      endRow,
      endCol,
      cells: [] as any[]
    };

    for (let i = startRow; i <= endRow; i++) {
      const row = [];
      for (let j = startCol; j <= endCol; j++) {
        const cell = this.getCell(i, j);
        row.push({
          content: cell?.content || '',
          rowSpan: cell?.rowSpan || 1,
          colSpan: cell?.colSpan || 1,
          isMerged: cell?.isMerged || false
        });
      }
      copiedData.cells.push(row);
    }

    return copiedData;
  }

  // 粘贴单元格数据
  public pasteRange(targetRow: number, targetCol: number, copiedData: any): boolean {
    if (!copiedData || !this.isValidPosition(targetRow, targetCol)) {
      return false;
    }

    const { cells } = copiedData;
    const rowCount = cells.length;
    const colCount = cells[0]?.length || 0;

    // 确保目标区域有足够空间
    const maxRow = targetRow + rowCount - 1;
    
    if (maxRow >= this.getRowCount()) {
      this.expandRows(maxRow + 1);
    }

    // 粘贴数据
    for (let i = 0; i < rowCount; i++) {
      for (let j = 0; j < colCount; j++) {
        const sourceCell = cells[i][j];
        const destRow = targetRow + i;
        const destCol = targetCol + j;
        
        if (this.isValidPosition(destRow, destCol)) {
          this.setCellContent(destRow, destCol, sourceCell.content);
        }
      }
    }

    return true;
  }

  // 导出JSON数据
  public exportToJSON(): string {
    // 收集非默认的行高
    const customRowHeights: { [key: number]: number } = {};
    for (let i = 0; i < this.data.rowHeights.length; i++) {
      if (this.data.rowHeights[i] !== DEFAULT_ROW_HEIGHT) {
        customRowHeights[i] = this.data.rowHeights[i];
      }
    }
    
    // 收集非默认的列宽
    const customColWidths: { [key: number]: number } = {};
    for (let j = 0; j < this.data.colWidths.length; j++) {
      if (this.data.colWidths[j] !== DEFAULT_COL_WIDTH) {
        customColWidths[j] = this.data.colWidths[j];
      }
    }
    
    const exportData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      metadata: {
        rowCount: this.getRowCount(),
        colCount: this.getColCount(),
        defaultRowHeight: DEFAULT_ROW_HEIGHT,
        defaultColWidth: DEFAULT_COL_WIDTH
      },
      data: {
        cells: [] as any[],
        rowHeights: customRowHeights,
        colWidths: customColWidths
      }
    };

    // 只导出有内容或特殊格式的单元格
    for (let i = 0; i < this.getRowCount(); i++) {
      for (let j = 0; j < this.getColCount(); j++) {
        const cell = this.data.cells[i][j];
        
        // 只保存有内容、合并信息或颜色的单元格
        if (cell.content || cell.rowSpan > 1 || cell.colSpan > 1 || cell.isMerged || cell.fontColor || cell.bgColor) {
          exportData.data.cells.push({
            row: i,
            col: j,
            content: cell.content,
            rowSpan: cell.rowSpan,
            colSpan: cell.colSpan,
            isMerged: cell.isMerged,
            mergeParent: cell.mergeParent,
            fontColor: cell.fontColor,
            bgColor: cell.bgColor
          });
        }
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  // 从JSON数据导入
  public importFromJSON(jsonData: string): boolean {
    try {
      const importData = JSON.parse(jsonData);
      
      // 验证数据格式
      if (!importData.version || !importData.data) {
        console.error('无效的JSON数据格式');
        return false;
      }

      const { metadata, data } = importData;
      
      // 重新初始化表格
      if (metadata) {
        const rows = metadata.rowCount || DEFAULT_ROWS;
        const cols = metadata.colCount || DEFAULT_COLS;
        
        // 重新初始化数据结构
        this.data = {
          cells: [],
          rowHeights: [],
          colWidths: []
        };

        // 初始化单元格
        for (let i = 0; i < rows; i++) {
          this.data.cells[i] = [];
          this.data.rowHeights[i] = DEFAULT_ROW_HEIGHT;
          
          for (let j = 0; j < cols; j++) {
            this.data.cells[i][j] = {
              content: '',
              rowSpan: 1,
              colSpan: 1,
              isMerged: false
            };
          }
        }

        // 初始化列宽
        for (let j = 0; j < cols; j++) {
          this.data.colWidths[j] = DEFAULT_COL_WIDTH;
        }
      }

      // 导入行高和列宽
      if (data.rowHeights) {
        // 支持新格式（对象）和旧格式（数组）
        if (Array.isArray(data.rowHeights)) {
          for (let i = 0; i < data.rowHeights.length && i < this.data.rowHeights.length; i++) {
            if (data.rowHeights[i]) {
              this.data.rowHeights[i] = data.rowHeights[i];
            }
          }
        } else {
          // 新格式：对象 { index: height }
          Object.entries(data.rowHeights).forEach(([index, height]) => {
            const i = parseInt(index);
            if (i >= 0 && i < this.data.rowHeights.length) {
              this.data.rowHeights[i] = height as number;
            }
          });
        }
      }
      
      if (data.colWidths) {
        // 支持新格式（对象）和旧格式（数组）
        if (Array.isArray(data.colWidths)) {
          for (let j = 0; j < data.colWidths.length && j < this.data.colWidths.length; j++) {
            if (data.colWidths[j]) {
              this.data.colWidths[j] = data.colWidths[j];
            }
          }
        } else {
          // 新格式：对象 { index: width }
          Object.entries(data.colWidths).forEach(([index, width]) => {
            const j = parseInt(index);
            if (j >= 0 && j < this.data.colWidths.length) {
              this.data.colWidths[j] = width as number;
            }
          });
        }
      }

      // 导入单元格数据
      if (data.cells && Array.isArray(data.cells)) {
        data.cells.forEach((cellData: any) => {
          const { row, col, content, rowSpan, colSpan, isMerged, mergeParent, fontColor, bgColor } = cellData;
          
          if (this.isValidPosition(row, col)) {
            this.data.cells[row][col] = {
              content: content || '',
              rowSpan: rowSpan || 1,
              colSpan: colSpan || 1,
              isMerged: isMerged || false,
              mergeParent: mergeParent,
              fontColor: fontColor,
              bgColor: bgColor
            };
          }
        });
      }

      // 清空缓存
      this.clearAllCache();
      this.isDirty = false;

      return true;
    } catch (error) {
      console.error('导入JSON数据失败:', error);
      return false;
    }
  }

  // 导出为简化的数据格式（仅包含内容）
  public exportSimpleJSON(): string {
    const simpleData: { [key: string]: string } = {};
    
    for (let i = 0; i < this.getRowCount(); i++) {
      for (let j = 0; j < this.getColCount(); j++) {
        const cell = this.data.cells[i][j];
        if (cell.content) {
          // 使用 A1 格式的坐标
          const cellAddress = this.getCellAddress(i, j);
          simpleData[cellAddress] = cell.content;
        }
      }
    }

    return JSON.stringify(simpleData, null, 2);
  }

  // 从简化JSON格式导入
  public importFromSimpleJSON(jsonData: string): boolean {
    try {
      const simpleData = JSON.parse(jsonData);
      
      // 清空当前数据
      this.clearAllContent();
      
      // 导入数据
      Object.entries(simpleData).forEach(([cellAddress, content]) => {
        const position = this.parseCellAddress(cellAddress);
        if (position && typeof content === 'string') {
          this.setCellContent(position.row, position.col, content);
        }
      });

      this.isDirty = false;
      return true;
    } catch (error) {
      console.error('导入简化JSON数据失败:', error);
      return false;
    }
  }

  // 获取单元格地址（A1格式）
  private getCellAddress(row: number, col: number): string {
    let colName = '';
    let colIndex = col;
    
    while (colIndex >= 0) {
      colName = String.fromCharCode(65 + (colIndex % 26)) + colName;
      colIndex = Math.floor(colIndex / 26) - 1;
    }
    
    return colName + (row + 1);
  }

  // 解析单元格地址（A1格式）
  private parseCellAddress(address: string): { row: number; col: number } | null {
    const match = address.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    
    const colName = match[1];
    const rowNum = parseInt(match[2]) - 1;
    
    let col = 0;
    for (let i = 0; i < colName.length; i++) {
      col = col * 26 + (colName.charCodeAt(i) - 64);
    }
    col -= 1;
    
    return { row: rowNum, col };
  }

  // 清空所有内容
  public clearAllContent(): void {
    for (let i = 0; i < this.getRowCount(); i++) {
      for (let j = 0; j < this.getColCount(); j++) {
        this.data.cells[i][j] = {
          content: '',
          rowSpan: 1,
          colSpan: 1,
          isMerged: false
        };
      }
    }
    
    this.clearAllCache();
    this.isDirty = true;
  }

  // 调试方法：检查指定区域的合并状态
  public debugMergeStatus(startRow: number, startCol: number, endRow: number, endCol: number): void {
    const startAddr = `${String.fromCharCode(65 + startCol)}${startRow + 1}`;
    const endAddr = `${String.fromCharCode(65 + endCol)}${endRow + 1}`;
    console.log(`
=== 检查区域 ${startAddr}:${endAddr} 的合并状态 ===`);
    
    for (let i = startRow; i <= endRow; i++) {
      for (let j = startCol; j <= endCol; j++) {
        const cell = this.data.cells[i][j];
        const cellAddr = `${String.fromCharCode(65 + j)}${i + 1}`;
        
        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const parentAddr = `${String.fromCharCode(65 + parentCol)}${parentRow + 1}`;
          console.log(`  ${cellAddr}: 被合并 → 父单元格 ${parentAddr}`);
        } else if (cell.rowSpan > 1 || cell.colSpan > 1) {
          const endRow = i + cell.rowSpan - 1;
          const endCol = j + cell.colSpan - 1;
          const rangeEndAddr = `${String.fromCharCode(65 + endCol)}${endRow + 1}`;
          console.log(`  ${cellAddr}: 合并父单元格 (${cellAddr}:${rangeEndAddr}) 内容:"${cell.content}"`);
        } else {
          console.log(`  ${cellAddr}: 普通单元格 内容:"${cell.content}"`);
        }
      }
    }
    
    // 简单的合并检查
    const canMerge = this.canMergeRange(startRow, startCol, endRow, endCol);
    console.log(`
可以合并 ${startAddr}:${endAddr}: ${canMerge ? '✅ 是' : '❌ 否'}`);
    console.log(`=== 检查完成 ===
`);
  }

  // 辅助方法：检查区域是否可以合并（不执行实际合并）
  private canMergeRange(startRow: number, startCol: number, endRow: number, endCol: number): boolean {
    if (!this.isValidRange(startRow, startCol, endRow, endCol)) {
      console.log(`  ❌ 无效范围`);
      return false;
    }
    
    if (startRow === endRow && startCol === endCol) {
      console.log(`  ❌ 只选择了一个单元格`);
      return false;
    }

    for (let i = startRow; i <= endRow; i++) {
      for (let j = startCol; j <= endCol; j++) {
        const cell = this.data.cells[i][j];
        
        if (cell.rowSpan > 1 || cell.colSpan > 1) {
          const mergeEndRow = i + cell.rowSpan - 1;
          const mergeEndCol = j + cell.colSpan - 1;
          
          if (mergeEndRow > endRow || mergeEndCol > endCol) {
            console.log(`  ❌ 现有合并单元格 (${i},${j}) 超出选择区域`);
            return false;
          }
        }
        
        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const parentCell = this.data.cells[parentRow][parentCol];
          const parentEndRow = parentRow + parentCell.rowSpan - 1;
          const parentEndCol = parentCol + parentCell.colSpan - 1;
          
          if (parentRow < startRow || parentEndRow > endRow || 
              parentCol < startCol || parentEndCol > endCol) {
            console.log(`  ❌ 父单元格 (${parentRow},${parentCol}) 超出选择区域`);
            return false;
          }
        }
      }
    }
    
    console.log(`  ✅ 可以合并`);
    return true;
  }

  // 获取表格统计信息
  public getStatistics(): {
    totalCells: number;
    filledCells: number;
    mergedCells: number;
    dataSize: string;
  } {
    let filledCells = 0;
    let mergedCells = 0;
    const totalCells = this.getRowCount() * this.getColCount();
    
    for (let i = 0; i < this.getRowCount(); i++) {
      for (let j = 0; j < this.getColCount(); j++) {
        const cell = this.data.cells[i][j];
        if (cell.content) filledCells++;
        if (cell.isMerged || cell.rowSpan > 1 || cell.colSpan > 1) mergedCells++;
      }
    }
    
    const jsonSize = new Blob([this.exportToJSON()]).size;
    const dataSize = jsonSize < 1024 ? `${jsonSize} B` : 
                    jsonSize < 1024 * 1024 ? `${(jsonSize / 1024).toFixed(1)} KB` :
                    `${(jsonSize / (1024 * 1024)).toFixed(1)} MB`;
    
    return {
      totalCells,
      filledCells,
      mergedCells,
      dataSize
    };
  }

  // 撤销
  public undo(): boolean {
    const action = this.historyManager.getUndoAction();
    if (!action) return false;
    
    this.historyManager.pauseRecording();
    this.applyAction(action.undoData, action.type);
    this.historyManager.resumeRecording();
    
    return true;
  }

  // 重做
  public redo(): boolean {
    const action = this.historyManager.getRedoAction();
    if (!action) return false;
    
    this.historyManager.pauseRecording();
    this.applyAction(action.data, action.type);
    this.historyManager.resumeRecording();
    
    return true;
  }

  // 应用操作
  private applyAction(data: any, type: string): void {
    switch (type) {
      case 'setCellContent':
        this.setCellContentNoHistory(data.row, data.col, data.content);
        break;
      case 'setFontColor':
        if (this.isValidPosition(data.row, data.col)) {
          this.data.cells[data.row][data.col].fontColor = data.color;
        }
        break;
      case 'setBgColor':
        if (this.isValidPosition(data.row, data.col)) {
          this.data.cells[data.row][data.col].bgColor = data.color;
        }
        break;
    }
    this.isDirty = true;
  }

  // 是否可以撤销
  public canUndo(): boolean {
    return this.historyManager.canUndo();
  }

  // 是否可以重做
  public canRedo(): boolean {
    return this.historyManager.canRedo();
  }

  // 获取历史管理器
  public getHistoryManager(): HistoryManager {
    return this.historyManager;
  }
}