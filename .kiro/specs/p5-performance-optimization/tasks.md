# P5 性能持续优化 — 任务列表

## 任务（按依赖关系排序）

### Task 1: 内存占用优化 — 稀疏存储改造
- [x] 1.1 新增 `src/sparse-grid.ts`，实现 SparseGrid 类（Map 存储 + Proxy 兼容 Cell[][] 接口）
- [x] 1.2 在 `src/model.ts` 中集成 SparseGrid，替代密集数组初始化
- [x] 1.3 修改 `getRowCount()`/`getColCount()` 基于行高/列宽数组长度
- [x] 1.4 修改 `expandRows()`/`expandCols()` 不预创建空 Cell 对象
- [x] 1.5 修改 `recalculateFormulas()` 使用 getRowCount/getColCount
- [x] 1.6 运行 getDiagnostics 验证类型正确性 ✅

### Task 2: 样式密集渲染优化
- [x] 2.1 新增 `renderCellBackgrounds()` 方法，按颜色分组批量绘制背景
- [x] 2.2 将背景色绘制从 renderCells 主循环中移除
- [x] 2.3 添加 font 字符串缓存，避免重复赋值 Canvas 上下文
- [x] 2.4 运行 getDiagnostics 验证 ✅

### Task 3: 公式 Worker 批量调度优化
- [x] 3.1 修改 `flushBatchQueue()` 按 BATCH_CHUNK_SIZE=20 分片发送
- [x] 3.2 新增 `sendBatchChunk()` 方法处理单个分片
- [x] 3.3 新增 `deduplicateDependencies()` 方法去除空值依赖
- [x] 3.4 保持超时、取消、回退机制不变
- [x] 3.5 运行 getDiagnostics 验证 ✅

### Task 4: Canvas 离屏渲染（冻结窗格缓存）
- [x] 4.1 新增 `src/frozen-pane-cache.ts`，实现 FrozenPaneCache 类
- [x] 4.2 实现 OffscreenCanvas 缓存管理（创建、失效、重绘）
- [x] 4.3 修改 `renderFrozenPanes()` 交叉区域使用缓存机制
- [x] 4.4 添加 OffscreenCanvas 不可用时的 fallback
- [x] 4.5 新增 `invalidateFrozenCache()` 公共方法
- [x] 4.6 运行 getDiagnostics 验证 ✅

### Task 5: 集成验证
- [x] 5.1 运行 `npx vite build` 确保编译通过 ✅
- [x] 5.2 更新 TODO.md 标记 P5 任务完成 ✅
