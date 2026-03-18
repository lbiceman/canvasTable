# 技术设计文档：数据类型与格式化

## 概述

本设计为 Canvas Excel 添加完整的数据类型识别与格式化系统。核心思路是引入格式化引擎层（Formatter Layer），位于 Model 和 Renderer 之间，负责将原始数据转换为格式化显示字符串。同时扩展 Cell 接口以支持数据类型、格式模式、富文本、换行和验证规则等新属性。

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────┐
│                   SpreadsheetApp                     │
│              (事件处理、UI 交互协调)                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ FormatEngine  │  │ Validator    │  │ TypeDetector│ │
│  │ (格式化引擎)  │  │ (数据验证)   │  │ (类型识别)  │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │                 │        │
├─────────┴─────────────────┴─────────────────┴────────┤
│                   SpreadsheetModel                    │
│           (Cell 数据、rawValue、dataType)              │
├─────────────────────────────────────────────────────┤
│                  SpreadsheetRenderer                  │
│     (格式化显示、条件格式渲染、富文本绘制、溢出处理)      │
└─────────────────────────────────────────────────────┘
```

### 新增文件结构

```
src/
├── format-engine.ts        # NumberFormatter + DateFormatter 格式化引擎
├── type-detector.ts        # DataTypeDetector 数据类型自动识别
├── conditional-format.ts   # ConditionalFormatEngine 条件格式引擎
├── validation.ts           # ValidationEngine 数据验证引擎
├── types.ts                # 扩展 Cell 接口 + 新增类型定义
```

不新增独立的富文本编辑器文件，富文本相关逻辑分散在 `types.ts`（数据结构）、`renderer.ts`（绘制）和 `inline-editor.ts`（编辑交互）中。

---

## 数据模型设计

### 扩展 Cell 接口

```typescript
// types.ts 中扩展

// 数据类型枚举
type DataType = 'text' | 'number' | 'date' | 'percentage' | 'currency';

// 格式类别枚举
type FormatCategory = 'general' | 'number' | 'currency' | 'percentage' | 'scientific' | 'date' | 'time' | 'datetime' | 'custom';

// 单元格格式信息
interface CellFormat {
  category: FormatCategory;
  pattern: string;          // 格式模式字符串，如 "#,##0.00"、"yyyy-MM-dd"
  currencySymbol?: string;  // 货币符号，如 "¥"、"$"
}

// 富文本片段
interface RichTextSegment {
  text: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontColor?: string;
  fontSize?: number;
}

// 条件格式规则
interface ConditionalFormatRule {
  id: string;
  range: { startRow: number; startCol: number; endRow: number; endCol: number };
  priority: number;
  condition: ConditionalFormatCondition;
  style: ConditionalFormatStyle;
}

// 条件格式条件
type ConditionalFormatCondition =
  | { type: 'greaterThan'; value: number }
  | { type: 'lessThan'; value: number }
  | { type: 'equals'; value: number | string }
  | { type: 'between'; min: number; max: number }
  | { type: 'textContains'; text: string }
  | { type: 'textStartsWith'; text: string }
  | { type: 'textEndsWith'; text: string }
  | { type: 'dataBar'; minValue?: number; maxValue?: number; color: string }
  | { type: 'colorScale'; minColor: string; midColor?: string; maxColor: string }
  | { type: 'iconSet'; iconType: 'arrows' | 'circles' | 'flags'; thresholds: number[] };

// 条件格式样式
interface ConditionalFormatStyle {
  fontColor?: string;
  bgColor?: string;
}

// 数据验证规则
interface ValidationRule {
  type: 'dropdown' | 'numberRange' | 'textLength' | 'custom';
  mode: 'block' | 'warning';
  options?: string[];              // dropdown 选项列表
  min?: number;                    // 数值/文本长度最小值
  max?: number;                    // 数值/文本长度最大值
  customExpression?: string;       // 自定义验证表达式
  inputTitle?: string;             // 输入提示标题
  inputMessage?: string;           // 输入提示内容
  errorTitle?: string;             // 错误提示标题
  errorMessage?: string;           // 错误提示内容
}

