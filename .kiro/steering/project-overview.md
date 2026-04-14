# Canvas Excel (ice-excel) 项目介绍

## 产品定位
Canvas Excel 是一款基于 HTML5 Canvas 渲染的高性能浏览器端电子表格应用。零运行时框架依赖，使用纯 TypeScript + Canvas 2D API 实现，支持百万级单元格（1M 行 × 16K 列）的虚拟滚动渲染。

## 技术栈
- **语言**: TypeScript 5.x（strict 模式，ES2020 target）
- **构建**: Vite 6.x
- **渲染**: HTML5 Canvas 2D Context（非 DOM 渲染）
- **测试**: Vitest（单元测试）+ Playwright（E2E 测试）
- **运行时依赖**: exceljs（XLSX 导入导出）、jspdf（PDF 导出）
- **UI**: 无框架，纯 TypeScript DOM 操作

## 架构模式
MVC 分层架构：

| 层 | 类 | 文件 | 职责 |
|---|---|---|---|
| Model | `SpreadsheetModel` | `src/model.ts` (~5600行) | 数据存储、单元格操作、合并逻辑、公式计算、行列管理 |
| View | `SpreadsheetRenderer` | `src/renderer.ts` (~3900行) | Canvas 绘制、视口管理、虚拟滚动、增量渲染、冻结窗格 |
| Controller | `SpreadsheetApp` | `src/app.ts` (~8000行) | 事件处理、键盘快捷键、剪贴板、工具栏交互、模块协调 |

## 核心模块清单

### 数据层
- `src/model.ts` — 数据模型，稀疏网格存储（SparseGrid），前缀和索引定位
- `src/sparse-grid.ts` — 稀疏网格实现，空单元格不分配内存
- `src/prefix-sum-index.ts` — O(log n) 行高/列宽定位
- `src/history-manager.ts` — 撤销/重做操作栈
- `src/types.ts` — 全局类型定义（Cell、Selection、Viewport 等）

### 渲染层
- `src/renderer.ts` — Canvas 渲染引擎，支持增量渲染和冻结窗格
- `src/dirty-region-tracker.ts` — 脏区域追踪，增量重绘优化
- `src/dpr-manager.ts` — 高 DPI 屏幕适配
- `src/frozen-pane-cache.ts` — 冻结窗格 OffscreenCanvas 缓存

### 公式引擎
- `src/formula-engine.ts` — 公式引擎入口（单例）
- `src/formula/parser.ts` — 公式解析器
- `src/formula/tokenizer.ts` — 词法分析
- `src/formula/evaluator.ts` — 求值器
- `src/formula/dependency-graph.ts` — 依赖图（自动重算）
- `src/formula/circular-detector.ts` — 循环引用检测
- `src/formula/array-formula.ts` — 数组公式（CSE）
- `src/formula/named-range.ts` — 命名范围管理
- `src/formula/function-registry.ts` — 函数注册表
- `src/formula/functions/` — 函数库：
  - `math.ts` — 数学函数
  - `statistics.ts` — 统计函数
  - `text.ts` — 文本函数
  - `date.ts` — 日期函数
  - `logic.ts` — 逻辑函数
  - `lookup.ts` — 查找函数
  - `financial.ts` — 财务函数
- `src/formula-worker.ts` — Web Worker 公式计算线程
- `src/formula-worker-bridge.ts` — Worker 通信桥接（批量任务队列）

### 公式栏
- `src/formula-bar/formula-bar.ts` — 公式栏 UI
- `src/formula-bar/autocomplete.ts` — 函数自动补全
- `src/formula-bar/syntax-highlighter.ts` — 语法高亮

### 编辑与交互
- `src/inline-editor.ts` — 单元格内编辑器（浮动 input）
- `src/cell-context-menu.ts` — 单元格右键菜单
- `src/multi-selection.ts` — 多选区（Ctrl+点击）
- `src/fill-series.ts` — 填充序列（拖拽填充柄）
- `src/row-col-reorder.ts` — 行列拖拽重排序
- `src/format-painter.ts` — 格式刷
- `src/paste-special-dialog.ts` — 选择性粘贴对话框
- `src/dropdown-selector.ts` — 下拉选择器（数据验证）

### 格式化
- `src/format-engine.ts` — 数字/日期格式化引擎
- `src/format-dialog.ts` — 格式设置对话框
- `src/type-detector.ts` — 数据类型自动检测
- `src/conditional-format.ts` — 条件格式引擎（数据条、色阶、图标集）
- `src/style-presets.ts` — 快速样式预设
- `src/color-picker.ts` — 颜色选择器

### 数据处理
- `src/sort-filter/` — 排序筛选模块：
  - `sort-engine.ts` — 排序引擎（多级排序）
  - `filter-engine.ts` — 筛选引擎（高级筛选、正则）
  - `sort-dialog.ts` — 排序对话框 UI
  - `filter-dropdown.ts` — 筛选下拉面板
  - `sort-filter-model.ts` — 排序筛选数据模型
  - `column-header-indicator.ts` — 列头排序/筛选图标
