package com.iceexcel.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceexcel.server.model.*;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 核心算法冒烟测试
 * 验证数据模型序列化、OT 转换、文档操作应用的基本功能
 */
class CoreAlgorithmSmokeTest {

    private final ObjectMapper mapper = new ObjectMapper();

    // ============================================================
    // JSON 序列化/反序列化
    // ============================================================

    @Test
    void cellEditOp_jsonRoundTrip() throws Exception {
        CellEditOp op = new CellEditOp("user1", 1000L, 1, 2, 3, "hello", "");
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(CellEditOp.class, deserialized);
        assertEquals(op, deserialized);
    }

    @Test
    void cellMergeOp_jsonRoundTrip() throws Exception {
        CellMergeOp op = new CellMergeOp("user1", 1000L, 1, 0, 0, 2, 2);
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(CellMergeOp.class, deserialized);
        assertEquals(op, deserialized);
    }

    @Test
    void rowInsertOp_jsonRoundTrip() throws Exception {
        RowInsertOp op = new RowInsertOp("user1", 1000L, 1, 5, 2);
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(RowInsertOp.class, deserialized);
        assertEquals(op, deserialized);
    }

    @Test
    void rowDeleteOp_jsonRoundTrip() throws Exception {
        RowDeleteOp op = new RowDeleteOp("user1", 1000L, 1, 3, 1);
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(RowDeleteOp.class, deserialized);
        assertEquals(op, deserialized);
    }

    @Test
    void jsonContainsTypeField() throws Exception {
        CellEditOp op = new CellEditOp("user1", 1000L, 1, 0, 0, "test", "");
        String json = mapper.writeValueAsString(op);
        assertTrue(json.contains("\"type\""));
        assertTrue(json.contains("\"cellEdit\""));
    }

    // ============================================================
    // OT 转换基本功能
    // ============================================================

    @Test
    void transform_cellEditVsRowInsert_adjustsRow() {
        CellEditOp edit = new CellEditOp("user1", 1000L, 1, 5, 0, "hello", "");
        RowInsertOp insert = new RowInsertOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(edit, insert);
        assertNotNull(result[0]);
        assertInstanceOf(CellEditOp.class, result[0]);
        // 行 5 在插入点 3 之后，应该被推后 2 行
        assertEquals(7, ((CellEditOp) result[0]).getRow());
    }

    @Test
    void transform_cellEditVsRowDelete_nullifiesDeletedRow() {
        CellEditOp edit = new CellEditOp("user1", 1000L, 1, 3, 0, "hello", "");
        RowDeleteOp delete = new RowDeleteOp("user2", 1000L, 1, 2, 3);

        CollabOperation[] result = OTTransformer.transform(edit, delete);
        // 行 3 在删除范围 [2, 5) 内，应该被消除
        assertNull(result[0]);
    }

    @Test
    void transform_rowInsertVsRowInsert_tieBreakByUserId() {
        RowInsertOp opA = new RowInsertOp("userB", 1000L, 1, 5, 1);
        RowInsertOp opB = new RowInsertOp("userA", 1000L, 1, 5, 1);

        CollabOperation[] result = OTTransformer.transform(opA, opB);
        assertNotNull(result[0]);
        // userB > userA 字典序，所以 opA 的 rowIndex 应该被推后
        assertEquals(6, ((RowInsertOp) result[0]).getRowIndex());
    }

    @Test
    void transform_cellMergeVsCellMerge_overlappingReturnsNull() {
        CellMergeOp opA = new CellMergeOp("user1", 1000L, 1, 0, 0, 2, 2);
        CellMergeOp opB = new CellMergeOp("user2", 1000L, 1, 1, 1, 3, 3);

        CollabOperation[] result = OTTransformer.transform(opA, opB);
        // 区域重叠，opA 应该被消除
        assertNull(result[0]);
    }

