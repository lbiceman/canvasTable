package com.iceexcel.server.model;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 房间内存模型，与 TypeScript Room 接口对应
 */
public class Room {

    private String roomId;
    private WorkbookData workbook;
    private List<CollabOperation> operations;
    private int revision;
    private int lastSnapshotOpCount;
    private ConcurrentHashMap<String, ClientConnection> clients;

    public Room() {
        this.operations = new ArrayList<>();
        this.revision = 0;
        this.clients = new ConcurrentHashMap<>();
    }

    public Room(String roomId, WorkbookData workbook) {
        this.roomId = roomId;
        this.workbook = workbook;
        this.operations = new ArrayList<>();
        this.revision = 0;
        this.clients = new ConcurrentHashMap<>();
    }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public WorkbookData getWorkbook() { return workbook; }
    public void setWorkbook(WorkbookData workbook) { this.workbook = workbook; }

    public List<CollabOperation> getOperations() { return operations; }
    public void setOperations(List<CollabOperation> operations) { this.operations = operations; }

    public int getRevision() { return revision; }
    public void setRevision(int revision) { this.revision = revision; }

    public int getLastSnapshotOpCount() { return lastSnapshotOpCount; }
    public void setLastSnapshotOpCount(int lastSnapshotOpCount) { this.lastSnapshotOpCount = lastSnapshotOpCount; }

    public ConcurrentHashMap<String, ClientConnection> getClients() { return clients; }
    public void setClients(ConcurrentHashMap<String, ClientConnection> clients) { this.clients = clients; }

    /**
     * 预定义用户颜色池，与 TypeScript USER_COLORS 常量一致
     */
    public static final String[] USER_COLORS = {
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
            "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
            "#BB8FCE", "#85C1E9", "#F8C471", "#82E0AA"
    };
}
