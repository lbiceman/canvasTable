import { SpreadsheetApp } from './app';
import themes from './themes.json';
import { Modal } from './modal';

export type ThemeType = 'light' | 'dark' | 'feishu' | 'soft' | 'highContrast';

export class UIControls {
  private app: SpreadsheetApp;
  private controlPanel: HTMLElement | null = null;
  private isVisible: boolean = false;
  private currentTheme: ThemeType = 'dark';

  constructor(app: SpreadsheetApp) {
    this.app = app;
    this.createToggleButton();
    this.createControlPanel();
    this.applyTheme('dark');
  }

  private createToggleButton(): void {
    const toggleButton = document.createElement('button');
    toggleButton.id = 'data-controls-toggle';
    toggleButton.textContent = '更多';
    toggleButton.className = 'ui-toggle-button';

    toggleButton.addEventListener('click', () => {
      this.togglePanel();
    });

    document.body.appendChild(toggleButton);
  }

  private createControlPanel(): void {
    const controlPanel = document.createElement('div');
    controlPanel.id = 'control-panel';
    controlPanel.className = 'ui-control-panel';

    this.controlPanel = controlPanel;

    // 标题栏
    const titleBar = document.createElement('div');
    titleBar.className = 'ui-panel-title-bar';

    const title = document.createElement('h3');
    title.textContent = '更多选项';
    title.className = 'ui-panel-title';

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.className = 'ui-close-button';

    closeButton.addEventListener('click', () => {
      this.hidePanel();
    });

    titleBar.appendChild(title);
    titleBar.appendChild(closeButton);
    controlPanel.appendChild(titleBar);

    // 主题选择
    const themeGroup = this.createThemeSelector();
    controlPanel.appendChild(themeGroup);

    // 打印与导出按钮组
    const printExportGroup = this.createButtonGroup('打印与导出', [
      { text: '🖨️ 打印预览', action: () => this.app.openPrintPreview() },
      { text: '📊 导出 XLSX', action: () => this.app.exportXlsx() },
      { text: '📂 导入 XLSX', action: () => this.app.importXlsx() },
      { text: '📄 导出 CSV', action: () => this.app.exportCsv() },
      { text: '📑 导出 PDF', action: () => this.app.exportPdf() }
    ]);
    controlPanel.appendChild(printExportGroup);

    // 导出按钮组
    const exportGroup = this.createButtonGroup('导出数据', [
      { text: '导出完整数据', action: () => this.app.exportToFile() },
      { text: '导出简化数据', action: () => this.app.exportSimpleToFile() }
    ]);
    controlPanel.appendChild(exportGroup);

    // 导入按钮组
    const importGroup = this.createButtonGroup('导入数据', [
      { text: '导入完整数据', action: () => this.handleImport() },
      { text: '导入简化数据', action: () => this.handleSimpleImport() }
    ]);
    controlPanel.appendChild(importGroup);

    // 本地存储按钮组
    const storageGroup = this.createButtonGroup('本地存储', [
      { text: '保存到本地', action: () => this.handleSaveLocal() },
      { text: '从本地加载', action: () => this.handleLoadLocal() }
    ]);
    controlPanel.appendChild(storageGroup);

    // 其他操作按钮组
    const otherGroup = this.createButtonGroup('其他操作', [
      { text: '查看统计', action: () => this.showStatistics() },
      { text: '清空数据', action: () => this.handleClearData() }
    ]);
    controlPanel.appendChild(otherGroup);

    // 示例数据按钮
    const exampleButton = document.createElement('button');
    exampleButton.textContent = '🚀 加载示例数据';
    exampleButton.className = 'ui-example-button';
    exampleButton.addEventListener('click', () => this.loadExampleData());
    controlPanel.appendChild(exampleButton);

    document.body.appendChild(controlPanel);
  }

  private createThemeSelector(): HTMLElement {
    const group = document.createElement('div');
    group.className = 'ui-button-group';

    const groupTitle = document.createElement('div');
    groupTitle.textContent = '主题设置';
    groupTitle.className = 'ui-group-title';
    group.appendChild(groupTitle);

    // 主题选项容器
    const themeOptions = document.createElement('div');
    themeOptions.className = 'ui-theme-options';

    // 浅色主题选项
    const lightOption = this.createThemeOption('light', themes.light.name, false);
    themeOptions.appendChild(lightOption);

    // 深色主题选项
    const darkOption = this.createThemeOption('dark', themes.dark.name, true);
    themeOptions.appendChild(darkOption);

    // One Pro Dark 主题选项
    const feishuOption = this.createThemeOption('feishu', themes.feishu.name, false);
    themeOptions.appendChild(feishuOption);

    // 轻柔模式主题选项
    const softOption = this.createThemeOption('soft', themes.soft.name, false);
    themeOptions.appendChild(softOption);

    // 高对比度主题选项
    const highContrastOption = this.createThemeOption('highContrast', themes.highContrast.name, false);
    themeOptions.appendChild(highContrastOption);

    group.appendChild(themeOptions);
    return group;
  }

  private createThemeOption(themeKey: ThemeType, themeName: string, isSelected: boolean): HTMLElement {
    const option = document.createElement('label');
    option.className = `ui-theme-option ${isSelected ? 'selected' : ''}`;
    option.dataset.theme = themeKey;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'theme';
    radio.value = themeKey;
    radio.checked = isSelected;

    const label = document.createElement('span');
    label.textContent = themeName;
    label.className = 'ui-theme-label';

    const icon = document.createElement('span');
    icon.textContent = themeKey === 'light' ? '☀️' : themeKey === 'feishu' ? '🎨' : themeKey === 'soft' ? '🍃' : themeKey === 'highContrast' ? '◐' : '🌙';
    icon.className = 'ui-theme-icon';

    option.appendChild(radio);
    option.appendChild(label);
    option.appendChild(icon);

    radio.addEventListener('change', () => {
      if (radio.checked) {
        this.setTheme(themeKey);
        this.updateThemeOptions();
      }
    });

    return option;
  }

  private updateThemeOptions(): void {
    if (!this.controlPanel) return;

    const options = this.controlPanel.querySelectorAll('.ui-theme-option');
    options.forEach((option) => {
      const themeKey = (option as HTMLElement).dataset.theme;
      const radio = option.querySelector('input[type="radio"]') as HTMLInputElement;
      const isSelected = themeKey === this.currentTheme;

      radio.checked = isSelected;
      option.classList.toggle('selected', isSelected);
    });
  }

  private setTheme(themeKey: ThemeType): void {
    this.currentTheme = themeKey;
    this.applyTheme(themeKey);
    this.showMessage(`已切换到${themes[themeKey].name}`, 'success');
  }

  private applyTheme(themeKey: ThemeType): void {
    const theme = themes[themeKey];
    const colors = theme.colors;
    const root = document.documentElement;

    // 设置CSS变量
    root.style.setProperty('--theme-background', colors.background);
    root.style.setProperty('--theme-foreground', colors.foreground);
    root.style.setProperty('--theme-header-bg', colors.headerBackground);
    root.style.setProperty('--theme-header-text', colors.headerText);
    root.style.setProperty('--theme-grid-line', colors.gridLine);
    root.style.setProperty('--theme-cell-bg', colors.cellBackground);
    root.style.setProperty('--theme-cell-text', colors.cellText);
    root.style.setProperty('--theme-selection-bg', colors.selectionBackground);
    root.style.setProperty('--theme-selection-border', colors.selectionBorder);
    root.style.setProperty('--theme-highlight-bg', colors.highlightBackground);
    root.style.setProperty('--theme-highlight-header-bg', colors.highlightHeaderBackground);
    root.style.setProperty('--theme-scrollbar-track', colors.scrollbarTrack);
    root.style.setProperty('--theme-scrollbar-thumb', colors.scrollbarThumb);
    root.style.setProperty('--theme-scrollbar-thumb-hover', colors.scrollbarThumbHover);
    root.style.setProperty('--theme-scrollbar-thumb-active', colors.scrollbarThumbActive);
    root.style.setProperty('--theme-toolbar-bg', colors.toolbarBackground);
    root.style.setProperty('--theme-toolbar-border', colors.toolbarBorder);
    root.style.setProperty('--theme-status-bg', colors.statusBarBackground);
    root.style.setProperty('--theme-status-text', colors.statusBarText);
    root.style.setProperty('--theme-input-bg', colors.inputBackground);
    root.style.setProperty('--theme-input-border', colors.inputBorder);
    root.style.setProperty('--theme-button-bg', colors.buttonBackground);
    root.style.setProperty('--theme-button-text', colors.buttonText);
    root.style.setProperty('--theme-button-border', colors.buttonBorder);
    root.style.setProperty('--theme-button-hover-bg', colors.buttonHoverBackground);

    // 通知渲染器更新主题
    this.app.setTheme(colors);

    // 同步更新 Sheet 标签栏和右键菜单的主题
    const sheetTabBar = this.app.getSheetTabBar();
    const sheetContextMenu = this.app.getSheetContextMenu();
    if (sheetTabBar) {
      sheetTabBar.applyTheme(colors);
    }
    if (sheetContextMenu) {
      sheetContextMenu.applyTheme(colors);
    }
  }

