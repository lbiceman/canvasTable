import { describe, it, expect } from 'vitest';
import { transform, invertOperation, ModelReader } from '../ot';
import { serializeOperation, deserializeOperation } from '../operations';
import {
  ColInsertOp,
  ColDeleteOp,
  CellEditOp,
  CellMergeOp,
  CellSplitOp,
  ColResizeOp,
  RowInsertOp,
  RowDeleteOp,
  RowResizeOp,
  FontColorOp,
  BgColorOp,
} from '../types';

// ============================================================
// 测试辅助：基础字段
// ============================================================

const baseA = { userId: 'user-a', timestamp: 1000, revision: 1 };
const baseB = { userId: 'user-b', timestamp: 1001, revision: 1 };

/** 创建 ColInsertOp */
const colInsert = (colIndex: number, count: number): ColInsertOp => ({
  ...baseA, type: 'colInsert', colIndex, count,
});

/** 创建 ColDeleteOp */
const colDelete = (colIndex: number, count: number): ColDeleteOp => ({
  ...baseA, type: 'colDelete', colIndex, count,
});

/** 创建 CellEditOp */
const cellEdit = (row: number, col: number): CellEditOp => ({
  ...baseA, type: 'cellEdit', row, col, content: 'x', previousContent: '',
});

/** 创建 CellMergeOp */
const cellMerge = (startRow: number, startCol: number, endRow: number, endCol: number): CellMergeOp => ({
  ...baseA, type: 'cellMerge', startRow, startCol, endRow, endCol,
});

/** 创建 CellSplitOp */
const cellSplit = (row: number, col: number, rowSpan = 1, colSpan = 1): CellSplitOp => ({
  ...baseA, type: 'cellSplit', row, col, rowSpan, colSpan,
});

/** 创建 ColResizeOp */
const colResize = (colIndex: number): ColResizeOp => ({
  ...baseA, type: 'colResize', colIndex, width: 100,
});

/** 创建 RowInsertOp */
const rowInsert = (rowIndex: number, count: number): RowInsertOp => ({
  ...baseA, type: 'rowInsert', rowIndex, count,
});

/** 创建 RowDeleteOp */
const rowDelete = (rowIndex: number, count: number): RowDeleteOp => ({
  ...baseA, type: 'rowDelete', rowIndex, count,
});

/** 创建 RowResizeOp */
const rowResize = (rowIndex: number): RowResizeOp => ({
  ...baseA, type: 'rowResize', rowIndex, height: 30,
});

/** 创建 FontColorOp */
const fontColor = (row: number, col: number): FontColorOp => ({
  ...baseA, type: 'fontColor', row, col, color: '#ff0000',
});

/** 创建 BgColorOp */
const bgColor = (row: number, col: number): BgColorOp => ({
  ...baseA, type: 'bgColor', row, col, color: '#00ff00',
});

/** 简单的 ModelReader mock（colInsert/colDelete 的 invertOperation 不需要读取模型） */
const mockModel: ModelReader = {
  getCell: () => null,
  getRowHeight: () => 25,
  getColWidth: () => 80,
};

// ============================================================
// 8.2 序列化/反序列化测试
// ============================================================

describe('8.2 ColInsertOp / ColDeleteOp 序列化与反序列化', () => {
  const baseFields = { userId: 'user-1', timestamp: 1700000000000, revision: 5 };

  it('ColInsertOp 正常序列化/反序列化', () => {
    const op: ColInsertOp = { ...baseFields, type: 'colInsert', colIndex: 3, count: 2 };
    const json = serializeOperation(op);
    const result = deserializeOperation(json);
    expect(result).toEqual(op);
  });

  it('ColDeleteOp 正常序列化/反序列化', () => {
    const op: ColDeleteOp = { ...baseFields, type: 'colDelete', colIndex: 5, count: 1 };
    const json = serializeOperation(op);
    const result = deserializeOperation(json);
    expect(result).toEqual(op);
  });

  it('colIndex 为负数时抛出错误', () => {
    const json = JSON.stringify({ ...baseFields, type: 'colInsert', colIndex: -1, count: 1 });
    expect(() => deserializeOperation(json)).toThrow();
  });

  it('count 为 0 时抛出错误', () => {
    const json = JSON.stringify({ ...baseFields, type: 'colInsert', colIndex: 0, count: 0 });
    expect(() => deserializeOperation(json)).toThrow();
  });

  it('count 为负数时抛出错误', () => {
    const json = JSON.stringify({ ...baseFields, type: 'colDelete', colIndex: 0, count: -2 });
    expect(() => deserializeOperation(json)).toThrow();
  });
});

