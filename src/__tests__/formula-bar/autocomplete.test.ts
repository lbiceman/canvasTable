// ============================================================
// 自动补全组件单元测试
// Requirements: 7.2, 7.3, 7.5, 7.6, 7.7, 9.9
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { AutoComplete } from '../../formula-bar/autocomplete';
import { FunctionRegistry } from '../../formula/function-registry';
import { NamedRangeManager } from '../../formula/named-range';
import type { FunctionDefinition, FormulaValue, EvaluationContext } from '../../formula/types';

/** 创建测试用的空函数处理器 */
const noop = (_args: FormulaValue[], _ctx: EvaluationContext): FormulaValue => 0;

/** 创建测试用的函数定义 */
function createFuncDef(
  name: string,
  category: FunctionDefinition['category'],
  description: string
): FunctionDefinition {
  return {
    name,
    category,
    description,
    minArgs: 1,
    maxArgs: -1,
    params: [],
    handler: noop,
  };
}

describe('AutoComplete', () => {
  let registry: FunctionRegistry;
  let namedRangeManager: NamedRangeManager;
  let autoComplete: AutoComplete;

  beforeEach(() => {
    registry = new FunctionRegistry();
    namedRangeManager = new NamedRangeManager();

    // 注册一些测试函数
    registry.register(createFuncDef('SUM', 'math', '求和'));
    registry.register(createFuncDef('SUMIF', 'statistics', '条件求和'));
    registry.register(createFuncDef('SUMIFS', 'statistics', '多条件求和'));
    registry.register(createFuncDef('SUBSTITUTE', 'text', '文本替换'));
    registry.register(createFuncDef('SQRT', 'math', '平方根'));
    registry.register(createFuncDef('COUNT', 'statistics', '计数'));
    registry.register(createFuncDef('COUNTA', 'statistics', '非空计数'));
    registry.register(createFuncDef('COUNTIF', 'statistics', '条件计数'));
    registry.register(createFuncDef('CONCATENATE', 'text', '文本连接'));
    registry.register(createFuncDef('ABS', 'math', '绝对值'));
    registry.register(createFuncDef('AVERAGE', 'math', '平均值'));
    registry.register(createFuncDef('AVERAGEIF', 'statistics', '条件平均值'));

    autoComplete = new AutoComplete(registry, namedRangeManager);
  });

  describe('search - 前缀搜索', () => {
    it('应根据前缀返回匹配的函数候选项', () => {
      const results = autoComplete.search('SU');
      const names = results.map((s) => s.name);
      expect(names).toContain('SUM');
      expect(names).toContain('SUMIF');
      expect(names).toContain('SUMIFS');
      expect(names).toContain('SUBSTITUTE');
      // 不应包含不匹配的函数
      expect(names).not.toContain('COUNT');
      expect(names).not.toContain('ABS');
    });

    it('搜索应不区分大小写', () => {
      const results = autoComplete.search('su');
      const names = results.map((s) => s.name);
      expect(names).toContain('SUM');
      expect(names).toContain('SUMIF');
    });

    it('搜索 CO 应返回 COUNT、COUNTA、COUNTIF、CONCATENATE', () => {
      const results = autoComplete.search('CO');
      const names = results.map((s) => s.name);
      expect(names).toContain('COUNT');
      expect(names).toContain('COUNTA');
      expect(names).toContain('COUNTIF');
      expect(names).toContain('CONCATENATE');
      expect(names).not.toContain('SUM');
    });

    it('空前缀应返回空列表', () => {
      const results = autoComplete.search('');
      expect(results).toHaveLength(0);
      expect(autoComplete.isVisible).toBe(false);
    });

    it('纯空格前缀应返回空列表', () => {
      const results = autoComplete.search('   ');
      expect(results).toHaveLength(0);
      expect(autoComplete.isVisible).toBe(false);
    });

    it('无匹配时应返回空列表', () => {
      const results = autoComplete.search('XYZ');
      expect(results).toHaveLength(0);
      expect(autoComplete.isVisible).toBe(false);
    });

    it('搜索 A 应返回 ABS、AVERAGE、AVERAGEIF', () => {
      const results = autoComplete.search('A');
      const names = results.map((s) => s.name);
      expect(names).toContain('ABS');
      expect(names).toContain('AVERAGE');
      expect(names).toContain('AVERAGEIF');
    });
  });

  describe('search - 命名范围候选项', () => {
    beforeEach(() => {
      // 创建一些命名范围
      namedRangeManager.create('Sales', {
        range: { type: 'RangeReference', startRow: 0, startCol: 0, endRow: 99, endCol: 0 },
      });
      namedRangeManager.create('SalesTotal', {
        range: { type: 'RangeReference', startRow: 0, startCol: 1, endRow: 99, endCol: 1 },
      });
      namedRangeManager.create('Revenue', {
        range: { type: 'RangeReference', startRow: 0, startCol: 2, endRow: 99, endCol: 2 },
      });
    });

    it('应搜索到匹配的命名范围', () => {
      const results = autoComplete.search('Sa');
      const names = results.map((s) => s.name);
      expect(names).toContain('Sales');
      expect(names).toContain('SalesTotal');
      expect(names).not.toContain('Revenue');
    });

    it('命名范围候选项的 source 应为 namedRange', () => {
      const results = autoComplete.search('Rev');
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('namedRange');
      expect(results[0].category).toBe('namedRange');
      expect(results[0].name).toBe('Revenue');
    });

    it('应同时返回函数和命名范围候选项', () => {
      const results = autoComplete.search('S');
      const funcResults = results.filter((s) => s.source === 'function');
      const rangeResults = results.filter((s) => s.source === 'namedRange');
      // 应有 SUM、SUMIF、SUMIFS、SUBSTITUTE、SQRT 等函数
      expect(funcResults.length).toBeGreaterThan(0);
      // 应有 Sales、SalesTotal 命名范围
      expect(rangeResults.length).toBeGreaterThan(0);
    });

    it('函数候选项应排在命名范围候选项之前', () => {
      const results = autoComplete.search('S');
      // 找到第一个命名范围的位置
      const firstRangeIdx = results.findIndex((s) => s.source === 'namedRange');
      // 找到最后一个函数的位置
      const lastFuncIdx = results.reduce(
        (acc, s, i) => (s.source === 'function' ? i : acc),
        -1
      );
      // 所有函数应在命名范围之前
      if (firstRangeIdx !== -1 && lastFuncIdx !== -1) {
        expect(lastFuncIdx).toBeLessThan(firstRangeIdx);
      }
    });
  });

  describe('search - 候选项信息完整性', () => {
    it('函数候选项应包含名称、类别和描述', () => {
      const results = autoComplete.search('SUM');
      const sumSuggestion = results.find((s) => s.name === 'SUM');
      expect(sumSuggestion).toBeDefined();
      expect(sumSuggestion!.category).toBe('math');
      expect(sumSuggestion!.description).toBe('求和');
      expect(sumSuggestion!.source).toBe('function');
    });
  });

  describe('isVisible 状态', () => {
    it('初始状态应不可见', () => {
      expect(autoComplete.isVisible).toBe(false);
    });

    it('搜索到结果后应可见', () => {
      autoComplete.search('SU');
      expect(autoComplete.isVisible).toBe(true);
    });

    it('搜索无结果时应不可见', () => {
      autoComplete.search('XYZ');
      expect(autoComplete.isVisible).toBe(false);
    });

    it('dismiss 后应不可见', () => {
      autoComplete.search('SU');
      expect(autoComplete.isVisible).toBe(true);
      autoComplete.dismiss();
      expect(autoComplete.isVisible).toBe(false);
    });
  });

  describe('键盘导航 - moveDown', () => {
    it('搜索后默认选中第一项（index=0）', () => {
      autoComplete.search('SU');
      expect(autoComplete.getSelectedIndex()).toBe(0);
    });

    it('moveDown 应将选中项向下移动', () => {
      autoComplete.search('SU');
      autoComplete.moveDown();
      expect(autoComplete.getSelectedIndex()).toBe(1);
    });

    it('在最后一项时 moveDown 应循环到第一项', () => {
      const results = autoComplete.search('SU');
      const count = results.length;
      // 移动到最后一项
      for (let i = 0; i < count - 1; i++) {
        autoComplete.moveDown();
      }
      expect(autoComplete.getSelectedIndex()).toBe(count - 1);
      // 再次 moveDown 应循环到 0
      autoComplete.moveDown();
      expect(autoComplete.getSelectedIndex()).toBe(0);
    });

    it('不可见时 moveDown 不应改变状态', () => {
      autoComplete.moveDown();
      expect(autoComplete.getSelectedIndex()).toBe(-1);
    });
  });

  describe('键盘导航 - moveUp', () => {
    it('在第一项时 moveUp 应循环到最后一项', () => {
      const results = autoComplete.search('SU');
      const count = results.length;
      expect(autoComplete.getSelectedIndex()).toBe(0);
      autoComplete.moveUp();
      expect(autoComplete.getSelectedIndex()).toBe(count - 1);
    });

    it('moveUp 应将选中项向上移动', () => {
      autoComplete.search('SU');
      autoComplete.moveDown(); // index = 1
      autoComplete.moveDown(); // index = 2
      autoComplete.moveUp();   // index = 1
      expect(autoComplete.getSelectedIndex()).toBe(1);
    });

    it('不可见时 moveUp 不应改变状态', () => {
      autoComplete.moveUp();
      expect(autoComplete.getSelectedIndex()).toBe(-1);
    });
  });

  describe('confirm - 确认选中项', () => {
    it('应返回当前选中的候选项', () => {
      const results = autoComplete.search('SU');
      const confirmed = autoComplete.confirm();
      expect(confirmed).not.toBeNull();
      expect(confirmed!.name).toBe(results[0].name);
    });

    it('确认后应关闭候选列表', () => {
      autoComplete.search('SU');
      autoComplete.confirm();
      expect(autoComplete.isVisible).toBe(false);
      expect(autoComplete.getSuggestions()).toHaveLength(0);
    });

    it('移动选中项后确认应返回对应项', () => {
      const results = autoComplete.search('SU');
      autoComplete.moveDown(); // 移动到第二项
      const confirmed = autoComplete.confirm();
      expect(confirmed).not.toBeNull();
      expect(confirmed!.name).toBe(results[1].name);
    });

    it('不可见时 confirm 应返回 null', () => {
      const confirmed = autoComplete.confirm();
      expect(confirmed).toBeNull();
    });

    it('dismiss 后 confirm 应返回 null', () => {
      autoComplete.search('SU');
      autoComplete.dismiss();
      const confirmed = autoComplete.confirm();
      expect(confirmed).toBeNull();
    });
  });

  describe('dismiss - 关闭候选列表', () => {
    it('应清空候选列表并重置选中索引', () => {
      autoComplete.search('SU');
      autoComplete.dismiss();
      expect(autoComplete.getSuggestions()).toHaveLength(0);
      expect(autoComplete.getSelectedIndex()).toBe(-1);
      expect(autoComplete.isVisible).toBe(false);
    });

    it('多次 dismiss 不应报错', () => {
      autoComplete.dismiss();
      autoComplete.dismiss();
      expect(autoComplete.isVisible).toBe(false);
    });
  });

  describe('重新搜索应重置状态', () => {
    it('重新搜索应重置选中索引为 0', () => {
      autoComplete.search('SU');
      autoComplete.moveDown();
      autoComplete.moveDown();
      expect(autoComplete.getSelectedIndex()).toBe(2);
      // 重新搜索
      autoComplete.search('CO');
      expect(autoComplete.getSelectedIndex()).toBe(0);
    });

    it('搜索不同前缀应更新候选列表', () => {
      autoComplete.search('SU');
      const suNames = autoComplete.getSuggestions().map((s) => s.name);
      expect(suNames).toContain('SUM');

      autoComplete.search('CO');
      const coNames = autoComplete.getSuggestions().map((s) => s.name);
      expect(coNames).toContain('COUNT');
      expect(coNames).not.toContain('SUM');
    });
  });

  describe('getSuggestions', () => {
    it('初始状态应返回空数组', () => {
      expect(autoComplete.getSuggestions()).toHaveLength(0);
    });

    it('搜索后应返回与 search 相同的结果', () => {
      const searchResults = autoComplete.search('AV');
      const suggestions = autoComplete.getSuggestions();
      expect(suggestions).toEqual(searchResults);
    });
  });
});
