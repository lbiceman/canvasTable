# Requirements Document

## Introduction

将 index.html 中所有工具栏相关的 HTML 标签迁移到 TypeScript 动态渲染，使 index.html 仅保留一个 `<div id="app"></div>` 容器。所有工具栏 DOM 结构由 `ui-controls.ts` 中的 `UIControls` 类在运行时动态创建，保持与现有功能完全一致的行为和 DOM 元素 ID，确保 `app.ts` 中大量通过 `getElementById` 获取 DOM 元素的代码无需修改。

## Glossary

- **Toolbar_Renderer**: `ui-controls.ts` 中负责动态创建工具栏 DOM 结构的模块
- **App_Controller**: `app.ts` 中的 `SpreadsheetApp` 类，负责工具栏事件绑定和业务逻辑
- **Toolbar_Row_1**: 工具栏第一行，包含撤销/重做、合并/拆分、颜色选择器、边框选择器、字体族/大小选择器、数字格式选择器、字体样式按钮、对齐选择器、自动换行、条件格式、图表、迷你图、冻结窗格、格式刷、脚本编辑器、状态信息和协同状态指示器
- **Toolbar_Row_2**: 工具栏第二行，包含单元格地址显示、公式栏输入框、确认按钮、公式错误提示、超链接/图片/透视表按钮
- **Status_Bar**: 底部状态栏，包含内存使用信息、协同同步状态和单元格计数
- **Sheet_Tab_Bar**: Sheet 标签栏容器
- **Collab_Status**: 协同编辑状态指示器区域，包含连接状态、在线用户数和同步状态

## Requirements

### Requirement 1: 简化 index.html 为最小容器

**User Story:** 作为开发者，我希望 index.html 仅包含一个 `<div id="app"></div>` 容器和必要的 `<head>` 内容，以便所有 UI 结构由 TypeScript 动态管理。

#### Acceptance Criteria

1. THE index.html SHALL 仅在 `<body>` 中保留 `<div id="app"></div>` 容器和 `<script type="module" src="/src/main.ts"></script>` 标签
2. THE index.html SHALL 保留 `<head>` 中的所有 meta 标签、字体链接和标题
3. THE index.html SHALL 移除所有工具栏、状态栏、Sheet 标签栏和协同通知容器的 HTML 标签

### Requirement 2: 动态渲染 Toolbar_Row_1

**User Story:** 作为开发者，我希望工具栏第一行的所有控件由 TypeScript 动态创建，以便集中管理 UI 结构。

#### Acceptance Criteria

