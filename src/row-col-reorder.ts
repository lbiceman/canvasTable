import { SpreadsheetModel } from './model';
import { HistoryManager } from './history-manager';
import { Cell } from './types';

/**
 * 拖拽状态接口
 * 记录当前拖拽操作的类型、源索引、目标位置和鼠标坐标
 */
export interface ReorderDragState {
  type: 'row' | 'col';
  sourceIndices: number[];    // 被拖拽的行/列索引（支持多选）
  targetIndex: number;        // 目标插入位置
  currentMousePos: number;    // 当前鼠标位置（用于渲染指示线）
}

/**
 * 行列拖拽重排序引擎
 * 负责拖拽行/列到新位置的数据迁移与历史记录
 */
export class RowColReorder {
  private model: SpreadsheetModel;
  private historyManager: HistoryManager;
  private dragState: ReorderDragState | null = null;

  constructor(model: SpreadsheetModel, historyManager: HistoryManager) {
    this.model = model;
    this.historyManager = historyManager;
  }

  /**
   * 开始行拖拽
   * @param rowIndices 被拖拽的行索引数组
   * @param mouseY 鼠标 Y 坐标
   */
  public startRowDrag(rowIndices: number[], mouseY: number): void {
    if (rowIndices.length === 0) return;

    // 排序索引，确保顺序一致
    const sorted = [...rowIndices].sort((a, b) => a - b);

    this.dragState = {
      type: 'row',
      sourceIndices: sorted,
      targetIndex: sorted[0],
      currentMousePos: mouseY,
    };
  }

  /**
   * 开始列拖拽
   * @param colIndices 被拖拽的列索引数组
   * @param mouseX 鼠标 X 坐标
   */
  public startColDrag(colIndices: number[], mouseX: number): void {
    if (colIndices.length === 0) return;

    // 排序索引，确保顺序一致
    const sorted = [...colIndices].sort((a, b) => a - b);

    this.dragState = {
      type: 'col',
      sourceIndices: sorted,
      targetIndex: sorted[0],
      currentMousePos: mouseX,
    };
  }

  /**
   * 更新拖拽位置
   * 根据鼠标位置计算目标行/列索引
   * @param mouseX 鼠标 X 坐标
   * @param mouseY 鼠标 Y 坐标
   */
  public updateDrag(mouseX: number, mouseY: number): void {
    if (!this.dragState) return;

    if (this.dragState.type === 'row') {
      this.dragState.currentMousePos = mouseY;
      this.dragState.targetIndex = this.calcTargetRowIndex(mouseY);
    } else {
      this.dragState.currentMousePos = mouseX;
      this.dragState.targetIndex = this.calcTargetColIndex(mouseX);
    }
  }

  /**
   * 根据鼠标 Y 坐标计算目标行索引
   * 遍历行高累加，找到鼠标所在的行
   */
  private calcTargetRowIndex(mouseY: number): number {
    const rowCount = this.model.getRowCount();
    let accumulatedHeight = 0;

    for (let i = 0; i < rowCount; i++) {
      const rowHeight = this.model.getRowHeight(i);
      accumulatedHeight += rowHeight;
      if (mouseY < accumulatedHeight) {
        return Math.max(0, Math.min(i, rowCount - 1));
      }
    }

    // 超出范围，限制到最后一行
    return rowCount - 1;
  }

  /**
   * 根据鼠标 X 坐标计算目标列索引
   * 遍历列宽累加，找到鼠标所在的列
   */
  private calcTargetColIndex(mouseX: number): number {
    const colCount = this.model.getColCount();
    let accumulatedWidth = 0;

    for (let i = 0; i < colCount; i++) {
      const colWidth = this.model.getColWidth(i);
      accumulatedWidth += colWidth;
      if (mouseX < accumulatedWidth) {
        return Math.max(0, Math.min(i, colCount - 1));
      }
    }

    // 超出范围，限制到最后一列
    return colCount - 1;
  }

  /**
   * 结束拖拽并执行重排序
   * @returns 是否执行了实际的移动操作
   */
  public endDrag(): boolean {
    if (!this.dragState) return false;

    const { type, sourceIndices, targetIndex } = this.dragState;

    // 检查目标位置是否与源位置相同（拖拽到原始位置不执行操作）
    if (this.isTargetSameAsSource(sourceIndices, targetIndex)) {
      this.dragState = null;
      return false;
    }

    if (type === 'row') {
      this.moveRows(sourceIndices, targetIndex);
    } else {
      this.moveCols(sourceIndices, targetIndex);
    }

    this.dragState = null;
    return true;
  }

  /**
   * 取消拖拽，清除拖拽状态
   */
  public cancelDrag(): void {
    this.dragState = null;
  }

  /**
   * 获取当前拖拽状态（供渲染器绘制指示线）
   */
  public getDragState(): ReorderDragState | null {
    return this.dragState;
  }