  public getCurrentTheme(): ThemeType {
    return this.currentTheme;
  }

  public getThemeColors(): typeof themes.light.colors {
    return themes[this.currentTheme].colors;
  }

  private createButtonGroup(title: string, buttons: Array<{text: string, action: () => void}>): HTMLElement {
    const group = document.createElement('div');
    group.className = 'ui-button-group';

    const groupTitle = document.createElement('div');
    groupTitle.textContent = title;
    groupTitle.className = 'ui-group-title';
    group.appendChild(groupTitle);

    buttons.forEach((button, index) => {
      const btn = document.createElement('button');
      btn.textContent = button.text;
      btn.className = 'ui-panel-button';
      if (index < buttons.length - 1) {
        btn.style.marginBottom = '8px';
      }
      btn.addEventListener('click', button.action);
      group.appendChild(btn);
    });

    return group;
  }

  private togglePanel(): void {
    if (!this.controlPanel) return;

    if (this.isVisible) {
      this.controlPanel.classList.remove('visible');
      setTimeout(() => {
        if (this.controlPanel) {
          this.controlPanel.style.display = 'none';
        }
      }, 300);
      this.isVisible = false;
    } else {
      this.controlPanel.style.display = 'block';
      setTimeout(() => {
        if (this.controlPanel) {
          this.controlPanel.classList.add('visible');
        }
      }, 10);
      this.isVisible = true;
    }
  }

  public showPanel(): void {
    if (!this.isVisible) {
      this.togglePanel();
    }
  }

  public hidePanel(): void {
    if (this.isVisible) {
      this.togglePanel();
    }
  }

  public isPanelVisible(): boolean {
    return this.isVisible;
  }

  private async handleImport(): Promise<void> {
    try {
      const success = await this.app.importFromFile();
      if (success) {
        this.showMessage('数据导入成功！', 'success');
      } else {
        this.showMessage('数据导入失败，请检查文件格式。', 'error');
      }
    } catch (error) {
      this.showMessage('导入过程中发生错误。', 'error');
    }
  }

  private async handleSimpleImport(): Promise<void> {
    try {
      const success = await this.app.importFromSimpleFile();
      if (success) {
        this.showMessage('简化数据导入成功！', 'success');
      } else {
        this.showMessage('简化数据导入失败，请检查文件格式。', 'error');
      }
    } catch (error) {
      this.showMessage('导入过程中发生错误。', 'error');
    }
  }

  private handleSaveLocal(): void {
    const success = this.app.saveToLocalStorage();
    if (success) {
      this.showMessage('数据已保存到本地存储！', 'success');
    } else {
      this.showMessage('保存失败，请检查浏览器存储权限。', 'error');
    }
  }

  private handleLoadLocal(): void {
    const success = this.app.loadFromLocalStorage();
    if (success) {
      this.showMessage('数据已从本地存储加载！', 'success');
    } else {
      this.showMessage('加载失败，本地存储中没有找到数据。', 'error');
    }
  }

  private async showStatistics(): Promise<void> {
    const stats = this.app.getStatistics();
    const message = `
      表格统计信息：
      • 总单元格数：${stats.totalCells}
      • 已填充单元格：${stats.filledCells}
      • 合并单元格：${stats.mergedCells}
      • 数据大小：${stats.dataSize}
    `;
    await Modal.alert(message);
  }

  private async handleClearData(): Promise<void> {
    if (await Modal.confirm('确定要清空所有数据吗？此操作不可撤销。')) {
      this.app.clearAllData();
      this.showMessage('所有数据已清空！', 'success');
    }
  }

  private async loadExampleData(): Promise<void> {
    try {
      const response = await fetch('/example-complex.json');
      if (!response.ok) {
        throw new Error('加载示例数据失败');
      }
      const jsonData = await response.text();
      const model = this.app.getModel();
      const success = model.importFromJSON(jsonData);
      if (success) {
        this.app.resetAndRender();
        this.showMessage('示例数据已加载！', 'success');
      } else {
        this.showMessage('加载示例数据失败', 'error');
      }
    } catch (error) {
      console.error('加载示例数据失败:', error);
      this.showMessage('加载示例数据失败', 'error');
    }
  }

  private showMessage(message: string, type: 'success' | 'error'): void {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.className = `ui-message ui-message-${type}`;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
      document.body.removeChild(messageDiv);
    }, 3000);
  }
}


// ============================================================
// renderToolbar 独立导出函数及辅助函数
// 在 SpreadsheetApp 实例化之前调用，动态创建所有工具栏 DOM 结构
// ============================================================

