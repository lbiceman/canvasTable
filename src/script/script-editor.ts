// ============================================================
// ScriptEditor - 脚本编辑器 UI
// 提供代码编辑、语法高亮、运行、保存/加载脚本功能
// 参考 PivotTablePanel 的浮动面板模式
// ============================================================

import { ScriptEngine } from './script-engine';
import type { ScriptResult, SavedScript } from './script-engine';
import { Modal } from '../modal';

/** 语法高亮关键字集合 */
const KEYWORDS = new Set([
  'var', 'let', 'const', 'function', 'return', 'if', 'else',
  'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'new', 'this', 'typeof', 'instanceof', 'in', 'of',
  'true', 'false', 'null', 'undefined', 'try', 'catch', 'finally',
  'throw', 'class', 'extends', 'import', 'export', 'default',
]);

export class ScriptEditor {
  private scriptEngine: ScriptEngine;

  // DOM 元素
  private overlay: HTMLDivElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private lineNumbers: HTMLDivElement | null = null;
  private highlightPre: HTMLPreElement | null = null;
  private outputPanel: HTMLDivElement | null = null;
  private scriptListContainer: HTMLDivElement | null = null;

  constructor(scriptEngine: ScriptEngine) {
    this.scriptEngine = scriptEngine;
  }

  /** 打开脚本编辑器面板 */
  show(): void {
    // 先关闭已有面板
    this.hide();
    this.createPanel();
  }

  /** 关闭面板 */
  hide(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.textarea = null;
    this.lineNumbers = null;
    this.highlightPre = null;
    this.outputPanel = null;
    this.scriptListContainer = null;
  }

