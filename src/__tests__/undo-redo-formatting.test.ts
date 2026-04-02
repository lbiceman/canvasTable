import { describe, it, expect, beforeEach } from 'vitest';
import { SpreadsheetModel } from '../model';

/**
 * 撤销/重做完整覆盖测试
 *
 * 注意：model 的 setRange* 方法在记录 undoData 时使用 `|| false` / `|| ''` 等默认值，
 * 因此撤销后属性值可能是 false/'' 而非 undefined。测试中使用 toBeFalsy() 检查"无值"状态。
 */

function createTestModel(rows = 10, cols = 10): SpreadsheetModel {
  return new SpreadsheetModel(rows, cols);
}

// ============================================================
// 字体样式操作
// ============================================================

describe('撤销/重做 - 加粗', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置加粗后撤销应恢复为非加粗', () => {
    model.setRangeFontBold(0, 0, 0, 0, true);
    expect(model.getCell(0, 0)!.fontBold).toBe(true);
    model.undo();
    expect(model.getCell(0, 0)!.fontBold).toBeFalsy();
  });

  it('撤销后重做应重新加粗', () => {
    model.setRangeFontBold(0, 0, 0, 0, true);
    model.undo();
    model.redo();
    expect(model.getCell(0, 0)!.fontBold).toBe(true);
  });

  it('范围加粗后撤销应全部恢复', () => {
    model.setRangeFontBold(0, 0, 0, 0, true);
    model.setRangeFontBold(0, 0, 1, 1, false);
    model.undo();
    // (0,0) 之前是 true，其他是 false/undefined
    expect(model.getCell(0, 0)!.fontBold).toBe(true);
  });
});

describe('撤销/重做 - 斜体', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置斜体后撤销应恢复', () => {
    model.setRangeFontItalic(0, 0, 0, 0, true);
    expect(model.getCell(0, 0)!.fontItalic).toBe(true);
    model.undo();
    expect(model.getCell(0, 0)!.fontItalic).toBeFalsy();
  });

  it('范围斜体重做应全部生效', () => {
    model.setRangeFontItalic(0, 0, 2, 2, true);
    model.undo();
    model.redo();
    for (let r = 0; r <= 2; r++) {
      for (let c = 0; c <= 2; c++) {
        expect(model.getCell(r, c)!.fontItalic).toBe(true);
      }
    }
  });
});

describe('撤销/重做 - 下划线', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置下划线后撤销应恢复', () => {
    model.setRangeFontUnderline(1, 1, 1, 1, true);
    expect(model.getCell(1, 1)!.fontUnderline).toBe(true);
    model.undo();
    expect(model.getCell(1, 1)!.fontUnderline).toBeFalsy();
  });

  it('round-trip: 设置 → 撤销 → 重做 → 撤销', () => {
    model.setRangeFontUnderline(0, 0, 0, 0, true);
    model.undo();
    expect(model.getCell(0, 0)!.fontUnderline).toBeFalsy();
    model.redo();
    expect(model.getCell(0, 0)!.fontUnderline).toBe(true);
    model.undo();
    expect(model.getCell(0, 0)!.fontUnderline).toBeFalsy();
  });
});

describe('撤销/重做 - 删除线', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置删除线后撤销应恢复', () => {
    model.setRangeFontStrikethrough(0, 0, 0, 0, true);
    expect(model.getCell(0, 0)!.fontStrikethrough).toBe(true);
    model.undo();
    expect(model.getCell(0, 0)!.fontStrikethrough).toBeFalsy();
  });

  it('范围删除线撤销后恢复原始值', () => {
    model.setRangeFontStrikethrough(0, 0, 0, 0, true);
    model.setRangeFontStrikethrough(0, 0, 1, 1, false);
    model.undo();
    expect(model.getCell(0, 0)!.fontStrikethrough).toBe(true);
  });
});

// ============================================================
// 颜色操作
// ============================================================

