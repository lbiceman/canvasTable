/**
 * DPRManager - 高 DPI 屏幕适配管理器
 *
 * 根据 devicePixelRatio 动态调整 Canvas 物理尺寸和绘制缩放，
 * 确保文字和线条在高分辨率屏幕上清晰锐利。
 *
 * 职责：
 * - 读取并监听 DPR 变化
 * - 设置 Canvas 物理像素尺寸（width/height = CSS尺寸 × DPR）
 * - 通过 CSS 样式保持显示尺寸不变
 * - 对绘制上下文执行 ctx.scale(dpr, dpr) 变换
 * - 提供 1 物理像素宽度计算（用于网格线渲染）
 */

export class DPRManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentDPR: number;
  private cssWidth: number;
  private cssHeight: number;
  private mediaQuery: MediaQueryList | null;
  private onDPRChange: (() => void) | null;
  /** matchMedia 的 change 事件监听器引用，用于 dispose 时移除 */
  private mediaChangeHandler: (() => void) | null;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.currentDPR = this.sanitizeDPR(window.devicePixelRatio);
    this.cssWidth = canvas.clientWidth || canvas.width;
    this.cssHeight = canvas.clientHeight || canvas.height;
    this.mediaQuery = null;
    this.onDPRChange = null;
    this.mediaChangeHandler = null;
  }

  /**
   * 校验 DPR 值，异常时回退为 1
   * DPR 值 ≤0 或 NaN 时使用默认值 1
   */
  private sanitizeDPR(dpr: number): number {
    if (!Number.isFinite(dpr) || dpr <= 0) {
      return 1;
    }
    return dpr;
  }

  /** 获取当前设备像素比 */
  getDPR(): number {
    this.currentDPR = this.sanitizeDPR(window.devicePixelRatio);
    return this.currentDPR;
  }

  /**
   * 应用 DPR 缩放
   * - 设置 Canvas 的 width/height 为 Math.round(cssWidth * dpr) / Math.round(cssHeight * dpr)
   * - 设置 style.width/style.height 为 CSS 尺寸
   * - 执行 ctx.scale(dpr, dpr) 使绘制坐标系与 CSS 坐标系一致
   */
  applyScale(): void {
    const dpr = this.getDPR();

    // 设置 Canvas 物理像素尺寸
    this.canvas.width = Math.round(this.cssWidth * dpr);
    this.canvas.height = Math.round(this.cssHeight * dpr);

    // 通过 CSS 样式保持显示尺寸为原始 CSS 尺寸
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;

    // 对绘制上下文执行 DPR 缩放变换
    this.ctx.scale(dpr, dpr);
  }

  /**
   * 更新 CSS 尺寸（窗口缩放时调用）
   * 更新后需要调用 applyScale() 重新设置物理尺寸
   */
  updateSize(cssWidth: number, cssHeight: number): void {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
  }

  /**
   * 监听 DPR 变化事件
   * 使用 matchMedia 监听 devicePixelRatio 变化（如用户拖动窗口到不同 DPI 的显示器）
   * DPR 变化时自动更新内部状态并触发回调
   */
  onDPRChanged(callback: () => void): void {
    // 清理之前的监听器
    this.removeMediaListener();

    this.onDPRChange = callback;
    this.setupMediaListener();
  }

  /**
   * 设置 matchMedia 监听器
   * 每次 DPR 变化后需要重新创建 matchMedia 查询（因为查询条件包含具体 DPR 值）
   */
  private setupMediaListener(): void {
    const dpr = this.getDPR();
    const query = `(resolution: ${dpr}dppx)`;

    try {
      this.mediaQuery = window.matchMedia(query);
    } catch {
      // matchMedia 不可用时静默忽略
      this.mediaQuery = null;
      return;
    }

    this.mediaChangeHandler = () => {
      // DPR 已变化，更新内部状态
      this.currentDPR = this.sanitizeDPR(window.devicePixelRatio);

      // 触发用户回调
      if (this.onDPRChange) {
        this.onDPRChange();
      }

      // 重新设置监听器（新的 DPR 值需要新的 matchMedia 查询）
      this.removeMediaListener();
      this.setupMediaListener();
    };

    this.mediaQuery.addEventListener('change', this.mediaChangeHandler);
  }

  /** 移除当前 matchMedia 监听器 */
  private removeMediaListener(): void {
    if (this.mediaQuery && this.mediaChangeHandler) {
      this.mediaQuery.removeEventListener('change', this.mediaChangeHandler);
    }
    this.mediaQuery = null;
    this.mediaChangeHandler = null;
  }

  /**
   * 计算 1 物理像素对应的 CSS 像素值
   * 用于网格线渲染，确保在高 DPI 屏幕上渲染为恰好 1 物理像素宽度
   */
  getPhysicalPixel(): number {
    const dpr = this.getDPR();
    return 1 / dpr;
  }

  /** 销毁监听器，释放资源 */
  dispose(): void {
    this.removeMediaListener();
    this.onDPRChange = null;
  }
}
