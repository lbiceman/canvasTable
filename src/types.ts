// ============================================================
// 图表类型导入与重新导出
// ============================================================

import type { SparklineConfig, ChartConfig } from './chart/types';
export type { SparklineConfig, ChartConfig };

// ============================================================
// 数据类型与格式化相关类型定义
// ============================================================

// 单元格数据类型
export type DataType = 'text' | 'number' | 'date' | 'percentage' | 'currency';

// 格式类别
export type FormatCategory = 'general' | 'number' | 'currency' | 'percentage' | 'scientific' | 'date' | 'time' | 'datetime' | 'custom';

// 单元格格式信息
export interface CellFormat {
  category: FormatCategory;
  pattern: string;          // 格式模式字符串，如 "#,##0.00"、"yyyy-MM-dd"
  currencySymbol?: string;  // 货币符号，如 "¥"、"$"
}

// 富文本片段
export interface RichTextSegment {
  text: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontColor?: string;
  fontSize?: number;
}

// 条件格式规则
export interface ConditionalFormatRule {
  id: string;
  range: { startRow: number; startCol: number; endRow: number; endCol: number };
  priority: number;
  condition: ConditionalFormatCondition;
  style: ConditionalFormatStyle;
}

// 条件格式条件（联合类型）
export type ConditionalFormatCondition =
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
export interface ConditionalFormatStyle {
  fontColor?: string;
  bgColor?: string;
}

// 条件格式评估结果
export interface ConditionalFormatResult {
  fontColor?: string;
  bgColor?: string;
  dataBar?: DataBarParams;
  icon?: IconInfo;
}

// 数据条渲染参数
export interface DataBarParams {
  percentage: number;  // 0-1 之间的填充比例
  color: string;
}

// 图标集图标信息
export interface IconInfo {
  type: 'arrows' | 'circles' | 'flags';
  index: number;  // 图标索引（0=最差, 1=中等, 2=最好）
}

// 数据验证规则
export interface ValidationRule {
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

// 数据验证结果
export interface ValidationResult {
  valid: boolean;
  errorTitle?: string;
  errorMessage?: string;
}

// 设置单元格内容的返回结果
export interface SetCellContentResult {
  success: boolean;
  validationResult?: ValidationResult;
}

// ============================================================
// 超链接与浮动图片类型定义
// ============================================================

// 超链接数据
export interface HyperlinkData {
  url: string;                     // 链接地址
  displayText?: string;            // 显示文本（为空时使用 URL）
}

// 浮动图片数据
export interface FloatingImage {
  id: string;                      // 唯一标识
  base64Data: string;              // Base64 编码图片数据
  x: number;                       // 画布 X 坐标
  y: number;                       // 画布 Y 坐标
  width: number;                   // 显示宽度
  height: number;                  // 显示高度
  originalWidth: number;           // 原始宽度
  originalHeight: number;          // 原始高度
}

// 单元格内嵌图片数据
export interface EmbeddedImage {
  base64Data: string;              // Base64 编码图片数据
  originalWidth: number;           // 原始宽度
  originalHeight: number;          // 原始高度
  displayWidth?: number;           // 用户自定义显示宽度（拖拽缩放后）
  displayHeight?: number;          // 用户自定义显示高度（拖拽缩放后）
}

// ============================================================
// 边框相关类型定义
// ============================================================

// 边框线型
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double';

// 边框应用位置
export type BorderPosition = 'top' | 'bottom' | 'left' | 'right' | 'all' | 'outer' | 'inner' | 'none';

// 单条边框样式
export interface BorderSide {
  style: BorderStyle;  // 线型
  color: string;       // 颜色
  width: number;       // 宽度（像素）
}

// 单元格边框配置
export interface CellBorder {
  top?: BorderSide;    // 上边框
  bottom?: BorderSide; // 下边框
  left?: BorderSide;   // 左边框
  right?: BorderSide;  // 右边框
}

// ============================================================
// 单元格数据结构
// ============================================================

// 单元格数据结构
export interface Cell {
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

  // === 数据类型与格式化新增字段 ===
  dataType?: DataType;             // 数据类型
  rawValue?: number;               // 原始数值（数字/日期/百分比/货币的实际值）
  format?: CellFormat;             // 格式信息
  isAutoFormat?: boolean;          // 是否为自动检测设置的格式（区别于用户手动设置）
  richText?: RichTextSegment[];    // 富文本内容
  wrapText?: boolean;              // 是否自动换行
  validation?: ValidationRule;     // 数据验证规则
  sparkline?: SparklineConfig;     // 迷你图配置

  // === 超链接字段 ===
  hyperlink?: HyperlinkData;       // 超链接数据（URL + 显示文本）

