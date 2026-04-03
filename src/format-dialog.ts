// ============================================================
// FormatDialog - 单元格格式对话框
// 提供数字格式、对齐、字体、边框、填充的统一设置面板
// ============================================================

import type { FormatCategory, CellBorder, BorderSide } from './types';

/** 格式对话框的当前设置值 */
export interface FormatDialogValues {
  // 数字格式
  formatCategory?: FormatCategory;
  formatPattern?: string;
  currencySymbol?: string;
  // 对齐
  fontAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  wrapText?: boolean;
  // 字体
  fontFamily?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontStrikethrough?: boolean;
  fontColor?: string;
  // 边框
  border?: CellBorder;
  // 填充
  bgColor?: string;
}

/** 确认回调 */
export type FormatDialogCallback = (values: FormatDialogValues) => void;

export class FormatDialog {
  private overlay: HTMLDivElement | null = null;
  private currentTab = 'number';
  private values: FormatDialogValues = {};
  private onConfirm: FormatDialogCallback | null = null;

  /**
   * 打开格式对话框
   * @param initialValues 当前单元格的格式值
   * @param callback 确认回调
   */
  open(initialValues: FormatDialogValues, callback: FormatDialogCallback): void {
    this.close();
    this.values = { ...initialValues };
    this.onConfirm = callback;
    this.currentTab = 'number';
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

    // 标题栏
    const titleBar = document.createElement('div');
    titleBar.className = 'format-dialog-title';
    titleBar.textContent = '设置单元格格式';
    const closeBtn = document.createElement('span');
    closeBtn.className = 'format-dialog-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());
    titleBar.appendChild(closeBtn);
    dialog.appendChild(titleBar);

    // 选项卡导航
    const tabBar = document.createElement('div');
    tabBar.className = 'format-dialog-tabs';
    const tabs = [
      { id: 'number', label: '数字' },
      { id: 'alignment', label: '对齐' },
      { id: 'font', label: '字体' },
      { id: 'border', label: '边框' },
      { id: 'fill', label: '填充' },
    ];
    tabs.forEach(({ id, label }) => {
      const tab = document.createElement('div');
      tab.className = `format-dialog-tab${this.currentTab === id ? ' active' : ''}`;
      tab.textContent = label;
      tab.addEventListener('click', () => {
        this.currentTab = id;
        this.refreshContent(dialog);
      });
      tabBar.appendChild(tab);
    });
    dialog.appendChild(tabBar);

    // 内容区
    const content = document.createElement('div');
    content.className = 'format-dialog-content';
    content.appendChild(this.buildTabContent());
    dialog.appendChild(content);

    // 底部按钮
    const footer = document.createElement('div');
    footer.className = 'format-dialog-footer';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'format-dialog-btn';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => this.close());
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'format-dialog-btn format-dialog-btn-primary';
    confirmBtn.textContent = '确定';
    confirmBtn.addEventListener('click', () => {
      if (this.onConfirm) this.onConfirm(this.values);
      this.close();
    });
    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    dialog.appendChild(footer);

    this.overlay.appendChild(dialog);
    document.body.appendChild(this.overlay);

