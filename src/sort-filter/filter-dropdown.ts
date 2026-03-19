// ============================================================
// 筛选下拉菜单 - 使用原生 DOM 构建筛选面板
// ============================================================

import type { SortFilterModel } from './sort-filter-model';
import type { ColumnFilter, SortDirection, FilterCriterion } from './types';
import { FilterEngine } from './filter-engine';

// 回调类型定义
interface FilterDropdownCallbacks {
  onApply: (colIndex: number, filter: ColumnFilter) => void;
  onSort: (colIndex: number, direction: SortDirection) => void;
  onClear: (colIndex: number) => void;
}

export class FilterDropdown {
  private container: HTMLDivElement | null = null;
  private model: SortFilterModel;
  private callbacks: FilterDropdownCallbacks;
  private currentColIndex: number = -1;
  private visible: boolean = false;
  // 点击外部关闭的事件处理器
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(model: SortFilterModel, callbacks: FilterDropdownCallbacks) {
    this.model = model;
    this.callbacks = callbacks;
  }

  /** 在指定位置显示筛选下拉菜单 */
  show(x: number, y: number, colIndex: number): void {
    // 先关闭已有菜单
    this.hide();

    this.currentColIndex = colIndex;
    this.visible = true;

    // 获取唯一值列表
    const uniqueValues = this.model.getUniqueValues(colIndex);
    const currentFilter = this.model.getColumnFilter(colIndex);

    // 推断数据类型
    const filterType = FilterEngine.inferFilterType(uniqueValues);

    // 创建容器
    this.container = document.createElement('div');
    this.container.className = 'filter-dropdown';
    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;

    // 构建内容
    this.buildContent(uniqueValues, currentFilter, filterType);

    document.body.appendChild(this.container);

    // 确保菜单不超出视口
    this.adjustPosition();

    // 延迟绑定点击外部关闭事件（避免当前点击触发关闭）
    setTimeout(() => {
      this.outsideClickHandler = (e: MouseEvent) => {
        if (this.container && !this.container.contains(e.target as Node)) {
          this.hide();
        }
      };
      document.addEventListener('mousedown', this.outsideClickHandler);
    }, 0);
  }

  /** 关闭菜单 */
  hide(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.visible = false;
    this.currentColIndex = -1;

    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
  }

  /** 是否可见 */
  isVisible(): boolean {
    return this.visible;
  }

  /** 销毁 */
  destroy(): void {
    this.hide();
  }

