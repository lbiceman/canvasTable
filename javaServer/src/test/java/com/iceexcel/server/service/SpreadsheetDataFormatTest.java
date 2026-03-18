package com.iceexcel.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceexcel.server.model.*;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * SpreadsheetData 级别的条件格式序列化测试
 * 验证 conditionalFormats 数组的 JSON 序列化/反序列化及向后兼容性
 */
class SpreadsheetDataFormatTest {

    private final ObjectMapper mapper = new ObjectMapper();

    // 辅助方法：创建小型文档
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
    // 1. conditionalFormats 序列化/反序列化
    // ============================================================

    @Test
    void spreadsheetData_withConditionalFormats_jsonRoundTrip() throws Exception {
        SpreadsheetData doc = createSmallDoc(2, 2);

        Map<String, Object> condition = new HashMap<>();
        condition.put("type", "greaterThan");
        condition.put("value", 100);

        ConditionalFormatRule rule = new ConditionalFormatRule(
                "rule-1",
                new CellRange(0, 0, 1, 1),
                1,
                condition,
                new ConditionalFormatStyle("#FF0000", "#FFEEEE")
        );
        doc.setConditionalFormats(List.of(rule));

        String json = mapper.writeValueAsString(doc);
        SpreadsheetData deserialized = mapper.readValue(json, SpreadsheetData.class);

        assertNotNull(deserialized.getConditionalFormats());
        assertEquals(1, deserialized.getConditionalFormats().size());

        ConditionalFormatRule deserializedRule = deserialized.getConditionalFormats().get(0);
        assertEquals("rule-1", deserializedRule.getId());
        assertEquals(1, deserializedRule.getPriority());
        assertEquals("#FF0000", deserializedRule.getStyle().getFontColor());
        assertEquals("#FFEEEE", deserializedRule.getStyle().getBgColor());
        assertEquals(0, deserializedRule.getRange().getStartRow());
        assertEquals(1, deserializedRule.getRange().getEndCol());
    }

    // ============================================================
    // 2. 多条条件格式规则往返一致性
    // ============================================================

    @Test
    void spreadsheetData_withMultipleConditionalFormats_roundTrip() throws Exception {
        SpreadsheetData doc = createSmallDoc(3, 3);

        Map<String, Object> condition1 = new HashMap<>();
        condition1.put("type", "greaterThan");
        condition1.put("value", 50);

        Map<String, Object> condition2 = new HashMap<>();
        condition2.put("type", "textContains");
        condition2.put("text", "重要");

        List<ConditionalFormatRule> rules = new ArrayList<>();
        rules.add(new ConditionalFormatRule(
                "rule-1", new CellRange(0, 0, 2, 2), 1,
                condition1, new ConditionalFormatStyle("#FF0000", null)
        ));
        rules.add(new ConditionalFormatRule(
                "rule-2", new CellRange(1, 1, 2, 2), 2,
                condition2, new ConditionalFormatStyle(null, "#FFFFCC")
        ));
        doc.setConditionalFormats(rules);

        String json = mapper.writeValueAsString(doc);
        SpreadsheetData deserialized = mapper.readValue(json, SpreadsheetData.class);

        assertEquals(2, deserialized.getConditionalFormats().size());
        assertEquals("rule-1", deserialized.getConditionalFormats().get(0).getId());
        assertEquals("rule-2", deserialized.getConditionalFormats().get(1).getId());
        assertEquals(1, deserialized.getConditionalFormats().get(0).getPriority());
        assertEquals(2, deserialized.getConditionalFormats().get(1).getPriority());
    }

    // ============================================================
    // 3. 空 conditionalFormats 数组序列化/反序列化
    // ============================================================

    @Test
    void spreadsheetData_withEmptyConditionalFormats_roundTrip() throws Exception {
        SpreadsheetData doc = createSmallDoc(2, 2);
        // 默认构造已初始化为空列表
        assertTrue(doc.getConditionalFormats().isEmpty());

        String json = mapper.writeValueAsString(doc);
        SpreadsheetData deserialized = mapper.readValue(json, SpreadsheetData.class);

        assertNotNull(deserialized.getConditionalFormats());
        assertTrue(deserialized.getConditionalFormats().isEmpty());
    }

