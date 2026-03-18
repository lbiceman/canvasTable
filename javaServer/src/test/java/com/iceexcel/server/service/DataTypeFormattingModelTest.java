package com.iceexcel.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceexcel.server.model.*;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 数据类型与格式化模型测试
 * 验证新模型类（CellFormat、RichTextSegment、ValidationRule、ConditionalFormatRule）
 * 以及 Cell 新增字段的 JSON 序列化/反序列化
 */
class DataTypeFormattingModelTest {

    private final ObjectMapper mapper = new ObjectMapper();

    // ============================================================
    // CellFormat JSON 序列化/反序列化
    // ============================================================

    @Test
    void cellFormat_jsonRoundTrip() throws Exception {
        CellFormat format = new CellFormat("currency", "#,##0.00", "¥");
        String json = mapper.writeValueAsString(format);
        CellFormat deserialized = mapper.readValue(json, CellFormat.class);
        assertEquals(format, deserialized);
    }

    @Test
    void cellFormat_withoutCurrencySymbol_jsonRoundTrip() throws Exception {
        CellFormat format = new CellFormat("number", "#,##0.00", null);
        String json = mapper.writeValueAsString(format);
        // currencySymbol 为 null 时不应出现在 JSON 中
        assertFalse(json.contains("currencySymbol"));
        CellFormat deserialized = mapper.readValue(json, CellFormat.class);
        assertEquals(format, deserialized);
    }

    @Test
    void cellFormat_nullFieldsNotInJson() throws Exception {
        CellFormat format = new CellFormat();
        format.setCategory("percentage");
        format.setPattern("0.00%");
        String json = mapper.writeValueAsString(format);
        assertTrue(json.contains("category"));
        assertTrue(json.contains("pattern"));
        assertFalse(json.contains("currencySymbol"));
    }

    // ============================================================
    // RichTextSegment JSON 序列化/反序列化
    // ============================================================

    @Test
    void richTextSegment_jsonRoundTrip() throws Exception {
        RichTextSegment segment = new RichTextSegment("Hello");
        segment.setFontBold(true);
        segment.setFontItalic(false);
        segment.setFontColor("#FF0000");
        segment.setFontSize(14);
        String json = mapper.writeValueAsString(segment);
        RichTextSegment deserialized = mapper.readValue(json, RichTextSegment.class);
        assertEquals(segment, deserialized);
    }

    @Test
    void richTextSegment_minimalFields_jsonRoundTrip() throws Exception {
        RichTextSegment segment = new RichTextSegment("plain text");
        String json = mapper.writeValueAsString(segment);
        // 只有 text 字段，其他 null 字段不应出现
        assertFalse(json.contains("fontBold"));
        assertFalse(json.contains("fontItalic"));
        assertFalse(json.contains("fontUnderline"));
        assertFalse(json.contains("fontColor"));
        assertFalse(json.contains("fontSize"));
        RichTextSegment deserialized = mapper.readValue(json, RichTextSegment.class);
        assertEquals(segment, deserialized);
    }

    @Test
    void richTextSegment_allStyleFields() throws Exception {
        RichTextSegment segment = new RichTextSegment("styled");
        segment.setFontBold(true);
        segment.setFontItalic(true);
        segment.setFontUnderline(true);
        segment.setFontColor("#0000FF");
        segment.setFontSize(18);
        String json = mapper.writeValueAsString(segment);
        assertTrue(json.contains("fontBold"));
        assertTrue(json.contains("fontItalic"));
        assertTrue(json.contains("fontUnderline"));
        assertTrue(json.contains("fontColor"));
        assertTrue(json.contains("fontSize"));
        RichTextSegment deserialized = mapper.readValue(json, RichTextSegment.class);
        assertEquals(segment, deserialized);
    }


    // ============================================================
    // ValidationRule JSON 序列化/反序列化
    // ============================================================

    @Test
    void validationRule_dropdown_jsonRoundTrip() throws Exception {
        ValidationRule rule = new ValidationRule();
        rule.setType("dropdown");
        rule.setMode("block");
        rule.setOptions(Arrays.asList("选项A", "选项B", "选项C"));
        rule.setInputTitle("请选择");
        rule.setInputMessage("从下拉列表中选择一个值");
        String json = mapper.writeValueAsString(rule);
        ValidationRule deserialized = mapper.readValue(json, ValidationRule.class);
        assertEquals(rule, deserialized);
    }