  /** 构建下拉菜单内容 */
  private buildContent(
    uniqueValues: string[],
    currentFilter: ColumnFilter | undefined,
    filterType: 'text' | 'number' | 'date'
  ): void {
    if (!this.container) return;

    // === 排序区域 ===
    const sortSection = document.createElement('div');
    sortSection.className = 'filter-dropdown-sort';

    const ascBtn = document.createElement('button');
    ascBtn.className = 'filter-dropdown-sort-btn';
    ascBtn.textContent = '↑ 升序排序';
    ascBtn.addEventListener('click', () => {
      this.callbacks.onSort(this.currentColIndex, 'asc');
      this.hide();
    });

    const descBtn = document.createElement('button');
    descBtn.className = 'filter-dropdown-sort-btn';
    descBtn.textContent = '↓ 降序排序';
    descBtn.addEventListener('click', () => {
      this.callbacks.onSort(this.currentColIndex, 'desc');
      this.hide();
    });

    sortSection.appendChild(ascBtn);
    sortSection.appendChild(descBtn);
    this.container.appendChild(sortSection);

    // 分隔线
    this.container.appendChild(this.createDivider());

    // === 搜索框 ===
    const searchInput = document.createElement('input');
    searchInput.className = 'filter-dropdown-search';
    searchInput.type = 'text';
    searchInput.placeholder = '搜索...';
    this.container.appendChild(searchInput);

    // === 值筛选区域 ===
    const valuesSection = document.createElement('div');
    valuesSection.className = 'filter-dropdown-values';

    // 全选/清除按钮
    const actionRow = document.createElement('div');
    actionRow.className = 'filter-dropdown-value-actions';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = '全选';
    selectAllBtn.addEventListener('click', () => {
      const checkboxes = valuesSection.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      checkboxes.forEach((cb) => { cb.checked = true; });
    });

    const clearAllBtn = document.createElement('button');
    clearAllBtn.textContent = '清除';
    clearAllBtn.addEventListener('click', () => {
      const checkboxes = valuesSection.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      checkboxes.forEach((cb) => { cb.checked = false; });
    });

    actionRow.appendChild(selectAllBtn);
    actionRow.appendChild(clearAllBtn);
    valuesSection.appendChild(actionRow);

    // 复选框列表
    const checkboxList = document.createElement('div');
    checkboxList.className = 'filter-dropdown-checkbox-list';

    // 当前选中的值集合
    const selectedSet = currentFilter?.selectedValues;

    for (const value of uniqueValues) {
      const label = document.createElement('label');
      label.className = 'filter-dropdown-value-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = value;
      // 默认全选，除非有 selectedValues 且该值不在其中
      checkbox.checked = selectedSet ? selectedSet.has(value) : true;

      const span = document.createElement('span');
      span.textContent = value || '(空)';

      label.appendChild(checkbox);
      label.appendChild(span);
      checkboxList.appendChild(label);
    }

    valuesSection.appendChild(checkboxList);
    this.container.appendChild(valuesSection);

    // 搜索框过滤逻辑
    searchInput.addEventListener('input', () => {
      const keyword = searchInput.value.toLowerCase();
      const items = checkboxList.querySelectorAll<HTMLLabelElement>('.filter-dropdown-value-item');
      items.forEach((item) => {
        const text = item.textContent?.toLowerCase() ?? '';
        item.style.display = text.includes(keyword) ? '' : 'none';
      });
    });

    // 分隔线
    this.container.appendChild(this.createDivider());

    // === 条件筛选区域 ===
    this.buildConditionSection(filterType, currentFilter);

    // 分隔线
    this.container.appendChild(this.createDivider());

    // === 确定/取消按钮 ===
    const buttonsRow = document.createElement('div');
    buttonsRow.className = 'filter-dropdown-actions';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'filter-dropdown-apply-btn';
    applyBtn.textContent = '确定';
    applyBtn.addEventListener('click', () => {
      this.applyFilter(checkboxList);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'filter-dropdown-cancel-btn';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => {
      this.hide();
    });

    const clearFilterBtn = document.createElement('button');
    clearFilterBtn.className = 'filter-dropdown-cancel-btn';
    clearFilterBtn.textContent = '清除筛选';
    clearFilterBtn.addEventListener('click', () => {
      this.callbacks.onClear(this.currentColIndex);
      this.hide();
    });

    buttonsRow.appendChild(clearFilterBtn);
    buttonsRow.appendChild(cancelBtn);
    buttonsRow.appendChild(applyBtn);
    this.container.appendChild(buttonsRow);
  }

  /** 构建条件筛选区域 */
  private buildConditionSection(
    filterType: 'text' | 'number' | 'date',
    currentFilter: ColumnFilter | undefined
  ): void {
    if (!this.container) return;

    const section = document.createElement('div');
    section.className = 'filter-dropdown-condition';

    const title = document.createElement('div');
    title.className = 'filter-dropdown-condition-title';
    title.textContent = '条件筛选';
    section.appendChild(title);

    // 操作符选择
    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'filter-dropdown-operator';

    const operators = this.getOperators(filterType);
    for (const op of operators) {
      const option = document.createElement('option');
      option.value = op.value;
      option.textContent = op.label;
      operatorSelect.appendChild(option);
    }
    section.appendChild(operatorSelect);

    // 值输入框
    const valueInput = document.createElement('input');
    valueInput.className = 'filter-dropdown-value-input';
    valueInput.type = filterType === 'number' ? 'number' : 'text';
    valueInput.placeholder = '输入值...';
    section.appendChild(valueInput);

    // 第二个值输入框（用于 between）
    const value2Input = document.createElement('input');
    value2Input.className = 'filter-dropdown-value-input filter-dropdown-value2';
    value2Input.type = filterType === 'number' ? 'number' : 'text';
    value2Input.placeholder = '输入第二个值...';
    value2Input.style.display = 'none';
    section.appendChild(value2Input);

    // 显示/隐藏第二个值输入框
    operatorSelect.addEventListener('change', () => {
      value2Input.style.display = operatorSelect.value === 'between' ? '' : 'none';
    });

    // 回填已有条件
    if (currentFilter?.criteria && currentFilter.criteria.length > 0) {
      const firstCriterion = currentFilter.criteria[0];
      operatorSelect.value = firstCriterion.operator;
      if (firstCriterion.type === 'text') {
        valueInput.value = firstCriterion.value;
      } else {
        valueInput.value = String(firstCriterion.value);
        if ('value2' in firstCriterion && firstCriterion.value2 !== undefined) {
          value2Input.value = String(firstCriterion.value2);
          value2Input.style.display = '';
        }
      }
    }

    // 存储引用以便 applyFilter 使用
    section.dataset.filterType = filterType;

    this.container.appendChild(section);
  }

  /** 获取操作符列表 */
  private getOperators(filterType: 'text' | 'number' | 'date'): Array<{ value: string; label: string }> {
    switch (filterType) {
      case 'text':
        return [
          { value: 'contains', label: '包含' },
          { value: 'notContains', label: '不包含' },
          { value: 'equals', label: '等于' },
          { value: 'startsWith', label: '开头是' },
          { value: 'endsWith', label: '结尾是' },
        ];
      case 'number':
        return [
          { value: 'equals', label: '等于' },
          { value: 'notEquals', label: '不等于' },
          { value: 'greaterThan', label: '大于' },
          { value: 'greaterOrEqual', label: '大于等于' },
          { value: 'lessThan', label: '小于' },
          { value: 'lessOrEqual', label: '小于等于' },
          { value: 'between', label: '介于' },
        ];
      case 'date':
        return [
          { value: 'equals', label: '等于' },
          { value: 'before', label: '在此之前' },
          { value: 'after', label: '在此之后' },
          { value: 'between', label: '介于' },
        ];
    }
  }

  /** 应用筛选 */
  private applyFilter(checkboxList: HTMLDivElement): void {
    const filter: ColumnFilter = {};

    // 收集选中的值
    const checkboxes = checkboxList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);

    if (!allChecked) {
      const selectedValues = new Set<string>();
      checkboxes.forEach((cb) => {
        if (cb.checked) {
          selectedValues.add(cb.value);
        }
      });
      filter.selectedValues = selectedValues;
    }

    // 收集条件筛选
    if (this.container) {
      const condSection = this.container.querySelector<HTMLDivElement>('.filter-dropdown-condition');
      if (condSection) {
        const operatorSelect = condSection.querySelector<HTMLSelectElement>('.filter-dropdown-operator');
        const valueInput = condSection.querySelector<HTMLInputElement>('.filter-dropdown-value-input:not(.filter-dropdown-value2)');
        const value2Input = condSection.querySelector<HTMLInputElement>('.filter-dropdown-value2');
        const filterType = condSection.dataset.filterType as 'text' | 'number' | 'date';

        if (operatorSelect && valueInput && valueInput.value.trim() !== '') {
          const criterion = this.buildCriterion(
            filterType,
            operatorSelect.value,
            valueInput.value.trim(),
            value2Input?.value.trim()
          );
          if (criterion) {
            filter.criteria = [criterion];
          }
        }
      }
    }

    // 如果没有任何筛选条件，清除该列筛选
    if (!filter.selectedValues && (!filter.criteria || filter.criteria.length === 0)) {
      this.callbacks.onClear(this.currentColIndex);
    } else {
      this.callbacks.onApply(this.currentColIndex, filter);
    }

    this.hide();
  }

