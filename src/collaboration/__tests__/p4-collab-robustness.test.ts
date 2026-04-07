import { describe, it, expect } from 'vitest';
import {
  transform,
  invertOperation,
  adjustFormulaForRowInsert,
  adjustFormulaForRowDelete,
  adjustFormulaForColInsert,
  adjustFormulaForColDelete,
} from '../ot';
import type { ModelReader } from '../ot';
import {
  CellEditOp,
  CellMergeOp,
  RowInsertOp,
  RowDeleteOp,
  ColInsertOp,
  ColDeleteOp,
  SetBorderOp,
  SetFontFamilyOp,
  SetStrikethroughOp,
} from '../types';
import { OfflineBuffer } from '../offline-buffer';

// ============================================================
// 基础操作模板
// ============================================================

const baseA = { userId: 'user-a', timestamp: 1000, revision: 1 };
const baseB = { userId: 'user-b', timestamp: 1001, revision: 1 };

// ============================================================
// 1. OT 边界测试：公式引用调整
// ============================================================

describe('公式引用调整 - 行插入', () => {
  it('行插入时公式中行号 >= 插入位置的引用向下偏移', () => {
    const result = adjustFormulaForRowInsert('=A1+B5', 2, 3);
    // A1 (row 0) < 插入位置 2，不变
    // B5 (row 4) >= 插入位置 2，偏移 +3 → B8
    expect(result).toBe('=A1+B8');
  });

  it('行插入时所有引用都在插入位置之前，不变', () => {
    const result = adjustFormulaForRowInsert('=A1+B2', 5, 2);
    expect(result).toBe('=A1+B2');
  });

  it('行插入时范围引用正确调整', () => {
    const result = adjustFormulaForRowInsert('=SUM(A1:A10)', 3, 2);
    // A1 (row 0) < 3，不变
    // A10 (row 9) >= 3，偏移 +2 → A12
    expect(result).toBe('=SUM(A1:A12)');
  });
});

describe('公式引用调整 - 行删除', () => {
  it('行删除时引用在删除范围内替换为 #REF!', () => {
    const result = adjustFormulaForRowDelete('=A3+B5', 2, 2);
    // A3 (row 2) 在删除范围 [2,4) 内 → #REF!
    // B5 (row 4) >= 删除范围结束 4，偏移 -2 → B3
    expect(result).toBe('=#REF!+B3');
  });

  it('行删除时引用在删除范围之前，不变', () => {
    const result = adjustFormulaForRowDelete('=A1', 5, 2);
    expect(result).toBe('=A1');
  });
});

describe('公式引用调整 - 列插入', () => {
  it('列插入时公式中列索引 >= 插入位置的引用向右偏移', () => {
    const result = adjustFormulaForColInsert('=A1+C5', 1, 2);
    // A (col 0) < 插入位置 1，不变
    // C (col 2) >= 插入位置 1，偏移 +2 → E
    expect(result).toBe('=A1+E5');
  });

  it('列插入时所有引用都在插入位置之前，不变', () => {
    const result = adjustFormulaForColInsert('=A1+B2', 5, 2);
    expect(result).toBe('=A1+B2');
  });
});

describe('公式引用调整 - 列删除', () => {
  it('列删除时引用在删除范围内替换为 #REF!', () => {
    const result = adjustFormulaForColDelete('=B1+D5', 1, 2);
    // B (col 1) 在删除范围 [1,3) 内 → #REF!
    // D (col 3) >= 删除范围结束 3，偏移 -2 → B
    expect(result).toBe('=#REF!+B5');
  });
});

// ============================================================
// 2. OT 边界测试：CellEdit（含公式）vs 行列插删
// ============================================================

