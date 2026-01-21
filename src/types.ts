// 单元格数据结构
export interface Cell {
  content: string;
  rowSpan: number;
  colSpan: number;
  isMerged: boolean;
  mergeParent?: { row: number; col: number };
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