// ============================================================
// PivotTablePanel - 数据透视表配置面板 UI
// 提供字段拖拽配置、聚合方式选择、筛选值勾选、结果预览
// 配置变化后 500ms 防抖重新计算
// ============================================================

import { PivotTable } from './pivot-table';
import type {
  PivotFieldConfig,
  PivotValueConfig,
  PivotFilterConfig,
  PivotConfig,
  PivotResult,
  AggregateFunction,
  PivotSortConfig,
} from './pivot-table';
import { SpreadsheetModel } from '../model';
import type { Selection } from '../types';
import type { SheetManager } from '../sheet-manager';
import { Modal } from '../modal';

/** 聚合方式中文标签映射 */
const AGG_LABELS: Record<AggregateFunction, string> = {
  sum: '求和',
  count: '计数',
  average: '平均值',
  max: '最大值',
  min: '最小值',
};

/** 所有聚合方式列表 */
const AGG_FUNCTIONS: AggregateFunction[] = ['sum', 'count', 'average', 'max', 'min'];

export class PivotTablePanel {
  private pivotTable: PivotTable;
  private model: SpreadsheetModel;

  // DOM 元素
  private overlay: HTMLDivElement | null = null;

  // 当前配置状态
  private sourceRange: Selection | null = null;
  private availableFields: PivotFieldConfig[] = [];
  private rowFields: PivotFieldConfig[] = [];
  private colFields: PivotFieldConfig[] = [];
  private valueFields: PivotValueConfig[] = [];
  private filterFields: PivotFilterConfig[] = [];

  // 当前计算结果
  private currentResult: PivotResult | null = null;

  // 防抖定时器
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // 聚合方式选择菜单
  private aggMenu: HTMLDivElement | null = null;

  // 排序配置
  private sortConfig: PivotSortConfig | null = null;

  constructor(pivotTable: PivotTable, model: SpreadsheetModel) {
    this.pivotTable = pivotTable;
    this.model = model;
  }

  /**
   * 显示配置面板
   * 1. 验证源数据区域
   * 2. 提取可用字段
   * 3. 创建面板 DOM 结构
   * 4. 绑定拖拽事件
   */
  show(sourceRange: Selection): void {
    // 验证源数据区域
    const validation = this.pivotTable.validateSourceRange(sourceRange);
    if (!validation.valid) {
      Modal.alert(validation.error ?? '数据区域无效');
      return;
    }

    // 先关闭已有面板
    this.hide();

    // 保存源数据区域并提取字段
    this.sourceRange = sourceRange;
    this.availableFields = this.pivotTable.extractFields(sourceRange);
    this.rowFields = [];
    this.colFields = [];
    this.valueFields = [];
    this.filterFields = [];
    this.currentResult = null;
    this.sortConfig = null;

    // 创建面板 DOM
    this.createPanel();
  }

  /** 隐藏并销毁面板 */
  hide(): void {
    this.hideAggMenu();

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }

  /**
   * 将透视表结果写入新工作表
   * 创建名为 '透视表结果' 的新工作表，写入表头和数据行
   */
  writeResultToSheet(result: PivotResult, sheetManager: SheetManager): void {
    // 创建新工作表
    const newSheet = sheetManager.addSheet();
    const newModel = sheetManager.getModelBySheetId(newSheet.id);
    if (!newModel) return;

    // 重命名工作表
    sheetManager.renameSheet(newSheet.id, '透视表结果');

    // 写入表头行
    result.headers.forEach((header, col) => {
      newModel.setCellContent(0, col, header);
    });

    // 写入数据行
    result.rows.forEach((row, rowIndex) => {
      const targetRow = rowIndex + 1;
      // 写入行标签
      row.labels.forEach((label, col) => {
        newModel.setCellContent(targetRow, col, label);
      });
      // 写入聚合值
      row.values.forEach((value, vi) => {
        const col = row.labels.length + vi;
        newModel.setCellContent(targetRow, col, String(value));
      });
    });

    // 写入总计行
    const totalRow = result.rows.length + 1;
    newModel.setCellContent(totalRow, 0, '总计');
    result.grandTotal.forEach((value, vi) => {
      const col = (this.rowFields.length || 1) + vi;
      newModel.setCellContent(totalRow, col, String(value));
    });
  }

