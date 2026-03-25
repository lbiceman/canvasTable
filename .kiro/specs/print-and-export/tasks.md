# 实现计划：打印与导出

## 概述

基于 MVC 架构，在 `src/print-export/` 目录下新建打印导出模块。CSV 导出纯手写零依赖，XLSX 使用 ExcelJS，PDF 使用 jsPDF。打印预览使用浏览器原生 `window.print()`。所有导出器/导入器通过 DataManager 集成到主应用。

## 任务

- [x] 1. 创建打印导出模块基础结构与类型定义
  - [x] 1.1 创建 `src/print-export/types.ts`，定义所有打印导出相关类型
    - 包含 PaperSize、Orientation、PageMargins、PageConfigData、CellRange、HeaderFooterSection、HeaderFooterData、HeaderFooterContext、PageBreakResult、PageData、CsvExportOptions、ImportResult 等类型
    - 包含 PAPER_DIMENSIONS 常量映射
    - _需求：1.2, 1.3, 1.4, 2.1, 3.1, 3.2, 6.5_

- [x] 2. 实现 PageConfig 页面配置模块
  - [x] 2.1 创建 `src/print-export/page-config.ts`，实现 PageConfig 类
    - 实现 `getContentArea()` 方法：根据纸张大小、方向和边距计算可用打印区域
    - 实现 `calculatePageBreaks()` 方法：根据行高/列宽计算分页断点
    - 实现边距值钳制逻辑（0-100 范围）
    - 实现 `serialize()` / `deserialize()` 序列化方法
    - _需求：1.2, 1.3, 1.4, 1.5, 7.3_
  - [ ]* 2.2 编写 PageConfig 属性测试 `src/__tests__/print-export/page-config.pbt.test.ts`
    - **属性 1：方向切换交换内容区域尺寸**
    - **验证需求：1.3**
  - [ ]* 2.3 编写 PageConfig 属性测试（边距钳制）
    - **属性 2：边距值约束在有效范围内**
    - **验证需求：1.4**
  - [ ]* 2.4 编写 PageConfig 属性测试（分页计算）
    - **属性 14：分页计算与页面配置一致性**
    - **验证需求：7.3, 1.3**
  - [ ]* 2.5 编写 PageConfig 单元测试 `src/__tests__/print-export/page-config.test.ts`
    - 测试各纸张尺寸的精确数值
    - 测试边距边界值 0 和 100
    - _需求：1.2, 1.3, 1.4_

- [x] 3. 实现 PrintArea 打印区域管理模块
  - [x] 3.1 创建 `src/print-export/print-area.ts`，实现 PrintArea 类
    - 实现 `set()` / `clear()` / `isSet()` 方法
    - 实现 `getEffectiveRange()` 方法：未设置时自动检测数据范围
    - 实现 `serialize()` / `deserialize()` 序列化方法
    - _需求：2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 3.2 编写 PrintArea 属性测试 `src/__tests__/print-export/print-area.pbt.test.ts`
    - **属性 3：打印区域设置/获取一致性**
    - **验证需求：2.1, 2.2**
  - [ ]* 3.3 编写 PrintArea 属性测试（清除恢复）
    - **属性 4：打印区域设置后清除恢复默认**
    - **验证需求：2.3**
  - [ ]* 3.4 编写 PrintArea 属性测试（默认数据范围）
    - **属性 5：默认打印范围覆盖所有数据单元格**
    - **验证需求：2.4**
  - [ ]* 3.5 编写 PrintArea 属性测试（序列化往返）
    - **属性 6：打印区域序列化往返一致性**
    - **验证需求：2.5**
  - [ ]* 3.6 编写 PrintArea 单元测试 `src/__tests__/print-export/print-area.test.ts`
    - 测试空模型的默认范围、单单元格打印区域
    - _需求：2.1, 2.3, 2.4_