  // === 数组公式相关字段 ===
  isArrayFormula?: boolean;        // 是否为数组公式
  arrayFormulaOrigin?: CellPosition; // 数组公式起始单元格位置

  // === 边框与样式扩展字段 ===
  border?: CellBorder;             // 边框配置
  fontFamily?: string;             // 字体族名称
  fontStrikethrough?: boolean;     // 删除线

  // === 单元格内嵌图片 ===
  embeddedImage?: EmbeddedImage;   // 内嵌图片数据
}

// 表格数据结构
export interface SpreadsheetData {
  cells: Cell[][];
  rowHeights: number[];
  colWidths: number[];
  charts?: ChartConfig[];          // 图表配置列表
  images?: FloatingImage[];        // 浮动图片列表
}

// 视口位置
export interface Viewport {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  offsetX: number;  // 水平滚动偏移（像素）
  offsetY: number;  // 垂直滚动偏移（像素）
  scrollX: number;  // 当前水平滚动位置
  scrollY: number;  // 当前垂直滚动位置
}

// 选择区域
export interface Selection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// 单元格位置
export interface CellPosition {
  row: number;
  col: number;
}

// 渲染配置
export interface RenderConfig {
  cellPadding: number;
  headerHeight: number;
  headerWidth: number;
  fontSize: number;
  fontFamily: string;
  gridColor: string;
  headerColor: string;
  textColor: string;
  selectionColor: string;
  selectionBorderColor: string;
}

// ============================================================
// 协同编辑相关类型导出
// ============================================================

// 从协同模块重新导出核心类型，方便外部使用
export type {
  CollabOperation,
  OperationType,
  CellEditOp,
  CellMergeOp,
  CellSplitOp,
  RowInsertOp,
  RowDeleteOp,
  RowResizeOp,
  ColResizeOp,
  FontColorOp,
  BgColorOp,
  FontSizeOp,
  FontBoldOp,
  FontItalicOp,
  FontUnderlineOp,
  FontAlignOp,
  VerticalAlignOp,
  RemoteUser,
  MessageType,
  WebSocketMessage,
} from './collaboration/types';

// ============================================================
// 多工作表（Multi-Sheet）相关类型定义
// ============================================================

/** 工作表元数据 */
export interface SheetMeta {
  id: string;              // 唯一标识符（UUID）
  name: string;            // 工作表名称，如 "Sheet1"
  visible: boolean;        // 是否可见
  tabColor: string | null; // 标签颜色，null 表示无颜色
  order: number;           // 排序序号
}

/** 视口状态快照 */
export interface ViewportState {
  scrollX: number;
  scrollY: number;
  selection: Selection | null;
  activeCell: CellPosition | null;
}

/** 重命名结果 */
export interface RenameResult {
  success: boolean;
  error?: 'empty' | 'duplicate' | 'invalid';
  message?: string;
}

/** 工作簿中的单个工作表条目 */
export interface WorkbookSheetEntry {
  meta: SheetMeta;
  data: Record<string, unknown>;      // 现有 exportToJSON 的 data 部分
  metadata: Record<string, unknown>;   // 现有 exportToJSON 的 metadata 部分
}

/** 工作簿序列化格式 */
export interface WorkbookData {
  version: "2.0";
  timestamp: string;
  activeSheetId: string;
  sheets: Array<WorkbookSheetEntry>;
}


// ============================================================
// 选区与编辑增强相关类型定义
// ============================================================

/** 多选区集合 */
export interface MultiSelectionState {
  selections: Selection[];
  activeIndex: number;
}

/** 冻结窗格配置 */
export interface FreezeConfig {
  rows: number;  // 冻结行数
  cols: number;  // 冻结列数
}

/** 行/列分组 */
export interface RowColumnGroup {
  type: 'row' | 'col';
  start: number;
  end: number;
  level: number;
  collapsed: boolean;
}

/** 填充方向 */
export type FillDirection = 'down' | 'up' | 'right' | 'left';

/** 填充模式 */
export interface FillPattern {
  type: 'number' | 'date' | 'text';
  step: number;          // 数字步长或日期天数间隔
  values: string[];      // 源值（用于文本复制填充）
}

/** 选择性粘贴模式 */
export type PasteSpecialMode = 'values' | 'formats' | 'formulas' | 'transpose';

/** 剪贴板单元格完整数据 */
export interface ClipboardCellData {
  content: string;
  formulaContent?: string;
  fontColor?: string;
  bgColor?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  format?: CellFormat;
  border?: CellBorder;             // 边框配置
  fontFamily?: string;             // 字体族名称
  fontStrikethrough?: boolean;     // 删除线
}

/** 内部剪贴板数据 */
export interface InternalClipboard {
  cells: ClipboardCellData[][];
  startRow: number;
  startCol: number;
}
