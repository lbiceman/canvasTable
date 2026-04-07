/**
 * FrozenPaneCache - 冻结窗格离屏渲染缓存
 *
 * 使用 OffscreenCanvas 缓存冻结区域（冻结行、冻结列、交叉区域），
 * 避免每帧重绘冻结区域的单元格内容。
 *
 * 缓存策略：
 * - 冻结区域数据变更时标记缓存失效
 * - 下一帧渲染时重绘到 OffscreenCanvas
 * - 正常渲染时直接 drawImage 绘制缓存
 * - 不支持 OffscreenCanvas 的浏览器自动回退到每帧重绘
 *
 * 性能优化：P5 Canvas 离屏渲染
 */

/** 缓存条目：一个 OffscreenCanvas 及其有效性标记 */
interface CacheEntry {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  valid: boolean;
}

export class FrozenPaneCache {
  /** 冻结行区域缓存 */
  private frozenRowCache: CacheEntry | null = null;

  /** 冻结列区域缓存 */
  private frozenColCache: CacheEntry | null = null;

  /** 冻结交叉区域缓存（行+列交叉） */
  private frozenCornerCache: CacheEntry | null = null;

  /** 是否支持 OffscreenCanvas */
  private supported: boolean;

  /** DPR 缩放比例 */
  private dpr: number;

  constructor() {
    // 检测 OffscreenCanvas 支持
    this.supported = typeof OffscreenCanvas !== 'undefined';
    this.dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  }

  /** 是否支持离屏缓存 */
  get isSupported(): boolean {
    return this.supported;
  }

  /**
   * 获取或创建冻结行缓存
   * @param width - 缓存宽度（CSS 像素）
   * @param height - 缓存高度（CSS 像素）
   */
  getFrozenRowCache(width: number, height: number): CacheEntry | null {
    if (!this.supported) return null;
    this.frozenRowCache = this.ensureCache(this.frozenRowCache, width, height);
    return this.frozenRowCache;
  }

  /**
   * 获取或创建冻结列缓存
   */
  getFrozenColCache(width: number, height: number): CacheEntry | null {
    if (!this.supported) return null;
    this.frozenColCache = this.ensureCache(this.frozenColCache, width, height);
    return this.frozenColCache;
  }

  /**
   * 获取或创建冻结交叉区域缓存
   */
  getFrozenCornerCache(width: number, height: number): CacheEntry | null {
    if (!this.supported) return null;
    this.frozenCornerCache = this.ensureCache(this.frozenCornerCache, width, height);
    return this.frozenCornerCache;
  }

  /**
   * 标记所有缓存失效（数据变更时调用）
   */
  invalidateAll(): void {
    if (this.frozenRowCache) this.frozenRowCache.valid = false;
    if (this.frozenColCache) this.frozenColCache.valid = false;
    if (this.frozenCornerCache) this.frozenCornerCache.valid = false;
  }

  /**
   * 标记冻结行缓存失效
   */
  invalidateRow(): void {
    if (this.frozenRowCache) this.frozenRowCache.valid = false;
    if (this.frozenCornerCache) this.frozenCornerCache.valid = false;
  }

  /**
   * 标记冻结列缓存失效
   */
  invalidateCol(): void {
    if (this.frozenColCache) this.frozenColCache.valid = false;
    if (this.frozenCornerCache) this.frozenCornerCache.valid = false;
  }

  /**
   * 将缓存绘制到主 Canvas
   * @param ctx - 主 Canvas 的 2D 上下文
   * @param cache - 缓存条目
   * @param destX - 目标 X 坐标（CSS 像素）
   * @param destY - 目标 Y 坐标（CSS 像素）
   */
  drawToMain(
    ctx: CanvasRenderingContext2D,
    cache: CacheEntry,
    destX: number,
    destY: number
  ): void {
    // drawImage 使用 CSS 像素坐标（ctx 已经 scale(dpr, dpr)）
    ctx.drawImage(
      cache.canvas,
      0, 0, cache.canvas.width, cache.canvas.height,
      destX, destY, cache.width, cache.height
    );
  }

  /**
   * 销毁所有缓存，释放 OffscreenCanvas 资源
   */
  dispose(): void {
    this.frozenRowCache = null;
    this.frozenColCache = null;
    this.frozenCornerCache = null;
  }

  /**
   * 更新 DPR（设备像素比变化时调用）
   */
  updateDPR(dpr: number): void {
    if (this.dpr !== dpr) {
      this.dpr = dpr;
      // DPR 变化时所有缓存需要重建
      this.frozenRowCache = null;
      this.frozenColCache = null;
      this.frozenCornerCache = null;
    }
  }

  /**
   * 确保缓存存在且尺寸正确
   * 尺寸变化时重建 OffscreenCanvas
   */
  private ensureCache(
    existing: CacheEntry | null,
    width: number,
    height: number
  ): CacheEntry {
    // 尺寸匹配且缓存存在，直接返回
    if (existing && existing.width === width && existing.height === height) {
      return existing;
    }

    // 创建新的 OffscreenCanvas（物理像素尺寸）
    const physicalWidth = Math.ceil(width * this.dpr);
    const physicalHeight = Math.ceil(height * this.dpr);

    const canvas = new OffscreenCanvas(
      Math.max(1, physicalWidth),
      Math.max(1, physicalHeight)
    );
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

    // 应用 DPR 缩放，使绘制坐标使用 CSS 像素
    ctx.scale(this.dpr, this.dpr);

    return {
      canvas,
      ctx,
      width,
      height,
      valid: false, // 新建的缓存标记为无效，需要重绘
    };
  }
}
