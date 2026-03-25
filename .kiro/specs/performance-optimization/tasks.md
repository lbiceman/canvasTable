# 实现计划：性能与体验优化

## 概述

基于设计文档，按模块逐步实现 5 个新组件（PrefixSumIndex、FormulaWorkerBridge、FormulaWorker、DirtyRegionTracker、DPRManager），并将它们集成到现有的 MVC 架构中。每个模块独立实现和测试，最后统一接线。

## 任务

- [x] 1. 实现 PrefixSumIndex 前缀和索引模块
  - [x] 1.1 创建 `src/prefix-sum-index.ts`，实现 PrefixSumIndex 类
    - 实现 `sizes`、`prefixSums`、`hiddenSet`、`dirty` 内部状态
    - 实现 `rebuild()` 方法：遍历 sizes 数组，排除 hiddenSet 中的索引，构建前缀和数组
    - 实现 `getIndexAtOffset(offset)` 方法：使用二分查找在前缀和数组中定位索引，O(log n) 复杂度
    - 实现 `getOffsetAtIndex(index)` 方法：O(1) 直接查表返回偏移量
    - 实现 `getTotalSize()` 方法：O(1) 返回前缀和数组末尾值
    - 实现 `update(index, newSize)` 方法：更新单个元素尺寸并标记 dirty
    - 实现 `insert(index, count, defaultSize)` 和 `remove(index, count)` 方法
    - _需求：1.6_

  - [ ]* 1.2 编写 PrefixSumIndex 属性测试
    - **属性 1：前缀和定位与逐行遍历结果一致**
    - 使用 fast-check 生成随机行高数组（正整数）、随机隐藏行集合、随机像素偏移量
    - 验证 `getIndexAtOffset(y)` 与逐行遍历的结果完全一致
    - 测试文件：`src/__tests__/prefix-sum-index.pbt.test.ts`
    - **验证需求：1.6**

  - [ ]* 1.3 编写 PrefixSumIndex 单元测试
    - 测试空数组、单元素、隐藏行/列、插入/删除后重建等边界情况
    - 测试文件：`src/__tests__/prefix-sum-index.test.ts`
    - _需求：1.6_

- [x] 2. 将 PrefixSumIndex 集成到 SpreadsheetModel
  - [x] 2.1 在 `src/model.ts` 中集成 PrefixSumIndex
    - 在 SpreadsheetModel 构造函数中创建行高和列宽的 PrefixSumIndex 实例
    - 重构 `getRowAtY()`、`getColAtX()`、`getRowY()`、`getColX()`、`getTotalHeight()`、`getTotalWidth()` 方法，委托给 PrefixSumIndex
    - 在 `setRowHeight()`、`setColWidth()`、`expandRows()`、`expandCols()`、`insertRows()`、`insertColumns()`、`deleteRows()`、`deleteColumns()` 中同步更新 PrefixSumIndex
    - _需求：1.6, 1.4_

  - [ ]* 2.2 编写按需加载行数限制属性测试
    - **属性 2：按需加载单次扩展行数不超过 500**
    - 使用 fast-check 生成随机当前行数和随机视口位置
    - 验证扩展后 `newRowCount - N <= 500`
    - 测试文件：`src/__tests__/expand-rows.pbt.test.ts`
    - **验证需求：1.4**

- [x] 3. 实现惯性滚动跳帧与帧时间监控
  - [x] 3.1 在 `src/renderer.ts` 中添加帧时间监控和跳帧机制
    - 在 `render()` 方法中添加 `performance.now()` 计时，帧时间超过 16ms 时输出 `console.warn` 性能警告（包含帧耗时和视口行列范围）
    - 添加惯性滚动跳帧逻辑：快速连续滚动时使用 `requestAnimationFrame` 合并，仅渲染最终目标位置
    - _需求：1.2, 1.3, 1.7_

