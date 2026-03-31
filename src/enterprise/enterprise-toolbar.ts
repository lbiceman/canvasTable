// ============================================================
// ICE Excel 企业版 - 工具栏集成
// ============================================================

import { AuthUser } from './types';

/** 企业版工具栏：在主工具栏右侧添加企业功能按钮 */
export class EnterpriseToolbar {
  private container: HTMLElement;
  private toolbarEl: HTMLElement | null = null;
  private onPermissionClick: (() => void) | null = null;
  private onAuditClick: (() => void) | null = null;
  private onProtectionClick: (() => void) | null = null;
  private onLogoutClick: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** 设置回调 */
  setCallbacks(callbacks: {
    onPermissionClick?: () => void;
    onAuditClick?: () => void;
    onProtectionClick?: () => void;
    onLogoutClick?: () => void;
  }): void {
    this.onPermissionClick = callbacks.onPermissionClick ?? null;
    this.onAuditClick = callbacks.onAuditClick ?? null;
    this.onProtectionClick = callbacks.onProtectionClick ?? null;
    this.onLogoutClick = callbacks.onLogoutClick ?? null;
  }

  /** 渲染工具栏 */
  render(user: AuthUser | null): void {
    if (this.toolbarEl) {
      this.toolbarEl.remove();
    }

    if (!user) return;

    this.toolbarEl = document.createElement('div');
    this.toolbarEl.className = 'enterprise-toolbar';
    this.toolbarEl.innerHTML = `
      <button class="enterprise-toolbar-btn" id="ent-protection-btn" title="工作表保护">
        🔒 保护
      </button>
      <button class="enterprise-toolbar-btn" id="ent-permission-btn" title="权限设置">
        👥 权限
      </button>
      <button class="enterprise-toolbar-btn" id="ent-audit-btn" title="审计日志">
        📋 审计
      </button>
      <div class="enterprise-user-badge">
        <span class="enterprise-user-avatar">${user.name.charAt(0)}</span>
        <span>${user.name}</span>
      </div>
      <button class="enterprise-toolbar-btn" id="ent-logout-btn" title="登出">
        退出
      </button>
    `;

    this.container.appendChild(this.toolbarEl);
    this.bindEvents();
  }

  /** 绑定事件 */
  private bindEvents(): void {
    if (!this.toolbarEl) return;

    this.toolbarEl.querySelector('#ent-protection-btn')?.addEventListener('click', () => {
      this.onProtectionClick?.();
    });

    this.toolbarEl.querySelector('#ent-permission-btn')?.addEventListener('click', () => {
      this.onPermissionClick?.();
    });

    this.toolbarEl.querySelector('#ent-audit-btn')?.addEventListener('click', () => {
      this.onAuditClick?.();
    });

    this.toolbarEl.querySelector('#ent-logout-btn')?.addEventListener('click', () => {
      this.onLogoutClick?.();
    });
  }

  /** 销毁 */
  destroy(): void {
    if (this.toolbarEl) {
      this.toolbarEl.remove();
      this.toolbarEl = null;
    }
  }
}
