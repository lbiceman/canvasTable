// ============================================================
// 评论数据模型
// 管理评论线程的 CRUD 操作
// ============================================================

import type { CommentThread, Comment, CommentEvent, CommentEventCallback } from './types';

/** 生成唯一ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 评论数据模型
 * 管理所有评论线程的增删改查
 */
export class CommentModel {
  /** 评论线程存储：key 为 "row-col" */
  private threads: Map<string, CommentThread> = new Map();
  /** 线程ID索引：key 为 threadId */
  private threadIndex: Map<string, string> = new Map();
  /** 事件回调列表 */
  private listeners: CommentEventCallback[] = [];
  /** 当前用户名 */
  private currentUser: string = '我';

  /** 设置当前用户名 */
  public setCurrentUser(name: string): void {
    this.currentUser = name;
  }

  /** 获取当前用户名 */
  public getCurrentUser(): string {
    return this.currentUser;
  }

  /** 生成单元格键 */
  private cellKey(row: number, col: number): string {
    return `${row}-${col}`;
  }

  /**
   * 创建评论线程
   * @param row 单元格行号
   * @param col 单元格列号
   * @param content 首条评论内容
   * @returns 创建的线程
   */
  public createThread(row: number, col: number, content: string): CommentThread {
    const key = this.cellKey(row, col);

    // 如果该单元格已有线程，添加评论到已有线程
    const existing = this.threads.get(key);
    if (existing) {
      this.addComment(existing.id, content);
      return existing;
    }

    const threadId = generateId();
    const comment: Comment = {
      id: generateId(),
      author: this.currentUser,
      content,
      createdAt: Date.now(),
      mentions: this.extractMentions(content),
    };

    const thread: CommentThread = {
      id: threadId,
      row,
      col,
      comments: [comment],
      resolved: false,
      createdAt: Date.now(),
    };

    this.threads.set(key, thread);
    this.threadIndex.set(threadId, key);
    this.emit({ type: 'threadCreated', threadId });

    return thread;
  }

  /**
   * 添加回复评论
   */
  public addComment(threadId: string, content: string): Comment | null {
    const key = this.threadIndex.get(threadId);
    if (!key) return null;

    const thread = this.threads.get(key);
    if (!thread) return null;

    const comment: Comment = {
      id: generateId(),
      author: this.currentUser,
      content,
      createdAt: Date.now(),
      mentions: this.extractMentions(content),
    };

    thread.comments.push(comment);

    // 如果线程已解决，重新打开
    if (thread.resolved) {
      thread.resolved = false;
      thread.resolvedAt = undefined;
      thread.resolvedBy = undefined;
    }

    this.emit({ type: 'commentAdded', threadId, commentId: comment.id });
    return comment;
  }

  /**
   * 编辑评论
   */
  public editComment(threadId: string, commentId: string, newContent: string): boolean {
    const key = this.threadIndex.get(threadId);
    if (!key) return false;

    const thread = this.threads.get(key);
    if (!thread) return false;

    const comment = thread.comments.find(c => c.id === commentId);
    if (!comment) return false;

    // 只能编辑自己的评论
    if (comment.author !== this.currentUser) return false;

    comment.content = newContent;
    comment.updatedAt = Date.now();
    comment.mentions = this.extractMentions(newContent);

    this.emit({ type: 'commentEdited', threadId, commentId });
    return true;
  }

  /**
   * 删除评论
   */
  public deleteComment(threadId: string, commentId: string): boolean {
    const key = this.threadIndex.get(threadId);
    if (!key) return false;

    const thread = this.threads.get(key);
    if (!thread) return false;

    const index = thread.comments.findIndex(c => c.id === commentId);
    if (index === -1) return false;

    // 只能删除自己的评论
    if (thread.comments[index].author !== this.currentUser) return false;

    thread.comments.splice(index, 1);

    // 如果线程中没有评论了，删除整个线程
    if (thread.comments.length === 0) {
      this.threads.delete(key);
      this.threadIndex.delete(threadId);
      this.emit({ type: 'threadDeleted', threadId });
    } else {
      this.emit({ type: 'commentDeleted', threadId, commentId });
    }

    return true;
  }

  /**
   * 标记线程为已解决
   */
  public resolveThread(threadId: string): boolean {
    const key = this.threadIndex.get(threadId);
    if (!key) return false;

    const thread = this.threads.get(key);
    if (!thread) return false;

    thread.resolved = true;
    thread.resolvedAt = Date.now();
    thread.resolvedBy = this.currentUser;

    this.emit({ type: 'threadResolved', threadId });
    return true;
  }

  /**
   * 重新打开已解决的线程
   */
  public reopenThread(threadId: string): boolean {
    const key = this.threadIndex.get(threadId);
    if (!key) return false;

    const thread = this.threads.get(key);
    if (!thread) return false;

    thread.resolved = false;
    thread.resolvedAt = undefined;
    thread.resolvedBy = undefined;

    this.emit({ type: 'threadReopened', threadId });
    return true;
  }

  /**
   * 删除整个线程
   */
  public deleteThread(threadId: string): boolean {
    const key = this.threadIndex.get(threadId);
    if (!key) return false;

    this.threads.delete(key);
    this.threadIndex.delete(threadId);

    this.emit({ type: 'threadDeleted', threadId });
    return true;
  }

  /**
   * 获取单元格的评论线程
   */
  public getThread(row: number, col: number): CommentThread | null {
    return this.threads.get(this.cellKey(row, col)) ?? null;
  }

  /**
   * 通过线程ID获取
   */
  public getThreadById(threadId: string): CommentThread | null {
    const key = this.threadIndex.get(threadId);
    if (!key) return null;
    return this.threads.get(key) ?? null;
  }

  /**
   * 获取所有评论线程
   */
  public getAllThreads(): CommentThread[] {
    return Array.from(this.threads.values());
  }

  /**
   * 获取有评论的单元格位置列表
   */
  public getCommentedCells(): Array<{ row: number; col: number; resolved: boolean }> {
    const cells: Array<{ row: number; col: number; resolved: boolean }> = [];
    for (const thread of this.threads.values()) {
      cells.push({ row: thread.row, col: thread.col, resolved: thread.resolved });
    }
    return cells;
  }

  /**
   * 检查单元格是否有评论
   */
  public hasComment(row: number, col: number): boolean {
    return this.threads.has(this.cellKey(row, col));
  }

  /**
   * 提取 @提及的用户名
   */
  private extractMentions(content: string): string[] {
    const mentions: string[] = [];
    const regex = /@(\S+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  }

  /**
   * 注册事件监听
   */
  public on(callback: CommentEventCallback): void {
    this.listeners.push(callback);
  }

  /**
   * 移除事件监听
   */
  public off(callback: CommentEventCallback): void {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: CommentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * 序列化为 JSON（用于持久化）
   */
  public serialize(): CommentThread[] {
    return Array.from(this.threads.values());
  }

  /**
   * 从 JSON 恢复（用于持久化）
   */
  public deserialize(threads: CommentThread[]): void {
    this.threads.clear();
    this.threadIndex.clear();
    for (const thread of threads) {
      const key = this.cellKey(thread.row, thread.col);
      this.threads.set(key, thread);
      this.threadIndex.set(thread.id, key);
    }
  }
}