// ============================================================
// 8.3 invertOperation 测试
// ============================================================

describe('8.3 invertOperation：colInsert ↔ colDelete 互为反向', () => {
  it('colInsert 的反向操作是 colDelete，其他字段不变', () => {
    const op = colInsert(3, 2);
    const inv = invertOperation(op, mockModel) as ColDeleteOp;
    expect(inv.type).toBe('colDelete');
    expect(inv.colIndex).toBe(3);
    expect(inv.count).toBe(2);
    expect(inv.userId).toBe(op.userId);
    expect(inv.revision).toBe(op.revision);
  });

  it('colDelete 的反向操作是 colInsert，其他字段不变', () => {
    const op = colDelete(5, 3);
    const inv = invertOperation(op, mockModel) as ColInsertOp;
    expect(inv.type).toBe('colInsert');
    expect(inv.colIndex).toBe(5);
    expect(inv.count).toBe(3);
    expect(inv.userId).toBe(op.userId);
    expect(inv.revision).toBe(op.revision);
  });

  it('invertOperation(invertOperation(op)) 等价于原操作（colInsert）', () => {
    const op = colInsert(2, 4);
    const inv = invertOperation(op, mockModel);
    const invInv = invertOperation(inv, mockModel) as ColInsertOp;
    expect(invInv.type).toBe('colInsert');
    expect(invInv.colIndex).toBe(op.colIndex);
    expect(invInv.count).toBe(op.count);
  });
});

// ============================================================
// 8.4 transformCellEditVsColInsert（3 个用例）
// ============================================================

describe('8.4 transformCellEditVsColInsert', () => {
  it('编辑列在插入点左侧：col 不变', () => {
    const [aPrime] = transform(cellEdit(0, 2), { ...baseB, ...colInsert(5, 3) });
    expect((aPrime as CellEditOp).col).toBe(2);
  });

  it('编辑列在插入点右侧：col += count', () => {
    const [aPrime] = transform(cellEdit(0, 7), { ...baseB, ...colInsert(5, 3) });
    expect((aPrime as CellEditOp).col).toBe(10);
  });

  it('编辑列等于插入点（边界）：col += count', () => {
    const [aPrime] = transform(cellEdit(0, 5), { ...baseB, ...colInsert(5, 3) });
    expect((aPrime as CellEditOp).col).toBe(8);
  });
});

// ============================================================
// 8.5 transformCellEditVsColDelete（4 个用例）
// ============================================================

describe('8.5 transformCellEditVsColDelete', () => {
  it('编辑列在删除范围左侧：col 不变', () => {
    const [aPrime] = transform(cellEdit(0, 2), { ...baseB, ...colDelete(5, 3) });
    expect((aPrime as CellEditOp).col).toBe(2);
  });

  it('编辑列在删除范围右侧：col -= count', () => {
    const [aPrime] = transform(cellEdit(0, 9), { ...baseB, ...colDelete(5, 3) });
    expect((aPrime as CellEditOp).col).toBe(6);
  });

  it('编辑列在删除范围内：返回 null', () => {
    const [aPrime] = transform(cellEdit(0, 6), { ...baseB, ...colDelete(5, 3) });
    expect(aPrime).toBeNull();
  });

  it('编辑列等于删除起始点（边界）：返回 null', () => {
    const [aPrime] = transform(cellEdit(0, 5), { ...baseB, ...colDelete(5, 3) });
    expect(aPrime).toBeNull();
  });
});

