# 需求文档：P0 核心缺失功能

## 简介

本文档定义 ICE Excel 电子表格应用的 5 项 P0 核心功能需求。这些功能是用户对电子表格应用的基本预期，缺失将严重影响产品可用性。功能包括：撤销/重做完整覆盖、列宽自适应、行高自适应、拖拽填充智能序列、状态栏统计。

## 术语表

- **SpreadsheetApp**：应用控制器，负责用户交互事件处理和模块协调
- **SpreadsheetModel**：数据模型层，管理单元格数据、格式属性和历史记录
- **SpreadsheetRenderer**：Canvas 渲染器，负责视口计算和画面绘制
- **HistoryManager**：历史记录管理器，维护撤销/重做操作栈
- **FillSeriesEngine**：填充序列引擎，负责推断填充模式并生成序列数据
- **StatusBar**：状态栏组件，位于应用底部，显示统计信息
- **Selection**：选区，用户当前选中的单元格范围
- **CellFormat**：单元格格式属性的集合，包括字体颜色、背景色、边框、对齐方式、字号、字体族、删除线等

## 需求

### 需求 1：撤销/重做完整覆盖格式化操作

**用户故事：** 作为电子表格用户，我希望对所有格式化操作执行撤销和重做，以便在修改格式后能恢复到之前的状态。

#### 验收标准

1. WHEN 用户对选区执行背景色设置后按 Ctrl+Z，THE SpreadsheetModel SHALL 将选区内所有单元格的背景色恢复为操作前的值
2. WHEN 用户对选区执行字体颜色设置后按 Ctrl+Z，THE SpreadsheetModel SHALL 将选区内所有单元格的字体颜色恢复为操作前的值
3. WHEN 用户对选区执行边框设置后按 Ctrl+Z，THE SpreadsheetModel SHALL 将选区内所有单元格的边框配置恢复为操作前的值
4. WHEN 用户对选区执行对齐方式设置后按 Ctrl+Z，THE SpreadsheetModel SHALL 将选区内所有单元格的水平对齐和垂直对齐恢复为操作前的值
5. WHEN 用户对选区执行字号设置后按 Ctrl+Z，THE SpreadsheetModel SHALL 将选区内所有单元格的字号恢复为操作前的值
6. WHEN 用户对选区执行字体族设置后按 Ctrl+Z，THE SpreadsheetModel SHALL 将选区内所有单元格的字体族恢复为操作前的值
7. WHEN 用户对选区执行删除线设置后按 Ctrl+Z，THE SpreadsheetModel SHALL 将选区内所有单元格的删除线状态恢复为操作前的值
8. WHEN 用户对选区执行加粗/斜体/下划线设置后按 Ctrl+Z，THE SpreadsheetModel SHALL 将选区内所有单元格的对应属性恢复为操作前的值
9. WHEN 用户撤销格式化操作后按 Ctrl+Y，THE SpreadsheetModel SHALL 重新应用该格式化操作
10. WHEN 用户连续执行多次格式化操作后多次按 Ctrl+Z，THE SpreadsheetModel SHALL 按操作的逆序逐一撤销每次格式化操作


### 需求 2：列宽自适应

**用户故事：** 作为电子表格用户，我希望双击列边界时列宽自动调整到内容最大宽度，以便快速查看被截断的单元格内容。

#### 验收标准

1. WHEN 用户双击列标题右侧边界，THE SpreadsheetRenderer SHALL 计算该列所有可见行中单元格内容的最大渲染宽度
2. WHEN 用户双击列标题右侧边界，THE SpreadsheetModel SHALL 将该列宽度设置为最大内容宽度加上单元格内边距的两倍
3. THE SpreadsheetModel SHALL 将列宽自适应的最小值限制为 30 像素
4. WHEN 列宽自适应操作完成后，THE SpreadsheetRenderer SHALL 立即重新渲染画布以反映新的列宽
5. WHEN 用户对自适应后的列宽按 Ctrl+Z，THE SpreadsheetModel SHALL 将列宽恢复为自适应前的值
6. WHEN 计算最大内容宽度时，THE SpreadsheetRenderer SHALL 考虑单元格的字体大小、字体族、加粗状态和格式化后的显示文本

