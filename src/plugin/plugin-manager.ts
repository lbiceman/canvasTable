// ============================================================
// PluginManager - 插件生命周期管理器
// 负责插件的注册、加载、卸载与状态查询
// ============================================================

import { PluginAPI, createPluginAPI } from './plugin-api';
import type { PluginAPICallbacks } from './plugin-api';

// 插件状态类型
export type PluginStatus = 'active' | 'failed' | 'unloaded';

// 插件接口定义
export interface Plugin {
  name: string;
  version: string;
  activate(api: PluginAPI): void;
  deactivate?(): void;
}

// 插件信息（对外暴露的只读信息）
export interface PluginInfo {
  name: string;
  version: string;
  status: PluginStatus;
}

// 内部插件记录，包含插件实例、API 实例和状态
interface PluginRecord {
  plugin: Plugin;
  api: PluginAPI;
  status: PluginStatus;
}

/**
 * PluginManager 类
 * 管理插件的完整生命周期：注册、激活、卸载、状态查询
 */
export class PluginManager {
  // 已注册插件的内部存储（按名称索引）
  private plugins: Map<string, PluginRecord> = new Map();
  // PluginAPI 回调接口（避免直接依赖 SpreadsheetApp）
  private callbacks: PluginAPICallbacks;

  constructor(callbacks: PluginAPICallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * 注册插件
   * 验证插件对象的必要字段，创建 PluginAPI 实例并调用 activate
   * @param plugin 符合 Plugin 接口的插件对象
   * @throws Error 当插件缺少必要字段或名称重复时
   */
  registerPlugin(plugin: Plugin): void {
    // 验证 name 字段：必须是非空字符串
    if (typeof plugin.name !== 'string' || plugin.name.trim() === '') {
      throw new Error('插件注册失败：缺少有效的 name 字段（必须为非空字符串）');
    }

    // 验证 version 字段：必须是非空字符串
    if (typeof plugin.version !== 'string' || plugin.version.trim() === '') {
      throw new Error('插件注册失败：缺少有效的 version 字段（必须为非空字符串）');
    }

    // 验证 activate 字段：必须是函数
    if (typeof plugin.activate !== 'function') {
      throw new Error('插件注册失败：缺少有效的 activate 方法（必须为函数）');
    }

    // 检查是否重复注册
    if (this.plugins.has(plugin.name)) {
      throw new Error(`插件注册失败：名称为 "${plugin.name}" 的插件已存在`);
    }

    // 创建 PluginAPI 实例（通过 Proxy 包装）
    const api = createPluginAPI(this.callbacks, plugin.name);

    // 尝试调用插件的 activate 方法
    try {
      plugin.activate(api);

      // 激活成功，记录为 active 状态
      this.plugins.set(plugin.name, {
        plugin,
        api,
        status: 'active',
      });
    } catch (error) {
      // 激活失败，捕获异常并标记为 failed 状态
      console.error(`[插件 ${plugin.name}] 激活失败:`, error);

      this.plugins.set(plugin.name, {
        plugin,
        api,
        status: 'failed',
      });
    }
  }

  /**
   * 卸载插件
   * 调用插件的 deactivate 方法（如存在），并通过 PluginAPI.cleanup 清理所有注册资源
   * @param name 要卸载的插件名称
   */
  unloadPlugin(name: string): void {
    const record = this.plugins.get(name);
    if (!record) {
      return;
    }

    // 调用插件的 deactivate 方法（如果存在）
    if (typeof record.plugin.deactivate === 'function') {
      try {
        record.plugin.deactivate();
      } catch (error) {
        console.error(`[插件 ${name}] deactivate 执行错误:`, error);
      }
    }

    // 通过 PluginAPI 清理该插件注册的所有资源
    record.api.cleanup();

    // 更新状态为 unloaded
    record.status = 'unloaded';
  }

  /**
   * 获取所有已注册插件的信息列表
   * @returns PluginInfo 数组，包含每个插件的 name、version、status
   */
  getPlugins(): PluginInfo[] {
    const result: PluginInfo[] = [];
    for (const [, record] of this.plugins) {
      result.push({
        name: record.plugin.name,
        version: record.plugin.version,
        status: record.status,
      });
    }
    return result;
  }
}
