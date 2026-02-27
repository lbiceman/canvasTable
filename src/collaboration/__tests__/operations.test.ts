import { describe, it, expect } from 'vitest';
import { serializeOperation, deserializeOperation } from '../operations';
import { CellEditOp, CellMergeOp, RowInsertOp } from '../types';

describe('serializeOperation / deserializeOperation', () => {
  const baseFields = {
    userId: 'user-1',
    timestamp: 1700000000000,
    revision: 5,
  };

  it('应正确序列化和反序列化 CellEditOp', () => {
    const op: CellEditOp = {
      ...baseFields,
      type: 'cellEdit',
      row: 3,
      col: 7,
      content: '新内容',
      previousContent: '旧内容',
    };
    const json = serializeOperation(op);
    const result = deserializeOperation(json);
    expect(result).toEqual(op);
  });

  it('应正确序列化和反序列化 CellMergeOp', () => {
    const op: CellMergeOp = {
      ...baseFields,
      type: 'cellMerge',
      startRow: 0,
      startCol: 0,
      endRow: 2,
      endCol: 3,
    };
    const json = serializeOperation(op);
    const result = deserializeOperation(json);
    expect(result).toEqual(op);
  });

  it('应正确序列化和反序列化 RowInsertOp', () => {
    const op: RowInsertOp = {
      ...baseFields,
      type: 'rowInsert',
      rowIndex: 10,
      count: 3,
    };
    const json = serializeOperation(op);
    const result = deserializeOperation(json);
    expect(result).toEqual(op);
  });

  it('应对无效 JSON 抛出错误', () => {
    expect(() => deserializeOperation('not json')).toThrow();
  });

  it('应对缺少 type 字段抛出错误', () => {
    const json = JSON.stringify({ userId: 'u1', timestamp: 0, revision: 0 });
    expect(() => deserializeOperation(json)).toThrow('无效的操作类型');
  });

  it('应对无效操作类型抛出错误', () => {
    const json = JSON.stringify({ type: 'unknown', userId: 'u1', timestamp: 0, revision: 0 });
    expect(() => deserializeOperation(json)).toThrow('无效的操作类型');
  });

  it('应对缺少特定字段抛出错误', () => {
    const json = JSON.stringify({ type: 'cellEdit', userId: 'u1', timestamp: 0, revision: 0, row: 0 });
    expect(() => deserializeOperation(json)).toThrow('cellEdit: 缺少 col');
  });
});
