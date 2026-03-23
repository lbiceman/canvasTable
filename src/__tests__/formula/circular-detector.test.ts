// ============================================================
// CircularDetector 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { CircularDetector } from '../../formula/circular-detector';
import { DependencyGraph } from '../../formula/dependency-graph';

describe('CircularDetector', () => {
  let detector: CircularDetector;
  let graph: DependencyGraph;

  beforeEach(() => {
    detector = new CircularDetector();
    graph = new DependencyGraph();
  });

  describe('自引用检测', () => {
    it('A1 = A1+1 → 检测到自引用循环', () => {
      // A1 的公式引用了自己
      const result = detector.detect('0,0', ['0,0'], graph);
      expect(result).not.toBeNull();
      expect(result).toEqual(['0,0', '0,0']);
    });

    it('自引用加其他依赖也能检测到', () => {
      const result = detector.detect('0,0', ['0,0', '1,0'], graph);
      expect(result).not.toBeNull();
      // 应包含自引用路径
      expect(result![0]).toBe('0,0');
      expect(result![result!.length - 1]).toBe('0,0');
    });
  });

  describe('直接循环检测', () => {
    it('A1 = B1, B1 = A1 → 检测到直接循环', () => {
      // 已有依赖：A1 依赖 B1
      graph.setDependencies('0,0', ['0,1']);
      // 现在要设置 B1 依赖 A1，应检测到循环
      const result = detector.detect('0,1', ['0,0'], graph);
      expect(result).not.toBeNull();
      // 循环路径应包含 B1 和 A1
      expect(result).toContain('0,0');
      expect(result).toContain('0,1');
      // 路径首尾应为 cellKey
      expect(result![0]).toBe('0,1');
    });
  });

  describe('间接循环检测', () => {
    it('A1 = B1, B1 = C1, C1 = A1 → 检测到间接循环', () => {
      // 已有依赖：A1 依赖 B1，B1 依赖 C1
      graph.setDependencies('0,0', ['0,1']); // A1 = f(B1)
      graph.setDependencies('0,1', ['0,2']); // B1 = f(C1)
      // 现在要设置 C1 依赖 A1，应检测到循环
      const result = detector.detect('0,2', ['0,0'], graph);
      expect(result).not.toBeNull();
      // 路径应包含所有三个单元格
      expect(result).toContain('0,0');
      expect(result).toContain('0,1');
      expect(result).toContain('0,2');
    });

    it('长链循环检测：A→B→C→D→A', () => {
      graph.setDependencies('0,0', ['1,0']); // A = f(B)
      graph.setDependencies('1,0', ['2,0']); // B = f(C)
      graph.setDependencies('2,0', ['3,0']); // C = f(D)
      // 现在要设置 D 依赖 A，应检测到循环
      const result = detector.detect('3,0', ['0,0'], graph);
      expect(result).not.toBeNull();
      expect(result![0]).toBe('3,0');
      // 路径中应能回到 cellKey 的某个依赖
      expect(result).toContain('0,0');
    });
  });

  describe('无循环场景', () => {
    it('正常依赖链不产生循环', () => {
      // A1 依赖 B1，B1 依赖 C1
      graph.setDependencies('0,0', ['0,1']); // A1 = f(B1)
      graph.setDependencies('0,1', ['0,2']); // B1 = f(C1)
      // D1 依赖 C1，不会形成循环
      const result = detector.detect('3,0', ['0,2'], graph);
      expect(result).toBeNull();
    });

    it('空依赖列表不产生循环', () => {
      const result = detector.detect('0,0', [], graph);
      expect(result).toBeNull();
    });

    it('依赖无公式的单元格不产生循环', () => {
      // B1 没有任何依赖
      const result = detector.detect('0,0', ['0,1'], graph);
      expect(result).toBeNull();
    });

    it('菱形依赖（无循环）→ 返回 null', () => {
      // D 依赖 B 和 C，B 依赖 A，C 依赖 A
      graph.setDependencies('3,0', ['1,0', '2,0']); // D = f(B, C)
      graph.setDependencies('1,0', ['0,0']);          // B = f(A)
      graph.setDependencies('2,0', ['0,0']);          // C = f(A)
      // E 依赖 D，不会形成循环
      const result = detector.detect('4,0', ['3,0'], graph);
      expect(result).toBeNull();
    });

    it('多个独立依赖均无循环', () => {
      graph.setDependencies('1,0', ['2,0']); // B = f(C)
      graph.setDependencies('3,0', ['4,0']); // D = f(E)
      // A 依赖 B 和 D，不会形成循环
      const result = detector.detect('0,0', ['1,0', '3,0'], graph);
      expect(result).toBeNull();
    });
  });

  describe('复杂场景', () => {
    it('多个新依赖中只有一个会导致循环', () => {
      // A1 依赖 B1
      graph.setDependencies('0,0', ['0,1']);
      // 设置 C1 依赖 [A1, D1]，其中 A1 的依赖链中有 B1
      // 但 B1 不依赖 C1，所以不会循环
      const result = detector.detect('0,2', ['0,0', '3,0'], graph);
      expect(result).toBeNull();
    });

    it('新依赖中某个会导致循环时能检测到', () => {
      // B1 依赖 C1，C1 依赖 A1
      graph.setDependencies('0,1', ['0,2']); // B1 = f(C1)
      graph.setDependencies('0,2', ['0,0']); // C1 = f(A1)
      // 设置 A1 依赖 [D1, B1]，B1 → C1 → A1 形成循环
      const result = detector.detect('0,0', ['3,0', '0,1'], graph);
      expect(result).not.toBeNull();
      expect(result![0]).toBe('0,0');
    });

    it('已有图中存在循环但新依赖不参与循环则返回 null', () => {
      // 已有循环：X → Y → X（但这在实际中不应该发生，仅测试检测器行为）
      graph.setDependencies('5,0', ['6,0']);
      graph.setDependencies('6,0', ['5,0']);
      // A1 依赖 B1，B1 没有依赖，不涉及已有循环
      const result = detector.detect('0,0', ['0,1'], graph);
      expect(result).toBeNull();
    });
  });

  describe('循环路径格式', () => {
    it('循环路径以 cellKey 开头', () => {
      graph.setDependencies('0,0', ['0,1']); // A1 = f(B1)
      const result = detector.detect('0,1', ['0,0'], graph);
      expect(result).not.toBeNull();
      expect(result![0]).toBe('0,1');
    });

    it('自引用循环路径长度为 2', () => {
      const result = detector.detect('0,0', ['0,0'], graph);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
    });

    it('直接循环路径包含两个不同的单元格', () => {
      graph.setDependencies('0,0', ['0,1']);
      const result = detector.detect('0,1', ['0,0'], graph);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });
});
