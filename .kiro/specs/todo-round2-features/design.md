# TODO 第二轮功能设计文档

## 技术方案

### 1. Ctrl+S 保存快捷键
- 在 `src/app.ts` 的 `handleKeyDown()` 中添加 `key === 's'` 分支
- 调用 `this.saveToLocalStorage()` 保存
- 创建 toast DOM 元素，2秒后自动移除
- `event.preventDefault()` 阻止浏览器默认行为

### 2. 数据验证 UI 设置入口
- 新建 `src/validation-dialog.ts`，参考 `FormatDialog` 模式
- 对话框包含：验证类型选择、参数输入、验证模式、输入/错误提示
- 在 `src/ui-controls.ts` 的 `renderToolbarRow1` 末尾添加"数据验证"按钮
- 在 `src/app.ts` 中绑定按钮事件，打开对话框并回填已有规则

### 3. 批注悬浮预览
- 在 `src/app.ts` 的 `handleMouseMove` 末尾添加批注检测逻辑
- 创建 tooltip DOM 元素（浅黄色背景、阴影、圆角）
- 通过 `model.getCellComment()` 检测批注
- tooltip 跟随鼠标位置，偏移 10px

### 4. Ctrl+P 打印快捷键
- 在 `handleKeyDown()` 中添加 `key === 'p'` 分支
- 调用 `this.openPrintPreview()`

### 5. 状态栏选区统计信息
- 已有 `computeSelectionStats()` 和 `updateSelectionStats()` 方法
- 已有 `#selection-stats` DOM 元素
- 功能已实现，验证现有实现是否满足需求

### 6. 公式栏名称框
- 已有 `initNameBoxInteraction()` 和 `handleNameBoxEntry()` 方法
- 名称框已创建且可编辑
- 功能已实现，验证现有实现是否满足需求

### 7. HistoryAction discriminated union
- 在 `src/history-manager.ts` 中定义各 ActionType 的数据接口
- 使用 discriminated union 替代 `HistoryActionData = unknown`
- 不常用类型使用 fallback 接口

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/app.ts` | 修改 | 添加 Ctrl+S、Ctrl+P 快捷键；批注 tooltip；验证对话框绑定 |
| `src/validation-dialog.ts` | 新建 | 数据验证设置对话框 |
| `src/ui-controls.ts` | 修改 | 工具栏添加"数据验证"按钮 |
| `src/style.css` | 修改 | toast 样式、tooltip 样式、验证对话框样式 |
| `src/history-manager.ts` | 修改 | discriminated union 改造 |
