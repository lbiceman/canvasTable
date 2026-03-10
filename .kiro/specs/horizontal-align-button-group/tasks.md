# 实施计划：横向对齐下拉按钮组

## 概述

将工具栏中三个独立的横向对齐按钮替换为下拉按钮组，参照现有纵向对齐按钮组（vertical-align-picker）的结构和样式。变更仅涉及 `index.html` 和 `src/style.css`，不修改任何 TypeScript 脚本逻辑。

## 任务

- [x] 1. 修改 HTML 结构：替换独立按钮为下拉按钮组
  - [x] 1.1 在 `index.html` 中，将三个独立的横向对齐按钮（`font-align-left-btn`、`font-align-center-btn`、`font-align-right-btn`）替换为 `horizontal-align-picker` 下拉按钮组结构
    - 外层容器使用 `<div class="horizontal-align-picker" title="水平对齐">`
    - 主按钮包含左对齐 SVG 图标和 `<span id="horizontal-align-text">左对齐</span>` 文字标签
    - 下拉菜单 `<div id="horizontal-align-dropdown" class="horizontal-align-dropdown">` 包含三个选项
    - 每个选项使用 `<div class="horizontal-align-option">` 并保留原有的 `id`、`data-align`、`title` 属性
    - 默认"左对齐"选项带 `active` 类
    - 参照设计文档中的 HTML 结构和现有 `vertical-align-picker` 的实现
    - _需求：1.1, 1.2, 1.3, 1.4, 2.1, 2.3, 4.1, 4.2, 4.3, 5.3_

- [x] 2. 新增 CSS 样式：添加 horizontal-align-picker 系列样式
  - [x] 2.1 在 `src/style.css` 中新增 `horizontal-align-*` 系列样式
    - `.horizontal-align-picker`：外层容器，参照 `.vertical-align-picker` 样式（相对定位、inline-flex）
    - `.horizontal-align-picker button`：主按钮样式，参照 `.vertical-align-picker button`
    - `.horizontal-align-picker button svg`：图标尺寸，参照 `.vertical-align-picker button svg`
    - `#horizontal-align-text`：文字标签字号，参照 `#vertical-align-text`
    - `.horizontal-align-dropdown`：下拉菜单样式（默认 `display: none`，绝对定位、背景色、边框、阴影、圆角），参照 `.vertical-align-dropdown`
    - `.horizontal-align-dropdown.visible`：显示状态 `display: block`
    - `.horizontal-align-option`：选项样式（内边距、字号、光标），参照 `.vertical-align-option`
    - `.horizontal-align-option:hover`：悬停效果，使用 `var(--theme-button-hover-bg)`
    - `.horizontal-align-option.active`：选中状态，使用 `var(--theme-selection-bg)` 和 `font-weight: 600`
    - 所有颜色值使用 CSS 变量确保主题兼容
    - _需求：3.1, 3.2, 3.3, 3.4, 2.2, 5.1_

- [x] 3. 检查点 - 验证变更
  - 确保页面正常加载，下拉按钮组正确显示
  - 确保原有按钮 ID 保留在下拉选项上，现有脚本逻辑不受影响
  - 确保浅色和深色主题下样式正确
  - 如有问题请向用户确认

## 备注

- 本次变更仅涉及 `index.html` 和 `src/style.css`，不修改任何 TypeScript 文件
- 所有样式参照现有 `vertical-align-*` 系列实现，保持视觉一致性
- 原有按钮的 `id`、`data-align`、`title` 属性保留在下拉选项元素上，确保 `app.ts` 事件绑定兼容
