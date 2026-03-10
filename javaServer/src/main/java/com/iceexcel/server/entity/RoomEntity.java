package com.iceexcel.server.entity;

import jakarta.persistence.*;

/**
 * 房间 JPA 实体，对应 rooms 表。
 * 存储房间的文档快照（JSON）和当前修订号。
 */
@Entity
@Table(name = "rooms")
public class RoomEntity {

    @Id
    @Column(name = "room_id", length = 255)
    private String roomId;

    @Column(name = "document_json", columnDefinition = "JSON")
    @Lob
    private String documentJson;

    @Column(name = "revision")
    private int revision;

    @Column(name = "updated_at")
    private long updatedAt;

    public RoomEntity() {
    }

    public RoomEntity(String roomId, String documentJson, int revision, long updatedAt) {
        this.roomId = roomId;
        this.documentJson = documentJson;
        this.revision = revision;
        this.updatedAt = updatedAt;
    }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getDocumentJson() { return documentJson; }
    public void setDocumentJson(String documentJson) { this.documentJson = documentJson; }

    public int getRevision() { return revision; }
    public void setRevision(int revision) { this.revision = revision; }

    public long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(long updatedAt) { this.updatedAt = updatedAt; }
}