describe('CellEdit（公式）vs RowInsert', () => {
  it('公式单元格与行插入并发时，公式引用正确调整', () => {
    const edit: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: '=A5+B10', previousContent: '',
    };
    const insert: RowInsertOp = {
      ...baseB, type: 'rowInsert', rowIndex: 3, count: 2,
    };
    const [editPrime] = transform(edit, insert);
    expect(editPrime).not.toBeNull();
    // 公式中 A5 (row 4) >= 3 → A7, B10 (row 9) >= 3 → B12
    expect((editPrime as CellEditOp).content).toBe('=A7+B12');
  });
});

describe('CellEdit（公式）vs RowDelete', () => {
  it('公式单元格与行删除并发时，被删除的引用替换为 #REF!', () => {
    const edit: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: '=A3+B10', previousContent: '',
    };
    const del: RowDeleteOp = {
      ...baseB, type: 'rowDelete', rowIndex: 2, count: 1,
    };
    const [editPrime] = transform(edit, del);
    expect(editPrime).not.toBeNull();
    // A3 (row 2) 在删除范围 [2,3) 内 → #REF!
    // B10 (row 9) >= 3 → B9
    expect((editPrime as CellEditOp).content).toBe('=#REF!+B9');
  });
});

describe('CellEdit（公式）vs ColInsert', () => {
  it('公式单元格与列插入并发时，公式引用正确调整', () => {
    const edit: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: '=C1+E5', previousContent: '',
    };
    const insert: ColInsertOp = {
      ...baseB, type: 'colInsert', colIndex: 2, count: 1,
    };
    const [editPrime] = transform(edit, insert);
    expect(editPrime).not.toBeNull();
    // C (col 2) >= 2 → D, E (col 4) >= 2 → F
    expect((editPrime as CellEditOp).content).toBe('=D1+F5');
  });
});

describe('CellEdit（公式）vs ColDelete', () => {
  it('公式单元格与列删除并发时，被删除的引用替换为 #REF!', () => {
    const edit: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: '=B1+D5', previousContent: '',
    };
    const del: ColDeleteOp = {
      ...baseB, type: 'colDelete', colIndex: 1, count: 1,
    };
    const [editPrime] = transform(edit, del);
    expect(editPrime).not.toBeNull();
    // B (col 1) 在删除范围 [1,2) 内 → #REF!
    // D (col 3) >= 2 → C
    expect((editPrime as CellEditOp).content).toBe('=#REF!+C5');
  });
});


// ============================================================
// 3. OT 边界测试：CellMerge vs RowDelete 边界场景
// ============================================================

