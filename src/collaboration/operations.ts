import {
  CollabOperation,
  OperationType,
  CellEditOp,
  CellMergeOp,
  CellSplitOp,
  RowInsertOp,
  RowDeleteOp,
  RowResizeOp,
  ColInsertOp,
  ColDeleteOp,
  ColResizeOp,
  FontColorOp,
  BgColorOp,
  FontSizeOp,
  FontBoldOp,
  FontItalicOp,
  FontUnderlineOp,
  FontAlignOp,
  VerticalAlignOp,
} from './types';

// 所有合法的操作类型
const VALID_OPERATION_TYPES: ReadonlySet<OperationType> = new Set([
  'cellEdit',
  'cellMerge',
  'cellSplit',
  'rowInsert',
  'rowDelete',
  'rowResize',
  'colInsert',
  'colDelete',
  'colResize',
  'fontColor',
  'bgColor',
  'fontSize',
  'fontBold',
  'fontItalic',
  'fontUnderline',
  'fontAlign',
  'verticalAlign',
]);

/**
 * 将协同操作对象序列化为 JSON 字符串
 */
export const serializeOperation = (op: CollabOperation): string => {
  return JSON.stringify(op);
};

/**
 * 将 JSON 字符串反序列化为协同操作对象
 * 对输入进行校验，确保数据完整性
 */
export const deserializeOperation = (json: string): CollabOperation => {
  const parsed: unknown = JSON.parse(json);

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('无效的操作数据：不是对象');
  }

  const obj = parsed as Record<string, unknown>;

  // 校验基础字段
  if (typeof obj.type !== 'string' || !VALID_OPERATION_TYPES.has(obj.type as OperationType)) {
    throw new Error(`无效的操作类型: ${String(obj.type)}`);
  }
  if (typeof obj.userId !== 'string') {
    throw new Error('缺少 userId 字段');
  }
  if (typeof obj.timestamp !== 'number') {
    throw new Error('缺少 timestamp 字段');
  }
  if (typeof obj.revision !== 'number') {
    throw new Error('缺少 revision 字段');
  }

  // 按类型校验特定字段
  const type = obj.type as OperationType;

  switch (type) {
    case 'cellEdit':
      validateCellEditOp(obj);
      return obj as unknown as CellEditOp;

    case 'cellMerge':
      validateCellMergeOp(obj);
      return obj as unknown as CellMergeOp;

    case 'cellSplit':
      validateCellSplitOp(obj);
      return obj as unknown as CellSplitOp;

    case 'rowInsert':
      validateRowInsertOp(obj);
      return obj as unknown as RowInsertOp;

    case 'rowDelete':
      validateRowDeleteOp(obj);
      return obj as unknown as RowDeleteOp;

    case 'rowResize':
      validateRowResizeOp(obj);
      return obj as unknown as RowResizeOp;

    case 'colInsert':
      validateColInsertOp(obj);
      return obj as unknown as ColInsertOp;

    case 'colDelete':
      validateColDeleteOp(obj);
      return obj as unknown as ColDeleteOp;

    case 'colResize':
      validateColResizeOp(obj);
      return obj as unknown as ColResizeOp;

    case 'fontColor':
      validateFontColorOp(obj);
      return obj as unknown as FontColorOp;

    case 'bgColor':
      validateBgColorOp(obj);
      return obj as unknown as BgColorOp;

    case 'fontSize':
      validateFontSizeOp(obj);
      return obj as unknown as FontSizeOp;

    case 'fontBold':
      validateFontBoldOp(obj);
      return obj as unknown as FontBoldOp;

    case 'fontItalic':
      validateFontItalicOp(obj);
      return obj as unknown as FontItalicOp;

    case 'fontUnderline':
      validateFontUnderlineOp(obj);
      return obj as unknown as FontUnderlineOp;

    case 'fontAlign':
      validateFontAlignOp(obj);
      return obj as unknown as FontAlignOp;

    case 'verticalAlign':
      validateVerticalAlignOp(obj);
      return obj as unknown as VerticalAlignOp;

    default:
      throw new Error(`未知的操作类型: ${type}`);
  }
};

// ============================================================
// 各操作类型的字段校验函数
// ============================================================

const validateCellEditOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.row !== 'number') throw new Error('cellEdit: 缺少 row');
  if (typeof obj.col !== 'number') throw new Error('cellEdit: 缺少 col');
  if (typeof obj.content !== 'string') throw new Error('cellEdit: 缺少 content');
  if (typeof obj.previousContent !== 'string') throw new Error('cellEdit: 缺少 previousContent');
};

const validateCellMergeOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.startRow !== 'number') throw new Error('cellMerge: 缺少 startRow');
  if (typeof obj.startCol !== 'number') throw new Error('cellMerge: 缺少 startCol');
  if (typeof obj.endRow !== 'number') throw new Error('cellMerge: 缺少 endRow');
  if (typeof obj.endCol !== 'number') throw new Error('cellMerge: 缺少 endCol');
};

const validateCellSplitOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.row !== 'number') throw new Error('cellSplit: 缺少 row');
  if (typeof obj.col !== 'number') throw new Error('cellSplit: 缺少 col');
  if (obj.rowSpan !== undefined && typeof obj.rowSpan !== 'number') {
    throw new Error('cellSplit: rowSpan 必须是数字');
  }
  if (obj.colSpan !== undefined && typeof obj.colSpan !== 'number') {
    throw new Error('cellSplit: colSpan 必须是数字');
  }
};

const validateRowInsertOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.rowIndex !== 'number') throw new Error('rowInsert: 缺少 rowIndex');
  if (typeof obj.count !== 'number') throw new Error('rowInsert: 缺少 count');
};

const validateRowDeleteOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.rowIndex !== 'number') throw new Error('rowDelete: 缺少 rowIndex');
  if (typeof obj.count !== 'number') throw new Error('rowDelete: 缺少 count');
};

const validateRowResizeOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.rowIndex !== 'number') throw new Error('rowResize: 缺少 rowIndex');
  if (typeof obj.height !== 'number') throw new Error('rowResize: 缺少 height');
};

const validateColInsertOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.colIndex !== 'number' || obj.colIndex < 0 || !Number.isInteger(obj.colIndex)) {
    throw new Error('colInsert: colIndex 必须是非负整数');
  }
  if (typeof obj.count !== 'number' || obj.count <= 0 || !Number.isInteger(obj.count)) {
    throw new Error('colInsert: count 必须是正整数');
  }
};

const validateColDeleteOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.colIndex !== 'number' || obj.colIndex < 0 || !Number.isInteger(obj.colIndex)) {
    throw new Error('colDelete: colIndex 必须是非负整数');
  }
  if (typeof obj.count !== 'number' || obj.count <= 0 || !Number.isInteger(obj.count)) {
    throw new Error('colDelete: count 必须是正整数');
  }
};

const validateColResizeOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.colIndex !== 'number') throw new Error('colResize: 缺少 colIndex');
  if (typeof obj.width !== 'number') throw new Error('colResize: 缺少 width');
};

const validateFontColorOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.row !== 'number') throw new Error('fontColor: 缺少 row');
  if (typeof obj.col !== 'number') throw new Error('fontColor: 缺少 col');
  if (typeof obj.color !== 'string') throw new Error('fontColor: 缺少 color');
};

const validateBgColorOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.row !== 'number') throw new Error('bgColor: 缺少 row');
  if (typeof obj.col !== 'number') throw new Error('bgColor: 缺少 col');
  if (typeof obj.color !== 'string') throw new Error('bgColor: 缺少 color');
};

const validateFontSizeOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.row !== 'number') throw new Error('fontSize: 缺少 row');
  if (typeof obj.col !== 'number') throw new Error('fontSize: 缺少 col');
  if (typeof obj.size !== 'number') throw new Error('fontSize: 缺少 size');
};

const validateFontBoldOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.row !== 'number') throw new Error('fontBold: 缺少 row');
  if (typeof obj.col !== 'number') throw new Error('fontBold: 缺少 col');
  if (typeof obj.bold !== 'boolean') throw new Error('fontBold: 缺少 bold');
};

const validateFontItalicOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.row !== 'number') throw new Error('fontItalic: 缺少 row');
  if (typeof obj.col !== 'number') throw new Error('fontItalic: 缺少 col');
  if (typeof obj.italic !== 'boolean') throw new Error('fontItalic: 缺少 italic');
};

const validateFontUnderlineOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.row !== 'number') throw new Error('fontUnderline: 缺少 row');
  if (typeof obj.col !== 'number') throw new Error('fontUnderline: 缺少 col');
  if (typeof obj.underline !== 'boolean') throw new Error('fontUnderline: 缺少 underline');
};

const validateFontAlignOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.row !== 'number') throw new Error('fontAlign: 缺少 row');
  if (typeof obj.col !== 'number') throw new Error('fontAlign: 缺少 col');
  if (typeof obj.align !== 'string') throw new Error('fontAlign: 缺少 align');
  if (!['left', 'center', 'right'].includes(obj.align)) throw new Error('fontAlign: align 必须是 left、center 或 right');
};

const validateVerticalAlignOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.row !== 'number') throw new Error('verticalAlign: 缺少 row');
  if (typeof obj.col !== 'number') throw new Error('verticalAlign: 缺少 col');
  if (typeof obj.align !== 'string') throw new Error('verticalAlign: 缺少 align');
  if (!['top', 'middle', 'bottom'].includes(obj.align)) throw new Error('verticalAlign: align 必须是 top、middle 或 bottom');
};