    @Test
    void validationRule_numberRange_jsonRoundTrip() throws Exception {
        ValidationRule rule = new ValidationRule();
        rule.setType("numberRange");
        rule.setMode("warning");
        rule.setMin(0.0);
        rule.setMax(100.0);
        rule.setErrorTitle("数值超出范围");
        rule.setErrorMessage("请输入 0 到 100 之间的数字");
        String json = mapper.writeValueAsString(rule);
        ValidationRule deserialized = mapper.readValue(json, ValidationRule.class);
        assertEquals(rule, deserialized);
    }

    @Test
    void validationRule_nullFieldsNotInJson() throws Exception {
        ValidationRule rule = new ValidationRule();
        rule.setType("textLength");
        rule.setMode("block");
        rule.setMin(1.0);
        rule.setMax(50.0);
        String json = mapper.writeValueAsString(rule);
        // 未设置的字段不应出现在 JSON 中
        assertFalse(json.contains("options"));
        assertFalse(json.contains("customExpression"));
        assertFalse(json.contains("inputTitle"));
        assertFalse(json.contains("inputMessage"));
        assertFalse(json.contains("errorTitle"));
        assertFalse(json.contains("errorMessage"));
    }

    // ============================================================
    // ConditionalFormatRule JSON 序列化/反序列化
    // ============================================================

    @Test
    void conditionalFormatRule_jsonRoundTrip() throws Exception {
        CellRange range = new CellRange(0, 0, 10, 5);
        ConditionalFormatStyle style = new ConditionalFormatStyle("#FF0000", "#FFEEEE");
        Map<String, Object> condition = new HashMap<>();
        condition.put("type", "greaterThan");
        condition.put("value", 100);
        ConditionalFormatRule rule = new ConditionalFormatRule("rule-1", range, 1, condition, style);
        String json = mapper.writeValueAsString(rule);
        ConditionalFormatRule deserialized = mapper.readValue(json, ConditionalFormatRule.class);
        assertEquals(rule, deserialized);
    }

    @Test
    void conditionalFormatRule_betweenCondition_jsonRoundTrip() throws Exception {
        CellRange range = new CellRange(0, 0, 5, 3);
        ConditionalFormatStyle style = new ConditionalFormatStyle(null, "#00FF00");
        Map<String, Object> condition = new HashMap<>();
        condition.put("type", "between");
        condition.put("min", 10);
        condition.put("max", 50);
        ConditionalFormatRule rule = new ConditionalFormatRule("rule-2", range, 2, condition, style);
        String json = mapper.writeValueAsString(rule);
        ConditionalFormatRule deserialized = mapper.readValue(json, ConditionalFormatRule.class);
        assertEquals(rule, deserialized);
    }

    @Test
    void conditionalFormatRule_textContainsCondition_jsonRoundTrip() throws Exception {
        CellRange range = new CellRange(1, 1, 20, 10);
        ConditionalFormatStyle style = new ConditionalFormatStyle("#0000FF", null);
        Map<String, Object> condition = new HashMap<>();
        condition.put("type", "textContains");
        condition.put("text", "重要");
        ConditionalFormatRule rule = new ConditionalFormatRule("rule-3", range, 3, condition, style);
        String json = mapper.writeValueAsString(rule);
        ConditionalFormatRule deserialized = mapper.readValue(json, ConditionalFormatRule.class);
        assertEquals(rule, deserialized);
    }

    // ============================================================
    // Cell 新增字段序列化
    // ============================================================

    @Test
    void cell_newFields_jsonRoundTrip() throws Exception {
        Cell cell = new Cell();
        cell.setContent("¥1,234.56");
        cell.setDataType("currency");
        cell.setRawValue(1234.56);
        cell.setWrapText(true);
        cell.setFormat(new CellFormat("currency", "#,##0.00", "¥"));

        RichTextSegment seg1 = new RichTextSegment("Bold ");
        seg1.setFontBold(true);
        RichTextSegment seg2 = new RichTextSegment("Normal");
        cell.setRichText(Arrays.asList(seg1, seg2));

        ValidationRule validation = new ValidationRule();
        validation.setType("numberRange");
        validation.setMode("block");
        validation.setMin(0.0);
        validation.setMax(10000.0);
        cell.setValidation(validation);

        String json = mapper.writeValueAsString(cell);
        Cell deserialized = mapper.readValue(json, Cell.class);
        assertEquals(cell, deserialized);
    }

