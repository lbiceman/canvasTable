// ============================================================
// SheetTabBar - 工作表标签栏 UI 组件
// 渲染在 Canvas 下方、状态栏上方，提供工作表切换、新增、
// 拖拽排序、重命名、右键菜单等交互功能
// ============================================================

import { Modal } from './modal';
import { SheetManager } from './sheet-manager';
import type { SheetMeta } from './types';

/** 事件回调接口 */
interface SheetTabBarCallbacks {
  /** 切换工作表后回调 */
  onSheetSwitch?: (sheetId: string) => void;
  /** 新增工作表后回调 */
  onSheetAdd?: () => void;
  /** 右键点击标签回调 */
  onContextMenu?: (e: MouseEvent, sheetId: string) => void;
}

export class SheetTabBar {
  private container: HTMLDivElement;
  private tabsContainer: HTMLDivElement;
  private addButton: HTMLButtonElement;
  private scrollLeftBtn: HTMLButtonElement;
  private scrollRightBtn: HTMLButtonElement;
  private dropIndicator: HTMLDivElement;
  private sheetManager: SheetManager;

  /** 事件回调 */
  public onSheetSwitch?: (sheetId: string) => void;
  public onSheetAdd?: () => void;
  public onContextMenu?: (e: MouseEvent, sheetId: string) => void;

  /** 拖拽状态 */
  private isDragging = false;
  private dragSheetId: string | null = null;
  private dragStartX = 0;

  /** 绑定的事件处理器引用（用于销毁时移除） */
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundResizeHandler: (() => void) | null = null;

  constructor(
    parentElement: HTMLElement,
    sheetManager: SheetManager,
    callbacks?: SheetTabBarCallbacks
  ) {
    this.sheetManager = sheetManager;

    // 设置回调
    if (callbacks) {
      this.onSheetSwitch = callbacks.onSheetSwitch;
      this.onSheetAdd = callbacks.onSheetAdd;
      this.onContextMenu = callbacks.onContextMenu;
    }

    // 获取或创建容器
    this.container = parentElement as HTMLDivElement;
    this.container.innerHTML = '';

    // 创建左侧滚动按钮
    this.scrollLeftBtn = document.createElement('button');
    this.scrollLeftBtn.className = 'sheet-tab-scroll-left';
    this.scrollLeftBtn.textContent = '◀';
    this.scrollLeftBtn.title = '向左滚动';
    this.scrollLeftBtn.addEventListener('click', () => this.scrollTabs('left'));
    this.container.appendChild(this.scrollLeftBtn);

    // 创建「+」新增按钮
    this.addButton = document.createElement('button');
    this.addButton.className = 'sheet-tab-add-btn';
    this.addButton.textContent = '+';
    this.addButton.title = '新增工作表';
    this.addButton.addEventListener('click', () => this.handleAddClick());
    this.container.appendChild(this.addButton);

    // 创建标签列表容器
    this.tabsContainer = document.createElement('div');
    this.tabsContainer.className = 'sheet-tab-list';
    this.container.appendChild(this.tabsContainer);

    // 创建拖拽指示线
    this.dropIndicator = document.createElement('div');
    this.dropIndicator.className = 'sheet-tab-drop-indicator';
    this.dropIndicator.style.display = 'none';
    this.container.appendChild(this.dropIndicator);

    // 创建右侧滚动按钮
    this.scrollRightBtn = document.createElement('button');
    this.scrollRightBtn.className = 'sheet-tab-scroll-right';
    this.scrollRightBtn.textContent = '▶';
    this.scrollRightBtn.title = '向右滚动';
    this.scrollRightBtn.addEventListener('click', () => this.scrollTabs('right'));
    this.container.appendChild(this.scrollRightBtn);

    // 监听窗口大小变化，更新滚动箭头
    this.boundResizeHandler = () => this.updateScrollArrows();
    window.addEventListener('resize', this.boundResizeHandler);

    // 初始渲染
    this.render();
  }

  // ============================================================
  // 渲染方法
  // ============================================================

  /** 渲染所有可见工作表标签 */
  public render(): void {
    // 清空标签容器
    this.tabsContainer.innerHTML = '';

    const visibleSheets = this.sheetManager.getVisibleSheets();
    const activeSheet = this.sheetManager.getActiveSheet();

    for (const sheet of visibleSheets) {
      const tabEl = this.renderTab(sheet, sheet.id === activeSheet.id);
      this.tabsContainer.appendChild(tabEl);
    }

    // 更新滚动箭头可见性
    this.updateScrollArrows();
  }

