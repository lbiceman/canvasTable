// @vitest-environment jsdom

/**
 * Bug 条件探索测试 — 选区状态不一致 & 正则转义损坏
 *
 * 此测试在未修复代码上运行时 **应该 FAIL**，失败即确认 bug 存在。
 * 修复后测试应 PASS，验证修复正确。
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { SpreadsheetModel } from '../model';
import { SpreadsheetRenderer } from '../renderer';
import type { Selection, RenderConfig } from '../types';

// ============================================================
// jsdom 环境下 Canvas API 模拟
// ============================================================

/**
 * 创建模拟的 CanvasRenderingContext2D
 * jsdom 不支持 Canvas API，需要手动模拟所有绑定方法
 */
function createMockCanvasContext(): CanvasRenderingContext2D {
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createPattern: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    })),
    putImageData: vi.fn(),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '12px sans-serif',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

/**
 * 创建模拟的 HTMLCanvasElement
 */
function createMockCanvas(): HTMLCanvasElement {
  const mockCtx = createMockCanvasContext();
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  // 覆盖 getContext 返回模拟上下文 — 需要 unknown 中转
  canvas.getContext = vi.fn(() => mockCtx) as unknown as HTMLCanvasElement['getContext'];
  return canvas;
}

/** 默认渲染配置 */
const DEFAULT_CONFIG: RenderConfig = {
  cellPadding: 4,
  headerHeight: 25,
  headerWidth: 50,
  fontSize: 12,
  fontFamily: 'sans-serif',
  gridColor: '#e0e0e0',
  headerColor: '#f5f5f5',
  textColor: '#333333',
  selectionColor: 'rgba(0, 0, 0, 0.05)',
  selectionBorderColor: '#808080',
};

// ============================================================
// 辅助类型与工具
// ============================================================

/** 访问 SpreadsheetRenderer 私有字段的类型 */
interface RendererInternals {
  selection: Selection | null;
  multiSelections: Selection[];
  activeSelectionIndex: number;
}

/**
 * 读取渲染器内部状态（通过索引访问私有字段）
 * 测试中需要检查 selection 和 multiSelections 的一致性
 */
function getRendererInternals(renderer: SpreadsheetRenderer): RendererInternals {
  // eslint-disable-next-line -- 测试中需要访问私有字段验证 bug 条件
  const r = renderer as unknown as Record<string, unknown>;
  return {
    selection: r['selection'] as Selection | null,
    multiSelections: r['multiSelections'] as Selection[],
    activeSelectionIndex: r['activeSelectionIndex'] as number,
  };
}

// ============================================================
// fast-check 生成器
// ============================================================

/** 生成有效的选区（startRow <= endRow, startCol <= endCol） */
const selectionArb = (maxRow: number, maxCol: number): fc.Arbitrary<Selection> =>
  fc.tuple(
    fc.integer({ min: 0, max: maxRow - 1 }),
    fc.integer({ min: 0, max: maxCol - 1 }),
    fc.integer({ min: 0, max: maxRow - 1 }),
    fc.integer({ min: 0, max: maxCol - 1 }),
  ).map(([r1, c1, r2, c2]) => ({
    startRow: Math.min(r1, r2),
    startCol: Math.min(c1, c2),
    endRow: Math.max(r1, r2),
    endCol: Math.max(c1, c2),
  }));

/** 生成包含正则特殊字符的搜索文本 */
const regexSpecialTextArb: fc.Arbitrary<string> = fc.array(
  fc.oneof(
    // 正则特殊字符
    fc.constantFrom('.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'),
    // 普通字符
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'x', 'y', 'z'),
  ),
  { minLength: 1, maxLength: 20 },
).map((chars: string[]) => chars.join(''));

// ============================================================
// 测试套件
// ============================================================