    @Test
    void transformAgainst_multipleOps() {
        CellEditOp edit = new CellEditOp("user1", 1000L, 1, 5, 0, "hello", "");
        List<CollabOperation> ops = new ArrayList<>();
        ops.add(new RowInsertOp("user2", 1000L, 1, 3, 1));
        ops.add(new RowInsertOp("user3", 1000L, 2, 4, 1));

        CollabOperation result = OTTransformer.transformAgainst(edit, ops);
        assertNotNull(result);
        assertInstanceOf(CellEditOp.class, result);
        // 行 5 -> 经过第一次插入(3, 1) -> 6 -> 经过第二次插入(4, 1) -> 7
        assertEquals(7, ((CellEditOp) result).getRow());
    }

    // ============================================================
    // 文档操作应用
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

    @Test
    void apply_cellEdit_updatesContent() {
        SpreadsheetData doc = createSmallDoc(5, 5);
        CellEditOp op = new CellEditOp("user1", 1000L, 1, 2, 3, "hello", "");
        DocumentApplier.apply(doc, op);
        assertEquals("hello", doc.getCells().get(2).get(3).getContent());
    }

    @Test
    void apply_cellMerge_setsSpanAndMergedFlag() {
        SpreadsheetData doc = createSmallDoc(5, 5);
        CellMergeOp op = new CellMergeOp("user1", 1000L, 1, 0, 0, 1, 1);
        DocumentApplier.apply(doc, op);

        Cell main = doc.getCells().get(0).get(0);
        assertEquals(2, main.getRowSpan());
        assertEquals(2, main.getColSpan());
        assertFalse(main.isMerged());

        Cell merged = doc.getCells().get(0).get(1);
        assertTrue(merged.isMerged());
        assertNotNull(merged.getMergeParent());
        assertEquals(0, merged.getMergeParent().getRow());
        assertEquals(0, merged.getMergeParent().getCol());
    }

    @Test
    void apply_rowInsert_increasesRowCount() {
        SpreadsheetData doc = createSmallDoc(5, 3);
        RowInsertOp op = new RowInsertOp("user1", 1000L, 1, 2, 3);
        DocumentApplier.apply(doc, op);
        assertEquals(8, doc.getCells().size());
        assertEquals(8, doc.getRowHeights().size());
    }

    @Test
    void apply_rowDelete_decreasesRowCount() {
        SpreadsheetData doc = createSmallDoc(5, 3);
        RowDeleteOp op = new RowDeleteOp("user1", 1000L, 1, 1, 2);
        DocumentApplier.apply(doc, op);
        assertEquals(3, doc.getCells().size());
        assertEquals(3, doc.getRowHeights().size());
    }

    // ============================================================
    // CellSplitOp 序列化测试
    // ============================================================

    @Test
    void cellSplitOp_jsonRoundTrip_withSpan() throws Exception {
        CellSplitOp op = new CellSplitOp("user1", 1000L, 1, 0, 0, 3, 3);
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(CellSplitOp.class, deserialized);
        assertEquals(op, deserialized);
        assertEquals(3, ((CellSplitOp) deserialized).getRowSpan());
        assertEquals(3, ((CellSplitOp) deserialized).getColSpan());
    }

    @Test
    void cellSplitOp_jsonRoundTrip_defaultSpan() throws Exception {
        CellSplitOp op = new CellSplitOp("user1", 1000L, 1, 0, 0);
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(CellSplitOp.class, deserialized);
        assertEquals(1, ((CellSplitOp) deserialized).getRowSpan());
        assertEquals(1, ((CellSplitOp) deserialized).getColSpan());
    }

    // ============================================================
    // CellSplit OT 转换测试
    // ============================================================

    @Test
    void transform_cellEditVsCellSplit_redirectsToTopLeft() {
        CellEditOp edit = new CellEditOp("user1", 1000L, 1, 1, 1, "hello", "");
        CellSplitOp split = new CellSplitOp("user2", 1000L, 1, 0, 0, 3, 3);

        CollabOperation[] result = OTTransformer.transform(edit, split);
        assertNotNull(result[0]);
        assertInstanceOf(CellEditOp.class, result[0]);
        assertEquals(0, ((CellEditOp) result[0]).getRow());
        assertEquals(0, ((CellEditOp) result[0]).getCol());
    }

