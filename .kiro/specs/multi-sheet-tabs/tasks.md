# 实现计划：多工作表（Multi-Sheet）

## 概述

本计划将多工作表功能拆分为渐进式实现步骤，从基础设施（Modal 组件、数据模型）开始，逐步构建 UI 组件、交互逻辑、跨 Sheet 公式和后端协同支持。每个任务构建在前一个任务之上，确保无孤立代码。

## 任务

- [x] 1. 实现通用 Modal 弹窗组件
  - [x] 1.1 创建 `src/modal.ts`，实现 Modal 类，提供 `alert`、`confirm`、`prompt`、`custom` 四个静态方法
    - 实现半透明遮罩层、对话框容器、按钮区域的 DOM 创建与销毁
    - 支持 `ModalOptions` 参数配置（title、message、confirmText、cancelText、customContent、inputDefault、inputPlaceholder）
    - `alert` 返回 `Promise<void>`，`confirm` 返回 `Promise<boolean>`，`prompt` 返回 `Promise<string | null>`
    - 支持 Enter 键确认、Escape 键取消、点击遮罩关闭
    - 弹窗显示时自动聚焦到输入框（prompt）或确认按钮
    - _需求: 12.1, 12.2, 12.3, 12.4, 12.7_

  - [x] 1.2 在 `src/style.css` 中添加 Modal 组件样式
    - 使用 CSS 变量适配亮色/暗色主题
    - 遮罩层、对话框、按钮、输入框样式与现有项目 UI 风格一致
    - _需求: 12.5_

  - [x] 1.3 替换项目中所有现有的 `alert()`、`confirm()`、`prompt()` 调用为 Modal 组件方法
    - `src/app.ts`：约 15 处 `alert()` 调用、1 处 `prompt()` 调用
    - `src/ui-controls.ts`：1 处 `alert()`、1 处 `confirm()`
    - `src/data-manager.ts`：1 处 `alert()`
    - 将调用方法改为 `async`，使用 `await Modal.alert()`/`Modal.confirm()`/`Modal.prompt()` 替换
    - _需求: 12.8_

  - [ ]* 1.4 编写 Modal 组件单元测试
    - 测试 alert/confirm/prompt 返回值一致性
    - 测试 Escape 键取消行为
    - 测试 customContent 传入自定义 DOM
    - **Property 25: Modal 返回值一致性**
    - **验证: 需求 12.3**

