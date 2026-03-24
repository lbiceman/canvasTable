# 需求文档：扩展功能（Extension Features）

## 简介

为 Canvas Excel (ice-excel) 电子表格应用实现第十二节「扩展功能」，包括数据透视表、宏/脚本支持、插件系统、超链接、图片插入、下拉选择器、右键菜单增强、格式刷、拖拽列/行重排序共九大功能模块。这些功能将显著提升应用的可扩展性和用户操作效率，使其更接近商用级电子表格产品。

## 术语表

- **SpreadsheetApp**：主控制器，负责用户交互事件处理与模块协调
- **SpreadsheetModel**：数据模型层，管理单元格数据、行列操作与业务逻辑
- **SpreadsheetRenderer**：Canvas 渲染器，负责视口计算、绘制与滚动
- **PivotTable**：数据透视表引擎，负责根据字段配置对源数据进行分组、聚合与汇总
- **PivotTablePanel**：数据透视表配置面板 UI，提供字段拖拽与配置交互
- **ScriptEngine**：脚本引擎，负责解析和执行用户自定义脚本
- **ScriptEditor**：脚本编辑器 UI，提供脚本编写与运行界面
- **PluginManager**：插件管理器，负责插件的注册、加载、卸载与生命周期管理
- **PluginAPI**：插件 API 接口，为第三方插件提供受控的电子表格操作能力
- **HyperlinkManager**：超链接管理器，负责超链接的存储、渲染与交互
- **ImageManager**：图片管理器，负责图片的插入、存储、定位与渲染
- **DropdownSelector**：下拉选择器控件，在单元格内提供下拉选择交互
- **CellContextMenu**：单元格右键上下文菜单，提供完整的单元格操作选项
- **FormatPainter**：格式刷工具，负责复制和应用单元格格式
- **RowColReorder**：行列重排序引擎，负责拖拽行/列到新位置的数据迁移与渲染
- **HistoryManager**：撤销/重做操作栈管理器
- **Cell**：单元格数据结构接口
- **InlineEditor**：浮动输入框，用于单元格编辑

## 需求

### 需求 1：数据透视表

**用户故事：** 作为数据分析用户，我希望通过拖拽字段生成汇总分析表，以便快速对大量数据进行多维度聚合分析。

#### 验收标准

1. WHEN 用户选中一个包含表头的数据区域并点击「数据透视表」按钮, THE PivotTablePanel SHALL 显示一个配置面板，列出源数据区域的所有列标题作为可用字段
2. WHEN 用户将字段拖拽到「行」区域, THE PivotTable SHALL 按该字段的唯一值对数据进行分组，并在结果表中生成对应的行标签
3. WHEN 用户将字段拖拽到「列」区域, THE PivotTable SHALL 按该字段的唯一值生成列标题
4. WHEN 用户将字段拖拽到「值」区域, THE PivotTable SHALL 对该字段执行默认聚合运算（数值字段默认求和，文本字段默认计数）
5. WHEN 用户在「值」区域点击已添加的字段, THE PivotTablePanel SHALL 显示聚合方式选择菜单，支持求和、计数、平均值、最大值、最小值五种聚合方式
6. WHEN 用户将字段拖拽到「筛选」区域, THE PivotTablePanel SHALL 显示该字段的值列表，允许用户勾选需要包含的值
7. WHEN 透视表配置发生变化, THE PivotTable SHALL 在 500 毫秒内重新计算并更新结果表
8. WHEN 源数据区域的单元格内容发生变化, THE PivotTable SHALL 自动重新计算透视表结果
9. THE PivotTable SHALL 在结果表的每个分组末尾生成小计行，在表格末尾生成总计行
10. IF 用户选中的数据区域不包含表头或为空, THEN THE PivotTablePanel SHALL 显示错误提示「请选择包含表头的非空数据区域」

### 需求 2：宏/脚本支持

**用户故事：** 作为高级用户，我希望编写自定义脚本来自动化重复操作，以便提高工作效率。

#### 验收标准

