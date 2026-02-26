---
inclusion: fileMatch
fileMatchPattern: "src/history-manager.ts,src/model.ts"
---

# 撤销/重做规范

## 操作类型（ActionType）
| 类型 | 说明 | data 内容 | undoData 内容 |
|------|------|-----------|---------------|
| setCellContent | 修改单元格内容 | {row, col, content} | {row, col, content: 旧内容} |
| mergeCells | 合并单元格 | {startRow, startCol, endRow, endCol} | 合并前的单元格快照 |
| splitCell | 拆分单元格 | {row, col} | 拆分前的合并信息 |
| setFontColor | 设置字体颜色 | {cells: [{row, col, color}]} | {cells: [{row, col, color: 旧颜色}]} |
| setBgColor | 设置背景颜色 | {cells: [{row, col, color}]} | {cells: [{row, col, color: 旧颜色}]} |
| insertRows | 插入行 | {startRow, count} | - |
| deleteRows | 删除行 | {startRow, count} | 删除的行数据快照 |
| clearContent | 清除内容 | {cells: [{row, col}]} | {cells: [{row, col, content}]} |

## 历史栈管理
- `undoStack`：撤销栈，记录已执行的操作
- `redoStack`：重做栈，记录已撤销的操作
- 最大历史记录数：100 条（`maxHistory`）
- 新操作会清空重做栈

## 记录控制
- `pauseRecording()`：暂停记录，用于撤销/重做回放时避免重复记录
- `resumeRecording()`：恢复记录
- 回放操作时必须先暂停记录，完成后恢复

## 撤销/重做流程

### 撤销（undo）
1. 从 `undoStack` 弹出操作
2. 将操作压入 `redoStack`
3. 暂停历史记录
4. 根据 `undoData` 恢复数据
5. 恢复历史记录
6. 重绘界面

### 重做（redo）
1. 从 `redoStack` 弹出操作
2. 将操作压入 `undoStack`
3. 暂停历史记录
4. 根据 `data` 重新执行操作
5. 恢复历史记录
6. 重绘界面

## 与 Model 的配合
- `setCellContent()` 自动记录历史
- `setCellContentNoHistory()` 不记录历史，用于撤销/重做回放
- 合并/拆分操作需在操作前保存完整快照
- 行操作需保存受影响的所有单元格数据

## UI 状态同步
- 每次数据变更后调用 `updateUndoRedoButtons()`
- 按钮禁用状态由 `canUndo()` / `canRedo()` 决定
