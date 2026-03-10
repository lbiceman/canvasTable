package com.iceexcel.server.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iceexcel.server.entity.OperationEntity;
import com.iceexcel.server.entity.RoomEntity;
import com.iceexcel.server.model.*;
import com.iceexcel.server.repository.OperationRepository;
import com.iceexcel.server.repository.RoomRepository;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.util.*;
import java.util.concurrent.*;

/**
 * 房间管理服务
 * 管理所有房间的生命周期，协调 OT 引擎和数据持久化。
 * 从 server/src/room-manager.ts 的 RoomManager 类翻译。
 */
@Service
public class RoomManager {

    private static final Logger log = LoggerFactory.getLogger(RoomManager.class);

    // 默认行列数
    private static final int DEFAULT_ROWS = 50;
    private static final int DEFAULT_COLS = 26;
    private static final int DEFAULT_ROW_HEIGHT = 28;
    private static final int DEFAULT_COL_WIDTH = 100;

    // 保存防抖间隔（毫秒）
    private static final long SAVE_DEBOUNCE_MS = 2000;

    // 所有房间（内存）
    private final ConcurrentHashMap<String, Room> rooms = new ConcurrentHashMap<>();
    // 每个房间的 OT 服务端状态
    private final ConcurrentHashMap<String, OTServer> otStates = new ConcurrentHashMap<>();
    // 保存防抖定时器
    private final ConcurrentHashMap<String, ScheduledFuture<?>> saveTimers = new ConcurrentHashMap<>();

