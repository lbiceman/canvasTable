# 实施任务

## 1. 撤销/重做完整覆盖格式化操作

- [x] 1.1 审查 `src/model.ts` 中 `applyAction()` 方法，确认所有格式化操作类型（`setFontColor`、`setBgColor`、`setBorder`、`setFontAlign`、`setVerticalAlign`、`setFontSize`、`setFontFamily`、`setStrikethrough`、`setFontBold`、`setFontItalic`、`setFontUnderline`）的撤销/重做分支完整且正确处理 `cells` 数组和范围两种数据格式
- [x] 1.2 在 `src/app.ts` 的 `handleUndo()` 和 `handleRedo()` 方法中，增加工具栏格式按钮状态同步（调用 `updateSelectedCellInfo()` 后同步工具栏加粗/斜体/下划线/对齐等按钮的高亮状态）
- [x] 1.3 验证 `src/model.ts` 中所有格式设置方法的 `historyManager.record()` 调用，确保 `undoData` 中保存了每个单元格的原始属性值（`cells` 数组格式），而非仅保存范围信息

## 2. 列宽自适应

- [x] 2.1 在 `src/app.ts` 的 `handleDoubleClick()` 方法中，增加列标题右侧边界双击检测逻辑（复用 `renderer.getColResizeAtPosition()` 方法）
- [x] 2.2 在 `src/app.ts` 中新增 `autoFitColumnWidth(colIndex: number)` 方法，遍历可见行计算该列最大内容宽度，使用离屏 Canvas 的 `measureText()` 测量文本宽度，考虑字体大小、字体族、加粗状态
- [x] 2.3 在 `autoFitColumnWidth()` 中记录撤销历史（type: `resizeCol`），设置列宽为 `max(maxContentWidth + cellPadding * 2, 30)`

## 3. 行高自适应完善

- [x] 3.1 在 `src/renderer.ts` 中新增 `measureCellHeight(row: number, col: number): number` 方法，计算单元格在当前列宽下的所需高度（处理 wrapText 换行和 richText 多片段场景）
- [x] 3.2 在 `src/app.ts` 的 `handleDoubleClick()` 方法中，增加行标题下侧边界双击检测逻辑（复用 `renderer.getRowResizeAtPosition()` 方法）
- [x] 3.3 在 `src/app.ts` 中新增 `autoFitRowHeight(rowIndex: number)` 方法，遍历该行所有可见列调用 `measureCellHeight()` 取最大值，设置行高为 `max(maxHeight, 25)`，并记录撤销历史

## 4. 拖拽填充智能序列

- [x] 4.1 在 `src/fill-series.ts` 中新增预定义序列常量 `KNOWN_SEQUENCES`，包含中文星期、中文月份、数字月份、英文星期、英文月份、季度等序列定义
- [x] 4.2 在 `src/types.ts` 中扩展 `FillPattern` 接口，新增 `'sequence'` 和 `'textNumber'` 类型及相关字段（`sequenceValues`、`textPrefix`、`textSuffix`）
- [x] 4.3 修改 `FillSeriesEngine.inferPattern()` 方法，在数字和日期检测之前增加预定义序列匹配逻辑和带数字后缀文本模式检测
- [x] 4.4 在 `FillSeriesEngine.generate()` 方法中新增 `generateSequence()` 和 `generateTextNumber()` 私有方法，处理序列循环填充和文本+数字递增填充
- [x] 4.5 处理逆向填充（up/left）：序列类型按逆序生成，textNumber 类型数字递减

## 5. 状态栏统计

- [x] 5.1 在 `src/ui-controls.ts` 的 `renderStatusBar()` 函数中，新增统计信息容器 DOM 元素（id: `selection-stats`），放置在单元格计数和视口信息之间
- [x] 5.2 在 `src/app.ts` 中新增 `computeSelectionStats()` 方法，遍历当前选区内的单元格，提取数值并计算 SUM、AVERAGE、COUNT、MIN、MAX
- [x] 5.3 在 `src/app.ts` 中新增 `updateSelectionStats()` 方法，调用 `computeSelectionStats()` 获取统计结果并更新 DOM 显示（多单元格有数值时显示，否则隐藏）
- [x] 5.4 在 `src/app.ts` 的选区变更相关方法中调用 `updateSelectionStats()`：`handleMouseUp()`、`handleKeyDown()` 中的选区操作、`handleMouseDown()` 中的选区操作
- [x] 5.5 在 `src/style.css` 中添加统计信息区域的样式（字体大小、间距、颜色等，与现有状态栏风格一致）
