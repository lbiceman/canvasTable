// ============================================================
// ValidationDialog - 数据验证设置对话框
// 支持下拉列表、数值范围、文本长度、自定义表达式四种验证类型
// UI 风格与 FormatDialog 保持一致
// ============================================================

import type { ValidationRule } from './types';

/** 确认回调：传入验证规则，undefined 表示清除验证 */
export type ValidationDialogCallback = (rule: ValidationRule | undefined) => void;

export class ValidationDialog {
  private overlay: HTMLDivElement | null = null;
  private values: Partial<ValidationRule> = {};
  private onConfirm: ValidationDialogCallback | null = null;

  /**
   * 打开数据验证对话框
   * @param initialRule 当前单元格已有的验证规则（可选）
   * @param callback 确认回调
   */
  open(initialRule: ValidationRule | undefined, callback: ValidationDialogCallback): void {
    this.close();
    this.values = initialRule ? { ...initialRule } : { type: 'dropdown', mode: 'block' };
    this.onConfirm = callback;
    this.render();
  }

  /** 关闭对话框 */
  close(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.onConfirm = null;
  }

  /** 渲染对话框 */
  private render(): void {
    // 遮罩层
    this.overlay = document.createElement('div');
    this.overlay.className = 'format-dialog-overlay';
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // 对话框容器
    const dialog = document.createElement('div');
    dialog.className = 'format-dialog';
    dialog.style.width = '500px';

    // 标题栏
    const titleBar = document.createElement('div');
    titleBar.className = 'format-dialog-title';
    titleBar.textContent = '数据验证';
    const closeBtn = document.createElement('span');
    closeBtn.className = 'format-dialog-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());
    titleBar.appendChild(closeBtn);
    dialog.appendChild(titleBar);

    // 内容区
    const content = document.createElement('div');
    content.className = 'format-dialog-content';
    content.appendChild(this.buildContent());
    dialog.appendChild(content);

    // 底部按钮
    const footer = document.createElement('div');
    footer.className = 'format-dialog-footer';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'format-dialog-btn';
    clearBtn.textContent = '清除验证';
    clearBtn.addEventListener('click', () => {
      if (this.onConfirm) this.onConfirm(undefined);
      this.close();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'format-dialog-btn';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => this.close());

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'format-dialog-btn format-dialog-btn-primary';
    confirmBtn.textContent = '确定';
    confirmBtn.addEventListener('click', () => {
      const rule = this.buildRule();
      if (rule && this.onConfirm) this.onConfirm(rule);
      this.close();
    });

    footer.appendChild(clearBtn);
    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    dialog.appendChild(footer);

    this.overlay.appendChild(dialog);
    document.body.appendChild(this.overlay);

    // Escape 关闭
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleKey);
      }
    };
    document.addEventListener('keydown', handleKey);
  }

  /** 构建对话框内容 */
  private buildContent(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'format-dialog-tab-panel';

    // 验证类型选择
    const typeSelect = this.createSelect(
      [
        { value: 'dropdown', label: '下拉列表' },
        { value: 'numberRange', label: '数值范围' },
        { value: 'textLength', label: '文本长度' },
        { value: 'custom', label: '自定义表达式' },
      ],
      this.values.type || 'dropdown',
      (v) => {
        this.values.type = v as ValidationRule['type'];
        this.refreshParams(container);
      }
    );
    container.appendChild(this.createRow('验证类型：', typeSelect));

    // 验证模式
    const modeSelect = this.createSelect(
      [
        { value: 'block', label: '阻止输入' },
        { value: 'warning', label: '仅警告' },
      ],
      this.values.mode || 'block',
      (v) => { this.values.mode = v as 'block' | 'warning'; }
    );
    container.appendChild(this.createRow('验证模式：', modeSelect));

    // 参数区域（根据类型动态变化）
    const paramsContainer = document.createElement('div');
    paramsContainer.className = 'validation-params';
    this.buildParams(paramsContainer);
    container.appendChild(paramsContainer);

    // 分隔线
    const hr = document.createElement('hr');
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid var(--theme-grid-line)';
    hr.style.margin = '8px 0';
    container.appendChild(hr);

    // 输入提示
    const inputTitleInput = this.createInput('输入提示标题', this.values.inputTitle || '', (v) => { this.values.inputTitle = v; });
    container.appendChild(this.createRow('输入提示标题：', inputTitleInput));

    const inputMsgInput = this.createInput('输入提示内容', this.values.inputMessage || '', (v) => { this.values.inputMessage = v; });
    container.appendChild(this.createRow('输入提示内容：', inputMsgInput));

    // 错误提示
    const errorTitleInput = this.createInput('错误提示标题', this.values.errorTitle || '', (v) => { this.values.errorTitle = v; });
    container.appendChild(this.createRow('错误提示标题：', errorTitleInput));

    const errorMsgInput = this.createInput('错误提示内容', this.values.errorMessage || '', (v) => { this.values.errorMessage = v; });
    container.appendChild(this.createRow('错误提示内容：', errorMsgInput));

    return container;
  }

  /** 根据验证类型构建参数输入区域 */
  private buildParams(container: HTMLElement): void {
    container.innerHTML = '';
    const type = this.values.type || 'dropdown';

    switch (type) {
      case 'dropdown': {
        const optionsInput = this.createInput(
          '选项（逗号分隔）',
          (this.values.options || []).join(', '),
          (v) => { this.values.options = v.split(',').map(s => s.trim()).filter(s => s); }
        );
        container.appendChild(this.createRow('下拉选项：', optionsInput));
        break;
      }
      case 'numberRange': {
        const minInput = this.createInput('最小值', this.values.min !== undefined ? String(this.values.min) : '', (v) => {
          this.values.min = v ? Number(v) : undefined;
        });
        container.appendChild(this.createRow('最小值：', minInput));

        const maxInput = this.createInput('最大值', this.values.max !== undefined ? String(this.values.max) : '', (v) => {
          this.values.max = v ? Number(v) : undefined;
        });
        container.appendChild(this.createRow('最大值：', maxInput));
        break;
      }
      case 'textLength': {
        const minInput = this.createInput('最小长度', this.values.min !== undefined ? String(this.values.min) : '', (v) => {
          this.values.min = v ? Number(v) : undefined;
        });
        container.appendChild(this.createRow('最小长度：', minInput));

        const maxInput = this.createInput('最大长度', this.values.max !== undefined ? String(this.values.max) : '', (v) => {
          this.values.max = v ? Number(v) : undefined;
        });
        container.appendChild(this.createRow('最大长度：', maxInput));
        break;
      }
      case 'custom': {
        const exprInput = this.createInput(
          '如 =AND(A1>0, A1<100)',
          this.values.customExpression || '',
          (v) => { this.values.customExpression = v; }
        );
        container.appendChild(this.createRow('公式表达式：', exprInput));
        break;
      }
    }
  }

  /** 刷新参数区域 */
  private refreshParams(container: HTMLElement): void {
    const paramsEl = container.querySelector('.validation-params');
    if (paramsEl) this.buildParams(paramsEl as HTMLElement);
  }

  /** 从当前值构建验证规则 */
  private buildRule(): ValidationRule | null {
    const type = this.values.type || 'dropdown';
    const mode = this.values.mode || 'block';

    const rule: ValidationRule = { type, mode };

    if (type === 'dropdown') {
      rule.options = this.values.options || [];
    } else if (type === 'numberRange' || type === 'textLength') {
      if (this.values.min !== undefined) rule.min = this.values.min;
      if (this.values.max !== undefined) rule.max = this.values.max;
    } else if (type === 'custom') {
      rule.customExpression = this.values.customExpression || '';
    }

    if (this.values.inputTitle) rule.inputTitle = this.values.inputTitle;
    if (this.values.inputMessage) rule.inputMessage = this.values.inputMessage;
    if (this.values.errorTitle) rule.errorTitle = this.values.errorTitle;
    if (this.values.errorMessage) rule.errorMessage = this.values.errorMessage;

    return rule;
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /** 创建一行：标签 + 控件 */
  private createRow(labelText: string, control: HTMLElement): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'format-dialog-row';
    const label = document.createElement('label');
    label.className = 'format-dialog-label';
    label.textContent = labelText;
    row.appendChild(label);
    row.appendChild(control);
    return row;
  }

  /** 创建下拉选择框 */
  private createSelect(
    options: { value: string; label: string }[],
    currentValue: string,
    onChange: (v: string) => void
  ): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'format-dialog-select';
    options.forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if (value === currentValue) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => onChange(select.value));
    return select;
  }

  /** 创建文本输入框 */
  private createInput(placeholder: string, value: string, onChange: (v: string) => void): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'format-dialog-input';
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener('input', () => onChange(input.value));
    return input;
  }
}
