// ============================================================
// 浮动图层类型定义
// ============================================================

/** 浮动对象类型 */
export type FloatingObjectType = 'image' | 'shape';

/** 形状类型 */
export type ShapeType = 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'triangle';

/** 浮动对象位置 */
export interface FloatingPosition {
  x: number;
  y: number;
}

/** 浮动对象尺寸 */
export interface FloatingSize {
  width: number;
  height: number;
}

/** 浮动对象基础属性 */
export interface FloatingObjectBase {
  id: string;
  type: FloatingObjectType;
  position: FloatingPosition;
  size: FloatingSize;
  rotation: number;       // 旋转角度（度）
  zIndex: number;         // 层级
  locked: boolean;        // 是否锁定
  visible: boolean;       // 是否可见
  opacity: number;        // 不透明度 0-1
}

/** 浮动图片 */
export interface FloatingImage extends FloatingObjectBase {
  type: 'image';
  src: string;            // 图片数据 URL 或外部 URL
  alt?: string;           // 替代文本
  keepAspectRatio: boolean; // 保持宽高比
}

/** 浮动形状 */
export interface FloatingShape extends FloatingObjectBase {
  type: 'shape';
  shapeType: ShapeType;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  text?: string;          // 形状内文字
  textColor?: string;
  fontSize?: number;
}

/** 浮动对象联合类型 */
export type FloatingObject = FloatingImage | FloatingShape;

/** 拖拽手柄类型 */
export type HandleType =
  | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'  // 角点
  | 'top' | 'bottom' | 'left' | 'right'                    // 边缘中点
  | 'rotate';                                                // 旋转

/** 浮动图层事件 */
export type FloatingLayerEventType =
  | 'objectAdded'
  | 'objectRemoved'
  | 'objectMoved'
  | 'objectResized'
  | 'objectSelected'
  | 'selectionCleared';

export type FloatingLayerCallback = (event: FloatingLayerEventType, objectId?: string) => void;
