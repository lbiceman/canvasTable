package com.iceexcel.server.service;

import com.iceexcel.server.model.CollabOperation;

import java.util.ArrayList;
import java.util.List;

/**
 * OT 服务端状态管理
 * 从 server/src/ot-server.ts 翻译。
 * 接收客户端操作、分配递增修订号、对过期操作执行转换、维护操作历史。
 */
public class OTServer {

    // 已确认操作历史
    private List<CollabOperation> operations;
    // 当前修订号（等于 operations.size()）
    private int revision;

    public OTServer() {
        this.operations = new ArrayList<>();
        this.revision = 0;
    }

    public OTServer(List<CollabOperation> operations, int revision) {
        this.operations = new ArrayList<>(operations);
        this.revision = revision;
    }

    /**
     * 接收客户端操作并处理
     *
     * 1. 如果客户端的修订号落后于服务器当前修订号，
     *    对操作执行转换以适配当前文档状态
     * 2. 分配递增的修订号
     * 3. 将操作加入历史
     *
     * @param clientRevision 客户端发送操作时的修订号
     * @param op 客户端提交的操作
     * @return 处理结果，包含新修订号和转换后的操作；如果操作被消除则返回 null
     */
    public ReceiveResult receiveOperation(int clientRevision, CollabOperation op) {
        // 获取客户端修订号之后的所有已确认操作
        // 这些是客户端尚未看到的操作，需要对新操作进行转换
        List<CollabOperation> concurrentOps = operations.subList(
                Math.min(clientRevision, operations.size()),
                operations.size()
        );

        // 对操作执行转换，使其适配当前文档状态
        CollabOperation transformedOp = OTTransformer.transformAgainst(op, concurrentOps);

        // 如果操作在转换后被消除（例如编辑的行被删除），返回 null
        if (transformedOp == null) {
            return null;
        }

        // 分配递增修订号
        revision += 1;
        transformedOp.setRevision(revision);

        // 将操作加入历史
        operations.add(transformedOp);

        return new ReceiveResult(revision, transformedOp);
    }

    /**
     * 获取指定修订号之后的所有操作（用于客户端重连同步）
     */
    public List<CollabOperation> getOperationsSince(int sinceRevision) {
        int fromIndex = Math.min(sinceRevision, operations.size());
        return new ArrayList<>(operations.subList(fromIndex, operations.size()));
    }

    // ============================================================
    // Getter / Setter
    // ============================================================

    public List<CollabOperation> getOperations() {
        return operations;
    }

    public void setOperations(List<CollabOperation> operations) {
        this.operations = operations;
    }

    public int getRevision() {
        return revision;
    }

    public void setRevision(int revision) {
        this.revision = revision;
    }

    /**
     * 操作接收结果
     */
    public static class ReceiveResult {
        private final int revision;
        private final CollabOperation transformedOp;

        public ReceiveResult(int revision, CollabOperation transformedOp) {
            this.revision = revision;
            this.transformedOp = transformedOp;
        }

        public int getRevision() {
            return revision;
        }

        public CollabOperation getTransformedOp() {
            return transformedOp;
        }
    }
}