    @Test
    void transform_cellEditVsCellSplit_outsideRange_noChange() {
        CellEditOp edit = new CellEditOp("user1", 1000L, 1, 5, 5, "hello", "");
        CellSplitOp split = new CellSplitOp("user2", 1000L, 1, 0, 0, 3, 3);

        CollabOperation[] result = OTTransformer.transform(edit, split);
        assertNotNull(result[0]);
        assertEquals(5, ((CellEditOp) result[0]).getRow());
        assertEquals(5, ((CellEditOp) result[0]).getCol());
    }

    @Test
    void transform_cellMergeVsCellSplit_overlapping_returnsNull() {
        CellMergeOp merge = new CellMergeOp("user1", 1000L, 1, 0, 0, 3, 3);
        CellSplitOp split = new CellSplitOp("user2", 1000L, 1, 1, 1, 2, 2);

        CollabOperation[] result = OTTransformer.transform(merge, split);
        assertNull(result[0]);
    }

    @Test
    void transform_cellMergeVsCellSplit_noOverlap_unchanged() {
        CellMergeOp merge = new CellMergeOp("user1", 1000L, 1, 5, 5, 7, 7);
        CellSplitOp split = new CellSplitOp("user2", 1000L, 1, 0, 0, 3, 3);

        CollabOperation[] result = OTTransformer.transform(merge, split);
        assertNotNull(result[0]);
        assertEquals(5, ((CellMergeOp) result[0]).getStartRow());
        assertEquals(5, ((CellMergeOp) result[0]).getStartCol());
    }

    @Test
    void transform_cellSplitVsCellSplit_samePosition_returnsNull() {
        CellSplitOp splitA = new CellSplitOp("user1", 1000L, 1, 0, 0, 3, 3);
        CellSplitOp splitB = new CellSplitOp("user2", 1000L, 1, 0, 0, 3, 3);

        CollabOperation[] result = OTTransformer.transform(splitA, splitB);
        assertNull(result[0]);
        assertNull(result[1]);
    }

    @Test
    void transform_cellSplitVsCellMerge_insideMerge_returnsNull() {
        CellSplitOp split = new CellSplitOp("user1", 1000L, 1, 1, 1, 2, 2);
        CellMergeOp merge = new CellMergeOp("user2", 1000L, 1, 0, 0, 3, 3);

        CollabOperation[] result = OTTransformer.transform(split, merge);
        assertNull(result[0]);
    }

    @Test
    void transform_fontColorVsCellSplit_redirectsToTopLeft() {
        FontColorOp fontColor = new FontColorOp("user1", 1000L, 1, 1, 1, "#FF0000");
        CellSplitOp split = new CellSplitOp("user2", 1000L, 1, 0, 0, 3, 3);

        CollabOperation[] result = OTTransformer.transform(fontColor, split);
        assertNotNull(result[0]);
        assertEquals(0, ((FontColorOp) result[0]).getRow());
        assertEquals(0, ((FontColorOp) result[0]).getCol());
    }

    @Test
    void transform_fontAlignVsCellMerge_redirectsToTopLeft() {
        FontAlignOp fontAlign = new FontAlignOp("user1", 1000L, 1, 1, 1, "center");
        CellMergeOp merge = new CellMergeOp("user2", 1000L, 1, 0, 0, 2, 2);

        CollabOperation[] result = OTTransformer.transform(fontAlign, merge);
        assertNotNull(result[0]);
        assertEquals(0, ((FontAlignOp) result[0]).getRow());
        assertEquals(0, ((FontAlignOp) result[0]).getCol());
        assertEquals("center", ((FontAlignOp) result[0]).getAlign());
    }

    @Test
    void transform_fontAlignVsCellMerge_outside_noChange() {
        FontAlignOp fontAlign = new FontAlignOp("user1", 1000L, 1, 5, 5, "right");
        CellMergeOp merge = new CellMergeOp("user2", 1000L, 1, 0, 0, 2, 2);

        CollabOperation[] result = OTTransformer.transform(fontAlign, merge);
        assertNotNull(result[0]);
        assertEquals(5, ((FontAlignOp) result[0]).getRow());
        assertEquals(5, ((FontAlignOp) result[0]).getCol());
    }