1. WHEN 用户点击工具栏「脚本编辑器」按钮, THE ScriptEditor SHALL 打开一个包含代码编辑区域和运行按钮的面板
2. THE ScriptEngine SHALL 提供以下 API 供脚本调用：getCellValue(row, col)、setCellValue(row, col, value)、getSelection()、setSelection(startRow, startCol, endRow, endCol)、getRowCount()、getColCount()
3. WHEN 用户点击「运行」按钮, THE ScriptEngine SHALL 在沙箱环境中执行脚本代码
4. IF 脚本执行过程中发生运行时错误, THEN THE ScriptEditor SHALL 在输出面板中显示错误信息，包含错误类型和行号
5. WHEN 脚本通过 API 修改单元格数据, THE HistoryManager SHALL 将整个脚本执行的所有修改记录为一个可撤销的操作
6. THE ScriptEngine SHALL 限制单次脚本执行时间不超过 10 秒，超时后终止执行并提示用户
7. WHEN 用户编写脚本, THE ScriptEditor SHALL 提供基础语法高亮（关键字、字符串、注释、数字使用不同颜色）
8. THE ScriptEngine SHALL 支持用户将脚本保存到 localStorage，并在脚本编辑器中列出已保存的脚本供加载使用

### 需求 3：插件系统

**用户故事：** 作为开发者，我希望通过插件机制扩展电子表格功能，以便在不修改核心代码的情况下添加自定义功能。

#### 验收标准

1. THE PluginManager SHALL 提供 registerPlugin(plugin) 方法，接受符合插件接口定义的对象进行注册
2. THE PluginAPI SHALL 为插件提供以下受控能力：读写单元格数据、注册自定义函数、添加工具栏按钮、添加右键菜单项、监听单元格变更事件
3. WHEN 插件调用 registerPlugin 方法, THE PluginManager SHALL 验证插件对象包含 name（字符串）、version（字符串）和 activate(api) 方法，缺少任一字段时拒绝注册并抛出错误
4. WHEN 插件注册成功, THE PluginManager SHALL 调用插件的 activate(api) 方法并传入 PluginAPI 实例
5. WHEN 用户卸载插件, THE PluginManager SHALL 调用插件的 deactivate() 方法（如存在），并移除该插件注册的所有工具栏按钮、菜单项和自定义函数
6. IF 插件的 activate 方法执行过程中抛出异常, THEN THE PluginManager SHALL 捕获异常，在控制台输出错误日志，并将该插件标记为加载失败状态
7. THE PluginManager SHALL 提供 getPlugins() 方法，返回所有已注册插件的名称、版本和状态（激活/失败/已卸载）列表

### 需求 4：超链接

**用户故事：** 作为用户，我希望在单元格中插入可点击的超链接，以便快速跳转到外部网页或文档。

#### 验收标准

1. WHEN 用户选中单元格并通过右键菜单选择「插入超链接」, THE HyperlinkManager SHALL 显示一个对话框，包含 URL 输入框和显示文本输入框
2. WHEN 用户在对话框中输入 URL 和显示文本并确认, THE HyperlinkManager SHALL 将超链接信息存储到 Cell 的 hyperlink 字段中
3. WHILE 单元格包含超链接, THE SpreadsheetRenderer SHALL 以蓝色字体和下划线样式渲染该单元格的显示文本
4. WHEN 用户按住 Ctrl 键并点击包含超链接的单元格, THE HyperlinkManager SHALL 在新浏览器标签页中打开该超链接的 URL
5. WHEN 用户右键点击包含超链接的单元格并选择「编辑超链接」, THE HyperlinkManager SHALL 显示编辑对话框，预填充当前 URL 和显示文本
6. WHEN 用户右键点击包含超链接的单元格并选择「移除超链接」, THE HyperlinkManager SHALL 清除该单元格的 hyperlink 字段，保留显示文本作为普通内容
7. IF 用户输入的 URL 不以 http://、https:// 或 mailto: 开头, THEN THE HyperlinkManager SHALL 自动添加 https:// 前缀
8. WHILE 鼠标悬停在包含超链接的单元格上且按住 Ctrl 键, THE SpreadsheetRenderer SHALL 将鼠标光标变为手型指针（pointer）

### 需求 5：图片插入

**用户故事：** 作为用户，我希望在电子表格中插入图片，以便在数据旁展示图表截图、产品图片等视觉内容。

#### 验收标准

