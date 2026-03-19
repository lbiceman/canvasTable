import type { RichTextSegment } from './types';

export class InlineEditor {
  private editorElement: HTMLDivElement;
  private inputElement: HTMLTextAreaElement;
  private richTextEditor: HTMLDivElement;
  private isActive: boolean = false;
  private richTextMode: boolean = false;
  private currentRow: number = -1;
  private currentCol: number = -1;
  private saveCallback: ((value: string) => void) | null = null;
  private richTextSaveCallback: ((segments: RichTextSegment[]) => void) | null = null;
  private isSaving: boolean = false;
  private isComposing: boolean = false;

  constructor() {
    // 创建编辑器容器元素
    this.editorElement = document.createElement('div');
    this.editorElement.className = 'inline-editor';
    this.editorElement.style.display = 'none';
    // 使用 textarea 支持多行文本编辑
    this.inputElement = document.createElement('textarea');
    this.inputElement.style.resize = 'none';
    this.inputElement.style.overflow = 'hidden';
    this.inputElement.rows = 1;
    // 创建富文本编辑器（contenteditable div）
    this.richTextEditor = document.createElement('div');
    this.richTextEditor.className = 'rich-text-editor';
    this.richTextEditor.contentEditable = 'true';
    this.richTextEditor.style.display = 'none';
    // 添加输入框和富文本编辑器到容器
    this.editorElement.appendChild(this.inputElement);
    this.editorElement.appendChild(this.richTextEditor);
    // 添加编辑器到文档
    document.body.appendChild(this.editorElement);
    // 初始化事件监听
    this.initEventListeners();
  }

  private initEventListeners(): void {
    // 监听 IME 输入法组合状态，防止 composition 期间触发保存
    this.inputElement.addEventListener('compositionstart', () => {
      this.isComposing = true;
    });
    this.inputElement.addEventListener('compositionend', () => {
      this.isComposing = false;
    });
    this.richTextEditor.addEventListener('compositionstart', () => {
      this.isComposing = true;
    });
    this.richTextEditor.addEventListener('compositionend', () => {
      this.isComposing = false;
    });

    this.inputElement.addEventListener('keydown', (event: KeyboardEvent) => {
      // IME 组合输入期间不处理按键
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Enter' && event.altKey) {
        event.preventDefault();
        this.insertNewlineAtCursor();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        this.save();
      } else if (event.key === 'Escape') {
        this.cancel();
      }
    });
    this.inputElement.addEventListener('blur', () => {
      // IME 组合输入期间不触发保存，等 compositionend 后再处理
      if (this.isComposing) return;
      this.save();
    });