1. WHEN Toolbar_Renderer 初始化时, THE Toolbar_Renderer SHALL 在 `#app` 容器内创建 `.toolbar > .toolbar-row.toolbar-row-1` 结构
2. THE Toolbar_Renderer SHALL 创建撤销按钮（id="undo-btn"）和重做按钮（id="redo-btn"），包含对应的 SVG 图标和中文文本，且初始状态为 disabled
3. THE Toolbar_Renderer SHALL 创建合并按钮（id="merge-cells"）和拆分按钮（id="split-cells"），包含对应的 SVG 图标和中文文本
4. THE Toolbar_Renderer SHALL 创建字体颜色选择器（id="font-color"，默认值 #333333）和背景颜色选择器（id="bg-color"，默认值 #ffffff），包含对应的 SVG 图标和 label 关联
5. THE Toolbar_Renderer SHALL 创建边框选择器（id="border-btn"、id="border-dropdown"），包含 8 个边框位置选项（top/bottom/left/right/all/outer/inner/none）、4 个线型选项（solid/dashed/dotted/double）和颜色选择器（id="border-color"）
6. THE Toolbar_Renderer SHALL 创建字体族选择器（id="font-family-btn"、id="font-family-dropdown"），包含 7 个字体选项（宋体、微软雅黑、黑体、楷体、Arial、Times New Roman、Courier New），每个选项设置对应的 data-font 属性和 font-family 样式
7. THE Toolbar_Renderer SHALL 创建字体大小选择器（id="font-size-btn"、id="font-size-dropdown"、id="font-size-text"），默认显示 "12px"
8. THE Toolbar_Renderer SHALL 创建数字格式选择器（id="number-format-btn"、id="number-format-dropdown"、id="number-format-text"），包含 7 个格式选项（常规/数字/货币/百分比/科学计数法/日期/时间）
9. THE Toolbar_Renderer SHALL 创建字体样式按钮：加粗（id="font-bold-btn"）、斜体（id="font-italic-btn"）、下划线（id="font-underline-btn"）、删除线（id="font-strikethrough-btn"），各按钮包含正确的 class 和 title 属性
10. THE Toolbar_Renderer SHALL 创建水平对齐选择器（id="horizontal-align-btn"、id="horizontal-align-dropdown"），包含左对齐（id="font-align-left-btn"）、居中对齐（id="font-align-center-btn"）、右对齐（id="font-align-right-btn"）选项
11. THE Toolbar_Renderer SHALL 创建垂直对齐选择器（id="vertical-align-btn"、id="vertical-align-dropdown"），包含上对齐、居中对齐（默认 active）、下对齐选项
12. THE Toolbar_Renderer SHALL 创建自动换行按钮（id="wrap-text-btn"）、条件格式按钮（id="conditional-format-btn"）、图表按钮（id="insert-chart-btn"），包含对应的 SVG 图标和中文文本
13. THE Toolbar_Renderer SHALL 创建迷你图选择器（id="sparkline-btn"、id="sparkline-dropdown"），包含折线/柱状/盈亏三个选项
14. THE Toolbar_Renderer SHALL 创建冻结窗格选择器（id="freeze-btn"、id="freeze-dropdown"），包含冻结首行/首列/至当前单元格/取消冻结四个选项
15. THE Toolbar_Renderer SHALL 创建格式刷按钮（id="format-painter-btn"）和脚本编辑器按钮（id="script-editor-btn"），包含对应的 SVG 图标和中文文本
16. THE Toolbar_Renderer SHALL 创建右侧状态区域，包含视口信息（id="viewport-info"）和协同状态指示器（id="collab-status"、id="collab-connection"、id="collab-connection-text"、id="collab-users"、id="collab-user-count"、id="collab-user-dropdown"、id="collab-user-list"、id="collab-sync"、id="collab-sync-status"）

### Requirement 3: 动态渲染 Toolbar_Row_2

**User Story:** 作为开发者，我希望工具栏第二行的所有控件由 TypeScript 动态创建，以便集中管理公式栏和扩展按钮。

#### Acceptance Criteria

1. WHEN Toolbar_Renderer 初始化时, THE Toolbar_Renderer SHALL 在 `.toolbar` 内创建 `.toolbar-row.toolbar-row-2` 结构
2. THE Toolbar_Renderer SHALL 创建 `.cell-info` 区域，包含单元格地址显示（id="selected-cell"，默认 "A1"）、内容输入框（id="cell-content"）、确认按钮（id="set-content"）和公式错误提示（id="formula-error"）
3. THE Toolbar_Renderer SHALL 创建超链接按钮（id="hyperlink-btn"）、图片按钮（id="image-btn"）和透视表按钮（id="pivot-table-btn"），包含对应的 SVG 图标和中文文本

### Requirement 4: 动态渲染 Spreadsheet 容器和辅助区域

**User Story:** 作为开发者，我希望 Canvas 容器、Sheet 标签栏、状态栏和协同通知容器由 TypeScript 动态创建，以便 index.html 完全清空。

#### Acceptance Criteria

1. WHEN Toolbar_Renderer 初始化时, THE Toolbar_Renderer SHALL 在 `#app` 容器内创建 `.spreadsheet-container > canvas#excel-canvas` 结构
2. THE Toolbar_Renderer SHALL 创建 Sheet 标签栏容器（id="sheet-tab-bar"，class="sheet-tab-bar"）
3. THE Toolbar_Renderer SHALL 创建状态栏（class="status-bar"），包含内存使用信息（id="memory-usage"）、协同同步状态文本（id="collab-sync-status"）和单元格计数（id="cell-count"）
4. THE Toolbar_Renderer SHALL 创建协同通知容器（id="collab-notifications"，class="collab-notifications"）

