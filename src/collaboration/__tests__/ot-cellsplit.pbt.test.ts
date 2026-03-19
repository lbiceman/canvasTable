import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { transform } from '../ot';
import { CollabOperation as _CollabOperation, CellSplitOp, CellEditOp, CellMergeOp } from '../types';

describe('PBT - CellSplit OT 对称性', () => {
  it('CellSplit 和 CellEdit 转换不抛异常，类型保持不变', () => {
    const arb = fc.record({
      split: arbitraryCellSplitOp(),
      edit: arbitraryCellEditOp(),
    });

    fc.assert(
      fc.property(arb, ({ split, edit }) => {
        const [aPrime, bPrime] = transform(split, edit);
        if (aPrime !== null) {
          expect(aPrime.type).toBe(split.type);
        }
        if (bPrime !== null) {
          expect(bPrime.type).toBe(edit.type);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('CellSplit 和 CellMerge 转换不抛异常，类型保持不变', () => {
    const arb = fc.record({
      split: arbitraryCellSplitOp(),
      merge: arbitraryCellMergeOp(),
    });

    fc.assert(
      fc.property(arb, ({ split, merge }) => {
        const [aPrime, bPrime] = transform(split, merge);
        if (aPrime !== null) {
          expect(aPrime.type).toBe(split.type);
        }
        if (bPrime !== null) {
          expect(bPrime.type).toBe(merge.type);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('两个 CellSplit 转换不抛异常，类型保持不变', () => {
    const arb = fc.record({
      splitA: arbitraryCellSplitOp(),
      splitB: arbitraryCellSplitOp(),
    });

    fc.assert(
      fc.property(arb, ({ splitA, splitB }) => {
        const [aPrime, bPrime] = transform(splitA, splitB);
        if (aPrime !== null) {
          expect(aPrime.type).toBe('cellSplit');
        }
        if (bPrime !== null) {
          expect(bPrime.type).toBe('cellSplit');
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('PBT - CellSplit 幂等性', () => {
  it('两个相同位置的 CellSplit，转换后至少一个为 null', () => {
    fc.assert(
      fc.property(arbitraryCellSplitOp(), (splitOp) => {
        const [aPrime, bPrime] = transform(splitOp, { ...splitOp } as CellSplitOp);
        expect(aPrime === null || bPrime === null).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

describe('PBT - CellEdit 重定向一致性', () => {
  it('编辑在拆分区域内时，转换后的 row/col 等于拆分操作的左上角', () => {
    const arb = fc.record({
      split: fc.record({
        row: fc.nat({ max: 100 }),
        col: fc.nat({ max: 50 }),
        rowSpan: fc.integer({ min: 2, max: 10 }),
        colSpan: fc.integer({ min: 2, max: 10 }),
      }),
    }).chain(({ split }) =>
      fc.record({
        split: fc.record({
          type: fc.constant('cellSplit' as const),
          userId: fc.string({ minLength: 1 }),
          timestamp: fc.nat(),
          revision: fc.nat(),
          row: fc.constant(split.row),
          col: fc.constant(split.col),
          rowSpan: fc.constant(split.rowSpan),
          colSpan: fc.constant(split.colSpan),
        }),
        editRow: fc.nat({ max: split.rowSpan - 1 }).map((offset) => split.row + offset),
        editCol: fc.nat({ max: split.colSpan - 1 }).map((offset) => split.col + offset),
      })
    );

    fc.assert(
      fc.property(arb, ({ split, editRow, editCol }) => {
        const editOp: CellEditOp = {
          type: 'cellEdit',
          userId: 'user',
          timestamp: 1,
          revision: 1,
          row: editRow,
          col: editCol,
          content: 'test',
          previousContent: '',
        };

        const [aPrime] = transform(editOp, split as CellSplitOp);
        expect(aPrime).not.toBeNull();
        expect((aPrime as CellEditOp).row).toBe(split.row);
        expect((aPrime as CellEditOp).col).toBe(split.col);
      }),
      { numRuns: 100 }
    );
  });

  it('编辑在拆分区域外时，row/col 不变', () => {
    const arb = fc.record({
      split: fc.record({
        row: fc.nat({ max: 50 }),
        col: fc.nat({ max: 30 }),
        rowSpan: fc.integer({ min: 1, max: 5 }),
        colSpan: fc.integer({ min: 1, max: 5 }),
      }),
    }).chain(({ split }) =>
      fc.record({
        split: fc.record({
          type: fc.constant('cellSplit' as const),
          userId: fc.string({ minLength: 1 }),
          timestamp: fc.nat(),
          revision: fc.nat(),
          row: fc.constant(split.row),
          col: fc.constant(split.col),
          rowSpan: fc.constant(split.rowSpan),
          colSpan: fc.constant(split.colSpan),
        }),
        editRow: fc.integer({ min: split.row + split.rowSpan + 1, max: split.row + split.rowSpan + 20 }),
        editCol: fc.integer({ min: split.col + split.colSpan + 1, max: split.col + split.colSpan + 20 }),
      })
    );

    fc.assert(
      fc.property(arb, ({ split, editRow, editCol }) => {
        const editOp: CellEditOp = {
          type: 'cellEdit',
          userId: 'user',
          timestamp: 1,
          revision: 1,
          row: editRow,
          col: editCol,
          content: 'test',
          previousContent: '',
        };

        const [aPrime] = transform(editOp, split as CellSplitOp);
        expect(aPrime).not.toBeNull();
        expect((aPrime as CellEditOp).row).toBe(editRow);
        expect((aPrime as CellEditOp).col).toBe(editCol);
      }),
      { numRuns: 100 }
    );
  });
});

function arbitraryCellEditOp(): fc.Arbitrary<CellEditOp> {
  return fc.record({
    type: fc.constant('cellEdit' as const),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.nat(),
    revision: fc.nat(),
    row: fc.nat({ max: 999 }),
    col: fc.nat({ max: 99 }),
    content: fc.string(),
    previousContent: fc.string(),
  });
}

function arbitraryCellSplitOp(): fc.Arbitrary<CellSplitOp> {
  return fc.record({
    type: fc.constant('cellSplit' as const),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.nat(),
    revision: fc.nat(),
    row: fc.nat({ max: 999 }),
    col: fc.nat({ max: 99 }),
    rowSpan: fc.integer({ min: 1, max: 10 }),
    colSpan: fc.integer({ min: 1, max: 10 }),
  });
}

function arbitraryCellMergeOp(): fc.Arbitrary<CellMergeOp> {
  return fc
    .tuple(
      fc.nat({ max: 999 }),
      fc.nat({ max: 99 }),
      fc.nat({ max: 10 }),
      fc.nat({ max: 10 })
    )
    .filter(([_sr, _sc, dr, dc]) => dr > 0 || dc > 0)
    .chain(([sr, sc, dr, dc]) =>
      fc.record({
        type: fc.constant('cellMerge' as const),
        userId: fc.string({ minLength: 1, maxLength: 20 }),
        timestamp: fc.nat(),
        revision: fc.nat(),
        startRow: fc.constant(sr),
        startCol: fc.constant(sc),
        endRow: fc.constant(sr + dr),
        endCol: fc.constant(sc + dc),
      })
    );
}