describe('CellMerge vs RowDelete 边界场景', () => {
  it('合并区域完全在删除范围内 → 操作取消', () => {
    const merge: CellMergeOp = {
      ...baseA, type: 'cellMerge',
      startRow: 2, startCol: 0, endRow: 4, endCol: 2,
    };
    const del: RowDeleteOp = {
      ...baseB, type: 'rowDelete', rowIndex: 1, count: 5,
    };
    const [mergePrime] = transform(merge, del);
    expect(mergePrime).toBeNull();
  });

  it('删除范围完全在合并区域内部 → 合并区域收缩', () => {
    const merge: CellMergeOp = {
      ...baseA, type: 'cellMerge',
      startRow: 0, startCol: 0, endRow: 5, endCol: 2,
    };
    const del: RowDeleteOp = {
      ...baseB, type: 'rowDelete', rowIndex: 2, count: 2,
    };
    const [mergePrime] = transform(merge, del);
    expect(mergePrime).not.toBeNull();
    expect((mergePrime as CellMergeOp).startRow).toBe(0);
    expect((mergePrime as CellMergeOp).endRow).toBe(3); // 5 - 2 = 3
  });

  it('合并区域完全在删除范围右侧 → 偏移', () => {
    const merge: CellMergeOp = {
      ...baseA, type: 'cellMerge',
      startRow: 5, startCol: 0, endRow: 7, endCol: 2,
    };
    const del: RowDeleteOp = {
      ...baseB, type: 'rowDelete', rowIndex: 1, count: 2,
    };
    const [mergePrime] = transform(merge, del);
    expect(mergePrime).not.toBeNull();
    expect((mergePrime as CellMergeOp).startRow).toBe(3); // 5 - 2
    expect((mergePrime as CellMergeOp).endRow).toBe(5); // 7 - 2
  });

  it('合并区域左侧部分重叠删除范围 → 操作取消', () => {
    const merge: CellMergeOp = {
      ...baseA, type: 'cellMerge',
      startRow: 3, startCol: 0, endRow: 6, endCol: 2,
    };
    const del: RowDeleteOp = {
      ...baseB, type: 'rowDelete', rowIndex: 2, count: 3,
    };
    // startRow=3 在 [2,5) 内，endRow=6 >= 5 → 左侧部分重叠
    const [mergePrime] = transform(merge, del);
    expect(mergePrime).toBeNull();
  });

  it('合并区域右侧部分重叠删除范围 → 操作取消', () => {
    const merge: CellMergeOp = {
      ...baseA, type: 'cellMerge',
      startRow: 0, startCol: 0, endRow: 3, endCol: 2,
    };
    const del: RowDeleteOp = {
      ...baseB, type: 'rowDelete', rowIndex: 2, count: 3,
    };
    // startRow=0 < 2, endRow=3 在 [2,5) 内 → 右侧部分重叠
    const [mergePrime] = transform(merge, del);
    expect(mergePrime).toBeNull();
  });

  it('合并区域完全在删除范围左侧 → 不变', () => {
    const merge: CellMergeOp = {
      ...baseA, type: 'cellMerge',
      startRow: 0, startCol: 0, endRow: 1, endCol: 2,
    };
    const del: RowDeleteOp = {
      ...baseB, type: 'rowDelete', rowIndex: 5, count: 2,
    };
    const [mergePrime] = transform(merge, del);
    expect(mergePrime).not.toBeNull();
    expect((mergePrime as CellMergeOp).startRow).toBe(0);
    expect((mergePrime as CellMergeOp).endRow).toBe(1);
  });
});

// ============================================================
// 4. OT 收敛性不变量验证
// ============================================================

describe('OT 收敛性不变量', () => {
  it('CellEdit vs RowInsert 满足对称转换', () => {
    const edit: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 5, col: 0,
      content: 'hello', previousContent: '',
    };
    const insert: RowInsertOp = {
      ...baseB, type: 'rowInsert', rowIndex: 3, count: 2,
    };
    const [aPrime, bPrime] = transform(edit, insert);
    // 两个转换后的操作都不应为 null
    expect(aPrime).not.toBeNull();
    expect(bPrime).not.toBeNull();
  });

  it('CellEdit vs CellEdit 同一单元格满足对称转换', () => {
    const editA: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: 'A', previousContent: '',
    };
    const editB: CellEditOp = {
      ...baseB, type: 'cellEdit', row: 0, col: 0,
      content: 'B', previousContent: '',
    };
    const [aPrime, bPrime] = transform(editA, editB);
    // 两个转换后的操作都不应为 null（后写入者胜出）
    expect(aPrime).not.toBeNull();
    expect(bPrime).not.toBeNull();
    // A' 的 previousContent 应该是 B 的 content
    expect((aPrime as CellEditOp).previousContent).toBe('B');
    // B' 的 previousContent 应该是 A 的 content
    expect((bPrime as CellEditOp).previousContent).toBe('A');
  });

  it('RowInsert vs RowDelete 满足对称转换', () => {
    const insert: RowInsertOp = {
      ...baseA, type: 'rowInsert', rowIndex: 3, count: 2,
    };
    const del: RowDeleteOp = {
      ...baseB, type: 'rowDelete', rowIndex: 5, count: 1,
    };
    const [aPrime, bPrime] = transform(insert, del);
    expect(aPrime).not.toBeNull();
    expect(bPrime).not.toBeNull();
  });
});

// ============================================================
// 5. 操作历史冲突：invertOperation 完整性
// ============================================================