    this.richTextEditor.addEventListener('keydown', (event: KeyboardEvent) => {
      // IME 组合输入期间不处理按键
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Enter' && !event.altKey) {
        event.preventDefault();
        this.save();
      } else if (event.key === 'Escape') {
        this.cancel();
      }
    });
    this.richTextEditor.addEventListener('blur', () => {
      // IME 组合输入期间不触发保存
      if (this.isComposing) return;
      this.save();
    });
  }

  // 显示普通文本编辑器
  public show(
    x: number, y: number, width: number, height: number,
    content: string, row: number, col: number,
    callback: (value: string) => void
  ): void {
    this.currentRow = row;
    this.currentCol = col;
    this.saveCallback = callback;
    this.richTextSaveCallback = null;
    this.richTextMode = false;
    this.isActive = true;
    // 定位编辑器容器
    this.editorElement.style.left = `${x}px`;
    this.editorElement.style.top = `${y}px`;
    this.editorElement.style.width = `${width}px`;
    this.editorElement.style.height = `${height}px`;
    this.editorElement.style.display = 'block';
    // 显示 textarea，隐藏富文本编辑器
    this.inputElement.style.display = 'block';
    this.richTextEditor.style.display = 'none';
    // 设置内容并聚焦
    this.inputElement.value = content;
    this.inputElement.focus();
    this.inputElement.setSelectionRange(content.length, content.length);
  }

  // 显示富文本编辑器
  public showRichText(
    x: number, y: number, width: number, height: number,
    segments: RichTextSegment[], row: number, col: number,
    callback: (segments: RichTextSegment[]) => void
  ): void {
    this.currentRow = row;
    this.currentCol = col;
    this.saveCallback = null;
    this.richTextSaveCallback = callback;
    this.richTextMode = true;
    this.isActive = true;
    // 定位编辑器容器
    this.editorElement.style.left = `${x}px`;
    this.editorElement.style.top = `${y}px`;
    this.editorElement.style.width = `${width}px`;
    this.editorElement.style.height = `${height}px`;
    this.editorElement.style.display = 'block';
    // 隐藏 textarea，显示富文本编辑器
    this.inputElement.style.display = 'none';
    this.richTextEditor.style.display = 'block';
    // 清空并加载富文本内容
    this.richTextEditor.innerHTML = '';
    for (const segment of segments) {
      const span = this.createSpanFromSegment(segment);
      this.richTextEditor.appendChild(span);
    }
    // 如果没有内容，添加空文本节点以便编辑
    if (segments.length === 0) {
      this.richTextEditor.appendChild(document.createTextNode(''));
    }
    // 聚焦并将光标移到末尾
    this.richTextEditor.focus();
    this.moveCursorToEnd(this.richTextEditor);
  }


  // 对选中文本应用样式
  public applyStyleToSelection(style: Partial<RichTextSegment>): void {
    if (!this.richTextMode || !this.isActive) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;
    // 确保选区在富文本编辑器内
    if (!this.richTextEditor.contains(range.commonAncestorContainer)) return;
    // 提取选中内容
    const fragment = range.extractContents();
    // 对片段中的每个节点应用新样式
    const processedNodes = this.applyStyleToFragment(fragment, style);
    // 创建临时容器插回处理后的节点
    const wrapper = document.createElement('span');
    for (const node of processedNodes) {
      wrapper.appendChild(node);
    }
    range.insertNode(wrapper);
    // 展开 wrapper，将子节点提升到父级避免多余嵌套
    while (wrapper.firstChild) {
      wrapper.parentNode?.insertBefore(wrapper.firstChild, wrapper);
    }
    wrapper.parentNode?.removeChild(wrapper);
    this.richTextEditor.focus();
  }

  // 提取编辑后的富文本片段
  public getRichTextSegments(): RichTextSegment[] {
    const segments: RichTextSegment[] = [];
    this.extractSegmentsFromNode(this.richTextEditor, segments, {});
    return this.mergeAdjacentSegments(segments);
  }

  // 判断编辑器是否处于编辑状态
  public isEditing(): boolean {
    return this.isActive;
  }

  // 获取当前编辑的行列
  public getPosition(): { row: number; col: number } {
    return { row: this.currentRow, col: this.currentCol };
  }

  // 判断是否为富文本模式
  public isRichTextMode(): boolean {
    return this.richTextMode;
  }

  // 保存编辑内容
  private save(): void {
    if (!this.isActive || this.isSaving) return;
    this.isSaving = true;
    try {
      if (this.richTextMode && this.richTextSaveCallback) {
        const segments = this.getRichTextSegments();
        this.richTextSaveCallback(segments);
      } else if (this.saveCallback) {
        this.saveCallback(this.inputElement.value);
      }
      this.hide();
    } finally {
      this.isSaving = false;
    }
  }

  // 取消编辑
  private cancel(): void {
    this.hide();
  }

  // 隐藏编辑器
  private hide(): void {
    this.isActive = false;
    this.richTextMode = false;
    this.editorElement.style.display = 'none';
    this.inputElement.style.display = 'none';
    this.richTextEditor.style.display = 'none';
    this.inputElement.value = '';
    this.richTextEditor.innerHTML = '';
    this.saveCallback = null;
    this.richTextSaveCallback = null;
    this.currentRow = -1;
    this.currentCol = -1;
  }

  // 在光标位置插入换行符（Alt+Enter）
  private insertNewlineAtCursor(): void {
    const textarea = this.inputElement;
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    textarea.value = `${value.substring(0, start)}\n${value.substring(end)}`;
    textarea.selectionStart = start + 1;
    textarea.selectionEnd = start + 1;
  }


  // 根据 RichTextSegment 创建带样式的 span 元素
  private createSpanFromSegment(segment: RichTextSegment): HTMLSpanElement {
    const span = document.createElement('span');
    span.textContent = segment.text;
    if (segment.fontBold) span.style.fontWeight = 'bold';
    if (segment.fontItalic) span.style.fontStyle = 'italic';
    if (segment.fontUnderline) span.style.textDecoration = 'underline';
    if (segment.fontColor) span.style.color = segment.fontColor;
    if (segment.fontSize) span.style.fontSize = `${segment.fontSize}px`;
    return span;
  }

  // 将光标移到元素末尾
  private moveCursorToEnd(element: HTMLElement): void {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // 对文档片段中的节点应用样式
  private applyStyleToFragment(fragment: DocumentFragment, style: Partial<RichTextSegment>): Node[] {
    const result: Node[] = [];
    for (const node of Array.from(fragment.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.length === 0) continue;
        const span = document.createElement('span');
        span.textContent = text;
        this.applyStyleToSpan(span, style);
        result.push(span);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const span = document.createElement('span');
        span.textContent = element.textContent || '';
        this.copyInlineStyles(element, span);
        this.applyStyleToSpan(span, style);
        result.push(span);
      }
    }
    return result;
  }

  // 将样式应用到 span 元素
  private applyStyleToSpan(span: HTMLSpanElement, style: Partial<RichTextSegment>): void {
    if (style.fontBold !== undefined) span.style.fontWeight = style.fontBold ? 'bold' : 'normal';
    if (style.fontItalic !== undefined) span.style.fontStyle = style.fontItalic ? 'italic' : 'normal';
    if (style.fontUnderline !== undefined) span.style.textDecoration = style.fontUnderline ? 'underline' : 'none';
    if (style.fontColor !== undefined) span.style.color = style.fontColor;
    if (style.fontSize !== undefined) span.style.fontSize = `${style.fontSize}px`;
  }

  // 复制元素的内联样式到目标元素
  private copyInlineStyles(source: HTMLElement, target: HTMLElement): void {
    if (source.style.fontWeight) target.style.fontWeight = source.style.fontWeight;
    if (source.style.fontStyle) target.style.fontStyle = source.style.fontStyle;
    if (source.style.textDecoration) target.style.textDecoration = source.style.textDecoration;
    if (source.style.color) target.style.color = source.style.color;
    if (source.style.fontSize) target.style.fontSize = source.style.fontSize;
  }


  // 递归遍历 DOM 节点，提取富文本片段
  private extractSegmentsFromNode(
    node: Node, segments: RichTextSegment[], inheritedStyle: Partial<RichTextSegment>
  ): void {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || '';
        if (text.length === 0) continue;
        segments.push({ text, ...this.cleanStyle(inheritedStyle) });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;
        const currentStyle = this.mergeStyles(inheritedStyle, this.extractStyleFromElement(element));
        this.extractSegmentsFromNode(element, segments, currentStyle);
      }
    }
  }

  // 从 HTML 元素提取样式信息
  private extractStyleFromElement(element: HTMLElement): Partial<RichTextSegment> {
    const style: Partial<RichTextSegment> = {};
    const fw = element.style.fontWeight;
    if (fw === 'bold' || fw === '700') style.fontBold = true;
    else if (fw === 'normal' || fw === '400') style.fontBold = false;
    const fs = element.style.fontStyle;
    if (fs === 'italic') style.fontItalic = true;
    else if (fs === 'normal') style.fontItalic = false;
    const td = element.style.textDecoration;
    if (td && td.includes('underline')) style.fontUnderline = true;
    else if (td === 'none') style.fontUnderline = false;
    if (element.style.color) style.fontColor = element.style.color;
    if (element.style.fontSize) {
      const size = parseInt(element.style.fontSize, 10);
      if (!isNaN(size)) style.fontSize = size;
    }
    // 处理语义化标签
    const tag = element.tagName.toLowerCase();
    if (tag === 'b' || tag === 'strong') style.fontBold = true;
    if (tag === 'i' || tag === 'em') style.fontItalic = true;
    if (tag === 'u') style.fontUnderline = true;
    return style;
  }

  // 合并两个样式对象，后者覆盖前者
  private mergeStyles(base: Partial<RichTextSegment>, override: Partial<RichTextSegment>): Partial<RichTextSegment> {
    const merged: Partial<RichTextSegment> = { ...base };
    if (override.fontBold !== undefined) merged.fontBold = override.fontBold;
    if (override.fontItalic !== undefined) merged.fontItalic = override.fontItalic;
    if (override.fontUnderline !== undefined) merged.fontUnderline = override.fontUnderline;
    if (override.fontColor !== undefined) merged.fontColor = override.fontColor;
    if (override.fontSize !== undefined) merged.fontSize = override.fontSize;
    return merged;
  }

  // 清理样式对象，移除 false/undefined 值
  private cleanStyle(style: Partial<RichTextSegment>): Partial<RichTextSegment> {
    const cleaned: Partial<RichTextSegment> = {};
    if (style.fontBold) cleaned.fontBold = true;
    if (style.fontItalic) cleaned.fontItalic = true;
    if (style.fontUnderline) cleaned.fontUnderline = true;
    if (style.fontColor) cleaned.fontColor = style.fontColor;
    if (style.fontSize) cleaned.fontSize = style.fontSize;
    return cleaned;
  }

  // 合并相邻的相同样式片段
  private mergeAdjacentSegments(segments: RichTextSegment[]): RichTextSegment[] {
    if (segments.length === 0) return [];
    const merged: RichTextSegment[] = [segments[0]];
    for (let i = 1; i < segments.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = segments[i];
      if (this.isSameStyle(prev, curr)) {
        prev.text += curr.text;
      } else {
        merged.push(curr);
      }
    }
    return merged;
  }

  // 判断两个片段的样式是否相同
  private isSameStyle(a: RichTextSegment, b: RichTextSegment): boolean {
    return (
      (a.fontBold || false) === (b.fontBold || false) &&
      (a.fontItalic || false) === (b.fontItalic || false) &&
      (a.fontUnderline || false) === (b.fontUnderline || false) &&
      (a.fontColor || '') === (b.fontColor || '') &&
      (a.fontSize || 0) === (b.fontSize || 0)
    );
  }
}
