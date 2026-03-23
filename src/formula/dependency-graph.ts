// ============================================================
// 依赖图管理器
// 追踪单元格间的公式依赖关系，支持拓扑排序获取重算顺序
// ============================================================

/**
 * DependencyGraph 管理单元格之间的依赖关系。
 *
 * 内部维护两个映射：
 * - dependsOn：正向依赖（cellKey 依赖哪些单元格）
 * - dependents：反向依赖（cellKey 被哪些单元格依赖）
 *
 * cellKey 格式为 "row,col"，如 "0,0" 表示 A1。
 */
export class DependencyGraph {
  /** 正向依赖：A 依赖 B → dependsOnMap.get(A) 包含 B */
  private dependsOnMap: Map<string, Set<string>> = new Map();

  /** 反向依赖：B 被 A 依赖 → dependentsMap.get(B) 包含 A */
  private dependentsMap: Map<string, Set<string>> = new Map();

  /**
   * 设置单元格的依赖列表。
   * 如果之前有依赖关系，先清除旧的再设置新的。
   * @param cellKey 单元格键，格式 "row,col"
   * @param dependencies 该单元格依赖的所有单元格键
   */
  setDependencies(cellKey: string, dependencies: string[]): void {
    // 先清除旧的依赖关系
    this.removeDependencies(cellKey);

    // 设置新的正向依赖
    const depSet = new Set(dependencies);
    this.dependsOnMap.set(cellKey, depSet);

    // 更新反向依赖
    for (const dep of depSet) {
      let set = this.dependentsMap.get(dep);
      if (!set) {
        set = new Set();
        this.dependentsMap.set(dep, set);
      }
      set.add(cellKey);
    }
  }

  /**
   * 获取依赖于指定单元格的所有单元格（即哪些单元格的公式引用了这个单元格）。
   * @param cellKey 单元格键
   * @returns 依赖于该单元格的单元格键数组
   */
  getDependents(cellKey: string): string[] {
    const set = this.dependentsMap.get(cellKey);
    return set ? [...set] : [];
  }

  /**
   * 获取一个单元格依赖的所有单元格。
   * @param cellKey 单元格键
   * @returns 该单元格依赖的单元格键数组
   */
  getDependencies(cellKey: string): string[] {
    const set = this.dependsOnMap.get(cellKey);
    return set ? [...set] : [];
  }

  /**
   * 检查一个单元格是否有依赖关系。
   * @param cellKey 单元格键
   * @returns 是否有依赖
   */
  hasDependencies(cellKey: string): boolean {
    const set = this.dependsOnMap.get(cellKey);
    return set !== undefined && set.size > 0;
  }

  /**
   * 移除一个单元格的所有依赖关系。
   * @param cellKey 单元格键
   */
  removeDependencies(cellKey: string): void {
    const oldDeps = this.dependsOnMap.get(cellKey);
    if (oldDeps) {
      // 从反向依赖中移除
      for (const dep of oldDeps) {
        const set = this.dependentsMap.get(dep);
        if (set) {
          set.delete(cellKey);
          if (set.size === 0) {
            this.dependentsMap.delete(dep);
          }
        }
      }
      this.dependsOnMap.delete(cellKey);
    }
  }

  /**
   * 给定一组变化的单元格，返回需要重新计算的单元格列表（按拓扑排序）。
   * 使用 BFS 收集所有受影响的单元格，然后用 Kahn 算法进行拓扑排序。
   * @param changedCells 发生变化的单元格键数组
   * @returns 按拓扑排序的重算单元格列表（被依赖的先计算）
   */
  getRecalcOrder(changedCells: string[]): string[] {
    // 第一步：BFS 收集所有受影响的单元格
    const affected = new Set<string>();
    const queue: string[] = [];

    for (const cell of changedCells) {
      const deps = this.dependentsMap.get(cell);
      if (deps) {
        for (const dep of deps) {
          if (!affected.has(dep)) {
            affected.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      const deps = this.dependentsMap.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!affected.has(dep)) {
            affected.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    if (affected.size === 0) {
      return [];
    }

    // 第二步：在受影响的子图上进行 Kahn 算法拓扑排序
    // 计算每个受影响单元格在子图中的入度（仅考虑受影响的依赖）
    const inDegree = new Map<string, number>();
    for (const cell of affected) {
      inDegree.set(cell, 0);
    }

    for (const cell of affected) {
      const deps = this.dependsOnMap.get(cell);
      if (deps) {
        for (const dep of deps) {
          // 入度来源：dep 在 affected 中或在 changedCells 中
          // 只有当 dep 也在 affected 中时才计入入度
          if (affected.has(dep)) {
            inDegree.set(cell, (inDegree.get(cell) ?? 0) + 1);
          }
        }
      }
    }

    // 入度为 0 的节点入队
    const topoQueue: string[] = [];
    for (const [cell, degree] of inDegree) {
      if (degree === 0) {
        topoQueue.push(cell);
      }
    }

    const result: string[] = [];
    let topoHead = 0;
    while (topoHead < topoQueue.length) {
      const current = topoQueue[topoHead++];
      result.push(current);

      const deps = this.dependentsMap.get(current);
      if (deps) {
        for (const dep of deps) {
          if (affected.has(dep)) {
            const newDegree = (inDegree.get(dep) ?? 0) - 1;
            inDegree.set(dep, newDegree);
            if (newDegree === 0) {
              topoQueue.push(dep);
            }
          }
        }
      }
    }

    return result;
  }
}
