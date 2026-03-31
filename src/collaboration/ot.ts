import {
  CollabOperation,
  CellEditOp,
  CellMergeOp,
  CellSplitOp,
  RowInsertOp,
  RowDeleteOp,
  RowResizeOp,
  ColInsertOp,
  ColDeleteOp,
  ColResizeOp,
  FontColorOp,
  BgColorOp,
  FontSizeOp,
  FontBoldOp,
  FontItalicOp,
  FontUnderlineOp,
  FontAlignOp,
  VerticalAlignOp,
  SetBorderOp,
  SetFontFamilyOp,
  SetStrikethroughOp,
  CellBorder,
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
 * 判断位置是否在拆分区域内
 */
const isInSplitRange = (
  row: number,
  col: number,
  splitOp: CellSplitOp
): boolean => {
  const rowSpan = splitOp.rowSpan ?? 1;
  const colSpan = splitOp.colSpan ?? 1;
  const endRow = splitOp.row + rowSpan - 1;
  const endCol = splitOp.col + colSpan - 1;
  return row >= splitOp.row && row <= endRow &&
         col >= splitOp.col && col <= endCol;
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
// 列索引调整函数（针对 ColInsert / ColDelete）
// ============================================================

/**
 * 判断列是否在删除范围内
 */
const isColInDeleteRange = (col: number, deleteOp: ColDeleteOp): boolean => {
  return col >= deleteOp.colIndex && col < deleteOp.colIndex + deleteOp.count;
};

/**
 * 根据列插入操作调整列索引
 */
const adjustColForInsert = (col: number, insertOp: ColInsertOp): number => {
  if (col >= insertOp.colIndex) {
    return col + insertOp.count;
  }
  return col;
};

/**
 * 根据列删除操作调整列索引，返回 null 表示该列被删除
 */
const adjustColForDelete = (col: number, deleteOp: ColDeleteOp): number | null => {
  if (isColInDeleteRange(col, deleteOp)) {
    return null; // 列被删除
  }
  if (col >= deleteOp.colIndex + deleteOp.count) {
    return col - deleteOp.count;
  }
  return col;
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

const transformFontSizeVsRowInsert = (
  op: FontSizeOp,
  insertOp: RowInsertOp
): FontSizeOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformFontBoldVsRowInsert = (
  op: FontBoldOp,
  insertOp: RowInsertOp
): FontBoldOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformFontItalicVsRowInsert = (
  op: FontItalicOp,
  insertOp: RowInsertOp
): FontItalicOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformFontUnderlineVsRowInsert = (
  op: FontUnderlineOp,
  insertOp: RowInsertOp
): FontUnderlineOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformFontAlignVsRowInsert = (
  op: FontAlignOp,
  insertOp: RowInsertOp
): FontAlignOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformVerticalAlignVsRowInsert = (
  op: VerticalAlignOp,
  insertOp: RowInsertOp
): VerticalAlignOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformSetBorderVsRowInsert = (
  op: SetBorderOp,
  insertOp: RowInsertOp
): SetBorderOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformSetFontFamilyVsRowInsert = (
  op: SetFontFamilyOp,
  insertOp: RowInsertOp
): SetFontFamilyOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformSetStrikethroughVsRowInsert = (
  op: SetStrikethroughOp,
  insertOp: RowInsertOp
): SetStrikethroughOp => {
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

const transformFontSizeVsRowDelete = (
  op: FontSizeOp,
  deleteOp: RowDeleteOp
): FontSizeOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformFontBoldVsRowDelete = (
  op: FontBoldOp,
  deleteOp: RowDeleteOp
): FontBoldOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformFontItalicVsRowDelete = (
  op: FontItalicOp,
  deleteOp: RowDeleteOp
): FontItalicOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformFontUnderlineVsRowDelete = (
  op: FontUnderlineOp,
  deleteOp: RowDeleteOp
): FontUnderlineOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformFontAlignVsRowDelete = (
  op: FontAlignOp,
  deleteOp: RowDeleteOp
): FontAlignOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformVerticalAlignVsRowDelete = (
  op: VerticalAlignOp,
  deleteOp: RowDeleteOp
): VerticalAlignOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformSetBorderVsRowDelete = (
  op: SetBorderOp,
  deleteOp: RowDeleteOp
): SetBorderOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformSetFontFamilyVsRowDelete = (
  op: SetFontFamilyOp,
  deleteOp: RowDeleteOp
): SetFontFamilyOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformSetStrikethroughVsRowDelete = (
  op: SetStrikethroughOp,
  deleteOp: RowDeleteOp
): SetStrikethroughOp | null => {
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
// 具体操作类型 vs ColInsert 的转换
// ============================================================

const transformCellEditVsColInsert = (
  op: CellEditOp,
  insertOp: ColInsertOp
): CellEditOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

const transformCellMergeVsColInsert = (
  op: CellMergeOp,
  insertOp: ColInsertOp
): CellMergeOp => {
  const result = cloneOp(op);
  if (op.startCol >= insertOp.colIndex) {
    // 合并区域完全在插入点右侧，整体右移
    result.startCol = op.startCol + insertOp.count;
    result.endCol = op.endCol + insertOp.count;
  } else if (op.endCol < insertOp.colIndex) {
    // 合并区域完全在插入点左侧，不变
  } else {
    // 插入点穿过合并区域（startCol < colIndex <= endCol），仅 endCol 增加
    result.endCol = op.endCol + insertOp.count;
  }
  return result;
};

const transformCellSplitVsColInsert = (
  op: CellSplitOp,
  insertOp: ColInsertOp
): CellSplitOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  // rowSpan/colSpan 是历史快照，不受列插入影响
  return result;
};

const transformColResizeVsColInsert = (
  op: ColResizeOp,
  insertOp: ColInsertOp
): ColResizeOp => {
  const result = cloneOp(op);
  result.colIndex = adjustColForInsert(op.colIndex, insertOp);
  return result;
};

const transformColInsertVsColInsert = (
  opA: ColInsertOp,
  opB: ColInsertOp
): ColInsertOp => {
  const result = cloneOp(opA);
  if (opA.colIndex > opB.colIndex) {
    result.colIndex = opA.colIndex + opB.count;
  }
  // opA.colIndex <= opB.colIndex 时不变
  return result;
};

const transformColDeleteVsColInsert = (
  opA: ColDeleteOp,
  opB: ColInsertOp
): ColDeleteOp => {
  const result = cloneOp(opA);
  if (opA.colIndex > opB.colIndex) {
    result.colIndex = opA.colIndex + opB.count;
  }
  // opA.colIndex <= opB.colIndex 时不变
  return result;
};

const transformFontColorVsColInsert = (
  op: FontColorOp,
  insertOp: ColInsertOp
): FontColorOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

const transformBgColorVsColInsert = (
  op: BgColorOp,
  insertOp: ColInsertOp
): BgColorOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

const transformFontSizeVsColInsert = (
  op: FontSizeOp,
  insertOp: ColInsertOp
): FontSizeOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

const transformFontBoldVsColInsert = (
  op: FontBoldOp,
  insertOp: ColInsertOp
): FontBoldOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

const transformFontItalicVsColInsert = (
  op: FontItalicOp,
  insertOp: ColInsertOp
): FontItalicOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

const transformFontUnderlineVsColInsert = (
  op: FontUnderlineOp,
  insertOp: ColInsertOp
): FontUnderlineOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

const transformFontAlignVsColInsert = (
  op: FontAlignOp,
  insertOp: ColInsertOp
): FontAlignOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

const transformVerticalAlignVsColInsert = (
  op: VerticalAlignOp,
  insertOp: ColInsertOp
): VerticalAlignOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

const transformSetBorderVsColInsert = (
  op: SetBorderOp,
  insertOp: ColInsertOp
): SetBorderOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

const transformSetFontFamilyVsColInsert = (
  op: SetFontFamilyOp,
  insertOp: ColInsertOp
): SetFontFamilyOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

const transformSetStrikethroughVsColInsert = (
  op: SetStrikethroughOp,
  insertOp: ColInsertOp
): SetStrikethroughOp => {
  const result = cloneOp(op);
  result.col = adjustColForInsert(op.col, insertOp);
  return result;
};

// ============================================================
// 具体操作类型 vs ColDelete 的转换
// ============================================================

const transformCellEditVsColDelete = (
  op: CellEditOp,
  deleteOp: ColDeleteOp
): CellEditOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  return result;
};

const transformCellMergeVsColDelete = (
  op: CellMergeOp,
  deleteOp: ColDeleteOp
): CellMergeOp | null => {
  const delEnd = deleteOp.colIndex + deleteOp.count;

  // 完全在删除范围内
  if (op.startCol >= deleteOp.colIndex && op.endCol < delEnd) {
    return null;
  }
  // 左侧部分重叠（合并区域被截断）
  if (op.startCol < deleteOp.colIndex && op.endCol >= deleteOp.colIndex && op.endCol < delEnd) {
    return null;
  }
  // 右侧部分重叠（合并区域被截断）
  if (op.startCol >= deleteOp.colIndex && op.startCol < delEnd && op.endCol >= delEnd) {
    return null;
  }
  // 删除范围完全在合并区域内部（合并区域收缩）
  if (op.startCol < deleteOp.colIndex && delEnd <= op.endCol) {
    const result = cloneOp(op);
    result.endCol = op.endCol - deleteOp.count;
    return result;
  }
  // 合并区域完全在删除范围右侧
  if (op.startCol >= delEnd) {
    const result = cloneOp(op);
    result.startCol = op.startCol - deleteOp.count;
    result.endCol = op.endCol - deleteOp.count;
    return result;
  }
  // 合并区域完全在删除范围左侧，不变
  return cloneOp(op);
};

const transformCellSplitVsColDelete = (
  op: CellSplitOp,
  deleteOp: ColDeleteOp
): CellSplitOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  // rowSpan/colSpan 是历史快照，不受列删除影响
  return result;
};

const transformColResizeVsColDelete = (
  op: ColResizeOp,
  deleteOp: ColDeleteOp
): ColResizeOp | null => {
  const newCol = adjustColForDelete(op.colIndex, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.colIndex = newCol;
  return result;
};

const transformColInsertVsColDelete = (
  opA: ColInsertOp,
  opB: ColDeleteOp
): ColInsertOp => {
  const result = cloneOp(opA);
  const delEnd = opB.colIndex + opB.count;
  if (opA.colIndex > delEnd) {
    // 插入位置在删除范围之后
    result.colIndex = opA.colIndex - opB.count;
  } else if (opA.colIndex <= opB.colIndex) {
    // 插入位置在删除范围之前，不变
  } else {
    // 插入位置在删除范围内，调整到删除起始位置
    result.colIndex = opB.colIndex;
  }
  return result;
};

const transformColDeleteVsColDelete = (
  opA: ColDeleteOp,
  opB: ColDeleteOp
): ColDeleteOp | null => {
  const origColIndex = opA.colIndex;
  const origCount = opA.count;
  const aEnd = origColIndex + origCount;
  const bEnd = opB.colIndex + opB.count;

  // opA 完全在 opB 之后
  if (origColIndex >= bEnd) {
    const result = cloneOp(opA);
    result.colIndex = origColIndex - opB.count;
    return result;
  }
  // opA 完全在 opB 之前
  if (aEnd <= opB.colIndex) {
    return cloneOp(opA);
  }
  // opA 完全在 opB 内部，被完全删除
  if (origColIndex >= opB.colIndex && aEnd <= bEnd) {
    return null;
  }
  // opA 完全包含 opB
  if (origColIndex < opB.colIndex && aEnd > bEnd) {
    const result = cloneOp(opA);
    result.count = origCount - opB.count;
    return result;
  }
  // opA 与 opB 前部分重叠（opA 起点在 opB 之前，opA 终点在 opB 内部）
  if (origColIndex < opB.colIndex && aEnd > opB.colIndex && aEnd <= bEnd) {
    const result = cloneOp(opA);
    result.count = opB.colIndex - origColIndex;
    return result;
  }
  // opA 与 opB 后部分重叠（opA 起点在 opB 内部，opA 终点在 opB 之后）
  const newCount = aEnd - bEnd;
  const result = cloneOp(opA);
  result.colIndex = opB.colIndex;
  result.count = newCount;
  return result;
};

const transformFontColorVsColDelete = (
  op: FontColorOp,
  deleteOp: ColDeleteOp
): FontColorOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  return result;
};

const transformBgColorVsColDelete = (
  op: BgColorOp,
  deleteOp: ColDeleteOp
): BgColorOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  return result;
};

const transformFontSizeVsColDelete = (
  op: FontSizeOp,
  deleteOp: ColDeleteOp
): FontSizeOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  return result;
};

