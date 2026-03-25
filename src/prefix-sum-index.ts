/**
 * PrefixSumIndex - 前缀和索引模块
 *
 * 维护行高/列宽的前缀和数组，提供 O(log n) 的坐标定位能力，
 * 替代原有 O(n) 逐行遍历的方式。
 *
 * 数据结构示例（行高场景）：
 *   sizes:      [25, 25, 30, 25, 25]
 *   prefixSums: [0, 25, 50, 80, 105, 130]
 *   prefixSums[i] = sizes[0] + sizes[1] + ... + sizes[i-1]（排除隐藏项）
 *
 * 需求：1.6
 */

export class PrefixSumIndex {
  /** 原始行高/列宽数组 */
  private sizes: number[];

  /** 前缀和数组，prefixSums[i] = 可见 sizes[0..i-1] 的累加和 */
  private prefixSums: number[];

  /** 隐藏行/列集合引用 */
  private hiddenSet: Set<number>;

  /** 是否需要重建前缀和 */
  private dirty: boolean;

  constructor(sizes: number[], hiddenSet: Set<number>) {
    this.sizes = sizes;
    this.hiddenSet = hiddenSet;
    this.prefixSums = [];
    this.dirty = true;
    this.rebuild();
  }

  /**
   * 重建前缀和数组（排除隐藏行/列）
   * 遍历 sizes 数组，跳过 hiddenSet 中的索引，构建累加前缀和
   */
  rebuild(): void {
    const { sizes, hiddenSet } = this;
    const len = sizes.length;
    // prefixSums 长度为 len + 1，prefixSums[0] = 0
    const prefixSums = new Array<number>(len + 1);
    prefixSums[0] = 0;

    for (let i = 0; i < len; i++) {
      // 隐藏项的尺寸视为 0
      const size = hiddenSet.has(i) ? 0 : sizes[i];
      prefixSums[i + 1] = prefixSums[i] + size;
    }

    this.prefixSums = prefixSums;
    this.dirty = false;
  }

  /**
   * 确保前缀和数组是最新的（惰性重建）
   */
  private ensureBuilt(): void {
    if (this.dirty) {
      this.rebuild();
    }
  }

  /**
   * 根据像素偏移量查找索引，O(log n) 二分查找
   *
   * 在前缀和数组中找到最大的 i 使得 prefixSums[i] <= offset，
   * 即该偏移量落在第 i 个元素的范围内。
   *
   * @param offset - 像素偏移量（从 0 开始）
   * @returns 对应的行/列索引
   */
  getIndexAtOffset(offset: number): number {
    this.ensureBuilt();

    const { prefixSums, sizes } = this;
    const len = sizes.length;

    // 边界处理：空数组
    if (len === 0) {
      return 0;
    }

    // 偏移量小于等于 0，返回第一个可见索引
    if (offset <= 0) {
      return 0;
    }

    const totalSize = prefixSums[len];

    // 偏移量超出总尺寸，返回最后一个索引
    if (offset >= totalSize) {
      return len - 1;
    }

    // 二分查找：找到最大的 i 使得 prefixSums[i] <= offset
    // 即 prefixSums[i] <= offset < prefixSums[i+1]
    let low = 0;
    let high = len;

    while (low < high) {
      const mid = (low + high + 1) >>> 1;
      if (prefixSums[mid] <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    return low;
  }

  /**
   * 获取指定索引的像素偏移量，O(1) 查找
   *
   * @param index - 行/列索引
   * @returns 该索引起始位置的像素偏移量
   */
  getOffsetAtIndex(index: number): number {
    this.ensureBuilt();

    // 边界处理
    if (index <= 0) {
      return 0;
    }
    if (index >= this.sizes.length) {
      return this.prefixSums[this.sizes.length];
    }

    return this.prefixSums[index];
  }

  /**
   * 获取总像素长度，O(1)
   *
   * @returns 所有可见元素的总尺寸
   */
  getTotalSize(): number {
    this.ensureBuilt();
    return this.prefixSums[this.sizes.length];
  }

  /**
   * 更新单个元素的尺寸，标记 dirty
   *
   * @param index - 要更新的索引
   * @param newSize - 新的尺寸值
   */
  update(index: number, newSize: number): void {
    if (index >= 0 && index < this.sizes.length) {
      this.sizes[index] = newSize;
      this.dirty = true;
    }
  }

  /**
   * 在指定位置插入元素
   *
   * @param index - 插入位置
   * @param count - 插入数量
   * @param defaultSize - 新元素的默认尺寸
   */
  insert(index: number, count: number, defaultSize: number): void {
    // 限制插入位置在有效范围内
    const insertAt = Math.max(0, Math.min(index, this.sizes.length));
    const newItems = new Array<number>(count).fill(defaultSize);
    this.sizes.splice(insertAt, 0, ...newItems);
    this.dirty = true;
  }

  /**
   * 删除指定位置的元素
   *
   * @param index - 删除起始位置
   * @param count - 删除数量
   */
  remove(index: number, count: number): void {
    if (index >= 0 && index < this.sizes.length) {
      const actualCount = Math.min(count, this.sizes.length - index);
      this.sizes.splice(index, actualCount);
      this.dirty = true;
    }
  }
}