// 扩展后的 Cell 接口
interface Cell {
  // === 现有字段 ===
  content: string;
  formulaContent?: string;
  rowSpan: number;
  colSpan: number;
  isMerged: boolean;
  mergeParent?: { row: number; col: number };
  fontColor?: string;
  bgColor?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';

  // === 新增字段 ===
  dataType?: DataType;             // 数据类型
  rawValue?: number;               // 原始数值（数字/日期/百分比/货币的实际值）
  format?: CellFormat;             // 格式信息
  richText?: RichTextSegment[];    // 富文本内容
  wrapText?: boolean;              // 是否自动换行
  validation?: ValidationRule;     // 数据验证规则
}
```

### 设计决策：rawValue 存储策略

- 数字类型：`rawValue` 存储原始数值（如 `1234.56`）
- 百分比类型：`rawValue` 存储小数值（如 `0.12` 表示 12%）
- 货币类型：`rawValue` 存储纯数值（如 `1234.56`，不含货币符号）
- 日期类型：`rawValue` 存储 Unix 时间戳毫秒数（如 `1705276800000` 表示 2024-01-15）
- 文本类型：不使用 `rawValue`，`content` 即为原始值

`content` 字段保持为格式化后的显示字符串，确保向后兼容。公式计算结果也存入 `rawValue`，`content` 存格式化后的显示值。

---

## 模块详细设计

### 1. 格式化引擎 (`format-engine.ts`)

```typescript
// 数字格式化器
class NumberFormatter {
  // 按格式模式格式化数值
  static format(value: number, pattern: string): string;
  // 将格式化字符串解析回数值
  static parse(text: string, pattern: string): number | null;
  // 内置快捷格式化
  static formatCurrency(value: number, symbol?: string): string;
  static formatPercentage(value: number, decimals?: number): string;
  static formatThousands(value: number, decimals?: number): string;
  static formatScientific(value: number, decimals?: number): string;
}

// 日期格式化器
class DateFormatter {
  // 按格式模式格式化日期
  static format(timestamp: number, pattern: string): string;
  // 将日期字符串解析为时间戳
  static parse(text: string, pattern: string): number | null;
  // 尝试多种模式自动解析
  static autoParse(text: string): number | null;
}
```

格式模式解析采用状态机方式逐字符处理，支持 Excel 兼容的 `#,##0.00` 语法。

数字格式化核心算法：
1. 解析 pattern 为 `{ integerPart, decimalPart, useThousands, prefix, suffix }` 结构
2. 将数值拆分为整数部分和小数部分
3. 按 `0` 和 `#` 占位符规则填充数字位
4. 插入千分位分隔符（如果 pattern 包含 `,`）
5. 拼接前缀/后缀（如 `¥`、`%`）

日期格式化核心算法：
1. 将时间戳转换为 Date 对象
2. 提取年、月、日、时、分、秒
3. 按 pattern 中的占位符（`yyyy`、`MM`、`dd`、`HH`、`mm`、`ss`）替换为对应值
4. 处理 12 小时制（`hh` + `A`/`a`）

### 2. 数据类型检测器 (`type-detector.ts`)

```typescript
interface DetectionResult {
  dataType: DataType;
  rawValue?: number;
  format?: CellFormat;
}

class DataTypeDetector {
  // 自动检测输入内容的数据类型
  static detect(input: string): DetectionResult;
}
```

检测优先级（从高到低）：
1. 空字符串 → `text`
2. 以 `=` 开头 → 跳过（公式由 FormulaEngine 处理）
3. 百分比匹配：`/^-?\d+(\.\d+)?%$/` → `percentage`
4. 货币匹配：`/^[¥$€£]\s?-?\d+(,\d{3})*(\.\d+)?$/` → `currency`
5. 日期匹配：尝试 `DateFormatter.autoParse()` → `date`
6. 纯数字匹配：`/^-?\d+(,\d{3})*(\.\d+)?$/`（去除千分位后）→ `number`
7. 以上均不匹配 → `text`

