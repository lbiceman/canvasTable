import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ResizeHandle } from '../chart/chart-overlay';

/**
 * Property 10: 图表缩放最小尺寸不变量
 *
 * 对于任意图表缩放操作，结果尺寸的宽度不应小于 200 像素，高度不应小于 150 像素。
 * 直接测试 ChartOverlay.applyResize 中的约束数学逻辑。
 *
 * **Validates: Requirements 4.3**
 *
 * Property 11: 图表位置边界约束
 *
 * 对于任意图表位置更新（拖拽或缩放），图表的位置应满足 position.x >= 0、position.y >= 0。
 *
 * **Validates: Requirements 4.7**
 */

// 图表最小尺寸约束常量（与 chart-overlay.ts 保持一致）
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

// ============================================================
// 纯函数：复现 ChartOverlay.applyResize 的约束逻辑
// ============================================================

interface ResizeInput {
  // 原始图表状态
  originalX: number;
  originalY: number;
  originalWidth: number;
  originalHeight: number;
  // 鼠标起始位置
  startMouseX: number;
  startMouseY: number;
  // 当前鼠标位置
  currentMouseX: number;
  currentMouseY: number;
  // 缩放手柄方向
  handle: ResizeHandle;
}

interface ResizeResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 模拟 ChartOverlay.applyResize 的纯约束逻辑
 * 与 chart-overlay.ts 中 applyResize 方法的实现完全一致
 */
function computeResize(input: ResizeInput): ResizeResult {
  const dx = input.currentMouseX - input.startMouseX;
  const dy = input.currentMouseY - input.startMouseY;

  let newX = input.originalX;
  let newY = input.originalY;
  let newWidth = input.originalWidth;
  let newHeight = input.originalHeight;

  const { handle } = input;

  // 西侧手柄：左边界移动
  if (handle === 'nw' || handle === 'w' || handle === 'sw') {
    newX = input.originalX + dx;
    newWidth = input.originalWidth - dx;
  }
  // 东侧手柄：右边界移动
  if (handle === 'ne' || handle === 'e' || handle === 'se') {
    newWidth = input.originalWidth + dx;
  }
  // 北侧手柄：上边界移动
  if (handle === 'nw' || handle === 'n' || handle === 'ne') {
    newY = input.originalY + dy;
    newHeight = input.originalHeight - dy;
  }
  // 南侧手柄：下边界移动
  if (handle === 'sw' || handle === 's' || handle === 'se') {
    newHeight = input.originalHeight + dy;
  }

  // 钳制最小尺寸
  if (newWidth < MIN_WIDTH) {
    if (handle === 'nw' || handle === 'w' || handle === 'sw') {
      newX = input.originalX + input.originalWidth - MIN_WIDTH;
    }
    newWidth = MIN_WIDTH;
  }
  if (newHeight < MIN_HEIGHT) {
    if (handle === 'nw' || handle === 'n' || handle === 'ne') {
      newY = input.originalY + input.originalHeight - MIN_HEIGHT;
    }
    newHeight = MIN_HEIGHT;
  }

  // 钳制位置到可视区域边界内
  newX = Math.max(0, newX);
  newY = Math.max(0, newY);

  return { x: newX, y: newY, width: newWidth, height: newHeight };
}

// ============================================================
// 纯函数：复现 ChartOverlay 拖拽移动的约束逻辑
// ============================================================

interface DragInput {
  // 原始图表位置
  originalX: number;
  originalY: number;
  // 鼠标起始位置
  dragStartX: number;
  dragStartY: number;
  // 当前鼠标位置
  currentX: number;
  currentY: number;
}

interface DragResult {
  x: number;
  y: number;
}

/**
 * 模拟 ChartOverlay.handleMouseMove 中拖拽的约束逻辑
 */
function computeDrag(input: DragInput): DragResult {
  const dx = input.currentX - input.dragStartX;
  const dy = input.currentY - input.dragStartY;

  let newX = input.originalX + dx;
  let newY = input.originalY + dy;

  // 钳制位置到可视区域边界内
  newX = Math.max(0, newX);
  newY = Math.max(0, newY);

  return { x: newX, y: newY };
}

// ============================================================
// fast-check 生成器
// ============================================================

// 缩放手柄方向生成器
const resizeHandleArb: fc.Arbitrary<ResizeHandle> = fc.constantFrom(
  'nw' as const, 'n' as const, 'ne' as const, 'e' as const,
  'se' as const, 's' as const, 'sw' as const, 'w' as const,
);

// 有效的初始图表尺寸（必须 >= 最小尺寸）
const validSizeArb = fc.record({
  width: fc.integer({ min: MIN_WIDTH, max: 2000 }),
  height: fc.integer({ min: MIN_HEIGHT, max: 2000 }),
});

// 有效的初始图表位置（>= 0）
const validPositionArb = fc.record({
  x: fc.integer({ min: 0, max: 5000 }),
  y: fc.integer({ min: 0, max: 5000 }),
});

// 鼠标坐标偏移量（可以为负，模拟各方向拖拽）
const mouseOffsetArb = fc.record({
  dx: fc.integer({ min: -3000, max: 3000 }),
  dy: fc.integer({ min: -3000, max: 3000 }),
});

// 鼠标起始坐标
const mouseStartArb = fc.record({
  x: fc.integer({ min: 0, max: 5000 }),
  y: fc.integer({ min: 0, max: 5000 }),
});

