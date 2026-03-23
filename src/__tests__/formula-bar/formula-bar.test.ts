// @vitest-environment jsdom
// ============================================================
// 公式栏主组件单元测试
// Requirements: 7.1-7.10, 8.2
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FormulaBar } from '../../formula-bar/formula-bar';
import { FunctionRegistry } from '../../formula/function-registry';
import { NamedRangeManager } from '../../formula/named-range';
import type { FormulaValue, EvaluationContext } from '../../formula/types';

/** 空函数处理器 */
const noop = (_args: FormulaValue[], _ctx: EvaluationContext): FormulaValue => 0;

/** 创建测试用函数注册表，注册几个常用函数 */
function createTestRegistry(): FunctionRegistry {
  const registry = new FunctionRegistry();
  registry.register({
    name: 'SUM',
    category: 'math',
    description: '对所有参数求和',
    minArgs: 1,
    maxArgs: -1,
    params: [
      { name: 'number1', description: '第一个数值', type: 'number' },
      { name: 'number2', description: '后续数值', type: 'number', optional: true },
    ],
    handler: noop,
  });
  registry.register({
    name: 'SUMIF',
    category: 'statistics',
    description: '条件求和',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'range', description: '条件区域', type: 'range' },
      { name: 'criteria', description: '条件', type: 'any' },
      { name: 'sum_range', description: '求和区域', type: 'range', optional: true },
    ],
    handler: noop,
  });
  registry.register({
    name: 'VLOOKUP',
    category: 'lookup',
    description: '垂直查找',
    minArgs: 3,
    maxArgs: 4,
    params: [
      { name: 'lookup_value', description: '查找值', type: 'any' },
      { name: 'table_array', description: '数据表区域', type: 'range' },
      { name: 'col_index_num', description: '返回列号', type: 'number' },
      { name: 'range_lookup', description: '匹配类型', type: 'boolean', optional: true },
    ],
    handler: noop,
  });
  registry.register({
    name: 'IF',
    category: 'logic',
    description: '条件判断',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'logical_test', description: '条件表达式', type: 'boolean' },
      { name: 'value_if_true', description: '条件为真时的值', type: 'any' },
      { name: 'value_if_false', description: '条件为假时的值', type: 'any', optional: true },
    ],
    handler: noop,
  });
  registry.register({
    name: 'ABS',
    category: 'math',
    description: '绝对值',
    minArgs: 1,
    maxArgs: 1,
    params: [
      { name: 'number', description: '数值', type: 'number' },
    ],
    handler: noop,
  });
  registry.register({
    name: 'COUNT',
    category: 'statistics',
    description: '计数',
    minArgs: 1,
    maxArgs: -1,
    params: [
      { name: 'value1', description: '值或区域', type: 'any' },
    ],
    handler: noop,
  });
  return registry;
}