    // ============================================================
    // DocumentApplier CellSplit 兼容性测试
    // ============================================================

    @Test
    void apply_cellSplit_withSpanFields_worksCorrectly() {
        SpreadsheetData doc = createSmallDoc(5, 5);
        CellMergeOp merge = new CellMergeOp("user1", 1000L, 1, 0, 0, 2, 2);
        DocumentApplier.apply(doc, merge);

        CellSplitOp split = new CellSplitOp("user1", 2000L, 2, 0, 0, 3, 3);
        DocumentApplier.apply(doc, split);

        Cell cell = doc.getCells().get(0).get(0);
        assertEquals(1, cell.getRowSpan());
        assertEquals(1, cell.getColSpan());

        Cell merged = doc.getCells().get(1).get(1);
        assertFalse(merged.isMerged());
    }

    // ============================================================
    // OTServer 基本功能
    // ============================================================

    @Test
    void otServer_receiveOperation_incrementsRevision() {
        OTServer server = new OTServer();
        CellEditOp op = new CellEditOp("user1", 1000L, 0, 0, 0, "hello", "");
        OTServer.ReceiveResult result = server.receiveOperation(0, op);
        assertNotNull(result);
        assertEquals(1, result.getRevision());
        assertEquals(1, server.getRevision());
    }

    @Test
    void otServer_receiveOperation_transformsStaleOp() {
        OTServer server = new OTServer();
        // 先提交一个 rowInsert
        server.receiveOperation(0, new RowInsertOp("user1", 1000L, 0, 3, 1));
        // 再提交一个基于 revision 0 的 cellEdit（落后了）
        CellEditOp staleEdit = new CellEditOp("user2", 2000L, 0, 5, 0, "world", "");
        OTServer.ReceiveResult result = server.receiveOperation(0, staleEdit);
        assertNotNull(result);
        assertEquals(2, result.getRevision());
        // 行 5 应该被 rowInsert(3, 1) 推后到 6
        assertEquals(6, ((CellEditOp) result.getTransformedOp()).getRow());
    }

    @Test
    void otServer_getOperationsSince_returnsCorrectSubset() {
        OTServer server = new OTServer();
        server.receiveOperation(0, new CellEditOp("user1", 1000L, 0, 0, 0, "a", ""));
        server.receiveOperation(1, new CellEditOp("user1", 2000L, 0, 1, 0, "b", ""));
        server.receiveOperation(2, new CellEditOp("user1", 3000L, 0, 2, 0, "c", ""));

        List<CollabOperation> ops = server.getOperationsSince(1);
        assertEquals(2, ops.size());
    }

    // ============================================================
    // 任务 9.1：列操作烟雾测试（基本应用）
    // ============================================================

    @Test
    void colInsertOp_jsonRoundTrip() throws Exception {
        ColInsertOp op = new ColInsertOp("user1", 1000L, 1, 3, 2);
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(ColInsertOp.class, deserialized);
        assertEquals(op, deserialized);
        assertEquals(3, ((ColInsertOp) deserialized).getColIndex());
        assertEquals(2, ((ColInsertOp) deserialized).getCount());
    }

    @Test
    void colDeleteOp_jsonRoundTrip() throws Exception {
        ColDeleteOp op = new ColDeleteOp("user1", 1000L, 1, 2, 1);
        String json = mapper.writeValueAsString(op);
        CollabOperation deserialized = mapper.readValue(json, CollabOperation.class);
        assertInstanceOf(ColDeleteOp.class, deserialized);
        assertEquals(op, deserialized);
        assertEquals(2, ((ColDeleteOp) deserialized).getColIndex());
        assertEquals(1, ((ColDeleteOp) deserialized).getCount());
    }

    @Test
    void colInsertOp_jsonContainsTypeField() throws Exception {
        ColInsertOp op = new ColInsertOp("user1", 1000L, 1, 0, 1);
        String json = mapper.writeValueAsString(op);
        assertTrue(json.contains("\"type\""));
        assertTrue(json.contains("\"colInsert\""));
    }