- [x] 2. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 3. 实现工作表数据模型与 SheetManager 核心
  - [x] 3.1 在 `src/types.ts` 中新增 `SheetMeta`、`SheetData`、`ViewportState`、`RenameResult`、`WorkbookData` 类型定义
    - _需求: 1.1, 1.5_

  - [x] 3.2 创建 `src/sheet-manager.ts`，实现 SheetManager 类核心功能
    - 构造函数：创建默认 "Sheet1" 工作表，每个工作表持有独立的 `SpreadsheetModel` 和 `HistoryManager` 实例
    - `addSheet(afterSheetId?)`：在指定位置后新增工作表，自动生成不重复名称（SheetN 格式）
    - `deleteSheet(sheetId)`：删除工作表（仅剩一个时拒绝），删除活动工作表时自动切换到相邻工作表
    - `renameSheet(sheetId, newName)`：验证名称（非空、不重复）后重命名
    - `switchSheet(sheetId)`：保存当前视口/选区状态，切换活动工作表，恢复目标工作表状态
    - `reorderSheet(sheetId, newIndex)`：移动工作表到目标位置
    - `duplicateSheet(sheetId)`：深拷贝工作表数据，生成 "原名称 (副本)" 格式名称
    - `hideSheet(sheetId)` / `showSheet(sheetId)`：隐藏/显示工作表
    - `setTabColor(sheetId, color)`：设置/清除标签颜色
    - `generateSheetName()` / `generateCopyName(originalName)`：名称生成工具方法
    - 查询方法：`getActiveSheet()`、`getActiveModel()`、`getSheetByName()`、`getSheetById()`、`getVisibleSheets()`、`getAllSheets()`、`getHiddenSheets()`
    - _需求: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 4.2, 4.3, 4.4, 5.3, 5.4, 5.5, 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 9.2, 9.4_

  - [x] 3.3 在 SpreadsheetModel 中新增 `getData()`、`setHistoryManager()`、`getHistoryManager()` 方法
    - `getData()` 返回内部 `SpreadsheetData` 引用
    - 确保已有 `loadFromData()` 方法可用于数据切换
    - _需求: 1.1, 1.4_

  - [x] 3.4 实现工作簿序列化与旧版数据迁移
    - `serializeWorkbook()`：将所有工作表数据序列化为 WorkbookData JSON（version: "2.0"）
    - `deserializeWorkbook(json)`：从 WorkbookData JSON 恢复所有工作表
    - `migrateFromLegacy(json)`：检测 v1.0 格式，自动包装为单工作表 WorkbookData
    - _需求: 1.5, 1.6_

  - [ ]* 3.5 编写 SheetManager 属性测试
    - **Property 1: 工作表列表不变量** — 验证: 需求 1.1
    - **Property 2: 独立历史栈隔离** — 验证: 需求 1.3
    - **Property 3: 视口状态切换往返** — 验证: 需求 1.4
    - **Property 6: 新增工作表位置与激活** — 验证: 需求 3.1, 3.2, 3.3
    - **Property 7: 切换工作表设置活动状态** — 验证: 需求 2.3
    - **Property 8: 删除工作表减少计数** — 验证: 需求 4.2
    - **Property 9: 删除活动工作表后的邻居切换** — 验证: 需求 4.4
    - **Property 11: 重命名验证拒绝无效名称** — 验证: 需求 5.3, 5.4, 5.5
    - **Property 12: 工作表排序保持完整性** — 验证: 需求 6.3
    - **Property 13: 复制工作表数据等价与位置** — 验证: 需求 7.1, 7.2, 7.3, 7.4
    - **Property 14: 隐藏/显示往返** — 验证: 需求 8.1, 8.2, 8.6
    - **Property 15: 隐藏活动工作表后的切换** — 验证: 需求 8.3
    - **Property 16: 标签颜色设置与清除** — 验证: 需求 9.2, 9.4
    - **Property 24: 默认名称生成唯一性** — 验证: 需求 3.2

  - [ ]* 3.6 编写工作簿序列化属性测试
    - **Property 4: 工作簿序列化往返** — 验证: 需求 1.5
    - **Property 5: 旧版数据迁移保真** — 验证: 需求 1.6

