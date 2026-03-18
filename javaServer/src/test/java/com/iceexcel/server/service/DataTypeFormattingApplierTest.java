package com.iceexcel.server.service;

import com.iceexcel.server.model.*;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * DocumentApplier 对新数据类型格式化操作的处理测试
 * 验证 applySetFormat、applySetWrapText、applySetRichText、applySetValidation 的正确性
 */
class DataTypeFormattingApplierTest {

    // ============================================================
    // 辅助方法
    // ============================================================

    private SpreadsheetData createSmallDoc(int rows, int cols) {
        List<List<Cell>> cells = new ArrayList<>();
        List<Integer> rowHeights = new ArrayList<>();
        List<Integer> colWidths = new ArrayList<>();
        for (int r = 0; r < rows; r++) {
            List<Cell> row = new ArrayList<>();
            for (int c = 0; c < cols; c++) {
                row.add(new Cell());
            }
            cells.add(row);
            rowHeights.add(28);
        }
        for (int c = 0; c < cols; c++) {
            colWidths.add(100);
        }
        return new SpreadsheetData(cells, rowHeights, colWidths);
    }

    // ============================================================
    // applySetFormat 测试
    // ============================================================

    @Test
    void applySetFormat_writesCellFormatCorrectly() {
        SpreadsheetData doc = createSmallDoc(3, 3);
        CellFormat format = new CellFormat("currency", "#,##0.00", "¥");

        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 1, 2, format);
        DocumentApplier.apply(doc, op);