// ============================================================
// 8.6 transformCellMergeVsColInsert（3 个用例）
// ============================================================

describe('8.6 transformCellMergeVsColInsert', () => {
  it('合并区域完全在插入点右侧：startCol 和 endCol 均 += count', () => {
    // 合并 [0, 5..8]，在列 3 插入 2 列 → [0, 7..10]
    const [aPrime] = transform(cellMerge(0, 5, 0, 8), { ...baseB, ...colInsert(3, 2) });
    const m = aPrime as CellMergeOp;
    expect(m.startCol).toBe(7);
    expect(m.endCol).toBe(10);
  });

  it('合并区域完全在插入点左侧：不变', () => {
    // 合并 [0, 1..3]，在列 5 插入 2 列 → 不变
    const [aPrime] = transform(cellMerge(0, 1, 0, 3), { ...baseB, ...colInsert(5, 2) });
    const m = aPrime as CellMergeOp;
    expect(m.startCol).toBe(1);
    expect(m.endCol).toBe(3);
  });

  it('插入点穿过合并区域（startCol < colIndex <= endCol）：仅 endCol += count', () => {
    // 合并 [0, 2..5]，在列 3 插入 2 列 → [0, 2..7]
    const [aPrime] = transform(cellMerge(0, 2, 0, 5), { ...baseB, ...colInsert(3, 2) });
    const m = aPrime as CellMergeOp;
    expect(m.startCol).toBe(2);
    expect(m.endCol).toBe(7);
  });
});

// ============================================================
// 8.7 transformCellMergeVsColDelete（6 个用例）
// ============================================================

describe('8.7 transformCellMergeVsColDelete', () => {
  it('合并区域完全在删除范围内：返回 null', () => {
    // 合并 [0, 3..5]，删除列 2-6 → null
    const [aPrime] = transform(cellMerge(0, 3, 0, 5), { ...baseB, ...colDelete(2, 5) });
    expect(aPrime).toBeNull();
  });

  it('合并区域左侧部分重叠（startCol 在左，endCol 在删除范围内）：返回 null', () => {
    // 合并 [0, 1..4]，删除列 3-6 → null（被截断）
    const [aPrime] = transform(cellMerge(0, 1, 0, 4), { ...baseB, ...colDelete(3, 4) });
    expect(aPrime).toBeNull();
  });

  it('合并区域右侧部分重叠（startCol 在删除范围内，endCol 在右）：返回 null', () => {
    // 合并 [0, 4..8]，删除列 2-5 → null（被截断）
    const [aPrime] = transform(cellMerge(0, 4, 0, 8), { ...baseB, ...colDelete(2, 4) });
    expect(aPrime).toBeNull();
  });

  it('删除范围完全在合并区域内部：endCol -= count（合并区域收缩）', () => {
    // 合并 [0, 1..6]，删除列 2-4（count=3）→ [0, 1..3]
    const [aPrime] = transform(cellMerge(0, 1, 0, 6), { ...baseB, ...colDelete(2, 3) });
    const m = aPrime as CellMergeOp;
    expect(m.startCol).toBe(1);
    expect(m.endCol).toBe(3);
  });

  it('合并区域完全在删除范围右侧：startCol 和 endCol 均 -= count', () => {
    // 合并 [0, 7..9]，删除列 2-4（count=3）→ [0, 4..6]
    const [aPrime] = transform(cellMerge(0, 7, 0, 9), { ...baseB, ...colDelete(2, 3) });
    const m = aPrime as CellMergeOp;
    expect(m.startCol).toBe(4);
    expect(m.endCol).toBe(6);
  });

  it('合并区域完全在删除范围左侧：不变', () => {
    // 合并 [0, 0..2]，删除列 5-7 → 不变
    const [aPrime] = transform(cellMerge(0, 0, 0, 2), { ...baseB, ...colDelete(5, 3) });
    const m = aPrime as CellMergeOp;
    expect(m.startCol).toBe(0);
    expect(m.endCol).toBe(2);
  });
});

