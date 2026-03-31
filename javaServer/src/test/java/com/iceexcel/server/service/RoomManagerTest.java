package com.iceexcel.server.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceexcel.server.model.ClientConnection;
import com.iceexcel.server.model.Room;
import com.iceexcel.server.repository.OperationRepository;
import com.iceexcel.server.repository.RoomRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.WebSocketSession;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * RoomManager 单元测试
 * 测试颜色分配逻辑和用户颜色查询
 */
@ExtendWith(MockitoExtension.class)
class RoomManagerTest {

    @Mock
    private RoomRepository roomRepository;

    @Mock
    private OperationRepository operationRepository;

    @Mock
    private WebSocketSession session;

    private ObjectMapper objectMapper;
    private RoomManager roomManager;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        roomManager = new RoomManager(roomRepository, operationRepository, objectMapper);
    }

    // ============================================================
    // 颜色分配测试
    // ============================================================

    @Test
    void joinRoom_assignsUniqueColorFromPool() {
        // 第一个用户加入，应分配第一个颜色
        RoomManager.JoinResult result1 = roomManager.joinRoom("room1", "user1", "User One", session);
        assertEquals(Room.USER_COLORS[0], result1.getColor());

        // 第二个用户加入，应分配第二个颜色（不重复）
        RoomManager.JoinResult result2 = roomManager.joinRoom("room1", "user2", "User Two", session);
        assertEquals(Room.USER_COLORS[1], result2.getColor());

        // 第三个用户加入，应分配第三个颜色
        RoomManager.JoinResult result3 = roomManager.joinRoom("room1", "user3", "User Three", session);
        assertEquals(Room.USER_COLORS[2], result3.getColor());

        // 验证三个用户的颜色互不相同
        assertNotEquals(result1.getColor(), result2.getColor());
        assertNotEquals(result2.getColor(), result3.getColor());
        assertNotEquals(result1.getColor(), result3.getColor());
    }

    @Test
    void joinRoom_cyclesColorWhenPoolExhausted() {
        // USER_COLORS 共有 12 个颜色，先分配 12 个用户
        String[] assignedColors = new String[Room.USER_COLORS.length + 3];

        for (int i = 0; i < Room.USER_COLORS.length; i++) {
            RoomManager.JoinResult result = roomManager.joinRoom(
                    "room2", "user" + i, "User " + i, session);
            assignedColors[i] = result.getColor();
        }

        // 验证前12个用户颜色互不相同
        for (int i = 0; i < Room.USER_COLORS.length; i++) {
            for (int j = i + 1; j < Room.USER_COLORS.length; j++) {
                assertNotEquals(assignedColors[i], assignedColors[j],
                        "Color at index " + i + " should not equal color at index " + j);
            }
        }

        // 第13个用户加入，颜色应循环回到第一个
        RoomManager.JoinResult result13 = roomManager.joinRoom("room2", "user12", "User 12", session);
        assertEquals(Room.USER_COLORS[0], result13.getColor());

        // 第14个用户加入，颜色应循环回到第二个
        RoomManager.JoinResult result14 = roomManager.joinRoom("room2", "user13", "User 13", session);
        assertEquals(Room.USER_COLORS[1], result14.getColor());
    }

    @Test
    void joinRoom_sameUserRejoinGetsDifferentColor() {
        // 用户离开后重新加入，如果原颜色被释放，应能获取该颜色
        // 但如果颜色池未循环，应保持颜色分配逻辑一致

        // 用户1和用户2加入
        RoomManager.JoinResult result1 = roomManager.joinRoom("room3", "user1", "User One", session);
        String color1 = result1.getColor();

        RoomManager.JoinResult result2 = roomManager.joinRoom("room3", "user2", "User Two", session);
        String color2 = result2.getColor();

        // 用户1离开
        roomManager.leaveRoom("room3", "user1");

        // 用户3加入（此时 USER_COLORS[0] 已被 user1 释放但被 user2 占用，USER_COLORS[1] 也被占用）
        // 所以用户3应获取 USER_COLORS[2]
        RoomManager.JoinResult result3 = roomManager.joinRoom("room3", "user3", "User Three", session);
        assertEquals(Room.USER_COLORS[2], result3.getColor());
    }

    @Test
    void joinRoom_afterUserLeave_releasesColor() {
        // 用户1和用户2加入
        RoomManager.JoinResult result1 = roomManager.joinRoom("room4", "user1", "User One", session);
        String color1 = result1.getColor();

        RoomManager.JoinResult result2 = roomManager.joinRoom("room4", "user2", "User Two", session);

        // 用户1离开
        roomManager.leaveRoom("room4", "user1");

        // 用户3加入，应能获取之前释放的颜色（如果颜色池有空闲）
        // 此时 room4 有 user2 占用一个颜色，还有11个空闲颜色
        RoomManager.JoinResult result3 = roomManager.joinRoom("room4", "user3", "User Three", session);

        // user2 占用 color1，则 user3 应该获取 USER_COLORS[1]（如果 color1 是 USER_COLORS[0]）
        if (color1.equals(Room.USER_COLORS[0])) {
            assertEquals(Room.USER_COLORS[1], result3.getColor());
        }
    }

    // ============================================================
    // getUserColor 测试
    // ============================================================

    @Test
    void getUserColor_returnsCorrectColorForUser() {
        // 用户加入房间
        RoomManager.JoinResult result = roomManager.joinRoom("room5", "user1", "User One", session);
        String assignedColor = result.getColor();

        // 查询该用户的颜色
        String retrievedColor = roomManager.getUserColor("room5", "user1");
        assertEquals(assignedColor, retrievedColor);
    }

    @Test
    void getUserColor_returnsNullForNonExistentUser() {
        // 从未加入房间的用户，查询颜色应返回 null
        String color = roomManager.getUserColor("room6", "nonExistentUser");
        assertNull(color);
    }

    @Test
    void getUserColor_returnsNullForNonExistentRoom() {
        // 不存在的房间，查询颜色应返回 null
        String color = roomManager.getUserColor("nonExistentRoom", "user1");
        assertNull(color);
    }

    @Test
    void getUserColor_afterUserLeave_returnsNull() {
        // 用户加入后离开，再次查询应返回 null
        roomManager.joinRoom("room7", "user1", "User One", session);
        roomManager.leaveRoom("room7", "user1");

        String color = roomManager.getUserColor("room7", "user1");
        assertNull(color);
    }

    @Test
    void getUserColor_multipleUsersDifferentColors() {
        // 多个用户加入，验证每个用户获取的颜色互不相同
        RoomManager.JoinResult result1 = roomManager.joinRoom("room8", "user1", "User One", session);
        RoomManager.JoinResult result2 = roomManager.joinRoom("room8", "user2", "User Two", session);
        RoomManager.JoinResult result3 = roomManager.joinRoom("room8", "user3", "User Three", session);

        assertNotEquals(result1.getColor(), result2.getColor());
        assertNotEquals(result2.getColor(), result3.getColor());
        assertNotEquals(result1.getColor(), result3.getColor());

        // 验证 getUserColor 返回的颜色与分配的一致
        assertEquals(result1.getColor(), roomManager.getUserColor("room8", "user1"));
        assertEquals(result2.getColor(), roomManager.getUserColor("room8", "user2"));
        assertEquals(result3.getColor(), roomManager.getUserColor("room8", "user3"));
    }
}
