// ============================================================
// 浮动图层管理器
// 管理浮动图片和形状的增删改查、层级管理、选中状态
// ============================================================

import type {
  FloatingObject,
  FloatingImage,
  FloatingShape,
  FloatingPosition,
  FloatingSize,
  FloatingLayerCallback,
  FloatingLayerEventType,
  ShapeType,
  HandleType,
} from './types';

/** 生成唯一ID */
function generateId(): string {
  return `float-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * 浮动图层管理器
 * 管理所有浮动对象的生命周期
 */
export class FloatingLayerManager {
  /** 浮动对象存储 */
  private objects: Map<string, FloatingObject> = new Map();
  /** 按 zIndex 排序的对象ID列表 */
  private zOrder: string[] = [];
  /** 当前选中的对象ID */
  private selectedId: string | null = null;
  /** 下一个 zIndex */
  private nextZIndex: number = 1;
  /** 事件回调 */
  private listeners: FloatingLayerCallback[] = [];

  /**
   * 添加浮动图片
   */
  public addImage(
    src: string,
    position: FloatingPosition,
    size: FloatingSize,
    alt?: string
  ): FloatingImage {
    const image: FloatingImage = {
      id: generateId(),
      type: 'image',
      position: { ...position },
      size: { ...size },
      rotation: 0,
      zIndex: this.nextZIndex++,
      locked: false,
      visible: true,
      opacity: 1,
      src,
      alt,
      keepAspectRatio: true,
    };

    this.objects.set(image.id, image);
    this.zOrder.push(image.id);
    this.emit('objectAdded', image.id);
    return image;
  }

  /**
   * 添加浮动形状
   */
  public addShape(
    shapeType: ShapeType,
    position: FloatingPosition,
    size: FloatingSize,
    options?: {
      fillColor?: string;
      strokeColor?: string;
      strokeWidth?: number;
      text?: string;
    }
  ): FloatingShape {
    const shape: FloatingShape = {
      id: generateId(),
      type: 'shape',
      position: { ...position },
      size: { ...size },
      rotation: 0,
      zIndex: this.nextZIndex++,
      locked: false,
      visible: true,
      opacity: 1,
      shapeType,
      fillColor: options?.fillColor ?? '#4A90D9',
      strokeColor: options?.strokeColor ?? '#2C5F8A',
      strokeWidth: options?.strokeWidth ?? 2,
      text: options?.text,
      textColor: '#FFFFFF',
      fontSize: 14,
    };

    this.objects.set(shape.id, shape);
    this.zOrder.push(shape.id);
    this.emit('objectAdded', shape.id);
    return shape;
  }

  /**
   * 删除浮动对象
   */
  public remove(id: string): boolean {
    if (!this.objects.has(id)) return false;

    this.objects.delete(id);
    this.zOrder = this.zOrder.filter(zId => zId !== id);

    if (this.selectedId === id) {
      this.selectedId = null;
      this.emit('selectionCleared');
    }

    this.emit('objectRemoved', id);
    return true;
  }

  /**
   * 移动浮动对象
   */
  public move(id: string, position: FloatingPosition): boolean {
    const obj = this.objects.get(id);
    if (!obj || obj.locked) return false;

    obj.position = { ...position };
    this.emit('objectMoved', id);
    return true;
  }

  /**
   * 调整浮动对象大小
   */
  public resize(id: string, size: FloatingSize, position?: FloatingPosition): boolean {
    const obj = this.objects.get(id);
    if (!obj || obj.locked) return false;

    obj.size = { ...size };
    if (position) {
      obj.position = { ...position };
    }
    this.emit('objectResized', id);
    return true;
  }

  /**
   * 选中浮动对象
   */
  public select(id: string | null): void {
    if (id === null) {
      this.selectedId = null;
      this.emit('selectionCleared');
      return;
    }

    if (this.objects.has(id)) {
      this.selectedId = id;
      this.emit('objectSelected', id);
    }
  }

  /**
   * 获取选中的对象
   */
  public getSelected(): FloatingObject | null {
    if (!this.selectedId) return null;
    return this.objects.get(this.selectedId) ?? null;
  }

  /**
   * 获取选中的对象ID
   */
  public getSelectedId(): string | null {
    return this.selectedId;
  }

  /**
   * 获取指定位置的浮动对象（从顶层开始检测）
   */
  public hitTest(x: number, y: number): FloatingObject | null {
    // 从 zOrder 末尾（最顶层）开始检测
    for (let i = this.zOrder.length - 1; i >= 0; i--) {
      const obj = this.objects.get(this.zOrder[i]);
      if (!obj || !obj.visible) continue;

      const { position, size } = obj;
      if (
        x >= position.x &&
        x <= position.x + size.width &&
        y >= position.y &&
        y <= position.y + size.height
      ) {
        return obj;
      }
    }
    return null;
  }

  /**
   * 检测拖拽手柄
   */
  public hitTestHandle(x: number, y: number, handleSize: number = 8): HandleType | null {
    const obj = this.getSelected();
    if (!obj) return null;

    const { position: pos, size } = obj;
    const hs = handleSize / 2;

    // 角点手柄
    const handles: Array<{ type: HandleType; cx: number; cy: number }> = [
      { type: 'topLeft', cx: pos.x, cy: pos.y },
      { type: 'topRight', cx: pos.x + size.width, cy: pos.y },
      { type: 'bottomLeft', cx: pos.x, cy: pos.y + size.height },
      { type: 'bottomRight', cx: pos.x + size.width, cy: pos.y + size.height },
      { type: 'top', cx: pos.x + size.width / 2, cy: pos.y },
      { type: 'bottom', cx: pos.x + size.width / 2, cy: pos.y + size.height },
      { type: 'left', cx: pos.x, cy: pos.y + size.height / 2 },
      { type: 'right', cx: pos.x + size.width, cy: pos.y + size.height / 2 },
    ];

    for (const handle of handles) {
      if (Math.abs(x - handle.cx) <= hs && Math.abs(y - handle.cy) <= hs) {
        return handle.type;
      }
    }

    return null;
  }

  // ============================================================
  // 层级管理
  // ============================================================

  /** 置顶 */
  public bringToFront(id: string): void {
    this.zOrder = this.zOrder.filter(zId => zId !== id);
    this.zOrder.push(id);
    this.updateZIndices();
  }

  /** 置底 */
  public sendToBack(id: string): void {
    this.zOrder = this.zOrder.filter(zId => zId !== id);
    this.zOrder.unshift(id);
    this.updateZIndices();
  }

  /** 上移一层 */
  public bringForward(id: string): void {
    const index = this.zOrder.indexOf(id);
    if (index < 0 || index >= this.zOrder.length - 1) return;
    [this.zOrder[index], this.zOrder[index + 1]] = [this.zOrder[index + 1], this.zOrder[index]];
    this.updateZIndices();
  }

  /** 下移一层 */
  public sendBackward(id: string): void {
    const index = this.zOrder.indexOf(id);
    if (index <= 0) return;
    [this.zOrder[index], this.zOrder[index - 1]] = [this.zOrder[index - 1], this.zOrder[index]];
    this.updateZIndices();
  }

  /** 更新所有对象的 zIndex */
  private updateZIndices(): void {
    for (let i = 0; i < this.zOrder.length; i++) {
      const obj = this.objects.get(this.zOrder[i]);
      if (obj) {
        obj.zIndex = i + 1;
      }
    }
  }

  // ============================================================
  // 查询方法
  // ============================================================

  /** 获取所有浮动对象（按 zIndex 排序） */
  public getAll(): FloatingObject[] {
    return this.zOrder
      .map(id => this.objects.get(id))
      .filter((obj): obj is FloatingObject => obj !== undefined);
  }

  /** 获取指定对象 */
  public get(id: string): FloatingObject | null {
    return this.objects.get(id) ?? null;
  }

  /** 获取对象数量 */
  public count(): number {
    return this.objects.size;
  }

  // ============================================================
  // 序列化
  // ============================================================

  /** 序列化为 JSON */
  public serialize(): FloatingObject[] {
    return this.getAll();
  }

  /** 从 JSON 恢复 */
  public deserialize(objects: FloatingObject[]): void {
    this.objects.clear();
    this.zOrder = [];
    this.selectedId = null;
    this.nextZIndex = 1;

    for (const obj of objects) {
      this.objects.set(obj.id, obj);
      this.zOrder.push(obj.id);
      if (obj.zIndex >= this.nextZIndex) {
        this.nextZIndex = obj.zIndex + 1;
      }
    }
  }

  // ============================================================
  // 事件
  // ============================================================

  public on(callback: FloatingLayerCallback): void {
    this.listeners.push(callback);
  }

  public off(callback: FloatingLayerCallback): void {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) this.listeners.splice(index, 1);
  }

  private emit(event: FloatingLayerEventType, objectId?: string): void {
    for (const listener of this.listeners) {
      listener(event, objectId);
    }
  }
}