    @Test
    void colDeleteOp_jsonContainsTypeField() throws Exception {
        ColDeleteOp op = new ColDeleteOp("user1", 1000L, 1, 0, 1);
        String json = mapper.writeValueAsString(op);
        assertTrue(json.contains("\"type\""));
        assertTrue(json.contains("\"colDelete\""));
    }

    @Test
    void apply_colInsert_increasesColCount() {
        SpreadsheetData doc = createSmallDoc(3, 5);
        ColInsertOp op = new ColInsertOp("user1", 1000L, 1, 2, 3);
        DocumentApplier.apply(doc, op);
        // 每行列数应增加 3
        assertEquals(8, doc.getCells().get(0).size());
        assertEquals(8, doc.getColWidths().size());
    }

    @Test
    void apply_colInsert_shiftsExistingData() {
        SpreadsheetData doc = createSmallDoc(3, 5);
        // 在 col=1 处设置内容
        doc.getCells().get(0).get(1).setContent("hello");
        ColInsertOp op = new ColInsertOp("user1", 1000L, 1, 0, 1);
        DocumentApplier.apply(doc, op);
        // 原 col=1 的内容应移到 col=2
        assertEquals("hello", doc.getCells().get(0).get(2).getContent());
        // 新插入的 col=0 应为空字符串（Cell 默认 content 为 ""）
        assertEquals("", doc.getCells().get(0).get(0).getContent());
    }

    @Test
    void apply_colDelete_decreasesColCount() {
        SpreadsheetData doc = createSmallDoc(3, 5);
        ColDeleteOp op = new ColDeleteOp("user1", 1000L, 1, 1, 2);
        DocumentApplier.apply(doc, op);
        // 每行列数应减少 2
        assertEquals(3, doc.getCells().get(0).size());
        assertEquals(3, doc.getColWidths().size());
    }

    @Test
    void apply_colDelete_shiftsRemainingData() {
        SpreadsheetData doc = createSmallDoc(3, 5);
        // 在 col=3 处设置内容
        doc.getCells().get(0).get(3).setContent("world");
        ColDeleteOp op = new ColDeleteOp("user1", 1000L, 1, 1, 2);
        DocumentApplier.apply(doc, op);
        // 原 col=3 的内容应移到 col=1
        assertEquals("world", doc.getCells().get(0).get(1).getContent());
    }

    @Test
    void apply_colInsert_usesDefaultColWidth() {
        SpreadsheetData doc = createSmallDoc(2, 3);
        ColInsertOp op = new ColInsertOp("user1", 1000L, 1, 1, 2);
        DocumentApplier.apply(doc, op);
        // 新插入的列宽应为默认值 100
        assertEquals(100, (int) doc.getColWidths().get(1));
        assertEquals(100, (int) doc.getColWidths().get(2));
    }

    // ============================================================
    // 任务 9.2：列操作 OT 转换验证
    // ============================================================

    @Test
    void transform_cellEditVsColInsert_leftOfInsert_noChange() {
        // col=1 在 colInsert(3, 2) 左侧，不受影响
        CellEditOp edit = new CellEditOp("user1", 1000L, 1, 0, 1, "hello", "");
        ColInsertOp insert = new ColInsertOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(edit, insert);
        assertNotNull(result[0]);
        assertInstanceOf(CellEditOp.class, result[0]);
        assertEquals(1, ((CellEditOp) result[0]).getCol());
    }

    @Test
    void transform_cellEditVsColInsert_rightOfInsert_adjustsCol() {
        // col=5 在 colInsert(3, 2) 右侧，应向右移动 2
        CellEditOp edit = new CellEditOp("user1", 1000L, 1, 0, 5, "hello", "");
        ColInsertOp insert = new ColInsertOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(edit, insert);
        assertNotNull(result[0]);
        assertEquals(7, ((CellEditOp) result[0]).getCol());
    }

