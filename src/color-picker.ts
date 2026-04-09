// ============================================================
// 增强型颜色选择器
// 支持 HEX/RGB 输入和最近使用颜色记录
// ============================================================

/** 颜色选择器回调 */
export interface ColorPickerCallbacks {
  onColorSelect: (color: string) => void;
}

/** 最近使用颜色的最大记录数 */
const MAX_RECENT_COLORS = 10;

/** 预设颜色面板 */
const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#CCCCCC', '#D9D9D9', '#EFEFEF', '#F3F3F3', '#FFFFFF',
  '#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#4A86E8', '#0000FF', '#9900FF', '#FF00FF',
  '#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3', '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC',
  '#DD7E6B', '#EA9999', '#F9CB9C', '#FFE599', '#B6D7A8', '#A2C4C9', '#A4C2F4', '#9FC5E8', '#B4A7D6', '#D5A6BD',
  '#CC4125', '#E06666', '#F6B26B', '#FFD966', '#93C47D', '#76A5AF', '#6D9EEB', '#6FA8DC', '#8E7CC3', '#C27BA0',
];

/**
 * 增强型颜色选择器
 */
export class ColorPicker {
  private panel: HTMLDivElement | null = null;
  private recentColors: string[] = [];
  private callbacks: ColorPickerCallbacks;
  private storageKey: string;

  constructor(callbacks: ColorPickerCallbacks, storageKey: string = 'recent-colors') {
    this.callbacks = callbacks;
    this.storageKey = storageKey;
    this.loadRecentColors();
  }

  /** 显示颜色选择器面板 */
  show(anchorX: number, anchorY: number): void {
    this.hide();

    this.panel = document.createElement('div');
    this.panel.className = 'color-picker-panel';
    this.panel.style.left = `${anchorX}px`;
    this.panel.style.top = `${anchorY}px`;

    // 预设颜色网格
    const presetSection = document.createElement('div');
    presetSection.className = 'color-picker-section';

    const presetTitle = document.createElement('div');
    presetTitle.className = 'color-picker-section-title';
    presetTitle.textContent = '主题颜色';
    presetSection.appendChild(presetTitle);

    const presetGrid = document.createElement('div');
    presetGrid.className = 'color-picker-grid';

    PRESET_COLORS.forEach(color => {
      const swatch = this.createSwatch(color);
      presetGrid.appendChild(swatch);
    });

    presetSection.appendChild(presetGrid);
    this.panel.appendChild(presetSection);

    // 最近使用颜色
    if (this.recentColors.length > 0) {
      const recentSection = document.createElement('div');
      recentSection.className = 'color-picker-section';

      const recentTitle = document.createElement('div');
      recentTitle.className = 'color-picker-section-title';
      recentTitle.textContent = '最近使用';
      recentSection.appendChild(recentTitle);

      const recentGrid = document.createElement('div');
      recentGrid.className = 'color-picker-grid';

      this.recentColors.forEach(color => {
        const swatch = this.createSwatch(color);
        recentGrid.appendChild(swatch);
      });

      recentSection.appendChild(recentGrid);
      this.panel.appendChild(recentSection);
    }

    // 自定义颜色输入
    const customSection = document.createElement('div');
    customSection.className = 'color-picker-custom';

    const hexLabel = document.createElement('label');
    hexLabel.textContent = 'HEX: ';
    hexLabel.style.fontSize = '12px';

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'color-picker-hex-input';
    hexInput.placeholder = '#FF0000';
    hexInput.maxLength = 7;

    const applyBtn = document.createElement('button');
    applyBtn.className = 'color-picker-apply-btn';
    applyBtn.textContent = '应用';
    applyBtn.addEventListener('click', () => {
      const value = hexInput.value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        this.selectColor(value);
      } else if (/^[0-9A-Fa-f]{6}$/.test(value)) {
        this.selectColor(`#${value}`);
      }
    });

    hexInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyBtn.click();
    });

    customSection.appendChild(hexLabel);
    customSection.appendChild(hexInput);
    customSection.appendChild(applyBtn);
    this.panel.appendChild(customSection);

    // 原生颜色选择器
    const nativeSection = document.createElement('div');
    nativeSection.className = 'color-picker-native';

    const nativeInput = document.createElement('input');
    nativeInput.type = 'color';
    nativeInput.className = 'color-picker-native-input';
    nativeInput.addEventListener('input', () => {
      this.selectColor(nativeInput.value);
    });

    const nativeLabel = document.createElement('span');
    nativeLabel.textContent = '更多颜色...';
    nativeLabel.style.fontSize = '12px';
    nativeLabel.style.cursor = 'pointer';
    nativeLabel.addEventListener('click', () => nativeInput.click());

    nativeSection.appendChild(nativeInput);
    nativeSection.appendChild(nativeLabel);
    this.panel.appendChild(nativeSection);

    document.body.appendChild(this.panel);

    // 点击外部关闭
    const closeHandler = (e: MouseEvent) => {
      if (this.panel && !this.panel.contains(e.target as Node)) {
        this.hide();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  }

  /** 隐藏面板 */
  hide(): void {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  /** 创建颜色色块 */
  private createSwatch(color: string): HTMLDivElement {
    const swatch = document.createElement('div');
    swatch.className = 'color-picker-swatch';
    swatch.style.backgroundColor = color;
    swatch.title = color;
    if (color === '#FFFFFF' || color === '#ffffff') {
      swatch.style.border = '1px solid #ccc';
    }
    swatch.addEventListener('click', () => this.selectColor(color));
    return swatch;
  }

  /** 选择颜色 */
  private selectColor(color: string): void {
    this.addRecentColor(color);
    this.callbacks.onColorSelect(color);
    this.hide();
  }

  /** 添加到最近使用颜色 */
  private addRecentColor(color: string): void {
    const upper = color.toUpperCase();
    this.recentColors = this.recentColors.filter(c => c.toUpperCase() !== upper);
    this.recentColors.unshift(color);
    if (this.recentColors.length > MAX_RECENT_COLORS) {
      this.recentColors = this.recentColors.slice(0, MAX_RECENT_COLORS);
    }
    this.saveRecentColors();
  }

  /** 保存最近使用颜色到 localStorage */
  private saveRecentColors(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.recentColors));
    } catch { /* 忽略 */ }
  }

  /** 从 localStorage 加载最近使用颜色 */
  private loadRecentColors(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) this.recentColors = JSON.parse(stored);
    } catch {
      this.recentColors = [];
    }
  }
}
