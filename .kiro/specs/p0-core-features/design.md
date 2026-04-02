# 设计文档：P0 核心缺失功能

## 概述

本设计文档描述 ICE Excel 5 项 P0 核心功能的技术实现方案。所有功能基于现有 MVC 架构（SpreadsheetModel / SpreadsheetRenderer / SpreadsheetApp）实现，不引入新的外部依赖。

## 1. 撤销/重做完整覆盖格式化操作

### 现状分析

经代码审查，`HistoryManager` 已定义所有格式化操作的 `ActionType`（`setFontColor`、`setBgColor`、`setBorder`、`setFontAlign`、`setVerticalAlign`、`setFontSize`、`setFontFamily`、`setStrikethrough`、`setFontBold`、`setFontItalic`、`setFontUnderline`）。`SpreadsheetModel` 中的格式设置方法（如 `setRangeFontColor`、`setRangeBgColor` 等）已调用 `historyManager.record()` 记录操作。`applyAction()` 方法中也已实现所有格式化操作类型的撤销/重做逻辑。

### 问题定位

实际问题在于 `SpreadsheetApp.handleUndo()` 和 `handleRedo()` 调用 `model.undo()` / `model.redo()` 后，仅调用了 `renderer.render()` 和 `updateSelectedCellInfo()`，但未同步更新工具栏按钮状态（如加粗按钮高亮、颜色选择器同步）。此外需要验证所有格式化操作的 `record()` 调用中 `undoData` 是否正确保存了每个单元格的原始值。

### 实现方案

1. 审查并修复所有格式化操作的 `undoData` 记录，确保保存每个单元格的原始属性值（而非仅保存范围和新值）
2. 在 `handleUndo()` 和 `handleRedo()` 中增加工具栏状态同步调用
3. 编写单元测试验证每种格式化操作的撤销/重做正确性

### 涉及文件

- `src/model.ts` — 验证 `applyAction()` 中所有格式化操作分支的完整性
- `src/app.ts` — `handleUndo()` / `handleRedo()` 增加工具栏同步

## 2. 列宽自适应

### 实现方案

在 `SpreadsheetApp.handleDoubleClick()` 中检测双击位置是否在列标题右侧边界（复用现有的 `renderer.getColResizeAtPosition()` 检测逻辑）。命中时调用新方法 `autoFitColumnWidth(colIndex)` 执行自适应。

#### 核心算法

```
autoFitColumnWidth(colIndex):
  1. 创建离屏 Canvas 用于文本测量
  2. 遍历视口范围内该列的所有行
  3. 对每个单元格：
     a. 获取格式化后的显示文本（考虑数字格式、日期格式）
     b. 设置 ctx.font 为单元格的字体属性（fontSize、fontFamily、fontBold）
     c. 调用 ctx.measureText() 获取文本宽度
  4. 取所有单元格的最大宽度 + cellPadding * 2
  5. 限制最小值为 30px
  6. 记录历史（type: 'resizeCol'）
  7. 调用 model.setColWidth() 设置新宽度
```

### 涉及文件

- `src/app.ts` — `handleDoubleClick()` 增加列边界双击检测，新增 `autoFitColumnWidth()` 方法
- `src/renderer.ts` — 提供 `getColResizeAtPosition()` 已有方法（复用）

## 3. 行高自适应完善

### 实现方案

#### 换行文本高度计算

在 `SpreadsheetRenderer` 中新增 `measureCellHeight(row, col)` 方法：

```
measureCellHeight(row, col):
  1. 获取单元格数据和列宽
  2. 如果 wrapText 为 true：
     a. 设置 ctx.font 为单元格字体属性
     b. 按列宽（减去 padding * 2）逐词拆分文本为多行
     c. 行高 = 行数 × (fontSize + lineSpacing)
  3. 如果有 richText：
     a. 遍历每个片段，按各自字体属性测量宽度
     b. 累计宽度超过列宽时换行
     c. 每行高度取该行最大 fontSize
  4. 返回 max(计算高度, DEFAULT_ROW_HEIGHT)
```

#### 双击行边界自适应

在 `handleDoubleClick()` 中检测双击位置是否在行标题下侧边界（复用 `renderer.getRowResizeAtPosition()`），命中时调用 `autoFitRowHeight(rowIndex)`。

### 涉及文件

- `src/renderer.ts` — 新增 `measureCellHeight()` 方法
- `src/app.ts` — `handleDoubleClick()` 增加行边界双击检测，新增 `autoFitRowHeight()` 方法

## 4. 拖拽填充智能序列

### 实现方案

扩展现有 `FillSeriesEngine`，在 `inferPattern()` 中增加序列匹配逻辑。

#### 新增序列定义