    @Test
    void cell_dataTypeAndRawValue_serialization() throws Exception {
        Cell cell = new Cell();
        cell.setContent("12%");
        cell.setDataType("percentage");
        cell.setRawValue(0.12);
        cell.setFormat(new CellFormat("percentage", "0.00%", null));

        String json = mapper.writeValueAsString(cell);
        assertTrue(json.contains("\"dataType\":\"percentage\""));
        assertTrue(json.contains("\"rawValue\":0.12"));

        Cell deserialized = mapper.readValue(json, Cell.class);
        assertEquals("percentage", deserialized.getDataType());
        assertEquals(0.12, deserialized.getRawValue(), 0.0001);
    }

    @Test
    void cell_wrapTextField_serialization() throws Exception {
        Cell cell = new Cell();
        cell.setContent("多行\n文本");
        cell.setWrapText(true);

        String json = mapper.writeValueAsString(cell);
        assertTrue(json.contains("\"wrapText\":true"));

        Cell deserialized = mapper.readValue(json, Cell.class);
        assertEquals(true, deserialized.getWrapText());
    }

    // ============================================================
    // @JsonInclude(NON_NULL) 确保空字段不出现在 JSON 中
    // ============================================================

    @Test
    void cell_nullNewFieldsNotInJson() throws Exception {
        Cell cell = new Cell();
        cell.setContent("hello");
        // 不设置任何新字段
        String json = mapper.writeValueAsString(cell);
        assertFalse(json.contains("dataType"));
        assertFalse(json.contains("rawValue"));
        assertFalse(json.contains("wrapText"));
        assertFalse(json.contains("format"));
        assertFalse(json.contains("richText"));
        assertFalse(json.contains("validation"));
    }

    @Test
    void cell_defaultConstructor_preservesDefaults() throws Exception {
        Cell cell = new Cell();
        assertEquals("", cell.getContent());
        assertEquals(1, cell.getRowSpan());
        assertEquals(1, cell.getColSpan());
        assertFalse(cell.isMerged());
        // 新字段默认为 null
        assertNull(cell.getDataType());
        assertNull(cell.getRawValue());
        assertNull(cell.getWrapText());
        assertNull(cell.getFormat());
        assertNull(cell.getRichText());
        assertNull(cell.getValidation());
    }

    // ============================================================
    // 向后兼容：旧格式 JSON（不含新字段）反序列化
    // ============================================================

    @Test
    void cell_oldJsonWithoutNewFields_deserializesCorrectly() throws Exception {
        // 模拟旧格式 JSON，只包含原有字段
        String oldJson = "{\"content\":\"test\",\"rowSpan\":1,\"colSpan\":1,\"isMerged\":false}";
        Cell cell = mapper.readValue(oldJson, Cell.class);
        assertEquals("test", cell.getContent());
        assertEquals(1, cell.getRowSpan());
        assertEquals(1, cell.getColSpan());
        assertFalse(cell.isMerged());
        // 新字段应为 null
        assertNull(cell.getDataType());
        assertNull(cell.getRawValue());
        assertNull(cell.getWrapText());
        assertNull(cell.getFormat());
        assertNull(cell.getRichText());
        assertNull(cell.getValidation());
    }

    @Test
    void cell_oldJsonWithStyling_deserializesCorrectly() throws Exception {
        // 旧格式 JSON 包含样式字段但不含新字段
        String oldJson = "{\"content\":\"styled\",\"rowSpan\":1,\"colSpan\":2,\"isMerged\":false,"
                + "\"fontColor\":\"#333\",\"bgColor\":\"#FFF\",\"fontSize\":14,\"fontBold\":true}";
        Cell cell = mapper.readValue(oldJson, Cell.class);
        assertEquals("styled", cell.getContent());
        assertEquals(2, cell.getColSpan());
        assertEquals("#333", cell.getFontColor());
        assertEquals("#FFF", cell.getBgColor());
        assertEquals(14, cell.getFontSize());
        assertEquals(true, cell.getFontBold());
        // 新字段应为 null
        assertNull(cell.getDataType());
        assertNull(cell.getFormat());
        assertNull(cell.getRichText());
        assertNull(cell.getValidation());
    }

    @Test
    void cell_partialNewFields_deserializesCorrectly() throws Exception {
        // JSON 只包含部分新字段
        String json = "{\"content\":\"100\",\"rowSpan\":1,\"colSpan\":1,\"isMerged\":false,"
                + "\"dataType\":\"number\",\"rawValue\":100.0}";
        Cell cell = mapper.readValue(json, Cell.class);
        assertEquals("number", cell.getDataType());
        assertEquals(100.0, cell.getRawValue(), 0.0001);
        // 未提供的新字段应为 null
        assertNull(cell.getWrapText());
        assertNull(cell.getFormat());
        assertNull(cell.getRichText());
        assertNull(cell.getValidation());
    }
}
