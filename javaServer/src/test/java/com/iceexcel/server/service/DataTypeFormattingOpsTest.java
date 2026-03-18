package com.iceexcel.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceexcel.server.model.*;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 数据类型与格式化协同操作测试
 * 验证新操作类型（SetFormatOp、SetWrapTextOp、SetRichTextOp、SetValidationOp）
 * 的 JSON 序列化/反序列化及 CollabOperation 多态反序列化
 */
class DataTypeFormattingOpsTest {

    private final ObjectMapper mapper = new ObjectMapper();

    // ============================================================
    // SetFormatOp JSON 序列化/反序列化
    // ============================================================

    @Test
    void setFormatOp_jsonRoundTrip() throws Exception {
        CellFormat format = new CellFormat("currency", "#,##0.00", "¥");
        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 2, 3, format);
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(SetFormatOp.class, deserialized);
        assertEquals(op, deserialized);
    }

    @Test
    void setFormatOp_jsonContainsTypeField() throws Exception {
        CellFormat format = new CellFormat("percentage", "0.00%", null);
        SetFormatOp op = new SetFormatOp("user1", 1000L, 1, 0, 0, format);
        String json = mapper.writeValueAsString(op);
        assertTrue(json.contains("\"type\""));
        assertTrue(json.contains("\"setFormat\""));
    }

    @Test
    void setFormatOp_preservesAllFields() throws Exception {
        CellFormat format = new CellFormat("number", "#,##0", null);
        SetFormatOp op = new SetFormatOp("user2", 2000L, 5, 10, 20, format);
        String json = mapper.writeValueAsString(op);
        SetFormatOp deserialized = mapper.readValue(json, SetFormatOp.class);
        assertEquals("user2", deserialized.getUserId());
        assertEquals(2000L, deserialized.getTimestamp());
        assertEquals(5, deserialized.getRevision());
        assertEquals(10, deserialized.getRow());
        assertEquals(20, deserialized.getCol());
        assertEquals(format, deserialized.getFormat());
    }

    // ============================================================
    // SetWrapTextOp JSON 序列化/反序列化
    // ============================================================

    @Test
    void setWrapTextOp_jsonRoundTrip() throws Exception {
        SetWrapTextOp op = new SetWrapTextOp("user1", 1000L, 1, 3, 4, true);
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(SetWrapTextOp.class, deserialized);
        assertEquals(op, deserialized);
    }

    @Test
    void setWrapTextOp_jsonContainsTypeField() throws Exception {
        SetWrapTextOp op = new SetWrapTextOp("user1", 1000L, 1, 0, 0, false);
        String json = mapper.writeValueAsString(op);
        assertTrue(json.contains("\"type\""));
        assertTrue(json.contains("\"setWrapText\""));
    }

    @Test
    void setWrapTextOp_preservesWrapTextValue() throws Exception {
        SetWrapTextOp opTrue = new SetWrapTextOp("user1", 1000L, 1, 1, 1, true);
        SetWrapTextOp opFalse = new SetWrapTextOp("user1", 1000L, 1, 1, 1, false);

        String jsonTrue = mapper.writeValueAsString(opTrue);
        String jsonFalse = mapper.writeValueAsString(opFalse);

        SetWrapTextOp deserializedTrue = mapper.readValue(jsonTrue, SetWrapTextOp.class);
        SetWrapTextOp deserializedFalse = mapper.readValue(jsonFalse, SetWrapTextOp.class);

        assertTrue(deserializedTrue.isWrapText());
        assertFalse(deserializedFalse.isWrapText());
    }

    // ============================================================
    // SetRichTextOp JSON 序列化/反序列化
    // ============================================================

    @Test
    void setRichTextOp_jsonRoundTrip() throws Exception {
        RichTextSegment seg1 = new RichTextSegment("Bold ");
        seg1.setFontBold(true);
        RichTextSegment seg2 = new RichTextSegment("Normal");
        List<RichTextSegment> richText = Arrays.asList(seg1, seg2);

        SetRichTextOp op = new SetRichTextOp("user1", 1000L, 1, 5, 6, richText);
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(SetRichTextOp.class, deserialized);
        assertEquals(op, deserialized);
    }

    @Test
    void setRichTextOp_jsonContainsTypeField() throws Exception {
        RichTextSegment seg = new RichTextSegment("test");
        SetRichTextOp op = new SetRichTextOp("user1", 1000L, 1, 0, 0, Arrays.asList(seg));
        String json = mapper.writeValueAsString(op);
        assertTrue(json.contains("\"type\""));
        assertTrue(json.contains("\"setRichText\""));
    }

    @Test
    void setRichTextOp_preservesRichTextSegments() throws Exception {
        RichTextSegment seg = new RichTextSegment("Styled");
        seg.setFontBold(true);
        seg.setFontItalic(true);
        seg.setFontColor("#FF0000");
        seg.setFontSize(16);

        SetRichTextOp op = new SetRichTextOp("user1", 1000L, 1, 2, 3, Arrays.asList(seg));
        String json = mapper.writeValueAsString(op);
        SetRichTextOp deserialized = mapper.readValue(json, SetRichTextOp.class);

        List<RichTextSegment> segments = deserialized.getRichText();
        assertEquals(1, segments.size());
        assertEquals("Styled", segments.get(0).getText());
        assertEquals(true, segments.get(0).getFontBold());
        assertEquals(true, segments.get(0).getFontItalic());
        assertEquals("#FF0000", segments.get(0).getFontColor());
        assertEquals(16, segments.get(0).getFontSize());
    }

    // ============================================================
    // SetValidationOp JSON 序列化/反序列化
    // ============================================================

    @Test
    void setValidationOp_jsonRoundTrip() throws Exception {
        ValidationRule rule = new ValidationRule();
        rule.setType("dropdown");
        rule.setMode("block");
        rule.setOptions(Arrays.asList("A", "B", "C"));

        SetValidationOp op = new SetValidationOp("user1", 1000L, 1, 7, 8, rule);
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(SetValidationOp.class, deserialized);
        assertEquals(op, deserialized);
    }

    @Test
    void setValidationOp_jsonContainsTypeField() throws Exception {
        ValidationRule rule = new ValidationRule();
        rule.setType("numberRange");
        rule.setMode("warning");
        SetValidationOp op = new SetValidationOp("user1", 1000L, 1, 0, 0, rule);
        String json = mapper.writeValueAsString(op);
        assertTrue(json.contains("\"type\""));
        assertTrue(json.contains("\"setValidation\""));
    }

    @Test
    void setValidationOp_preservesValidationRule() throws Exception {
        ValidationRule rule = new ValidationRule();
        rule.setType("numberRange");
        rule.setMode("warning");
        rule.setMin(0.0);
        rule.setMax(100.0);
        rule.setErrorTitle("超出范围");
        rule.setErrorMessage("请输入 0-100 之间的数字");

        SetValidationOp op = new SetValidationOp("user1", 1000L, 1, 4, 5, rule);
        String json = mapper.writeValueAsString(op);
        SetValidationOp deserialized = mapper.readValue(json, SetValidationOp.class);

        ValidationRule deserializedRule = deserialized.getValidation();
        assertEquals("numberRange", deserializedRule.getType());
        assertEquals("warning", deserializedRule.getMode());
        assertEquals(0.0, deserializedRule.getMin(), 0.0001);
        assertEquals(100.0, deserializedRule.getMax(), 0.0001);
        assertEquals("超出范围", deserializedRule.getErrorTitle());
        assertEquals("请输入 0-100 之间的数字", deserializedRule.getErrorMessage());
    }

    // ============================================================
    // CollabOperation 多态反序列化：正确识别新操作类型
    // ============================================================

    @Test
    void polymorphicDeserialization_setFormatOp() throws Exception {
        String json = "{\"type\":\"setFormat\",\"userId\":\"u1\",\"timestamp\":100,\"revision\":1,"
                + "\"row\":0,\"col\":0,\"format\":{\"category\":\"number\",\"pattern\":\"#,##0\"}}";
        CollabOperation op = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(SetFormatOp.class, op);
        assertEquals("setFormat", op.getType());
    }

    @Test
    void polymorphicDeserialization_setWrapTextOp() throws Exception {
        String json = "{\"type\":\"setWrapText\",\"userId\":\"u1\",\"timestamp\":100,\"revision\":1,"
                + "\"row\":0,\"col\":0,\"wrapText\":true}";
        CollabOperation op = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(SetWrapTextOp.class, op);
        assertEquals("setWrapText", op.getType());
    }

    @Test
    void polymorphicDeserialization_setRichTextOp() throws Exception {
        String json = "{\"type\":\"setRichText\",\"userId\":\"u1\",\"timestamp\":100,\"revision\":1,"
                + "\"row\":0,\"col\":0,\"richText\":[{\"text\":\"hello\"}]}";
        CollabOperation op = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(SetRichTextOp.class, op);
        assertEquals("setRichText", op.getType());
    }

    @Test
    void polymorphicDeserialization_setValidationOp() throws Exception {
        String json = "{\"type\":\"setValidation\",\"userId\":\"u1\",\"timestamp\":100,\"revision\":1,"
                + "\"row\":0,\"col\":0,\"validation\":{\"type\":\"dropdown\",\"mode\":\"block\","
                + "\"options\":[\"X\",\"Y\"]}}";
        CollabOperation op = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(SetValidationOp.class, op);
        assertEquals("setValidation", op.getType());
    }
}