### 3. 条件格式引擎 (`conditional-format.ts`)

```typescript
class ConditionalFormatEngine {
  private rules: ConditionalFormatRule[] = [];

  // 添加条件格式规则
  addRule(rule: ConditionalFormatRule): void;
  // 移除规则
  removeRule(ruleId: string): void;
  // 评估单元格的条件格式，返回应用的样式
  evaluate(row: number, col: number, cell: Cell): ConditionalFormatResult | null;
  // 获取数据条渲染参数
  getDataBarParams(row: number, col: number, cell: Cell, rule: ConditionalFormatRule): DataBarParams | null;
  // 获取色阶颜色
  getColorScaleColor(row: number, col: number, cell: Cell, rule: ConditionalFormatRule): string | null;
  // 获取图标集图标
  getIconSetIcon(row: number, col: number, cell: Cell, rule: ConditionalFormatRule): IconInfo | null;
}

interface ConditionalFormatResult {
  fontColor?: string;
  bgColor?: string;
  dataBar?: DataBarParams;
  icon?: IconInfo;
}

interface DataBarParams {
  percentage: number;  // 0-1 之间的填充比例
  color: string;
}

interface IconInfo {
  type: 'arrows' | 'circles' | 'flags';
  index: number;  // 图标索引（0=最差, 1=中等, 2=最好）
}
```

条件格式规则存储在 `SpreadsheetModel` 中（新增 `conditionalFormats: ConditionalFormatRule[]` 字段），而非存储在每个 Cell 上，因为条件格式通常应用于区域范围。

评估流程：
1. 收集覆盖该单元格的所有规则
2. 按 `priority` 排序（数值越小优先级越高）
3. 逐条评估条件，返回第一条匹配的结果

### 4. 数据验证引擎 (`validation.ts`)

```typescript
interface ValidationResult {
  valid: boolean;
  errorTitle?: string;
  errorMessage?: string;
}

class ValidationEngine {
  // 验证单元格输入值
  static validate(value: string, rule: ValidationRule): ValidationResult;
  // 获取下拉列表选项
  static getDropdownOptions(rule: ValidationRule): string[];
}
```

验证在 `SpreadsheetModel.setCellContent()` 中触发，在内容实际写入之前执行。验证规则存储在 Cell 的 `validation` 字段中。

### 5. 渲染器增强 (`renderer.ts` 修改)

#### renderCells 方法修改要点

```
renderCells() {
  for each visible cell:
    1. 获取 cellInfo（现有逻辑）
    2. 【新增】评估条件格式 → 覆盖 fontColor/bgColor
    3. 【新增】绘制数据条背景（如果有）
    4. 绘制背景色（现有逻辑，可能被条件格式覆盖）
    5. 【新增】确定显示文本：
       - 如果有 richText → 使用富文本渲染路径
       - 如果有 format + rawValue → 调用 FormatEngine 获取显示字符串
       - 否则 → 使用 content（现有逻辑）
    6. 【新增】文本换行处理：
       - 如果 wrapText=true → 按单元格宽度分行
       - 如果包含 \n → 按换行符分行
       - 多行文本按 verticalAlign 定位
    7. 【新增】文本溢出处理：
       - 如果文本超宽且 wrapText=false 且 fontAlign='left'
       - 检查右侧相邻单元格是否为空
       - 扩展绘制区域
    8. 绘制文本（现有逻辑，增强为支持多行/富文本/溢出）
    9. 【新增】绘制条件格式图标（如果有）
    10.【新增】绘制下拉箭头（如果有 dropdown 验证）
}
```

#### 富文本渲染