- [x] 4. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 5. 实现 Sheet 标签栏 UI 与右键菜单
  - [x] 5.1 扩展 `src/themes.json`，在 light 和 dark 主题中新增 Sheet 标签栏颜色键
    - 新增 `sheetTabBackground`、`sheetTabActiveBackground`、`sheetTabText`、`sheetTabActiveText`、`sheetTabBorder`、`sheetTabHoverBackground`
    - _需求: 2.6_

  - [x] 5.2 修改 `index.html`，在 `.spreadsheet-container` 和 `.status-bar` 之间插入 `<div id="sheet-tab-bar" class="sheet-tab-bar"></div>`
    - _需求: 2.1_

  - [x] 5.3 在 `src/style.css` 中添加 Sheet 标签栏、标签项、滚动箭头、拖拽指示线、颜色指示条的样式
    - 新增 CSS 变量 `--sheet-tab-height: 32px`
    - 标签栏样式适配亮色/暗色主题
    - _需求: 2.1, 2.4, 2.5, 2.6, 6.1, 6.2, 9.3_

  - [x] 5.4 创建 `src/sheet-tab-bar.ts`，实现 SheetTabBar 类
    - 渲染所有可见工作表标签，高亮当前活动工作表
    - 左侧「+」按钮，点击触发新增工作表
    - 标签点击切换工作表，双击弹出 Modal prompt 重命名
    - 标签数量超出可见宽度时显示左右滚动箭头
    - 标签底部绘制 tabColor 彩色指示条（3px 高度）
    - 实现拖拽排序：mousedown 启动拖拽、mousemove 显示插入指示线、mouseup 完成排序
    - 右键点击标签触发上下文菜单
    - `applyTheme(themeColors)` 方法适配主题切换
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 9.3_

  - [x] 5.5 创建 `src/sheet-context-menu.ts`，实现 SheetContextMenu 类
    - 菜单项：重命名、删除、复制、隐藏、标签颜色、显示隐藏的工作表
    - 根据当前状态动态禁用选项（仅剩一个工作表时禁用删除和隐藏）
    - 「删除」触发 Modal confirm 确认对话框
    - 「重命名」触发 Modal prompt 对话框
    - 「标签颜色」显示颜色选择面板（预定义颜色 + 无颜色选项）
    - 「显示隐藏的工作表」弹出隐藏工作表列表（使用 Modal custom）
    - 点击菜单外部关闭菜单
    - 适配亮色/暗色主题
    - _需求: 4.1, 5.1, 5.2, 5.6, 7.1, 8.1, 8.4, 8.5, 8.6, 9.1, 9.4, 11.1, 11.2, 11.3, 11.4_

  - [ ]* 5.6 编写 SheetTabBar DOM 单元测试
    - 测试「+」按钮存在性
    - 测试标签点击切换活动工作表
    - **Property 23: 上下文菜单状态正确性** — 验证: 需求 11.3

- [x] 6. 集成 SheetManager 到 SpreadsheetApp
  - [x] 6.1 修改 `src/renderer.ts`，新增 `setModel(model)` 方法
    - 切换绑定的 SpreadsheetModel 数据源并触发重新渲染
    - 调整 Canvas 高度计算，减去标签栏高度
    - _需求: 2.3_

  - [x] 6.2 修改 `src/app.ts`，集成 SheetManager 和 SheetTabBar
    - 在构造函数中初始化 SheetManager（创建默认 Sheet1）和 SheetTabBar
    - 修改 `handleUndo`/`handleRedo`：委托给当前活动 Sheet 的 HistoryManager
    - 新增 `getSheetManager()` 方法供外部访问
    - 工作表切换时调用 `renderer.setModel()` 切换数据源
    - _需求: 1.2, 1.3, 2.3_

  - [x] 6.3 修改 `src/ui-controls.ts`，更新 `applyTheme()` 方法
    - 主题切换时同步更新 SheetTabBar 和 SheetContextMenu 的主题
    - 传递新增的 Sheet 标签栏颜色键
    - _需求: 2.6, 11.4_

  - [x] 6.4 修改 `src/main.ts`，更新协同模式初始化
    - `applyOperationToModel` 函数需根据操作的 `sheetId` 路由到对应工作表的 Model
    - `onDocumentSync` 回调需处理 WorkbookData 格式
    - _需求: 1.1_

  - [x] 6.5 修改 `src/data-manager.ts`，更新导入/导出逻辑
    - 导出时调用 `sheetManager.serializeWorkbook()` 生成 WorkbookData JSON
    - 导入时检测版本号，v2.0 调用 `deserializeWorkbook()`，旧版调用 `migrateFromLegacy()`
    - 本地存储保存/加载使用 WorkbookData 格式
    - _需求: 1.5, 1.6_

