/**
 * 服务端 OT 转换模块
 * 与客户端 src/collaboration/ot.ts 保持一致的转换逻辑
 */
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
  FontSizeOp,
  FontBoldOp,
  FontItalicOp,
  FontUnderlineOp,
  FontAlignOp,
  VerticalAlignOp,
} from './types.ts';

// 深拷贝操作对象
const cloneOp = <T extends CollabOperation>(op: T): T => {
  return JSON.parse(JSON.stringify(op)) as T;
};

// 判断行是否在删除范围内
const isRowInDeleteRange = (row: number, deleteOp: RowDeleteOp): boolean => {
  return row >= deleteOp.rowIndex && row < deleteOp.rowIndex + deleteOp.count;
};

// 根据行插入操作调整行索引
const adjustRowForInsert = (row: number, insertOp: RowInsertOp): number => {
  return row >= insertOp.rowIndex ? row + insertOp.count : row;
};

// 根据行删除操作调整行索引，返回 null 表示该行被删除
const adjustRowForDelete = (row: number, deleteOp: RowDeleteOp): number | null => {
  if (isRowInDeleteRange(row, deleteOp)) return null;
  if (row >= deleteOp.rowIndex + deleteOp.count) return row - deleteOp.count;
  return row;
};

// ============================================================
// 具体操作类型 vs RowInsert 的转换
// ============================================================

const transformCellEditVsRowInsert = (op: CellEditOp, insertOp: RowInsertOp): CellEditOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformCellMergeVsRowInsert = (op: CellMergeOp, insertOp: RowInsertOp): CellMergeOp => {
  const result = cloneOp(op);
  result.startRow = adjustRowForInsert(op.startRow, insertOp);
  result.endRow = adjustRowForInsert(op.endRow, insertOp);
  return result;
};

const transformCellSplitVsRowInsert = (op: CellSplitOp, insertOp: RowInsertOp): CellSplitOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformRowResizeVsRowInsert = (op: RowResizeOp, insertOp: RowInsertOp): RowResizeOp => {
  const result = cloneOp(op);
  result.rowIndex = adjustRowForInsert(op.rowIndex, insertOp);
  return result;
};

const transformFontColorVsRowInsert = (op: FontColorOp, insertOp: RowInsertOp): FontColorOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformBgColorVsRowInsert = (op: BgColorOp, insertOp: RowInsertOp): BgColorOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformFontSizeVsRowInsert = (op: FontSizeOp, insertOp: RowInsertOp): FontSizeOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformFontBoldVsRowInsert = (op: FontBoldOp, insertOp: RowInsertOp): FontBoldOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformFontItalicVsRowInsert = (op: FontItalicOp, insertOp: RowInsertOp): FontItalicOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformFontUnderlineVsRowInsert = (op: FontUnderlineOp, insertOp: RowInsertOp): FontUnderlineOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformFontAlignVsRowInsert = (op: FontAlignOp, insertOp: RowInsertOp): FontAlignOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformVerticalAlignVsRowInsert = (op: VerticalAlignOp, insertOp: RowInsertOp): VerticalAlignOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

// ============================================================
// 具体操作类型 vs RowDelete 的转换
// ============================================================

const transformCellEditVsRowDelete = (op: CellEditOp, deleteOp: RowDeleteOp): CellEditOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformCellMergeVsRowDelete = (op: CellMergeOp, deleteOp: RowDeleteOp): CellMergeOp | null => {
  const newStartRow = adjustRowForDelete(op.startRow, deleteOp);
  const newEndRow = adjustRowForDelete(op.endRow, deleteOp);
  if (newStartRow === null || newEndRow === null) return null;
  const result = cloneOp(op);
  result.startRow = newStartRow;
  result.endRow = newEndRow;
  return result;
};

const transformCellSplitVsRowDelete = (op: CellSplitOp, deleteOp: RowDeleteOp): CellSplitOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformRowResizeVsRowDelete = (op: RowResizeOp, deleteOp: RowDeleteOp): RowResizeOp | null => {
  const newRow = adjustRowForDelete(op.rowIndex, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.rowIndex = newRow;
  return result;
};

const transformFontColorVsRowDelete = (op: FontColorOp, deleteOp: RowDeleteOp): FontColorOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformBgColorVsRowDelete = (op: BgColorOp, deleteOp: RowDeleteOp): BgColorOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformFontSizeVsRowDelete = (op: FontSizeOp, deleteOp: RowDeleteOp): FontSizeOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformFontBoldVsRowDelete = (op: FontBoldOp, deleteOp: RowDeleteOp): FontBoldOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformFontItalicVsRowDelete = (op: FontItalicOp, deleteOp: RowDeleteOp): FontItalicOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformFontUnderlineVsRowDelete = (op: FontUnderlineOp, deleteOp: RowDeleteOp): FontUnderlineOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformFontAlignVsRowDelete = (op: FontAlignOp, deleteOp: RowDeleteOp): FontAlignOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

const transformVerticalAlignVsRowDelete = (op: VerticalAlignOp, deleteOp: RowDeleteOp): VerticalAlignOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};