- [x] 4. 检查点 - 确保大数据量优化模块测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 5. 实现 DPRManager 高 DPI 适配模块
  - [x] 5.1 创建 `src/dpr-manager.ts`，实现 DPRManager 类
    - 实现 `currentDPR`、`cssWidth`、`cssHeight` 内部状态
    - 实现 `getDPR()` 方法：返回当前 `window.devicePixelRatio`
    - 实现 `applyScale()` 方法：设置 Canvas 的 `width`/`height` 为 `Math.round(cssWidth * dpr)` / `Math.round(cssHeight * dpr)`，设置 `style.width`/`style.height` 为 CSS 尺寸，执行 `ctx.scale(dpr, dpr)`
    - 实现 `updateSize(cssWidth, cssHeight)` 方法：窗口缩放时更新尺寸
    - 实现 `onDPRChanged(callback)` 方法：使用 `matchMedia` 监听 DPR 变化
    - 实现 `getPhysicalPixel()` 方法：返回 `1 / dpr`
    - 实现 `dispose()` 方法：清理监听器
    - DPR 值异常（≤0 或 NaN）时回退使用 DPR=1
    - _需求：4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

  - [ ]* 5.2 编写 DPR 尺寸计算属性测试
    - **属性 7：DPR 尺寸计算正确性**
    - 使用 fast-check 生成随机 DPR (0.5~4) 和随机 CSS 尺寸
    - 验证 Canvas `width` = `Math.round(cssWidth * dpr)`，`style.width` = `cssWidth + 'px'`
    - 测试文件：`src/__tests__/dpr-manager.pbt.test.ts`
    - **验证需求：4.1, 4.2, 4.7**

  - [ ]* 5.3 编写网格线物理像素宽度属性测试
    - **属性 8：网格线物理像素宽度**
    - 使用 fast-check 生成随机 DPR (0.5~4)
    - 验证网格线 `ctx.lineWidth` = `1 / dpr`
    - 测试文件：`src/__tests__/dpr-manager.pbt.test.ts`（追加到同一文件）
    - **验证需求：4.5**

  - [ ]* 5.4 编写 DPRManager 单元测试
    - 测试 DPR=1/2/3、DPR 变化事件、窗口缩放、异常 DPR 回退
    - 测试文件：`src/__tests__/dpr-manager.test.ts`
    - _需求：4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 6. 将 DPRManager 集成到 SpreadsheetRenderer
  - [x] 6.1 在 `src/renderer.ts` 中集成 DPRManager
    - 在 SpreadsheetRenderer 构造函数中创建 DPRManager 实例
    - 替换现有的 Canvas 尺寸设置逻辑，使用 `DPRManager.applyScale()` 设置物理像素尺寸和 DPR 缩放
    - 在 `render()` 中绘制网格线时使用 `dprManager.getPhysicalPixel()` 设置 lineWidth，确保 1 物理像素宽度
    - 注册 DPR 变化回调，DPR 变化时重新计算 Canvas 尺寸并全量重绘
    - 在窗口 resize 事件中调用 `dprManager.updateSize()` 同步更新
    - 确保所有文本以设备原生分辨率渲染，字体边缘清晰
    - _需求：4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 7. 检查点 - 确保高 DPI 适配模块测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 8. 实现 DirtyRegionTracker 增量渲染模块
  - [x] 8.1 创建 `src/dirty-region-tracker.ts`，实现 DirtyRegionTracker 类
    - 实现 `dirtyRects` 队列、`isScrolling` 状态、`canvasArea` 面积
    - 实现 `markDirty(row, col, x, y, width, height)` 方法：将单元格标记为脏区域
    - 实现 `markMergedDirty(startRow, startCol, x, y, width, height)` 方法：将整个合并区域标记为脏区域
    - 实现 `setScrolling(scrolling)` 方法：设置滚动状态
    - 实现 `shouldFullRedraw()` 方法：脏区域总面积 > 50% Canvas 面积或处于滚动状态时返回 true
    - 实现 `flush()` 方法：获取并清空脏区域队列
    - 实现 `scheduleRedraw(callback)` 方法：使用 `requestAnimationFrame` 调度重绘
    - 实现 `updateCanvasSize(width, height)` 方法：更新 Canvas 尺寸
    - _需求：3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 8.2 编写全量重绘判断属性测试
    - **属性 5：全量重绘判断正确性**
    - 使用 fast-check 生成随机脏区域矩形集合、随机 Canvas 尺寸、随机滚动状态
    - 验证 `shouldFullRedraw()` 在脏区域面积 > 50% 或滚动状态时返回 true，否则返回 false
    - 测试文件：`src/__tests__/dirty-region-tracker.pbt.test.ts`
    - **验证需求：3.4, 3.5**

  - [ ]* 8.3 编写脏区域标记属性测试
    - **属性 6：脏区域标记正确性**
    - 使用 fast-check 生成随机单元格变更和随机合并单元格配置
    - 验证变更后 DirtyRegionTracker 中存在覆盖该单元格的脏区域矩形
    - 测试文件：`src/__tests__/dirty-region-tracker.pbt.test.ts`（追加到同一文件）
    - **验证需求：3.7, 3.8**

  - [ ]* 8.4 编写 DirtyRegionTracker 单元测试
    - 测试空队列、单区域、多区域、面积阈值边界等情况
    - 测试文件：`src/__tests__/dirty-region-tracker.test.ts`
    - _需求：3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 9. 将 DirtyRegionTracker 集成到渲染流程
  - [x] 9.1 在 `src/renderer.ts` 中集成 DirtyRegionTracker
    - 在 SpreadsheetRenderer 构造函数中创建 DirtyRegionTracker 实例
    - 添加 `renderDirtyRegions()` 方法：使用 `ctx.save()`/`ctx.clip()`/`ctx.restore()` 限制绘制范围到脏区域
    - 修改 `render()` 方法：检查 DirtyRegionTracker 状态，非滚动场景下优先使用增量重绘，滚动时使用全量重绘
    - 当 `shouldFullRedraw()` 返回 true 时回退为全量重绘
    - _需求：3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 9.2 在 `src/model.ts` 中添加脏区域通知机制
    - 在 `setCellContent()`、样式变更方法中通知 DirtyRegionTracker 标记脏区域
    - 合并单元格变更时调用 `markMergedDirty()` 标记整个合并区域
    - 通过回调或事件机制将 Model 层的变更通知传递到 Renderer 层的 DirtyRegionTracker
    - _需求：3.7, 3.8_

