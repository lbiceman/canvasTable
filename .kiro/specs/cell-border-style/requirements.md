# 需求文档：单元格边框与样式

## 简介

为 Canvas Excel 电子表格应用添加单元格边框设置、边框样式/颜色自定义、字体族选择和删除线样式功能。用户可以对选中的单元格或区域设置不同位置（上/下/左/右/全部/外框/内框）的边框，选择边框线型（实线、虚线、点线、双线），自定义边框颜色，切换字体族，以及应用删除线文本装饰。所有边框和样式信息存储在 Cell 数据结构中，由 SpreadsheetRenderer 在 Canvas 上渲染，并支持撤销/重做和 JSON 导入/导出。

## 术语表

- **SpreadsheetApp**：主控制器，负责用户交互、工具栏事件绑定和操作协调
- **SpreadsheetModel**：数据模型层，负责单元格数据存储、批量样式设置和历史记录
- **SpreadsheetRenderer**：Canvas 渲染器，负责将单元格数据绘制到画布上
- **Cell**：单元格数据结构，包含内容、样式、格式等属性
- **CellBorder**：单元格边框配置对象，包含上/下/左/右四条边的样式信息
- **BorderSide**：单条边框的样式定义，包含线型、颜色和宽度
- **BorderStyle**：边框线型枚举，包括 solid（实线）、dashed（虚线）、dotted（点线）、double（双线）
- **BorderPosition**：边框应用位置，包括 top（上）、bottom（下）、left（左）、right（右）、all（全部）、outer（外框）、inner（内框）、none（清除）
- **HistoryManager**：撤销/重做历史管理器
- **Toolbar**：工具栏 UI 区域，包含边框、字体族、删除线等操作按钮

## 需求

### 需求 1：单元格边框数据模型

**用户故事：** 作为开发者，我希望 Cell 数据结构支持存储边框信息，以便每个单元格可以独立配置上/下/左/右四条边框的样式。

#### 验收标准

1. THE Cell 接口 SHALL 包含可选的 `border` 属性，类型为 CellBorder，用于存储四条边框的样式配置
2. THE CellBorder 接口 SHALL 包含 `top`、`bottom`、`left`、`right` 四个可选属性，每个属性类型为 BorderSide
3. THE BorderSide 接口 SHALL 包含 `style`（BorderStyle 类型）、`color`（字符串类型）和 `width`（数值类型）三个属性
4. THE BorderStyle 类型 SHALL 支持 `solid`、`dashed`、`dotted`、`double` 四种线型值

### 需求 2：批量设置单元格边框

**用户故事：** 作为用户，我希望对选中的单元格区域批量设置边框，以便快速为表格添加边框线。

#### 验收标准

1. WHEN 用户选中一个单元格区域并选择"全部边框"时，THE SpreadsheetModel SHALL 为区域内每个单元格设置上/下/左/右四条边框
2. WHEN 用户选中一个单元格区域并选择"外框边框"时，THE SpreadsheetModel SHALL 仅为区域最外圈的单元格设置对应方向的边框（顶行设上边框、底行设下边框、左列设左边框、右列设右边框）
3. WHEN 用户选中一个单元格区域并选择"内框边框"时，THE SpreadsheetModel SHALL 仅为区域内部相邻单元格之间的共享边设置边框
4. WHEN 用户选择"上边框"/"下边框"/"左边框"/"右边框"时，THE SpreadsheetModel SHALL 仅为选中区域内每个单元格设置对应方向的单条边框
5. WHEN 用户选择"清除边框"时，THE SpreadsheetModel SHALL 移除选中区域内所有单元格的全部边框配置
6. WHEN 边框设置操作执行时，THE SpreadsheetModel SHALL 通过 HistoryManager 记录操作，支持撤销和重做
7. WHEN 选中区域包含合并单元格时，THE SpreadsheetModel SHALL 将边框应用到合并区域的父单元格上

### 需求 3：边框样式与颜色选择

**用户故事：** 作为用户，我希望自定义边框的线型和颜色，以便创建不同视觉效果的表格边框。

#### 验收标准

1. THE Toolbar SHALL 提供边框线型选择控件，包含实线、虚线、点线、双线四个选项
2. THE Toolbar SHALL 提供边框颜色选择控件，使用 HTML `<input type="color">` 元素实现颜色选取
3. WHEN 用户更改边框线型或颜色后再应用边框时，THE SpreadsheetModel SHALL 使用用户选择的线型和颜色值创建边框
4. THE Toolbar SHALL 显示当前选中的边框线型和颜色作为默认值，初始默认为黑色实线

### 需求 4：Canvas 边框渲染

**用户故事：** 作为用户，我希望在表格中看到已设置的单元格边框，以便直观确认边框效果。

#### 验收标准

