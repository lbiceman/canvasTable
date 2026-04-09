// ============================================================
// PluginAPI - 插件受控 API 接口
// 为第三方插件提供受控的电子表格操作能力
// 使用 Proxy 包装限制插件只能通过白名单方法操作
// ============================================================

import type { SpreadsheetModel } from '../model';
import { FormulaEngine } from '../formula-engine';
import type { FormulaValue } from '../formula/types';
// 插件 API 回调接口 - 避免循环依赖
export interface PluginAPICallbacks {
  getModel(): SpreadsheetModel;
  addToolbarButton(config: { label: string; icon?: string; onClick: () => void }): HTMLButtonElement;
  removeToolbarButton(button: HTMLButtonElement): void;
  addContextMenuItem(config: { label: string; action: () => void }): string;
  removeContextMenuItem(id: string): void;
}

// 单元格变更回调类型
type CellChangeCallback = (row: number, col: number, oldValue: string, newValue: string) => void;

// 白名单方法列表
const ALLOWED_METHODS: ReadonlySet<string> = new Set([
  'getCellValue',
  'setCellValue',
  'registerFunction',
  'addToolbarButton',
  'addContextMenuItem',
  'onCellChange',
  'cleanup',
]);

/**
 * PluginAPI 类
 * 为插件提供受控的电子表格操作接口
 * 通过 Proxy 包装确保插件只能访问白名单方法
 */
export class PluginAPI {
  private callbacks: PluginAPICallbacks;
  private pluginName: string;

  // 该插件注册的工具栏按钮
  private toolbarButtons: HTMLButtonElement[] = [];
  // 该插件注册的右键菜单项 ID
  private contextMenuItemIds: string[] = [];
  // 该插件注册的自定义公式函数名
  private customFunctions: Map<string, (...args: unknown[]) => unknown> = new Map();
  // 该插件注册的单元格变更回调
  private cellChangeCallbacks: CellChangeCallback[] = [];
  // 按钮/菜单项 ID 计数器
  private idCounter: number = 0;

  constructor(callbacks: PluginAPICallbacks, pluginName: string) {
    this.callbacks = callbacks;
    this.pluginName = pluginName;
  }

  /**
   * 读取单元格值
   * @param row 行索引
   * @param col 列索引
   * @returns 单元格内容字符串，越界返回空字符串
   */
  getCellValue(row: number, col: number): string {
    const model = this.callbacks.getModel();
    if (row < 0 || row >= model.getRowCount() || col < 0 || col >= model.getColCount()) {
      return '';
    }
    const cell = model.getCell(row, col);
    return cell ? cell.content : '';
  }

  /**
   * 写入单元格值
   * @param row 行索引
   * @param col 列索引
   * @param value 要设置的值
   */
  setCellValue(row: number, col: number, value: string): void {
    const model = this.callbacks.getModel();
    if (row < 0 || row >= model.getRowCount() || col < 0 || col >= model.getColCount()) {
      return;
    }
    const oldValue = this.getCellValue(row, col);
    model.setCellContent(row, col, value);
    const newValue = this.getCellValue(row, col);

    // 通知所有注册的单元格变更回调
    if (oldValue !== newValue) {
      for (const cb of this.cellChangeCallbacks) {
        try {
          cb(row, col, oldValue, newValue);
        } catch (e) {
          console.error(`[插件 ${this.pluginName}] 单元格变更回调执行错误:`, e);
        }
      }
    }
  }

  /**
   * 注册自定义公式函数
   * 同时注册到内部 Map 和公式引擎的 FunctionRegistry
   * @param name 函数名称
   * @param fn 函数实现
   */
  registerFunction(name: string, fn: (...args: unknown[]) => unknown): void {
    const upperName = name.toUpperCase();
    this.customFunctions.set(upperName, fn);

    // 同步注册到公式引擎的 FunctionRegistry
    try {
      const engine = FormulaEngine.getInstance();
      const registry = engine.getRegistry();
      registry.register({
        name: upperName,
        category: 'math',
        description: `插件 ${this.pluginName} 注册的自定义函数`,
        minArgs: 0,
        maxArgs: -1,
        params: [],
        handler: (args: FormulaValue[]): FormulaValue => {
          try {
            const result = fn(...args);
            // 将插件函数返回值转为 FormulaValue
            if (typeof result === 'number' || typeof result === 'string' || typeof result === 'boolean') {
              return result;
            }
            return String(result);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { type: '#VALUE!' as const, message: `插件函数 ${upperName} 执行错误: ${msg}` };
          }
        },
      });
    } catch (e) {
      console.error(`[插件 ${this.pluginName}] 注册公式函数 ${upperName} 到引擎失败:`, e);
    }
  }