- [x] 4. 实现 HeaderFooter 页眉页脚模块
  - [x] 4.1 创建 `src/print-export/header-footer.ts`，实现 HeaderFooter 类
    - 实现 `renderHeader()` / `renderFooter()` 方法：替换 `{page}`、`{pages}`、`{date}`、`{time}`、`{sheetName}` 占位符
    - 实现 `isEmpty()` 方法
    - 实现 `serialize()` / `deserialize()` 序列化方法
    - _需求：3.1, 3.2, 3.3, 3.4_
  - [ ]* 4.2 编写 HeaderFooter 属性测试 `src/__tests__/print-export/header-footer.pbt.test.ts`
    - **属性 7：页眉页脚占位符替换完整性**
    - **验证需求：3.2, 3.3**
  - [ ]* 4.3 编写 HeaderFooter 属性测试（空检测）
    - **属性 8：空页眉页脚检测**
    - **验证需求：3.4**
  - [ ]* 4.4 编写 HeaderFooter 单元测试 `src/__tests__/print-export/header-footer.test.ts`
    - 测试各占位符的具体替换结果、无占位符的透传
    - _需求：3.2, 3.3, 3.4_

- [x] 5. 检查点 - 确保基础模块测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 6. 实现 CsvExporter CSV 导出模块
  - [x] 6.1 创建 `src/print-export/csv-exporter.ts`，实现 CsvExporter 类
    - 实现 `toCsvString()` 方法：将单元格矩阵转换为 CSV 字符串
    - 实现 `escapeField()` 方法：RFC 4180 字段转义（逗号、换行符、双引号）
    - 实现 `getDisplayValue()` 方法：获取格式化后的显示值
    - 实现 `export()` 方法：UTF-8 BOM 编码 + 触发浏览器下载
    - 处理合并单元格：左上角输出内容，其余位置输出空字符串
    - 支持 `usePrintArea` 选项过滤打印区域
    - _需求：6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  - [ ]* 6.2 编写 CsvExporter 属性测试 `src/__tests__/print-export/csv-exporter.pbt.test.ts`
    - **属性 10：CSV 字段转义往返一致性**
    - **验证需求：6.3**
  - [ ]* 6.3 编写 CsvExporter 属性测试（显示值）
    - **属性 11：CSV 导出使用显示值**
    - **验证需求：6.4**
  - [ ]* 6.4 编写 CsvExporter 属性测试（合并单元格）
    - **属性 12：CSV 合并单元格仅在左上角输出**
    - **验证需求：6.7**
  - [ ]* 6.5 编写 CsvExporter 属性测试（打印区域过滤）
    - **属性 13：CSV 打印区域过滤**
    - **验证需求：6.5**
  - [ ]* 6.6 编写 CsvExporter 单元测试 `src/__tests__/print-export/csv-exporter.test.ts`
    - 测试 UTF-8 BOM 前缀、空表格导出、中文内容
    - _需求：6.2, 6.3, 6.4_

- [x] 7. 实现 XlsxExporter XLSX 导出模块
  - [x] 7.1 安装 ExcelJS 依赖并创建 `src/print-export/xlsx-exporter.ts`，实现 XlsxExporter 类
    - 实现 `export()` 方法：遍历所有可见工作表，导出为 .xlsx 文件
    - 实现 `mapCellStyle()` 方法：Cell 样式到 ExcelJS 样式的映射
    - 实现 `mapBorder()` 方法：CellBorder 到 ExcelJS 边框的映射
    - 实现 `mapNumberFormat()` 方法：CellFormat 到 ExcelJS 数字格式的映射
    - 导出内容包括：文本、数值、公式、字体样式、背景色、对齐、边框、合并单元格、行高、列宽、数字格式、自动换行
    - 触发浏览器文件下载，文件名默认 `{工作簿名称}-{日期}.xlsx`
    - 错误处理：捕获异常并通过 Modal.alert() 显示
    - _需求：4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_
  - [ ]* 7.2 编写 XlsxExporter 单元测试 `src/__tests__/print-export/xlsx-exporter.test.ts`
    - 测试各 BorderStyle 映射、颜色格式转换
    - _需求：4.2, 4.3_