// ============================================================
// 8.8 transformCellSplitVsColInsert 和 transformCellSplitVsColDelete
// ============================================================

describe('8.8 transformCellSplitVsColInsert / ColDelete', () => {
  it('split col 在插入点右侧：col += count', () => {
    const [aPrime] = transform(cellSplit(0, 6, 2, 3), { ...baseB, ...colInsert(4, 2) });
    expect((aPrime as CellSplitOp).col).toBe(8);
    // rowSpan/colSpan 不变
    expect((aPrime as CellSplitOp).rowSpan).toBe(2);
    expect((aPrime as CellSplitOp).colSpan).toBe(3);
  });

  it('split col 在插入点左侧：col 不变', () => {
    const [aPrime] = transform(cellSplit(0, 2, 1, 2), { ...baseB, ...colInsert(5, 3) });
    expect((aPrime as CellSplitOp).col).toBe(2);
  });

  it('split col 在删除范围内：返回 null', () => {
    const [aPrime] = transform(cellSplit(0, 4, 1, 1), { ...baseB, ...colDelete(3, 3) });
    expect(aPrime).toBeNull();
  });

  it('split col 在删除范围右侧：col -= count', () => {
    const [aPrime] = transform(cellSplit(0, 8, 2, 2), { ...baseB, ...colDelete(3, 3) });
    expect((aPrime as CellSplitOp).col).toBe(5);
    // rowSpan/colSpan 不变
    expect((aPrime as CellSplitOp).rowSpan).toBe(2);
    expect((aPrime as CellSplitOp).colSpan).toBe(2);
  });
});

// ============================================================
// 8.9 transformColResizeVsColInsert 和 transformColResizeVsColDelete
// ============================================================

describe('8.9 transformColResizeVsColInsert / ColDelete', () => {
  it('resize colIndex 在插入点右侧：colIndex += count', () => {
    const [aPrime] = transform(colResize(7), { ...baseB, ...colInsert(5, 2) });
    expect((aPrime as ColResizeOp).colIndex).toBe(9);
  });

  it('resize colIndex 在插入点左侧：colIndex 不变', () => {
    const [aPrime] = transform(colResize(3), { ...baseB, ...colInsert(5, 2) });
    expect((aPrime as ColResizeOp).colIndex).toBe(3);
  });

  it('resize colIndex 在删除范围内：返回 null', () => {
    const [aPrime] = transform(colResize(4), { ...baseB, ...colDelete(3, 3) });
    expect(aPrime).toBeNull();
  });

  it('resize colIndex 在删除范围右侧：colIndex -= count', () => {
    const [aPrime] = transform(colResize(8), { ...baseB, ...colDelete(3, 3) });
    expect((aPrime as ColResizeOp).colIndex).toBe(5);
  });
});

// ============================================================
// 8.10 transformColInsertVsColInsert 和 transformColInsertVsColDelete
// ============================================================

describe('8.10 transformColInsertVsColInsert / ColDelete', () => {
  it('colInsert vs colInsert：colIndex > opB.colIndex → colIndex += count', () => {
    const [aPrime] = transform(colInsert(7, 1), { ...baseB, ...colInsert(5, 2) });
    expect((aPrime as ColInsertOp).colIndex).toBe(9);
  });

  it('colInsert vs colInsert：colIndex <= opB.colIndex → 不变', () => {
    const [aPrime] = transform(colInsert(3, 1), { ...baseB, ...colInsert(5, 2) });
    expect((aPrime as ColInsertOp).colIndex).toBe(3);
  });

  it('colInsert vs colInsert：colIndex 等于 opB.colIndex → 不变', () => {
    const [aPrime] = transform(colInsert(5, 1), { ...baseB, ...colInsert(5, 2) });
    expect((aPrime as ColInsertOp).colIndex).toBe(5);
  });

  it('colInsert vs colDelete：colIndex > delEnd → colIndex -= count', () => {
    // opA 在列 8 插入，opB 删除列 3-5（count=3，delEnd=6）→ colIndex = 8-3 = 5
    const [aPrime] = transform(colInsert(8, 1), { ...baseB, ...colDelete(3, 3) });
    expect((aPrime as ColInsertOp).colIndex).toBe(5);
  });

  it('colInsert vs colDelete：colIndex <= opB.colIndex → 不变', () => {
    const [aPrime] = transform(colInsert(2, 1), { ...baseB, ...colDelete(3, 3) });
    expect((aPrime as ColInsertOp).colIndex).toBe(2);
  });

  it('colInsert vs colDelete：colIndex 在删除范围内 → colIndex = opB.colIndex', () => {
    // opA 在列 4 插入，opB 删除列 3-5 → colIndex = 3
    const [aPrime] = transform(colInsert(4, 1), { ...baseB, ...colDelete(3, 3) });
    expect((aPrime as ColInsertOp).colIndex).toBe(3);
  });
});