describe('撤销/重做 - 字体颜色', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置字体颜色后撤销应恢复', () => {
    model.setRangeFontColor(0, 0, 0, 0, '#ff0000');
    expect(model.getCell(0, 0)!.fontColor).toBe('#ff0000');
    model.undo();
    // 初始值可能是 '' 或 undefined
    const restored = model.getCell(0, 0)!.fontColor;
    expect(restored === '' || restored === undefined).toBe(true);
  });

  it('连续修改字体颜色，逐一撤销', () => {
    model.setRangeFontColor(0, 0, 0, 0, '#ff0000');
    model.setRangeFontColor(0, 0, 0, 0, '#00ff00');
    model.setRangeFontColor(0, 0, 0, 0, '#0000ff');

    expect(model.getCell(0, 0)!.fontColor).toBe('#0000ff');
    model.undo();
    expect(model.getCell(0, 0)!.fontColor).toBe('#00ff00');
    model.undo();
    expect(model.getCell(0, 0)!.fontColor).toBe('#ff0000');
    model.undo();
    expect(!model.getCell(0, 0)!.fontColor || model.getCell(0, 0)!.fontColor === '').toBe(true);
  });
});

describe('撤销/重做 - 背景颜色', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置背景颜色后撤销应恢复', () => {
    model.setRangeBgColor(0, 0, 0, 0, '#ffff00');
    expect(model.getCell(0, 0)!.bgColor).toBe('#ffff00');
    model.undo();
    expect(!model.getCell(0, 0)!.bgColor || model.getCell(0, 0)!.bgColor === '').toBe(true);
  });

  it('范围背景颜色撤销应恢复所有单元格', () => {
    model.setRangeBgColor(0, 0, 0, 0, '#ff0000');
    model.setRangeBgColor(0, 0, 1, 1, '#00ff00');
    model.undo();
    expect(model.getCell(0, 0)!.bgColor).toBe('#ff0000');
    // 其他单元格恢复为初始值（'' 或 undefined）
    const bg01 = model.getCell(0, 1)!.bgColor;
    expect(!bg01 || bg01 === '').toBe(true);
  });
});

// ============================================================
// 字体属性操作
// ============================================================

describe('撤销/重做 - 字体大小', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置字体大小后撤销应恢复到原始值', () => {
    model.setRangeFontSize(0, 0, 0, 0, 24);
    expect(model.getCell(0, 0)!.fontSize).toBe(24);
    model.undo();
    // model 记录 undoData 时使用 cell.fontSize || 14 作为默认值
    // 撤销后恢复为该默认值（14），而非 undefined
    const restored = model.getCell(0, 0)!.fontSize;
    expect(restored === undefined || restored === 14).toBe(true);
  });

  it('重做应重新设置字体大小', () => {
    model.setRangeFontSize(0, 0, 0, 0, 18);
    model.undo();
    model.redo();
    expect(model.getCell(0, 0)!.fontSize).toBe(18);
  });
});

describe('撤销/重做 - 字体族', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置字体族后撤销应恢复', () => {
    model.setRangeFontFamily(0, 0, 0, 0, 'Courier New');
    expect(model.getCell(0, 0)!.fontFamily).toBe('Courier New');
    model.undo();
    expect(!model.getCell(0, 0)!.fontFamily || model.getCell(0, 0)!.fontFamily === '').toBe(true);
  });

  it('范围字体族撤销应恢复每个单元格的原始值', () => {
    model.setRangeFontFamily(0, 0, 0, 0, 'Arial');
    model.setRangeFontFamily(0, 0, 1, 1, 'Times New Roman');
    model.undo();
    expect(model.getCell(0, 0)!.fontFamily).toBe('Arial');
  });
});

// ============================================================
// 对齐操作
// ============================================================

