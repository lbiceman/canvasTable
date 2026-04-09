// ============================================================
// 多级排序对话框
// 支持添加多个排序条件，按优先级排序
// ============================================================

import type { SortRule, SortDirection } from './types';

/** 排序对话框回调 */
export interface SortDialogCallbacks {
  onApply: (rules: SortRule[]) => void;
  getColCount: () => number;
  getColLabel: (col: number) => string;
}

/**
 * 多级排序对话框
 * 支持添加/删除/调整排序条件，每个条件可选列和排序方向
 */
export class SortDialog {
  private overlay: HTMLDivElement | null = null;
  private rules: SortRule[] = [];
  private callbacks: SortDialogCallbacks;

  constructor(callbacks: SortDialogCallbacks) {
    this.callbacks = callbacks;
  }

  /** 显示对话框 */
  show(initialRules?: SortRule[]): void {
    this.rules = initialRules ? [...initialRules] : [{ colIndex: 0, direction: 'asc', dataType: 'auto' }];
    this.render();
  }

  /** 隐藏对话框 */
  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  /** 渲染对话框 */
  private render(): void {
    this.hide();

    this.overlay = document.createElement('div');
    this.overlay.className = 'sort-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'sort-dialog';

    // 标题
    const title = document.createElement('div');
    title.className = 'sort-dialog-title';
    title.textContent = '排序';
    dialog.appendChild(title);

    // 规则列表容器
    const rulesContainer = document.createElement('div');
    rulesContainer.className = 'sort-dialog-rules';

    this.rules.forEach((rule, index) => {
      const ruleRow = this.createRuleRow(rule, index);
      rulesContainer.appendChild(ruleRow);
    });
    dialog.appendChild(rulesContainer);

    // 添加条件按钮
    const addBtn = document.createElement('button');
    addBtn.className = 'sort-dialog-add-btn';
    addBtn.textContent = '+ 添加排序条件';
    addBtn.addEventListener('click', () => {
      this.rules.push({ colIndex: 0, direction: 'asc', dataType: 'auto' });
      this.render();
    });
    dialog.appendChild(addBtn);

    // 按钮栏
    const btnBar = document.createElement('div');
    btnBar.className = 'sort-dialog-btn-bar';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'sort-dialog-cancel-btn';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => this.hide());

    const applyBtn = document.createElement('button');
    applyBtn.className = 'sort-dialog-apply-btn';
    applyBtn.textContent = '确定';
    applyBtn.addEventListener('click', () => {
      this.callbacks.onApply(this.rules);
      this.hide();
    });

    btnBar.appendChild(cancelBtn);
    btnBar.appendChild(applyBtn);
    dialog.appendChild(btnBar);

    this.overlay.appendChild(dialog);
    document.body.appendChild(this.overlay);

    // 点击遮罩关闭
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  /** 创建单个排序规则行 */
  private createRuleRow(rule: SortRule, index: number): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'sort-dialog-rule-row';

    // 标签
    const label = document.createElement('span');
    label.className = 'sort-dialog-rule-label';
    label.textContent = index === 0 ? '排序依据' : '次要依据';
    row.appendChild(label);

    // 列选择
    const colSelect = document.createElement('select');
    colSelect.className = 'sort-dialog-select';
    const colCount = this.callbacks.getColCount();
    for (let c = 0; c < Math.min(colCount, 100); c++) {
      const opt = document.createElement('option');
      opt.value = String(c);
      opt.textContent = this.callbacks.getColLabel(c);
      if (c === rule.colIndex) opt.selected = true;
      colSelect.appendChild(opt);
    }
    colSelect.addEventListener('change', () => {
      this.rules[index].colIndex = parseInt(colSelect.value, 10);
    });
    row.appendChild(colSelect);

    // 方向选择
    const dirSelect = document.createElement('select');
    dirSelect.className = 'sort-dialog-select';
    const ascOpt = document.createElement('option');
    ascOpt.value = 'asc';
    ascOpt.textContent = '升序 (A→Z)';
    if (rule.direction === 'asc') ascOpt.selected = true;
    const descOpt = document.createElement('option');
    descOpt.value = 'desc';
    descOpt.textContent = '降序 (Z→A)';
    if (rule.direction === 'desc') descOpt.selected = true;
    dirSelect.appendChild(ascOpt);
    dirSelect.appendChild(descOpt);
    dirSelect.addEventListener('change', () => {
      this.rules[index].direction = dirSelect.value as SortDirection;
    });
    row.appendChild(dirSelect);

    // 删除按钮（至少保留一个规则）
    if (this.rules.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.className = 'sort-dialog-del-btn';
      delBtn.textContent = '×';
      delBtn.title = '删除此条件';
      delBtn.addEventListener('click', () => {
        this.rules.splice(index, 1);
        this.render();
      });
      row.appendChild(delBtn);
    }

    return row;
  }
}