// ============================================================
// 8.11 transformColDeleteVsColInsert 和 transformColDeleteVsColDelete（6 个重叠场景）
// ============================================================

describe('8.11 transformColDeleteVsColInsert / ColDelete', () => {
  it('colDelete vs colInsert：colIndex > opB.colIndex → colIndex += count', () => {
    const [aPrime] = transform(colDelete(7, 2), { ...baseB, ...colInsert(5, 3) });
    expect((aPrime as ColDeleteOp).colIndex).toBe(10);
  });

  it('colDelete vs colInsert：colIndex <= opB.colIndex → 不变', () => {
    const [aPrime] = transform(colDelete(3, 2), { ...baseB, ...colInsert(5, 3) });
    expect((aPrime as ColDeleteOp).colIndex).toBe(3);
  });

  // colDelete vs colDelete 的 6 个场景
  it('场景1：A 完全在 B 之后 → colIndex -= B.count', () => {
    // A 删除列 8-9，B 删除列 3-5（count=3）→ A.colIndex = 8-3 = 5
    const [aPrime] = transform(colDelete(8, 2), { ...baseB, ...colDelete(3, 3) });
    expect((aPrime as ColDeleteOp).colIndex).toBe(5);
    expect((aPrime as ColDeleteOp).count).toBe(2);
  });

  it('场景2：A 完全在 B 之前 → 不变', () => {
    // A 删除列 0-1，B 删除列 5-7 → 不变
    const [aPrime] = transform(colDelete(0, 2), { ...baseB, ...colDelete(5, 3) });
    expect((aPrime as ColDeleteOp).colIndex).toBe(0);
    expect((aPrime as ColDeleteOp).count).toBe(2);
  });

  it('场景3：A 被 B 完全包含 → 返回 null', () => {
    // A 删除列 4-5，B 删除列 3-7（count=5）→ null
    const [aPrime] = transform(colDelete(4, 2), { ...baseB, ...colDelete(3, 5) });
    expect(aPrime).toBeNull();
  });

  it('场景4：A 完全包含 B → count -= B.count', () => {
    // A 删除列 2-8（count=7），B 删除列 4-6（count=3）→ count = 7-3 = 4
    const [aPrime] = transform(colDelete(2, 7), { ...baseB, ...colDelete(4, 3) });
    expect((aPrime as ColDeleteOp).colIndex).toBe(2);
    expect((aPrime as ColDeleteOp).count).toBe(4);
  });

  it('场景5：A 与 B 前部分重叠 → count = B.colIndex - A.colIndex', () => {
    // A 删除列 2-5（count=4），B 删除列 3-6（count=4）→ count = 3-2 = 1
    const [aPrime] = transform(colDelete(2, 4), { ...baseB, ...colDelete(3, 4) });
    expect((aPrime as ColDeleteOp).colIndex).toBe(2);
    expect((aPrime as ColDeleteOp).count).toBe(1);
  });

  it('场景6：A 与 B 后部分重叠 → colIndex = B.colIndex，count = A.end - B.end', () => {
    // A 删除列 4-8（count=5，end=9），B 删除列 2-6（count=5，end=7）
    // newCount = 9 - 7 = 2，colIndex = 2
    const [aPrime] = transform(colDelete(4, 5), { ...baseB, ...colDelete(2, 5) });
    expect((aPrime as ColDeleteOp).colIndex).toBe(2);
    expect((aPrime as ColDeleteOp).count).toBe(2);
  });
});

