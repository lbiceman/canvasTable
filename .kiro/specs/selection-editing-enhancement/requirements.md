# 需求文档：选区与编辑增强

## 简介

为 ice-excel Canvas 电子表格应用增强选区操作与编辑能力，涵盖多选区、整行/整列选择、全选、填充柄自动填充、查找与替换、选择性粘贴、拖拽移动、批量删除行/列、冻结窗格、隐藏行/列、分组折叠等功能。当前应用仅支持单选区模型（`Selection` 接口含 startRow/startCol/endRow/endCol），本次增强将扩展为多选区模型，并在此基础上实现一系列编辑增强功能，对标 Google Sheets / 腾讯文档的选区与编辑体验。

## 术语表

- **SpreadsheetApp**：主控制器，负责事件处理、选区管理、剪贴板操作
- **SpreadsheetModel**：数据模型层，负责单元格数据、行列管理、合并单元格逻辑
- **SpreadsheetRenderer**：Canvas 渲染器，负责视口管理、选区绘制、行列标题绘制
- **Selection**：选区对象，包含 startRow、startCol、endRow、endCol 四个属性
- **MultiSelection**：多选区集合，包含一个主选区（activeSelection）和多个附加选区（selections 数组）
- **FillHandle**：填充柄，位于选区右下角的小方块控件，用于拖拽自动填充
- **FillSeries**：填充序列，自动填充时根据源数据推断的递增/递减模式（数字递增、日期递增、自定义序列）
- **PasteSpecialMode**：选择性粘贴模式，包括仅粘贴值、仅粘贴格式、仅粘贴公式、转置粘贴
- **FreezePane**：冻结窗格，将指定行/列固定在视口顶部或左侧，滚动时保持可见
- **RowColumnGroup**：行/列分组，将连续的行或列归为一组，支持折叠/展开
- **SearchDialog**：搜索对话框，当前仅支持查找功能
- **InlineEditor**：内联编辑器，单元格编辑浮层
- **HistoryManager**：历史管理器，撤销/重做操作栈
- **Viewport**：视口，表示当前可见的行列范围及滚动偏移

## 需求

### 需求 1：多选区支持

**用户故事：** 作为电子表格用户，我希望通过 Ctrl+点击选择多个不连续的单元格区域，以便同时对多个区域进行格式化或数据操作。

#### 验收标准

1. WHEN 用户按住 Ctrl 键并点击一个单元格，THE SpreadsheetApp SHALL 将该单元格添加为一个新的独立选区，同时保留所有已有选区
2. WHEN 用户按住 Ctrl 键并拖拽选择一个区域，THE SpreadsheetApp SHALL 将该拖拽区域添加为一个新的独立选区，同时保留所有已有选区
3. WHEN 用户不按 Ctrl 键点击单元格，THE SpreadsheetApp SHALL 清除所有已有选区，仅保留当前点击产生的单选区
4. THE SpreadsheetRenderer SHALL 为 MultiSelection 中的每个选区分别绘制选区背景和边框
5. WHEN 用户对多选区执行 Delete 操作，THE SpreadsheetApp SHALL 清除所有选区内的单元格内容
6. WHEN 用户对多选区执行格式化操作（加粗、字体颜色等），THE SpreadsheetApp SHALL 将格式应用到所有选区内的单元格
7. THE SpreadsheetApp SHALL 在 MultiSelection 中维护一个 activeSelection 属性，指向最后添加的选区，用于状态栏信息显示和导航定位

### 需求 2：整行/整列选择

**用户故事：** 作为电子表格用户，我希望通过点击行号或列号选中整行或整列，并支持 Ctrl+点击多选和 Shift+点击范围选择，以便快速操作整行或整列数据。

#### 验收标准

1. WHEN 用户点击行号区域，THE SpreadsheetApp SHALL 选中该行的所有列（从第 0 列到最后一列）
2. WHEN 用户点击列号区域，THE SpreadsheetApp SHALL 选中该列的所有行（从第 0 行到最后一行）
3. WHEN 用户按住 Ctrl 键并点击行号，THE SpreadsheetApp SHALL 将该整行添加为新选区，同时保留已有选区
4. WHEN 用户按住 Ctrl 键并点击列号，THE SpreadsheetApp SHALL 将该整列添加为新选区，同时保留已有选区
5. WHEN 用户按住 Shift 键并点击行号，THE SpreadsheetApp SHALL 将选区扩展为从当前活动行到目标行的连续整行范围
6. WHEN 用户按住 Shift 键并点击列号，THE SpreadsheetApp SHALL 将选区扩展为从当前活动列到目标列的连续整列范围
7. WHEN 用户在行号区域拖拽，THE SpreadsheetApp SHALL 连续选中拖拽经过的所有整行

