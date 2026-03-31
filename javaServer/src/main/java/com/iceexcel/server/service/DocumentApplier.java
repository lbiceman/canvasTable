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
     * 将操作应用到工作簿
     * 根据操作类型路由：Sheet 级操作直接修改 WorkbookData，
     * 单元格级操作根据 sheetId 找到对应 SpreadsheetData 后应用
     */
    public static void apply(WorkbookData workbook, CollabOperation op) {
        // Sheet 级操作
        if (op instanceof SheetAddOp) {
            applySheetAdd(workbook, (SheetAddOp) op);
        } else if (op instanceof SheetDeleteOp) {
            applySheetDelete(workbook, (SheetDeleteOp) op);
        } else if (op instanceof SheetRenameOp) {
            applySheetRename(workbook, (SheetRenameOp) op);
        } else if (op instanceof SheetReorderOp) {
            applySheetReorder(workbook, (SheetReorderOp) op);
        } else if (op instanceof SheetDuplicateOp) {
            applySheetDuplicate(workbook, (SheetDuplicateOp) op);
        } else if (op instanceof SheetVisibilityOp) {
            applySheetVisibility(workbook, (SheetVisibilityOp) op);
        } else if (op instanceof SheetTabColorOp) {
            applySheetTabColor(workbook, (SheetTabColorOp) op);
        } else {
            // 单元格级操作：根据 sheetId 路由到对应工作表
            String sheetId = op.getSheetId();
            if (sheetId != null && workbook.getSheets() != null) {
                for (SheetEntry entry : workbook.getSheets()) {
                    if (entry.getMeta() != null && sheetId.equals(entry.getMeta().getId())) {
                        Object data = entry.getData();
                        if (data instanceof SpreadsheetData) {
                            apply((SpreadsheetData) data, op);
                        }
                        break;
                    }
                }
            } else if (workbook.getSheets() != null && !workbook.getSheets().isEmpty()) {
                // 兼容：无 sheetId 时应用到第一个工作表
                Object data = workbook.getSheets().get(0).getData();
                if (data instanceof SpreadsheetData) {
                    apply((SpreadsheetData) data, op);
                }
            }
        }
    }

    /**
     * 将操作应用到文档快照（单工作表级别）
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
        } else if (op instanceof ColInsertOp) {
            applyColInsert(cells, colWidths, (ColInsertOp) op);
        } else if (op instanceof ColDeleteOp) {
            applyColDelete(cells, colWidths, (ColDeleteOp) op);
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
        } else if (op instanceof SetFormatOp) {
            applySetFormat(cells, (SetFormatOp) op);
        } else if (op instanceof SetWrapTextOp) {
            applySetWrapText(cells, (SetWrapTextOp) op);
        } else if (op instanceof SetRichTextOp) {
            applySetRichText(cells, (SetRichTextOp) op);
        } else if (op instanceof SetValidationOp) {
            applySetValidation(cells, (SetValidationOp) op);
        } else if (op instanceof ChartCreateOp) {
            applyChartCreate(document, (ChartCreateOp) op);
        } else if (op instanceof ChartUpdateOp) {
            applyChartUpdate(document, (ChartUpdateOp) op);
        } else if (op instanceof ChartDeleteOp) {
            applyChartDelete(document, (ChartDeleteOp) op);
        } else if (op instanceof SetBorderOp) {
            applySetBorder(cells, (SetBorderOp) op);
        } else if (op instanceof SetFontFamilyOp) {
            applySetFontFamily(cells, (SetFontFamilyOp) op);
        } else if (op instanceof SetStrikethroughOp) {
            applySetStrikethrough(cells, (SetStrikethroughOp) op);
        } else if (op instanceof SetSparklineOp) {
            applySetSparkline(document, (SetSparklineOp) op);
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

    private static void applyColInsert(List<List<Cell>> cells, List<Integer> colWidths, ColInsertOp op) {
        int colIndex = op.getColIndex();
        int count = op.getCount();

        // 每行在 colIndex 处插入 count 个空 Cell
        for (List<Cell> row : cells) {
            for (int i = 0; i < count; i++) {
                row.add(colIndex + i, new Cell());
            }
        }

        // 在 colWidths 中插入 count 个默认列宽（100）
        for (int i = 0; i < count; i++) {
            colWidths.add(colIndex + i, 100);
        }

        // 更新合并单元格引用：调整 mergeParent 的 col 引用
        for (List<Cell> row : cells) {
            for (Cell cell : row) {
                if (cell.getMergeParent() != null) {
                    MergeParent mp = cell.getMergeParent();
                    if (mp.getCol() >= colIndex) {
                        mp.setCol(mp.getCol() + count);
                    }
                }
            }
        }
    }

    private static void applyColDelete(List<List<Cell>> cells, List<Integer> colWidths, ColDeleteOp op) {
        int colIndex = op.getColIndex();
        int count = op.getCount();

        // 每行删除 colIndex 起的 count 个 Cell
        for (List<Cell> row : cells) {
            for (int i = 0; i < count && colIndex < row.size(); i++) {
                row.remove(colIndex);
            }
        }

        // 从 colWidths 中删除对应条目
        for (int i = 0; i < count && colIndex < colWidths.size(); i++) {
            colWidths.remove(colIndex);
        }

        // 更新合并单元格引用：调整 mergeParent 的 col 引用
        int delEnd = colIndex + count;
        for (List<Cell> row : cells) {
            for (Cell cell : row) {
                if (cell.getMergeParent() != null) {
                    MergeParent mp = cell.getMergeParent();
                    int mpCol = mp.getCol();
                    if (mpCol >= colIndex && mpCol < delEnd) {
                        // mergeParent 在被删除的列范围内，清除引用
                        cell.setMergeParent(null);
                        cell.setMerged(false);
                    } else if (mpCol >= delEnd) {
                        mp.setCol(mpCol - count);
                    }
                }
            }
        }
    }

    private static void applySetFormat(List<List<Cell>> cells, SetFormatOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setFormat(op.getFormat());
        }
    }

    private static void applySetWrapText(List<List<Cell>> cells, SetWrapTextOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setWrapText(op.isWrapText());
        }
    }

    private static void applySetRichText(List<List<Cell>> cells, SetRichTextOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setRichText(op.getRichText());
        }
    }

    private static void applySetValidation(List<List<Cell>> cells, SetValidationOp op) {
        if (op.getRow() < cells.size() && !cells.isEmpty() && op.getCol() < cells.get(0).size()) {
            cells.get(op.getRow()).get(op.getCol()).setValidation(op.getValidation());
        }
    }

    private static void applySetBorder(List<List<Cell>> cells, SetBorderOp op) {
        ensureCellExists(cells, op.getRow(), op.getCol());
        cells.get(op.getRow()).get(op.getCol()).setBorder(op.getBorder());
    }

    private static void applySetFontFamily(List<List<Cell>> cells, SetFontFamilyOp op) {
        ensureCellExists(cells, op.getRow(), op.getCol());
        cells.get(op.getRow()).get(op.getCol()).setFontFamily(op.getFontFamily());
    }

    private static void applySetStrikethrough(List<List<Cell>> cells, SetStrikethroughOp op) {
        ensureCellExists(cells, op.getRow(), op.getCol());
        cells.get(op.getRow()).get(op.getCol()).setFontStrikethrough(op.isStrikethrough());
    }

    /**
     * 确保指定行列的单元格存在，必要时自动扩展行列
     */
    private static void ensureCellExists(List<List<Cell>> cells, int row, int col) {
        int colCount = cells.isEmpty() ? DEFAULT_COLS : cells.get(0).size();
        // 扩展行
        while (cells.size() <= row) {
            List<Cell> newRow = new ArrayList<>(colCount);
            for (int c = 0; c < colCount; c++) {
                newRow.add(new Cell());
            }
            cells.add(newRow);
        }
        // 扩展列
        List<Cell> targetRow = cells.get(row);
        while (targetRow.size() <= col) {
            targetRow.add(new Cell());
        }
    }

    // ============================================================
    // 图表操作应用逻辑
    // ============================================================

    /**
     * 应用图表创建操作：将图表配置添加到 charts 列表
     */
    private static void applyChartCreate(SpreadsheetData data, ChartCreateOp op) {
        List<ChartConfigData> charts = data.getCharts();
        if (charts == null) {
            charts = new ArrayList<>();
            data.setCharts(charts);
        }
        charts.add(op.getChartConfig());
    }

    /**
     * 应用图表更新操作：根据 chartId 查找并替换配置
     */
    private static void applyChartUpdate(SpreadsheetData data, ChartUpdateOp op) {
        List<ChartConfigData> charts = data.getCharts();
        if (charts == null || charts.isEmpty()) {
            return;
        }
        for (int i = 0; i < charts.size(); i++) {
            if (op.getChartId().equals(charts.get(i).getId())) {
                charts.set(i, op.getChartConfig());
                return;
            }
        }
    }

    /**
     * 应用图表删除操作：根据 chartId 从列表中移除
     */
    private static void applyChartDelete(SpreadsheetData data, ChartDeleteOp op) {
        List<ChartConfigData> charts = data.getCharts();
        if (charts == null || charts.isEmpty()) {
            return;
        }
        charts.removeIf(chart -> op.getChartId().equals(chart.getId()));
    }

    /**
     * 应用设置迷你图操作：设置目标单元格的 sparkline 字段
     */
    private static void applySetSparkline(SpreadsheetData data, SetSparklineOp op) {
        List<List<Cell>> cells = data.getCells();
        if (cells.isEmpty()) {
            return;
        }
        // 确保行存在，必要时扩展行
        while (cells.size() <= op.getRow()) {
            int colCount = cells.isEmpty() ? DEFAULT_COLS : cells.get(0).size();
            List<Cell> newRow = new ArrayList<>(colCount);
            for (int c = 0; c < colCount; c++) {
                newRow.add(new Cell());
            }
            cells.add(newRow);
        }
        // 确保列存在，必要时扩展列
        List<Cell> row = cells.get(op.getRow());
        while (row.size() <= op.getCol()) {
            row.add(new Cell());
        }
        // 设置或清除迷你图
        row.get(op.getCol()).setSparkline(op.getSparkline());
    }

    // ============================================================
    // Sheet 级操作应用逻辑
    // ============================================================

    private static void applySheetAdd(WorkbookData workbook, SheetAddOp op) {
        SheetMeta meta = new SheetMeta(op.getSheetId(), op.getSheetName(), true, null, op.getInsertIndex());
        SheetEntry entry = new SheetEntry();
        entry.setMeta(meta);
        entry.setData(new SpreadsheetData());

        List<SheetEntry> sheets = workbook.getSheets();
        int index = Math.min(op.getInsertIndex(), sheets.size());
        sheets.add(index, entry);

        // 更新 order
        for (int i = 0; i < sheets.size(); i++) {
            sheets.get(i).getMeta().setOrder(i);
        }
    }

    private static void applySheetDelete(WorkbookData workbook, SheetDeleteOp op) {
        List<SheetEntry> sheets = workbook.getSheets();
        if (sheets.size() <= 1) return;
        sheets.removeIf(e -> e.getMeta() != null && op.getSheetId().equals(e.getMeta().getId()));

        // 更新 order
        for (int i = 0; i < sheets.size(); i++) {
            sheets.get(i).getMeta().setOrder(i);
        }
    }

    private static void applySheetRename(WorkbookData workbook, SheetRenameOp op) {
        SheetEntry entry = workbook.getSheetEntry(op.getSheetId());
        if (entry != null && entry.getMeta() != null) {
            entry.getMeta().setName(op.getNewName());
        }
    }

    private static void applySheetReorder(WorkbookData workbook, SheetReorderOp op) {
        List<SheetEntry> sheets = workbook.getSheets();
        int currentIndex = -1;
        for (int i = 0; i < sheets.size(); i++) {
            if (sheets.get(i).getMeta() != null && op.getSheetId().equals(sheets.get(i).getMeta().getId())) {
                currentIndex = i;
                break;
            }
        }
        if (currentIndex == -1) return;

        SheetEntry entry = sheets.remove(currentIndex);
        int newIndex = Math.max(0, Math.min(op.getNewIndex(), sheets.size()));
        sheets.add(newIndex, entry);

        // 更新 order
        for (int i = 0; i < sheets.size(); i++) {
            sheets.get(i).getMeta().setOrder(i);
        }
    }

    private static void applySheetDuplicate(WorkbookData workbook, SheetDuplicateOp op) {
        SheetEntry source = workbook.getSheetEntry(op.getSourceSheetId());
        if (source == null) return;

        SheetMeta newMeta = new SheetMeta(op.getNewSheetId(), op.getNewSheetName(), true, null, 0);
        SheetEntry newEntry = new SheetEntry();
        newEntry.setMeta(newMeta);
        // 深拷贝数据（简单引用，后端不直接操作数据内容）
        newEntry.setData(source.getData());
        newEntry.setMetadata(source.getMetadata());

        // 插入到源工作表右侧
        List<SheetEntry> sheets = workbook.getSheets();
        int sourceIndex = sheets.indexOf(source);
        sheets.add(sourceIndex + 1, newEntry);

        // 更新 order
        for (int i = 0; i < sheets.size(); i++) {
            sheets.get(i).getMeta().setOrder(i);
        }
    }

    private static void applySheetVisibility(WorkbookData workbook, SheetVisibilityOp op) {
        SheetEntry entry = workbook.getSheetEntry(op.getSheetId());
        if (entry != null && entry.getMeta() != null) {
            entry.getMeta().setVisible(op.isVisible());
        }
    }

    private static void applySheetTabColor(WorkbookData workbook, SheetTabColorOp op) {
        SheetEntry entry = workbook.getSheetEntry(op.getSheetId());
        if (entry != null && entry.getMeta() != null) {
            entry.getMeta().setTabColor(op.getTabColor());
        }
    }
}