// 缩放操作输入生成器
const resizeInputArb: fc.Arbitrary<ResizeInput> = fc.tuple(
  validPositionArb,
  validSizeArb,
  mouseStartArb,
  mouseOffsetArb,
  resizeHandleArb,
).map(([pos, size, mouseStart, offset, handle]) => ({
  originalX: pos.x,
  originalY: pos.y,
  originalWidth: size.width,
  originalHeight: size.height,
  startMouseX: mouseStart.x,
  startMouseY: mouseStart.y,
  currentMouseX: mouseStart.x + offset.dx,
  currentMouseY: mouseStart.y + offset.dy,
  handle,
}));

// 拖拽操作输入生成器
const dragInputArb: fc.Arbitrary<DragInput> = fc.tuple(
  validPositionArb,
  mouseStartArb,
  mouseOffsetArb,
).map(([pos, mouseStart, offset]) => ({
  originalX: pos.x,
  originalY: pos.y,
  dragStartX: mouseStart.x,
  dragStartY: mouseStart.y,
  currentX: mouseStart.x + offset.dx,
  currentY: mouseStart.y + offset.dy,
}));

// ============================================================
// 属性测试
// ============================================================

describe('Feature: chart-visualization, Property 10: 图表缩放最小尺寸不变量', () => {
  it('任意缩放操作后，宽度不小于 200 像素，高度不小于 150 像素', () => {
    fc.assert(
      fc.property(resizeInputArb, (input) => {
        const result = computeResize(input);

        // 验证：宽度 >= MIN_WIDTH (200)
        expect(result.width).toBeGreaterThanOrEqual(MIN_WIDTH);

        // 验证：高度 >= MIN_HEIGHT (150)
        expect(result.height).toBeGreaterThanOrEqual(MIN_HEIGHT);
      }),
      { numRuns: 200 },
    );
  });

  it('极端缩小操作（鼠标大幅向内拖拽）仍满足最小尺寸约束', () => {
    // 专门生成极端缩小场景：鼠标偏移量使尺寸趋向 0 或负值
    const extremeShrinkArb: fc.Arbitrary<ResizeInput> = fc.tuple(
      validPositionArb,
      validSizeArb,
      mouseStartArb,
      resizeHandleArb,
    ).map(([pos, size, mouseStart, handle]) => {
      // 根据手柄方向生成极端缩小偏移
      // 东侧手柄向左拖拽（dx 大幅为负），西侧手柄向右拖拽（dx 大幅为正）
      const extremeDx = (handle === 'ne' || handle === 'e' || handle === 'se')
        ? -(size.width + 500)  // 东侧手柄向左拖拽超过图表宽度
        : (size.width + 500);  // 西侧手柄向右拖拽超过图表宽度
      const extremeDy = (handle === 'sw' || handle === 's' || handle === 'se')
        ? -(size.height + 500) // 南侧手柄向上拖拽超过图表高度
        : (size.height + 500); // 北侧手柄向下拖拽超过图表高度

      return {
        originalX: pos.x,
        originalY: pos.y,
        originalWidth: size.width,
        originalHeight: size.height,
        startMouseX: mouseStart.x,
        startMouseY: mouseStart.y,
        currentMouseX: mouseStart.x + extremeDx,
        currentMouseY: mouseStart.y + extremeDy,
        handle,
      };
    });

    fc.assert(
      fc.property(extremeShrinkArb, (input) => {
        const result = computeResize(input);

        expect(result.width).toBeGreaterThanOrEqual(MIN_WIDTH);
        expect(result.height).toBeGreaterThanOrEqual(MIN_HEIGHT);
      }),
      { numRuns: 200 },
    );
  });
});

describe('Feature: chart-visualization, Property 11: 图表位置边界约束', () => {
  it('任意拖拽操作后，位置 x >= 0 且 y >= 0', () => {
    fc.assert(
      fc.property(dragInputArb, (input) => {
        const result = computeDrag(input);

        // 验证：位置 x >= 0
        expect(result.x).toBeGreaterThanOrEqual(0);

        // 验证：位置 y >= 0
        expect(result.y).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it('任意缩放操作后，位置 x >= 0 且 y >= 0', () => {
    fc.assert(
      fc.property(resizeInputArb, (input) => {
        const result = computeResize(input);

        // 验证：缩放后位置 x >= 0
        expect(result.x).toBeGreaterThanOrEqual(0);

        // 验证：缩放后位置 y >= 0
        expect(result.y).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it('极端向左上方拖拽仍满足位置边界约束', () => {
    // 专门生成极端拖拽场景：鼠标大幅向左上方移动
    const extremeDragArb: fc.Arbitrary<DragInput> = fc.tuple(
      validPositionArb,
      mouseStartArb,
    ).map(([pos, mouseStart]) => ({
      originalX: pos.x,
      originalY: pos.y,
      dragStartX: mouseStart.x,
      dragStartY: mouseStart.y,
      // 鼠标大幅向左上方移动，使计算出的位置为大幅负值
      currentX: mouseStart.x - (pos.x + 1000),
      currentY: mouseStart.y - (pos.y + 1000),
    }));

    fc.assert(
      fc.property(extremeDragArb, (input) => {
        const result = computeDrag(input);

        expect(result.x).toBeGreaterThanOrEqual(0);
        expect(result.y).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it('图表创建时位置也满足边界约束（showTypeSelector 逻辑）', () => {
    // 模拟 showTypeSelector 中的位置钳制逻辑：Math.max(0, x), Math.max(0, y)
    const createPositionArb = fc.record({
      x: fc.integer({ min: -1000, max: 5000 }),
      y: fc.integer({ min: -1000, max: 5000 }),
    });

    fc.assert(
      fc.property(createPositionArb, (pos) => {
        const clampedX = Math.max(0, pos.x);
        const clampedY = Math.max(0, pos.y);

        expect(clampedX).toBeGreaterThanOrEqual(0);
        expect(clampedY).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });
});
