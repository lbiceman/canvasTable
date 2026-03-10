# 需求文档

## 简介

将工具栏中横向对齐的三个独立按钮（左对齐、居中对齐、右对齐）整合为一个下拉按钮组，交互方式与现有的纵向对齐按钮（`vertical-align-picker`）保持一致。此变更仅涉及 HTML 结构和 CSS 样式调整，不涉及任何脚本代码逻辑的修改。

## 术语表

- **Toolbar**：页面顶部的工具栏区域，包含各种操作按钮
- **HorizontalAlignPicker**：新的横向对齐下拉按钮组组件，包含主按钮和下拉菜单
- **HorizontalAlignDropdown**：横向对齐下拉菜单，展示左对齐、居中对齐、右对齐三个选项
- **VerticalAlignPicker**：现有的纵向对齐下拉按钮组，作为交互和样式的参考基准
- **AlignOption**：下拉菜单中的单个对齐选项项

## 需求

### 需求 1：替换独立按钮为下拉按钮组

**用户故事：** 作为用户，我希望横向对齐按钮以下拉按钮组的形式呈现，以便工具栏更加整洁紧凑。

#### 验收标准

1. THE HorizontalAlignPicker SHALL 替换工具栏中原有的三个独立横向对齐按钮（`font-align-left-btn`、`font-align-center-btn`、`font-align-right-btn`）
2. THE HorizontalAlignPicker SHALL 包含一个主按钮和一个下拉菜单
3. THE HorizontalAlignPicker 的主按钮 SHALL 显示一个对齐图标和当前选中对齐方式的文字标签
4. THE HorizontalAlignDropdown SHALL 包含三个选项：左对齐、居中对齐、右对齐

### 需求 2：下拉菜单交互方式与纵向对齐一致

**用户故事：** 作为用户，我希望横向对齐下拉按钮组的交互方式与纵向对齐按钮组一致，以获得统一的操作体验。

#### 验收标准

1. THE HorizontalAlignPicker SHALL 采用与 VerticalAlignPicker 相同的 HTML 结构模式（外层容器 > 主按钮 > 下拉菜单）
2. THE HorizontalAlignDropdown SHALL 在点击主按钮时显示或隐藏（复用现有的 CSS `visible` 类切换机制）
3. THE HorizontalAlignDropdown SHALL 默认处于隐藏状态
4. WHEN 用户选择一个 AlignOption 时，THE HorizontalAlignDropdown SHALL 关闭

### 需求 3：样式与现有组件保持一致

**用户故事：** 作为用户，我希望新的下拉按钮组在视觉上与现有的纵向对齐按钮组风格一致，以保持界面的统一性。

#### 验收标准

1. THE HorizontalAlignPicker SHALL 使用与 VerticalAlignPicker 相同的 CSS 样式模式（包括尺寸、边框、圆角、间距）
2. THE HorizontalAlignDropdown SHALL 使用与 `vertical-align-dropdown` 相同的下拉菜单样式（包括定位、背景色、边框、阴影、圆角）
3. THE AlignOption SHALL 使用与 `vertical-align-option` 相同的选项样式（包括内边距、字号、悬停效果、选中状态）
4. THE HorizontalAlignPicker SHALL 正确响应浅色和深色主题的 CSS 变量切换

### 需求 4：保留原有按钮的 ID 和属性

**用户故事：** 作为开发者，我希望原有按钮的 ID 和 data 属性被保留在下拉选项中，以确保现有的脚本逻辑无需修改即可正常工作。

#### 验收标准

1. THE HorizontalAlignDropdown 中的每个 AlignOption SHALL 保留原有按钮对应的 `data-align` 属性值（`left`、`center`、`right`）
2. THE HorizontalAlignPicker SHALL 保留原有三个按钮的 ID（`font-align-left-btn`、`font-align-center-btn`、`font-align-right-btn`）在下拉选项元素上，以确保现有事件绑定逻辑不受影响
3. THE HorizontalAlignPicker SHALL 保持原有按钮的 `title` 属性内容不变

### 需求 5：选中状态的正确显示

**用户故事：** 作为用户，我希望下拉菜单中能正确显示当前选中的对齐方式，以便我了解当前的对齐状态。

#### 验收标准

1. THE HorizontalAlignDropdown SHALL 通过 `active` CSS 类标识当前选中的 AlignOption
2. THE HorizontalAlignPicker 的主按钮文字标签 SHALL 反映当前选中的对齐方式（如"左对齐"、"居中"、"右对齐"）
3. WHEN 页面初始加载时，THE HorizontalAlignPicker SHALL 默认显示"左对齐"为选中状态