    // 防抖保存调度器
    private final ScheduledExecutorService saveScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "room-save-scheduler");
        t.setDaemon(true);
        return t;
    });

    private final RoomRepository roomRepository;
    private final OperationRepository operationRepository;
    private final ObjectMapper objectMapper;

    public RoomManager(RoomRepository roomRepository,
                       OperationRepository operationRepository,
                       ObjectMapper objectMapper) {
        this.roomRepository = roomRepository;
        this.operationRepository = operationRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * 创建空白文档（50行×26列）
     */
    private SpreadsheetData createEmptyDocument() {
        List<List<Cell>> cells = new ArrayList<>(DEFAULT_ROWS);
        for (int r = 0; r < DEFAULT_ROWS; r++) {
            List<Cell> row = new ArrayList<>(DEFAULT_COLS);
            for (int c = 0; c < DEFAULT_COLS; c++) {
                row.add(new Cell());
            }
            cells.add(row);
        }
        List<Integer> rowHeights = new ArrayList<>(DEFAULT_ROWS);
        for (int i = 0; i < DEFAULT_ROWS; i++) {
            rowHeights.add(DEFAULT_ROW_HEIGHT);
        }
        List<Integer> colWidths = new ArrayList<>(DEFAULT_COLS);
        for (int i = 0; i < DEFAULT_COLS; i++) {
            colWidths.add(DEFAULT_COL_WIDTH);
        }
        return new SpreadsheetData(cells, rowHeights, colWidths);
    }

    /**
     * 获取或创建房间
     * 优先从数据库加载已有数据，不存在则创建空白文档
     */
    public Room getOrCreateRoom(String roomId) {
        return rooms.computeIfAbsent(roomId, id -> {
            // 尝试从数据库加载
            Optional<RoomEntity> entityOpt = roomRepository.findById(id);
            if (entityOpt.isPresent()) {
                RoomEntity entity = entityOpt.get();
                try {
                    SpreadsheetData document = objectMapper.readValue(
                            entity.getDocumentJson(), SpreadsheetData.class);

                    // 加载操作历史
                    List<OperationEntity> opEntities =
                            operationRepository.findByRoomIdOrderByRevisionAsc(id);
                    List<CollabOperation> operations = new ArrayList<>();
                    for (OperationEntity opEntity : opEntities) {
                        CollabOperation op = objectMapper.readValue(
                                opEntity.getOperationJson(), CollabOperation.class);
                        operations.add(op);
                    }

                    // 恢复 OT 状态
                    OTServer otServer = new OTServer(operations, entity.getRevision());
                    otStates.put(id, otServer);

                    Room room = new Room(id, document);
                    room.setOperations(operations);
                    room.setRevision(entity.getRevision());
                    log.info("从数据库恢复房间 {}，修订号: {}", id, entity.getRevision());
                    return room;
                } catch (JsonProcessingException e) {
                    log.error("解析房间 {} 数据失败，创建空白文档", id, e);
                }
            }

            // 数据库中不存在，创建空白房间
            otStates.put(id, new OTServer());
            return new Room(id, createEmptyDocument());
        });
    }

    /**
     * 用户加入房间
     * 返回分配给用户的颜色和当前房间
     */
    public JoinResult joinRoom(String roomId, String userId, String userName, WebSocketSession session) {
        Room room = getOrCreateRoom(roomId);

        // 分配颜色：从颜色池中选择未被使用的颜色
        Set<String> usedColors = new HashSet<>();
        for (ClientConnection c : room.getClients().values()) {
            usedColors.add(c.getColor());
        }
        String color = null;
        for (String candidate : Room.USER_COLORS) {
            if (!usedColors.contains(candidate)) {
                color = candidate;
                break;
            }
        }
        // 如果所有颜色都被使用，循环分配
        if (color == null) {
            color = Room.USER_COLORS[room.getClients().size() % Room.USER_COLORS.length];
        }

        ClientConnection client = new ClientConnection(userId, userName, color, session);
        room.getClients().put(userId, client);

        return new JoinResult(color, room);
    }

    /**
     * 用户离开房间
     * 返回 true 如果房间仍有用户，false 如果房间已空
     */
    public boolean leaveRoom(String roomId, String userId) {
        Room room = rooms.get(roomId);
        if (room == null) return false;

        room.getClients().remove(userId);

        // 如果房间为空，立即保存数据到数据库
        if (room.getClients().isEmpty()) {
            // 取消防抖定时器，立即保存
            cancelSaveTimer(roomId);
            persistRoom(roomId);
        }

        return !room.getClients().isEmpty();
    }

    /**
     * 接收并处理操作
     */
    public OTServer.ReceiveResult receiveOperation(String roomId, int clientRevision, CollabOperation op) {
        OTServer otServer = otStates.get(roomId);
        if (otServer == null) return null;

        OTServer.ReceiveResult result = otServer.receiveOperation(clientRevision, op);
        if (result != null) {
            // 同步房间的修订号和操作历史
            Room room = rooms.get(roomId);
            if (room != null) {
                room.setRevision(result.getRevision());
                room.getOperations().add(result.getTransformedOp());
                // 将操作应用到文档快照，保持文档状态最新
                DocumentApplier.apply(room.getDocument(), result.getTransformedOp());
            }
            // 防抖保存到数据库
            scheduleSave(roomId);
        }
        return result;
    }

    /**
     * 获取指定修订号之后的操作（用于重连同步）
     */
    public List<CollabOperation> getOperationsSince(String roomId, int sinceRevision) {
        OTServer otServer = otStates.get(roomId);
        if (otServer == null) return Collections.emptyList();
        return otServer.getOperationsSince(sinceRevision);
    }

    /**
     * 获取房间当前修订号
     */
    public int getRevision(String roomId) {
        OTServer otServer = otStates.get(roomId);
        return otServer != null ? otServer.getRevision() : 0;
    }

    /**
     * 获取房间的文档状态
     */
    public SpreadsheetData getDocument(String roomId) {
        Room room = rooms.get(roomId);
        return room != null ? room.getDocument() : null;
    }

    /**
     * 获取房间内的远程用户列表
     */
    public List<RemoteUser> getRemoteUsers(String roomId, String excludeUserId) {
        Room room = rooms.get(roomId);
        if (room == null) return Collections.emptyList();

        List<RemoteUser> users = new ArrayList<>();
        for (ClientConnection client : room.getClients().values()) {
            if (excludeUserId != null && client.getUserId().equals(excludeUserId)) continue;
            users.add(new RemoteUser(client.getUserId(), client.getUserName(), client.getColor()));
        }
        return users;
    }

    /**
     * 获取房间内所有用户列表（包括自己）
     */
    public List<RemoteUser> getAllUsers(String roomId) {
        return getRemoteUsers(roomId, null);
    }

    /**
     * 获取房间内所有客户端连接（可排除指定用户）
     */
    public List<ClientConnection> getOtherClients(String roomId, String excludeUserId) {
        Room room = rooms.get(roomId);
        if (room == null) return Collections.emptyList();

        List<ClientConnection> clients = new ArrayList<>();
        for (ClientConnection client : room.getClients().values()) {
            if (!client.getUserId().equals(excludeUserId)) {
                clients.add(client);
            }
        }
        return clients;
    }

    /**
     * 通过 WebSocketSession 查找用户所在的房间和用户 ID
     */
    public ClientInfo findClientBySession(WebSocketSession session) {
        for (Map.Entry<String, Room> entry : rooms.entrySet()) {
            for (Map.Entry<String, ClientConnection> clientEntry : entry.getValue().getClients().entrySet()) {
                if (clientEntry.getValue().getSession().equals(session)) {
                    return new ClientInfo(entry.getKey(), clientEntry.getKey());
                }
            }
        }
        return null;
    }

    // ============================================================
    // 防抖保存逻辑
    // ============================================================

    /**
     * 防抖保存房间数据到数据库
     * 避免每次操作都写数据库，合并短时间内的多次写入
     */
    private void scheduleSave(String roomId) {
        cancelSaveTimer(roomId);
        ScheduledFuture<?> future = saveScheduler.schedule(
                () -> persistRoom(roomId),
                SAVE_DEBOUNCE_MS,
                TimeUnit.MILLISECONDS
        );
        saveTimers.put(roomId, future);
    }

    /**
     * 取消指定房间的防抖保存定时器
     */
    private void cancelSaveTimer(String roomId) {
        ScheduledFuture<?> existing = saveTimers.remove(roomId);
        if (existing != null) {
            existing.cancel(false);
        }
    }

    /**
     * 立即保存房间数据到数据库
     */
    private void persistRoom(String roomId) {
        Room room = rooms.get(roomId);
        OTServer otServer = otStates.get(roomId);
        if (room == null || otServer == null) return;

        try {
            String documentJson = objectMapper.writeValueAsString(room.getDocument());
            int revision = otServer.getRevision();

            // 保存房间文档快照
            RoomEntity entity = new RoomEntity(roomId, documentJson, revision, System.currentTimeMillis());
            roomRepository.save(entity);

            // 保存操作历史（增量保存：只保存数据库中还没有的操作）
            // 查询数据库中该房间已有的最大修订号
            List<OperationEntity> existingOps =
                    operationRepository.findByRoomIdOrderByRevisionAsc(roomId);
            int maxExistingRevision = existingOps.isEmpty() ? 0 :
                    existingOps.get(existingOps.size() - 1).getRevision();

            // 只保存新增的操作
            List<CollabOperation> allOps = otServer.getOperations();
            List<OperationEntity> newEntities = new ArrayList<>();
            for (CollabOperation op : allOps) {
                if (op.getRevision() > maxExistingRevision) {
                    String opJson = objectMapper.writeValueAsString(op);
                    newEntities.add(new OperationEntity(
                            roomId, op.getRevision(), opJson,
                            op.getUserId(), op.getTimestamp()));
                }
            }
            if (!newEntities.isEmpty()) {
                operationRepository.saveAll(newEntities);
            }

            log.info("房间 {} 数据已保存，修订号: {}", roomId, revision);
        } catch (JsonProcessingException e) {
            log.error("保存房间 {} 数据失败：JSON 序列化错误", roomId, e);
            throw new RuntimeException("保存房间数据失败", e);
        }
    }

    /**
     * 保存所有房间数据（用于服务器关闭时）
     */
    public void saveAll() {
        for (String roomId : rooms.keySet()) {
            cancelSaveTimer(roomId);
            try {
                persistRoom(roomId);
            } catch (Exception e) {
                log.error("关闭时保存房间 {} 数据失败", roomId, e);
            }
        }
    }

    /**
     * 服务器关闭时保存所有房间数据并关闭调度器
     */
    @PreDestroy
    public void shutdown() {
        log.info("服务器关闭中，保存所有房间数据...");
        saveAll();
        saveScheduler.shutdown();
        try {
            if (!saveScheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                saveScheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            saveScheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
        log.info("所有房间数据已保存");
    }

    // ============================================================
    // 内部结果类
    // ============================================================

    /**
     * 加入房间结果
     */
    public static class JoinResult {
        private final String color;
        private final Room room;

        public JoinResult(String color, Room room) {
            this.color = color;
            this.room = room;
        }

        public String getColor() { return color; }
        public Room getRoom() { return room; }
    }

    /**
     * 客户端查找结果
     */
    public static class ClientInfo {
        private final String roomId;
        private final String userId;

        public ClientInfo(String roomId, String userId) {
            this.roomId = roomId;
            this.userId = userId;
        }

        public String getRoomId() { return roomId; }
        public String getUserId() { return userId; }
    }
}