    @Test
    void transform_cellEditVsColInsert_atInsertPoint_adjustsCol() {
        // col=3 恰好在 colInsert(3, 2) 插入点，应向右移动 2
        CellEditOp edit = new CellEditOp("user1", 1000L, 1, 0, 3, "hello", "");
        ColInsertOp insert = new ColInsertOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(edit, insert);
        assertNotNull(result[0]);
        assertEquals(5, ((CellEditOp) result[0]).getCol());
    }

    @Test
    void transform_cellEditVsColDelete_leftOfDelete_noChange() {
        // col=1 在 colDelete(3, 2) 左侧，不受影响
        CellEditOp edit = new CellEditOp("user1", 1000L, 1, 0, 1, "hello", "");
        ColDeleteOp delete = new ColDeleteOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(edit, delete);
        assertNotNull(result[0]);
        assertEquals(1, ((CellEditOp) result[0]).getCol());
    }

    @Test
    void transform_cellEditVsColDelete_insideDelete_returnsNull() {
        // col=4 在 colDelete(3, 2) 范围 [3,5) 内，应被消除
        CellEditOp edit = new CellEditOp("user1", 1000L, 1, 0, 4, "hello", "");
        ColDeleteOp delete = new ColDeleteOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(edit, delete);
        assertNull(result[0]);
    }

    @Test
    void transform_cellEditVsColDelete_rightOfDelete_adjustsCol() {
        // col=6 在 colDelete(3, 2) 右侧，应向左移动 2
        CellEditOp edit = new CellEditOp("user1", 1000L, 1, 0, 6, "hello", "");
        ColDeleteOp delete = new ColDeleteOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(edit, delete);
        assertNotNull(result[0]);
        assertEquals(4, ((CellEditOp) result[0]).getCol());
    }

    @Test
    void transform_colInsertVsColInsert_sameIndex_noChange() {
        // 两个 colInsert 在同一位置，colIndex 相同时 opA 不被推后（无 tie-break）
        ColInsertOp opA = new ColInsertOp("userB", 1000L, 1, 5, 1);
        ColInsertOp opB = new ColInsertOp("userA", 1000L, 1, 5, 1);

        CollabOperation[] result = OTTransformer.transform(opA, opB);
        assertNotNull(result[0]);
        // colIndex 相同时不推后（只有 > 才推后）
        assertEquals(5, ((ColInsertOp) result[0]).getColIndex());
    }

    @Test
    void transform_colInsertVsColInsert_differentIndex_rightShifted() {
        // opA 在 col=7，opB 在 col=3 插入 2 列，opA 应向右移动 2
        ColInsertOp opA = new ColInsertOp("user1", 1000L, 1, 7, 1);
        ColInsertOp opB = new ColInsertOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(opA, opB);
        assertNotNull(result[0]);
        assertEquals(9, ((ColInsertOp) result[0]).getColIndex());
    }

    @Test
    void transform_colDeleteVsColInsert_rightOfInsert_adjustsColIndex() {
        // colDelete(5, 1) vs colInsert(3, 2)，删除点在插入点右侧，应向右移动 2
        ColDeleteOp opA = new ColDeleteOp("user1", 1000L, 1, 5, 1);
        ColInsertOp opB = new ColInsertOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(opA, opB);
        assertNotNull(result[0]);
        assertEquals(7, ((ColDeleteOp) result[0]).getColIndex());
    }

    @Test
    void transform_colDeleteVsColDelete_noOverlap_rightShifted() {
        // colDelete(5, 2) vs colDelete(2, 2)，删除点在右侧，应向左移动 2
        ColDeleteOp opA = new ColDeleteOp("user1", 1000L, 1, 5, 2);
        ColDeleteOp opB = new ColDeleteOp("user2", 1000L, 1, 2, 2);

        CollabOperation[] result = OTTransformer.transform(opA, opB);
        assertNotNull(result[0]);
        assertEquals(3, ((ColDeleteOp) result[0]).getColIndex());
    }

    @Test
    void transform_colResizeVsColInsert_rightOfInsert_adjustsColIndex() {
        // colResize(5) vs colInsert(3, 2)，resize 点在插入点右侧，应向右移动 2
        ColResizeOp resize = new ColResizeOp("user1", 1000L, 1, 5, 120);
        ColInsertOp insert = new ColInsertOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(resize, insert);
        assertNotNull(result[0]);
        assertEquals(7, ((ColResizeOp) result[0]).getColIndex());
    }

