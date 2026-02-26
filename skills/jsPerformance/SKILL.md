---
name: jsPerformance
description: JavaScript/TypeScript 性能优化规范，适用于 Canvas 渲染和大数据量场景
keywords: performance, optimization, canvas, typescript, loop
---

# JavaScript 性能优化规范

针对 ice-excel Canvas 电子表格应用的性能优化指南，重点关注渲染性能和大数据量处理。

## 适用场景

- 编写或优化循环和数组操作
- Canvas 绑制操作
- 处理大量单元格数据
- 缓存计算结果
- 优化热点代码路径

## 核心规则

### 1. 使用 Set/Map 进行 O(1) 查找

```typescript
// ❌ 差: O(n) 每次查找
const mergedCells = [[0,0], [1,1], [2,2]];
if (mergedCells.some(([r,c]) => r === row && c === col)) { ... }

// ✅ 好: O(1) 每次查找
const mergedCellSet = new Set(['0,0', '1,1', '2,2']);
if (mergedCellSet.has(`${row},${col}`)) { ... }
```

### 2. 构建索引 Map 避免重复查找

```typescript
// ❌ 差: O(n) 每次查找 = O(n*m) 总计
cells.forEach(cell => {
  const style = styles.find(s => s.id === cell.styleId);
});

// ✅ 好: O(1) 每次查找 = O(n+m) 总计
const styleById = new Map(styles.map(s => [s.id, s]));
cells.forEach(cell => {
  const style = styleById.get(cell.styleId);
});
```

### 3. 缓存属性访问

```typescript
// ❌ 差: 重复访问属性
for (let row = viewport.startRow; row <= viewport.endRow; row++) {
  for (let col = viewport.startCol; col <= viewport.endCol; col++) {
    // viewport 属性每次都要访问
  }
}

// ✅ 好: 缓存到局部变量
const { startRow, endRow, startCol, endCol } = viewport;
for (let row = startRow; row <= endRow; row++) {
  for (let col = startCol; col <= endCol; col++) {
    // 使用局部变量
  }
}
```

### 4. 提前退出

```typescript
// ❌ 差: 继续遍历即使已找到
function findCell(row: number, col: number): Cell | null {
  let result: Cell | null = null;
  cells.forEach(cell => {
    if (cell.row === row && cell.col === col) result = cell;
  });
  return result;
}

// ✅ 好: 找到立即返回
function findCell(row: number, col: number): Cell | null {
  for (const cell of cells) {
    if (cell.row === row && cell.col === col) return cell;
  }
  return null;
}
```

### 5. 合并多次迭代

```typescript
// ❌ 差: 3 次迭代
const visible = cells.filter(c => c.visible);
const merged = cells.filter(c => c.isMerged);
const hasContent = cells.filter(c => c.content);

// ✅ 好: 1 次迭代
const visible: Cell[] = [], merged: Cell[] = [], hasContent: Cell[] = [];
for (const cell of cells) {
  if (cell.visible) visible.push(cell);
  if (cell.isMerged) merged.push(cell);
  if (cell.content) hasContent.push(cell);
}
```

### 6. Canvas 批量绘制

```typescript
// ❌ 差: 每个单元格单独绘制
for (const cell of cells) {
  ctx.fillStyle = cell.bgColor;
  ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
}

// ✅ 好: 按颜色分组批量绘制
const cellsByColor = groupBy(cells, c => c.bgColor);
for (const [color, group] of cellsByColor) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const cell of group) {
    ctx.rect(cell.x, cell.y, cell.width, cell.height);
  }
  ctx.fill();
}
```

### 7. 避免布局抖动

```typescript
// ❌ 差: 读写交替导致重排
element.style.width = '100px';
const width = element.offsetWidth;  // 强制重排
element.style.height = '200px';

// ✅ 好: 先写后读
element.style.width = '100px';
element.style.height = '200px';
const { width, height } = element.getBoundingClientRect();
```

### 8. 缓存昂贵计算

```typescript
// ❌ 差: 每次调用都计算
function getCellPosition(row: number, col: number) {
  let y = 0;
  for (let i = 0; i < row; i++) y += rowHeights[i];
  // ...
}

// ✅ 好: 缓存累计值
const rowPositions: number[] = [];
let y = 0;
for (const height of rowHeights) {
  rowPositions.push(y);
  y += height;
}
function getCellPosition(row: number, col: number) {
  return { y: rowPositions[row], ... };
}
```

## Canvas 特定优化

### 只绘制可见区域
```typescript
// 只遍历 viewport 范围内的单元格
for (let row = viewport.startRow; row <= viewport.endRow; row++) {
  for (let col = viewport.startCol; col <= viewport.endCol; col++) {
    drawCell(row, col);
  }
}
```

### 使用 requestAnimationFrame
```typescript
// 避免在一帧内多次渲染
let renderPending = false;
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    render();
    renderPending = false;
  });
}
```

### 离屏 Canvas 缓存
```typescript
// 对于不常变化的内容，使用离屏 canvas 缓存
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d');
// 绑制到离屏 canvas...
// 然后一次性复制到主 canvas
ctx.drawImage(offscreen, 0, 0);
```
