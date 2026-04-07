# P4 协同编辑健壮性 — 设计文档

## 技术方案

### 1. OT 边界测试增强

**现状分析**：`src/collaboration/ot.ts` 已实现大部分 OT 转换函数，但缺少以下边界场景的覆盖：
- cellMerge 与 rowDelete 并发时，删除范围完全包含合并区域的处理
- cellMerge 与 colDelete 并发时，删除范围部分重叠合并区域的处理
- 公式单元格（cellEdit 含公式内容）与行列插删并发时的公式引用调整

**方案**：
- 在 `ot.ts` 中增强 `transformCellMergeVsRowDelete` 和 `transformCellMergeVsColDelete` 的边界处理
- 新增公式引用地址调整辅助函数 `adjustFormulaReferences`，在 cellEdit 与行列插删转换时自动调整公式中的单元格引用
- 通过 property-based testing (fast-check) 验证 OT 收敛性不变量

### 2. 离线编辑 + 重连同步

**现状分析**：`WebSocketClient` 已有离线队列 (`offlineQueue`) 和指数退避重连机制。但缺少：
- 重连后的状态重同步（需要重新获取服务器文档状态）
- OT 客户端在重连后的修订号重置
- 离线操作与服务器新状态的 OT 合并

**方案**：
- 在 `WebSocketClient` 中增加 `onReconnect` 回调，重连成功后通知 `CollaborationEngine`
- `CollaborationEngine` 收到重连通知后，重新发送 join 消息获取最新状态
- 收到 state 消息后，将离线队列中的操作通过 `transformAgainst` 与服务器操作合并
- 新增 `OfflineBuffer` 类管理离线操作的缓存和合并

### 3. 协同光标优化

**现状分析**：`CursorAwareness.renderCursors()` 已绘制远程用户选区边框和名称标签，背景色 alpha 为 0.08（过淡）。

**方案**：
- 将选区背景色 alpha 从 0.08 提升到 0.15，使半透明背景更明显
- 保持边框 2px 实线不变
- 保持用户名标签位置不变

### 4. 操作历史冲突

**现状分析**：`CollabHistoryManager` 已实现独立的撤销/重做栈，`invertOperation` 已覆盖大部分操作类型。但缺少：
- `invertOperation` 对 `setBorder`、`setFontFamily`、`setStrikethrough` 的支持
- 多人同时撤销时的 OT 转换验证

**方案**：
- 在 `ot.ts` 的 `invertOperation` 中补充缺失操作类型的反向操作生成
- 确保反向操作通过 `submitUndoRedoOperation` 进入 OT 通道，与远程操作正确转换

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/collaboration/ot.ts` | 修改 | 增强 OT 边界处理、新增公式引用调整、补充 invertOperation |
| `src/collaboration/cursor-awareness.ts` | 修改 | 提升选区背景色 alpha 值 |
| `src/collaboration/websocket-client.ts` | 修改 | 增加重连回调机制 |
| `src/collaboration/collaboration-engine.ts` | 修改 | 增加重连状态重同步逻辑、离线操作合并 |
| `src/collaboration/offline-buffer.ts` | 新增 | 离线操作缓存与合并管理 |
| `src/collaboration/types.ts` | 修改 | 新增连接状态事件类型 |

## 数据流

### 离线编辑重连流程
```
用户编辑 → OTClient.applyLocal() → WebSocketClient.sendOperation()
                                        ↓ (断网)
                                   offlineQueue 缓存
                                        ↓ (重连)
                                   doConnect() → onopen
                                        ↓
                                   发送 join 消息
                                        ↓
                                   收到 state 消息（含最新 revision）
                                        ↓
                                   CollaborationEngine.handleReconnect()
                                        ↓
                                   OTClient 重置 revision
                                        ↓
                                   离线操作通过 OT 转换合并
                                        ↓
                                   flushOfflineQueue()
```

### 多人撤销流程
```
用户A 撤销 → CollabHistoryManager.undo()
              → invertOperation(op, model)
              → submitUndoRedoOperation(inverseOp)
              → OTClient.applyLocal(inverseOp)
              → 发送到服务器
              → 服务器广播给用户B
              → 用户B 的 OTClient.applyRemote(inverseOp)
              → transform(用户B的pending, inverseOp)
              → 应用转换后的操作
```