### 需求 3：行高自适应完善

**用户故事：** 作为电子表格用户，我希望启用自动换行的单元格能自动计算行高，以便完整显示多行文本内容。

#### 验收标准

1. WHEN 单元格设置了 wrapText 属性且内容超过列宽，THE SpreadsheetRenderer SHALL 按列宽将文本拆分为多行并计算所需的总高度
2. WHEN 单元格包含富文本内容（richText 数组），THE SpreadsheetRenderer SHALL 根据各片段的字体大小计算换行后的总高度
3. WHEN 用户双击行标题下侧边界，THE SpreadsheetModel SHALL 将该行高度设置为该行所有单元格中所需最大高度
4. THE SpreadsheetModel SHALL 将行高自适应的最小值限制为默认行高（25 像素）
5. WHEN 行高自适应操作完成后，THE SpreadsheetRenderer SHALL 立即重新渲染画布以反映新的行高
6. WHEN 用户对自适应后的行高按 Ctrl+Z，THE SpreadsheetModel SHALL 将行高恢复为自适应前的值

### 需求 4：拖拽填充智能序列

**用户故事：** 作为电子表格用户，我希望拖拽填充柄时能自动识别并延续日期序列、星期序列和自定义序列，以便快速生成有规律的数据。

#### 验收标准

1. WHEN 源单元格包含星期文本（如"星期一"或"周一"），THE FillSeriesEngine SHALL 按星期顺序循环生成后续值
2. WHEN 源单元格包含中文月份文本（如"一月"或"1月"），THE FillSeriesEngine SHALL 按月份顺序循环生成后续值
3. WHEN 源单元格包含英文星期缩写（如"Mon"或"Monday"），THE FillSeriesEngine SHALL 按英文星期顺序循环生成后续值
4. WHEN 源单元格包含英文月份缩写（如"Jan"或"January"），THE FillSeriesEngine SHALL 按英文月份顺序循环生成后续值
5. WHEN 源单元格包含带数字后缀的文本（如"第1季度"），THE FillSeriesEngine SHALL 保持文本前缀不变并递增数字部分
6. WHEN 填充方向为向上或向左时，THE FillSeriesEngine SHALL 按序列的逆序生成值
7. WHEN 源数据不匹配任何已知序列模式时，THE FillSeriesEngine SHALL 回退到现有的文本循环复制模式
8. FOR ALL 已知序列类型，填充到序列末尾后 THE FillSeriesEngine SHALL 从序列起始位置循环继续

### 需求 5：状态栏统计

**用户故事：** 作为电子表格用户，我希望选中区域时底部状态栏显示常用统计值，以便快速了解数据概况而无需编写公式。

#### 验收标准

1. WHEN 用户选中包含数值的多个单元格，THE StatusBar SHALL 显示选区的 SUM（求和）值
2. WHEN 用户选中包含数值的多个单元格，THE StatusBar SHALL 显示选区的 AVERAGE（平均值）
3. WHEN 用户选中包含数值的多个单元格，THE StatusBar SHALL 显示选区的 COUNT（数值计数）
4. WHEN 用户选中包含数值的多个单元格，THE StatusBar SHALL 显示选区的 MIN（最小值）和 MAX（最大值）
5. WHEN 选区内所有单元格均为空或非数值文本，THE StatusBar SHALL 仅显示 COUNT: 0 而隐藏 SUM、AVERAGE、MIN、MAX
6. WHEN 用户取消选区或仅选中单个单元格，THE StatusBar SHALL 隐藏统计信息区域
7. THE StatusBar SHALL 在每次选区变更后 16 毫秒内完成统计计算和显示更新
8. WHEN 计算统计值时，THE StatusBar SHALL 忽略空单元格和纯文本单元格，仅统计可解析为数值的单元格