  /** 构建筛选条件 */
  private buildCriterion(
    filterType: 'text' | 'number' | 'date',
    operator: string,
    value: string,
    value2?: string
  ): FilterCriterion | null {
    switch (filterType) {
      case 'text':
        return {
          type: 'text',
          operator: operator as FilterCriterion & { type: 'text' } extends { operator: infer O } ? O : never,
          value,
        } as FilterCriterion;
      case 'number': {
        const numVal = Number(value);
        if (isNaN(numVal)) return null;
        const criterion: FilterCriterion = {
          type: 'number',
          operator: operator as 'equals',
          value: numVal,
        };
        if (operator === 'between' && value2) {
          const numVal2 = Number(value2);
          if (!isNaN(numVal2)) {
            return { type: 'number', operator: 'between', value: numVal, value2: numVal2 };
          }
        }
        return criterion;
      }
      case 'date': {
        const dateVal = Date.parse(value);
        if (isNaN(dateVal)) return null;
        if (operator === 'between' && value2) {
          const dateVal2 = Date.parse(value2);
          if (!isNaN(dateVal2)) {
            return { type: 'date', operator: 'between', value: dateVal, value2: dateVal2 };
          }
        }
        return { type: 'date', operator: operator as 'equals', value: dateVal };
      }
    }
  }

  /** 创建分隔线 */
  private createDivider(): HTMLDivElement {
    const divider = document.createElement('div');
    divider.className = 'filter-dropdown-divider';
    return divider;
  }

  /** 调整位置确保不超出视口 */
  private adjustPosition(): void {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;

    if (rect.right > viewWidth) {
      this.container.style.left = `${viewWidth - rect.width - 8}px`;
    }
    if (rect.bottom > viewHeight) {
      this.container.style.top = `${viewHeight - rect.height - 8}px`;
    }
  }
}
