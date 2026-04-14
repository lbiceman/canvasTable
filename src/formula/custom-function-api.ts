// ============================================================
// 自定义函数注册 API
// 允许用户通过脚本注册自定义公式函数
// ============================================================

import { FunctionRegistry } from './function-registry';
import type { FunctionDefinition, FunctionParam, FormulaValue, EvaluationContext } from './types';

/** 自定义函数参数声明 */
export interface CustomFunctionParam {
  name: string;
  description: string;
  type?: 'number' | 'string' | 'boolean' | 'range' | 'any';
  optional?: boolean;
}

/** 自定义函数定义（用户侧简化接口） */
export interface CustomFunctionDef {
  name: string;
  description: string;
  params: CustomFunctionParam[];
  handler: (...args: unknown[]) => unknown;
}

/** 已注册的自定义函数记录 */
interface CustomFunctionRecord {
  definition: CustomFunctionDef;
  registeredAt: number;
}

/** localStorage 存储键 */
const STORAGE_KEY = 'ice-excel-custom-functions';

/**
 * 自定义函数注册 API
 * 提供标准化的函数注册接口，支持持久化
 */
export class CustomFunctionAPI {
  private registry: FunctionRegistry;
  /** 已注册的自定义函数 */
  private customFunctions: Map<string, CustomFunctionRecord> = new Map();

  constructor(registry: FunctionRegistry) {
    this.registry = registry;
  }

  /**
   * 注册自定义函数
   * @param def 函数定义
   * @returns 注册结果
   */
  public register(def: CustomFunctionDef): { success: boolean; error?: string } {
    // 验证函数名
    const name = def.name.toUpperCase();
    if (!name || !/^[A-Z_][A-Z0-9_.]*$/.test(name)) {
      return { success: false, error: '函数名必须以字母或下划线开头，只能包含字母、数字、下划线和点号' };
    }

    // 检查是否与内置函数冲突
    const existing = this.registry.get(name);
    if (existing && !this.customFunctions.has(name)) {
      return { success: false, error: `函数 "${name}" 与内置函数冲突` };
    }

    // 验证参数
    if (!Array.isArray(def.params)) {
      return { success: false, error: '参数列表必须是数组' };
    }

    // 验证处理函数
    if (typeof def.handler !== 'function') {
      return { success: false, error: 'handler 必须是函数' };
    }

    // 转换为内部 FunctionDefinition
    const params: FunctionParam[] = def.params.map(p => ({
      name: p.name,
      description: p.description,
      type: p.type || 'any',
      optional: p.optional,
    }));

    const minArgs = params.filter(p => !p.optional).length;
    const maxArgs = params.length;

    // 包装用户的 handler，适配内部接口
    const wrappedHandler = (args: FormulaValue[], _context: EvaluationContext): FormulaValue => {
      try {
        const result = def.handler(...args);
        // 将结果转换为 FormulaValue
        if (result === null || result === undefined) return '';
        if (typeof result === 'number' || typeof result === 'string' || typeof result === 'boolean') {
          return result;
        }
        if (Array.isArray(result)) {
          return result as FormulaValue[][];
        }
        return String(result);
      } catch (err) {
        return { type: '#VALUE!' as const, message: `自定义函数 ${name} 执行错误: ${err}` };
      }
    };

    const functionDef: FunctionDefinition = {
      name,
      category: 'lookup', // 自定义函数归类到 lookup
      description: def.description,
      minArgs,
      maxArgs,
      params,
      handler: wrappedHandler,
    };

    // 注册到函数注册表
    this.registry.register(functionDef);

    // 记录自定义函数
    this.customFunctions.set(name, {
      definition: def,
      registeredAt: Date.now(),
    });

    return { success: true };
  }

  /**
   * 注销自定义函数
   */
  public unregister(name: string): boolean {
    const upperName = name.toUpperCase();
    if (!this.customFunctions.has(upperName)) {
      return false;
    }

    this.registry.unregister(upperName);
    this.customFunctions.delete(upperName);
    return true;
  }

  /**
   * 获取所有自定义函数
   */
  public getAll(): Array<{ name: string; description: string; params: CustomFunctionParam[]; registeredAt: number }> {
    const result: Array<{ name: string; description: string; params: CustomFunctionParam[]; registeredAt: number }> = [];
    for (const [name, record] of this.customFunctions) {
      result.push({
        name,
        description: record.definition.description,
        params: record.definition.params,
        registeredAt: record.registeredAt,
      });
    }
    return result;
  }

  /**
   * 检查是否是自定义函数
   */
  public isCustomFunction(name: string): boolean {
    return this.customFunctions.has(name.toUpperCase());
  }

  /**
   * 保存自定义函数到 localStorage
   * 注意：handler 函数无法序列化，只保存元数据
   */
  public saveToStorage(): void {
    const data: Array<{ name: string; description: string; params: CustomFunctionParam[]; code?: string }> = [];
    for (const [, record] of this.customFunctions) {
      data.push({
        name: record.definition.name,
        description: record.definition.description,
        params: record.definition.params,
      });
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage 不可用时静默失败
    }
  }

  /**
   * 从 localStorage 加载自定义函数元数据
   * 注意：只加载元数据，handler 需要用户重新注册
   */
  public loadFromStorage(): Array<{ name: string; description: string; params: CustomFunctionParam[] }> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * 生成函数使用文档
   */
  public generateDocs(name: string): string | null {
    const record = this.customFunctions.get(name.toUpperCase());
    if (!record) return null;

    const def = record.definition;
    let doc = `## ${def.name}\n\n`;
    doc += `${def.description}\n\n`;
    doc += `### 语法\n\n`;
    doc += `=${def.name}(${def.params.map(p => p.optional ? `[${p.name}]` : p.name).join(', ')})\n\n`;
    doc += `### 参数\n\n`;
    for (const param of def.params) {
      doc += `- **${param.name}**${param.optional ? '（可选）' : ''}: ${param.description}\n`;
    }
    return doc;
  }
}