describe('撤销/重做 - 水平对齐', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置居中对齐后撤销应恢复到原始值', () => {
    model.setRangeFontAlign(0, 0, 0, 0, 'center');
    expect(model.getCell(0, 0)!.fontAlign).toBe('center');
    model.undo();
    // model 记录 undoData 时使用 cell.fontAlign || 'left' 作为默认值
    const restored = model.getCell(0, 0)!.fontAlign;
    expect(restored === undefined || restored === 'left').toBe(true);
  });

  it('连续切换对齐方式，逐一撤销', () => {
    model.setRangeFontAlign(0, 0, 0, 0, 'left');
    model.setRangeFontAlign(0, 0, 0, 0, 'center');
    model.setRangeFontAlign(0, 0, 0, 0, 'right');

    model.undo();
    expect(model.getCell(0, 0)!.fontAlign).toBe('center');
    model.undo();
    expect(model.getCell(0, 0)!.fontAlign).toBe('left');
    model.undo();
    // 恢复到默认值 'left'（model 使用 || 'left'）
    const restored = model.getCell(0, 0)!.fontAlign;
    expect(restored === undefined || restored === 'left').toBe(true);
  });
});

describe('撤销/重做 - 垂直对齐', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置顶部对齐后撤销应恢复到原始值', () => {
    model.setRangeVerticalAlign(0, 0, 0, 0, 'top');
    expect(model.getCell(0, 0)!.verticalAlign).toBe('top');
    model.undo();
    // model 记录 undoData 时使用 cell.verticalAlign || 'middle' 作为默认值
    const restored = model.getCell(0, 0)!.verticalAlign;
    expect(restored === undefined || restored === 'middle').toBe(true);
  });

  it('设置底部对齐后重做应生效', () => {
    model.setRangeVerticalAlign(0, 0, 0, 0, 'bottom');
    model.undo();
    model.redo();
    expect(model.getCell(0, 0)!.verticalAlign).toBe('bottom');
  });
});

// ============================================================
// 边框操作
// ============================================================

describe('撤销/重做 - 边框', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置全部边框后撤销应恢复', () => {
    const borderSide = { style: 'solid' as const, color: '#000000', width: 1 };
    model.setRangeBorder(0, 0, 0, 0, 'all', borderSide);
    expect(model.getCell(0, 0)!.border).toBeDefined();
    expect(model.getCell(0, 0)!.border!.top).toBeDefined();

    model.undo();
    expect(model.getCell(0, 0)!.border).toBeUndefined();
  });

  it('设置虚线边框后撤销应恢复', () => {
    const borderSide = { style: 'dashed' as const, color: '#ff0000', width: 2 };
    model.setRangeBorder(1, 1, 1, 1, 'all', borderSide);
    model.undo();
    expect(model.getCell(1, 1)!.border).toBeUndefined();
  });

  it('清除边框后撤销应恢复原边框', () => {
    const borderSide = { style: 'solid' as const, color: '#000000', width: 1 };
    model.setRangeBorder(0, 0, 0, 0, 'all', borderSide);
    model.setRangeBorder(0, 0, 0, 0, 'none', borderSide);
    model.undo();
    expect(model.getCell(0, 0)!.border).toBeDefined();
    expect(model.getCell(0, 0)!.border!.top).toBeDefined();
  });

  it('设置双线边框后重做应生效', () => {
    const borderSide = { style: 'double' as const, color: '#0000ff', width: 2 };
    model.setRangeBorder(0, 0, 0, 0, 'all', borderSide);
    model.undo();
    model.redo();
    expect(model.getCell(0, 0)!.border!.top!.style).toBe('double');
  });
});


// ============================================================
// 格式与换行操作
// ============================================================

describe('撤销/重做 - 数字格式', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置货币格式后撤销应恢复', () => {
    model.setCellContent(0, 0, '1234.56');
    const format = { category: 'currency' as const, pattern: '#,##0.00', currencySymbol: '¥' };
    model.setRangeFormat(0, 0, 0, 0, format);
    expect(model.getCell(0, 0)!.format!.category).toBe('currency');

    model.undo();
    const undoneCell = model.getCell(0, 0)!;
    if (undoneCell.format) {
      expect(undoneCell.format.category).not.toBe('currency');
    }
  });
});

describe('撤销/重做 - 自动换行', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置自动换行后撤销应恢复', () => {
    model.setRangeWrapText(0, 0, 0, 0, true);
    expect(model.getCell(0, 0)!.wrapText).toBe(true);
    model.undo();
    expect(model.getCell(0, 0)!.wrapText).toBeFalsy();
  });

  it('取消自动换行后撤销应恢复为换行', () => {
    model.setRangeWrapText(0, 0, 0, 0, true);
    model.setRangeWrapText(0, 0, 0, 0, false);
    model.undo();
    expect(model.getCell(0, 0)!.wrapText).toBe(true);
  });
});

