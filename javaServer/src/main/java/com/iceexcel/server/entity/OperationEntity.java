package com.iceexcel.server.entity;

import jakarta.persistence.*;

/**
 * 操作历史 JPA 实体，对应 operations 表。
 * 存储每个协同操作的 JSON 序列化数据，支持按修订号范围查询。
 */
@Entity
@Table(name = "operations", indexes = {
        @Index(name = "idx_room_revision", columnList = "room_id, revision")
})
public class OperationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_id", length = 255, nullable = false)
    private String roomId;

    @Column(name = "revision", nullable = false)
    private int revision;

    @Column(name = "operation_json", columnDefinition = "JSON")
    @Lob
    private String operationJson;

    @Column(name = "user_id", length = 255)
    private String userId;

    @Column(name = "timestamp")
    private long timestamp;

    public OperationEntity() {
    }

    public OperationEntity(String roomId, int revision, String operationJson, String userId, long timestamp) {
        this.roomId = roomId;
        this.revision = revision;
        this.operationJson = operationJson;
        this.userId = userId;
        this.timestamp = timestamp;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public int getRevision() { return revision; }
    public void setRevision(int revision) { this.revision = revision; }

    public String getOperationJson() { return operationJson; }
    public void setOperationJson(String operationJson) { this.operationJson = operationJson; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}