describe('invertOperation 完整性', () => {
  const mockModel: ModelReader = {
    getCell: (row: number, col: number) => ({
      content: `cell-${row}-${col}`,
      rowSpan: 1,
      colSpan: 1,
      fontColor: '#ff0000',
      bgColor: '#00ff00',
      fontSize: 14,
      fontBold: true,
      fontItalic: false,
      fontUnderline: true,
      fontAlign: 'center',
      verticalAlign: 'middle',
      border: { top: { style: 'solid' as const, color: '#000', width: 1 } },
      fontFamily: 'Arial',
      fontStrikethrough: true,
    }),
    getRowHeight: () => 25,
    getColWidth: () => 100,
  };

  it('cellEdit 的反向操作交换 content 和 previousContent', () => {
    const op: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: 'new', previousContent: 'old',
    };
    const inverse = invertOperation(op, mockModel) as CellEditOp;
    expect(inverse.type).toBe('cellEdit');
    expect(inverse.content).toBe('old');
    expect(inverse.previousContent).toBe('new');
  });

  it('setBorder 的反向操作恢复原始边框', () => {
    const op: SetBorderOp = {
      ...baseA, type: 'setBorder', row: 0, col: 0,
      border: { bottom: { style: 'dashed', color: '#fff', width: 2 } },
    };
    const inverse = invertOperation(op, mockModel) as SetBorderOp;
    expect(inverse.type).toBe('setBorder');
    expect(inverse.border).toEqual({ top: { style: 'solid', color: '#000', width: 1 } });
  });

  it('setFontFamily 的反向操作恢复原始字体族', () => {
    const op: SetFontFamilyOp = {
      ...baseA, type: 'setFontFamily', row: 0, col: 0,
      fontFamily: 'Courier',
    };
    const inverse = invertOperation(op, mockModel) as SetFontFamilyOp;
    expect(inverse.type).toBe('setFontFamily');
    expect(inverse.fontFamily).toBe('Arial');
  });

  it('setStrikethrough 的反向操作恢复原始删除线状态', () => {
    const op: SetStrikethroughOp = {
      ...baseA, type: 'setStrikethrough', row: 0, col: 0,
      strikethrough: false,
    };
    const inverse = invertOperation(op, mockModel) as SetStrikethroughOp;
    expect(inverse.type).toBe('setStrikethrough');
    expect(inverse.strikethrough).toBe(true);
  });

  it('rowInsert 的反向操作是 rowDelete', () => {
    const op: RowInsertOp = {
      ...baseA, type: 'rowInsert', rowIndex: 3, count: 2,
    };
    const inverse = invertOperation(op, mockModel);
    expect(inverse.type).toBe('rowDelete');
  });

  it('colInsert 的反向操作是 colDelete', () => {
    const op: ColInsertOp = {
      ...baseA, type: 'colInsert', colIndex: 3, count: 2,
    };
    const inverse = invertOperation(op, mockModel);
    expect(inverse.type).toBe('colDelete');
  });
});

// ============================================================
// 6. 离线缓冲区测试
// ============================================================

