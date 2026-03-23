// ============================================================
// FunctionRegistry 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { FunctionRegistry } from '../../formula/function-registry';
import type { FunctionDefinition, FormulaValue, EvaluationContext } from '../../formula/types';

/** 创建测试用函数定义 */
const createDef = (name: string, category: 'math' | 'statistics' | 'text' = 'math'): FunctionDefinition => ({
  name,
  category,
  description: `${name} 函数`,
  minArgs: 1,
  maxArgs: 1,
  params: [{ name: 'value', description: '参数', type: 'number' }],
  handler: (args: FormulaValue[], _ctx: EvaluationContext): FormulaValue => args[0],
});

describe('FunctionRegistry', () => {
  let registry: FunctionRegistry;

  beforeEach(() => {
    registry = new FunctionRegistry();
  });

  describe('register / get', () => {
    it('注册后可通过名称获取函数定义', () => {
      const def = createDef('SUM');
      registry.register(def);
      expect(registry.get('SUM')).toBe(def);
    });

    it('获取时不区分大小写', () => {
      const def = createDef('ABS');
      registry.register(def);
      expect(registry.get('abs')).toBe(def);
      expect(registry.get('Abs')).toBe(def);
      expect(registry.get('ABS')).toBe(def);
    });

    it('获取未注册的函数返回 undefined', () => {
      expect(registry.get('NOTEXIST')).toBeUndefined();
    });
  });

  describe('getAllNames', () => {
    it('空注册表返回空数组', () => {
      expect(registry.getAllNames()).toEqual([]);
    });

    it('返回所有已注册函数名（大写）', () => {
      registry.register(createDef('SUM'));
      registry.register(createDef('ABS'));
      registry.register(createDef('MAX'));
      const names = registry.getAllNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('SUM');
      expect(names).toContain('ABS');
      expect(names).toContain('MAX');
    });
  });

  describe('searchByPrefix', () => {
    beforeEach(() => {
      registry.register(createDef('SUM'));
      registry.register(createDef('SUMIF', 'statistics'));
      registry.register(createDef('SUMIFS', 'statistics'));
      registry.register(createDef('SUBSTITUTE', 'text'));
      registry.register(createDef('ABS'));
      registry.register(createDef('AVERAGE'));
    });

    it('按前缀搜索返回匹配的函数定义', () => {
      const results = registry.searchByPrefix('SUM');
      expect(results).toHaveLength(3);
      const names = results.map((d) => d.name);
      expect(names).toContain('SUM');
      expect(names).toContain('SUMIF');
      expect(names).toContain('SUMIFS');
    });

    it('搜索时不区分大小写', () => {
      const results = registry.searchByPrefix('sum');
      expect(results).toHaveLength(3);
    });

    it('前缀 "SU" 匹配 SUM、SUMIF、SUMIFS、SUBSTITUTE', () => {
      const results = registry.searchByPrefix('SU');
      expect(results).toHaveLength(4);
    });

    it('无匹配时返回空数组', () => {
      expect(registry.searchByPrefix('XYZ')).toEqual([]);
    });

    it('空前缀返回所有函数', () => {
      const results = registry.searchByPrefix('');
      expect(results).toHaveLength(6);
    });
  });
});
