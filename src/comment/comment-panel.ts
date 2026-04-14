// ============================================================
// 评论面板 UI
// 显示评论线程、支持添加回复、标记已解决
// ============================================================

import { CommentModel } from './comment-model';
import type { CommentThread, Comment } from './types';

/**
 * 评论面板
 * 浮动在单元格旁边，显示评论线程
 */
export class CommentPanel {
  private panel: HTMLDivElement;
  private model: CommentModel;
  private currentThread: CommentThread | null = null;
  private currentRow: number = -1;
  private currentCol: number = -1;
  private onUpdate: (() => void) | null = null;

  constructor(model: CommentModel) {
    this.model = model;
    this.panel = this.createPanel();
    document.body.appendChild(this.panel);
  }

  /** 设置更新回调（评论变更后通知外部重绘） */
  public setUpdateCallback(callback: () => void): void {
    this.onUpdate = callback;
  }

  /** 显示评论面板 */
  public show(row: number, col: number, x: number, y: number): void {
    this.currentRow = row;
    this.currentCol = col;
    this.currentThread = this.model.getThread(row, col);

    this.panel.style.display = 'block';
    this.panel.style.left = `${x}px`;
    this.panel.style.top = `${y}px`;

    this.render();

    // 聚焦输入框
    const input = this.panel.querySelector('.comment-input') as HTMLTextAreaElement;
    if (input) {
      requestAnimationFrame(() => input.focus());
    }
  }

  /** 隐藏面板 */
  public hide(): void {
    this.panel.style.display = 'none';
    this.currentThread = null;
  }

  /** 面板是否可见 */
  public isVisible(): boolean {
    return this.panel.style.display !== 'none';
  }

  /** 创建面板 DOM */
  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'comment-panel';
    panel.style.display = 'none';

    // 阻止面板内的点击事件冒泡到 canvas
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('click', (e) => e.stopPropagation());

