// ============================================================
// ArrayFormulaManager 单元测试
// Requirements: 8.1-8.7
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ArrayFormulaManager } from '../../formula/array-formula';
import { FormulaValue } from '../../formula/types';

describe('ArrayFormulaManager', () => {
  let manager: ArrayFormulaManager;

  beforeEach(() => {
    manager = new ArrayFormulaManager();
  });

  // ============================================================
  // register - 注册数组公式 (Requirement 8.1)
  // ============================================================
  describe('register - 注册数组公式', () => {
    it('成功注册数组公式', () => {
      manager.register(
        { row: 0, col: 0 },
        'SUM(A1:A5*B1:B5)',
        { startRow: 0, startCol: 0, endRow: 4, endCol: 0 }
      );
      // 注册后可通过 getArrayFormula 查询
      const info = manager.getArrayFormula(0, 0);
      expect(info).not.toBeNull();
      expect(info!.formula).toBe('SUM(A1:A5*B1:B5)');
      expect(info!.originRow).toBe(0);
      expect(info!.originCol).toBe(0);
    });

    it('注册多个数组公式', () => {
      manager.register(
        { row: 0, col: 0 },
        'A1:A3*B1:B3',
        { startRow: 0, startCol: 0, endRow: 2, endCol: 0 }
      );
      manager.register(
        { row: 5, col: 5 },
        'C1:C3+D1:D3',
        { startRow: 5, startCol: 5, endRow: 7, endCol: 5 }
      );

      expect(manager.getArrayFormula(0, 0)).not.toBeNull();
      expect(manager.getArrayFormula(5, 5)).not.toBeNull();
    });

    it('重复注册同一起始位置会覆盖', () => {
      manager.register(
        { row: 0, col: 0 },
        'A1:A3*B1:B3',
        { startRow: 0, startCol: 0, endRow: 2, endCol: 0 }
      );
      manager.register(
        { row: 0, col: 0 },
        'X1:X5+Y1:Y5',
        { startRow: 0, startCol: 0, endRow: 4, endCol: 0 }
      );

      const info = manager.getArrayFormula(0, 0);
      expect(info!.formula).toBe('X1:X5+Y1:Y5');
      expect(info!.range.endRow).toBe(4);
    });
  });

  // ============================================================
  // isInArrayFormula - 检查单元格是否在数组公式区域 (Requirement 8.4)
  // ============================================================
  describe('isInArrayFormula - 检查单元格是否在数组公式区域', () => {
    beforeEach(() => {
      manager.register(
        { row: 1, col: 1 },
        'A1:A3*B1:B3',
        { startRow: 1, startCol: 1, endRow: 3, endCol: 3 }
      );
    });

    it('起始单元格在数组公式区域内', () => {
      expect(manager.isInArrayFormula(1, 1)).toBe(true);
    });

    it('区域内部单元格在数组公式区域内', () => {
      expect(manager.isInArrayFormula(2, 2)).toBe(true);
    });

    it('区域边界单元格在数组公式区域内', () => {
      expect(manager.isInArrayFormula(3, 3)).toBe(true);
      expect(manager.isInArrayFormula(1, 3)).toBe(true);
      expect(manager.isInArrayFormula(3, 1)).toBe(true);
    });

    it('区域外部单元格不在数组公式区域内', () => {
      expect(manager.isInArrayFormula(0, 0)).toBe(false);
      expect(manager.isInArrayFormula(4, 4)).toBe(false);
      expect(manager.isInArrayFormula(0, 2)).toBe(false);
      expect(manager.isInArrayFormula(2, 0)).toBe(false);
    });

    it('无注册数组公式时返回 false', () => {
      const emptyManager = new ArrayFormulaManager();
      expect(emptyManager.isInArrayFormula(0, 0)).toBe(false);
    });
  });

  // ============================================================
  // getArrayFormula - 获取数组公式信息 (Requirement 8.4)
  // ============================================================
  describe('getArrayFormula - 获取数组公式信息', () => {
    beforeEach(() => {
      manager.register(
        { row: 2, col: 3 },
        'SUM(A1:A5)',
        { startRow: 2, startCol: 3, endRow: 6, endCol: 3 }
      );
    });

    it('返回包含该单元格的数组公式信息', () => {
      const info = manager.getArrayFormula(4, 3);
      expect(info).not.toBeNull();
      expect(info!.originRow).toBe(2);
      expect(info!.originCol).toBe(3);
      expect(info!.formula).toBe('SUM(A1:A5)');
      expect(info!.range).toEqual({
        startRow: 2,
        startCol: 3,
        endRow: 6,
        endCol: 3,
      });
    });

    it('不在任何数组公式区域内返回 null', () => {
      expect(manager.getArrayFormula(0, 0)).toBeNull();
      expect(manager.getArrayFormula(7, 3)).toBeNull();
    });

    it('多个数组公式时返回正确的那个', () => {
      manager.register(
        { row: 10, col: 10 },
        'B1:B3+C1:C3',
        { startRow: 10, startCol: 10, endRow: 12, endCol: 12 }
      );

      const info1 = manager.getArrayFormula(4, 3);
      expect(info1!.formula).toBe('SUM(A1:A5)');

      const info2 = manager.getArrayFormula(11, 11);
      expect(info2!.formula).toBe('B1:B3+C1:C3');
    });
  });

  // ============================================================
  // delete - 删除数组公式 (Requirement 8.5)
  // ============================================================
  describe('delete - 删除数组公式', () => {
    it('成功删除已注册的数组公式', () => {
      manager.register(
        { row: 0, col: 0 },
        'A1:A3*B1:B3',
        { startRow: 0, startCol: 0, endRow: 2, endCol: 0 }
      );

      manager.delete(0, 0);
      expect(manager.isInArrayFormula(0, 0)).toBe(false);
      expect(manager.getArrayFormula(0, 0)).toBeNull();
    });

    it('删除不存在的数组公式不报错', () => {
      // 不应抛出异常
      expect(() => manager.delete(99, 99)).not.toThrow();
    });

    it('删除一个不影响其他数组公式', () => {
      manager.register(
        { row: 0, col: 0 },
        'formula1',
        { startRow: 0, startCol: 0, endRow: 2, endCol: 0 }
      );
      manager.register(
        { row: 5, col: 5 },
        'formula2',
        { startRow: 5, startCol: 5, endRow: 7, endCol: 5 }
      );

      manager.delete(0, 0);

      expect(manager.getArrayFormula(0, 0)).toBeNull();
      expect(manager.getArrayFormula(5, 5)).not.toBeNull();
      expect(manager.getArrayFormula(5, 5)!.formula).toBe('formula2');
    });
  });

  // ============================================================
  // checkOverlap - 检查区域重叠 (Requirement 8.7)
  // ============================================================
  describe('checkOverlap - 检查区域重叠', () => {
    it('区域内全部为空时返回空数组', () => {
      const cellGetter = (): FormulaValue => '';
      const result = manager.checkOverlap(
        { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
        cellGetter
      );
      expect(result).toEqual([]);
    });

    it('区域内有非空数值时返回对应位置', () => {
      const cellGetter = (row: number, col: number): FormulaValue => {
        if (row === 1 && col === 1) return 42;
        return '';
      };
      const result = manager.checkOverlap(
        { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
        cellGetter
      );
      expect(result).toEqual([{ row: 1, col: 1 }]);
    });

    it('区域内有非空字符串时返回对应位置', () => {
      const cellGetter = (row: number, col: number): FormulaValue => {
        if (row === 0 && col === 0) return '数据';
        return '';
      };
      const result = manager.checkOverlap(
        { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
        cellGetter
      );
      expect(result).toEqual([{ row: 0, col: 0 }]);
    });

    it('区域内有布尔值时返回对应位置', () => {
      const cellGetter = (row: number, col: number): FormulaValue => {
        if (row === 0 && col === 0) return true;
        if (row === 1 && col === 0) return false;
        return '';
      };
      const result = manager.checkOverlap(
        { startRow: 0, startCol: 0, endRow: 1, endCol: 0 },
        cellGetter
      );
      expect(result).toEqual([
        { row: 0, col: 0 },
        { row: 1, col: 0 },
      ]);
    });

    it('区域内有错误值时返回对应位置', () => {
      const cellGetter = (row: number, col: number): FormulaValue => {
        if (row === 0 && col === 0) return { type: '#VALUE!', message: '错误' };
        return '';
      };
      const result = manager.checkOverlap(
        { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        cellGetter
      );
      expect(result).toEqual([{ row: 0, col: 0 }]);
    });

    it('多个非空单元格全部返回', () => {
      const cellGetter = (row: number, col: number): FormulaValue => {
        if (row === 0 && col === 0) return 1;
        if (row === 1 && col === 1) return '文本';
        if (row === 2 && col === 2) return true;
        return '';
      };
      const result = manager.checkOverlap(
        { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
        cellGetter
      );
      expect(result).toHaveLength(3);
      expect(result).toContainEqual({ row: 0, col: 0 });
      expect(result).toContainEqual({ row: 1, col: 1 });
      expect(result).toContainEqual({ row: 2, col: 2 });
    });

    it('单个单元格区域检查', () => {
      const cellGetter = (): FormulaValue => 100;
      const result = manager.checkOverlap(
        { startRow: 5, startCol: 5, endRow: 5, endCol: 5 },
        cellGetter
      );
      expect(result).toEqual([{ row: 5, col: 5 }]);
    });
  });
});