  /**
   * 渲染单个工作表标签
   * @param sheet 工作表元数据
   * @param isActive 是否为当前活动工作表
   */
  private renderTab(sheet: SheetMeta, isActive: boolean): HTMLDivElement {
    const tab = document.createElement('div');
    tab.className = `sheet-tab${isActive ? ' active' : ''}`;
    tab.dataset.sheetId = sheet.id;

    // 标签名称
    const nameSpan = document.createElement('span');
    nameSpan.className = 'sheet-tab-name';
    nameSpan.textContent = sheet.name;
    tab.appendChild(nameSpan);

    // 颜色指示条（仅在设置了 tabColor 时显示）
    if (sheet.tabColor) {
      const colorBar = document.createElement('div');
      colorBar.className = 'sheet-tab-color-bar';
      colorBar.style.backgroundColor = sheet.tabColor;
      tab.appendChild(colorBar);
    }

    // 绑定点击事件 - 切换工作表
    tab.addEventListener('click', () => this.handleTabClick(sheet.id));

    // 绑定双击事件 - 弹出重命名 Modal
    tab.addEventListener('dblclick', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleTabDoubleClick(sheet.id);
    });

    // 绑定右键事件 - 触发上下文菜单
    tab.addEventListener('contextmenu', (e: MouseEvent) => {
      this.handleTabContextMenu(e, sheet.id);
    });

    // 初始化拖拽排序
    this.initDragAndDrop(tab, sheet.id);

