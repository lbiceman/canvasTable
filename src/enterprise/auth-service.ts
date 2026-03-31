// ============================================================
// ICE Excel 企业版 - 认证服务
// ============================================================

import { AuthUser, LoginRequest, LoginResponse } from './types';

/** 认证服务：管理登录状态、Token 刷新 */
export class AuthService {
  private currentUser: AuthUser | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly API_BASE: string;
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 5 * 60 * 1000; // 5 分钟
  private loginAttempts = 0;
  private lockoutUntil = 0;
  private onAuthChange: ((user: AuthUser | null) => void) | null = null;

  constructor(apiBase: string = '/api') {
    this.API_BASE = apiBase;
    this.restoreSession();
  }

  /** 注册认证状态变更回调 */
  setOnAuthChange(callback: (user: AuthUser | null) => void): void {
    this.onAuthChange = callback;
  }

  /** 邮箱密码登录 */
  async login(request: LoginRequest): Promise<LoginResponse> {
    // 检查锁定状态
    if (Date.now() < this.lockoutUntil) {
      const remaining = Math.ceil((this.lockoutUntil - Date.now()) / 1000);
      return {
        success: false,
        error: `账号已锁定，请 ${remaining} 秒后重试`,
        lockoutUntil: this.lockoutUntil,
      };
    }

    try {
      const response = await fetch(`${this.API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const data = await response.json() as LoginResponse;

      if (data.success && data.user) {
        this.loginAttempts = 0;
        this.setCurrentUser(data.user);
        this.scheduleTokenRefresh();
        return data;
      }

      // 登录失败，增加尝试次数
      this.loginAttempts++;
      if (this.loginAttempts >= this.MAX_ATTEMPTS) {
        this.lockoutUntil = Date.now() + this.LOCKOUT_DURATION;
        this.loginAttempts = 0;
        return {
          success: false,
          error: '密码错误次数过多，账号已锁定 5 分钟',
          lockoutUntil: this.lockoutUntil,
        };
      }

      return {
        success: false,
        error: data.error || `登录失败（剩余 ${this.MAX_ATTEMPTS - this.loginAttempts} 次尝试）`,
      };
    } catch {
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  /** OAuth2 登录跳转 */
  startOAuth2Login(provider: 'google' | 'microsoft' | 'feishu'): void {
    window.location.href = `${this.API_BASE}/auth/oauth2/${provider}`;
  }

  /** SAML SSO 登录跳转 */
  startSAMLLogin(): void {
    window.location.href = `${this.API_BASE}/auth/saml/login`;
  }

  /** 登出 */
  async logout(): Promise<void> {
    if (this.currentUser) {
      try {
        await fetch(`${this.API_BASE}/auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
        });
      } catch {
        // 忽略登出请求失败
      }
    }
    this.clearSession();
  }

  /** 获取当前用户 */
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /** 是否已登录 */
  isAuthenticated(): boolean {
    return this.currentUser !== null && Date.now() < this.currentUser.tokenExpiry;
  }

  /** 获取认证请求头 */
  getAuthHeaders(): Record<string, string> {
    if (!this.currentUser) return {};
    return { 'Authorization': `Bearer ${this.currentUser.token}` };
  }

  /** 从 localStorage 恢复会话 */
  private restoreSession(): void {
    try {
      const stored = localStorage.getItem('ice_excel_auth');
      if (stored) {
        const user = JSON.parse(stored) as AuthUser;
        if (Date.now() < user.tokenExpiry) {
          this.currentUser = user;
          this.scheduleTokenRefresh();
          this.onAuthChange?.(user);
        } else {
          localStorage.removeItem('ice_excel_auth');
        }
      }
    } catch {
      localStorage.removeItem('ice_excel_auth');
    }
  }

  /** 设置当前用户并持久化 */
  private setCurrentUser(user: AuthUser): void {
    this.currentUser = user;
    localStorage.setItem('ice_excel_auth', JSON.stringify(user));
    this.onAuthChange?.(user);
  }

  /** 清除会话 */
  private clearSession(): void {
    this.currentUser = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    localStorage.removeItem('ice_excel_auth');
    this.onAuthChange?.(null);
  }

  /** 定时刷新 Token */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (!this.currentUser) return;

    // 在 Token 过期前 5 分钟刷新
    const refreshIn = this.currentUser.tokenExpiry - Date.now() - 5 * 60 * 1000;
    if (refreshIn <= 0) {
      this.refreshToken();
      return;
    }

    this.refreshTimer = setTimeout(() => this.refreshToken(), refreshIn);
  }

  /** 刷新 Token */
  private async refreshToken(): Promise<void> {
    if (!this.currentUser?.refreshToken) {
      this.clearSession();
      return;
    }

    try {
      const response = await fetch(`${this.API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.currentUser.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json() as { token: string; refreshToken: string; expiry: number };
        this.setCurrentUser({
          ...this.currentUser,
          token: data.token,
          refreshToken: data.refreshToken,
          tokenExpiry: data.expiry,
        });
        this.scheduleTokenRefresh();
      } else {
        this.clearSession();
      }
    } catch {
      this.clearSession();
    }
  }
}