### Requirement 5: DOM 元素 ID 兼容性

**User Story:** 作为开发者，我希望动态创建的所有 DOM 元素保持与原 HTML 完全一致的 id、class、data 属性和层级结构，以便 app.ts 中的 getElementById 调用无需修改。

#### Acceptance Criteria

1. THE Toolbar_Renderer SHALL 确保所有动态创建的元素的 id 属性与原 index.html 中的 id 完全一致
2. THE Toolbar_Renderer SHALL 确保所有动态创建的元素的 class 属性与原 index.html 中的 class 完全一致
3. THE Toolbar_Renderer SHALL 确保所有动态创建的元素的 data-* 属性（如 data-position、data-style、data-font、data-format、data-align、data-type、data-freeze）与原 index.html 完全一致
4. THE Toolbar_Renderer SHALL 确保所有动态创建的元素的 title 属性与原 index.html 完全一致
5. THE Toolbar_Renderer SHALL 确保所有 SVG 图标的 viewBox、path、fill 等属性与原 index.html 完全一致
6. THE Toolbar_Renderer SHALL 确保 DOM 元素的父子层级关系与原 index.html 完全一致

### Requirement 6: 渲染时序保证

**User Story:** 作为开发者，我希望工具栏 DOM 在 SpreadsheetApp 构造函数执行前完成创建，以便所有 getElementById 调用能正确获取到元素。

#### Acceptance Criteria

1. WHEN main.ts 中 DOMContentLoaded 事件触发时, THE Toolbar_Renderer SHALL 在 SpreadsheetApp 实例化之前完成所有工具栏 DOM 的创建和挂载
2. WHEN Toolbar_Renderer 完成 DOM 创建后, THE App_Controller SHALL 能通过 getElementById 获取到所有工具栏元素
3. IF Toolbar_Renderer 创建 DOM 失败, THEN THE Toolbar_Renderer SHALL 在控制台输出错误信息并抛出异常

### Requirement 7: 代码组织与类型安全

**User Story:** 作为开发者，我希望工具栏渲染代码遵循项目的 TypeScript 编码规范，以便代码可维护且类型安全。

#### Acceptance Criteria

1. THE Toolbar_Renderer SHALL 使用 TypeScript 编写，禁止使用 any 类型
2. THE Toolbar_Renderer SHALL 使用 ES Module 导出公共接口
3. THE Toolbar_Renderer SHALL 将工具栏渲染逻辑组织为 UIControls 类的方法或独立的渲染函数
4. THE Toolbar_Renderer SHALL 使用中文注释说明各工具栏区域的创建逻辑
5. THE Toolbar_Renderer SHALL 使用英文命名变量和函数

### Requirement 8: 现有功能行为一致性

**User Story:** 作为开发者，我希望迁移后所有工具栏功能的行为与迁移前完全一致，以便用户无感知。

#### Acceptance Criteria

1. WHEN 迁移完成后, THE App_Controller SHALL 正常初始化所有工具栏事件绑定（initFontSizePicker、initBorderPicker、initFontFamilyPicker、initVerticalAlignPicker、initHorizontalAlignPicker、initNumberFormatPicker、initChartToolbarEvents 等）
2. WHEN 迁移完成后, THE App_Controller SHALL 正常响应所有工具栏按钮的点击事件（撤销/重做、合并/拆分、字体样式、对齐方式等）
3. WHEN 迁移完成后, THE main.ts 中的协同 UI 更新函数 SHALL 正常通过 getElementById 获取协同状态元素并更新显示
4. WHEN 迁移完成后, THE App_Controller 的 initFormulaBar 方法 SHALL 正常找到 `.cell-info` 容器并初始化公式栏组件
5. WHEN 颜色选择器的 label 和 input 通过 for/id 关联时, THE Toolbar_Renderer SHALL 确保点击 SVG 图标能正确触发颜色选择器弹出