    return tab;
  }

  /** 更新滚动箭头的可见性 */
  private updateScrollArrows(): void {
    const { scrollLeft, scrollWidth, clientWidth } = this.tabsContainer;
    const hasOverflow = scrollWidth > clientWidth;

    // 左侧箭头：有溢出且未滚动到最左
    if (hasOverflow && scrollLeft > 0) {
      this.scrollLeftBtn.classList.add('visible');
    } else {
      this.scrollLeftBtn.classList.remove('visible');
    }

    // 右侧箭头：有溢出且未滚动到最右
    if (hasOverflow && scrollLeft + clientWidth < scrollWidth - 1) {
      this.scrollRightBtn.classList.add('visible');
    } else {
      this.scrollRightBtn.classList.remove('visible');
    }
  }

  /**
   * 滚动标签列表
   * @param direction 滚动方向
   */
  private scrollTabs(direction: 'left' | 'right'): void {
    const scrollAmount = 120;
    if (direction === 'left') {
      this.tabsContainer.scrollLeft -= scrollAmount;
    } else {
      this.tabsContainer.scrollLeft += scrollAmount;
    }
    // 滚动后更新箭头状态
    requestAnimationFrame(() => this.updateScrollArrows());
  }

  // ============================================================
  // 交互处理
  // ============================================================

  /** 标签点击 - 切换工作表 */
  private handleTabClick(sheetId: string): void {
    const activeSheet = this.sheetManager.getActiveSheet();
    if (sheetId === activeSheet.id) {
      return;
    }

    this.sheetManager.switchSheet(sheetId);
    this.render();
    // onSheetSwitch 回调已由 SheetManager.switchSheet 内部的 onSwitchCallback 触发
  }

  /** 标签双击 - 弹出 Modal prompt 重命名 */
  private handleTabDoubleClick(sheetId: string): void {
    this.showRenameModal(sheetId);
  }

  /** 标签右键 - 触发上下文菜单 */
  private handleTabContextMenu(e: MouseEvent, sheetId: string): void {
    e.preventDefault();
    e.stopPropagation();
    this.onContextMenu?.(e, sheetId);
  }

  /** 「+」按钮点击 - 新增工作表 */
  private handleAddClick(): void {
    this.sheetManager.addSheet();
    this.render();
    // onSheetAdd 回调已由 SheetManager.addSheet -> switchSheet 内部的 onSwitchCallback 触发
  }

  // ============================================================
  // 重命名 Modal
  // ============================================================

  /**
   * 弹出重命名 Modal prompt
   * 使用 Modal.prompt() 获取新名称，验证后应用
   */
  private async showRenameModal(sheetId: string): Promise<void> {
    const sheet = this.sheetManager.getSheetById(sheetId);
    if (!sheet) {
      return;
    }

    const newName = await Modal.prompt('请输入新的工作表名称', {
      title: '重命名工作表',
      inputDefault: sheet.name,
      inputPlaceholder: '工作表名称',
    });

    // 用户取消
    if (newName === null) {
      return;
    }

    // 调用 SheetManager 验证并重命名
    const result = this.sheetManager.renameSheet(sheetId, newName);
    if (!result.success && result.message) {
      await Modal.alert(result.message, { title: '重命名失败' });
      return;
    }

    // 重命名成功，刷新标签栏
    this.render();
  }

  // ============================================================
  // 拖拽排序
  // ============================================================

  /**
   * 初始化标签的拖拽排序
   * mousedown 启动拖拽、mousemove 显示插入指示线、mouseup 完成排序
   */
  private initDragAndDrop(tabElement: HTMLDivElement, sheetId: string): void {
    tabElement.addEventListener('mousedown', (e: MouseEvent) => {
      // 仅响应左键
      if (e.button !== 0) {
        return;
      }

      this.isDragging = false;
      this.dragSheetId = sheetId;
      this.dragStartX = e.clientX;

      // 绑定全局 mousemove 和 mouseup
      this.boundMouseMove = (moveEvent: MouseEvent) => {
        this.handleDragMove(moveEvent, tabElement);
      };
      this.boundMouseUp = (upEvent: MouseEvent) => {
        this.handleDragEnd(upEvent);
      };

      document.addEventListener('mousemove', this.boundMouseMove);
      document.addEventListener('mouseup', this.boundMouseUp);
    });
  }

  /**
   * 拖拽移动处理
   * 超过 5px 阈值后启动拖拽，显示插入指示线
   */
  private handleDragMove(e: MouseEvent, sourceTab: HTMLDivElement): void {
    const dx = Math.abs(e.clientX - this.dragStartX);

    // 超过阈值才启动拖拽（避免误触）
    if (!this.isDragging && dx > 5) {
      this.isDragging = true;
      sourceTab.classList.add('dragging');
    }

    if (!this.isDragging) {
      return;
    }

    // 计算插入位置并显示指示线
    const tabs = Array.from(
      this.tabsContainer.querySelectorAll<HTMLDivElement>('.sheet-tab')
    );
    const containerRect = this.tabsContainer.getBoundingClientRect();
    let indicatorLeft = 0;
    let found = false;

    for (const tab of tabs) {
      const tabRect = tab.getBoundingClientRect();
      const tabCenter = tabRect.left + tabRect.width / 2;

      if (e.clientX < tabCenter) {
        indicatorLeft = tabRect.left - containerRect.left + this.tabsContainer.scrollLeft;
        found = true;
        break;
      }
    }

    // 如果鼠标在所有标签右侧，指示线放在最后一个标签右边
    if (!found && tabs.length > 0) {
      const lastTab = tabs[tabs.length - 1];
      const lastRect = lastTab.getBoundingClientRect();
      indicatorLeft = lastRect.right - containerRect.left + this.tabsContainer.scrollLeft;
    }

    this.dropIndicator.style.display = 'block';
    this.dropIndicator.style.left = `${indicatorLeft + this.tabsContainer.offsetLeft}px`;
  }

  /**
   * 拖拽结束处理
   * 计算目标位置，调用 sheetManager.reorderSheet() 完成排序
   */
  private handleDragEnd(e: MouseEvent): void {
    // 移除全局事件监听
    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove);
      this.boundMouseMove = null;
    }
    if (this.boundMouseUp) {
      document.removeEventListener('mouseup', this.boundMouseUp);
      this.boundMouseUp = null;
    }

    // 隐藏指示线
    this.dropIndicator.style.display = 'none';

    // 移除拖拽样式
    const draggingTab = this.tabsContainer.querySelector('.sheet-tab.dragging');
    if (draggingTab) {
      draggingTab.classList.remove('dragging');
    }

    if (!this.isDragging || !this.dragSheetId) {
      this.isDragging = false;
      this.dragSheetId = null;
      return;
    }

    // 计算目标索引
    const visibleSheets = this.sheetManager.getVisibleSheets();
    const tabs = Array.from(
      this.tabsContainer.querySelectorAll<HTMLDivElement>('.sheet-tab')
    );
    let targetIndex = visibleSheets.length - 1;

    for (let i = 0; i < tabs.length; i++) {
      const tabRect = tabs[i].getBoundingClientRect();
      const tabCenter = tabRect.left + tabRect.width / 2;

      if (e.clientX < tabCenter) {
        targetIndex = i;
        break;
      }
    }

    // 调整目标索引：如果拖拽源在目标之前，需要减 1
    const sourceIndex = visibleSheets.findIndex((s) => s.id === this.dragSheetId);
    if (sourceIndex >= 0 && sourceIndex < targetIndex) {
      targetIndex = Math.max(0, targetIndex - 1);
    }

    // 执行排序
    this.sheetManager.reorderSheet(this.dragSheetId, targetIndex);
    this.render();

    this.isDragging = false;
    this.dragSheetId = null;
  }

  // ============================================================
  // 主题适配
  // ============================================================

  /**
   * 适配主题切换
   * 通过 CSS 变量更新标签栏颜色
   */
  public applyTheme(themeColors: Record<string, string>): void {
    const root = document.documentElement;

    const colorMap: Record<string, string> = {
      sheetTabBackground: '--sheet-tab-bg',
      sheetTabActiveBackground: '--sheet-tab-active-bg',
      sheetTabText: '--sheet-tab-text',
      sheetTabActiveText: '--sheet-tab-active-text',
      sheetTabBorder: '--sheet-tab-border',
      sheetTabHoverBackground: '--sheet-tab-hover-bg',
    };

    for (const [key, cssVar] of Object.entries(colorMap)) {
      if (themeColors[key]) {
        root.style.setProperty(cssVar, themeColors[key]);
      }
    }
  }

  // ============================================================
  // 销毁
  // ============================================================

  /** 销毁组件，移除事件监听和 DOM */
  public destroy(): void {
    // 移除全局事件监听
    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove);
      this.boundMouseMove = null;
    }
    if (this.boundMouseUp) {
      document.removeEventListener('mouseup', this.boundMouseUp);
      this.boundMouseUp = null;
    }
    if (this.boundResizeHandler) {
      window.removeEventListener('resize', this.boundResizeHandler);
      this.boundResizeHandler = null;
    }

    // 清空容器内容
    this.container.innerHTML = '';
  }
}