// ============================================================
// RowInsert / RowDelete 互相转换
// ============================================================

const transformRowInsertVsRowInsert = (opA: RowInsertOp, opB: RowInsertOp): RowInsertOp => {
  const result = cloneOp(opA);
  if (opA.rowIndex > opB.rowIndex) {
    result.rowIndex = opA.rowIndex + opB.count;
  } else if (opA.rowIndex === opB.rowIndex && opA.userId > opB.userId) {
    result.rowIndex = opA.rowIndex + opB.count;
  }
  return result;
};

const transformRowInsertVsRowDelete = (insertOp: RowInsertOp, deleteOp: RowDeleteOp): RowInsertOp => {
  const result = cloneOp(insertOp);
  if (insertOp.rowIndex > deleteOp.rowIndex) {
    const deleteEnd = deleteOp.rowIndex + deleteOp.count;
    if (insertOp.rowIndex >= deleteEnd) {
      result.rowIndex = insertOp.rowIndex - deleteOp.count;
    } else {
      result.rowIndex = deleteOp.rowIndex;
    }
  }
  return result;
};

const transformRowDeleteVsRowInsert = (deleteOp: RowDeleteOp, insertOp: RowInsertOp): RowDeleteOp => {
  const result = cloneOp(deleteOp);
  if (deleteOp.rowIndex >= insertOp.rowIndex) {
    result.rowIndex = deleteOp.rowIndex + insertOp.count;
  }
  return result;
};

const transformRowDeleteVsRowDelete = (opA: RowDeleteOp, opB: RowDeleteOp): RowDeleteOp | null => {
  const aStart = opA.rowIndex;
  const aEnd = opA.rowIndex + opA.count;
  const bStart = opB.rowIndex;
  const bEnd = opB.rowIndex + opB.count;

  if (aEnd <= bStart) return cloneOp(opA);
  if (aStart >= bEnd) {
    const result = cloneOp(opA);
    result.rowIndex = opA.rowIndex - opB.count;
    return result;
  }
  if (aStart >= bStart && aEnd <= bEnd) return null;
  if (aStart < bStart && aEnd > bEnd) {
    const result = cloneOp(opA);
    result.count = opA.count - opB.count;
    return result;
  }
  if (aStart < bStart) {
    const result = cloneOp(opA);
    result.count = bStart - aStart;
    return result;
  }
  const result = cloneOp(opA);
  result.rowIndex = bStart;
  result.count = aEnd - bEnd;
  return result;
};

// ============================================================
// CellEdit vs CellEdit
// ============================================================

const transformCellEditVsCellEdit = (opA: CellEditOp, opB: CellEditOp): CellEditOp => {
  const result = cloneOp(opA);
  if (opA.row === opB.row && opA.col === opB.col) {
    result.previousContent = opB.content;
  }
  return result;
};

// ============================================================
// CellMerge 相关转换
// ============================================================

const transformCellEditVsCellMerge = (editOp: CellEditOp, mergeOp: CellMergeOp): CellEditOp => {
  const result = cloneOp(editOp);
  if (
    editOp.row >= mergeOp.startRow && editOp.row <= mergeOp.endRow &&
    editOp.col >= mergeOp.startCol && editOp.col <= mergeOp.endCol
  ) {
    result.row = mergeOp.startRow;
    result.col = mergeOp.startCol;
  }
  return result;
};

const transformCellMergeVsCellMerge = (opA: CellMergeOp, opB: CellMergeOp): CellMergeOp | null => {
  const overlaps =
    opA.startRow <= opB.endRow && opA.endRow >= opB.startRow &&
    opA.startCol <= opB.endCol && opA.endCol >= opB.startCol;
  return overlaps ? null : cloneOp(opA);
};

// ============================================================
// 核心 transformSingle 函数
// ============================================================

