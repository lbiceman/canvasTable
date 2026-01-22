import { SpreadsheetApp } from './app';
import themes from './themes.json';

export type ThemeType = 'light' | 'dark';

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
    icon.textContent = themeKey === 'light' ? '☀️' : '🌙';
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

  private showStatistics(): void {
    const stats = this.app.getStatistics();
    const message = `
      表格统计信息：
      • 总单元格数：${stats.totalCells}
      • 已填充单元格：${stats.filledCells}
      • 合并单元格：${stats.mergedCells}
      • 数据大小：${stats.dataSize}
    `;
    alert(message);
  }

  private handleClearData(): void {
    if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
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