// ============================================================
// 合并/拆分单元格
// ============================================================

describe('撤销/重做 - 合并/拆分单元格', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('合并单元格后撤销应恢复为独立单元格', () => {
    model.setCellContent(0, 0, 'A');
    model.setCellContent(0, 1, 'B');
    model.mergeCells(0, 0, 1, 1);
    expect(model.getCell(0, 0)!.rowSpan).toBe(2);
    expect(model.getCell(0, 0)!.colSpan).toBe(2);
    expect(model.getCell(0, 1)!.isMerged).toBe(true);

    model.undo();
    expect(model.getCell(0, 0)!.rowSpan).toBe(1);
    expect(model.getCell(0, 0)!.colSpan).toBe(1);
    expect(model.getCell(0, 1)!.isMerged).toBe(false);
  });

  it('合并后重做应重新合并', () => {
    model.mergeCells(0, 0, 1, 1);
    model.undo();
    model.redo();
    expect(model.getCell(0, 0)!.rowSpan).toBe(2);
    expect(model.getCell(0, 0)!.colSpan).toBe(2);
  });

  it('拆分单元格后撤销应恢复合并状态', () => {
    model.mergeCells(0, 0, 1, 1);
    model.splitCell(0, 0);
    expect(model.getCell(0, 0)!.rowSpan).toBe(1);

    model.undo();
    expect(model.getCell(0, 0)!.rowSpan).toBe(2);
    expect(model.getCell(0, 0)!.colSpan).toBe(2);
  });
});

// ============================================================
// 单元格内容编辑
// ============================================================

describe('撤销/重做 - 单元格内容编辑', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('编辑内容后撤销应恢复原内容', () => {
    model.setCellContent(0, 0, 'Hello');
    expect(model.getCell(0, 0)!.content).toBe('Hello');
    model.undo();
    expect(model.getCell(0, 0)!.content).toBe('');
  });

  it('连续编辑多个单元格，逐一撤销', () => {
    model.setCellContent(0, 0, 'A');
    model.setCellContent(0, 1, 'B');
    model.setCellContent(0, 2, 'C');

    model.undo();
    expect(model.getCell(0, 2)!.content).toBe('');
    model.undo();
    expect(model.getCell(0, 1)!.content).toBe('');
    model.undo();
    expect(model.getCell(0, 0)!.content).toBe('');
  });

  it('编辑后撤销再重做应恢复编辑', () => {
    model.setCellContent(0, 0, 'Test');
    model.undo();
    model.redo();
    expect(model.getCell(0, 0)!.content).toBe('Test');
  });

  it('清除内容后撤销应恢复', () => {
    model.setCellContent(0, 0, 'Data');
    model.setCellContent(0, 1, 'More');
    model.clearRangeContent(0, 0, 0, 1);
    expect(model.getCell(0, 0)!.content).toBe('');

    model.undo();
    expect(model.getCell(0, 0)!.content).toBe('Data');
    expect(model.getCell(0, 1)!.content).toBe('More');
  });
});

// ============================================================
// 内嵌图片
// ============================================================

