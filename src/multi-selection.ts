import type { Selection, CellPosition } from './types';

/**
 * 多选区管理器
 * 管理多个选区的状态，支持添加、清除、全选等操作
 */
export class MultiSelectionManager {
  /** 所有选区列表 */
  private selections: Selection[];
  /** 当前活动选区索引 */
  private activeIndex: number;
  /** 是否处于全选状态 */
  private _isSelectAll: boolean;

  constructor() {
    this.selections = [];
    this.activeIndex = -1;
    this._isSelectAll = false;
  }

  /** 清除所有选区，设置单选区 */
  public setSingle(selection: Selection): void {
    this.selections = [selection];
    this.activeIndex = 0;
    this._isSelectAll = false;
  }

  /** 添加一个新选区（Ctrl+点击） */
  public addSelection(selection: Selection): void {
    this.selections.push(selection);
    this.activeIndex = this.selections.length - 1;
    this._isSelectAll = false;
  }

  /** 获取所有选区 */
  public getSelections(): Selection[] {
    return this.selections;
  }

  /** 获取当前活动选区 */
  public getActiveSelection(): Selection | null {
    if (this.activeIndex >= 0 && this.activeIndex < this.selections.length) {
      return this.selections[this.activeIndex];
    }
    return null;
  }

  /** 获取所有选区覆盖的单元格位置集合 */
  public getAllCells(): CellPosition[] {
    const cells: CellPosition[] = [];
    for (const sel of this.selections) {
      const minRow = Math.min(sel.startRow, sel.endRow);
      const maxRow = Math.max(sel.startRow, sel.endRow);
      const minCol = Math.min(sel.startCol, sel.endCol);
      const maxCol = Math.max(sel.startCol, sel.endCol);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          cells.push({ row: r, col: c });
        }
      }
    }
    return cells;
  }

  /** 判断指定单元格是否在任意选区内 */
  public containsCell(row: number, col: number): boolean {
    return this.selections.some((sel) => {
      const minRow = Math.min(sel.startRow, sel.endRow);
      const maxRow = Math.max(sel.startRow, sel.endRow);
      const minCol = Math.min(sel.startCol, sel.endCol);
      const maxCol = Math.max(sel.startCol, sel.endCol);
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
    });
  }

  /** 清除所有选区 */
  public clear(): void {
    this.selections = [];
    this.activeIndex = -1;
    this._isSelectAll = false;
  }

  /** 获取选区数量 */
  public getCount(): number {
    return this.selections.length;
  }

  /** 设置全选 */
  public selectAll(maxRow: number, maxCol: number): void {
    this.selections = [{ startRow: 0, startCol: 0, endRow: maxRow, endCol: maxCol }];
    this.activeIndex = 0;
    this._isSelectAll = true;
  }

  /** 判断是否为全选状态 */
  public isSelectAll(): boolean {
    return this._isSelectAll;
  }
}
