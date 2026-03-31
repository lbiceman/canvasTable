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
     * 判断位置是否在拆分区域内
     */
    private static boolean isInSplitRange(int row, int col, CellSplitOp splitOp) {
        int rowSpan = splitOp.getRowSpan();
        int colSpan = splitOp.getColSpan();
        int endRow = splitOp.getRow() + rowSpan - 1;
        int endCol = splitOp.getCol() + colSpan - 1;
        return row >= splitOp.getRow() && row <= endRow
            && col >= splitOp.getCol() && col <= endCol;
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

    /**
     * 判断列是否在删除范围内
     */
    private static boolean isColInDeleteRange(int col, ColDeleteOp deleteOp) {
        return col >= deleteOp.getColIndex() && col < deleteOp.getColIndex() + deleteOp.getCount();
    }

    /**
     * 根据列插入操作调整列索引
     */
    private static int adjustColForInsert(int col, ColInsertOp insertOp) {
        return col >= insertOp.getColIndex() ? col + insertOp.getCount() : col;
    }

    /**
     * 根据列删除操作调整列索引，返回 null 表示该列被删除
     */
    private static Integer adjustColForDelete(int col, ColDeleteOp deleteOp) {
        if (isColInDeleteRange(col, deleteOp)) return null;
        if (col >= deleteOp.getColIndex() + deleteOp.getCount()) return col - deleteOp.getCount();
        return col;
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

    private static SetFormatOp transformSetFormatVsRowInsert(SetFormatOp op, RowInsertOp insertOp) {
        SetFormatOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static SetWrapTextOp transformSetWrapTextVsRowInsert(SetWrapTextOp op, RowInsertOp insertOp) {
        SetWrapTextOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static SetRichTextOp transformSetRichTextVsRowInsert(SetRichTextOp op, RowInsertOp insertOp) {
        SetRichTextOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static SetValidationOp transformSetValidationVsRowInsert(SetValidationOp op, RowInsertOp insertOp) {
        SetValidationOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static SetBorderOp transformSetBorderVsRowInsert(SetBorderOp op, RowInsertOp insertOp) {
        SetBorderOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static SetFontFamilyOp transformSetFontFamilyVsRowInsert(SetFontFamilyOp op, RowInsertOp insertOp) {
        SetFontFamilyOp result = cloneOp(op);
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        return result;
    }

    private static SetStrikethroughOp transformSetStrikethroughVsRowInsert(SetStrikethroughOp op, RowInsertOp insertOp) {
        SetStrikethroughOp result = cloneOp(op);
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

    private static SetFormatOp transformSetFormatVsRowDelete(SetFormatOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        SetFormatOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static SetWrapTextOp transformSetWrapTextVsRowDelete(SetWrapTextOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        SetWrapTextOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static SetRichTextOp transformSetRichTextVsRowDelete(SetRichTextOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        SetRichTextOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static SetValidationOp transformSetValidationVsRowDelete(SetValidationOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        SetValidationOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static SetBorderOp transformSetBorderVsRowDelete(SetBorderOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        SetBorderOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static SetFontFamilyOp transformSetFontFamilyVsRowDelete(SetFontFamilyOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        SetFontFamilyOp result = cloneOp(op);
        result.setRow(newRow);
        return result;
    }

    private static SetStrikethroughOp transformSetStrikethroughVsRowDelete(SetStrikethroughOp op, RowDeleteOp deleteOp) {
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        SetStrikethroughOp result = cloneOp(op);
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
    // 具体操作类型 vs ColInsert 的转换
    // ============================================================

    private static CellEditOp transformCellEditVsColInsert(CellEditOp op, ColInsertOp insertOp) {
        CellEditOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static CellMergeOp transformCellMergeVsColInsert(CellMergeOp op, ColInsertOp insertOp) {
        CellMergeOp result = cloneOp(op);
        if (op.getStartCol() >= insertOp.getColIndex()) {
            // 合并区域完全在插入点右侧，整体右移
            result.setStartCol(op.getStartCol() + insertOp.getCount());
            result.setEndCol(op.getEndCol() + insertOp.getCount());
        } else if (op.getEndCol() < insertOp.getColIndex()) {
            // 合并区域完全在插入点左侧，不变
        } else {
            // 插入点穿过合并区域，endCol 增加
            result.setEndCol(op.getEndCol() + insertOp.getCount());
        }
        return result;
    }

    private static CellSplitOp transformCellSplitVsColInsert(CellSplitOp op, ColInsertOp insertOp) {
        CellSplitOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static ColResizeOp transformColResizeVsColInsert(ColResizeOp op, ColInsertOp insertOp) {
        ColResizeOp result = cloneOp(op);
        result.setColIndex(adjustColForInsert(op.getColIndex(), insertOp));
        return result;
    }

    private static ColInsertOp transformColInsertVsColInsert(ColInsertOp opA, ColInsertOp opB) {
        ColInsertOp result = cloneOp(opA);
        if (opA.getColIndex() > opB.getColIndex()) {
            result.setColIndex(opA.getColIndex() + opB.getCount());
        }
        return result;
    }

    private static ColDeleteOp transformColDeleteVsColInsert(ColDeleteOp opA, ColInsertOp opB) {
        ColDeleteOp result = cloneOp(opA);
        if (opA.getColIndex() > opB.getColIndex()) {
            result.setColIndex(opA.getColIndex() + opB.getCount());
        }
        return result;
    }

    private static FontColorOp transformFontColorVsColInsert(FontColorOp op, ColInsertOp insertOp) {
        FontColorOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static BgColorOp transformBgColorVsColInsert(BgColorOp op, ColInsertOp insertOp) {
        BgColorOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static FontSizeOp transformFontSizeVsColInsert(FontSizeOp op, ColInsertOp insertOp) {
        FontSizeOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static FontBoldOp transformFontBoldVsColInsert(FontBoldOp op, ColInsertOp insertOp) {
        FontBoldOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static FontItalicOp transformFontItalicVsColInsert(FontItalicOp op, ColInsertOp insertOp) {
        FontItalicOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static FontUnderlineOp transformFontUnderlineVsColInsert(FontUnderlineOp op, ColInsertOp insertOp) {
        FontUnderlineOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static FontAlignOp transformFontAlignVsColInsert(FontAlignOp op, ColInsertOp insertOp) {
        FontAlignOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static VerticalAlignOp transformVerticalAlignVsColInsert(VerticalAlignOp op, ColInsertOp insertOp) {
        VerticalAlignOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static SetFormatOp transformSetFormatVsColInsert(SetFormatOp op, ColInsertOp insertOp) {
        SetFormatOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static SetWrapTextOp transformSetWrapTextVsColInsert(SetWrapTextOp op, ColInsertOp insertOp) {
        SetWrapTextOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static SetRichTextOp transformSetRichTextVsColInsert(SetRichTextOp op, ColInsertOp insertOp) {
        SetRichTextOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static SetValidationOp transformSetValidationVsColInsert(SetValidationOp op, ColInsertOp insertOp) {
        SetValidationOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static SetBorderOp transformSetBorderVsColInsert(SetBorderOp op, ColInsertOp insertOp) {
        SetBorderOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static SetFontFamilyOp transformSetFontFamilyVsColInsert(SetFontFamilyOp op, ColInsertOp insertOp) {
        SetFontFamilyOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    private static SetStrikethroughOp transformSetStrikethroughVsColInsert(SetStrikethroughOp op, ColInsertOp insertOp) {
        SetStrikethroughOp result = cloneOp(op);
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        return result;
    }

    // ============================================================
    // 具体操作类型 vs ColDelete 的转换
    // ============================================================

    private static CellEditOp transformCellEditVsColDelete(CellEditOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        CellEditOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static CellMergeOp transformCellMergeVsColDelete(CellMergeOp op, ColDeleteOp deleteOp) {
        int delEnd = deleteOp.getColIndex() + deleteOp.getCount();
        // 完全在删除范围内
        if (op.getStartCol() >= deleteOp.getColIndex() && op.getEndCol() < delEnd) return null;
        // 左侧部分重叠（startCol 在左，endCol 在删除范围内）
        if (op.getStartCol() < deleteOp.getColIndex() && op.getEndCol() >= deleteOp.getColIndex() && op.getEndCol() < delEnd) return null;
        // 右侧部分重叠（startCol 在删除范围内，endCol 在右）
        if (op.getStartCol() >= deleteOp.getColIndex() && op.getStartCol() < delEnd && op.getEndCol() >= delEnd) return null;
        // 删除范围完全在合并区域内部（合并区域收缩）
        if (op.getStartCol() < deleteOp.getColIndex() && delEnd <= op.getEndCol()) {
            CellMergeOp result = cloneOp(op);
            result.setEndCol(op.getEndCol() - deleteOp.getCount());
            return result;
        }
        // 合并区域完全在删除范围右侧
        if (op.getStartCol() >= delEnd) {
            CellMergeOp result = cloneOp(op);
            result.setStartCol(op.getStartCol() - deleteOp.getCount());
            result.setEndCol(op.getEndCol() - deleteOp.getCount());
            return result;
        }
        // 合并区域完全在删除范围左侧，不变
        return cloneOp(op);
    }

    private static CellSplitOp transformCellSplitVsColDelete(CellSplitOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        CellSplitOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static ColResizeOp transformColResizeVsColDelete(ColResizeOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getColIndex(), deleteOp);
        if (newCol == null) return null;
        ColResizeOp result = cloneOp(op);
        result.setColIndex(newCol);
        return result;
    }

    private static ColInsertOp transformColInsertVsColDelete(ColInsertOp opA, ColDeleteOp opB) {
        ColInsertOp result = cloneOp(opA);
        int delEnd = opB.getColIndex() + opB.getCount();
        if (opA.getColIndex() > delEnd) {
            result.setColIndex(opA.getColIndex() - opB.getCount());
        } else if (opA.getColIndex() <= opB.getColIndex()) {
            // 不变
        } else {
            result.setColIndex(opB.getColIndex());
        }
        return result;
    }

    private static ColDeleteOp transformColDeleteVsColDelete(ColDeleteOp opA, ColDeleteOp opB) {
        int origColIndex = opA.getColIndex();
        int origCount = opA.getCount();
        int aEnd = origColIndex + origCount;
        int bEnd = opB.getColIndex() + opB.getCount();

        // A 完全在 B 之后
        if (origColIndex >= bEnd) {
            ColDeleteOp result = cloneOp(opA);
            result.setColIndex(origColIndex - opB.getCount());
            return result;
        }
        // A 完全在 B 之前
        if (aEnd <= opB.getColIndex()) return cloneOp(opA);
        // A 被 B 完全包含
        if (origColIndex >= opB.getColIndex() && aEnd <= bEnd) return null;
        // A 完全包含 B
        if (origColIndex < opB.getColIndex() && aEnd > bEnd) {
            ColDeleteOp result = cloneOp(opA);
            result.setCount(origCount - opB.getCount());
            return result;
        }
        // A 的前部分与 B 重叠（A 左侧在 B 左侧，A 右侧在 B 内部）
        if (origColIndex < opB.getColIndex() && aEnd > opB.getColIndex() && aEnd <= bEnd) {
            ColDeleteOp result = cloneOp(opA);
            result.setCount(opB.getColIndex() - origColIndex);
            return result;
        }
        // A 的后部分与 B 重叠（A 左侧在 B 内部，A 右侧在 B 右侧）
        int newCount = aEnd - bEnd;
        ColDeleteOp result = cloneOp(opA);
        result.setColIndex(opB.getColIndex());
        result.setCount(newCount);
        return result;
    }

    private static FontColorOp transformFontColorVsColDelete(FontColorOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        FontColorOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static BgColorOp transformBgColorVsColDelete(BgColorOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        BgColorOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static FontSizeOp transformFontSizeVsColDelete(FontSizeOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        FontSizeOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static FontBoldOp transformFontBoldVsColDelete(FontBoldOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        FontBoldOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static FontItalicOp transformFontItalicVsColDelete(FontItalicOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        FontItalicOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static FontUnderlineOp transformFontUnderlineVsColDelete(FontUnderlineOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        FontUnderlineOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static FontAlignOp transformFontAlignVsColDelete(FontAlignOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        FontAlignOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static VerticalAlignOp transformVerticalAlignVsColDelete(VerticalAlignOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        VerticalAlignOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static SetFormatOp transformSetFormatVsColDelete(SetFormatOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        SetFormatOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static SetWrapTextOp transformSetWrapTextVsColDelete(SetWrapTextOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        SetWrapTextOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static SetRichTextOp transformSetRichTextVsColDelete(SetRichTextOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        SetRichTextOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static SetValidationOp transformSetValidationVsColDelete(SetValidationOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        SetValidationOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static SetBorderOp transformSetBorderVsColDelete(SetBorderOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        SetBorderOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static SetFontFamilyOp transformSetFontFamilyVsColDelete(SetFontFamilyOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        SetFontFamilyOp result = cloneOp(op);
        result.setCol(newCol);
        return result;
    }

    private static SetStrikethroughOp transformSetStrikethroughVsColDelete(SetStrikethroughOp op, ColDeleteOp deleteOp) {
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        SetStrikethroughOp result = cloneOp(op);
        result.setCol(newCol);
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
    // CellSplit 相关转换函数
    // ============================================================

    private static CellEditOp transformCellEditVsCellSplit(CellEditOp editOp, CellSplitOp splitOp) {
        CellEditOp result = cloneOp(editOp);
        if (isInSplitRange(editOp.getRow(), editOp.getCol(), splitOp)) {
            result.setRow(splitOp.getRow());
            result.setCol(splitOp.getCol());
        }
        return result;
    }

    private static CellMergeOp transformCellMergeVsCellSplit(CellMergeOp mergeOp, CellSplitOp splitOp) {
        int splitEndRow = splitOp.getRow() + splitOp.getRowSpan() - 1;
        int splitEndCol = splitOp.getCol() + splitOp.getColSpan() - 1;
        boolean overlaps =
                mergeOp.getStartRow() <= splitEndRow && mergeOp.getEndRow() >= splitOp.getRow()
                        && mergeOp.getStartCol() <= splitEndCol && mergeOp.getEndCol() >= splitOp.getCol();
        return overlaps ? null : cloneOp(mergeOp);
    }

    private static CellSplitOp transformCellSplitVsCellSplit(CellSplitOp opA, CellSplitOp opB) {
        if (opA.getRow() == opB.getRow() && opA.getCol() == opB.getCol()) {
            return null;
        }
        return cloneOp(opA);
    }

    private static CellSplitOp transformCellSplitVsCellEdit(CellSplitOp splitOp, CellEditOp editOp) {
        return cloneOp(splitOp);
    }

    private static CellSplitOp transformCellSplitVsCellMerge(CellSplitOp splitOp, CellMergeOp mergeOp) {
        if (isInMergeRange(splitOp.getRow(), splitOp.getCol(), mergeOp)) {
            return null;
        }
        return cloneOp(splitOp);
    }

    // ============================================================
    // DataRange 调整辅助方法（用于图表和迷你图操作）
    // ============================================================

    /**
     * 根据行插入操作调整 DataRange 的行索引
     */
    private static DataRange adjustDataRangeForRowInsert(DataRange range, int rowIndex, int count) {
        if (range == null) return null;
        int startRow = range.getStartRow();
        int endRow = range.getEndRow();
        if (rowIndex <= startRow) {
            // 插入点在范围之前或起始位置，整体下移
            startRow += count;
            endRow += count;
        } else if (rowIndex <= endRow) {
            // 插入点在范围内部，扩展 endRow
            endRow += count;
        }
        // 插入点在范围之后，不变
        return new DataRange(startRow, range.getStartCol(), endRow, range.getEndCol());
    }

    /**
     * 根据行删除操作调整 DataRange 的行索引
     */
    private static DataRange adjustDataRangeForRowDelete(DataRange range, int rowIndex, int count) {
        if (range == null) return null;
        int startRow = range.getStartRow();
        int endRow = range.getEndRow();
        int delEnd = rowIndex + count;
        if (rowIndex <= startRow) {
            // 删除点在范围之前或起始位置，整体上移
            startRow = Math.max(rowIndex, startRow - count);
            endRow = Math.max(startRow, endRow - count);
        } else if (rowIndex <= endRow) {
            // 删除点在范围内部，收缩 endRow
            endRow = Math.max(startRow, endRow - Math.min(count, endRow - rowIndex + 1));
        }
        // 删除点在范围之后，不变
        return new DataRange(startRow, range.getStartCol(), endRow, range.getEndCol());
    }

    /**
     * 根据列插入操作调整 DataRange 的列索引
     */
    private static DataRange adjustDataRangeForColInsert(DataRange range, int colIndex, int count) {
        if (range == null) return null;
        int startCol = range.getStartCol();
        int endCol = range.getEndCol();
        if (colIndex <= startCol) {
            // 插入点在范围之前或起始位置，整体右移
            startCol += count;
            endCol += count;
        } else if (colIndex <= endCol) {
            // 插入点在范围内部，扩展 endCol
            endCol += count;
        }
        // 插入点在范围之后，不变
        return new DataRange(range.getStartRow(), startCol, range.getEndRow(), endCol);
    }

    /**
     * 根据列删除操作调整 DataRange 的列索引
     */
    private static DataRange adjustDataRangeForColDelete(DataRange range, int colIndex, int count) {
        if (range == null) return null;
        int startCol = range.getStartCol();
        int endCol = range.getEndCol();
        int delEnd = colIndex + count;
        if (colIndex <= startCol) {
            // 删除点在范围之前或起始位置，整体左移
            startCol = Math.max(colIndex, startCol - count);
            endCol = Math.max(startCol, endCol - count);
        } else if (colIndex <= endCol) {
            // 删除点在范围内部，收缩 endCol
            endCol = Math.max(startCol, endCol - Math.min(count, endCol - colIndex + 1));
        }
        // 删除点在范围之后，不变
        return new DataRange(range.getStartRow(), startCol, range.getEndRow(), endCol);
    }

    /**
     * 克隆 ChartConfigData 并替换 dataRange
     */
    private static ChartConfigData cloneChartConfigWithDataRange(ChartConfigData config, DataRange newRange) {
        ChartConfigData cloned = new ChartConfigData(
            config.getId(), config.getType(), newRange,
            config.getPosition(), config.getSize(),
            config.getTitle(), config.getLegend(),
            config.getAxes(), config.getDataLabels()
        );
        return cloned;
    }

    // ============================================================
    // ChartCreateOp 的 OT 变换
    // ============================================================

    private static ChartCreateOp transformChartCreateVsRowInsert(ChartCreateOp op, RowInsertOp insertOp) {
        ChartConfigData config = op.getChartConfig();
        if (config == null || config.getDataRange() == null) return cloneOp(op);
        DataRange adjusted = adjustDataRangeForRowInsert(config.getDataRange(), insertOp.getRowIndex(), insertOp.getCount());
        ChartCreateOp result = cloneOp(op);
        result.setChartConfig(cloneChartConfigWithDataRange(config, adjusted));
        return result;
    }

    private static ChartCreateOp transformChartCreateVsRowDelete(ChartCreateOp op, RowDeleteOp deleteOp) {
        ChartConfigData config = op.getChartConfig();
        if (config == null || config.getDataRange() == null) return cloneOp(op);
        DataRange adjusted = adjustDataRangeForRowDelete(config.getDataRange(), deleteOp.getRowIndex(), deleteOp.getCount());
        ChartCreateOp result = cloneOp(op);
        result.setChartConfig(cloneChartConfigWithDataRange(config, adjusted));
        return result;
    }

    private static ChartCreateOp transformChartCreateVsColInsert(ChartCreateOp op, ColInsertOp insertOp) {
        ChartConfigData config = op.getChartConfig();
        if (config == null || config.getDataRange() == null) return cloneOp(op);
        DataRange adjusted = adjustDataRangeForColInsert(config.getDataRange(), insertOp.getColIndex(), insertOp.getCount());
        ChartCreateOp result = cloneOp(op);
        result.setChartConfig(cloneChartConfigWithDataRange(config, adjusted));
        return result;
    }

    private static ChartCreateOp transformChartCreateVsColDelete(ChartCreateOp op, ColDeleteOp deleteOp) {
        ChartConfigData config = op.getChartConfig();
        if (config == null || config.getDataRange() == null) return cloneOp(op);
        DataRange adjusted = adjustDataRangeForColDelete(config.getDataRange(), deleteOp.getColIndex(), deleteOp.getCount());
        ChartCreateOp result = cloneOp(op);
        result.setChartConfig(cloneChartConfigWithDataRange(config, adjusted));
        return result;
    }

    /**
     * ChartCreateOp vs ChartDeleteOp：同 chartId 时取消创建
     */
    private static CollabOperation transformChartCreateVsChartDelete(ChartCreateOp createOp, ChartDeleteOp deleteOp) {
        if (createOp.getChartConfig() != null
                && createOp.getChartConfig().getId() != null
                && createOp.getChartConfig().getId().equals(deleteOp.getChartId())) {
            return null; // 取消创建
        }
        return cloneOp(createOp);
    }

    // ============================================================
    // ChartUpdateOp 的 OT 变换
    // ============================================================

    private static ChartUpdateOp transformChartUpdateVsRowInsert(ChartUpdateOp op, RowInsertOp insertOp) {
        ChartConfigData config = op.getChartConfig();
        if (config == null || config.getDataRange() == null) return cloneOp(op);
        DataRange adjusted = adjustDataRangeForRowInsert(config.getDataRange(), insertOp.getRowIndex(), insertOp.getCount());
        ChartUpdateOp result = cloneOp(op);
        result.setChartConfig(cloneChartConfigWithDataRange(config, adjusted));
        return result;
    }

    private static ChartUpdateOp transformChartUpdateVsRowDelete(ChartUpdateOp op, RowDeleteOp deleteOp) {
        ChartConfigData config = op.getChartConfig();
        if (config == null || config.getDataRange() == null) return cloneOp(op);
        DataRange adjusted = adjustDataRangeForRowDelete(config.getDataRange(), deleteOp.getRowIndex(), deleteOp.getCount());
        ChartUpdateOp result = cloneOp(op);
        result.setChartConfig(cloneChartConfigWithDataRange(config, adjusted));
        return result;
    }

    private static ChartUpdateOp transformChartUpdateVsColInsert(ChartUpdateOp op, ColInsertOp insertOp) {
        ChartConfigData config = op.getChartConfig();
        if (config == null || config.getDataRange() == null) return cloneOp(op);
        DataRange adjusted = adjustDataRangeForColInsert(config.getDataRange(), insertOp.getColIndex(), insertOp.getCount());
        ChartUpdateOp result = cloneOp(op);
        result.setChartConfig(cloneChartConfigWithDataRange(config, adjusted));
        return result;
    }

    private static ChartUpdateOp transformChartUpdateVsColDelete(ChartUpdateOp op, ColDeleteOp deleteOp) {
        ChartConfigData config = op.getChartConfig();
        if (config == null || config.getDataRange() == null) return cloneOp(op);
        DataRange adjusted = adjustDataRangeForColDelete(config.getDataRange(), deleteOp.getColIndex(), deleteOp.getCount());
        ChartUpdateOp result = cloneOp(op);
        result.setChartConfig(cloneChartConfigWithDataRange(config, adjusted));
        return result;
    }

    /**
     * ChartUpdateOp vs ChartDeleteOp：同 chartId 时取消更新
     */
    private static CollabOperation transformChartUpdateVsChartDelete(ChartUpdateOp updateOp, ChartDeleteOp deleteOp) {
        if (updateOp.getChartId() != null && updateOp.getChartId().equals(deleteOp.getChartId())) {
            return null; // 取消更新
        }
        return cloneOp(updateOp);
    }

    // ============================================================
    // SetSparklineOp 的 OT 变换
    // ============================================================

    private static SetSparklineOp transformSetSparklineVsRowInsert(SetSparklineOp op, RowInsertOp insertOp) {
        SetSparklineOp result = cloneOp(op);
        // 调整 row 索引（与 CellEditOp 相同逻辑）
        result.setRow(adjustRowForInsert(op.getRow(), insertOp));
        // 调整 sparkline.dataRange 的行索引
        if (op.getSparkline() != null && op.getSparkline().getDataRange() != null) {
            SparklineConfigData sparkline = result.getSparkline();
            DataRange adjusted = adjustDataRangeForRowInsert(sparkline.getDataRange(), insertOp.getRowIndex(), insertOp.getCount());
            sparkline.setDataRange(adjusted);
        }
        return result;
    }

    private static CollabOperation transformSetSparklineVsRowDelete(SetSparklineOp op, RowDeleteOp deleteOp) {
        // 调整 row 索引，如果行被删除则取消操作
        Integer newRow = adjustRowForDelete(op.getRow(), deleteOp);
        if (newRow == null) return null;
        SetSparklineOp result = cloneOp(op);
        result.setRow(newRow);
        // 调整 sparkline.dataRange 的行索引
        if (op.getSparkline() != null && op.getSparkline().getDataRange() != null) {
            SparklineConfigData sparkline = result.getSparkline();
            DataRange adjusted = adjustDataRangeForRowDelete(sparkline.getDataRange(), deleteOp.getRowIndex(), deleteOp.getCount());
            sparkline.setDataRange(adjusted);
        }
        return result;
    }

    private static SetSparklineOp transformSetSparklineVsColInsert(SetSparklineOp op, ColInsertOp insertOp) {
        SetSparklineOp result = cloneOp(op);
        // 调整 col 索引
        result.setCol(adjustColForInsert(op.getCol(), insertOp));
        // 调整 sparkline.dataRange 的列索引
        if (op.getSparkline() != null && op.getSparkline().getDataRange() != null) {
            SparklineConfigData sparkline = result.getSparkline();
            DataRange adjusted = adjustDataRangeForColInsert(sparkline.getDataRange(), insertOp.getColIndex(), insertOp.getCount());
            sparkline.setDataRange(adjusted);
        }
        return result;
    }

    private static CollabOperation transformSetSparklineVsColDelete(SetSparklineOp op, ColDeleteOp deleteOp) {
        // 调整 col 索引，如果列被删除则取消操作
        Integer newCol = adjustColForDelete(op.getCol(), deleteOp);
        if (newCol == null) return null;
        SetSparklineOp result = cloneOp(op);
        result.setCol(newCol);
        // 调整 sparkline.dataRange 的列索引
        if (op.getSparkline() != null && op.getSparkline().getDataRange() != null) {
            SparklineConfigData sparkline = result.getSparkline();
            DataRange adjusted = adjustDataRangeForColDelete(sparkline.getDataRange(), deleteOp.getColIndex(), deleteOp.getCount());
            sparkline.setDataRange(adjusted);
        }
        return result;
    }

    // ============================================================
    // 核心 transformSingle 函数
    // ============================================================

    /**
     * 对两个操作执行单向转换：将 opA 相对于 opB 进行转换
     */
    private static CollabOperation transformSingle(CollabOperation opA, CollabOperation opB) {
        // Sheet 级操作的 OT 转换规则
        // 不同 sheetId 的操作之间无需转换（天然隔离）
        if (opA.getSheetId() != null && opB.getSheetId() != null
                && !opA.getSheetId().equals(opB.getSheetId())) {
            return cloneOp(opA);
        }

        // SheetDeleteOp 消除同 Sheet 的所有后续操作
        if (opB instanceof SheetDeleteOp) {
            String deletedId = ((SheetDeleteOp) opB).getSheetId();
            if (deletedId != null && deletedId.equals(opA.getSheetId())) {
                return null; // 操作被消除
            }
            return cloneOp(opA);
        }

        // Sheet 级操作之间：同 Sheet 的 SheetRenameOp 后者覆盖前者
        if (opA instanceof SheetRenameOp && opB instanceof SheetRenameOp) {
            SheetRenameOp renameA = (SheetRenameOp) opA;
            SheetRenameOp renameB = (SheetRenameOp) opB;
            if (renameA.getSheetId() != null && renameA.getSheetId().equals(renameB.getSheetId())) {
                // 后者覆盖前者：更新 opA 的 oldName 为 opB 的 newName
                SheetRenameOp result = cloneOp(renameA);
                result.setOldName(renameB.getNewName());
                return result;
            }
            return cloneOp(opA);
        }

        // 其他 Sheet 级操作之间无冲突
        if (opA instanceof SheetAddOp || opA instanceof SheetDeleteOp
                || opA instanceof SheetRenameOp || opA instanceof SheetReorderOp
                || opA instanceof SheetDuplicateOp || opA instanceof SheetVisibilityOp
                || opA instanceof SheetTabColorOp) {
            return cloneOp(opA);
        }
        if (opB instanceof SheetAddOp || opB instanceof SheetRenameOp
                || opB instanceof SheetReorderOp || opB instanceof SheetDuplicateOp
                || opB instanceof SheetVisibilityOp || opB instanceof SheetTabColorOp) {
            return cloneOp(opA);
        }

        // opB 是 colInsert
        if (opB instanceof ColInsertOp) {
            ColInsertOp insertOp = (ColInsertOp) opB;
            if (opA instanceof CellEditOp) return transformCellEditVsColInsert((CellEditOp) opA, insertOp);
            if (opA instanceof CellMergeOp) return transformCellMergeVsColInsert((CellMergeOp) opA, insertOp);
            if (opA instanceof CellSplitOp) return transformCellSplitVsColInsert((CellSplitOp) opA, insertOp);
            if (opA instanceof ColResizeOp) return transformColResizeVsColInsert((ColResizeOp) opA, insertOp);
            if (opA instanceof RowInsertOp) return cloneOp(opA); // 行列独立
            if (opA instanceof RowDeleteOp) return cloneOp(opA); // 行列独立
            if (opA instanceof RowResizeOp) return cloneOp(opA); // 行列独立
            if (opA instanceof ColInsertOp) return transformColInsertVsColInsert((ColInsertOp) opA, insertOp);
            if (opA instanceof ColDeleteOp) return transformColDeleteVsColInsert((ColDeleteOp) opA, insertOp);
            if (opA instanceof FontColorOp) return transformFontColorVsColInsert((FontColorOp) opA, insertOp);
            if (opA instanceof BgColorOp) return transformBgColorVsColInsert((BgColorOp) opA, insertOp);
            if (opA instanceof FontSizeOp) return transformFontSizeVsColInsert((FontSizeOp) opA, insertOp);
            if (opA instanceof FontBoldOp) return transformFontBoldVsColInsert((FontBoldOp) opA, insertOp);
            if (opA instanceof FontItalicOp) return transformFontItalicVsColInsert((FontItalicOp) opA, insertOp);
            if (opA instanceof FontUnderlineOp) return transformFontUnderlineVsColInsert((FontUnderlineOp) opA, insertOp);
            if (opA instanceof FontAlignOp) return transformFontAlignVsColInsert((FontAlignOp) opA, insertOp);
            if (opA instanceof VerticalAlignOp) return transformVerticalAlignVsColInsert((VerticalAlignOp) opA, insertOp);
            if (opA instanceof SetFormatOp) return transformSetFormatVsColInsert((SetFormatOp) opA, insertOp);
            if (opA instanceof SetWrapTextOp) return transformSetWrapTextVsColInsert((SetWrapTextOp) opA, insertOp);
            if (opA instanceof SetRichTextOp) return transformSetRichTextVsColInsert((SetRichTextOp) opA, insertOp);
            if (opA instanceof SetValidationOp) return transformSetValidationVsColInsert((SetValidationOp) opA, insertOp);
            if (opA instanceof SetBorderOp) return transformSetBorderVsColInsert((SetBorderOp) opA, insertOp);
            if (opA instanceof SetFontFamilyOp) return transformSetFontFamilyVsColInsert((SetFontFamilyOp) opA, insertOp);
            if (opA instanceof SetStrikethroughOp) return transformSetStrikethroughVsColInsert((SetStrikethroughOp) opA, insertOp);
            // 图表操作 vs ColInsert
            if (opA instanceof ChartCreateOp) return transformChartCreateVsColInsert((ChartCreateOp) opA, insertOp);
            if (opA instanceof ChartUpdateOp) return transformChartUpdateVsColInsert((ChartUpdateOp) opA, insertOp);
            if (opA instanceof ChartDeleteOp) return cloneOp(opA); // 删除操作不受影响
            if (opA instanceof SetSparklineOp) return transformSetSparklineVsColInsert((SetSparklineOp) opA, insertOp);
        }

        // opB 是 colDelete
        if (opB instanceof ColDeleteOp) {
            ColDeleteOp deleteOp = (ColDeleteOp) opB;
            if (opA instanceof CellEditOp) return transformCellEditVsColDelete((CellEditOp) opA, deleteOp);
            if (opA instanceof CellMergeOp) return transformCellMergeVsColDelete((CellMergeOp) opA, deleteOp);
            if (opA instanceof CellSplitOp) return transformCellSplitVsColDelete((CellSplitOp) opA, deleteOp);
            if (opA instanceof ColResizeOp) return transformColResizeVsColDelete((ColResizeOp) opA, deleteOp);
            if (opA instanceof RowInsertOp) return cloneOp(opA); // 行列独立
            if (opA instanceof RowDeleteOp) return cloneOp(opA); // 行列独立
            if (opA instanceof RowResizeOp) return cloneOp(opA); // 行列独立
            if (opA instanceof ColInsertOp) return transformColInsertVsColDelete((ColInsertOp) opA, deleteOp);
            if (opA instanceof ColDeleteOp) return transformColDeleteVsColDelete((ColDeleteOp) opA, deleteOp);
            if (opA instanceof FontColorOp) return transformFontColorVsColDelete((FontColorOp) opA, deleteOp);
            if (opA instanceof BgColorOp) return transformBgColorVsColDelete((BgColorOp) opA, deleteOp);
            if (opA instanceof FontSizeOp) return transformFontSizeVsColDelete((FontSizeOp) opA, deleteOp);
            if (opA instanceof FontBoldOp) return transformFontBoldVsColDelete((FontBoldOp) opA, deleteOp);
            if (opA instanceof FontItalicOp) return transformFontItalicVsColDelete((FontItalicOp) opA, deleteOp);
            if (opA instanceof FontUnderlineOp) return transformFontUnderlineVsColDelete((FontUnderlineOp) opA, deleteOp);
            if (opA instanceof FontAlignOp) return transformFontAlignVsColDelete((FontAlignOp) opA, deleteOp);
            if (opA instanceof VerticalAlignOp) return transformVerticalAlignVsColDelete((VerticalAlignOp) opA, deleteOp);
            if (opA instanceof SetFormatOp) return transformSetFormatVsColDelete((SetFormatOp) opA, deleteOp);
            if (opA instanceof SetWrapTextOp) return transformSetWrapTextVsColDelete((SetWrapTextOp) opA, deleteOp);
            if (opA instanceof SetRichTextOp) return transformSetRichTextVsColDelete((SetRichTextOp) opA, deleteOp);
            if (opA instanceof SetValidationOp) return transformSetValidationVsColDelete((SetValidationOp) opA, deleteOp);
            if (opA instanceof SetBorderOp) return transformSetBorderVsColDelete((SetBorderOp) opA, deleteOp);
            if (opA instanceof SetFontFamilyOp) return transformSetFontFamilyVsColDelete((SetFontFamilyOp) opA, deleteOp);
            if (opA instanceof SetStrikethroughOp) return transformSetStrikethroughVsColDelete((SetStrikethroughOp) opA, deleteOp);
            // 图表操作 vs ColDelete
            if (opA instanceof ChartCreateOp) return transformChartCreateVsColDelete((ChartCreateOp) opA, deleteOp);
            if (opA instanceof ChartUpdateOp) return transformChartUpdateVsColDelete((ChartUpdateOp) opA, deleteOp);
            if (opA instanceof ChartDeleteOp) return cloneOp(opA); // 删除操作不受影响
            if (opA instanceof SetSparklineOp) return transformSetSparklineVsColDelete((SetSparklineOp) opA, deleteOp);
        }

        // opB 是 colResize 时，不影响其他操作
        if (opB instanceof ColResizeOp) {
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
            if (opA instanceof SetFormatOp) return transformSetFormatVsRowInsert((SetFormatOp) opA, insertOp);
            if (opA instanceof SetWrapTextOp) return transformSetWrapTextVsRowInsert((SetWrapTextOp) opA, insertOp);
            if (opA instanceof SetRichTextOp) return transformSetRichTextVsRowInsert((SetRichTextOp) opA, insertOp);
            if (opA instanceof SetValidationOp) return transformSetValidationVsRowInsert((SetValidationOp) opA, insertOp);
            if (opA instanceof SetBorderOp) return transformSetBorderVsRowInsert((SetBorderOp) opA, insertOp);
            if (opA instanceof SetFontFamilyOp) return transformSetFontFamilyVsRowInsert((SetFontFamilyOp) opA, insertOp);
            if (opA instanceof SetStrikethroughOp) return transformSetStrikethroughVsRowInsert((SetStrikethroughOp) opA, insertOp);
            // 图表操作 vs RowInsert
            if (opA instanceof ChartCreateOp) return transformChartCreateVsRowInsert((ChartCreateOp) opA, insertOp);
            if (opA instanceof ChartUpdateOp) return transformChartUpdateVsRowInsert((ChartUpdateOp) opA, insertOp);
            if (opA instanceof ChartDeleteOp) return cloneOp(opA); // 删除操作不受影响
            if (opA instanceof SetSparklineOp) return transformSetSparklineVsRowInsert((SetSparklineOp) opA, insertOp);
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
            if (opA instanceof SetFormatOp) return transformSetFormatVsRowDelete((SetFormatOp) opA, deleteOp);
            if (opA instanceof SetWrapTextOp) return transformSetWrapTextVsRowDelete((SetWrapTextOp) opA, deleteOp);
            if (opA instanceof SetRichTextOp) return transformSetRichTextVsRowDelete((SetRichTextOp) opA, deleteOp);
            if (opA instanceof SetValidationOp) return transformSetValidationVsRowDelete((SetValidationOp) opA, deleteOp);
            if (opA instanceof SetBorderOp) return transformSetBorderVsRowDelete((SetBorderOp) opA, deleteOp);
            if (opA instanceof SetFontFamilyOp) return transformSetFontFamilyVsRowDelete((SetFontFamilyOp) opA, deleteOp);
            if (opA instanceof SetStrikethroughOp) return transformSetStrikethroughVsRowDelete((SetStrikethroughOp) opA, deleteOp);
            // 图表操作 vs RowDelete
            if (opA instanceof ChartCreateOp) return transformChartCreateVsRowDelete((ChartCreateOp) opA, deleteOp);
            if (opA instanceof ChartUpdateOp) return transformChartUpdateVsRowDelete((ChartUpdateOp) opA, deleteOp);
            if (opA instanceof ChartDeleteOp) return cloneOp(opA); // 删除操作不受影响
            if (opA instanceof SetSparklineOp) return transformSetSparklineVsRowDelete((SetSparklineOp) opA, deleteOp);
        }

        // opB 是 cellEdit
        if (opB instanceof CellEditOp) {
            if (opA instanceof CellEditOp) return transformCellEditVsCellEdit((CellEditOp) opA, (CellEditOp) opB);
            if (opA instanceof CellSplitOp) return transformCellSplitVsCellEdit((CellSplitOp) opA, (CellEditOp) opB);
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
            if (opA instanceof FontAlignOp) {
                FontAlignOp result = cloneOp((FontAlignOp) opA);
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
            if (opA instanceof SetFormatOp) {
                SetFormatOp result = cloneOp((SetFormatOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof SetWrapTextOp) {
                SetWrapTextOp result = cloneOp((SetWrapTextOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof SetRichTextOp) {
                SetRichTextOp result = cloneOp((SetRichTextOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof SetValidationOp) {
                SetValidationOp result = cloneOp((SetValidationOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof SetBorderOp) {
                SetBorderOp result = cloneOp((SetBorderOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof SetFontFamilyOp) {
                SetFontFamilyOp result = cloneOp((SetFontFamilyOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof SetStrikethroughOp) {
                SetStrikethroughOp result = cloneOp((SetStrikethroughOp) opA);
                if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
                    result.setRow(mergeOp.getStartRow());
                    result.setCol(mergeOp.getStartCol());
                }
                return result;
            }
            if (opA instanceof CellSplitOp) {
                return transformCellSplitVsCellMerge((CellSplitOp) opA, mergeOp);
            }
            // 其他类型不受 cellMerge 影响
            return cloneOp(opA);
        }

        // opB 是 cellSplit
        if (opB instanceof CellSplitOp) {
            CellSplitOp splitOp = (CellSplitOp) opB;
            if (opA instanceof CellEditOp) return transformCellEditVsCellSplit((CellEditOp) opA, splitOp);
            if (opA instanceof CellMergeOp) return transformCellMergeVsCellSplit((CellMergeOp) opA, splitOp);
            if (opA instanceof CellSplitOp) return transformCellSplitVsCellSplit((CellSplitOp) opA, splitOp);
            if (opA instanceof FontColorOp) {
                FontColorOp result = cloneOp((FontColorOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof BgColorOp) {
                BgColorOp result = cloneOp((BgColorOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof FontSizeOp) {
                FontSizeOp result = cloneOp((FontSizeOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof FontBoldOp) {
                FontBoldOp result = cloneOp((FontBoldOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof FontItalicOp) {
                FontItalicOp result = cloneOp((FontItalicOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof FontUnderlineOp) {
                FontUnderlineOp result = cloneOp((FontUnderlineOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof FontAlignOp) {
                FontAlignOp result = cloneOp((FontAlignOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof VerticalAlignOp) {
                VerticalAlignOp result = cloneOp((VerticalAlignOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof SetFormatOp) {
                SetFormatOp result = cloneOp((SetFormatOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof SetWrapTextOp) {
                SetWrapTextOp result = cloneOp((SetWrapTextOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof SetRichTextOp) {
                SetRichTextOp result = cloneOp((SetRichTextOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof SetValidationOp) {
                SetValidationOp result = cloneOp((SetValidationOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof SetBorderOp) {
                SetBorderOp result = cloneOp((SetBorderOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof SetFontFamilyOp) {
                SetFontFamilyOp result = cloneOp((SetFontFamilyOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            if (opA instanceof SetStrikethroughOp) {
                SetStrikethroughOp result = cloneOp((SetStrikethroughOp) opA);
                if (isInSplitRange(result.getRow(), result.getCol(), splitOp)) {
                    result.setRow(splitOp.getRow());
                    result.setCol(splitOp.getCol());
                }
                return result;
            }
            // rowInsert/rowDelete/rowResize/colResize 不受 cellSplit 影响
            return cloneOp(opA);
        }

        // opB 是 setFormat：同一单元格的 setFormat 冲突，服务端操作优先
        if (opB instanceof SetFormatOp) {
            SetFormatOp formatOp = (SetFormatOp) opB;
            if (opA instanceof SetFormatOp) {
                SetFormatOp a = (SetFormatOp) opA;
                if (a.getRow() == formatOp.getRow() && a.getCol() == formatOp.getCol()) {
                    return null; // 服务端操作优先，客户端操作被丢弃
                }
            }
            return cloneOp(opA);
        }

        // opB 是 setWrapText：同一单元格的 setWrapText 冲突，服务端操作优先
        if (opB instanceof SetWrapTextOp) {
            SetWrapTextOp wrapOp = (SetWrapTextOp) opB;
            if (opA instanceof SetWrapTextOp) {
                SetWrapTextOp a = (SetWrapTextOp) opA;
                if (a.getRow() == wrapOp.getRow() && a.getCol() == wrapOp.getCol()) {
                    return null;
                }
            }
            return cloneOp(opA);
        }

        // opB 是 setRichText：同一单元格的 setRichText 冲突，服务端操作优先
        if (opB instanceof SetRichTextOp) {
            SetRichTextOp richOp = (SetRichTextOp) opB;
            if (opA instanceof SetRichTextOp) {
                SetRichTextOp a = (SetRichTextOp) opA;
                if (a.getRow() == richOp.getRow() && a.getCol() == richOp.getCol()) {
                    return null;
                }
            }
            return cloneOp(opA);
        }

        // opB 是 setValidation：同一单元格的 setValidation 冲突，服务端操作优先
        if (opB instanceof SetValidationOp) {
            SetValidationOp valOp = (SetValidationOp) opB;
            if (opA instanceof SetValidationOp) {
                SetValidationOp a = (SetValidationOp) opA;
                if (a.getRow() == valOp.getRow() && a.getCol() == valOp.getCol()) {
                    return null;
                }
            }
            return cloneOp(opA);
        }

        // opB 是 setBorder：同一单元格的 setBorder 冲突，服务端操作优先
        if (opB instanceof SetBorderOp) {
            SetBorderOp borderOp = (SetBorderOp) opB;
            if (opA instanceof SetBorderOp) {
                SetBorderOp a = (SetBorderOp) opA;
                if (a.getRow() == borderOp.getRow() && a.getCol() == borderOp.getCol()) {
                    return null;
                }
            }
            return cloneOp(opA);
        }

        // opB 是 setFontFamily：同一单元格的 setFontFamily 冲突，服务端操作优先
        if (opB instanceof SetFontFamilyOp) {
            SetFontFamilyOp fontFamilyOp = (SetFontFamilyOp) opB;
            if (opA instanceof SetFontFamilyOp) {
                SetFontFamilyOp a = (SetFontFamilyOp) opA;
                if (a.getRow() == fontFamilyOp.getRow() && a.getCol() == fontFamilyOp.getCol()) {
                    return null;
                }
            }
            return cloneOp(opA);
        }

        // opB 是 setStrikethrough：同一单元格的 setStrikethrough 冲突，服务端操作优先
        if (opB instanceof SetStrikethroughOp) {
            SetStrikethroughOp strikethroughOp = (SetStrikethroughOp) opB;
            if (opA instanceof SetStrikethroughOp) {
                SetStrikethroughOp a = (SetStrikethroughOp) opA;
                if (a.getRow() == strikethroughOp.getRow() && a.getCol() == strikethroughOp.getCol()) {
                    return null;
                }
            }
            return cloneOp(opA);
        }

        // opB 是 chartDelete：图表创建/更新操作与同 chartId 的删除操作冲突时取消
        if (opB instanceof ChartDeleteOp) {
            ChartDeleteOp deleteOp = (ChartDeleteOp) opB;
            if (opA instanceof ChartCreateOp) return transformChartCreateVsChartDelete((ChartCreateOp) opA, deleteOp);
            if (opA instanceof ChartUpdateOp) return transformChartUpdateVsChartDelete((ChartUpdateOp) opA, deleteOp);
            if (opA instanceof ChartDeleteOp) return cloneOp(opA); // 两个删除互不影响
            return cloneOp(opA);
        }

        // opB 是 chartCreate/chartUpdate/setSparkline：不影响其他操作
        if (opB instanceof ChartCreateOp || opB instanceof ChartUpdateOp || opB instanceof SetSparklineOp) {
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
