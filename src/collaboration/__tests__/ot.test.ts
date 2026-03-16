import { describe, it, expect } from 'vitest';
import { transform, transformAgainst } from '../ot';
import {
  CellEditOp,
  RowInsertOp,
  RowDeleteOp,
  CellMergeOp,
  CollabOperation,
} from '../types';

const base = {
  userId: 'user-a',
  timestamp: 1000,
  revision: 1,
};

const baseB = {
  userId: 'user-b',
  timestamp: 1001,
  revision: 1,
};

describe('transform - CellEdit vs CellEdit', () => {
  it('不同单元格的编辑互不影响', () => {
    const opA: CellEditOp = { ...base, type: 'cellEdit', row: 0, col: 0, content: 'A', previousContent: '' };
    const opB: CellEditOp = { ...baseB, type: 'cellEdit', row: 1, col: 1, content: 'B', previousContent: '' };
    const [aPrime, bPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect(bPrime).not.toBeNull();
    expect((aPrime as CellEditOp).row).toBe(0);
    expect((bPrime as CellEditOp).row).toBe(1);
  });

  it('同一单元格的编辑冲突时更新 previousContent', () => {
    const opA: CellEditOp = { ...base, type: 'cellEdit', row: 0, col: 0, content: 'A', previousContent: '' };
    const opB: CellEditOp = { ...baseB, type: 'cellEdit', row: 0, col: 0, content: 'B', previousContent: '' };
    const [aPrime] = transform(opA, opB);
    expect((aPrime as CellEditOp).previousContent).toBe('B');
  });
});

describe('transform - CellEdit vs RowInsert', () => {
  it('编辑行在插入行之后时，行索引增加', () => {
    const edit: CellEditOp = { ...base, type: 'cellEdit', row: 5, col: 0, content: 'X', previousContent: '' };
    const insert: RowInsertOp = { ...baseB, type: 'rowInsert', rowIndex: 3, count: 2 };
    const [editPrime] = transform(edit, insert);
    expect((editPrime as CellEditOp).row).toBe(7);
  });

  it('编辑行在插入行之前时，行索引不变', () => {
    const edit: CellEditOp = { ...base, type: 'cellEdit', row: 1, col: 0, content: 'X', previousContent: '' };
    const insert: RowInsertOp = { ...baseB, type: 'rowInsert', rowIndex: 3, count: 2 };
    const [editPrime] = transform(edit, insert);
    expect((editPrime as CellEditOp).row).toBe(1);
  });
});

describe('transform - CellEdit vs RowDelete', () => {
  it('编辑行在删除范围内时，操作变为 null', () => {
    const edit: CellEditOp = { ...base, type: 'cellEdit', row: 3, col: 0, content: 'X', previousContent: '' };
    const del: RowDeleteOp = { ...baseB, type: 'rowDelete', rowIndex: 2, count: 3 };
    const [editPrime] = transform(edit, del);
    expect(editPrime).toBeNull();
  });

  it('编辑行在删除范围之后时，行索引减少', () => {
    const edit: CellEditOp = { ...base, type: 'cellEdit', row: 8, col: 0, content: 'X', previousContent: '' };
    const del: RowDeleteOp = { ...baseB, type: 'rowDelete', rowIndex: 2, count: 3 };
    const [editPrime] = transform(edit, del);
    expect((editPrime as CellEditOp).row).toBe(5);
  });
});

describe('transform - RowInsert vs RowInsert', () => {
  it('不同位置的插入互相调整', () => {
    const insertA: RowInsertOp = { ...base, type: 'rowInsert', rowIndex: 5, count: 2 };
    const insertB: RowInsertOp = { ...baseB, type: 'rowInsert', rowIndex: 3, count: 1 };
    const [aPrime] = transform(insertA, insertB);
    expect((aPrime as RowInsertOp).rowIndex).toBe(6);
  });
});

describe('transform - RowDelete vs RowDelete', () => {
  it('不重叠的删除互相调整索引', () => {
    const delA: RowDeleteOp = { ...base, type: 'rowDelete', rowIndex: 10, count: 2 };
    const delB: RowDeleteOp = { ...baseB, type: 'rowDelete', rowIndex: 3, count: 2 };
    const [aPrime] = transform(delA, delB);
    expect((aPrime as RowDeleteOp).rowIndex).toBe(8);
  });

  it('完全重叠的删除变为 null', () => {
    const delA: RowDeleteOp = { ...base, type: 'rowDelete', rowIndex: 3, count: 2 };
    const delB: RowDeleteOp = { ...baseB, type: 'rowDelete', rowIndex: 3, count: 2 };
    const [aPrime] = transform(delA, delB);
    expect(aPrime).toBeNull();
  });
});

describe('transform - CellEdit vs CellMerge', () => {
  it('编辑位置在合并范围内时，调整到父单元格', () => {
    const edit: CellEditOp = { ...base, type: 'cellEdit', row: 1, col: 1, content: 'X', previousContent: '' };
    const merge: CellMergeOp = { ...baseB, type: 'cellMerge', startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
    const [editPrime] = transform(edit, merge);
    expect((editPrime as CellEditOp).row).toBe(0);
    expect((editPrime as CellEditOp).col).toBe(0);
  });
});

describe('transformAgainst', () => {
  it('依次对操作列表进行转换', () => {
    const edit: CellEditOp = { ...base, type: 'cellEdit', row: 5, col: 0, content: 'X', previousContent: '' };
    const ops: CollabOperation[] = [
      { ...baseB, type: 'rowInsert', rowIndex: 2, count: 1 } as RowInsertOp,
      { ...baseB, type: 'rowInsert', rowIndex: 0, count: 1 } as RowInsertOp,
    ];
    const result = transformAgainst(edit, ops);
    // 第一次转换：row 5 -> 6（插入在 2）
    // 第二次转换：row 6 -> 7（插入在 0）
    expect((result as CellEditOp).row).toBe(7);
  });

  it('操作被消除时返回 null', () => {
    const edit: CellEditOp = { ...base, type: 'cellEdit', row: 3, col: 0, content: 'X', previousContent: '' };
    const ops: CollabOperation[] = [
      { ...baseB, type: 'rowDelete', rowIndex: 2, count: 3 } as RowDeleteOp,
    ];
    const result = transformAgainst(edit, ops);
    expect(result).toBeNull();
  });
});

import { invertOperation, ModelReader } from '../ot';
import {
  CellSplitOp,
  RowResizeOp,
  FontColorOp,
  BgColorOp,
  ColResizeOp,
  FontBoldOp,
  FontAlignOp,
  FontSizeOp,
  FontItalicOp,
  FontUnderlineOp,
  VerticalAlignOp,
} from '../types';

// 模拟 ModelReader
const createMockModel = (): ModelReader => ({
  getCell: (row: number, col: number) => ({
    content: `cell-${row}-${col}`,
    rowSpan: 1,
    colSpan: 1,
    fontColor: '#FF0000',
    bgColor: '#00FF00',
    fontSize: 14,
  }),
  getRowHeight: () => 25,
  getColWidth: () => 100,
});

describe('invertOperation', () => {
  const model = createMockModel();

  it('CellEdit 的反向操作交换 content 和 previousContent', () => {
    const op: CellEditOp = { ...base, type: 'cellEdit', row: 0, col: 0, content: '新', previousContent: '旧' };
    const inv = invertOperation(op, model);
    expect(inv.type).toBe('cellEdit');
    expect((inv as CellEditOp).content).toBe('旧');
    expect((inv as CellEditOp).previousContent).toBe('新');
  });

  it('CellMerge 的反向操作是 CellSplit', () => {
    const op: CellMergeOp = { ...base, type: 'cellMerge', startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
    const inv = invertOperation(op, model);
    expect(inv.type).toBe('cellSplit');
    expect((inv as CellSplitOp).row).toBe(0);
    expect((inv as CellSplitOp).col).toBe(0);
  });

  it('RowInsert 的反向操作是 RowDelete', () => {
    const op: RowInsertOp = { ...base, type: 'rowInsert', rowIndex: 5, count: 3 };
    const inv = invertOperation(op, model);
    expect(inv.type).toBe('rowDelete');
    expect((inv as RowDeleteOp).rowIndex).toBe(5);
    expect((inv as RowDeleteOp).count).toBe(3);
  });

  it('RowDelete 的反向操作是 RowInsert', () => {
    const op: RowDeleteOp = { ...base, type: 'rowDelete', rowIndex: 5, count: 3 };
    const inv = invertOperation(op, model);
    expect(inv.type).toBe('rowInsert');
    expect((inv as RowInsertOp).rowIndex).toBe(5);
    expect((inv as RowInsertOp).count).toBe(3);
  });

  it('RowResize 的反向操作恢复原始行高', () => {
    const op: RowResizeOp = { ...base, type: 'rowResize', rowIndex: 3, height: 50 };
    const inv = invertOperation(op, model);
    expect(inv.type).toBe('rowResize');
    expect((inv as RowResizeOp).height).toBe(25);
  });

  it('ColResize 的反向操作恢复原始列宽', () => {
    const op: ColResizeOp = { ...base, type: 'colResize', colIndex: 2, width: 200 };
    const inv = invertOperation(op, model);
    expect(inv.type).toBe('colResize');
    expect((inv as ColResizeOp).width).toBe(100);
  });

  it('FontColor 的反向操作恢复原始字体颜色', () => {
    const op: FontColorOp = { ...base, type: 'fontColor', row: 0, col: 0, color: '#0000FF' };
    const inv = invertOperation(op, model);
    expect(inv.type).toBe('fontColor');
    expect((inv as FontColorOp).color).toBe('#FF0000');
  });

  it('BgColor 的反向操作恢复原始背景颜色', () => {
    const op: BgColorOp = { ...base, type: 'bgColor', row: 0, col: 0, color: '#0000FF' };
    const inv = invertOperation(op, model);
    expect(inv.type).toBe('bgColor');
    expect((inv as BgColorOp).color).toBe('#00FF00');
  });
});

describe('transform - CellEdit vs CellSplit', () => {
  it('编辑在拆分区域内 → 重定向到左上角', () => {
    const opA: CellEditOp = { ...base, type: 'cellEdit', row: 1, col: 1, content: 'hello', previousContent: '' };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 0, col: 0, rowSpan: 3, colSpan: 3 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect((aPrime as CellEditOp).row).toBe(0);
    expect((aPrime as CellEditOp).col).toBe(0);
    expect((aPrime as CellEditOp).content).toBe('hello');
  });

  it('编辑在拆分区域外 → 不受影响', () => {
    const opA: CellEditOp = { ...base, type: 'cellEdit', row: 5, col: 5, content: 'hello', previousContent: '' };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 0, col: 0, rowSpan: 3, colSpan: 3 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect((aPrime as CellEditOp).row).toBe(5);
    expect((aPrime as CellEditOp).col).toBe(5);
  });

  it('编辑恰好在拆分区域边界上 → 重定向', () => {
    const opA: CellEditOp = { ...base, type: 'cellEdit', row: 2, col: 2, content: 'edge', previousContent: '' };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 0, col: 0, rowSpan: 3, colSpan: 3 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect((aPrime as CellEditOp).row).toBe(0);
    expect((aPrime as CellEditOp).col).toBe(0);
  });

  it('拆分 rowSpan/colSpan 为 1 → 仅主单元格匹配', () => {
    const opA: CellEditOp = { ...base, type: 'cellEdit', row: 0, col: 0, content: 'x', previousContent: '' };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect((aPrime as CellEditOp).row).toBe(0);
    expect((aPrime as CellEditOp).col).toBe(0);
  });
});

describe('transform - CellMerge vs CellSplit', () => {
  it('合并区域与拆分区域重叠 → 合并失效', () => {
    const opA: CellMergeOp = { ...base, type: 'cellMerge', startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 1, col: 1, rowSpan: 2, colSpan: 2 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).toBeNull();
  });

  it('合并区域与拆分区域不重叠 → 合并正常', () => {
    const opA: CellMergeOp = { ...base, type: 'cellMerge', startRow: 5, startCol: 5, endRow: 7, endCol: 7 };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 0, col: 0, rowSpan: 3, colSpan: 3 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect((aPrime as CellMergeOp).startRow).toBe(5);
    expect((aPrime as CellMergeOp).startCol).toBe(5);
  });

  it('合并区域完全包含拆分区域 → 合并失效', () => {
    const opA: CellMergeOp = { ...base, type: 'cellMerge', startRow: 0, startCol: 0, endRow: 5, endCol: 5 };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 1, col: 1, rowSpan: 2, colSpan: 2 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).toBeNull();
  });

  it('拆分区域完全包含合并区域 → 合并失效', () => {
    const opA: CellMergeOp = { ...base, type: 'cellMerge', startRow: 1, startCol: 1, endRow: 2, endCol: 2 };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 0, col: 0, rowSpan: 5, colSpan: 5 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).toBeNull();
  });
});

describe('transform - CellSplit vs CellSplit', () => {
  it('同一位置 → 后者失效', () => {
    const opA: CellSplitOp = { ...base, type: 'cellSplit', row: 0, col: 0, rowSpan: 3, colSpan: 3 };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 0, col: 0, rowSpan: 3, colSpan: 3 };
    const [aPrime, bPrime] = transform(opA, opB);
    expect(aPrime).toBeNull();
    expect(bPrime).toBeNull();
  });

  it('不同位置 → 互不影响', () => {
    const opA: CellSplitOp = { ...base, type: 'cellSplit', row: 0, col: 0, rowSpan: 2, colSpan: 2 };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 5, col: 5, rowSpan: 3, colSpan: 3 };
    const [aPrime, bPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect(bPrime).not.toBeNull();
    expect((aPrime as CellSplitOp).row).toBe(0);
    expect((bPrime as CellSplitOp).row).toBe(5);
  });
});