```typescript
// 在 renderer.ts 中新增私有方法
private renderRichText(
  segments: RichTextSegment[],
  x: number, y: number,
  maxWidth: number, height: number,
  defaultFontSize: number, fontFamily: string,
  verticalAlign: string
): void {
  // 逐段测量宽度，计算总宽度
  // 根据 textAlign 计算起始 X
  // 逐段设置字体样式并绘制
  // 处理下划线
}
```

#### 多行文本渲染

```typescript
// 在 renderer.ts 中新增私有方法
private renderWrappedText(
  text: string,
  x: number, y: number,
  cellWidth: number, cellHeight: number,
  fontSize: number, fontFamily: string,
  align: string, verticalAlign: string
): void {
  // 1. 按 \n 分割为段落
  // 2. 每段按单元格宽度进行自动换行（逐词/逐字测量）
  // 3. 计算总行数和总高度
  // 4. 根据 verticalAlign 计算起始 Y
  // 5. 逐行绘制
}
```

#### 文本溢出渲染

```typescript
// 在 renderer.ts 中新增私有方法
private calculateOverflowWidth(
  row: number, col: number, textWidth: number, cellWidth: number
): number {
  // 从 col+1 开始检查右侧单元格
  // 如果为空，累加其宽度到可用宽度
  // 直到文本完全容纳或遇到非空单元格
  // 返回扩展后的总可用宽度
}
```

### 6. Model 层修改 (`model.ts`)

#### setCellContent 修改

在现有 `setCellContent` 方法中，非公式内容写入后增加类型检测步骤：

```typescript
// 在 setCellContent 中，非公式分支末尾添加：
if (!cell.format) {
  // 仅在未手动设置格式时执行自动检测
  const detection = DataTypeDetector.detect(content);
  cell.dataType = detection.dataType;
  cell.rawValue = detection.rawValue;
  if (detection.format) {
    cell.format = detection.format;
  }
}
```

#### 新增格式设置方法

```typescript
// 设置单元格格式
public setCellFormat(row: number, col: number, format: CellFormat): void;
public setRangeFormat(startRow: number, startCol: number, endRow: number, endCol: number, format: CellFormat): void;

// 设置换行
public setCellWrapText(row: number, col: number, wrap: boolean): void;
public setRangeWrapText(startRow: number, startCol: number, endRow: number, endCol: number, wrap: boolean): void;

// 设置富文本
public setCellRichText(row: number, col: number, richText: RichTextSegment[]): void;

// 设置验证规则
public setCellValidation(row: number, col: number, rule: ValidationRule | undefined): void;

// 自动调整行高（换行模式下）
public autoFitRowHeight(row: number): void;
```

#### 行高自动调整

当 `wrapText=true` 的单元格内容变化时，需要重新计算该行的最佳行高：

```typescript
public autoFitRowHeight(row: number): void {
  // 1. 遍历该行所有单元格
  // 2. 对每个 wrapText=true 的单元格，计算换行后的文本高度
  // 3. 取所有单元格所需高度的最大值
  // 4. 如果大于当前行高，更新行高
  // 注意：需要创建临时 Canvas 上下文来测量文本
}
```

### 7. InlineEditor 增强 (`inline-editor.ts`)

#### 富文本编辑支持

将 `<input>` 替换为 `contenteditable` 的 `<div>`（仅在富文本模式下）：

```typescript
// 新增属性
private richTextMode: boolean = false;
private richTextEditor: HTMLDivElement | null = null;

// 新增方法
public showRichText(x, y, width, height, segments: RichTextSegment[], row, col, callback): void;
public applyStyleToSelection(style: Partial<RichTextSegment>): void;
public getRichTextSegments(): RichTextSegment[];
```

#### Alt+Enter 换行支持

在现有 `keydown` 事件监听中添加：

```typescript
if (event.key === 'Enter' && event.altKey) {
  event.preventDefault();
  // 在光标位置插入 \n
  // 不触发保存
}
```

