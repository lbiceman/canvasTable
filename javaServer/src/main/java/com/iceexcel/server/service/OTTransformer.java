package com.iceexcel.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceexcel.server.model.*;

import java.util.List;

/**
 * OT 转换工具类（无状态）
 * 从 server/src/ot.ts 逐函数翻译所有转换逻辑
 */
public class OTTransformer {

    private static final ObjectMapper mapper = new ObjectMapper();

    // ============================================================
    // 深拷贝与辅助方法
    // ============================================================

    /**
     * 深拷贝操作对象（通过 JSON 序列化/反序列化）
     */
    @SuppressWarnings("unchecked")
    private static <T extends CollabOperation> T cloneOp(T op) {
        try {
            String json = mapper.writeValueAsString(op);
            return (T) mapper.readValue(json, CollabOperation.class);
        } catch (Exception e) {
            throw new RuntimeException("克隆操作失败", e);
        }
    }

    /**
     * 判断行是否在删除范围内
     */
    private static boolean isRowInDeleteRange(int row, RowDeleteOp deleteOp) {
        return row >= deleteOp.getRowIndex() && row < deleteOp.getRowIndex() + deleteOp.getCount();
    }

    /**
     * 根据行插入操作调整行索引
     */
    private static int adjustRowForInsert(int row, RowInsertOp insertOp) {
        return row >= insertOp.getRowIndex() ? row + insertOp.getCount() : row;
    }

    /**
     * 根据行删除操作调整行索引，返回 null 表示该行被删除
     */
    private static Integer adjustRowForDelete(int row, RowDeleteOp deleteOp) {
        if (isRowInDeleteRange(row, deleteOp)) return null;
        if (row >= deleteOp.getRowIndex() + deleteOp.getCount()) return row - deleteOp.getCount();
        return row;
    }

    // ============================================================
    // 具体操作类型 vs RowInsert 的转换
    // ============================================================

