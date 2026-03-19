package com.iceexcel.server.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.iceexcel.server.model.*;
import com.iceexcel.server.service.OTServer;
import com.iceexcel.server.service.RoomManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;

/**
 * WebSocket 消息处理器
 * 从 server/src/index.ts 翻译，处理所有 WebSocket 消息的路由和分发。
 */
@Component
public class CollabWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(CollabWebSocketHandler.class);

    // 同步请求修订号差距阈值，超过此值发送完整快照
    private static final int SYNC_SNAPSHOT_THRESHOLD = 100;

    private final RoomManager roomManager;
    private final ObjectMapper objectMapper;

    public CollabWebSocketHandler(RoomManager roomManager, ObjectMapper objectMapper) {
        this.roomManager = roomManager;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode root = objectMapper.readTree(message.getPayload());
            String type = root.path("type").asText();
            JsonNode payload = root.get("payload");

            if ("join".equals(type)) {
                handleJoin(session, payload);
                return;
            }

            // 其他消息需要先找到客户端所在的房间
            RoomManager.ClientInfo clientInfo = roomManager.findClientBySession(session);
            if (clientInfo == null) {
                log.warn("收到未加入房间的客户端消息，忽略");
                return;
            }

            String roomId = clientInfo.getRoomId();
            String userId = clientInfo.getUserId();

            switch (type) {
                case "operation":
                    handleOperation(session, roomId, userId, payload);
                    break;
                case "cursor":
                    handleCursor(roomId, userId, payload);
                    break;
                case "sync":
                    handleSync(session, roomId, payload);
                    break;
                case "leave":
                    handleDisconnect(session);
                    break;
                default:
                    log.warn("未知消息类型: {}", type);
            }
        } catch (Exception e) {
            log.error("消息处理错误:", e);
        }
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("新客户端连接: {}", session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        handleDisconnect(session);
        log.info("客户端断开连接: {}", session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("WebSocket 传输错误, session={}: {}", session.getId(), exception.getMessage());
    }

    // ============================================================
    // 消息处理方法
    // ============================================================

    /**
     * 处理加入房间请求
     */
    private void handleJoin(WebSocketSession session, JsonNode payload) {
        String roomId = payload.path("roomId").asText();
        String userId = payload.path("userId").asText();
        String userName = payload.path("userName").asText();

        RoomManager.JoinResult joinResult = roomManager.joinRoom(roomId, userId, userName, session);
        String color = joinResult.getColor();
        Room room = joinResult.getRoom();

        // 发送当前文档状态给新加入的客户端
        ObjectNode statePayload = objectMapper.createObjectNode();
        statePayload.set("workbook", objectMapper.valueToTree(room.getWorkbook()));
        statePayload.put("revision", roomManager.getRevision(roomId));
        statePayload.set("users", objectMapper.valueToTree(roomManager.getAllUsers(roomId)));
        sendMessage(session, "state", statePayload);

        // 通知房间内其他用户有新用户加入
        ObjectNode userJoinPayload = objectMapper.createObjectNode();
        ObjectNode userNode = objectMapper.createObjectNode();
        userNode.put("userId", userId);
        userNode.put("userName", userName);
        userNode.put("color", color);
        userNode.putNull("selection");
        userNode.put("lastActive", System.currentTimeMillis());
        userJoinPayload.set("user", userNode);
        broadcastToOthers(roomId, userId, "user_join", userJoinPayload);

        log.info("用户 {}({}) 加入房间 {}", userName, userId, roomId);
    }

    /**
     * 处理操作消息
     */
    private void handleOperation(WebSocketSession session, String roomId, String userId, JsonNode payload) {
        try {
            int revision = payload.path("revision").asInt();
            CollabOperation operation = objectMapper.treeToValue(payload.get("operation"), CollabOperation.class);

            OTServer.ReceiveResult result = roomManager.receiveOperation(roomId, revision, operation);

            if (result != null) {
                // 向发送者确认操作
                ObjectNode ackPayload = objectMapper.createObjectNode();
                ackPayload.put("revision", result.getRevision());
                sendMessage(session, "ack", ackPayload);

                // 向其他客户端广播转换后的操作
                ObjectNode remoteOpPayload = objectMapper.createObjectNode();
                remoteOpPayload.put("revision", result.getRevision());
                remoteOpPayload.set("operation", objectMapper.valueToTree(result.getTransformedOp()));
                remoteOpPayload.put("userId", userId);
                broadcastToOthers(roomId, userId, "remote_op", remoteOpPayload);
            } else {
                // 操作被消除，仍然发送确认
                ObjectNode ackPayload = objectMapper.createObjectNode();
                ackPayload.put("revision", roomManager.getRevision(roomId));
                sendMessage(session, "ack", ackPayload);
            }
        } catch (Exception e) {
            log.error("处理操作消息失败:", e);
        }
    }

    /**
     * 处理光标更新消息
     */
    private void handleCursor(String roomId, String userId, JsonNode payload) {
        ObjectNode cursorPayload = objectMapper.createObjectNode();
        cursorPayload.put("userId", userId);
        cursorPayload.set("selection", payload.get("selection"));
        broadcastToOthers(roomId, userId, "cursor", cursorPayload);
    }

    /**
     * 处理同步请求（客户端重连后请求缺失的操作）
     */
    private void handleSync(WebSocketSession session, String roomId, JsonNode payload) {
        int sinceRevision = payload.path("sinceRevision").asInt();
        int currentRevision = roomManager.getRevision(roomId);

        // 如果差距超过阈值，发送完整文档快照
        if (currentRevision - sinceRevision > SYNC_SNAPSHOT_THRESHOLD) {
            WorkbookData workbook = roomManager.getWorkbook(roomId);
            ObjectNode statePayload = objectMapper.createObjectNode();
            statePayload.set("workbook", objectMapper.valueToTree(workbook));
            statePayload.put("revision", currentRevision);
            statePayload.set("users", objectMapper.valueToTree(roomManager.getAllUsers(roomId)));
            sendMessage(session, "state", statePayload);
        } else {
            // 发送缺失的操作
            List<CollabOperation> ops = roomManager.getOperationsSince(roomId, sinceRevision);
            for (CollabOperation op : ops) {
                ObjectNode remoteOpPayload = objectMapper.createObjectNode();
                remoteOpPayload.put("revision", op.getRevision());
                remoteOpPayload.set("operation", objectMapper.valueToTree(op));
                remoteOpPayload.put("userId", op.getUserId());
                sendMessage(session, "remote_op", remoteOpPayload);
            }
        }
    }

    /**
     * 处理客户端断开连接
     */
    private void handleDisconnect(WebSocketSession session) {
        RoomManager.ClientInfo clientInfo = roomManager.findClientBySession(session);
        if (clientInfo == null) return;

        String roomId = clientInfo.getRoomId();
        String userId = clientInfo.getUserId();
        roomManager.leaveRoom(roomId, userId);

        // 通知其他用户
        ObjectNode leavePayload = objectMapper.createObjectNode();
        leavePayload.put("userId", userId);
        broadcastToOthers(roomId, userId, "user_leave", leavePayload);

        log.info("用户 {} 离开房间 {}", userId, roomId);
    }

    // ============================================================
    // 辅助方法
    // ============================================================

    /**
     * 向指定 WebSocket 会话发送消息
     */
    private void sendMessage(WebSocketSession session, String type, JsonNode payload) {
        if (!session.isOpen()) return;
        try {
            ObjectNode message = objectMapper.createObjectNode();
            message.put("type", type);
            message.set("payload", payload);
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
        } catch (IOException e) {
            log.error("发送消息失败, session={}: {}", session.getId(), e.getMessage());
        }
    }

    /**
     * 向房间内其他客户端广播消息
     */
    private void broadcastToOthers(String roomId, String excludeUserId, String type, JsonNode payload) {
        List<ClientConnection> clients = roomManager.getOtherClients(roomId, excludeUserId);
        if (clients.isEmpty()) return;

        try {
            ObjectNode message = objectMapper.createObjectNode();
            message.put("type", type);
            message.set("payload", payload);
            String data = objectMapper.writeValueAsString(message);
            TextMessage textMessage = new TextMessage(data);

            for (ClientConnection client : clients) {
                WebSocketSession ws = client.getSession();
                if (ws != null && ws.isOpen()) {
                    try {
                        ws.sendMessage(textMessage);
                    } catch (IOException e) {
                        log.error("广播消息失败, userId={}: {}", client.getUserId(), e.getMessage());
                    }
                }
            }
        } catch (IOException e) {
            log.error("序列化广播消息失败:", e);
        }
    }
}
