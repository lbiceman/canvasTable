// ============================================================
// DependencyGraph 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../../formula/dependency-graph';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('setDependencies / getDependencies', () => {
    it('设置依赖后可获取依赖列表', () => {
      graph.setDependencies('0,0', ['1,0', '2,0']);
      const deps = graph.getDependencies('0,0');
      expect(deps).toHaveLength(2);
      expect(deps).toContain('1,0');
      expect(deps).toContain('2,0');
    });

    it('未设置依赖的单元格返回空数组', () => {
      expect(graph.getDependencies('0,0')).toEqual([]);
    });

    it('重新设置依赖会替换旧的依赖', () => {
      graph.setDependencies('0,0', ['1,0', '2,0']);
      graph.setDependencies('0,0', ['3,0']);
      const deps = graph.getDependencies('0,0');
      expect(deps).toEqual(['3,0']);
    });

    it('重新设置依赖后旧的反向依赖被清除', () => {
      graph.setDependencies('0,0', ['1,0']);
      graph.setDependencies('0,0', ['2,0']);
      // 1,0 不再被 0,0 依赖
      expect(graph.getDependents('1,0')).toEqual([]);
      // 2,0 被 0,0 依赖
      expect(graph.getDependents('2,0')).toContain('0,0');
    });

    it('设置空依赖列表', () => {
      graph.setDependencies('0,0', ['1,0']);
      graph.setDependencies('0,0', []);
      expect(graph.getDependencies('0,0')).toEqual([]);
      expect(graph.getDependents('1,0')).toEqual([]);
    });
  });

  describe('getDependents', () => {
    it('获取依赖于指定单元格的所有单元格', () => {
      // A1(0,0) 的公式引用了 B1(0,1)
      graph.setDependencies('0,0', ['0,1']);
      // C1(0,2) 的公式也引用了 B1(0,1)
      graph.setDependencies('0,2', ['0,1']);

      const dependents = graph.getDependents('0,1');
      expect(dependents).toHaveLength(2);
      expect(dependents).toContain('0,0');
      expect(dependents).toContain('0,2');
    });

    it('没有被依赖的单元格返回空数组', () => {
      expect(graph.getDependents('5,5')).toEqual([]);
    });
  });

  describe('hasDependencies', () => {
    it('有依赖的单元格返回 true', () => {
      graph.setDependencies('0,0', ['1,0']);
      expect(graph.hasDependencies('0,0')).toBe(true);
    });

    it('没有依赖的单元格返回 false', () => {
      expect(graph.hasDependencies('0,0')).toBe(false);
    });

    it('移除依赖后返回 false', () => {
      graph.setDependencies('0,0', ['1,0']);
      graph.removeDependencies('0,0');
      expect(graph.hasDependencies('0,0')).toBe(false);
    });
  });

  describe('removeDependencies', () => {
    it('移除单元格的所有依赖关系', () => {
      graph.setDependencies('0,0', ['1,0', '2,0']);
      graph.removeDependencies('0,0');
      expect(graph.getDependencies('0,0')).toEqual([]);
      expect(graph.getDependents('1,0')).toEqual([]);
      expect(graph.getDependents('2,0')).toEqual([]);
    });

    it('移除不存在的依赖不会报错', () => {
      expect(() => graph.removeDependencies('99,99')).not.toThrow();
    });

    it('移除一个单元格的依赖不影响其他单元格', () => {
      graph.setDependencies('0,0', ['2,0']);
      graph.setDependencies('1,0', ['2,0']);
      graph.removeDependencies('0,0');
      // 1,0 仍然依赖 2,0
      expect(graph.getDependents('2,0')).toEqual(['1,0']);
    });
  });

  describe('getRecalcOrder', () => {
    it('简单链式依赖的拓扑排序', () => {
      // A1 依赖 B1，B1 依赖 C1
      // C1 变化 → 先算 B1，再算 A1
      graph.setDependencies('0,0', ['0,1']); // A1 = f(B1)
      graph.setDependencies('0,1', ['0,2']); // B1 = f(C1)

      const order = graph.getRecalcOrder(['0,2']);
      expect(order).toHaveLength(2);
      // B1 应在 A1 之前
      expect(order.indexOf('0,1')).toBeLessThan(order.indexOf('0,0'));
    });

    it('多个变化源的重算顺序', () => {
      // A1 依赖 B1 和 C1
      graph.setDependencies('0,0', ['0,1', '0,2']);

      const order = graph.getRecalcOrder(['0,1', '0,2']);
      expect(order).toEqual(['0,0']);
    });

    it('没有受影响的单元格返回空数组', () => {
      graph.setDependencies('0,0', ['0,1']);
      const order = graph.getRecalcOrder(['5,5']);
      expect(order).toEqual([]);
    });

    it('菱形依赖的拓扑排序', () => {
      // D 依赖 B 和 C，B 依赖 A，C 依赖 A
      // A 变化 → B、C 先算（顺序不限），D 最后算
      graph.setDependencies('3,0', ['1,0', '2,0']); // D = f(B, C)
      graph.setDependencies('1,0', ['0,0']);          // B = f(A)
      graph.setDependencies('2,0', ['0,0']);          // C = f(A)

      const order = graph.getRecalcOrder(['0,0']);
      expect(order).toHaveLength(3);
      // B 和 C 应在 D 之前
      expect(order.indexOf('1,0')).toBeLessThan(order.indexOf('3,0'));
      expect(order.indexOf('2,0')).toBeLessThan(order.indexOf('3,0'));
    });

    it('不相关的单元格不会出现在重算列表中', () => {
      graph.setDependencies('0,0', ['0,1']); // A1 = f(B1)
      graph.setDependencies('2,0', ['2,1']); // C1 = f(D1)（不相关）

      const order = graph.getRecalcOrder(['0,1']);
      expect(order).toEqual(['0,0']);
      expect(order).not.toContain('2,0');
    });

    it('空变化列表返回空数组', () => {
      graph.setDependencies('0,0', ['0,1']);
      expect(graph.getRecalcOrder([])).toEqual([]);
    });

    it('长链依赖的拓扑排序', () => {
      // A → B → C → D → E
      graph.setDependencies('1,0', ['0,0']); // B = f(A)
      graph.setDependencies('2,0', ['1,0']); // C = f(B)
      graph.setDependencies('3,0', ['2,0']); // D = f(C)
      graph.setDependencies('4,0', ['3,0']); // E = f(D)

      const order = graph.getRecalcOrder(['0,0']);
      expect(order).toHaveLength(4);
      // 顺序应为 B, C, D, E
      for (let i = 0; i < order.length - 1; i++) {
        expect(order.indexOf(order[i])).toBeLessThan(order.indexOf(order[i + 1]));
      }
    });

    it('变化的单元格本身不在重算列表中', () => {
      graph.setDependencies('0,0', ['0,1']);
      const order = graph.getRecalcOrder(['0,1']);
      expect(order).not.toContain('0,1');
    });
  });
});