// ============================================================
// 8.12 行列操作交叉转换
// ============================================================

describe('8.12 行列操作交叉转换（行操作 vs 列操作 返回克隆）', () => {
  it('rowInsert vs colInsert：返回 rowInsert 克隆（不变）', () => {
    const op = rowInsert(3, 2);
    const [aPrime] = transform(op, { ...baseB, ...colInsert(5, 1) });
    expect(aPrime).toEqual(op);
  });

  it('rowDelete vs colInsert：返回 rowDelete 克隆（不变）', () => {
    const op = rowDelete(2, 3);
    const [aPrime] = transform(op, { ...baseB, ...colInsert(4, 2) });
    expect(aPrime).toEqual(op);
  });

  it('rowResize vs colInsert：返回 rowResize 克隆（不变）', () => {
    const op = rowResize(5);
    const [aPrime] = transform(op, { ...baseB, ...colInsert(3, 1) });
    expect(aPrime).toEqual(op);
  });

  it('rowInsert vs colDelete：返回 rowInsert 克隆（不变）', () => {
    const op = rowInsert(1, 1);
    const [aPrime] = transform(op, { ...baseB, ...colDelete(2, 2) });
    expect(aPrime).toEqual(op);
  });

  it('rowDelete vs colDelete：返回 rowDelete 克隆（不变）', () => {
    const op = rowDelete(4, 2);
    const [aPrime] = transform(op, { ...baseB, ...colDelete(1, 3) });
    expect(aPrime).toEqual(op);
  });

  it('rowResize vs colDelete：返回 rowResize 克隆（不变）', () => {
    const op = rowResize(0);
    const [aPrime] = transform(op, { ...baseB, ...colDelete(0, 1) });
    expect(aPrime).toEqual(op);
  });
});

// ============================================================
// 8.13 样式操作 vs colInsert/colDelete
// ============================================================

describe('8.13 样式操作 vs colInsert / colDelete', () => {
  it('fontColor vs colInsert：col 在插入点右侧 → col += count', () => {
    const [aPrime] = transform(fontColor(0, 6), { ...baseB, ...colInsert(4, 2) });
    expect((aPrime as FontColorOp).col).toBe(8);
  });

  it('fontColor vs colInsert：col 在插入点左侧 → col 不变', () => {
    const [aPrime] = transform(fontColor(0, 2), { ...baseB, ...colInsert(4, 2) });
    expect((aPrime as FontColorOp).col).toBe(2);
  });

  it('fontColor vs colDelete：col 在删除范围内 → null', () => {
    const [aPrime] = transform(fontColor(0, 4), { ...baseB, ...colDelete(3, 3) });
    expect(aPrime).toBeNull();
  });

  it('fontColor vs colDelete：col 在删除范围右侧 → col -= count', () => {
    const [aPrime] = transform(fontColor(0, 8), { ...baseB, ...colDelete(3, 3) });
    expect((aPrime as FontColorOp).col).toBe(5);
  });

  it('bgColor vs colInsert：col 在插入点右侧 → col += count', () => {
    const [aPrime] = transform(bgColor(1, 5), { ...baseB, ...colInsert(3, 2) });
    expect((aPrime as BgColorOp).col).toBe(7);
  });

  it('bgColor vs colDelete：col 在删除范围内 → null', () => {
    const [aPrime] = transform(bgColor(1, 3), { ...baseB, ...colDelete(2, 4) });
    expect(aPrime).toBeNull();
  });

  it('bgColor vs colDelete：col 在删除范围右侧 → col -= count', () => {
    const [aPrime] = transform(bgColor(1, 9), { ...baseB, ...colDelete(2, 4) });
    expect((aPrime as BgColorOp).col).toBe(5);
  });
});

