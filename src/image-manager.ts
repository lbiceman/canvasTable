// ============================================================
// 图片管理器
// 负责浮动图片的插入、删除、拖拽移动、等比缩放与 Canvas 渲染
// ============================================================

import type { FloatingImage } from './types';
import { HistoryManager } from './history-manager';
import { SpreadsheetRenderer } from './renderer';
import { Modal } from './modal';

/** 图片控制点类型：四角 */
export type ImageHandle = 'nw' | 'ne' | 'sw' | 'se';

/** 命中测试结果 */
interface HitTestResult {
  imageId: string;
  handle: ImageHandle | null;
}

/** 拖拽状态 */
interface DragState {
  imageId: string;
  handle: ImageHandle | null;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origWidth: number;
  origHeight: number;
}

/** 控制点尺寸（像素） */
const HANDLE_SIZE = 8;

/** 最大显示宽度 */
const MAX_WIDTH = 800;

/** 最大显示高度 */
const MAX_HEIGHT = 600;

/** 最大文件大小（5MB） */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** 允许的图片 MIME 类型 */
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

/**
 * 图片管理器
 * 管理浮动图片的生命周期：插入、删除、拖拽移动、等比缩放、Canvas 渲染、导入/导出
 */
export class ImageManager {
  private renderer: SpreadsheetRenderer;
  private historyManager: HistoryManager;

  /** 所有浮动图片 */
  private images: FloatingImage[] = [];

  /** 当前选中的图片 ID */
  private selectedImageId: string | null = null;

  /** 拖拽状态 */
  private dragState: DragState | null = null;

  /** 已加载的 HTMLImageElement 缓存（避免重复创建） */
  private imageCache: Map<string, HTMLImageElement> = new Map();

  constructor(renderer: SpreadsheetRenderer, historyManager: HistoryManager) {
    this.renderer = renderer;
    this.historyManager = historyManager;
  }

  // ============================================================
  // 图片插入
  // ============================================================

  /**
   * 打开文件选择对话框并插入图片
   * accept 限制 PNG/JPG/GIF/WebP，5MB 大小校验
   * @param anchorX 插入位置 X 坐标
   * @param anchorY 插入位置 Y 坐标
   */
  public insertImage(anchorX: number, anchorY: number): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPTED_TYPES;

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;

      // 文件大小校验
      if (file.size > MAX_FILE_SIZE) {
        Modal.alert('图片文件大小不能超过 5MB');
        return;
      }

      // 使用 FileReader 读取为 Base64 data URL
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;

        // 使用 Image 构造器获取原始尺寸
        const img = new Image();
        img.onload = () => {
          const originalWidth = img.naturalWidth;
          const originalHeight = img.naturalHeight;

          // 计算显示尺寸（限制最大 800×600，保持宽高比）
          const { width, height } = this.constrainSize(originalWidth, originalHeight);

          const id = this.addImage(base64Data, anchorX, anchorY, width, height, originalWidth, originalHeight);

          // 记录历史操作
          const image = this.images.find(i => i.id === id);
          if (image) {
            this.historyManager.record({
              type: 'insertImage',
              data: { image: { ...image } },
              undoData: { imageId: id }
            });
          }

          // 选中新插入的图片
          this.selectedImageId = id;

          // 重新渲染
          this.renderer.render();
        };

        img.onerror = () => {
          Modal.alert('图片读取失败');
        };