### 8. 历史记录扩展 (`history-manager.ts`)

新增 ActionType：

```typescript
type ActionType =
  | ... // 现有类型
  | 'setFormat'
  | 'setWrapText'
  | 'setRichText'
  | 'setValidation'
  | 'setConditionalFormat';
```

### 9. 协同编辑扩展 (`collaboration/types.ts`)

新增操作类型：

```typescript
type OperationType =
  | ... // 现有类型
  | 'setFormat'
  | 'setWrapText'
  | 'setRichText'
  | 'setValidation';

interface SetFormatOp extends BaseOperation {
  type: 'setFormat';
  row: number;
  col: number;
  format: CellFormat;
}

interface SetWrapTextOp extends BaseOperation {
  type: 'setWrapText';
  row: number;
  col: number;
  wrapText: boolean;
}
```

### 10. 数据持久化兼容 (`model.ts` 导入/导出)

#### exportToJSON 修改

在现有的单元格序列化中，增加新字段的输出：

```typescript
// 在 exportToJSON 的单元格序列化部分添加：
if (cell.dataType) cellData.dataType = cell.dataType;
if (cell.rawValue !== undefined) cellData.rawValue = cell.rawValue;
if (cell.format) cellData.format = cell.format;
if (cell.richText) cellData.richText = cell.richText;
if (cell.wrapText) cellData.wrapText = cell.wrapText;
if (cell.validation) cellData.validation = cell.validation;
```

#### importFromJSON 修改

在现有的单元格反序列化中，增加新字段的读取。旧格式文件（不含新字段）自动兼容，新字段默认为 `undefined`。

同时在 `SpreadsheetData` 级别增加 `conditionalFormats` 数组的序列化/反序列化。

---

## UI 交互设计

### 工具栏新增控件

在现有工具栏中添加：

1. 数字格式下拉菜单（位于字号选择器右侧）
   - 常规、数字、货币、百分比、科学计数法、日期、时间、自定义
2. 换行按钮（位于垂直对齐按钮右侧）
   - 切换 wrapText 属性
3. 条件格式按钮（新增工具栏区域）
   - 打开条件格式设置面板
4. 数据验证按钮（新增工具栏区域）
   - 打开验证规则设置面板

### 下拉菜单交互

当单元格有 dropdown 验证时：
1. 渲染器在单元格右侧绘制 ▼ 图标
2. 点击图标或双击单元格时，显示 DOM 下拉菜单
3. 选择选项后写入单元格并关闭菜单

### 验证错误提示

使用绝对定位的 DOM 元素（tooltip），在单元格附近显示：
- 输入提示：选中单元格时显示，浅蓝色背景
- 错误提示：验证失败时显示，浅红色背景

---

## 性能考虑

1. 格式化缓存：`FormatEngine` 对相同 `(rawValue, pattern)` 组合缓存格式化结果，避免每帧重复计算
2. 条件格式评估缓存：仅在单元格值变化时重新评估，结果缓存到渲染周期
3. 文本换行缓存：换行计算结果（行数组）缓存在 Cell 级别，仅在内容或列宽变化时重新计算
4. 溢出计算：仅对可见区域内的单元格计算溢出，不影响虚拟滚动性能
5. 富文本段落测量：使用离屏 Canvas 预测量文本宽度，避免主 Canvas 状态切换

---

## 向后兼容性

1. Cell 接口所有新增字段均为可选（`?`），现有数据无需迁移
2. 旧 JSON 文件导入时，新字段自动为 `undefined`，行为与当前完全一致
3. `content` 字段保持为显示字符串，现有渲染逻辑在无 `rawValue`/`format` 时不受影响
4. 条件格式规则数组默认为空，不影响现有渲染性能
5. 协同编辑新增操作类型，旧客户端收到未知类型时忽略（需在 OTTransformer 中添加 fallback）