  /**
   * 添加工具栏按钮
   * @param config 按钮配置（label、icon、onClick）
   * @returns 按钮唯一 ID
   */
  addToolbarButton(config: { label: string; icon?: string; onClick: () => void }): string {
    const id = `${this.pluginName}-btn-${this.idCounter++}`;
    const button = this.callbacks.addToolbarButton(config);
    button.dataset.pluginButtonId = id;
    this.toolbarButtons.push(button);
    return id;
  }

  /**
   * 添加右键菜单项
   * @param config 菜单项配置（label、onClick）
   * @returns 菜单项唯一 ID
   */
  addContextMenuItem(config: { label: string; onClick: () => void }): string {
    const menuId = this.callbacks.addContextMenuItem({
      label: config.label,
      action: config.onClick,
    });
    this.contextMenuItemIds.push(menuId);
    return menuId;
  }

  /**
   * 监听单元格变更事件
   * @param callback 变更回调函数
   */
  onCellChange(callback: CellChangeCallback): void {
    this.cellChangeCallbacks.push(callback);
  }

  /**
   * 获取该插件注册的自定义函数
   * @param name 函数名称（大写）
   * @returns 函数实现或 undefined
   */
  getCustomFunction(name: string): ((...args: unknown[]) => unknown) | undefined {
    return this.customFunctions.get(name.toUpperCase());
  }

  /**
   * 获取该插件注册的所有自定义函数名
   */
  getCustomFunctionNames(): string[] {
    return [...this.customFunctions.keys()];
  }

  /**
   * 通知单元格变更（由外部调用，如 PluginManager 转发模型变更事件）
   */
  notifyCellChange(row: number, col: number, oldValue: string, newValue: string): void {
    for (const cb of this.cellChangeCallbacks) {
      try {
        cb(row, col, oldValue, newValue);
      } catch (e) {
        console.error(`[插件 ${this.pluginName}] 单元格变更回调执行错误:`, e);
      }
    }
  }

  /**
   * 清理该插件注册的所有资源
   * 移除工具栏按钮、右键菜单项、自定义函数、单元格变更回调
   */
  cleanup(): void {
    // 移除工具栏按钮
    for (const button of this.toolbarButtons) {
      this.callbacks.removeToolbarButton(button);
    }
    this.toolbarButtons = [];

    // 移除右键菜单项
    for (const id of this.contextMenuItemIds) {
      this.callbacks.removeContextMenuItem(id);
    }
    this.contextMenuItemIds = [];

    // 清除自定义函数（同时从公式引擎反注册）
    try {
      const engine = FormulaEngine.getInstance();
      const registry = engine.getRegistry();
      for (const funcName of this.customFunctions.keys()) {
        registry.unregister(funcName);
      }
    } catch (e) {
      console.error(`[插件 ${this.pluginName}] 反注册公式函数失败:`, e);
    }
    this.customFunctions.clear();

    // 清除单元格变更回调
    this.cellChangeCallbacks = [];
  }
}

/**
 * 创建 Proxy 包装的 PluginAPI 实例
 * 限制插件只能访问白名单中的方法
 * @param callbacks 回调接口
 * @param pluginName 插件名称
 * @returns Proxy 包装后的 PluginAPI 实例
 */
export function createPluginAPI(callbacks: PluginAPICallbacks, pluginName: string): PluginAPI {
  const api = new PluginAPI(callbacks, pluginName);

  const proxy = new Proxy(api, {
    get(target: PluginAPI, prop: string | symbol): unknown {
      if (typeof prop === 'symbol') {
        return undefined;
      }

      if (!ALLOWED_METHODS.has(prop)) {
        return undefined;
      }

      const value = target[prop as keyof PluginAPI];
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },

    set(): boolean {
      // 禁止插件修改 API 对象的属性
      return false;
    },

    deleteProperty(): boolean {
      // 禁止插件删除 API 对象的属性
      return false;
    },

    has(_target: PluginAPI, prop: string | symbol): boolean {
      if (typeof prop === 'symbol') {
        return false;
      }
      return ALLOWED_METHODS.has(prop);
    },

    ownKeys(): string[] {
      return [...ALLOWED_METHODS];
    },

    getOwnPropertyDescriptor(_target: PluginAPI, prop: string | symbol): PropertyDescriptor | undefined {
      if (typeof prop === 'symbol') {
        return undefined;
      }
      if (ALLOWED_METHODS.has(prop)) {
        return {
          configurable: true,
          enumerable: true,
          writable: false,
        };
      }
      return undefined;
    },
  });

  return proxy as unknown as PluginAPI;
}
