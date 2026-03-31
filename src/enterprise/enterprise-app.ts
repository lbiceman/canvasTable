// ============================================================
// ICE Excel 企业版 - 应用编排器
// ============================================================

import { AuthService } from './auth-service';
import { LoginPage } from './login-page';
import { PermissionService } from './permission-service';
import { PermissionPanel } from './permission-panel';
import { SheetProtectionManager } from './sheet-protection';
import { ProtectionDialog } from './protection-dialog';
import { AuditService } from './audit-service';
import { AuditPanel } from './audit-panel';
import { EnterpriseToolbar } from './enterprise-toolbar';
import { CollabRole } from './types';

/** 企业版应用编排器：协调所有企业级模块 */
export class EnterpriseApp {
  private authService: AuthService;
  private permissionService: PermissionService;
  private protectionManager: SheetProtectionManager;
  private auditService: AuditService;
  private loginPage: LoginPage | null = null;
  private permissionPanel: PermissionPanel | null = null;
  private auditPanel: AuditPanel | null = null;
  private protectionDialog: ProtectionDialog;
  private enterpriseToolbar: EnterpriseToolbar | null = null;
  private appContainer: HTMLElement;
  private initialized = false;

  constructor(appContainer: HTMLElement, apiBase: string = '/api') {
    this.appContainer = appContainer;
    this.authService = new AuthService(apiBase);
    this.permissionService = new PermissionService();
    this.protectionManager = new SheetProtectionManager();
    this.protectionDialog = new ProtectionDialog(this.protectionManager);
    this.auditService = new AuditService(apiBase, () => this.authService.getAuthHeaders());
  }

  /** 初始化企业版功能 */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // 导入企业版样式
    this.loadStyles();

    // 监听认证状态变更
    this.authService.setOnAuthChange((user) => {
      if (user) {
        this.showApp();
      } else {
        this.showLogin();
      }
    });

    // 监听权限变更
    this.permissionService.setOnPermissionChange((role) => {
      this.onPermissionChanged(role);
    });

    // 监听保护状态变更
    this.protectionManager.setOnProtectionChange((sheetId, protection) => {
      this.auditService.log(
        protection.enabled ? 'SHEET_LOCK' : 'SHEET_UNLOCK',
        this.authService.getCurrentUser()?.id || '',
        this.authService.getCurrentUser()?.name || '',
        sheetId,
        protection.enabled ? '启用工作表保护' : '解除工作表保护',
      );
    });

    // 检查是否已登录
    if (this.authService.isAuthenticated()) {
      this.showApp();
    } else {
      this.showLogin();
    }
  }

  /** 显示登录页面 */
  private showLogin(): void {
    this.enterpriseToolbar?.destroy();
    const loginContainer = document.createElement('div');
    loginContainer.id = 'enterprise-login-container';
    document.body.appendChild(loginContainer);

    this.loginPage = new LoginPage(loginContainer, this.authService, () => {
      loginContainer.remove();
      this.loginPage = null;
      this.showApp();
    });
    this.loginPage.render();

    // 隐藏主应用
    this.appContainer.style.display = 'none';
  }

  /** 显示主应用 */
  private showApp(): void {
    // 移除登录页
    const loginContainer = document.getElementById('enterprise-login-container');
    loginContainer?.remove();

    // 显示主应用
    this.appContainer.style.display = '';

    // 初始化企业工具栏
    const toolbarContainer = document.querySelector('.toolbar') as HTMLElement;
    if (toolbarContainer) {
      this.enterpriseToolbar = new EnterpriseToolbar(toolbarContainer);
      this.enterpriseToolbar.setCallbacks({
        onPermissionClick: () => this.togglePermissionPanel(),
        onAuditClick: () => this.toggleAuditPanel(),
        onProtectionClick: () => this.openProtectionDialog(),
        onLogoutClick: () => this.logout(),
      });
      this.enterpriseToolbar.render(this.authService.getCurrentUser());
    }

    // 初始化权限面板
    this.permissionPanel = new PermissionPanel(document.body, this.permissionService);
    this.permissionPanel.setOnRoleChange((userId, newRole) => {
      this.changeUserRole(userId, newRole);
    });

    // 初始化审计面板
    this.auditPanel = new AuditPanel(document.body, this.auditService);

    // 记录登录审计
    const user = this.authService.getCurrentUser();
    if (user) {
      this.auditService.log('LOGIN', user.id, user.name, '系统', `${user.authMethod} 登录`);
    }
  }

  /** 切换权限面板 */
  private togglePermissionPanel(): void {
    this.permissionPanel?.toggle();
  }

  /** 切换审计面板 */
  private toggleAuditPanel(): void {
    this.auditPanel?.toggle();
  }

  /** 打开保护对话框 */
  private openProtectionDialog(): void {
    if (!this.permissionService.canProtect()) {
      alert('您没有设置保护的权限');
      return;
    }
    // 获取当前活动 Sheet ID
    const activeSheetId = this.getActiveSheetId();
    this.protectionDialog.open(activeSheetId);
  }

  /** 登出 */
  private async logout(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (user) {
      await this.auditService.log('LOGOUT', user.id, user.name, '系统', '用户登出');
    }
    await this.authService.logout();
    this.showLogin();
  }

  /** 变更用户角色 */
  private changeUserRole(userId: string, newRole: CollabRole): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.auditService.log(
        'ROLE_CHANGE',
        currentUser.id,
        currentUser.name,
        userId,
        `角色变更为 ${newRole}`,
      );
    }
    // 通知服务端变更角色
    this.permissionPanel?.refresh();
  }

  /** 权限变更回调 */
  private onPermissionChanged(role: CollabRole): void {
    // 根据权限更新 UI 状态
    const canEdit = this.permissionService.canEdit();
    // 通知主应用更新编辑状态
    const event = new CustomEvent('enterprise:permission-change', {
      detail: { role, canEdit },
    });
    window.dispatchEvent(event);
  }

  /** 获取当前活动 Sheet ID */
  private getActiveSheetId(): string {
    // 尝试从全局 app 获取
    const app = (window as Record<string, unknown>).app as {
      getSheetManager?: () => { getActiveSheetId: () => string };
    } | undefined;
    return app?.getSheetManager?.()?.getActiveSheetId?.() || 'default';
  }

  /** 加载企业版样式 */
  private loadStyles(): void {
    if (!document.getElementById('enterprise-styles')) {
      const link = document.createElement('link');
      link.id = 'enterprise-styles';
      link.rel = 'stylesheet';
      link.href = '/src/enterprise/enterprise.css';
      document.head.appendChild(link);
    }
  }

  // === 公共 API ===

  /** 获取认证服务 */
  getAuthService(): AuthService { return this.authService; }

  /** 获取权限服务 */
  getPermissionService(): PermissionService { return this.permissionService; }

  /** 获取保护管理器 */
  getProtectionManager(): SheetProtectionManager { return this.protectionManager; }

  /** 获取审计服务 */
  getAuditService(): AuditService { return this.auditService; }

  /** 检查单元格是否可编辑（综合权限+保护） */
  canEditCell(sheetId: string, row: number, col: number): boolean {
    if (!this.permissionService.canEdit()) return false;
    return this.protectionManager.canEditCell(sheetId, row, col);
  }
}
