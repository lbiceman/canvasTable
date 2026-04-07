# P3 数据能力 — 设计文档

## 技术方案

### 1. XLSX 导入兼容性增强

**现状分析**：`xlsx-importer.ts` 已支持基础导入（单元格值、字体、背景色、对齐、边框、合并单元格、数字格式）。缺失条件格式导入。

**方案**：在 `XlsxImporter` 中新增 `parseConditionalFormats()` 方法，从 ExcelJS worksheet 中提取条件格式规则，转换为 `ConditionalFormatRule[]` 格式，写入 WorkbookData 的 metadata 中。

**关键映射**：
- ExcelJS `worksheet.conditionalFormattings` → `ConditionalFormatRule[]`
- ExcelJS 条件类型 → ice-excel 条件类型（greaterThan/lessThan/between/equals/textContains 等）

### 2. XLSX 导出兼容性增强

**现状分析**：`xlsx-exporter.ts` 已支持基础导出。缺失条件格式导出。

**方案**：在 `XlsxExporter` 中新增 `exportConditionalFormats()` 方法，将 `ConditionalFormatRule[]` 转换为 ExcelJS 条件格式 API 调用。

### 3. 大文件流式导入

**方案**：创建 `XlsxStreamImporter` 类，使用分块处理策略：
1. 使用 ExcelJS 的流式读取 API（`workbook.xlsx.load` 支持 ArrayBuffer）
2. 解析后按行分块处理（每块 1000 行），使用 `setTimeout(0)` 让出主线程
3. 显示进度条 UI（模态框 + 进度百分比）
4. 支持取消操作

**文件**：`src/print-export/xlsx-stream-importer.ts`

### 4. CSV 编码检测

**方案**：创建 `EncodingDetector` 类，基于字节特征检测编码：
1. UTF-8 BOM 检测（EF BB BF）
2. UTF-8 有效性验证（多字节序列规则）
3. GBK 字节范围检测（首字节 0x81-0xFE，次字节 0x40-0xFE）
4. Shift-JIS 字节范围检测（首字节 0x81-0x9F/0xE0-0xEF）
5. 使用 TextDecoder API 解码

**文件**：`src/print-export/encoding-detector.ts`

在 `DataManager` 中新增 `importFromCsv()` 方法，支持 `.csv` 文件导入。

### 5. 数据透视表补全

**现状分析**：`PivotTable` 引擎和 `PivotTablePanel` UI 已基本完整，支持：
- 源数据验证、字段提取
- 行字段/列字段/值字段/筛选字段配置
- 5 种聚合方式（sum/count/average/max/min）
- 小计行和总计行
- 拖拽配置 UI、预览表格、写入工作表

**需补全**：
- 结果排序功能（按行标签或聚合值升序/降序）
- 排序 UI 控件

## 文件变更清单

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/print-export/xlsx-stream-importer.ts` | 大文件流式导入器 |
| `src/print-export/encoding-detector.ts` | CSV 编码检测器 |

### 修改文件
| 文件 | 变更内容 |
|------|----------|
| `src/print-export/xlsx-importer.ts` | 新增条件格式导入 |
| `src/print-export/xlsx-exporter.ts` | 新增条件格式导出 |
| `src/data-manager.ts` | 新增 CSV 导入方法、大文件导入方法 |
| `src/pivot-table/pivot-table.ts` | 新增排序功能 |
| `src/pivot-table/pivot-table-panel.ts` | 新增排序 UI |
| `src/print-export/types.ts` | 新增 CSV 导入相关类型 |

### 不修改的文件
- `src/types.ts` — 已有类型定义足够
- `src/model.ts` — 不修改核心数据模型
- `src/app.ts` — 仅在需要时添加 CSV 导入入口
