# Implementation Plan: toolbar-ts-rendering

## Overview

将 index.html 中约 400 行工具栏 HTML 迁移到 TypeScript 动态渲染。在 `ui-controls.ts` 中新增 `renderToolbar` 导出函数及内部辅助函数，调整 `main.ts` 初始化顺序，最后简化 `index.html`。使用 Vitest + jsdom + fast-check 进行测试。

## Tasks

- [x] 1. 在 ui-controls.ts 中实现 renderToolbar 导出函数和辅助函数骨架
  - [x] 1.1 新增 renderToolbar(container: HTMLElement): void 导出函数
    - 校验 container 参数，为 null 时抛出 Error
    - 创建 `.toolbar` 容器并挂载到 container
    - 依次调用 renderToolbarRow1、renderToolbarRow2
    - 依次调用 renderSpreadsheetContainer、renderSheetTabBar、renderStatusBar、renderCollabNotifications
    - _Requirements: 6.1, 7.2, 7.3_

  - [x] 1.2 实现 renderToolbarRow1 辅助函数 — 撤销/重做、合并/拆分、颜色选择器
    - 创建 `.toolbar-row.toolbar-row-1 > .toolbar-group` 结构
    - 创建 #undo-btn（disabled、SVG + "撤销"）和 #redo-btn（disabled、SVG + "重做"）
    - 创建 .separator
    - 创建 #merge-cells（SVG + "合并"）和 #split-cells（SVG + "拆分"）
    - 创建 .font-color-picker（label[for=font-color] + input#font-color[value=#333333]）
    - 创建 .bg-color-picker（label[for=bg-color] + input#bg-color[value=#ffffff]）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.4, 5.5_

  - [x] 1.3 实现 renderToolbarRow1 辅助函数 — 边框选择器
    - 创建 .border-picker > #border-btn + #border-dropdown
    - 创建 8 个 .border-position-option（data-position: top/bottom/left/right/all/outer/inner/none），每个包含 SVG 和文本
    - 创建 4 个 .border-style-option（data-style: solid/dashed/dotted/double），solid 默认 active
    - 创建 .border-color-picker > input#border-color[value=#000000] + span#border-color-text
    - _Requirements: 2.5, 5.3, 5.5, 5.6_

  - [x] 1.4 实现 renderToolbarRow1 辅助函数 — 字体族/大小/数字格式选择器
    - 创建 .font-family-picker > #font-family-btn + #font-family-dropdown，7 个 .font-family-option（data-font + font-family 样式）
    - 创建 .font-size-picker > #font-size-btn(#font-size-text 默认 "12px") + #font-size-dropdown（空容器）
    - 创建 .number-format-picker > #number-format-btn(#number-format-text 默认 "常规") + #number-format-dropdown，7 个 .number-format-option（data-format），"常规" 默认 active
    - _Requirements: 2.6, 2.7, 2.8, 5.3_

  - [x] 1.5 实现 renderToolbarRow1 辅助函数 — 字体样式、对齐、换行、条件格式、图表、迷你图、冻结、格式刷、脚本
    - 创建 #font-bold-btn(.toolbar-btn.font-bold-btn, title="加粗 (Ctrl+B)", 文本 "B")
    - 创建 #font-italic-btn(.toolbar-btn.font-italic-btn, title="斜体 (Ctrl+I)", 文本 "I")
    - 创建 #font-underline-btn(.toolbar-btn.font-underline-btn, title="下划线 (Ctrl+U)", 文本 "U")
    - 创建 #font-strikethrough-btn(.toolbar-btn.font-strikethrough-btn, title="删除线", 内含 `<span style="text-decoration: line-through;">S</span>`)
    - 创建 .horizontal-align-picker > #horizontal-align-btn + #horizontal-align-dropdown（3 个选项，左对齐默认 active，各有 id）
    - 创建 .vertical-align-picker > #vertical-align-btn + #vertical-align-dropdown（3 个选项，居中对齐默认 active）
    - 创建 #wrap-text-btn(.toolbar-btn.wrap-text-btn, SVG)
    - .separator + #conditional-format-btn(SVG + "条件格式") + .separator
    - #insert-chart-btn(SVG + "图表")
    - .sparkline-picker > #sparkline-btn + #sparkline-dropdown（3 个选项 data-type: line/bar/winLoss）
    - .freeze-picker > #freeze-btn + #freeze-dropdown（4 个选项 data-freeze: firstRow/firstCol/currentCell/none）
    - .separator + #format-painter-btn(SVG + "格式刷") + #script-editor-btn(SVG + "脚本")
    - _Requirements: 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 5.1, 5.2, 5.3, 5.4_

  - [x] 1.6 实现 renderToolbarRow1 辅助函数 — 右侧状态区域和协同状态指示器
    - 创建 .toolbar-right > .status > #viewport-info（默认文本 "视图: 行 1-20, 列 A-Z"）
    - 创建 #collab-status(style="display: none;") > #collab-connection(.disconnected) + #collab-users + #collab-sync
    - #collab-connection 包含 .collab-dot + #collab-connection-text("未连接")
    - #collab-users 包含 SVG + #collab-user-count("0") + #collab-user-dropdown > .collab-user-dropdown-title + ul#collab-user-list
    - #collab-sync(style="display: none;") 包含 SVG
    - _Requirements: 2.16, 5.1, 5.2, 5.6_

  - [x] 1.7 实现 renderToolbarRow2 辅助函数
    - 创建 .toolbar-row.toolbar-row-2 结构
    - 创建 .cell-info > #selected-cell("A1") + input#cell-content(type=text, autocomplete=off, placeholder) + button#set-content(SVG) + #formula-error(.formula-error)
    - 创建 .toolbar-group > #hyperlink-btn(SVG + "链接") + #image-btn(SVG + "图片") + #pivot-table-btn(SVG + "透视表") + .separator
    - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.4, 5.5_

  - [x] 1.8 实现 renderSpreadsheetContainer、renderSheetTabBar、renderStatusBar、renderCollabNotifications
    - renderSpreadsheetContainer: .spreadsheet-container > canvas#excel-canvas
    - renderSheetTabBar: div#sheet-tab-bar.sheet-tab-bar
    - renderStatusBar: .status-bar > .status-item(#memory-usage 默认文本) + .status-item(#collab-sync-status[style=display:none] + #cell-count 默认文本)
    - renderCollabNotifications: div#collab-notifications.collab-notifications
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2_

- [x] 2. Checkpoint — 验证 renderToolbar 函数编译通过
  - 确保 `ui-controls.ts` 无 TypeScript 编译错误
  - 确保所有辅助函数使用 createElement 创建 DOM，SVG 使用 innerHTML 注入
  - 确保所有 tests pass，ask the user if questions arise.

- [x] 3. 修改 main.ts 初始化顺序
  - [x] 3.1 调整 DOMContentLoaded 回调
    - 导入 renderToolbar
    - 获取 #app 容器，不存在时抛出 Error
    - 调用 renderToolbar(appContainer) 在 SpreadsheetApp 实例化之前
    - 保持后续 SpreadsheetApp、UIControls、initCollaboration 顺序不变
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 4. 简化 index.html
  - [x] 4.1 清理 index.html body 内容
    - 保留 `<head>` 中所有 meta、字体链接、title
    - `<body>` 仅保留 `<div id="app"></div>` 和 `<script type="module" src="/src/main.ts"></script>`
    - 移除所有 .toolbar、.spreadsheet-container、#sheet-tab-bar、.status-bar、#collab-notifications 的 HTML
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 5. Checkpoint — 验证端到端功能
  - 确保 `npm run build` 编译通过
  - 确保所有 tests pass，ask the user if questions arise.

- [ ] 6. 编写单元测试和属性测试
  - [ ]* 6.1 编写 renderToolbar 基本结构单元测试
    - 验证 .toolbar、.toolbar-row-1、.toolbar-row-2、.spreadsheet-container、#sheet-tab-bar、.status-bar、#collab-notifications 存在
    - 验证 container 为 null 时抛出异常
    - _Requirements: 2.1, 3.1, 4.1, 4.2, 4.3, 4.4, 6.3_

  - [ ]* 6.2 编写 Toolbar_Row_1 关键元素单元测试
    - 验证 #undo-btn 和 #redo-btn 存在、disabled、包含 SVG
    - 验证 #font-color 默认值 #333333，#bg-color 默认值 #ffffff，label for 属性正确
    - 验证 8 个 border-position-option 的 data-position 值、4 个 border-style-option 的 data-style 值
    - 验证 #font-bold-btn、#font-italic-btn、#font-underline-btn、#font-strikethrough-btn 的 id/class/title
    - 验证水平对齐左对齐默认 active，垂直对齐居中默认 active
    - _Requirements: 2.2, 2.4, 2.5, 2.9, 2.10, 2.11, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 6.3 编写 Toolbar_Row_2 和辅助区域单元测试
    - 验证 #selected-cell 文本为 "A1"、#cell-content 为 input、#set-content 为 button
    - 验证 #memory-usage、#collab-sync-status、#cell-count 存在且默认文本正确
    - _Requirements: 3.2, 4.3_

  - [ ]* 6.4 编写属性测试 — Property 1: DOM 属性保真性
    - **Property 1: DOM 属性保真性**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 6.2**
    - 使用 fast-check 从预定义元素规格列表中随机选取元素
    - 验证 id、className、data-*、title 属性与规格一致
    - 至少 100 次迭代

  - [ ]* 6.5 编写属性测试 — Property 2: DOM 层级保真性
    - **Property 2: DOM 层级保真性**
    - **Validates: Requirements 5.6, 2.1, 3.1, 4.1**
    - 使用 fast-check 从预定义父子关系列表中随机选取
    - 验证子元素的 parentElement 匹配预期父元素
    - 至少 100 次迭代

- [x] 7. 使用浏览器 MCP 编写 e2e 测试覆盖所有功能点
  - [x] 7.1 e2e 验证工具栏基本结构渲染
    - 启动开发服务器，使用浏览器 MCP 打开页面
    - 验证 .toolbar、.toolbar-row-1、.toolbar-row-2 存在
    - 验证 .spreadsheet-container、canvas#excel-canvas 存在
    - 验证 #sheet-tab-bar、.status-bar、#collab-notifications 存在
    - _Requirements: 2.1, 3.1, 4.1, 4.2, 4.3, 4.4_

  - [x] 7.2 e2e 验证 Toolbar_Row_1 所有控件渲染
    - 验证 #undo-btn 和 #redo-btn 存在且 disabled
    - 验证 #merge-cells、#split-cells 存在
    - 验证 #font-color、#bg-color 颜色选择器存在
    - 验证 #border-btn、#border-dropdown 边框选择器存在
    - 验证 #font-family-btn、#font-size-btn、#number-format-btn 存在
    - 验证 #font-bold-btn、#font-italic-btn、#font-underline-btn、#font-strikethrough-btn 存在
    - 验证 #horizontal-align-btn、#vertical-align-btn 存在
    - 验证 #wrap-text-btn、#conditional-format-btn、#insert-chart-btn 存在
    - 验证 #sparkline-btn、#freeze-btn、#format-painter-btn、#script-editor-btn 存在
    - 验证 #viewport-info、#collab-status 存在
    - _Requirements: 2.2-2.16, 5.1, 5.2_

  - [x] 7.3 e2e 验证 Toolbar_Row_2 控件渲染
    - 验证 #selected-cell 显示 "A1"
    - 验证 #cell-content 输入框存在
    - 验证 #set-content 确认按钮存在
    - 验证 #hyperlink-btn、#image-btn、#pivot-table-btn 存在
    - _Requirements: 3.2, 3.3_

  - [x] 7.4 e2e 验证状态栏和辅助区域渲染
    - 验证 #memory-usage 显示默认文本
    - 验证 #cell-count 显示默认文本
    - 验证 canvas 可见且有尺寸
    - _Requirements: 4.1, 4.3_

  - [x] 7.5 e2e 验证工具栏交互功能正常
    - 使用浏览器 MCP 点击边框按钮，验证下拉面板显示
    - 使用浏览器 MCP 点击字体族按钮，验证下拉面板显示
    - 使用浏览器 MCP 点击数字格式按钮，验证下拉面板显示
    - 使用浏览器 MCP 在单元格输入内容，验证公式栏同步更新
    - _Requirements: 8.1, 8.2_

- [x] 8. Final checkpoint — 确保所有测试通过
  - 确保所有 tests pass，ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 设计文档使用 TypeScript，无需额外选择实现语言
- SVG 创建统一使用 innerHTML 注入到容器元素，避免 namespace 复杂性
- 所有 DOM 属性（id/class/data-*/title/SVG）必须与原 index.html 完全一致
- Property tests 使用 fast-check，每个属性至少 100 次迭代
- Checkpoints 确保增量验证