### 需求 3：全选

**用户故事：** 作为电子表格用户，我希望通过 Ctrl+A 快捷键全选所有单元格，以便快速对整个工作表进行操作。

#### 验收标准

1. WHEN 用户按下 Ctrl+A（或 Cmd+A），THE SpreadsheetApp SHALL 选中当前工作表的所有单元格（从第 0 行第 0 列到最后一行最后一列）
2. WHEN 全选生效时，THE SpreadsheetRenderer SHALL 高亮显示所有行号和列号标题
3. WHEN 用户在全选状态下按下任意方向键，THE SpreadsheetApp SHALL 取消全选并将选区设置为方向键指向的单元格
4. THE SpreadsheetApp SHALL 在按下 Ctrl+A 时调用 preventDefault() 阻止浏览器默认全选行为

### 需求 4：填充柄（自动填充）

**用户故事：** 作为电子表格用户，我希望通过拖拽单元格右下角的填充柄自动填充序列数据，以便快速生成递增数字、递增日期或自定义序列。

#### 验收标准

1. THE SpreadsheetRenderer SHALL 在当前选区的右下角绘制一个 6×6 像素的填充柄方块，使用 themeColors 中的 selectionBorder 颜色
2. WHEN 用户将鼠标悬停在填充柄上，THE SpreadsheetRenderer SHALL 将鼠标光标变为十字形（crosshair）
3. WHEN 用户从填充柄开始拖拽，THE SpreadsheetApp SHALL 显示填充预览区域（虚线边框），指示将被填充的目标范围
4. WHEN 用户拖拽填充柄向下或向右释放，且源单元格包含数字，THE SpreadsheetModel SHALL 按照源数据的递增模式填充目标区域（例如 1,2 → 3,4,5...）
5. WHEN 用户拖拽填充柄向下或向右释放，且源单元格包含日期，THE SpreadsheetModel SHALL 按照日期递增模式填充目标区域（例如逐日递增）
6. WHEN 用户拖拽填充柄向下或向右释放，且源单元格包含普通文本，THE SpreadsheetModel SHALL 将源文本复制填充到目标区域
7. WHEN 用户拖拽填充柄向上或向左释放，THE SpreadsheetModel SHALL 按照源数据的递减模式填充目标区域
8. WHEN 源区域包含多个单元格，THE SpreadsheetModel SHALL 识别序列模式（等差数列、日期间隔等）并按该模式延续填充
9. THE SpreadsheetApp SHALL 将填充操作记录到 HistoryManager，支持撤销/重做

### 需求 5：查找与替换

**用户故事：** 作为电子表格用户，我希望在查找功能的基础上增加替换功能，以便快速批量修改单元格内容。

#### 验收标准

1. WHEN 用户按下 Ctrl+H（或 Cmd+H），THE SearchDialog SHALL 打开并显示查找与替换界面，包含查找输入框和替换输入框
2. WHEN 用户在替换输入框中输入替换文本并点击"替换"按钮，THE SpreadsheetModel SHALL 将当前匹配的单元格内容替换为替换文本
3. WHEN 用户点击"全部替换"按钮，THE SpreadsheetModel SHALL 将所有匹配的单元格内容替换为替换文本，并显示替换总数
4. WHEN 替换操作完成后，THE SearchDialog SHALL 更新结果计数信息，反映替换后的匹配数量
5. THE SpreadsheetApp SHALL 将每次替换操作记录到 HistoryManager，支持撤销/重做
6. WHEN 用户按下 Ctrl+F（或 Cmd+F），THE SearchDialog SHALL 打开查找界面（保持现有查找功能不变）
7. THE SearchDialog SHALL 提供"查找"和"查找与替换"两种模式的切换能力


### 需求 6：选择性粘贴

**用户故事：** 作为电子表格用户，我希望在粘贴时可以选择仅粘贴值、仅粘贴格式、仅粘贴公式或转置粘贴，以便精确控制粘贴行为。

#### 验收标准

