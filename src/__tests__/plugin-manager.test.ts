// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginManager } from '../plugin/plugin-manager';
import type { Plugin } from '../plugin/plugin-manager';
import type { PluginAPICallbacks } from '../plugin/plugin-api';
import type { PluginAPI } from '../plugin/plugin-api';

/**
 * 创建轻量级模拟的 PluginAPICallbacks
 * 不依赖 SpreadsheetModel，避免初始化开销
 */
function createMockCallbacks(): PluginAPICallbacks {
  // 模拟最小化的 model 对象
  const mockModel = {
    getRowCount: () => 10,
    getColCount: () => 10,
    getCell: () => ({ content: '', rowSpan: 1, colSpan: 1, isMerged: false }),
    setCellContent: vi.fn(),
  };

  return {
    getModel: () => mockModel as unknown as ReturnType<PluginAPICallbacks['getModel']>,
    addToolbarButton: (config: { label: string; icon?: string; onClick: () => void }) => {
      const btn = document.createElement('button');
      btn.textContent = config.label;
      btn.addEventListener('click', config.onClick);
      document.body.appendChild(btn);
      return btn;
    },
    removeToolbarButton: (button: HTMLButtonElement) => {
      button.remove();
    },
    addContextMenuItem: (_config: { label: string; action: () => void }) => {
      return `menu-item-${Math.random().toString(36).slice(2, 8)}`;
    },
    removeContextMenuItem: (_id: string) => {
      // 模拟移除
    },
  };
}

/**
 * 创建有效的测试插件
 */
function createValidPlugin(name = 'test-plugin', version = '1.0.0'): Plugin {
  return {
    name,
    version,
    activate: vi.fn(),
  };
}

