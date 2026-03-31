package com.iceexcel.server.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.iceexcel.server.model.ClientConnection;
import com.iceexcel.server.model.RemoteUser;
import com.iceexcel.server.service.RoomManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * CollabWebSocketHandler 单元测试
 * 测试 handleCursor 方法的 cursor 消息广播功能
 */
@ExtendWith(MockitoExtension.class)
class CollabWebSocketHandlerTest {

    @Mock
    private RoomManager roomManager;

    @Mock
    private WebSocketSession session;

    @Mock
    private WebSocketSession otherSession;

    private ObjectMapper objectMapper;
    private CollabWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.findAndRegisterModules();
        handler = new CollabWebSocketHandler(roomManager, objectMapper);
    }

    // ============================================================
    // handleCursor 测试
    // ============================================================

    @Test
    void handleCursor_broadcastIncludesColorField() throws Exception {
        String roomId = "room1";
        String userId = "user1";
        String userColor = "#FF6B6B";

        // 模拟 findClientBySession 返回客户端信息
        when(roomManager.findClientBySession(session)).thenReturn(new RoomManager.ClientInfo(roomId, userId));

        // 模拟 getUserColor 返回用户颜色
        when(roomManager.getUserColor(roomId, userId)).thenReturn(userColor);

        // 模拟 getOtherClients 返回其他客户端（用于广播）
        ClientConnection otherClient = new ClientConnection();
        otherClient.setUserId("user2");
        otherClient.setUserName("User Two");
        otherClient.setColor("#4ECDC4");
        otherClient.setSession(otherSession);
        when(roomManager.getOtherClients(roomId, userId)).thenReturn(List.of(otherClient));
        when(otherSession.isOpen()).thenReturn(true);

        // 构建 cursor 消息 payload
        ObjectNode payload = objectMapper.createObjectNode();
        ObjectNode selection = objectMapper.createObjectNode();
        selection.put("startRow", 0);
        selection.put("startCol", 0);
        selection.put("endRow", 0);
        selection.put("endCol", 0);
        payload.set("selection", selection);

        // 调用 handleCursor
        handler.handleCursor(roomId, userId, payload);

        // 验证向其他客户端发送了消息
        ArgumentCaptor<TextMessage> messageCaptor = ArgumentCaptor.forClass(TextMessage.class);
        verify(otherSession).sendMessage(messageCaptor.capture());

        // 解析发送的消息
        String messageJson = messageCaptor.getValue().getPayload();
        JsonNode root = objectMapper.readTree(messageJson);

        // 验证消息类型是 cursor
        assertEquals("cursor", root.get("type").asText());

        // 验证 payload 包含 color 字段
        JsonNode cursorPayload = root.get("payload");
        assertTrue(cursorPayload.has("color"), "cursor payload should contain color field");
        assertEquals(userColor, cursorPayload.get("color").asText());

        // 验证 payload 包含 userId 字段
        assertTrue(cursorPayload.has("userId"));
        assertEquals(userId, cursorPayload.get("userId").asText());

        // 验证 payload 包含 selection 字段
        assertTrue(cursorPayload.has("selection"));
    }

    @Test
    void handleCursor_noBroadcastWhenNoOtherClients() {
        String roomId = "room2";
        String userId = "user1";

        when(roomManager.findClientBySession(session)).thenReturn(new RoomManager.ClientInfo(roomId, userId));
        when(roomManager.getUserColor(roomId, userId)).thenReturn("#FF6B6B");
        when(roomManager.getOtherClients(roomId, userId)).thenReturn(Collections.emptyList());

        ObjectNode payload = objectMapper.createObjectNode();
        ObjectNode selection = objectMapper.createObjectNode();
        selection.put("startRow", 5);
        selection.put("startCol", 3);
        payload.set("selection", selection);

        // 调用 handleCursor，不应有异常
        handler.handleCursor(roomId, userId, payload);

        // 验证没有发送任何消息
        verifyNoInteractions(otherSession);
    }

    @Test
    void handleCursor_broadcastsToAllOtherClients() throws Exception {
        String roomId = "room3";
        String userId = "user1";
        String userColor = "#45B7D1";

        when(roomManager.findClientBySession(session)).thenReturn(new RoomManager.ClientInfo(roomId, userId));
        when(roomManager.getUserColor(roomId, userId)).thenReturn(userColor);

        // 模拟多个其他客户端
        WebSocketSession session2 = mock(WebSocketSession.class);
        WebSocketSession session3 = mock(WebSocketSession.class);

        ClientConnection client2 = new ClientConnection();
        client2.setUserId("user2");
        client2.setSession(session2);
        when(session2.isOpen()).thenReturn(true);

        ClientConnection client3 = new ClientConnection();
        client3.setUserId("user3");
        client3.setSession(session3);
        when(session3.isOpen()).thenReturn(true);

        when(roomManager.getOtherClients(roomId, userId)).thenReturn(List.of(client2, client3));

        ObjectNode payload = objectMapper.createObjectNode();
        ObjectNode selection = objectMapper.createObjectNode();
        selection.put("startRow", 0);
        payload.set("selection", selection);

        handler.handleCursor(roomId, userId, payload);

        // 验证两个其他客户端都收到了消息
        verify(session2).sendMessage(any(TextMessage.class));
        verify(session3).sendMessage(any(TextMessage.class));
    }

    @Test
    void handleCursor_doesNotSendToOriginalUser() {
        String roomId = "room4";
        String userId = "user1";

        when(roomManager.findClientBySession(session)).thenReturn(new RoomManager.ClientInfo(roomId, userId));
        when(roomManager.getUserColor(roomId, userId)).thenReturn("#FF6B6B");
        when(roomManager.getOtherClients(roomId, userId)).thenReturn(Collections.emptyList());

        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("selection", "{}");

        // 调用 handleCursor
        handler.handleCursor(roomId, userId, payload);

        // 验证没有向原用户发送消息（因为是广播给其他用户）
        verify(session, never()).sendMessage(any(TextMessage.class));
    }
}
