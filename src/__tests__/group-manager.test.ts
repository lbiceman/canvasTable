import { describe, it, expect, beforeEach } from 'vitest';
import { GroupManager } from '../group-manager';

describe('GroupManager', () => {
  let manager: GroupManager;

  beforeEach(() => {
    manager = new GroupManager();
  });

  describe('createRowGroup', () => {
    it('创建行分组成功返回 true', () => {
      expect(manager.createRowGroup(2, 5)).toBe(true);
      const groups = manager.getRowGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0]).toEqual({
        type: 'row',
        start: 2,
        end: 5,
        level: 1,
        collapsed: false,
      });
    });

    it('重复创建相同范围的分组返回 false', () => {
      manager.createRowGroup(2, 5);
      expect(manager.createRowGroup(2, 5)).toBe(false);
      expect(manager.getRowGroups()).toHaveLength(1);
    });

    it('创建不重叠的多个分组', () => {
      manager.createRowGroup(0, 3);
      manager.createRowGroup(5, 8);
      const groups = manager.getRowGroups();
      expect(groups).toHaveLength(2);
      expect(groups[0].level).toBe(1);
      expect(groups[1].level).toBe(1);
    });
  });

  describe('createColGroup', () => {
    it('创建列分组成功返回 true', () => {
      expect(manager.createColGroup(1, 4)).toBe(true);
      const groups = manager.getColGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].type).toBe('col');
    });
  });

  describe('嵌套层级计算', () => {
    it('子分组层级为 2', () => {
      manager.createRowGroup(0, 10);  // 层级 1
      manager.createRowGroup(2, 5);   // 层级 2（被 0-10 包含）
      const groups = manager.getRowGroups();
      const parent = groups.find((g) => g.start === 0 && g.end === 10);
      const child = groups.find((g) => g.start === 2 && g.end === 5);
      expect(parent?.level).toBe(1);
      expect(child?.level).toBe(2);
    });

    it('三层嵌套层级正确', () => {
      manager.createRowGroup(0, 20);  // 层级 1
      manager.createRowGroup(2, 15);  // 层级 2
      manager.createRowGroup(5, 10);  // 层级 3
      const groups = manager.getRowGroups();
      expect(groups.find((g) => g.start === 0)?.level).toBe(1);
      expect(groups.find((g) => g.start === 2)?.level).toBe(2);
      expect(groups.find((g) => g.start === 5)?.level).toBe(3);
    });

    it('先创建子分组再创建父分组，层级自动调整', () => {
      manager.createRowGroup(2, 5);   // 先创建，初始层级 1
      manager.createRowGroup(0, 10);  // 后创建父分组
      const groups = manager.getRowGroups();
      const parent = groups.find((g) => g.start === 0);
      const child = groups.find((g) => g.start === 2);
      expect(parent?.level).toBe(1);
      expect(child?.level).toBe(2);
    });

    it('嵌套达到 8 级时仍可创建', () => {
      // 创建 8 层嵌套
      for (let i = 0; i < 8; i++) {
        expect(manager.createRowGroup(i, 20 - i)).toBe(true);
      }
      expect(manager.getMaxLevel('row')).toBe(8);
    });

    it('嵌套超过 8 级时拒绝创建', () => {
      // 创建 8 层嵌套
      for (let i = 0; i < 8; i++) {
        manager.createRowGroup(i, 20 - i);
      }
      // 第 9 层应被拒绝
      expect(manager.createRowGroup(8, 12)).toBe(false);
      expect(manager.getRowGroups()).toHaveLength(8);
    });
  });

  describe('removeGroup', () => {
    it('移除存在的分组返回 true', () => {
      manager.createRowGroup(2, 5);
      expect(manager.removeGroup('row', 2, 5)).toBe(true);
      expect(manager.getRowGroups()).toHaveLength(0);
    });

    it('移除不存在的分组返回 false', () => {
      expect(manager.removeGroup('row', 0, 5)).toBe(false);
    });

    it('移除父分组后子分组层级重新计算', () => {
      manager.createRowGroup(0, 20);  // 层级 1
      manager.createRowGroup(2, 15);  // 层级 2
      manager.createRowGroup(5, 10);  // 层级 3
      // 移除中间层
      manager.removeGroup('row', 2, 15);
      const groups = manager.getRowGroups();
      expect(groups.find((g) => g.start === 0)?.level).toBe(1);
      // 5-10 现在只被 0-20 包含，层级变为 2
      expect(groups.find((g) => g.start === 5)?.level).toBe(2);
    });
  });

  describe('collapseGroup / expandGroup', () => {
    it('折叠分组设置 collapsed 为 true', () => {
      manager.createRowGroup(2, 5);
      manager.collapseGroup('row', 2, 5);
      const groups = manager.getRowGroups();
      expect(groups[0].collapsed).toBe(true);
    });

    it('展开分组设置 collapsed 为 false', () => {
      manager.createRowGroup(2, 5);
      manager.collapseGroup('row', 2, 5);
      manager.expandGroup('row', 2, 5);
      const groups = manager.getRowGroups();
      expect(groups[0].collapsed).toBe(false);
    });

    it('折叠不存在的分组不报错', () => {
      expect(() => manager.collapseGroup('row', 0, 5)).not.toThrow();
    });

    it('展开不存在的分组不报错', () => {
      expect(() => manager.expandGroup('row', 0, 5)).not.toThrow();
    });
  });

  describe('getGroupsAt', () => {
    it('返回包含指定位置的所有分组', () => {
      manager.createRowGroup(0, 10);
      manager.createRowGroup(3, 7);
      const groups = manager.getGroupsAt('row', 5);
      expect(groups).toHaveLength(2);
    });

    it('位置不在任何分组内返回空数组', () => {
      manager.createRowGroup(0, 3);
      expect(manager.getGroupsAt('row', 5)).toHaveLength(0);
    });

    it('边界位置包含在分组内', () => {
      manager.createRowGroup(2, 5);
      expect(manager.getGroupsAt('row', 2)).toHaveLength(1);
      expect(manager.getGroupsAt('row', 5)).toHaveLength(1);
    });
  });

  describe('getMaxLevel', () => {
    it('无分组时返回 0', () => {
      expect(manager.getMaxLevel('row')).toBe(0);
      expect(manager.getMaxLevel('col')).toBe(0);
    });

    it('单个分组返回 1', () => {
      manager.createRowGroup(0, 5);
      expect(manager.getMaxLevel('row')).toBe(1);
    });

    it('嵌套分组返回最大层级', () => {
      manager.createRowGroup(0, 20);
      manager.createRowGroup(2, 15);
      manager.createRowGroup(5, 10);
      expect(manager.getMaxLevel('row')).toBe(3);
    });
  });

  describe('getRowGroups / getColGroups 返回副本', () => {
    it('修改返回值不影响内部状态', () => {
      manager.createRowGroup(0, 5);
      const groups = manager.getRowGroups();
      groups.pop();
      expect(manager.getRowGroups()).toHaveLength(1);
    });
  });

  describe('行分组和列分组独立', () => {
    it('行分组和列分组互不影响', () => {
      manager.createRowGroup(0, 5);
      manager.createColGroup(0, 3);
      expect(manager.getRowGroups()).toHaveLength(1);
      expect(manager.getColGroups()).toHaveLength(1);
      manager.removeGroup('row', 0, 5);
      expect(manager.getRowGroups()).toHaveLength(0);
      expect(manager.getColGroups()).toHaveLength(1);
    });
  });
});
