export interface SearchResult {
  row: number;
  col: number;
  content: string;
  /** 跨工作表搜索时的工作表名称 */
  sheetName?: string;
}

/** 搜索选项 */
export interface SearchOptions {
  /** 是否使用正则表达式 */
  useRegex: boolean;
  /** 是否大小写敏感 */
  caseSensitive: boolean;
  /** 是否全字匹配 */
  wholeWord: boolean;
  /** 搜索范围：当前工作表 / 所有工作表 */
  scope: 'currentSheet' | 'allSheets';
}

export class SearchDialog {
  private dialog: HTMLDivElement;
  private input: HTMLInputElement;
  private resultsInfo: HTMLSpanElement;
  private replaceInput: HTMLInputElement;
  private replaceBtn: HTMLButtonElement;
  private replaceAllBtn: HTMLButtonElement;
  private replaceRow: HTMLDivElement;
  private mode: 'find' | 'findReplace' = 'find';
  private results: SearchResult[] = [];
  private currentIndex: number = -1;

  // 搜索选项状态
  private options: SearchOptions = {
    useRegex: false,
    caseSensitive: false,
    wholeWord: false,
    scope: 'currentSheet',
  };

  // 选项按钮引用
  private regexBtn!: HTMLButtonElement;
  private caseBtn!: HTMLButtonElement;
  private wordBtn!: HTMLButtonElement;
  private scopeSelect!: HTMLSelectElement;

  // 回调
  private onSearch: ((keyword: string, options: SearchOptions) => SearchResult[]) | null = null;
  private onNavigate: ((result: SearchResult) => void) | null = null;
  private onClose: (() => void) | null = null;
  private onNoResults: (() => void) | null = null;
  private onReplace: ((searchText: string, replaceText: string, options: SearchOptions) => boolean) | null = null;
  private onReplaceAll: ((searchText: string, replaceText: string, options: SearchOptions) => number) | null = null;

  constructor() {
    this.dialog = this.createDialog();
    this.input = this.dialog.querySelector('.search-input') as HTMLInputElement;
    this.resultsInfo = this.dialog.querySelector('.search-results-info') as HTMLSpanElement;
    this.replaceInput = this.dialog.querySelector('.replace-input') as HTMLInputElement;
    this.replaceBtn = this.dialog.querySelector('.replace-btn') as HTMLButtonElement;
    this.replaceAllBtn = this.dialog.querySelector('.replace-all-btn') as HTMLButtonElement;
    this.replaceRow = this.dialog.querySelector('.search-replace-row') as HTMLDivElement;
    this.regexBtn = this.dialog.querySelector('.search-option-regex') as HTMLButtonElement;
    this.caseBtn = this.dialog.querySelector('.search-option-case') as HTMLButtonElement;
    this.wordBtn = this.dialog.querySelector('.search-option-word') as HTMLButtonElement;
    this.scopeSelect = this.dialog.querySelector('.search-scope-select') as HTMLSelectElement;
    document.body.appendChild(this.dialog);
    this.bindEvents();
  }

  private createDialog(): HTMLDivElement {
    const dialog = document.createElement('div');
    dialog.className = 'search-dialog';
    dialog.style.display = 'none';
    dialog.innerHTML = `
      <div class="search-dialog-content">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path>
          </svg>
          <input type="text" class="search-input" placeholder="查找内容..." />
        </div>
        <div class="search-options-row">
          <button class="search-option-btn search-option-regex" title="正则表达式 (Alt+R)">.*</button>
          <button class="search-option-btn search-option-case" title="大小写敏感 (Alt+C)">Aa</button>
          <button class="search-option-btn search-option-word" title="全字匹配 (Alt+W)">\\b</button>
          <select class="search-scope-select" title="搜索范围">
            <option value="currentSheet">当前工作表</option>
            <option value="allSheets">所有工作表</option>
          </select>
        </div>
        <span class="search-results-info"></span>
        <button class="search-btn search-prev" title="上一个 (Shift+Enter)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="search-btn search-next" title="下一个 (Enter)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="search-btn search-close" title="关闭 (Escape)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="search-replace-row" style="display: none;">
        <div class="replace-input-wrapper">
          <input type="text" class="replace-input" placeholder="替换为..." />
        </div>
        <button class="search-btn replace-btn" title="替换">替换</button>
        <button class="search-btn replace-all-btn" title="全部替换">全部替换</button>
      </div>
    `;
    return dialog;
  }

