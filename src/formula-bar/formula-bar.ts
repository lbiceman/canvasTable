// ============================================================
// 公式栏主组件（FormulaBar）
// 集成 SyntaxHighlighter 实现实时语法高亮
// 集成 AutoComplete 实现函数自动补全
// 实现函数参数说明提示和数组公式花括号标识
// Requirements: 7.1-7.10, 8.2
// ============================================================

import { SyntaxHighlighter } from './syntax-highlighter';
import type { HighlightType } from './syntax-highlighter';
import { AutoComplete } from './autocomplete';
import type { AutoCompleteSuggestion } from './autocomplete';
import type { FunctionRegistry } from '../formula/function-registry';
import type { NamedRangeManager } from '../formula/named-range';
import type { FunctionParam } from '../formula/types';

// ============================================================
// 类型定义
// ============================================================

/** 输入变化回调 */
type InputCallback = (value: string) => void;

/** 确认/取消回调 */
type ActionCallback = () => void;

/** 参数提示信息 */
interface ParamHintInfo {
  /** 函数名 */
  functionName: string;
  /** 参数列表 */
  params: FunctionParam[];
  /** 当前参数索引 */
  activeIndex: number;
}

/** 高亮类型到 CSS 颜色的映射 */
const HIGHLIGHT_COLORS: Record<HighlightType, string> = {
  function: '#795E26',
  cellRef: '#0070C1',
  rangeRef: '#0070C1',
  number: '#098658',
  string: '#A31515',
  operator: '#000000',
  paren: '#000000',
  text: '#000000',
};

// ============================================================
// FormulaBar 类
// ============================================================

/**
 * 公式栏主组件
 * - 名称框显示当前单元格地址
 * - 公式输入区域支持语法高亮
 * - 自动补全下拉列表
 * - 参数提示浮层
 * - 数组公式花括号标识
 */
export class FormulaBar {
  /** 外层容器 */
  private container: HTMLElement;
  /** 名称框 */
  private nameBox: HTMLInputElement;
  /** 公式输入框 */
  private input: HTMLInputElement;
  /** 语法高亮覆盖层 */
  private highlightOverlay: HTMLDivElement;
  /** 自动补全下拉列表 */
  private dropdownEl: HTMLDivElement;
  /** 参数提示浮层 */
  private paramHintEl: HTMLDivElement;

  /** 语法高亮器 */
  private highlighter: SyntaxHighlighter;
  /** 自动补全组件 */
  private autoComplete: AutoComplete;
  /** 函数注册表 */
  private functionRegistry: FunctionRegistry;

  /** 是否为数组公式 */
  private isArrayFormula: boolean = false;

  /** 回调列表 */
  private inputCallbacks: InputCallback[] = [];
  private confirmCallbacks: ActionCallback[] = [];
  private cancelCallbacks: ActionCallback[] = [];

  /** 事件处理器引用（用于 destroy 时移除） */
  private boundHandleInput: () => void;
  private boundHandleKeyDown: (e: KeyboardEvent) => void;
  private boundHandleBlur: () => void;

  constructor(
    container: HTMLElement,
    registry: FunctionRegistry,
    namedRangeManager: NamedRangeManager
  ) {
    this.container = container;
    this.functionRegistry = registry;
    this.highlighter = new SyntaxHighlighter();
    this.autoComplete = new AutoComplete(registry, namedRangeManager);

    // 创建 DOM 结构
    this.nameBox = this.createNameBox();
    this.input = this.createInput();
    this.highlightOverlay = this.createHighlightOverlay();
    this.dropdownEl = this.createDropdown();
    this.paramHintEl = this.createParamHint();

    // 组装 DOM
    const barEl = document.createElement('div');
    barEl.className = 'formula-bar';

    barEl.appendChild(this.nameBox);

    // 公式输入区域容器
    const inputArea = document.createElement('div');
    inputArea.className = 'formula-input-area';
    inputArea.style.position = 'relative';
    inputArea.style.flex = '1';
    inputArea.appendChild(this.highlightOverlay);
    inputArea.appendChild(this.input);
    inputArea.appendChild(this.dropdownEl);
    inputArea.appendChild(this.paramHintEl);

    barEl.appendChild(inputArea);
    this.container.appendChild(barEl);

    // 绑定事件
    this.boundHandleInput = this.handleInput.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleBlur = this.handleBlur.bind(this);

    this.input.addEventListener('input', this.boundHandleInput);
    this.input.addEventListener('keydown', this.boundHandleKeyDown);
    this.input.addEventListener('blur', this.boundHandleBlur);
  }

