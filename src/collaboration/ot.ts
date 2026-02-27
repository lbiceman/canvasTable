import {
  CollabOperation,
  CellEditOp,
  CellMergeOp,
  CellSplitOp,
  RowInsertOp,
  RowDeleteOp,
  RowResizeOp,
  FontColorOp,
  BgColorOp,
} from './types';

// ============================================================
// 辅助函数
// ============================================================

/**
 * 深拷贝操作对象
 */
const cloneOp = <T extends CollabOperation>(op: T): T => {
  return JSON.parse(JSON.stringify(op)) as T;
};

/**
 * 判断行是否在删除范围内
 */
const isRowInDeleteRange = (row: number, deleteOp: RowDeleteOp): boolean => {
  return row >= deleteOp.rowIndex && row < deleteOp.rowIndex + deleteOp.count;
};

// ============================================================
// 行索引调整函数（针对 RowInsert）
// ============================================================

/**
 * 根据行插入操作调整行索引
 */
const adjustRowForInsert = (row: number, insertOp: RowInsertOp): number => {
  if (row >= insertOp.rowIndex) {
    return row + insertOp.count;
  }
  return row;
};

/**
 * 根据行删除操作调整行索引，返回 null 表示该行被删除
 */
const adjustRowForDelete = (row: number, deleteOp: RowDeleteOp): number | null => {
  if (isRowInDeleteRange(row, deleteOp)) {
    return null; // 行被删除
  }
  if (row >= deleteOp.rowIndex + deleteOp.count) {
    return row - deleteOp.count;
  }
  return row;
};

// ============================================================
// 具体操作类型 vs RowInsert 的转换
// ============================================================

const transformCellEditVsRowInsert = (
  op: CellEditOp,
  insertOp: RowInsertOp
): CellEditOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformCellMergeVsRowInsert = (
  op: CellMergeOp,
  insertOp: RowInsertOp
): CellMergeOp => {
  const result = cloneOp(op);
  result.startRow = adjustRowForInsert(op.startRow, insertOp);
  result.endRow = adjustRowForInsert(op.endRow, insertOp);
  return result;
};

const transformCellSplitVsRowInsert = (
  op: CellSplitOp,
  insertOp: RowInsertOp
): CellSplitOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformRowResizeVsRowInsert = (
  op: RowResizeOp,
  insertOp: RowInsertOp
): RowResizeOp => {
  const result = cloneOp(op);
  result.rowIndex = adjustRowForInsert(op.rowIndex, insertOp);
  return result;
};

const transformFontColorVsRowInsert = (
  op: FontColorOp,
  insertOp: RowInsertOp
): FontColorOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformBgColorVsRowInsert = (
  op: BgColorOp,
  insertOp: RowInsertOp
): BgColorOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

// ============================================================
// 具体操作类型 vs RowDelete 的转换
// ============================================================

const transformCellEditVsRowDelete = (
  op: CellEditOp,
  deleteOp: RowDeleteOp
): CellEditOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null; // 编辑的行被删除，操作变为空操作
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformCellMergeVsRowDelete = (
  op: CellMergeOp,
  deleteOp: RowDeleteOp
): CellMergeOp | null => {
  const newStartRow = adjustRowForDelete(op.startRow, deleteOp);
  const newEndRow = adjustRowForDelete(op.endRow, deleteOp);
  // 如果合并区域的任一端被删除，整个合并操作变为空操作
  if (newStartRow === null || newEndRow === null) return null;
  const result = cloneOp(op);
  result.startRow = newStartRow;
  result.endRow = newEndRow;
  return result;
};

