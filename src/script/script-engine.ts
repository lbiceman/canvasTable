// 脚本引擎 - 提供沙箱化的脚本执行环境
import { SpreadsheetModel } from '../model';
import { HistoryManager } from '../history-manager';
import type { Selection } from '../types';

// 脚本 API 接口 - 暴露给用户脚本的安全操作集
export interface ScriptAPI {
  getCellValue(row: number, col: number): string;
  setCellValue(row: number, col: number, value: string): void;
  getSelection(): { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  setSelection(startRow: number, startCol: number, endRow: number, endCol: number): void;
  getRowCount(): number;
  getColCount(): number;
}

// 脚本执行结果
export interface ScriptResult {
  success: boolean;
  error?: { message: string; line?: number };
  output?: string;
  cellChanges: Array<{ row: number; col: number; oldValue: string; newValue: string }>;
}

// 已保存的脚本
export interface SavedScript {
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

// 单元格变更记录（内部使用）
interface CellChange {
  row: number;
  col: number;
  oldValue: string;
  newValue: string;
}

// localStorage 存储键
const STORAGE_KEY = 'ice-excel-scripts';

// 脚本执行超时时间（毫秒）
const EXECUTION_TIMEOUT = 10000;

export class ScriptEngine {
  private model: SpreadsheetModel;
  private historyManager: HistoryManager;
  private currentSelection: Selection | null = null;

  constructor(model: SpreadsheetModel, historyManager: HistoryManager) {
    this.model = model;
    this.historyManager = historyManager;
  }

  // 设置当前选区（由外部控制器调用）
  public setSelection(selection: Selection | null): void {
    this.currentSelection = selection;
  }

  // 在沙箱中执行脚本，超时 10 秒
  public execute(code: string): ScriptResult {
    const cellChanges: CellChange[] = [];
    let timedOut = false;
    const outputMessages: string[] = [];

    // 构建 ScriptAPI 实例
    const api = this.createScriptAPI(cellChanges, () => timedOut);

    // 构建沙箱代理 - 拦截全局访问
    const sandbox = this.createSandbox(api, outputMessages);

    try {
      // 使用 new Function 构造脚本，注入沙箱环境
      // eslint-disable-next-line no-new-func -- 脚本引擎需要动态执行用户代码
      const scriptFn = new Function(
        'sandbox',
        `with(sandbox) { ${code} }`
      );

      // 设置超时标志
      const timeoutId = setTimeout(() => {
        timedOut = true;
      }, EXECUTION_TIMEOUT);

      try {
        scriptFn(sandbox);
      } finally {
        clearTimeout(timeoutId);
      }

      // 检查是否超时
      if (timedOut) {
        // 超时：回滚所有已执行的修改
        this.rollbackChanges(cellChanges);
        return {
          success: false,
          error: { message: '脚本执行超时（超过10秒）' },
          cellChanges: [],
        };
      }

      // 执行成功：通过 HistoryManager 记录为单条可撤销操作
      if (cellChanges.length > 0) {
        this.recordHistoryEntry(cellChanges);
      }

      return {
        success: true,
        output: outputMessages.length > 0 ? outputMessages.join('\n') : undefined,
        cellChanges: cellChanges.map(({ row, col, oldValue, newValue }) => ({
          row, col, oldValue, newValue,
        })),
      };
    } catch (err: unknown) {
      // 运行时错误：回滚所有已执行的修改
      this.rollbackChanges(cellChanges);

      const errorInfo = this.parseError(err);
      return {
        success: false,
        error: errorInfo,
        cellChanges: [],
      };
    }
  }

  // 保存脚本到 localStorage
  public saveScript(name: string, code: string): void {
    const scripts = this.loadScripts();
    const now = new Date().toISOString();
    const existingIndex = scripts.findIndex((s) => s.name === name);

    if (existingIndex >= 0) {
      // 更新已有脚本
      scripts[existingIndex].code = code;
      scripts[existingIndex].updatedAt = now;
    } else {
      // 新增脚本
      scripts.push({
        name,
        code,
        createdAt: now,
        updatedAt: now,
      });
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
    } catch (e: unknown) {
      console.error('保存脚本失败:', e);
    }
  }

  // 加载已保存的脚本列表
  public loadScripts(): SavedScript[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // 验证每个条目的结构
      return parsed.filter((item: unknown): item is SavedScript => {
        if (typeof item !== 'object' || item === null) return false;
        const obj = item as Record<string, unknown>;
        return (
          typeof obj.name === 'string' &&
          typeof obj.code === 'string' &&
          typeof obj.createdAt === 'string' &&
          typeof obj.updatedAt === 'string'
        );
      });
    } catch (e: unknown) {
      console.warn('加载脚本列表失败:', e);
      return [];
    }
  }

  // 删除已保存的脚本
  public deleteScript(name: string): void {
    const scripts = this.loadScripts();
    const filtered = scripts.filter((s) => s.name !== name);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e: unknown) {
      console.error('删除脚本失败:', e);
    }
  }

