import { SpreadsheetModel } from './model';
import { SpreadsheetRenderer } from './renderer';
import { RenderConfig, CellPosition, Selection, CellFormat, ConditionalFormatRule, ConditionalFormatCondition, ConditionalFormatStyle } from './types';
import { InlineEditor } from './inline-editor';
import { DataManager } from './data-manager';
import { SearchDialog, SearchResult } from './search-dialog';
import { CollaborationEngine } from './collaboration/collaboration-engine';
import { CollabOperation } from './collaboration/types';
import { ValidationEngine } from './validation';
import { ChartOverlay } from './chart/chart-overlay';
import { ChartEngine } from './chart/chart-engine';
import { ChartEditor } from './chart/chart-editor';
import type { SparklineType, DataRange, ThemeColors } from './chart/types';
import { CHART_COLORS_LIGHT, CHART_COLORS_DARK } from './chart/types';
import { SheetManager } from './sheet-manager';
import { SheetTabBar } from './sheet-tab-bar';
import { SheetContextMenu } from './sheet-context-menu';
import { FilterDropdown } from './sort-filter/filter-dropdown';
import type { SortDirection, ColumnFilter } from './sort-filter/types';

export class SpreadsheetApp {
  private model: SpreadsheetModel;
  private renderer: SpreadsheetRenderer;
  private canvas: HTMLCanvasElement;
  private currentSelection: Selection | null = null;
  private selectionStart: CellPosition | null = null;
  private inlineEditor: InlineEditor;
  private dataManager: DataManager;
  private searchDialog: SearchDialog;

  // 协同引擎（协同模式下设置）
  private collaborationEngine: CollaborationEngine | null = null;

  // 多工作表管理
  private sheetManager: SheetManager;
  private sheetTabBar!: SheetTabBar;
  private sheetContextMenu!: SheetContextMenu;

  // 滚动条元素
  private vScrollbar: HTMLDivElement | null = null;
  private hScrollbar: HTMLDivElement | null = null;
  private vScrollThumb: HTMLDivElement | null = null;
  private hScrollThumb: HTMLDivElement | null = null;

  // 滚动状态
  private isDraggingVScroll = false;
  private isDraggingHScroll = false;
  private scrollDragStartY = 0;
  private scrollDragStartX = 0;
  private scrollDragStartScrollY = 0;
  private scrollDragStartScrollX = 0;

  // 行操作右键菜单
  private contextMenu: HTMLDivElement | null = null;
  private contextMenuRow: number | null = null;

  // 列操作右键菜单
  private colContextMenu: HTMLDivElement | null = null;
  private contextMenuCol: number | null = null;

  // 行高/列宽调整状态
  private isResizingRow = false;
  private isResizingCol = false;
  private resizeRowIndex: number = -1;
  private resizeColIndex: number = -1;
  private resizeStartY: number = 0;
  private resizeStartX: number = 0;
  private resizeStartHeight: number = 0;
  private resizeStartWidth: number = 0;

  // 下拉列表菜单
  private dropdownMenu: HTMLDivElement | null = null;
  private dropdownRow: number = -1;
  private dropdownCol: number = -1;

  // 验证提示 tooltip
  private validationTooltip: HTMLDivElement | null = null;
  private validationTooltipTimer: ReturnType<typeof setTimeout> | null = null;

  // 条件格式设置面板
  private conditionalFormatPanel: HTMLDivElement | null = null;

  // 图表交互模块
  private chartOverlay: ChartOverlay;
  private chartEngine: ChartEngine;
  private chartEditor: ChartEditor;

  // 排序筛选下拉菜单
  private filterDropdown: FilterDropdown;

  constructor(_containerId: string) {
    // 创建模型
    this.model = new SpreadsheetModel();

    // 注册公式错误回调
    this.model.registerFormulaErrorCallback((error: string) => {
      this.showFormulaError(error);
    });

    // 初始化多工作表管理器（默认创建 Sheet1，使用当前 model）
    this.sheetManager = new SheetManager();

    // 设置工作表切换回调（统一处理所有切换场景：标签点击、隐藏、删除等）
    this.sheetManager.setOnSwitchCallback((sheetId: string) => {
      this.handleSheetSwitch(sheetId);
      // 同步刷新标签栏
      if (this.sheetTabBar) {
        this.sheetTabBar.render();
      }
    });

    // 获取Canvas元素
    this.canvas = document.getElementById('excel-canvas') as HTMLCanvasElement;

    // 创建内联编辑器
    this.inlineEditor = new InlineEditor();

    // 创建数据管理器
    this.dataManager = new DataManager(this.model);
    this.dataManager.setSheetManager(this.sheetManager);

    // 创建搜索对话框
    this.searchDialog = new SearchDialog();
    this.searchDialog.setSearchHandler(this.handleSearch.bind(this));
    this.searchDialog.setNavigateHandler(this.handleSearchNavigate.bind(this));
    this.searchDialog.setNoResultsHandler(this.handleSearchNoResults.bind(this));

    // 渲染配置
    const config: RenderConfig = {
      cellPadding: 6,
      headerHeight: 28,
      headerWidth: 40,
      fontSize: 13,
      fontFamily: 'Inter, system-ui, sans-serif',
      gridColor: '#e0e0e0',
      headerColor: '#f5f5f5',
      textColor: '#333333',
      selectionColor: 'rgba(0, 0, 0, 0.05)',
      selectionBorderColor: '#808080'
    };

    // 创建渲染器
    this.renderer = new SpreadsheetRenderer(this.canvas, this.model, config);

    // 初始化图表模块
    const ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.chartEngine = new ChartEngine(ctx);
    this.chartOverlay = new ChartOverlay(this.model.chartModel, this.chartEngine);
    this.chartEditor = new ChartEditor(this.model.chartModel, () => {
      this.renderer.render();
    });
    // 将图表浮动层设置到渲染器
    this.renderer.setChartOverlay(this.chartOverlay);

    // 初始化排序筛选模块
    this.renderer.setSortFilterModel(this.model.sortFilterModel);
    this.filterDropdown = new FilterDropdown(this.model.sortFilterModel, {
      onApply: (colIndex: number, filter: ColumnFilter) => {
        this.handleFilterApply(colIndex, filter);
      },
      onSort: (colIndex: number, direction: SortDirection) => {
        this.handleSort(colIndex, direction);
      },
      onClear: (colIndex: number) => {
        this.handleFilterClear(colIndex);
      },
    });

    // 初始化 Sheet 标签栏
    const tabBarEl = document.getElementById('sheet-tab-bar') as HTMLDivElement;
    this.sheetTabBar = new SheetTabBar(tabBarEl, this.sheetManager, {
      onContextMenu: (e: MouseEvent, sheetId: string) => {
        this.sheetContextMenu.show(e.clientX, e.clientY, sheetId);
      },
    });

    // 初始化 Sheet 右键菜单
    this.sheetContextMenu = new SheetContextMenu(this.sheetManager, this.sheetTabBar);

    // 创建滚动条
    this.createScrollbars();

    // 创建右键菜单（行操作）
    this.createContextMenu();
    // 创建列操作右键菜单
    this.createColContextMenu();

    // 创建下拉列表菜单
    this.createDropdownMenu();

    // 创建验证提示 tooltip
    this.createValidationTooltip();

    // 创建条件格式设置面板
    this.createConditionalFormatPanel();

    // 设置滚动回调
    this.renderer.setScrollChangeCallback(this.handleScrollChange.bind(this));

    // 初始化事件监听
    this.initEventListeners();

    // 初始化状态显示
    this.updateStatusBar();

    // 初始渲染
    this.renderer.render();

    // 更新滚动条
    this.updateScrollbars();
  }

  // 创建滚动条
  private createScrollbars(): void {
    const container = this.canvas.parentElement as HTMLElement;
    if (!container) return;

    // 创建垂直滚动条
    this.vScrollbar = document.createElement('div');
    this.vScrollbar.className = 'scrollbar scrollbar-vertical';
    this.vScrollThumb = document.createElement('div');
    this.vScrollThumb.className = 'scrollbar-thumb';
    this.vScrollbar.appendChild(this.vScrollThumb);
    container.appendChild(this.vScrollbar);

    // 创建水平滚动条
    this.hScrollbar = document.createElement('div');
    this.hScrollbar.className = 'scrollbar scrollbar-horizontal';
    this.hScrollThumb = document.createElement('div');
    this.hScrollThumb.className = 'scrollbar-thumb';
    this.hScrollbar.appendChild(this.hScrollThumb);
    container.appendChild(this.hScrollbar);

    // 绑定滚动条事件
    this.bindScrollbarEvents();
  }