1. WHEN 用户点击工具栏「插入图片」按钮, THE ImageManager SHALL 打开文件选择对话框，仅允许选择 PNG、JPG、GIF、WebP 格式的图片文件
2. WHEN 用户选择图片文件后, THE ImageManager SHALL 将图片以 Base64 编码存储，并在当前选中单元格位置创建一个浮动图片层
3. THE SpreadsheetRenderer SHALL 在 Canvas 上渲染浮动图片，图片默认大小为原始尺寸，最大不超过 800×600 像素
4. WHEN 用户拖拽浮动图片, THE ImageManager SHALL 更新图片的位置坐标
5. WHEN 用户拖拽浮动图片的边角控制点, THE ImageManager SHALL 按比例缩放图片尺寸
6. WHEN 用户选中浮动图片并按 Delete 键, THE ImageManager SHALL 删除该图片，并将删除操作记录到 HistoryManager
7. IF 用户选择的图片文件大小超过 5MB, THEN THE ImageManager SHALL 显示错误提示「图片文件大小不能超过 5MB」并拒绝插入
8. WHEN 电子表格数据导出为 JSON 时, THE ImageManager SHALL 将所有图片的 Base64 数据、位置和尺寸信息包含在导出数据中
9. WHEN 电子表格数据从 JSON 导入时, THE ImageManager SHALL 还原所有图片到其保存时的位置和尺寸

### 需求 6：下拉选择器

**用户故事：** 作为用户，我希望在单元格中使用下拉选择控件，以便从预定义选项中快速选择值，减少输入错误。

#### 验收标准

1. WHILE 单元格配置了 dropdown 类型的 ValidationRule, THE SpreadsheetRenderer SHALL 在该单元格右侧渲染一个下拉箭头图标
2. WHEN 用户点击下拉箭头图标或双击配置了下拉验证的单元格, THE DropdownSelector SHALL 在单元格下方显示一个下拉选项列表
3. WHEN 用户从下拉列表中点击选择一个选项, THE DropdownSelector SHALL 将选中值设置为单元格内容，关闭下拉列表，并将操作记录到 HistoryManager
4. WHEN 下拉列表显示时用户按上/下方向键, THE DropdownSelector SHALL 在选项之间移动高亮焦点
5. WHEN 下拉列表显示时用户按 Enter 键, THE DropdownSelector SHALL 确认当前高亮选项并关闭列表
6. WHEN 下拉列表显示时用户按 Escape 键, THE DropdownSelector SHALL 关闭列表且不修改单元格内容
7. WHEN 下拉列表显示时用户点击列表外部区域, THE DropdownSelector SHALL 关闭列表且不修改单元格内容
8. IF 下拉选项列表超过 8 个选项, THEN THE DropdownSelector SHALL 显示滚动条以限制列表最大可见高度

### 需求 7：右键菜单增强

**用户故事：** 作为用户，我希望在单元格区域右键时看到完整的操作菜单，以便快速执行复制、粘贴、插入、删除、格式刷等常用操作。

#### 验收标准

1. WHEN 用户在单元格数据区域右键点击, THE CellContextMenu SHALL 显示包含以下菜单项的上下文菜单：剪切、复制、粘贴、选择性粘贴、分隔线、插入超链接、分隔线、插入行（上方）、插入行（下方）、插入列（左侧）、插入列（右侧）、删除行、删除列、分隔线、格式刷、清除格式、分隔线、排序、筛选
2. WHEN 用户点击「剪切」菜单项, THE CellContextMenu SHALL 执行与 Ctrl+X 相同的剪切操作
3. WHEN 用户点击「复制」菜单项, THE CellContextMenu SHALL 执行与 Ctrl+C 相同的复制操作
4. WHEN 用户点击「粘贴」菜单项, THE CellContextMenu SHALL 执行与 Ctrl+V 相同的粘贴操作
5. WHEN 用户点击「选择性粘贴」菜单项, THE CellContextMenu SHALL 打开选择性粘贴对话框
6. WHILE 剪贴板为空（无内部剪贴板数据）, THE CellContextMenu SHALL 将「粘贴」和「选择性粘贴」菜单项显示为禁用（灰色）状态
7. WHEN 用户点击「插入行（上方）」菜单项, THE CellContextMenu SHALL 在当前选中行上方插入一行空行
8. WHEN 用户点击「插入行（下方）」菜单项, THE CellContextMenu SHALL 在当前选中行下方插入一行空行
9. WHEN 用户点击「插入列（左侧）」菜单项, THE CellContextMenu SHALL 在当前选中列左侧插入一列空列
10. WHEN 用户点击「插入列（右侧）」菜单项, THE CellContextMenu SHALL 在当前选中列右侧插入一列空列
11. WHEN 用户点击「格式刷」菜单项, THE CellContextMenu SHALL 激活格式刷模式（等同于点击工具栏格式刷按钮）
12. WHEN 用户点击「清除格式」菜单项, THE CellContextMenu SHALL 清除选中区域所有单元格的字体颜色、背景色、字号、加粗、斜体、下划线、对齐方式等格式属性，保留单元格内容
13. THE CellContextMenu SHALL 在显示时自动调整位置，确保菜单不超出浏览器视口边界
14. WHEN 用户点击菜单外部区域或按 Escape 键, THE CellContextMenu SHALL 关闭菜单