/** 创建工具栏第一行：撤销/重做、合并/拆分、颜色选择器、边框、字体、对齐等 */
function renderToolbarRow1(toolbar: HTMLElement): void {
  // 创建 .toolbar-row.toolbar-row-1 结构
  const row1 = document.createElement('div');
  row1.className = 'toolbar-row toolbar-row-1';

  // 创建 .toolbar-group 容器
  const toolbarGroup = document.createElement('div');
  toolbarGroup.className = 'toolbar-group';

  // === 撤销按钮 ===
  const undoBtn = document.createElement('button');
  undoBtn.id = 'undo-btn';
  undoBtn.title = '撤销 (Ctrl+Z)';
  undoBtn.disabled = true;
  undoBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.84998 7.49998C1.84998 4.66458 4.05979 1.84998 7.49998 1.84998C10.945 1.84998 13.15 4.66458 13.15 7.49998C13.15 10.3354 10.945 13.15 7.49998 13.15C6.5941 13.15 5.72086 12.9138 4.95634 12.4893L5.44367 11.6106C6.07324 11.9586 6.77013 12.15 7.49998 12.15C10.3276 12.15 12.15 9.79523 12.15 7.49998C12.15 5.20473 10.3276 2.84998 7.49998 2.84998C4.67236 2.84998 2.84998 5.20473 2.84998 7.49998H4.24998L2.04998 10.2L-0.150024 7.49998H1.84998Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
            </svg>`;
  const undoSpan = document.createElement('span');
  undoSpan.textContent = '撤销';
  undoBtn.appendChild(undoSpan);
  toolbarGroup.appendChild(undoBtn);

  // === 重做按钮 ===
  const redoBtn = document.createElement('button');
  redoBtn.id = 'redo-btn';
  redoBtn.title = '重做 (Ctrl+Y)';
  redoBtn.disabled = true;
  redoBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.15 7.49998C13.15 4.66458 10.9402 1.84998 7.50002 1.84998C4.05983 1.84998 1.85002 4.66458 1.85002 7.49998C1.85002 10.3354 4.05983 13.15 7.50002 13.15C8.40589 13.15 9.27914 12.9138 10.0437 12.4893L9.55633 11.6106C8.92676 11.9586 8.22987 12.15 7.50002 12.15C4.67239 12.15 2.85002 9.79523 2.85002 7.49998C2.85002 5.20473 4.67239 2.84998 7.50002 2.84998C10.3276 2.84998 12.15 5.20473 12.15 7.49998H10.75L12.95 10.2L15.15 7.49998H13.15Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
            </svg>`;
  const redoSpan = document.createElement('span');
  redoSpan.textContent = '重做';
  redoBtn.appendChild(redoSpan);
  toolbarGroup.appendChild(redoBtn);

  // === 分隔符 ===
  const separator1 = document.createElement('div');
  separator1.className = 'separator';
  toolbarGroup.appendChild(separator1);

  // === 合并按钮 ===
  const mergeBtn = document.createElement('button');
  mergeBtn.id = 'merge-cells';
  mergeBtn.title = '合并选中的单元格';
  mergeBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 2.5C2 2.22386 2.22386 2 2.5 2H12.5C12.7761 2 13 2.22386 13 2.5V12.5C13 12.7761 12.7761 13 12.5 13H2.5C2.22386 13 2 12.7761 2 12.5V2.5ZM3 3V7H7V3H3ZM8 3V7H12V3H8ZM3 8V12H7V8H3ZM8 8V12H12V8H8Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
            </svg>`;
  const mergeSpan = document.createElement('span');
  mergeSpan.textContent = '合并';
  mergeBtn.appendChild(mergeSpan);
  toolbarGroup.appendChild(mergeBtn);

  // === 拆分按钮 ===
  const splitBtn = document.createElement('button');
  splitBtn.id = 'split-cells';
  splitBtn.title = '拆分选中的单元格';
  splitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 2.5C2 2.22386 2.22386 2 2.5 2H12.5C12.7761 2 13 2.22386 13 2.5V12.5C13 12.7761 12.7761 13 12.5 13H2.5C2.22386 13 2 12.7761 2 12.5V2.5ZM3 3V12H12V3H3Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
            </svg>`;
  const splitSpan = document.createElement('span');
  splitSpan.textContent = '拆分';
  splitBtn.appendChild(splitSpan);
  toolbarGroup.appendChild(splitBtn);

  // === 字体颜色选择器 ===
  const fontColorPicker = document.createElement('div');
  fontColorPicker.className = 'font-color-picker';
  fontColorPicker.title = '设置字体颜色';

  const fontColorLabel = document.createElement('label');
  fontColorLabel.htmlFor = 'font-color';
  fontColorLabel.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 1L3 13H5L6 10H9L10 13H12L7.5 1ZM7.5 4L8.5 8H6.5L7.5 4Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
              </svg>`;

  const fontColorInput = document.createElement('input');
  fontColorInput.type = 'color';
  fontColorInput.id = 'font-color';
  fontColorInput.value = '#333333';

  fontColorPicker.appendChild(fontColorLabel);
  fontColorPicker.appendChild(fontColorInput);
  toolbarGroup.appendChild(fontColorPicker);

  // === 背景颜色选择器 ===
  const bgColorPicker = document.createElement('div');
  bgColorPicker.className = 'bg-color-picker';
  bgColorPicker.title = '设置背景颜色';

  const bgColorLabel = document.createElement('label');
  bgColorLabel.htmlFor = 'bg-color';
  bgColorLabel.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 0C7.77614 0 8 0.223858 8 0.5V2.5C8 2.77614 7.77614 3 7.5 3C7.22386 3 7 2.77614 7 2.5V0.5C7 0.223858 7.22386 0 7.5 0ZM2.1967 2.1967C2.39196 2.00144 2.70854 2.00144 2.90381 2.1967L4.31802 3.61091C4.51328 3.80617 4.51328 4.12276 4.31802 4.31802C4.12276 4.51328 3.80617 4.51328 3.61091 4.31802L2.1967 2.90381C2.00144 2.70854 2.00144 2.39196 2.1967 2.1967ZM12.8033 2.1967C12.9986 2.39196 12.9986 2.70854 12.8033 2.90381L11.3891 4.31802C11.1938 4.51328 10.8772 4.51328 10.682 4.31802C10.4867 4.12276 10.4867 3.80617 10.682 3.61091L12.0962 2.1967C12.2915 2.00144 12.608 2.00144 12.8033 2.1967ZM7.5 4C5.567 4 4 5.567 4 7.5C4 9.433 5.567 11 7.5 11C9.433 11 11 9.433 11 7.5C11 5.567 9.433 4 7.5 4ZM0 7.5C0 7.22386 0.223858 7 0.5 7H2.5C2.77614 7 3 7.22386 3 7.5C3 7.77614 2.77614 8 2.5 8H0.5C0.223858 8 0 7.77614 0 7.5ZM12 7.5C12 7.22386 12.2239 7 12.5 7H14.5C14.7761 7 15 7.22386 15 7.5C15 7.77614 14.7761 8 14.5 8H12.5C12.2239 8 12 7.77614 12 7.5ZM2.1967 12.8033C2.00144 12.608 2.00144 12.2915 2.1967 12.0962L3.61091 10.682C3.80617 10.4867 4.12276 10.4867 4.31802 10.682C4.51328 10.8772 4.51328 11.1938 4.31802 11.3891L2.90381 12.8033C2.70854 12.9986 2.39196 12.9986 2.1967 12.8033ZM12.8033 12.8033C12.608 12.9986 12.2915 12.9986 12.0962 12.8033L10.682 11.3891C10.4867 11.1938 10.4867 10.8772 10.682 10.682C10.8772 10.4867 11.1938 10.4867 11.3891 10.682L12.8033 12.0962C12.9986 12.2915 12.9986 12.608 12.8033 12.8033ZM7.5 12C7.77614 12 8 12.2239 8 12.5V14.5C8 14.7761 7.77614 15 7.5 15C7.22386 15 7 14.7761 7 14.5V12.5C7 12.2239 7.22386 12 7.5 12Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
              </svg>`;

  const bgColorInput = document.createElement('input');
  bgColorInput.type = 'color';
  bgColorInput.id = 'bg-color';
  bgColorInput.value = '#ffffff';

  bgColorPicker.appendChild(bgColorLabel);
  bgColorPicker.appendChild(bgColorInput);
  toolbarGroup.appendChild(bgColorPicker);

  // === 边框选择器 ===
  const borderPicker = document.createElement('div');
  borderPicker.className = 'border-picker';
  borderPicker.title = '边框';

  // 边框按钮
  const borderBtn = document.createElement('button');
  borderBtn.id = 'border-btn';
  borderBtn.type = 'button';
  borderBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1.5" y="1.5" width="12" height="12" rx="0.5" stroke="currentColor" stroke-width="1.2"></rect>
                <line x1="1.5" y1="7.5" x2="13.5" y2="7.5" stroke="currentColor" stroke-width="1"></line>
                <line x1="7.5" y1="1.5" x2="7.5" y2="13.5" stroke="currentColor" stroke-width="1"></line>
              </svg>`;
  const borderBtnSpan = document.createElement('span');
  borderBtnSpan.textContent = '边框';
  borderBtn.appendChild(borderBtnSpan);
  borderPicker.appendChild(borderBtn);

  // 边框下拉面板
  const borderDropdown = document.createElement('div');
  borderDropdown.id = 'border-dropdown';
  borderDropdown.className = 'border-dropdown';

  // --- 边框位置选项区域 ---
  const borderPositionSection = document.createElement('div');
  borderPositionSection.className = 'border-section';

  const borderPositionTitle = document.createElement('div');
  borderPositionTitle.className = 'border-section-title';
  borderPositionTitle.textContent = '边框位置';
  borderPositionSection.appendChild(borderPositionTitle);

  const borderPositionGrid = document.createElement('div');
  borderPositionGrid.className = 'border-position-grid';

  // 8 个边框位置选项的配置
  const borderPositions: Array<{ position: string; title: string; label: string; svg: string }> = [
    {
      position: 'top', title: '上边框', label: '上边框',
      svg: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="2" width="14" height="14" rx="0.5" stroke="#ccc" stroke-width="0.8" fill="none"></rect>
                      <line x1="2" y1="2" x2="16" y2="2" stroke="currentColor" stroke-width="2"></line>
                    </svg>`
    },
    {
      position: 'bottom', title: '下边框', label: '下边框',
      svg: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="2" width="14" height="14" rx="0.5" stroke="#ccc" stroke-width="0.8" fill="none"></rect>
                      <line x1="2" y1="16" x2="16" y2="16" stroke="currentColor" stroke-width="2"></line>
                    </svg>`
    },
    {
      position: 'left', title: '左边框', label: '左边框',
      svg: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="2" width="14" height="14" rx="0.5" stroke="#ccc" stroke-width="0.8" fill="none"></rect>
                      <line x1="2" y1="2" x2="2" y2="16" stroke="currentColor" stroke-width="2"></line>
                    </svg>`
    },
    {
      position: 'right', title: '右边框', label: '右边框',
      svg: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="2" width="14" height="14" rx="0.5" stroke="#ccc" stroke-width="0.8" fill="none"></rect>
                      <line x1="16" y1="2" x2="16" y2="16" stroke="currentColor" stroke-width="2"></line>
                    </svg>`
    },
    {
      position: 'all', title: '全部边框', label: '全部边框',
      svg: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="2" width="14" height="14" rx="0.5" stroke="currentColor" stroke-width="1.5" fill="none"></rect>
                      <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="1.2"></line>
                      <line x1="9" y1="2" x2="9" y2="16" stroke="currentColor" stroke-width="1.2"></line>
                    </svg>`
    },
    {
      position: 'outer', title: '外框边框', label: '外框边框',
      svg: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="2" width="14" height="14" rx="0.5" stroke="currentColor" stroke-width="2" fill="none"></rect>
                    </svg>`
    },
    {
      position: 'inner', title: '内框边框', label: '内框边框',
      svg: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="2" width="14" height="14" rx="0.5" stroke="#ccc" stroke-width="0.8" fill="none"></rect>
                      <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="1.5"></line>
                      <line x1="9" y1="2" x2="9" y2="16" stroke="currentColor" stroke-width="1.5"></line>
                    </svg>`
    },
    {
      position: 'none', title: '清除边框', label: '清除边框',
      svg: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="2" width="14" height="14" rx="0.5" stroke="#ccc" stroke-width="0.8" stroke-dasharray="2 2" fill="none"></rect>
                      <line x1="4" y1="4" x2="14" y2="14" stroke="#e53e3e" stroke-width="1.5"></line>
                      <line x1="14" y1="4" x2="4" y2="14" stroke="#e53e3e" stroke-width="1.5"></line>
                    </svg>`
    }
  ];

  borderPositions.forEach(({ position, title, label, svg }) => {
    const option = document.createElement('div');
    option.className = 'border-position-option';
    option.dataset.position = position;
    option.title = title;
    option.innerHTML = svg;
    const optionSpan = document.createElement('span');
    optionSpan.textContent = label;
    option.appendChild(optionSpan);
    borderPositionGrid.appendChild(option);
  });

  borderPositionSection.appendChild(borderPositionGrid);
  borderDropdown.appendChild(borderPositionSection);

  // --- 边框线型选项区域 ---
  const borderStyleSection = document.createElement('div');
  borderStyleSection.className = 'border-section';

  const borderStyleTitle = document.createElement('div');
  borderStyleTitle.className = 'border-section-title';
  borderStyleTitle.textContent = '线型';
  borderStyleSection.appendChild(borderStyleTitle);

  const borderStyleGrid = document.createElement('div');
  borderStyleGrid.className = 'border-style-grid';

  // 4 个线型选项的配置
  const borderStyles: Array<{ style: string; title: string; label: string; svg: string; active: boolean }> = [
    {
      style: 'solid', title: '实线', label: '实线', active: true,
      svg: `<svg width="40" height="14" viewBox="0 0 40 14" xmlns="http://www.w3.org/2000/svg">
                      <line x1="2" y1="7" x2="38" y2="7" stroke="currentColor" stroke-width="1.5"></line>
                    </svg>`
    },
    {
      style: 'dashed', title: '虚线', label: '虚线', active: false,
      svg: `<svg width="40" height="14" viewBox="0 0 40 14" xmlns="http://www.w3.org/2000/svg">
                      <line x1="2" y1="7" x2="38" y2="7" stroke="currentColor" stroke-width="1.5" stroke-dasharray="6 3"></line>
                    </svg>`
    },
    {
      style: 'dotted', title: '点线', label: '点线', active: false,
      svg: `<svg width="40" height="14" viewBox="0 0 40 14" xmlns="http://www.w3.org/2000/svg">
                      <line x1="2" y1="7" x2="38" y2="7" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"></line>
                    </svg>`
    },
    {
      style: 'double', title: '双线', label: '双线', active: false,
      svg: `<svg width="40" height="14" viewBox="0 0 40 14" xmlns="http://www.w3.org/2000/svg">
                      <line x1="2" y1="5" x2="38" y2="5" stroke="currentColor" stroke-width="1"></line>
                      <line x1="2" y1="9" x2="38" y2="9" stroke="currentColor" stroke-width="1"></line>
                    </svg>`
    }
  ];

  borderStyles.forEach(({ style, title, label, svg, active }) => {
    const option = document.createElement('div');
    option.className = active ? 'border-style-option active' : 'border-style-option';
    option.dataset.style = style;
    option.title = title;
    option.innerHTML = svg;
    const optionSpan = document.createElement('span');
    optionSpan.textContent = label;
    option.appendChild(optionSpan);
    borderStyleGrid.appendChild(option);
  });

  borderStyleSection.appendChild(borderStyleGrid);
  borderDropdown.appendChild(borderStyleSection);

  // --- 边框颜色选择区域 ---
  const borderColorSection = document.createElement('div');
  borderColorSection.className = 'border-section';

  const borderColorTitle = document.createElement('div');
  borderColorTitle.className = 'border-section-title';
  borderColorTitle.textContent = '颜色';
  borderColorSection.appendChild(borderColorTitle);

  const borderColorPicker = document.createElement('div');
  borderColorPicker.className = 'border-color-picker';

  const borderColorInput = document.createElement('input');
  borderColorInput.type = 'color';
  borderColorInput.id = 'border-color';
  borderColorInput.value = '#000000';

  const borderColorText = document.createElement('span');
  borderColorText.id = 'border-color-text';
  borderColorText.textContent = '#000000';

  borderColorPicker.appendChild(borderColorInput);
  borderColorPicker.appendChild(borderColorText);
  borderColorSection.appendChild(borderColorPicker);
  borderDropdown.appendChild(borderColorSection);

  borderPicker.appendChild(borderDropdown);
  toolbarGroup.appendChild(borderPicker);

  // === 字体族选择器 ===
  const fontFamilyPicker = document.createElement('div');
  fontFamilyPicker.className = 'font-family-picker';
  fontFamilyPicker.title = '字体';

  // 字体族按钮
  const fontFamilyBtn = document.createElement('button');
  fontFamilyBtn.id = 'font-family-btn';
  fontFamilyBtn.type = 'button';
  fontFamilyBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 2C2.22386 2 2 2.22386 2 2.5V4H3V3H7V12H5.5V13H9.5V12H8V3H12V4H13V2.5C13 2.22386 12.7761 2 12.5 2H2.5Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
              </svg>`;
  const fontFamilyText = document.createElement('span');
  fontFamilyText.id = 'font-family-text';
  fontFamilyText.textContent = '字体';
  fontFamilyBtn.appendChild(fontFamilyText);
  fontFamilyPicker.appendChild(fontFamilyBtn);

  // 字体族下拉面板
  const fontFamilyDropdown = document.createElement('div');
  fontFamilyDropdown.id = 'font-family-dropdown';
  fontFamilyDropdown.className = 'font-family-dropdown';

  // 7 个字体选项配置
  const fontFamilies: Array<{ font: string; style: string; label: string }> = [
    { font: 'SimSun', style: 'font-family: SimSun, serif;', label: '宋体' },
    { font: 'Microsoft YaHei', style: "font-family: 'Microsoft YaHei', sans-serif;", label: '微软雅黑' },
    { font: 'SimHei', style: 'font-family: SimHei, sans-serif;', label: '黑体' },
    { font: 'KaiTi', style: 'font-family: KaiTi, serif;', label: '楷体' },
    { font: 'Arial', style: 'font-family: Arial, sans-serif;', label: 'Arial' },
    { font: 'Times New Roman', style: "font-family: 'Times New Roman', serif;", label: 'Times New Roman' },
    { font: 'Courier New', style: "font-family: 'Courier New', monospace;", label: 'Courier New' }
  ];

  fontFamilies.forEach(({ font, style, label }) => {
    const option = document.createElement('div');
    option.className = 'font-family-option';
    option.dataset.font = font;
    option.setAttribute('style', style);
    option.textContent = label;
    fontFamilyDropdown.appendChild(option);
  });

  fontFamilyPicker.appendChild(fontFamilyDropdown);
  toolbarGroup.appendChild(fontFamilyPicker);

  // === 字体大小选择器 ===
  const fontSizePicker = document.createElement('div');
  fontSizePicker.className = 'font-size-picker';
  fontSizePicker.title = '调整字体大小';

  // 字体大小按钮
  const fontSizeBtn = document.createElement('button');
  fontSizeBtn.id = 'font-size-btn';
  fontSizeBtn.type = 'button';
  fontSizeBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 4.5C2.5 3.09886 3.59886 2 5 2H10C11.4011 2 12.5 3.09886 12.5 4.5V4.5C12.5 5.05228 12.0523 5.5 11.5 5.5H3.5C2.94772 5.5 2.5 5.05228 2.5 4.5V4.5ZM7.5 5.5V13M5.5 13H9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>`;
  const fontSizeText = document.createElement('span');
  fontSizeText.id = 'font-size-text';
  fontSizeText.textContent = '12px';
  fontSizeBtn.appendChild(fontSizeText);
  fontSizePicker.appendChild(fontSizeBtn);

  // 字体大小下拉面板（空容器，由 app.ts 动态填充）
  const fontSizeDropdown = document.createElement('div');
  fontSizeDropdown.id = 'font-size-dropdown';
  fontSizeDropdown.className = 'font-size-dropdown';
  fontSizePicker.appendChild(fontSizeDropdown);

  toolbarGroup.appendChild(fontSizePicker);

  // === 数字格式选择器 ===
  const numberFormatPicker = document.createElement('div');
  numberFormatPicker.className = 'number-format-picker';
  numberFormatPicker.title = '数字格式';

  // 数字格式按钮
  const numberFormatBtn = document.createElement('button');
  numberFormatBtn.id = 'number-format-btn';
  numberFormatBtn.type = 'button';
  numberFormatBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.5 2C3.22386 2 3 2.22386 3 2.5V12.5C3 12.7761 3.22386 13 3.5 13H11.5C11.7761 13 12 12.7761 12 12.5V2.5C12 2.22386 11.7761 2 11.5 2H3.5ZM5 5H10V6H5V5ZM5 7.5H8V8.5H5V7.5ZM5 10H10V11H5V10Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
              </svg>`;
  const numberFormatText = document.createElement('span');
  numberFormatText.id = 'number-format-text';
  numberFormatText.textContent = '常规';
  numberFormatBtn.appendChild(numberFormatText);
  numberFormatPicker.appendChild(numberFormatBtn);

  // 数字格式下拉面板
  const numberFormatDropdown = document.createElement('div');
  numberFormatDropdown.id = 'number-format-dropdown';
  numberFormatDropdown.className = 'number-format-dropdown';

  // 7 个数字格式选项配置
  const numberFormats: Array<{ format: string; label: string; active: boolean }> = [
    { format: 'general', label: '常规', active: true },
    { format: 'number', label: '数字', active: false },
    { format: 'currency', label: '货币', active: false },
    { format: 'percentage', label: '百分比', active: false },
    { format: 'scientific', label: '科学计数法', active: false },
    { format: 'date', label: '日期', active: false },
    { format: 'time', label: '时间', active: false }
  ];

  numberFormats.forEach(({ format, label, active }) => {
    const option = document.createElement('div');
    option.className = active ? 'number-format-option active' : 'number-format-option';
    option.dataset.format = format;
    option.textContent = label;
    numberFormatDropdown.appendChild(option);
  });

  numberFormatPicker.appendChild(numberFormatDropdown);
  toolbarGroup.appendChild(numberFormatPicker);

  // === 字体加粗按钮 ===
  const fontBoldBtn = document.createElement('button');
  fontBoldBtn.id = 'font-bold-btn';
  fontBoldBtn.className = 'toolbar-btn font-bold-btn';
  fontBoldBtn.title = '加粗 (Ctrl+B)';
  fontBoldBtn.textContent = 'B';
  toolbarGroup.appendChild(fontBoldBtn);

  // === 字体斜体按钮 ===
  const fontItalicBtn = document.createElement('button');
  fontItalicBtn.id = 'font-italic-btn';
  fontItalicBtn.className = 'toolbar-btn font-italic-btn';
  fontItalicBtn.title = '斜体 (Ctrl+I)';
  fontItalicBtn.textContent = 'I';
  toolbarGroup.appendChild(fontItalicBtn);

  // === 字体下划线按钮 ===
  const fontUnderlineBtn = document.createElement('button');
  fontUnderlineBtn.id = 'font-underline-btn';
  fontUnderlineBtn.className = 'toolbar-btn font-underline-btn';
  fontUnderlineBtn.title = '下划线 (Ctrl+U)';
  fontUnderlineBtn.textContent = 'U';
  toolbarGroup.appendChild(fontUnderlineBtn);

  // === 字体删除线按钮 ===
  const fontStrikethroughBtn = document.createElement('button');
  fontStrikethroughBtn.id = 'font-strikethrough-btn';
  fontStrikethroughBtn.className = 'toolbar-btn font-strikethrough-btn';
  fontStrikethroughBtn.title = '删除线';
  fontStrikethroughBtn.innerHTML = '<span style="text-decoration: line-through;">S</span>';
  toolbarGroup.appendChild(fontStrikethroughBtn);

  // === 水平对齐选择器 ===
  const horizontalAlignPicker = document.createElement('div');
  horizontalAlignPicker.className = 'horizontal-align-picker';
  horizontalAlignPicker.title = '水平对齐';

  // 水平对齐按钮
  const horizontalAlignBtn = document.createElement('button');
  horizontalAlignBtn.id = 'horizontal-align-btn';
  horizontalAlignBtn.type = 'button';
  horizontalAlignBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 3.5C2 3.22386 2.22386 3 2.5 3H12.5C12.7761 3 13 3.22386 13 3.5C13 3.77614 12.7761 4 12.5 4H2.5C2.22386 4 2 3.77614 2 3.5ZM2 7.5C2 7.22386 2.22386 7 2.5 7H9.5C9.77614 7 10 7.22386 10 7.5C10 7.77614 9.77614 8 9.5 8H2.5C2.22386 8 2 7.77614 2 7.5ZM2 11.5C2 11.2239 2.22386 11 2.5 11H12.5C12.7761 11 13 11.2239 13 11.5C13 11.7761 12.7761 12 12.5 12H2.5C2.22386 12 2 11.7761 2 11.5Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
              </svg>`;
  const horizontalAlignText = document.createElement('span');
  horizontalAlignText.id = 'horizontal-align-text';
  horizontalAlignText.textContent = '左对齐';
  horizontalAlignBtn.appendChild(horizontalAlignText);
  horizontalAlignPicker.appendChild(horizontalAlignBtn);

  // 水平对齐下拉面板
  const horizontalAlignDropdown = document.createElement('div');
  horizontalAlignDropdown.id = 'horizontal-align-dropdown';
  horizontalAlignDropdown.className = 'horizontal-align-dropdown';

  // 3 个水平对齐选项
  const horizontalAlignOptions: Array<{ id: string; align: string; title: string; label: string; active: boolean }> = [
    { id: 'font-align-left-btn', align: 'left', title: '左对齐', label: '左对齐', active: true },
    { id: 'font-align-center-btn', align: 'center', title: '居中对齐', label: '居中对齐', active: false },
    { id: 'font-align-right-btn', align: 'right', title: '右对齐', label: '右对齐', active: false },
  ];

  horizontalAlignOptions.forEach(({ id, align, title, label, active }) => {
    const option = document.createElement('div');
    option.className = active ? 'horizontal-align-option active' : 'horizontal-align-option';
    option.id = id;
    option.dataset.align = align;
    option.title = title;
    option.textContent = label;
    horizontalAlignDropdown.appendChild(option);
  });

  horizontalAlignPicker.appendChild(horizontalAlignDropdown);
  toolbarGroup.appendChild(horizontalAlignPicker);

  // === 垂直对齐选择器 ===
  const verticalAlignPicker = document.createElement('div');
  verticalAlignPicker.className = 'vertical-align-picker';
  verticalAlignPicker.title = '垂直对齐';

  // 垂直对齐按钮
  const verticalAlignBtn = document.createElement('button');
  verticalAlignBtn.id = 'vertical-align-btn';
  verticalAlignBtn.type = 'button';
  verticalAlignBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 2.5H14M1 7.5H14M1 12.5H14M7.5 4V6M7.5 9V11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
              </svg>`;
  const verticalAlignText = document.createElement('span');
  verticalAlignText.id = 'vertical-align-text';
  verticalAlignText.textContent = '居中';
  verticalAlignBtn.appendChild(verticalAlignText);
  verticalAlignPicker.appendChild(verticalAlignBtn);

  // 垂直对齐下拉面板
  const verticalAlignDropdown = document.createElement('div');
  verticalAlignDropdown.id = 'vertical-align-dropdown';
  verticalAlignDropdown.className = 'vertical-align-dropdown';

  // 3 个垂直对齐选项
  const verticalAlignOptionConfigs: Array<{ align: string; label: string; active: boolean }> = [
    { align: 'top', label: '上对齐', active: false },
    { align: 'middle', label: '居中对齐', active: true },
    { align: 'bottom', label: '下对齐', active: false },
  ];

  verticalAlignOptionConfigs.forEach(({ align, label, active }) => {
    const option = document.createElement('div');
    option.className = active ? 'vertical-align-option active' : 'vertical-align-option';
    option.dataset.align = align;
    option.textContent = label;
    verticalAlignDropdown.appendChild(option);
  });

  verticalAlignPicker.appendChild(verticalAlignDropdown);
  toolbarGroup.appendChild(verticalAlignPicker);

  // === 自动换行按钮 ===
  const wrapTextBtn = document.createElement('button');
  wrapTextBtn.id = 'wrap-text-btn';
  wrapTextBtn.className = 'toolbar-btn wrap-text-btn';
  wrapTextBtn.title = '自动换行';
  wrapTextBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 3.5H13M2 7.5H11C11.8284 7.5 12.5 8.17157 12.5 9C12.5 9.82843 11.8284 10.5 11 10.5H9M9 10.5L10.5 9M9 10.5L10.5 12M2 11.5H6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>`;
  toolbarGroup.appendChild(wrapTextBtn);

  // === 分隔符 ===
  const separator2 = document.createElement('div');
  separator2.className = 'separator';
  toolbarGroup.appendChild(separator2);

  // === 条件格式按钮 ===
  const conditionalFormatBtn = document.createElement('button');
  conditionalFormatBtn.id = 'conditional-format-btn';
  conditionalFormatBtn.title = '条件格式';
  conditionalFormatBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 2.5C2 2.22386 2.22386 2 2.5 2H12.5C12.7761 2 13 2.22386 13 2.5V5.5C13 5.77614 12.7761 6 12.5 6H2.5C2.22386 6 2 5.77614 2 5.5V2.5Z" fill="#4CAF50" fill-opacity="0.3"></path>
              <path d="M2 6.5C2 6.22386 2.22386 6 2.5 6H12.5C12.7761 6 13 6.22386 13 6.5V9.5C13 9.77614 12.7761 10 12.5 10H2.5C2.22386 10 2 9.77614 2 9.5V6.5Z" fill="#FFC107" fill-opacity="0.3"></path>
              <path d="M2 10.5C2 10.2239 2.22386 10 2.5 10H12.5C12.7761 10 13 10.2239 13 10.5V12.5C13 12.7761 12.7761 13 12.5 13H2.5C2.22386 13 2 12.7761 2 12.5V10.5Z" fill="#F44336" fill-opacity="0.3"></path>
              <rect x="2" y="2" width="11" height="11" rx="0.5" stroke="currentColor" stroke-width="1"></rect>
            </svg>`;
  const conditionalFormatSpan = document.createElement('span');
  conditionalFormatSpan.textContent = '条件格式';
  conditionalFormatBtn.appendChild(conditionalFormatSpan);
  toolbarGroup.appendChild(conditionalFormatBtn);

  // === 分隔符 ===
  const separator3 = document.createElement('div');
  separator3.className = 'separator';
  toolbarGroup.appendChild(separator3);

  // === 插入图表按钮 ===
  const insertChartBtn = document.createElement('button');
  insertChartBtn.id = 'insert-chart-btn';
  insertChartBtn.title = '插入图表';
  insertChartBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="8" width="3" height="5" rx="0.5" fill="currentColor"></rect>
              <rect x="6" y="5" width="3" height="8" rx="0.5" fill="currentColor"></rect>
              <rect x="10" y="2" width="3" height="11" rx="0.5" fill="currentColor"></rect>
            </svg>`;
  const insertChartSpan = document.createElement('span');
  insertChartSpan.textContent = '图表';
  insertChartBtn.appendChild(insertChartSpan);
  toolbarGroup.appendChild(insertChartBtn);

  // === 迷你图选择器 ===
  const sparklinePicker = document.createElement('div');
  sparklinePicker.className = 'sparkline-picker';
  sparklinePicker.title = '迷你图';

  // 迷你图按钮
  const sparklineBtn = document.createElement('button');
  sparklineBtn.id = 'sparkline-btn';
  sparklineBtn.type = 'button';
  sparklineBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 11L4 6L7 8L11 3L14 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>`;
  const sparklineBtnSpan = document.createElement('span');
  sparklineBtnSpan.textContent = '迷你图';
  sparklineBtn.appendChild(sparklineBtnSpan);
  sparklinePicker.appendChild(sparklineBtn);

  // 迷你图下拉面板
  const sparklineDropdown = document.createElement('div');
  sparklineDropdown.id = 'sparkline-dropdown';
  sparklineDropdown.className = 'sparkline-dropdown';

  const sparklineOptionConfigs: Array<{ type: string; label: string }> = [
    { type: 'line', label: '折线迷你图' },
    { type: 'bar', label: '柱状迷你图' },
    { type: 'winLoss', label: '盈亏迷你图' },
  ];

  sparklineOptionConfigs.forEach(({ type, label }) => {
    const option = document.createElement('div');
    option.className = 'sparkline-option';
    option.dataset.type = type;
    option.textContent = label;
    sparklineDropdown.appendChild(option);
  });

  sparklinePicker.appendChild(sparklineDropdown);
  toolbarGroup.appendChild(sparklinePicker);

  // === 冻结窗格选择器 ===
  const freezePicker = document.createElement('div');
  freezePicker.className = 'freeze-picker';
  freezePicker.title = '冻结窗格';

  // 冻结按钮
  const freezeBtn = document.createElement('button');
  freezeBtn.id = 'freeze-btn';
  freezeBtn.type = 'button';
  freezeBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 1V14M7.5 1L5 3.5M7.5 1L10 3.5M7.5 14L5 11.5M7.5 14L10 11.5M1 7.5H14M1 7.5L3.5 5M1 7.5L3.5 10M14 7.5L11.5 5M14 7.5L11.5 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>`;
  const freezeBtnSpan = document.createElement('span');
  freezeBtnSpan.textContent = '冻结';
  freezeBtn.appendChild(freezeBtnSpan);
  freezePicker.appendChild(freezeBtn);

  // 冻结下拉面板
  const freezeDropdown = document.createElement('div');
  freezeDropdown.id = 'freeze-dropdown';
  freezeDropdown.className = 'freeze-dropdown';

  const freezeOptionConfigs: Array<{ freeze: string; label: string }> = [
    { freeze: 'firstRow', label: '冻结首行' },
    { freeze: 'firstCol', label: '冻结首列' },
    { freeze: 'currentCell', label: '冻结至当前单元格' },
    { freeze: 'none', label: '取消冻结' },
  ];

  freezeOptionConfigs.forEach(({ freeze, label }) => {
    const option = document.createElement('div');
    option.className = 'freeze-option';
    option.dataset.freeze = freeze;
    option.textContent = label;
    freezeDropdown.appendChild(option);
  });

  freezePicker.appendChild(freezeDropdown);
  toolbarGroup.appendChild(freezePicker);

  // === 分隔符 ===
  const separator4 = document.createElement('div');
  separator4.className = 'separator';
  toolbarGroup.appendChild(separator4);

  // === 格式刷按钮 ===
  const formatPainterBtn = document.createElement('button');
  formatPainterBtn.id = 'format-painter-btn';
  formatPainterBtn.title = '格式刷（单击单次，双击锁定）';
  formatPainterBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 1H4C3.44772 1 3 1.44772 3 2V4C3 4.55228 3.44772 5 4 5H10C10.5523 5 11 4.55228 11 4V2C11 1.44772 10.5523 1 10 1ZM6 5V7H8V5M7 7V13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>`;
  const formatPainterSpan = document.createElement('span');
  formatPainterSpan.textContent = '格式刷';
  formatPainterBtn.appendChild(formatPainterSpan);
  toolbarGroup.appendChild(formatPainterBtn);

  // === 数据验证按钮 ===
  const validationBtn = document.createElement('button');
  validationBtn.id = 'validation-btn';
  validationBtn.title = '数据验证';
  validationBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3354 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.5553 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
            </svg>`;
  const validationSpan = document.createElement('span');
  validationSpan.textContent = '数据验证';
  validationBtn.appendChild(validationSpan);
  toolbarGroup.appendChild(validationBtn);

  // === 脚本编辑器按钮 ===
  const scriptEditorBtn = document.createElement('button');
  scriptEditorBtn.id = 'script-editor-btn';
  scriptEditorBtn.title = '脚本编辑器';
  scriptEditorBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4L1.5 7.5L4 11M11 4L13.5 7.5L11 11M9 2L6 13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>`;
  const scriptEditorSpan = document.createElement('span');
  scriptEditorSpan.textContent = '脚本';
  scriptEditorBtn.appendChild(scriptEditorSpan);
  toolbarGroup.appendChild(scriptEditorBtn);

  // === 右侧状态区域 ===
  const toolbarRight = document.createElement('div');
  toolbarRight.className = 'toolbar-right';

  // 视口信息状态
  const statusDiv = document.createElement('div');
  statusDiv.className = 'status';

  const viewportInfo = document.createElement('span');
  viewportInfo.id = 'viewport-info';
  viewportInfo.textContent = '视图: 行 1-20, 列 A-Z';
  statusDiv.appendChild(viewportInfo);
  toolbarRight.appendChild(statusDiv);

  // === 协同状态指示器（协同模式下显示） ===
  const collabStatus = document.createElement('div');
  collabStatus.id = 'collab-status';
  collabStatus.className = 'collab-status';
  collabStatus.style.display = 'none';

  // --- 连接状态 ---
  const collabConnection = document.createElement('span');
  collabConnection.id = 'collab-connection';
  collabConnection.className = 'collab-connection disconnected';
  collabConnection.title = '连接状态';

  const collabDot = document.createElement('span');
  collabDot.className = 'collab-dot';
  collabConnection.appendChild(collabDot);

  const collabConnectionText = document.createElement('span');
  collabConnectionText.id = 'collab-connection-text';
  collabConnectionText.textContent = '未连接';
  collabConnection.appendChild(collabConnectionText);

  collabStatus.appendChild(collabConnection);

  // --- 在线用户 ---
  const collabUsers = document.createElement('span');
  collabUsers.id = 'collab-users';
  collabUsers.className = 'collab-users';
  collabUsers.title = '在线用户';

  // 用户图标 SVG
  collabUsers.innerHTML = `<svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 0.875C5.49797 0.875 3.875 2.49797 3.875 4.5C3.875 6.50203 5.49797 8.125 7.5 8.125C9.50203 8.125 11.125 6.50203 11.125 4.5C11.125 2.49797 9.50203 0.875 7.5 0.875ZM4.825 4.5C4.825 3.02264 6.02264 1.825 7.5 1.825C8.97736 1.825 10.175 3.02264 10.175 4.5C10.175 5.97736 8.97736 7.175 7.5 7.175C6.02264 7.175 4.825 5.97736 4.825 4.5ZM2.5 14C2.5 11.2386 4.73858 9 7.5 9C10.2614 9 12.5 11.2386 12.5 14H11.5C11.5 11.7909 9.70914 10 7.5 10C5.29086 10 3.5 11.7909 3.5 14H2.5Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
              </svg>`;

  const collabUserCount = document.createElement('span');
  collabUserCount.id = 'collab-user-count';
  collabUserCount.textContent = '0';
  collabUsers.appendChild(collabUserCount);

  // 在线用户下拉列表
  const collabUserDropdown = document.createElement('div');
  collabUserDropdown.id = 'collab-user-dropdown';
  collabUserDropdown.className = 'collab-user-dropdown';

  const collabUserDropdownTitle = document.createElement('div');
  collabUserDropdownTitle.className = 'collab-user-dropdown-title';
  collabUserDropdownTitle.textContent = '在线用户';
  collabUserDropdown.appendChild(collabUserDropdownTitle);

  const collabUserList = document.createElement('ul');
  collabUserList.id = 'collab-user-list';
  collabUserList.className = 'collab-user-list';
  collabUserDropdown.appendChild(collabUserList);

  collabUsers.appendChild(collabUserDropdown);
  collabStatus.appendChild(collabUsers);

  // --- 同步状态 ---
  const collabSync = document.createElement('span');
  collabSync.id = 'collab-sync';
  collabSync.className = 'collab-sync';
  collabSync.style.display = 'none';
  collabSync.title = '同步中';

  // 同步图标 SVG
  collabSync.innerHTML = `<svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.90321 7.29677C1.90321 10.341 4.11041 12.4147 6.58893 12.8439C6.87255 12.893 7.06266 13.1627 7.01355 13.4464C6.96444 13.73 6.69471 13.9201 6.41109 13.871C3.49942 13.3668 0.953213 10.9127 0.953213 7.29677C0.953213 5.76009 1.55074 4.55245 2.41316 3.77997L1.23 3.77997C0.953857 3.77997 0.73 3.55611 0.73 3.27997C0.73 3.00383 0.953857 2.77997 1.23 2.77997L3.73 2.77997C4.00614 2.77997 4.23 3.00383 4.23 3.27997L4.23 5.77997C4.23 6.05611 4.00614 6.27997 3.73 6.27997C3.45386 6.27997 3.23 6.05611 3.23 5.77997L3.23 4.34639C2.45426 5.03425 1.90321 6.01236 1.90321 7.29677ZM13.0468 7.29677C13.0468 4.25257 10.8396 2.17888 8.36109 1.74966C8.07747 1.70055 7.88736 1.43082 7.93647 1.1472C7.98558 0.863579 8.25531 0.673466 8.53893 0.722578C11.4506 1.22685 13.9968 3.68097 13.9968 7.29677C13.9968 8.83346 13.3993 10.0411 12.5369 10.8136L13.72 10.8136C13.9961 10.8136 14.22 11.0374 14.22 11.3136C14.22 11.5897 13.9961 11.8136 13.72 11.8136L11.22 11.8136C10.9439 11.8136 10.72 11.5897 10.72 11.3136L10.72 8.81357C10.72 8.53743 10.9439 8.31357 11.22 8.31357C11.4961 8.31357 11.72 8.53743 11.72 8.81357L11.72 10.247C12.4957 9.55918 13.0468 8.58107 13.0468 7.29677Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
              </svg>`;

  collabStatus.appendChild(collabSync);
  toolbarRight.appendChild(collabStatus);
  toolbarGroup.appendChild(toolbarRight);

  row1.appendChild(toolbarGroup);
  toolbar.appendChild(row1);
}