- [x] 8. 实现 XlsxImporter XLSX 导入模块
  - [x] 8.1 创建 `src/print-export/xlsx-importer.ts`，实现 XlsxImporter 类
    - 实现 `import()` 方法：从 File 对象解析 .xlsx 文件
    - 实现 `mapStyleToCell()` 方法：ExcelJS 样式到 Cell 属性的反向映射
    - 实现 `mapNumberFormatToCell()` 方法：ExcelJS 数字格式到 CellFormat 的映射
    - 实现 `toWorkbookData()` 方法：将解析结果转换为 WorkbookData 格式
    - 解析内容包括：文本、数值、公式、字体样式、背景色、对齐、边框、合并单元格、行高、列宽、数字格式、多工作表
    - 错误处理：无效文件提示、不支持功能的警告列表
    - _需求：5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_
  - [ ]* 8.2 编写 XlsxImporter 单元测试 `src/__tests__/print-export/xlsx-importer.test.ts`
    - 测试无效文件错误处理、不支持功能的警告
    - _需求：5.8, 5.9_
  - [ ]* 8.3 编写 XLSX 往返属性测试 `src/__tests__/print-export/xlsx-roundtrip.pbt.test.ts`
    - **属性 9：XLSX 导出/导入往返一致性**
    - **验证需求：4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.10, 5.11**

- [x] 9. 检查点 - 确保导出/导入模块测试通过
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 10. 实现 PdfExporter PDF 导出模块
  - [x] 10.1 安装 jsPDF 依赖并创建 `src/print-export/pdf-exporter.ts`，实现 PdfExporter 类
    - 实现 `export()` 方法：使用 PageConfig 设置渲染 PDF 并触发下载
    - 实现 `renderPage()` 方法：渲染单页表格内容（文本、字体样式、背景色、边框、对齐）
    - 实现 `renderHeaderFooter()` 方法：在每页渲染页眉页脚
    - 按 PageConfig 纸张大小和方向分页
    - 支持 PrintArea 过滤
    - 支持中文字符渲染
    - 文件名默认 `{工作簿名称}-{日期}.pdf`
    - 错误处理：库加载失败、字体加载失败、内存不足
    - _需求：7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  - [ ]* 10.2 编写 PdfExporter 单元测试 `src/__tests__/print-export/pdf-exporter.test.ts`
    - 测试页面尺寸设置、中文字体加载
    - _需求：7.1, 7.3, 7.7_

- [x] 11. 实现 PrintPreviewDialog 打印预览对话框
  - [x] 11.1 创建 `src/print-export/print-preview-dialog.ts`，实现 PrintPreviewDialog 类
    - 实现 `open()` / `close()` 方法：全屏模态对话框的显示与关闭
    - 实现页面设置 UI：纸张大小选择、方向切换、边距输入
    - 实现页眉页脚编辑 UI：左/中/右三个文本输入
    - 实现分页预览渲染：显示总页数和当前页码，支持翻页
    - 实现 `refreshPreview()` 方法：参数变更后 500ms 内重新计算分页
    - 实现 `print()` 方法：调用 `window.print()` 执行打印
    - 添加 CSS `@media print` 样式到 `src/style.css`
    - _需求：1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 3.1_

- [x] 12. 集成到 DataManager 和 SpreadsheetApp
  - [x] 12.1 扩展 DataManager，新增导出/导入公共方法
    - 添加 `exportToXlsx()`、`importFromXlsx()`、`exportToCsv()`、`exportToPdf()` 方法
    - 各方法内部实例化对应的导出器/导入器并调用
    - _需求：4.1, 4.8, 5.1, 6.1, 6.6, 7.1, 7.6_
  - [x] 12.2 扩展 SpreadsheetApp，新增工具栏按钮和菜单项
    - 在工具栏添加"打印预览"、"导出 XLSX"、"导出 CSV"、"导出 PDF"按钮
    - 在右键菜单添加"设置打印区域"、"清除打印区域"选项
    - 绑定事件处理：打开打印预览对话框、触发各导出操作、导入 XLSX 文件
    - _需求：1.1, 1.7, 1.8, 2.1, 2.3, 4.1, 5.1, 6.1, 7.1_
  - [x] 12.3 在 `index.html` 工具栏区域添加打印导出相关按钮 HTML 元素
    - 添加打印预览、导出 XLSX、导出 CSV、导出 PDF、导入 XLSX 按钮
    - _需求：1.1, 4.1, 5.1, 6.1, 7.1_
  - [x] 12.4 实现打印配置持久化
    - 在 WorkbookSheetEntry.metadata 中存储 printArea、pageConfig、headerFooter
    - 在 SheetManager 序列化/反序列化时处理打印配置
    - _需求：2.5_

- [x] 13. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点任务用于增量验证，确保每个阶段的代码质量
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界情况
- CSV 导出为纯 TypeScript 实现，零依赖；XLSX 和 PDF 需安装第三方库
