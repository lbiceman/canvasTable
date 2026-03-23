// ============================================================
// 函数注册表：集中管理所有可用函数的元数据和实现
// ============================================================

import type { FunctionDefinition } from './types';

/**
 * 函数注册表
 * 存储函数元数据（名称、类别、参数说明、最小/最大参数数量）
 * 支持按名称查找和按前缀搜索（用于自动补全）
 */
export class FunctionRegistry {
  /** 以大写函数名为键存储函数定义 */
  private readonly functions: Map<string, FunctionDefinition> = new Map();

  /** 注册一个函数 */
  register(definition: FunctionDefinition): void {
    this.functions.set(definition.name.toUpperCase(), definition);
  }

  /** 获取函数定义（不区分大小写） */
  get(name: string): FunctionDefinition | undefined {
    return this.functions.get(name.toUpperCase());
  }

  /** 获取所有已注册函数名 */
  getAllNames(): string[] {
    return Array.from(this.functions.keys());
  }

  /** 按前缀搜索函数（不区分大小写，用于自动补全） */
  searchByPrefix(prefix: string): FunctionDefinition[] {
    const upperPrefix = prefix.toUpperCase();
    const results: FunctionDefinition[] = [];
    for (const [key, def] of this.functions) {
      if (key.startsWith(upperPrefix)) {
        results.push(def);
      }
    }
    return results;
  }
}
