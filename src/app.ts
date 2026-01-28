import { SpreadsheetModel } from './model';
import { SpreadsheetRenderer } from './renderer';
import { RenderConfig, CellPosition, Selection } from './types';
import { InlineEditor } from './inline-editor';
import { DataManager } from './data-manager';
import { SearchDialog, SearchResult } from './search-dialog';

export class SpreadsheetApp {
  private model: SpreadsheetModel;
  private renderer: SpreadsheetRenderer;
  private canvas: HTMLCanvasElement;
  private currentSelection: Selection | null = null;
  private selectionStart: CellPosition | null = null;
  private inlineEditor: InlineEditor;
  private dataManager: DataManager;
  private searchDialog: SearchDialog;
  
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

  // 右键菜单
  private contextMenu: HTMLDivElement | null = null;
  private contextMenuRow: number | null = null;
  
  constructor(_containerId: string) {
    // 创建模型
    this.model = new SpreadsheetModel();
    
    // 获取Canvas元素
    this.canvas = document.getElementById('excel-canvas') as HTMLCanvasElement;
    
    // 创建内联编辑器
    this.inlineEditor = new InlineEditor();
    
    // 创建数据管理器
    this.dataManager = new DataManager(this.model);
    
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
    
    // 创建滚动条
    this.createScrollbars();
    
    // 创建右键菜单
    this.createContextMenu();
    
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

  // 插入行
  private insertRows(count: number): void {
    const rowToInsert = this.contextMenuRow;
    this.hideContextMenu();
    
    if (rowToInsert !== null && count > 0) {
      const success = this.model.insertRows(rowToInsert + 1, count);
      if (success) {
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
      event.preventDefault();
      this.handleDeleteKey();
      return;
    }
    
    // Escape 取消选择
    if (event.key === 'Escape') {
      this.currentSelection = null;
      this.renderer.clearSelection();
      this.renderer.clearHighlight();
      this.renderer.render();
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
    
    // 获取单元格信息
    const cellInfo = this.model.getMergedCellInfo(startRow, startCol);
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
        this.model.setCellContent(cellInfo.row, cellInfo.col, value);
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
    
    // 清除选中区域的内容
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        this.model.setCellContent(row, col, '');
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
    if (this.model.undo()) {
      this.renderer.render();
      this.updateSelectedCellInfo();
      this.updateUndoRedoButtons();
    }
  }

  // 处理重做
  private handleRedo(): void {
    if (this.model.redo()) {
      this.renderer.render();
      this.updateSelectedCellInfo();
      this.updateUndoRedoButtons();
    }
  }

  // 更新撤销/重做按钮状态
  private updateUndoRedoButtons(): void {
    const undoButton = document.getElementById('undo-btn') as HTMLButtonElement;
    const redoButton = document.getElementById('redo-btn') as HTMLButtonElement;
    
    if (undoButton) {
      undoButton.disabled = !this.model.canUndo();
    }
    if (redoButton) {
      redoButton.disabled = !this.model.canRedo();
    }
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
      this.showContextMenu(event.clientX, event.clientY, clickedRow);
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
    
    // 检查是否在表格区域内
    const cellPosition = this.renderer.getCellAtPosition(x, y);
    
    if (cellPosition) {
      // 获取单元格信息（考虑合并单元格）
      const cellInfo = this.model.getMergedCellInfo(cellPosition.row, cellPosition.col);
      
      if (cellInfo) {
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
              // 设置单元格内容
              this.model.setCellContent(cellInfo.row, cellInfo.col, value);
              
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
    this.selectionStart = null;
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
            // 重新渲染
            this.renderer.render();
            
            // 更新单元格信息显示
            this.updateSelectedCellInfo();
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
    } else {
      alert('选择区域中没有可拆分的合并单元格');
    }
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
    
    // 重新渲染
    this.renderer.render();
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
    
    // 重新渲染
    this.renderer.render();
  }

  // 处理设置单元格内容
  private handleSetContent(): void {
    if (this.currentSelection) {
      const { startRow, startCol } = this.currentSelection;
      
      // 获取输入框内容
      const contentInput = document.getElementById('cell-content') as HTMLInputElement;
      const content = contentInput.value;
      
      // 设置单元格内容
      this.model.setCellContent(startRow, startCol, content);
      
      // 重新渲染
      this.renderer.render();
    } else {
      alert('请先选择要设置内容的单元格');
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
        
        // 更新单元格内容输入框
        cellContentInput.value = cellInfo.content || '';
      }
    }
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
    const success = await this.dataManager.importFromFile();
    if (success) {
      this.renderer.render();
    }
    return success;
  }

  // 从简化格式文件导入数据
  public async importFromSimpleFile(): Promise<boolean> {
    const success = await this.dataManager.importFromSimpleFile();
    if (success) {
      this.renderer.render();
    }
    return success;
  }

  // 从URL导入数据
  public async importFromURL(url: string): Promise<boolean> {
    const success = await this.dataManager.importFromURL(url);
    if (success) {
      this.renderer.render();
    }
    return success;
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
  public setTheme(colors: any): void {
    this.renderer.setThemeColors(colors);
    this.renderer.render();
  }
}