        Cell cell = doc.getCells().get(1).get(2);
        assertNotNull(cell.getFormat());
        assertEquals("currency", cell.getFormat().getCategory());
        assertEquals("#,##0.00", cell.getFormat().getPattern());
        assertEquals("¥", cell.getFormat().getCurrencySymbol());
    }

    // ============================================================
    // applySetWrapText 测试
    // ============================================================

    @Test
    void applySetWrapText_true_setsWrapTextOnCell() {
        SpreadsheetData doc = createSmallDoc(3, 3);

        SetWrapTextOp op = new SetWrapTextOp("user1", 1000L, 1, 0, 0, true);
        DocumentApplier.apply(doc, op);

        assertEquals(true, doc.getCells().get(0).get(0).getWrapText());
    }

    @Test
    void applySetWrapText_false_setsWrapTextFalseOnCell() {
        SpreadsheetData doc = createSmallDoc(3, 3);
        // 先设置为 true
        doc.getCells().get(1).get(1).setWrapText(true);

        SetWrapTextOp op = new SetWrapTextOp("user1", 1000L, 1, 1, 1, false);
        DocumentApplier.apply(doc, op);

        assertEquals(false, doc.getCells().get(1).get(1).getWrapText());
    }

    // ============================================================
    // applySetRichText 测试
    // ============================================================

    @Test
    void applySetRichText_writesRichTextSegmentsCorrectly() {
        SpreadsheetData doc = createSmallDoc(3, 3);

        RichTextSegment seg1 = new RichTextSegment("Hello ");
        seg1.setFontBold(true);
        seg1.setFontColor("#ff0000");

        RichTextSegment seg2 = new RichTextSegment("World");
        seg2.setFontItalic(true);
        seg2.setFontSize(16);

        List<RichTextSegment> richText = Arrays.asList(seg1, seg2);
        SetRichTextOp op = new SetRichTextOp("user1", 1000L, 1, 2, 1, richText);
        DocumentApplier.apply(doc, op);

        Cell cell = doc.getCells().get(2).get(1);
        assertNotNull(cell.getRichText());
        assertEquals(2, cell.getRichText().size());
        assertEquals("Hello ", cell.getRichText().get(0).getText());
        assertEquals(true, cell.getRichText().get(0).getFontBold());
        assertEquals("#ff0000", cell.getRichText().get(0).getFontColor());
        assertEquals("World", cell.getRichText().get(1).getText());
        assertEquals(true, cell.getRichText().get(1).getFontItalic());
        assertEquals(16, cell.getRichText().get(1).getFontSize());
    }

    // ============================================================
    // applySetValidation 测试
    // ============================================================

    @Test
    void applySetValidation_writesValidationRuleCorrectly() {
        SpreadsheetData doc = createSmallDoc(3, 3);

        ValidationRule rule = new ValidationRule();
        rule.setType("dropdown");
        rule.setMode("block");
        rule.setOptions(Arrays.asList("选项A", "选项B", "选项C"));
        rule.setInputTitle("请选择");
        rule.setInputMessage("从下拉列表中选择一个值");

        SetValidationOp op = new SetValidationOp("user1", 1000L, 1, 0, 2, rule);
        DocumentApplier.apply(doc, op);

        Cell cell = doc.getCells().get(0).get(2);
        assertNotNull(cell.getValidation());
        assertEquals("dropdown", cell.getValidation().getType());
        assertEquals("block", cell.getValidation().getMode());
        assertEquals(Arrays.asList("选项A", "选项B", "选项C"), cell.getValidation().getOptions());
        assertEquals("请选择", cell.getValidation().getInputTitle());
    }

    // ============================================================
    // 越界坐标安全处理测试
    // ============================================================

    @Test
    void applySetFormat_outOfBoundsRow_doesNotThrow() {
        SpreadsheetData doc = createSmallDoc(2, 2);
        CellFormat format = new CellFormat("number", "#,##0", null);

        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 10, 0, format);
        assertDoesNotThrow(() -> DocumentApplier.apply(doc, op));
        // 原有单元格不受影响
        assertNull(doc.getCells().get(0).get(0).getFormat());
    }

    @Test
    void applySetFormat_outOfBoundsCol_doesNotThrow() {
        SpreadsheetData doc = createSmallDoc(2, 2);
        CellFormat format = new CellFormat("percentage", "0.00%", null);

        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 0, 10, format);
        assertDoesNotThrow(() -> DocumentApplier.apply(doc, op));
        assertNull(doc.getCells().get(0).get(0).getFormat());
    }

    @Test
    void applySetWrapText_outOfBounds_doesNotThrow() {
        SpreadsheetData doc = createSmallDoc(2, 2);

        SetWrapTextOp op = new SetWrapTextOp("user1", 1000L, 1, 5, 5, true);
        assertDoesNotThrow(() -> DocumentApplier.apply(doc, op));
        assertNull(doc.getCells().get(0).get(0).getWrapText());
    }

    @Test
    void applySetRichText_outOfBounds_doesNotThrow() {
        SpreadsheetData doc = createSmallDoc(2, 2);
        List<RichTextSegment> richText = Arrays.asList(new RichTextSegment("test"));

        SetRichTextOp op = new SetRichTextOp("user1", 1000L, 1, 99, 0, richText);
        assertDoesNotThrow(() -> DocumentApplier.apply(doc, op));
        assertNull(doc.getCells().get(0).get(0).getRichText());
    }

    @Test
    void applySetValidation_outOfBounds_doesNotThrow() {
        SpreadsheetData doc = createSmallDoc(2, 2);
        ValidationRule rule = new ValidationRule();
        rule.setType("numberRange");
        rule.setMin(0.0);
        rule.setMax(100.0);

        SetValidationOp op = new SetValidationOp("user1", 1000L, 1, 0, 50, rule);
        assertDoesNotThrow(() -> DocumentApplier.apply(doc, op));
        assertNull(doc.getCells().get(0).get(0).getValidation());
    }

    // ============================================================
    // 同一单元格多次操作测试（最后一次生效）
    // ============================================================

    @Test
    void applySetFormat_multipleTimes_lastOneWins() {
        SpreadsheetData doc = createSmallDoc(3, 3);

        CellFormat format1 = new CellFormat("number", "#,##0", null);
        CellFormat format2 = new CellFormat("currency", "#,##0.00", "$");

        DocumentApplier.apply(doc, new SetFormatOp("user1", 1000L, 1, 0, 0, format1));
        DocumentApplier.apply(doc, new SetFormatOp("user2", 2000L, 2, 0, 0, format2));

        Cell cell = doc.getCells().get(0).get(0);
        assertEquals("currency", cell.getFormat().getCategory());
        assertEquals("$", cell.getFormat().getCurrencySymbol());
    }

    @Test
    void applySetWrapText_multipleTimes_lastOneWins() {
        SpreadsheetData doc = createSmallDoc(3, 3);

        DocumentApplier.apply(doc, new SetWrapTextOp("user1", 1000L, 1, 0, 0, true));
        assertEquals(true, doc.getCells().get(0).get(0).getWrapText());

        DocumentApplier.apply(doc, new SetWrapTextOp("user2", 2000L, 2, 0, 0, false));
        assertEquals(false, doc.getCells().get(0).get(0).getWrapText());
    }
}