  // ============================================================
  // 公共 API
  // ============================================================

  /**
   * 设置公式栏内容
   * 数组公式时在显示中添加花括号
   */
  setValue(value: string, isArrayFormula: boolean = false): void {
    this.isArrayFormula = isArrayFormula;
    if (isArrayFormula && value.startsWith('=')) {
      // 数组公式显示花括号：{=SUM(...)}
      this.input.value = `{${value}}`;
    } else {
      this.input.value = value;
    }
    this.updateHighlight();
  }

  /**
   * 获取当前输入值
   * 数组公式时去除花括号返回原始公式
   */
  getValue(): string {
    const raw = this.input.value;
    if (this.isArrayFormula && raw.startsWith('{=') && raw.endsWith('}')) {
      return raw.slice(1, -1);
    }
    return raw;
  }

  /** 设置名称框显示 */
  setNameBox(address: string): void {
    this.nameBox.value = address;
  }

  /** 获取名称框当前值 */
  getNameBox(): string {
    return this.nameBox.value;
  }

  /** 聚焦公式栏输入框 */
  focus(): void {
    this.input.focus();
  }

  /** 失焦 */
  blur(): void {
    this.input.blur();
  }

  /** 注册输入变化回调 */
  onInput(callback: InputCallback): void {
    this.inputCallbacks.push(callback);
  }

  /** 注册确认（Enter）回调 */
  onConfirm(callback: ActionCallback): void {
    this.confirmCallbacks.push(callback);
  }

  /** 注册取消（Escape）回调 */
  onCancel(callback: ActionCallback): void {
    this.cancelCallbacks.push(callback);
  }

  /** 清理事件监听器和 DOM */
  destroy(): void {
    this.input.removeEventListener('input', this.boundHandleInput);
    this.input.removeEventListener('keydown', this.boundHandleKeyDown);
    this.input.removeEventListener('blur', this.boundHandleBlur);
    // 清空回调
    this.inputCallbacks = [];
    this.confirmCallbacks = [];
    this.cancelCallbacks = [];
  }

  /** 获取自动补全组件（供测试使用） */
  getAutoComplete(): AutoComplete {
    return this.autoComplete;
  }

  /** 获取输入框元素（供测试使用） */
  getInputElement(): HTMLInputElement {
    return this.input;
  }

  /** 获取下拉列表元素（供测试使用） */
  getDropdownElement(): HTMLDivElement {
    return this.dropdownEl;
  }

  /** 获取参数提示元素（供测试使用） */
  getParamHintElement(): HTMLDivElement {
    return this.paramHintEl;
  }

  /** 获取高亮覆盖层元素（供测试使用） */
  getHighlightOverlay(): HTMLDivElement {
    return this.highlightOverlay;
  }

  /** 获取名称框元素（供外部交互使用） */
  getNameBoxElement(): HTMLInputElement {
    return this.nameBox;
  }


  // ============================================================
  // DOM 创建方法
  // ============================================================

  /** 创建名称框 */
  private createNameBox(): HTMLInputElement {
    const nameBox = document.createElement('input');
    nameBox.className = 'name-box';
    nameBox.type = 'text';
    nameBox.readOnly = true;
    return nameBox;
  }

