// ============================================================
// ICE Excel 企业版 - 工作表保护对话框
// ============================================================

import { SheetProtectionManager } from './sheet-protection';
import { SheetProtection } from './types';

/** 工作表保护设置对话框 */
export class ProtectionDialog {
  private dialog: HTMLElement | null = null;
  private protectionManager: SheetProtectionManager;
  private currentSheetId: string = '';

  constructor(protectionManager: SheetProtectionManager) {
    this.protectionManager = protectionManager;
  }

  /** 打开保护设置对话框 */
  open(sheetId: string): void {
    this.currentSheetId = sheetId;
    this.close();

    const existing = this.protectionManager.getProtection(sheetId);

    this.dialog = document.createElement('div');
    this.dialog.className = 'protection-dialog-overlay';
    this.dialog.innerHTML = `
      <div class="protection-dialog" role="dialog" aria-labelledby="protection-title" aria-modal="true">
        <h3 id="protection-title">工作表保护设置</h3>
        <div class="protection-dialog-body">
          <div class="protection-status">
            当前状态: <strong>${existing?.enabled ? '已保护 🔒' : '未保护 🔓'}</strong>
          </div>
          <div class="protection-options">
            <label><input type="checkbox" id="prot-edit" ${existing?.allowEditCells ? 'checked' : ''} /> 允许编辑单元格</label>
            <label><input type="checkbox" id="prot-format" ${existing?.allowFormatCells ? 'checked' : ''} /> 允许格式化单元格</label>
            <label><input type="checkbox" id="prot-insert" ${existing?.allowInsertRows ? 'checked' : ''} /> 允许插入行列</label>
            <label><input type="checkbox" id="prot-undo" ${existing?.allowUndoRedo !== false ? 'checked' : ''} /> 允许撤销/重做</label>
          </div>
          <div class="protection-password">
            <label for="prot-password">设置密码（可选）:</label>
            <input type="password" id="prot-password" placeholder="留空则无密码保护" autocomplete="new-password" />
          </div>
        </div>
        <div class="protection-dialog-footer">
          ${existing?.enabled
            ? '<button class="prot-btn prot-btn-danger" id="prot-disable">解除保护</button>'
            : '<button class="prot-btn prot-btn-primary" id="prot-enable">启用保护</button>'
          }
          <button class="prot-btn" id="prot-cancel">取消</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.dialog);
    this.bindEvents(existing);

    // 聚焦到对话框
    const firstInput = this.dialog.querySelector('input') as HTMLElement;
    firstInput?.focus();
  }

  /** 关闭对话框 */
  close(): void {
    if (this.dialog) {
      this.dialog.remove();
      this.dialog = null;
    }
  }

  /** 绑定事件 */
  private bindEvents(existing: SheetProtection | undefined): void {
    if (!this.dialog) return;

    // 取消
    this.dialog.querySelector('#prot-cancel')?.addEventListener('click', () => this.close());

    // 点击遮罩关闭
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.close();
    });

    // ESC 关闭
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // 启用保护
    this.dialog.querySelector('#prot-enable')?.addEventListener('click', () => {
      const config: Partial<SheetProtection> = {
        allowEditCells: (this.dialog?.querySelector('#prot-edit') as HTMLInputElement)?.checked,
        allowFormatCells: (this.dialog?.querySelector('#prot-format') as HTMLInputElement)?.checked,
        allowInsertRows: (this.dialog?.querySelector('#prot-insert') as HTMLInputElement)?.checked,
        allowUndoRedo: (this.dialog?.querySelector('#prot-undo') as HTMLInputElement)?.checked,
      };
      const password = (this.dialog?.querySelector('#prot-password') as HTMLInputElement)?.value;
      this.protectionManager.enableProtection(this.currentSheetId, config, password || undefined);
      this.close();
    });

    // 解除保护
    this.dialog.querySelector('#prot-disable')?.addEventListener('click', () => {
      if (existing?.passwordHash) {
        const password = prompt('请输入保护密码:');
        if (password === null) return;
        const success = this.protectionManager.disableProtection(this.currentSheetId, password);
        if (!success) {
          alert('密码错误');
          return;
        }
      } else {
        this.protectionManager.disableProtection(this.currentSheetId);
      }
      this.close();
    });
  }
}