1. WHEN 用户按下 Ctrl+Shift+V（或 Cmd+Shift+V），THE SpreadsheetApp SHALL 显示选择性粘贴对话框，提供"仅粘贴值"、"仅粘贴格式"、"仅粘贴公式"、"转置粘贴"四个选项
2. WHEN 用户选择"仅粘贴值"，THE SpreadsheetModel SHALL 仅粘贴源单元格的显示文本内容，不包含格式、公式等信息
3. WHEN 用户选择"仅粘贴格式"，THE SpreadsheetModel SHALL 仅将源单元格的格式属性（字体、颜色、对齐等）应用到目标单元格，不修改目标单元格的内容
4. WHEN 用户选择"仅粘贴公式"，THE SpreadsheetModel SHALL 仅粘贴源单元格的公式内容（formulaContent），并根据目标位置偏移调整公式中的单元格引用
5. WHEN 用户选择"转置粘贴"，THE SpreadsheetModel SHALL 将源数据的行列互换后粘贴到目标区域（原来的行变为列，列变为行）
6. THE SpreadsheetApp SHALL 在内部剪贴板中保存完整的单元格信息（包括内容、格式、公式），以支持选择性粘贴
7. THE SpreadsheetApp SHALL 将选择性粘贴操作记录到 HistoryManager，支持撤销/重做

### 需求 7：拖拽移动单元格/区域

**用户故事：** 作为电子表格用户，我希望通过拖拽选中的单元格或区域将其移动到新位置，以便快速重新排列数据。

#### 验收标准

1. WHEN 用户在已选中区域的边框上按下鼠标，THE SpreadsheetRenderer SHALL 将鼠标光标变为移动光标（move）
2. WHEN 用户拖拽已选中区域，THE SpreadsheetRenderer SHALL 显示半透明的拖拽预览，指示目标放置位置
3. WHEN 用户释放鼠标完成拖拽，THE SpreadsheetModel SHALL 将源区域的所有单元格数据（内容、格式、公式）移动到目标位置，并清空源区域
4. IF 目标区域包含非空单元格，THEN THE SpreadsheetApp SHALL 显示确认对话框，询问用户是否覆盖目标区域的现有数据
5. IF 拖拽目标位置与源区域重叠，THEN THE SpreadsheetApp SHALL 正确处理重叠区域的数据移动，确保数据不丢失
6. THE SpreadsheetApp SHALL 将拖拽移动操作记录到 HistoryManager，支持撤销/重做

### 需求 8：批量删除行/列

**用户故事：** 作为电子表格用户，我希望选中多行或多列后一次性批量删除，以便高效管理工作表结构。

#### 验收标准

1. WHEN 用户选中多个连续整行并执行删除操作，THE SpreadsheetModel SHALL 一次性删除所有选中的行
2. WHEN 用户选中多个连续整列并执行删除操作，THE SpreadsheetModel SHALL 一次性删除所有选中的列
3. WHEN 用户通过 Ctrl+点击选中多个不连续整行并执行删除操作，THE SpreadsheetModel SHALL 从最大行号开始逆序删除所有选中的行，确保行号偏移不影响删除结果
4. WHEN 用户通过 Ctrl+点击选中多个不连续整列并执行删除操作，THE SpreadsheetModel SHALL 从最大列号开始逆序删除所有选中的列，确保列号偏移不影响删除结果
5. THE SpreadsheetApp SHALL 在右键菜单中提供"删除选中行"和"删除选中列"选项，仅在选中整行或整列时启用
6. THE SpreadsheetApp SHALL 将批量删除操作作为单个撤销单元记录到 HistoryManager，支持一次撤销恢复所有删除的行/列
7. IF 删除操作会导致工作表行数或列数少于 1，THEN THE SpreadsheetModel SHALL 拒绝该删除操作并保持数据不变

### 需求 9：冻结行/列（冻结窗格）

**用户故事：** 作为电子表格用户，我希望冻结首行、首列或自定义位置的行/列，使其在滚动时始终可见，以便在浏览大量数据时保持标题行/列的参照。

#### 验收标准