  // 创建右键菜单
  private createContextMenu(): void {
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'context-menu';
    this.contextMenu.style.display = 'none';

    // 添加行选项（带输入框）
    const insertItem = document.createElement('div');
    insertItem.className = 'context-menu-item context-menu-input-item';

    const insertLabel = document.createElement('span');
    insertLabel.textContent = '添加';

    const insertInput = document.createElement('input');
    insertInput.type = 'number';
    insertInput.min = '1';
    insertInput.value = '1';
    insertInput.className = 'context-menu-input';
    insertInput.addEventListener('click', (e) => e.stopPropagation());
    insertInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.insertRows(parseInt(insertInput.value, 10) || 1);
      }
    });

    const insertSuffix = document.createElement('span');
    insertSuffix.textContent = '行';

    const insertBtn = document.createElement('button');
    insertBtn.className = 'context-menu-btn';
    insertBtn.textContent = '确定';
    insertBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.insertRows(parseInt(insertInput.value, 10) || 1);
    });

    insertItem.appendChild(insertLabel);
    insertItem.appendChild(insertInput);
    insertItem.appendChild(insertSuffix);
    insertItem.appendChild(insertBtn);

    // 删除行选项
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item';
    deleteItem.innerHTML = '<span class="context-menu-icon">🗑️</span>删除当前行';
    deleteItem.addEventListener('click', () => this.deleteCurrentRow());

    this.contextMenu.appendChild(insertItem);
    this.contextMenu.appendChild(deleteItem);
    document.body.appendChild(this.contextMenu);

    // 点击其他地方关闭菜单
    document.addEventListener('click', (e) => {
      if (this.contextMenu && !this.contextMenu.contains(e.target as Node)) {
        this.hideContextMenu();
      }
    });
  }

  // 创建列操作右键菜单
  private createColContextMenu(): void {
    this.colContextMenu = document.createElement('div');
    this.colContextMenu.className = 'context-menu col-context-menu';
    this.colContextMenu.style.display = 'none';

    // 插入列选项（带输入框）
    const insertItem = document.createElement('div');
    insertItem.className = 'context-menu-item context-menu-input-item';

    const insertLabel = document.createElement('span');
    insertLabel.textContent = '添加';

    const insertInput = document.createElement('input');
    insertInput.type = 'number';
    insertInput.min = '1';
    insertInput.value = '1';
    insertInput.className = 'context-menu-input';
    insertInput.addEventListener('click', (e) => e.stopPropagation());
    insertInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.insertColumns(parseInt(insertInput.value, 10) || 1);
      }
    });

    const insertSuffix = document.createElement('span');
    insertSuffix.textContent = '列';

    const insertBtn = document.createElement('button');
    insertBtn.className = 'context-menu-btn';
    insertBtn.textContent = '确定';
    insertBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.insertColumns(parseInt(insertInput.value, 10) || 1);
    });

    insertItem.appendChild(insertLabel);
    insertItem.appendChild(insertInput);
    insertItem.appendChild(insertSuffix);
    insertItem.appendChild(insertBtn);

    // 删除列选项
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item';
    deleteItem.innerHTML = '<span class="context-menu-icon">🗑️</span>删除当前列';
    deleteItem.addEventListener('click', () => this.deleteCurrentCol());

    this.colContextMenu.appendChild(insertItem);
    this.colContextMenu.appendChild(deleteItem);

    // 分隔线
    const divider = document.createElement('div');
    divider.className = 'context-menu-divider';
    this.colContextMenu.appendChild(divider);

    // 排序与筛选选项
    const sortAscItem = document.createElement('div');
    sortAscItem.className = 'context-menu-item';
    sortAscItem.innerHTML = '<span class="context-menu-icon">↑</span>升序排序';
    sortAscItem.addEventListener('click', () => {
      if (this.contextMenuCol !== null) {
        this.handleSort(this.contextMenuCol, 'asc');
      }
      this.hideColContextMenu();
    });

    const sortDescItem = document.createElement('div');
    sortDescItem.className = 'context-menu-item';
    sortDescItem.innerHTML = '<span class="context-menu-icon">↓</span>降序排序';
    sortDescItem.addEventListener('click', () => {
      if (this.contextMenuCol !== null) {
        this.handleSort(this.contextMenuCol, 'desc');
      }
      this.hideColContextMenu();
    });

    const filterItem = document.createElement('div');
    filterItem.className = 'context-menu-item';
    filterItem.innerHTML = '<span class="context-menu-icon">🔽</span>筛选...';
    filterItem.addEventListener('click', () => {
      if (this.contextMenuCol !== null) {
        const col = this.contextMenuCol;
        const canvasRect = this.canvas.getBoundingClientRect();
        const cellRect = this.renderer.getCellRect(0, col);
        const { headerHeight } = this.renderer.getConfig();
        const anchorX = canvasRect.left + (cellRect?.x ?? 0);
        const anchorY = canvasRect.top + headerHeight;
        this.filterDropdown.show(anchorX, anchorY, col);
      }
      this.hideColContextMenu();
    });

    const clearSortFilterItem = document.createElement('div');
    clearSortFilterItem.className = 'context-menu-item';
    clearSortFilterItem.innerHTML = '<span class="context-menu-icon">✕</span>清除排序与筛选';
    clearSortFilterItem.addEventListener('click', () => {
      const sfModel = this.model.sortFilterModel;
      const oldSnapshot = sfModel.getSnapshot();
      sfModel.clearSort();
      sfModel.clearAllFilters();
      const newSnapshot = sfModel.getSnapshot();
      this.model.getHistoryManager().record({
        type: 'setFilter',
        data: newSnapshot,
        undoData: oldSnapshot,
      });
      this.renderer.render();
      this.updateUndoRedoButtons();
      this.hideColContextMenu();
    });

    this.colContextMenu.appendChild(sortAscItem);
    this.colContextMenu.appendChild(sortDescItem);
    this.colContextMenu.appendChild(filterItem);
    this.colContextMenu.appendChild(clearSortFilterItem);

    document.body.appendChild(this.colContextMenu);

    // 点击其他地方关闭列菜单
    document.addEventListener('click', (e) => {
      if (this.colContextMenu && !this.colContextMenu.contains(e.target as Node)) {
        this.hideColContextMenu();
      }
    });
  }

  // 插入列
  private insertColumns(count: number): void {
    const colToInsert = this.contextMenuCol;
    this.hideColContextMenu();

    if (colToInsert !== null && count > 0) {
      // 在当前列位置插入，当前列及右侧全部右移
      const success = this.model.insertColumns(colToInsert, count);
      if (success) {
        // 协同模式下提交操作
        if (this.isCollaborationMode()) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'colInsert',
            colIndex: colToInsert,
            count,
          });
        }
        this.renderer.render();
        this.updateScrollbars();
        this.updateStatusBar();
      }
    }
  }

  // 删除当前列
  private deleteCurrentCol(): void {
    const colToDelete = this.contextMenuCol;
    this.hideColContextMenu();

    if (colToDelete !== null) {
      const success = this.model.deleteColumns(colToDelete, 1);
      if (success) {
        // 协同模式下提交操作
        if (this.isCollaborationMode()) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'colDelete',
            colIndex: colToDelete,
            count: 1,
          });
        }
        this.currentSelection = null;
        this.renderer.clearSelection();
        this.renderer.clearHighlight();
        this.renderer.render();
        this.updateScrollbars();
        this.updateStatusBar();
      }
    }
  }

  // 显示列操作右键菜单
  private showColContextMenu(x: number, y: number, col: number): void {
    if (!this.colContextMenu) return;
    this.contextMenuCol = col;
    this.colContextMenu.style.left = `${x}px`;
    this.colContextMenu.style.top = `${y}px`;
    this.colContextMenu.style.display = 'block';
  }

  // 隐藏列操作右键菜单
  private hideColContextMenu(): void {
    if (this.colContextMenu) {
      this.colContextMenu.style.display = 'none';
    }
    this.contextMenuCol = null;
  }

  // 创建下拉列表菜单 DOM 元素
  private createDropdownMenu(): void {
    this.dropdownMenu = document.createElement('div');
    this.dropdownMenu.className = 'dropdown-validation-menu';
    this.dropdownMenu.style.display = 'none';
    document.body.appendChild(this.dropdownMenu);

    // 点击外部关闭下拉菜单
    document.addEventListener('mousedown', (e) => {
      if (this.dropdownMenu && !this.dropdownMenu.contains(e.target as Node)) {
        this.hideDropdownMenu();
      }
    });
  }

  // 显示下拉列表验证菜单
  private showDropdownMenu(row: number, col: number): void {
    if (!this.dropdownMenu) return;

    // 如果已经在显示同一单元格的下拉菜单，则关闭
    if (this.dropdownRow === row && this.dropdownCol === col && this.dropdownMenu.style.display !== 'none') {
      this.hideDropdownMenu();
      return;
    }

    // 获取单元格信息
    const cellInfo = this.model.getMergedCellInfo(row, col);
    if (!cellInfo || !cellInfo.validation || cellInfo.validation.type !== 'dropdown') return;

    // 获取下拉选项
    const options = ValidationEngine.getDropdownOptions(cellInfo.validation);
    if (options.length === 0) return;

    // 清空菜单内容
    this.dropdownMenu.innerHTML = '';

    // 当前单元格内容，用于高亮已选项
    const currentContent = cellInfo.content || '';

    // 创建选项列表
    for (const option of options) {
      const item = document.createElement('div');
      item.className = 'dropdown-validation-item';
      if (option === currentContent) {
        item.classList.add('dropdown-validation-item-selected');
      }
      item.textContent = option;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 获取旧内容
        const previousContent = this.model.getCell(row, col)?.content ?? '';

        // 写入单元格
        this.model.setCellContent(row, col, option);

        // 协同模式下提交操作
        if (this.isCollaborationMode() && option !== previousContent) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'cellEdit',
            row,
            col,
            content: option,
            previousContent,
          });
        }

        // 关闭菜单
        this.hideDropdownMenu();

        // 更新状态栏和重新渲染
        this.updateSelectedCellInfo();
        this.renderer.render();
      });
      this.dropdownMenu.appendChild(item);
    }

    // 计算菜单位置（基于单元格在画布上的位置）
    const cellRect = this.renderer.getCellRect(cellInfo.row, cellInfo.col);
    if (!cellRect) return;

    const canvasRect = this.canvas.getBoundingClientRect();
    const menuLeft = canvasRect.left + cellRect.x;
    const menuTop = canvasRect.top + cellRect.y + cellRect.height;

    this.dropdownMenu.style.left = `${menuLeft}px`;
    this.dropdownMenu.style.top = `${menuTop}px`;
    this.dropdownMenu.style.minWidth = `${cellRect.width}px`;
    this.dropdownMenu.style.display = 'block';

    // 记录当前下拉菜单对应的单元格
    this.dropdownRow = row;
    this.dropdownCol = col;
  }

  // 隐藏下拉列表验证菜单
  private hideDropdownMenu(): void {
    if (this.dropdownMenu) {
      this.dropdownMenu.style.display = 'none';
      this.dropdownMenu.innerHTML = '';
    }
    this.dropdownRow = -1;
    this.dropdownCol = -1;
  }

  // 创建验证提示 tooltip 元素
  private createValidationTooltip(): void {
    this.validationTooltip = document.createElement('div');
    this.validationTooltip.className = 'validation-tooltip';
    this.validationTooltip.style.display = 'none';
    document.body.appendChild(this.validationTooltip);
  }

  // 显示验证提示 tooltip
  private showValidationTooltip(
    row: number,
    col: number,
    type: 'info' | 'error',
    title: string,
    message: string
  ): void {
    if (!this.validationTooltip) return;

    // 清除之前的自动隐藏定时器
    this.clearTooltipTimer();

    // 获取单元格位置
    const cellRect = this.renderer.getCellRect(row, col);
    if (!cellRect) return;

    // 设置 tooltip 内容
    this.validationTooltip.innerHTML = '';
    this.validationTooltip.className = `validation-tooltip validation-tooltip-${type}`;

    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'validation-tooltip-title';
      titleEl.textContent = title;
      this.validationTooltip.appendChild(titleEl);
    }

    if (message) {
      const msgEl = document.createElement('div');
      msgEl.className = 'validation-tooltip-message';
      msgEl.textContent = message;
      this.validationTooltip.appendChild(msgEl);
    }

    // 计算位置（单元格下方）
    const canvasRect = this.canvas.getBoundingClientRect();
    const tooltipLeft = canvasRect.left + cellRect.x;
    const tooltipTop = canvasRect.top + cellRect.y + cellRect.height + 4;

    this.validationTooltip.style.left = `${tooltipLeft}px`;
    this.validationTooltip.style.top = `${tooltipTop}px`;
    this.validationTooltip.style.display = 'block';

    // 错误提示 4 秒后自动隐藏，输入提示在选中期间持续显示
    if (type === 'error') {
      this.validationTooltipTimer = setTimeout(() => {
        this.hideValidationTooltip();
      }, 4000);
    }
  }

  // 隐藏验证提示 tooltip
  private hideValidationTooltip(): void {
    if (this.validationTooltip) {
      this.validationTooltip.style.display = 'none';
    }
    this.clearTooltipTimer();
  }

  // 清除 tooltip 自动隐藏定时器
  private clearTooltipTimer(): void {
    if (this.validationTooltipTimer !== null) {
      clearTimeout(this.validationTooltipTimer);
      this.validationTooltipTimer = null;
    }
  }

  // 检查并显示单元格的输入提示
  private showInputHintIfNeeded(row: number, col: number): void {
    const cellInfo = this.model.getMergedCellInfo(row, col);
    if (!cellInfo || !cellInfo.validation) {
      this.hideValidationTooltip();
      return;
    }

    const { validation } = cellInfo;
    const { inputTitle, inputMessage } = validation;

    // 有输入提示时显示浅蓝色 tooltip
    if (inputTitle || inputMessage) {
      this.showValidationTooltip(
        cellInfo.row,
        cellInfo.col,
        'info',
        inputTitle || '',
        inputMessage || ''
      );
    } else {
      this.hideValidationTooltip();
    }
  }

  // 显示验证错误提示
  private showValidationError(row: number, col: number, errorTitle?: string, errorMessage?: string): void {
    const title = errorTitle || '输入无效';
    const message = errorMessage || '输入的值不符合此单元格的验证规则。';
    this.showValidationTooltip(row, col, 'error', title, message);
  }


  // 插入行
  private insertRows(count: number): void {
    const rowToInsert = this.contextMenuRow;
    this.hideContextMenu();

    if (rowToInsert !== null && count > 0) {
      const success = this.model.insertRows(rowToInsert + 1, count);
      if (success) {
        // 协同模式下提交操作
        if (this.isCollaborationMode()) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'rowInsert',
            rowIndex: rowToInsert + 1,
            count,
          });
        }
        this.renderer.render();
        this.updateScrollbars();
        this.updateStatusBar();
      }
    }
  }

  // 显示右键菜单
  private showContextMenu(x: number, y: number, row: number): void {
    if (!this.contextMenu) return;

    this.contextMenuRow = row;
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.style.display = 'block';
  }

  // 隐藏右键菜单
  private hideContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }
    this.contextMenuRow = null;
  }

  // 删除当前选中的行
  private deleteCurrentRow(): void {
    const rowToDelete = this.contextMenuRow;
    this.hideContextMenu();

    if (rowToDelete !== null) {
      const success = this.model.deleteRows(rowToDelete, 1);
      if (success) {
        // 协同模式下提交操作
        if (this.isCollaborationMode()) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'rowDelete',
            rowIndex: rowToDelete,
            count: 1,
          });
        }
        this.currentSelection = null;
        this.renderer.clearSelection();
        this.renderer.clearHighlight();
        this.renderer.render();
        this.updateScrollbars();
        this.updateStatusBar();
      }
    }
  }

  // 绑定滚动条事件
  private bindScrollbarEvents(): void {
    // 垂直滚动条拖拽
    if (this.vScrollThumb) {
      this.vScrollThumb.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.isDraggingVScroll = true;
        this.scrollDragStartY = e.clientY;
        this.scrollDragStartScrollY = this.renderer.getViewport().scrollY;
        document.body.style.cursor = 'grabbing';
      });
    }

    // 水平滚动条拖拽
    if (this.hScrollThumb) {
      this.hScrollThumb.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.isDraggingHScroll = true;
        this.scrollDragStartX = e.clientX;
        this.scrollDragStartScrollX = this.renderer.getViewport().scrollX;
        document.body.style.cursor = 'grabbing';
      });
    }

    // 全局鼠标移动和释放
    document.addEventListener('mousemove', (e) => {
      if (this.isDraggingVScroll && this.vScrollbar) {
        const trackHeight = this.vScrollbar.clientHeight - 4;
        const { maxScrollY } = this.renderer.getMaxScroll();
        const thumbHeight = this.vScrollThumb?.clientHeight || 30;
        const availableTrack = trackHeight - thumbHeight;

        const deltaY = e.clientY - this.scrollDragStartY;
        const scrollDelta = (deltaY / availableTrack) * maxScrollY;

        this.renderer.scrollTo(
          this.renderer.getViewport().scrollX,
          this.scrollDragStartScrollY + scrollDelta
        );
      }

      if (this.isDraggingHScroll && this.hScrollbar) {
        const trackWidth = this.hScrollbar.clientWidth - 4;
        const { maxScrollX } = this.renderer.getMaxScroll();
        const thumbWidth = this.hScrollThumb?.clientWidth || 30;
        const availableTrack = trackWidth - thumbWidth;

        const deltaX = e.clientX - this.scrollDragStartX;
        const scrollDelta = (deltaX / availableTrack) * maxScrollX;

        this.renderer.scrollTo(
          this.scrollDragStartScrollX + scrollDelta,
          this.renderer.getViewport().scrollY
        );
      }
    });

    document.addEventListener('mouseup', () => {
      this.isDraggingVScroll = false;
      this.isDraggingHScroll = false;
      document.body.style.cursor = '';
    });

    // 点击滚动条轨道
    if (this.vScrollbar) {
      this.vScrollbar.addEventListener('click', (e) => {
        if (e.target === this.vScrollbar) {
          const rect = this.vScrollbar!.getBoundingClientRect();
          const clickY = e.clientY - rect.top;
          const trackHeight = this.vScrollbar!.clientHeight;
          const { maxScrollY } = this.renderer.getMaxScroll();

          const newScrollY = (clickY / trackHeight) * maxScrollY;
          this.renderer.scrollTo(this.renderer.getViewport().scrollX, newScrollY);
        }
      });
    }

    if (this.hScrollbar) {
      this.hScrollbar.addEventListener('click', (e) => {
        if (e.target === this.hScrollbar) {
          const rect = this.hScrollbar!.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const trackWidth = this.hScrollbar!.clientWidth;
          const { maxScrollX } = this.renderer.getMaxScroll();

          const newScrollX = (clickX / trackWidth) * maxScrollX;
          this.renderer.scrollTo(newScrollX, this.renderer.getViewport().scrollY);
        }
      });
    }
  }

  // 更新滚动条
  private updateScrollbars(): void {
    const viewport = this.renderer.getViewport();
    const { maxScrollX, maxScrollY } = this.renderer.getMaxScroll();
    const config = this.renderer.getConfig();

    const viewWidth = this.canvas.width - config.headerWidth;
    const viewHeight = this.canvas.height - config.headerHeight;
    const totalWidth = this.model.getTotalWidth();
    const totalHeight = this.model.getTotalHeight();

    // 更新垂直滚动条
    if (this.vScrollbar && this.vScrollThumb) {
      if (maxScrollY > 0) {
        this.vScrollbar.style.display = 'block';

        const trackHeight = this.vScrollbar.clientHeight - 4;
        const thumbHeight = Math.max(30, (viewHeight / totalHeight) * trackHeight);
        const thumbTop = maxScrollY > 0 ? (viewport.scrollY / maxScrollY) * (trackHeight - thumbHeight) : 0;

        this.vScrollThumb.style.height = `${thumbHeight}px`;
        this.vScrollThumb.style.top = `${thumbTop + 2}px`;
      } else {
        this.vScrollbar.style.display = 'none';
      }
    }

    // 更新水平滚动条
    if (this.hScrollbar && this.hScrollThumb) {
      if (maxScrollX > 0) {
        this.hScrollbar.style.display = 'block';

        const trackWidth = this.hScrollbar.clientWidth - 4;
        const thumbWidth = Math.max(30, (viewWidth / totalWidth) * trackWidth);
        const thumbLeft = maxScrollX > 0 ? (viewport.scrollX / maxScrollX) * (trackWidth - thumbWidth) : 0;

        this.hScrollThumb.style.width = `${thumbWidth}px`;
        this.hScrollThumb.style.left = `${thumbLeft + 2}px`;
      } else {
        this.hScrollbar.style.display = 'none';
      }
    }
  }

  // 处理滚动变化
  private handleScrollChange(_scrollX: number, _scrollY: number, _maxScrollX: number, _maxScrollY: number): void {
    this.updateScrollbars();
    this.updateViewportInfo();
  }

  // 初始化事件监听
  private initEventListeners(): void {
    // 窗口大小改变事件
    window.addEventListener('resize', this.handleResize.bind(this));

    // 鼠标事件
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
    this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));

    // 滚轮事件
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

    // 按钮事件
    const mergeButton = document.getElementById('merge-cells');
    if (mergeButton) {
      mergeButton.addEventListener('click', this.handleMergeCells.bind(this));
    }

    const splitButton = document.getElementById('split-cells');
    if (splitButton) {
      splitButton.addEventListener('click', this.handleSplitCells.bind(this));
    }

    // 撤销/重做按钮事件
    const undoButton = document.getElementById('undo-btn');
    if (undoButton) {
      undoButton.addEventListener('click', this.handleUndo.bind(this));
    }

    const redoButton = document.getElementById('redo-btn');
    if (redoButton) {
      redoButton.addEventListener('click', this.handleRedo.bind(this));
    }

    // 字体颜色选择器事件
    const fontColorInput = document.getElementById('font-color') as HTMLInputElement;
    if (fontColorInput) {
      fontColorInput.addEventListener('input', this.handleFontColorChange.bind(this));
    }

    // 背景颜色选择器事件
    const bgColorInput = document.getElementById('bg-color') as HTMLInputElement;
    if (bgColorInput) {
      bgColorInput.addEventListener('input', this.handleBgColorChange.bind(this));
    }

    // 初始化字体大小选择器
    this.initFontSizePicker();

    // 初始化数字格式下拉菜单
    this.initNumberFormatPicker();

    // 初始化垂直对齐选择器
    this.initVerticalAlignPicker();

    // 初始化水平对齐选择器
    this.initHorizontalAlignPicker();

    // 字体加粗按钮事件
    const fontBoldBtn = document.getElementById('font-bold-btn');
    if (fontBoldBtn) {
      fontBoldBtn.addEventListener('click', this.handleFontBoldChange.bind(this));
    }

    // 字体斜体按钮事件
    const fontItalicBtn = document.getElementById('font-italic-btn');
    if (fontItalicBtn) {
      fontItalicBtn.addEventListener('click', this.handleFontItalicChange.bind(this));
    }

    // 字体下划线按钮事件
    const fontUnderlineBtn = document.getElementById('font-underline-btn');
    if (fontUnderlineBtn) {
      fontUnderlineBtn.addEventListener('click', this.handleFontUnderlineChange.bind(this));
    }

    // 字体对齐按钮事件
    const fontAlignLeftBtn = document.getElementById('font-align-left-btn');
    if (fontAlignLeftBtn) {
      fontAlignLeftBtn.addEventListener('click', () => this.handleFontAlignChange('left'));
    }

    const fontAlignCenterBtn = document.getElementById('font-align-center-btn');
    if (fontAlignCenterBtn) {
      fontAlignCenterBtn.addEventListener('click', () => this.handleFontAlignChange('center'));
    }

    const fontAlignRightBtn = document.getElementById('font-align-right-btn');
    if (fontAlignRightBtn) {
      fontAlignRightBtn.addEventListener('click', () => this.handleFontAlignChange('right'));
    }

    // 自动换行按钮事件
    const wrapTextBtn = document.getElementById('wrap-text-btn');
    if (wrapTextBtn) {
      wrapTextBtn.addEventListener('click', this.handleWrapTextChange.bind(this));
    }

    // 条件格式按钮事件
    const conditionalFormatBtn = document.getElementById('conditional-format-btn');
    if (conditionalFormatBtn) {
      conditionalFormatBtn.addEventListener('click', () => this.showConditionalFormatPanel());
    }

    const setContentButton = document.getElementById('set-content');
    if (setContentButton) {
      setContentButton.addEventListener('click', this.handleSetContent.bind(this));
    }

    // 单元格内容输入框事件
    const cellContentInput = document.getElementById('cell-content') as HTMLInputElement;
    if (cellContentInput) {
      // 按下回车键时设置内容
      cellContentInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          this.handleSetContent();
        }
      });

      // 失去焦点时设置内容
      cellContentInput.addEventListener('blur', () => {
        if (document.activeElement !== setContentButton) {
          this.handleSetContent();
        }
      });
    }

    // 初始化图表工具栏按钮事件
    this.initChartToolbarEvents();

    // 键盘事件
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    // 初始化大小
    this.handleResize();
  }

  // 处理键盘事件
  private handleKeyDown(event: KeyboardEvent): void {
    // 如果内联编辑器正在编辑，则忽略键盘事件
    if (this.inlineEditor.isEditing()) {
      return;
    }

    // IME 组合输入期间不处理按键
    if (event.isComposing || event.keyCode === 229) {
      return;
    }

    // 如果焦点在输入框中（除了搜索框的特殊快捷键），则忽略
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
      // 允许 Escape 关闭搜索框
      if (event.key === 'Escape' && this.searchDialog.isVisible()) {
        this.searchDialog.hide();
        return;
      }
      // 允许 Ctrl+F 打开搜索框
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        this.searchDialog.show();
        return;
      }
      return;
    }

    // 复制 Ctrl+C / Cmd+C
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      event.preventDefault();
      this.handleCopy();
      return;
    }

    // 粘贴 Ctrl+V / Cmd+V
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      event.preventDefault();
      this.handlePaste();
      return;
    }

    // 剪切 Ctrl+X / Cmd+X
    if ((event.ctrlKey || event.metaKey) && event.key === 'x') {
      event.preventDefault();
      this.handleCut();
      return;
    }

    // 撤销 Ctrl+Z / Cmd+Z
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.handleUndo();
      return;
    }

    // 重做 Ctrl+Y / Cmd+Y 或 Ctrl+Shift+Z / Cmd+Shift+Z
    if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
      event.preventDefault();
      this.handleRedo();
      return;
    }

    // 查找 Ctrl+F / Cmd+F
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      event.preventDefault();
      this.searchDialog.show();
      return;
    }

    // 方向键导航
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      this.handleArrowKey(event.key, event.shiftKey);
      return;
    }

    // Tab 键切换单元格
    if (event.key === 'Tab') {
      event.preventDefault();
      this.handleTabKey(event.shiftKey);
      return;
    }

    // Enter 键向下移动或进入编辑
    if (event.key === 'Enter') {
      event.preventDefault();
      this.handleEnterKey();
      return;
    }

    // Delete / Backspace 删除内容
    if (event.key === 'Delete' || event.key === 'Backspace') {
      // 【图表交互】如果有选中的图表，Delete 键删除图表
      if (this.chartOverlay.getSelectedChartId()) {
        event.preventDefault();
        this.chartOverlay.deleteSelectedChart();
        this.renderer.render();
        return;
      }
      event.preventDefault();
      this.handleDeleteKey();
      return;
    }

    // Escape 取消选择
    if (event.key === 'Escape') {
      // 【图表交互】如果有选中的图表，Escape 取消选中
      if (this.chartOverlay.getSelectedChartId()) {
        this.chartOverlay.deselectChart();
        this.renderer.render();
        return;
      }
      this.currentSelection = null;
      this.renderer.clearSelection();
      this.renderer.clearHighlight();
      this.renderer.render();
      // 协同模式下广播清除光标
      if (this.isCollaborationMode()) {
        this.collaborationEngine!.sendCursor(null);
      }
      return;
    }

    // F2 进入编辑模式（保留原内容）
    if (event.key === 'F2') {
      event.preventDefault();
      this.startEditing(false);
      return;
    }

    // 直接输入字符进入编辑模式（清空原内容）
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.startEditing(true, event.key);
      return;
    }
  }

  // 开始编辑当前选中的单元格
  private startEditing(clearContent: boolean, initialChar?: string): void {
    if (!this.currentSelection) {
      return;
    }

    const { startRow, startCol } = this.currentSelection;

    // 排序筛选激活时，将显示行映射到数据行
    const sfModel = this.model.sortFilterModel;
    const dataRow = sfModel.isActive() ? sfModel.getDataRowIndex(startRow) : startRow;
    if (dataRow === -1) return;

    // 获取单元格信息（使用数据行）
    const cellInfo = this.model.getMergedCellInfo(dataRow, startCol);
    if (!cellInfo) {
      return;
    }

    // 获取单元格在画布上的位置
    const cellRect = this.renderer.getCellRect(cellInfo.row, cellInfo.col);
    if (!cellRect) {
      return;
    }

    const canvasRect = this.canvas.getBoundingClientRect();

    // 确定初始内容
    const initialContent = clearContent ? (initialChar || '') : (cellInfo.content || '');

    // 显示内联编辑器
    this.inlineEditor.show(
      canvasRect.left + cellRect.x + 1,
      canvasRect.top + cellRect.y + 1,
      cellRect.width - 2,
      cellRect.height - 2,
      initialContent,
      cellInfo.row,
      cellInfo.col,
      (value) => {
        const previousContent = this.model.getCell(cellInfo.row, cellInfo.col)?.content ?? '';
        const result = this.model.setCellContent(cellInfo.row, cellInfo.col, value);

        // 验证失败时显示错误提示（需求 5.5）
        if (!result.success && result.validationResult && !result.validationResult.valid) {
          this.showValidationError(
            cellInfo.row,
            cellInfo.col,
            result.validationResult.errorTitle,
            result.validationResult.errorMessage
          );
          return;
        }
        // 警告模式下也显示错误提示
        if (result.validationResult && !result.validationResult.valid) {
          this.showValidationError(
            cellInfo.row,
            cellInfo.col,
            result.validationResult.errorTitle,
            result.validationResult.errorMessage
          );
        }

        // 编辑后重新计算排序筛选映射（编辑值可能不再满足筛选条件）
        if (sfModel.isActive()) {
          sfModel.recalculate();
        }

        // 协同模式下提交操作
        if (this.isCollaborationMode() && value !== previousContent) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'cellEdit',
            row: cellInfo.row,
            col: cellInfo.col,
            content: value,
            previousContent,
          });
        }
        this.updateSelectedCellInfo();
        this.renderer.render();
        this.updateUndoRedoButtons();
      }
    );
  }

  // 处理方向键
  private handleArrowKey(key: string, shiftKey: boolean): void {
    if (!this.currentSelection) {
      // 如果没有选择，默认选择 A1
      this.currentSelection = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
    }

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 计算移动方向
    let deltaRow = 0;
    let deltaCol = 0;

    switch (key) {
      case 'ArrowUp': deltaRow = -1; break;
      case 'ArrowDown': deltaRow = 1; break;
      case 'ArrowLeft': deltaCol = -1; break;
      case 'ArrowRight': deltaCol = 1; break;
    }

    if (shiftKey) {
      // Shift + 方向键：扩展选择区域
      const newEndRow = Math.max(0, Math.min(endRow + deltaRow, this.model.getRowCount() - 1));
      const newEndCol = Math.max(0, Math.min(endCol + deltaCol, this.model.getColCount() - 1));

      this.currentSelection = {
        startRow,
        startCol,
        endRow: newEndRow,
        endCol: newEndCol
      };

      this.renderer.setSelection(
        Math.min(startRow, newEndRow),
        Math.min(startCol, newEndCol),
        Math.max(startRow, newEndRow),
        Math.max(startCol, newEndCol)
      );
    } else {
      // 普通方向键：移动选择
      const newRow = Math.max(0, Math.min(startRow + deltaRow, this.model.getRowCount() - 1));
      const newCol = Math.max(0, Math.min(startCol + deltaCol, this.model.getColCount() - 1));

      this.currentSelection = {
        startRow: newRow,
        startCol: newCol,
        endRow: newRow,
        endCol: newCol
      };

      this.renderer.setSelection(newRow, newCol, newRow, newCol);

      // 确保选中的单元格可见
      this.renderer.scrollToCell(newRow, newCol);
    }

    // 清除行/列高亮
    this.renderer.clearHighlight();

    // 更新单元格信息显示
    this.updateSelectedCellInfo();
  }

  // 处理 Tab 键
  private handleTabKey(shiftKey: boolean): void {
    if (!this.currentSelection) {
      this.currentSelection = { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
    }

    const { startRow, startCol } = this.currentSelection;

    let newRow = startRow;
    let newCol = startCol;

    if (shiftKey) {
      // Shift+Tab：向左移动
      newCol--;
      if (newCol < 0) {
        newCol = this.model.getColCount() - 1;
        newRow--;
        if (newRow < 0) {
          newRow = 0;
          newCol = 0;
        }
      }
    } else {
      // Tab：向右移动
      newCol++;
      if (newCol >= this.model.getColCount()) {
        newCol = 0;
        newRow++;
        if (newRow >= this.model.getRowCount()) {
          newRow = this.model.getRowCount() - 1;
          newCol = this.model.getColCount() - 1;
        }
      }
    }

    this.currentSelection = {
      startRow: newRow,
      startCol: newCol,
      endRow: newRow,
      endCol: newCol
    };

    this.renderer.setSelection(newRow, newCol, newRow, newCol);
    this.renderer.scrollToCell(newRow, newCol);
    this.renderer.clearHighlight();
    this.updateSelectedCellInfo();
  }

  // 处理 Enter 键
  private handleEnterKey(): void {
    if (!this.currentSelection) {
      return;
    }

    const { startRow, startCol } = this.currentSelection;

    // 向下移动一行
    const newRow = Math.min(startRow + 1, this.model.getRowCount() - 1);

    this.currentSelection = {
      startRow: newRow,
      startCol: startCol,
      endRow: newRow,
      endCol: startCol
    };

    this.renderer.setSelection(newRow, startCol, newRow, startCol);
    this.renderer.scrollToCell(newRow, startCol);
    this.renderer.clearHighlight();
    this.updateSelectedCellInfo();
  }

  // 处理 Delete 键
  private handleDeleteKey(): void {
    if (!this.currentSelection) {
      return;
    }

    const { startRow, startCol, endRow, endCol } = this.currentSelection;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    // 批量清除选中区域的内容
    this.model.clearRangeContent(minRow, minCol, maxRow, maxCol);

    // 协同模式下提交操作
    if (this.isCollaborationMode()) {
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const previousContent = this.model.getCell(row, col)?.content ?? '';
          if (previousContent !== '') {
            this.submitCollabOperation({
              ...this.createBaseOp(),
              type: 'cellEdit',
              row,
              col,
              content: '',
              previousContent,
            });
          }
        }
      }
    }

    this.renderer.render();
    this.updateSelectedCellInfo();
    this.updateUndoRedoButtons();
  }

  // 剪贴板数据
  private clipboardData: { content: string[][]; startRow: number; startCol: number } | null = null;
  private isCut: boolean = false;

  // 处理复制
  private handleCopy(): void {
    if (!this.currentSelection) {
      return;
    }

    const { startRow, startCol, endRow, endCol } = this.currentSelection;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    // 收集选中区域的内容
    const content: string[][] = [];
    for (let row = minRow; row <= maxRow; row++) {
      const rowData: string[] = [];
      for (let col = minCol; col <= maxCol; col++) {
        const cell = this.model.getCell(row, col);
        rowData.push(cell?.content || '');
      }
      content.push(rowData);
    }

    this.clipboardData = { content, startRow: minRow, startCol: minCol };
    this.isCut = false;

    // 同时复制到系统剪贴板（纯文本格式，用 Tab 分隔）
    const textContent = content.map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(textContent).catch(() => {
      // 忽略剪贴板错误
    });
  }

  // 处理剪切
  private handleCut(): void {
    this.handleCopy();
    this.isCut = true;
  }

  // 处理粘贴
  private async handlePaste(): Promise<void> {
    if (!this.currentSelection) {
      return;
    }

    const { startRow, startCol } = this.currentSelection;

    // 优先尝试从系统剪贴板读取
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // 解析剪贴板文本（Tab 分隔列，换行分隔行）
        const rows = text.split('\n').map(row => row.split('\t'));

        for (let i = 0; i < rows.length; i++) {
          for (let j = 0; j < rows[i].length; j++) {
            const targetRow = startRow + i;
            const targetCol = startCol + j;

            if (targetRow < this.model.getRowCount() && targetCol < this.model.getColCount()) {
              this.model.setCellContent(targetRow, targetCol, rows[i][j]);
            }
          }
        }

        this.renderer.render();
        this.updateSelectedCellInfo();
        this.updateUndoRedoButtons();
        return;
      }
    } catch {
      // 系统剪贴板不可用，使用内部剪贴板
    }

    // 使用内部剪贴板
    if (!this.clipboardData) {
      return;
    }

    const { content } = this.clipboardData;

    for (let i = 0; i < content.length; i++) {
      for (let j = 0; j < content[i].length; j++) {
        const targetRow = startRow + i;
        const targetCol = startCol + j;

        if (targetRow < this.model.getRowCount() && targetCol < this.model.getColCount()) {
          this.model.setCellContent(targetRow, targetCol, content[i][j]);
        }
      }
    }

    // 如果是剪切操作，清除原位置的内容
    if (this.isCut && this.clipboardData) {
      const { startRow: srcRow, startCol: srcCol } = this.clipboardData;
      for (let i = 0; i < content.length; i++) {
        for (let j = 0; j < content[i].length; j++) {
          const row = srcRow + i;
          const col = srcCol + j;
          // 避免清除粘贴目标位置
          if (row < startRow || row >= startRow + content.length ||
              col < startCol || col >= startCol + content[0].length) {
            this.model.setCellContent(row, col, '');
          }
        }
      }
      this.isCut = false;
    }

    this.renderer.render();
    this.updateSelectedCellInfo();
    this.updateUndoRedoButtons();
  }

  // 处理撤销
  private handleUndo(): void {
    if (this.isCollaborationMode()) {
      // 协同模式下委托给协同引擎
      const inverseOp = this.collaborationEngine!.undo();
      if (inverseOp) {
        this.renderer.render();
        this.updateSelectedCellInfo();
        this.updateUndoRedoButtons();
        this.updateScrollbars();
      }
      return;
    }
    if (this.model.undo()) {
      this.renderer.render();
      this.updateSelectedCellInfo();
      this.updateUndoRedoButtons();
      this.updateScrollbars();
    }
  }

  // 处理重做
  private handleRedo(): void {
    if (this.isCollaborationMode()) {
      // 协同模式下委托给协同引擎
      const op = this.collaborationEngine!.redo();
      if (op) {
        this.renderer.render();
        this.updateSelectedCellInfo();
        this.updateUndoRedoButtons();
        this.updateScrollbars();
      }
      return;
    }
    if (this.model.redo()) {
      this.renderer.render();
      this.updateSelectedCellInfo();
      this.updateUndoRedoButtons();
      this.updateScrollbars();
    }
  }

  // 更新撤销/重做按钮状态
  private updateUndoRedoButtons(): void {
    const undoButton = document.getElementById('undo-btn') as HTMLButtonElement;
    const redoButton = document.getElementById('redo-btn') as HTMLButtonElement;

    if (this.isCollaborationMode()) {
      if (undoButton) {
        undoButton.disabled = !this.collaborationEngine!.canUndo();
      }
      if (redoButton) {
        redoButton.disabled = !this.collaborationEngine!.canRedo();
      }
      return;
    }

    if (undoButton) {
      undoButton.disabled = !this.model.canUndo();
    }
    if (redoButton) {
      redoButton.disabled = !this.model.canRedo();
    }
  }

  // ============================================================
  // 排序筛选操作处理
  // ============================================================

  /** 处理排序操作 */
  private handleSort(colIndex: number, direction: SortDirection): void {
    const sfModel = this.model.sortFilterModel;
    // 记录旧快照到撤销栈
    const oldSnapshot = sfModel.getSnapshot();
    sfModel.setSingleSort(colIndex, direction);
    const newSnapshot = sfModel.getSnapshot();

    this.model.getHistoryManager().record({
      type: 'setSort',
      data: newSnapshot,
      undoData: oldSnapshot,
    });

    this.renderer.render();
    this.updateUndoRedoButtons();
  }

  /** 处理筛选应用 */
  private handleFilterApply(colIndex: number, filter: ColumnFilter): void {
    const sfModel = this.model.sortFilterModel;
    // 记录旧快照到撤销栈
    const oldSnapshot = sfModel.getSnapshot();
    sfModel.setColumnFilter(colIndex, filter);
    const newSnapshot = sfModel.getSnapshot();

    this.model.getHistoryManager().record({
      type: 'setFilter',
      data: newSnapshot,
      undoData: oldSnapshot,
    });

    this.renderer.render();
    this.updateUndoRedoButtons();
  }

  /** 处理清除筛选 */
  private handleFilterClear(colIndex: number): void {
    const sfModel = this.model.sortFilterModel;
    const oldSnapshot = sfModel.getSnapshot();
    sfModel.clearColumnFilter(colIndex);
    const newSnapshot = sfModel.getSnapshot();

    this.model.getHistoryManager().record({
      type: 'setFilter',
      data: newSnapshot,
      undoData: oldSnapshot,
    });

    this.renderer.render();
    this.updateUndoRedoButtons();
  }

  // 处理搜索
  private handleSearch(keyword: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerKeyword = keyword.toLowerCase();

    for (let row = 0; row < this.model.getRowCount(); row++) {
      for (let col = 0; col < this.model.getColCount(); col++) {
        const cell = this.model.getCell(row, col);
        if (cell && cell.content && cell.content.toLowerCase().includes(lowerKeyword)) {
          results.push({
            row,
            col,
            content: cell.content
          });
        }
      }
    }

    return results;
  }

  // 处理搜索结果导航
  private handleSearchNavigate(result: SearchResult): void {
    // 选中找到的单元格
    this.currentSelection = {
      startRow: result.row,
      startCol: result.col,
      endRow: result.row,
      endCol: result.col
    };

    this.renderer.setSelection(result.row, result.col, result.row, result.col);
    this.renderer.scrollToCell(result.row, result.col);
    this.renderer.clearHighlight();
    this.updateSelectedCellInfo();
  }

  // 处理搜索无结果
  private handleSearchNoResults(): void {
    this.currentSelection = null;
    this.renderer.clearSelection();
    this.renderer.clearHighlight();
  }

  // 处理窗口大小改变
  private handleResize(): void {
    const container = this.canvas.parentElement as HTMLElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      // 减去滚动条宽度
      this.renderer.resize(rect.width - 14, rect.height - 14);

      // 更新视口信息
      this.updateViewportInfo();

      // 更新滚动条
      this.updateScrollbars();
    }
  }

  // 处理滚轮事件
  private handleWheel(event: WheelEvent): void {
    event.preventDefault();

    // 如果内联编辑器正在编辑，则忽略滚轮事件
    if (this.inlineEditor.isEditing()) {
      return;
    }

    // 计算滚动量
    let deltaX = event.deltaX;
    let deltaY = event.deltaY;

    // 如果按住Shift键，水平滚动
    if (event.shiftKey) {
      deltaX = deltaY;
      deltaY = 0;
    }

    // 滚动
    this.renderer.scrollBy(deltaX, deltaY);
  }

  // 处理右键菜单事件
  private handleContextMenu(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 检查是否点击了行号区域
    const clickedRow = this.renderer.getRowHeaderAtPosition(x, y);
    if (clickedRow !== null) {
      event.preventDefault();
      this.hideColContextMenu();
      this.showContextMenu(event.clientX, event.clientY, clickedRow);
      return;
    }

    // 检查是否点击了列头区域
    const clickedCol = this.renderer.getColHeaderAtPosition(x, y);
    if (clickedCol !== null) {
      event.preventDefault();
      this.hideContextMenu();
      this.showColContextMenu(event.clientX, event.clientY, clickedCol);
    }
  }

  // 处理鼠标按下事件
  private handleMouseDown(event: MouseEvent): void {
    // 如果内联编辑器正在编辑，则忽略鼠标事件
    if (this.inlineEditor.isEditing()) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 检查是否在行高调整区域
    const rowResizeInfo = this.renderer.getRowResizeAtPosition(x, y);
    if (rowResizeInfo !== null) {
      this.isResizingRow = true;
      this.resizeRowIndex = rowResizeInfo;
      this.resizeStartY = event.clientY;
      this.resizeStartHeight = this.model.getRowHeight(rowResizeInfo);
      this.canvas.style.cursor = 'row-resize';
      return;
    }

    // 检查是否在列宽调整区域
    const colResizeInfo = this.renderer.getColResizeAtPosition(x, y);
    if (colResizeInfo !== null) {
      this.isResizingCol = true;
      this.resizeColIndex = colResizeInfo;
      this.resizeStartX = event.clientX;
      this.resizeStartWidth = this.model.getColWidth(colResizeInfo);
      this.canvas.style.cursor = 'col-resize';
      return;
    }

    // 【图表交互】将画布坐标转换为数据区域坐标，代理到 ChartOverlay
    const { headerWidth, headerHeight } = this.renderer.getConfig();
    const viewport = this.renderer.getViewport();
    if (x > headerWidth && y > headerHeight) {
      const dataX = x - headerWidth + viewport.scrollX;
      const dataY = y - headerHeight + viewport.scrollY;
      const consumed = this.chartOverlay.handleMouseDown(dataX, dataY);
      if (consumed) {
        // 图表层消费了事件，阻止正常电子表格交互
        this.renderer.render();
        return;
      }
    }

    // 检查是否点击了行号区域
    const clickedRow = this.renderer.getRowHeaderAtPosition(x, y);
    if (clickedRow !== null) {
      // 高亮整行
      this.renderer.setHighlightedRow(clickedRow);

      // 选择整行
      this.currentSelection = {
        startRow: clickedRow,
        startCol: 0,
        endRow: clickedRow,
        endCol: this.model.getColCount() - 1
      };
      this.renderer.setSelection(clickedRow, 0, clickedRow, this.model.getColCount() - 1);

      // 更新单元格信息显示
      this.updateSelectedCellInfo();
      return;
    }

    // 检查是否点击了列号区域
    const clickedCol = this.renderer.getColHeaderAtPosition(x, y);
    if (clickedCol !== null) {
      // 高亮整列
      this.renderer.setHighlightedCol(clickedCol);

      // 选择整列
      this.currentSelection = {
        startRow: 0,
        startCol: clickedCol,
        endRow: this.model.getRowCount() - 1,
        endCol: clickedCol
      };
      this.renderer.setSelection(0, clickedCol, this.model.getRowCount() - 1, clickedCol);

      // 更新单元格信息显示
      this.updateSelectedCellInfo();
      return;
    }

    // 点击单元格区域时清除高亮
    this.renderer.clearHighlight();

    // 检查是否在表格区域内
    const cellPosition = this.renderer.getCellAtPosition(x, y);

    if (cellPosition) {
      // 获取单元格信息（考虑合并单元格）
      const cellInfo = this.model.getMergedCellInfo(cellPosition.row, cellPosition.col);

      if (cellInfo) {
        // 检查是否点击了下拉验证箭头区域（单元格右侧 20px 区域）
        if (cellInfo.validation && cellInfo.validation.type === 'dropdown') {
          const cellRect = this.renderer.getCellRect(cellInfo.row, cellInfo.col);
          if (cellRect) {
            const arrowWidth = 20;
            const clickXInCell = x - cellRect.x;
            if (clickXInCell >= cellRect.width - arrowWidth) {
              // 先设置选择区域
              this.selectionStart = { row: cellInfo.row, col: cellInfo.col };
              this.currentSelection = {
                startRow: cellInfo.row,
                startCol: cellInfo.col,
                endRow: cellInfo.row + cellInfo.rowSpan - 1,
                endCol: cellInfo.col + cellInfo.colSpan - 1
              };
              this.renderer.setSelection(
                cellInfo.row, cellInfo.col,
                cellInfo.row + cellInfo.rowSpan - 1,
                cellInfo.col + cellInfo.colSpan - 1
              );
              this.updateSelectedCellInfo();

              // 显示下拉菜单
              this.showDropdownMenu(cellInfo.row, cellInfo.col);
              return;
            }
          }
        }

        // 如果是合并单元格，选择整个合并区域
        if (cellInfo.rowSpan > 1 || cellInfo.colSpan > 1) {
          this.selectionStart = { row: cellInfo.row, col: cellInfo.col };
          this.currentSelection = {
            startRow: cellInfo.row,
            startCol: cellInfo.col,
            endRow: cellInfo.row + cellInfo.rowSpan - 1,
            endCol: cellInfo.col + cellInfo.colSpan - 1
          };
          this.renderer.setSelection(
            cellInfo.row,
            cellInfo.col,
            cellInfo.row + cellInfo.rowSpan - 1,
            cellInfo.col + cellInfo.colSpan - 1
          );
        } else {
          // 普通单元格
          this.selectionStart = cellPosition;
          this.currentSelection = {
            startRow: cellPosition.row,
            startCol: cellPosition.col,
            endRow: cellPosition.row,
            endCol: cellPosition.col
          };
          this.renderer.setSelection(
            cellPosition.row,
            cellPosition.col,
            cellPosition.row,
            cellPosition.col
          );
        }

        // 更新单元格信息显示
        this.updateSelectedCellInfo();
      }
    }
  }

  // 处理双击事件
  private handleDoubleClick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 【图表交互】双击图表时打开编辑面板
    const { headerWidth, headerHeight } = this.renderer.getConfig();
    const viewport = this.renderer.getViewport();
    if (x > headerWidth && y > headerHeight) {
      const dataX = x - headerWidth + viewport.scrollX;
      const dataY = y - headerHeight + viewport.scrollY;
      const hit = this.chartOverlay.hitTest(dataX, dataY);
      if (hit) {
        this.chartOverlay.selectChart(hit.chartId);
        this.chartEditor.open(hit.chartId);
        this.renderer.render();
        return;
      }
    }

    // 检查是否在表格区域内
    const cellPosition = this.renderer.getCellAtPosition(x, y);

    if (cellPosition) {
      // 获取单元格信息（考虑合并单元格）
      const cellInfo = this.model.getMergedCellInfo(cellPosition.row, cellPosition.col);

      if (cellInfo) {
        // 如果单元格有下拉列表验证，双击时显示下拉菜单而非编辑器
        if (cellInfo.validation && cellInfo.validation.type === 'dropdown') {
          this.currentSelection = {
            startRow: cellInfo.row,
            startCol: cellInfo.col,
            endRow: cellInfo.row + cellInfo.rowSpan - 1,
            endCol: cellInfo.col + cellInfo.colSpan - 1
          };
          this.updateSelectedCellInfo();
          this.showDropdownMenu(cellInfo.row, cellInfo.col);
          return;
        }

        // 更新选择区域
        this.currentSelection = {
          startRow: cellInfo.row,
          startCol: cellInfo.col,
          endRow: cellInfo.row,
          endCol: cellInfo.col
        };

        // 更新单元格信息显示
        this.updateSelectedCellInfo();

        // 获取单元格在画布上的位置和大小
        const cellRect = this.renderer.getCellRect(cellInfo.row, cellInfo.col);

        if (cellRect) {
          // 计算单元格的总宽度和高度（考虑合并单元格）
          let totalWidth = cellRect.width;
          let totalHeight = cellRect.height;

          // 显示内联编辑器
          this.inlineEditor.show(
            rect.left + cellRect.x + 1, // 左边位置（+1像素避免边框重叠）
            rect.top + cellRect.y + 1,  // 顶部位置（+1像素避免边框重叠）
            totalWidth - 2,             // 宽度（-2像素避免边框重叠）
            totalHeight - 2,            // 高度（-2像素避免边框重叠）
            cellInfo.content || '',     // 单元格内容
            cellInfo.row,               // 行索引
            cellInfo.col,               // 列索引
            (value) => {                // 保存回调函数
              // 获取旧内容
              const previousContent = this.model.getCell(cellInfo.row, cellInfo.col)?.content ?? '';
              // 设置单元格内容
              const result = this.model.setCellContent(cellInfo.row, cellInfo.col, value);

              // 验证失败时显示错误提示（需求 5.5）
              if (!result.success && result.validationResult && !result.validationResult.valid) {
                this.showValidationError(
                  cellInfo.row,
                  cellInfo.col,
                  result.validationResult.errorTitle,
                  result.validationResult.errorMessage
                );
                return;
              }
              // 警告模式下也显示错误提示
              if (result.validationResult && !result.validationResult.valid) {
                this.showValidationError(
                  cellInfo.row,
                  cellInfo.col,
                  result.validationResult.errorTitle,
                  result.validationResult.errorMessage
                );
              }

              // 协同模式下提交操作
              if (this.isCollaborationMode() && value !== previousContent) {
                this.submitCollabOperation({
                  ...this.createBaseOp(),
                  type: 'cellEdit',
                  row: cellInfo.row,
                  col: cellInfo.col,
                  content: value,
                  previousContent,
                });
              }

              // 更新单元格信息显示
              this.updateSelectedCellInfo();

              // 重新渲染
              this.renderer.render();
            }
          );
        }
      }
    }
  }

  // 处理鼠标移动事件
  private handleMouseMove(event: MouseEvent): void {
    // 如果内联编辑器正在编辑，则忽略鼠标事件
    if (this.inlineEditor.isEditing()) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 处理行高调整拖拽
    if (this.isResizingRow) {
      const deltaY = event.clientY - this.resizeStartY;
      const newHeight = Math.max(20, this.resizeStartHeight + deltaY);
      this.model.setRowHeight(this.resizeRowIndex, newHeight, false);
      this.renderer.render();
      this.updateScrollbars();
      return;
    }

    // 处理列宽调整拖拽
    if (this.isResizingCol) {
      const deltaX = event.clientX - this.resizeStartX;
      const newWidth = Math.max(30, this.resizeStartWidth + deltaX);
      this.model.setColWidth(this.resizeColIndex, newWidth, false);
      this.renderer.render();
      this.updateScrollbars();
      return;
    }

    // 【图表交互】将画布坐标转换为数据区域坐标，代理到 ChartOverlay
    const { headerWidth, headerHeight } = this.renderer.getConfig();
    const viewport = this.renderer.getViewport();
    if (x > headerWidth && y > headerHeight) {
      const dataX = x - headerWidth + viewport.scrollX;
      const dataY = y - headerHeight + viewport.scrollY;
      const cursorStyle = this.chartOverlay.handleMouseMove(dataX, dataY);
      if (cursorStyle) {
        // 图表层返回了光标样式，更新光标并重绘
        this.canvas.style.cursor = cursorStyle;
        this.renderer.render();
        return;
      }
    }

    // 检查是否在调整区域，更新鼠标样式
    const rowResizeInfo = this.renderer.getRowResizeAtPosition(x, y);
    const colResizeInfo = this.renderer.getColResizeAtPosition(x, y);

    if (rowResizeInfo !== null) {
      this.canvas.style.cursor = 'row-resize';
    } else if (colResizeInfo !== null) {
      this.canvas.style.cursor = 'col-resize';
    } else if (!this.selectionStart) {
      this.canvas.style.cursor = 'default';
    }

    if (this.selectionStart) {
      // 更新选择区域
      const cellPosition = this.renderer.getCellAtPosition(x, y);

      if (cellPosition) {
        // 获取当前单元格信息（考虑合并单元格）
        const currentCellInfo = this.model.getMergedCellInfo(cellPosition.row, cellPosition.col);

        if (currentCellInfo) {
          // 获取起始单元格信息（考虑合并单元格）
          const startCellInfo = this.model.getMergedCellInfo(this.selectionStart.row, this.selectionStart.col);

          if (startCellInfo) {
            // 计算实际的起始和结束位置（考虑合并单元格）
            const actualStartRow = startCellInfo.row;
            const actualStartCol = startCellInfo.col;
            const actualEndRow = currentCellInfo.row + currentCellInfo.rowSpan - 1;
            const actualEndCol = currentCellInfo.col + currentCellInfo.colSpan - 1;

            // 确保选择区域的起始和结束位置正确
            const startRow = Math.min(actualStartRow, currentCellInfo.row);
            const endRow = Math.max(actualStartRow + startCellInfo.rowSpan - 1, actualEndRow);
            const startCol = Math.min(actualStartCol, currentCellInfo.col);
            const endCol = Math.max(actualStartCol + startCellInfo.colSpan - 1, actualEndCol);

            this.currentSelection = {
              startRow: this.selectionStart.row,
              startCol: this.selectionStart.col,
              endRow: cellPosition.row,
              endCol: cellPosition.col
            };

            this.renderer.setSelection(startRow, startCol, endRow, endCol);
          }
        }
      }
    }
  }

  // 处理鼠标松开事件
  private handleMouseUp(): void {
    // 【图表交互】通知图表浮动层鼠标释放
    this.chartOverlay.handleMouseUp();

    this.selectionStart = null;

    // 协同模式下广播最终选择区域
    if (this.isCollaborationMode() && this.currentSelection) {
      this.collaborationEngine!.sendCursor(this.currentSelection);
    }

    // 重置行高/列宽调整状态，并在协同模式下提交操作
    if (this.isResizingRow) {
      const finalHeight = this.model.getRowHeight(this.resizeRowIndex);
      // 记录撤销历史（非协同模式）
      if (!this.isCollaborationMode() && finalHeight !== this.resizeStartHeight) {
        this.model.getHistoryManager().record({
          type: 'resizeRow',
          data: { row: this.resizeRowIndex, height: finalHeight },
          undoData: { row: this.resizeRowIndex, height: this.resizeStartHeight }
        });
      }
      if (this.isCollaborationMode()) {
        this.submitCollabOperation({
          ...this.createBaseOp(),
          type: 'rowResize',
          rowIndex: this.resizeRowIndex,
          height: finalHeight,
        });
      }
      this.isResizingRow = false;
      this.resizeRowIndex = -1;
      this.canvas.style.cursor = 'default';
    }

    if (this.isResizingCol) {
      const finalWidth = this.model.getColWidth(this.resizeColIndex);
      // 记录撤销历史（非协同模式）
      if (!this.isCollaborationMode() && finalWidth !== this.resizeStartWidth) {
        this.model.getHistoryManager().record({
          type: 'resizeCol',
          data: { col: this.resizeColIndex, width: finalWidth },
          undoData: { col: this.resizeColIndex, width: this.resizeStartWidth }
        });
      }
      if (this.isCollaborationMode()) {
        this.submitCollabOperation({
          ...this.createBaseOp(),
          type: 'colResize',
          colIndex: this.resizeColIndex,
          width: finalWidth,
        });
      }
      this.isResizingCol = false;
      this.resizeColIndex = -1;
      this.canvas.style.cursor = 'default';
    }
  }

  /**
   * 处理合并单元格 - 完全参考Excel的实现
   *
   * Excel中的合并单元格行为：
   * 1. 必须选择多个单元格才能合并
   * 2. 合并后，只保留左上角单元格的内容
   * 3. 如果选择区域包含已合并的单元格，会先拆分再合并
   * 4. 合并后，选择区域变为合并后的单元格
   */
  private handleMergeCells(): void {
    if (!this.currentSelection) {
      alert('请先选择要合并的单元格');
      return;
    }

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 确保选择区域的起始和结束位置正确
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    // 如果只选择了一个单元格
    if (minRow === maxRow && minCol === maxCol) {
      alert('请选择多个单元格进行合并');
      return;
    }

    // 合并多个单元格
    if (this.model.mergeCells(minRow, minCol, maxRow, maxCol)) {
      // 协同模式下提交操作
      if (this.isCollaborationMode()) {
        this.submitCollabOperation({
          ...this.createBaseOp(),
          type: 'cellMerge',
          startRow: minRow,
          startCol: minCol,
          endRow: maxRow,
          endCol: maxCol,
        });
      }
      // 更新选择区域为合并后的单元格
      this.currentSelection = {
        startRow: minRow,
        startCol: minCol,
        endRow: minRow,
        endCol: minCol
      };
      this.renderer.setSelection(minRow, minCol, minRow, minCol);

      // 更新单元格信息显示
      this.updateSelectedCellInfo();

      // 更新撤销/重做按钮状态
      this.updateUndoRedoButtons();
    } else {
      alert('无法合并选定的单元格');
    }
  }

  /**
   * 处理拆分单元格 - 完全参考Excel的实现
   *
   * Excel中的拆分单元格行为：
   * 1. 如果选择了一个合并单元格，直接拆分该单元格
   * 2. 如果选择了多个单元格，检查每个单元格是否是合并单元格的父单元格，如果是则拆分
   * 3. 如果选择区域中没有合并单元格，显示提示信息
   * 4. 拆分后，保持选择区域不变
   */
  private handleSplitCells(): void {
    if (!this.currentSelection) {
      alert('请先选择要拆分的单元格');
      return;
    }

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 确保选择区域的起始和结束位置正确
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    // 如果只选择了一个单元格
    if (minRow === maxRow && minCol === maxCol) {
      // 获取单元格信息
      const cellInfo = this.model.getMergedCellInfo(minRow, minCol);

      // 检查是否是合并单元格或合并单元格的一部分
      if (cellInfo) {
        const { row, col, rowSpan, colSpan } = cellInfo;

        // 如果是合并单元格
        if (rowSpan > 1 || colSpan > 1) {
          // 拆分单元格
          if (this.model.splitCell(row, col)) {
            // 协同模式下提交操作
            if (this.isCollaborationMode()) {
              this.submitCollabOperation({
                ...this.createBaseOp(),
                type: 'cellSplit',
                row,
                col,
                rowSpan,
                colSpan,
              });
            }
            // 重新渲染
            this.renderer.render();

            // 更新单元格信息显示
            this.updateSelectedCellInfo();

            // 更新撤销/重做按钮状态
            this.updateUndoRedoButtons();
            return;
          }
        }
      }

      // 如果不是合并单元格
      alert('选中的单元格不是合并单元格');
      return;
    }

    // 如果选择了多个单元格
    let splitCount = 0;
    const processedCells = new Set<string>(); // 用于跟踪已处理的合并单元格

    // 遍历选择区域中的每个单元格
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        // 获取单元格信息
        const cellInfo = this.model.getMergedCellInfo(i, j);

        if (cellInfo) {
          const { row, col, rowSpan, colSpan } = cellInfo;

          // 如果是合并单元格且尚未处理
          if ((rowSpan > 1 || colSpan > 1) && !processedCells.has(`${row},${col}`)) {
            // 检查合并单元格是否完全在选择区域内
            const endMergeRow = row + rowSpan - 1;
            const endMergeCol = col + colSpan - 1;

            if (row >= minRow && col >= minCol && endMergeRow <= maxRow && endMergeCol <= maxCol) {
              // 拆分单元格
              if (this.model.splitCell(row, col)) {
                // 协同模式下提交操作
                if (this.isCollaborationMode()) {
                  this.submitCollabOperation({
                    ...this.createBaseOp(),
                    type: 'cellSplit',
                    row,
                    col,
                    rowSpan,
                    colSpan,
                  });
                }
                splitCount++;
                processedCells.add(`${row},${col}`);
              }
            }
          }
        }
      }
    }

    if (splitCount > 0) {
      // 重新渲染
      this.renderer.render();

      // 更新单元格信息显示
      this.updateSelectedCellInfo();

      // 更新撤销/重做按钮状态
      this.updateUndoRedoButtons();
    } else {
      alert('选择区域中没有可拆分的合并单元格');
    }
  }

  // 可选字号列表（偶数）
  private static readonly FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 48];

  // 数字格式映射表：data-format 值 → CellFormat（general 表示移除格式）
  private static readonly NUMBER_FORMAT_MAP: Record<string, CellFormat | undefined> = {
    'general': undefined,
    'number': { category: 'number', pattern: '#,##0.00' },
    'currency': { category: 'currency', pattern: '¥#,##0.00', currencySymbol: '¥' },
    'percentage': { category: 'percentage', pattern: '0.00%' },
    'scientific': { category: 'scientific', pattern: '0.00E+0' },
    'date': { category: 'date', pattern: 'yyyy-MM-dd' },
    'time': { category: 'time', pattern: 'HH:mm:ss' },
  };

  // 格式类别到下拉菜单显示文本的映射
  private static readonly FORMAT_DISPLAY_TEXT: Record<string, string> = {
    'general': '常规',
    'number': '数字',
    'currency': '货币',
    'percentage': '百分比',
    'scientific': '科学计数法',
    'date': '日期',
    'time': '时间',
  };

  // 初始化字体大小选择器
  private initFontSizePicker(): void {
    const btn = document.getElementById('font-size-btn');
    const dropdown = document.getElementById('font-size-dropdown');
    const textEl = document.getElementById('font-size-text');
    if (!btn || !dropdown || !textEl) return;

    // 默认显示 12px
    textEl.textContent = '12px';

    // 生成下拉选项
    SpreadsheetApp.FONT_SIZES.forEach((size) => {
      const option = document.createElement('div');
      option.className = `font-size-option${size === 12 ? ' active' : ''}`;
      option.textContent = `${size}px`;
      option.dataset.size = String(size);
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleFontSizeChange(size);
        dropdown.classList.remove('visible');
      });
      dropdown.appendChild(option);
    });

    // 点击按钮切换下拉框
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('visible');
    });

    // 点击其他地方关闭下拉框
    document.addEventListener('click', () => {
      dropdown.classList.remove('visible');
    });
  }

  // 更新字体大小按钮显示文本和下拉选项激活状态
  private updateFontSizeUI(size: number): void {
    const textEl = document.getElementById('font-size-text');
    if (textEl) {
      textEl.textContent = `${size}px`;
    }

    const dropdown = document.getElementById('font-size-dropdown');
    if (dropdown) {
      dropdown.querySelectorAll('.font-size-option').forEach((el) => {
        const optionEl = el as HTMLElement;
        optionEl.classList.toggle('active', optionEl.dataset.size === String(size));
      });
    }
  }

  // 初始化数字格式下拉菜单
  private initNumberFormatPicker(): void {
    const btn = document.getElementById('number-format-btn');
    const dropdown = document.getElementById('number-format-dropdown');
    if (!btn || !dropdown) return;

    // 点击按钮切换下拉框
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('visible');
    });

    // 监听格式选项点击
    const options = dropdown.querySelectorAll('.number-format-option');
    options.forEach((option) => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const formatKey = (option as HTMLElement).dataset.format;
        if (formatKey !== undefined) {
          this.handleNumberFormatChange(formatKey);
        }
        dropdown.classList.remove('visible');
      });
    });

    // 点击其他地方关闭下拉框
    document.addEventListener('click', () => {
      dropdown.classList.remove('visible');
    });
  }

  // 更新数字格式下拉菜单 UI 状态
  private updateNumberFormatUI(formatCategory: string): void {
    const textEl = document.getElementById('number-format-text');
    if (textEl) {
      textEl.textContent = SpreadsheetApp.FORMAT_DISPLAY_TEXT[formatCategory] || '常规';
    }

    const dropdown = document.getElementById('number-format-dropdown');
    if (dropdown) {
      dropdown.querySelectorAll('.number-format-option').forEach((el) => {
        const optionEl = el as HTMLElement;
        optionEl.classList.toggle('active', optionEl.dataset.format === formatCategory);
      });
    }
  }

  // 处理数字格式变更
  private handleNumberFormatChange(formatKey: string): void {
    if (!this.currentSelection) return;

    const format = SpreadsheetApp.NUMBER_FORMAT_MAP[formatKey];
    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    if (format === undefined) {
      // "常规"格式：清除选中区域的格式
      this.model.clearRangeFormat(startRow, startCol, endRow, endCol);
    } else {
      // 设置选中区域的格式
      this.model.setRangeFormat(startRow, startCol, endRow, endCol, format);
    }

    // 更新 UI 显示
    this.updateNumberFormatUI(formatKey);

    // 重新渲染
    this.renderer.render();

    // 更新撤销/重做按钮状态
    this.updateUndoRedoButtons();
  }

  // 处理换行按钮点击
  private handleWrapTextChange(): void {
    if (!this.currentSelection) return;

    const wrapTextBtn = document.getElementById('wrap-text-btn');
    if (!wrapTextBtn) return;

    // 切换换行状态
    const isWrap = !wrapTextBtn.classList.contains('active');
    wrapTextBtn.classList.toggle('active', isWrap);

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 设置选中区域的换行属性
    this.model.setRangeWrapText(startRow, startCol, endRow, endCol, isWrap);

    // 重新渲染
    this.renderer.render();

    // 更新撤销/重做按钮状态
    this.updateUndoRedoButtons();
  }

  // 更新换行按钮 UI 状态
  private updateWrapTextUI(wrap: boolean): void {
    const wrapTextBtn = document.getElementById('wrap-text-btn');
    if (wrapTextBtn) {
      wrapTextBtn.classList.toggle('active', wrap);
    }
  }

  // ============================================================
  // 图表工具栏按钮事件
  // ============================================================

  /**
   * 初始化图表工具栏按钮事件
   *
   * - "插入图表"按钮：点击后检查选区是否包含数据，有则弹出类型选择面板
   * - "迷你图"下拉按钮：切换下拉菜单显示
   * - 迷你图选项：点击后弹出数据范围输入对话框，创建 SparklineConfig
   */
  private initChartToolbarEvents(): void {
    // 插入图表按钮
    const insertChartBtn = document.getElementById('insert-chart-btn');
    if (insertChartBtn) {
      insertChartBtn.addEventListener('click', () => {
        this.handleInsertChart();
      });
    }

    // 迷你图下拉按钮（与 number-format-picker 相同的下拉模式）
    const sparklineBtn = document.getElementById('sparkline-btn');
    const sparklineDropdown = document.getElementById('sparkline-dropdown');
    if (sparklineBtn && sparklineDropdown) {
      sparklineBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sparklineDropdown.classList.toggle('visible');
      });

      // 迷你图选项点击
      const sparklineOptions = sparklineDropdown.querySelectorAll('.sparkline-option');
      sparklineOptions.forEach((option) => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const sparklineType = (option as HTMLElement).dataset.type as SparklineType;
          if (sparklineType) {
            this.handleSparklineOption(sparklineType);
          }
          sparklineDropdown.classList.remove('visible');
        });
      });

      // 点击其他地方关闭下拉框
      document.addEventListener('click', () => {
        sparklineDropdown.classList.remove('visible');
      });
    }
  }

  /**
   * 处理"插入图表"按钮点击
   *
   * 检查当前选区是否包含数据，有则调用 ChartOverlay.showTypeSelector()。
   */
  private handleInsertChart(): void {
    if (!this.currentSelection) {
      alert('请先选择包含数据的单元格区域');
      return;
    }

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 检查选区是否包含至少一个有内容的单元格
    let hasData = false;
    for (let r = startRow; r <= endRow && !hasData; r++) {
      for (let c = startCol; c <= endCol && !hasData; c++) {
        const cell = this.model.getCell(r, c);
        if (cell && cell.content !== '') {
          hasData = true;
        }
      }
    }

    if (!hasData) {
      alert('选中的区域没有数据，请选择包含数据的区域');
      return;
    }

    // 计算弹出面板位置（使用插入图表按钮的位置）
    const btn = document.getElementById('insert-chart-btn');
    let popupX = 100;
    let popupY = 100;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      popupX = rect.left;
      popupY = rect.bottom + 4;
    }

    // 计算图表在数据区域中的放置位置（选区右侧偏移 20px）
    const config = this.renderer.getConfig();
    const viewport = this.renderer.getViewport();
    let chartX = config.headerWidth;
    for (let c = 0; c <= endCol; c++) {
      chartX += this.model.getColWidth(c);
    }
    chartX += viewport.scrollX + 20;

    let chartY = config.headerHeight;
    for (let r = 0; r < startRow; r++) {
      chartY += this.model.getRowHeight(r);
    }
    chartY += viewport.scrollY;

    const dataRange: DataRange = { startRow, startCol, endRow, endCol };
    const chartPosition = { x: chartX, y: chartY };
    this.chartOverlay.showTypeSelector(popupX, popupY, dataRange, chartPosition);
  }

  /**
   * 处理迷你图选项点击
   *
   * 弹出数据范围输入对话框，解析后在当前选中单元格创建 SparklineConfig。
   */
  private handleSparklineOption(type: SparklineType): void {
    if (!this.currentSelection) return;

    const { startRow, startCol } = this.currentSelection;

    // 弹出数据范围输入对话框
    const rangeStr = prompt('请输入数据范围（例如 A1:A10）：');
    if (!rangeStr || rangeStr.trim() === '') return;

    const parsed = this.parseRangeString(rangeStr.trim());
    if (!parsed) {
      alert('无效的数据范围格式，请使用如 A1:A10 的格式。');
      return;
    }

    // 在当前选中单元格设置迷你图配置
    const cell = this.model.getCell(startRow, startCol);
    if (cell) {
      cell.sparkline = {
        type,
        dataRange: parsed,
      };
      this.renderer.render();
    }
  }

  /**
   * 解析范围字符串（如 "A1:A10"）为 DataRange 对象
   *
   * @returns DataRange 或 null（格式无效时）
   */
  private parseRangeString(rangeStr: string): DataRange | null {
    const match = rangeStr.match(/^([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)$/);
    if (!match) return null;

    const startCol = this.letterToColumnIndex(match[1].toUpperCase());
    const startRow = parseInt(match[2], 10) - 1;
    const endCol = this.letterToColumnIndex(match[3].toUpperCase());
    const endRow = parseInt(match[4], 10) - 1;

    if (startRow < 0 || startCol < 0 || endRow < 0 || endCol < 0) return null;
    if (startRow > endRow || startCol > endCol) return null;

    return { startRow, startCol, endRow, endCol };
  }

  /**
   * 将列字母转换为列索引（A=0, B=1, ..., Z=25, AA=26, ...）
   */
  private letterToColumnIndex(letters: string): number {
    let index = 0;
    for (let i = 0; i < letters.length; i++) {
      index = index * 26 + (letters.charCodeAt(i) - 64);
    }
    return index - 1;
  }

  /**
   * 更新"插入图表"按钮的启用/禁用状态
   *
   * 根据当前选区是否包含数据来决定按钮状态。
   */
  private updateInsertChartButtonState(): void {
    const btn = document.getElementById('insert-chart-btn');
    if (!btn) return;

    if (!this.currentSelection) {
      btn.setAttribute('disabled', '');
      btn.title = '请先选择数据区域';
      return;
    }

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 检查选区是否包含至少一个有内容的单元格
    let hasData = false;
    for (let r = startRow; r <= endRow && !hasData; r++) {
      for (let c = startCol; c <= endCol && !hasData; c++) {
        const cell = this.model.getCell(r, c);
        if (cell && cell.content !== '') {
          hasData = true;
        }
      }
    }

    if (hasData) {
      btn.removeAttribute('disabled');
      btn.title = '插入图表';
    } else {
      btn.setAttribute('disabled', '');
      btn.title = '请先选择数据区域';
    }
  }

  // ============================================================
  // 条件格式设置面板
  // ============================================================

  // 条件格式条件类型标签映射
  private static readonly CONDITION_TYPE_LABELS: Record<string, string> = {
    greaterThan: '大于',
    lessThan: '小于',
    equals: '等于',
    between: '介于',
    textContains: '文本包含',
    textStartsWith: '文本开头为',
    textEndsWith: '文本结尾为',
    dataBar: '数据条',
    colorScale: '色阶',
    iconSet: '图标集',
  };

  // 创建条件格式设置面板（DOM 覆盖层）
  private createConditionalFormatPanel(): void {
    const panel = document.createElement('div');
    panel.className = 'cf-panel';
    panel.style.display = 'none';
    document.body.appendChild(panel);
    this.conditionalFormatPanel = panel;

    // 点击面板外部关闭
    document.addEventListener('mousedown', (e) => {
      if (this.conditionalFormatPanel &&
          this.conditionalFormatPanel.style.display !== 'none' &&
          !this.conditionalFormatPanel.contains(e.target as Node)) {
        // 检查点击目标是否是条件格式按钮本身
        const btn = document.getElementById('conditional-format-btn');
        if (btn && (btn === e.target || btn.contains(e.target as Node))) return;
        this.hideConditionalFormatPanel();
      }
    });
  }

  // 显示条件格式设置面板
  private showConditionalFormatPanel(): void {
    if (!this.conditionalFormatPanel) return;

    // 如果面板已显示，则关闭
    if (this.conditionalFormatPanel.style.display !== 'none') {
      this.hideConditionalFormatPanel();
      return;
    }

    this.renderConditionalFormatPanel();
    this.conditionalFormatPanel.style.display = 'block';
    // 触发动画
    requestAnimationFrame(() => {
      this.conditionalFormatPanel?.classList.add('visible');
    });
  }

  // 隐藏条件格式设置面板
  private hideConditionalFormatPanel(): void {
    if (!this.conditionalFormatPanel) return;
    this.conditionalFormatPanel.classList.remove('visible');
    this.conditionalFormatPanel.style.display = 'none';
  }

  // 获取当前选区的范围文本（如 "A1:C3"）
  private getSelectionRangeText(): string {
    if (!this.currentSelection) return 'A1';
    const { startRow, startCol, endRow, endCol } = this.currentSelection;
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const startLabel = `${this.columnIndexToLetter(minCol)}${minRow + 1}`;
    const endLabel = `${this.columnIndexToLetter(maxCol)}${maxRow + 1}`;
    if (startLabel === endLabel) return startLabel;
    return `${startLabel}:${endLabel}`;
  }

  // 获取当前选区的范围对象
  private getSelectionRange(): { startRow: number; startCol: number; endRow: number; endCol: number } {
    if (!this.currentSelection) {
      return { startRow: 0, startCol: 0, endRow: 0, endCol: 0 };
    }
    const { startRow, startCol, endRow, endCol } = this.currentSelection;
    return {
      startRow: Math.min(startRow, endRow),
      startCol: Math.min(startCol, endCol),
      endRow: Math.max(startRow, endRow),
      endCol: Math.max(startCol, endCol),
    };
  }

  // 渲染条件格式面板内容
  private renderConditionalFormatPanel(): void {
    if (!this.conditionalFormatPanel) return;

    const rules = this.model.getConditionalFormats();
    const panel = this.conditionalFormatPanel;
    panel.innerHTML = '';

    // 标题栏
    const titleBar = document.createElement('div');
    titleBar.className = 'cf-panel-title-bar';

    const title = document.createElement('h3');
    title.className = 'cf-panel-title';
    title.textContent = '条件格式';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'cf-panel-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.hideConditionalFormatPanel());

    titleBar.appendChild(title);
    titleBar.appendChild(closeBtn);
    panel.appendChild(titleBar);

    // 已有规则列表
    const listSection = document.createElement('div');
    listSection.className = 'cf-rule-list';

    if (rules.length === 0) {
      const emptyTip = document.createElement('div');
      emptyTip.className = 'cf-empty-tip';
      emptyTip.textContent = '暂无条件格式规则';
      listSection.appendChild(emptyTip);
    } else {
      rules.forEach((rule) => {
        const ruleItem = this.createRuleItem(rule);
        listSection.appendChild(ruleItem);
      });
    }
    panel.appendChild(listSection);

    // 分隔线
    const divider = document.createElement('div');
    divider.className = 'cf-divider';
    panel.appendChild(divider);

    // 新增规则表单
    const formSection = document.createElement('div');
    formSection.className = 'cf-form';

    const formTitle = document.createElement('div');
    formTitle.className = 'cf-form-title';
    formTitle.textContent = '添加新规则';
    formSection.appendChild(formTitle);

    // 应用范围
    const rangeGroup = this.createFormGroup('应用范围');
    const rangeInput = document.createElement('input');
    rangeInput.type = 'text';
    rangeInput.className = 'cf-input';
    rangeInput.value = this.getSelectionRangeText();
    rangeInput.readOnly = true;
    rangeGroup.appendChild(rangeInput);
    formSection.appendChild(rangeGroup);

    // 条件类型
    const typeGroup = this.createFormGroup('条件类型');
    const typeSelect = document.createElement('select');
    typeSelect.className = 'cf-select';
    const conditionTypes: Array<ConditionalFormatCondition['type']> = [
      'greaterThan', 'lessThan', 'equals', 'between',
      'textContains', 'textStartsWith', 'textEndsWith',
      'dataBar', 'colorScale', 'iconSet',
    ];
    conditionTypes.forEach((ct) => {
      const opt = document.createElement('option');
      opt.value = ct;
      opt.textContent = SpreadsheetApp.CONDITION_TYPE_LABELS[ct] || ct;
      typeSelect.appendChild(opt);
    });
    typeGroup.appendChild(typeSelect);
    formSection.appendChild(typeGroup);

    // 值输入区域（根据条件类型动态显示）
    const valueContainer = document.createElement('div');
    valueContainer.className = 'cf-value-container';
    formSection.appendChild(valueContainer);

    // 样式设置区域
    const styleContainer = document.createElement('div');
    styleContainer.className = 'cf-style-container';
    formSection.appendChild(styleContainer);

    // 初始渲染值输入和样式区域
    this.renderConditionValueInputs(valueContainer, styleContainer, typeSelect.value as ConditionalFormatCondition['type']);

    // 条件类型变更时更新值输入区域
    typeSelect.addEventListener('change', () => {
      this.renderConditionValueInputs(valueContainer, styleContainer, typeSelect.value as ConditionalFormatCondition['type']);
    });

    // 添加按钮
    const addBtn = document.createElement('button');
    addBtn.className = 'cf-add-btn';
    addBtn.textContent = '添加规则';
    addBtn.addEventListener('click', () => {
      this.handleAddConditionalFormatRule(typeSelect, valueContainer, styleContainer);
    });
    formSection.appendChild(addBtn);

    panel.appendChild(formSection);
  }

  // 创建表单分组
  private createFormGroup(label: string): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'cf-form-group';
    const labelEl = document.createElement('label');
    labelEl.className = 'cf-label';
    labelEl.textContent = label;
    group.appendChild(labelEl);
    return group;
  }

  // 根据条件类型渲染值输入区域和样式区域
  private renderConditionValueInputs(
    valueContainer: HTMLDivElement,
    styleContainer: HTMLDivElement,
    conditionType: ConditionalFormatCondition['type']
  ): void {
    valueContainer.innerHTML = '';
    styleContainer.innerHTML = '';

    const isVisualType = conditionType === 'dataBar' || conditionType === 'colorScale' || conditionType === 'iconSet';

    // 值输入
    if (conditionType === 'between') {
      // 介于：两个输入框
      const minGroup = this.createFormGroup('最小值');
      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.className = 'cf-input';
      minInput.dataset.field = 'min';
      minGroup.appendChild(minInput);
      valueContainer.appendChild(minGroup);

      const maxGroup = this.createFormGroup('最大值');
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.className = 'cf-input';
      maxInput.dataset.field = 'max';
      maxGroup.appendChild(maxInput);
      valueContainer.appendChild(maxGroup);
    } else if (conditionType === 'dataBar') {
      // 数据条：颜色选择
      const colorGroup = this.createFormGroup('数据条颜色');
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'cf-color-input';
      colorInput.value = '#4CAF50';
      colorInput.dataset.field = 'barColor';
      colorGroup.appendChild(colorInput);
      valueContainer.appendChild(colorGroup);
    } else if (conditionType === 'colorScale') {
      // 色阶：最小/最大颜色
      const minColorGroup = this.createFormGroup('最小值颜色');
      const minColorInput = document.createElement('input');
      minColorInput.type = 'color';
      minColorInput.className = 'cf-color-input';
      minColorInput.value = '#F44336';
      minColorInput.dataset.field = 'minColor';
      minColorGroup.appendChild(minColorInput);
      valueContainer.appendChild(minColorGroup);

      const maxColorGroup = this.createFormGroup('最大值颜色');
      const maxColorInput = document.createElement('input');
      maxColorInput.type = 'color';
      maxColorInput.className = 'cf-color-input';
      maxColorInput.value = '#4CAF50';
      maxColorInput.dataset.field = 'maxColor';
      maxColorGroup.appendChild(maxColorInput);
      valueContainer.appendChild(maxColorGroup);
    } else if (conditionType === 'iconSet') {
      // 图标集：类型选择
      const iconGroup = this.createFormGroup('图标类型');
      const iconSelect = document.createElement('select');
      iconSelect.className = 'cf-select';
      iconSelect.dataset.field = 'iconType';
      const iconTypes: Array<{ value: string; label: string }> = [
        { value: 'arrows', label: '箭头' },
        { value: 'circles', label: '圆点' },
        { value: 'flags', label: '旗帜' },
      ];
      iconTypes.forEach(({ value, label }) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        iconSelect.appendChild(opt);
      });
      iconGroup.appendChild(iconSelect);
      valueContainer.appendChild(iconGroup);
    } else if (conditionType === 'greaterThan' || conditionType === 'lessThan' || conditionType === 'equals') {
      // 数值比较：单个值输入
      const valGroup = this.createFormGroup('值');
      const valInput = document.createElement('input');
      valInput.type = 'text';
      valInput.className = 'cf-input';
      valInput.dataset.field = 'value';
      valGroup.appendChild(valInput);
      valueContainer.appendChild(valGroup);
    } else {
      // 文本条件：文本输入
      const textGroup = this.createFormGroup('文本');
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.className = 'cf-input';
      textInput.dataset.field = 'text';
      textGroup.appendChild(textInput);
      valueContainer.appendChild(textGroup);
    }

    // 样式设置（仅非可视化类型显示字体/背景颜色）
    if (!isVisualType) {
      const fontColorGroup = this.createFormGroup('字体颜色');
      const fontColorInput = document.createElement('input');
      fontColorInput.type = 'color';
      fontColorInput.className = 'cf-color-input';
      fontColorInput.value = '#F44336';
      fontColorInput.dataset.field = 'fontColor';
      fontColorGroup.appendChild(fontColorInput);
      styleContainer.appendChild(fontColorGroup);

      const bgColorGroup = this.createFormGroup('背景颜色');
      const bgColorInput = document.createElement('input');
      bgColorInput.type = 'color';
      bgColorInput.className = 'cf-color-input';
      bgColorInput.value = '#FFEB3B';
      bgColorInput.dataset.field = 'bgColor';
      bgColorGroup.appendChild(bgColorInput);
      styleContainer.appendChild(bgColorGroup);
    }
  }

  // 处理添加条件格式规则
  private handleAddConditionalFormatRule(
    typeSelect: HTMLSelectElement,
    valueContainer: HTMLDivElement,
    styleContainer: HTMLDivElement
  ): void {
    const conditionType = typeSelect.value as ConditionalFormatCondition['type'];
    const range = this.getSelectionRange();

    // 构建条件对象
    const condition = this.buildConditionFromInputs(conditionType, valueContainer);
    if (!condition) return;

    // 构建样式对象
    const style = this.buildStyleFromInputs(conditionType, styleContainer);

    // 生成唯一 ID
    const id = `cf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 获取当前规则数量作为优先级
    const existingRules = this.model.getConditionalFormats();
    const priority = existingRules.length;

    const rule: ConditionalFormatRule = {
      id,
      range,
      priority,
      condition,
      style,
    };

    this.model.addConditionalFormat(rule);
    this.renderer.render();

    // 重新渲染面板以显示新规则
    this.renderConditionalFormatPanel();
  }

  // 从输入框构建条件对象
  private buildConditionFromInputs(
    conditionType: ConditionalFormatCondition['type'],
    valueContainer: HTMLDivElement
  ): ConditionalFormatCondition | null {
    const getInputValue = (field: string): string => {
      const input = valueContainer.querySelector(`[data-field="${field}"]`) as HTMLInputElement | HTMLSelectElement | null;
      return input ? input.value : '';
    };

    switch (conditionType) {
      case 'greaterThan': {
        const val = parseFloat(getInputValue('value'));
        if (isNaN(val)) { alert('请输入有效的数值'); return null; }
        return { type: 'greaterThan', value: val };
      }
      case 'lessThan': {
        const val = parseFloat(getInputValue('value'));
        if (isNaN(val)) { alert('请输入有效的数值'); return null; }
        return { type: 'lessThan', value: val };
      }
      case 'equals': {
        const raw = getInputValue('value');
        const num = parseFloat(raw);
        return { type: 'equals', value: isNaN(num) ? raw : num };
      }
      case 'between': {
        const min = parseFloat(getInputValue('min'));
        const max = parseFloat(getInputValue('max'));
        if (isNaN(min) || isNaN(max)) { alert('请输入有效的最小值和最大值'); return null; }
        return { type: 'between', min, max };
      }
      case 'textContains': {
        const text = getInputValue('text');
        if (!text) { alert('请输入文本'); return null; }
        return { type: 'textContains', text };
      }
      case 'textStartsWith': {
        const text = getInputValue('text');
        if (!text) { alert('请输入文本'); return null; }
        return { type: 'textStartsWith', text };
      }
      case 'textEndsWith': {
        const text = getInputValue('text');
        if (!text) { alert('请输入文本'); return null; }
        return { type: 'textEndsWith', text };
      }
      case 'dataBar': {
        const color = getInputValue('barColor') || '#4CAF50';
        return { type: 'dataBar', color };
      }
      case 'colorScale': {
        const minColor = getInputValue('minColor') || '#F44336';
        const maxColor = getInputValue('maxColor') || '#4CAF50';
        return { type: 'colorScale', minColor, maxColor };
      }
      case 'iconSet': {
        const iconType = (getInputValue('iconType') || 'arrows') as 'arrows' | 'circles' | 'flags';
        return { type: 'iconSet', iconType, thresholds: [33, 67] };
      }
      default:
        return null;
    }
  }

  // 从输入框构建样式对象
  private buildStyleFromInputs(
    conditionType: ConditionalFormatCondition['type'],
    styleContainer: HTMLDivElement
  ): ConditionalFormatStyle {
    const isVisualType = conditionType === 'dataBar' || conditionType === 'colorScale' || conditionType === 'iconSet';
    if (isVisualType) return {};

    const fontColorInput = styleContainer.querySelector('[data-field="fontColor"]') as HTMLInputElement | null;
    const bgColorInput = styleContainer.querySelector('[data-field="bgColor"]') as HTMLInputElement | null;

    const style: ConditionalFormatStyle = {};
    if (fontColorInput) style.fontColor = fontColorInput.value;
    if (bgColorInput) style.bgColor = bgColorInput.value;
    return style;
  }

  // 创建规则列表项
  private createRuleItem(rule: ConditionalFormatRule): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'cf-rule-item';

    // 规则描述
    const desc = document.createElement('div');
    desc.className = 'cf-rule-desc';

    const condLabel = SpreadsheetApp.CONDITION_TYPE_LABELS[rule.condition.type] || rule.condition.type;
    const rangeText = `${this.columnIndexToLetter(rule.range.startCol)}${rule.range.startRow + 1}:${this.columnIndexToLetter(rule.range.endCol)}${rule.range.endRow + 1}`;

    // 条件详情文本
    let detailText = condLabel;
    const { condition } = rule;
    if (condition.type === 'between') {
      detailText += ` ${condition.min} ~ ${condition.max}`;
    } else if (condition.type === 'greaterThan' || condition.type === 'lessThan') {
      detailText += ` ${condition.value}`;
    } else if (condition.type === 'equals') {
      detailText += ` ${condition.value}`;
    } else if (condition.type === 'textContains' || condition.type === 'textStartsWith' || condition.type === 'textEndsWith') {
      detailText += ` "${condition.text}"`;
    }

    desc.innerHTML = `<span class="cf-rule-range">${rangeText}</span> <span class="cf-rule-condition">${detailText}</span>`;

    // 样式预览
    const preview = document.createElement('span');
    preview.className = 'cf-rule-preview';
    preview.textContent = 'Aa';
    if (rule.style.fontColor) preview.style.color = rule.style.fontColor;
    if (rule.style.bgColor) preview.style.backgroundColor = rule.style.bgColor;
    if (rule.condition.type === 'dataBar') {
      preview.textContent = '▮';
      preview.style.color = rule.condition.color;
    } else if (rule.condition.type === 'colorScale') {
      preview.style.background = `linear-gradient(to right, ${rule.condition.minColor}, ${rule.condition.maxColor})`;
      preview.style.color = 'transparent';
    } else if (rule.condition.type === 'iconSet') {
      preview.textContent = '▲●▼';
      preview.style.fontSize = '10px';
    }

    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'cf-rule-delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.model.removeConditionalFormat(rule.id);
      this.renderer.render();
      this.renderConditionalFormatPanel();
    });

    item.appendChild(desc);
    item.appendChild(preview);
    item.appendChild(deleteBtn);
    return item;
  }

  // 垂直对齐显示文本映射
  private static readonly VERTICAL_ALIGN_LABELS: Record<string, string> = {
    top: '上对齐',
    middle: '居中',
    bottom: '下对齐',
  };

  // 水平对齐显示文本映射
  private static readonly HORIZONTAL_ALIGN_LABELS: Record<string, string> = {
    left: '左对齐',
    center: '居中',
    right: '右对齐',
  };

  // 初始化水平对齐选择器
  private initHorizontalAlignPicker(): void {
    const btn = document.getElementById('horizontal-align-btn');
    const dropdown = document.getElementById('horizontal-align-dropdown');
    if (!btn || !dropdown) return;

    // 点击选项
    dropdown.querySelectorAll('.horizontal-align-option').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const align = (el as HTMLElement).dataset.align as 'left' | 'center' | 'right';
        this.handleFontAlignChange(align);
        dropdown.classList.remove('visible');
      });
    });

    // 点击按钮切换下拉框
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('visible');
    });

    // 点击其他地方关闭下拉框
    document.addEventListener('click', () => {
      dropdown.classList.remove('visible');
    });
  }

  // 更新水平对齐按钮显示文本和下拉选项激活状态
  private updateHorizontalAlignUI(align: string): void {
    const textEl = document.getElementById('horizontal-align-text');
    if (textEl) {
      textEl.textContent = SpreadsheetApp.HORIZONTAL_ALIGN_LABELS[align] || '左对齐';
    }

    const dropdown = document.getElementById('horizontal-align-dropdown');
    if (dropdown) {
      dropdown.querySelectorAll('.horizontal-align-option').forEach((el) => {
        const optionEl = el as HTMLElement;
        optionEl.classList.toggle('active', optionEl.dataset.align === align);
      });
    }
  }

  // 初始化垂直对齐选择器
  private initVerticalAlignPicker(): void {
    const btn = document.getElementById('vertical-align-btn');
    const dropdown = document.getElementById('vertical-align-dropdown');
    if (!btn || !dropdown) return;

    // 点击选项
    dropdown.querySelectorAll('.vertical-align-option').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const align = (el as HTMLElement).dataset.align as 'top' | 'middle' | 'bottom';
        this.handleVerticalAlignChange(align);
        dropdown.classList.remove('visible');
      });
    });

    // 点击按钮切换下拉框
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('visible');
    });

    // 点击其他地方关闭下拉框
    document.addEventListener('click', () => {
      dropdown.classList.remove('visible');
    });
  }

  // 更新垂直对齐按钮显示文本和下拉选项激活状态
  private updateVerticalAlignUI(align: string): void {
    const textEl = document.getElementById('vertical-align-text');
    if (textEl) {
      textEl.textContent = SpreadsheetApp.VERTICAL_ALIGN_LABELS[align] || '居中';
    }

    const dropdown = document.getElementById('vertical-align-dropdown');
    if (dropdown) {
      dropdown.querySelectorAll('.vertical-align-option').forEach((el) => {
        const optionEl = el as HTMLElement;
        optionEl.classList.toggle('active', optionEl.dataset.align === align);
      });
    }
  }

  // 处理字体大小变更（应用到当前选中的单元格）
  private handleFontSizeChange(size: number): void {
    if (!this.currentSelection) {
      return;
    }

    // 更新按钮文本和下拉选项
    this.updateFontSizeUI(size);

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 设置选中区域的字体大小
    this.model.setRangeFontSize(startRow, startCol, endRow, endCol, size);

    // 协同模式下为每个单元格提交操作
    if (this.isCollaborationMode()) {
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'fontSize',
            row: r,
            col: c,
            size,
          });
        }
      }
    }

    // 重新渲染
    this.renderer.render();

    // 更新撤销/重做按钮状态
    this.updateUndoRedoButtons();
  }

  // 处理字体颜色变化
  private handleFontColorChange(): void {
    if (!this.currentSelection) {
      return;
    }

    const fontColorInput = document.getElementById('font-color') as HTMLInputElement;
    if (!fontColorInput) return;

    const color = fontColorInput.value;
    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 设置选中区域的字体颜色
    this.model.setRangeFontColor(startRow, startCol, endRow, endCol, color);

    // 协同模式下为每个单元格提交操作
    if (this.isCollaborationMode()) {
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'fontColor',
            row: r,
            col: c,
            color,
          });
        }
      }
    }

    // 重新渲染
    this.renderer.render();

    // 更新撤销/重做按钮状态
    this.updateUndoRedoButtons();
  }

  // 处理背景颜色变化
  private handleBgColorChange(): void {
    if (!this.currentSelection) {
      return;
    }

    const bgColorInput = document.getElementById('bg-color') as HTMLInputElement;
    if (!bgColorInput) return;

    const color = bgColorInput.value;
    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 设置选中区域的背景颜色
    this.model.setRangeBgColor(startRow, startCol, endRow, endCol, color);

    // 协同模式下为每个单元格提交操作
    if (this.isCollaborationMode()) {
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'bgColor',
            row: r,
            col: c,
            color,
          });
        }
      }
    }

    // 重新渲染
    this.renderer.render();

    // 更新撤销/重做按钮状态
    this.updateUndoRedoButtons();
  }

  // 处理字体加粗变化
  private handleFontBoldChange(): void {
    if (!this.currentSelection) {
      return;
    }

    const fontBoldBtn = document.getElementById('font-bold-btn') as HTMLButtonElement;
    if (!fontBoldBtn) return;

    // 切换加粗状态
    const isBold = !fontBoldBtn.classList.contains('active');
    fontBoldBtn.classList.toggle('active', isBold);

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 设置选中区域的字体加粗
    this.model.setRangeFontBold(startRow, startCol, endRow, endCol, isBold);

    // 协同模式下为每个单元格提交操作
    if (this.isCollaborationMode()) {
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'fontBold',
            row: r,
            col: c,
            bold: isBold,
          });
        }
      }
    }

    // 重新渲染
    this.renderer.render();

    // 更新撤销/重做按钮状态
    this.updateUndoRedoButtons();
  }

  // 处理字体斜体变化
  private handleFontItalicChange(): void {
    if (!this.currentSelection) {
      return;
    }

    const fontItalicBtn = document.getElementById('font-italic-btn') as HTMLButtonElement;
    if (!fontItalicBtn) return;

    // 切换斜体状态
    const isItalic = !fontItalicBtn.classList.contains('active');
    fontItalicBtn.classList.toggle('active', isItalic);

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 设置选中区域的字体斜体
    this.model.setRangeFontItalic(startRow, startCol, endRow, endCol, isItalic);

    // 协同模式下为每个单元格提交操作
    if (this.isCollaborationMode()) {
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'fontItalic',
            row: r,
            col: c,
            italic: isItalic,
          });
        }
      }
    }

    // 重新渲染
    this.renderer.render();

    // 更新撤销/重做按钮状态
    this.updateUndoRedoButtons();
  }

  // 处理字体下划线变化
  private handleFontUnderlineChange(): void {
    if (!this.currentSelection) {
      return;
    }

    const fontUnderlineBtn = document.getElementById('font-underline-btn') as HTMLButtonElement;
    if (!fontUnderlineBtn) return;

    // 切换下划线状态
    const isUnderline = !fontUnderlineBtn.classList.contains('active');
    fontUnderlineBtn.classList.toggle('active', isUnderline);

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 设置选中区域的字体下划线
    this.model.setRangeFontUnderline(startRow, startCol, endRow, endCol, isUnderline);

    // 协同模式下为每个单元格提交操作
    if (this.isCollaborationMode()) {
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'fontUnderline',
            row: r,
            col: c,
            underline: isUnderline,
          });
        }
      }
    }

    // 重新渲染
    this.renderer.render();

    // 更新撤销/重做按钮状态
    this.updateUndoRedoButtons();
  }

  // 处理字体对齐变化
  private handleFontAlignChange(align: 'left' | 'center' | 'right'): void {
    if (!this.currentSelection) {
      return;
    }

    // 更新所有对齐按钮状态
    const leftBtn = document.getElementById('font-align-left-btn');
    const centerBtn = document.getElementById('font-align-center-btn');
    const rightBtn = document.getElementById('font-align-right-btn');

    if (leftBtn) leftBtn.classList.toggle('active', align === 'left');
    if (centerBtn) centerBtn.classList.toggle('active', align === 'center');
    if (rightBtn) rightBtn.classList.toggle('active', align === 'right');

    // 更新水平对齐按钮显示文本
    this.updateHorizontalAlignUI(align);

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 设置选中区域的字体对齐
    this.model.setRangeFontAlign(startRow, startCol, endRow, endCol, align);

    // 协同模式下为每个单元格提交操作
    if (this.isCollaborationMode()) {
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'fontAlign',
            row: r,
            col: c,
            align,
          });
        }
      }
    }

    // 重新渲染
    this.renderer.render();

    // 更新撤销/重做按钮状态
    this.updateUndoRedoButtons();
  }

  // 处理垂直对齐变化
  private handleVerticalAlignChange(align: 'top' | 'middle' | 'bottom'): void {
    if (!this.currentSelection) {
      return;
    }

    // 更新按钮文本和下拉选项
    this.updateVerticalAlignUI(align);

    const { startRow, startCol, endRow, endCol } = this.currentSelection;

    // 设置选中区域的垂直对齐
    this.model.setRangeVerticalAlign(startRow, startCol, endRow, endCol, align);

    // 协同模式下为每个单元格提交操作
    if (this.isCollaborationMode()) {
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          this.submitCollabOperation({
            ...this.createBaseOp(),
            type: 'verticalAlign',
            row: r,
            col: c,
            align,
          });
        }
      }
    }

    // 重新渲染
    this.renderer.render();

    // 更新撤销/重做按钮状态
    this.updateUndoRedoButtons();
  }

  // 处理设置单元格内容
  private handleSetContent(): void {
    // 内联编辑器激活时不处理，避免用旧值覆盖编辑器保存的新值
    if (this.inlineEditor.isEditing()) return;
    if (this.currentSelection) {
      const { startRow, startCol } = this.currentSelection;

      // 获取输入框内容
      const contentInput = document.getElementById('cell-content') as HTMLInputElement;
      const content = contentInput.value;

      // 验证公式
      if (this.model.validateFormula) {
        const validation = this.model.validateFormula(content);
        if (!validation.valid) {
          this.showFormulaError(validation.error || '公式错误');
          return;
        }
      }

      // 获取旧内容
      const previousContent = this.model.getCell(startRow, startCol)?.content ?? '';

      // 设置单元格内容
      const result = this.model.setCellContent(startRow, startCol, content);

      // 验证失败时显示错误提示（需求 5.5）
      if (!result.success && result.validationResult && !result.validationResult.valid) {
        this.showValidationError(
          startRow,
          startCol,
          result.validationResult.errorTitle,
          result.validationResult.errorMessage
        );
        return;
      }
      // 警告模式下也显示错误提示
      if (result.validationResult && !result.validationResult.valid) {
        this.showValidationError(
          startRow,
          startCol,
          result.validationResult.errorTitle,
          result.validationResult.errorMessage
        );
      }

      // 协同模式下提交操作
      if (this.isCollaborationMode() && content !== previousContent) {
        this.submitCollabOperation({
          ...this.createBaseOp(),
          type: 'cellEdit',
          row: startRow,
          col: startCol,
          content,
          previousContent,
        });
      }

      // 重新渲染
      this.renderer.render();
      this.updateUndoRedoButtons();
    } else {
      alert('请先选择要设置内容的单元格');
    }
  }

  // 显示公式错误提示
  private showFormulaError(message: string): void {
    const errorElement = document.getElementById('formula-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';

      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 3000);
    } else {
      alert(message);
    }
  }

  // 更新状态栏信息
  private updateStatusBar(): void {
    // 更新单元格数量信息
    const cellCountElement = document.getElementById('cell-count');
    if (cellCountElement) {
      const rowCount = this.model.getRowCount();
      const colCount = this.model.getColCount();
      cellCountElement.textContent = `${rowCount.toLocaleString()} 行 × ${colCount} 列`;
    }

    // 更新视口信息
    this.updateViewportInfo();
  }

  // 更新视口信息
  private updateViewportInfo(): void {
    const viewportInfoElement = document.getElementById('viewport-info');
    if (viewportInfoElement && this.renderer) {
      const viewport = this.renderer.getViewport();
      const startCol = this.columnIndexToLetter(viewport.startCol);
      const endCol = this.columnIndexToLetter(viewport.endCol);
      viewportInfoElement.textContent = `视图: 行 ${viewport.startRow + 1}-${viewport.endRow + 1}, 列 ${startCol}-${endCol}`;
    }
  }

  // 更新选中单元格信息
  private updateSelectedCellInfo(): void {
    if (!this.currentSelection) return;

    const selectedCellElement = document.getElementById('selected-cell');
    const cellContentInput = document.getElementById('cell-content') as HTMLInputElement;

    if (selectedCellElement && cellContentInput) {
      const { startRow, startCol } = this.currentSelection;

      // 获取单元格信息（考虑合并单元格）
      const cellInfo = this.model.getMergedCellInfo(startRow, startCol);

      if (cellInfo) {
        // 更新单元格位置显示
        const colLetter = this.columnIndexToLetter(cellInfo.col);
        selectedCellElement.textContent = `${colLetter}${cellInfo.row + 1}`;

        // 更新单元格内容输入框 - 如果是公式则显示原始公式
        cellContentInput.value = cellInfo.formulaContent || cellInfo.content || '';

        // 更新字体大小按钮显示为当前单元格的字体大小
        this.updateFontSizeUI(cellInfo.fontSize || 12);

        // 更新字体加粗按钮状态
        const fontBoldBtn = document.getElementById('font-bold-btn');
        if (fontBoldBtn) {
          fontBoldBtn.classList.toggle('active', cellInfo.fontBold || false);
        }

        // 更新字体斜体按钮状态
        const fontItalicBtn = document.getElementById('font-italic-btn');
        if (fontItalicBtn) {
          fontItalicBtn.classList.toggle('active', cellInfo.fontItalic || false);
        }

        // 更新字体下划线按钮状态
        const fontUnderlineBtn = document.getElementById('font-underline-btn');
        if (fontUnderlineBtn) {
          fontUnderlineBtn.classList.toggle('active', cellInfo.fontUnderline || false);
        }

        // 更新字体对齐按钮状态
        const fontAlignLeftBtn = document.getElementById('font-align-left-btn');
        const fontAlignCenterBtn = document.getElementById('font-align-center-btn');
        const fontAlignRightBtn = document.getElementById('font-align-right-btn');
        const align = cellInfo.fontAlign || 'left';
        if (fontAlignLeftBtn) fontAlignLeftBtn.classList.toggle('active', align === 'left');
        if (fontAlignCenterBtn) fontAlignCenterBtn.classList.toggle('active', align === 'center');
        if (fontAlignRightBtn) fontAlignRightBtn.classList.toggle('active', align === 'right');

        // 更新水平对齐按钮显示文本
        this.updateHorizontalAlignUI(align);

        // 更新垂直对齐按钮状态
        this.updateVerticalAlignUI(cellInfo.verticalAlign || 'middle');

        // 更新数字格式下拉菜单状态
        const formatCategory = cellInfo.format?.category || 'general';
        this.updateNumberFormatUI(formatCategory);

        // 更新换行按钮状态
        this.updateWrapTextUI(cellInfo.wrapText || false);
      }
    }

    // 协同模式下广播光标位置
    if (this.isCollaborationMode() && this.currentSelection) {
      this.collaborationEngine!.sendCursor(this.currentSelection);
    }

    // 检查并显示输入提示 tooltip（需求 5.6）
    if (this.currentSelection) {
      const { startRow, startCol } = this.currentSelection;
      this.showInputHintIfNeeded(startRow, startCol);
    }

    // 更新"插入图表"按钮状态
    this.updateInsertChartButtonState();
  }

  // 将列索引转换为字母（A, B, C, ..., Z, AA, AB, ...）
  private columnIndexToLetter(index: number): string {
    let result = '';
    let temp = index + 1;

    while (temp > 0) {
      const remainder = (temp - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      temp = Math.floor((temp - 1) / 26);
    }

    return result;
  }

  // 导出数据到JSON文件
  public exportToFile(filename?: string): void {
    this.dataManager.exportToFile(filename);
  }

  // 导出简化数据到JSON文件
  public exportSimpleToFile(filename?: string): void {
    this.dataManager.exportSimpleToFile(filename);
  }

  // 从文件导入数据
  public async importFromFile(): Promise<boolean> {
    const result = await this.dataManager.importFromFile();
    if (result.success) {
      this.renderer.render();
    }
    return result.success;
  }

  // 从简化格式文件导入数据
  public async importFromSimpleFile(): Promise<boolean> {
    const result = await this.dataManager.importFromSimpleFile();
    if (result.success) {
      this.renderer.render();
    }
    return result.success;
  }

  // 从URL导入数据
  public async importFromURL(url: string): Promise<boolean> {
    const result = await this.dataManager.importFromURL(url);
    if (result.success) {
      this.renderer.render();
    }
    return result.success;
  }

  // 保存到本地存储
  public saveToLocalStorage(key?: string): boolean {
    return this.dataManager.saveToLocalStorage(key);
  }

  // 从本地存储加载
  public loadFromLocalStorage(key?: string): boolean {
    const success = this.dataManager.loadFromLocalStorage(key);
    if (success) {
      this.renderer.render();
    }
    return success;
  }

  // 获取数据预览
  public getDataPreview(maxRows?: number, maxCols?: number): any {
    return this.dataManager.getDataPreview(maxRows, maxCols);
  }

  // 获取表格统计信息
  public getStatistics(): any {
    return this.model.getStatistics();
  }

  // 清空所有数据
  public clearAllData(): void {
    this.model.clearAllContent();
    this.renderer.render();
  }

  // 调试方法：检查合并状态
  public debugMergeStatus(startRow: number, startCol: number, endRow: number, endCol: number): void {
    this.model.debugMergeStatus(startRow, startCol, endRow, endCol);
  }

  // 公共方法：获取模型
  public getModel(): SpreadsheetModel {
    return this.model;
  }

  // 公共方法：触发重新渲染
  public render(): void {
    this.renderer.render();
  }

  // 重置滚动位置并重新渲染
  public resetAndRender(): void {
    this.renderer.scrollTo(0, 0);
    this.renderer.updateViewport();
    this.renderer.render();
    this.updateScrollbars();
  }

  // 设置主题
  public setTheme(colors: Record<string, string>): void {
    this.renderer.setThemeColors(colors);

    // 根据背景色判断亮色/暗色主题，更新图表引擎配色
    const isDark = colors.background !== '#ffffff';
    const chartTheme: ThemeColors = {
      background: colors.background || '#ffffff',
      foreground: colors.foreground || '#333333',
      gridLine: colors.gridLine || '#e0e0e0',
      chartColors: isDark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT,
    };
    this.chartEngine.setThemeColors(chartTheme);

    this.renderer.render();
  }

  // ============================================================
  // 协同编辑集成
  // ============================================================

  /**
   * 设置协同引擎
   * 由 main.ts 在协同模式初始化时调用
   */
  public setCollaborationEngine(engine: CollaborationEngine | null): void {
    this.collaborationEngine = engine;
    if (engine) {
      this.renderer.setCursorAwareness(engine.getCursorAwareness());
      // 注入协同回调到 SheetManager，使 Sheet 级操作自动提交
      this.sheetManager.setCollabCallback((op: Record<string, unknown>) => {
        if (this.collaborationEngine && this.collaborationEngine.isInitialized()) {
          this.collaborationEngine.submitOperation({
            ...this.createBaseOp(),
            ...op,
          } as CollabOperation);
        }
      });
    } else {
      this.renderer.setCursorAwareness(null);
      this.sheetManager.setCollabCallback(null);
    }
  }

  /**
   * 获取协同引擎
   */
  public getCollaborationEngine(): CollaborationEngine | null {
    return this.collaborationEngine;
  }

  /**
   * 是否处于协同模式
   */
  public isCollaborationMode(): boolean {
    return this.collaborationEngine !== null && this.collaborationEngine.isInitialized();
  }

  /**
   * 获取渲染器（供外部使用）
   */
  public getRenderer(): SpreadsheetRenderer {
    return this.renderer;
  }

  /**
   * 提交协同操作（内部辅助方法）
   * 在协同模式下将操作提交到协同引擎
   */
  private submitCollabOperation(op: CollabOperation): void {
    if (this.collaborationEngine && this.collaborationEngine.isInitialized()) {
      this.collaborationEngine.submitOperation(op);
    }
  }

  /**
   * 创建基础操作对象（内部辅助方法）
   * 自动附加当前活动工作表的 sheetId
   */
  private createBaseOp(): { userId: string; timestamp: number; revision: number; sheetId: string } {
    return {
      userId: this.collaborationEngine?.getUserId() ?? '',
      timestamp: Date.now(),
      revision: 0,
      sheetId: this.sheetManager.getActiveSheet().id,
    };
  }

  // ============================================================
  // 多工作表切换
  // ============================================================

  /**
   * 处理工作表切换
   * 由 SheetManager.switchSheet 的 onSwitchCallback 触发
   */
  private handleSheetSwitch(sheetId: string): void {
    // 保存当前视口状态
    const viewport = this.renderer.getViewport();
    this.sheetManager.saveViewportState({
      scrollX: viewport.scrollX,
      scrollY: viewport.scrollY,
      selection: this.currentSelection,
      activeCell: this.currentSelection
        ? { row: this.currentSelection.startRow, col: this.currentSelection.startCol }
        : null,
    });

    // 更新 app 的 model 引用
    this.model = this.sheetManager.getActiveModel();

    // 切换渲染器数据源
    this.renderer.setModel(this.model);

    // 恢复目标工作表的视口状态
    const savedState = this.sheetManager.getViewportState(sheetId);
    if (savedState) {
      this.renderer.scrollTo(savedState.scrollX, savedState.scrollY);
      this.currentSelection = savedState.selection;
      if (savedState.selection) {
        this.renderer.setSelection(
          savedState.selection.startRow,
          savedState.selection.startCol,
          savedState.selection.endRow,
          savedState.selection.endCol
        );
      } else {
        this.renderer.clearSelection();
      }
    } else {
      this.renderer.scrollTo(0, 0);
      this.currentSelection = null;
      this.renderer.clearSelection();
    }

    // 更新数据管理器的 model 引用
    this.dataManager = new DataManager(this.model);
    this.dataManager.setSheetManager(this.sheetManager);

    // 刷新 UI
    this.renderer.render();
    this.updateScrollbars();
    this.updateSelectedCellInfo();
    this.updateUndoRedoButtons();
    this.updateStatusBar();
  }

  // ============================================================
  // 公共 getter 方法
  // ============================================================

  /** 获取 SheetManager */
  public getSheetManager(): SheetManager {
    return this.sheetManager;
  }

  /** 获取 SheetTabBar */
  public getSheetTabBar(): SheetTabBar {
    return this.sheetTabBar;
  }

  /** 获取 SheetContextMenu */
  public getSheetContextMenu(): SheetContextMenu {
    return this.sheetContextMenu;
  }
}