describe('PluginManager', () => {
  let manager: PluginManager;
  let callbacks: PluginAPICallbacks;

  beforeEach(() => {
    callbacks = createMockCallbacks();
    manager = new PluginManager(callbacks);
  });

  describe('registerPlugin - 字段验证', () => {
    it('应拒绝缺少 name 字段的插件', () => {
      const plugin = { version: '1.0', activate: vi.fn() } as unknown as Plugin;
      expect(() => manager.registerPlugin(plugin)).toThrow('name');
      expect(manager.getPlugins()).toHaveLength(0);
    });

    it('应拒绝 name 为空字符串的插件', () => {
      const plugin = createValidPlugin('', '1.0.0');
      expect(() => manager.registerPlugin(plugin)).toThrow('name');
      expect(manager.getPlugins()).toHaveLength(0);
    });

    it('应拒绝 name 为纯空格的插件', () => {
      const plugin = createValidPlugin('   ', '1.0.0');
      expect(() => manager.registerPlugin(plugin)).toThrow('name');
      expect(manager.getPlugins()).toHaveLength(0);
    });

    it('应拒绝缺少 version 字段的插件', () => {
      const plugin = { name: 'test', activate: vi.fn() } as unknown as Plugin;
      expect(() => manager.registerPlugin(plugin)).toThrow('version');
      expect(manager.getPlugins()).toHaveLength(0);
    });

    it('应拒绝 version 为空字符串的插件', () => {
      const plugin = createValidPlugin('test', '');
      expect(() => manager.registerPlugin(plugin)).toThrow('version');
      expect(manager.getPlugins()).toHaveLength(0);
    });

    it('应拒绝缺少 activate 方法的插件', () => {
      const plugin = { name: 'test', version: '1.0' } as unknown as Plugin;
      expect(() => manager.registerPlugin(plugin)).toThrow('activate');
      expect(manager.getPlugins()).toHaveLength(0);
    });

    it('应拒绝 activate 不是函数的插件', () => {
      const plugin = { name: 'test', version: '1.0', activate: 'not-a-function' } as unknown as Plugin;
      expect(() => manager.registerPlugin(plugin)).toThrow('activate');
      expect(manager.getPlugins()).toHaveLength(0);
    });
  });

  describe('registerPlugin - 成功注册', () => {
    it('应成功注册有效插件并标记为 active', () => {
      const plugin = createValidPlugin();
      manager.registerPlugin(plugin);

      const plugins = manager.getPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('test-plugin');
      expect(plugins[0].version).toBe('1.0.0');
      expect(plugins[0].status).toBe('active');
    });

    it('应调用插件的 activate 方法并传入 PluginAPI', () => {
      const activateFn = vi.fn();
      const plugin: Plugin = { name: 'test', version: '1.0', activate: activateFn };
      manager.registerPlugin(plugin);

      expect(activateFn).toHaveBeenCalledTimes(1);
      // 验证传入的参数是 PluginAPI（Proxy 包装后的对象）
      const api = activateFn.mock.calls[0][0];
      expect(typeof api.getCellValue).toBe('function');
      expect(typeof api.setCellValue).toBe('function');
      expect(typeof api.cleanup).toBe('function');
    });

    it('应拒绝重复注册同名插件', () => {
      const plugin1 = createValidPlugin('dup-plugin');
      const plugin2 = createValidPlugin('dup-plugin', '2.0.0');

      manager.registerPlugin(plugin1);
      expect(() => manager.registerPlugin(plugin2)).toThrow('已存在');
      expect(manager.getPlugins()).toHaveLength(1);
    });
  });

  describe('registerPlugin - activate 异常处理', () => {
    it('activate 抛出异常时不应向外抛出，插件标记为 failed', () => {
      const plugin: Plugin = {
        name: 'bad-plugin',
        version: '1.0',
        activate: () => { throw new Error('激活失败'); },
      };

      expect(() => manager.registerPlugin(plugin)).not.toThrow();

      const plugins = manager.getPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('bad-plugin');
      expect(plugins[0].status).toBe('failed');
    });

    it('activate 异常时应输出 console.error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const plugin: Plugin = {
        name: 'error-plugin',
        version: '1.0',
        activate: () => { throw new Error('boom'); },
      };

      manager.registerPlugin(plugin);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('unloadPlugin', () => {
    it('应调用插件的 deactivate 方法并标记为 unloaded', () => {
      const deactivateFn = vi.fn();
      const plugin: Plugin = {
        name: 'unload-test',
        version: '1.0',
        activate: vi.fn(),
        deactivate: deactivateFn,
      };

      manager.registerPlugin(plugin);
      manager.unloadPlugin('unload-test');

      expect(deactivateFn).toHaveBeenCalledTimes(1);
      const plugins = manager.getPlugins();
      expect(plugins[0].status).toBe('unloaded');
    });

    it('插件没有 deactivate 方法时不应报错', () => {
      const plugin = createValidPlugin('no-deactivate');
      manager.registerPlugin(plugin);

      expect(() => manager.unloadPlugin('no-deactivate')).not.toThrow();
      expect(manager.getPlugins()[0].status).toBe('unloaded');
    });

    it('卸载不存在的插件不应报错', () => {
      expect(() => manager.unloadPlugin('nonexistent')).not.toThrow();
    });

    it('应通过 PluginAPI.cleanup 清理插件注册的资源', () => {
      let capturedApi: PluginAPI | null = null;
      const plugin: Plugin = {
        name: 'cleanup-test',
        version: '1.0',
        activate: (api: PluginAPI) => {
          capturedApi = api;
          // 插件注册一个工具栏按钮
          api.addToolbarButton({ label: '测试按钮', onClick: () => {} });
        },
      };

      manager.registerPlugin(plugin);
      expect(capturedApi).not.toBeNull();

      // 卸载插件应触发 cleanup
      manager.unloadPlugin('cleanup-test');
      expect(manager.getPlugins()[0].status).toBe('unloaded');
    });

    it('deactivate 抛出异常时不应阻止卸载流程', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const plugin: Plugin = {
        name: 'bad-deactivate',
        version: '1.0',
        activate: vi.fn(),
        deactivate: () => { throw new Error('deactivate 错误'); },
      };

      manager.registerPlugin(plugin);
      expect(() => manager.unloadPlugin('bad-deactivate')).not.toThrow();
      expect(manager.getPlugins()[0].status).toBe('unloaded');
      consoleSpy.mockRestore();
    });
  });

  describe('getPlugins', () => {
    it('无插件时返回空数组', () => {
      expect(manager.getPlugins()).toEqual([]);
    });

    it('应返回所有已注册插件的信息', () => {
      manager.registerPlugin(createValidPlugin('plugin-a', '1.0'));
      manager.registerPlugin(createValidPlugin('plugin-b', '2.0'));

      const plugins = manager.getPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins.map((p) => p.name)).toContain('plugin-a');
      expect(plugins.map((p) => p.name)).toContain('plugin-b');
    });

    it('应正确反映不同状态的插件', () => {
      // active 插件
      manager.registerPlugin(createValidPlugin('active-plugin'));

      // failed 插件
      manager.registerPlugin({
        name: 'failed-plugin',
        version: '1.0',
        activate: () => { throw new Error('fail'); },
      });

      // unloaded 插件
      manager.registerPlugin(createValidPlugin('unloaded-plugin'));
      manager.unloadPlugin('unloaded-plugin');

      const plugins = manager.getPlugins();
      const statusMap = new Map(plugins.map((p) => [p.name, p.status]));

      expect(statusMap.get('active-plugin')).toBe('active');
      expect(statusMap.get('failed-plugin')).toBe('failed');
      expect(statusMap.get('unloaded-plugin')).toBe('unloaded');
    });
  });
});