  // 创建 ScriptAPI 实例
  private createScriptAPI(
    cellChanges: CellChange[],
    isTimedOut: () => boolean
  ): ScriptAPI {
    const model = this.model;

    return {
      // 获取单元格值 - 越界返回空字符串
      getCellValue: (row: number, col: number): string => {
        if (isTimedOut()) return '';
        if (row < 0 || row >= model.getRowCount() || col < 0 || col >= model.getColCount()) {
          return '';
        }
        return model.getComputedValue(row, col);
      },

      // 设置单元格值 - 越界静默忽略
      setCellValue: (row: number, col: number, value: string): void => {
        if (isTimedOut()) return;
        if (row < 0 || row >= model.getRowCount() || col < 0 || col >= model.getColCount()) {
          return;
        }
        const oldValue = model.getComputedValue(row, col);
        // 暂停历史记录，手动跟踪变更
        model.getHistoryManager().pauseRecording();
        try {
          model.setCellContent(row, col, value);
        } finally {
          model.getHistoryManager().resumeRecording();
        }
        const newValue = model.getComputedValue(row, col);
        cellChanges.push({ row, col, oldValue, newValue });
      },

      // 获取当前选区
      getSelection: (): { startRow: number; startCol: number; endRow: number; endCol: number } | null => {
        if (!this.currentSelection) return null;
        const { startRow, startCol, endRow, endCol } = this.currentSelection;
        return { startRow, startCol, endRow, endCol };
      },

      // 设置选区
      setSelection: (startRow: number, startCol: number, endRow: number, endCol: number): void => {
        this.currentSelection = { startRow, startCol, endRow, endCol };
      },

      // 获取总行数
      getRowCount: (): number => {
        return model.getRowCount();
      },

      // 获取总列数
      getColCount: (): number => {
        return model.getColCount();
      },
    };
  }

  // 创建沙箱代理 - 拦截全局变量访问
  private createSandbox(api: ScriptAPI, outputMessages: string[]): Record<string, unknown> {
    // 危险属性黑名单 - 阻断原型链逃逸攻击路径
    const DANGEROUS_PROPS: ReadonlySet<string> = new Set([
      'constructor', '__proto__', 'prototype',
      '__defineGetter__', '__defineSetter__',
      '__lookupGetter__', '__lookupSetter__',
    ]);

    /**
     * 包装白名单对象，拦截原型链访问
     * 对函数和对象类型的值进行 Proxy 包装，阻止通过 .constructor 等属性逃逸
     */
    const wrapSafe = (value: unknown): unknown => {
      if (value === null || value === undefined) return value;
      if (typeof value !== 'object' && typeof value !== 'function') return value;

      return new Proxy(value as object, {
        get(target: object, prop: string | symbol): unknown {
          if (typeof prop === 'string' && DANGEROUS_PROPS.has(prop)) {
            return undefined;
          }
          return Reflect.get(target, prop);
        },
      });
    };

    // 安全的全局对象白名单
    const allowedGlobals: Record<string, unknown> = {
      // ScriptAPI 方法
      getCellValue: api.getCellValue,
      setCellValue: api.setCellValue,
      getSelection: api.getSelection,
      setSelection: api.setSelection,
      getRowCount: api.getRowCount,
      getColCount: api.getColCount,
      // 安全的内置对象（通过 wrapSafe 包装阻断原型链）
      Math: wrapSafe(Math),
      Date: wrapSafe(Date),
      String: wrapSafe(String),
      Number: wrapSafe(Number),
      Boolean: wrapSafe(Boolean),
      Array: wrapSafe(Array),
      Object: wrapSafe(Object),
      JSON: wrapSafe(JSON),
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      undefined,
      NaN,
      Infinity,
      // 控制台输出（受限）
      console: {
        log: (...args: unknown[]) => {
          // 收集脚本输出
          outputMessages.push(args.map((a) => String(a)).join(' '));
        },
      },
    };

    // 使用 Proxy 拦截所有属性访问
    const handler: ProxyHandler<Record<string, unknown>> = {
      has: (): boolean => {
        // 让 with 语句拦截所有变量查找
        return true;
      },
      get: (_target: Record<string, unknown>, prop: string | symbol): unknown => {
        if (typeof prop === 'symbol') return undefined;
        // 阻止访问危险的原型链属性
        if (DANGEROUS_PROPS.has(prop)) {
          return undefined;
        }
        // 允许访问白名单中的全局对象
        if (prop in allowedGlobals) {
          return allowedGlobals[prop];
        }
        // 阻止访问危险的全局对象
        return undefined;
      },
      set: (_target: Record<string, unknown>, prop: string | symbol, value: unknown): boolean => {
        if (typeof prop === 'symbol') return false;
        // 阻止覆盖危险属性
        if (DANGEROUS_PROPS.has(prop)) return false;
        // 允许脚本内部定义变量
        allowedGlobals[prop] = value;
        return true;
      },
    };

    return new Proxy(allowedGlobals, handler);
  }

  // 回滚所有已执行的单元格修改
  private rollbackChanges(cellChanges: CellChange[]): void {
    this.model.getHistoryManager().pauseRecording();
    try {
      // 逆序回滚，确保多次修改同一单元格时恢复到最初状态
      for (let i = cellChanges.length - 1; i >= 0; i--) {
        const { row, col, oldValue } = cellChanges[i];
        this.model.setCellContent(row, col, oldValue);
      }
    } finally {
      this.model.getHistoryManager().resumeRecording();
    }
  }

  // 将所有单元格变更记录为单条 HistoryManager 操作
  private recordHistoryEntry(cellChanges: CellChange[]): void {
    this.historyManager.record({
      type: 'scriptExecution',
      data: {
        changes: cellChanges.map(({ row, col, newValue }) => ({
          row, col, value: newValue,
        })),
      },
      undoData: {
        changes: cellChanges.map(({ row, col, oldValue }) => ({
          row, col, value: oldValue,
        })),
      },
    });
  }

  // 解析错误信息，尝试提取行号
  private parseError(err: unknown): { message: string; line?: number } {
    if (err instanceof Error) {
      const message = err.message;
      // 尝试从错误堆栈中提取行号
      const lineMatch = err.stack?.match(/<anonymous>:(\d+):\d+/);
      const line = lineMatch ? parseInt(lineMatch[1], 10) - 1 : undefined;
      return { message, line };
    }
    return { message: String(err) };
  }
}
