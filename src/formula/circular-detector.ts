// ============================================================
// 循环引用检测器
// 基于 DFS 检测公式依赖中的循环引用，返回循环路径或 null
// ============================================================

import { DependencyGraph } from './dependency-graph';

/**
 * CircularDetector 用于在公式写入前检测循环引用。
 *
 * 检测逻辑：
 * 如果将 cellKey 的依赖设为 newDependencies，检查是否会形成循环。
 * 对于 newDependencies 中的每个 dep，从 dep 出发沿着现有的
 * dependsOn 链（即 dep 依赖谁、dep 的依赖又依赖谁……）进行 DFS，
 * 如果能到达 cellKey，说明存在循环：cellKey → dep → ... → cellKey。
 */
export class CircularDetector {
  /**
   * 检测是否存在循环引用
   * @param cellKey 要设置公式的单元格键
   * @param newDependencies 新公式引用的单元格键集合
   * @param dependencyGraph 当前的依赖图
   * @returns 如果存在循环引用，返回循环路径数组；否则返回 null
   */
  detect(
    cellKey: string,
    newDependencies: string[],
    dependencyGraph: DependencyGraph
  ): string[] | null {
    for (const dep of newDependencies) {
      // 自引用：cellKey 直接依赖自己
      if (dep === cellKey) {
        return [cellKey, cellKey];
      }

      // 从 dep 出发，沿着 dependsOn 链 DFS，检查是否能到达 cellKey
      const path = this.dfs(dep, cellKey, dependencyGraph);
      if (path !== null) {
        // 构建完整循环路径：cellKey → dep → ... → cellKey
        return [cellKey, ...path];
      }
    }

    return null;
  }

  /**
   * 从 start 出发沿着 dependsOn 链进行 DFS，查找是否能到达 target。
   * @param start 起始单元格
   * @param target 目标单元格
   * @param graph 依赖图
   * @returns 如果找到路径，返回从 start 到 target 的路径；否则返回 null
   */
  private dfs(
    start: string,
    target: string,
    graph: DependencyGraph
  ): string[] | null {
    const visited = new Set<string>();
    // 栈中存储 [当前节点, 从 start 到当前节点的路径]
    const stack: Array<[string, string[]]> = [[start, [start]]];

    while (stack.length > 0) {
      const [current, path] = stack.pop()!;

      if (current === target) {
        return path;
      }

      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      // 沿着 dependsOn 链继续搜索（current 依赖哪些单元格）
      const dependencies = graph.getDependencies(current);
      for (const dep of dependencies) {
        if (!visited.has(dep)) {
          stack.push([dep, [...path, dep]]);
        }
      }
    }

    return null;
  }
}
