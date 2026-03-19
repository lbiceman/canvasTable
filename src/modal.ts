// ============================================================
// 通用 Modal 弹窗组件
// 替代浏览器原生 alert()、confirm()、prompt()
// ============================================================

/**
 * Modal 配置选项
 */
export interface ModalOptions {
  /** 弹窗标题 */
  title?: string;
  /** 文本内容 */
  message?: string;
  /** 确认按钮文本，默认「确定」 */
  confirmText?: string;
  /** 取消按钮文本，默认「取消」 */
  cancelText?: string;
  /** 自定义 DOM 内容（替代 message） */
  customContent?: HTMLElement;
  /** 是否显示取消按钮，默认 true */
  showCancel?: boolean;
  /** prompt 模式的输入框默认值 */
  inputDefault?: string;
  /** prompt 模式的输入框占位文本 */
  inputPlaceholder?: string;
}

/** 弹窗模式 */
type ModalMode = 'alert' | 'confirm' | 'prompt' | 'custom';

/**
 * 通用 Modal 弹窗类
 * 提供 alert、confirm、prompt、custom 四种静态方法
 */
export class Modal {
  /**
   * 信息提示弹窗（替代 alert）
   * @param message 提示信息
   * @param options 可选配置
   */
  static alert(message: string, options?: Partial<ModalOptions>): Promise<void> {
    return Modal.show(
      { ...options, message, showCancel: false },
      'alert'
    ).then(() => undefined);
  }

  /**
   * 确认对话框（替代 confirm）
   * @param message 确认信息
   * @param options 可选配置
   */
  static confirm(message: string, options?: Partial<ModalOptions>): Promise<boolean> {
    return Modal.show(
      { ...options, message },
      'confirm'
    ).then((result) => result === true);
  }

  /**
   * 输入对话框（替代 prompt）
   * @param message 提示信息
   * @param options 可选配置
   */
  static prompt(message: string, options?: Partial<ModalOptions>): Promise<string | null> {
    return Modal.show(
      { ...options, message },
      'prompt'
    ).then((result) => {
      if (typeof result === 'string') return result;
      return null;
    });
  }

  /**
   * 自定义内容弹窗（用于复杂表单场景）
   * @param options 配置选项，需包含 customContent
   */
  static custom(options: ModalOptions): Promise<boolean> {
    return Modal.show(options, 'custom').then((result) => result === true);
  }

  /**
   * 内部核心方法：创建并显示弹窗
   * @param options 配置选项
   * @param mode 弹窗模式
   * @returns Promise，根据模式返回不同类型的结果
   */
  private static show(
    options: ModalOptions,
    mode: ModalMode
  ): Promise<string | boolean | null> {
    return new Promise((resolve) => {
      const overlay = Modal.createOverlay();
      const dialog = Modal.createDialog(options, mode);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // 获取输入框引用（prompt 模式）
      const input = dialog.querySelector<HTMLInputElement>('.modal-input');
      // 获取确认按钮引用
      const confirmBtn = dialog.querySelector<HTMLButtonElement>('.modal-confirm-btn');

      /** 确认操作 */
      const handleConfirm = (): void => {
        cleanup();
        if (mode === 'prompt') {
          resolve(input ? input.value : '');
        } else if (mode === 'alert') {
          resolve(null);
        } else {
          resolve(true);
        }
      };

      /** 取消操作 */
      const handleCancel = (): void => {
        cleanup();
        if (mode === 'alert') {
          resolve(null);
        } else if (mode === 'prompt') {
          resolve(null);
        } else {
          resolve(false);
        }
      };

      /** 清理 DOM 和事件监听 */
      const cleanup = (): void => {
        document.removeEventListener('keydown', handleKeyDown);
        Modal.destroy(overlay);
      };

      /** 键盘事件处理 */
      const handleKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Enter') {
          // 避免在自定义内容中的 textarea 等元素中触发
          const target = e.target as HTMLElement;
          if (target.tagName === 'TEXTAREA') return;
          e.preventDefault();
          handleConfirm();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      };

      // 绑定键盘事件
      document.addEventListener('keydown', handleKeyDown);

      // 点击遮罩关闭（等同取消）
      overlay.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.target === overlay) {
          handleCancel();
        }
      });

      // 绑定按钮事件
      confirmBtn?.addEventListener('click', handleConfirm);
      const cancelBtn = dialog.querySelector<HTMLButtonElement>('.modal-cancel-btn');
      cancelBtn?.addEventListener('click', handleCancel);

      // 自动聚焦：prompt 模式聚焦输入框，其他模式聚焦确认按钮
      requestAnimationFrame(() => {
        if (mode === 'prompt' && input) {
          input.focus();
          input.select();
        } else if (confirmBtn) {
          confirmBtn.focus();
        }
      });
    });
  }

  /**
   * 创建半透明遮罩层
   */
  private static createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    return overlay;
  }

  /**
   * 创建对话框 DOM 结构
   * @param options 配置选项
   * @param mode 弹窗模式
   */
  private static createDialog(options: ModalOptions, mode: ModalMode): HTMLDivElement {
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';

    const confirmText = options.confirmText ?? '确定';
    const cancelText = options.cancelText ?? '取消';
    const showCancel = options.showCancel !== false;

    // 标题区域
    if (options.title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'modal-title';
      titleEl.textContent = options.title;
      dialog.appendChild(titleEl);
    }

    // 内容区域
    const body = document.createElement('div');
    body.className = 'modal-body';

    if (mode === 'custom' && options.customContent) {
      // 自定义内容模式
      body.appendChild(options.customContent);
    } else if (options.message) {
      // 文本消息
      const messageEl = document.createElement('div');
      messageEl.className = 'modal-message';
      messageEl.textContent = options.message;
      body.appendChild(messageEl);
    }

    // prompt 模式的输入框
    if (mode === 'prompt') {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'modal-input';
      input.value = options.inputDefault ?? '';
      if (options.inputPlaceholder) {
        input.placeholder = options.inputPlaceholder;
      }
      body.appendChild(input);
    }

    dialog.appendChild(body);

    // 按钮区域
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    if (showCancel && mode !== 'alert') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'modal-btn modal-cancel-btn';
      cancelBtn.textContent = cancelText;
      footer.appendChild(cancelBtn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'modal-btn modal-confirm-btn';
    confirmBtn.textContent = confirmText;
    footer.appendChild(confirmBtn);

    dialog.appendChild(footer);

    return dialog;
  }

  /**
   * 销毁弹窗，移除 DOM
   * @param overlay 遮罩层元素
   */
  private static destroy(overlay: HTMLDivElement): void {
    overlay.classList.add('modal-closing');
    // 等待动画完成后移除 DOM
    const handleTransitionEnd = (): void => {
      overlay.removeEventListener('transitionend', handleTransitionEnd);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };
    overlay.addEventListener('transitionend', handleTransitionEnd);
    // 兜底：如果动画未触发，200ms 后强制移除
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 200);
  }
}
