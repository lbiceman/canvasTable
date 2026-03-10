# 实现计划：Node.js 到 Java 迁移

## 概述

将 ice-excel 协同编辑后端从 Node.js/TypeScript 迁移到 Java (Spring Boot 3) + MySQL，分步实现数据模型、OT 算法、房间管理、WebSocket 处理和数据持久化。

## 任务

- [-] 1. 项目目录重组与 Java 项目初始化
  - [ ] 1.1 将 `server` 目录重命名为 `nodeServer`
    - 使用 git mv 重命名目录
    - _Requirements: 8.1_
  - [x] 1.2 创建 `javaServer` 目录和 Spring Boot 项目骨架
    - 创建 `javaServer/pom.xml`，引入 spring-boot-starter-websocket、spring-boot-starter-data-jpa、mysql-connector-j、jackson-databind、jqwik 依赖
    - 创建 `javaServer/src/main/java/com/iceexcel/server/IceExcelServerApplication.java` Spring Boot 入口类
    - 创建 `javaServer/src/main/resources/application.yml` 配置文件（数据库连接、端口 8081）
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 8.2_

- [x] 2. 数据模型定义
  - [x] 2.1 创建 Cell 和 SpreadsheetData 模型类
    - 在 `model/` 包下创建 `Cell.java`、`MergeParent.java`、`SpreadsheetData.java`
    - 添加 Jackson 注解确保 JSON 序列化与 TypeScript 类型一致
    - 添加 `@JsonInclude(NON_NULL)` 处理可选字段
    - _Requirements: 2.7_
  - [x] 2.2 创建 CollabOperation 类型层次
    - 创建 `CollabOperation.java` 抽象基类，使用 `@JsonTypeInfo(use = NAME, property = "type")` + `@JsonSubTypes` 注解
    - 创建 14 个操作子类：`CellEditOp`、`CellMergeOp`、`CellSplitOp`、`RowInsertOp`、`RowDeleteOp`、`RowResizeOp`、`ColResizeOp`、`FontColorOp`、`BgColorOp`、`FontSizeOp`、`FontBoldOp`、`FontItalicOp`、`FontUnderlineOp`、`FontAlignOp`
    - 每个子类包含与 TypeScript 类型完全对应的字段
    - _Requirements: 3.1, 2.7_
  - [x] 2.3 创建 WebSocket 消息模型和辅助类
    - 创建 `WebSocketMessage.java`（type + payload）
    - 创建 `RemoteUser.java`、`Room.java`（内存模型）、`ClientConnection.java`
    - 定义 `USER_COLORS` 常量数组
    - _Requirements: 2.7, 4.3_
  - [ ]* 2.4 编写 CollabOperation JSON 序列化往返属性测试
    - **Property 1: CollabOperation JSON 序列化往返一致性**
    - 使用 jqwik 生成随机的 14 种操作类型，验证 serialize → deserialize 等价
    - **Validates: Requirements 3.6**
  - [ ]* 2.5 编写 WebSocket 消息 JSON 格式兼容性属性测试
    - **Property 10: WebSocket 消息 JSON 格式兼容性**
    - 验证序列化后的 JSON 包含 "type" 和 "payload" 字段，且操作类型字段名与 Node.js 一致
    - **Validates: Requirements 2.7**

- [-] 3. OT 转换算法实现
  - [x] 3.1 实现 OTTransformer 工具类
    - 在 `service/` 包下创建 `OTTransformer.java`
    - 从 `server/src/ot.ts` 逐函数翻译所有转换逻辑
    - 实现 `transform(opA, opB)` 和 `transformAgainst(op, ops)` 方法
    - 实现所有 transformXxxVsRowInsert、transformXxxVsRowDelete 系列方法
    - 实现 transformCellEditVsCellEdit、transformCellEditVsCellMerge、transformCellMergeVsCellMerge
    - 实现 transformRowInsertVsRowInsert、transformRowInsertVsRowDelete、transformRowDeleteVsRowInsert、transformRowDeleteVsRowDelete
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 3.2 编写 OT 转换不崩溃属性测试
    - **Property 2: OT 转换对任意操作对不崩溃且保持类型一致**
    - 使用 jqwik 生成随机操作对，验证 transform 不抛异常且结果类型一致
    - **Validates: Requirements 3.1, 3.2**
  - [ ]* 3.3 编写同位置 rowInsert 决胜属性测试
    - **Property 3: 同位置 rowInsert 使用 userId 字典序决胜**
    - 生成同 rowIndex 的 rowInsert 对，验证字典序较大的 userId 的 rowIndex 被推后
    - **Validates: Requirements 3.3**
  - [ ]* 3.4 编写被删除行操作消除属性测试
    - **Property 4: 被删除行上的操作转换返回 null**
    - 生成行索引在 rowDelete 范围内的操作，验证转换返回 null
    - **Validates: Requirements 3.4**
  - [ ]* 3.5 编写重叠 cellMerge 消除属性测试
    - **Property 5: 重叠 cellMerge 转换返回 null**
    - 生成区域重叠的 cellMerge 对，验证转换返回 null
    - **Validates: Requirements 3.5**

