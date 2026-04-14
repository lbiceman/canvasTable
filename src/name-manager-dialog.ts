// ============================================================
// 名称管理器对话框
// 提供命名范围的可视化管理界面（新建、编辑、删除、筛选）
// ============================================================

import { NamedRangeManager } from './formula/named-range';
import type { RangeReferenceNode } from './formula/types';
import { Modal } from './modal';

/** 列号转字母（0 → A, 1 → B, 25 → Z, 26 → AA） */
function colToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

/** 将 RangeReferenceNode 转为 A1 格式字符串 */
function rangeToA1(range: RangeReferenceNode): string {
  const startRef = `${colToLetter(range.startCol)}${range.startRow + 1}`;
  const endRef = `${colToLetter(range.endCol)}${range.endRow + 1}`;
  if (startRef === endRef) return startRef;
  const prefix = range.sheetName ? `${range.sheetName}!` : '';
  return `${prefix}${startRef}:${endRef}`;
}

/** 解析 A1 格式字符串为行列坐标 */
function parseA1Range(ref: string): RangeReferenceNode | null {
  // 去除工作表前缀
  let sheetName: string | undefined;
  let rangeStr = ref.trim();
  const sheetMatch = rangeStr.match(/^(.+)!/);
  if (sheetMatch) {
    sheetName = sheetMatch[1].replace(/^'|'$/g, '');
    rangeStr = rangeStr.substring(sheetMatch[0].length);
  }

  // 匹配 A1:B2 或 A1 格式
  const rangeMatch = rangeStr.match(/^([A-Z]{1,3})(\d+)(?::([A-Z]{1,3})(\d+))?$/i);
  if (!rangeMatch) return null;

  const startCol = letterToCol(rangeMatch[1].toUpperCase());
  const startRow = parseInt(rangeMatch[2]) - 1;
  const endCol = rangeMatch[3] ? letterToCol(rangeMatch[3].toUpperCase()) : startCol;
  const endRow = rangeMatch[4] ? parseInt(rangeMatch[4]) - 1 : startRow;

  if (startRow < 0 || startCol < 0 || endRow < 0 || endCol < 0) return null;

  return {
    type: 'RangeReference',
    startRow,
    startCol,
    endRow,
    endCol,
    sheetName,
  };
}

