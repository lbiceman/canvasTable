# P4 协同编辑健壮性 — 任务列表

## 任务

- [x] 1. 增强 OT 边界处理：公式引用调整
  - 在 `ot.ts` 中新增 `adjustFormulaForRowInsert/Delete/ColInsert/Delete` 辅助函数
  - 在 `transformCellEditVsRowInsert/Delete` 和 `transformCellEditVsColInsert/Delete` 中调用

- [x] 2. 增强 OT 边界处理：合并单元格与行列删除的边界
  - 增强 `transformCellMergeVsRowDelete`：完整的 5 种位置关系处理
  - `transformCellMergeVsColDelete` 已有完整实现

- [x] 3. 补充 invertOperation 缺失的操作类型（已确认已实现）
  - `setBorder`、`setFontFamily`、`setStrikethrough` 的反向操作已存在

- [x] 4. 协同光标优化：提升选区背景色透明度
  - 修改 `cursor-awareness.ts` 中 alpha 值从 0.08 到 0.15

- [x] 5. 离线编辑：新增 OfflineBuffer 模块
  - 创建 `src/collaboration/offline-buffer.ts`
  - 实现离线操作缓存、rebase、重放逻辑

- [x] 6. 离线编辑：WebSocket 重连回调
  - 在 `websocket-client.ts` 中增加 `onReconnect` 和 `onStatusChange` 回调
  - 重连成功后通知上层

- [x] 7. 离线编辑：CollaborationEngine 重连同步
  - 在 `collaboration-engine.ts` 中处理重连状态重同步
  - 重连后通过 handleStateMessage 重新初始化 OTClient 并重放离线操作

- [x] 8. 代码诊断检查
  - 所有文件零诊断错误

- [x] 9. 更新 TODO.md 标记 P4 任务完成
