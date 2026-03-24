// ============================================================
// 超链接管理器
// 负责超链接的存储、编辑、打开与对话框交互
// ============================================================

import { SpreadsheetModel } from './model';
import { SpreadsheetRenderer } from './renderer';
import { HistoryManager } from './history-manager';
import type { HyperlinkData } from './types';

/**
 * 超链接管理器
 * 提供超链接的增删改查、URL 规范化、对话框 UI 和浏览器打开功能
 */
export class HyperlinkManager {
  private model: SpreadsheetModel;
  private renderer: SpreadsheetRenderer;
  private historyManager: HistoryManager;

  constructor(
    model: SpreadsheetModel,
    renderer: SpreadsheetRenderer,
    historyManager: HistoryManager
  ) {
    this.model = model;
    this.renderer = renderer;
    this.historyManager = historyManager;
  }

  /**
   * 设置单元格超链接
   * 将超链接数据写入 Cell.hyperlink 字段，并记录历史操作
   */
  public setHyperlink(row: number, col: number, data: HyperlinkData): void {
    const cell = this.model.getCell(row, col);
    if (!cell) return;

    // 保存旧数据用于撤销
    const oldHyperlink = cell.hyperlink ? { ...cell.hyperlink } : null;
    const oldContent = cell.content;

    // 规范化 URL
    const normalizedData: HyperlinkData = {
      url: this.normalizeUrl(data.url),
      displayText: data.displayText || undefined
    };

    // 设置超链接
    cell.hyperlink = normalizedData;

    // 如果有显示文本，更新单元格内容
    if (normalizedData.displayText) {
      cell.content = normalizedData.displayText;
    } else if (!cell.content) {
      // 单元格无内容时，使用 URL 作为显示文本
      cell.content = normalizedData.url;
    }

    // 记录历史操作
    this.historyManager.record({
      type: 'setHyperlink',
      data: { row, col, hyperlink: normalizedData, content: cell.content },
      undoData: { row, col, hyperlink: oldHyperlink, content: oldContent }
    });

    // 重新渲染
    this.renderer.render();
  }

  /**
   * 获取单元格超链接
   * 返回超链接数据，无超链接时返回 null
   */
  public getHyperlink(row: number, col: number): HyperlinkData | null {
    const cell = this.model.getCell(row, col);
    if (!cell || !cell.hyperlink) return null;
    return { ...cell.hyperlink };
  }

  /**
   * 移除单元格超链接
   * 清除 hyperlink 字段，保留单元格内容不变
   */
  public removeHyperlink(row: number, col: number): void {
    const cell = this.model.getCell(row, col);
    if (!cell || !cell.hyperlink) return;

    // 保存旧数据用于撤销
    const oldHyperlink = { ...cell.hyperlink };

    // 清除超链接
    cell.hyperlink = undefined;

    // 记录历史操作
    this.historyManager.record({
      type: 'removeHyperlink',
      data: { row, col },
      undoData: { row, col, hyperlink: oldHyperlink }
    });

    // 重新渲染
    this.renderer.render();
  }

  /**
   * 打开超链接
   * 在新浏览器标签页中打开单元格的超链接 URL
   */
  public openHyperlink(row: number, col: number): void {
    const hyperlink = this.getHyperlink(row, col);
    if (!hyperlink) return;

    window.open(hyperlink.url, '_blank');
  }

  /**
   * 规范化 URL
   * 如果 URL 不以 http://、https:// 或 mailto: 开头，自动添加 https:// 前缀
   */
  public normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;

    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.startsWith('mailto:')
    ) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  /**
   * 显示插入/编辑超链接对话框
   * 包含 URL 输入框和显示文本输入框
   */
  public showDialog(row: number, col: number): void {
    const existingHyperlink = this.getHyperlink(row, col);
    const cell = this.model.getCell(row, col);
    const isEdit = existingHyperlink !== null;

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';

    // 标题
    const titleEl = document.createElement('div');
    titleEl.className = 'modal-title';
    titleEl.textContent = isEdit ? '编辑超链接' : '插入超链接';
    dialog.appendChild(titleEl);

    // 内容区域
    const body = document.createElement('div');
    body.className = 'modal-body';

    // URL 标签和输入框
    const urlLabel = document.createElement('label');
    urlLabel.className = 'hyperlink-dialog-label';
    urlLabel.textContent = '链接地址';
    body.appendChild(urlLabel);

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'modal-input';
    urlInput.placeholder = '请输入 URL，例如 www.example.com';
    urlInput.value = existingHyperlink?.url || '';
    body.appendChild(urlInput);

    // 错误提示
    const errorTip = document.createElement('div');
    errorTip.className = 'hyperlink-dialog-error';
    errorTip.textContent = '';
    errorTip.style.display = 'none';
    body.appendChild(errorTip);

    // 显示文本标签和输入框
    const textLabel = document.createElement('label');
    textLabel.className = 'hyperlink-dialog-label';
    textLabel.textContent = '显示文本';
    body.appendChild(textLabel);

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'modal-input';
    textInput.placeholder = '留空则显示链接地址';
    textInput.value = existingHyperlink?.displayText || cell?.content || '';
    body.appendChild(textInput);

    dialog.appendChild(body);

    // 按钮区域
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn modal-cancel-btn';
    cancelBtn.textContent = '取消';
    footer.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'modal-btn modal-confirm-btn';
    confirmBtn.textContent = '确定';
    footer.appendChild(confirmBtn);

    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 自动聚焦 URL 输入框
    requestAnimationFrame(() => {
      urlInput.focus();
      urlInput.select();
    });

    /** 确认操作 */
    const handleConfirm = (): void => {
      const url = urlInput.value.trim();
      if (!url) {
        errorTip.textContent = '请输入有效的 URL';
        errorTip.style.display = 'block';
        urlInput.focus();
        return;
      }

      const displayText = textInput.value.trim() || undefined;
      this.setHyperlink(row, col, { url, displayText });
      cleanup();
    };

    /** 取消操作 */
    const handleCancel = (): void => {
      cleanup();
    };

    /** 清理 DOM 和事件 */
    const cleanup = (): void => {
      document.removeEventListener('keydown', handleKeyDown);
      // 关闭动画
      overlay.classList.add('modal-closing');
      const handleTransitionEnd = (): void => {
        overlay.removeEventListener('transitionend', handleTransitionEnd);
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      };
      overlay.addEventListener('transitionend', handleTransitionEnd);
      // 兜底：200ms 后强制移除
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 200);
    };

    /** 键盘事件 */
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };

    // 绑定事件
    document.addEventListener('keydown', handleKeyDown);
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);

    // 点击遮罩关闭
    overlay.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.target === overlay) {
        handleCancel();
      }
    });

    // URL 输入时清除错误提示
    urlInput.addEventListener('input', () => {
      errorTip.style.display = 'none';
    });
  }
}
