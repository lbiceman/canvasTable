// ============================================================
// ICE Excel 企业版 - 登录页面
// ============================================================

import { AuthService } from './auth-service';

/** 登录页面：渲染统一登录 UI */
export class LoginPage {
  private container: HTMLElement;
  private authService: AuthService;
  private onLoginSuccess: () => void;

  constructor(container: HTMLElement, authService: AuthService, onLoginSuccess: () => void) {
    this.container = container;
    this.authService = authService;
    this.onLoginSuccess = onLoginSuccess;
  }

  /** 渲染登录页面 */
  render(): void {
    this.container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'login-page';
    wrapper.innerHTML = `
      <div class="login-card">
        <h1 class="login-title">ICE Excel 企业版</h1>
        <p class="login-subtitle">安全协作在线表格</p>

        <div class="login-oauth-section">
          <button class="login-btn login-btn-google" data-provider="google">
            <span class="login-btn-icon">G</span>
            谷歌 SSO 登录
          </button>
          <button class="login-btn login-btn-sso" data-provider="saml">
            <span class="login-btn-icon">🔐</span>
            企业 SSO (SAML)
          </button>
        </div>

        <div class="login-divider">
          <span>或使用邮箱密码登录</span>
        </div>

        <form class="login-form" id="login-form">
          <div class="login-field">
            <label for="login-email">邮箱</label>
            <input type="email" id="login-email" placeholder="请输入邮箱" required autocomplete="username" />
          </div>
          <div class="login-field">
            <label for="login-password">密码</label>
            <input type="password" id="login-password" placeholder="请输入密码" required autocomplete="current-password" />
          </div>
          <div class="login-error" id="login-error" role="alert" aria-live="polite"></div>
          <button type="submit" class="login-btn login-btn-primary" id="login-submit">
            登录
          </button>
        </form>

        <p class="login-footer">支持: OAuth 2.0 | SAML 2.0 | OIDC</p>
      </div>
    `;

    this.container.appendChild(wrapper);
    this.bindEvents();
  }

  /** 绑定事件 */
  private bindEvents(): void {
    // 邮箱密码登录
    const form = document.getElementById('login-form') as HTMLFormElement;
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('login-email') as HTMLInputElement).value;
      const password = (document.getElementById('login-password') as HTMLInputElement).value;
      const errorEl = document.getElementById('login-error');
      const submitBtn = document.getElementById('login-submit') as HTMLButtonElement;

      submitBtn.disabled = true;
      submitBtn.textContent = '登录中...';

      const result = await this.authService.login({ email, password });

      if (result.success) {
        this.onLoginSuccess();
      } else {
        if (errorEl) {
          errorEl.textContent = result.error || '登录失败';
          errorEl.style.display = 'block';
        }
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
      }
    });

    // OAuth2 登录
    const googleBtn = this.container.querySelector('[data-provider="google"]');
    googleBtn?.addEventListener('click', () => {
      this.authService.startOAuth2Login('google');
    });

    // SAML SSO 登录
    const samlBtn = this.container.querySelector('[data-provider="saml"]');
    samlBtn?.addEventListener('click', () => {
      this.authService.startSAMLLogin();
    });
  }

  /** 销毁登录页面 */
  destroy(): void {
    this.container.innerHTML = '';
  }
}
