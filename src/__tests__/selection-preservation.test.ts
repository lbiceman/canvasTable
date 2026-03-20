// @vitest-environment jsdom

/**
 * 保持性属性测试 — 非 Bug 条件功能行为保持不变
 *
 * 这些测试验证不涉及 bug 条件的功能，在未修复代码上应 PASS。
 * 修复后这些测试也应继续 PASS，确认无回归。
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { MultiSelectionManager } from '../multi-selection';
import type { Selection } from '../types';

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

// ============================================================
// 测试套件
// ============================================================

describe('保持性属性测试 — 多选区与现有功能保持不变', () => {
  const ROWS = 50;
  const COLS = 26;
  let multiSelection: MultiSelectionManager;

  beforeEach(() => {
    multiSelection = new MultiSelectionManager();
  });

  /**
   * Property: Ctrl+点击多选区保持
   *
   * 对于任意 Ctrl+点击操作序列，每次 addSelection() 后
   * getSelections().length 应递增 1。
   *
   * **Validates: Requirements 3.1**
   */
  it('Ctrl+点击多选区：addSelection() 后 getSelections().length 应递增', () => {
    fc.assert(
      fc.property(
        // 生成 2~10 个随机选区，模拟多次 Ctrl+点击
        fc.array(selectionArb(ROWS, COLS), { minLength: 2, maxLength: 10 }),
        (selections) => {
          // 先设置第一个选区（模拟首次点击）
          multiSelection.setSingle(selections[0]);
          expect(multiSelection.getSelections().length).toBe(1);

          // 后续选区通过 addSelection 添加（模拟 Ctrl+点击）
          for (let i = 1; i < selections.length; i++) {
            const prevCount = multiSelection.getSelections().length;
            multiSelection.addSelection(selections[i]);
            expect(multiSelection.getSelections().length).toBe(prevCount + 1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: 行号点击选择整行保持
   *
   * 对于任意行号点击，选区应覆盖整行（startCol=0, endCol=maxCol）。
   *
   * **Validates: Requirements 3.2**
   */
  it('行号点击选择整行：选区应覆盖 startCol=0, endCol=maxCol', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: ROWS - 1 }),
        (row) => {
          const maxCol = COLS - 1;
          // 模拟行号点击：选区覆盖整行
          const rowSelection: Selection = {
            startRow: row,
            startCol: 0,
            endRow: row,
            endCol: maxCol,
          };
          multiSelection.setSingle(rowSelection);

          const sel = multiSelection.getSelections()[0];
          expect(sel.startCol).toBe(0);
          expect(sel.endCol).toBe(maxCol);
          expect(sel.startRow).toBe(row);
          expect(sel.endRow).toBe(row);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: 列号点击选择整列保持
   *
   * 对于任意列号点击，选区应覆盖整列（startRow=0, endRow=maxRow）。
   *
   * **Validates: Requirements 3.2**
   */
  it('列号点击选择整列：选区应覆盖 startRow=0, endRow=maxRow', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: COLS - 1 }),
        (col) => {
          const maxRow = ROWS - 1;
          // 模拟列号点击：选区覆盖整列
          const colSelection: Selection = {
            startRow: 0,
            startCol: col,
            endRow: maxRow,
            endCol: col,
          };
          multiSelection.setSingle(colSelection);

          const sel = multiSelection.getSelections()[0];
          expect(sel.startRow).toBe(0);
          expect(sel.endRow).toBe(maxRow);
          expect(sel.startCol).toBe(col);
          expect(sel.endCol).toBe(col);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: 全选保持
   *
   * 对于任意表格尺寸，Ctrl+A 全选后 isSelectAll() 应返回 true。
   *
   * **Validates: Requirements 3.3**
   */
  it('Ctrl+A 全选：isSelectAll() 应返回 true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 1, max: 100 }),
        (maxRow, maxCol) => {
          multiSelection.selectAll(maxRow - 1, maxCol - 1);

          expect(multiSelection.isSelectAll()).toBe(true);

          // 全选后选区应覆盖整个表格
          const selections = multiSelection.getSelections();
          expect(selections.length).toBe(1);
          expect(selections[0].startRow).toBe(0);
          expect(selections[0].startCol).toBe(0);
          expect(selections[0].endRow).toBe(maxRow - 1);
          expect(selections[0].endCol).toBe(maxCol - 1);
        },
      ),
      { numRuns: 100 },
    );
  });
});
