# 需求文档

## 简介

将 ice-excel 协同编辑电子表格应用的后端服务从 Node.js/TypeScript + 文件存储迁移到 Java + MySQL。当前后端基于 WebSocket 提供实时协同编辑功能，包括 OT（操作转换）算法、房间管理、文档持久化等核心模块。迁移后需保持与现有前端的完全兼容，同时利用 MySQL 提供更可靠的数据持久化能力。

## 术语表

- **Java_Server**: 使用 Java 实现的 WebSocket 协同编辑后端服务，替代当前 Node.js 服务
- **MySQL_Database**: MySQL 关系型数据库，用于持久化房间文档数据和操作历史
- **OT_Engine**: 操作转换引擎，负责处理并发编辑冲突，将客户端操作转换为一致的文档状态
- **Room_Manager**: 房间管理器，负责房间的创建、加入、离开以及在线用户管理
- **WebSocket_Handler**: WebSocket 消息处理器，负责接收和路由客户端消息
- **Data_Access_Layer**: 数据访问层，封装 MySQL 数据库的读写操作
- **SpreadsheetData**: 电子表格文档数据结构，包含单元格数据、行高、列宽
- **CollabOperation**: 协同操作，表示用户对文档的一次编辑操作（如单元格编辑、行插入、合并等）

## 需求

### 需求 1：MySQL 数据库搭建与配置

**用户故事：** 作为开发者，我希望使用 MySQL 数据库替代文件存储，以获得更可靠的数据持久化和查询能力。

#### 验收标准

1. THE Java_Server SHALL 使用 MySQL 8.0 或更高版本作为数据存储后端
2. WHEN Java_Server 启动时，THE Data_Access_Layer SHALL 自动创建所需的数据库表（如果不存在）
3. THE Data_Access_Layer SHALL 提供房间文档数据（SpreadsheetData）的存储和读取功能
4. THE Data_Access_Layer SHALL 提供操作历史（CollabOperation）的存储和查询功能
5. WHEN 数据库连接失败时，THEN THE Java_Server SHALL 记录错误日志并以非零退出码终止启动

### 需求 2：WebSocket 服务迁移

**用户故事：** 作为开发者，我希望将 WebSocket 服务从 Node.js 迁移到 Java，以便统一技术栈并利用 Java 生态。

#### 验收标准

1. THE Java_Server SHALL 在可配置端口（默认 8081）上提供 WebSocket 服务
2. WHEN 客户端发送 `join` 消息时，THE WebSocket_Handler SHALL 将客户端加入指定房间并返回当前文档状态
3. WHEN 客户端发送 `operation` 消息时，THE WebSocket_Handler SHALL 将操作交给 OT_Engine 处理，并向发送者返回 `ack`，向其他客户端广播 `remote_op`
4. WHEN 客户端发送 `cursor` 消息时，THE WebSocket_Handler SHALL 将光标位置广播给同房间的其他客户端
5. WHEN 客户端发送 `sync` 消息时，THE WebSocket_Handler SHALL 根据客户端修订号返回缺失的操作或完整文档快照
6. WHEN 客户端断开连接时，THE WebSocket_Handler SHALL 将该用户从房间移除并通知其他客户端
7. THE WebSocket_Handler SHALL 使用与当前 Node.js 服务完全相同的 JSON 消息格式，确保前端无需修改

### 需求 3：OT 算法迁移

**用户故事：** 作为开发者，我希望将 OT 操作转换算法从 TypeScript 迁移到 Java，以保持协同编辑的正确性。

#### 验收标准

1. THE OT_Engine SHALL 支持所有 14 种操作类型的转换：cellEdit、cellMerge、cellSplit、rowInsert、rowDelete、rowResize、colResize、fontColor、bgColor、fontSize、fontBold、fontItalic、fontUnderline、fontAlign
2. WHEN 客户端提交的操作修订号落后于服务器当前修订号时，THE OT_Engine SHALL 对该操作执行转换以适配当前文档状态
3. WHEN 两个并发的 rowInsert 操作在同一位置时，THE OT_Engine SHALL 使用 userId 字典序作为决胜条件
4. WHEN 操作目标行被并发的 rowDelete 操作删除时，THE OT_Engine SHALL 返回 null 表示操作被消除
5. WHEN 两个并发的 cellMerge 操作区域重叠时，THE OT_Engine SHALL 消除后到达的操作
6. FOR ALL 有效的 CollabOperation 对象，THE OT_Engine 的 JSON 序列化再反序列化 SHALL 产生等价的对象（往返一致性）

