package com.iceexcel.server.service;

import com.iceexcel.server.model.*;

import java.util.ArrayList;
import java.util.List;

/**
 * 文档操作应用工具类（无状态）
 * 将协同操作应用到文档快照上，保持文档状态与操作历史同步。
 * 从 server/src/room-manager.ts 的 applyOperationToDocument 函数翻译。
 */
public class DocumentApplier {

    // 默认行高和列宽
    private static final int DEFAULT_ROW_HEIGHT = 28;
    private static final int DEFAULT_COLS = 26;

    /**
     * 将操作应用到文档快照
     */
    public static void apply(SpreadsheetData document, CollabOperation op) {
        List<List<Cell>> cells = document.getCells();
        List<Integer> rowHeights = document.getRowHeights();
        List<Integer> colWidths = document.getColWidths();

        if (op instanceof CellEditOp) {
            applyCellEdit(cells, (CellEditOp) op);
        } else if (op instanceof CellMergeOp) {
            applyCellMerge(cells, (CellMergeOp) op);
        } else if (op instanceof CellSplitOp) {
            applyCellSplit(cells, (CellSplitOp) op);
        } else if (op instanceof RowInsertOp) {
            applyRowInsert(cells, rowHeights, (RowInsertOp) op);
        } else if (op instanceof RowDeleteOp) {
            applyRowDelete(cells, rowHeights, (RowDeleteOp) op);
        } else if (op instanceof RowResizeOp) {
            applyRowResize(rowHeights, (RowResizeOp) op);
        } else if (op instanceof ColResizeOp) {
            applyColResize(colWidths, (ColResizeOp) op);
        } else if (op instanceof FontColorOp) {
            applyFontColor(cells, (FontColorOp) op);
        } else if (op instanceof BgColorOp) {
            applyBgColor(cells, (BgColorOp) op);
        } else if (op instanceof FontSizeOp) {
            applyFontSize(cells, (FontSizeOp) op);
        } else if (op instanceof FontBoldOp) {
            applyFontBold(cells, (FontBoldOp) op);
        } else if (op instanceof FontItalicOp) {
            applyFontItalic(cells, (FontItalicOp) op);
        } else if (op instanceof FontUnderlineOp) {
            applyFontUnderline(cells, (FontUnderlineOp) op);
        } else if (op instanceof FontAlignOp) {
            applyFontAlign(cells, (FontAlignOp) op);
        } else if (op instanceof VerticalAlignOp) {
            applyVerticalAlign(cells, (VerticalAlignOp) op);
        }
    }

    // ============================================================
    // 各操作类型的应用逻辑
    // ============================================================

    private static void applyCellEdit(List<List<Cell>> cells, CellEditOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setContent(op.getContent());
        }
    }

    private static void applyCellMerge(List<List<Cell>> cells, CellMergeOp op) {
        int startRow = op.getStartRow();
        int startCol = op.getStartCol();
        int endRow = op.getEndRow();
        int endCol = op.getEndCol();

        for (int r = startRow; r <= endRow && r < cells.size(); r++) {
            for (int c = startCol; c <= endCol && !cells.isEmpty() && c < cells.get(0).size(); c++) {
                Cell cell = cells.get(r).get(c);
                if (r == startRow && c == startCol) {
                    // 主单元格：设置 rowSpan 和 colSpan
                    cell.setRowSpan(endRow - startRow + 1);
                    cell.setColSpan(endCol - startCol + 1);
                    cell.setMerged(false);
                } else {
                    // 被合并单元格：标记为已合并
                    cell.setMerged(true);
                    cell.setMergeParent(new MergeParent(startRow, startCol));
                    cell.setRowSpan(1);
                    cell.setColSpan(1);
                }
            }
        }
    }

    private static void applyCellSplit(List<List<Cell>> cells, CellSplitOp op) {
        if (op.getRow() >= cells.size() || cells.isEmpty() || op.getCol() >= cells.get(0).size()) {
            return;
        }
        Cell cell = cells.get(op.getRow()).get(op.getCol());
        int rs = cell.getRowSpan();
        int cs = cell.getColSpan();

        for (int r = op.getRow(); r < op.getRow() + rs && r < cells.size(); r++) {
            for (int c = op.getCol(); c < op.getCol() + cs && c < cells.get(0).size(); c++) {
                Cell target = cells.get(r).get(c);
                target.setRowSpan(1);
                target.setColSpan(1);
                target.setMerged(false);
                target.setMergeParent(null);
            }
        }
    }

    private static void applyRowInsert(List<List<Cell>> cells, List<Integer> rowHeights, RowInsertOp op) {
        int colCount = cells.isEmpty() ? DEFAULT_COLS : cells.get(0).size();
        int index = op.getRowIndex();

        for (int i = 0; i < op.getCount(); i++) {
            List<Cell> newRow = new ArrayList<>(colCount);
            for (int c = 0; c < colCount; c++) {
                newRow.add(new Cell());
            }
            cells.add(index + i, newRow);
            rowHeights.add(index + i, DEFAULT_ROW_HEIGHT);
        }
    }

    private static void applyRowDelete(List<List<Cell>> cells, List<Integer> rowHeights, RowDeleteOp op) {
        int index = op.getRowIndex();
        int count = op.getCount();
        // 从后往前删除，避免索引偏移问题
        for (int i = 0; i < count && index < cells.size(); i++) {
            cells.remove(index);
        }
        for (int i = 0; i < count && index < rowHeights.size(); i++) {
            rowHeights.remove(index);
        }
    }

    private static void applyRowResize(List<Integer> rowHeights, RowResizeOp op) {
        if (op.getRowIndex() < rowHeights.size()) {
            rowHeights.set(op.getRowIndex(), op.getHeight());
        }
    }

    private static void applyColResize(List<Integer> colWidths, ColResizeOp op) {
        if (op.getColIndex() < colWidths.size()) {
            colWidths.set(op.getColIndex(), op.getWidth());
        }
    }

    private static void applyFontColor(List<List<Cell>> cells, FontColorOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setFontColor(op.getColor());
        }
    }

    private static void applyBgColor(List<List<Cell>> cells, BgColorOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setBgColor(op.getColor());
        }
    }

    private static void applyFontSize(List<List<Cell>> cells, FontSizeOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setFontSize(op.getSize());
        }
    }

    private static void applyFontBold(List<List<Cell>> cells, FontBoldOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setFontBold(op.isBold());
        }
    }

    private static void applyFontItalic(List<List<Cell>> cells, FontItalicOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setFontItalic(op.isItalic());
        }
    }

    private static void applyFontUnderline(List<List<Cell>> cells, FontUnderlineOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setFontUnderline(op.isUnderline());
        }
    }

    private static void applyFontAlign(List<List<Cell>> cells, FontAlignOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setFontAlign(op.getAlign());
        }
    }

    private static void applyVerticalAlign(List<List<Cell>> cells, VerticalAlignOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setVerticalAlign(op.getAlign());
        }
    }
}