    // 键盘事件：Escape 关闭
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleKey);
      }
    };
    document.addEventListener('keydown', handleKey);
  }

  /** 刷新选项卡导航和内容区 */
  private refreshContent(dialog: HTMLDivElement): void {
    // 更新选项卡激活状态
    const tabEls = dialog.querySelectorAll('.format-dialog-tab');
    const tabIds = ['number', 'alignment', 'font', 'border', 'fill'];
    tabEls.forEach((el, i) => {
      el.className = `format-dialog-tab${this.currentTab === tabIds[i] ? ' active' : ''}`;
    });
    // 替换内容区
    const content = dialog.querySelector('.format-dialog-content');
    if (content) {
      content.innerHTML = '';
      content.appendChild(this.buildTabContent());
    }
  }

  /** 根据当前选项卡构建内容 */
  private buildTabContent(): HTMLDivElement {
    switch (this.currentTab) {
      case 'number': return this.buildNumberTab();
      case 'alignment': return this.buildAlignmentTab();
      case 'font': return this.buildFontTab();
      case 'border': return this.buildBorderTab();
      case 'fill': return this.buildFillTab();
      default: return this.buildNumberTab();
    }
  }

  // ============================================================
  // 辅助方法：创建表单行
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
  private createSelect(options: { value: string; label: string }[], currentValue: string, onChange: (v: string) => void): HTMLSelectElement {
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

  /** 创建复选框 */
  private createCheckbox(labelText: string, checked: boolean, onChange: (v: boolean) => void): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'format-dialog-checkbox';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.addEventListener('change', () => onChange(cb.checked));
    const lbl = document.createElement('span');
    lbl.textContent = labelText;
    wrapper.appendChild(cb);
    wrapper.appendChild(lbl);
    return wrapper;
  }

  // ============================================================
  // 数字格式选项卡
  // ============================================================

  private buildNumberTab(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'format-dialog-tab-panel';

    // 格式类别
    const categoryOptions = [
      { value: 'general', label: '常规' },
      { value: 'number', label: '数值' },
      { value: 'currency', label: '货币' },
      { value: 'percentage', label: '百分比' },
      { value: 'scientific', label: '科学计数' },
      { value: 'date', label: '日期' },
      { value: 'time', label: '时间' },
      { value: 'custom', label: '自定义' },
    ];
    const categorySelect = this.createSelect(
      categoryOptions,
      this.values.formatCategory || 'general',
      (v) => { this.values.formatCategory = v as FormatCategory; }
    );
    container.appendChild(this.createRow('分类：', categorySelect));

    // 格式模式
    const patternInput = document.createElement('input');
    patternInput.type = 'text';
    patternInput.className = 'format-dialog-input';
    patternInput.value = this.values.formatPattern || '';
    patternInput.placeholder = '例如: #,##0.00';
    patternInput.addEventListener('input', () => {
      this.values.formatPattern = patternInput.value;
    });
    container.appendChild(this.createRow('格式代码：', patternInput));

    // 货币符号
    const currencySelect = this.createSelect(
      [
        { value: '¥', label: '¥ 人民币' },
        { value: '$', label: '$ 美元' },
        { value: '€', label: '€ 欧元' },
        { value: '£', label: '£ 英镑' },
      ],
      this.values.currencySymbol || '¥',
      (v) => { this.values.currencySymbol = v; }
    );
    container.appendChild(this.createRow('货币符号：', currencySelect));

    return container;
  }

  // ============================================================
  // 对齐选项卡
  // ============================================================

  private buildAlignmentTab(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'format-dialog-tab-panel';

    // 水平对齐
    const hAlignSelect = this.createSelect(
      [
        { value: 'left', label: '左对齐' },
        { value: 'center', label: '居中' },
        { value: 'right', label: '右对齐' },
      ],
      this.values.fontAlign || 'left',
      (v) => { this.values.fontAlign = v as 'left' | 'center' | 'right'; }
    );
    container.appendChild(this.createRow('水平对齐：', hAlignSelect));

    // 垂直对齐
    const vAlignSelect = this.createSelect(
      [
        { value: 'top', label: '顶端对齐' },
        { value: 'middle', label: '垂直居中' },
        { value: 'bottom', label: '底端对齐' },
      ],
      this.values.verticalAlign || 'bottom',
      (v) => { this.values.verticalAlign = v as 'top' | 'middle' | 'bottom'; }
    );
    container.appendChild(this.createRow('垂直对齐：', vAlignSelect));

    // 自动换行
    container.appendChild(
      this.createCheckbox('自动换行', !!this.values.wrapText, (v) => { this.values.wrapText = v; })
    );

    return container;
  }

  // ============================================================
  // 字体选项卡
  // ============================================================

  private buildFontTab(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'format-dialog-tab-panel';

    // 字体族
    const fontFamilySelect = this.createSelect(
      [
        { value: 'Arial', label: 'Arial' },
        { value: 'Helvetica', label: 'Helvetica' },
        { value: 'Times New Roman', label: 'Times New Roman' },
        { value: 'Courier New', label: 'Courier New' },
        { value: 'Microsoft YaHei', label: '微软雅黑' },
        { value: 'SimSun', label: '宋体' },
        { value: 'SimHei', label: '黑体' },
        { value: 'KaiTi', label: '楷体' },
      ],
      this.values.fontFamily || 'Arial',
      (v) => { this.values.fontFamily = v; }
    );
    container.appendChild(this.createRow('字体：', fontFamilySelect));

    // 字号
    const sizeInput = document.createElement('input');
    sizeInput.type = 'number';
    sizeInput.className = 'format-dialog-input';
    sizeInput.min = '6';
    sizeInput.max = '72';
    sizeInput.value = String(this.values.fontSize || 13);
    sizeInput.addEventListener('change', () => {
      this.values.fontSize = parseInt(sizeInput.value, 10) || 13;
    });
    container.appendChild(this.createRow('字号：', sizeInput));

    // 字体样式复选框
    container.appendChild(
      this.createCheckbox('加粗', !!this.values.fontBold, (v) => { this.values.fontBold = v; })
    );
    container.appendChild(
      this.createCheckbox('斜体', !!this.values.fontItalic, (v) => { this.values.fontItalic = v; })
    );
    container.appendChild(
      this.createCheckbox('下划线', !!this.values.fontUnderline, (v) => { this.values.fontUnderline = v; })
    );
    container.appendChild(
      this.createCheckbox('删除线', !!this.values.fontStrikethrough, (v) => { this.values.fontStrikethrough = v; })
    );

    // 字体颜色
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'format-dialog-color';
    colorInput.value = this.values.fontColor || '#000000';
    colorInput.addEventListener('input', () => {
      this.values.fontColor = colorInput.value;
    });
    container.appendChild(this.createRow('字体颜色：', colorInput));

    return container;
  }

  // ============================================================
  // 边框选项卡
  // ============================================================

  private buildBorderTab(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'format-dialog-tab-panel';

    const sides: { key: keyof CellBorder; label: string }[] = [
      { key: 'top', label: '上边框' },
      { key: 'bottom', label: '下边框' },
      { key: 'left', label: '左边框' },
      { key: 'right', label: '右边框' },
    ];

    if (!this.values.border) {
      this.values.border = {};
    }

    sides.forEach(({ key, label }) => {
      const sideRow = document.createElement('div');
      sideRow.className = 'format-dialog-border-side';

      const sideLabel = document.createElement('span');
      sideLabel.className = 'format-dialog-border-label';
      sideLabel.textContent = label;
      sideRow.appendChild(sideLabel);

      const current: BorderSide | undefined = this.values.border?.[key];

      // 线型选择
      const styleSelect = this.createSelect(
        [
          { value: '', label: '无' },
          { value: 'solid', label: '实线' },
          { value: 'dashed', label: '虚线' },
          { value: 'dotted', label: '点线' },
          { value: 'double', label: '双线' },
        ],
        current?.style || '',
        (v) => {
          if (!v) {
            if (this.values.border) delete this.values.border[key];
          } else {
            if (!this.values.border) this.values.border = {};
            this.values.border[key] = {
              style: v as BorderSide['style'],
              color: this.values.border[key]?.color || '#000000',
              width: this.values.border[key]?.width || 1,
            };
          }
        }
      );
      sideRow.appendChild(styleSelect);

      // 颜色选择
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'format-dialog-color';
      colorInput.value = current?.color || '#000000';
      colorInput.addEventListener('input', () => {
        if (this.values.border?.[key]) {
          this.values.border[key]!.color = colorInput.value;
        }
      });
      sideRow.appendChild(colorInput);

      container.appendChild(sideRow);
    });

    return container;
  }

  // ============================================================
  // 填充选项卡
  // ============================================================

  private buildFillTab(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'format-dialog-tab-panel';

    // 背景颜色
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'format-dialog-color format-dialog-color-large';
    colorInput.value = this.values.bgColor || '#ffffff';
    colorInput.addEventListener('input', () => {
      this.values.bgColor = colorInput.value;
      if (preview) preview.style.backgroundColor = colorInput.value;
    });
    container.appendChild(this.createRow('背景颜色：', colorInput));

    // 预设颜色
    const presetColors = [
      '#ffffff', '#f2f2f2', '#d9d9d9', '#bfbfbf', '#808080', '#000000',
      '#ff0000', '#ff6600', '#ffcc00', '#33cc33', '#3399ff', '#9933ff',
      '#ffcccc', '#ffe0cc', '#fff5cc', '#ccffcc', '#cce5ff', '#e5ccff',
    ];
    const presetGrid = document.createElement('div');
    presetGrid.className = 'format-dialog-color-grid';
    presetColors.forEach((color) => {
      const swatch = document.createElement('div');
      swatch.className = 'format-dialog-color-swatch';
      swatch.style.backgroundColor = color;
      swatch.addEventListener('click', () => {
        this.values.bgColor = color;
        colorInput.value = color;
        if (preview) preview.style.backgroundColor = color;
      });
      presetGrid.appendChild(swatch);
    });
    container.appendChild(presetGrid);

    // 预览
    const preview = document.createElement('div');
    preview.className = 'format-dialog-fill-preview';
    preview.style.backgroundColor = this.values.bgColor || '#ffffff';
    const previewLabel = document.createElement('div');
    previewLabel.className = 'format-dialog-preview-label';
    previewLabel.textContent = '预览';
    container.appendChild(previewLabel);
    container.appendChild(preview);

    return container;
  }
}