    @Test
    void transform_colResizeVsColDelete_insideDelete_returnsNull() {
        // colResize(4) vs colDelete(3, 2)，resize 点在删除范围内，应被消除
        ColResizeOp resize = new ColResizeOp("user1", 1000L, 1, 4, 120);
        ColDeleteOp delete = new ColDeleteOp("user2", 1000L, 1, 3, 2);

        CollabOperation[] result = OTTransformer.transform(resize, delete);
        assertNull(result[0]);
    }

    @Test
    void transform_rowInsertVsColInsert_returnsClone() {
        // 行操作 vs 列操作，应返回克隆（不受影响）
        RowInsertOp rowInsert = new RowInsertOp("user1", 1000L, 1, 3, 2);
        ColInsertOp colInsert = new ColInsertOp("user2", 1000L, 1, 5, 1);

        CollabOperation[] result = OTTransformer.transform(rowInsert, colInsert);
        assertNotNull(result[0]);
        assertInstanceOf(RowInsertOp.class, result[0]);
        assertEquals(3, ((RowInsertOp) result[0]).getRowIndex());
        assertEquals(2, ((RowInsertOp) result[0]).getCount());
    }

    @Test
    void transform_rowDeleteVsColDelete_returnsClone() {
        // 行操作 vs 列操作，应返回克隆（不受影响）
        RowDeleteOp rowDelete = new RowDeleteOp("user1", 1000L, 1, 2, 3);
        ColDeleteOp colDelete = new ColDeleteOp("user2", 1000L, 1, 1, 2);

        CollabOperation[] result = OTTransformer.transform(rowDelete, colDelete);
        assertNotNull(result[0]);
        assertInstanceOf(RowDeleteOp.class, result[0]);
        assertEquals(2, ((RowDeleteOp) result[0]).getRowIndex());
        assertEquals(3, ((RowDeleteOp) result[0]).getCount());
    }

    // ============================================================
    // 任务 9.3：前后端一致性验证（OT 收敛性）
    // ============================================================

    @Test
    void convergence_colInsert_cellEdit_applyBothOrders() {
        // 验证 OT 收敛性：两个用户分别先应用不同操作，最终结果应一致
        // 用户1：先 colInsert(2, 1)，再 cellEdit(0, 3, "hello")（已被转换）
        // 用户2：先 cellEdit(0, 3, "hello")，再 colInsert(2, 1)（已被转换）

        ColInsertOp colInsert = new ColInsertOp("user1", 1000L, 1, 2, 1);
        CellEditOp cellEdit = new CellEditOp("user2", 1000L, 1, 0, 3, "hello", "");

        // 文档 A：先应用 colInsert，再应用转换后的 cellEdit
        SpreadsheetData docA = createSmallDoc(3, 5);
        DocumentApplier.apply(docA, colInsert);
        CollabOperation[] transformedForA = OTTransformer.transform(cellEdit, colInsert);
        assertNotNull(transformedForA[0]);
        DocumentApplier.apply(docA, transformedForA[0]);

        // 文档 B：先应用 cellEdit，再应用转换后的 colInsert
        SpreadsheetData docB = createSmallDoc(3, 5);
        DocumentApplier.apply(docB, cellEdit);
        CollabOperation[] transformedForB = OTTransformer.transform(colInsert, cellEdit);
        assertNotNull(transformedForB[0]);
        DocumentApplier.apply(docB, transformedForB[0]);

        // 两个文档的列数应相同
        assertEquals(docA.getCells().get(0).size(), docB.getCells().get(0).size());
        // 两个文档中 "hello" 应在同一位置
        String contentA = docA.getCells().get(0).get(4).getContent();
        String contentB = docB.getCells().get(0).get(4).getContent();
        assertEquals(contentA, contentB);
        assertEquals("hello", contentA);
    }

