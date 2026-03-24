import { SpreadsheetModel } from './model';

// 下拉列表项高度（像素）
const ITEM_HEIGHT = 28;
// 最大可见项数（超过则显示滚动条）
const MAX_VISIBLE_ITEMS = 8;

/**
 * 下拉选择器
 * 在单元格下方显示 DOM 下拉列表，支持键盘导航和鼠标选择
 */
export class DropdownSelector {
  private model: SpreadsheetModel;
  private container: HTMLDivElement | null = null;
  private highlightIndex: number = 0;
  private options: string[] = [];
  private currentRow: number = -1;
  private currentCol: number = -1;
  private selectCallback: ((value: string) => void) | null = null;

  // 绑定的事件处理器引用（用于移除监听）
  private boundOnDocumentMouseDown: (e: MouseEvent) => void;

  constructor(model: SpreadsheetModel) {
    this.model = model;
    this.boundOnDocumentMouseDown = this.onDocumentMouseDown.bind(this);
  }

  /**
   * 显示下拉列表
   * @param row 单元格行索引
   * @param col 单元格列索引
   * @param options 选项列表
   * @param anchorRect 单元格的 DOMRect，用于定位下拉列表
   */
  public show(row: number, col: number, options: string[], anchorRect: DOMRect): void {
    // 选项为空时不显示
    if (options.length === 0) {
      return;
    }

    // 如果已有下拉列表，先关闭
    this.hide();

    this.currentRow = row;
    this.currentCol = col;
    this.options = options;
    this.highlightIndex = 0;

    // 创建下拉容器
    this.container = document.createElement('div');
    this.container.className = 'dropdown-selector';
    this.container.style.position = 'absolute';
    this.container.style.left = `${anchorRect.left}px`;
    this.container.style.top = `${anchorRect.bottom}px`;
    this.container.style.minWidth = `${anchorRect.width}px`;
    this.container.style.zIndex = '10000';

    // 计算最大可见高度（超过 8 项显示滚动条）
    const maxHeight = MAX_VISIBLE_ITEMS * ITEM_HEIGHT;
    this.container.style.maxHeight = `${maxHeight}px`;
    this.container.style.overflowY = options.length > MAX_VISIBLE_ITEMS ? 'auto' : 'hidden';

    // 创建选项列表项
    options.forEach((option, index) => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      if (index === this.highlightIndex) {
        item.classList.add('dropdown-item-active');
      }
      item.style.height = `${ITEM_HEIGHT}px`;
      item.style.lineHeight = `${ITEM_HEIGHT}px`;
      item.textContent = option;

      // 鼠标悬停时更新高亮
      item.addEventListener('mouseenter', () => {
        this.setHighlight(index);
      });

      // 点击选项确认选择
      item.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        this.confirmSelection();
      });

      this.container!.appendChild(item);
    });

    document.body.appendChild(this.container);

    // 监听文档 mousedown 事件，点击外部区域关闭
    document.addEventListener('mousedown', this.boundOnDocumentMouseDown, true);
  }

  /**
   * 隐藏下拉列表
   */
  public hide(): void {
    if (this.container) {
      // 移除文档级事件监听
      document.removeEventListener('mousedown', this.boundOnDocumentMouseDown, true);

      // 从 DOM 中移除容器
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
    }

    this.options = [];
    this.highlightIndex = 0;
    this.currentRow = -1;
    this.currentCol = -1;
  }

  /**
   * 是否正在显示下拉列表
   */
  public isVisible(): boolean {
    return this.container !== null;
  }

  /**
   * 处理键盘事件
   * @returns true 表示事件已处理（调用方应阻止默认行为）
   */
  public handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.isVisible()) {
      return false;
    }

    switch (event.key) {
      case 'ArrowDown': {
        // 向下移动高亮，不超过最后一项
        const nextIndex = Math.min(this.highlightIndex + 1, this.options.length - 1);
        this.setHighlight(nextIndex);
        this.scrollToHighlight();
        return true;
      }

      case 'ArrowUp': {
        // 向上移动高亮，不低于第一项
        const prevIndex = Math.max(this.highlightIndex - 1, 0);
        this.setHighlight(prevIndex);
        this.scrollToHighlight();
        return true;
      }

      case 'Enter': {
        // 确认当前高亮选项
        this.confirmSelection();
        return true;
      }

      case 'Escape': {
        // 取消选择，关闭列表
        this.hide();
        return true;
      }

      default:
        return false;
    }
  }

  /**
   * 设置选择回调
   * 当用户选择一个选项时，回调函数接收选中的值字符串
   */
  public onSelect(callback: (value: string) => void): void {
    this.selectCallback = callback;
  }

  /**
   * 更新高亮项索引并刷新 DOM 样式
   */
  private setHighlight(index: number): void {
    if (!this.container) return;

    const items = this.container.querySelectorAll('.dropdown-item');

    // 移除旧高亮
    if (items[this.highlightIndex]) {
      items[this.highlightIndex].classList.remove('dropdown-item-active');
    }

    this.highlightIndex = index;

    // 添加新高亮
    if (items[this.highlightIndex]) {
      items[this.highlightIndex].classList.add('dropdown-item-active');
    }
  }

  /**
   * 确保高亮项在可视区域内（滚动到可见位置）
   */
  private scrollToHighlight(): void {
    if (!this.container) return;

    const items = this.container.querySelectorAll('.dropdown-item');
    const activeItem = items[this.highlightIndex] as HTMLElement | undefined;
    if (activeItem) {
      // 使用 scrollIntoView 确保高亮项可见
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * 获取当前下拉列表关联的行索引
   */
  public getCurrentRow(): number {
    return this.currentRow;
  }

  /**
   * 获取当前下拉列表关联的列索引
   */
  public getCurrentCol(): number {
    return this.currentCol;
  }

  /**
   * 获取关联的数据模型
   */
  public getModel(): SpreadsheetModel {
    return this.model;
  }

  /**
   * 确认选择当前高亮项
   */
  private confirmSelection(): void {
    if (this.highlightIndex >= 0 && this.highlightIndex < this.options.length) {
      const selectedValue = this.options[this.highlightIndex];

      // 触发选择回调
      if (this.selectCallback) {
        this.selectCallback(selectedValue);
      }
    }

    this.hide();
  }

  /**
   * 文档 mousedown 事件处理：点击下拉列表外部区域时关闭
   */
  private onDocumentMouseDown(e: MouseEvent): void {
    if (!this.container) return;

    const target = e.target as Node;
    // 如果点击目标不在下拉容器内，关闭列表
    if (!this.container.contains(target)) {
      this.hide();
    }
  }
}
