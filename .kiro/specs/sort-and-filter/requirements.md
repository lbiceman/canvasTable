# 需求文档：排序与筛选

## 简介

为 Canvas Excel 电子表格应用实现排序与筛选功能，使用户能够对表格数据进行单列/多列排序、自动筛选和高级筛选操作。排序与筛选通过行索引映射实现，不修改原始数据顺序，筛选激活时提供清晰的视觉指示。所有 UI 元素基于 Canvas 渲染或原生 DOM 构建，不依赖任何 UI 框架。

## 术语表

- **SortEngine**：排序引擎，负责根据排序规则计算行索引映射
- **FilterEngine**：筛选引擎，负责根据筛选条件计算行可见性
- **SortFilterModel**：排序与筛选数据模型，存储排序规则、筛选条件和行索引映射
- **FilterDropdown**：筛选下拉菜单，列头点击后弹出的筛选条件设置面板
- **ColumnHeaderIndicator**：列头筛选指示器，在列头区域渲染的筛选/排序状态图标
- **RowIndexMap**：行索引映射数组，将显示行号映射到实际数据行号
- **SortRule**：排序规则，包含列索引和排序方向（升序/降序）
- **FilterCondition**：筛选条件，描述对某列数据的筛选逻辑
- **SpreadsheetModel**：电子表格数据模型，管理单元格数据和行列结构
- **SpreadsheetRenderer**：电子表格渲染器，负责 Canvas 绘制
- **SpreadsheetApp**：电子表格控制器，协调用户交互与数据/渲染层

## 需求

### 需求 1：排序数据模型与行索引映射

**用户故事：** 作为开发者，我希望排序与筛选通过行索引映射实现，以便不修改原始数据顺序，支持撤销和恢复原始排列。

#### 验收标准

1. THE SortFilterModel SHALL 维护一个 RowIndexMap 数组，将显示行索引映射到实际数据行索引
2. WHEN 未应用任何排序或筛选时，THE SortFilterModel SHALL 使 RowIndexMap 为恒等映射（显示行 i 对应数据行 i）
3. WHEN 排序规则或筛选条件发生变化时，THE SortFilterModel SHALL 重新计算 RowIndexMap
4. THE SortFilterModel SHALL 提供 getDataRowIndex(displayRow: number) 方法，将显示行号转换为实际数据行号
5. THE SortFilterModel SHALL 提供 getDisplayRowIndex(dataRow: number) 方法，将实际数据行号转换为显示行号；WHEN 该数据行被筛选隐藏时，SHALL 返回 -1

### 需求 2：单列排序

**用户故事：** 作为用户，我希望对某一列进行升序或降序排序，以便快速查看数据的排列顺序。

#### 验收标准

1. WHEN 用户对某列触发升序排序时，THE SortEngine SHALL 按该列单元格值从小到大重新计算 RowIndexMap
2. WHEN 用户对某列触发降序排序时，THE SortEngine SHALL 按该列单元格值从大到小重新计算 RowIndexMap
3. THE SortEngine SHALL 支持文本、数字和日期三种数据类型的比较：数字按数值大小比较，日期按时间先后比较，文本按 Unicode 编码顺序比较
4. WHEN 单元格内容为空时，THE SortEngine SHALL 将空单元格排列在排序结果的末尾，无论升序或降序
5. WHEN 排序完成后，THE SpreadsheetRenderer SHALL 根据更新后的 RowIndexMap 重新渲染可见区域

### 需求 3：多列排序

**用户故事：** 作为用户，我希望按多列设置排序优先级，以便在主排序列值相同时按次要列进一步排序。

#### 验收标准

1. THE SortFilterModel SHALL 支持存储多个 SortRule，每个 SortRule 包含列索引和排序方向
2. WHEN 应用多列排序时，THE SortEngine SHALL 按 SortRule 列表的顺序依次比较：先按第一条规则排序，值相同时按第二条规则排序，依此类推
3. WHEN 用户添加新的排序规则时，THE SortFilterModel SHALL 将新规则追加到 SortRule 列表末尾
4. WHEN 用户移除某条排序规则时，THE SortFilterModel SHALL 从 SortRule 列表中删除该规则并重新计算 RowIndexMap
5. THE SortFilterModel SHALL 支持清除所有排序规则，恢复原始数据顺序

### 需求 4：自动筛选

**用户故事：** 作为用户，我希望通过列头的筛选下拉菜单快速筛选数据，以便只查看符合条件的行。

#### 验收标准