describe('transform - CellSplit vs CellEdit', () => {
  it('拆分不受编辑影响', () => {
    const opA: CellSplitOp = { ...base, type: 'cellSplit', row: 0, col: 0, rowSpan: 3, colSpan: 3 };
    const opB: CellEditOp = { ...baseB, type: 'cellEdit', row: 1, col: 1, content: 'hello', previousContent: '' };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect((aPrime as CellSplitOp).row).toBe(0);
    expect((aPrime as CellSplitOp).col).toBe(0);
    expect((aPrime as CellSplitOp).rowSpan).toBe(3);
  });
});

describe('transform - CellSplit vs CellMerge', () => {
  it('拆分位置在合并区域内 → 拆分失效', () => {
    const opA: CellSplitOp = { ...base, type: 'cellSplit', row: 1, col: 1, rowSpan: 2, colSpan: 2 };
    const opB: CellMergeOp = { ...baseB, type: 'cellMerge', startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).toBeNull();
  });

  it('拆分位置在合并区域外 → 拆分正常', () => {
    const opA: CellSplitOp = { ...base, type: 'cellSplit', row: 5, col: 5, rowSpan: 2, colSpan: 2 };
    const opB: CellMergeOp = { ...baseB, type: 'cellMerge', startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect((aPrime as CellSplitOp).row).toBe(5);
  });
});

describe('transform - StyleOp vs CellSplit', () => {
  it('FontBold 在拆分区域内 → 重定向到左上角', () => {
    const opA: FontBoldOp = { ...base, type: 'fontBold', row: 1, col: 1, bold: true };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 0, col: 0, rowSpan: 3, colSpan: 3 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect((aPrime as FontBoldOp).row).toBe(0);
    expect((aPrime as FontBoldOp).col).toBe(0);
    expect((aPrime as FontBoldOp).bold).toBe(true);
  });

  it('FontColor 在拆分区域外 → 不受影响', () => {
    const opA: FontColorOp = { ...base, type: 'fontColor', row: 5, col: 5, color: '#FF0000' };
    const opB: CellSplitOp = { ...baseB, type: 'cellSplit', row: 0, col: 0, rowSpan: 3, colSpan: 3 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect((aPrime as FontColorOp).row).toBe(5);
    expect((aPrime as FontColorOp).col).toBe(5);
  });
});

describe('transform - FontAlign vs CellMerge', () => {
  it('FontAlign 在合并区域内 → 重定向到左上角', () => {
    const opA: FontAlignOp = { ...base, type: 'fontAlign', row: 1, col: 1, align: 'center' };
    const opB: CellMergeOp = { ...baseB, type: 'cellMerge', startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect((aPrime as FontAlignOp).row).toBe(0);
    expect((aPrime as FontAlignOp).col).toBe(0);
    expect((aPrime as FontAlignOp).align).toBe('center');
  });

  it('FontAlign 在合并区域外 → 不受影响', () => {
    const opA: FontAlignOp = { ...base, type: 'fontAlign', row: 5, col: 5, align: 'right' };
    const opB: CellMergeOp = { ...baseB, type: 'cellMerge', startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
    const [aPrime] = transform(opA, opB);
    expect(aPrime).not.toBeNull();
    expect((aPrime as FontAlignOp).row).toBe(5);
    expect((aPrime as FontAlignOp).col).toBe(5);
  });
});

describe('invertOperation - CellMerge 反向操作携带范围', () => {
  const model = createMockModel();

  it('CellMerge 的反向操作是带 rowSpan/colSpan 的 CellSplit', () => {
    const op: CellMergeOp = { ...base, type: 'cellMerge', startRow: 0, startCol: 0, endRow: 2, endCol: 3 };
    const inv = invertOperation(op, model);
    expect(inv.type).toBe('cellSplit');
    expect((inv as CellSplitOp).row).toBe(0);
    expect((inv as CellSplitOp).col).toBe(0);
    expect((inv as CellSplitOp).rowSpan).toBe(3);
    expect((inv as CellSplitOp).colSpan).toBe(4);
  });
});