  // ============================================================
  // 面板 DOM 创建
  // ============================================================

  /** 创建完整面板 DOM 结构 */
  private createPanel(): void {
    // 遮罩层
    this.overlay = document.createElement('div');
    this.overlay.className = 'pivot-panel-overlay';

    // 面板容器
    const panel = document.createElement('div');
    panel.className = 'pivot-panel';

    // 标题栏
    const titleBar = document.createElement('div');
    titleBar.className = 'pivot-panel-title';
    titleBar.textContent = '数据透视表配置';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pivot-panel-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.hide());
    titleBar.appendChild(closeBtn);
    panel.appendChild(titleBar);

    // 主体区域（左侧配置 + 右侧预览）
    const body = document.createElement('div');
    body.className = 'pivot-panel-body';

    // 左侧：可用字段 + 四个放置区域
    const configArea = document.createElement('div');
    configArea.className = 'pivot-panel-config';

    // 可用字段列表
    configArea.appendChild(this.createFieldList());

    // 四个放置区域
    configArea.appendChild(this.createDropZone('row', '行字段'));
    configArea.appendChild(this.createDropZone('col', '列字段'));
    configArea.appendChild(this.createDropZone('value', '值字段'));
    configArea.appendChild(this.createDropZone('filter', '筛选字段'));

    body.appendChild(configArea);

    // 右侧：预览区域
    const previewArea = document.createElement('div');
    previewArea.className = 'pivot-preview';
    previewArea.innerHTML = '<p style="color:#999;text-align:center;">请拖拽字段到左侧区域以生成透视表</p>';
    body.appendChild(previewArea);

    panel.appendChild(body);

    // 底部按钮栏
    const footer = document.createElement('div');
    footer.className = 'pivot-panel-footer';

    const writeBtn = document.createElement('button');
    writeBtn.className = 'pivot-panel-btn pivot-panel-btn-primary';
    writeBtn.textContent = '写入工作表';
    writeBtn.addEventListener('click', () => {
      if (!this.currentResult) {
        Modal.alert('请先配置透视表字段');
        return;
      }
      // 写入工作表需要 SheetManager，通过自定义事件通知外部
      this.overlay?.dispatchEvent(new CustomEvent('pivot-write', {
        detail: { result: this.currentResult },
        bubbles: true,
      }));
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'pivot-panel-btn';
    cancelBtn.textContent = '关闭';
    cancelBtn.addEventListener('click', () => this.hide());

    footer.appendChild(cancelBtn);
    footer.appendChild(writeBtn);
    panel.appendChild(footer);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    // 点击遮罩层关闭
    this.overlay.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
  }

  // ============================================================
  // 可用字段列表
  // ============================================================

  /** 创建可用字段列表区域 */
  private createFieldList(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'pivot-field-list';

    const label = document.createElement('div');
    label.className = 'pivot-zone-label';
    label.textContent = '可用字段';
    container.appendChild(label);

    const list = document.createElement('div');
    list.className = 'pivot-field-list-items';
    list.dataset.zone = 'available';

    // 允许拖回可用字段区域
    list.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    });

    list.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer?.getData('text/plain');
      if (!data) return;