    // ============================================================
    // 4. 默认构造函数初始化 conditionalFormats 为空列表
    // ============================================================

    @Test
    void spreadsheetData_defaultConstructor_conditionalFormatsInitialized() {
        SpreadsheetData doc = new SpreadsheetData();
        assertNotNull(doc.getConditionalFormats());
        assertTrue(doc.getConditionalFormats().isEmpty());
    }

    @Test
    void spreadsheetData_threeArgConstructor_conditionalFormatsInitialized() {
        SpreadsheetData doc = createSmallDoc(1, 1);
        assertNotNull(doc.getConditionalFormats());
        assertTrue(doc.getConditionalFormats().isEmpty());
    }

    // ============================================================
    // 5. 旧格式 JSON（不含 conditionalFormats）反序列化兼容性
    // ============================================================

    @Test
    void spreadsheetData_oldFormatJson_withoutConditionalFormats_deserializesCorrectly() throws Exception {
        // 模拟旧格式 JSON，不包含 conditionalFormats 字段
        String oldJson = "{\"cells\":[[{\"content\":\"\",\"rowSpan\":1,\"colSpan\":1,\"isMerged\":false}]],"
                + "\"rowHeights\":[28],\"colWidths\":[100]}";

        SpreadsheetData deserialized = mapper.readValue(oldJson, SpreadsheetData.class);

        assertNotNull(deserialized.getCells());
        assertEquals(1, deserialized.getCells().size());
        assertEquals(1, deserialized.getRowHeights().size());
        assertEquals(1, deserialized.getColWidths().size());
        // 旧格式 JSON 不含 conditionalFormats，反序列化后应为 null（Jackson 不会调用默认构造函数的初始化）
        // 或者为空列表（取决于 Jackson 行为）
        // 实际行为：Jackson 使用默认构造函数初始化后再设置字段，所以 conditionalFormats 保持为空列表
        assertNotNull(deserialized.getConditionalFormats());
        assertTrue(deserialized.getConditionalFormats().isEmpty());
    }

    // ============================================================
    // 6. 包含新格式字段的 Cell 完整往返测试
    // ============================================================

    @Test
    void spreadsheetData_withFormattedCells_fullRoundTrip() throws Exception {
        SpreadsheetData doc = createSmallDoc(2, 2);

        // 设置第一个单元格的格式化字段
        Cell cell = doc.getCells().get(0).get(0);
        cell.setContent("¥1,234.56");
        cell.setDataType("currency");
        cell.setRawValue(1234.56);
        cell.setFormat(new CellFormat("currency", "#,##0.00", "¥"));
        cell.setWrapText(true);

        // 设置条件格式
        Map<String, Object> condition = new HashMap<>();
        condition.put("type", "greaterThan");
        condition.put("value", 1000);
        doc.setConditionalFormats(List.of(new ConditionalFormatRule(
                "rule-1", new CellRange(0, 0, 1, 1), 1,
                condition, new ConditionalFormatStyle("#00FF00", null)
        )));

        String json = mapper.writeValueAsString(doc);
        SpreadsheetData deserialized = mapper.readValue(json, SpreadsheetData.class);

        // 验证单元格字段
        Cell deserializedCell = deserialized.getCells().get(0).get(0);
        assertEquals("¥1,234.56", deserializedCell.getContent());
        assertEquals("currency", deserializedCell.getDataType());
        assertEquals(1234.56, deserializedCell.getRawValue());
        assertEquals("currency", deserializedCell.getFormat().getCategory());
        assertEquals("#,##0.00", deserializedCell.getFormat().getPattern());
        assertEquals("¥", deserializedCell.getFormat().getCurrencySymbol());
        assertTrue(deserializedCell.getWrapText());

        // 验证条件格式
        assertEquals(1, deserialized.getConditionalFormats().size());
        assertEquals("rule-1", deserialized.getConditionalFormats().get(0).getId());
    }
}
