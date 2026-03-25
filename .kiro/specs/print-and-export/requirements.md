# 需求文档：打印与导出

## 简介

为 Canvas Excel（ice-excel）电子表格应用新增打印与导出功能模块。该模块涵盖打印预览与页面设置、自定义打印区域、页眉页脚、XLSX 导出与导入、CSV 导出以及 PDF 导出。所有功能基于现有 MVC 架构（SpreadsheetModel / SpreadsheetRenderer / SpreadsheetApp）和 DataManager 模块扩展实现，保持零运行时依赖的项目约束。

## 术语表

- **Spreadsheet_App**：电子表格应用主控制器，负责用户交互协调
- **Data_Manager**：数据管理模块，负责文件导入/导出与本地存储
- **Print_Preview_Dialog**：打印预览对话框，用于分页预览和页面设置
- **Page_Config**：页面配置对象，包含纸张大小、方向、边距等打印参数
- **Print_Area**：打印区域，用户自定义的待打印单元格范围
- **Header_Footer**：页眉页脚配置，包含左/中/右三个区域的文本内容
- **XLSX_Exporter**：XLSX 导出器，将电子表格数据转换为 .xlsx 文件
- **XLSX_Importer**：XLSX 导入器，解析 .xlsx 文件并加载到电子表格
- **CSV_Exporter**：CSV 导出器，将电子表格数据转换为 .csv 文件
- **PDF_Exporter**：PDF 导出器，将电子表格数据转换为 .pdf 文件
- **WorkbookData**：工作簿序列化格式（v2.0），包含多工作表数据
- **SpreadsheetModel**：电子表格数据模型，管理单元格数据与业务逻辑

## 需求

### 需求 1：打印预览与页面设置

**用户故事：** 作为用户，我希望在打印前预览分页效果并配置页面参数，以便获得符合预期的打印输出。

#### 验收标准

1. WHEN 用户点击"打印预览"按钮, THE Print_Preview_Dialog SHALL 以模态对话框形式展示当前工作表的分页预览视图
2. THE Print_Preview_Dialog SHALL 支持以下纸张大小选项：A4（210×297mm）、A3（297×420mm）、Letter（216×279mm）、Legal（216×356mm）
3. THE Print_Preview_Dialog SHALL 支持纵向和横向两种页面方向设置
4. THE Print_Preview_Dialog SHALL 支持上、下、左、右四个方向的边距设置，边距值以毫米为单位，范围为 0 至 100
5. WHEN 用户修改页面设置参数, THE Print_Preview_Dialog SHALL 在 500ms 内重新计算分页并更新预览视图
6. THE Print_Preview_Dialog SHALL 在预览视图中显示总页数和当前页码
7. WHEN 用户点击"打印"按钮, THE Print_Preview_Dialog SHALL 调用浏览器原生打印功能（window.print）执行打印
8. WHEN 用户点击"取消"按钮, THE Print_Preview_Dialog SHALL 关闭对话框并返回编辑状态

### 需求 2：打印区域设置

**用户故事：** 作为用户，我希望自定义打印范围，以便只打印工作表中需要的部分。

#### 验收标准

1. WHEN 用户选中一个单元格区域并执行"设置打印区域"操作, THE Spreadsheet_App SHALL 将该选区记录为当前工作表的 Print_Area
2. WHILE Print_Area 已设置, THE Print_Preview_Dialog SHALL 仅预览和打印 Print_Area 范围内的单元格
3. WHEN 用户执行"清除打印区域"操作, THE Spreadsheet_App SHALL 移除当前工作表的 Print_Area 设置，恢复为打印全部内容
4. IF 用户未设置 Print_Area, THEN THE Print_Preview_Dialog SHALL 默认打印当前工作表中所有包含数据的单元格区域
5. THE Spreadsheet_App SHALL 将 Print_Area 配置持久化到工作簿数据中，在保存和加载时保留该设置

### 需求 3：页眉页脚

**用户故事：** 作为用户，我希望为打印输出添加页眉和页脚，以便在打印页面上显示标题、页码、日期等信息。

#### 验收标准

1. THE Print_Preview_Dialog SHALL 提供页眉和页脚的编辑界面，每个区域包含左、中、右三个文本输入位置
2. THE Header_Footer SHALL 支持以下占位符变量：`{page}`（当前页码）、`{pages}`（总页数）、`{date}`（当前日期）、`{time}`（当前时间）、`{sheetName}`（工作表名称）
3. WHEN 页眉或页脚包含占位符变量, THE Print_Preview_Dialog SHALL 在预览和打印时将占位符替换为实际值
4. IF 用户未配置页眉页脚内容, THEN THE Print_Preview_Dialog SHALL 不在打印输出中显示页眉页脚区域

### 需求 4：导出为 XLSX 格式

**用户故事：** 作为用户，我希望将电子表格导出为 .xlsx 文件，以便在 Microsoft Excel 中打开和编辑。

#### 验收标准

