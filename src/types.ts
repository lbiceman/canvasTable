// 单元格数据结构
export interface Cell {
  content: string;
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
}

// 表格数据结构
export interface SpreadsheetData {
  cells: Cell[][];
  rowHeights: number[];
  colWidths: number[];
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