    private static CellEditOp transformCellEditVsRowInsert(CellEditOp op, RowInsertOp insertOp) {
        CellEditOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static CellMergeOp transformCellMergeVsRowInsert(CellMergeOp op, RowInsertOp insertOp) {
        CellMergeOp result = cloneOp(op);
        result.setStartRow(adjustRowForInsert(op.getStartRow(), insertOp));
        result.setEndRow(adjustRowForInsert(op.getEndRow(), insertOp));
        return result;
    }

    private static CellSplitOp transformCellSplitVsRowInsert(CellSplitOp op, RowInsertOp insertOp) {
        CellSplitOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static RowResizeOp transformRowResizeVsRowInsert(RowResizeOp op, RowInsertOp insertOp) {
        RowResizeOp result = cloneOp(op);
        result.setRowIndex(adjustRowForInsert(op.getRowIndex(), insertOp));
        return result;
    }

    private static FontColorOp transformFontColorVsRowInsert(FontColorOp op, RowInsertOp insertOp) {
        FontColorOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static BgColorOp transformBgColorVsRowInsert(BgColorOp op, RowInsertOp insertOp) {
        BgColorOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static FontSizeOp transformFontSizeVsRowInsert(FontSizeOp op, RowInsertOp insertOp) {
        FontSizeOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static FontBoldOp transformFontBoldVsRowInsert(FontBoldOp op, RowInsertOp insertOp) {
        FontBoldOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static FontItalicOp transformFontItalicVsRowInsert(FontItalicOp op, RowInsertOp insertOp) {
        FontItalicOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static FontUnderlineOp transformFontUnderlineVsRowInsert(FontUnderlineOp op, RowInsertOp insertOp) {
        FontUnderlineOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static FontAlignOp transformFontAlignVsRowInsert(FontAlignOp op, RowInsertOp insertOp) {
        FontAlignOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static VerticalAlignOp transformVerticalAlignVsRowInsert(VerticalAlignOp op, RowInsertOp insertOp) {
        VerticalAlignOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    // ============================================================
    // 具体操作类型 vs RowDelete 的转换
    // ============================================================

    private static CellEditOp transformCellEditVsRowDelete(CellEditOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        CellEditOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static CellMergeOp transformCellMergeVsRowDelete(CellMergeOp op, RowDeleteOp deleteOp) {
        Integer newStartRow = adjustRowForDelete(op.getStartRow(), deleteOp);
        Integer newEndRow = adjustRowForDelete(op.getEndRow(), deleteOp);
        if (newStartRow == null || newEndRow == null) return null;
        CellMergeOp result = cloneOp(op);
        result.setStartRow(newStartRow);
        result.setEndRow(newEndRow);
        return result;
    }

    private static CellSplitOp transformCellSplitVsRowDelete(CellSplitOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        CellSplitOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static RowResizeOp transformRowResizeVsRowDelete(RowResizeOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRowIndex(), deleteOp);
        if (newRow == null) return null;
        RowResizeOp result = cloneOp(op);
        result.setRowIndex(newRow);
        return result;
    }

    private static FontColorOp transformFontColorVsRowDelete(FontColorOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        FontColorOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static BgColorOp transformBgColorVsRowDelete(BgColorOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        BgColorOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static FontSizeOp transformFontSizeVsRowDelete(FontSizeOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        FontSizeOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static FontBoldOp transformFontBoldVsRowDelete(FontBoldOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        FontBoldOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static FontItalicOp transformFontItalicVsRowDelete(FontItalicOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        FontItalicOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static FontUnderlineOp transformFontUnderlineVsRowDelete(FontUnderlineOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        FontUnderlineOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static FontAlignOp transformFontAlignVsRowDelete(FontAlignOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        FontAlignOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static VerticalAlignOp transformVerticalAlignVsRowDelete(VerticalAlignOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        VerticalAlignOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    // ============================================================
    // RowInsert / RowDelete 互相转换
    // ============================================================

    private static RowInsertOp transformRowInsertVsRowInsert(RowInsertOp opA, RowInsertOp opB) {
        RowInsertOp result = cloneOp(opA);
        if (opA.getRowIndex() > opB.getRowIndex()) {
            result.setRowIndex(opA.getRowIndex() + opB.getCount());
        } else if (opA.getRowIndex() == opB.getRowIndex()
                && opA.getUserId() != null && opB.getUserId() != null
                && opA.getUserId().compareTo(opB.getUserId()) > 0) {
            result.setRowIndex(opA.getRowIndex() + opB.getCount());
        }
        return result;
    }

    private static RowInsertOp transformRowInsertVsRowDelete(RowInsertOp insertOp, RowDeleteOp deleteOp) {
        RowInsertOp result = cloneOp(insertOp);
        if (insertOp.getRowIndex() > deleteOp.getRowIndex()) {
            int deleteEnd = deleteOp.getRowIndex() + deleteOp.getCount();
            if (insertOp.getRowIndex() >= deleteEnd) {
                result.setRowIndex(insertOp.getRowIndex() - deleteOp.getCount());
            } else {
                result.setRowIndex(deleteOp.getRowIndex());
            }
        }
        return result;
    }

    private static RowDeleteOp transformRowDeleteVsRowInsert(RowDeleteOp deleteOp, RowInsertOp insertOp) {
        RowDeleteOp result = cloneOp(deleteOp);
        if (deleteOp.getRowIndex() >= insertOp.getRowIndex()) {
            result.setRowIndex(deleteOp.getRowIndex() + insertOp.getCount());
        }
        return result;
    }

    private static RowDeleteOp transformRowDeleteVsRowDelete(RowDeleteOp opA, RowDeleteOp opB) {
        int aStart = opA.getRowIndex();
        int aEnd = opA.getRowIndex() + opA.getCount();
        int bStart = opB.getRowIndex();
        int bEnd = opB.getRowIndex() + opB.getCount();

        // A 完全在 B 之前
        if (aEnd <= bStart) return cloneOp(opA);
        // A 完全在 B 之后
        if (aStart >= bEnd) {
            RowDeleteOp result = cloneOp(opA);
            result.setRowIndex(opA.getRowIndex() - opB.getCount());
            return result;
        }
        // A 被 B 完全包含
        if (aStart >= bStart && aEnd <= bEnd) return null;
        // A 完全包含 B
        if (aStart < bStart && aEnd > bEnd) {
            RowDeleteOp result = cloneOp(opA);
            result.setCount(opA.getCount() - opB.getCount());
            return result;
        }
        // A 的前部分与 B 不重叠
        if (aStart < bStart) {
            RowDeleteOp result = cloneOp(opA);
            result.setCount(bStart - aStart);
            return result;
        }
        // A 的后部分与 B 不重叠
        RowDeleteOp result = cloneOp(opA);
        result.setRowIndex(bStart);
        result.setCount(aEnd - bEnd);
        return result;
    }

    // ============================================================
    // CellEdit vs CellEdit
    // ============================================================

    private static CellEditOp transformCellEditVsCellEdit(CellEditOp opA, CellEditOp opB) {
        CellEditOp result = cloneOp(opA);
        if (opA.getRow() == opB.getRow() && opA.getCol() == opB.getCol()) {
            result.setPreviousContent(opB.getContent());
        }
        return result;
    }

    // ============================================================
    // CellMerge 相关转换
    // ============================================================

    private static CellEditOp transformCellEditVsCellMerge(CellEditOp editOp, CellMergeOp mergeOp) {
        CellEditOp result = cloneOp(editOp);
        if (editOp.getRow() >= mergeOp.getStartRow() && editOp.getRow() <= mergeOp.getEndRow()
                && editOp.getCol() >= mergeOp.getStartCol() && editOp.getCol() <= mergeOp.getEndCol()) {
            result.setRow(mergeOp.getStartRow());
            result.setCol(mergeOp.getStartCol());
        }
        return result;
    }

    private static CellMergeOp transformCellMergeVsCellMerge(CellMergeOp opA, CellMergeOp opB) {
        boolean overlaps =
                opA.getStartRow() <= opB.getEndRow() && opA.getEndRow() >= opB.getStartRow()
                        && opA.getStartCol() <= opB.getEndCol() && opA.getEndCol() >= opB.getStartCol();
        return overlaps ? null : cloneOp(opA);
    }

    /**
     * 辅助方法：判断带 row/col 的操作是否在 cellMerge 区域内，如果是则重定向到主单元格
     */
    private static boolean isInMergeRange(int row, int col, CellMergeOp mergeOp) {
        return row >= mergeOp.getStartRow() && row <= mergeOp.getEndRow()
                && col >= mergeOp.getStartCol() && col <= mergeOp.getEndCol();
    }

    // ============================================================
    // 核心 transformSingle 函数
    // ============================================================

    /**
     * 对两个操作执行单向转换：将 opA 相对于 opB 进行转换
     */
    private static CollabOperation transformSingle(CollabOperation opA, CollabOperation opB) {
        // colResize 不影响其他操作，也不受其他操作影响
        if (opA instanceof ColResizeOp || opB instanceof ColResizeOp) {
            return cloneOp(opA);
        }

        // opB 是 rowInsert
        if (opB instanceof RowInsertOp) {
            RowInsertOp insertOp = (RowInsertOp) opB;
            if (opA instanceof CellEditOp) return transformCellEditVsRowInsert((CellEditOp) opA, insertOp);
            if (opA instanceof CellMergeOp) return transformCellMergeVsRowInsert((CellMergeOp) opA, insertOp);
            if (opA instanceof CellSplitOp) return transformCellSplitVsRowInsert((CellSplitOp) opA, insertOp);
            if (opA instanceof RowInsertOp) return transformRowInsertVsRowInsert((RowInsertOp) opA, insertOp);
            if (opA instanceof RowDeleteOp) return transformRowDeleteVsRowInsert((RowDeleteOp) opA, insertOp);
            if (opA instanceof RowResizeOp) return transformRowResizeVsRowInsert((RowResizeOp) opA, insertOp);
            if (opA instanceof FontColorOp) return transformFontColorVsRowInsert((FontColorOp) opA, insertOp);
            if (opA instanceof BgColorOp) return transformBgColorVsRowInsert((BgColorOp) opA, insertOp);
            if (opA instanceof FontSizeOp) return transformFontSizeVsRowInsert((FontSizeOp) opA, insertOp);
            if (opA instanceof FontBoldOp) return transformFontBoldVsRowInsert((FontBoldOp) opA, insertOp);
            if (opA instanceof FontItalicOp) return transformFontItalicVsRowInsert((FontItalicOp) opA, insertOp);
            if (opA instanceof FontUnderlineOp) return transformFontUnderlineVsRowInsert((FontUnderlineOp) opA, insertOp);
            if (opA instanceof FontAlignOp) return transformFontAlignVsRowInsert((FontAlignOp) opA, insertOp);
            if (opA instanceof VerticalAlignOp) return transformVerticalAlignVsRowInsert((VerticalAlignOp) opA, insertOp);
        }

        // opB 是 rowDelete
        if (opB instanceof RowDeleteOp) {
            RowDeleteOp deleteOp = (RowDeleteOp) opB;
            if (opA instanceof CellEditOp) return transformCellEditVsRowDelete((CellEditOp) opA, deleteOp);
            if (opA instanceof CellMergeOp) return transformCellMergeVsRowDelete((CellMergeOp) opA, deleteOp);
            if (opA instanceof CellSplitOp) return transformCellSplitVsRowDelete((CellSplitOp) opA, deleteOp);
            if (opA instanceof RowInsertOp) return transformRowInsertVsRowDelete((RowInsertOp) opA, deleteOp);
            if (opA instanceof RowDeleteOp) return transformRowDeleteVsRowDelete((RowDeleteOp) opA, deleteOp);
            if (opA instanceof RowResizeOp) return transformRowResizeVsRowDelete((RowResizeOp) opA, deleteOp);
            if (opA instanceof FontColorOp) return transformFontColorVsRowDelete((FontColorOp) opA, deleteOp);
            if (opA instanceof BgColorOp) return transformBgColorVsRowDelete((BgColorOp) opA, deleteOp);
            if (opA instanceof FontSizeOp) return transformFontSizeVsRowDelete((FontSizeOp) opA, deleteOp);
            if (opA instanceof FontBoldOp) return transformFontBoldVsRowDelete((FontBoldOp) opA, deleteOp);
            if (opA instanceof FontItalicOp) return transformFontItalicVsRowDelete((FontItalicOp) opA, deleteOp);
            if (opA instanceof FontUnderlineOp) return transformFontUnderlineVsRowDelete((FontUnderlineOp) opA, deleteOp);
            if (opA instanceof FontAlignOp) return transformFontAlignVsRowDelete((FontAlignOp) opA, deleteOp);
            if (opA instanceof VerticalAlignOp) return transformVerticalAlignVsRowDelete((VerticalAlignOp) opA, deleteOp);
        }

        // opB 是 cellEdit
        if (opB instanceof CellEditOp) {
            if (opA instanceof CellEditOp) return transformCellEditVsCellEdit((CellEditOp) opA, (CellEditOp) opB);
            return cloneOp(opA);
        }

        // opB 是 cellMerge
        if (opB instanceof CellMergeOp) {
            CellMergeOp mergeOp = (CellMergeOp) opB;
            if (opA instanceof CellEditOp) return transformCellEditVsCellMerge((CellEditOp) opA, mergeOp);
            if (opA instanceof CellMergeOp) return transformCellMergeVsCellMerge((CellMergeOp) opA, mergeOp);
            // fontColor、bgColor、fontSize、fontBold、fontItalic、fontUnderline 在 merge 区域内重定向到主单元格
            if (opA instanceof FontColorOp) {
                FontColorOp result = cloneOp((FontColorOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof BgColorOp) {
                BgColorOp result = cloneOp((BgColorOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof FontSizeOp) {
                FontSizeOp result = cloneOp((FontSizeOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof FontBoldOp) {
                FontBoldOp result = cloneOp((FontBoldOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof FontItalicOp) {
                FontItalicOp result = cloneOp((FontItalicOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof FontUnderlineOp) {
                FontUnderlineOp result = cloneOp((FontUnderlineOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof VerticalAlignOp) {
                VerticalAlignOp result = cloneOp((VerticalAlignOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            // 其他类型不受 cellMerge 影响
            return cloneOp(opA);
        }

        // 默认：不受影响，返回克隆
        return cloneOp(opA);
    }

    // ============================================================
    // 公开 API
    // ============================================================

    /**
     * OT 转换函数：返回转换后的操作对 [a', b']
     * 数组第一个元素是 opA 相对于 opB 的转换结果
     * 数组第二个元素是 opB 相对于 opA 的转换结果
     */
    public static CollabOperation[] transform(CollabOperation opA, CollabOperation opB) {
        CollabOperation aPrime = transformSingle(opA, opB);
        CollabOperation bPrime = transformSingle(opB, opA);
        return new CollabOperation[]{aPrime, bPrime};
    }

    /**
     * 对操作列表执行转换：将 op 依次相对于 ops 中的每个操作进行转换
     * 如果中途被消除（返回 null），则整体返回 null
     */
    public static CollabOperation transformAgainst(CollabOperation op, List<CollabOperation> ops) {
        CollabOperation current = op;
        for (CollabOperation other : ops) {
            if (current == null) return null;
            CollabOperation[] result = transform(current, other);
            current = result[0];
        }
        return current;
    }
}