describe('OfflineBuffer', () => {
  it('缓存操作并返回正确数量', () => {
    const buffer = new OfflineBuffer();
    const op1: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: 'A', previousContent: '',
    };
    const op2: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 1, col: 0,
      content: 'B', previousContent: '',
    };
    buffer.buffer(op1);
    buffer.buffer(op2);
    expect(buffer.size()).toBe(2);
    expect(buffer.hasOperations()).toBe(true);
  });

  it('flush 返回所有操作并清空缓冲区', () => {
    const buffer = new OfflineBuffer();
    const op: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: 'A', previousContent: '',
    };
    buffer.buffer(op);
    const ops = buffer.flush();
    expect(ops.length).toBe(1);
    expect(buffer.size()).toBe(0);
    expect(buffer.hasOperations()).toBe(false);
  });

  it('clear 清空缓冲区', () => {
    const buffer = new OfflineBuffer();
    const op: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: 'A', previousContent: '',
    };
    buffer.buffer(op);
    buffer.clear();
    expect(buffer.size()).toBe(0);
  });

  it('rebase 将离线操作针对服务器操作进行 OT 转换', () => {
    const buffer = new OfflineBuffer();
    // 离线期间在 row=5 编辑
    const localOp: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 5, col: 0,
      content: 'offline', previousContent: '',
    };
    buffer.buffer(localOp);

    // 服务器在 row=3 插入了 2 行
    const serverOps: RowInsertOp[] = [{
      ...baseB, type: 'rowInsert', rowIndex: 3, count: 2,
    }];

    const rebased = buffer.rebase(serverOps);
    expect(rebased.length).toBe(1);
    // 离线操作的 row 应该从 5 偏移到 7
    expect((rebased[0] as CellEditOp).row).toBe(7);
  });

  it('rebase 过滤掉被消除的操作', () => {
    const buffer = new OfflineBuffer();
    // 离线期间在 row=3 编辑
    const localOp: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 3, col: 0,
      content: 'offline', previousContent: '',
    };
    buffer.buffer(localOp);

    // 服务器删除了 row=2 开始的 3 行（包含 row=3）
    const serverOps: RowDeleteOp[] = [{
      ...baseB, type: 'rowDelete', rowIndex: 2, count: 3,
    }];

    const rebased = buffer.rebase(serverOps);
    // 操作应该被消除（编辑的行被删除了）
    expect(rebased.length).toBe(0);
  });

  it('getOperations 返回只读视图', () => {
    const buffer = new OfflineBuffer();
    const op: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: 'A', previousContent: '',
    };
    buffer.buffer(op);
    const ops = buffer.getOperations();
    expect(ops.length).toBe(1);
    expect(ops[0]).toBe(op);
  });
});

// ============================================================
// 7. 多人同时撤销/重做一致性
// ============================================================

describe('多人撤销/重做 OT 一致性', () => {
  it('用户A撤销的反向操作与用户B的操作正确转换', () => {
    // 用户A 在 row=0 编辑了 "hello"
    const opA: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: 'hello', previousContent: '',
    };
    // 用户A 的撤销操作（反向）
    const undoA: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: '', previousContent: 'hello',
    };
    // 用户B 在 row=0 之前插入了 2 行
    const opB: RowInsertOp = {
      ...baseB, type: 'rowInsert', rowIndex: 0, count: 2,
    };

    // 用户A 的撤销操作需要针对用户B 的插入进行转换
    const [undoAPrime] = transform(undoA, opB);
    expect(undoAPrime).not.toBeNull();
    // 撤销操作的 row 应该从 0 偏移到 2
    expect((undoAPrime as CellEditOp).row).toBe(2);
  });

  it('两个用户同时撤销不同单元格的操作互不影响', () => {
    const undoA: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: '', previousContent: 'A',
    };
    const undoB: CellEditOp = {
      ...baseB, type: 'cellEdit', row: 1, col: 1,
      content: '', previousContent: 'B',
    };
    const [aPrime, bPrime] = transform(undoA, undoB);
    expect(aPrime).not.toBeNull();
    expect(bPrime).not.toBeNull();
    expect((aPrime as CellEditOp).row).toBe(0);
    expect((bPrime as CellEditOp).row).toBe(1);
  });

  it('两个用户同时撤销同一单元格的操作正确处理冲突', () => {
    const undoA: CellEditOp = {
      ...baseA, type: 'cellEdit', row: 0, col: 0,
      content: 'original', previousContent: 'A-edit',
    };
    const undoB: CellEditOp = {
      ...baseB, type: 'cellEdit', row: 0, col: 0,
      content: 'original', previousContent: 'B-edit',
    };
    const [aPrime, bPrime] = transform(undoA, undoB);
    // 两个撤销操作都不应被消除
    expect(aPrime).not.toBeNull();
    expect(bPrime).not.toBeNull();
  });
});
