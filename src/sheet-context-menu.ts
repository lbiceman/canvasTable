// ============================================================
// SheetContextMenu - 工作表标签右键上下文菜单
// 提供重命名、删除、复制、隐藏、标签颜色、显示隐藏工作表等操作
// ============================================================

import { Modal } from './modal';
import { SheetManager } from './sheet-manager';
import type { SheetTabBar } from './sheet-tab-bar';

/** 菜单项定义 */
interface MenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
}

/** 预定义标签颜色 */
const TAB_COLORS = [
  '#FF0000', '#FF6600', '#FFCC00', '#33CC33',
  '#0099FF', '#6633CC', '#CC0066', '#999999',
];

export class SheetContextMenu {
  private menuElement: HTMLDivElement | null = null;
  private sheetManager: SheetManager;
  private sheetTabBar: SheetTabBar;
  private boundCloseHandler: ((e: MouseEvent) => void) | null = null;
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(sheetManager: SheetManager, sheetTabBar: SheetTabBar) {
    this.sheetManager = sheetManager;
    this.sheetTabBar = sheetTabBar;
  }

  /**
   * 显示上下文菜单
   * @param x 鼠标 X 坐标
   * @param y 鼠标 Y 坐标
   * @param sheetId 目标工作表 ID
   */
  show(x: number, y: number, sheetId: string): void {
    // 先关闭已有菜单
    this.hide();

    const menuItems = this.buildMenuItems(sheetId);
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'sheet-context-menu';

    for (const item of menuItems) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'sheet-context-menu-separator';
        this.menuElement.appendChild(sep);
      }

      const menuItem = document.createElement('div');
      menuItem.className = `sheet-context-menu-item${item.disabled ? ' disabled' : ''}`;
      menuItem.textContent = item.label;