/** 创建工具栏第二行：单元格地址、公式栏输入、确认按钮、扩展按钮 */
function renderToolbarRow2(toolbar: HTMLElement): void {
  // 创建 .toolbar-row.toolbar-row-2 结构
  const row2 = document.createElement('div');
  row2.className = 'toolbar-row toolbar-row-2';

  // === .cell-info 区域 ===
  const cellInfo = document.createElement('div');
  cellInfo.className = 'cell-info';

  // 单元格地址显示
  const selectedCell = document.createElement('span');
  selectedCell.id = 'selected-cell';
  selectedCell.textContent = 'A1';
  cellInfo.appendChild(selectedCell);

  // 公式栏输入框
  const cellContent = document.createElement('input');
  cellContent.id = 'cell-content';
  cellContent.type = 'text';
  cellContent.autocomplete = 'off';
  cellContent.placeholder = '单元格内容（=SUM/SUBTRACT/MULTIPLY/DIVIDE 支持）';
  cellInfo.appendChild(cellContent);

  // 确认按钮（包含 SVG 勾选图标）
  const setContentBtn = document.createElement('button');
  setContentBtn.id = 'set-content';
  setContentBtn.title = '确认输入';
  setContentBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
              </svg>`;
  cellInfo.appendChild(setContentBtn);

  // 公式错误提示
  const formulaError = document.createElement('div');
  formulaError.id = 'formula-error';
  formulaError.className = 'formula-error';
  cellInfo.appendChild(formulaError);

  row2.appendChild(cellInfo);

  // === .toolbar-group 区域 ===
  const toolbarGroup = document.createElement('div');
  toolbarGroup.className = 'toolbar-group';

  // 插入超链接按钮
  const hyperlinkBtn = document.createElement('button');
  hyperlinkBtn.id = 'hyperlink-btn';
  hyperlinkBtn.title = '插入超链接';
  hyperlinkBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.51 7.5a2.5 2.5 0 0 1-2.5 2.5H4.5a2.5 2.5 0 0 1 0-5h1M6.49 7.5a2.5 2.5 0 0 1 2.5-2.5h1.51a2.5 2.5 0 0 1 0 5h-1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>`;
  const hyperlinkSpan = document.createElement('span');
  hyperlinkSpan.textContent = '链接';
  hyperlinkBtn.appendChild(hyperlinkSpan);
  toolbarGroup.appendChild(hyperlinkBtn);

  // 插入图片按钮
  const imageBtn = document.createElement('button');
  imageBtn.id = 'image-btn';
  imageBtn.title = '插入图片';
  imageBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="11" height="11" rx="1" stroke="currentColor" stroke-width="1.2"></rect>
                <circle cx="5.5" cy="5.5" r="1" fill="currentColor"></circle>
                <path d="M2 10l3-3 2 2 3-3 3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>`;
  const imageSpan = document.createElement('span');
  imageSpan.textContent = '图片';
  imageBtn.appendChild(imageSpan);
  toolbarGroup.appendChild(imageBtn);

  // 数据透视表按钮
  const pivotTableBtn = document.createElement('button');
  pivotTableBtn.id = 'pivot-table-btn';
  pivotTableBtn.title = '数据透视表';
  pivotTableBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1.5" y="1.5" width="12" height="12" rx="0.5" stroke="currentColor" stroke-width="1"></rect>
                <line x1="1.5" y1="5" x2="13.5" y2="5" stroke="currentColor" stroke-width="1"></line>
                <line x1="5" y1="5" x2="5" y2="13.5" stroke="currentColor" stroke-width="1"></line>
              </svg>`;
  const pivotSpan = document.createElement('span');
  pivotSpan.textContent = '透视表';
  pivotTableBtn.appendChild(pivotSpan);
  toolbarGroup.appendChild(pivotTableBtn);

  // 名称管理器按钮
  const nameManagerBtn = document.createElement('button');
  nameManagerBtn.id = 'name-manager-btn';
  nameManagerBtn.title = '名称管理器';
  nameManagerBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 3h11M2 7.5h11M2 12h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <circle cx="12" cy="11" r="2" stroke="currentColor" stroke-width="1"/>
              </svg>`;
  const nameManagerSpan = document.createElement('span');
  nameManagerSpan.textContent = '名称';
  nameManagerBtn.appendChild(nameManagerSpan);
  toolbarGroup.appendChild(nameManagerBtn);

  // 插件中心按钮
  const pluginCenterBtn = document.createElement('button');
  pluginCenterBtn.id = 'plugin-center-btn';
  pluginCenterBtn.title = '插件中心';
  pluginCenterBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1"/>
                <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1"/>
                <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1"/>
                <line x1="11.25" y1="9.5" x2="11.25" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <line x1="9.5" y1="11.25" x2="13" y2="11.25" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>`;
  const pluginSpan = document.createElement('span');
  pluginSpan.textContent = '插件';
  pluginCenterBtn.appendChild(pluginSpan);
  toolbarGroup.appendChild(pluginCenterBtn);

  // 分隔符
  const separator = document.createElement('div');
  separator.className = 'separator';
  toolbarGroup.appendChild(separator);

  row2.appendChild(toolbarGroup);

  toolbar.appendChild(row2);
}

/** 创建 spreadsheet 容器和 canvas */
function renderSpreadsheetContainer(appContainer: HTMLElement): void {
  // 创建 .spreadsheet-container 容器
  const spreadsheetContainer = document.createElement('div');
  spreadsheetContainer.className = 'spreadsheet-container';

  // 创建 canvas#excel-canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'excel-canvas';

  spreadsheetContainer.appendChild(canvas);
  appContainer.appendChild(spreadsheetContainer);
}

/** 创建 Sheet 标签栏容器 */
function renderSheetTabBar(appContainer: HTMLElement): void {
  // 创建 div#sheet-tab-bar.sheet-tab-bar
  const sheetTabBar = document.createElement('div');
  sheetTabBar.id = 'sheet-tab-bar';
  sheetTabBar.className = 'sheet-tab-bar';

  appContainer.appendChild(sheetTabBar);
}

/** 创建底部状态栏 */
function renderStatusBar(appContainer: HTMLElement): void {
  // 创建 .status-bar 容器
  const statusBar = document.createElement('div');
  statusBar.className = 'status-bar';

  // === 第一个 .status-item：内存使用信息 ===
  const statusItem1 = document.createElement('div');
  statusItem1.className = 'status-item';

  const memoryUsage = document.createElement('span');
  memoryUsage.id = 'memory-usage';
  memoryUsage.textContent = '无限滚动 - 按需加载数据';

  statusItem1.appendChild(memoryUsage);
  statusBar.appendChild(statusItem1);

  // === 第二个 .status-item：协同同步状态 + 单元格计数 ===
  const statusItem2 = document.createElement('div');
  statusItem2.className = 'status-item';

  const collabSyncStatus = document.createElement('span');
  collabSyncStatus.id = 'collab-sync-status';
  collabSyncStatus.className = 'collab-sync-text';
  collabSyncStatus.style.display = 'none';
  collabSyncStatus.textContent = '同步中...';

  const cellCount = document.createElement('span');
  cellCount.id = 'cell-count';
  cellCount.textContent = '1,000 行 × 100 列';

  statusItem2.appendChild(collabSyncStatus);
  statusItem2.appendChild(cellCount);
  statusBar.appendChild(statusItem2);

  // === 第三个 .status-item：选区统计信息 ===
  const statusItem3 = document.createElement('div');
  statusItem3.className = 'status-item';

  const selectionStats = document.createElement('span');
  selectionStats.id = 'selection-stats';
  selectionStats.className = 'selection-stats';
  selectionStats.style.display = 'none';

  statusItem3.appendChild(selectionStats);
  statusBar.appendChild(statusItem3);

  appContainer.appendChild(statusBar);
}

/** 创建协同通知容器 */
function renderCollabNotifications(appContainer: HTMLElement): void {
  // 创建 div#collab-notifications.collab-notifications
  const collabNotifications = document.createElement('div');
  collabNotifications.id = 'collab-notifications';
  collabNotifications.className = 'collab-notifications';

  appContainer.appendChild(collabNotifications);
}

/**
 * 在 SpreadsheetApp 实例化之前调用，动态创建所有工具栏 DOM 结构
 * @param container - #app 容器元素
 * @throws Error 如果 container 为 null/undefined
 */
export function renderToolbar(container: HTMLElement): void {
  // 校验 container 参数
  if (!container) {
    throw new Error('找不到 #app 容器元素');
  }

  // 创建 .toolbar 容器并挂载到 container
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  container.appendChild(toolbar);

  // 依次创建工具栏两行
  renderToolbarRow1(toolbar);
  renderToolbarRow2(toolbar);

  // 依次创建其他区域
  renderSpreadsheetContainer(container);
  renderSheetTabBar(container);
  renderStatusBar(container);
  renderCollabNotifications(container);
}