### 需求 8：格式刷

**用户故事：** 作为用户，我希望快速复制一个单元格的格式并应用到其他单元格，以便高效地统一表格样式。

#### 验收标准

1. WHEN 用户选中单元格并点击工具栏「格式刷」按钮, THE FormatPainter SHALL 进入格式刷模式，复制选中单元格的格式属性（字体颜色、背景色、字号、加粗、斜体、下划线、水平对齐、垂直对齐、数据格式）
2. WHILE 格式刷模式激活, THE SpreadsheetRenderer SHALL 将鼠标光标变为格式刷图标样式
3. WHILE 格式刷模式激活, THE SpreadsheetApp SHALL 在工具栏格式刷按钮上显示激活状态（高亮）
4. WHEN 格式刷模式激活后用户点击或拖选目标单元格区域, THE FormatPainter SHALL 将复制的格式应用到目标区域的所有单元格，并将操作记录到 HistoryManager
5. WHEN 格式刷单次应用完成后, THE FormatPainter SHALL 自动退出格式刷模式，恢复正常鼠标光标
6. WHEN 用户双击工具栏「格式刷」按钮, THE FormatPainter SHALL 进入锁定格式刷模式，允许连续多次应用格式
7. WHILE 锁定格式刷模式激活, THE FormatPainter SHALL 在每次点击或拖选后保持格式刷模式不退出
8. WHEN 锁定格式刷模式下用户按 Escape 键或再次点击格式刷按钮, THE FormatPainter SHALL 退出格式刷模式
9. WHEN 格式刷应用格式到目标区域, THE FormatPainter SHALL 仅修改格式属性，保留目标单元格的原有内容和公式

### 需求 9：拖拽列/行重排序

**用户故事：** 作为用户，我希望通过拖拽行号或列号来调整行列顺序，以便灵活地重新组织数据布局。

#### 验收标准

1. WHEN 用户在行号区域按下鼠标并开始拖拽, THE RowColReorder SHALL 进入行重排序模式，高亮显示被拖拽的行
2. WHILE 行重排序拖拽进行中, THE SpreadsheetRenderer SHALL 在鼠标位置显示一条水平插入指示线，标示行将被放置的目标位置
3. WHEN 用户在行重排序模式下释放鼠标, THE RowColReorder SHALL 将被拖拽的行移动到指示线所在位置，更新所有受影响行的单元格数据和行高，并将操作记录到 HistoryManager
4. WHEN 用户在列号区域按下鼠标并开始拖拽, THE RowColReorder SHALL 进入列重排序模式，高亮显示被拖拽的列
5. WHILE 列重排序拖拽进行中, THE SpreadsheetRenderer SHALL 在鼠标位置显示一条垂直插入指示线，标示列将被放置的目标位置
6. WHEN 用户在列重排序模式下释放鼠标, THE RowColReorder SHALL 将被拖拽的列移动到指示线所在位置，更新所有受影响列的单元格数据和列宽，并将操作记录到 HistoryManager
7. IF 用户将行/列拖拽到其原始位置, THEN THE RowColReorder SHALL 不执行任何数据移动操作
8. WHEN 用户选中多行后拖拽行号区域, THE RowColReorder SHALL 将所有选中的行作为一个整体移动到目标位置
9. WHEN 用户选中多列后拖拽列号区域, THE RowColReorder SHALL 将所有选中的列作为一个整体移动到目标位置
10. WHEN 行/列重排序操作完成后, THE SpreadsheetRenderer SHALL 重新渲染整个可见区域以反映新的行列顺序
