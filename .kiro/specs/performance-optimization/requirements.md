# 需求文档：性能与体验优化

## 简介

Canvas Excel (ice-excel) 是一个基于 HTML5 Canvas 的高性能电子表格应用。当前版本已实现虚拟滚动和基础渲染，但在大数据量场景（10万+行）、公式密集计算、频繁局部更新和高 DPI 屏幕显示等方面存在性能与体验瓶颈。本需求旨在通过大数据量优化、Web Worker 公式计算、增量渲染和高 DPI 适配四个方向，全面提升应用的性能表现和用户体验。

## 术语表

- **Renderer**：`SpreadsheetRenderer` 类，负责 Canvas 画布的视口管理与绘制调度
- **Model**：`SpreadsheetModel` 类，负责单元格数据存储、公式计算触发和数据变更管理
- **FormulaEngine**：`FormulaEngine` 类，负责公式解析、求值、依赖图管理和循环引用检测
- **Viewport**：视口，表示当前 Canvas 画布中可见的行列范围及滚动偏移量
- **Virtual_Scrolling**：虚拟滚动，仅渲染视口范围内的可见单元格，而非全量数据
- **Dirty_Region**：脏区域，数据变更后需要重新绘制的 Canvas 矩形区域
- **DPR**：Device Pixel Ratio，设备像素比，表示物理像素与 CSS 像素的比值
- **Worker_Thread**：Web Worker 线程，独立于主线程运行的后台计算线程
- **Offscreen_Buffer**：离屏缓冲区，用于预渲染内容的不可见 Canvas 画布
- **Batch_Recalculation**：批量重算，将多个公式计算请求合并为一次批量执行

## 需求

### 需求 1：大数据量滚动与渲染优化

**用户故事：** 作为一个处理大量数据的用户，我希望在加载 10 万行以上数据时仍能流畅滚动和操作，以便高效完成数据分析工作。

#### 验收标准

1. WHEN 用户加载包含 100,000 行数据的工作表, THE Renderer SHALL 在 2 秒内完成首屏渲染并显示可交互界面
2. WHILE 用户在包含 100,000 行数据的工作表中滚动, THE Renderer SHALL 保持每帧渲染时间不超过 16 毫秒（60fps）
3. WHEN 用户快速连续滚动（惯性滚动）, THE Renderer SHALL 跳过中间帧仅渲染最终目标位置，避免渲染积压
4. THE Model SHALL 采用按需加载策略，仅在视口接近数据边界时扩展行列数据，单次扩展不超过 500 行
5. WHEN 视口范围内存在合并单元格, THE Renderer SHALL 在渲染合并单元格时复用缓存的合并信息，避免重复计算合并区域
6. THE Renderer SHALL 使用行高累加前缀和数组进行 O(log n) 复杂度的行定位，替代逐行遍历
7. IF 渲染过程中检测到帧时间超过 16 毫秒, THEN THE Renderer SHALL 在控制台输出性能警告日志，包含帧耗时和当前视口行列范围

### 需求 2：Web Worker 公式计算

**用户故事：** 作为一个使用大量公式的用户，我希望公式计算不会导致界面卡顿，以便在等待计算结果时仍能继续编辑和浏览。

#### 验收标准

1. THE Worker_Thread SHALL 接收公式字符串、单元格位置和依赖数据作为输入，返回计算结果值
2. WHEN 用户编辑一个含有公式的单元格, THE FormulaEngine SHALL 将公式求值任务发送到 Worker_Thread 执行，主线程不执行公式求值逻辑
3. WHILE Worker_Thread 正在执行公式计算, THE Renderer SHALL 在对应单元格中显示加载指示符（如旋转图标或"计算中..."文本）
4. WHEN Worker_Thread 返回计算结果, THE Model SHALL 更新对应单元格的显示值并触发受影响区域的重新渲染
5. WHEN 多个单元格的公式需要重算, THE FormulaEngine SHALL 将这些公式合并为一次 Batch_Recalculation 发送到 Worker_Thread，减少消息传递开销
6. IF Worker_Thread 在 5 秒内未返回计算结果, THEN THE FormulaEngine SHALL 终止该 Worker_Thread 并在对应单元格显示超时错误提示
7. WHEN 用户在 Worker_Thread 计算期间再次编辑同一单元格, THE FormulaEngine SHALL 取消正在进行的计算任务并提交新的计算请求
8. THE Worker_Thread SHALL 支持 FormulaEngine 中已注册的全部公式函数，计算结果与主线程计算结果一致

### 需求 3：增量渲染

**用户故事：** 作为一个频繁编辑单元格的用户，我希望每次编辑后只有变化的区域被重新绘制，以便获得更快的视觉反馈。

#### 验收标准

1. WHEN 单个单元格内容发生变更, THE Renderer SHALL 仅重绘该单元格所在的 Dirty_Region，而非整个 Canvas 画布
2. WHEN 多个不相邻的单元格同时变更, THE Renderer SHALL 分别重绘各个 Dirty_Region，跳过未变更的区域
3. THE Renderer SHALL 维护一个脏区域队列，在下一个 requestAnimationFrame 回调中批量处理所有待重绘区域
4. WHEN 脏区域的总面积超过 Canvas 画布面积的 50%, THE Renderer SHALL 回退为全量重绘，避免多次局部重绘的开销超过全量重绘
5. WHEN 用户执行滚动操作, THE Renderer SHALL 使用全量重绘模式，增量渲染仅适用于非滚动场景下的数据变更
6. THE Renderer SHALL 在重绘 Dirty_Region 时使用 Canvas 的 clip() 方法限制绘制范围，确保不影响相邻单元格的显示
7. WHEN 单元格样式（字体颜色、背景色、边框）发生变更, THE Renderer SHALL 将该单元格标记为 Dirty_Region 并触发增量重绘
8. THE Renderer SHALL 在增量重绘时正确处理合并单元格，将整个合并区域作为一个 Dirty_Region 单元

### 需求 4：高 DPI 屏幕适配

**用户故事：** 作为一个使用 Retina 或高分辨率屏幕的用户，我希望电子表格中的文字和线条清晰锐利，以便获得与原生应用一致的显示质量。

#### 验收标准

1. THE Renderer SHALL 在初始化时读取 `window.devicePixelRatio` 值，并据此设置 Canvas 的物理像素尺寸（width/height 属性）为 CSS 尺寸乘以 DPR
2. THE Renderer SHALL 通过 CSS 样式将 Canvas 的显示尺寸保持为原始 CSS 尺寸，使物理像素与显示像素的比值等于 DPR
3. THE Renderer SHALL 在所有绘制操作前对 Canvas 上下文执行 `ctx.scale(dpr, dpr)` 变换，确保绘制坐标系与 CSS 坐标系一致
4. WHEN `window.devicePixelRatio` 值发生变化（如用户拖动窗口到不同 DPI 的显示器）, THE Renderer SHALL 重新计算 Canvas 尺寸并执行全量重绘
5. THE Renderer SHALL 确保网格线在高 DPI 屏幕上渲染为 1 物理像素宽度，避免出现模糊的亚像素渲染
6. THE Renderer SHALL 确保所有文本在高 DPI 屏幕上以设备原生分辨率渲染，字体边缘清晰无锯齿
7. WHEN Canvas 尺寸因窗口缩放而改变, THE Renderer SHALL 同步更新物理像素尺寸和 DPR 缩放变换，保持显示清晰度