// ============================================================
// 8.14 收敛性属性测试
// ============================================================

describe('8.14 OT 收敛性属性测试', () => {
  /**
   * **Validates: Requirements 26**
   *
   * 对于随机生成的 colInsert/colDelete 操作对，验证：
   * 1. transform(opA, opB) 和 transform(opB, opA) 都能正常执行（不抛出异常）
   * 2. 如果转换结果不为 null，则 colIndex 和 count 字段是合理的（非负数）
   */

  /** 生成随机的 colInsert 或 colDelete 操作 */
  const randomColOp = (seed: number, userId: string): ColInsertOp | ColDeleteOp => {
    const colIndex = seed % 10;
    const count = (seed % 5) + 1;
    const isInsert = seed % 2 === 0;
    return isInsert
      ? { userId, timestamp: seed, revision: 1, type: 'colInsert', colIndex, count }
      : { userId, timestamp: seed, revision: 1, type: 'colDelete', colIndex, count };
  };

  it('随机操作对：transform 不抛出异常', () => {
    for (let i = 0; i < 50; i++) {
      const opA = randomColOp(i * 3, 'user-a');
      const opB = randomColOp(i * 7 + 1, 'user-b');
      expect(() => transform(opA, opB)).not.toThrow();
      expect(() => transform(opB, opA)).not.toThrow();
    }
  });

  it('随机操作对：转换结果的 colIndex 和 count 非负', () => {
    for (let i = 0; i < 50; i++) {
      const opA = randomColOp(i * 3, 'user-a');
      const opB = randomColOp(i * 7 + 1, 'user-b');

      const [aPrime, bPrime] = transform(opA, opB);

      if (aPrime !== null && 'colIndex' in aPrime) {
        expect(aPrime.colIndex).toBeGreaterThanOrEqual(0);
      }
      if (aPrime !== null && 'count' in aPrime) {
        expect((aPrime as ColInsertOp | ColDeleteOp).count).toBeGreaterThan(0);
      }
      if (bPrime !== null && 'colIndex' in bPrime) {
        expect(bPrime.colIndex).toBeGreaterThanOrEqual(0);
      }
      if (bPrime !== null && 'count' in bPrime) {
        expect((bPrime as ColInsertOp | ColDeleteOp).count).toBeGreaterThan(0);
      }
    }
  });

  it('colInsert vs colInsert：双向转换结果对称（两者都不为 null）', () => {
    const cases: Array<[number, number, number, number]> = [
      [0, 1, 5, 2],
      [3, 2, 1, 3],
      [5, 1, 5, 1],
      [10, 3, 7, 2],
    ];
    for (const [aIdx, aCount, bIdx, bCount] of cases) {
      const opA: ColInsertOp = { ...baseA, type: 'colInsert', colIndex: aIdx, count: aCount };
      const opB: ColInsertOp = { ...baseB, type: 'colInsert', colIndex: bIdx, count: bCount };
      const [aPrime, bPrime] = transform(opA, opB);
      // colInsert vs colInsert 永远不返回 null
      expect(aPrime).not.toBeNull();
      expect(bPrime).not.toBeNull();
      expect((aPrime as ColInsertOp).count).toBe(aCount);
      expect((bPrime as ColInsertOp).count).toBe(bCount);
    }
  });

  it('colDelete vs colDelete：双向转换结果合理', () => {
    // 完全不重叠的情况，双向转换都应有效
    const opA: ColDeleteOp = { ...baseA, type: 'colDelete', colIndex: 0, count: 2 };
    const opB: ColDeleteOp = { ...baseB, type: 'colDelete', colIndex: 5, count: 2 };
    const [aPrime, bPrime] = transform(opA, opB);
    // A 在 B 之前，A 不变
    expect(aPrime).not.toBeNull();
    expect((aPrime as ColDeleteOp).colIndex).toBe(0);
    // B 在 A 之后，B.colIndex -= A.count
    expect(bPrime).not.toBeNull();
    expect((bPrime as ColDeleteOp).colIndex).toBe(3);
  });
});