const transformCellSplitVsRowDelete = (
  op: CellSplitOp,
  deleteOp: RowDeleteOp
): CellSplitOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformRowResizeVsRowDelete = (
  op: RowResizeOp,
  deleteOp: RowDeleteOp
): RowResizeOp | null => {
  const newRow = adjustRowForDelete(op.rowIndex, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.rowIndex = newRow;
  return result;
};

const transformFontColorVsRowDelete = (
  op: FontColorOp,
  deleteOp: RowDeleteOp
): FontColorOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformBgColorVsRowDelete = (
  op: BgColorOp,
  deleteOp: RowDeleteOp
): BgColorOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

// ============================================================
// RowInsert vs RowInsert / RowDelete 的转换
// ============================================================

const transformRowInsertVsRowInsert = (
  opA: RowInsertOp,
  opB: RowInsertOp
): RowInsertOp => {
  const result = cloneOp(opA);
  if (opA.rowIndex > opB.rowIndex) {
    result.rowIndex = opA.rowIndex + opB.count;
  } else if (opA.rowIndex === opB.rowIndex) {
    // 相同位置插入，按 userId 排序决定优先级
    if (opA.userId > opB.userId) {
      result.rowIndex = opA.rowIndex + opB.count;
    }
  }
  return result;
};

const transformRowInsertVsRowDelete = (
  insertOp: RowInsertOp,
  deleteOp: RowDeleteOp
): RowInsertOp => {
  const result = cloneOp(insertOp);
  if (insertOp.rowIndex > deleteOp.rowIndex) {
    // 插入位置在删除范围之后
    const deleteEnd = deleteOp.rowIndex + deleteOp.count;
    if (insertOp.rowIndex >= deleteEnd) {
      result.rowIndex = insertOp.rowIndex - deleteOp.count;
    } else {
      // 插入位置在删除范围内，调整到删除起始位置
      result.rowIndex = deleteOp.rowIndex;
    }
  }
  return result;
};

const transformRowDeleteVsRowInsert = (
  deleteOp: RowDeleteOp,
  insertOp: RowInsertOp
): RowDeleteOp => {
  const result = cloneOp(deleteOp);
  if (deleteOp.rowIndex >= insertOp.rowIndex) {
    result.rowIndex = deleteOp.rowIndex + insertOp.count;
  }
  return result;
};

const transformRowDeleteVsRowDelete = (
  opA: RowDeleteOp,
  opB: RowDeleteOp
): RowDeleteOp | null => {
  const aStart = opA.rowIndex;
  const aEnd = opA.rowIndex + opA.count;
  const bStart = opB.rowIndex;
  const bEnd = opB.rowIndex + opB.count;

  // 完全不重叠
  if (aEnd <= bStart) {
    // A 在 B 之前，不受影响
    return cloneOp(opA);
  }
  if (aStart >= bEnd) {
    // A 在 B 之后，调整索引
    const result = cloneOp(opA);
    result.rowIndex = opA.rowIndex - opB.count;
    return result;
  }

  // 有重叠
  if (aStart >= bStart && aEnd <= bEnd) {
    // A 完全被 B 包含，变为空操作
    return null;
  }

  if (aStart < bStart && aEnd > bEnd) {
    // A 包含 B，减少删除数量
    const result = cloneOp(opA);
    result.count = opA.count - opB.count;
    return result;
  }

  if (aStart < bStart) {
    // A 的前部分不重叠
    const result = cloneOp(opA);
    result.count = bStart - aStart;
    return result;
  }

  // A 的后部分不重叠
  const result = cloneOp(opA);
  result.rowIndex = bStart;
  result.count = aEnd - bEnd;
  return result;
};

// ============================================================
// CellEdit vs CellEdit 的转换
// ============================================================

const transformCellEditVsCellEdit = (
  opA: CellEditOp,
  opB: CellEditOp
): CellEditOp => {
  const result = cloneOp(opA);
  // 同一单元格的编辑冲突
  if (opA.row === opB.row && opA.col === opB.col) {
    // 后到达的操作覆盖，但更新 previousContent 以保持链
    result.previousContent = opB.content;
  }
  return result;
};

// ============================================================
// CellMerge 相关转换
// ============================================================

const transformCellEditVsCellMerge = (
  editOp: CellEditOp,
  mergeOp: CellMergeOp
): CellEditOp => {
  const result = cloneOp(editOp);
  // 如果编辑位置在合并范围内，调整目标为合并后的父单元格
  if (
    editOp.row >= mergeOp.startRow &&
    editOp.row <= mergeOp.endRow &&
    editOp.col >= mergeOp.startCol &&
    editOp.col <= mergeOp.endCol
  ) {
    result.row = mergeOp.startRow;
    result.col = mergeOp.startCol;
  }
  return result;
};

const transformCellMergeVsCellMerge = (
  opA: CellMergeOp,
  opB: CellMergeOp
): CellMergeOp | null => {
  // 检查两个合并区域是否重叠
  const overlaps =
    opA.startRow <= opB.endRow &&
    opA.endRow >= opB.startRow &&
    opA.startCol <= opB.endCol &&
    opA.endCol >= opB.startCol;

  if (overlaps) {
    // 重叠的合并操作，先到达的优先，后到达的变为空操作
    return null;
  }
  return cloneOp(opA);
};

// ============================================================
// 核心 transform 函数
// ============================================================

/**
 * 将操作转换为针对另一个操作的等效操作。
 * 返回 null 表示该操作在转换后变为空操作（应被丢弃）。
 *
 * 核心不变量：对于任意两个并发操作 A 和 B，
 * apply(apply(state, A), transform(B, A)) === apply(apply(state, B), transform(A, B))
 */
const transformSingle = (
  opA: CollabOperation,
  opB: CollabOperation
): CollabOperation | null => {
  // 如果两个操作完全独立（不涉及行变化且不涉及相同单元格），直接返回
  // 列宽调整不影响任何其他操作
  if (opA.type === 'colResize' || opB.type === 'colResize') {
    return cloneOp(opA);
  }

  // ---- opB 是 RowInsert ----
  if (opB.type === 'rowInsert') {
    switch (opA.type) {
      case 'cellEdit':
        return transformCellEditVsRowInsert(opA, opB);
      case 'cellMerge':
        return transformCellMergeVsRowInsert(opA, opB);
      case 'cellSplit':
        return transformCellSplitVsRowInsert(opA, opB);
      case 'rowInsert':
        return transformRowInsertVsRowInsert(opA, opB);
      case 'rowDelete':
        return transformRowDeleteVsRowInsert(opA, opB);
      case 'rowResize':
        return transformRowResizeVsRowInsert(opA, opB);
      case 'fontColor':
        return transformFontColorVsRowInsert(opA, opB);
      case 'bgColor':
        return transformBgColorVsRowInsert(opA, opB);
    }
  }

  // ---- opB 是 RowDelete ----
  if (opB.type === 'rowDelete') {
    switch (opA.type) {
      case 'cellEdit':
        return transformCellEditVsRowDelete(opA, opB);
      case 'cellMerge':
        return transformCellMergeVsRowDelete(opA, opB);
      case 'cellSplit':
        return transformCellSplitVsRowDelete(opA, opB);
      case 'rowInsert':
        return transformRowInsertVsRowDelete(opA, opB);
      case 'rowDelete':
        return transformRowDeleteVsRowDelete(opA, opB);
      case 'rowResize':
        return transformRowResizeVsRowDelete(opA, opB);
      case 'fontColor':
        return transformFontColorVsRowDelete(opA, opB);
      case 'bgColor':
        return transformBgColorVsRowDelete(opA, opB);
    }
  }

  // ---- opB 是 CellEdit ----
  if (opB.type === 'cellEdit') {
    switch (opA.type) {
      case 'cellEdit':
        return transformCellEditVsCellEdit(opA, opB);
      default:
        // 其他操作类型不受单元格编辑影响
        return cloneOp(opA);
    }
  }

  // ---- opB 是 CellMerge ----
  if (opB.type === 'cellMerge') {
    switch (opA.type) {
      case 'cellEdit':
        return transformCellEditVsCellMerge(opA, opB);
      case 'cellMerge':
        return transformCellMergeVsCellMerge(opA, opB);
      case 'fontColor': {
        // 如果颜色操作在合并范围内，调整到父单元格
        const result = cloneOp(opA);
        if (
          opA.row >= opB.startRow &&
          opA.row <= opB.endRow &&
          opA.col >= opB.startCol &&
          opA.col <= opB.endCol
        ) {
          result.row = opB.startRow;
          result.col = opB.startCol;
        }
        return result;
      }
      case 'bgColor': {
        const result = cloneOp(opA);
        if (
          opA.row >= opB.startRow &&
          opA.row <= opB.endRow &&
          opA.col >= opB.startCol &&
          opA.col <= opB.endCol
        ) {
          result.row = opB.startRow;
          result.col = opB.startCol;
        }
        return result;
      }
      default:
        return cloneOp(opA);
    }
  }

  // ---- opB 是 CellSplit ----
  if (opB.type === 'cellSplit') {
    // 拆分操作不影响其他操作的行列索引
    return cloneOp(opA);
  }

  // ---- opB 是 RowResize ----
  if (opB.type === 'rowResize') {
    // 行高调整不影响其他操作
    return cloneOp(opA);
  }

  // ---- opB 是 FontColor / BgColor ----
  if (opB.type === 'fontColor' || opB.type === 'bgColor') {
    // 颜色操作不影响其他操作
    return cloneOp(opA);
  }

  // 默认：不转换
  return cloneOp(opA);
};

// ============================================================
// 公开 API
// ============================================================

/**
 * OT 转换函数：返回转换后的操作对 [a', b']
 * 满足：apply(apply(state, a), b') === apply(apply(state, b), a')
 *
 * 如果某个操作在转换后变为空操作，返回 null
 */
export const transform = (
  opA: CollabOperation,
  opB: CollabOperation
): [CollabOperation | null, CollabOperation | null] => {
  const aPrime = transformSingle(opA, opB);
  const bPrime = transformSingle(opB, opA);
  return [aPrime, bPrime];
};

/**
 * 对操作列表执行转换：将 op 依次针对 ops 中的每个操作进行转换
 * 返回转换后的操作，如果操作被消除则返回 null
 */
export const transformAgainst = (
  op: CollabOperation,
  ops: CollabOperation[]
): CollabOperation | null => {
  let current: CollabOperation | null = op;

  for (const other of ops) {
    if (current === null) return null;
    const [transformed] = transform(current, other);
    current = transformed;
  }

  return current;
};

// ============================================================
// invertOperation - 生成反向操作（用于撤销）
// ============================================================

/**
 * 模型查询接口，用于获取生成反向操作所需的当前状态信息。
 * 避免直接依赖 SpreadsheetModel 类，保持模块解耦。
 */
export interface ModelReader {
  getCell(row: number, col: number): { content: string; rowSpan: number; colSpan: number; fontColor?: string; bgColor?: string } | null;
  getRowHeight(row: number): number;
  getColWidth(col: number): number;
}

/**
 * 为给定操作生成反向操作。
 * 反向操作应用后能撤销原操作的效果。
 *
 * 不变量：对于任意操作 op 和状态 S，
 * apply(apply(S, op), invertOperation(op, S)) === S
 */
export const invertOperation = (
  op: CollabOperation,
  model: ModelReader
): CollabOperation => {
  switch (op.type) {
    case 'cellEdit': {
      // 反向操作：将内容恢复为 previousContent
      return {
        ...op,
        content: op.previousContent,
        previousContent: op.content,
        timestamp: Date.now(),
      };
    }

    case 'cellMerge': {
      // 反向操作：拆分合并的单元格（拆分左上角）
      return {
        type: 'cellSplit',
        userId: op.userId,
        timestamp: Date.now(),
        revision: op.revision,
        row: op.startRow,
        col: op.startCol,
      };
    }

    case 'cellSplit': {
      // 反向操作：重新合并。需要从模型获取原始合并范围。
      // 由于拆分后单元格已经是 1x1，我们只能恢复为最小合并（自身）
      // 实际使用中，协同引擎会在操作历史中保存完整的合并信息
      const cell = model.getCell(op.row, op.col);
      if (cell && (cell.rowSpan > 1 || cell.colSpan > 1)) {
        return {
          type: 'cellMerge',
          userId: op.userId,
          timestamp: Date.now(),
          revision: op.revision,
          startRow: op.row,
          startCol: op.col,
          endRow: op.row + cell.rowSpan - 1,
          endCol: op.col + cell.colSpan - 1,
        };
      }
      // 如果单元格已经是 1x1，返回一个无效的合并（自身到自身），
      // 应用时不会产生效果
      return {
        type: 'cellMerge',
        userId: op.userId,
        timestamp: Date.now(),
        revision: op.revision,
        startRow: op.row,
        startCol: op.col,
        endRow: op.row,
        endCol: op.col,
      };
    }

    case 'rowInsert': {
      // 反向操作：删除插入的行
      return {
        type: 'rowDelete',
        userId: op.userId,
        timestamp: Date.now(),
        revision: op.revision,
        rowIndex: op.rowIndex,
        count: op.count,
      };
    }

    case 'rowDelete': {
      // 反向操作：在相同位置插入行
      return {
        type: 'rowInsert',
        userId: op.userId,
        timestamp: Date.now(),
        revision: op.revision,
        rowIndex: op.rowIndex,
        count: op.count,
      };
    }

    case 'rowResize': {
      // 反向操作：恢复原始行高
      const currentHeight = model.getRowHeight(op.rowIndex);
      return {
        ...op,
        height: currentHeight,
        timestamp: Date.now(),
      };
    }

    case 'colResize': {
      // 反向操作：恢复原始列宽
      const currentWidth = model.getColWidth(op.colIndex);
      return {
        ...op,
        width: currentWidth,
        timestamp: Date.now(),
      };
    }

    case 'fontColor': {
      // 反向操作：恢复原始字体颜色
      const cell = model.getCell(op.row, op.col);
      return {
        ...op,
        color: cell?.fontColor ?? '',
        timestamp: Date.now(),
      };
    }

    case 'bgColor': {
      // 反向操作：恢复原始背景颜色
      const cell = model.getCell(op.row, op.col);
      return {
        ...op,
        color: cell?.bgColor ?? '',
        timestamp: Date.now(),
      };
    }
  }
};
