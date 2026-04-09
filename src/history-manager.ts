// ============================================================
// 历史记录管理器
// 使用 discriminated union 为常用 ActionType 定义类型安全的数据接口
// ============================================================

import type { Cell, CellBorder, EmbeddedImage } from './types';

// ============================================================
// 常用操作的数据接口定义
// ============================================================

/** 单元格位置与内容（setCellContent） */
export interface SetCellContentData {
  row: number;
  col: number;
  content?: string;
  comment?: string;
  formulaContent?: string;
}

/** 合并单元格数据（mergeCells） */
export interface MergeCellsData {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  content?: string;
}

/** 合并/拆分操作的撤销数据 */
export interface CellsSnapshotData {
  cells: Partial<Cell>[][];
}

/** 拆分单元格数据（splitCell） */
export interface SplitCellData {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  content?: string;
}

/** 范围样式操作数据（setFontColor / setBgColor 等） */
export interface RangeStyleData {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  color?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: string;
  verticalAlign?: string;
  fontFamily?: string;
  strikethrough?: boolean;
}

/** 范围样式撤销数据（保存每个单元格的旧值） */
export interface RangeStyleUndoData {
  cells: Array<{
    row: number;
    col: number;
    color?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: string;
    verticalAlign?: string;
    fontFamily?: string;
    strikethrough?: boolean;
  }>;
}

/** 清除内容数据（clearContent） */
export interface ClearContentData {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/** 行操作数据（insertRows / deleteRows） */
export interface RowOperationData {
  rowIndex: number;
  count?: number;
  rows?: Partial<Cell>[][];
  rowHeights?: number[];
}

/** 边框操作数据（setBorder） */
export interface SetBorderData {
  cells: Array<{
    row: number;
    col: number;
    border: CellBorder | undefined;
  }>;
}

/** 内嵌图片操作数据（setEmbeddedImage） */
export interface SetEmbeddedImageData {
  row: number;
  col: number;
  image: EmbeddedImage | undefined;
}

// ============================================================
// Discriminated Union 定义
// ============================================================

/** 常用操作类型的 discriminated union */
export type HistoryAction =
  | { type: 'setCellContent'; data: SetCellContentData; undoData: SetCellContentData }
  | { type: 'mergeCells'; data: MergeCellsData; undoData: CellsSnapshotData }
  | { type: 'splitCell'; data: SplitCellData; undoData: CellsSnapshotData }
  | { type: 'setFontColor'; data: RangeStyleData; undoData: RangeStyleUndoData }
  | { type: 'setBgColor'; data: RangeStyleData; undoData: RangeStyleUndoData }
  | { type: 'clearContent'; data: ClearContentData; undoData: CellsSnapshotData }
  | { type: 'insertRows'; data: RowOperationData; undoData: RowOperationData }
  | { type: 'deleteRows'; data: RowOperationData; undoData: RowOperationData }
  | { type: 'setBorder'; data: SetBorderData; undoData: SetBorderData }
  | { type: 'setEmbeddedImage'; data: SetEmbeddedImageData; undoData: SetEmbeddedImageData }
  // 通用 fallback：不常用的操作类型使用 unknown 数据
  | { type: FallbackActionType; data: unknown; undoData: unknown };

/** 不常用的操作类型（使用通用 fallback 接口） */
export type FallbackActionType =
  | 'setFontSize'
  | 'setFontBold'
  | 'setFontItalic'
  | 'setFontUnderline'
  | 'setFontAlign'
  | 'setVerticalAlign'
  | 'resizeRow'
  | 'resizeCol'
  | 'setFormat'
  | 'setWrapText'
  | 'setRichText'
  | 'setValidation'
  | 'setConditionalFormat'
  | 'setSort'
  | 'setFilter'
  | 'batchDeleteRows'
  | 'batchDeleteCols'
  | 'hideRows'
  | 'hideCols'
  | 'unhideRows'
  | 'unhideCols'
  | 'createGroup'
  | 'removeGroup'
  | 'collapseGroup'
  | 'expandGroup'
  | 'freeze'
  | 'fill'
  | 'dragMove'
  | 'pasteSpecial'
  | 'replace'
  | 'replaceAll'
  | 'setHyperlink'
  | 'removeHyperlink'
  | 'formatPainter'
  | 'reorderRows'
  | 'reorderCols'
  | 'clearFormat'
  | 'scriptExecution'
  | 'setFontFamily'
  | 'setStrikethrough';

/** 所有操作类型的联合（保持向后兼容） */
export type ActionType = HistoryAction['type'];

/**
 * 历史操作数据类型（向后兼容别名）
 * @deprecated 使用 HistoryAction 的 discriminated union 替代
 */
export type HistoryActionData = unknown;

// 历史记录管理器
export class HistoryManager {
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];
  private maxHistory: number = 100;
  private isRecording: boolean = true;
  private storageKey: string = 'spreadsheet-history';
  private isLoaded: boolean = false;

  constructor() {
    this.loadFromStorage();
  }

  // 从本地存储加载历史记录
  private loadFromStorage(): void {
    try {
      const savedUndo = localStorage.getItem(`${this.storageKey}-undo`);
      const savedRedo = localStorage.getItem(`${this.storageKey}-redo`);
      
      if (savedUndo) {
        this.undoStack = JSON.parse(savedUndo);
      }
      if (savedRedo) {
        this.redoStack = JSON.parse(savedRedo);
      }
      this.isLoaded = true;
    } catch (e) {
      console.warn('Failed to load history from storage:', e);
      this.undoStack = [];
      this.redoStack = [];
    }
  }

  // 保存到本地存储
  private saveToStorage(): void {
    try {
      localStorage.setItem(`${this.storageKey}-undo`, JSON.stringify(this.undoStack));
      localStorage.setItem(`${this.storageKey}-redo`, JSON.stringify(this.redoStack));
    } catch (e) {
      console.warn('Failed to save history to storage:', e);
    }
  }

  // 清除存储的历史记录
  public clearStorage(): void {
    try {
      localStorage.removeItem(`${this.storageKey}-undo`);
      localStorage.removeItem(`${this.storageKey}-redo`);
    } catch (e) {
      console.warn('Failed to clear history storage:', e);
    }
  }

  // 记录操作
  public record(action: HistoryAction): void {
    if (!this.isRecording) return;

    this.undoStack.push(action);

    // 新操作会清空重做栈
    this.redoStack = [];

    // 限制历史记录数量
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    // 持久化存储
    if (this.isLoaded) {
      this.saveToStorage();
    }
  }

  // 是否可以撤销
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  // 是否可以重做
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // 获取撤销操作
  public getUndoAction(): HistoryAction | null {
    const action = this.undoStack.pop();
    if (action) {
      this.redoStack.push(action);
      // 持久化存储
      if (this.isLoaded) {
        this.saveToStorage();
      }
    }
    return action || null;
  }

  // 获取重做操作
  public getRedoAction(): HistoryAction | null {
    const action = this.redoStack.pop();
    if (action) {
      this.undoStack.push(action);
      // 持久化存储
      if (this.isLoaded) {
        this.saveToStorage();
      }
    }
    return action || null;
  }

  // 暂停记录
  public pauseRecording(): void {
    this.isRecording = false;
  }

  // 恢复记录
  public resumeRecording(): void {
    this.isRecording = true;
  }

  // 清空历史
  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    // 清除持久化存储
    if (this.isLoaded) {
      this.clearStorage();
    }
  }

  // 获取撤销栈长度
  public getUndoCount(): number {
    return this.undoStack.length;
  }

  // 获取重做栈长度
  public getRedoCount(): number {
    return this.redoStack.length;
  }
}