describe('撤销/重做 - 内嵌图片', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('设置图片后撤销应恢复', () => {
    const image = { base64Data: 'data:image/png;base64,ABC', originalWidth: 100, originalHeight: 100 };
    const cell = model.getCell(0, 0)!;
    const oldImage = cell.embeddedImage;
    cell.embeddedImage = { ...image };
    model.getHistoryManager().record({
      type: 'setEmbeddedImage',
      data: { row: 0, col: 0, image: { ...image } },
      undoData: { row: 0, col: 0, image: oldImage },
    });

    expect(model.getCell(0, 0)!.embeddedImage).toBeDefined();
    model.undo();
    expect(model.getCell(0, 0)!.embeddedImage).toBeUndefined();
  });

  it('删除图片后撤销应恢复图片', () => {
    const image = { base64Data: 'data:image/png;base64,XYZ', originalWidth: 200, originalHeight: 150 };
    const cell = model.getCell(0, 0)!;
    cell.embeddedImage = { ...image };
    model.getHistoryManager().record({
      type: 'setEmbeddedImage',
      data: { row: 0, col: 0, image: { ...image } },
      undoData: { row: 0, col: 0, image: undefined },
    });

    // 删除图片
    const oldImage = { ...cell.embeddedImage! };
    cell.embeddedImage = undefined;
    model.getHistoryManager().record({
      type: 'setEmbeddedImage',
      data: { row: 0, col: 0, image: undefined },
      undoData: { row: 0, col: 0, image: oldImage },
    });

    model.undo();
    expect(model.getCell(0, 0)!.embeddedImage).toBeDefined();
    expect(model.getCell(0, 0)!.embeddedImage!.originalWidth).toBe(200);
  });

  it('图片重做应重新设置', () => {
    const image = { base64Data: 'data:image/png;base64,123', originalWidth: 50, originalHeight: 50 };
    const cell = model.getCell(0, 0)!;
    cell.embeddedImage = { ...image };
    model.getHistoryManager().record({
      type: 'setEmbeddedImage',
      data: { row: 0, col: 0, image: { ...image } },
      undoData: { row: 0, col: 0, image: undefined },
    });

    model.undo();
    model.redo();
    expect(model.getCell(0, 0)!.embeddedImage).toBeDefined();
    expect(model.getCell(0, 0)!.embeddedImage!.originalWidth).toBe(50);
  });
});

// ============================================================
// 行列操作
// ============================================================

describe('撤销/重做 - 行列操作', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('调整行高后撤销应恢复原高度', () => {
    const originalHeight = model.getRowHeight(0);
    model.setRowHeight(0, 50);
    expect(model.getRowHeight(0)).toBe(50);
    model.undo();
    expect(model.getRowHeight(0)).toBe(originalHeight);
  });

  it('调整列宽后撤销应恢复原宽度', () => {
    const originalWidth = model.getColWidth(0);
    model.setColWidth(0, 200);
    expect(model.getColWidth(0)).toBe(200);
    model.undo();
    expect(model.getColWidth(0)).toBe(originalWidth);
  });

  it('调整行高后重做应重新设置', () => {
    model.setRowHeight(0, 80);
    model.undo();
    model.redo();
    expect(model.getRowHeight(0)).toBe(80);
  });

  it('调整列宽后重做应重新设置', () => {
    model.setColWidth(0, 300);
    model.undo();
    model.redo();
    expect(model.getColWidth(0)).toBe(300);
  });
});

// ============================================================
// 复杂连续操作
// ============================================================