      const { fieldIndex, fromZone } = JSON.parse(data) as { fieldIndex: number; fromZone: string };
      if (fromZone !== 'available') {
        this.removeFieldFromZone(fieldIndex, fromZone);
        this.scheduleRecompute();
      }
    });

    for (const field of this.availableFields) {
      list.appendChild(this.createFieldItem(field, 'available'));
    }

    container.appendChild(list);
    return container;
  }

  /** 创建可拖拽的字段项 */
  private createFieldItem(field: PivotFieldConfig, zone: string): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'pivot-field-item';
    item.textContent = field.fieldName;
    item.draggable = true;
    item.dataset.fieldIndex = String(field.fieldIndex);
    item.dataset.zone = zone;

    item.addEventListener('dragstart', (e: DragEvent) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', JSON.stringify({
          fieldIndex: field.fieldIndex,
          fieldName: field.fieldName,
          fromZone: zone,
        }));
        e.dataTransfer.effectAllowed = 'move';
      }
      item.classList.add('pivot-field-item-dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('pivot-field-item-dragging');
    });

    return item;
  }

  // ============================================================
  // 放置区域（Drop Zones）
  // ============================================================

  /** 创建放置区域 */
  private createDropZone(zoneType: string, label: string): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'pivot-drop-zone-container';

    const zoneLabelEl = document.createElement('div');
    zoneLabelEl.className = 'pivot-zone-label';
    zoneLabelEl.textContent = label;
    container.appendChild(zoneLabelEl);

    const zone = document.createElement('div');
    zone.className = 'pivot-drop-zone';
    zone.dataset.zone = zoneType;

    // 拖拽进入高亮
    zone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      zone.classList.add('pivot-drop-zone-active');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('pivot-drop-zone-active');
    });

    // 放置处理
    zone.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      zone.classList.remove('pivot-drop-zone-active');

      const data = e.dataTransfer?.getData('text/plain');
      if (!data) return;

      const { fieldIndex, fieldName, fromZone } = JSON.parse(data) as {
        fieldIndex: number;
        fieldName: string;
        fromZone: string;
      };

      // 如果从其他区域拖来，先从原区域移除
      if (fromZone !== 'available' && fromZone !== zoneType) {
        this.removeFieldFromZone(fieldIndex, fromZone);
      }

      // 避免重复添加到同一区域
      if (fromZone === zoneType) return;

      // 添加到目标区域
      this.addFieldToZone(fieldIndex, fieldName, zoneType);
      this.scheduleRecompute();
    });

    container.appendChild(zone);
    return container;
  }

  /** 将字段添加到指定区域 */
  private addFieldToZone(fieldIndex: number, fieldName: string, zoneType: string): void {
    const field: PivotFieldConfig = { fieldIndex, fieldName };

    switch (zoneType) {
      case 'row':
        // 避免重复
        if (this.rowFields.some((f) => f.fieldIndex === fieldIndex)) return;
        this.rowFields.push(field);
        break;

      case 'col':
        if (this.colFields.some((f) => f.fieldIndex === fieldIndex)) return;
        this.colFields.push(field);
        break;

      case 'value': {
        if (this.valueFields.some((f) => f.fieldIndex === fieldIndex)) return;
        // 判断字段类型：检查源数据中该列是否为数值
        const isNumeric = this.isFieldNumeric(fieldIndex);
        const valueField: PivotValueConfig = {
          ...field,
          aggregateFunc: isNumeric ? 'sum' : 'count',
        };
        this.valueFields.push(valueField);
        break;
      }

      case 'filter': {
        if (this.filterFields.some((f) => f.fieldIndex === fieldIndex)) return;
        // 获取该字段的唯一值，默认全选
        const uniqueValues = this.getFieldUniqueValues(fieldIndex);
        const filterField: PivotFilterConfig = {
          ...field,
          selectedValues: new Set(uniqueValues),
        };
        this.filterFields.push(filterField);
        break;
      }
    }

    this.renderZoneContents();
  }

  /** 从指定区域移除字段 */
  private removeFieldFromZone(fieldIndex: number, zoneType: string): void {
    switch (zoneType) {
      case 'row':
        this.rowFields = this.rowFields.filter((f) => f.fieldIndex !== fieldIndex);
        break;
      case 'col':
        this.colFields = this.colFields.filter((f) => f.fieldIndex !== fieldIndex);
        break;
      case 'value':
        this.valueFields = this.valueFields.filter((f) => f.fieldIndex !== fieldIndex);
        break;
      case 'filter':
        this.filterFields = this.filterFields.filter((f) => f.fieldIndex !== fieldIndex);
        break;
    }

    this.renderZoneContents();
  }

  /** 重新渲染所有区域内的字段项 */
  private renderZoneContents(): void {
    if (!this.overlay) return;

    // 渲染各区域
    this.renderZone('row', this.rowFields);
    this.renderZone('col', this.colFields);
    this.renderValueZone();
    this.renderFilterZone();
  }

  /** 渲染普通区域（行/列）的字段项 */
  private renderZone(zoneType: string, fields: PivotFieldConfig[]): void {
    const zone = this.overlay?.querySelector(`[data-zone="${zoneType}"].pivot-drop-zone`) as HTMLDivElement | null;
    if (!zone) return;

    zone.innerHTML = '';
    for (const field of fields) {
      const item = this.createFieldItem(field, zoneType);
      // 添加移除按钮
      const removeBtn = document.createElement('span');
      removeBtn.className = 'pivot-field-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        this.removeFieldFromZone(field.fieldIndex, zoneType);
        this.scheduleRecompute();
      });
      item.appendChild(removeBtn);
      zone.appendChild(item);
    }

    if (fields.length === 0) {
      zone.innerHTML = '<span class="pivot-drop-hint">拖拽字段到此处</span>';
    }
  }

  // ============================================================
  // 值字段区域（含聚合方式选择）
  // ============================================================

  /** 渲染值字段区域 */
  private renderValueZone(): void {
    const zone = this.overlay?.querySelector('[data-zone="value"].pivot-drop-zone') as HTMLDivElement | null;
    if (!zone) return;

    zone.innerHTML = '';
    for (const field of this.valueFields) {
      const item = this.createFieldItem(field, 'value');
      item.textContent = `${field.fieldName}(${AGG_LABELS[field.aggregateFunc]})`;

      // 点击显示聚合方式选择菜单
      item.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        this.showAggMenu(field, item);
      });

      // 移除按钮
      const removeBtn = document.createElement('span');
      removeBtn.className = 'pivot-field-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        this.removeFieldFromZone(field.fieldIndex, 'value');
        this.scheduleRecompute();
      });
      item.appendChild(removeBtn);
      zone.appendChild(item);
    }

    if (this.valueFields.length === 0) {
      zone.innerHTML = '<span class="pivot-drop-hint">拖拽字段到此处</span>';
    }
  }

  /** 显示聚合方式选择菜单 */
  private showAggMenu(field: PivotValueConfig, anchor: HTMLElement): void {
    this.hideAggMenu();

    const menu = document.createElement('div');
    menu.className = 'pivot-agg-menu';

    for (const func of AGG_FUNCTIONS) {
      const menuItem = document.createElement('div');
      menuItem.className = 'pivot-agg-menu-item';
      if (func === field.aggregateFunc) {
        menuItem.classList.add('pivot-agg-menu-item-active');
      }
      menuItem.textContent = AGG_LABELS[func];
      menuItem.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        field.aggregateFunc = func;
        this.hideAggMenu();
        this.renderValueZone();
        this.scheduleRecompute();
      });
      menu.appendChild(menuItem);
    }

    // 定位到锚点元素下方
    const rect = anchor.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 2}px`;

    document.body.appendChild(menu);
    this.aggMenu = menu;

    // 点击外部关闭
    const closeHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        this.hideAggMenu();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', closeHandler);
    }, 0);
  }

  /** 隐藏聚合方式选择菜单 */
  private hideAggMenu(): void {
    if (this.aggMenu && this.aggMenu.parentNode) {
      this.aggMenu.parentNode.removeChild(this.aggMenu);
    }
    this.aggMenu = null;
  }

  // ============================================================
  // 筛选字段区域（含值勾选列表）
  // ============================================================

  /** 渲染筛选字段区域 */
  private renderFilterZone(): void {
    const zone = this.overlay?.querySelector('[data-zone="filter"].pivot-drop-zone') as HTMLDivElement | null;
    if (!zone) return;

    zone.innerHTML = '';
    for (const field of this.filterFields) {
      const fieldContainer = document.createElement('div');
      fieldContainer.className = 'pivot-filter-field';

      // 字段标题行
      const header = this.createFieldItem(field, 'filter');

      const removeBtn = document.createElement('span');
      removeBtn.className = 'pivot-field-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        this.removeFieldFromZone(field.fieldIndex, 'filter');
        this.scheduleRecompute();
      });
      header.appendChild(removeBtn);
      fieldContainer.appendChild(header);

      // 值勾选列表
      const uniqueValues = this.getFieldUniqueValues(field.fieldIndex);
      const checkList = document.createElement('div');
      checkList.className = 'pivot-filter-checklist';

      // 全选/取消全选
      const selectAllLabel = document.createElement('label');
      selectAllLabel.className = 'pivot-filter-check-item';
      const selectAllCb = document.createElement('input');
      selectAllCb.type = 'checkbox';
      selectAllCb.checked = field.selectedValues.size === uniqueValues.length;
      selectAllCb.addEventListener('change', () => {
        if (selectAllCb.checked) {
          field.selectedValues = new Set(uniqueValues);
        } else {
          field.selectedValues = new Set();
        }
        this.renderFilterZone();
        this.scheduleRecompute();
      });
      selectAllLabel.appendChild(selectAllCb);
      selectAllLabel.appendChild(document.createTextNode(' 全选'));
      checkList.appendChild(selectAllLabel);

      // 各值复选框
      for (const val of uniqueValues) {
        const label = document.createElement('label');
        label.className = 'pivot-filter-check-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = field.selectedValues.has(val);
        cb.addEventListener('change', () => {
          if (cb.checked) {
            field.selectedValues.add(val);
          } else {
            field.selectedValues.delete(val);
          }
          this.scheduleRecompute();
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(` ${val || '(空)'}`));
        checkList.appendChild(label);
      }

      fieldContainer.appendChild(checkList);
      zone.appendChild(fieldContainer);
    }

    if (this.filterFields.length === 0) {
      zone.innerHTML = '<span class="pivot-drop-hint">拖拽字段到此处</span>';
    }
  }

  // ============================================================
  // 防抖重新计算与预览渲染
  // ============================================================

  /** 防抖调度重新计算（500ms） */
  private scheduleRecompute(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.recompute();
      this.debounceTimer = null;
    }, 500);
  }

  /** 执行透视表计算并更新预览 */
  private recompute(): void {
    if (!this.sourceRange) return;

    // 至少需要一个值字段才能计算
    if (this.valueFields.length === 0) {
      this.currentResult = null;
      this.renderPreview(null);
      return;
    }

    const config: PivotConfig = {
      sourceRange: this.sourceRange,
      rowFields: this.rowFields,
      colFields: this.colFields,
      valueFields: this.valueFields,
      filterFields: this.filterFields,
      sort: this.sortConfig ?? undefined,
    };

    try {
      this.currentResult = this.pivotTable.compute(config);
      this.renderPreview(this.currentResult);
    } catch (err) {
      console.error('透视表计算错误:', err);
      this.currentResult = null;
      this.renderPreview(null);
    }
  }

  /** 渲染预览区域 */
  private renderPreview(result: PivotResult | null): void {
    const preview = this.overlay?.querySelector('.pivot-preview') as HTMLDivElement | null;
    if (!preview) return;

    if (!result) {
      preview.innerHTML = '<p style="color:#999;text-align:center;">请拖拽字段到左侧区域以生成透视表</p>';
      return;
    }

    // 构建预览表格
    const table = document.createElement('table');
    table.className = 'pivot-preview-table';

    // 排序控件区域
    const sortBar = document.createElement('div');
    sortBar.className = 'pivot-sort-bar';
    sortBar.style.cssText = 'margin-bottom:6px;display:flex;gap:6px;align-items:center;font-size:12px;';

    const sortLabel = document.createElement('span');
    sortLabel.textContent = '排序：';
    sortBar.appendChild(sortLabel);

    // 排序方式选择
    const sortBySelect = document.createElement('select');
    sortBySelect.style.cssText = 'font-size:12px;padding:2px 4px;';
    const noneOpt = document.createElement('option');
    noneOpt.value = 'none';
    noneOpt.textContent = '无';
    sortBySelect.appendChild(noneOpt);

    // 行标签排序选项
    this.rowFields.forEach((f, idx) => {
      const opt = document.createElement('option');
      opt.value = `label:${idx}`;
      opt.textContent = `${f.fieldName}（标签）`;
      if (this.sortConfig?.by === 'label' && this.sortConfig.fieldIndex === idx) {
        opt.selected = true;
      }
      sortBySelect.appendChild(opt);
    });

    // 值字段排序选项
    this.valueFields.forEach((f, idx) => {
      const opt = document.createElement('option');
      opt.value = `value:${idx}`;
      opt.textContent = `${f.fieldName}（值）`;
      if (this.sortConfig?.by === 'value' && this.sortConfig.fieldIndex === idx) {
        opt.selected = true;
      }
      sortBySelect.appendChild(opt);
    });

    sortBar.appendChild(sortBySelect);

    // 排序方向
    const dirSelect = document.createElement('select');
    dirSelect.style.cssText = 'font-size:12px;padding:2px 4px;';
    const ascOpt = document.createElement('option');
    ascOpt.value = 'asc';
    ascOpt.textContent = '升序';
    const descOpt = document.createElement('option');
    descOpt.value = 'desc';
    descOpt.textContent = '降序';
    if (this.sortConfig?.direction === 'desc') descOpt.selected = true;
    dirSelect.appendChild(ascOpt);
    dirSelect.appendChild(descOpt);
    sortBar.appendChild(dirSelect);

    // 排序变更事件
    const onSortChange = (): void => {
      const val = sortBySelect.value;
      if (val === 'none') {
        this.sortConfig = null;
      } else {
        const [by, indexStr] = val.split(':');
        this.sortConfig = {
          by: by as 'label' | 'value',
          fieldIndex: parseInt(indexStr, 10),
          direction: dirSelect.value as 'asc' | 'desc',
        };
      }
      this.scheduleRecompute();
    };

    sortBySelect.addEventListener('change', onSortChange);
    dirSelect.addEventListener('change', onSortChange);

    preview.innerHTML = '';
    preview.appendChild(sortBar);

    // 表头
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const header of result.headers) {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 数据行
    const tbody = document.createElement('tbody');
    for (const row of result.rows) {
      const tr = document.createElement('tr');
      if (row.isSubtotal) {
        tr.className = 'pivot-preview-subtotal';
      }

      for (const label of row.labels) {
        const td = document.createElement('td');
        td.textContent = label;
        tr.appendChild(td);
      }
      for (const value of row.values) {
        const td = document.createElement('td');
        td.textContent = typeof value === 'number' ? this.formatNumber(value) : String(value);
        td.className = 'pivot-preview-value';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    // 总计行
    const totalTr = document.createElement('tr');
    totalTr.className = 'pivot-preview-grandtotal';
    const totalLabelTd = document.createElement('td');
    totalLabelTd.textContent = '总计';
    totalLabelTd.colSpan = this.rowFields.length || 1;
    totalTr.appendChild(totalLabelTd);

    for (const value of result.grandTotal) {
      const td = document.createElement('td');
      td.textContent = typeof value === 'number' ? this.formatNumber(value) : String(value);
      td.className = 'pivot-preview-value';
      totalTr.appendChild(td);
    }
    tbody.appendChild(totalTr);

    table.appendChild(tbody);

    preview.appendChild(table);
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /** 判断字段是否为数值类型（检查源数据中该列的第一个非空值） */
  private isFieldNumeric(fieldIndex: number): boolean {
    if (!this.sourceRange) return false;
    const { startRow, startCol, endRow } = this.sourceRange;

    for (let row = startRow + 1; row <= endRow; row++) {
      const cell = this.model.getCell(row, startCol + fieldIndex);
      const content = cell?.content?.trim() ?? '';
      if (content !== '') {
        return !isNaN(Number(content));
      }
    }
    return false;
  }

  /** 获取字段的唯一值列表 */
  private getFieldUniqueValues(fieldIndex: number): string[] {
    if (!this.sourceRange) return [];
    const { startRow, startCol, endRow } = this.sourceRange;
    const seen = new Set<string>();
    const result: string[] = [];

    for (let row = startRow + 1; row <= endRow; row++) {
      const cell = this.model.getCell(row, startCol + fieldIndex);
      const content = cell?.content ?? '';
      if (!seen.has(content)) {
        seen.add(content);
        result.push(content);
      }
    }

    return result;
  }

  /** 格式化数值（保留两位小数，去除尾零） */
  private formatNumber(value: number): string {
    if (Number.isInteger(value)) return String(value);
    return parseFloat(value.toFixed(2)).toString();
  }
}