1. WHEN 用户执行"导出 XLSX"操作, THE XLSX_Exporter SHALL 将当前工作簿的所有可见工作表导出为一个 .xlsx 文件
2. THE XLSX_Exporter SHALL 导出以下单元格属性：文本内容、数值、公式、字体样式（加粗、斜体、下划线、删除线、字号、字体颜色、字体族）、背景色、水平对齐、垂直对齐
3. THE XLSX_Exporter SHALL 导出单元格边框样式，包括线型（实线、虚线、点线、双线）、颜色和宽度
4. THE XLSX_Exporter SHALL 导出合并单元格信息
5. THE XLSX_Exporter SHALL 导出自定义行高和列宽
6. THE XLSX_Exporter SHALL 导出数字格式（货币、百分比、日期、时间等格式模式）
7. THE XLSX_Exporter SHALL 导出自动换行设置
8. WHEN 导出完成, THE XLSX_Exporter SHALL 触发浏览器文件下载，文件名默认为 `{工作簿名称}-{日期}.xlsx`
9. IF 导出过程中发生错误, THEN THE XLSX_Exporter SHALL 向用户显示包含错误原因的提示信息

### 需求 5：导入 XLSX 格式

**用户故事：** 作为用户，我希望导入 .xlsx 文件，以便在 Canvas Excel 中查看和编辑 Excel 文件。

#### 验收标准

1. WHEN 用户选择一个 .xlsx 文件执行导入操作, THE XLSX_Importer SHALL 解析该文件并将数据加载到电子表格中
2. THE XLSX_Importer SHALL 解析以下单元格属性：文本内容、数值、公式字符串、字体样式（加粗、斜体、下划线、删除线、字号、字体颜色、字体族）、背景色、水平对齐、垂直对齐
3. THE XLSX_Importer SHALL 解析单元格边框样式
4. THE XLSX_Importer SHALL 解析合并单元格信息并正确还原合并状态
5. THE XLSX_Importer SHALL 解析自定义行高和列宽
6. THE XLSX_Importer SHALL 解析数字格式并映射到 CellFormat 类型
7. THE XLSX_Importer SHALL 解析多工作表结构，为每个工作表创建对应的 Sheet 标签
8. IF .xlsx 文件格式无效或损坏, THEN THE XLSX_Importer SHALL 向用户显示包含错误原因的提示信息，不修改当前工作簿数据
9. IF .xlsx 文件包含 Canvas Excel 不支持的功能（如 VBA 宏、数据透视表缓存）, THEN THE XLSX_Importer SHALL 跳过不支持的内容并在导入完成后显示警告列表
10. WHEN XLSX 文件导入完成, THE XLSX_Importer SHALL 将解析结果转换为 WorkbookData 格式并通过 SheetManager 加载
11. FOR ALL 有效的 WorkbookData 对象, 导出为 XLSX 后再导入 SHALL 产生等价的 WorkbookData 对象（往返一致性）

### 需求 6：导出为 CSV

**用户故事：** 作为用户，我希望将电子表格导出为 CSV 文件，以便在其他应用程序中使用表格数据。

#### 验收标准

1. WHEN 用户执行"导出 CSV"操作, THE CSV_Exporter SHALL 将当前活动工作表的数据导出为一个 .csv 文件
2. THE CSV_Exporter SHALL 使用 UTF-8 编码（带 BOM），以确保中文内容在 Microsoft Excel 中正确显示
3. THE CSV_Exporter SHALL 使用逗号作为字段分隔符，使用双引号包裹包含逗号、换行符或双引号的字段值
4. THE CSV_Exporter SHALL 导出单元格的显示值（格式化后的文本），而非原始数值
5. WHILE Print_Area 已设置, THE CSV_Exporter SHALL 提供选项让用户选择导出全部数据或仅导出 Print_Area 范围内的数据
6. WHEN 导出完成, THE CSV_Exporter SHALL 触发浏览器文件下载，文件名默认为 `{工作表名称}-{日期}.csv`
7. THE CSV_Exporter SHALL 对合并单元格仅在左上角位置输出内容，其余合并位置输出空字符串

### 需求 7：导出为 PDF

**用户故事：** 作为用户，我希望将电子表格导出为 PDF 文件，以便生成不可编辑的文档用于分享和存档。

#### 验收标准

1. WHEN 用户执行"导出 PDF"操作, THE PDF_Exporter SHALL 使用当前 Page_Config 设置将电子表格渲染为 PDF 文件
2. THE PDF_Exporter SHALL 在 PDF 中保留单元格的文本内容、字体样式、背景色、边框和对齐方式
3. THE PDF_Exporter SHALL 按照 Page_Config 中的纸张大小和方向进行分页
4. WHILE Header_Footer 已配置, THE PDF_Exporter SHALL 在 PDF 每页中渲染页眉和页脚内容
5. WHILE Print_Area 已设置, THE PDF_Exporter SHALL 仅导出 Print_Area 范围内的单元格
6. WHEN 导出完成, THE PDF_Exporter SHALL 触发浏览器文件下载，文件名默认为 `{工作簿名称}-{日期}.pdf`
7. THE PDF_Exporter SHALL 支持中文字符的正确渲染
8. IF 导出过程中发生错误, THEN THE PDF_Exporter SHALL 向用户显示包含错误原因的提示信息