1. WHEN 用户点击列头的筛选图标时，THE FilterDropdown SHALL 在该列头下方显示筛选下拉菜单
2. THE FilterDropdown SHALL 显示该列所有唯一值的复选框列表，默认全部选中
3. WHEN 用户取消某些值的选中状态并确认时，THE FilterEngine SHALL 隐藏不包含选中值的行
4. THE FilterDropdown SHALL 提供搜索输入框，WHEN 用户输入搜索文本时，THE FilterDropdown SHALL 实时过滤复选框列表中的选项
5. THE FilterDropdown SHALL 提供"全选"和"清除"快捷操作按钮
6. WHEN 用户点击 FilterDropdown 外部区域时，THE FilterDropdown SHALL 关闭且不应用更改

### 需求 5：文本/数字/日期筛选条件

**用户故事：** 作为用户，我希望使用条件筛选（如"大于"、"包含"、"在某日期之后"），以便精确筛选数据。

#### 验收标准

1. THE FilterDropdown SHALL 提供文本筛选条件选项：包含、不包含、等于、开头是、结尾是
2. THE FilterDropdown SHALL 提供数字筛选条件选项：等于、不等于、大于、大于等于、小于、小于等于、介于
3. THE FilterDropdown SHALL 提供日期筛选条件选项：等于、在某日期之前、在某日期之后、介于两个日期之间
4. WHEN 用户选择筛选条件并输入筛选值后确认时，THE FilterEngine SHALL 根据条件和值计算行可见性并更新 RowIndexMap
5. THE FilterEngine SHALL 根据列的数据类型自动判断可用的筛选条件类型

### 需求 6：高级筛选

**用户故事：** 作为用户，我希望组合多个筛选条件进行复杂筛选，以便处理复杂的数据分析场景。

#### 验收标准

1. THE FilterEngine SHALL 支持对同一列设置多个筛选条件，通过"与"（AND）或"或"（OR）逻辑组合
2. THE FilterEngine SHALL 支持同时对多列设置筛选条件，多列之间使用"与"（AND）逻辑组合
3. WHEN 多列同时存在筛选条件时，THE FilterEngine SHALL 仅显示满足所有列筛选条件的行
4. THE SortFilterModel SHALL 支持清除单列的筛选条件，清除后该列不再参与筛选计算
5. THE SortFilterModel SHALL 支持清除所有筛选条件，恢复显示全部行

### 需求 7：筛选状态视觉指示

**用户故事：** 作为用户，我希望在筛选激活时看到清晰的视觉提示，以便知道当前数据处于筛选状态。

#### 验收标准

1. WHEN 某列存在活跃的筛选条件时，THE ColumnHeaderIndicator SHALL 在该列头区域渲染筛选图标，使用与普通状态不同的颜色或样式
2. WHEN 某列存在活跃的排序规则时，THE ColumnHeaderIndicator SHALL 在该列头区域渲染排序方向箭头（升序向上、降序向下）
3. WHILE 筛选处于激活状态，THE SpreadsheetRenderer SHALL 在状态栏显示筛选摘要信息，格式为"显示 M / N 行"
4. WHILE 筛选处于激活状态，THE SpreadsheetRenderer SHALL 使被筛选隐藏的行的行号在行标题区域不连续显示，以提示用户存在隐藏行
5. IF 筛选导致所有行均被隐藏，THEN THE SpreadsheetRenderer SHALL 在数据区域显示"无匹配结果"提示文本

### 需求 8：排序与筛选的交互集成

**用户故事：** 作为用户，我希望排序和筛选能够协同工作，以便同时筛选和排序数据。

#### 验收标准

1. WHEN 同时存在排序规则和筛选条件时，THE SortFilterModel SHALL 先应用筛选（确定可见行），再对可见行应用排序
2. WHEN 排序或筛选状态变化时，THE SpreadsheetApp SHALL 更新当前选区和活跃单元格的位置，使其映射到正确的显示行
3. WHEN 排序或筛选状态变化时，THE SpreadsheetRenderer SHALL 重新渲染整个可见区域
4. THE SpreadsheetModel SHALL 在排序/筛选状态下，通过 RowIndexMap 正确读取和写入单元格数据，确保编辑操作作用于实际数据行
5. WHEN 用户在筛选状态下编辑单元格内容时，IF 编辑后的值不再满足当前筛选条件，THEN THE SortFilterModel SHALL 在下次筛选刷新时隐藏该行

### 需求 9：排序与筛选的撤销/重做支持

**用户故事：** 作为用户，我希望排序和筛选操作支持撤销和重做，以便在误操作时恢复之前的状态。

#### 验收标准

1. WHEN 用户执行排序操作时，THE SpreadsheetApp SHALL 将排序前的 SortRule 列表记录到撤销栈
2. WHEN 用户执行筛选操作时，THE SpreadsheetApp SHALL 将筛选前的 FilterCondition 集合记录到撤销栈
3. WHEN 用户触发撤销时，THE SpreadsheetApp SHALL 恢复到上一次的排序规则和筛选条件，并重新计算 RowIndexMap
4. WHEN 用户触发重做时，THE SpreadsheetApp SHALL 重新应用被撤销的排序规则和筛选条件