- [x] 7. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 8. 实现跨 Sheet 数据引用与公式计算
  - [x] 8.1 修改 `src/formula-engine.ts`，扩展跨 Sheet 引用支持
    - 新增 `setSheetCellGetter(getter)` 方法，注入跨 Sheet 单元格获取回调
    - 修改 `parseCellReference` 支持 `SheetName!CellRef` 和 `'Sheet Name'!CellRef` 格式
    - 修改 `parseRangeReference` 支持 `SheetName!RangeRef` 格式
    - 使用正则 `/^(?:'([^']+)'|([A-Za-z0-9_\u4e00-\u9fff]+))!([A-Z]+\d+(?::[A-Z]+\d+)?)$/i` 解析
    - 修改 `evaluate` 方法，遇到跨 Sheet 引用时通过 `sheetCellGetter` 获取数据
    - 引用不存在的工作表返回 `#REF!` 错误
    - 引用超出范围的单元格返回 `#REF!` 错误
    - _需求: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 8.2 在 SheetManager 中实现 `getCellFromSheet(sheetName, row, col)` 方法
    - 通过工作表名称查找对应 Model 并返回单元格数据
    - 在 SheetManager 构造函数中将此方法注入 FormulaEngine 的 `sheetCellGetter`
    - _需求: 10.3_

  - [x] 8.3 实现跨 Sheet 依赖追踪与重算
    - 当被引用工作表的源数据变化时，重新计算所有引用该数据的公式
    - 删除被引用工作表时，将所有引用该工作表的公式更新为 `#REF!`
    - 重命名被引用工作表时，自动更新所有引用公式中的工作表名称
    - _需求: 10.6, 10.7, 10.8_

  - [ ]* 8.4 编写跨 Sheet 公式属性测试
    - **Property 17: 跨 Sheet 引用解析往返** — 验证: 需求 10.1, 10.2
    - **Property 18: 跨 Sheet 引用求值正确性** — 验证: 需求 10.3
    - **Property 19: 不存在的工作表引用返回 #REF!** — 验证: 需求 10.4
    - **Property 20: 跨 Sheet 依赖重算** — 验证: 需求 10.6
    - **Property 21: 删除被引用工作表产生 #REF!** — 验证: 需求 10.7
    - **Property 22: 重命名被引用工作表更新公式** — 验证: 需求 10.8

  - [ ]* 8.5 编写跨 Sheet 公式单元测试
    - 测试引用不存在工作表返回 #REF!
    - 测试引用超出范围单元格返回 #REF!
    - 测试含空格名称的单引号包裹格式
    - _需求: 10.4, 10.5_

- [x] 9. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 10. Java 后端协同支持 - 数据模型与操作类
  - [x] 10.1 创建 `WorkbookData.java` 和 `SheetEntry.java` 模型类
    - `WorkbookData`：version、activeSheetId、sheets 列表，提供 `getSheetData(sheetId)`、`getSheetEntry(sheetId)`、`migrateFromLegacy(SpreadsheetData)` 方法
    - `SheetEntry`：id、name、visible、tabColor、order、data（SpreadsheetData）
    - _需求: 1.1, 1.5_

  - [x] 10.2 创建 7 个 Sheet 级操作类并注册到 CollabOperation
    - `SheetAddOp`（sheetId、sheetName、insertIndex）
    - `SheetDeleteOp`（sheetId）
    - `SheetRenameOp`（sheetId、oldName、newName）
    - `SheetReorderOp`（sheetId、oldIndex、newIndex）
    - `SheetDuplicateOp`（sourceSheetId、newSheetId、newSheetName）
    - `SheetVisibilityOp`（sheetId、visible）
    - `SheetTabColorOp`（sheetId、tabColor）
    - 在 `CollabOperation.java` 的 `@JsonSubTypes` 中注册所有新操作类型
    - _需求: 3.1, 4.2, 5.3, 6.3, 7.1, 8.1, 9.2_

  - [x] 10.3 修改 `CollabOperation.java` 基类，新增 `sheetId` 字段
    - 添加 `sheetId` 属性及 getter/setter
    - 所有现有操作在发送时携带 sheetId，后端据此路由到对应工作表
    - _需求: 1.1_