    @Test
    void convergence_colDelete_cellEdit_applyBothOrders() {
        // 验证 OT 收敛性：colDelete vs cellEdit（不在删除范围内）
        ColDeleteOp colDelete = new ColDeleteOp("user1", 1000L, 1, 1, 1);
        CellEditOp cellEdit = new CellEditOp("user2", 1000L, 1, 0, 3, "world", "");

        // 文档 A：先应用 colDelete，再应用转换后的 cellEdit
        SpreadsheetData docA = createSmallDoc(3, 5);
        DocumentApplier.apply(docA, colDelete);
        CollabOperation[] transformedForA = OTTransformer.transform(cellEdit, colDelete);
        assertNotNull(transformedForA[0]);
        DocumentApplier.apply(docA, transformedForA[0]);

        // 文档 B：先应用 cellEdit，再应用转换后的 colDelete
        SpreadsheetData docB = createSmallDoc(3, 5);
        DocumentApplier.apply(docB, cellEdit);
        CollabOperation[] transformedForB = OTTransformer.transform(colDelete, cellEdit);
        assertNotNull(transformedForB[0]);
        DocumentApplier.apply(docB, transformedForB[0]);

        // 两个文档的列数应相同
        assertEquals(docA.getCells().get(0).size(), docB.getCells().get(0).size());
        // "world" 应在同一位置（col=3 -> col=2 after delete col=1）
        String contentA = docA.getCells().get(0).get(2).getContent();
        String contentB = docB.getCells().get(0).get(2).getContent();
        assertEquals(contentA, contentB);
        assertEquals("world", contentA);
    }

    @Test
    void convergence_colInsert_colInsert_applyBothOrders() {
        // 验证两个 colInsert 操作的 OT 收敛性
        ColInsertOp opA = new ColInsertOp("user1", 1000L, 1, 2, 1);
        ColInsertOp opB = new ColInsertOp("user2", 1000L, 1, 4, 2);

        // 文档 A：先应用 opA，再应用转换后的 opB
        SpreadsheetData docA = createSmallDoc(2, 5);
        DocumentApplier.apply(docA, opA);
        CollabOperation[] transformedForA = OTTransformer.transform(opB, opA);
        assertNotNull(transformedForA[0]);
        DocumentApplier.apply(docA, transformedForA[0]);

        // 文档 B：先应用 opB，再应用转换后的 opA
        SpreadsheetData docB = createSmallDoc(2, 5);
        DocumentApplier.apply(docB, opB);
        CollabOperation[] transformedForB = OTTransformer.transform(opA, opB);
        assertNotNull(transformedForB[0]);
        DocumentApplier.apply(docB, transformedForB[0]);

        // 两个文档的列数应相同（5 + 1 + 2 = 8）
        assertEquals(8, docA.getCells().get(0).size());
        assertEquals(8, docB.getCells().get(0).size());
        assertEquals(docA.getCells().get(0).size(), docB.getCells().get(0).size());
    }

    @Test
    void otServer_receiveColInsert_incrementsRevision() {
        OTServer server = new OTServer();
        ColInsertOp op = new ColInsertOp("user1", 1000L, 0, 3, 1);
        OTServer.ReceiveResult result = server.receiveOperation(0, op);
        assertNotNull(result);
        assertEquals(1, result.getRevision());
    }

    @Test
    void otServer_receiveColDelete_transformsStaleEdit() {
        OTServer server = new OTServer();
        // 先提交一个 colDelete(2, 1)
        server.receiveOperation(0, new ColDeleteOp("user1", 1000L, 0, 2, 1));
        // 再提交一个基于 revision 0 的 cellEdit（col=4，落后了）
        CellEditOp staleEdit = new CellEditOp("user2", 2000L, 0, 0, 4, "test", "");
        OTServer.ReceiveResult result = server.receiveOperation(0, staleEdit);
        assertNotNull(result);
        assertEquals(2, result.getRevision());
        // col=4 在 colDelete(2, 1) 右侧，应向左移动 1 变为 col=3
        assertEquals(3, ((CellEditOp) result.getTransformedOp()).getCol());
    }
}