      if (!item.disabled) {
        menuItem.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          this.hide();
          item.action();
        });
      }

      this.menuElement.appendChild(menuItem);
    }

    // 定位菜单
    this.menuElement.style.left = `${x}px`;
    this.menuElement.style.top = `${y}px`;
    document.body.appendChild(this.menuElement);

    // 确保菜单不超出视口
    requestAnimationFrame(() => {
      if (!this.menuElement) return;
      const rect = this.menuElement.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.menuElement.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.menuElement.style.top = `${y - rect.height}px`;
      }
    });

    // 点击外部关闭菜单
    this.boundCloseHandler = (e: MouseEvent) => {
      if (this.menuElement && !this.menuElement.contains(e.target as Node)) {
        this.hide();
      }
    };
    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };
    // 延迟绑定，避免当前点击事件立即触发关闭
    setTimeout(() => {
      document.addEventListener('mousedown', this.boundCloseHandler!);
      document.addEventListener('keydown', this.boundKeyHandler!);
    }, 0);
  }

  /** 隐藏并销毁菜单 */
  hide(): void {
    if (this.menuElement && this.menuElement.parentNode) {
      this.menuElement.parentNode.removeChild(this.menuElement);
    }
    this.menuElement = null;

    if (this.boundCloseHandler) {
      document.removeEventListener('mousedown', this.boundCloseHandler);
      this.boundCloseHandler = null;
    }
    if (this.boundKeyHandler) {
      document.removeEventListener('keydown', this.boundKeyHandler);
      this.boundKeyHandler = null;
    }
  }

  /**
   * 构建菜单项列表
   * 根据当前工作簿状态动态禁用选项
   */
  private buildMenuItems(sheetId: string): MenuItem[] {
    const visibleSheets = this.sheetManager.getVisibleSheets();
    const hiddenSheets = this.sheetManager.getHiddenSheets();
    const isOnlyVisible = visibleSheets.length <= 1;

    return [
      {
        label: '重命名',
        action: () => this.handleRename(sheetId),
      },
      {
        label: '删除',
        action: () => this.handleDelete(sheetId),
        disabled: isOnlyVisible,
      },
      {
        label: '复制',
        action: () => this.handleDuplicate(sheetId),
      },
      {
        label: '隐藏',
        action: () => this.handleHide(sheetId),
        disabled: isOnlyVisible,
        separator: true,
      },
      {
        label: '标签颜色',
        action: () => this.handleTabColor(sheetId),
        separator: true,
      },
      {
        label: `显示隐藏的工作表 (${hiddenSheets.length})`,
        action: () => this.handleShowHidden(),
        disabled: hiddenSheets.length === 0,
      },
    ];
  }

  // ============================================================
  // 菜单操作处理
  // ============================================================

  /** 重命名工作表 - 弹出 Modal prompt */
  private async handleRename(sheetId: string): Promise<void> {
    const sheet = this.sheetManager.getSheetById(sheetId);
    if (!sheet) return;

    const newName = await Modal.prompt('请输入新的工作表名称', {
      title: '重命名工作表',
      inputDefault: sheet.name,
      inputPlaceholder: '工作表名称',
    });

    if (newName === null) return;

    const result = this.sheetManager.renameSheet(sheetId, newName);
    if (!result.success && result.message) {
      await Modal.alert(result.message, { title: '重命名失败' });
      return;
    }

    this.sheetTabBar.render();
  }

  /** 删除工作表 - 弹出 Modal confirm 确认 */
  private async handleDelete(sheetId: string): Promise<void> {
    const sheet = this.sheetManager.getSheetById(sheetId);
    if (!sheet) return;

    const confirmed = await Modal.confirm(
      `确定要删除工作表「${sheet.name}」吗？此操作不可撤销。`,
      { title: '删除工作表' }
    );

    if (!confirmed) return;

    const success = this.sheetManager.deleteSheet(sheetId);
    if (success) {
      this.sheetTabBar.render();
    }
  }

  /** 复制工作表 */
  private handleDuplicate(sheetId: string): void {
    this.sheetManager.duplicateSheet(sheetId);
    this.sheetTabBar.render();
  }

  /** 隐藏工作表 */
  private handleHide(sheetId: string): void {
    const success = this.sheetManager.hideSheet(sheetId);
    if (success) {
      this.sheetTabBar.render();
    }
  }

  /** 显示隐藏的工作表 - 使用 Modal custom 展示列表 */
  private async handleShowHidden(): Promise<void> {
    const hiddenSheets = this.sheetManager.getHiddenSheets();
    if (hiddenSheets.length === 0) return;

    // 构建隐藏工作表列表 DOM
    const listContainer = document.createElement('div');
    listContainer.className = 'sheet-hidden-list';

    for (const sheet of hiddenSheets) {
      const item = document.createElement('div');
      item.className = 'sheet-hidden-list-item';
      item.textContent = sheet.name;
      item.addEventListener('click', () => {
        this.sheetManager.showSheet(sheet.id);
        this.sheetTabBar.render();
        // 关闭弹窗 - 通过模拟 Escape 键
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      listContainer.appendChild(item);
    }

    await Modal.custom({
      title: '显示隐藏的工作表',
      customContent: listContainer,
      showCancel: false,
      confirmText: '关闭',
    });
  }

  /** 标签颜色 - 显示颜色选择面板 */
  private async handleTabColor(sheetId: string): Promise<void> {
    const sheet = this.sheetManager.getSheetById(sheetId);
    if (!sheet) return;

    // 构建颜色选择面板 DOM
    const colorPanel = document.createElement('div');
    colorPanel.className = 'sheet-color-picker';

    // 「无颜色」选项
    const noneOption = document.createElement('div');
    noneOption.className = 'sheet-color-picker-none';
    noneOption.textContent = '无颜色';
    if (!sheet.tabColor) {
      noneOption.classList.add('selected');
    }
    colorPanel.appendChild(noneOption);

    // 颜色网格
    const colorGrid = document.createElement('div');
    colorGrid.className = 'sheet-color-picker-grid';

    let selectedColor: string | null = sheet.tabColor;

    for (const color of TAB_COLORS) {
      const swatch = document.createElement('div');
      swatch.className = 'sheet-color-picker-swatch';
      swatch.style.backgroundColor = color;
      if (sheet.tabColor === color) {
        swatch.classList.add('selected');
      }
      swatch.addEventListener('click', () => {
        // 清除所有选中状态
        colorGrid.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
        noneOption.classList.remove('selected');
        swatch.classList.add('selected');
        selectedColor = color;
      });
      colorGrid.appendChild(swatch);
    }

    noneOption.addEventListener('click', () => {
      colorGrid.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
      noneOption.classList.add('selected');
      selectedColor = null;
    });

    colorPanel.appendChild(colorGrid);

    const confirmed = await Modal.custom({
      title: '标签颜色',
      customContent: colorPanel,
      confirmText: '确定',
      cancelText: '取消',
    });

    if (confirmed) {
      this.sheetManager.setTabColor(sheetId, selectedColor);
      this.sheetTabBar.render();
    }
  }

  // ============================================================
  // 主题适配与销毁
  // ============================================================

  /** 适配主题切换 */
  applyTheme(_themeColors: Record<string, string>): void {
    // 菜单使用 CSS 变量，主题切换时自动适配
    // 此方法预留用于未来可能的动态样式调整
  }

  /** 销毁组件 */
  destroy(): void {
    this.hide();
  }
}
