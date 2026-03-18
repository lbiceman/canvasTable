# 需求文档：数据类型与格式化

## 简介

为 Canvas Excel 电子表格应用添加完整的数据类型识别与格式化能力，包括数字格式化、日期/时间处理、数据类型自动识别、条件格式、数据验证、富文本编辑、文本换行与溢出处理。该功能将扩展现有的 Cell 数据模型，新增格式化引擎和验证系统，并增强 Canvas 渲染器以支持多样化的单元格显示效果。

## 术语表

- **Cell**：单元格数据对象，存储内容、格式和样式信息
- **SpreadsheetModel**：数据模型层，管理单元格数据和业务逻辑
- **SpreadsheetRenderer**：Canvas 渲染层，负责将单元格数据绘制到画布上
- **NumberFormatter**：数字格式化引擎，将数值按指定格式模式转换为显示字符串
- **DateFormatter**：日期格式化引擎，将日期值按指定格式模式转换为显示字符串
- **FormatPattern**：格式模式字符串，如 `#,##0.00`、`yyyy-MM-dd`，定义数据的显示方式
- **DataType**：单元格数据类型枚举，包括 text、number、date、percentage、currency
- **ConditionalFormat**：条件格式规则，根据单元格值动态改变显示样式
- **ValidationRule**：数据验证规则，限制单元格可接受的输入内容
- **RichTextSegment**：富文本片段，表示单元格内一段具有独立样式的文本
- **TextOverflow**：文本溢出模式，控制长文本在单元格中的显示行为

## 需求

### 需求 1：数字格式化

**用户故事：** 作为电子表格用户，我想要将数字按货币、百分比、千分位等格式显示，以便数据更易于阅读和理解。

#### 验收标准

1. WHEN 用户为单元格设置数字格式模式, THE NumberFormatter SHALL 按照该格式模式将数值转换为格式化显示字符串
2. THE NumberFormatter SHALL 支持以下内置格式类型：货币（如 ¥1,234.56）、百分比（如 12.34%）、千分位（如 1,234,567）、科学计数法（如 1.23E+4）
3. WHEN 用户指定自定义格式模式（如 `#,##0.00`）, THE NumberFormatter SHALL 按照该模式解析并格式化数值
4. THE NumberFormatter SHALL 支持格式模式中的以下占位符：`#`（可选数字位）、`0`（必填数字位）、`,`（千分位分隔符）、`.`（小数点）、`%`（百分比）、`E+`（科学计数法）
5. WHEN 单元格内容为非数值字符串且格式类型为数字格式, THE NumberFormatter SHALL 保持原始文本不变
6. THE NumberFormatter SHALL 提供 format(value, pattern) 方法将数值格式化为字符串，以及 parse(text, pattern) 方法将格式化字符串解析回数值
7. FOR ALL 有效数值, 对该数值执行 format 再执行 parse SHALL 产生与原始数值等价的结果（往返一致性）

### 需求 2：日期/时间类型

**用户故事：** 作为电子表格用户，我想要输入和显示日期与时间数据，以便管理时间相关的信息。

#### 验收标准

1. THE DateFormatter SHALL 支持以下日期格式模式：`yyyy-MM-dd`、`yyyy/MM/dd`、`MM/dd/yyyy`、`dd/MM/yyyy`、`yyyy年MM月dd日`
2. THE DateFormatter SHALL 支持以下时间格式模式：`HH:mm:ss`、`HH:mm`、`hh:mm:ss A`（12小时制）
3. THE DateFormatter SHALL 支持日期时间组合格式：`yyyy-MM-dd HH:mm:ss`
4. WHEN 用户在单元格中输入符合日期格式的文本, THE DateFormatter SHALL 将其解析为内部日期数值存储
5. THE DateFormatter SHALL 提供 format(dateValue, pattern) 方法将日期数值格式化为字符串，以及 parse(text, pattern) 方法将日期字符串解析回日期数值
6. FOR ALL 有效日期值, 对该日期值执行 format 再执行 parse SHALL 产生与原始日期值等价的结果（往返一致性）
7. IF 用户输入的文本无法解析为有效日期, THEN THE DateFormatter SHALL 将该内容作为普通文本保留

### 需求 3：数据类型自动识别

**用户故事：** 作为电子表格用户，我想要在输入数据时系统自动识别数据类型并应用相应格式，以便减少手动格式设置的工作量。

#### 验收标准

1. WHEN 用户在单元格中完成输入, THE SpreadsheetModel SHALL 自动检测输入内容的数据类型
2. THE SpreadsheetModel SHALL 识别以下数据类型：纯数字（如 `1234`、`-56.78`）、百分比（如 `12%`、`3.5%`）、货币（如 `¥100`、`$50.00`）、日期（如 `2024-01-15`、`2024/01/15`）、普通文本
3. WHEN 输入内容被识别为数字类型, THE SpreadsheetModel SHALL 将 Cell 的 dataType 设置为对应类型，并存储原始数值到 rawValue 字段
4. WHEN 输入内容被识别为百分比类型, THE SpreadsheetModel SHALL 将显示值保留百分比格式，并将实际数值（如 0.12）存储到 rawValue 字段
5. WHEN 单元格已手动设置格式类型, THE SpreadsheetModel SHALL 优先使用手动设置的格式，跳过自动识别
6. IF 输入内容无法匹配任何已知数据类型, THEN THE SpreadsheetModel SHALL 将 dataType 设置为 text 并保持原始内容不变

### 需求 4：条件格式

**用户故事：** 作为电子表格用户，我想要根据单元格的值自动改变其显示样式，以便快速识别数据中的关键信息和趋势。

#### 验收标准