  /** 创建公式输入框 */
  private createInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.className = 'formula-input';
    input.type = 'text';
    input.style.position = 'relative';
    input.style.zIndex = '1';
    input.style.background = 'transparent';
    input.style.color = 'transparent';
    input.style.caretColor = 'black';
    return input;
  }

  /** 创建语法高亮覆盖层 */
  private createHighlightOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'highlight-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.whiteSpace = 'pre';
    return overlay;
  }

  /** 创建自动补全下拉列表 */
  private createDropdown(): HTMLDivElement {
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.zIndex = '100';
    return dropdown;
  }

  /** 创建参数提示浮层 */
  private createParamHint(): HTMLDivElement {
    const hint = document.createElement('div');
    hint.className = 'param-hint';
    hint.style.display = 'none';
    hint.style.position = 'absolute';
    hint.style.zIndex = '99';
    return hint;
  }

  // ============================================================
  // 事件处理
  // ============================================================

  /** 处理输入事件 */
  private handleInput(): void {
    const value = this.getValue();
    // 更新语法高亮
    this.updateHighlight();
    // 更新自动补全
    this.updateAutoComplete();
    // 更新参数提示
    this.updateParamHint();
    // 通知回调
    for (const cb of this.inputCallbacks) {
      cb(value);
    }
  }

  /** 处理键盘事件 */
  private handleKeyDown(e: KeyboardEvent): void {
    // 自动补全可见时，拦截导航键
    if (this.autoComplete.isVisible) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.autoComplete.moveDown();
          this.renderDropdown();
          return;
        case 'ArrowUp':
          e.preventDefault();
          this.autoComplete.moveUp();
          this.renderDropdown();
          return;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          this.confirmAutoComplete();
          return;
        case 'Escape':
          e.preventDefault();
          this.autoComplete.dismiss();
          this.hideDropdown();
          return;
      }
    }

    // 非自动补全状态下的键盘处理
    switch (e.key) {
      case 'Enter':
        for (const cb of this.confirmCallbacks) {
          cb();
        }
        break;
      case 'Escape':
        for (const cb of this.cancelCallbacks) {
          cb();
        }
        break;
    }
  }

  /** 处理失焦事件 */
  private handleBlur(): void {
    // 延迟关闭，允许点击下拉列表
    setTimeout(() => {
      this.autoComplete.dismiss();
      this.hideDropdown();
      this.hideParamHint();
    }, 150);
  }

  // ============================================================
  // 语法高亮
  // ============================================================

  /** 更新语法高亮覆盖层 */
  private updateHighlight(): void {
    const value = this.input.value;
    // 清空覆盖层
    this.highlightOverlay.innerHTML = '';

    if (!value) {
      return;
    }

    // 获取高亮 token
    const tokens = this.highlighter.highlight(value);
    // 渲染带颜色的 span 元素
    for (const token of tokens) {
      const span = document.createElement('span');
      span.textContent = token.text;
      span.style.color = HIGHLIGHT_COLORS[token.type];
      this.highlightOverlay.appendChild(span);
    }
  }

  // ============================================================
  // 自动补全
  // ============================================================

  /** 更新自动补全候选列表 */
  private updateAutoComplete(): void {
    const value = this.input.value;
    const cursorPos = this.input.selectionStart ?? value.length;

    // 提取当前正在输入的函数名前缀
    const prefix = this.extractFunctionPrefix(value, cursorPos);

    if (prefix && prefix.length > 0) {
      this.autoComplete.search(prefix);
      if (this.autoComplete.isVisible) {
        this.renderDropdown();
        this.showDropdown();
      } else {
        this.hideDropdown();
      }
    } else {
      this.autoComplete.dismiss();
      this.hideDropdown();
    }
  }

  /**
   * 从输入值和光标位置提取函数名前缀
   * 向左扫描直到遇到非字母字符
   */
  private extractFunctionPrefix(value: string, cursorPos: number): string {
    let start = cursorPos;
    while (start > 0 && /[a-zA-Z]/.test(value[start - 1])) {
      start--;
    }
    const prefix = value.slice(start, cursorPos);
    // 只有在 = 号之后才触发自动补全
    if (!value.includes('=')) {
      return '';
    }
    return prefix;
  }

  /** 确认自动补全选中项 */
  private confirmAutoComplete(): void {
    const selected = this.autoComplete.confirm();
    if (!selected) return;

    const value = this.input.value;
    const cursorPos = this.input.selectionStart ?? value.length;

    // 找到前缀的起始位置
    let start = cursorPos;
    while (start > 0 && /[a-zA-Z]/.test(value[start - 1])) {
      start--;
    }

    // 构建插入文本：函数名 + 左括号，命名范围只插入名称
    const insertText = selected.source === 'function'
      ? `${selected.name}(`
      : selected.name;

    // 替换前缀为完整函数名
    const newValue = value.slice(0, start) + insertText + value.slice(cursorPos);
    this.input.value = newValue;

    // 设置光标位置
    const newCursorPos = start + insertText.length;
    this.input.setSelectionRange(newCursorPos, newCursorPos);

    // 更新高亮和参数提示
    this.updateHighlight();
    this.updateParamHint();
    this.hideDropdown();

    // 触发输入回调
    const currentValue = this.getValue();
    for (const cb of this.inputCallbacks) {
      cb(currentValue);
    }
  }

  /** 渲染下拉列表 */
  private renderDropdown(): void {
    const suggestions = this.autoComplete.getSuggestions();
    const selectedIndex = this.autoComplete.getSelectedIndex();

    this.dropdownEl.innerHTML = '';

    suggestions.forEach((suggestion: AutoCompleteSuggestion, index: number) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      if (index === selectedIndex) {
        item.classList.add('selected');
      }

      // 函数名
      const nameSpan = document.createElement('span');
      nameSpan.className = 'autocomplete-name';
      nameSpan.textContent = suggestion.name;
      item.appendChild(nameSpan);

      // 类别
      const categorySpan = document.createElement('span');
      categorySpan.className = 'autocomplete-category';
      categorySpan.textContent = suggestion.category;
      item.appendChild(categorySpan);

      // 描述
      const descSpan = document.createElement('span');
      descSpan.className = 'autocomplete-desc';
      descSpan.textContent = suggestion.description;
      item.appendChild(descSpan);

      // 点击选择
      item.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        // 设置选中索引后确认
        while (this.autoComplete.getSelectedIndex() !== index) {
          this.autoComplete.moveDown();
        }
        this.confirmAutoComplete();
      });

      this.dropdownEl.appendChild(item);
    });
  }

  /** 显示下拉列表 */
  private showDropdown(): void {
    this.dropdownEl.style.display = 'block';
  }

  /** 隐藏下拉列表 */
  private hideDropdown(): void {
    this.dropdownEl.style.display = 'none';
  }

  // ============================================================
  // 参数提示
  // ============================================================

  /** 更新参数提示 */
  private updateParamHint(): void {
    const value = this.input.value;
    const cursorPos = this.input.selectionStart ?? value.length;

    const hintInfo = this.detectParamContext(value, cursorPos);
    if (hintInfo) {
      this.renderParamHint(hintInfo);
      this.showParamHint();
    } else {
      this.hideParamHint();
    }
  }

  /**
   * 检测光标是否在函数括号内，并返回参数提示信息
   * 从光标位置向左扫描，找到最近的未匹配左括号及其前面的函数名
   */
  private detectParamContext(value: string, cursorPos: number): ParamHintInfo | null {
    let parenDepth = 0;
    let commaCount = 0;

    // 从光标位置向左扫描
    for (let i = cursorPos - 1; i >= 0; i--) {
      const ch = value[i];
      if (ch === ')') {
        parenDepth++;
      } else if (ch === '(') {
        if (parenDepth === 0) {
          // 找到未匹配的左括号，提取前面的函数名
          let funcEnd = i;
          let funcStart = funcEnd;
          while (funcStart > 0 && /[a-zA-Z]/.test(value[funcStart - 1])) {
            funcStart--;
          }
          const funcName = value.slice(funcStart, funcEnd).toUpperCase();
          if (funcName.length === 0) return null;

          // 从注册表获取函数定义
          const funcDef = this.functionRegistry.get(funcName);
          if (!funcDef) return null;

          return {
            functionName: funcDef.name,
            params: funcDef.params,
            activeIndex: commaCount,
          };
        }
        parenDepth--;
      } else if (ch === ',' && parenDepth === 0) {
        commaCount++;
      }
    }

    return null;
  }

  /** 渲染参数提示 */
  private renderParamHint(info: ParamHintInfo): void {
    this.paramHintEl.innerHTML = '';

    // 函数名标题
    const titleSpan = document.createElement('span');
    titleSpan.className = 'param-hint-title';
    titleSpan.textContent = `${info.functionName}(`;
    this.paramHintEl.appendChild(titleSpan);

    // 参数列表
    info.params.forEach((param: FunctionParam, index: number) => {
      if (index > 0) {
        const comma = document.createElement('span');
        comma.textContent = ', ';
        this.paramHintEl.appendChild(comma);
      }

      const paramSpan = document.createElement('span');
      paramSpan.className = 'param-hint-param';
      const optionalMark = param.optional ? '?' : '';
      paramSpan.textContent = `${param.name}${optionalMark}`;

      // 高亮当前参数
      if (index === info.activeIndex) {
        paramSpan.classList.add('active');
        paramSpan.style.fontWeight = 'bold';
      }

      // 添加参数描述 tooltip
      paramSpan.title = param.description;
      this.paramHintEl.appendChild(paramSpan);
    });

    const closeParen = document.createElement('span');
    closeParen.textContent = ')';
    this.paramHintEl.appendChild(closeParen);

    // 如果有当前参数的描述，显示在下方
    if (info.activeIndex < info.params.length) {
      const activeParam = info.params[info.activeIndex];
      const descDiv = document.createElement('div');
      descDiv.className = 'param-hint-desc';
      descDiv.textContent = `${activeParam.name}: ${activeParam.description}`;
      this.paramHintEl.appendChild(descDiv);
    }
  }

  /** 显示参数提示 */
  private showParamHint(): void {
    this.paramHintEl.style.display = 'block';
  }

  /** 隐藏参数提示 */
  private hideParamHint(): void {
    this.paramHintEl.style.display = 'none';
  }
}
