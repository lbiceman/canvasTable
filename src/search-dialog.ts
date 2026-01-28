export interface SearchResult {
  row: number;
  col: number;
  content: string;
}

export class SearchDialog {
  private dialog: HTMLDivElement;
  private input: HTMLInputElement;
  private resultsInfo: HTMLSpanElement;
  private results: SearchResult[] = [];
  private currentIndex: number = -1;
  private onSearch: ((keyword: string) => SearchResult[]) | null = null;
  private onNavigate: ((result: SearchResult) => void) | null = null;
  private onClose: (() => void) | null = null;
  private onNoResults: (() => void) | null = null;

  constructor() {
    this.dialog = this.createDialog();
    this.input = this.dialog.querySelector('.search-input') as HTMLInputElement;
    this.resultsInfo = this.dialog.querySelector('.search-results-info') as HTMLSpanElement;
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
    `;
    return dialog;
  }

  private bindEvents(): void {
    // 输入搜索
    this.input.addEventListener('input', () => {
      this.search();
    });

    // 键盘事件
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

    // 按钮事件
    const prevBtn = this.dialog.querySelector('.search-prev');
    const nextBtn = this.dialog.querySelector('.search-next');
    const closeBtn = this.dialog.querySelector('.search-close');

    prevBtn?.addEventListener('click', () => this.prev());
    nextBtn?.addEventListener('click', () => this.next());
    closeBtn?.addEventListener('click', () => this.hide());
  }

  public show(): void {
    this.dialog.style.display = 'block';
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

  public setSearchHandler(handler: (keyword: string) => SearchResult[]): void {
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

  private search(): void {
    const keyword = this.input.value.trim();
    if (!keyword) {
      this.results = [];
      this.currentIndex = -1;
      this.resultsInfo.textContent = '';
      this.onNoResults?.();
      return;
    }

    if (this.onSearch) {
      this.results = this.onSearch(keyword);
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