1. WHEN 单元格设置了边框时，THE SpreadsheetRenderer SHALL 在对应位置绘制边框线，边框线绘制在网格线之上
2. WHEN 边框样式为 `solid` 时，THE SpreadsheetRenderer SHALL 使用 Canvas `setLineDash([])` 绘制连续实线
3. WHEN 边框样式为 `dashed` 时，THE SpreadsheetRenderer SHALL 使用 Canvas `setLineDash([6, 3])` 绘制虚线
4. WHEN 边框样式为 `dotted` 时，THE SpreadsheetRenderer SHALL 使用 Canvas `setLineDash([2, 2])` 绘制点线
5. WHEN 边框样式为 `double` 时，THE SpreadsheetRenderer SHALL 绘制两条平行线，间距为 2 像素
6. THE SpreadsheetRenderer SHALL 使用边框配置中的 `color` 属性设置 Canvas `strokeStyle`
7. WHEN 两个相邻单元格共享一条边且双方均设置了边框时，THE SpreadsheetRenderer SHALL 优先渲染宽度较大的边框，宽度相同时渲染后绘制的单元格的边框
8. THE SpreadsheetRenderer SHALL 仅渲染视口范围内可见单元格的边框，遵循虚拟滚动机制

### 需求 5：字体族选择

**用户故事：** 作为用户，我希望为单元格选择不同的字体，以便丰富表格的文字展示效果。

#### 验收标准

1. THE Cell 接口 SHALL 包含可选的 `fontFamily` 属性，类型为字符串，用于存储单元格的字体族名称
2. THE Toolbar SHALL 提供字体族下拉选择控件，包含以下预设字体选项：宋体（SimSun）、微软雅黑（Microsoft YaHei）、黑体（SimHei）、楷体（KaiTi）、Arial、Times New Roman、Courier New
3. WHEN 用户从字体族下拉列表中选择一个字体时，THE SpreadsheetModel SHALL 将选中区域内所有单元格的 `fontFamily` 属性设置为对应字体名称
4. WHEN 单元格设置了 `fontFamily` 属性时，THE SpreadsheetRenderer SHALL 使用该字体族渲染单元格文本内容
5. WHEN 单元格未设置 `fontFamily` 属性时，THE SpreadsheetRenderer SHALL 使用 RenderConfig 中的默认 `fontFamily` 渲染文本
6. WHEN 字体族设置操作执行时，THE SpreadsheetModel SHALL 通过 HistoryManager 记录操作，支持撤销和重做
7. WHEN 用户选中单元格时，THE Toolbar SHALL 在字体族下拉控件中显示当前单元格的字体族名称

### 需求 6：删除线样式

**用户故事：** 作为用户，我希望为单元格文本添加删除线效果，以便标记已完成或已废弃的数据。

#### 验收标准

1. THE Cell 接口 SHALL 包含可选的 `fontStrikethrough` 属性，类型为布尔值，用于标记文本是否显示删除线
2. THE Toolbar SHALL 提供删除线切换按钮，点击后切换选中区域单元格的删除线状态
3. WHEN 单元格的 `fontStrikethrough` 为 `true` 时，THE SpreadsheetRenderer SHALL 在文本垂直中心位置绘制一条水平线，线宽为 1 像素，颜色与文本颜色一致
4. WHEN 用户点击删除线按钮时，THE SpreadsheetModel SHALL 切换选中区域内所有单元格的 `fontStrikethrough` 属性值（若当前为 true 则设为 false，反之亦然）
5. WHEN 删除线设置操作执行时，THE SpreadsheetModel SHALL 通过 HistoryManager 记录操作，支持撤销和重做
6. WHEN 用户选中已设置删除线的单元格时，THE Toolbar SHALL 高亮显示删除线按钮以反映当前状态

### 需求 7：边框与样式的数据持久化

**用户故事：** 作为用户，我希望边框、字体族和删除线设置在保存和加载时不丢失，以便下次打开时保持一致。

#### 验收标准

1. WHEN 导出 JSON 数据时，THE DataManager SHALL 将单元格的 `border`、`fontFamily` 和 `fontStrikethrough` 属性包含在导出数据中
2. WHEN 导入 JSON 数据时，THE DataManager SHALL 正确解析并恢复单元格的 `border`、`fontFamily` 和 `fontStrikethrough` 属性
3. WHEN 保存到 LocalStorage 时，THE DataManager SHALL 将边框、字体族和删除线信息一并持久化
4. FOR ALL 包含边框、字体族或删除线属性的 Cell 对象，导出后再导入 SHALL 产生与原始对象等价的数据（往返一致性）

### 需求 8：工具栏边框操作面板

**用户故事：** 作为用户，我希望通过工具栏中的边框按钮快速访问所有边框操作，以便高效地设置单元格边框。

#### 验收标准

1. THE Toolbar SHALL 在现有工具栏中添加一个边框操作按钮，点击后展开下拉面板
2. THE 边框下拉面板 SHALL 包含以下边框位置选项：上边框、下边框、左边框、右边框、全部边框、外框边框、内框边框、清除边框
3. THE 边框下拉面板 SHALL 包含边框线型选择区域，显示实线、虚线、点线、双线四种线型图标
4. THE 边框下拉面板 SHALL 包含边框颜色选择器
5. WHEN 用户点击边框位置选项时，THE SpreadsheetApp SHALL 使用当前选中的线型和颜色对选中区域应用对应的边框
6. WHEN 用户点击面板外部区域时，THE 边框下拉面板 SHALL 自动关闭
