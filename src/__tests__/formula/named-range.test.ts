// ============================================================
// NamedRangeManager 单元测试
// Requirements: 9.1-9.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { NamedRangeManager } from '../../formula/named-range';
import { RangeReferenceNode } from '../../formula/types';

/** 创建测试用的区域引用 */
const makeRange = (
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  sheetName?: string
): { range: RangeReferenceNode; sheetScope?: string } => ({
  range: {
    type: 'RangeReference',
    startRow,
    startCol,
    endRow,
    endCol,
    sheetName,
  },
});

describe('NamedRangeManager', () => {
  let manager: NamedRangeManager;

  beforeEach(() => {
    manager = new NamedRangeManager();
  });

  // ============================================================
  // 创建命名范围 (Requirement 9.1)
  // ============================================================
  describe('create - 创建命名范围', () => {
    it('成功创建合法命名范围', () => {
      const result = manager.create('Sales', makeRange(0, 0, 9, 0));
      expect(result.success).toBe(true);
    });

    it('创建后可通过 resolve 查询', () => {
      manager.create('Sales', makeRange(0, 0, 9, 0));
      const resolved = manager.resolve('Sales');
      expect(resolved).not.toBeNull();
      expect(resolved!.name).toBe('Sales');
      expect(resolved!.range.startRow).toBe(0);
      expect(resolved!.range.endRow).toBe(9);
    });

    it('拒绝重复名称（不区分大小写）', () => {
      manager.create('Sales', makeRange(0, 0, 9, 0));
      const result = manager.create('SALES', makeRange(1, 1, 5, 5));
      expect(result.success).toBe(false);
      expect(result.error).toBe('duplicate');
    });

    it('拒绝非法名称', () => {
      const result = manager.create('1abc', makeRange(0, 0, 9, 0));
      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_name');
    });

    it('拒绝与单元格引用冲突的名称', () => {
      const result = manager.create('A1', makeRange(0, 0, 9, 0));
      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_name');
    });

    it('以下划线开头的名称可以创建', () => {
      const result = manager.create('_myRange', makeRange(0, 0, 5, 5));
      expect(result.success).toBe(true);
    });

    it('包含点号的名称可以创建', () => {
      const result = manager.create('Sheet1.Sales', makeRange(0, 0, 5, 5));
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // 更新命名范围 (Requirement 9.2)
  // ============================================================
  describe('update - 更新命名范围', () => {
    it('成功更新已有命名范围的区域', () => {
      manager.create('Sales', makeRange(0, 0, 9, 0));
      const result = manager.update('Sales', makeRange(0, 0, 19, 0));
      expect(result.success).toBe(true);

      const resolved = manager.resolve('Sales');
      expect(resolved!.range.endRow).toBe(19);
    });

    it('更新不存在的名称返回失败', () => {
      const result = manager.update('NotExist', makeRange(0, 0, 9, 0));
      expect(result.success).toBe(false);
    });

    it('更新时名称不区分大小写', () => {
      manager.create('Sales', makeRange(0, 0, 9, 0));
      const result = manager.update('sales', makeRange(0, 0, 19, 0));
      expect(result.success).toBe(true);

      // 保留原始名称
      const resolved = manager.resolve('Sales');
      expect(resolved!.name).toBe('Sales');
      expect(resolved!.range.endRow).toBe(19);
    });
  });

  // ============================================================
  // 删除命名范围 (Requirement 9.3)
  // ============================================================
  describe('delete - 删除命名范围', () => {
    it('成功删除已有命名范围', () => {
      manager.create('Sales', makeRange(0, 0, 9, 0));
      const result = manager.delete('Sales');
      expect(result).toBe(true);
      expect(manager.resolve('Sales')).toBeNull();
    });

    it('删除不存在的名称返回 false', () => {
      const result = manager.delete('NotExist');
      expect(result).toBe(false);
    });

    it('删除时名称不区分大小写', () => {
      manager.create('Sales', makeRange(0, 0, 9, 0));
      const result = manager.delete('sales');
      expect(result).toBe(true);
      expect(manager.resolve('Sales')).toBeNull();
    });
  });

  // ============================================================
  // 解析命名范围 (Requirement 9.4, 9.7)
  // ============================================================
  describe('resolve - 解析命名范围', () => {
    it('解析已有命名范围', () => {
      manager.create('Sales', makeRange(0, 0, 9, 0));
      const resolved = manager.resolve('Sales');
      expect(resolved).not.toBeNull();
      expect(resolved!.range.startRow).toBe(0);
      expect(resolved!.range.startCol).toBe(0);
      expect(resolved!.range.endRow).toBe(9);
      expect(resolved!.range.endCol).toBe(0);
    });

    it('解析不存在的名称返回 null', () => {
      expect(manager.resolve('NotExist')).toBeNull();
    });

    it('解析时名称不区分大小写', () => {
      manager.create('Sales', makeRange(0, 0, 9, 0));
      expect(manager.resolve('sales')).not.toBeNull();
      expect(manager.resolve('SALES')).not.toBeNull();
      expect(manager.resolve('SaLeS')).not.toBeNull();
    });
  });

  // ============================================================
  // 获取所有命名范围
  // ============================================================
  describe('getAll - 获取所有命名范围', () => {
    it('空管理器返回空数组', () => {
      expect(manager.getAll()).toEqual([]);
    });

    it('返回所有已创建的命名范围', () => {
      manager.create('Sales', makeRange(0, 0, 9, 0));
      manager.create('Costs', makeRange(0, 1, 9, 1));
      const all = manager.getAll();
      expect(all).toHaveLength(2);
      const names = all.map((r) => r.name);
      expect(names).toContain('Sales');
      expect(names).toContain('Costs');
    });

    it('删除后不再出现在列表中', () => {
      manager.create('Sales', makeRange(0, 0, 9, 0));
      manager.create('Costs', makeRange(0, 1, 9, 1));
      manager.delete('Sales');
      const all = manager.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('Costs');
    });
  });

  // ============================================================
  // 名称验证 (Requirement 9.5)
  // ============================================================
  describe('validateName - 名称验证', () => {
    it('合法名称：以字母开头', () => {
      expect(manager.validateName('Sales').valid).toBe(true);
    });

    it('合法名称：以下划线开头', () => {
      expect(manager.validateName('_data').valid).toBe(true);
    });

    it('合法名称：包含数字', () => {
      expect(manager.validateName('Data2024').valid).toBe(true);
    });

    it('合法名称：包含点号', () => {
      expect(manager.validateName('Sheet1.Range').valid).toBe(true);
    });

    it('合法名称：包含下划线', () => {
      expect(manager.validateName('my_range').valid).toBe(true);
    });

    it('非法名称：以数字开头', () => {
      const result = manager.validateName('1abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('非法名称：以特殊字符开头', () => {
      expect(manager.validateName('@name').valid).toBe(false);
      expect(manager.validateName('#name').valid).toBe(false);
      expect(manager.validateName('$name').valid).toBe(false);
    });

    it('非法名称：包含空格', () => {
      expect(manager.validateName('my range').valid).toBe(false);
    });

    it('非法名称：包含特殊字符', () => {
      expect(manager.validateName('name!').valid).toBe(false);
      expect(manager.validateName('name@').valid).toBe(false);
      expect(manager.validateName('name#').valid).toBe(false);
    });

    it('非法名称：空字符串', () => {
      expect(manager.validateName('').valid).toBe(false);
    });

    it('非法名称：仅空格', () => {
      expect(manager.validateName('   ').valid).toBe(false);
    });

    it('与单元格引用冲突：A1', () => {
      expect(manager.validateName('A1').valid).toBe(false);
    });

    it('与单元格引用冲突：B2', () => {
      expect(manager.validateName('B2').valid).toBe(false);
    });

    it('与单元格引用冲突：AA100', () => {
      expect(manager.validateName('AA100').valid).toBe(false);
    });

    it('与单元格引用冲突：XFD1048576', () => {
      expect(manager.validateName('XFD1048576').valid).toBe(false);
    });

    it('不与单元格引用冲突的类似名称：ABC（无数字）', () => {
      expect(manager.validateName('ABC').valid).toBe(true);
    });

    it('不与单元格引用冲突的类似名称：ABCD1（超过3个字母）', () => {
      expect(manager.validateName('ABCD1').valid).toBe(true);
    });

    it('保留字 TRUE 不合法', () => {
      expect(manager.validateName('TRUE').valid).toBe(false);
    });

    it('保留字 FALSE 不合法', () => {
      expect(manager.validateName('FALSE').valid).toBe(false);
    });

    it('保留字不区分大小写', () => {
      expect(manager.validateName('true').valid).toBe(false);
      expect(manager.validateName('True').valid).toBe(false);
      expect(manager.validateName('false').valid).toBe(false);
    });
  });

  // ============================================================
  // 行列变化自动调整 (Requirement 9.8)
  // ============================================================
  describe('adjustForRowColChange - 行列变化自动调整', () => {
    describe('插入行', () => {
      it('在范围之前插入行：范围整体下移', () => {
        manager.create('Data', makeRange(5, 0, 10, 3));
        manager.adjustForRowColChange('insertRow', 3);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startRow).toBe(6);
        expect(resolved!.range.endRow).toBe(11);
        // 列不变
        expect(resolved!.range.startCol).toBe(0);
        expect(resolved!.range.endCol).toBe(3);
      });

      it('在范围起始行插入行：范围整体下移', () => {
        manager.create('Data', makeRange(5, 0, 10, 3));
        manager.adjustForRowColChange('insertRow', 5);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startRow).toBe(6);
        expect(resolved!.range.endRow).toBe(11);
      });

      it('在范围中间插入行：endRow 下移，startRow 不变', () => {
        manager.create('Data', makeRange(5, 0, 10, 3));
        manager.adjustForRowColChange('insertRow', 7);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startRow).toBe(5);
        expect(resolved!.range.endRow).toBe(11);
      });

      it('在范围之后插入行：范围不变', () => {
        manager.create('Data', makeRange(5, 0, 10, 3));
        manager.adjustForRowColChange('insertRow', 15);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startRow).toBe(5);
        expect(resolved!.range.endRow).toBe(10);
      });
    });

    describe('删除行', () => {
      it('删除范围之前的行：范围整体上移', () => {
        manager.create('Data', makeRange(5, 0, 10, 3));
        manager.adjustForRowColChange('deleteRow', 2);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startRow).toBe(4);
        expect(resolved!.range.endRow).toBe(9);
      });

      it('删除范围中间的行：endRow 上移', () => {
        manager.create('Data', makeRange(5, 0, 10, 3));
        manager.adjustForRowColChange('deleteRow', 7);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startRow).toBe(5);
        expect(resolved!.range.endRow).toBe(9);
      });

      it('删除范围之后的行：范围不变', () => {
        manager.create('Data', makeRange(5, 0, 10, 3));
        manager.adjustForRowColChange('deleteRow', 15);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startRow).toBe(5);
        expect(resolved!.range.endRow).toBe(10);
      });

      it('删除单行范围所在行：移除该命名范围', () => {
        manager.create('SingleRow', makeRange(5, 0, 5, 3));
        manager.adjustForRowColChange('deleteRow', 5);
        expect(manager.resolve('SingleRow')).toBeNull();
      });
    });

    describe('插入列', () => {
      it('在范围之前插入列：范围整体右移', () => {
        manager.create('Data', makeRange(0, 5, 10, 10));
        manager.adjustForRowColChange('insertCol', 3);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startCol).toBe(6);
        expect(resolved!.range.endCol).toBe(11);
        // 行不变
        expect(resolved!.range.startRow).toBe(0);
        expect(resolved!.range.endRow).toBe(10);
      });

      it('在范围中间插入列：endCol 右移', () => {
        manager.create('Data', makeRange(0, 5, 10, 10));
        manager.adjustForRowColChange('insertCol', 7);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startCol).toBe(5);
        expect(resolved!.range.endCol).toBe(11);
      });

      it('在范围之后插入列：范围不变', () => {
        manager.create('Data', makeRange(0, 5, 10, 10));
        manager.adjustForRowColChange('insertCol', 15);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startCol).toBe(5);
        expect(resolved!.range.endCol).toBe(10);
      });
    });

    describe('删除列', () => {
      it('删除范围之前的列：范围整体左移', () => {
        manager.create('Data', makeRange(0, 5, 10, 10));
        manager.adjustForRowColChange('deleteCol', 2);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startCol).toBe(4);
        expect(resolved!.range.endCol).toBe(9);
      });

      it('删除范围中间的列：endCol 左移', () => {
        manager.create('Data', makeRange(0, 5, 10, 10));
        manager.adjustForRowColChange('deleteCol', 7);
        const resolved = manager.resolve('Data');
        expect(resolved!.range.startCol).toBe(5);
        expect(resolved!.range.endCol).toBe(9);
      });

      it('删除单列范围所在列：移除该命名范围', () => {
        manager.create('SingleCol', makeRange(0, 5, 10, 5));
        manager.adjustForRowColChange('deleteCol', 5);
        expect(manager.resolve('SingleCol')).toBeNull();
      });
    });

    describe('多个命名范围同时调整', () => {
      it('插入行时所有受影响的命名范围都被调整', () => {
        manager.create('Range1', makeRange(5, 0, 10, 3));
        manager.create('Range2', makeRange(8, 0, 15, 3));
        manager.create('Range3', makeRange(0, 0, 3, 3)); // 不受影响

        manager.adjustForRowColChange('insertRow', 6);

        const r1 = manager.resolve('Range1');
        expect(r1!.range.startRow).toBe(5);
        expect(r1!.range.endRow).toBe(11);

        const r2 = manager.resolve('Range2');
        expect(r2!.range.startRow).toBe(9);
        expect(r2!.range.endRow).toBe(16);

        const r3 = manager.resolve('Range3');
        expect(r3!.range.startRow).toBe(0);
        expect(r3!.range.endRow).toBe(3);
      });
    });
  });
});