const transformSingle = (opA: CollabOperation, opB: CollabOperation): CollabOperation | null => {
  if (opA.type === 'colResize' || opB.type === 'colResize') return cloneOp(opA);

  if (opB.type === 'rowInsert') {
    switch (opA.type) {
      case 'cellEdit': return transformCellEditVsRowInsert(opA, opB);
      case 'cellMerge': return transformCellMergeVsRowInsert(opA, opB);
      case 'cellSplit': return transformCellSplitVsRowInsert(opA, opB);
      case 'rowInsert': return transformRowInsertVsRowInsert(opA, opB);
      case 'rowDelete': return transformRowDeleteVsRowInsert(opA, opB);
      case 'rowResize': return transformRowResizeVsRowInsert(opA, opB);
      case 'fontColor': return transformFontColorVsRowInsert(opA, opB);
      case 'bgColor': return transformBgColorVsRowInsert(opA, opB);
      case 'fontSize': return transformFontSizeVsRowInsert(opA, opB);
      case 'fontBold': return transformFontBoldVsRowInsert(opA, opB);
      case 'fontItalic': return transformFontItalicVsRowInsert(opA, opB);
      case 'fontUnderline': return transformFontUnderlineVsRowInsert(opA, opB);
      case 'fontAlign': return transformFontAlignVsRowInsert(opA, opB);
      case 'verticalAlign': return transformVerticalAlignVsRowInsert(opA, opB);
    }
  }

  if (opB.type === 'rowDelete') {
    switch (opA.type) {
      case 'cellEdit': return transformCellEditVsRowDelete(opA, opB);
      case 'cellMerge': return transformCellMergeVsRowDelete(opA, opB);
      case 'cellSplit': return transformCellSplitVsRowDelete(opA, opB);
      case 'rowInsert': return transformRowInsertVsRowDelete(opA, opB);
      case 'rowDelete': return transformRowDeleteVsRowDelete(opA, opB);
      case 'rowResize': return transformRowResizeVsRowDelete(opA, opB);
      case 'fontColor': return transformFontColorVsRowDelete(opA, opB);
      case 'bgColor': return transformBgColorVsRowDelete(opA, opB);
      case 'fontSize': return transformFontSizeVsRowDelete(opA, opB);
      case 'fontBold': return transformFontBoldVsRowDelete(opA, opB);
      case 'fontItalic': return transformFontItalicVsRowDelete(opA, opB);
      case 'fontUnderline': return transformFontUnderlineVsRowDelete(opA, opB);
      case 'fontAlign': return transformFontAlignVsRowDelete(opA, opB);
      case 'verticalAlign': return transformVerticalAlignVsRowDelete(opA, opB);
    }
  }

  if (opB.type === 'cellEdit') {
    if (opA.type === 'cellEdit') return transformCellEditVsCellEdit(opA, opB);
    return cloneOp(opA);
  }

  if (opB.type === 'cellMerge') {
    switch (opA.type) {
      case 'cellEdit': return transformCellEditVsCellMerge(opA, opB);
      case 'cellMerge': return transformCellMergeVsCellMerge(opA, opB);
      case 'fontColor': {
        const result = cloneOp(opA);
        if (opA.row >= opB.startRow && opA.row <= opB.endRow && opA.col >= opB.startCol && opA.col <= opB.endCol) {
          result.row = opB.startRow;
          result.col = opB.startCol;
        }
        return result;
      }
      case 'bgColor': {
        const result = cloneOp(opA);
        if (opA.row >= opB.startRow && opA.row <= opB.endRow && opA.col >= opB.startCol && opA.col <= opB.endCol) {
          result.row = opB.startRow;
          result.col = opB.startCol;
        }
        return result;
      }
      case 'fontSize': {
        const result = cloneOp(opA);
        if (opA.row >= opB.startRow && opA.row <= opB.endRow && opA.col >= opB.startCol && opA.col <= opB.endCol) {
          result.row = opB.startRow;
          result.col = opB.startCol;
        }
        return result;
      }
      case 'fontBold': {
        const result = cloneOp(opA);
        if (opA.row >= opB.startRow && opA.row <= opB.endRow && opA.col >= opB.startCol && opA.col <= opB.endCol) {
          result.row = opB.startRow;
          result.col = opB.startCol;
        }
        return result;
      }
      case 'fontItalic': {
        const result = cloneOp(opA);
        if (opA.row >= opB.startRow && opA.row <= opB.endRow && opA.col >= opB.startCol && opA.col <= opB.endCol) {
          result.row = opB.startRow;
          result.col = opB.startCol;
        }
        return result;
      }
      case 'fontUnderline': {
        const result = cloneOp(opA);
        if (opA.row >= opB.startRow && opA.row <= opB.endRow && opA.col >= opB.startCol && opA.col <= opB.endCol) {
          result.row = opB.startRow;
          result.col = opB.startCol;
        }
        return result;
      }
      case 'verticalAlign': {
        const result = cloneOp(opA);
        if (opA.row >= opB.startRow && opA.row <= opB.endRow && opA.col >= opB.startCol && opA.col <= opB.endCol) {
          result.row = opB.startRow;
          result.col = opB.startCol;
        }
        return result;
      }
      default: return cloneOp(opA);
    }
  }

  return cloneOp(opA);
};

// ============================================================
// 公开 API
// ============================================================

/**
 * OT 转换函数：返回转换后的操作对 [a', b']
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
 * 对操作列表执行转换
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