/** 字母转列号（A → 0, B → 1, Z → 25, AA → 26） */
function letterToCol(letters: string): number {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

export class NameManagerDialog {
  private namedRangeManager: NamedRangeManager;
  private overlay: HTMLDivElement | null = null;
  private listContainer: HTMLDivElement | null = null;
  private filterInput: HTMLInputElement | null = null;
  private onUpdate: (() => void) | null = null;

  constructor(namedRangeManager: NamedRangeManager) {
    this.namedRangeManager = namedRangeManager;
  }

  /** 设置更新回调（名称变更后通知外部刷新） */
  public setUpdateCallback(callback: () => void): void {
    this.onUpdate = callback;
  }

  /** 显示名称管理器对话框 */
  public show(): void {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'name-manager-overlay';
    this.overlay.innerHTML = this.buildHTML();
    document.body.appendChild(this.overlay);

    this.listContainer = this.overlay.querySelector('.nm-list') as HTMLDivElement;
    this.filterInput = this.overlay.querySelector('.nm-filter-input') as HTMLInputElement;

    this.bindEvents();
    this.refreshList();
  }

  /** 关闭对话框 */
  public hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.listContainer = null;
      this.filterInput = null;
    }
  }

  private buildHTML(): string {
    return `
      <div class="name-manager-dialog">
        <div class="nm-header">
          <h3>名称管理器</h3>
          <button class="nm-close-btn" title="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="nm-toolbar">
          <button class="nm-btn nm-new-btn">新建</button>
          <div class="nm-filter-wrapper">
            <input type="text" class="nm-filter-input" placeholder="按名称筛选..." />
          </div>
        </div>
        <div class="nm-list-header">
          <span class="nm-col-name">名称</span>
          <span class="nm-col-range">引用区域</span>
          <span class="nm-col-scope">作用域</span>
          <span class="nm-col-actions">操作</span>
        </div>
        <div class="nm-list"></div>
      </div>
    `;
  }

  private bindEvents(): void {
    if (!this.overlay) return;

    // 关闭按钮
    const closeBtn = this.overlay.querySelector('.nm-close-btn');
    closeBtn?.addEventListener('click', () => this.hide());

    // 新建按钮
    const newBtn = this.overlay.querySelector('.nm-new-btn');
    newBtn?.addEventListener('click', () => this.showCreateDialog());

    // 筛选输入
    this.filterInput?.addEventListener('input', () => this.refreshList());

    // 点击遮罩关闭
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Escape 关闭
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  }

  /** 刷新列表 */
  private refreshList(): void {
    if (!this.listContainer) return;

    const filter = this.filterInput?.value.trim().toLowerCase() || '';
    const allRanges = this.namedRangeManager.getAll();
    const filtered = filter
      ? allRanges.filter(r => r.name.toLowerCase().includes(filter))
      : allRanges;

    if (filtered.length === 0) {
      this.listContainer.innerHTML = '<div class="nm-empty">暂无命名范围</div>';
      return;
    }

    this.listContainer.innerHTML = filtered.map(range => {
      const rangeStr = rangeToA1(range.range);
      const scope = range.sheetScope || '工作簿';
      return `
        <div class="nm-list-item" data-name="${this.escapeHtml(range.name)}">
          <span class="nm-col-name" title="${this.escapeHtml(range.name)}">${this.escapeHtml(range.name)}</span>
          <span class="nm-col-range" title="${rangeStr}">${rangeStr}</span>
          <span class="nm-col-scope">${this.escapeHtml(scope)}</span>
          <span class="nm-col-actions">
            <button class="nm-action-btn nm-edit-btn" title="编辑">✏️</button>
            <button class="nm-action-btn nm-delete-btn" title="删除">🗑️</button>
          </span>
        </div>
      `;
    }).join('');

    // 绑定编辑和删除按钮事件
    this.listContainer.querySelectorAll('.nm-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.nm-list-item');
        const name = item?.getAttribute('data-name');
        if (name) this.showEditDialog(name);
      });
    });

    this.listContainer.querySelectorAll('.nm-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.nm-list-item');
        const name = item?.getAttribute('data-name');
        if (name) this.handleDelete(name);
      });
    });
  }

  /** 显示新建对话框 */
  private showCreateDialog(): void {
    this.showFormDialog('新建命名范围', '', '', '', (name, rangeStr, scope) => {
      const range = parseA1Range(rangeStr);
      if (!range) {
        Modal.alert('无效的区域引用格式，请使用 A1:B2 格式');
        return false;
      }
      const result = this.namedRangeManager.create(name, {
        range,
        sheetScope: scope || undefined,
      });
      if (!result.success) {
        Modal.alert(result.message || '创建失败');
        return false;
      }
      this.refreshList();
      this.onUpdate?.();
      return true;
    });
  }

  /** 显示编辑对话框 */
  private showEditDialog(name: string): void {
    const existing = this.namedRangeManager.resolve(name);
    if (!existing) return;

    const rangeStr = rangeToA1(existing.range);
    const scope = existing.sheetScope || '';

    this.showFormDialog('编辑命名范围', name, rangeStr, scope, (_newName, newRangeStr, newScope) => {
      const range = parseA1Range(newRangeStr);
      if (!range) {
        Modal.alert('无效的区域引用格式，请使用 A1:B2 格式');
        return false;
      }
      const result = this.namedRangeManager.update(name, {
        range,
        sheetScope: newScope || undefined,
      });
      if (!result.success) {
        Modal.alert(result.message || '更新失败');
        return false;
      }
      this.refreshList();
      this.onUpdate?.();
      return true;
    });
  }

  /** 处理删除 */
  private handleDelete(name: string): void {
    Modal.confirm(`确定要删除命名范围 "${name}" 吗？`).then((confirmed) => {
      if (confirmed) {
        this.namedRangeManager.delete(name);
        this.refreshList();
        this.onUpdate?.();
      }
    });
  }

  /** 显示表单对话框（新建/编辑共用） */
  private showFormDialog(
    title: string,
    name: string,
    rangeStr: string,
    scope: string,
    onSubmit: (name: string, range: string, scope: string) => boolean
  ): void {
    const formOverlay = document.createElement('div');
    formOverlay.className = 'nm-form-overlay';
    formOverlay.innerHTML = `
      <div class="nm-form-dialog">
        <h4>${title}</h4>
        <div class="nm-form-row">
          <label>名称：</label>
          <input type="text" class="nm-form-name" value="${this.escapeHtml(name)}" ${name ? 'readonly' : ''} placeholder="输入名称..." />
        </div>
        <div class="nm-form-row">
          <label>引用区域：</label>
          <input type="text" class="nm-form-range" value="${this.escapeHtml(rangeStr)}" placeholder="例如 A1:B10" />
        </div>
        <div class="nm-form-row">
          <label>作用域：</label>
          <input type="text" class="nm-form-scope" value="${this.escapeHtml(scope)}" placeholder="留空表示工作簿级别" />
        </div>
        <div class="nm-form-actions">
          <button class="nm-btn nm-form-cancel">取消</button>
          <button class="nm-btn nm-form-submit">确定</button>
        </div>
      </div>
    `;

    document.body.appendChild(formOverlay);

    const nameInput = formOverlay.querySelector('.nm-form-name') as HTMLInputElement;
    const rangeInput = formOverlay.querySelector('.nm-form-range') as HTMLInputElement;
    const scopeInput = formOverlay.querySelector('.nm-form-scope') as HTMLInputElement;

    // 聚焦到第一个可编辑输入框
    if (name) {
      rangeInput.focus();
    } else {
      nameInput.focus();
    }

    const close = () => formOverlay.remove();

    formOverlay.querySelector('.nm-form-cancel')?.addEventListener('click', close);
    formOverlay.querySelector('.nm-form-submit')?.addEventListener('click', () => {
      const n = nameInput.value.trim();
      const r = rangeInput.value.trim();
      const s = scopeInput.value.trim();
      if (!n) { Modal.alert('请输入名称'); return; }
      if (!r) { Modal.alert('请输入引用区域'); return; }
      if (onSubmit(n, r, s)) {
        close();
      }
    });

    formOverlay.addEventListener('click', (e) => {
      if (e.target === formOverlay) close();
    });

    formOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') {
        formOverlay.querySelector('.nm-form-submit')?.dispatchEvent(new Event('click'));
      }
    });
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
