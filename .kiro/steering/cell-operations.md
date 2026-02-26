---
inclusion: fileMatch
fileMatchPattern: "src/model.ts,src/app.ts"
---

# 单元格操作规范

## 合并单元格数据模型
- 合并区域的左上角为父单元格：`rowSpan > 1` 或 `colSpan > 1`，持有实际内容
- 被合并的子单元格：`isMerged = true`，`mergeParent` 指向父单元格坐标，`content` 为空
- 操作被合并的子单元格时，必须先通过 `mergeParent` 找到父单元格再操作

## 内容修改
- 修改单元格内容必须通过 `setCellContent()`，该方法自动处理合并单元格重定向和历史记录
- 不记录历史的场景（撤销/重做回放）使用 `setCellContentNoHistory()`
- 内容未变化时直接 return，避免产生无意义的历史记录

## 行列操作
- 插入/删除行后必须调用 `updateMergeReferencesAfter*` 更新所有 `mergeParent` 引用
- 删除行前必须先调用 `splitMergedCellsInRows()` 拆分受影响的合并单元格
- 行列数有上限：最大 1,000,000 行 × 16,384 列

## 操作后刷新
- 数据变更后设置 `isDirty = true`
- 涉及合并/拆分操作后调用 `clearAllCache()` 清空缓存
- 控制器层（`SpreadsheetApp`）在数据变更后需依次调用：
  - `renderer.render()` 重绘画布
  - `updateScrollbars()` 更新滚动条
  - `updateStatusBar()` 更新状态栏（行列操作时）
  - `updateUndoRedoButtons()` 更新撤销/重做按钮状态（内容操作时）