  private bindEvents(): void {
    // 输入搜索
    this.input.addEventListener('input', () => {
      this.search();
    });

    // 查找输入框键盘事件
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.prev();
        } else {
          this.next();
        }
      } else if (e.key === 'Escape') {
        this.hide();
      }
    });

    // 替换输入框键盘事件
    this.replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    });

    // 按钮事件
    const prevBtn = this.dialog.querySelector('.search-prev');
    const nextBtn = this.dialog.querySelector('.search-next');
    const closeBtn = this.dialog.querySelector('.search-close');

    prevBtn?.addEventListener('click', () => this.prev());
    nextBtn?.addEventListener('click', () => this.next());
    closeBtn?.addEventListener('click', () => this.hide());

    // 替换按钮事件
    this.replaceBtn.addEventListener('click', () => this.handleReplace());
    this.replaceAllBtn.addEventListener('click', () => this.handleReplaceAll());

    // 搜索选项按钮事件
    this.regexBtn.addEventListener('click', () => {
      this.options.useRegex = !this.options.useRegex;
      this.updateOptionButtons();
      this.search();
    });

    this.caseBtn.addEventListener('click', () => {
      this.options.caseSensitive = !this.options.caseSensitive;
      this.updateOptionButtons();
      this.search();
    });

    this.wordBtn.addEventListener('click', () => {
      this.options.wholeWord = !this.options.wholeWord;
      this.updateOptionButtons();
      this.search();
    });

    this.scopeSelect.addEventListener('change', () => {
      this.options.scope = this.scopeSelect.value as 'currentSheet' | 'allSheets';
      this.search();
    });

    // Alt 快捷键切换选项
    this.dialog.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        this.regexBtn.click();
      } else if (e.altKey && e.key === 'c') {
        e.preventDefault();
        this.caseBtn.click();
      } else if (e.altKey && e.key === 'w') {
        e.preventDefault();
        this.wordBtn.click();
      }
    });
  }

  /** 更新选项按钮的激活状态 */
  private updateOptionButtons(): void {
    this.regexBtn.classList.toggle('active', this.options.useRegex);
    this.caseBtn.classList.toggle('active', this.options.caseSensitive);
    this.wordBtn.classList.toggle('active', this.options.wholeWord);
  }

  /** 获取当前搜索选项 */
  public getOptions(): SearchOptions {
    return { ...this.options };
  }

  /** 显示对话框，支持查找模式和查找替换模式 */
  public show(mode?: 'find' | 'findReplace'): void {
    this.mode = mode ?? 'find';
    this.dialog.style.display = 'block';

    // 根据模式显示/隐藏替换行
    this.replaceRow.style.display = this.mode === 'findReplace' ? 'flex' : 'none';

    this.input.focus();
    this.input.select();
  }

  public hide(): void {
    this.dialog.style.display = 'none';
    this.results = [];
    this.currentIndex = -1;
    this.resultsInfo.textContent = '';
    this.onClose?.();
  }

  public isVisible(): boolean {
    return this.dialog.style.display !== 'none';
  }

  public setSearchHandler(handler: (keyword: string, options: SearchOptions) => SearchResult[]): void {
    this.onSearch = handler;
  }

  public setNavigateHandler(handler: (result: SearchResult) => void): void {
    this.onNavigate = handler;
  }

  public setCloseHandler(handler: () => void): void {
    this.onClose = handler;
  }

  public setNoResultsHandler(handler: () => void): void {
    this.onNoResults = handler;
  }

  /** 设置替换回调 */
  public setReplaceHandler(handler: (search: string, replace: string, options: SearchOptions) => boolean): void {
    this.onReplace = handler;
  }

  /** 设置全部替换回调 */
  public setReplaceAllHandler(handler: (search: string, replace: string, options: SearchOptions) => number): void {
    this.onReplaceAll = handler;
  }

  /** 执行替换当前匹配 */
  private handleReplace(): void {
    const searchText = this.input.value.trim();
    const replaceText = this.replaceInput.value;
    if (!searchText || this.currentIndex < 0) return;

    if (this.onReplace) {
      const replaced = this.onReplace(searchText, replaceText, this.options);
      if (replaced) {
        // 替换成功后重新搜索以更新结果
        this.search();
      }
    }
  }

  /** 执行全部替换 */
  private handleReplaceAll(): void {
    const searchText = this.input.value.trim();
    const replaceText = this.replaceInput.value;
    if (!searchText) return;

    if (this.onReplaceAll) {
      const count = this.onReplaceAll(searchText, replaceText, this.options);
      // 全部替换后重新搜索以更新结果
      this.search();
      // 显示替换计数
      if (count > 0) {
        this.resultsInfo.textContent = `已替换 ${count} 项`;
      }
    }
  }

  private search(): void {
    const keyword = this.input.value.trim();
    if (!keyword) {
      this.results = [];
      this.currentIndex = -1;
      this.resultsInfo.textContent = '';
      this.onNoResults?.();
      return;
    }

    // 正则模式下验证正则表达式是否合法
    if (this.options.useRegex) {
      try {
        new RegExp(keyword);
      } catch {
        this.resultsInfo.textContent = '正则表达式无效';
        this.results = [];
        this.currentIndex = -1;
        return;
      }
    }

    if (this.onSearch) {
      this.results = this.onSearch(keyword, this.options);
      this.currentIndex = this.results.length > 0 ? 0 : -1;
      this.updateResultsInfo();

      if (this.currentIndex >= 0) {
        this.navigateToCurrent();
      } else {
        this.onNoResults?.();
      }
    }
  }

  private next(): void {
    if (this.results.length === 0) return;

    this.currentIndex = (this.currentIndex + 1) % this.results.length;
    this.updateResultsInfo();
    this.navigateToCurrent();
  }

  private prev(): void {
    if (this.results.length === 0) return;

    this.currentIndex = (this.currentIndex - 1 + this.results.length) % this.results.length;
    this.updateResultsInfo();
    this.navigateToCurrent();
  }

  private updateResultsInfo(): void {
    if (this.results.length === 0) {
      this.resultsInfo.textContent = '无结果';
    } else {
      this.resultsInfo.textContent = `${this.currentIndex + 1}/${this.results.length}`;
    }
  }

  private navigateToCurrent(): void {
    if (this.currentIndex >= 0 && this.onNavigate) {
      this.onNavigate(this.results[this.currentIndex]);
    }
  }
}
