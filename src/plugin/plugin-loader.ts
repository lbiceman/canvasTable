// ============================================================
// 插件动态加载器
// 支持从 URL 或本地文件动态加载第三方插件
// ============================================================

import type { Plugin } from './plugin-manager';

/** 加载结果 */
export interface PluginLoadResult {
  success: boolean;
  plugin?: Plugin;
  error?: string;
}

/**
 * 插件动态加载器
 * 支持从 URL 和本地文件加载插件 JS 文件
 */
export class PluginLoader {
  /**
   * 从 URL 加载插件
   * 通过动态创建 script 标签加载远程 JS 文件
   * @param url 插件 JS 文件的 URL
   * @returns 加载结果
   */
  public async loadFromURL(url: string): Promise<PluginLoadResult> {
    try {
      // 验证 URL 格式
      const parsedUrl = new URL(url);
      if (!parsedUrl.pathname.endsWith('.js')) {
        return { success: false, error: '插件文件必须是 .js 格式' };
      }

      // 使用 fetch 获取脚本内容
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, error: `加载失败: HTTP ${response.status}` };
      }

      const code = await response.text();
      return this.executePluginCode(code, url);
    } catch (err) {
      return { success: false, error: `加载插件失败: ${err}` };
    }
  }

  /**
   * 从本地文件加载插件
   * @param file 用户选择的文件对象
   * @returns 加载结果
   */
  public async loadFromFile(file: File): Promise<PluginLoadResult> {
    try {
      if (!file.name.endsWith('.js')) {
        return { success: false, error: '插件文件必须是 .js 格式' };
      }

      const code = await file.text();
      return this.executePluginCode(code, file.name);
    } catch (err) {
      return { success: false, error: `读取文件失败: ${err}` };
    }
  }

  /**
   * 在沙箱中执行插件代码
   * 使用 Function 构造器创建隔离的执行环境
   */
  private executePluginCode(code: string, source: string): PluginLoadResult {
    try {
      // 创建沙箱环境：只暴露必要的全局对象
      const sandbox = {
        console: {
          log: (...args: unknown[]) => console.log(`[插件:${source}]`, ...args),
          warn: (...args: unknown[]) => console.warn(`[插件:${source}]`, ...args),
          error: (...args: unknown[]) => console.error(`[插件:${source}]`, ...args),
        },
        Math,
        Date,
        JSON,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        String,
        Number,
        Boolean,
        Array,
        Object,
        Map,
        Set,
        Promise,
        RegExp,
        Error,
        TypeError,
        RangeError,
        setTimeout: undefined,  // 禁止定时器
        setInterval: undefined,
        fetch: undefined,       // 禁止网络请求
        XMLHttpRequest: undefined,
        document: undefined,    // 禁止 DOM 访问
        window: undefined,
      };

      // 使用 Function 构造器执行代码
      // 插件代码应该导出一个符合 Plugin 接口的对象
      // eslint-disable-next-line no-new-func
      const factory = new Function(
        'sandbox',
        `with(sandbox) {
          const module = { exports: {} };
          const exports = module.exports;
          ${code}
          return module.exports;
        }`
      );

      const exported = factory(sandbox);

      // 验证导出的对象是否符合 Plugin 接口
      if (!exported || typeof exported !== 'object') {
        return { success: false, error: '插件必须导出一个对象' };
      }

      const plugin = exported as Plugin;

      if (typeof plugin.name !== 'string' || !plugin.name.trim()) {
        return { success: false, error: '插件缺少有效的 name 字段' };
      }

      if (typeof plugin.version !== 'string' || !plugin.version.trim()) {
        return { success: false, error: '插件缺少有效的 version 字段' };
      }

      if (typeof plugin.activate !== 'function') {
        return { success: false, error: '插件缺少 activate 方法' };
      }

      return { success: true, plugin };
    } catch (err) {
      return { success: false, error: `执行插件代码失败: ${err}` };
    }
  }

  /**
   * 打开文件选择器让用户选择本地插件文件
   * @returns 加载结果
   */
  public async promptLoadFromFile(): Promise<PluginLoadResult> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.js';

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve({ success: false, error: '未选择文件' });
          return;
        }
        const result = await this.loadFromFile(file);
        resolve(result);
      });

      input.click();
    });
  }
}
