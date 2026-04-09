// ============================================================
// 数据分列功能
// 按分隔符将单元格内容拆分到多列
// ============================================================

import type { SpreadsheetModel } from './model';

/** 分列选项 */
export interface TextToColumnsOptions {
  delimiter: string;       // 分隔符（逗号、制表符、自定义）
  startRow: number;        // 起始行
  startCol: number;        // 起始列
  endRow: number;          // 结束行
}

/**
 * 数据分列引擎
 * 将指定列的单元格内容按分隔符拆分到右侧多列
 */
export class TextToColumnsEngine {
  /**
   * 执行数据分列
   * @param model 数据模型
   * @param options 分列选项
   * @returns 拆分后的最大列数
   */
  static execute(model: SpreadsheetModel, options: TextToColumnsOptions): number {
    const { delimiter, startRow, startCol, endRow } = options;
    let maxCols = 0;

    for (let row = startRow; row <= endRow; row++) {
      const cell = model.getCell(row, startCol);
      const content = cell?.content ?? '';
      if (!content) continue;

      const parts = content.split(delimiter);
      maxCols = Math.max(maxCols, parts.length);

      // 将拆分结果写入右侧列
      for (let i = 0; i < parts.length; i++) {
        const trimmed = parts[i].trim();
        model.setCellContent(row, startCol + i, trimmed);
      }
    }

    return maxCols;
  }

  /** 预览分列结果（不写入模型） */
  static preview(
    model: SpreadsheetModel,
    options: TextToColumnsOptions
  ): string[][] {
    const { delimiter, startRow, startCol, endRow } = options;
    const result: string[][] = [];

    for (let row = startRow; row <= endRow; row++) {
      const cell = model.getCell(row, startCol);
      const content = cell?.content ?? '';
      result.push(content ? content.split(delimiter).map(s => s.trim()) : ['']);
    }

    return result;
  }
}

/**
 * 数据分列对话框
 */
export class TextToColumnsDialog {
  private overlay: HTMLDivElement | null = null;
  private onApply: ((delimiter: string) => void) | null = null;

  /** 显示对话框 */
  show(callback: (delimiter: string) => void): void {
    this.onApply = callback;
    this.render();
  }

  /** 隐藏对话框 */
  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private render(): void {
    this.hide();

    this.overlay = document.createElement('div');
    this.overlay.className = 'sort-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'sort-dialog';

    const title = document.createElement('div');
    title.className = 'sort-dialog-title';
    title.textContent = '数据分列';
    dialog.appendChild(title);

    // 分隔符选择
    const optionsDiv = document.createElement('div');
    optionsDiv.style.padding = '12px 0';

    const delimiters = [
      { value: ',', label: '逗号 (,)' },
      { value: '\t', label: '制表符 (Tab)' },
      { value: ';', label: '分号 (;)' },
      { value: ' ', label: '空格' },
      { value: '|', label: '竖线 (|)' },
    ];

    let selectedDelimiter = ',';

    delimiters.forEach((d, i) => {
      const label = document.createElement('label');
      label.style.display = 'block';
      label.style.padding = '4px 0';
      label.style.cursor = 'pointer';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'delimiter';
      radio.value = d.value;
      if (i === 0) radio.checked = true;
      radio.addEventListener('change', () => {
        selectedDelimiter = d.value;
      });

      label.appendChild(radio);
      label.appendChild(document.createTextNode(` ${d.label}`));
      optionsDiv.appendChild(label);
    });

    // 自定义分隔符
    const customLabel = document.createElement('label');
    customLabel.style.display = 'flex';
    customLabel.style.alignItems = 'center';
    customLabel.style.padding = '4px 0';
    customLabel.style.gap = '8px';

    const customRadio = document.createElement('input');
    customRadio.type = 'radio';
    customRadio.name = 'delimiter';
    customRadio.value = 'custom';

    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.placeholder = '自定义分隔符';
    customInput.style.width = '120px';
    customInput.style.padding = '4px 8px';
    customInput.style.border = '1px solid var(--theme-input-border)';
    customInput.style.borderRadius = '4px';
    customInput.style.background = 'var(--theme-input-bg)';
    customInput.style.color = 'var(--theme-foreground)';

    customRadio.addEventListener('change', () => {
      selectedDelimiter = customInput.value || ',';
    });
    customInput.addEventListener('input', () => {
      if (customRadio.checked) {
        selectedDelimiter = customInput.value || ',';
      }
    });

    customLabel.appendChild(customRadio);
    customLabel.appendChild(document.createTextNode('自定义: '));
    customLabel.appendChild(customInput);
    optionsDiv.appendChild(customLabel);

    dialog.appendChild(optionsDiv);

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
      this.onApply?.(selectedDelimiter);
      this.hide();
    });

    btnBar.appendChild(cancelBtn);
    btnBar.appendChild(applyBtn);
    dialog.appendChild(btnBar);

    this.overlay.appendChild(dialog);
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }
}
