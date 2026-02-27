import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { serializeOperation, deserializeOperation } from '../operations';
import { CollabOperation } from '../types';

// ============================================================
// 操作生成器
// ============================================================

const arbitraryCellEditOp = (): fc.Arbitrary<CollabOperation> =>
  fc.record({
    type: fc.constant('cellEdit' as const),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.nat(),
    revision: fc.nat(),
    row: fc.nat({ max: 999 }),
    col: fc.nat({ max: 99 }),
    content: fc.string(),
    previousContent: fc.string(),
  });

const arbitraryCellMergeOp = (): fc.Arbitrary<CollabOperation> =>
  fc.tuple(fc.nat({ max: 999 }), fc.nat({ max: 99 }), fc.nat({ max: 10 }), fc.nat({ max: 10 }))
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

const arbitraryCellSplitOp = (): fc.Arbitrary<CollabOperation> =>
  fc.record({
    type: fc.constant('cellSplit' as const),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.nat(),
    revision: fc.nat(),
    row: fc.nat({ max: 999 }),
    col: fc.nat({ max: 99 }),
  });

const arbitraryRowInsertOp = (): fc.Arbitrary<CollabOperation> =>
  fc.record({
    type: fc.constant('rowInsert' as const),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.nat(),
    revision: fc.nat(),
    rowIndex: fc.nat({ max: 999 }),
    count: fc.integer({ min: 1, max: 100 }),
  });

const arbitraryRowDeleteOp = (): fc.Arbitrary<CollabOperation> =>
  fc.record({
    type: fc.constant('rowDelete' as const),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.nat(),
    revision: fc.nat(),
    rowIndex: fc.nat({ max: 999 }),
    count: fc.integer({ min: 1, max: 100 }),
  });

const arbitraryRowResizeOp = (): fc.Arbitrary<CollabOperation> =>
  fc.record({
    type: fc.constant('rowResize' as const),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.nat(),
    revision: fc.nat(),
    rowIndex: fc.nat({ max: 999 }),
    height: fc.integer({ min: 10, max: 500 }),
  });

const arbitraryColResizeOp = (): fc.Arbitrary<CollabOperation> =>
  fc.record({
    type: fc.constant('colResize' as const),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.nat(),
    revision: fc.nat(),
    colIndex: fc.nat({ max: 99 }),
    width: fc.integer({ min: 20, max: 800 }),
  });

const arbitraryFontColorOp = (): fc.Arbitrary<CollabOperation> =>
  fc.record({
    type: fc.constant('fontColor' as const),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.nat(),
    revision: fc.nat(),
    row: fc.nat({ max: 999 }),
    col: fc.nat({ max: 99 }),
    color: fc.stringMatching(/^#[0-9a-fA-F]{6}$/),
  });

const arbitraryBgColorOp = (): fc.Arbitrary<CollabOperation> =>
  fc.record({
    type: fc.constant('bgColor' as const),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
    timestamp: fc.nat(),
    revision: fc.nat(),
    row: fc.nat({ max: 999 }),
    col: fc.nat({ max: 99 }),
    color: fc.stringMatching(/^#[0-9a-fA-F]{6}$/),
  });

// 生成任意操作类型
const arbitraryOperation = (): fc.Arbitrary<CollabOperation> =>
  fc.oneof(
    arbitraryCellEditOp(),
    arbitraryCellMergeOp(),
    arbitraryCellSplitOp(),
    arbitraryRowInsertOp(),
    arbitraryRowDeleteOp(),
    arbitraryRowResizeOp(),
    arbitraryColResizeOp(),
    arbitraryFontColorOp(),
    arbitraryBgColorOp(),
  );

// ============================================================
// Property 1: 操作序列化往返一致性
// Feature: collaborative-editing, Property 1: 操作序列化往返一致性
// Validates: Requirements 2.2, 2.3, 2.4
// ============================================================

describe('Property 1: 操作序列化往返一致性', () => {
  it('对于任意有效的 CollabOperation，序列化后再反序列化应产生等价对象', () => {
    fc.assert(
      fc.property(arbitraryOperation(), (op) => {
        const serialized = serializeOperation(op);
        const deserialized = deserializeOperation(serialized);
        expect(deserialized).toEqual(op);
      }),
      { numRuns: 200 }
    );
  });
});
