import type { RowColumnGroup } from './types';

/**
 * 行列分组管理器
 * 负责行/列分组的创建、移除、折叠/展开及嵌套层级计算
 */
export class GroupManager {
  /** 行分组列表 */
  private rowGroups: RowColumnGroup[];
  /** 列分组列表 */
  private colGroups: RowColumnGroup[];
  /** 最大嵌套层级上限 */
  private static readonly MAX_LEVEL = 8;

  constructor() {
    this.rowGroups = [];
    this.colGroups = [];
  }

  /** 创建行分组 */
  public createRowGroup(startRow: number, endRow: number): boolean {
    return this.createGroup('row', startRow, endRow);
  }

  /** 创建列分组 */
  public createColGroup(startCol: number, endCol: number): boolean {
    return this.createGroup('col', startCol, endCol);
  }

  /** 移除分组 */
  public removeGroup(type: 'row' | 'col', start: number, end: number): boolean {
    const groups = this.getGroupList(type);
    const index = groups.findIndex(
      (g) => g.start === start && g.end === end
    );
    if (index === -1) {
      return false;
    }
    groups.splice(index, 1);
    // 移除后重新计算剩余分组的层级
    this.recalculateLevels(type);
    return true;
  }

  /** 折叠分组 */
  public collapseGroup(type: 'row' | 'col', start: number, end: number): void {
    const group = this.findGroup(type, start, end);
    if (group) {
      group.collapsed = true;
    }
  }

  /** 展开分组 */
  public expandGroup(type: 'row' | 'col', start: number, end: number): void {
    const group = this.findGroup(type, start, end);
    if (group) {
      group.collapsed = false;
    }
  }

  /** 获取指定位置的分组信息 */
  public getGroupsAt(type: 'row' | 'col', index: number): RowColumnGroup[] {
    const groups = this.getGroupList(type);
    return groups.filter((g) => g.start <= index && g.end >= index);
  }

  /** 获取最大嵌套层级 */
  public getMaxLevel(type: 'row' | 'col'): number {
    const groups = this.getGroupList(type);
    if (groups.length === 0) {
      return 0;
    }
    return Math.max(...groups.map((g) => g.level));
  }

  /** 获取所有行分组 */
  public getRowGroups(): RowColumnGroup[] {
    return [...this.rowGroups];
  }

  /** 获取所有列分组 */
  public getColGroups(): RowColumnGroup[] {
    return [...this.colGroups];
  }

  /**
   * 创建分组的内部实现
   * 计算嵌套层级，检查是否超过上限，检查是否重复
   */
  private createGroup(type: 'row' | 'col', start: number, end: number): boolean {
    const groups = this.getGroupList(type);

    // 检查是否已存在相同范围的分组
    const duplicate = groups.some((g) => g.start === start && g.end === end);
    if (duplicate) {
      return false;
    }

    // 计算新分组的层级：包含它的父分组数量 + 1
    const level = this.calculateLevel(groups, start, end);

    // 检查是否超过最大嵌套层级
    if (level > GroupManager.MAX_LEVEL) {
      return false;
    }

    // 添加新分组后，需要检查被新分组包含的子分组是否会超过上限
    // 先临时添加新分组，重新计算所有层级
    const newGroup: RowColumnGroup = {
      type,
      start,
      end,
      level,
      collapsed: false,
    };
    groups.push(newGroup);

    // 重新计算所有分组的层级
    this.recalculateLevels(type);

    // 检查是否有任何分组超过上限
    const maxLevel = this.getMaxLevel(type);
    if (maxLevel > GroupManager.MAX_LEVEL) {
      // 回滚：移除刚添加的分组
      const addedIndex = groups.findIndex(
        (g) => g.start === start && g.end === end
      );
      if (addedIndex !== -1) {
        groups.splice(addedIndex, 1);
      }
      // 恢复原有分组的层级
      this.recalculateLevels(type);
      return false;
    }

    return true;
  }

  /**
   * 计算新分组的层级
   * 层级 = 完全包含该分组的父分组数量 + 1
   */
  private calculateLevel(
    groups: RowColumnGroup[],
    start: number,
    end: number
  ): number {
    let parentCount = 0;
    for (const g of groups) {
      // 父分组完全包含新分组
      if (g.start <= start && g.end >= end && !(g.start === start && g.end === end)) {
        parentCount++;
      }
    }
    return parentCount + 1;
  }

  /**
   * 重新计算指定类型所有分组的层级
   */
  private recalculateLevels(type: 'row' | 'col'): void {
    const groups = this.getGroupList(type);
    for (const group of groups) {
      group.level = this.calculateLevel(groups, group.start, group.end);
    }
  }

  /**
   * 查找匹配的分组
   */
  private findGroup(
    type: 'row' | 'col',
    start: number,
    end: number
  ): RowColumnGroup | undefined {
    const groups = this.getGroupList(type);
    return groups.find((g) => g.start === start && g.end === end);
  }

  /**
   * 获取指定类型的分组列表引用
   */
  private getGroupList(type: 'row' | 'col'): RowColumnGroup[] {
    return type === 'row' ? this.rowGroups : this.colGroups;
  }
}