- [x] 10. 检查点 - 确保增量渲染模块测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 11. 实现 FormulaWorker 和 FormulaWorkerBridge
  - [x] 11.1 创建 `src/formula-worker.ts`，实现 Worker 线程入口
    - 监听 `self.onmessage` 事件，接收 `WorkerRequest` 消息
    - 复用 FormulaEngine 的解析和求值逻辑（纯计算部分），使用 dependencies 提供的单元格数据
    - 遍历 `formulas` 数组逐个求值，返回 `WorkerResponse`（包含 row、col、value、error）
    - 支持 FormulaEngine 中已注册的全部公式函数
    - _需求：2.1, 2.8_

  - [x] 11.2 创建 `src/formula-worker-bridge.ts`，实现 FormulaWorkerBridge 类
    - 实现 Worker 实例管理：创建、终止、重建
    - 实现 `pendingTasks` Map 管理待处理任务（id → resolve/reject/timer）
    - 实现 `evaluate(formula, row, col, dependencies)` 方法：提交单个公式计算任务
    - 实现 `enqueueForBatch(formula, row, col, dependencies)` 方法：将公式加入批量队列，使用微任务（`queueMicrotask`）合并发送
    - 实现 `cancelTask(row, col)` 方法：取消指定单元格的待处理任务
    - 实现 5 秒超时控制：超时后终止 Worker，在对应单元格显示 `#TIMEOUT!`，自动重建新 Worker
    - 实现 `resetWorker()` 方法：终止并重建 Worker（超时恢复）
    - 实现 `dispose()` 方法：销毁 Worker
    - Worker 创建失败时回退到主线程同步计算
    - _需求：2.1, 2.2, 2.5, 2.6, 2.7_

  - [ ]* 11.3 编写 Worker 计算一致性属性测试
    - **属性 3：Worker 计算结果与主线程一致**
    - 使用 fast-check 生成随机简单公式和随机依赖数据
    - 验证 FormulaWorker 的计算结果与 FormulaEngine.evaluate() 一致
    - 测试文件：`src/__tests__/formula-worker.pbt.test.ts`
    - **验证需求：2.1, 2.8**

  - [ ]* 11.4 编写 Worker 结果回写属性测试
    - **属性 4：Worker 结果回写往返正确性**
    - 使用 fast-check 生成随机单元格位置和随机计算结果
    - 验证 Bridge 接收 Worker 响应后 Model 中对应单元格值正确更新
    - 测试文件：`src/__tests__/formula-worker-bridge.pbt.test.ts`
    - **验证需求：2.4**

  - [ ]* 11.5 编写 FormulaWorkerBridge 单元测试
    - 测试超时处理、任务取消、Worker 重建、批量合并等场景
    - 测试文件：`src/__tests__/formula-worker-bridge.test.ts`
    - _需求：2.5, 2.6, 2.7_

- [x] 12. 将 Web Worker 公式计算集成到 Model 层
  - [x] 12.1 在 `src/model.ts` 中集成 FormulaWorkerBridge
    - 在 SpreadsheetModel 中创建 FormulaWorkerBridge 实例
    - 修改 `setCellContent()` 中的公式处理逻辑：将公式求值任务通过 `enqueueForBatch()` 发送到 Worker
    - 公式发送到 Worker 后，在单元格设置 `isComputing: true`，Renderer 显示"计算中..."加载指示符
    - Worker 返回结果后更新单元格值、清除 `isComputing` 标记，触发脏区域重绘
    - 用户在 Worker 计算期间再次编辑同一单元格时，调用 `cancelTask()` 取消旧任务
    - 修改 `recalculateFormulas()` 使用批量重算
    - _需求：2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 12.2 在 `src/renderer.ts` 中添加"计算中..."加载指示符渲染
    - 在 `renderCells()` 中检查单元格 `isComputing` 标记
    - 为正在计算的单元格显示"计算中..."文本或旋转图标
    - _需求：2.3_