describe('FormulaBar', () => {
  let container: HTMLElement;
  let registry: FunctionRegistry;
  let namedRangeManager: NamedRangeManager;
  let formulaBar: FormulaBar;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    registry = createTestRegistry();
    namedRangeManager = new NamedRangeManager();
    formulaBar = new FormulaBar(container, registry, namedRangeManager);
  });

  afterEach(() => {
    formulaBar.destroy();
    document.body.removeChild(container);
  });

  // ============================================================
  // DOM 结构测试
  // ============================================================

  describe('DOM 结构', () => {
    it('应创建 formula-bar 容器', () => {
      const barEl = container.querySelector('.formula-bar');
      expect(barEl).not.toBeNull();
    });

    it('应包含名称框 input.name-box', () => {
      const nameBox = container.querySelector('input.name-box');
      expect(nameBox).not.toBeNull();
    });

    it('应包含公式输入框 input.formula-input', () => {
      const input = container.querySelector('input.formula-input');
      expect(input).not.toBeNull();
    });

    it('应包含高亮覆盖层 div.highlight-overlay', () => {
      const overlay = container.querySelector('.highlight-overlay');
      expect(overlay).not.toBeNull();
    });

    it('应包含自动补全下拉列表 div.autocomplete-dropdown', () => {
      const dropdown = container.querySelector('.autocomplete-dropdown');
      expect(dropdown).not.toBeNull();
      expect((dropdown as HTMLElement).style.display).toBe('none');
    });

    it('应包含参数提示浮层 div.param-hint', () => {
      const hint = container.querySelector('.param-hint');
      expect(hint).not.toBeNull();
      expect((hint as HTMLElement).style.display).toBe('none');
    });
  });

  // ============================================================
  // setValue / getValue 测试
  // ============================================================

  describe('setValue / getValue', () => {
    it('应正确设置和获取普通值', () => {
      formulaBar.setValue('Hello');
      expect(formulaBar.getValue()).toBe('Hello');
    });

    it('应正确设置和获取公式', () => {
      formulaBar.setValue('=SUM(A1:A10)');
      expect(formulaBar.getValue()).toBe('=SUM(A1:A10)');
    });

    it('数组公式应显示花括号', () => {
      formulaBar.setValue('=SUM(A1:A10*B1:B10)', true);
      const input = formulaBar.getInputElement();
      expect(input.value).toBe('{=SUM(A1:A10*B1:B10)}');
    });

    it('数组公式 getValue 应去除花括号', () => {
      formulaBar.setValue('=SUM(A1:A10*B1:B10)', true);
      expect(formulaBar.getValue()).toBe('=SUM(A1:A10*B1:B10)');
    });

    it('非数组公式不应添加花括号', () => {
      formulaBar.setValue('=SUM(A1:A10)', false);
      const input = formulaBar.getInputElement();
      expect(input.value).toBe('=SUM(A1:A10)');
    });

    it('空值应正确处理', () => {
      formulaBar.setValue('');
      expect(formulaBar.getValue()).toBe('');
    });

    it('非公式的数组公式标记不应添加花括号', () => {
      formulaBar.setValue('Hello', true);
      const input = formulaBar.getInputElement();
      // 不以 = 开头，不添加花括号
      expect(input.value).toBe('Hello');
    });
  });

  // ============================================================
  // 名称框测试
  // ============================================================

  describe('setNameBox / getNameBox', () => {
    it('应正确设置和获取名称框值', () => {
      formulaBar.setNameBox('A1');
      expect(formulaBar.getNameBox()).toBe('A1');
    });

    it('应支持复杂地址格式', () => {
      formulaBar.setNameBox('Sheet1!B2:C10');
      expect(formulaBar.getNameBox()).toBe('Sheet1!B2:C10');
    });
  });

  // ============================================================
  // 语法高亮测试
  // ============================================================

  describe('语法高亮', () => {
    it('设置公式后应渲染高亮 span 元素', () => {
      formulaBar.setValue('=SUM(A1:B10)');
      const overlay = formulaBar.getHighlightOverlay();
      const spans = overlay.querySelectorAll('span');
      expect(spans.length).toBeGreaterThan(0);
    });

    it('高亮 span 拼接应等于输入值', () => {
      formulaBar.setValue('=SUM(A1:B10)');
      const overlay = formulaBar.getHighlightOverlay();
      const spans = overlay.querySelectorAll('span');
      const text = Array.from(spans).map((s) => s.textContent).join('');
      expect(text).toBe('=SUM(A1:B10)');
    });

    it('空值不应渲染高亮', () => {
      formulaBar.setValue('');
      const overlay = formulaBar.getHighlightOverlay();
      expect(overlay.innerHTML).toBe('');
    });

    it('数组公式应正确高亮（含花括号）', () => {
      formulaBar.setValue('=SUM(A1:A10)', true);
      const overlay = formulaBar.getHighlightOverlay();
      const spans = overlay.querySelectorAll('span');
      const text = Array.from(spans).map((s) => s.textContent).join('');
      expect(text).toBe('{=SUM(A1:A10)}');
    });
  });

  // ============================================================
  // 回调测试
  // ============================================================

  describe('回调注册', () => {
    it('onInput 回调应在输入时触发', () => {
      const callback = vi.fn();
      formulaBar.onInput(callback);

      const input = formulaBar.getInputElement();
      input.value = '=SUM';
      input.dispatchEvent(new Event('input'));

      expect(callback).toHaveBeenCalledWith('=SUM');
    });

    it('onConfirm 回调应在 Enter 键时触发（无自动补全）', () => {
      const callback = vi.fn();
      formulaBar.onConfirm(callback);

      const input = formulaBar.getInputElement();
      input.value = '=1+2';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(callback).toHaveBeenCalled();
    });

    it('onCancel 回调应在 Escape 键时触发（无自动补全）', () => {
      const callback = vi.fn();
      formulaBar.onCancel(callback);

      const input = formulaBar.getInputElement();
      input.value = '=1+2';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(callback).toHaveBeenCalled();
    });

    it('destroy 后回调不应再触发', () => {
      const callback = vi.fn();
      formulaBar.onInput(callback);
      formulaBar.destroy();

      const input = formulaBar.getInputElement();
      input.value = '=SUM';
      input.dispatchEvent(new Event('input'));

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 自动补全集成测试
  // ============================================================

  describe('自动补全集成', () => {
    it('输入函数前缀应显示下拉列表', () => {
      const input = formulaBar.getInputElement();
      input.value = '=SU';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new Event('input'));

      const dropdown = formulaBar.getDropdownElement();
      expect(dropdown.style.display).toBe('block');
      expect(dropdown.children.length).toBeGreaterThan(0);
    });

    it('下拉列表应包含匹配的函数名', () => {
      const input = formulaBar.getInputElement();
      input.value = '=SU';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new Event('input'));

      const dropdown = formulaBar.getDropdownElement();
      const names = Array.from(dropdown.querySelectorAll('.autocomplete-name'))
        .map((el) => el.textContent);
      expect(names).toContain('SUM');
      expect(names).toContain('SUMIF');
    });

    it('无匹配时不应显示下拉列表', () => {
      const input = formulaBar.getInputElement();
      input.value = '=XYZ';
      input.setSelectionRange(4, 4);
      input.dispatchEvent(new Event('input'));

      const dropdown = formulaBar.getDropdownElement();
      expect(dropdown.style.display).toBe('none');
    });

    it('非公式输入不应触发自动补全', () => {
      const input = formulaBar.getInputElement();
      input.value = 'SUM';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new Event('input'));

      const dropdown = formulaBar.getDropdownElement();
      expect(dropdown.style.display).toBe('none');
    });

    it('ArrowDown 应移动选中项', () => {
      const input = formulaBar.getInputElement();
      input.value = '=SU';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new Event('input'));

      // 初始选中第一项
      const ac = formulaBar.getAutoComplete();
      expect(ac.getSelectedIndex()).toBe(0);

      // 按下方向键
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(ac.getSelectedIndex()).toBe(1);
    });

    it('ArrowUp 应移动选中项', () => {
      const input = formulaBar.getInputElement();
      input.value = '=SU';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new Event('input'));

      const ac = formulaBar.getAutoComplete();
      // 按上方向键应循环到最后一项
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      expect(ac.getSelectedIndex()).toBe(ac.getSuggestions().length - 1);
    });

    it('Tab 键应确认选中项并插入函数名和左括号', () => {
      const input = formulaBar.getInputElement();
      input.value = '=SU';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new Event('input'));

      // 确认第一项（SUM）
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));

      // 应插入 SUM(
      expect(input.value).toContain('SUM(');
    });

    it('Enter 键在自动补全可见时应确认选中项', () => {
      const confirmCallback = vi.fn();
      formulaBar.onConfirm(confirmCallback);

      const input = formulaBar.getInputElement();
      input.value = '=SU';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new Event('input'));

      // Enter 应确认自动补全，而不是触发 confirm 回调
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(input.value).toContain('SUM(');
      // confirm 回调不应被触发（被自动补全拦截）
      expect(confirmCallback).not.toHaveBeenCalled();
    });

    it('Escape 键应关闭下拉列表', () => {
      const input = formulaBar.getInputElement();
      input.value = '=SU';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new Event('input'));

      const dropdown = formulaBar.getDropdownElement();
      expect(dropdown.style.display).toBe('block');

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(dropdown.style.display).toBe('none');
    });

    it('下拉列表项应包含类别和描述', () => {
      const input = formulaBar.getInputElement();
      input.value = '=SU';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new Event('input'));

      const dropdown = formulaBar.getDropdownElement();
      const categories = Array.from(dropdown.querySelectorAll('.autocomplete-category'))
        .map((el) => el.textContent);
      const descs = Array.from(dropdown.querySelectorAll('.autocomplete-desc'))
        .map((el) => el.textContent);

      expect(categories.length).toBeGreaterThan(0);
      expect(descs.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 参数提示测试
  // ============================================================

  describe('参数提示', () => {
    it('在函数括号内输入时应显示参数提示', () => {
      const input = formulaBar.getInputElement();
      input.value = '=SUM(';
      input.setSelectionRange(5, 5);
      input.dispatchEvent(new Event('input'));

      const hint = formulaBar.getParamHintElement();
      expect(hint.style.display).toBe('block');
    });

    it('参数提示应包含函数名', () => {
      const input = formulaBar.getInputElement();
      input.value = '=SUM(';
      input.setSelectionRange(5, 5);
      input.dispatchEvent(new Event('input'));

      const hint = formulaBar.getParamHintElement();
      expect(hint.textContent).toContain('SUM');
    });

    it('参数提示应包含参数名称', () => {
      const input = formulaBar.getInputElement();
      input.value = '=VLOOKUP(';
      input.setSelectionRange(9, 9);
      input.dispatchEvent(new Event('input'));

      const hint = formulaBar.getParamHintElement();
      expect(hint.textContent).toContain('lookup_value');
    });

    it('逗号后应高亮下一个参数', () => {
      const input = formulaBar.getInputElement();
      input.value = '=VLOOKUP(A1,';
      input.setSelectionRange(12, 12);
      input.dispatchEvent(new Event('input'));

      const hint = formulaBar.getParamHintElement();
      // 第二个参数应被高亮（有 active 类）
      const activeParams = hint.querySelectorAll('.param-hint-param.active');
      expect(activeParams.length).toBe(1);
      expect(activeParams[0].textContent).toContain('table_array');
    });

    it('第三个参数位置应正确高亮', () => {
      const input = formulaBar.getInputElement();
      input.value = '=VLOOKUP(A1, B1:D10,';
      input.setSelectionRange(20, 20);
      input.dispatchEvent(new Event('input'));

      const hint = formulaBar.getParamHintElement();
      const activeParams = hint.querySelectorAll('.param-hint-param.active');
      expect(activeParams.length).toBe(1);
      expect(activeParams[0].textContent).toContain('col_index_num');
    });

    it('不在函数括号内时不应显示参数提示', () => {
      const input = formulaBar.getInputElement();
      input.value = '=A1+B1';
      input.setSelectionRange(6, 6);
      input.dispatchEvent(new Event('input'));

      const hint = formulaBar.getParamHintElement();
      expect(hint.style.display).toBe('none');
    });

    it('未注册的函数不应显示参数提示', () => {
      const input = formulaBar.getInputElement();
      input.value = '=UNKNOWN(';
      input.setSelectionRange(9, 9);
      input.dispatchEvent(new Event('input'));

      const hint = formulaBar.getParamHintElement();
      expect(hint.style.display).toBe('none');
    });

    it('参数描述应显示在提示中', () => {
      const input = formulaBar.getInputElement();
      input.value = '=VLOOKUP(';
      input.setSelectionRange(9, 9);
      input.dispatchEvent(new Event('input'));

      const hint = formulaBar.getParamHintElement();
      const descEl = hint.querySelector('.param-hint-desc');
      expect(descEl).not.toBeNull();
      expect(descEl!.textContent).toContain('查找值');
    });
  });

  // ============================================================
  // focus / blur 测试
  // ============================================================

  describe('focus / blur', () => {
    it('focus 应聚焦输入框', () => {
      formulaBar.focus();
      expect(document.activeElement).toBe(formulaBar.getInputElement());
    });

    it('blur 应失焦输入框', () => {
      formulaBar.focus();
      formulaBar.blur();
      expect(document.activeElement).not.toBe(formulaBar.getInputElement());
    });
  });

  // ============================================================
  // 命名范围自动补全测试
  // ============================================================

  describe('命名范围自动补全', () => {
    beforeEach(() => {
      namedRangeManager.create('Sales', {
        range: { type: 'RangeReference', startRow: 0, startCol: 0, endRow: 99, endCol: 0 },
      });
    });

    it('输入命名范围前缀应在下拉列表中显示', () => {
      const input = formulaBar.getInputElement();
      input.value = '=Sa';
      input.setSelectionRange(3, 3);
      input.dispatchEvent(new Event('input'));

      const dropdown = formulaBar.getDropdownElement();
      const names = Array.from(dropdown.querySelectorAll('.autocomplete-name'))
        .map((el) => el.textContent);
      expect(names).toContain('Sales');
    });
  });
});
