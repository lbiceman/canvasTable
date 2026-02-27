# 实现计划：多用户协同编辑

## 概述

将 ice-excel 从单用户应用改造为支持多用户实时协同编辑的系统。采用增量实现方式，先建立核心操作和 OT 算法，再添加网络通信和 UI 层。使用 TypeScript 实现客户端和服务端。

## 任务

- [x] 1. 定义协同操作类型与序列化
  - [x] 1.1 创建 `src/collaboration/types.ts`，定义所有协同操作的 TypeScript 接口（`CollabOperation` 联合类型及 9 种具体操作类型：`CellEditOp`、`CellMergeOp`、`CellSplitOp`、`RowInsertOp`、`RowDeleteOp`、`RowResizeOp`、`ColResizeOp`、`FontColorOp`、`BgColorOp`），以及 `RemoteUser`、`WebSocketMessage` 等协议类型
    - _需求: 2.1_
  - [x] 1.2 创建 `src/collaboration/operations.ts`，实现 `serializeOperation()` 和 `deserializeOperation()` 函数，将操作对象与 JSON 字符串互转
    - _需求: 2.2, 2.3, 2.4_
  - [x]* 1.3 编写操作序列化往返属性测试
    - **Property 1: 操作序列化往返一致性**
    - **验证需求: 2.2, 2.3, 2.4**

- [x] 2. 实现 OT 操作转换核心算法
  - [x] 2.1 创建 `src/collaboration/ot.ts`，实现 `transform(opA, opB)` 函数，处理所有操作类型组合的转换逻辑（CellEdit vs CellEdit、CellEdit vs RowInsert、CellEdit vs RowDelete 等），以及 `transformAgainst(op, ops)` 批量转换函数
    - _需求: 3.1, 3.2, 3.4_
  - [x] 2.2 在 `src/collaboration/ot.ts` 中实现 `invertOperation(op, model)` 函数，为每种操作类型生成反向操作
    - _需求: 8.2_
  - [ ]* 2.3 编写 OT 收敛性属性测试
    - **Property 2: OT 收敛性**
    - **验证需求: 3.1, 3.2, 3.4**
  - [ ]* 2.4 编写操作反转往返属性测试
    - **Property 11: 操作反转往返一致性**
    - **验证需求: 8.2**

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 4. 实现 OT 客户端状态机
  - [x] 4.1 创建 `src/collaboration/ot-client.ts`，实现三状态模型（`synchronized`、`awaitingConfirm`、`awaitingWithBuffer`），包含 `applyLocal()`、`serverAck()`、`applyRemote()` 方法，管理 pending 和 buffer 操作的转换
    - _需求: 3.3_
  - [ ]* 4.2 编写 OT 客户端状态机属性测试
    - **Property 3: OT 客户端状态机转换正确性**
    - **验证需求: 3.3**

- [-] 5. 实现 WebSocket 通信模块
  - [x] 5.1 创建 `src/collaboration/websocket-client.ts`，实现 WebSocket 连接管理，包含 `connect()`、`disconnect()`、`sendOperation()`、`sendCursor()` 方法，以及指数退避重连逻辑（1s 起步，最大 30s，最多 5 次）和离线操作缓冲队列
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ]* 5.2 编写指数退避重连间隔属性测试
    - **Property 5: 指数退避重连间隔**
    - **验证需求: 1.2**
  - [ ]* 5.3 编写离线操作缓冲和有序发送属性测试
    - **Property 6: 离线操作缓冲**
    - **Property 7: 缓冲操作有序发送**
    - **验证需求: 1.3, 1.4**

- [x] 6. 实现光标感知模块
  - [x] 6.1 创建 `src/collaboration/cursor-awareness.ts`，实现 `CursorAwareness` 类，管理远程用户列表、颜色分配、选择区域更新，以及 `renderCursors()` 方法在 Canvas 上绘制远程用户的选择边框和名称标签
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [x] 6.2 修改 `src/renderer.ts`，在 `render()` 方法的选区绘制之后调用 `CursorAwareness.renderCursors()` 渲染远程光标
    - _需求: 5.2, 5.3_
  - [ ]* 6.3 编写用户颜色唯一性属性测试
    - **Property 8: 用户颜色唯一性**
    - **验证需求: 5.4**

- [x] 7. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 8. 实现协同引擎（总协调器）
  - [x] 8.1 创建 `src/collaboration/collaboration-engine.ts`，实现 `CollaborationEngine` 类，整合 OTClient、WebSocketClient、CursorAwareness，提供 `init()`、`destroy()`、`submitOperation()` 方法，处理消息路由和状态管理
    - _需求: 1.1, 6.1, 6.2, 6.3_
  - [x] 8.2 在 `CollaborationEngine` 中实现协同模式下的历史管理，维护每用户独立的操作历史栈，`undo()` 生成反向操作并通过协同通道发送
    - _需求: 8.1, 8.2, 8.3_
  - [ ]* 8.3 编写用户独立历史栈与撤销隔离属性测试
    - **Property 10: 用户独立历史栈与撤销隔离**
    - **验证需求: 8.1, 8.3**

- [x] 9. 实现服务端
  - [x] 9.1 创建 `server/` 目录，初始化 Node.js 项目，安装 `ws` 依赖，创建 `server/src/types.ts` 定义服务端类型
    - _需求: 4.1_
  - [x] 9.2 创建 `server/src/ot-server.ts`，实现服务端 OT 处理逻辑：接收操作、分配递增修订号、对过期操作执行转换、维护操作历史
    - _需求: 4.1, 4.2, 4.5_
  - [x] 9.3 创建 `server/src/room-manager.ts`，实现房间管理：创建/加入/离开房间、文档状态存储、用户列表管理
    - _需求: 4.3, 4.4_
  - [x] 9.4 创建 `server/src/index.ts`，实现 WebSocket 服务器入口，处理连接、消息路由、广播逻辑
    - _需求: 4.3, 4.4_
  - [ ]* 9.5 编写服务端修订号与转换属性测试
    - **Property 4: 服务端修订号单调递增与转换正确性**
    - **验证需求: 4.1, 4.2, 4.5**
  - [ ]* 9.6 编写重连同步操作应用属性测试
    - **Property 9: 重连同步操作应用**
    - **验证需求: 6.2**

- [x] 10. 集成到现有应用
  - [x] 10.1 修改 `src/types.ts`，添加协同相关的类型导出
    - _需求: 2.1_
  - [x] 10.2 修改 `src/app.ts`，在用户编辑操作（setCellContent、mergeCells、splitCell、insertRows、deleteRows、行高列宽调整、颜色设置）中调用 `CollaborationEngine.submitOperation()` 提交操作，在协同模式下将撤销/重做委托给 CollaborationEngine
    - _需求: 2.2, 8.1, 8.2_
  - [x] 10.3 修改 `src/app.ts`，在选择变化时调用 `WebSocketClient.sendCursor()` 广播光标位置
    - _需求: 5.1_
  - [x] 10.4 在 `index.html` 和 `src/style.css` 中添加协同状态 UI 元素：连接状态指示器、在线用户数量、用户加入/离开通知、同步状态指示
    - _需求: 7.1, 7.2, 7.3, 7.4_
  - [x] 10.5 修改 `src/main.ts`，添加协同模式初始化逻辑，根据 URL 参数（roomId）决定是否启用协同模式
    - _需求: 1.1, 6.1_

- [x] 11. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 开发
- 每个任务引用了具体的需求编号以保证可追溯性
- 属性测试使用 `fast-check` 库，每个测试至少运行 100 次迭代
- 单元测试验证具体示例和边界情况
- 检查点确保增量验证
