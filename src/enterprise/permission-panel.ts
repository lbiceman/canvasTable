// ============================================================
// ICE Excel 企业版 - 权限面板 UI
// ============================================================

import { PermissionService } from './permission-service';
import { CollabRole, RoomUserPermission } from './types';

/** 权限面板：显示在线用户和角色管理 */
export class PermissionPanel {
  private container: HTMLElement;
  private panel: HTMLElement | null = null;
  private permissionService: PermissionService;
  private visible = false;
  private onRoleChange: ((userId: string, newRole: CollabRole) => void) | null = null;

  constructor(container: HTMLElement, permissionService: PermissionService) {
    this.container = container;
    this.permissionService = permissionService;
  }

  /** 注册角色变更回调 */
  setOnRoleChange(callback: (userId: string, newRole: CollabRole) => void): void {
    this.onRoleChange = callback;
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
  show(): void {
    this.visible = true;
    this.render();
  }

  /** 隐藏面板 */
  hide(): void {
    this.visible = false;
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  /** 刷新面板内容 */
  refresh(): void {
    if (this.visible) {
      this.render();
    }
  }

  /** 渲染面板 */
  private render(): void {
    if (this.panel) {
      this.panel.remove();
    }

    this.panel = document.createElement('div');
    this.panel.className = 'permission-panel';

    const users = this.permissionService.getRoomUsers();
    const onlineUsers = users.filter(u => u.online);
    const isAdmin = this.permissionService.isAdmin();

    const roleLabels: Record<CollabRole, string> = {
      admin: '管理员',
      editor: '可编辑',
      readOnly: '只读',
      guest: '访客',
    };

    const roleColors: Record<CollabRole, string> = {
      admin: '#e74c3c',
      editor: '#3498db',
      readOnly: '#95a5a6',
      guest: '#bdc3c7',
    };

    let html = `
      <div class="permission-panel-header">
        <h3>权限设置</h3>
        <button class="permission-panel-close" aria-label="关闭权限面板">✕</button>
      </div>
      <div class="permission-panel-section">
        <h4>在线用户 (${onlineUsers.length})</h4>
        <ul class="permission-user-list">
    `;

    for (const user of users) {
      const roleLabel = roleLabels[user.role];
      const roleColor = roleColors[user.role];
      const onlineClass = user.online ? 'online' : 'offline';

      html += `
        <li class="permission-user-item ${onlineClass}" data-user-id="${user.userId}">
          <span class="permission-user-avatar" style="background:${user.color || '#ccc'}">${user.userName.charAt(0)}</span>
          <span class="permission-user-name">${user.userName}</span>
          <span class="permission-user-status ${onlineClass}"></span>
      `;

      if (isAdmin) {
        html += `
          <select class="permission-role-select" data-user-id="${user.userId}" aria-label="设置 ${user.userName} 的角色">
            ${(['admin', 'editor', 'readOnly', 'guest'] as CollabRole[]).map(r =>
              `<option value="${r}" ${r === user.role ? 'selected' : ''} ${!this.permissionService.canGrantRole(r) ? 'disabled' : ''}>${roleLabels[r]}</option>`
            ).join('')}
          </select>
        `;
      } else {
        html += `<span class="permission-role-badge" style="color:${roleColor}">${roleLabel}</span>`;
      }

      html += '</li>';
    }

    html += `
        </ul>
      </div>
      <div class="permission-panel-section">
        <h4>权限说明</h4>
        <table class="permission-matrix-table">
          <thead><tr><th>角色</th><th>查看</th><th>编辑</th><th>格式化</th><th>保护</th><th>导出</th></tr></thead>
          <tbody>
            <tr><td>管理员</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
            <tr><td>可编辑</td><td>✅</td><td>✅</td><td>✅</td><td>❌</td><td>✅</td></tr>
            <tr><td>只读</td><td>✅</td><td>❌</td><td>❌</td><td>❌</td><td>✅</td></tr>
            <tr><td>访客</td><td>✅</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td></tr>
          </tbody>
        </table>
      </div>
    `;

    this.panel.innerHTML = html;
    this.container.appendChild(this.panel);
    this.bindEvents();
  }

  /** 绑定事件 */
  private bindEvents(): void {
    if (!this.panel) return;

    // 关闭按钮
    const closeBtn = this.panel.querySelector('.permission-panel-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // 角色变更
    const selects = this.panel.querySelectorAll('.permission-role-select');
    selects.forEach(select => {
      select.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const userId = target.dataset.userId;
        const newRole = target.value as CollabRole;
        if (userId) {
          this.onRoleChange?.(userId, newRole);
        }
      });
    });
  }
}
