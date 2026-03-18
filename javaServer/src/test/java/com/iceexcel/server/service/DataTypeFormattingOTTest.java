package com.iceexcel.server.service;

import com.iceexcel.server.model.*;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * OTTransformer 对新数据类型格式化操作的转换测试
 * 验证 SetFormatOp、SetWrapTextOp、SetRichTextOp、SetValidationOp 与行列操作的 OT 转换正确性
 */
class DataTypeFormattingOTTest {

    // ============================================================
    // SetFormatOp vs RowInsert
    // ============================================================

    @Test
    void setFormatVsRowInsert_rowBelowInsert_shifts() {
        // row=5 在 rowInsert(3, 2) 插入点之后，应向下偏移 2
        CellFormat format = new CellFormat("currency", "#,##0.00", "¥");
        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 5, 2, format);
        RowInsertOp insert = new RowInsertOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(op, insert);
        assertNotNull(result[0]);
        assertInstanceOf(SetFormatOp.class, result[0]);
        assertEquals(7, ((SetFormatOp) result[0]).getRow());
        assertEquals(2, ((SetFormatOp) result[0]).getCol());
    }

    @Test
    void setFormatVsRowInsert_rowAboveInsert_noChange() {
        // row=1 在 rowInsert(3, 2) 插入点之前，不受影响
        CellFormat format = new CellFormat("number", "#,##0", null);
        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 1, 0, format);
        RowInsertOp insert = new RowInsertOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(op, insert);
        assertNotNull(result[0]);
        assertInstanceOf(SetFormatOp.class, result[0]);
        assertEquals(1, ((SetFormatOp) result[0]).getRow());
    }

    // ============================================================
    // SetFormatOp vs RowDelete
    // ============================================================

    @Test
    void setFormatVsRowDelete_inRange_returnsNull() {
        // row=4 在 rowDelete(3, 3) 删除范围 [3, 6) 内，应被消除
        CellFormat format = new CellFormat("percentage", "0.00%", null);
        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 4, 1, format);
        RowDeleteOp delete = new RowDeleteOp("user2", 1000L, 1, 3, 3);

        CollabOperation[] result = OTTransformer.transform(op, delete);
        assertNull(result[0]);
    }

    @Test
    void setFormatVsRowDelete_belowRange_shifts() {
        // row=8 在 rowDelete(3, 3) 删除范围之后，应向上偏移 3
        CellFormat format = new CellFormat("scientific", "0.00E+0", null);
        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 8, 0, format);
        RowDeleteOp delete = new RowDeleteOp("user2", 1000L, 1, 3, 3);

        CollabOperation[] result = OTTransformer.transform(op, delete);
        assertNotNull(result[0]);
        assertInstanceOf(SetFormatOp.class, result[0]);
        assertEquals(5, ((SetFormatOp) result[0]).getRow());
    }

    // ============================================================
    // SetFormatOp vs ColInsert
    // ============================================================

    @Test
    void setFormatVsColInsert_colRightOfInsert_shifts() {
        // col=5 在 colInsert(2, 3) 插入点之后，应向右偏移 3
        CellFormat format = new CellFormat("date", "yyyy-MM-dd", null);
        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 0, 5, format);
        ColInsertOp insert = new ColInsertOp("user2", 1000L, 1, 2, 3);

        CollabOperation[] result = OTTransformer.transform(op, insert);
        assertNotNull(result[0]);
        assertInstanceOf(SetFormatOp.class, result[0]);
        assertEquals(8, ((SetFormatOp) result[0]).getCol());
        assertEquals(0, ((SetFormatOp) result[0]).getRow());
    }

    @Test
    void setFormatVsColInsert_colLeftOfInsert_noChange() {
        // col=1 在 colInsert(3, 2) 插入点之前，不受影响
        CellFormat format = new CellFormat("number", "#,##0.00", null);
        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 0, 1, format);
        ColInsertOp insert = new ColInsertOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(op, insert);
        assertNotNull(result[0]);
        assertEquals(1, ((SetFormatOp) result[0]).getCol());
    }

    // ============================================================
    // SetFormatOp vs ColDelete
    // ============================================================

    @Test
    void setFormatVsColDelete_inRange_returnsNull() {
        // col=3 在 colDelete(2, 3) 删除范围 [2, 5) 内，应被消除
        CellFormat format = new CellFormat("currency", "#,##0.00", "$");
        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 0, 3, format);
        ColDeleteOp delete = new ColDeleteOp("user2", 1000L, 1, 2, 3);

        CollabOperation[] result = OTTransformer.transform(op, delete);
        assertNull(result[0]);
    }

    @Test
    void setFormatVsColDelete_rightOfRange_shifts() {
        // col=7 在 colDelete(2, 3) 删除范围之后，应向左偏移 3
        CellFormat format = new CellFormat("number", "#,##0", null);
        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 1, 7, format);
        ColDeleteOp delete = new ColDeleteOp("user2", 1000L, 1, 2, 3);

        CollabOperation[] result = OTTransformer.transform(op, delete);
        assertNotNull(result[0]);
        assertInstanceOf(SetFormatOp.class, result[0]);
        assertEquals(4, ((SetFormatOp) result[0]).getCol());
    }

    // ============================================================
    // SetWrapTextOp vs RowInsert / RowDelete
    // ============================================================

    @Test
    void setWrapTextVsRowInsert_rowShifts() {
        // row=4 在 rowInsert(2, 1) 插入点之后，应向下偏移 1
        SetWrapTextOp op = new SetWrapTextOp("user1", 1000L, 1, 4, 3, true);
        RowInsertOp insert = new RowInsertOp("user2", 1000L, 1, 2, 1);

        CollabOperation[] result = OTTransformer.transform(op, insert);
        assertNotNull(result[0]);
        assertInstanceOf(SetWrapTextOp.class, result[0]);
        assertEquals(5, ((SetWrapTextOp) result[0]).getRow());
        assertEquals(3, ((SetWrapTextOp) result[0]).getCol());
        assertTrue(((SetWrapTextOp) result[0]).isWrapText());
    }

    @Test
    void setWrapTextVsRowDelete_inRange_returnsNull() {
        // row=3 在 rowDelete(2, 4) 删除范围 [2, 6) 内，应被消除
        SetWrapTextOp op = new SetWrapTextOp("user1", 1000L, 1, 3, 0, true);
        RowDeleteOp delete = new RowDeleteOp("user2", 1000L, 1, 2, 4);

        CollabOperation[] result = OTTransformer.transform(op, delete);
        assertNull(result[0]);
    }

    // ============================================================
    // SetRichTextOp vs ColInsert / ColDelete
    // ============================================================

    @Test
    void setRichTextVsColInsert_colShifts() {
        // col=3 在 colInsert(1, 2) 插入点之后，应向右偏移 2
        RichTextSegment seg = new RichTextSegment("测试");
        seg.setFontBold(true);
        List<RichTextSegment> richText = Arrays.asList(seg);
        SetRichTextOp op = new SetRichTextOp("user1", 1000L, 1, 0, 3, richText);
        ColInsertOp insert = new ColInsertOp("user2", 1000L, 1, 1, 2);

        CollabOperation[] result = OTTransformer.transform(op, insert);
        assertNotNull(result[0]);
        assertInstanceOf(SetRichTextOp.class, result[0]);
        assertEquals(5, ((SetRichTextOp) result[0]).getCol());
        assertEquals(0, ((SetRichTextOp) result[0]).getRow());
    }

    @Test
    void setRichTextVsColDelete_inRange_returnsNull() {
        // col=2 在 colDelete(1, 3) 删除范围 [1, 4) 内，应被消除
        RichTextSegment seg = new RichTextSegment("删除测试");
        List<RichTextSegment> richText = Arrays.asList(seg);
        SetRichTextOp op = new SetRichTextOp("user1", 1000L, 1, 5, 2, richText);
        ColDeleteOp delete = new ColDeleteOp("user2", 1000L, 1, 1, 3);

        CollabOperation[] result = OTTransformer.transform(op, delete);
        assertNull(result[0]);
    }

    // ============================================================
    // SetValidationOp vs RowInsert / ColDelete
    // ============================================================

    @Test
    void setValidationVsRowInsert_rowShifts() {
        // row=6 在 rowInsert(4, 2) 插入点之后，应向下偏移 2
        ValidationRule rule = new ValidationRule();
        rule.setType("dropdown");
        rule.setMode("block");
        rule.setOptions(Arrays.asList("A", "B", "C"));
        SetValidationOp op = new SetValidationOp("user1", 1000L, 1, 6, 1, rule);
        RowInsertOp insert = new RowInsertOp("user2", 1000L, 1, 4, 2);

        CollabOperation[] result = OTTransformer.transform(op, insert);
        assertNotNull(result[0]);
        assertInstanceOf(SetValidationOp.class, result[0]);
        assertEquals(8, ((SetValidationOp) result[0]).getRow());
        assertEquals(1, ((SetValidationOp) result[0]).getCol());
    }

    @Test
    void setValidationVsColDelete_inRange_returnsNull() {
        // col=5 在 colDelete(4, 3) 删除范围 [4, 7) 内，应被消除
        ValidationRule rule = new ValidationRule();
        rule.setType("numberRange");
        rule.setMode("warning");
        rule.setMin(0.0);
        rule.setMax(100.0);
        SetValidationOp op = new SetValidationOp("user1", 1000L, 1, 2, 5, rule);
        ColDeleteOp delete = new ColDeleteOp("user2", 1000L, 1, 4, 3);

        CollabOperation[] result = OTTransformer.transform(op, delete);
        assertNull(result[0]);
    }
}