1. WHEN 用户为单元格区域设置条件格式规则, THE SpreadsheetRenderer SHALL 在渲染时根据规则动态计算并应用样式
2. THE ConditionalFormat SHALL 支持以下比较条件：大于、小于、等于、介于、文本包含、文本开头为、文本结尾为
3. THE ConditionalFormat SHALL 支持以下样式效果：字体颜色变更、背景颜色变更
4. THE ConditionalFormat SHALL 支持数据条效果：在单元格内绘制与数值成比例的水平条形图
5. THE ConditionalFormat SHALL 支持色阶效果：根据数值在范围内的位置，在两种或三种颜色之间插值计算背景色
6. THE ConditionalFormat SHALL 支持图标集效果：根据数值阈值在单元格内显示对应的图标（如箭头、圆点）
7. WHEN 同一单元格存在多条条件格式规则, THE SpreadsheetRenderer SHALL 按规则优先级从高到低依次评估，应用第一条匹配的规则
8. WHEN 单元格值发生变化, THE SpreadsheetRenderer SHALL 重新评估该单元格关联的条件格式规则并更新显示

### 需求 5：数据验证

**用户故事：** 作为电子表格用户，我想要限制单元格可接受的输入类型和范围，以便确保数据的准确性和一致性。

#### 验收标准

1. WHEN 用户为单元格设置验证规则, THE SpreadsheetModel SHALL 在每次输入完成时对新值执行验证检查
2. THE ValidationRule SHALL 支持以下验证类型：下拉列表（限制输入为预定义选项之一）、数值范围（限制输入为指定最小值和最大值之间的数字）、文本长度（限制输入文本的字符数范围）、自定义验证（通过用户定义的条件表达式验证）
3. WHEN 单元格设置了下拉列表验证, THE SpreadsheetRenderer SHALL 在单元格右侧绘制下拉箭头图标
4. WHEN 用户点击下拉箭头, THE SpreadsheetApp SHALL 显示包含所有可选项的下拉菜单
5. WHEN 用户输入不符合验证规则的值, THE SpreadsheetApp SHALL 显示错误提示信息，并根据验证规则的严格程度决定是否阻止输入
6. WHILE 单元格处于选中状态且该单元格设置了输入提示, THE SpreadsheetApp SHALL 在单元格附近显示提示信息
7. THE ValidationRule SHALL 支持两种错误处理模式：阻止模式（拒绝无效输入并恢复原值）和警告模式（显示警告但允许输入）

### 需求 6：富文本编辑

**用户故事：** 作为电子表格用户，我想要在单个单元格内对不同文本片段应用不同的字体样式，以便实现更丰富的文本展示效果。

#### 验收标准

1. THE Cell SHALL 支持通过 richText 字段存储富文本内容，该字段为 RichTextSegment 数组
2. THE RichTextSegment SHALL 包含以下属性：text（文本内容）、fontBold（加粗）、fontItalic（斜体）、fontUnderline（下划线）、fontColor（字体颜色）、fontSize（字号）
3. WHEN 单元格包含 richText 数据, THE SpreadsheetRenderer SHALL 逐段绘制每个 RichTextSegment，每段使用各自的样式属性
4. WHEN 用户在内联编辑器中选中部分文本并应用样式, THE InlineEditor SHALL 将该单元格内容转换为 RichTextSegment 数组，对选中部分创建独立的样式片段
5. WHEN 单元格同时存在 richText 和 content 字段, THE SpreadsheetRenderer SHALL 优先使用 richText 进行渲染
6. IF 富文本所有片段的样式属性完全相同, THEN THE SpreadsheetModel SHALL 将其合并为普通 content 存储以节省空间

### 需求 7：文本换行与自动换行

**用户故事：** 作为电子表格用户，我想要在单元格内显示多行文本，以便完整展示较长的内容而不被截断。

#### 验收标准

1. WHEN 单元格的 wrapText 属性设置为 true, THE SpreadsheetRenderer SHALL 将文本按单元格宽度自动换行显示
2. WHEN 单元格内容包含换行符（`\n`）, THE SpreadsheetRenderer SHALL 在换行符位置进行强制换行
3. WHEN 自动换行导致文本高度超过当前行高, THE SpreadsheetModel SHALL 自动调整该行的行高以完整显示所有文本行
4. WHEN 用户手动调整行高后, THE SpreadsheetModel SHALL 保持用户设置的行高，文本换行在该高度内显示并裁剪超出部分
5. THE SpreadsheetRenderer SHALL 在换行模式下根据单元格的 verticalAlign 属性（top、middle、bottom）正确定位多行文本的垂直位置
6. WHEN 用户在内联编辑器中按下 Alt+Enter, THE InlineEditor SHALL 在光标位置插入换行符

### 需求 8：文本溢出处理

**用户故事：** 作为电子表格用户，我想要长文本能够溢出显示到相邻的空单元格区域，以便在不调整列宽的情况下查看完整内容。

#### 验收标准

1. WHEN 单元格文本宽度超过单元格宽度且 wrapText 为 false, THE SpreadsheetRenderer SHALL 检查右侧相邻单元格是否为空
2. WHILE 右侧相邻单元格为空, THE SpreadsheetRenderer SHALL 将文本绘制区域扩展到该空单元格，直到文本完全显示或遇到非空单元格
3. WHEN 右侧相邻单元格包含内容, THE SpreadsheetRenderer SHALL 在当前单元格边界处裁剪文本显示
4. WHEN 溢出区域内的空单元格被输入内容, THE SpreadsheetRenderer SHALL 立即收回溢出显示，将原单元格文本裁剪到自身宽度内
5. THE SpreadsheetRenderer SHALL 仅对水平对齐方式为 left 的单元格启用向右溢出显示