- [x] 13. 扩展 Cell 类型定义
  - [x] 13.1 在 `src/types.ts` 中扩展 Cell 接口
    - 添加 `isComputing?: boolean` 字段，标记公式正在 Worker 中计算
    - _需求：2.3_

- [x] 14. 最终检查点 - 确保所有模块测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 15. E2E 端到端测试
  - [x] 15.1 创建 `e2e/performance-large-data.spec.ts`，大数据量渲染与滚动 E2E 测试
    - 测试加载 100,000 行数据后页面可交互（首屏渲染完成）
    - 测试大数据量下滚动操作流畅（滚动到底部、快速连续滚动不卡死）
    - 测试滚动后单元格内容正确显示（视口内数据与预期一致）
    - 测试行列插入/删除后前缀和索引正确更新（插入行后滚动定位正确）
    - _需求：1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 15.2 创建 `e2e/performance-worker-formula.spec.ts`，Web Worker 公式计算 E2E 测试
    - 测试输入公式后单元格显示"计算中..."加载指示符，随后显示正确结果
    - 测试批量公式（多个单元格同时含公式）计算结果正确
    - 测试编辑含公式单元格时旧计算被取消、新结果正确显示
    - 测试公式计算超时场景（如有可能模拟）显示 `#TIMEOUT!` 错误
    - _需求：2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 15.3 创建 `e2e/performance-incremental-render.spec.ts`，增量渲染 E2E 测试
    - 测试编辑单个单元格后页面正确更新（内容变更可见）
    - 测试编辑多个不相邻单元格后所有变更正确显示
    - 测试合并单元格内容变更后整个合并区域正确重绘
    - 测试样式变更（背景色、字体颜色、边框）后单元格正确更新
    - 测试滚动后再编辑单元格，增量渲染与全量渲染切换正常
    - _需求：3.1, 3.2, 3.7, 3.8_

  - [x] 15.4 创建 `e2e/performance-hidpi.spec.ts`，高 DPI 适配 E2E 测试
    - 测试页面加载后 Canvas 元素的物理尺寸与 CSS 尺寸比值等于 DPR
    - 测试窗口缩放后 Canvas 尺寸正确更新
    - 测试网格线和文本在页面上正常渲染（无明显模糊或错位）
    - _需求：4.1, 4.2, 4.3, 4.7_

- [x] 16. 浏览器 MCP 测试（使用 Chrome DevTools MCP 进行可视化验证）
  - [x] 16.1 大数据量渲染浏览器验证
    - 使用 Chrome DevTools MCP 打开应用页面
    - 通过 `evaluate_script` 注入 100,000 行测试数据
    - 使用 `take_screenshot` 截图验证首屏渲染正确
    - 使用 `performance_start_trace` 录制滚动性能 trace，验证帧时间
    - 使用 `list_console_messages` 检查是否有性能警告日志输出
    - _需求：1.1, 1.2, 1.7_

  - [x] 16.2 高 DPI 适配浏览器验证
    - 使用 `emulate` 设置不同 DPR（如 2x、3x）的设备视口
    - 使用 `evaluate_script` 检查 Canvas 的 `width`/`height` 属性与 CSS 尺寸的比值是否等于 DPR
    - 使用 `take_screenshot` 截图对比不同 DPR 下的渲染清晰度
    - _需求：4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 16.3 增量渲染浏览器验证
    - 使用 Chrome DevTools MCP 打开应用页面
    - 通过 `click` 和 `fill` 编辑单元格内容
    - 使用 `take_screenshot` 截图验证编辑后单元格正确更新
    - 通过 `evaluate_script` 检查 DirtyRegionTracker 的脏区域队列状态
    - _需求：3.1, 3.2, 3.7_

  - [x] 16.4 Web Worker 公式计算浏览器验证
    - 使用 Chrome DevTools MCP 打开应用页面
    - 通过 `click` 和 `fill` 输入公式（如 `=SUM(A1:A100)`）
    - 使用 `take_snapshot` 验证"计算中..."加载指示符出现
    - 等待计算完成后使用 `take_snapshot` 验证结果正确显示
    - 使用 `list_console_messages` 检查是否有 Worker 相关错误日志
    - _需求：2.2, 2.3, 2.4_

- [x] 17. 提交代码
  - [x] 17.1 提交所有性能优化代码
    - 使用 `git add` 添加所有新增和修改的文件
    - 使用 `git commit` 提交，提交信息：`feat: 性能与体验优化 - 大数据量优化、Web Worker 公式计算、增量渲染、高 DPI 适配`
    - _覆盖全部需求：1.1-1.7, 2.1-2.8, 3.1-3.8, 4.1-4.7_

## 说明

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保可追溯性
- 检查点任务确保增量验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界条件
