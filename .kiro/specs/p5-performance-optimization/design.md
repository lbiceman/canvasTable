# P5 性能持续优化 — 设计文档

## 技术方案

### 1. 样式密集渲染优化

**问题分析**：当前 `renderCells()` 逐个单元格设置 `ctx.font`、`ctx.fillStyle`、`ctx.textAlign` 等属性，每次属性切换都有 Canvas 上下文状态切换开销。450 个全样式单元格时，状态切换次数 = 单元格数 × 属性数。

**方案**：在 `renderCells()` 中引入样式分组批量绘制机制：
1. 第一遍遍历：收集可见单元格信息，按 `fontKey`（font + color + align 组合）分组
2. 第二遍遍历：按分组批量绘制，每组只设置一次 `ctx.font`/`ctx.fillStyle`/`ctx.textAlign`
3. 背景色单独一遍绘制（先绘制所有背景，再绘制所有文本）

**修改文件**：`src/renderer.ts`
- 新增 `renderCellsBatched()` 方法替代当前 `renderCells()` 中的逐单元格绘制逻辑
- 保留原有 `renderCells()` 作为入口，内部调用批量绘制

### 2. 公式 Worker 批量调度优化

**问题分析**：当前 `flushBatchQueue()` 将所有公式合并为一次 `postMessage`，但每次 `enqueueForBatch` 都通过 `queueMicrotask` 调度，且没有分片机制。大量公式时单次消息体过大，序列化/反序列化开销高。

**方案**：
1. 将批量队列按固定大小（BATCH_CHUNK_SIZE = 20）分片发送
2. 每个分片独立 `postMessage`，Worker 端并行处理
3. 减少单次消息的序列化开销，同时保持批量合并的优势
4. 优化 dependencies 数据：去重共享依赖，减少传输数据量

**修改文件**：`src/formula-worker-bridge.ts`
- 修改 `flushBatchQueue()` 方法，增加分片逻辑
- 新增 `deduplicateDependencies()` 方法去重共享依赖

### 3. 内存占用优化（稀疏存储）

**问题分析**：当前 `SpreadsheetModel` 使用 `Cell[][]` 密集二维数组，初始化 1000 行 × 100 列 = 10 万个 Cell 对象，每个空 Cell 包含 `content: '', rowSpan: 1, colSpan: 1, isMerged: false` 四个属性。10 万行时创建 1000 万个对象。

**方案**：
1. 将 `data.cells: Cell[][]` 改为 `data.cells: Map<string, Cell>`，key 为 `"row-col"` 格式
2. 提供 `DEFAULT_CELL` 常量作为空单元格的默认返回值（冻结对象，不可修改）
3. `getCell()` 返回 `Map.get(key) ?? DEFAULT_CELL`
4. `setCellContent()` 等写入方法在首次写入时创建 Cell 对象并存入 Map
5. 行高/列宽数组保持不变（它们是密集的，且数据量小）
6. `expandRows()`/`expandCols()` 不再预创建空 Cell 对象，只扩展行高/列宽数组

**修改文件**：`src/model.ts`
- 修改 `SpreadsheetData.cells` 类型为 `Map<string, Cell>`
- 修改 `getCell()`、`setCellContent()`、`expandRows()`、`expandCols()` 等方法
- 新增 `DEFAULT_CELL` 常量
- 修改 `getRowCount()`/`getColCount()` 基于行高/列宽数组长度

**修改文件**：`src/types.ts`
- 修改 `SpreadsheetData.cells` 类型定义

### 4. Canvas 离屏渲染（冻结窗格缓存）

**问题分析**：当前 `renderFrozenPanes()` 每帧都重新绘制冻结区域的所有单元格，即使冻结区域数据未变化。

**方案**：
1. 新增 `FrozenPaneCache` 类管理三个 OffscreenCanvas：冻结行、冻结列、交叉区域
2. 冻结区域数据变更时标记缓存失效，下一帧重绘到 OffscreenCanvas
3. 正常渲染时直接 `ctx.drawImage(offscreenCanvas, ...)` 绘制缓存
4. 滚动时：冻结行缓存水平偏移随 scrollX 变化，冻结列缓存垂直偏移随 scrollY 变化

**新增文件**：`src/frozen-pane-cache.ts`
- `FrozenPaneCache` 类：管理 OffscreenCanvas 缓存的创建、失效、重绘

**修改文件**：`src/renderer.ts`
- 修改 `renderFrozenPanes()` 使用缓存机制
- 在数据变更时调用缓存失效方法

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/renderer.ts` | 修改 | 样式分组批量绘制 + 冻结窗格缓存集成 |
| `src/model.ts` | 修改 | 稀疏存储改造 |
| `src/types.ts` | 修改 | SpreadsheetData.cells 类型变更 |
| `src/formula-worker-bridge.ts` | 修改 | 批量分片调度优化 |
| `src/frozen-pane-cache.ts` | 新增 | 冻结窗格 OffscreenCanvas 缓存管理 |

## 风险与缓解

1. **稀疏存储兼容性**：大量代码通过 `data.cells[row][col]` 直接访问，需要全面排查并替换为 `getCell()`/`getOrCreateCell()`
2. **OffscreenCanvas 兼容性**：部分旧浏览器不支持 OffscreenCanvas，需要 fallback 到当前实现
3. **样式分组内存开销**：分组需要临时数组存储单元格信息，需控制内存分配
