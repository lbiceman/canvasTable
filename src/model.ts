import { Cell, SpreadsheetData, CellPosition, CellFormat, RichTextSegment, ValidationRule, ValidationResult, SetCellContentResult, ConditionalFormatRule, SparklineConfig } from './types';
import type { RowColumnGroup, FillDirection } from './types';
import { HistoryManager } from './history-manager';
import { FormulaEngine } from './formula-engine';
import { DataTypeDetector } from './type-detector';
import { NumberFormatter, DateFormatter } from './format-engine';
import { ValidationEngine } from './validation';
import { ConditionalFormatEngine } from './conditional-format';
import { ChartModel } from './chart/chart-model';
import { SortFilterModel } from './sort-filter/sort-filter-model';
import { GroupManager } from './group-manager';
import { FillSeriesEngine } from './fill-series';

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
  private fontSize: number = 12; // 全局字体大小（默认12px）
  private formulaEngine: FormulaEngine;
  private formulaChangeCallbacks: Array<(row: number, col: number, newValue: string) => void> = [];
  private conditionalFormats: ConditionalFormatRule[] = []; // 条件格式规则列表
  private conditionalFormatEngine: ConditionalFormatEngine; // 条件格式引擎

  // 图表数据模型
  public readonly chartModel: ChartModel;

  // 排序筛选数据模型
  public readonly sortFilterModel: SortFilterModel;

  // 隐藏行列集合
  private hiddenRows: Set<number> = new Set();
  private hiddenCols: Set<number> = new Set();

  // 冻结窗格配置
  private freezeRowCount: number = 0;
  private freezeColCount: number = 0;

  // 分组管理器
  private groupManager: GroupManager = new GroupManager();

  constructor(rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
    // 初始化历史管理器
    this.historyManager = new HistoryManager();

    // 初始化条件格式引擎
    this.conditionalFormatEngine = new ConditionalFormatEngine();

    // 初始化图表数据模型
    this.chartModel = new ChartModel(this);

    // 初始化公式引擎
    this.formulaEngine = FormulaEngine.getInstance();
    this.formulaEngine.setCellGetter((row: number, col: number) => {
      return this.getCell(row, col);
    });

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

    // 初始化排序筛选数据模型（必须在 this.data 初始化之后，因为 buildIdentityMap 会调用 getRowCount）
    this.sortFilterModel = new SortFilterModel({
      getCell: (r: number, c: number) => this.getCell(r, c),
      getRowCount: () => this.getRowCount(),
    });
  }

  // 获取单元格数据
  public getCell(row: number, col: number): Cell | null {
    if (this.isValidPosition(row, col)) {
      return this.data.cells[row][col];
    }
    return null;
  }

  // 通过显示行号获取单元格（经过排序筛选映射）
  public getCellByDisplayRow(displayRow: number, col: number): Cell | null {
    const dataRow = this.sortFilterModel.getDataRowIndex(displayRow);
    if (dataRow === -1) return null;
    return this.getCell(dataRow, col);
  }

  // 获取单元格的计算值（公式计算后的值）
  public getComputedValue(row: number, col: number): string {
    const cell = this.getCell(row, col);
    if (!cell) return '';

    const content = cell.content;
    if (!this.formulaEngine.isFormula(content)) {
      return content;
    }

    const result = this.formulaEngine.evaluate(content, row, col);
    return result.value.toString();
  }

  // 重新计算指定单元格及其依赖单元格
  public recalculateCell(row: number, col: number): void {
    const cell = this.getCell(row, col);
    if (!cell) return;

    if (this.formulaEngine.isFormula(cell.content)) {
      this.formulaEngine.clearCellCache(row, col);
      const result = this.formulaEngine.evaluate(cell.content, row, col);
      cell.content = result.value.toString();

      this.notifyFormulaChange(row, col, result.value.toString());

      // 公式重算完成后通知图表更新
      this.notifyChartDataChange(row, col);
    }

    const dependents = this.formulaEngine.getDependents(row, col);
    for (const dep of dependents) {
      this.recalculateCell(dep.row, dep.col);
    }
  }

  // 重新计算所有公式单元格
  public recalculateFormulas(): void {
    const rows = this.data.cells.length;
    const cols = this.data.cells[0]?.length ?? 0;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const cell = this.data.cells[i][j];
        if (cell && this.formulaEngine.isFormula(cell.content)) {
          this.formulaEngine.clearCellCache(i, j);
          const result = this.formulaEngine.evaluate(cell.content, i, j);
          cell.content = result.value.toString();
          this.notifyFormulaChange(i, j, result.value.toString());
        }
      }
    }
  }

  // 注册公式变化回调
  public registerFormulaChangeCallback(callback: (row: number, col: number, newValue: string) => void): void {
    this.formulaChangeCallbacks.push(callback);
  }

  // 通知公式变化
  private notifyFormulaChange(row: number, col: number, newValue: string): void {
    for (const callback of this.formulaChangeCallbacks) {
      callback(row, col, newValue);
    }
  }

  // 公式错误回调
  private formulaErrorCallbacks: Array<(error: string) => void> = [];

  // 注册公式错误回调
  public registerFormulaErrorCallback(callback: (error: string) => void): void {
    this.formulaErrorCallbacks.push(callback);
  }

  // 通知公式错误
  private notifyFormulaError(error: string): void {
    for (const callback of this.formulaErrorCallbacks) {
      callback(error);
    }
  }

  /**
   * 通知图表模型：指定单元格数据已变更
   *
   * 遍历所有图表，检查变更的单元格是否在图表数据范围内，
   * 如果是则更新图表状态。
   */
  private notifyChartDataChange(row: number, col: number): void {
    const allCharts = this.chartModel.getAllCharts();
    for (const chart of allCharts) {
      const { startRow, startCol, endRow, endCol } = chart.dataRange;
      if (row >= startRow && row <= endRow && col >= startCol && col <= endCol) {
        this.chartModel.checkChartStatus(chart.id);
      }
    }
  }

  // 验证公式
  public validateFormula(formula: string): { valid: boolean; error?: string } {
    return this.formulaEngine.validateFormula(formula);
  }

  // 批量清除范围内单元格内容
  public clearRangeContent(startRow: number, startCol: number, endRow: number, endCol: number): void {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();
    const cellsData: { row: number; col: number; content: string }[] = [];

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            const oldContent = this.data.cells[parentRow][parentCol].content || '';
            cellsData.push({ row: parentRow, col: parentCol, content: oldContent });
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            const oldContent = cell.content || '';
            cellsData.push({ row: i, col: j, content: oldContent });
            processedCells.add(key);
          }
        }
      }
    }

    const hasChanges = cellsData.some(c => c.content !== '');
    if (hasChanges) {
      this.historyManager.record({
        type: 'clearContent',
        data: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol },
        undoData: { cells: cellsData }
      });
    }

    processedCells.clear();
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            this.data.cells[parentRow][parentCol].content = '';
            this.contentCache[`${parentRow}-${parentCol}`] = '';
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            cell.content = '';
            this.contentCache[key] = '';
            processedCells.add(key);
          }
        }
      }
    }

    this.isDirty = true;
  }

  // 设置单元格内容
  public setCellContent(row: number, col: number, content: string): SetCellContentResult {
    if (!this.isValidPosition(row, col)) {
      return { success: false };
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
      return { success: true };
    }

    // 在写入前检查验证规则
    const targetCell = (cell.isMerged && cell.mergeParent)
      ? this.data.cells[targetRow][targetCol]
      : cell;

    let warningResult: ValidationResult | undefined;
    if (targetCell.validation) {
      const validationResult = ValidationEngine.validate(content, targetCell.validation);
      if (!validationResult.valid) {
        if (targetCell.validation.mode === 'block') {
          // 阻止模式：拒绝无效输入，不写入内容
          return { success: false, validationResult };
        }
        // 警告模式：允许写入，但记录警告信息返回给调用方
        warningResult = validationResult;
      }
    }

    // 记录历史
    this.historyManager.record({
      type: 'setCellContent',
      data: { row: targetRow, col: targetCol, content },
      undoData: { row: targetRow, col: targetCol, content: oldContent }
    });

    // 处理公式内容
    if (this.formulaEngine.isFormula(content)) {
      const validation = this.formulaEngine.validateFormula(content);
      if (!validation.valid) {
        console.error('公式验证失败:', validation.error);
        this.notifyFormulaError(validation.error || '公式错误');
        return { success: false };
      }

      const result = this.formulaEngine.evaluate(content, targetRow, targetCol);

      if (result.isError) {
        console.error('公式计算错误:', result.errorMessage);
        this.notifyFormulaError(result.errorMessage || '公式计算错误');
        return { success: false };
      }

      if (cell.isMerged && cell.mergeParent) {
        this.data.cells[targetRow][targetCol].formulaContent = content;
        this.data.cells[targetRow][targetCol].content = result.value.toString();
        this.contentCache[`${targetRow}-${targetCol}`] = result.value.toString();
      } else {
        cell.formulaContent = content;
        cell.content = result.value.toString();
        this.contentCache[cacheKey] = result.value.toString();
      }

      this.notifyFormulaChange(targetRow, targetCol, result.value.toString());

      const affectedCells = this.formulaEngine.getAffectedCells(targetRow, targetCol);
      for (const affected of affectedCells) {
        this.recalculateCell(affected.row, affected.col);
      }
    } else {
      if (cell.isMerged && cell.mergeParent) {
        this.data.cells[targetRow][targetCol].formulaContent = undefined;
        this.data.cells[targetRow][targetCol].content = content;
        this.contentCache[`${targetRow}-${targetCol}`] = content;
      } else {
        cell.formulaContent = undefined;
        cell.content = content;
        this.contentCache[cacheKey] = content;
      }

      // 自动类型检测：始终重新检测以更新 rawValue
      // 自动类型检测：未手动设置格式时重新检测
      const detectCell = (cell.isMerged && cell.mergeParent)
        ? this.data.cells[targetRow][targetCol]
        : cell;
      if (!detectCell.format || detectCell.isAutoFormat) {
        const detection = DataTypeDetector.detect(content);
        detectCell.dataType = detection.dataType;
        detectCell.rawValue = detection.rawValue;
        if (detection.format) {
          detectCell.format = detection.format;
          detectCell.isAutoFormat = true;
        } else {
          // 内容不再是可格式化的类型，清除自动格式
          detectCell.format = undefined;
          detectCell.isAutoFormat = undefined;
        }
      }

      const affectedCells = this.formulaEngine.getAffectedCells(targetRow, targetCol);
      for (const affected of affectedCells) {
        this.recalculateCell(affected.row, affected.col);
      }
    }

    this.isDirty = true;
    this.clearCacheIfNeeded();

    // 通知图表模型：单元格数据已变更，检查受影响的图表状态
    this.notifyChartDataChange(targetRow, targetCol);

    return { success: true, validationResult: warningResult };
  }

  // 设置单元格内容（不记录历史，用于撤销/重做）
  public setCellContentNoHistory(row: number, col: number, content: string): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];

    if (this.formulaEngine.isFormula(content)) {
      const result = this.formulaEngine.evaluate(content, row, col);
      cell.formulaContent = content;
      cell.content = result.value.toString();
      this.contentCache[`${row}-${col}`] = result.value.toString();
    } else {
      cell.formulaContent = undefined;
      cell.content = content;
      this.contentCache[`${row}-${col}`] = content;

      // 自动类型检测：更新 rawValue 和 format（与 setCellContent 保持一致）
      if (!cell.format || cell.isAutoFormat) {
        const detection = DataTypeDetector.detect(content);
        cell.dataType = detection.dataType;
        cell.rawValue = detection.rawValue;
        if (detection.format) {
          cell.format = detection.format;
          cell.isAutoFormat = true;
        } else {
          // 内容不再是可格式化的类型，清除自动格式
          cell.format = undefined;
          cell.isAutoFormat = undefined;
        }
      }
    }

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
    const cellsData: { row: number; col: number; color: string }[] = [];

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            const oldColor = this.data.cells[parentRow][parentCol].fontColor || '';
            cellsData.push({ row: parentRow, col: parentCol, color: oldColor });
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            const oldColor = cell.fontColor || '';
            cellsData.push({ row: i, col: j, color: oldColor });
            processedCells.add(key);
          }
        }
      }
    }

    const hasChanges = cellsData.some(c => c.color !== color);
    if (hasChanges) {
      this.historyManager.record({
        type: 'setFontColor',
        data: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol, color },
        undoData: { cells: cellsData }
      });
    }

    processedCells.clear();
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

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

  // 设置单元格字体大小
  public setCellFontSize(row: number, col: number, size: number): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];

    // 如果是被合并的单元格，则设置合并父单元格的字体大小
    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      this.data.cells[parentRow][parentCol].fontSize = size;
    } else {
      cell.fontSize = size;
    }

    this.isDirty = true;
  }

  // 批量设置单元格字体大小
  public setRangeFontSize(startRow: number, startCol: number, endRow: number, endCol: number, size: number): void {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();
    const cellsData: { row: number; col: number; size: number }[] = [];

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            const oldSize = this.data.cells[parentRow][parentCol].fontSize || 14;
            cellsData.push({ row: parentRow, col: parentCol, size: oldSize });
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            const oldSize = cell.fontSize || 14;
            cellsData.push({ row: i, col: j, size: oldSize });
            processedCells.add(key);
          }
        }
      }
    }

    const hasChanges = cellsData.some(c => c.size !== size);
    if (hasChanges) {
      this.historyManager.record({
        type: 'setFontSize',
        data: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol, size },
        undoData: { cells: cellsData }
      });
    }

    processedCells.clear();
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            this.data.cells[parentRow][parentCol].fontSize = size;
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            cell.fontSize = size;
            processedCells.add(key);
          }
        }
      }
    }

    this.isDirty = true;
  }

  // 设置单元格字体加粗
  public setCellFontBold(row: number, col: number, bold: boolean): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];

    // 如果是被合并的单元格，则设置合并父单元格的字体加粗
    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      this.data.cells[parentRow][parentCol].fontBold = bold;
    } else {
      cell.fontBold = bold;
    }

    this.isDirty = true;
  }

  // 批量设置单元格字体加粗
  public setRangeFontBold(startRow: number, startCol: number, endRow: number, endCol: number, bold: boolean): void {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();
    const cellsData: { row: number; col: number; bold: boolean }[] = [];

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            const oldBold = this.data.cells[parentRow][parentCol].fontBold || false;
            cellsData.push({ row: parentRow, col: parentCol, bold: oldBold });
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            const oldBold = cell.fontBold || false;
            cellsData.push({ row: i, col: j, bold: oldBold });
            processedCells.add(key);
          }
        }
      }
    }

    const hasChanges = cellsData.some(c => c.bold !== bold);
    if (hasChanges) {
      this.historyManager.record({
        type: 'setFontBold',
        data: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol, bold },
        undoData: { cells: cellsData }
      });
    }

    processedCells.clear();
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            this.data.cells[parentRow][parentCol].fontBold = bold;
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            cell.fontBold = bold;
            processedCells.add(key);
          }
        }
      }
    }

    this.isDirty = true;
  }

  // 设置单元格字体斜体
  public setCellFontItalic(row: number, col: number, italic: boolean): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];

    // 如果是被合并的单元格，则设置合并父单元格的字体斜体
    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      this.data.cells[parentRow][parentCol].fontItalic = italic;
    } else {
      cell.fontItalic = italic;
    }

    this.isDirty = true;
  }

  // 批量设置单元格字体斜体
  public setRangeFontItalic(startRow: number, startCol: number, endRow: number, endCol: number, italic: boolean): void {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();
    const originalItalics: Array<{ row: number; col: number; italic: boolean }> = [];

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            originalItalics.push({
              row: parentRow,
              col: parentCol,
              italic: this.data.cells[parentRow][parentCol].fontItalic || false
            });
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            originalItalics.push({
              row: i,
              col: j,
              italic: cell.fontItalic || false
            });
            processedCells.add(key);
          }
        }
      }
    }

    const hasChanges = originalItalics.some(c => c.italic !== italic);
    if (hasChanges) {
      this.historyManager.record({
        type: 'setFontItalic',
        data: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol, italic },
        undoData: { cells: originalItalics }
      });
    }

    processedCells.clear();
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            this.data.cells[parentRow][parentCol].fontItalic = italic;
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            cell.fontItalic = italic;
            processedCells.add(key);
          }
        }
      }
    }

    this.isDirty = true;
  }

  // 设置单元格字体下划线
  public setCellFontUnderline(row: number, col: number, underline: boolean): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];

    // 如果是被合并的单元格，则设置合并父单元格的下划线
    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      this.data.cells[parentRow][parentCol].fontUnderline = underline;
    } else {
      cell.fontUnderline = underline;
    }

    this.isDirty = true;
  }

  // 批量设置单元格字体下划线
  public setRangeFontUnderline(startRow: number, startCol: number, endRow: number, endCol: number, underline: boolean): void {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();
    const originalUnderlines: Array<{ row: number; col: number; underline: boolean }> = [];

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            originalUnderlines.push({
              row: parentRow,
              col: parentCol,
              underline: this.data.cells[parentRow][parentCol].fontUnderline || false
            });
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            originalUnderlines.push({
              row: i,
              col: j,
              underline: cell.fontUnderline || false
            });
            processedCells.add(key);
          }
        }
      }
    }

    const hasChanges = originalUnderlines.some(c => c.underline !== underline);
    if (hasChanges) {
      this.historyManager.record({
        type: 'setFontUnderline',
        data: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol, underline },
        undoData: { cells: originalUnderlines }
      });
    }

    processedCells.clear();
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            this.data.cells[parentRow][parentCol].fontUnderline = underline;
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            cell.fontUnderline = underline;
            processedCells.add(key);
          }
        }
      }
    }

    this.isDirty = true;
  }

  // 设置单元格字体对齐方式
  public setCellFontAlign(row: number, col: number, align: 'left' | 'center' | 'right'): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];

    // 如果是被合并的单元格，则设置合并父单元格的字体对齐方式
    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      this.data.cells[parentRow][parentCol].fontAlign = align;
    } else {
      cell.fontAlign = align;
    }

    this.isDirty = true;
  }

  // 批量设置单元格字体对齐方式
  public setRangeFontAlign(startRow: number, startCol: number, endRow: number, endCol: number, align: 'left' | 'center' | 'right'): void {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();
    const cellsData: { row: number; col: number; align: string }[] = [];

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            const oldAlign = this.data.cells[parentRow][parentCol].fontAlign || 'left';
            cellsData.push({ row: parentRow, col: parentCol, align: oldAlign });
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            const oldAlign = cell.fontAlign || 'left';
            cellsData.push({ row: i, col: j, align: oldAlign });
            processedCells.add(key);
          }
        }
      }
    }

    const hasChanges = cellsData.some(c => c.align !== align);
    if (hasChanges) {
      this.historyManager.record({
        type: 'setFontAlign',
        data: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol, align },
        undoData: { cells: cellsData }
      });
    }

    processedCells.clear();
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            this.data.cells[parentRow][parentCol].fontAlign = align;
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            cell.fontAlign = align;
            processedCells.add(key);
          }
        }
      }
    }

    this.isDirty = true;
  }

  // 设置单元格垂直对齐方式
  public setCellVerticalAlign(row: number, col: number, align: 'top' | 'middle' | 'bottom'): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];

    // 如果是被合并的单元格，则设置合并父单元格的垂直对齐方式
    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      this.data.cells[parentRow][parentCol].verticalAlign = align;
    } else {
      cell.verticalAlign = align;
    }

    this.isDirty = true;
  }

  // 设置选区范围内所有单元格的垂直对齐方式
  public setRangeVerticalAlign(startRow: number, startCol: number, endRow: number, endCol: number, align: 'top' | 'middle' | 'bottom'): void {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();
    const cellsData: { row: number; col: number; align: string }[] = [];

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            const oldAlign = this.data.cells[parentRow][parentCol].verticalAlign || 'middle';
            cellsData.push({ row: parentRow, col: parentCol, align: oldAlign });
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            const oldAlign = cell.verticalAlign || 'middle';
            cellsData.push({ row: i, col: j, align: oldAlign });
            processedCells.add(key);
          }
        }
      }
    }

    const hasChanges = cellsData.some(c => c.align !== align);
    if (hasChanges) {
      this.historyManager.record({
        type: 'setVerticalAlign',
        data: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol, align },
        undoData: { cells: cellsData }
      });
    }

    processedCells.clear();
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            this.data.cells[parentRow][parentCol].verticalAlign = align;
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            cell.verticalAlign = align;
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
    const cellsData: { row: number; col: number; color: string }[] = [];

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            const oldColor = this.data.cells[parentRow][parentCol].bgColor || '';
            cellsData.push({ row: parentRow, col: parentCol, color: oldColor });
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            const oldColor = cell.bgColor || '';
            cellsData.push({ row: i, col: j, color: oldColor });
            processedCells.add(key);
          }
        }
      }
    }

    const hasChanges = cellsData.some(c => c.color !== color);
    if (hasChanges) {
      this.historyManager.record({
        type: 'setBgColor',
        data: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol, color },
        undoData: { cells: cellsData }
      });
    }

    processedCells.clear();
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

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

    // 保存原始状态用于撤销
    const originalCells: {row: number; col: number; content: string; rowSpan: number; colSpan: number; isMerged: boolean; mergeParent?: CellPosition}[] = [];
    for (let i = startRow; i <= endRow; i++) {
      for (let j = startCol; j <= endCol; j++) {
        const cell = this.data.cells[i][j];
        originalCells.push({
          row: i,
          col: j,
          content: cell.content,
          rowSpan: cell.rowSpan,
          colSpan: cell.colSpan,
          isMerged: cell.isMerged,
          mergeParent: cell.mergeParent
        });
      }
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

    // 记录历史
    this.historyManager.record({
      type: 'mergeCells',
      data: { startRow, startCol, endRow, endCol, content },
      undoData: { cells: originalCells }
    });

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

    // 保存所有受影响单元格的原始状态，用于撤销
    const originalCells: {row: number; col: number; content: string; rowSpan: number; colSpan: number; isMerged: boolean; mergeParent?: CellPosition}[] = [];
    for (let i = parentRow; i <= endRow; i++) {
      for (let j = parentCol; j <= endCol; j++) {
        const affectedCell = this.data.cells[i][j];
        originalCells.push({
          row: i,
          col: j,
          content: affectedCell.content,
          rowSpan: affectedCell.rowSpan,
          colSpan: affectedCell.colSpan,
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

    // 记录历史
    this.historyManager.record({
      type: 'splitCell',
      data: { row: parentRow, col: parentCol, rowSpan, colSpan, content },
      undoData: { cells: originalCells }
    });

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
  public setRowHeight(row: number, height: number, recordHistory: boolean = true): void {
    if (row >= 0 && row < this.data.rowHeights.length) {
      const oldHeight = this.data.rowHeights[row];
      // 只在值发生变化时记录历史
      if (recordHistory && oldHeight !== height) {
        this.historyManager.record({
          type: 'resizeRow',
          data: { row, height },
          undoData: { row, height: oldHeight }
        });
      }
      this.data.rowHeights[row] = height;
    }
  }

  // 设置列宽
  public setColWidth(col: number, width: number, recordHistory: boolean = true): void {
    if (col >= 0 && col < this.data.colWidths.length) {
      const oldWidth = this.data.colWidths[col];
      // 只在值发生变化时记录历史
      if (recordHistory && oldWidth !== width) {
        this.historyManager.record({
          type: 'resizeCol',
          data: { col, width },
          undoData: { col, width: oldWidth }
        });
      }
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

  // 获取全局字体大小
  public getFontSize(): number {
    return this.fontSize;
  }

  // 设置全局字体大小
  public setFontSize(size: number): void {
    this.fontSize = size;
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

    // 通知图表模型调整数据范围
    this.chartModel.adjustDataRanges('rowInsert', rowIndex, count);

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

    // 通知图表模型调整数据范围
    this.chartModel.adjustDataRanges('rowDelete', rowIndex, actualCount);

    this.clearAllCache();
    this.isDirty = true;
    return true;
  }

  // 插入指定列
  public insertColumns(colIndex: number, count: number): boolean {
    if (colIndex < 0 || colIndex > this.getColCount() || count <= 0) {
      return false;
    }

    // 检查是否超过最大列数
    if (this.getColCount() + count > MAX_COLS) {
      return false;
    }

    const rowCount = this.getRowCount();

    // 每行在 colIndex 处插入 count 个空单元格
    for (let i = 0; i < rowCount; i++) {
      const newCells: Cell[] = [];
      for (let k = 0; k < count; k++) {
        newCells.push({
          content: '',
          rowSpan: 1,
          colSpan: 1,
          isMerged: false
        });
      }
      this.data.cells[i].splice(colIndex, 0, ...newCells);
    }

    // 在 colWidths 中插入 count 个默认列宽
    const newWidths = Array(count).fill(DEFAULT_COL_WIDTH);
    this.data.colWidths.splice(colIndex, 0, ...newWidths);

    // 更新合并/拆分单元格引用
    this.updateMergeReferencesAfterInsertCols(colIndex, count);

    // 通知图表模型调整数据范围
    this.chartModel.adjustDataRanges('colInsert', colIndex, count);

    this.clearAllCache();
    this.isDirty = true;
    return true;
  }

  // 插入列后更新合并/拆分单元格引用
  private updateMergeReferencesAfterInsertCols(colIndex: number, count: number): void {
    for (let i = 0; i < this.getRowCount(); i++) {
      for (let j = 0; j < this.getColCount(); j++) {
        const cell = this.data.cells[i][j];
        // 更新被合并单元格的父单元格引用
        if (cell.isMerged && cell.mergeParent) {
          if (cell.mergeParent.col >= colIndex) {
            cell.mergeParent.col += count;
          }
        }
        // 更新合并父单元格的 colSpan（如果插入点在合并区域内部）
        if ((cell.rowSpan > 1 || cell.colSpan > 1) && !cell.isMerged) {
          const endCol = j + cell.colSpan - 1;
          if (j < colIndex && endCol >= colIndex) {
            // 插入点在合并区域内部，扩展 colSpan
            cell.colSpan += count;
          } else if (j >= colIndex) {
            // 合并父单元格在插入点右侧，不需要调整（已随行数据移动）
          }
        }
      }
    }
  }

  // 删除指定列
  public deleteColumns(colIndex: number, count: number): boolean {
    if (colIndex < 0 || colIndex >= this.getColCount() || count <= 0) {
      return false;
    }

    // 确保不会删除所有列
    const actualCount = Math.min(count, this.getColCount() - colIndex);
    if (this.getColCount() - actualCount < 1) {
      return false;
    }

    // 先拆分受影响的合并单元格
    this.splitMergedCellsInCols(colIndex, actualCount);

    // 每行删除 colIndex 起的 actualCount 个单元格
    const rowCount = this.getRowCount();
    for (let i = 0; i < rowCount; i++) {
      this.data.cells[i].splice(colIndex, actualCount);
    }

    // 从 colWidths 中删除对应条目
    this.data.colWidths.splice(colIndex, actualCount);

    // 更新合并/拆分单元格引用
    this.updateMergeReferencesAfterDeleteCols(colIndex, actualCount);

    // 通知图表模型调整数据范围
    this.chartModel.adjustDataRanges('colDelete', colIndex, actualCount);

    this.clearAllCache();
    this.isDirty = true;
    return true;
  }

  // ============================================================
  // 隐藏行列管理
  // ============================================================

  /** 隐藏指定行 */
  public hideRows(indices: number[]): void {
    for (const idx of indices) {
      this.hiddenRows.add(idx);
    }
  }

  /** 隐藏指定列 */
  public hideCols(indices: number[]): void {
    for (const idx of indices) {
      this.hiddenCols.add(idx);
    }
  }

  /** 取消隐藏指定行 */
  public unhideRows(indices: number[]): void {
    for (const idx of indices) {
      this.hiddenRows.delete(idx);
    }
  }

  /** 取消隐藏指定列 */
  public unhideCols(indices: number[]): void {
    for (const idx of indices) {
      this.hiddenCols.delete(idx);
    }
  }

  /** 判断行是否隐藏 */
  public isRowHidden(row: number): boolean {
    return this.hiddenRows.has(row);
  }

  /** 判断列是否隐藏 */
  public isColHidden(col: number): boolean {
    return this.hiddenCols.has(col);
  }

  /** 获取所有隐藏行（返回副本） */
  public getHiddenRows(): Set<number> {
    return new Set(this.hiddenRows);
  }

  /** 获取所有隐藏列（返回副本） */
  public getHiddenCols(): Set<number> {
    return new Set(this.hiddenCols);
  }

  // ============================================================
  // 冻结窗格管理
  // ============================================================

  /** 设置冻结行数 */
  public setFreezeRows(count: number): void {
    this.freezeRowCount = Math.max(0, count);
  }

  /** 设置冻结列数 */
  public setFreezeCols(count: number): void {
    this.freezeColCount = Math.max(0, count);
  }

  /** 获取冻结行数 */
  public getFreezeRows(): number {
    return this.freezeRowCount;
  }

  /** 获取冻结列数 */
  public getFreezeCols(): number {
    return this.freezeColCount;
  }

  // ============================================================
  // 批量删除行/列
  // ============================================================

  /**
   * 批量删除多行（支持不连续行，自动逆序处理）
   * @param rowIndices 要删除的行索引数组
   * @returns true 如果删除成功，false 如果删除会导致行数少于 1
   */
  public batchDeleteRows(rowIndices: number[]): boolean {
    // 去重并升序排序
    const uniqueIndices = [...new Set(rowIndices)]
      .filter((idx) => idx >= 0 && idx < this.getRowCount())
      .sort((a, b) => a - b);

    if (uniqueIndices.length === 0) {
      return false;
    }

    // 检查删除后是否至少保留 1 行
    if (this.getRowCount() - uniqueIndices.length < 1) {
      return false;
    }

    // 保存撤销数据：记录每行的完整单元格数据和行高
    const undoData = {
      indices: uniqueIndices,
      rows: uniqueIndices.map((idx) => ({
        index: idx,
        cells: this.data.cells[idx] ? [...this.data.cells[idx]] : [],
        height: this.data.rowHeights[idx]
      }))
    };

    // 逆序删除前，先拆分受影响的合并单元格
    for (let i = uniqueIndices.length - 1; i >= 0; i--) {
      const idx = uniqueIndices[i];
      this.splitMergedCellsInRows(idx, 1);
    }

    // 从最大索引开始逆序删除，避免索引偏移
    for (let i = uniqueIndices.length - 1; i >= 0; i--) {
      const idx = uniqueIndices[i];
      this.data.cells.splice(idx, 1);
      this.data.rowHeights.splice(idx, 1);
    }

    // 记录历史（作为单个操作）
    this.historyManager.record({
      type: 'batchDeleteRows',
      data: { indices: uniqueIndices },
      undoData
    });

    this.clearAllCache();
    this.isDirty = true;
    return true;
  }

  /**
   * 批量删除多列（支持不连续列，自动逆序处理）
   * @param colIndices 要删除的列索引数组
   * @returns true 如果删除成功，false 如果删除会导致列数少于 1
   */
  public batchDeleteColumns(colIndices: number[]): boolean {
    // 去重并升序排序
    const uniqueIndices = [...new Set(colIndices)]
      .filter((idx) => idx >= 0 && idx < this.getColCount())
      .sort((a, b) => a - b);

    if (uniqueIndices.length === 0) {
      return false;
    }

    // 检查删除后是否至少保留 1 列
    if (this.getColCount() - uniqueIndices.length < 1) {
      return false;
    }

    // 保存撤销数据：记录每列的完整单元格数据和列宽
    const undoData = {
      indices: uniqueIndices,
      cols: uniqueIndices.map((idx) => ({
        index: idx,
        cells: this.data.cells.map((row) => row[idx]),
        width: this.data.colWidths[idx]
      }))
    };

    // 逆序删除前，先拆分受影响的合并单元格
    for (let i = uniqueIndices.length - 1; i >= 0; i--) {
      const idx = uniqueIndices[i];
      this.splitMergedCellsInCols(idx, 1);
    }

    // 从最大索引开始逆序删除，避免索引偏移
    for (let i = uniqueIndices.length - 1; i >= 0; i--) {
      const idx = uniqueIndices[i];
      for (const row of this.data.cells) {
        row.splice(idx, 1);
      }
      this.data.colWidths.splice(idx, 1);
    }

    // 记录历史（作为单个操作）
    this.historyManager.record({
      type: 'batchDeleteCols',
      data: { indices: uniqueIndices },
      undoData
    });

    this.clearAllCache();
    this.isDirty = true;
    return true;
  }

  // 删除列后更新合并/拆分单元格引用
  private updateMergeReferencesAfterDeleteCols(colIndex: number, count: number): void {
    for (let i = 0; i < this.getRowCount(); i++) {
      for (let j = 0; j < this.getColCount(); j++) {
        const cell = this.data.cells[i][j];
        // 更新被合并单元格的父单元格引用
        if (cell.isMerged && cell.mergeParent) {
          if (cell.mergeParent.col >= colIndex + count) {
            cell.mergeParent.col -= count;
          }
        }
      }
    }
  }

  // 拆分指定列范围内的合并单元格
  private splitMergedCellsInCols(startCol: number, count: number): void {
    const endCol = startCol + count - 1;
    const processedCells = new Set<string>();

    for (let i = 0; i < this.getRowCount(); i++) {
      for (let j = startCol; j <= endCol && j < this.getColCount(); j++) {
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
    formulaContent?: string;
    fontColor?: string;
    bgColor?: string;
    fontSize?: number;
    fontBold?: boolean;
    fontItalic?: boolean;
    fontUnderline?: boolean;
    fontAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    format?: CellFormat;
    rawValue?: number;
    wrapText?: boolean;
    richText?: RichTextSegment[];
    validation?: ValidationRule;
    sparkline?: SparklineConfig;
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
        formulaContent: parentCell.formulaContent,
        fontColor: parentCell.fontColor,
        bgColor: parentCell.bgColor,
        fontSize: parentCell.fontSize,
        fontBold: parentCell.fontBold,
        fontItalic: parentCell.fontItalic,
        fontUnderline: parentCell.fontUnderline,
        fontAlign: parentCell.fontAlign,
        verticalAlign: parentCell.verticalAlign,
        format: parentCell.format,
        rawValue: parentCell.rawValue,
        wrapText: parentCell.wrapText,
        richText: parentCell.richText,
        validation: parentCell.validation,
        sparkline: parentCell.sparkline,
      };
    }

    // 如果是合并父单元格或普通单元格
    return {
      row,
      col,
      rowSpan: cell.rowSpan,
      colSpan: cell.colSpan,
      content: cell.content,
      formulaContent: cell.formulaContent,
      fontColor: cell.fontColor,
      bgColor: cell.bgColor,
      fontSize: cell.fontSize,
      fontBold: cell.fontBold,
      fontItalic: cell.fontItalic,
      fontUnderline: cell.fontUnderline,
      fontAlign: cell.fontAlign,
      verticalAlign: cell.verticalAlign,
      format: cell.format,
      rawValue: cell.rawValue,
      wrapText: cell.wrapText,
      richText: cell.richText,
      validation: cell.validation,
      sparkline: cell.sparkline,
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

  /**
   * 从 SpreadsheetData 直接加载文档数据（协同模式同步用）
   * 直接替换内部数据结构，无需格式转换
   */
  public loadFromData(source: SpreadsheetData): void {
    this.data = {
      cells: source.cells,
      rowHeights: source.rowHeights,
      colWidths: source.colWidths,
    };
    this.clearAllCache();
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
        defaultColWidth: DEFAULT_COL_WIDTH,
        // 隐藏行列（Set → 数组）
        hiddenRows: Array.from(this.hiddenRows),
        hiddenCols: Array.from(this.hiddenCols),
        // 冻结窗格配置
        freezeRows: this.freezeRowCount,
        freezeCols: this.freezeColCount,
        // 分组数据
        rowGroups: this.groupManager.getRowGroups(),
        colGroups: this.groupManager.getColGroups(),
      },
      data: {
        cells: [] as Record<string, unknown>[],
        rowHeights: customRowHeights,
        colWidths: customColWidths,
        // 序列化条件格式规则（仅在有规则时包含）
        ...(this.conditionalFormats.length > 0 ? { conditionalFormats: this.conditionalFormats } : {}),
        // 序列化图表配置（仅在有图表时包含）
        ...(this.chartModel.getAllCharts().length > 0 ? { charts: this.chartModel.serialize() } : {})
      }
    };

    // 只导出有内容或特殊格式的单元格
    for (let i = 0; i < this.getRowCount(); i++) {
      for (let j = 0; j < this.getColCount(); j++) {
        const cell = this.data.cells[i][j];

        // 只保存有内容、合并信息、颜色或数据类型格式化相关字段的单元格
        if (cell.content || cell.rowSpan > 1 || cell.colSpan > 1 || cell.isMerged || cell.fontColor || cell.bgColor || cell.fontSize || cell.fontBold || cell.fontItalic || cell.fontUnderline || cell.verticalAlign || cell.formulaContent || cell.dataType || cell.rawValue !== undefined || cell.format || cell.richText || cell.wrapText || cell.validation) {
          // 导出数据对象类型，使用 Record 避免 any
          const cellData: Record<string, unknown> = {
            row: i,
            col: j,
            content: cell.content,
            rowSpan: cell.rowSpan,
            colSpan: cell.colSpan,
            isMerged: cell.isMerged,
            mergeParent: cell.mergeParent,
            fontColor: cell.fontColor,
            bgColor: cell.bgColor,
            fontSize: cell.fontSize,
            fontBold: cell.fontBold,
            fontItalic: cell.fontItalic,
            fontUnderline: cell.fontUnderline,
            verticalAlign: cell.verticalAlign,
          };

          if (cell.formulaContent) {
            cellData.formulaContent = cell.formulaContent;
          }

          // 序列化数据类型与格式化相关字段（仅非空值）
          if (cell.dataType) cellData.dataType = cell.dataType;
          if (cell.rawValue !== undefined) cellData.rawValue = cell.rawValue;
          if (cell.format) cellData.format = cell.format;
          if (cell.richText) cellData.richText = cell.richText;
          if (cell.wrapText) cellData.wrapText = cell.wrapText;
          if (cell.validation) cellData.validation = cell.validation;

          exportData.data.cells.push(cellData);
        }
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  // 验证导入数据格式和公式
  public static validateImportData(jsonData: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const importData = JSON.parse(jsonData);

      if (!importData.version) {
        errors.push('缺少版本信息 (version 字段)');
      }

      if (!importData.data) {
        errors.push('缺少数据部分 (data 字段)');
        return { valid: false, errors, warnings };
      }

      const { data, metadata } = importData;

      if (metadata) {
        if (metadata.rowCount && typeof metadata.rowCount !== 'number') {
          errors.push('行数 (rowCount) 必须是数字');
        }
        if (metadata.colCount && typeof metadata.colCount !== 'number') {
          errors.push('列数 (colCount) 必须是数字');
        }
      }

      if (data.cells && Array.isArray(data.cells)) {
        const formulaEngine = FormulaEngine.getInstance();

        data.cells.forEach((cellData: any, index: number) => {
          if (!cellData.row && cellData.row !== 0) {
            errors.push(`单元格 #${index + 1}: 缺少行号 (row 字段)`);
          }
          if (!cellData.col && cellData.col !== 0) {
            errors.push(`单元格 #${index + 1}: 缺少列号 (col 字段)`);
          }

          if (cellData.formulaContent) {
            if (typeof cellData.formulaContent !== 'string') {
              errors.push(`单元格 (${cellData.row}, ${cellData.col}): formulaContent 必须是字符串`);
            } else if (!cellData.formulaContent.startsWith('=')) {
              warnings.push(`单元格 (${cellData.row}, ${cellData.col}): formulaContent 应该以 '=' 开头`);
            } else {
              const validation = formulaEngine.validateFormula(cellData.formulaContent);
              if (!validation.valid) {
                errors.push(`单元格 (${cellData.row}, ${cellData.col}): 公式错误 - ${validation.error}`);
              }
            }
          }

          if (cellData.content && typeof cellData.content !== 'string') {
            warnings.push(`单元格 (${cellData.row}, ${cellData.col}): content 应该是字符串`);
          }

          if (cellData.isMerged && cellData.mergeParent) {
            const parentRow = cellData.mergeParent.row;
            const parentCol = cellData.mergeParent.col;
            if (parentRow === cellData.row && parentCol === cellData.col) {
              errors.push(`单元格 (${cellData.row}, ${cellData.col}): 合并父单元格不能是自己`);
            }
          }
        });
      }

      if (!data.cells || !Array.isArray(data.cells)) {
        warnings.push('数据中没有单元格数组 (cells)');
      }

      // 验证 charts 字段：如果存在但不是数组，记录警告
      if (data.charts !== undefined && !Array.isArray(data.charts)) {
        warnings.push('charts 字段格式无效（应为数组），将忽略图表数据');
      }

    } catch (error) {
      errors.push(`JSON 解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // 验证简化格式导入数据
  public static validateSimpleImportData(jsonData: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const simpleData = JSON.parse(jsonData);

      if (typeof simpleData !== 'object' || simpleData === null || Array.isArray(simpleData)) {
        errors.push('简化格式数据必须是对象');
        return { valid: false, errors, warnings };
      }

      const formulaEngine = FormulaEngine.getInstance();

      Object.entries(simpleData).forEach(([cellAddress, data]) => {
        const position = SpreadsheetModel.parseCellAddressStatic(cellAddress);
        if (!position) {
          errors.push(`无效的单元格地址: ${cellAddress}`);
          return;
        }

        if (typeof data === 'string') {
          return;
        }

        if (typeof data === 'object' && data !== null) {
          const cellData = data as { value?: string; formula?: string };

          if (cellData.formula) {
            if (typeof cellData.formula !== 'string') {
              errors.push(`单元格 ${cellAddress}: formula 必须是字符串`);
            } else if (!cellData.formula.startsWith('=')) {
              warnings.push(`单元格 ${cellAddress}: formula 应该以 '=' 开头`);
            } else {
              const validation = formulaEngine.validateFormula(cellData.formula);
              if (!validation.valid) {
                errors.push(`单元格 ${cellAddress}: 公式错误 - ${validation.error}`);
              }
            }
          }

          if (cellData.value !== undefined && typeof cellData.value !== 'string') {
            warnings.push(`单元格 ${cellAddress}: value 应该是字符串`);
          }
        } else {
          errors.push(`单元格 ${cellAddress}: 数据格式无效，应为字符串或对象`);
        }
      });

    } catch (error) {
      errors.push(`JSON 解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // 静态方法：解析单元格地址
  private static parseCellAddressStatic(cellAddress: string): { row: number; col: number } | null {
    const match = cellAddress.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;

    const colStr = match[1].toUpperCase();
    const row = parseInt(match[2], 10) - 1;

    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    col = col - 1;

    return { row, col };
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

        // 恢复隐藏行列
        if (Array.isArray(metadata.hiddenRows)) {
          this.hiddenRows = new Set(metadata.hiddenRows as number[]);
        } else {
          this.hiddenRows = new Set();
        }
        if (Array.isArray(metadata.hiddenCols)) {
          this.hiddenCols = new Set(metadata.hiddenCols as number[]);
        } else {
          this.hiddenCols = new Set();
        }

        // 恢复冻结窗格配置
        if (typeof metadata.freezeRows === 'number') {
          this.freezeRowCount = metadata.freezeRows;
        } else {
          this.freezeRowCount = 0;
        }
        if (typeof metadata.freezeCols === 'number') {
          this.freezeColCount = metadata.freezeCols;
        } else {
          this.freezeColCount = 0;
        }

        // 恢复分组数据
        this.groupManager = new GroupManager();
        if (Array.isArray(metadata.rowGroups)) {
          for (const group of metadata.rowGroups as RowColumnGroup[]) {
            this.groupManager.createRowGroup(group.start, group.end);
            if (group.collapsed) {
              this.groupManager.collapseGroup('row', group.start, group.end);
            }
          }
        }
        if (Array.isArray(metadata.colGroups)) {
          for (const group of metadata.colGroups as RowColumnGroup[]) {
            this.groupManager.createColGroup(group.start, group.end);
            if (group.collapsed) {
              this.groupManager.collapseGroup('col', group.start, group.end);
            }
          }
        }
      }

      // 导入行高和列宽（支持顶层或data内部两种格式）
      const rowHeightsData = importData.rowHeights || data.rowHeights;
      const colWidthsData = importData.colWidths || data.colWidths;

      if (rowHeightsData) {
        // 支持新格式（对象）和旧格式（数组）
        if (Array.isArray(rowHeightsData)) {
          for (let i = 0; i < rowHeightsData.length && i < this.data.rowHeights.length; i++) {
            if (rowHeightsData[i]) {
              this.data.rowHeights[i] = rowHeightsData[i];
            }
          }
        } else {
          // 新格式：对象 { index: height }
          Object.entries(rowHeightsData).forEach(([index, height]) => {
            const i = parseInt(index);
            if (i >= 0 && i < this.data.rowHeights.length) {
              this.data.rowHeights[i] = height as number;
            }
          });
        }
      }

      if (colWidthsData) {
        // 支持新格式（对象）和旧格式（数组）
        if (Array.isArray(colWidthsData)) {
          for (let j = 0; j < colWidthsData.length && j < this.data.colWidths.length; j++) {
            if (colWidthsData[j]) {
              this.data.colWidths[j] = colWidthsData[j];
            }
          }
        } else {
          // 新格式：对象 { index: width }
          Object.entries(colWidthsData).forEach(([index, width]) => {
            const j = parseInt(index);
            if (j >= 0 && j < this.data.colWidths.length) {
              this.data.colWidths[j] = width as number;
            }
          });
        }
      }

      // 导入单元格数据
      if (data.cells && Array.isArray(data.cells)) {
        // 使用 Record 类型避免 any，cellData 为 JSON 反序列化的通用对象
        data.cells.forEach((cellData: Record<string, unknown>) => {
          const { row, col, content, formulaContent, rowSpan, colSpan, isMerged, mergeParent, fontColor, bgColor, fontSize, fontBold, fontItalic, fontUnderline, verticalAlign,
            // 数据类型与格式化新增字段（旧格式文件中不存在，默认 undefined）
            dataType, rawValue, format, richText, wrapText, validation
          } = cellData;

          if (this.isValidPosition(row as number, col as number)) {
            this.data.cells[row as number][col as number] = {
              content: (content as string) || '',
              formulaContent: formulaContent as string | undefined,
              rowSpan: (rowSpan as number) || 1,
              colSpan: (colSpan as number) || 1,
              isMerged: (isMerged as boolean) || false,
              mergeParent: mergeParent as { row: number; col: number } | undefined,
              fontColor: fontColor as string | undefined,
              bgColor: bgColor as string | undefined,
              fontSize: fontSize as number | undefined,
              fontBold: fontBold as boolean | undefined,
              fontItalic: fontItalic as boolean | undefined,
              fontUnderline: fontUnderline as boolean | undefined,
              verticalAlign: verticalAlign as 'top' | 'middle' | 'bottom' | undefined,
              // 反序列化数据类型与格式化字段（旧格式文件自动兼容，值为 undefined）
              dataType: dataType as Cell['dataType'],
              rawValue: rawValue as number | undefined,
              format: format as CellFormat | undefined,
              richText: richText as RichTextSegment[] | undefined,
              wrapText: wrapText as boolean | undefined,
              validation: validation as ValidationRule | undefined,
            };
          }
        });
      }

      // 反序列化条件格式规则（旧格式文件无此字段，默认空数组）
      const importedConditionalFormats = (data.conditionalFormats as ConditionalFormatRule[] | undefined) || [];
      this.conditionalFormats = importedConditionalFormats;

      // 重建条件格式引擎，同步导入的规则
      this.conditionalFormatEngine = new ConditionalFormatEngine();
      for (const rule of this.conditionalFormats) {
        this.conditionalFormatEngine.addRule(rule);
      }

      // 反序列化图表配置（旧格式文件无此字段，跳过）
      if (Array.isArray(data.charts)) {
        this.chartModel.deserialize(data.charts as unknown[]);
      } else if (data.charts !== undefined) {
        // charts 字段存在但不是数组，忽略并警告
        console.warn('导入数据中 charts 字段格式无效（非数组），已忽略图表数据');
      }

      // 重新计算所有公式
      this.recalculateFormulas();

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
    const simpleData: { [key: string]: { value: string; formula?: string } } = {};

    for (let i = 0; i < this.getRowCount(); i++) {
      for (let j = 0; j < this.getColCount(); j++) {
        const cell = this.data.cells[i][j];
        if (cell.content || cell.formulaContent) {
          // 使用 A1 格式的坐标
          const cellAddress = this.getCellAddress(i, j);
          if (cell.formulaContent) {
            simpleData[cellAddress] = {
              value: cell.content,
              formula: cell.formulaContent
            };
          } else {
            simpleData[cellAddress] = {
              value: cell.content
            };
          }
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
      Object.entries(simpleData).forEach(([cellAddress, data]) => {
        const position = this.parseCellAddress(cellAddress);
        if (position) {
          // 支持旧格式（字符串）和新格式（对象）
          if (typeof data === 'string') {
            this.setCellContentNoHistory(position.row, position.col, data);
          } else if (typeof data === 'object' && data !== null) {
            const cellData = data as { value: string; formula?: string };
            if (cellData.formula) {
              this.setCellContentNoHistory(position.row, position.col, cellData.formula);
            } else if (cellData.value) {
              this.setCellContentNoHistory(position.row, position.col, cellData.value);
            }
          }
        }
      });

      // 重新计算所有公式
      this.recalculateFormulas();

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
        // 撤销时使用 cells 数组恢复原始值，重做时使用范围应用新值
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].fontColor = cellData.color;
            }
          }
        } else if (data.startRow !== undefined && data.color !== undefined) {
          const minRow = Math.min(data.startRow, data.endRow);
          const maxRow = Math.max(data.startRow, data.endRow);
          const minCol = Math.min(data.startCol, data.endCol);
          const maxCol = Math.max(data.startCol, data.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              if (this.isValidPosition(r, c)) {
                this.data.cells[r][c].fontColor = data.color;
              }
            }
          }
        }
        break;
      case 'setBgColor':
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].bgColor = cellData.color;
            }
          }
        } else if (data.startRow !== undefined && data.color !== undefined) {
          const minRow = Math.min(data.startRow, data.endRow);
          const maxRow = Math.max(data.startRow, data.endRow);
          const minCol = Math.min(data.startCol, data.endCol);
          const maxCol = Math.max(data.startCol, data.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              if (this.isValidPosition(r, c)) {
                this.data.cells[r][c].bgColor = data.color;
              }
            }
          }
        }
        break;
      case 'setFontSize':
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].fontSize = cellData.size;
            }
          }
        } else if (data.startRow !== undefined && data.size !== undefined) {
          const minRow = Math.min(data.startRow, data.endRow);
          const maxRow = Math.max(data.startRow, data.endRow);
          const minCol = Math.min(data.startCol, data.endCol);
          const maxCol = Math.max(data.startCol, data.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              if (this.isValidPosition(r, c)) {
                this.data.cells[r][c].fontSize = data.size;
              }
            }
          }
        }
        break;
      case 'setFontBold':
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].fontBold = cellData.bold;
            }
          }
        } else if (data.startRow !== undefined && data.bold !== undefined) {
          const minRow = Math.min(data.startRow, data.endRow);
          const maxRow = Math.max(data.startRow, data.endRow);
          const minCol = Math.min(data.startCol, data.endCol);
          const maxCol = Math.max(data.startCol, data.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              if (this.isValidPosition(r, c)) {
                this.data.cells[r][c].fontBold = data.bold;
              }
            }
          }
        }
        break;
      case 'setFontItalic':
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].fontItalic = cellData.italic;
            }
          }
        } else if (data.startRow !== undefined && data.italic !== undefined) {
          const minRow = Math.min(data.startRow, data.endRow);
          const maxRow = Math.max(data.startRow, data.endRow);
          const minCol = Math.min(data.startCol, data.endCol);
          const maxCol = Math.max(data.startCol, data.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              if (this.isValidPosition(r, c)) {
                this.data.cells[r][c].fontItalic = data.italic;
              }
            }
          }
        }
        break;
      case 'setFontUnderline':
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].fontUnderline = cellData.underline;
            }
          }
        } else if (data.startRow !== undefined && data.underline !== undefined) {
          const minRow = Math.min(data.startRow, data.endRow);
          const maxRow = Math.max(data.startRow, data.endRow);
          const minCol = Math.min(data.startCol, data.endCol);
          const maxCol = Math.max(data.startCol, data.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              if (this.isValidPosition(r, c)) {
                this.data.cells[r][c].fontUnderline = data.underline;
              }
            }
          }
        }
        break;
      case 'setFontAlign':
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].fontAlign = cellData.align;
            }
          }
        } else if (data.startRow !== undefined && data.align !== undefined) {
          const minRow = Math.min(data.startRow, data.endRow);
          const maxRow = Math.max(data.startRow, data.endRow);
          const minCol = Math.min(data.startCol, data.endCol);
          const maxCol = Math.max(data.startCol, data.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              if (this.isValidPosition(r, c)) {
                this.data.cells[r][c].fontAlign = data.align;
              }
            }
          }
        }
        break;
      case 'setVerticalAlign':
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].verticalAlign = cellData.align;
            }
          }
        } else if (data.startRow !== undefined && data.align !== undefined) {
          const minRow = Math.min(data.startRow, data.endRow);
          const maxRow = Math.max(data.startRow, data.endRow);
          const minCol = Math.min(data.startCol, data.endCol);
          const maxCol = Math.max(data.startCol, data.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              if (this.isValidPosition(r, c)) {
                this.data.cells[r][c].verticalAlign = data.align;
              }
            }
          }
        }
        break;
      case 'mergeCells':
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              const cell = this.data.cells[cellData.row][cellData.col];
              cell.content = cellData.content;
              cell.rowSpan = cellData.rowSpan;
              cell.colSpan = cellData.colSpan;
              cell.isMerged = cellData.isMerged;
              if (cellData.mergeParent) {
                cell.mergeParent = cellData.mergeParent;
              } else {
                delete cell.mergeParent;
              }
            }
          }
        } else if (data.startRow !== undefined) {
          const { startRow, startCol, endRow, endCol, content } = data;
          const rowSpan = endRow - startRow + 1;
          const colSpan = endCol - startCol + 1;

          const parentCell = this.data.cells[startRow][startCol];
          parentCell.rowSpan = rowSpan;
          parentCell.colSpan = colSpan;
          parentCell.content = content;
          parentCell.isMerged = false;
          delete parentCell.mergeParent;

          for (let i = startRow; i <= endRow; i++) {
            for (let j = startCol; j <= endCol; j++) {
              if (i !== startRow || j !== startCol) {
                const cell = this.data.cells[i][j];
                cell.isMerged = true;
                cell.mergeParent = { row: startRow, col: startCol };
                cell.content = '';
              }
            }
          }
        }
        break;
      case 'splitCell':
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              const cell = this.data.cells[cellData.row][cellData.col];
              cell.content = cellData.content;
              cell.rowSpan = cellData.rowSpan;
              cell.colSpan = cellData.colSpan;
              cell.isMerged = cellData.isMerged;
              if (cellData.mergeParent) {
                cell.mergeParent = cellData.mergeParent;
              } else {
                delete cell.mergeParent;
              }
            }
          }
        } else if (data.row !== undefined) {
          const { row, col, rowSpan, colSpan, content } = data;
          const endRow = row + rowSpan - 1;
          const endCol = col + colSpan - 1;

          for (let i = row; i <= endRow; i++) {
            for (let j = col; j <= endCol; j++) {
              this.data.cells[i][j] = {
                content: i === row && j === col ? content : '',
                rowSpan: 1,
                colSpan: 1,
                isMerged: false,
                mergeParent: undefined
              };
            }
          }
        }
        break;
      case 'insertRows':
        if (data.rowIndex !== undefined && data.count !== undefined) {
          if (data.rowsToInsert && data.heightsToInsert) {
            this.data.cells.splice(data.rowIndex, 0, ...data.rowsToInsert);
            this.data.rowHeights.splice(data.rowIndex, 0, ...data.heightsToInsert);
          } else {
            const actualCount = Math.min(data.count, this.getRowCount() - data.rowIndex);
            if (actualCount > 0) {
              this.data.cells.splice(data.rowIndex, actualCount);
              this.data.rowHeights.splice(data.rowIndex, actualCount);
            }
          }
        }
        break;
      case 'deleteRows':
        if (data.deletedRows && data.deletedHeights) {
          this.data.cells.splice(data.rowIndex, 0, ...data.deletedRows);
          this.data.rowHeights.splice(data.rowIndex, 0, ...data.deletedHeights);
        } else if (data.rowIndex !== undefined && data.count !== undefined) {
          const actualCount = Math.min(data.count, this.getRowCount() - data.rowIndex);
          if (actualCount > 0) {
            this.data.cells.splice(data.rowIndex, actualCount);
            this.data.rowHeights.splice(data.rowIndex, actualCount);
          }
        }
        break;
      case 'clearContent':
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].content = cellData.content;
              this.contentCache[`${cellData.row}-${cellData.col}`] = cellData.content;
            }
          }
        } else if (data.startRow !== undefined) {
          const minRow = Math.min(data.startRow, data.endRow);
          const maxRow = Math.max(data.startRow, data.endRow);
          const minCol = Math.min(data.startCol, data.endCol);
          const maxCol = Math.max(data.startCol, data.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              if (this.isValidPosition(r, c)) {
                this.data.cells[r][c].content = '';
                this.contentCache[`${r}-${c}`] = '';
              }
            }
          }
        }
        break;
      case 'resizeRow':
        if (data.row !== undefined && data.height !== undefined) {
          if (data.row >= 0 && data.row < this.data.rowHeights.length) {
            this.data.rowHeights[data.row] = data.height;
          }
        }
        break;
      case 'resizeCol':
        if (data.col !== undefined && data.width !== undefined) {
          if (data.col >= 0 && data.col < this.data.colWidths.length) {
            this.data.colWidths[data.col] = data.width;
          }
        }
        break;
      case 'setFormat':
        // 撤销时使用 cells 数组恢复原始格式，重做时使用范围应用新格式
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              const cell = this.data.cells[cellData.row][cellData.col];
              cell.format = cellData.format;
              // 撤销时恢复 content、rawValue、dataType
              if (cellData.content !== undefined) {
                cell.content = cellData.content;
              }
              if (cellData.rawValue !== undefined) {
                cell.rawValue = cellData.rawValue;
              } else {
                cell.rawValue = undefined;
              }
              if (cellData.dataType !== undefined) {
                cell.dataType = cellData.dataType;
              } else {
                cell.dataType = undefined;
              }
            }
          }
        } else if (data.startRow !== undefined && data.format !== undefined) {
          const minRow = Math.min(data.startRow, data.endRow);
          const maxRow = Math.max(data.startRow, data.endRow);
          const minCol = Math.min(data.startCol, data.endCol);
          const maxCol = Math.max(data.startCol, data.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              if (this.isValidPosition(r, c)) {
                const cell = this.data.cells[r][c];
                cell.format = data.format;
                this.reformatCellContent(cell, data.format);
              }
            }
          }
        }
        break;
      case 'setWrapText':
        // 撤销时使用 cells 数组恢复原始换行设置，重做时使用范围应用
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].wrapText = cellData.wrapText;
            }
          }
        } else if (data.startRow !== undefined && data.wrapText !== undefined) {
          const minRow = Math.min(data.startRow, data.endRow);
          const maxRow = Math.max(data.startRow, data.endRow);
          const minCol = Math.min(data.startCol, data.endCol);
          const maxCol = Math.max(data.startCol, data.endCol);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              if (this.isValidPosition(r, c)) {
                this.data.cells[r][c].wrapText = data.wrapText;
              }
            }
          }
        }
        break;
      case 'setRichText':
        // 撤销/重做时使用 cells 数组恢复富文本内容
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].richText = cellData.richText;
            }
          }
        }
        break;
      case 'setValidation':
        // 撤销/重做时使用 cells 数组恢复验证规则
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.data.cells[cellData.row][cellData.col].validation = cellData.validation;
            }
          }
        }
        break;
      case 'setConditionalFormat':
        // 条件格式的撤销/重做：添加或移除规则
        if (data.action === 'add' && data.rule) {
          this.conditionalFormats.push(data.rule);
          this.conditionalFormatEngine.addRule(data.rule);
        } else if (data.action === 'remove' && data.ruleId) {
          this.conditionalFormats = this.conditionalFormats.filter((r) => r.id !== data.ruleId);
          this.conditionalFormatEngine.removeRule(data.ruleId);
        }
        break;
      case 'setSort':
      case 'setFilter':
        // 排序/筛选的撤销/重做：恢复快照
        this.sortFilterModel.restoreSnapshot(data);
        break;
      case 'dragMove':
        // 拖拽移动的撤销/重做：恢复源区域和目标区域的单元格数据
        if (data.sourceCells && Array.isArray(data.sourceCells)) {
          // 撤销：恢复源区域和目标区域的原始数据
          for (const cellData of data.sourceCells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              const writeContent = cellData.formulaContent ?? cellData.content;
              this.setCellContentNoHistory(cellData.row, cellData.col, writeContent);
            }
          }
          if (data.targetCells && Array.isArray(data.targetCells)) {
            for (const cellData of data.targetCells) {
              if (this.isValidPosition(cellData.row, cellData.col)) {
                const writeContent = cellData.formulaContent ?? cellData.content;
                this.setCellContentNoHistory(cellData.row, cellData.col, writeContent);
              }
            }
          }
        } else if (data.sourceStartRow !== undefined) {
          // 重做：重新执行移动操作
          const srcRows = data.sourceEndRow - data.sourceStartRow;
          const srcCols = data.sourceEndCol - data.sourceStartCol;
          const buf: string[][] = [];
          for (let r = data.sourceStartRow; r <= data.sourceEndRow; r++) {
            const rowBuf: string[] = [];
            for (let c = data.sourceStartCol; c <= data.sourceEndCol; c++) {
              const cell = this.getCell(r, c);
              rowBuf.push(cell?.formulaContent ?? cell?.content ?? '');
            }
            buf.push(rowBuf);
          }
          for (let r = data.sourceStartRow; r <= data.sourceEndRow; r++) {
            for (let c = data.sourceStartCol; c <= data.sourceEndCol; c++) {
              this.setCellContentNoHistory(r, c, '');
            }
          }
          for (let r = 0; r <= srcRows; r++) {
            for (let c = 0; c <= srcCols; c++) {
              this.setCellContentNoHistory(data.targetStartRow + r, data.targetStartCol + c, buf[r][c]);
            }
          }
        }
        break;
      case 'hideRows':
        // 切换隐藏状态：撤销时取消隐藏，重做时隐藏
        if (Array.isArray(data)) {
          for (const idx of data) {
            if (this.hiddenRows.has(idx)) {
              this.hiddenRows.delete(idx);
            } else {
              this.hiddenRows.add(idx);
            }
          }
        }
        break;
      case 'hideCols':
        if (Array.isArray(data)) {
          for (const idx of data) {
            if (this.hiddenCols.has(idx)) {
              this.hiddenCols.delete(idx);
            } else {
              this.hiddenCols.add(idx);
            }
          }
        }
        break;
      case 'unhideRows':
        // 切换：撤销时重新隐藏，重做时取消隐藏
        if (Array.isArray(data)) {
          for (const idx of data) {
            if (this.hiddenRows.has(idx)) {
              this.hiddenRows.delete(idx);
            } else {
              this.hiddenRows.add(idx);
            }
          }
        }
        break;
      case 'unhideCols':
        if (Array.isArray(data)) {
          for (const idx of data) {
            if (this.hiddenCols.has(idx)) {
              this.hiddenCols.delete(idx);
            } else {
              this.hiddenCols.add(idx);
            }
          }
        }
        break;
      case 'freeze':
        // 直接应用冻结配置（撤销时恢复旧值，重做时应用新值）
        if (data.rows !== undefined) {
          this.freezeRowCount = Math.max(0, data.rows);
        }
        if (data.cols !== undefined) {
          this.freezeColCount = Math.max(0, data.cols);
        }
        break;
      case 'createGroup':
        // 切换：撤销时移除分组，重做时创建分组
        if (data.groupType && data.start !== undefined && data.end !== undefined) {
          if (data.groupType === 'row') {
            // 尝试移除，如果不存在则创建
            if (!this.groupManager.removeGroup('row', data.start, data.end)) {
              this.groupManager.createRowGroup(data.start, data.end);
            }
          } else {
            if (!this.groupManager.removeGroup('col', data.start, data.end)) {
              this.groupManager.createColGroup(data.start, data.end);
            }
          }
        }
        break;
      case 'removeGroup':
        // 切换：撤销时创建分组，重做时移除分组
        if (data.groupType && data.start !== undefined && data.end !== undefined) {
          const existingGroup = this.groupManager.getGroupsAt(data.groupType, data.start)
            .find((g: RowColumnGroup) => g.start === data.start && g.end === data.end);

          if (existingGroup) {
            // 分组存在 → 移除（重做方向）
            // 如果之前是折叠状态，先取消隐藏
            if (data.wasCollapsed) {
              const indices: number[] = [];
              for (let i = data.start; i <= data.end; i++) {
                indices.push(i);
              }
              if (data.groupType === 'row') {
                this.unhideRows(indices);
              } else {
                this.unhideCols(indices);
              }
            }
            this.groupManager.removeGroup(data.groupType, data.start, data.end);
          } else {
            // 分组不存在 → 创建（撤销方向）
            if (data.groupType === 'row') {
              this.groupManager.createRowGroup(data.start, data.end);
            } else {
              this.groupManager.createColGroup(data.start, data.end);
            }
            // 如果之前是折叠状态，恢复折叠并隐藏
            if (data.wasCollapsed) {
              this.groupManager.collapseGroup(data.groupType, data.start, data.end);
              const indices: number[] = [];
              for (let i = data.start; i <= data.end; i++) {
                indices.push(i);
              }
              if (data.groupType === 'row') {
                this.hideRows(indices);
              } else {
                this.hideCols(indices);
              }
            }
          }
        }
        break;
      case 'collapseGroup':
        // 切换折叠/展开状态及隐藏行列
        if (data.groupType && data.start !== undefined && data.end !== undefined) {
          const groups = data.groupType === 'row'
            ? this.groupManager.getRowGroups()
            : this.groupManager.getColGroups();
          const group = groups.find((g: { start: number; end: number }) => g.start === data.start && g.end === data.end);
          if (group && group.collapsed) {
            // 当前已折叠 → 展开并取消隐藏
            this.groupManager.expandGroup(data.groupType, data.start, data.end);
            if (data.hiddenIndices && Array.isArray(data.hiddenIndices)) {
              if (data.groupType === 'row') {
                this.unhideRows(data.hiddenIndices);
              } else {
                this.unhideCols(data.hiddenIndices);
              }
            }
          } else {
            // 当前展开 → 折叠并隐藏
            this.groupManager.collapseGroup(data.groupType, data.start, data.end);
            if (data.hiddenIndices && Array.isArray(data.hiddenIndices)) {
              if (data.groupType === 'row') {
                this.hideRows(data.hiddenIndices);
              } else {
                this.hideCols(data.hiddenIndices);
              }
            }
          }
        }
        break;
      case 'expandGroup':
        // 切换展开/折叠状态及隐藏行列
        if (data.groupType && data.start !== undefined && data.end !== undefined) {
          const groups = data.groupType === 'row'
            ? this.groupManager.getRowGroups()
            : this.groupManager.getColGroups();
          const group = groups.find((g: { start: number; end: number }) => g.start === data.start && g.end === data.end);
          if (group && group.collapsed) {
            // 当前已折叠 → 展开并取消隐藏
            this.groupManager.expandGroup(data.groupType, data.start, data.end);
            if (data.hiddenIndices && Array.isArray(data.hiddenIndices)) {
              if (data.groupType === 'row') {
                this.unhideRows(data.hiddenIndices);
              } else {
                this.unhideCols(data.hiddenIndices);
              }
            }
          } else {
            // 当前展开 → 折叠并隐藏
            this.groupManager.collapseGroup(data.groupType, data.start, data.end);
            if (data.hiddenIndices && Array.isArray(data.hiddenIndices)) {
              if (data.groupType === 'row') {
                this.hideRows(data.hiddenIndices);
              } else {
                this.hideCols(data.hiddenIndices);
              }
            }
          }
        }
        break;
      case 'batchDeleteRows':
        // 撤销：undoData 包含 rows 数组，恢复已删除的行
        // 重做：data 只包含 indices，重新删除
        if (data.rows && Array.isArray(data.rows)) {
          // 撤销：按索引升序插入恢复行
          const sortedRows = [...data.rows].sort(
            (a: { index: number }, b: { index: number }) => a.index - b.index
          );
          for (const rowData of sortedRows) {
            this.data.cells.splice(rowData.index, 0, rowData.cells);
            this.data.rowHeights.splice(rowData.index, 0, rowData.height);
          }
          this.clearAllCache();
        } else if (data.indices && Array.isArray(data.indices)) {
          // 重做：逆序删除
          const sorted = [...data.indices].sort((a: number, b: number) => b - a);
          for (const idx of sorted) {
            if (idx >= 0 && idx < this.data.cells.length) {
              this.data.cells.splice(idx, 1);
              this.data.rowHeights.splice(idx, 1);
            }
          }
          this.clearAllCache();
        }
        break;
      case 'batchDeleteCols':
        // 撤销：undoData 包含 cols 数组，恢复已删除的列
        // 重做：data 只包含 indices，重新删除
        if (data.cols && Array.isArray(data.cols)) {
          // 撤销：按索引升序插入恢复列
          const sortedCols = [...data.cols].sort(
            (a: { index: number }, b: { index: number }) => a.index - b.index
          );
          for (const colData of sortedCols) {
            for (let r = 0; r < this.data.cells.length; r++) {
              this.data.cells[r].splice(colData.index, 0, colData.cells[r]);
            }
            this.data.colWidths.splice(colData.index, 0, colData.width);
          }
          this.clearAllCache();
        } else if (data.indices && Array.isArray(data.indices)) {
          // 重做：逆序删除
          const sorted = [...data.indices].sort((a: number, b: number) => b - a);
          for (const idx of sorted) {
            for (const row of this.data.cells) {
              if (idx < row.length) {
                row.splice(idx, 1);
              }
            }
            if (idx < this.data.colWidths.length) {
              this.data.colWidths.splice(idx, 1);
            }
          }
          this.clearAllCache();
        }
        break;
      case 'fill':
        // 撤销：undoData 是 [{row, col, oldContent}] 数组，恢复原始内容
        // 重做：data 包含 source/target/direction，重新执行填充
        if (Array.isArray(data)) {
          // 撤销：恢复原始单元格内容
          for (const cellData of data) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.setCellContentNoHistory(cellData.row, cellData.col, cellData.oldContent);
            }
          }
        } else if (data.source && data.target && data.direction) {
          // 重做：重新执行填充
          this.fillRange(
            data.source.startRow, data.source.startCol,
            data.source.endRow, data.source.endCol,
            data.target.startRow, data.target.startCol,
            data.target.endRow, data.target.endCol,
            data.direction
          );
        }
        break;
      case 'pasteSpecial':
        // 撤销：undoData.cells 包含原始单元格数据
        // 重做：data 包含粘贴参数，重新执行
        if (data.cells && Array.isArray(data.cells)) {
          // 撤销：恢复原始单元格内容和格式
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              const cell = this.data.cells[cellData.row][cellData.col];
              cell.content = cellData.content ?? '';
              if (cellData.fontBold !== undefined) cell.fontBold = cellData.fontBold;
              if (cellData.fontItalic !== undefined) cell.fontItalic = cellData.fontItalic;
              if (cellData.fontUnderline !== undefined) cell.fontUnderline = cellData.fontUnderline;
              if (cellData.fontSize !== undefined) cell.fontSize = cellData.fontSize;
              if (cellData.fontColor !== undefined) cell.fontColor = cellData.fontColor;
              if (cellData.bgColor !== undefined) cell.bgColor = cellData.bgColor;
              if (cellData.fontAlign !== undefined) cell.fontAlign = cellData.fontAlign;
              if (cellData.format !== undefined) cell.format = cellData.format;
              this.contentCache[`${cellData.row}-${cellData.col}`] = cell.content;
            }
          }
        }
        break;
      case 'replace':
        // 替换单个单元格：data/undoData 都是 {row, col, content}
        if (data.row !== undefined && data.col !== undefined && data.content !== undefined) {
          this.setCellContentNoHistory(data.row, data.col, data.content);
        }
        break;
      case 'replaceAll':
        // 全部替换：data/undoData 都是 {cells: [{row, col, content}]}
        if (data.cells && Array.isArray(data.cells)) {
          for (const cellData of data.cells) {
            if (this.isValidPosition(cellData.row, cellData.col)) {
              this.setCellContentNoHistory(cellData.row, cellData.col, cellData.content);
            }
          }
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

  // 设置关联的 HistoryManager（供 SheetManager 切换工作表时使用）
  public setHistoryManager(hm: HistoryManager): void {
    this.historyManager = hm;
  }

  // 获取内部 SpreadsheetData 引用（供 SheetManager 保存/恢复数据）
  public getData(): SpreadsheetData {
    return this.data;
  }

  // ============================================================
  // 格式设置方法
  // ============================================================

  /**
   * 根据格式重新格式化单元格内容
   * 当单元格有 rawValue 时，使用对应的格式化器更新 content 显示字符串
   */
  private reformatCellContent(cell: Cell, format: CellFormat): void {
    if (cell.rawValue === undefined) {
      return;
    }

    const { category, pattern, currencySymbol } = format;

    // 数字相关格式：使用 NumberFormatter
    if (category === 'number' || category === 'currency' || category === 'percentage' || category === 'scientific') {
      if (category === 'currency' && currencySymbol) {
        cell.content = NumberFormatter.formatCurrency(cell.rawValue, currencySymbol);
      } else {
        cell.content = NumberFormatter.format(cell.rawValue, pattern);
      }
      return;
    }

    // 日期/时间格式：使用 DateFormatter
    if (category === 'date' || category === 'time' || category === 'datetime') {
      cell.content = DateFormatter.format(cell.rawValue, pattern);
      return;
    }

    // 常规格式：如果有 rawValue，直接转为字符串
    if (category === 'general') {
      cell.content = String(cell.rawValue);
    }
  }

  // 设置单元格格式
  public setCellFormat(row: number, col: number, format: CellFormat): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];

    // 如果是被合并的单元格，则设置合并父单元格的格式
    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      const targetCell = this.data.cells[parentRow][parentCol];
      const oldFormat = targetCell.format ? { ...targetCell.format } : undefined;
      const oldContent = targetCell.content;
      const oldRawValue = targetCell.rawValue;
      const oldDataType = targetCell.dataType;

      this.historyManager.record({
        type: 'setFormat',
        data: { cells: [{ row: parentRow, col: parentCol, format }] },
        undoData: { cells: [{ row: parentRow, col: parentCol, format: oldFormat, content: oldContent, rawValue: oldRawValue, dataType: oldDataType }] }
      });

      targetCell.format = format;
      targetCell.isAutoFormat = undefined;
      this.reformatCellContent(targetCell, format);
    } else {
      const oldFormat = cell.format ? { ...cell.format } : undefined;
      const oldContent = cell.content;
      const oldRawValue = cell.rawValue;
      const oldDataType = cell.dataType;

      this.historyManager.record({
        type: 'setFormat',
        data: { cells: [{ row, col, format }] },
        undoData: { cells: [{ row, col, format: oldFormat, content: oldContent, rawValue: oldRawValue, dataType: oldDataType }] }
      });

      cell.format = format;
      cell.isAutoFormat = undefined;
      this.reformatCellContent(cell, format);
    }

    this.isDirty = true;
  }

  // 设置区域格式
  public setRangeFormat(startRow: number, startCol: number, endRow: number, endCol: number, format: CellFormat): void {
    if (!this.isValidRange(startRow, startCol, endRow, endCol)) {
      return;
    }

    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();
    // 收集旧值用于撤销
    const undoCells: { row: number; col: number; format: CellFormat | undefined; content: string; rawValue: number | undefined; dataType: string | undefined }[] = [];

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            const targetCell = this.data.cells[parentRow][parentCol];
            undoCells.push({
              row: parentRow, col: parentCol,
              format: targetCell.format ? { ...targetCell.format } : undefined,
              content: targetCell.content,
              rawValue: targetCell.rawValue,
              dataType: targetCell.dataType
            });
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            undoCells.push({
              row: i, col: j,
              format: cell.format ? { ...cell.format } : undefined,
              content: cell.content,
              rawValue: cell.rawValue,
              dataType: cell.dataType
            });
            processedCells.add(key);
          }
        }
      }
    }

    // 记录历史
    this.historyManager.record({
      type: 'setFormat',
      data: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol, format },
      undoData: { cells: undoCells }
    });

    // 应用格式
    processedCells.clear();
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            const targetCell = this.data.cells[parentRow][parentCol];
            targetCell.format = format;
            targetCell.isAutoFormat = undefined;
            this.reformatCellContent(targetCell, format);
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            cell.format = format;
            cell.isAutoFormat = undefined;
            this.reformatCellContent(cell, format);
            processedCells.add(key);
          }
        }
      }
    }

    this.isDirty = true;
  }

  // 清除单元格格式（恢复为常规）
  public clearCellFormat(row: number, col: number): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];
    let targetCell = cell;

    // 如果是被合并的单元格，清除合并父单元格的格式
    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      targetCell = this.data.cells[parentRow][parentCol];
    }

    // 如果有 rawValue，将其转回字符串作为 content
    if (targetCell.rawValue !== undefined) {
      targetCell.content = String(targetCell.rawValue);
    }
    targetCell.format = undefined;
    targetCell.isAutoFormat = undefined;
    targetCell.dataType = undefined;
    targetCell.rawValue = undefined;

    this.isDirty = true;
  }

  // 清除区域格式（恢复为常规）
  public clearRangeFormat(startRow: number, startCol: number, endRow: number, endCol: number): void {
    if (!this.isValidRange(startRow, startCol, endRow, endCol)) {
      return;
    }

    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            const targetCell = this.data.cells[parentRow][parentCol];
            if (targetCell.rawValue !== undefined) {
              targetCell.content = String(targetCell.rawValue);
            }
            targetCell.format = undefined;
            targetCell.isAutoFormat = undefined;
            targetCell.dataType = undefined;
            targetCell.rawValue = undefined;
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            if (cell.rawValue !== undefined) {
              cell.content = String(cell.rawValue);
            }
            cell.format = undefined;
            cell.isAutoFormat = undefined;
            cell.dataType = undefined;
            cell.rawValue = undefined;
            processedCells.add(key);
          }
        }
      }
    }

    this.isDirty = true;
  }

  // 设置单元格自动换行
  public setCellWrapText(row: number, col: number, wrap: boolean): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];

    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      const oldWrap = this.data.cells[parentRow][parentCol].wrapText || false;

      this.historyManager.record({
        type: 'setWrapText',
        data: { cells: [{ row: parentRow, col: parentCol, wrapText: wrap }] },
        undoData: { cells: [{ row: parentRow, col: parentCol, wrapText: oldWrap }] }
      });

      this.data.cells[parentRow][parentCol].wrapText = wrap;
    } else {
      const oldWrap = cell.wrapText || false;

      this.historyManager.record({
        type: 'setWrapText',
        data: { cells: [{ row, col, wrapText: wrap }] },
        undoData: { cells: [{ row, col, wrapText: oldWrap }] }
      });

      cell.wrapText = wrap;
    }

    this.isDirty = true;
  }

  // 设置区域自动换行
  public setRangeWrapText(startRow: number, startCol: number, endRow: number, endCol: number, wrap: boolean): void {
    if (!this.isValidRange(startRow, startCol, endRow, endCol)) {
      return;
    }

    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const processedCells = new Set<string>();
    // 收集旧值用于撤销
    const undoCells: { row: number; col: number; wrapText: boolean }[] = [];

    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            undoCells.push({ row: parentRow, col: parentCol, wrapText: this.data.cells[parentRow][parentCol].wrapText || false });
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            undoCells.push({ row: i, col: j, wrapText: cell.wrapText || false });
            processedCells.add(key);
          }
        }
      }
    }

    // 记录历史
    this.historyManager.record({
      type: 'setWrapText',
      data: { startRow: minRow, startCol: minCol, endRow: maxRow, endCol: maxCol, wrapText: wrap },
      undoData: { cells: undoCells }
    });

    // 应用换行设置
    processedCells.clear();
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        const cell = this.data.cells[i][j];

        if (cell.isMerged && cell.mergeParent) {
          const { row: parentRow, col: parentCol } = cell.mergeParent;
          const key = `${parentRow}-${parentCol}`;
          if (!processedCells.has(key)) {
            this.data.cells[parentRow][parentCol].wrapText = wrap;
            processedCells.add(key);
          }
        } else {
          const key = `${i}-${j}`;
          if (!processedCells.has(key)) {
            cell.wrapText = wrap;
            processedCells.add(key);
          }
        }
      }
    }

    this.isDirty = true;
  }

  // 设置单元格富文本
  public setCellRichText(row: number, col: number, richText: RichTextSegment[]): void {
      if (!this.isValidPosition(row, col)) {
        return;
      }

      const cell = this.data.cells[row][col];

      // 优化：当所有片段样式完全相同时，合并为普通 content 存储
      const optimized = this.optimizeRichText(richText);

      if (cell.isMerged && cell.mergeParent) {
        const { row: parentRow, col: parentCol } = cell.mergeParent;
        const targetCell = this.data.cells[parentRow][parentCol];
        const oldRichText = targetCell.richText ? targetCell.richText.map((s) => ({ ...s })) : undefined;

        this.historyManager.record({
          type: 'setRichText',
          data: { cells: [{ row: parentRow, col: parentCol, richText: optimized.richText }] },
          undoData: { cells: [{ row: parentRow, col: parentCol, richText: oldRichText }] }
        });

        if (optimized.merged) {
          // 所有片段样式相同，合并为普通 content
          targetCell.content = optimized.content;
          targetCell.richText = undefined;
        } else {
          targetCell.richText = optimized.richText;
        }
      } else {
        const oldRichText = cell.richText ? cell.richText.map((s) => ({ ...s })) : undefined;

        this.historyManager.record({
          type: 'setRichText',
          data: { cells: [{ row, col, richText: optimized.richText }] },
          undoData: { cells: [{ row, col, richText: oldRichText }] }
        });

        if (optimized.merged) {
          // 所有片段样式相同，合并为普通 content
          cell.content = optimized.content;
          cell.richText = undefined;
        } else {
          cell.richText = optimized.richText;
        }
      }

      this.isDirty = true;
    }

  /**
   * 优化富文本：当所有片段样式完全相同时，合并为普通文本
   * 比较的样式属性：fontBold、fontItalic、fontUnderline、fontColor、fontSize
   */
  private optimizeRichText(segments: RichTextSegment[]): {
    merged: boolean;
    content: string;
    richText: RichTextSegment[] | undefined;
  } {
    // 空数组直接合并为普通文本
    if (segments.length === 0) {
      return { merged: true, content: '', richText: undefined };
    }

    // 以第一个片段的样式为基准，比较所有片段
    const baseStyle = segments[0];
    const allSameStyle = segments.every((segment) =>
      (segment.fontBold ?? false) === (baseStyle.fontBold ?? false) &&
      (segment.fontItalic ?? false) === (baseStyle.fontItalic ?? false) &&
      (segment.fontUnderline ?? false) === (baseStyle.fontUnderline ?? false) &&
      (segment.fontColor ?? '') === (baseStyle.fontColor ?? '') &&
      (segment.fontSize ?? 0) === (baseStyle.fontSize ?? 0)
    );

    if (allSameStyle) {
      // 所有片段样式相同，拼接文本内容
      const mergedContent = segments.map((s) => s.text).join('');
      return { merged: true, content: mergedContent, richText: undefined };
    }

    // 样式不同，保持富文本格式
    return { merged: false, content: '', richText: segments };
  }

  // 设置单元格数据验证规则
  public setCellValidation(row: number, col: number, rule: ValidationRule | undefined): void {
    if (!this.isValidPosition(row, col)) {
      return;
    }

    const cell = this.data.cells[row][col];

    if (cell.isMerged && cell.mergeParent) {
      const { row: parentRow, col: parentCol } = cell.mergeParent;
      const targetCell = this.data.cells[parentRow][parentCol];
      const oldRule = targetCell.validation ? { ...targetCell.validation } : undefined;

      this.historyManager.record({
        type: 'setValidation',
        data: { cells: [{ row: parentRow, col: parentCol, validation: rule }] },
        undoData: { cells: [{ row: parentRow, col: parentCol, validation: oldRule }] }
      });

      targetCell.validation = rule;
    } else {
      const oldRule = cell.validation ? { ...cell.validation } : undefined;

      this.historyManager.record({
        type: 'setValidation',
        data: { cells: [{ row, col, validation: rule }] },
        undoData: { cells: [{ row, col, validation: oldRule }] }
      });

      cell.validation = rule;
    }

    this.isDirty = true;
  }

  // ============================================================
  // 行高自动调整
  // ============================================================

  // 自动调整行高以适应换行文本
  public autoFitRowHeight(row: number): void {
    if (row < 0 || row >= this.data.rowHeights.length) {
      return;
    }

    const colCount = this.getColCount();
    let maxHeight = DEFAULT_ROW_HEIGHT;

    // 创建临时 Canvas 上下文用于文本测量
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    for (let col = 0; col < colCount; col++) {
      const cell = this.data.cells[row][col];

      // 跳过被合并的子单元格
      if (cell.isMerged && cell.mergeParent) {
        continue;
      }

      // 仅处理 wrapText=true 的单元格
      if (!cell.wrapText) {
        continue;
      }

      const content = cell.content;
      if (!content) {
        continue;
      }

      // 计算单元格可用宽度（考虑合并单元格）
      let cellWidth = 0;
      for (let c = col; c < col + cell.colSpan; c++) {
        cellWidth += this.getColWidth(c);
      }
      // 减去内边距
      const padding = 8;
      const availableWidth = cellWidth - padding * 2;

      if (availableWidth <= 0) {
        continue;
      }

      // 设置字体用于测量
      const fontSize = cell.fontSize || this.fontSize;
      ctx.font = `${cell.fontBold ? 'bold ' : ''}${cell.fontItalic ? 'italic ' : ''}${fontSize}px Arial`;

      const lineHeight = fontSize + 4;

      // 按换行符分割段落，再按宽度自动换行
      const paragraphs = content.split('\n');
      let totalLines = 0;

      for (const paragraph of paragraphs) {
        if (paragraph === '') {
          totalLines += 1;
          continue;
        }

        // 逐字符测量，按宽度换行
        let currentLine = '';
        let lines = 0;

        for (let i = 0; i < paragraph.length; i++) {
          const testLine = currentLine + paragraph[i];
          const metrics = ctx.measureText(testLine);

          if (metrics.width > availableWidth && currentLine !== '') {
            lines += 1;
            currentLine = paragraph[i];
          } else {
            currentLine = testLine;
          }
        }
        // 最后一行
        if (currentLine !== '') {
          lines += 1;
        }

        totalLines += lines;
      }

      // 计算所需高度
      const requiredHeight = totalLines * lineHeight + padding * 2;
      if (requiredHeight > maxHeight) {
        maxHeight = requiredHeight;
      }
    }

    // 更新行高（不记录历史，由调用方决定是否记录）
    if (maxHeight > this.data.rowHeights[row]) {
      this.data.rowHeights[row] = maxHeight;
      this.isDirty = true;
    }
  }

  /**
   * 添加条件格式规则
   * 规则存储在 Model 级别，同时同步到条件格式引擎
   */
  public addConditionalFormat(rule: ConditionalFormatRule): void {
    // 记录历史，撤销时移除该规则
    this.historyManager.record({
      type: 'setConditionalFormat',
      data: { action: 'add', rule },
      undoData: { action: 'remove', ruleId: rule.id }
    });

    this.conditionalFormats.push(rule);
    this.conditionalFormatEngine.addRule(rule);
    this.isDirty = true;
  }

  /**
   * 移除指定 ID 的条件格式规则
   */
  public removeConditionalFormat(ruleId: string): void {
    // 找到要移除的规则，用于撤销时恢复
    const removedRule = this.conditionalFormats.find((r) => r.id === ruleId);
    if (removedRule) {
      this.historyManager.record({
        type: 'setConditionalFormat',
        data: { action: 'remove', ruleId },
        undoData: { action: 'add', rule: { ...removedRule } }
      });
    }

    this.conditionalFormats = this.conditionalFormats.filter((r) => r.id !== ruleId);
    this.conditionalFormatEngine.removeRule(ruleId);
    this.isDirty = true;
  }

  /**
   * 获取所有条件格式规则（只读副本）
   */
  public getConditionalFormats(): ConditionalFormatRule[] {
    return [...this.conditionalFormats];
  }

  /**
   * 获取条件格式引擎实例（供渲染器使用）
   */
  public getConditionalFormatEngine(): ConditionalFormatEngine {
    return this.conditionalFormatEngine;
  }

  // ============================================================
  // 分组管理（委托给 GroupManager）
  // ============================================================

  /** 创建行分组 */
  public createRowGroup(startRow: number, endRow: number): boolean {
    return this.groupManager.createRowGroup(startRow, endRow);
  }

  /** 创建列分组 */
  public createColGroup(startCol: number, endCol: number): boolean {
    return this.groupManager.createColGroup(startCol, endCol);
  }

  /** 移除分组 */
  public removeGroup(type: 'row' | 'col', start: number, end: number): boolean {
    return this.groupManager.removeGroup(type, start, end);
  }

  /** 折叠分组 */
  public collapseGroup(type: 'row' | 'col', start: number, end: number): void {
    this.groupManager.collapseGroup(type, start, end);
  }

  /** 展开分组 */
  public expandGroup(type: 'row' | 'col', start: number, end: number): void {
    this.groupManager.expandGroup(type, start, end);
  }

  /** 获取指定位置的分组信息 */
  public getGroupsAt(type: 'row' | 'col', index: number): RowColumnGroup[] {
    return this.groupManager.getGroupsAt(type, index);
  }

  /** 获取最大嵌套层级 */
  public getMaxGroupLevel(type: 'row' | 'col'): number {
    return this.groupManager.getMaxLevel(type);
  }

  /** 获取所有行分组 */
  public getRowGroups(): RowColumnGroup[] {
    return this.groupManager.getRowGroups();
  }

  /** 获取所有列分组 */
  public getColGroups(): RowColumnGroup[] {
    return this.groupManager.getColGroups();
  }

  // ============================================================
  // 填充操作
  // ============================================================

  /**
   * 填充指定范围
   * @param sourceStartRow 源区域起始行
   * @param sourceStartCol 源区域起始列
   * @param sourceEndRow 源区域结束行
   * @param sourceEndCol 源区域结束列
   * @param targetStartRow 目标区域起始行
   * @param targetStartCol 目标区域起始列
   * @param targetEndRow 目标区域结束行
   * @param targetEndCol 目标区域结束列
   * @param direction 填充方向
   */
  public fillRange(
    sourceStartRow: number, sourceStartCol: number,
    sourceEndRow: number, sourceEndCol: number,
    targetStartRow: number, targetStartCol: number,
    targetEndRow: number, targetEndCol: number,
    direction: FillDirection
  ): void {
    // 保存目标区域原始数据用于撤销
    const undoData: { row: number; col: number; oldContent: string }[] = [];

    if (direction === 'down' || direction === 'up') {
      // 按列填充
      for (let col = sourceStartCol; col <= sourceEndCol; col++) {
        // 收集源列数据
        const sourceValues: string[] = [];
        for (let row = sourceStartRow; row <= sourceEndRow; row++) {
          sourceValues.push(this.getCell(row, col)?.content || '');
        }

        const pattern = FillSeriesEngine.inferPattern(sourceValues);
        const targetCount = targetEndRow - targetStartRow + 1;
        const fillValues = FillSeriesEngine.generate(pattern, targetCount, direction);

        // 写入目标单元格
        for (let i = 0; i < fillValues.length; i++) {
          const targetRow = targetStartRow + i;
          undoData.push({
            row: targetRow,
            col,
            oldContent: this.getCell(targetRow, col)?.content || ''
          });
          this.setCellContentNoHistory(targetRow, col, fillValues[i]);
        }
      }
    } else {
      // 按行填充（left/right）
      for (let row = sourceStartRow; row <= sourceEndRow; row++) {
        const sourceValues: string[] = [];
        for (let col = sourceStartCol; col <= sourceEndCol; col++) {
          sourceValues.push(this.getCell(row, col)?.content || '');
        }

        const pattern = FillSeriesEngine.inferPattern(sourceValues);
        const targetCount = targetEndCol - targetStartCol + 1;
        const fillValues = FillSeriesEngine.generate(pattern, targetCount, direction);

        for (let i = 0; i < fillValues.length; i++) {
          const targetCol = targetStartCol + i;
          undoData.push({
            row,
            col: targetCol,
            oldContent: this.getCell(row, targetCol)?.content || ''
          });
          this.setCellContentNoHistory(row, targetCol, fillValues[i]);
        }
      }
    }

    // 记录历史
    this.historyManager.record({
      type: 'fill',
      data: {
        source: { startRow: sourceStartRow, startCol: sourceStartCol, endRow: sourceEndRow, endCol: sourceEndCol },
        target: { startRow: targetStartRow, startCol: targetStartCol, endRow: targetEndRow, endCol: targetEndCol },
        direction
      },
      undoData
    });

    this.isDirty = true;
  }

}
