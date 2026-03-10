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
}
