// ============================================================
// 插件中心 UI
// 提供可视化的插件浏览、安装、管理界面
// ============================================================

import { PluginManager } from './plugin-manager';
import type { PluginInfo } from './plugin-manager';
import { PluginLoader } from './plugin-loader';

/**
 * 插件中心面板
 * 提供插件的可视化管理界面：查看已安装插件、从 URL/本地文件安装、卸载
 */
export class PluginCenter {
  private overlay: HTMLDivElement | null = null;
  private pluginManager: PluginManager;
  private pluginLoader: PluginLoader;
  private onUpdate: (() => void) | null = null;

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager;
    this.pluginLoader = new PluginLoader();
  }

  /** 设置更新回调（插件变更后通知外部） */
  public setUpdateCallback(callback: () => void): void {
    this.onUpdate = callback;
  }

  /** 显示插件中心面板 */
  public show(): void {
    if (this.overlay) return;
    this.overlay = this.createOverlay();
    document.body.appendChild(this.overlay);
    this.render();
  }

  /** 隐藏插件中心面板 */
  public hide(): void {
    if (!this.overlay) return;
    this.overlay.remove();
    this.overlay = null;
  }

  /** 面板是否可见 */
  public isVisible(): boolean {
    return this.overlay !== null;
  }

  /** 创建遮罩层 */
  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) this.hide();
    });
    // Escape 关闭
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return overlay;
  }

  /** 渲染面板内容 */
  private render(): void {
    if (!this.overlay) return;

    const plugins = this.pluginManager.getPlugins();

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog plugin-center-dialog';
    dialog.style.width = '560px';
    dialog.style.maxHeight = '80vh';
    dialog.style.display = 'flex';
    dialog.style.flexDirection = 'column';

    // 阻止事件冒泡
    dialog.addEventListener('mousedown', (e) => e.stopPropagation());

    // 标题栏
    const header = document.createElement('div');
    header.className = 'modal-title';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.innerHTML = `
      <span>插件中心</span>
      <button class="plugin-center-close-btn" title="关闭" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--text-secondary,#666);padding:4px 8px;">✕</button>
    `;
    dialog.appendChild(header);

    // 操作栏
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;gap:8px;padding:12px 20px;border-bottom:1px solid var(--border-color,#e0e0e0);';
    toolbar.innerHTML = `
      <button class="modal-btn modal-confirm-btn plugin-install-url-btn" style="font-size:13px;padding:6px 14px;">从 URL 安装</button>
      <button class="modal-btn modal-confirm-btn plugin-install-file-btn" style="font-size:13px;padding:6px 14px;">从本地文件安装</button>
    `;
    dialog.appendChild(toolbar);

    // 插件列表
    const listContainer = document.createElement('div');
    listContainer.className = 'plugin-center-list';
    listContainer.style.cssText = 'flex:1;overflow-y:auto;padding:12px 20px;';

    if (plugins.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align:center;padding:40px 0;color:var(--text-secondary,#999);">
          <div style="font-size:36px;margin-bottom:12px;">🧩</div>
          <div style="font-size:14px;">暂无已安装插件</div>
          <div style="font-size:12px;margin-top:8px;">点击上方按钮安装插件</div>
        </div>
      `;
    } else {
      for (const plugin of plugins) {
        listContainer.appendChild(this.createPluginCard(plugin));
      }
    }

    dialog.appendChild(listContainer);

    // 清空并添加
    this.overlay!.innerHTML = '';
    this.overlay!.appendChild(dialog);

    // 绑定事件
    this.bindEvents(dialog);
  }

  /** 创建单个插件卡片 */
  private createPluginCard(plugin: PluginInfo): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'plugin-card';
    card.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border:1px solid var(--border-color,#e0e0e0);border-radius:6px;margin-bottom:8px;';

    // 状态颜色和文本
    const statusMap: Record<string, { color: string; text: string }> = {
      active: { color: '#22c55e', text: '运行中' },
      failed: { color: '#ef4444', text: '加载失败' },
      unloaded: { color: '#9ca3af', text: '已卸载' },
    };
    const status = statusMap[plugin.status] ?? { color: '#9ca3af', text: plugin.status };

    card.innerHTML = `
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:14px;font-weight:500;">${this.escapeHtml(plugin.name)}</span>
          <span style="font-size:11px;color:var(--text-secondary,#999);">v${this.escapeHtml(plugin.version)}</span>
          <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${status.color}20;color:${status.color};">${status.text}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        ${plugin.status === 'active' ? `<button class="modal-btn modal-cancel-btn plugin-unload-btn" data-plugin-name="${this.escapeHtml(plugin.name)}" style="font-size:12px;padding:4px 12px;">卸载</button>` : ''}
      </div>
    `;

    return card;
  }

  /** 绑定面板事件 */
  private bindEvents(dialog: HTMLElement): void {
    // 关闭按钮
    dialog.querySelector('.plugin-center-close-btn')?.addEventListener('click', () => {
      this.hide();
    });

    // 从 URL 安装
    dialog.querySelector('.plugin-install-url-btn')?.addEventListener('click', () => {
      this.handleInstallFromURL();
    });

    // 从本地文件安装
    dialog.querySelector('.plugin-install-file-btn')?.addEventListener('click', () => {
      this.handleInstallFromFile();
    });

    // 卸载按钮
    dialog.querySelectorAll('.plugin-unload-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = (e.target as HTMLElement).getAttribute('data-plugin-name');
        if (name) this.handleUnload(name);
      });
    });
  }

  /** 从 URL 安装插件 */
  private async handleInstallFromURL(): Promise<void> {
    // 创建输入对话框
    const url = window.prompt('请输入插件 JS 文件的 URL：');
    if (!url || !url.trim()) return;

    this.showLoading('正在加载插件...');

    const result = await this.pluginLoader.loadFromURL(url.trim());
    if (!result.success || !result.plugin) {
      this.hideLoading();
      window.alert(`安装失败：${result.error ?? '未知错误'}`);
      return;
    }

    try {
      this.pluginManager.registerPlugin(result.plugin);
      this.hideLoading();
      this.render();
      this.onUpdate?.();
    } catch (err) {
      this.hideLoading();
      window.alert(`注册插件失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** 从本地文件安装插件 */
  private async handleInstallFromFile(): Promise<void> {
    const result = await this.pluginLoader.promptLoadFromFile();
    if (!result.success || !result.plugin) {
      if (result.error && result.error !== '未选择文件') {
        window.alert(`安装失败：${result.error}`);
      }
      return;
    }

    try {
      this.pluginManager.registerPlugin(result.plugin);
      this.render();
      this.onUpdate?.();
    } catch (err) {
      window.alert(`注册插件失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** 卸载插件 */
  private handleUnload(name: string): void {
    const confirmed = window.confirm(`确定要卸载插件「${name}」吗？`);
    if (!confirmed) return;

    this.pluginManager.unloadPlugin(name);
    this.render();
    this.onUpdate?.();
  }

  /** 显示加载提示 */
  private showLoading(message: string): void {
    const existing = this.overlay?.querySelector('.plugin-loading-overlay');
    if (existing) existing.remove();

    const loading = document.createElement('div');
    loading.className = 'plugin-loading-overlay';
    loading.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.8);z-index:10;border-radius:8px;';
    loading.innerHTML = `<div style="text-align:center;"><div style="font-size:24px;margin-bottom:8px;">⏳</div><div style="font-size:13px;color:var(--text-secondary,#666);">${this.escapeHtml(message)}</div></div>`;

    const dialog = this.overlay?.querySelector('.plugin-center-dialog');
    if (dialog) {
      (dialog as HTMLElement).style.position = 'relative';
      dialog.appendChild(loading);
    }
  }

  /** 隐藏加载提示 */
  private hideLoading(): void {
    const loading = this.overlay?.querySelector('.plugin-loading-overlay');
    if (loading) loading.remove();
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
    this.hide();
  }
}
