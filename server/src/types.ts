// ============================================================
// 基础数据类型（与客户端 src/types.ts 对应，避免 DOM 依赖）
// ============================================================

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
}

// 表格数据结构
export interface SpreadsheetData {
  cells: Cell[][];
  rowHeights: number[];
  colWidths: number[];
}

// 选择区域
export interface Selection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// ============================================================
// 操作类型定义（与客户端 src/collaboration/types.ts 一致）
// ============================================================

export type OperationType =
  | 'cellEdit'
  | 'cellMerge'
  | 'cellSplit'
  | 'rowInsert'
  | 'rowDelete'
  | 'rowResize'
  | 'colResize'
  | 'fontColor'
  | 'bgColor'
  | 'fontSize'
  | 'fontBold'
  | 'fontItalic';

export interface BaseOperation {
  type: OperationType;
  userId: string;
  timestamp: number;
  revision: number;
}

export interface CellEditOp extends BaseOperation {
  type: 'cellEdit';
  row: number;
  col: number;
  content: string;
  previousContent: string;
}

export interface CellMergeOp extends BaseOperation {
  type: 'cellMerge';
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface CellSplitOp extends BaseOperation {
  type: 'cellSplit';
  row: number;
  col: number;
}

export interface RowInsertOp extends BaseOperation {
  type: 'rowInsert';
  rowIndex: number;
  count: number;
}

export interface RowDeleteOp extends BaseOperation {
  type: 'rowDelete';
  rowIndex: number;
  count: number;
}

export interface RowResizeOp extends BaseOperation {
  type: 'rowResize';
  rowIndex: number;
  height: number;
}

export interface ColResizeOp extends BaseOperation {
  type: 'colResize';
  colIndex: number;
  width: number;
}

export interface FontColorOp extends BaseOperation {
  type: 'fontColor';
  row: number;
  col: number;
  color: string;
}

export interface BgColorOp extends BaseOperation {
  type: 'bgColor';
  row: number;
  col: number;
  color: string;
}

export interface FontSizeOp extends BaseOperation {
  type: 'fontSize';
  row: number;
  col: number;
  size: number;
}

export interface FontBoldOp extends BaseOperation {
  type: 'fontBold';
  row: number;
  col: number;
  bold: boolean;
}

export interface FontItalicOp extends BaseOperation {
  type: 'fontItalic';
  row: number;
  col: number;
  italic: boolean;
}

export type CollabOperation =
  | CellEditOp
  | CellMergeOp
  | CellSplitOp
  | RowInsertOp
  | RowDeleteOp
  | RowResizeOp
  | ColResizeOp
  | FontColorOp
  | BgColorOp
  | FontSizeOp
  | FontBoldOp
  | FontItalicOp;

// ============================================================
// WebSocket 协议消息类型
// ============================================================

export type MessageType =
  | 'join'
  | 'leave'
  | 'operation'
  | 'ack'
  | 'remote_op'
  | 'sync'
  | 'cursor'
  | 'user_join'
  | 'user_leave'
  | 'state';

export interface WebSocketMessage {
  type: MessageType;
  payload: unknown;
}

// 远程用户信息
export interface RemoteUser {
  userId: string;
  userName: string;
  color: string;
  selection: Selection | null;
  lastActive: number;
}

// 预定义用户颜色池
export const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
];

// ============================================================
// 服务端特有类型
// ============================================================

// 客户端连接信息
export interface ClientConnection {
  userId: string;
  userName: string;
  color: string;
  ws: unknown; // WebSocket 实例，使用 unknown 避免直接依赖 ws 类型
}

// 房间信息
export interface Room {
  roomId: string;
  // 当前文档状态
  document: SpreadsheetData;
  // 已确认操作历史
  operations: CollabOperation[];
  // 当前修订号
  revision: number;
  // 在线客户端
  clients: Map<string, ClientConnection>;
}
