import type { PasteSpecialMode } from './types';

/**
 * 选择性粘贴对话框
 * 提供"仅粘贴值"、"仅粘贴格式"、"仅粘贴公式"、"转置粘贴"四个选项
 */
export class PasteSpecialDialog {
  private overlay: HTMLDivElement;
  private dialog: HTMLDivElement;
  private onSelect: ((mode: PasteSpecialMode) => void) | null = null;

  /** 粘贴选项配置 */
  private static readonly OPTIONS: ReadonlyArray<{ mode: PasteSpecialMode; label: string; icon: string }> = [
    { mode: 'values', label: '仅粘贴值', icon: '📋' },
    { mode: 'formats', label: '仅粘贴格式', icon: '🎨' },
    { mode: 'formulas', label: '仅粘贴公式', icon: '📐' },
    { mode: 'transpose', label: '转置粘贴', icon: '🔄' },
  ];

  constructor() {
    this.overlay = this.createOverlay();
    this.dialog = this.createDialog();
    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);
    this.bindEvents();
  }

  /** 创建遮罩层 */
  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'paste-special-overlay';
    overlay.style.display = 'none';
    return overlay;
  }

  /** 创建对话框 DOM */
  private createDialog(): HTMLDivElement {
    const dialog = document.createElement('div');
    dialog.className = 'paste-special-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', '选择性粘贴');

    const title = document.createElement('div');
    title.className = 'paste-special-title';
    title.textContent = '选择性粘贴';
    dialog.appendChild(title);

    const optionsList = document.createElement('div');
    optionsList.className = 'paste-special-options';

    for (const option of PasteSpecialDialog.OPTIONS) {
      const btn = document.createElement('button');
      btn.className = 'paste-special-option';
      btn.dataset['mode'] = option.mode;
      btn.setAttribute('type', 'button');

      const icon = document.createElement('span');
      icon.className = 'paste-special-option-icon';
      icon.textContent = option.icon;

      const label = document.createElement('span');
      label.className = 'paste-special-option-label';
      label.textContent = option.label;

      btn.appendChild(icon);
      btn.appendChild(label);
      optionsList.appendChild(btn);
    }

    dialog.appendChild(optionsList);
    return dialog;
  }

  /** 绑定事件 */
  private bindEvents(): void {
    // 点击遮罩层关闭对话框
    this.overlay.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // 选项按钮点击
    const buttons = this.dialog.querySelectorAll('.paste-special-option');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLButtonElement).dataset['mode'] as PasteSpecialMode;
        if (mode && this.onSelect) {
          this.onSelect(mode);
        }
        this.hide();
      });
    });

    // Escape 键关闭对话框
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /** 键盘事件处理 */
  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hide();
    }
  }

  /** 显示对话框 */
  public show(): void {
    this.overlay.style.display = 'flex';
    document.addEventListener('keydown', this.handleKeyDown);
    // 聚焦第一个选项按钮
    const firstBtn = this.dialog.querySelector('.paste-special-option') as HTMLButtonElement | null;
    firstBtn?.focus();
  }

  /** 隐藏对话框 */
  public hide(): void {
    this.overlay.style.display = 'none';
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  /** 设置选项选择回调 */
  public setSelectHandler(handler: (mode: PasteSpecialMode) => void): void {
    this.onSelect = handler;
  }
}