- [x] 4. 文档操作应用与 OT 服务端
  - [x] 4.1 实现 DocumentApplier 工具类
    - 在 `service/` 包下创建 `DocumentApplier.java`
    - 从 `server/src/room-manager.ts` 的 `applyOperationToDocument` 函数翻译
    - 实现所有 14 种操作类型的文档应用逻辑
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ]* 4.2 编写操作应用正确性属性测试
    - **Property 6: 操作应用后文档状态一致性**
    - 使用 jqwik 生成随机文档和操作，验证应用后的文档状态符合预期
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
  - [x] 4.3 实现 OTServer 类
    - 在 `service/` 包下创建 `OTServer.java`
    - 从 `server/src/ot-server.ts` 翻译 `receiveOperation` 和 `getOperationsSince` 方法
    - 管理操作历史列表和修订号
    - _Requirements: 3.2_

- [x] 5. Checkpoint - 确保核心算法测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 6. 数据访问层实现
  - [x] 6.1 创建 JPA 实体类
    - 在 `entity/` 包下创建 `RoomEntity.java`（rooms 表）和 `OperationEntity.java`（operations 表）
    - 配置 `@Entity`、`@Table`、`@Column(columnDefinition = "JSON")` 等注解
    - 配置 `(room_id, revision)` 联合索引
    - _Requirements: 1.2, 5.1, 5.2_
  - [x] 6.2 创建 Spring Data JPA Repository 接口
    - 在 `repository/` 包下创建 `RoomRepository.java` 和 `OperationRepository.java`
    - OperationRepository 添加按 roomId 和 revision 范围查询的方法
    - _Requirements: 1.3, 1.4, 5.2_
  - [ ]* 6.3 编写房间数据往返属性测试
    - **Property 7: 房间数据存储/读取往返一致性**
    - 使用 jqwik + Spring Boot Test + 内嵌数据库，验证 save → load 等价
    - **Validates: Requirements 1.3, 5.1, 5.4**
  - [ ]* 6.4 编写操作历史往返属性测试
    - **Property 8: 操作历史存储/查询往返一致性**
    - 验证操作列表 save → query by revision range 返回正确子集
    - **Validates: Requirements 1.4, 5.2**

- [x] 7. 房间管理实现
  - [x] 7.1 实现 RoomManager 服务类
    - 在 `service/` 包下创建 `RoomManager.java`，标注 `@Service`
    - 使用 `ConcurrentHashMap` 管理内存中的房间和 OT 状态
    - 实现 `getOrCreateRoom`（优先从数据库加载）、`joinRoom`（颜色分配）、`leaveRoom`（最后用户离开时持久化）
    - 实现 `receiveOperation`（调用 OTServer + DocumentApplier + 防抖保存）
    - 实现 `getOperationsSince`、`getRevision`、`getDocument`、`findClientBySession`
    - 使用 `ScheduledExecutorService` 实现 2 秒防抖保存
    - 实现 `saveAll` 方法和 `@PreDestroy` 关闭钩子
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [ ]* 7.2 编写颜色分配唯一性属性测试
    - **Property 9: 颜色分配唯一性**
    - 使用 jqwik 生成随机用户数量（不超过颜色池大小），验证每个用户获得不同颜色
    - **Validates: Requirements 4.3**

- [x] 8. WebSocket 处理器实现
  - [x] 8.1 实现 WebSocketConfig 配置类
    - 在 `config/` 包下创建 `WebSocketConfig.java`
    - 注册 WebSocket 端点，设置 `setAllowedOrigins("*")`
    - _Requirements: 2.1_
  - [x] 8.2 实现 CollabWebSocketHandler
    - 在 `websocket/` 包下创建 `CollabWebSocketHandler.java`，继承 `TextWebSocketHandler`
    - 实现 `handleTextMessage` 方法，解析 JSON 消息并路由到对应处理方法
    - 实现 `handleJoin`：调用 RoomManager.joinRoom，发送 state 消息，广播 user_join
    - 实现 `handleOperation`：调用 RoomManager.receiveOperation，发送 ack，广播 remote_op
    - 实现 `handleCursor`：广播 cursor 消息
    - 实现 `handleSync`：根据修订号差距决定发送操作列表或完整快照（阈值 100）
    - 实现 `afterConnectionClosed`：调用 RoomManager.leaveRoom，广播 user_leave
    - 实现 `sendMessage` 和 `broadcastToOthers` 辅助方法
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 6.6_

- [x] 9. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 10. 集成验证与收尾
  - [x] 10.1 创建 application.yml 完整配置
    - 配置 MySQL 连接（URL、用户名、密码）
    - 配置 JPA ddl-auto: update（自动建表）
    - 配置服务端口 8081
    - _Requirements: 1.1, 1.2, 7.3_
  - [x] 10.2 添加优雅关闭支持
    - 在 RoomManager 中使用 `@PreDestroy` 注解实现关闭时保存所有房间数据
    - _Requirements: 4.6, 7.4_
  - [ ]* 10.3 编写 WebSocket 消息处理集成测试
    - 测试 join → state 响应流程
    - 测试 operation → ack + remote_op 广播流程
    - 测试断开连接 → user_leave 广播流程
    - _Requirements: 2.2, 2.3, 2.6_

- [x] 11. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 进度
- 每个任务引用了具体的需求编号以便追溯
- Checkpoint 任务用于阶段性验证
- 属性测试验证通用正确性属性，单元测试验证具体用例和边界情况