```typescript
// 预定义序列表
const KNOWN_SEQUENCES: { pattern: RegExp; values: string[] }[] = [
  // 中文星期（完整）
  { pattern: /^星期[一二三四五六日]$/, values: ['星期一','星期二','星期三','星期四','星期五','星期六','星期日'] },
  // 中文星期（简写）
  { pattern: /^周[一二三四五六日]$/, values: ['周一','周二','周三','周四','周五','周六','周日'] },
  // 中文月份
  { pattern: /^(一|二|三|四|五|六|七|八|九|十|十一|十二)月$/, values: ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'] },
  // 数字月份
  { pattern: /^(1|2|3|4|5|6|7|8|9|10|11|12)月$/, values: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'] },
  // 英文星期（完整）
  { pattern: /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i, values: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] },
  // 英文星期（缩写）
  { pattern: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i, values: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
  // 英文月份（完整）
  { pattern: /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i, values: ['January','February','March','April','May','June','July','August','September','October','November','December'] },
  // 英文月份（缩写）
  { pattern: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i, values: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] },
  // 季度
  { pattern: /^Q[1-4]$/, values: ['Q1','Q2','Q3','Q4'] },
  // 中文季度
  { pattern: /^第[一二三四]季度$/, values: ['第一季度','第二季度','第三季度','第四季度'] },
];
```

#### 推断逻辑修改

```
inferPattern(values):
  1. 检查是否匹配预定义序列（KNOWN_SEQUENCES）
     - 所有值都匹配同一序列 → 返回 sequence 类型
  2. 检查是否为带数字后缀的文本模式
     - 匹配 /^(.+?)(\d+)(.*)$/ → 提取前缀、数字、后缀
     - 返回 textNumber 类型
  3. 原有逻辑：数字 → 日期 → 文本复制
```

#### 新增 FillPattern 类型

在 `types.ts` 中扩展 `FillPattern`：

```typescript
export interface FillPattern {
  type: 'number' | 'date' | 'text' | 'sequence' | 'textNumber';
  step: number;
  values: string[];
  sequenceValues?: string[];  // 预定义序列的完整值列表
  textPrefix?: string;        // 文本+数字模式的前缀
  textSuffix?: string;        // 文本+数字模式的后缀
}
```

### 涉及文件

- `src/fill-series.ts` — 扩展 `inferPattern()` 和 `generate()` 方法
- `src/types.ts` — 扩展 `FillPattern` 接口

## 5. 状态栏统计

### 实现方案

#### 统计计算模块

新增 `SelectionStatistics` 工具类，负责从选区数据中计算统计值：

```typescript
interface SelectionStats {
  sum: number;
  average: number;
  count: number;      // 数值单元格计数
  min: number;
  max: number;
  totalCells: number; // 选区总单元格数
}
```

#### UI 布局

在现有状态栏（`.status-bar`）中新增统计信息区域：

```
[无限滚动 - 按需加载数据] [统计: 求和=XX 平均值=XX 计数=XX 最小值=XX 最大值=XX] [1000行 × 100列]
```

统计区域仅在选中多个单元格且包含数值时显示。

#### 更新时机

在 `SpreadsheetApp` 中，每次选区变更时调用 `updateSelectionStats()`：
- `handleMouseUp()` — 鼠标选择完成
- `handleKeyDown()` — 键盘导航/选择
- `handleMouseDown()` — 点击选择

### 涉及文件

- `src/ui-controls.ts` — 状态栏 DOM 中新增统计信息容器
- `src/app.ts` — 新增 `updateSelectionStats()` 方法，在选区变更时调用
- `src/style.css` — 统计信息区域样式

## 正确性属性

### 属性 1：格式化操作撤销/重做 Round-Trip（需求 1）

**类型：** Round-Trip

**描述：** 对任意格式化操作（背景色、字体色、边框、对齐、字号、字体族、删除线、加粗、斜体、下划线），执行操作后撤销，单元格的所有格式属性应恢复为操作前的值。

**验证方法：**
1. 记录操作前单元格的格式快照
2. 执行格式化操作
3. 执行撤销
4. 比较操作后的格式快照与操作前的快照，应完全一致

### 属性 2：序列填充循环性（需求 4）

**类型：** Invariant

**描述：** 对任意预定义序列（星期、月份等），从序列中任意位置开始填充 N 个值（N = 序列长度的整数倍），生成的值序列应包含完整的循环。

**验证方法：**
1. 选择序列中的任意起始位置
2. 生成序列长度整数倍个值
3. 验证每个序列值出现的次数相等

### 属性 3：统计计算一致性（需求 5）

**类型：** Model-Based Testing

**描述：** 状态栏的 SUM、AVERAGE、COUNT、MIN、MAX 计算结果应与使用标准数学库对相同数据集计算的结果一致。

**验证方法：**
1. 生成随机数值数组
2. 用 SelectionStatistics 计算统计值
3. 用标准 reduce/Math.min/Math.max 计算参考值
4. 比较两组结果，应在浮点精度范围内一致

### 属性 4：列宽自适应撤销 Round-Trip（需求 2）

**类型：** Round-Trip

**描述：** 执行列宽自适应后撤销，列宽应恢复为自适应前的值。

### 属性 5：填充方向对称性（需求 4）

**类型：** Metamorphic

**描述：** 从序列中间位置向右填充 N 个值，与从该位置向左填充 N 个值，两组结果合并后应覆盖序列中连续的 2N+1 个位置。