- `src/text-to-columns.ts` — 数据分列
- `src/deduplication.ts` — 去重功能
- `src/validation.ts` — 数据验证引擎
- `src/validation-dialog.ts` — 验证规则对话框

### 图表与可视化
- `src/chart/` — 图表模块：
  - `chart-model.ts` — 图表数据模型
  - `chart-engine.ts` — 图表渲染引擎（柱状图、折线图、饼图等）
  - `chart-overlay.ts` — 图表浮动层（拖拽、缩放）
  - `chart-editor.ts` — 图表编辑面板
  - `sparkline-renderer.ts` — 迷你图渲染
  - `types.ts` — 图表类型定义

### 多工作表
- `src/sheet-manager.ts` — 工作表管理器（增删切换）
- `src/sheet-tab-bar.ts` — 工作表标签栏 UI
- `src/sheet-context-menu.ts` — 工作表右键菜单

### 协同编辑
- `src/collaboration/` — 协同模块：
  - `collaboration-engine.ts` — 协同引擎主控
  - `websocket-client.ts` — WebSocket 客户端
  - `ot.ts` — 操作转换（OT）算法
  - `ot-client.ts` — OT 客户端状态机
  - `operations.ts` — 操作序列化
  - `conflict-resolver.ts` — 冲突解决
  - `cursor-awareness.ts` — 远程光标感知
  - `offline-buffer.ts` — 离线操作缓冲
  - `types.ts` — 协同类型定义

### 导入导出
- `src/data-manager.ts` — JSON 导入导出、localStorage 持久化
- `src/print-export/` — 打印导出模块：
  - `xlsx-exporter.ts` — XLSX 导出
  - `xlsx-importer.ts` — XLSX 导入
  - `xlsx-stream-importer.ts` — XLSX 流式导入（大文件）
  - `csv-exporter.ts` — CSV 导出
  - `encoding-detector.ts` — 编码自动检测
  - `pdf-exporter.ts` — PDF 导出
  - `print-preview-dialog.ts` — 打印预览对话框
  - `print-area.ts` — 打印区域管理
  - `page-config.ts` — 页面配置
  - `header-footer.ts` — 页眉页脚

### 扩展模块
- `src/pivot-table/` — 数据透视表
- `src/plugin/` — 插件系统（plugin-manager + plugin-api）
- `src/script/` — 脚本引擎（script-engine + script-editor）
- `src/hyperlink-manager.ts` — 超链接管理
- `src/group-manager.ts` — 行列分组（折叠/展开）
- `src/version-history.ts` — 版本历史
- `src/permission-manager.ts` — 权限管理
- `src/search-dialog.ts` — 查找替换对话框

### UI 与主题
- `src/main.ts` — 应用入口，初始化协同
- `src/ui-controls.ts` — 设置面板、主题切换
- `src/themes.json` — 主题颜色定义（亮色/暗色）
- `src/style.css` — 全局样式、CSS 变量
- `src/modal.ts` — 通用模态框

### Java 后端（协同服务）
- `javaServer/` — Spring Boot WebSocket 服务端
  - OT 操作转换服务端
  - 房间管理、操作持久化
  - 企业版模块（权限、多租户）

## 全局访问点
- `window.app` — SpreadsheetApp 实例
- `window.uiControls` — UIControls 实例

## 常用命令
```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器（Vite，端口 3000）
npm run build        # TypeScript 编译 + Vite 生产构建
npm run preview      # 预览生产构建
npm run test:e2e     # 运行 Playwright E2E 测试
npm run test:e2e:ui  # Playwright UI 模式
```

## 关键设计决策
1. **Canvas 渲染而非 DOM** — 大数据量下 DOM 节点过多导致性能瓶颈，Canvas 虚拟滚动仅绘制可见区域
2. **稀疏网格存储** — SparseGrid + Proxy，空单元格不分配 Cell 对象，节省内存
3. **前缀和索引** — PrefixSumIndex 实现 O(log n) 的行列坐标定位，替代 O(n) 累加
4. **Web Worker 公式计算** — 复杂公式在 Worker 线程异步计算，不阻塞 UI 渲染
5. **增量渲染** — DirtyRegionTracker 追踪变更区域，仅重绘脏区域而非全量重绘
6. **冻结窗格缓存** — FrozenPaneCache 使用 OffscreenCanvas 缓存冻结区域，避免重复绘制
7. **OT 协同算法** — 基于操作转换的实时协同编辑，支持离线缓冲和冲突解决

## 数据流
```
用户操作 → SpreadsheetApp（事件处理）
  → SpreadsheetModel（数据变更 + 公式重算）
    → notifyCellDirty（脏区域标记）
  → SpreadsheetRenderer（Canvas 重绘）
    → DirtyRegionTracker（增量渲染判断）
    → render()（全量或增量重绘）
```

## 协同数据流
```
本地操作 → CollaborationEngine → OTClient → WebSocket → 服务端
服务端 → WebSocket → OTClient（操作转换）→ Model（应用远程操作）→ Renderer（重绘）
```