1. THE SpreadsheetRenderer SHALL 支持设置冻结行数（freezeRows）和冻结列数（freezeCols）属性
2. WHILE 冻结行数大于 0，THE SpreadsheetRenderer SHALL 将冻结行固定在视口顶部，滚动时冻结行保持不动
3. WHILE 冻结列数大于 0，THE SpreadsheetRenderer SHALL 将冻结列固定在视口左侧，滚动时冻结列保持不动
4. THE SpreadsheetRenderer SHALL 在冻结区域与非冻结区域之间绘制一条分隔线，使用 themeColors 中的颜色，以视觉区分冻结边界
5. WHEN 用户通过菜单选择"冻结首行"，THE SpreadsheetApp SHALL 将 freezeRows 设置为 1
6. WHEN 用户通过菜单选择"冻结首列"，THE SpreadsheetApp SHALL 将 freezeCols 设置为 1
7. WHEN 用户通过菜单选择"冻结至当前单元格"，THE SpreadsheetApp SHALL 将 freezeRows 设置为当前活动单元格的行号，freezeCols 设置为当前活动单元格的列号
8. WHEN 用户通过菜单选择"取消冻结"，THE SpreadsheetApp SHALL 将 freezeRows 和 freezeCols 均设置为 0
9. THE SpreadsheetRenderer SHALL 将冻结区域的单元格内容绘制在非冻结区域之上，确保冻结区域不被滚动内容遮挡


### 需求 10：隐藏行/列

**用户故事：** 作为电子表格用户，我希望隐藏不需要显示的行或列，并在需要时取消隐藏，以便聚焦于关键数据。

#### 验收标准

1. WHEN 用户选中一行或多行并执行"隐藏行"操作，THE SpreadsheetModel SHALL 将选中行标记为隐藏状态
2. WHEN 用户选中一列或多列并执行"隐藏列"操作，THE SpreadsheetModel SHALL 将选中列标记为隐藏状态
3. WHILE 行处于隐藏状态，THE SpreadsheetRenderer SHALL 跳过该行的渲染，不为其分配显示空间
4. WHILE 列处于隐藏状态，THE SpreadsheetRenderer SHALL 跳过该列的渲染，不为其分配显示空间
5. THE SpreadsheetRenderer SHALL 在隐藏行/列的相邻标题之间显示双线指示符，提示用户此处存在隐藏的行/列
6. WHEN 用户选中隐藏行/列两侧的相邻行/列并执行"取消隐藏"操作，THE SpreadsheetModel SHALL 将被隐藏的行/列恢复为可见状态
7. THE SpreadsheetApp SHALL 在右键菜单中提供"隐藏行"、"隐藏列"、"取消隐藏行"、"取消隐藏列"选项
8. THE SpreadsheetApp SHALL 将隐藏/取消隐藏操作记录到 HistoryManager，支持撤销/重做
9. WHILE 行或列处于隐藏状态，THE SpreadsheetModel SHALL 在行高/列宽计算和坐标定位中排除隐藏的行/列

### 需求 11：分组折叠

**用户故事：** 作为电子表格用户，我希望将连续的行或列分组，并通过折叠/展开控制其可见性，以便组织和管理复杂的数据结构。

#### 验收标准

1. WHEN 用户选中连续的多行并执行"分组"操作，THE SpreadsheetModel SHALL 创建一个行分组，记录分组的起始行和结束行
2. WHEN 用户选中连续的多列并执行"分组"操作，THE SpreadsheetModel SHALL 创建一个列分组，记录分组的起始列和结束列
3. THE SpreadsheetRenderer SHALL 在分组行/列的标题区域旁绘制分组指示线和折叠/展开按钮（-/+ 图标）
4. WHEN 用户点击分组的折叠按钮（-），THE SpreadsheetModel SHALL 将该分组内的所有行/列设置为隐藏状态，并将按钮变为展开按钮（+）
5. WHEN 用户点击分组的展开按钮（+），THE SpreadsheetModel SHALL 将该分组内的所有行/列恢复为可见状态，并将按钮变为折叠按钮（-）
6. THE SpreadsheetModel SHALL 支持嵌套分组（分组内包含子分组），嵌套层级上限为 8 级
7. THE SpreadsheetRenderer SHALL 根据分组嵌套层级在标题区域绘制层级指示线，每级缩进固定像素宽度
8. WHEN 用户选中已分组的行/列并执行"取消分组"操作，THE SpreadsheetModel SHALL 移除该分组定义，恢复行/列为独立状态
9. THE SpreadsheetApp SHALL 将分组/取消分组及折叠/展开操作记录到 HistoryManager，支持撤销/重做