- [x] 11. Java 后端协同支持 - 服务层修改
  - [x] 11.1 修改 `Room.java`，将 `document` 字段从 `SpreadsheetData` 改为 `WorkbookData`
    - 更新构造函数、getter/setter
    - _需求: 1.1_

  - [x] 11.2 修改 `DocumentApplier.java`，扩展操作应用逻辑
    - 新增 `apply(WorkbookData, CollabOperation)` 方法：根据操作类型路由
    - Sheet 级操作直接修改 WorkbookData 的 sheets 列表
    - 单元格级操作根据 sheetId 找到对应 SpreadsheetData 后调用现有 `apply(SpreadsheetData, op)`
    - 实现 `applySheetAdd`、`applySheetDelete`、`applySheetRename`、`applySheetReorder`、`applySheetDuplicate`、`applySheetVisibility`、`applySheetTabColor`
    - _需求: 3.1, 4.2, 5.3, 6.3, 7.1, 8.1, 9.2_

  - [x] 11.3 修改 `OTTransformer.java`，新增 Sheet 级操作的 OT 转换规则
    - 不同 sheetId 的操作无需转换（天然隔离）
    - 同一 sheetId 的单元格操作使用现有转换逻辑
    - `SheetDeleteOp` 消除同 Sheet 的所有后续操作
    - 同 Sheet 的 `SheetRenameOp` 后者覆盖前者
    - _需求: 1.1_

  - [x] 11.4 修改 `RoomManager.java`
    - `createEmptyDocument()` 改为 `createEmptyWorkbook()`，返回包含默认 Sheet1 的 WorkbookData
    - `getDocument()` 改为 `getWorkbook()`，返回 WorkbookData
    - `receiveOperation` 中 `DocumentApplier.apply` 调用改为传入 WorkbookData
    - 数据库加载时检测版本号，旧版数据自动迁移
    - _需求: 1.1, 1.6_

  - [x] 11.5 修改 `CollabWebSocketHandler.java`
    - `handleJoin`：发送 WorkbookData（payload.workbook）而非 SpreadsheetData
    - `handleSync`：快照模式发送完整 WorkbookData
    - 操作消息中的 operation 已携带 sheetId，无需额外处理
    - _需求: 1.1_

- [x] 12. 前端协同客户端适配
  - [x] 12.1 修改前端协同类型定义（`src/collaboration/types.ts`）
    - 新增 Sheet 级操作类型：`sheetAdd`、`sheetDelete`、`sheetRename`、`sheetReorder`、`sheetDuplicate`、`sheetVisibility`、`sheetTabColor`
    - 所有操作接口新增可选 `sheetId` 字段
    - _需求: 1.1_

  - [x] 12.2 修改前端协同引擎，适配 WorkbookData 消息格式
    - `onDocumentSync` 回调接收 WorkbookData 并通过 SheetManager 恢复所有工作表
    - 发送操作时自动附加当前活动工作表的 sheetId
    - 接收远程 Sheet 级操作时更新本地 SheetManager 状态并刷新 SheetTabBar
    - _需求: 1.1_

  - [x] 12.3 在 SheetManager 的工作表操作中集成协同操作提交
    - addSheet、deleteSheet、renameSheet、reorderSheet、duplicateSheet、hideSheet、showSheet、setTabColor 操作完成后提交对应的协同操作
    - _需求: 3.1, 4.2, 5.3, 6.3, 7.1, 8.1, 9.2_

- [x] 13. 最终检查点 - 确保所有测试通过
  - 构建通过，浏览器功能验证通过（新增、切换、重命名、删除、复制、隐藏/显示工作表均正常），e2e 测试中截图对比类测试因标签栏布局变化有预期差异，核心功能测试通过。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保可追溯性
- 检查点确保增量验证，及早发现问题
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界条件
- Modal 组件作为基础设施最先实现，因为后续的 Sheet 操作（删除确认、重命名等）依赖它