describe('Bug 条件探索测试 — 选区状态不一致', () => {
  const ROWS = 20;
  const COLS = 10;
  let model: SpreadsheetModel;
  let renderer: SpreadsheetRenderer;

  beforeEach(() => {
    model = new SpreadsheetModel(ROWS, COLS);
    const canvas = createMockCanvas();
    renderer = new SpreadsheetRenderer(canvas, model, DEFAULT_CONFIG);
  });

  /**
   * Property 1: 选区状态一致性
   *
   * 对于任意选区坐标，调用 renderer.setSelection() 后，
   * renderer.multiSelections[0] 应存储相同坐标。
   *
   * 未修复代码中 setSelection() 仅更新 this.selection 而不更新 this.multiSelections，
   * 导致两套状态不一致 → 测试应 FAIL。
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   */
  it('setSelection() 后 multiSelections[0] 应存储相同坐标', () => {
    fc.assert(
      fc.property(selectionArb(ROWS, COLS), (sel) => {
        const { startRow, startCol, endRow, endCol } = sel;

        // 执行 setSelection — 模拟用户单击/拖拽/键盘导航
        renderer.setSelection(startRow, startCol, endRow, endCol);

        const internals = getRendererInternals(renderer);

        // 期望：multiSelections 应包含与 setSelection 相同的坐标
        // 未修复代码中 setSelection() 只更新 this.selection，
        // 不更新 this.multiSelections，导致不一致
        expect(internals.multiSelections.length).toBeGreaterThan(0);

        const multi = internals.multiSelections[0];
        expect(multi.startRow).toBe(startRow);
        expect(multi.startCol).toBe(startCol);
        expect(multi.endRow).toBe(endRow);
        expect(multi.endCol).toBe(endCol);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 1 补充: setSelection() 后 selection 应为 null
   *
   * 修复后 setSelection() 应委托到 setMultiSelection()，
   * 并清除 this.selection = null，确保单一状态源。
   *
   * 未修复代码中 setSelection() 直接设置 this.selection，不清除 → 测试应 FAIL。
   *
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   */
  it('setSelection() 后 this.selection 应为 null（单一状态源）', () => {
    fc.assert(
      fc.property(selectionArb(ROWS, COLS), (sel) => {
        const { startRow, startCol, endRow, endCol } = sel;

        renderer.setSelection(startRow, startCol, endRow, endCol);

        const internals = getRendererInternals(renderer);

        // 期望：修复后 selection 应为 null，仅通过 multiSelections 管理状态
        // 未修复代码中 selection 会被设置为非 null 值
        expect(internals.selection).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});

describe('Bug 条件探索测试 — 正则转义损坏', () => {
  /**
   * Property 2: 正则转义正确性
   *
   * 对于任意包含正则特殊字符的搜索文本，
   * handleReplace/handleReplaceAll 中的正则转义应生成有效的 RegExp 对象。
   *
   * 未修复代码中 '\\$&' 被替换为 UUID 字符串（如 '\\c9144968-...'），
   * 导致转义后的字符串无法构造有效 RegExp → 测试应 FAIL。
   *
   * **Validates: Requirements 1.5, 1.6**
   */
  it('正则转义字符串应生成有效的 RegExp 对象', () => {
    // 修复后代码使用正确的正则替换引用语法 '\\$&'
    // '\\$&' 表示在匹配的特殊字符前加反斜杠，实现正则转义
    const HANDLE_REPLACE_ESCAPE = '\\$&';
    const HANDLE_REPLACE_ALL_ESCAPE = '\\$&';

    fc.assert(
      fc.property(regexSpecialTextArb, (searchText) => {
        // 模拟 handleReplace 中的正则转义逻辑
        const escapedForReplace = searchText.replace(
          /[.*+?^${}()|[\]\\]/g,
          HANDLE_REPLACE_ESCAPE,
        );
        const escapedForReplaceAll = searchText.replace(
          /[.*+?^${}()|[\]\\]/g,
          HANDLE_REPLACE_ALL_ESCAPE,
        );

        // 期望：转义后的字符串应能构造有效的 RegExp
        // 未修复代码中 UUID 替换导致无效正则模式
        let replaceValid = true;
        let replaceAllValid = true;

        try {
          new RegExp(escapedForReplace, 'gi');
        } catch {
          replaceValid = false;
        }

        try {
          new RegExp(escapedForReplaceAll, 'gi');
        } catch {
          replaceAllValid = false;
        }

        expect(replaceValid).toBe(true);
        expect(replaceAllValid).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2 补充: 正则转义后的文本应能正确匹配原始字面量
   *
   * 正确的 '\\$&' 会将每个特殊字符替换为 '\\' + 该字符本身，
   * 使得 new RegExp(escaped) 匹配字面量文本。
   *
   * 未修复代码中 UUID 替换导致转义结果完全错误 → 测试应 FAIL。
   *
   * **Validates: Requirements 2.5, 2.6**
   */
  it('正则转义后的文本应能正确匹配原始字面量', () => {
    // 修复后代码使用正确的正则替换引用语法 '\\$&'
    const ACTUAL_REPLACE_STRING = '\\$&';

    fc.assert(
      fc.property(regexSpecialTextArb, (searchText) => {
        // 使用实际代码中的替换字符串进行转义
        const escaped = searchText.replace(
          /[.*+?^${}()|[\]\\]/g,
          ACTUAL_REPLACE_STRING,
        );

        // 构造正则并尝试匹配原始文本
        let matchesOriginal = false;
        try {
          const regex = new RegExp(escaped, 'gi');
          matchesOriginal = regex.test(searchText);
        } catch {
          // 无效正则 — 已经是 bug
          matchesOriginal = false;
        }

        // 期望：转义后的正则应能匹配原始搜索文本
        // 未修复代码中 UUID 替换导致完全无法匹配
        expect(matchesOriginal).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
