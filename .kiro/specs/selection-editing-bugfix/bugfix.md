# Bugfix 需求文档

## 简介

`selection-editing-enhancement` 功能实现后引入了三个相互关联的 bug：单击选区位置错误、出现双焦点框（幽灵选区）、搜索替换功能不可用。根本原因是 `SpreadsheetRenderer` 中同时维护了 `selection`（旧单选区状态）和 `multiSelections`（新多选区状态）两套选区数据，代码中混用导致状态不一致；以及 `handleReplace`/`handleReplaceAll` 中正则表达式转义字符串被意外替换为 UUID。

## Bug 分析

### 当前行为（缺陷）

1.1 WHEN 用户单击一个普通单元格时，`handleMouseDown` 先调用 `renderer.setSelection()` 更新 `this.selection` 并触发 `render()`，此时 `this.multiSelections` 尚未更新，THEN 系统使用旧的 `this.selection` 分支渲染选区，导致渲染的选区位置与用户实际点击的单元格不一致（尤其在涉及合并单元格坐标调整时，`selection` 存储的是调整后坐标，而 `multiSelections` 存储的是原始点击坐标）

1.2 WHEN 用户拖拽选区（`handleMouseMove`）时，`multiSelection.setSingle()` 存储原始点击坐标，而 `renderer.setSelection()` 存储经过合并单元格计算后的不同坐标，THEN 系统中 `selection` 和 `multiSelections` 两套状态保存了不同的坐标值，导致选区显示位置与实际数据选区不一致

1.3 WHEN `renderer.setSelection()` 触发 `render()` 时 `this.multiSelections` 中仍保留旧数据（上一次操作的多选区），且 `this.selection` 也有值，THEN 系统同时渲染 `multiSelections`（走 `renderMultiSelection` 分支）和隐含的旧选区，导致页面上出现两个焦点框（双选区/幽灵选区），用户未按 Ctrl 键却看到多选效果

1.4 WHEN `handleArrowKey`、`handleTabKey`、`handleEnterKey` 中先更新 `multiSelection` 再调用 `renderer.setSelection()` 时，THEN 系统中 `selection` 和 `multiSelections` 可能不同步，导致键盘导航后选区渲染位置不正确或出现双焦点框

1.5 WHEN 用户在查找替换对话框中点击"替换"按钮时，`handleReplace` 中的正则表达式转义代码 `searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` 中的 `'\\$&'` 被意外替换为 UUID 字符串 `'\\4968c2fc-a54f-49fa-ae2a-30b538c14018'`，THEN 系统生成无效的正则表达式，替换功能完全不可用

1.6 WHEN 用户在查找替换对话框中点击"全部替换"按钮时，`handleReplaceAll` 中存在同样的正则表达式转义字符串被替换为 UUID 的问题，THEN 系统生成无效的正则表达式，全部替换功能完全不可用

### 期望行为（正确）

2.1 WHEN 用户单击一个普通单元格时，THEN 系统 SHALL 仅通过 `multiSelections` 单一状态源渲染选区，确保渲染的选区位置与用户实际点击的单元格完全一致

2.2 WHEN 用户拖拽选区时，THEN 系统 SHALL 通过统一的选区状态（`multiSelections`）存储经过合并单元格调整后的正确坐标，并基于该状态渲染选区，确保拖拽预览与最终选区位置一致

2.3 WHEN 用户进行任何选区操作（单击、拖拽、键盘导航）且未按 Ctrl 键时，THEN 系统 SHALL 在页面上仅显示一个选区框，不出现幽灵选区或双焦点框

2.4 WHEN 用户通过方向键、Tab 键、Enter 键导航时，THEN 系统 SHALL 通过统一的选区状态更新和渲染，确保键盘导航后选区位置正确且无双焦点框

2.5 WHEN 用户点击"替换"按钮时，THEN 系统 SHALL 使用正确的正则表达式转义 `'\\$&'` 对搜索文本中的特殊字符进行转义，成功将当前匹配单元格的内容替换为替换文本

2.6 WHEN 用户点击"全部替换"按钮时，THEN 系统 SHALL 使用正确的正则表达式转义 `'\\$&'` 对搜索文本中的特殊字符进行转义，成功将所有匹配单元格的内容替换为替换文本，并返回正确的替换计数

### 不变行为（回归防护）

3.1 WHEN 用户按住 Ctrl 键点击多个单元格时，THEN 系统 SHALL 继续正确支持多选区功能，每个选区独立渲染，活动选区使用主题色边框，非活动选区使用半透明变体

3.2 WHEN 用户点击行号或列号区域时，THEN 系统 SHALL 继续正确选中整行或整列，支持 Ctrl+点击多选和 Shift+点击范围扩展

3.3 WHEN 用户按下 Ctrl+A 全选时，THEN 系统 SHALL 继续正确选中所有单元格并高亮所有行列标题

3.4 WHEN 用户双击单元格进入编辑模式时，THEN 系统 SHALL 继续在正确的单元格位置显示内联编辑器

3.5 WHEN 用户使用填充柄拖拽填充时，THEN 系统 SHALL 继续正确显示填充预览并执行填充操作

3.6 WHEN 用户使用 Ctrl+F 打开查找对话框并搜索时，THEN 系统 SHALL 继续正确高亮匹配的单元格并支持导航

3.7 WHEN 用户执行拖拽移动选区时，THEN 系统 SHALL 继续正确显示移动预览并执行移动操作

3.8 WHEN 用户对选区执行 Delete 键删除内容或格式化操作时，THEN 系统 SHALL 继续正确应用到所有选区内的单元格