const transformFontBoldVsColDelete = (
  op: FontBoldOp,
  deleteOp: ColDeleteOp
): FontBoldOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  return result;
};

const transformFontItalicVsColDelete = (
  op: FontItalicOp,
  deleteOp: ColDeleteOp
): FontItalicOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  return result;
};

const transformFontUnderlineVsColDelete = (
  op: FontUnderlineOp,
  deleteOp: ColDeleteOp
): FontUnderlineOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  return result;
};

const transformFontAlignVsColDelete = (
  op: FontAlignOp,
  deleteOp: ColDeleteOp
): FontAlignOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  return result;
};

const transformVerticalAlignVsColDelete = (
  op: VerticalAlignOp,
  deleteOp: ColDeleteOp
): VerticalAlignOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  return result;
};

const transformSetBorderVsColDelete = (
  op: SetBorderOp,
  deleteOp: ColDeleteOp
): SetBorderOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  return result;
};

const transformSetFontFamilyVsColDelete = (
  op: SetFontFamilyOp,
  deleteOp: ColDeleteOp
): SetFontFamilyOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
  return result;
};

const transformSetStrikethroughVsColDelete = (
  op: SetStrikethroughOp,
  deleteOp: ColDeleteOp
): SetStrikethroughOp | null => {
  const newCol = adjustColForDelete(op.col, deleteOp);
  if (newCol === null) return null;
  const result = cloneOp(op);
  result.col = newCol;
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
// CellSplit 相关转换函数
// ============================================================

const transformCellEditVsCellSplit = (
  editOp: CellEditOp,
  splitOp: CellSplitOp
): CellEditOp => {
  const result = cloneOp(editOp);
  if (isInSplitRange(editOp.row, editOp.col, splitOp)) {
    result.row = splitOp.row;
    result.col = splitOp.col;
  }
  return result;
};

const transformCellMergeVsCellSplit = (
  mergeOp: CellMergeOp,
  splitOp: CellSplitOp
): CellMergeOp | null => {
  const rowSpan = splitOp.rowSpan ?? 1;
  const colSpan = splitOp.colSpan ?? 1;
  const splitEndRow = splitOp.row + rowSpan - 1;
  const splitEndCol = splitOp.col + colSpan - 1;

  const overlaps =
    mergeOp.startRow <= splitEndRow &&
    mergeOp.endRow >= splitOp.row &&
    mergeOp.startCol <= splitEndCol &&
    mergeOp.endCol >= splitOp.col;

  return overlaps ? null : cloneOp(mergeOp);
};

const transformCellSplitVsCellSplit = (
  opA: CellSplitOp,
  opB: CellSplitOp
): CellSplitOp | null => {
  if (opA.row === opB.row && opA.col === opB.col) {
    return null;
  }
  return cloneOp(opA);
};

const transformCellSplitVsCellEdit = (
  splitOp: CellSplitOp,
  _editOp: CellEditOp
): CellSplitOp => {
  return cloneOp(splitOp);
};

const transformCellSplitVsCellMerge = (
  splitOp: CellSplitOp,
  mergeOp: CellMergeOp
): CellSplitOp | null => {
  if (
    splitOp.row >= mergeOp.startRow &&
    splitOp.row <= mergeOp.endRow &&
    splitOp.col >= mergeOp.startCol &&
    splitOp.col <= mergeOp.endCol
  ) {
    return null;
  }
  return cloneOp(splitOp);
};

const transformStyleOpVsCellSplit = (
  styleOp: CollabOperation,
  splitOp: CellSplitOp
): CollabOperation => {
  const result = cloneOp(styleOp);
  if ('row' in result && 'col' in result && typeof result.row === 'number' && typeof result.col === 'number') {
    if (isInSplitRange(result.row, result.col, splitOp)) {
      result.row = splitOp.row;
      result.col = splitOp.col;
    }
  }
  return result;
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
  // opB 是 ColResize 时，列宽调整不影响其他操作
  if (opB.type === 'colResize') {
    return cloneOp(opA);
  }

  // ---- opB 是 ColInsert ----
  if (opB.type === 'colInsert') {
    switch (opA.type) {
      case 'cellEdit':
        return transformCellEditVsColInsert(opA, opB);
      case 'cellMerge':
        return transformCellMergeVsColInsert(opA, opB);
      case 'cellSplit':
        return transformCellSplitVsColInsert(opA, opB);
      case 'colResize':
        return transformColResizeVsColInsert(opA, opB);
      case 'rowInsert':
        return cloneOp(opA); // 行列独立
      case 'rowDelete':
        return cloneOp(opA); // 行列独立
      case 'rowResize':
        return cloneOp(opA); // 行列独立
      case 'colInsert':
        return transformColInsertVsColInsert(opA, opB);
      case 'colDelete':
        return transformColDeleteVsColInsert(opA, opB);
      case 'fontColor':
        return transformFontColorVsColInsert(opA, opB);
      case 'bgColor':
        return transformBgColorVsColInsert(opA, opB);
      case 'fontSize':
        return transformFontSizeVsColInsert(opA, opB);
      case 'fontBold':
        return transformFontBoldVsColInsert(opA, opB);
      case 'fontItalic':
        return transformFontItalicVsColInsert(opA, opB);
      case 'fontUnderline':
        return transformFontUnderlineVsColInsert(opA, opB);
      case 'fontAlign':
        return transformFontAlignVsColInsert(opA, opB);
      case 'verticalAlign':
        return transformVerticalAlignVsColInsert(opA, opB);
      case 'setBorder':
        return transformSetBorderVsColInsert(opA, opB);
      case 'setFontFamily':
        return transformSetFontFamilyVsColInsert(opA, opB);
      case 'setStrikethrough':
        return transformSetStrikethroughVsColInsert(opA, opB);
    }
  }

  // ---- opB 是 ColDelete ----
  if (opB.type === 'colDelete') {
    switch (opA.type) {
      case 'cellEdit':
        return transformCellEditVsColDelete(opA, opB);
      case 'cellMerge':
        return transformCellMergeVsColDelete(opA, opB);
      case 'cellSplit':
        return transformCellSplitVsColDelete(opA, opB);
      case 'colResize':
        return transformColResizeVsColDelete(opA, opB);
      case 'rowInsert':
        return cloneOp(opA); // 行列独立
      case 'rowDelete':
        return cloneOp(opA); // 行列独立
      case 'rowResize':
        return cloneOp(opA); // 行列独立
      case 'colInsert':
        return transformColInsertVsColDelete(opA, opB);
      case 'colDelete':
        return transformColDeleteVsColDelete(opA, opB);
      case 'fontColor':
        return transformFontColorVsColDelete(opA, opB);
      case 'bgColor':
        return transformBgColorVsColDelete(opA, opB);
      case 'fontSize':
        return transformFontSizeVsColDelete(opA, opB);
      case 'fontBold':
        return transformFontBoldVsColDelete(opA, opB);
      case 'fontItalic':
        return transformFontItalicVsColDelete(opA, opB);
      case 'fontUnderline':
        return transformFontUnderlineVsColDelete(opA, opB);
      case 'fontAlign':
        return transformFontAlignVsColDelete(opA, opB);
      case 'verticalAlign':
        return transformVerticalAlignVsColDelete(opA, opB);
      case 'setBorder':
        return transformSetBorderVsColDelete(opA, opB);
      case 'setFontFamily':
        return transformSetFontFamilyVsColDelete(opA, opB);
      case 'setStrikethrough':
        return transformSetStrikethroughVsColDelete(opA, opB);
    }
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
      case 'fontSize':
        return transformFontSizeVsRowInsert(opA, opB);
      case 'fontBold':
        return transformFontBoldVsRowInsert(opA, opB);
      case 'fontItalic':
        return transformFontItalicVsRowInsert(opA, opB);
      case 'fontUnderline':
        return transformFontUnderlineVsRowInsert(opA, opB);
      case 'fontAlign':
        return transformFontAlignVsRowInsert(opA, opB);
      case 'verticalAlign':
        return transformVerticalAlignVsRowInsert(opA, opB);
      case 'setBorder':
        return transformSetBorderVsRowInsert(opA, opB);
      case 'setFontFamily':
        return transformSetFontFamilyVsRowInsert(opA, opB);
      case 'setStrikethrough':
        return transformSetStrikethroughVsRowInsert(opA, opB);
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
      case 'fontSize':
        return transformFontSizeVsRowDelete(opA, opB);
      case 'fontBold':
        return transformFontBoldVsRowDelete(opA, opB);
      case 'fontItalic':
        return transformFontItalicVsRowDelete(opA, opB);
      case 'fontUnderline':
        return transformFontUnderlineVsRowDelete(opA, opB);
      case 'fontAlign':
        return transformFontAlignVsRowDelete(opA, opB);
      case 'verticalAlign':
        return transformVerticalAlignVsRowDelete(opA, opB);
      case 'setBorder':
        return transformSetBorderVsRowDelete(opA, opB);
      case 'setFontFamily':
        return transformSetFontFamilyVsRowDelete(opA, opB);
      case 'setStrikethrough':
        return transformSetStrikethroughVsRowDelete(opA, opB);
    }
  }

  // ---- opB 是 CellEdit ----
  if (opB.type === 'cellEdit') {
    switch (opA.type) {
      case 'cellEdit':
        return transformCellEditVsCellEdit(opA, opB);
      case 'cellSplit':
        return transformCellSplitVsCellEdit(opA, opB);
      default:
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
      case 'cellSplit':
        return transformCellSplitVsCellMerge(opA, opB);
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
      case 'fontSize': {
        // 如果字体大小操作在合并范围内，调整到父单元格
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
      case 'fontBold': {
        // 如果字体加粗操作在合并范围内，调整到父单元格
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
      case 'fontItalic': {
        // 如果字体斜体操作在合并范围内，调整到父单元格
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
      case 'fontUnderline': {
        // 如果字体下划线操作在合并范围内，调整到父单元格
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
      case 'fontAlign': {
        // 如果字体对齐操作在合并范围内，调整到父单元格
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
      case 'verticalAlign': {
        // 如果垂直对齐操作在合并范围内，调整到父单元格
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
      case 'setBorder': {
        // 如果边框操作在合并范围内，调整到主单元格
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
      case 'setFontFamily': {
        // 如果字体族操作在合并范围内，调整到主单元格
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
      case 'setStrikethrough': {
        // 如果删除线操作在合并范围内，调整到主单元格
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
    switch (opA.type) {
      case 'cellEdit':
        return transformCellEditVsCellSplit(opA, opB);
      case 'cellMerge':
        return transformCellMergeVsCellSplit(opA, opB);
      case 'cellSplit':
        return transformCellSplitVsCellSplit(opA, opB);
      case 'fontColor':
      case 'bgColor':
      case 'fontSize':
      case 'fontBold':
      case 'fontItalic':
      case 'fontUnderline':
      case 'fontAlign':
      case 'verticalAlign':
      case 'setBorder':
      case 'setFontFamily':
      case 'setStrikethrough':
        return transformStyleOpVsCellSplit(opA, opB);
      default:
        return cloneOp(opA);
    }
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

  // ---- 同类型同单元格冲突消除 ----
  if (opA.type === 'setBorder' && opB.type === 'setBorder') {
    if (opA.row === opB.row && opA.col === opB.col) return null;
    return cloneOp(opA);
  }
  if (opA.type === 'setFontFamily' && opB.type === 'setFontFamily') {
    if (opA.row === opB.row && opA.col === opB.col) return null;
    return cloneOp(opA);
  }
  if (opA.type === 'setStrikethrough' && opB.type === 'setStrikethrough') {
    if (opA.row === opB.row && opA.col === opB.col) return null;
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
  getCell(row: number, col: number): { content: string; rowSpan: number; colSpan: number; fontColor?: string; bgColor?: string; fontSize?: number; fontBold?: boolean; fontItalic?: boolean; fontUnderline?: boolean; fontAlign?: string; verticalAlign?: string; border?: CellBorder; fontFamily?: string; fontStrikethrough?: boolean } | null;
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
        rowSpan: op.endRow - op.startRow + 1,
        colSpan: op.endCol - op.startCol + 1,
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

    case 'colInsert': {
      // 反向操作：删除插入的列
      return { ...op, type: 'colDelete' } as ColDeleteOp;
    }

    case 'colDelete': {
      // 反向操作：在相同位置插入列
      return { ...op, type: 'colInsert' } as ColInsertOp;
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

    case 'fontSize': {
      // 反向操作：恢复原始字体大小
      const cell = model.getCell(op.row, op.col);
      return {
        ...op,
        size: cell?.fontSize ?? 12,
        timestamp: Date.now(),
      };
    }

    case 'fontBold': {
      // 反向操作：恢复原始字体加粗状态
      const cell = model.getCell(op.row, op.col);
      return {
        ...op,
        bold: cell?.fontBold ?? false,
        timestamp: Date.now(),
      };
    }

    case 'fontItalic': {
      // 反向操作：恢复原始字体斜体状态
      const cell = model.getCell(op.row, op.col);
      return {
        ...op,
        italic: cell?.fontItalic ?? false,
        timestamp: Date.now(),
      };
    }

    case 'fontUnderline': {
      // 反向操作：恢复原始字体下划线状态
      const cell = model.getCell(op.row, op.col);
      return {
        ...op,
        underline: cell?.fontUnderline ?? false,
        timestamp: Date.now(),
      };
    }

    case 'fontAlign': {
      // 反向操作：恢复原始字体对齐状态
      const cell = model.getCell(op.row, op.col);
      return {
        ...op,
        align: (cell?.fontAlign as 'left' | 'center' | 'right') ?? 'left',
        timestamp: Date.now(),
      };
    }

    case 'verticalAlign': {
      // 反向操作：恢复原始垂直对齐状态
      const cell = model.getCell(op.row, op.col);
      return {
        ...op,
        align: (cell?.verticalAlign as 'top' | 'middle' | 'bottom') ?? 'middle',
        timestamp: Date.now(),
      };
    }

    case 'setBorder': {
      // 反向操作：恢复原始边框值
      const cell = model.getCell(op.row, op.col);
      return {
        ...op,
        border: cell?.border ?? undefined,
        timestamp: Date.now(),
      };
    }

    case 'setFontFamily': {
      // 反向操作：恢复原始字体族
      const cell = model.getCell(op.row, op.col);
      return {
        ...op,
        fontFamily: cell?.fontFamily ?? '',
        timestamp: Date.now(),
      };
    }

    case 'setStrikethrough': {
      // 反向操作：恢复原始删除线状态
      const cell = model.getCell(op.row, op.col);
      return {
        ...op,
        strikethrough: cell?.fontStrikethrough ?? false,
        timestamp: Date.now(),
      };
    }

    default: {
      // Sheet 级操作（sheetAdd/sheetDelete 等）和其他未处理的操作类型
      // 返回原操作本身（Sheet 级操作不支持撤销）
      return op;
    }
  }
};