  /**
   * 应用语法高亮到代码文本
   * 将代码转换为包含 <span> 标签的 HTML 字符串
   * 高亮规则：关键字(蓝紫色)、字符串(绿色)、注释(灰色)、数字(橙色)
   */
  applySyntaxHighlight(code: string): string {
    // 使用正则逐段匹配，按优先级处理：注释 > 字符串 > 数字 > 关键字
    // 先对整段代码进行 HTML 转义，再替换为高亮 span
    const tokens: Array<{ start: number; end: number; className: string }> = [];

    // 匹配多行注释 /* ... */
    const multiLineCommentRe = /\/\*[\s\S]*?\*\//g;
    let match: RegExpExecArray | null;

    match = multiLineCommentRe.exec(code);
    while (match !== null) {
      tokens.push({ start: match.index, end: match.index + match[0].length, className: 'script-editor-comment' });
      match = multiLineCommentRe.exec(code);
    }

    // 匹配单行注释 // ...
    const singleLineCommentRe = /\/\/[^\n]*/g;
    match = singleLineCommentRe.exec(code);
    while (match !== null) {
      if (!this.isOverlapping(tokens, match.index, match.index + match[0].length)) {
        tokens.push({ start: match.index, end: match.index + match[0].length, className: 'script-editor-comment' });
      }
      match = singleLineCommentRe.exec(code);
    }

    // 匹配字符串（单引号、双引号、模板字符串）
    const stringRe = /`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;
    match = stringRe.exec(code);
    while (match !== null) {
      if (!this.isOverlapping(tokens, match.index, match.index + match[0].length)) {
        tokens.push({ start: match.index, end: match.index + match[0].length, className: 'script-editor-string' });
      }
      match = stringRe.exec(code);
    }

    // 匹配数字
    const numberRe = /\b\d+(\.\d+)?\b/g;
    match = numberRe.exec(code);
    while (match !== null) {
      if (!this.isOverlapping(tokens, match.index, match.index + match[0].length)) {
        tokens.push({ start: match.index, end: match.index + match[0].length, className: 'script-editor-number' });
      }
      match = numberRe.exec(code);
    }

    // 匹配关键字（需要单词边界）
    const keywordRe = /\b[a-zA-Z_]\w*\b/g;
    match = keywordRe.exec(code);
    while (match !== null) {
      if (KEYWORDS.has(match[0]) && !this.isOverlapping(tokens, match.index, match.index + match[0].length)) {
        tokens.push({ start: match.index, end: match.index + match[0].length, className: 'script-editor-keyword' });
      }
      match = keywordRe.exec(code);
    }

    // 按起始位置排序
    tokens.sort((a, b) => a.start - b.start);

    // 构建高亮 HTML
    let result = '';
    let cursor = 0;

    for (const token of tokens) {
      // 添加 token 之前的普通文本
      if (token.start > cursor) {
        result += this.escapeHtml(code.slice(cursor, token.start));
      }
      // 添加高亮 token
      result += `<span class="${token.className}">${this.escapeHtml(code.slice(token.start, token.end))}</span>`;
      cursor = token.end;
    }

    // 添加剩余文本
    if (cursor < code.length) {
      result += this.escapeHtml(code.slice(cursor));
    }

    return result;
  }

  // ============================================================
  // 面板 DOM 创建
  // ============================================================

  /** 创建完整面板 DOM 结构 */
  private createPanel(): void {
    // 遮罩层
    this.overlay = document.createElement('div');
    this.overlay.className = 'script-editor-overlay';

    // 面板容器
    const panel = document.createElement('div');
    panel.className = 'script-editor-panel';

    // 标题栏
    panel.appendChild(this.createTitleBar());

    // 主体区域（左侧编辑器 + 右侧已保存脚本列表）
    const body = document.createElement('div');
    body.className = 'script-editor-body';

    // 左侧：代码编辑区 + 输出面板
    const leftArea = document.createElement('div');
    leftArea.className = 'script-editor-left';

    leftArea.appendChild(this.createCodeEditor());
    leftArea.appendChild(this.createOutputPanel());

    body.appendChild(leftArea);

    // 右侧：已保存脚本列表
    body.appendChild(this.createScriptList());

    panel.appendChild(body);

    // 底部工具栏
    panel.appendChild(this.createToolbar());

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);

    // 点击遮罩层关闭
    this.overlay.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // 加载已保存脚本列表
    this.refreshScriptList();
  }

  /** 创建标题栏 */
  private createTitleBar(): HTMLDivElement {
    const titleBar = document.createElement('div');
    titleBar.className = 'script-editor-title';
    titleBar.textContent = '脚本编辑器';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'script-editor-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.hide());
    titleBar.appendChild(closeBtn);

    return titleBar;
  }

  /** 创建代码编辑区域（行号 + textarea + 高亮层） */
  private createCodeEditor(): HTMLDivElement {
    const editorContainer = document.createElement('div');
    editorContainer.className = 'script-editor-code-area';

    // 行号区域
    this.lineNumbers = document.createElement('div');
    this.lineNumbers.className = 'script-editor-line-numbers';
    this.lineNumbers.textContent = '1';
    editorContainer.appendChild(this.lineNumbers);

    // 代码编辑包装器（高亮层 + textarea 叠加）
    const codeWrapper = document.createElement('div');
    codeWrapper.className = 'script-editor-code-wrapper';

    // 语法高亮层（pre 元素，位于 textarea 下方）
    this.highlightPre = document.createElement('pre');
    this.highlightPre.className = 'script-editor-highlight';
    this.highlightPre.setAttribute('aria-hidden', 'true');
    codeWrapper.appendChild(this.highlightPre);

    // textarea（透明文字，用于实际输入）
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'script-editor-textarea';
    this.textarea.spellcheck = false;
    this.textarea.setAttribute('autocomplete', 'off');
    this.textarea.setAttribute('autocorrect', 'off');
    this.textarea.setAttribute('autocapitalize', 'off');
    this.textarea.placeholder = '// 在此编写脚本...\n// 可用 API: getCellValue, setCellValue, getSelection, setSelection, getRowCount, getColCount\n// 示例: setCellValue(0, 0, "Hello")';

    // 输入事件：更新行号和语法高亮
    this.textarea.addEventListener('input', () => {
      this.updateLineNumbers();
      this.updateHighlight();
    });

    // 滚动同步
    this.textarea.addEventListener('scroll', () => {
      this.syncScroll();
    });

    // Tab 键支持缩进
    this.textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = this.textarea;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
        ta.selectionStart = start + 2;
        ta.selectionEnd = start + 2;
        this.updateLineNumbers();
        this.updateHighlight();
      }
    });

    codeWrapper.appendChild(this.textarea);
    editorContainer.appendChild(codeWrapper);

    return editorContainer;
  }

  /** 创建输出面板 */
  private createOutputPanel(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'script-editor-output-container';

    const label = document.createElement('div');
    label.className = 'script-editor-output-label';
    label.textContent = '输出';
    container.appendChild(label);

    this.outputPanel = document.createElement('div');
    this.outputPanel.className = 'script-editor-output';
    this.outputPanel.textContent = '// 运行脚本后在此显示结果';
    container.appendChild(this.outputPanel);

    return container;
  }

  /** 创建已保存脚本列表 */
  private createScriptList(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'script-editor-script-list';

    const label = document.createElement('div');
    label.className = 'script-editor-list-label';
    label.textContent = '已保存脚本';
    container.appendChild(label);

    this.scriptListContainer = document.createElement('div');
    this.scriptListContainer.className = 'script-editor-list-items';
    container.appendChild(this.scriptListContainer);

    return container;
  }

  /** 创建底部工具栏 */
  private createToolbar(): HTMLDivElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'script-editor-toolbar';

    // 运行按钮
    const runBtn = document.createElement('button');
    runBtn.className = 'script-editor-btn script-editor-btn-primary';
    runBtn.textContent = '▶ 运行';
    runBtn.addEventListener('click', () => this.runScript());
    toolbar.appendChild(runBtn);

    // 保存按钮
    const saveBtn = document.createElement('button');
    saveBtn.className = 'script-editor-btn';
    saveBtn.textContent = '💾 保存';
    saveBtn.addEventListener('click', () => this.saveScript());
    toolbar.appendChild(saveBtn);

    // 清空按钮
    const clearBtn = document.createElement('button');
    clearBtn.className = 'script-editor-btn';
    clearBtn.textContent = '🗑 清空';
    clearBtn.addEventListener('click', () => {
      if (this.textarea) {
        this.textarea.value = '';
        this.updateLineNumbers();
        this.updateHighlight();
      }
    });
    toolbar.appendChild(clearBtn);

    return toolbar;
  }

  // ============================================================
  // 编辑器功能方法
  // ============================================================

  /** 更新行号显示 */
  private updateLineNumbers(): void {
    if (!this.textarea || !this.lineNumbers) return;

    const lines = this.textarea.value.split('\n');
    const lineCount = lines.length;
    const numbers: string[] = [];
    for (let i = 1; i <= lineCount; i++) {
      numbers.push(String(i));
    }
    this.lineNumbers.textContent = numbers.join('\n');
  }

  /** 更新语法高亮层 */
  private updateHighlight(): void {
    if (!this.textarea || !this.highlightPre) return;

    const code = this.textarea.value;
    // 高亮层末尾需要额外换行，确保与 textarea 高度一致
    this.highlightPre.innerHTML = this.applySyntaxHighlight(code) + '\n';
  }

  /** 同步 textarea 和高亮层/行号的滚动位置 */
  private syncScroll(): void {
    if (!this.textarea) return;

    const scrollTop = this.textarea.scrollTop;
    const scrollLeft = this.textarea.scrollLeft;

    if (this.highlightPre) {
      this.highlightPre.scrollTop = scrollTop;
      this.highlightPre.scrollLeft = scrollLeft;
    }
    if (this.lineNumbers) {
      this.lineNumbers.scrollTop = scrollTop;
    }
  }

  // ============================================================
  // 脚本运行与保存
  // ============================================================

  /** 运行当前编辑器中的脚本 */
  private runScript(): void {
    if (!this.textarea || !this.outputPanel) return;

    const code = this.textarea.value.trim();
    if (code === '') {
      this.showOutput('请输入脚本代码', false);
      return;
    }

    const result: ScriptResult = this.scriptEngine.execute(code);

    if (result.success) {
      const messages: string[] = [];
      if (result.output) {
        messages.push(result.output);
      }
      messages.push(`✅ 脚本执行成功，修改了 ${result.cellChanges.length} 个单元格`);
      this.showOutput(messages.join('\n'), true);
    } else {
      const errorMsg = result.error?.message ?? '未知错误';
      const lineInfo = result.error?.line !== undefined ? `（第 ${result.error.line} 行）` : '';
      this.showOutput(`❌ 错误${lineInfo}: ${errorMsg}`, false);
    }
  }

  /** 保存当前脚本 */
  private async saveScript(): Promise<void> {
    if (!this.textarea) return;

    const code = this.textarea.value.trim();
    if (code === '') {
      this.showOutput('请输入脚本代码后再保存', false);
      return;
    }

    const name = await Modal.prompt('请输入脚本名称:');
    if (!name || name.trim() === '') return;

    this.scriptEngine.saveScript(name.trim(), code);
    this.showOutput(`💾 脚本「${name.trim()}」已保存`, true);
    this.refreshScriptList();
  }

  /** 显示输出信息 */
  private showOutput(message: string, success: boolean): void {
    if (!this.outputPanel) return;

    this.outputPanel.textContent = message;
    this.outputPanel.className = success
      ? 'script-editor-output script-editor-output-success'
      : 'script-editor-output script-editor-output-error';
  }

  // ============================================================
  // 已保存脚本列表管理
  // ============================================================

  /** 刷新已保存脚本列表 */
  private refreshScriptList(): void {
    if (!this.scriptListContainer) return;

    this.scriptListContainer.innerHTML = '';
    const scripts: SavedScript[] = this.scriptEngine.loadScripts();

    if (scripts.length === 0) {
      const emptyHint = document.createElement('div');
      emptyHint.className = 'script-editor-list-empty';
      emptyHint.textContent = '暂无已保存的脚本';
      this.scriptListContainer.appendChild(emptyHint);
      return;
    }

    for (const script of scripts) {
      const item = document.createElement('div');
      item.className = 'script-editor-list-item';

      // 脚本名称（点击加载）
      const nameSpan = document.createElement('span');
      nameSpan.className = 'script-editor-list-item-name';
      nameSpan.textContent = script.name;
      nameSpan.title = `更新于: ${script.updatedAt}`;
      nameSpan.addEventListener('click', () => {
        this.loadScript(script);
      });
      item.appendChild(nameSpan);

      // 删除按钮
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'script-editor-list-item-delete';
      deleteBtn.textContent = '×';
      deleteBtn.title = '删除脚本';
      deleteBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        this.deleteScript(script.name);
      });
      item.appendChild(deleteBtn);

      this.scriptListContainer.appendChild(item);
    }
  }

  /** 加载脚本到编辑器 */
  private loadScript(script: SavedScript): void {
    if (!this.textarea) return;

    this.textarea.value = script.code;
    this.updateLineNumbers();
    this.updateHighlight();
    this.showOutput(`已加载脚本「${script.name}」`, true);
  }

  /** 删除已保存的脚本 */
  private async deleteScript(name: string): Promise<void> {
    if (!await Modal.confirm(`确定要删除脚本「${name}」吗？`)) return;

    this.scriptEngine.deleteScript(name);
    this.refreshScriptList();
    this.showOutput(`已删除脚本「${name}」`, true);
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /** HTML 转义 */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** 检查新 token 是否与已有 token 重叠 */
  private isOverlapping(
    tokens: Array<{ start: number; end: number; className: string }>,
    start: number,
    end: number
  ): boolean {
    for (const token of tokens) {
      if (start < token.end && end > token.start) {
        return true;
      }
    }
    return false;
  }
}
