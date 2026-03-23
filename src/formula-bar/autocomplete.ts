// ============================================================
// 自动补全组件（AutoComplete）
// 根据输入前缀从 FunctionRegistry 和 NamedRangeManager 搜索候选项
// 支持键盘导航（上下方向键移动、Tab/Enter 确认、Escape 关闭）
// Requirements: 7.2, 7.3, 7.5, 7.6, 7.7, 9.9
// ============================================================

import type { FunctionRegistry } from '../formula/function-registry';
import type { NamedRangeManager } from '../formula/named-range';
import type { FunctionCategory } from '../formula/types';

/** 候选项来源类型 */
export type SuggestionSource = 'function' | 'namedRange';

/** 自动补全候选项 */
export interface AutoCompleteSuggestion {
  /** 候选项名称 */
  name: string;
  /** 候选项类别（函数类别或 'namedRange'） */
  category: FunctionCategory | 'namedRange';
  /** 候选项描述 */
  description: string;
  /** 候选项来源 */
  source: SuggestionSource;
}

/** 自动补全状态 */
interface AutoCompleteState {
  /** 候选项列表 */
  suggestions: AutoCompleteSuggestion[];
  /** 当前选中项索引，-1 表示无选中 */
  selectedIndex: number;
  /** 是否可见 */
  visible: boolean;
}

/**
 * 自动补全组件
 * - 接收 FunctionRegistry 和 NamedRangeManager 实例
 * - 提供 search(prefix) 方法搜索候选项
 * - 支持键盘导航状态管理
 */
export class AutoComplete {
  private readonly functionRegistry: FunctionRegistry;
  private readonly namedRangeManager: NamedRangeManager;
  private state: AutoCompleteState;

  constructor(
    functionRegistry: FunctionRegistry,
    namedRangeManager: NamedRangeManager
  ) {
    this.functionRegistry = functionRegistry;
    this.namedRangeManager = namedRangeManager;
    this.state = {
      suggestions: [],
      selectedIndex: -1,
      visible: false,
    };
  }

  /**
   * 根据前缀搜索候选项（函数和命名范围混合）
   * 不区分大小写匹配
   * @param prefix 输入前缀
   * @returns 匹配的候选项列表
   */
  search(prefix: string): AutoCompleteSuggestion[] {
    // 空前缀不显示候选列表
    if (!prefix || prefix.trim().length === 0) {
      this.state = { suggestions: [], selectedIndex: -1, visible: false };
      return [];
    }

    const upperPrefix = prefix.toUpperCase();
    const suggestions: AutoCompleteSuggestion[] = [];

    // 从 FunctionRegistry 搜索匹配的函数
    const matchedFunctions = this.functionRegistry.searchByPrefix(prefix);
    for (const funcDef of matchedFunctions) {
      suggestions.push({
        name: funcDef.name,
        category: funcDef.category,
        description: funcDef.description,
        source: 'function',
      });
    }

    // 从 NamedRangeManager 搜索匹配的命名范围
    const allNamedRanges = this.namedRangeManager.getAll();
    for (const namedRange of allNamedRanges) {
      if (namedRange.name.toUpperCase().startsWith(upperPrefix)) {
        // 构建区域描述字符串
        const rangeDesc = namedRange.sheetScope
          ? `${namedRange.sheetScope}!区域引用`
          : '区域引用';
        suggestions.push({
          name: namedRange.name,
          category: 'namedRange',
          description: rangeDesc,
          source: 'namedRange',
        });
      }
    }

    // 按名称字母排序，函数优先于命名范围
    suggestions.sort((a, b) => {
      if (a.source !== b.source) {
        return a.source === 'function' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    // 更新状态
    this.state = {
      suggestions,
      selectedIndex: suggestions.length > 0 ? 0 : -1,
      visible: suggestions.length > 0,
    };

    return suggestions;
  }

  /** 获取当前候选项列表 */
  getSuggestions(): AutoCompleteSuggestion[] {
    return this.state.suggestions;
  }

  /** 获取当前选中项索引 */
  getSelectedIndex(): number {
    return this.state.selectedIndex;
  }

  /** 候选列表是否可见 */
  get isVisible(): boolean {
    return this.state.visible;
  }

  /**
   * 向上移动选中项
   * 如果已在顶部则循环到底部
   */
  moveUp(): void {
    if (!this.state.visible || this.state.suggestions.length === 0) {
      return;
    }
    const count = this.state.suggestions.length;
    if (this.state.selectedIndex <= 0) {
      // 循环到底部
      this.state.selectedIndex = count - 1;
    } else {
      this.state.selectedIndex--;
    }
  }

  /**
   * 向下移动选中项
   * 如果已在底部则循环到顶部
   */
  moveDown(): void {
    if (!this.state.visible || this.state.suggestions.length === 0) {
      return;
    }
    const count = this.state.suggestions.length;
    if (this.state.selectedIndex >= count - 1) {
      // 循环到顶部
      this.state.selectedIndex = 0;
    } else {
      this.state.selectedIndex++;
    }
  }

  /**
   * 确认当前选中项
   * @returns 选中的候选项，如果无选中则返回 null
   */
  confirm(): AutoCompleteSuggestion | null {
    if (
      !this.state.visible ||
      this.state.selectedIndex < 0 ||
      this.state.selectedIndex >= this.state.suggestions.length
    ) {
      return null;
    }
    const selected = this.state.suggestions[this.state.selectedIndex];
    // 确认后关闭候选列表
    this.dismiss();
    return selected;
  }

  /**
   * 关闭候选列表（Escape 键触发）
   */
  dismiss(): void {
    this.state = {
      suggestions: [],
      selectedIndex: -1,
      visible: false,
    };
  }
}
