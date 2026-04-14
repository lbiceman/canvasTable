// ============================================================
// 评论/批注线程类型定义
// ============================================================

/** 单条评论 */
export interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: number;    // 时间戳
  updatedAt?: number;
  mentions?: string[];  // @提及的用户名列表
}

/** 评论线程 */
export interface CommentThread {
  id: string;
  row: number;
  col: number;
  comments: Comment[];
  resolved: boolean;
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

/** 评论事件类型 */
export type CommentEventType =
  | 'threadCreated'
  | 'commentAdded'
  | 'commentEdited'
  | 'commentDeleted'
  | 'threadResolved'
  | 'threadReopened'
  | 'threadDeleted';

/** 评论事件 */
export interface CommentEvent {
  type: CommentEventType;
  threadId: string;
  commentId?: string;
}

/** 评论事件回调 */
export type CommentEventCallback = (event: CommentEvent) => void;