### 需求 4：房间管理迁移

**用户故事：** 作为开发者，我希望将房间管理功能从 Node.js 迁移到 Java，以支持多用户协同编辑。

#### 验收标准

1. WHEN 用户加入一个不存在的房间时，THE Room_Manager SHALL 创建新房间并初始化空白文档（50行×26列）
2. WHEN 用户加入一个已存在的房间时，THE Room_Manager SHALL 优先从 MySQL_Database 加载已有数据
3. WHEN 用户加入房间时，THE Room_Manager SHALL 从预定义颜色池中分配一个未被使用的颜色
4. WHEN 房间内最后一个用户离开时，THE Room_Manager SHALL 立即将房间数据持久化到 MySQL_Database
5. WHEN 操作被确认后，THE Room_Manager SHALL 将操作应用到内存中的文档快照并触发防抖保存（2秒间隔）
6. WHEN Java_Server 收到关闭信号时，THE Room_Manager SHALL 保存所有房间数据到 MySQL_Database

### 需求 5：数据持久化迁移

**用户故事：** 作为开发者，我希望将数据持久化从 JSON 文件存储迁移到 MySQL，以提高数据可靠性和查询效率。

#### 验收标准

1. THE Data_Access_Layer SHALL 将房间文档数据（SpreadsheetData）以 JSON 格式存储在 MySQL 的 TEXT/JSON 列中
2. THE Data_Access_Layer SHALL 将操作历史（CollabOperation）存储在独立的表中，支持按修订号范围查询
3. WHEN 保存房间数据时，THE Data_Access_Layer SHALL 在单个事务中同时更新文档快照和操作历史
4. WHEN 加载房间数据时，THE Data_Access_Layer SHALL 返回文档快照、当前修订号和操作历史
5. IF 数据库写入失败，THEN THE Data_Access_Layer SHALL 记录错误日志并抛出异常，不静默丢失数据

### 需求 6：操作应用与文档同步

**用户故事：** 作为开发者，我希望 Java 服务能正确地将操作应用到文档快照，保持文档状态与操作历史同步。

#### 验收标准

1. THE Java_Server SHALL 支持将所有 14 种操作类型正确应用到 SpreadsheetData 文档快照
2. WHEN cellEdit 操作被应用时，THE Java_Server SHALL 更新目标单元格的内容
3. WHEN cellMerge 操作被应用时，THE Java_Server SHALL 设置主单元格的 rowSpan/colSpan 并标记被合并单元格
4. WHEN rowInsert 操作被应用时，THE Java_Server SHALL 在指定位置插入空白行并更新行高数组
5. WHEN rowDelete 操作被应用时，THE Java_Server SHALL 删除指定行并更新行高数组
6. WHEN 同步请求的修订号差距超过 100 时，THE WebSocket_Handler SHALL 发送完整文档快照而非逐条操作

### 需求 7：Java 项目结构与构建

**用户故事：** 作为开发者，我希望 Java 项目有清晰的结构和标准的构建流程，便于开发和维护。

#### 验收标准

1. THE Java_Server SHALL 使用 Spring Boot 框架作为应用基础
2. THE Java_Server SHALL 使用 Maven 或 Gradle 作为构建工具
3. THE Java_Server SHALL 通过配置文件（application.properties 或 application.yml）管理数据库连接和服务端口等配置
4. THE Java_Server SHALL 提供与 Node.js 服务等效的启动和关闭流程
5. THE Java_Server 的代码 SHALL 放置在项目根目录下的 `javaServer` 文件夹中

### 需求 8：项目目录重组

**用户故事：** 作为开发者，我希望项目目录结构清晰地区分新旧服务，便于迁移过渡期的维护。

#### 验收标准

1. WHEN 迁移开始时，THE 原有 `server` 目录 SHALL 重命名为 `nodeServer` 以保留旧服务代码
2. THE Java_Server 的所有代码 SHALL 放置在 `javaServer` 目录下
