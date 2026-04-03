// ============================================================
// CellContextMenu - 单元格右键上下文菜单
// 提供剪切/复制/粘贴/插入/删除/格式刷/清除格式/排序/筛选等操作
// 支持插件系统通过 registerExtraItem / removeExtraItem 扩展菜单
// ============================================================

/** 菜单项定义 */
export interface CellMenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
}

/** 回调接口，避免与 SpreadsheetApp 的循环依赖 */
export interface CellContextMenuCallbacks {
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onPasteSpecial: () => void;
  onInsertHyperlink: (row: number, col: number) => void;
  onEditHyperlink: (row: number, col: number) => void;
  onRemoveHyperlink: (row: number, col: number) => void;
  hasHyperlink: (row: number, col: number) => boolean;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onInsertColLeft: () => void;
  onInsertColRight: () => void;
  onDeleteRow: () => void;
  onDeleteCol: () => void;
  onFormatPainter: () => void;
  onClearFormat: () => void;
  onSort: () => void;
  onFilter: () => void;
  hasClipboardData: () => boolean;
  onInsertComment: (row: number, col: number) => void;
  onFormatCells: () => void;
}

export class CellContextMenu {
  private menuElement: HTMLDivElement | null = null;
  private callbacks: CellContextMenuCallbacks;
  private boundCloseHandler: ((e: MouseEvent) => void) | null = null;
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  // 插件扩展菜单项存储
  private extraItems: Map<string, CellMenuItem> = new Map();
  private nextExtraId: number = 0;

  constructor(callbacks: CellContextMenuCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * 显示右键菜单
   * @param x 鼠标 X 坐标
   * @param y 鼠标 Y 坐标
   * @param row 右键点击的行索引
   * @param col 右键点击的列索引
   */
  show(x: number, y: number, row: number, col: number): void {
    // 先关闭已有菜单
    this.hide();

    // 构建菜单项列表
    const menuItems = this.buildMenuItems(row, col);

    // 创建菜单容器
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'cell-context-menu';

    // 渲染菜单项
    for (const item of menuItems) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'cell-context-menu-separator';
        this.menuElement.appendChild(sep);
        continue;
      }

      const menuItem = document.createElement('div');
      menuItem.className = item.disabled
        ? 'cell-context-menu-item cell-context-menu-item-disabled'
        : 'cell-context-menu-item';
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

    // 初始定位
    this.menuElement.style.left = `${x}px`;
    this.menuElement.style.top = `${y}px`;
    document.body.appendChild(this.menuElement);

    // 视口边界约束：测量菜单尺寸后调整位置
    const menuWidth = this.menuElement.offsetWidth;
    const menuHeight = this.menuElement.offsetHeight;
    let finalX = x;
    let finalY = y;

    if (x + menuWidth > window.innerWidth) {
      finalX = window.innerWidth - menuWidth;
    }
    if (y + menuHeight > window.innerHeight) {
      finalY = window.innerHeight - menuHeight;
    }

    // 确保不会出现负值
    if (finalX < 0) finalX = 0;
    if (finalY < 0) finalY = 0;

    this.menuElement.style.left = `${finalX}px`;
    this.menuElement.style.top = `${finalY}px`;

    // 点击外部关闭菜单
    this.boundCloseHandler = (e: MouseEvent) => {
      if (this.menuElement && !this.menuElement.contains(e.target as Node)) {
        this.hide();
      }
    };

    // Escape 关闭菜单
    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    };

    // 延迟绑定，避免当前右键事件立即触发关闭
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
   * 注册额外菜单项（供插件系统扩展）
   * @param item 菜单项定义
   * @returns 菜单项 ID，用于后续移除
   */
  registerExtraItem(item: CellMenuItem): string {
    const id = `extra-${this.nextExtraId++}`;
    this.extraItems.set(id, item);
    return id;
  }

  /**
   * 移除额外菜单项
   * @param id registerExtraItem 返回的 ID
   */
  removeExtraItem(id: string): void {
    this.extraItems.delete(id);
  }

  /**
   * 构建完整菜单项列表
   * 包含：剪切/复制/粘贴/选择性粘贴/分隔线/插入超链接/分隔线/
   * 插入行上下/插入列左右/删除行列/分隔线/格式刷/清除格式/分隔线/排序/筛选
   * 以及插件扩展的额外菜单项
   */
  private buildMenuItems(row: number, col: number): CellMenuItem[] {
    const hasClipboard = this.callbacks.hasClipboardData();
    const cellHasHyperlink = this.callbacks.hasHyperlink(row, col);

    const items: CellMenuItem[] = [
      // 剪贴板操作
      { label: '剪切', action: () => this.callbacks.onCut() },
      { label: '复制', action: () => this.callbacks.onCopy() },
      { label: '粘贴', action: () => this.callbacks.onPaste(), disabled: !hasClipboard },
      { label: '选择性粘贴', action: () => this.callbacks.onPasteSpecial(), disabled: !hasClipboard },

      // 分隔线
      { label: '', action: () => {}, separator: true },

      // 超链接：根据单元格是否已有超链接动态显示不同菜单项
      ...(cellHasHyperlink
        ? [
            { label: '编辑超链接', action: () => this.callbacks.onEditHyperlink(row, col) },
            { label: '移除超链接', action: () => this.callbacks.onRemoveHyperlink(row, col) },
          ]
        : [
            { label: '插入超链接', action: () => this.callbacks.onInsertHyperlink(row, col) },
          ]),

      // 分隔线
      { label: '', action: () => {}, separator: true },

      // 插入行列
      { label: '插入行（上方）', action: () => this.callbacks.onInsertRowAbove() },
      { label: '插入行（下方）', action: () => this.callbacks.onInsertRowBelow() },
      { label: '插入列（左侧）', action: () => this.callbacks.onInsertColLeft() },
      { label: '插入列（右侧）', action: () => this.callbacks.onInsertColRight() },
      { label: '删除行', action: () => this.callbacks.onDeleteRow() },
      { label: '删除列', action: () => this.callbacks.onDeleteCol() },

      // 分隔线
      { label: '', action: () => {}, separator: true },

      // 格式操作
      { label: '格式刷', action: () => this.callbacks.onFormatPainter() },
      { label: '清除格式', action: () => this.callbacks.onClearFormat() },
      { label: '设置单元格格式', action: () => this.callbacks.onFormatCells() },

      // 分隔线
      { label: '', action: () => {}, separator: true },

      // 批注
      { label: '插入批注', action: () => this.callbacks.onInsertComment(row, col) },

      // 分隔线
      { label: '', action: () => {}, separator: true },

      // 排序筛选
      { label: '排序', action: () => this.callbacks.onSort() },
      { label: '筛选', action: () => this.callbacks.onFilter() },
    ];

    // 追加插件扩展的额外菜单项（在最后一个分隔线之后）
    if (this.extraItems.size > 0) {
      // 添加分隔线
      items.push({ label: '', action: () => {}, separator: true });

      for (const [, extraItem] of this.extraItems) {
        items.push(extraItem);
      }
    }

    return items;
  }

  /** 适配主题切换（预留） */
  applyTheme(_themeColors: Record<string, string>): void {
    // 菜单使用 CSS 变量，主题切换时自动适配
  }

  /** 销毁组件 */
  destroy(): void {
    this.hide();
    this.extraItems.clear();
  }
}