    // Escape 关闭
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    });

    return panel;
  }

  /** 渲染面板内容 */
  private render(): void {
    const thread = this.currentThread;

    let html = '<div class="comment-panel-content">';

    if (thread && thread.comments.length > 0) {
      // 已有评论线程
      html += '<div class="comment-thread-header">';
      html += `<span class="comment-cell-ref">${this.getCellRef(this.currentRow, this.currentCol)}</span>`;
      if (thread.resolved) {
        html += '<span class="comment-resolved-badge">已解决</span>';
        html += `<button class="comment-reopen-btn" title="重新打开">重新打开</button>`;
      } else {
        html += `<button class="comment-resolve-btn" title="标记为已解决">✓ 解决</button>`;
      }
      html += `<button class="comment-delete-thread-btn" title="删除线程">🗑️</button>`;
      html += '</div>';

      // 评论列表
      html += '<div class="comment-list">';
      for (const comment of thread.comments) {
        html += this.renderComment(comment, thread.id);
      }
      html += '</div>';
    } else {
      // 新建评论
      html += '<div class="comment-thread-header">';
      html += `<span class="comment-cell-ref">${this.getCellRef(this.currentRow, this.currentCol)} - 新建评论</span>`;
      html += '</div>';
    }

    // 输入区域
    html += '<div class="comment-input-area">';
    html += '<textarea class="comment-input" placeholder="输入评论...（@用户名 可提及用户）" rows="2"></textarea>';
    html += '<button class="comment-submit-btn">发送</button>';
    html += '</div>';

    html += '</div>';
    this.panel.innerHTML = html;

    this.bindPanelEvents();
  }

  /** 渲染单条评论 */
  private renderComment(comment: Comment, threadId: string): string {
    const time = this.formatTime(comment.createdAt);
    const isOwn = comment.author === this.model.getCurrentUser();
    const editedMark = comment.updatedAt ? ' <span class="comment-edited">(已编辑)</span>' : '';

    // 高亮 @提及
    const content = this.highlightMentions(this.escapeHtml(comment.content));

    let html = `<div class="comment-item ${isOwn ? 'comment-own' : ''}" data-comment-id="${comment.id}" data-thread-id="${threadId}">`;
    html += `<div class="comment-meta">`;
    html += `<span class="comment-author">${this.escapeHtml(comment.author)}</span>`;
    html += `<span class="comment-time">${time}</span>`;
    html += `</div>`;
    html += `<div class="comment-content">${content}${editedMark}</div>`;
    if (isOwn) {
      html += `<div class="comment-actions">`;
      html += `<button class="comment-edit-btn" title="编辑">编辑</button>`;
      html += `<button class="comment-delete-btn" title="删除">删除</button>`;
      html += `</div>`;
    }
    html += '</div>';
    return html;
  }

  /** 绑定面板内事件 */
  private bindPanelEvents(): void {
    // 发送按钮
    const submitBtn = this.panel.querySelector('.comment-submit-btn');
    const input = this.panel.querySelector('.comment-input') as HTMLTextAreaElement;

    submitBtn?.addEventListener('click', () => {
      const content = input?.value.trim();
      if (!content) return;

      if (this.currentThread) {
        this.model.addComment(this.currentThread.id, content);
      } else {
        this.currentThread = this.model.createThread(this.currentRow, this.currentCol, content);
      }

      this.render();
      this.onUpdate?.();
    });

    // Enter 发送（Shift+Enter 换行）
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitBtn?.dispatchEvent(new Event('click'));
      }
    });

    // 解决按钮
    const resolveBtn = this.panel.querySelector('.comment-resolve-btn');
    resolveBtn?.addEventListener('click', () => {
      if (this.currentThread) {
        this.model.resolveThread(this.currentThread.id);
        this.currentThread = this.model.getThread(this.currentRow, this.currentCol);
        this.render();
        this.onUpdate?.();
      }
    });

    // 重新打开按钮
    const reopenBtn = this.panel.querySelector('.comment-reopen-btn');
    reopenBtn?.addEventListener('click', () => {
      if (this.currentThread) {
        this.model.reopenThread(this.currentThread.id);
        this.currentThread = this.model.getThread(this.currentRow, this.currentCol);
        this.render();
        this.onUpdate?.();
      }
    });

    // 删除线程按钮
    const deleteThreadBtn = this.panel.querySelector('.comment-delete-thread-btn');
    deleteThreadBtn?.addEventListener('click', () => {
      if (this.currentThread) {
        this.model.deleteThread(this.currentThread.id);
        this.currentThread = null;
        this.hide();
        this.onUpdate?.();
      }
    });

    // 编辑评论按钮
    this.panel.querySelectorAll('.comment-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.comment-item');
        const commentId = item?.getAttribute('data-comment-id');
        const threadId = item?.getAttribute('data-thread-id');
        if (commentId && threadId) {
          this.startEditComment(threadId, commentId, item as HTMLElement);
        }
      });
    });

    // 删除评论按钮
    this.panel.querySelectorAll('.comment-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.comment-item');
        const commentId = item?.getAttribute('data-comment-id');
        const threadId = item?.getAttribute('data-thread-id');
        if (commentId && threadId) {
          this.model.deleteComment(threadId, commentId);
          this.currentThread = this.model.getThread(this.currentRow, this.currentCol);
          if (!this.currentThread) {
            this.hide();
          } else {
            this.render();
          }
          this.onUpdate?.();
        }
      });
    });
  }

  /** 开始编辑评论 */
  private startEditComment(threadId: string, commentId: string, element: HTMLElement): void {
    const contentEl = element.querySelector('.comment-content');
    if (!contentEl) return;

    const thread = this.model.getThreadById(threadId);
    if (!thread) return;

    const comment = thread.comments.find(c => c.id === commentId);
    if (!comment) return;

    // 替换内容为编辑框
    const editArea = document.createElement('textarea');
    editArea.className = 'comment-edit-input';
    editArea.value = comment.content;
    editArea.rows = 2;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'comment-save-edit-btn';
    saveBtn.textContent = '保存';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'comment-cancel-edit-btn';
    cancelBtn.textContent = '取消';

    const editContainer = document.createElement('div');
    editContainer.className = 'comment-edit-container';
    editContainer.appendChild(editArea);
    editContainer.appendChild(saveBtn);
    editContainer.appendChild(cancelBtn);

    contentEl.replaceWith(editContainer);
    editArea.focus();

    saveBtn.addEventListener('click', () => {
      const newContent = editArea.value.trim();
      if (newContent) {
        this.model.editComment(threadId, commentId, newContent);
        this.currentThread = this.model.getThread(this.currentRow, this.currentCol);
        this.render();
        this.onUpdate?.();
      }
    });

    cancelBtn.addEventListener('click', () => {
      this.render();
    });
  }

  /** 获取单元格引用文本 */
  private getCellRef(row: number, col: number): string {
    let colStr = '';
    let c = col;
    while (c >= 0) {
      colStr = String.fromCharCode(65 + (c % 26)) + colStr;
      c = Math.floor(c / 26) - 1;
    }
    return `${colStr}${row + 1}`;
  }

  /** 格式化时间 */
  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}天前`;

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  /** 高亮 @提及 */
  private highlightMentions(text: string): string {
    return text.replace(/@(\S+)/g, '<span class="comment-mention">@$1</span>');
  }

  /** HTML 转义 */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 销毁面板 */
  public destroy(): void {
    this.panel.remove();
  }
}