        img.src = base64Data;
      };

      reader.onerror = () => {
        Modal.alert('图片读取失败');
      };

      reader.readAsDataURL(file);
    });

    input.click();
  }

  // ============================================================
  // 图片增删
  // ============================================================

  /**
   * 添加图片到管理器
   * @returns 图片唯一 ID
   */
  public addImage(
    base64Data: string,
    x: number,
    y: number,
    width: number,
    height: number,
    originalWidth?: number,
    originalHeight?: number
  ): string {
    const id = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const image: FloatingImage = {
      id,
      base64Data,
      x,
      y,
      width,
      height,
      originalWidth: originalWidth ?? width,
      originalHeight: originalHeight ?? height
    };

    this.images.push(image);

    // 预加载到缓存
    this.loadImageToCache(image);

    return id;
  }

  /**
   * 删除图片
   */
  public deleteImage(id: string): void {
    const index = this.images.findIndex(img => img.id === id);
    if (index === -1) return;

    const image = { ...this.images[index] };
    this.images.splice(index, 1);

    // 清除缓存
    this.imageCache.delete(id);

    // 清除选中状态
    if (this.selectedImageId === id) {
      this.selectedImageId = null;
    }

    // 记录历史操作
    this.historyManager.record({
      type: 'deleteImage',
      data: { imageId: id },
      undoData: { image }
    });

    // 重新渲染
    this.renderer.render();
  }

  // ============================================================
  // 命中测试
  // ============================================================

  /**
   * 命中测试：检测点击位置是否在图片区域或四角控制点上
   * 从后往前遍历（后添加的图片在上层）
   */
  public hitTest(x: number, y: number): HitTestResult | null {
    for (let i = this.images.length - 1; i >= 0; i--) {
      const img = this.images[i];

      // 先检测四角控制点（仅选中状态下检测）
      if (this.selectedImageId === img.id) {
        const handle = this.hitTestHandles(img, x, y);
        if (handle) {
          return { imageId: img.id, handle };
        }
      }

      // 检测图片区域
      if (
        x >= img.x &&
        x <= img.x + img.width &&
        y >= img.y &&
        y <= img.y + img.height
      ) {
        return { imageId: img.id, handle: null };
      }
    }

    return null;
  }

  /**
   * 检测四角控制点命中
   */
  private hitTestHandles(img: FloatingImage, x: number, y: number): ImageHandle | null {
    const halfSize = HANDLE_SIZE / 2;

    // 四角控制点中心坐标
    const handles: Array<{ handle: ImageHandle; cx: number; cy: number }> = [
      { handle: 'nw', cx: img.x, cy: img.y },
      { handle: 'ne', cx: img.x + img.width, cy: img.y },
      { handle: 'sw', cx: img.x, cy: img.y + img.height },
      { handle: 'se', cx: img.x + img.width, cy: img.y + img.height }
    ];

    for (const { handle, cx, cy } of handles) {
      if (
        x >= cx - halfSize &&
        x <= cx + halfSize &&
        y >= cy - halfSize &&
        y <= cy + halfSize
      ) {
        return handle;
      }
    }

    return null;
  }

  // ============================================================
  // 鼠标拖拽交互（移动 + 等比缩放）
  // ============================================================

  /**
   * 处理鼠标按下
   * @returns 是否命中了图片（用于阻止事件冒泡）
   */
  public handleMouseDown(x: number, y: number): boolean {
    const hit = this.hitTest(x, y);

    if (!hit) {
      // 点击空白区域，取消选中
      this.selectedImageId = null;
      return false;
    }

    // 选中图片
    this.selectedImageId = hit.imageId;
    const img = this.images.find(i => i.id === hit.imageId);
    if (!img) return false;

    // 初始化拖拽状态
    this.dragState = {
      imageId: hit.imageId,
      handle: hit.handle,
      startX: x,
      startY: y,
      origX: img.x,
      origY: img.y,
      origWidth: img.width,
      origHeight: img.height
    };

    return true;
  }

  /**
   * 处理鼠标移动（拖拽中）
   */
  public handleMouseMove(x: number, y: number): void {
    if (!this.dragState) return;

    const img = this.images.find(i => i.id === this.dragState!.imageId);
    if (!img) return;

    const dx = x - this.dragState.startX;
    const dy = y - this.dragState.startY;

    if (this.dragState.handle === null) {
      // 拖拽移动
      img.x = this.dragState.origX + dx;
      img.y = this.dragState.origY + dy;
    } else {
      // 等比缩放
      this.handleResize(img, dx, dy);
    }

    // 重新渲染
    this.renderer.render();
  }

  /**
   * 处理鼠标释放
   */
  public handleMouseUp(): void {
    if (!this.dragState) return;

    const img = this.images.find(i => i.id === this.dragState!.imageId);
    if (!img) {
      this.dragState = null;
      return;
    }

    const state = this.dragState;

    // 检查是否有实际变化
    const moved = img.x !== state.origX || img.y !== state.origY;
    const resized = img.width !== state.origWidth || img.height !== state.origHeight;

    if (moved && state.handle === null) {
      // 记录移动历史
      this.historyManager.record({
        type: 'moveImage',
        data: { imageId: img.id, x: img.x, y: img.y },
        undoData: { imageId: img.id, x: state.origX, y: state.origY }
      });
    } else if (resized && state.handle !== null) {
      // 记录缩放历史
      this.historyManager.record({
        type: 'resizeImage',
        data: {
          imageId: img.id,
          x: img.x, y: img.y,
          width: img.width, height: img.height
        },
        undoData: {
          imageId: img.id,
          x: state.origX, y: state.origY,
          width: state.origWidth, height: state.origHeight
        }
      });
    }

    this.dragState = null;
  }

  /**
   * 等比缩放处理
   * 根据拖拽的控制点方向计算新尺寸，保持宽高比
   */
  private handleResize(img: FloatingImage, dx: number, _dy: number): void {
    const state = this.dragState!;
    const aspectRatio = img.originalWidth / img.originalHeight;

    let newWidth = state.origWidth;
    let newHeight = state.origHeight;
    let newX = state.origX;
    let newY = state.origY;

    switch (state.handle) {
      case 'se':
        // 右下角：宽高同时增大
        newWidth = Math.max(20, state.origWidth + dx);
        newHeight = newWidth / aspectRatio;
        break;
      case 'ne':
        // 右上角：宽增大，高从顶部调整
        newWidth = Math.max(20, state.origWidth + dx);
        newHeight = newWidth / aspectRatio;
        newY = state.origY + state.origHeight - newHeight;
        break;
      case 'sw':
        // 左下角：宽从左侧调整
        newWidth = Math.max(20, state.origWidth - dx);
        newHeight = newWidth / aspectRatio;
        newX = state.origX + state.origWidth - newWidth;
        break;
      case 'nw':
        // 左上角：宽高从左上角调整
        newWidth = Math.max(20, state.origWidth - dx);
        newHeight = newWidth / aspectRatio;
        newX = state.origX + state.origWidth - newWidth;
        newY = state.origY + state.origHeight - newHeight;
        break;
    }

    img.width = newWidth;
    img.height = newHeight;
    img.x = newX;
    img.y = newY;
  }

  // ============================================================
  // Canvas 渲染
  // ============================================================

  /**
   * 在 Canvas 上渲染所有浮动图片及选中状态的控制点
   * @param ctx Canvas 2D 上下文
   * @param scrollX 水平滚动偏移
   * @param scrollY 垂直滚动偏移
   */
  public renderAll(ctx: CanvasRenderingContext2D, scrollX: number, scrollY: number): void {
    for (const img of this.images) {
      const drawX = img.x - scrollX;
      const drawY = img.y - scrollY;

      // 从缓存获取 HTMLImageElement
      const cachedImg = this.imageCache.get(img.id);
      if (cachedImg && cachedImg.complete) {
        ctx.drawImage(cachedImg, drawX, drawY, img.width, img.height);
      } else {
        // 缓存未就绪，绘制占位矩形
        ctx.save();
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(drawX, drawY, img.width, img.height);
        ctx.setLineDash([]);
        ctx.restore();

        // 尝试加载
        this.loadImageToCache(img);
      }

      // 绘制选中状态的控制点
      if (this.selectedImageId === img.id) {
        this.renderHandles(ctx, drawX, drawY, img.width, img.height);
      }
    }
  }

  /**
   * 绘制四角控制点（8×8 像素白色方块 + 蓝色边框）
   */
  private renderHandles(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const halfSize = HANDLE_SIZE / 2;

    // 绘制选中边框
    ctx.save();
    ctx.strokeStyle = '#4a86c8';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, width, height);

    // 四角控制点
    const corners = [
      { cx: x, cy: y },                       // nw
      { cx: x + width, cy: y },               // ne
      { cx: x, cy: y + height },              // sw
      { cx: x + width, cy: y + height }       // se
    ];

    for (const { cx, cy } of corners) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - halfSize, cy - halfSize, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeStyle = '#4a86c8';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - halfSize, cy - halfSize, HANDLE_SIZE, HANDLE_SIZE);
    }

    ctx.restore();
  }

  // ============================================================
  // 导入 / 导出
  // ============================================================

  /**
   * 导出所有图片数据
   */
  public exportImages(): FloatingImage[] {
    return this.images.map(img => ({ ...img }));
  }

  /**
   * 导入图片数据（替换当前所有图片）
   */
  public importImages(images: FloatingImage[]): void {
    // 清除旧缓存
    this.imageCache.clear();
    this.selectedImageId = null;
    this.dragState = null;

    // 导入新数据
    this.images = images.map(img => ({ ...img }));

    // 预加载所有图片到缓存
    for (const img of this.images) {
      this.loadImageToCache(img);
    }
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 计算受限显示尺寸（最大 800×600，保持宽高比）
   */
  public constrainSize(originalWidth: number, originalHeight: number): { width: number; height: number } {
    let width = originalWidth;
    let height = originalHeight;

    if (width <= MAX_WIDTH && height <= MAX_HEIGHT) {
      return { width, height };
    }

    const widthRatio = MAX_WIDTH / width;
    const heightRatio = MAX_HEIGHT / height;
    const ratio = Math.min(widthRatio, heightRatio);

    width = width * ratio;
    height = height * ratio;

    return { width, height };
  }

  /**
   * 预加载图片到 HTMLImageElement 缓存
   */
  private loadImageToCache(img: FloatingImage): void {
    if (this.imageCache.has(img.id)) return;

    const htmlImg = new Image();
    htmlImg.src = img.base64Data;
    this.imageCache.set(img.id, htmlImg);
  }

  /**
   * 获取当前选中的图片 ID
   */
  public getSelectedImageId(): string | null {
    return this.selectedImageId;
  }

  /**
   * 设置选中的图片 ID
   */
  public setSelectedImageId(id: string | null): void {
    this.selectedImageId = id;
  }

  /**
   * 获取所有图片
   */
  public getImages(): FloatingImage[] {
    return this.images;
  }

  /**
   * 根据 ID 获取图片
   */
  public getImageById(id: string): FloatingImage | undefined {
    return this.images.find(img => img.id === id);
  }
}