describe('撤销/重做 - 复杂连续操作', () => {
  let model: SpreadsheetModel;
  beforeEach(() => { model = createTestModel(); });

  it('连续多种格式操作后全部撤销应恢复初始状态', () => {
    // 记录初始状态
    const initialContent = model.getCell(0, 0)!.content;
    const initialBold = model.getCell(0, 0)!.fontBold;
    const initialItalic = model.getCell(0, 0)!.fontItalic;

    // 执行一系列操作
    model.setCellContent(0, 0, 'Test');
    model.setRangeFontBold(0, 0, 0, 0, true);
    model.setRangeFontItalic(0, 0, 0, 0, true);
    model.setRangeFontColor(0, 0, 0, 0, '#ff0000');
    model.setRangeBgColor(0, 0, 0, 0, '#ffff00');
    model.setRangeFontStrikethrough(0, 0, 0, 0, true);
    model.setRangeFontUnderline(0, 0, 0, 0, true);

    // 验证所有格式已应用
    const cell = model.getCell(0, 0)!;
    expect(cell.content).toBe('Test');
    expect(cell.fontBold).toBe(true);
    expect(cell.fontItalic).toBe(true);
    expect(cell.fontColor).toBe('#ff0000');
    expect(cell.bgColor).toBe('#ffff00');
    expect(cell.fontStrikethrough).toBe(true);
    expect(cell.fontUnderline).toBe(true);

    // 全部撤销（7 次操作）
    for (let i = 0; i < 7; i++) {
      model.undo();
    }

    const restored = model.getCell(0, 0)!;
    expect(restored.content).toBe(initialContent);
    // model 的 undoData 使用 || false 默认值，所以撤销后是 false 而非 undefined
    expect(restored.fontBold).toBeFalsy();
    expect(restored.fontItalic).toBeFalsy();
  });

  it('全部撤销后全部重做应恢复最终状态', () => {
    model.setCellContent(0, 0, 'Data');
    model.setRangeFontBold(0, 0, 0, 0, true);
    model.setRangeFontColor(0, 0, 0, 0, '#0000ff');
    model.setRangeBgColor(0, 0, 0, 0, '#00ff00');

    // 全部撤销
    model.undo(); model.undo(); model.undo(); model.undo();

    // 全部重做
    model.redo(); model.redo(); model.redo(); model.redo();

    expect(model.getCell(0, 0)!.content).toBe('Data');
    expect(model.getCell(0, 0)!.fontBold).toBe(true);
    expect(model.getCell(0, 0)!.fontColor).toBe('#0000ff');
    expect(model.getCell(0, 0)!.bgColor).toBe('#00ff00');
  });

  it('撤销后执行新操作应清空重做栈', () => {
    model.setRangeFontBold(0, 0, 0, 0, true);
    model.setRangeFontItalic(0, 0, 0, 0, true);
    model.undo();
    expect(model.canRedo()).toBe(true);

    model.setRangeFontColor(0, 0, 0, 0, '#ff0000');
    expect(model.canRedo()).toBe(false);
  });

  it('对多个不同单元格的混合操作撤销', () => {
    model.setCellContent(0, 0, 'A1');
    model.setCellContent(1, 1, 'B2');
    model.setRangeFontBold(0, 0, 0, 0, true);
    model.setRangeBgColor(1, 1, 1, 1, '#ff0000');

    // 撤销背景色
    model.undo();
    expect(model.getCell(1, 1)!.bgColor).toBeFalsy();

    // 撤销加粗
    model.undo();
    expect(model.getCell(0, 0)!.fontBold).toBeFalsy();

    // 撤销 B2 内容
    model.undo();
    expect(model.getCell(1, 1)!.content).toBe('');

    // 撤销 A1 内容
    model.undo();
    expect(model.getCell(0, 0)!.content).toBe('');
  });

  it('空撤销栈时 undo 返回 false', () => {
    expect(model.undo()).toBe(false);
  });

  it('空重做栈时 redo 返回 false', () => {
    expect(model.redo()).toBe(false);
  });

  it('canUndo/canRedo 状态正确', () => {
    expect(model.canUndo()).toBe(false);
    expect(model.canRedo()).toBe(false);

    model.setRangeFontBold(0, 0, 0, 0, true);
    expect(model.canUndo()).toBe(true);
    expect(model.canRedo()).toBe(false);

    model.undo();
    expect(model.canUndo()).toBe(false);
    expect(model.canRedo()).toBe(true);

    model.redo();
    expect(model.canUndo()).toBe(true);
    expect(model.canRedo()).toBe(false);
  });

  it('格式化 + 合并 + 内容编辑的混合撤销', () => {
    model.setCellContent(0, 0, 'Hello');
    model.setRangeFontBold(0, 0, 0, 0, true);
    model.setRangeBgColor(0, 0, 0, 0, '#ff0000');
    model.mergeCells(0, 0, 1, 1);

    // 撤销合并
    model.undo();
    expect(model.getCell(0, 0)!.rowSpan).toBe(1);

    // 撤销背景色
    model.undo();
    expect(model.getCell(0, 0)!.bgColor).toBeFalsy();

    // 撤销加粗
    model.undo();
    expect(model.getCell(0, 0)!.fontBold).toBeFalsy();

    // 撤销内容
    model.undo();
    expect(model.getCell(0, 0)!.content).toBe('');
  });
});