  /**
   * 判断目标位置是否与源位置相同
   * 如果目标在源索引范围内，视为未移动
   */
  private isTargetSameAsSource(sourceIndices: number[], targetIndex: number): boolean {
    return sourceIndices.includes(targetIndex);
  }

  /**
   * 移动行到目标位置
   * 算法：
   * 1. 提取源行数据（单元格 + 行高）
   * 2. 从原始位置移除源行
   * 3. 计算移除后的调整目标索引
   * 4. 在目标位置插入提取的行
   * 5. 记录历史操作
   *
   * @param sourceIndices 源行索引数组（已排序）
   * @param targetIndex 目标插入位置
   */
  public moveRows(sourceIndices: number[], targetIndex: number): void {
    const sorted = [...sourceIndices].sort((a, b) => a - b);
    const data = this.model.getData();
    const cells = data.cells;
    const rowHeights = data.rowHeights;

    // 1. 提取源行数据（按排序顺序，保持相对顺序）
    const extractedRows: Cell[][] = sorted.map((idx) => cells[idx]);
    const extractedHeights: number[] = sorted.map((idx) => rowHeights[idx]);

    // 2. 从原始位置移除源行（从后往前删除，避免索引偏移）
    for (let i = sorted.length - 1; i >= 0; i--) {
      cells.splice(sorted[i], 1);
      rowHeights.splice(sorted[i], 1);
    }

    // 3. 计算调整后的目标索引
    // 移除源行后，目标索引需要减去在目标之前被移除的行数
    let adjustedTarget = targetIndex;
    for (const srcIdx of sorted) {
      if (srcIdx < targetIndex) {
        adjustedTarget--;
      }
    }

    // 限制在有效范围内
    adjustedTarget = Math.max(0, Math.min(adjustedTarget, cells.length));

    // 4. 在目标位置插入提取的行
    cells.splice(adjustedTarget, 0, ...extractedRows);
    rowHeights.splice(adjustedTarget, 0, ...extractedHeights);

    // 5. 记录历史操作
    this.historyManager.record({
      type: 'reorderRows',
      data: { sourceIndices: sorted, targetIndex },
      undoData: { sourceIndices: sorted, targetIndex },
    });
  }

  /**
   * 移动列到目标位置
   * 算法：
   * 1. 对每一行，提取源列的单元格数据
   * 2. 从每一行中移除源列单元格
   * 3. 计算调整后的目标索引
   * 4. 在每一行的目标位置插入提取的单元格
   * 5. 同步移动列宽
   * 6. 记录历史操作
   *
   * @param sourceIndices 源列索引数组（已排序）
   * @param targetIndex 目标插入位置
   */
  public moveCols(sourceIndices: number[], targetIndex: number): void {
    const sorted = [...sourceIndices].sort((a, b) => a - b);
    const data = this.model.getData();
    const cells = data.cells;
    const colWidths = data.colWidths;

    // 1 & 2. 对每一行，提取并移除源列单元格
    for (let rowIdx = 0; rowIdx < cells.length; rowIdx++) {
      const row = cells[rowIdx];

      // 提取源列单元格（按排序顺序）
      const extractedCells: Cell[] = sorted.map((colIdx) => row[colIdx]);

      // 从后往前移除源列单元格
      for (let i = sorted.length - 1; i >= 0; i--) {
        row.splice(sorted[i], 1);
      }

      // 3. 计算调整后的目标索引
      let adjustedTarget = targetIndex;
      for (const srcIdx of sorted) {
        if (srcIdx < targetIndex) {
          adjustedTarget--;
        }
      }

      // 限制在有效范围内
      adjustedTarget = Math.max(0, Math.min(adjustedTarget, row.length));

      // 4. 在目标位置插入提取的单元格
      row.splice(adjustedTarget, 0, ...extractedCells);
    }

    // 5. 同步移动列宽
    const extractedWidths: number[] = sorted.map((colIdx) => colWidths[colIdx]);

    // 从后往前移除源列宽
    for (let i = sorted.length - 1; i >= 0; i--) {
      colWidths.splice(sorted[i], 1);
    }

    // 计算调整后的目标索引
    let adjustedColTarget = targetIndex;
    for (const srcIdx of sorted) {
      if (srcIdx < targetIndex) {
        adjustedColTarget--;
      }
    }
    adjustedColTarget = Math.max(0, Math.min(adjustedColTarget, colWidths.length));

    // 插入列宽
    colWidths.splice(adjustedColTarget, 0, ...extractedWidths);

    // 6. 记录历史操作
    this.historyManager.record({
      type: 'reorderCols',
      data: { sourceIndices: sorted, targetIndex },
      undoData: { sourceIndices: sorted, targetIndex },
    });
  }
}
