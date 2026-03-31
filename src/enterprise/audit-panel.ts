// ============================================================
// ICE Excel 企业版 - 审计日志面板 UI
// ============================================================

import { AuditService } from './audit-service';
import { AuditEventCategory, AuditLogEntry } from './types';

/** 审计日志面板 */
export class AuditPanel {
  private container: HTMLElement;
  private panel: HTMLElement | null = null;
  private auditService: AuditService;
  private visible = false;
  private currentCategory: AuditEventCategory | undefined;
  private currentPage = 0;
  private readonly PAGE_SIZE = 20;

  constructor(container: HTMLElement, auditService: AuditService) {
    this.container = container;
    this.auditService = auditService;
  }

  /** 切换面板显示 */
  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /** 显示面板 */
  async show(): Promise<void> {
    this.visible = true;
    this.currentPage = 0;
    await this.render();
  }

  /** 隐藏面板 */
  hide(): void {
    this.visible = false;
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  /** 渲染面板 */
  private async render(): Promise<void> {
    if (this.panel) {
      this.panel.remove();
    }

    this.panel = document.createElement('div');
    this.panel.className = 'audit-panel';

    const result = await this.auditService.query({
      category: this.currentCategory,
      page: this.currentPage,
      pageSize: this.PAGE_SIZE,
    });

    const categoryLabels: Record<string, string> = {
      all: '全部',
      auth: '登录',
      permission: '权限',
      data: '数据',
      admin: '管理',
    };

    let html = `
      <div class="audit-panel-header">
        <h3>审计日志</h3>
        <div class="audit-panel-actions">
          <button class="audit-export-btn" data-format="csv" aria-label="导出 CSV">导出 CSV</button>
          <button class="audit-export-btn" data-format="json" aria-label="导出 JSON">导出 JSON</button>
          <button class="audit-panel-close" aria-label="关闭审计面板">✕</button>
        </div>
      </div>
      <div class="audit-filter-bar">
    `;

    for (const [key, label] of Object.entries(categoryLabels)) {
      const active = (key === 'all' && !this.currentCategory) || key === this.currentCategory;
      html += `<button class="audit-filter-btn ${active ? 'active' : ''}" data-category="${key}">${label}</button>`;
    }

    html += `</div><div class="audit-log-table-wrapper">
      <table class="audit-log-table">
        <thead>
          <tr><th>时间</th><th>用户</th><th>操作</th><th>目标</th><th>详情</th><th>IP</th></tr>
        </thead>
        <tbody>
    `;

    if (result.entries.length === 0) {
      html += '<tr><td colspan="6" class="audit-empty">暂无日志记录</td></tr>';
    } else {
      for (const entry of result.entries) {
        html += this.renderLogRow(entry);
      }
    }

    html += `</tbody></table></div>`;

    // 分页
    const totalPages = Math.ceil(result.total / this.PAGE_SIZE);
    if (totalPages > 1) {
      html += `<div class="audit-pagination">
        <button class="audit-page-btn" data-page="prev" ${this.currentPage === 0 ? 'disabled' : ''}>上一页</button>
        <span>${this.currentPage + 1} / ${totalPages}</span>
        <button class="audit-page-btn" data-page="next" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}>下一页</button>
      </div>`;
    }

    this.panel.innerHTML = html;
    this.container.appendChild(this.panel);
    this.bindEvents();
  }

  /** 渲染单行日志 */
  private renderLogRow(entry: AuditLogEntry): string {
    const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN');
    const categoryClass = `audit-category-${entry.category}`;
    return `
      <tr class="${categoryClass}">
        <td>${time}</td>
        <td>${entry.userName}</td>
        <td><span class="audit-event-badge">${entry.eventType}</span></td>
        <td>${entry.target}</td>
        <td>${entry.detail}</td>
        <td>${entry.ip}</td>
      </tr>
    `;
  }

  /** 绑定事件 */
  private bindEvents(): void {
    if (!this.panel) return;

    // 关闭
    this.panel.querySelector('.audit-panel-close')?.addEventListener('click', () => this.hide());

    // 分类筛选
    this.panel.querySelectorAll('.audit-filter-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const category = (e.target as HTMLElement).dataset.category;
        this.currentCategory = category === 'all' ? undefined : category as AuditEventCategory;
        this.currentPage = 0;
        await this.render();
      });
    });

    // 分页
    this.panel.querySelectorAll('.audit-page-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = (e.target as HTMLElement).dataset.page;
        if (action === 'prev' && this.currentPage > 0) {
          this.currentPage--;
        } else if (action === 'next') {
          this.currentPage++;
        }
        await this.render();
      });
    });

    // 导出
    this.panel.querySelectorAll('.audit-export-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const format = (e.target as HTMLElement).dataset.format;
        const query = { category: this.currentCategory, page: 0, pageSize: 10000 };
        let content: string;
        let filename: string;
        let mimeType: string;

        if (format === 'csv') {
          content = await this.auditService.exportCSV(query);
          filename = `audit-log-${Date.now()}.csv`;
          mimeType = 'text/csv';
        } else {
          content = await this.auditService.exportJSON(query);
          filename = `audit-log-${Date.now()}.json`;
          mimeType = 'application/json';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  }
}
