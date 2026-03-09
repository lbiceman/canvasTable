import { Selection, SpreadsheetData } from '../types';

// ============================================================
// 操作类型定义
// ============================================================

// 操作类型枚举
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
  | 'fontItalic'
  | 'fontUnderline'
  | 'fontAlign';

// 基础操作接口
export interface BaseOperation {
  type: OperationType;
  userId: string;
  timestamp: number;
  revision: number;
}

// 单元格编辑操作
export interface CellEditOp extends BaseOperation {
  type: 'cellEdit';
  row: number;
  col: number;
  content: string;
  previousContent: string;
}

// 合并单元格操作
export interface CellMergeOp extends BaseOperation {
  type: 'cellMerge';
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// 拆分单元格操作
export interface CellSplitOp extends BaseOperation {
  type: 'cellSplit';
  row: number;
  col: number;
}

// 插入行操作
export interface RowInsertOp extends BaseOperation {
  type: 'rowInsert';
  rowIndex: number;
  count: number;
}

// 删除行操作
export interface RowDeleteOp extends BaseOperation {
  type: 'rowDelete';
  rowIndex: number;
  count: number;
}

// 调整行高操作
export interface RowResizeOp extends BaseOperation {
  type: 'rowResize';
  rowIndex: number;
  height: number;
}

// 调整列宽操作
export interface ColResizeOp extends BaseOperation {
  type: 'colResize';
  colIndex: number;
  width: number;
}

// 字体颜色操作
export interface FontColorOp extends BaseOperation {
  type: 'fontColor';
  row: number;
  col: number;
  color: string;
}

// 背景颜色操作
export interface BgColorOp extends BaseOperation {
  type: 'bgColor';
  row: number;
  col: number;
  color: string;
}

// 字体大小操作（单元格级别）
export interface FontSizeOp extends BaseOperation {
  type: 'fontSize';
  row: number;
  col: number;
  size: number;
}

// 字体加粗操作（单元格级别）
export interface FontBoldOp extends BaseOperation {
  type: 'fontBold';
  row: number;
  col: number;
  bold: boolean;
}

// 字体斜体操作（单元格级别）
export interface FontItalicOp extends BaseOperation {
  type: 'fontItalic';
  row: number;
  col: number;
  italic: boolean;
}

// 字体下划线操作（单元格级别）
export interface FontUnderlineOp extends BaseOperation {
  type: 'fontUnderline';
  row: number;
  col: number;
  underline: boolean;
}

// 字体对齐操作（单元格级别）
export interface FontAlignOp extends BaseOperation {
  type: 'fontAlign';
  row: number;
  col: number;
  align: 'left' | 'center' | 'right';
}

// 联合操作类型
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
  | FontItalicOp
  | FontUnderlineOp
  | FontAlignOp;

// ============================================================
// 远程用户与光标感知
// ============================================================

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
// WebSocket 协议消息类型
// ============================================================

// 消息类型
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

// 通用 WebSocket 消息
export interface WebSocketMessage {
  type: MessageType;
  payload: unknown;
}

// 加入房间请求
export interface JoinMessage {
  type: 'join';
  payload: {
    roomId: string;
    userId: string;
    userName: string;
  };
}

// 文档状态响应
export interface StateMessage {
  type: 'state';
  payload: {
    document: SpreadsheetData;
    revision: number;
    users: RemoteUser[];
  };
}

// 操作消息
export interface OperationMessage {
  type: 'operation';
  payload: {
    revision: number;
    operation: CollabOperation;
  };
}

// 确认消息
export interface AckMessage {
  type: 'ack';
  payload: {
    revision: number;
  };
}

// 远程操作消息
export interface RemoteOpMessage {
  type: 'remote_op';
  payload: {
    revision: number;
    operation: CollabOperation;
    userId: string;
  };
}

// 光标消息
export interface CursorMessage {
  type: 'cursor';
  payload: {
    userId: string;
    selection: Selection | null;
  };
}

// 用户加入通知
export interface UserJoinMessage {
  type: 'user_join';
  payload: {
    user: RemoteUser;
  };
}

// 用户离开通知
export interface UserLeaveMessage {
  type: 'user_leave';
  payload: {
    userId: string;
  };
}
