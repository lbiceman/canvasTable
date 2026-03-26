# Canvas Excel

基于 HTML5 Canvas 的高性能浏览器电子表格，零运行时依赖，支持百万行级数据流畅滚动、60+ 公式函数、实时协同编辑、图表可视化和插件扩展。

## 性能基准

> 测试环境：Chrome 浏览器，数据通过 `window.app` API 注入，计时使用 `performance.now()`

| 数据规模 | 数据注入 | 单帧渲染 | 滚动到底部 | 随机滚动（平均） |
|---------|---------|---------|-----------|----------------|
| 10 万行 × 100 列 | 353ms | 5.4ms | 2.9ms | ~3ms |
| 50 万行 × 100 列 | 1.3s | 2.2ms | 11.7ms | 2.6ms |
| **100 万行 × 100 列** | 3.3s | 12.8ms | 1.2ms | **3.5ms** |
| 1,000 列 | 28ms | 2.9ms | — | 2.7ms |
| 5,000 列 | 157ms | 3.6ms | — | 4.3ms |
| **16,384 列**（Excel 上限） | 523ms | 1.6ms | — | **4.0ms** |
| 10 万行 × 1,000 列 | 5.2s | 5.7ms | — | 3.4ms |

单帧渲染始终低于 16ms（60fps 阈值），所有场景下滚动流畅无卡顿。

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器（端口 3000）
npm run build    # 生产构建
```

## 核心功能

### 公式引擎

支持 60+ 函数，公式计算在 Web Worker 中异步执行，不阻塞 UI：

- 数学：SUM、AVERAGE、MAX、MIN、ABS、ROUND、CEILING、FLOOR、MOD、POWER、SQRT
- 统计：COUNT、COUNTA、COUNTIF、COUNTIFS、SUMIF、SUMIFS、AVERAGEIF
- 文本：LEFT、RIGHT、MID、LEN、TRIM、UPPER、LOWER、CONCATENATE、SUBSTITUTE、FIND、SEARCH、TEXT
- 逻辑：IF、AND、OR、NOT、IFERROR、IFS、SWITCH
- 查找：VLOOKUP、HLOOKUP、INDEX、MATCH、OFFSET、INDIRECT
- 日期：TODAY、NOW、DATE、YEAR、MONTH、DAY、DATEDIF、EDATE、EOMONTH
- 数组公式（Ctrl+Shift+Enter）、命名范围、跨 Sheet 引用（`Sheet2!A1`）、循环引用检测
- 公式栏语法高亮、自动补全、函数参数提示

### 数据格式化

- 数字格式：货币、百分比、千分位、科学计数法、自定义格式（`#,##0.00`）
- 日期/时间：日期选择器、多种日期格式（yyyy-MM-dd 等）
- 条件格式：根据值自动变色、数据条、色阶、图标集
- 数据验证：下拉列表、数值范围、自定义规则、输入提示
- 自动类型识别：输入时自动识别数字、日期、百分比

### 多工作表

- 底部 Sheet 标签栏：新增、删除、重命名、复制
- 拖拽排序、隐藏/显示、颜色标记
- 跨 Sheet 公式引用与计算

### 图表与可视化

- 5 种图表类型：柱状图、折线图、饼图、散点图、面积图
- 图表编辑器：标题、图例、坐标轴、数据标签配置
- 数据联动：源数据变化时图表自动更新
- 迷你图（Sparkline）：单元格内嵌小型图表
- 拖拽移动/缩放、协同同步

### 排序与筛选

- 单列/多列排序（自定义优先级）
- 自动筛选：文本/数字/日期条件
- 高级筛选：AND/OR 组合条件
- 筛选状态指示：列头高亮、可见行数显示

### 协同编辑

- WebSocket 实时协同（Java 后端）
- OT 算法冲突处理
- 多用户光标感知、在线用户列表

### 打印与导出

- 打印预览：分页预览、纸张/方向/边距设置、页眉页脚
- XLSX 导入/导出（兼容 Microsoft Excel）
- CSV 导出
- JSON 导入/导出（完整格式 + 简化格式）
- LocalStorage 本地持久化

### 扩展功能

- 数据透视表：拖拽字段配置行/列/值/筛选，5 种聚合方式
- 脚本编辑器：用户自定义脚本，语法高亮，执行结果可撤销
- 插件系统：注册/卸载插件，API 白名单控制，工具栏/菜单扩展点
- 超链接：插入/编辑/移除，URL 自动补全，Ctrl+点击打开
- 浮动图片：插入/拖拽移动/等比缩放/删除，5MB 大小限制
- 格式刷：单次模式（单击）/ 锁定模式（双击），Escape 退出
- 右键菜单：剪切/复制/粘贴/选择性粘贴/插入行列/删除行列/格式刷/清除格式/排序/筛选
- 下拉选择器：单元格内嵌下拉控件，键盘导航
- 行列拖拽重排序：拖拽行号/列号移动整行/整列

### 编辑能力

- 单元格合并/拆分
- 多选区（Ctrl+点击）、整行/整列选择、Ctrl+A 全选
- 填充柄自动填充（数字/日期递增、自定义序列）
- 选择性粘贴（值/格式/公式/转置）
- 冻结行/列（冻结窗格）
- 隐藏行/列、分组折叠
- 查找与替换
- 完整撤销/重做栈

### 样式

- 字体：族选择（宋体、微软雅黑、Arial 等）、大小、颜色
- 格式：加粗、斜体、下划线、删除线
- 对齐：水平/垂直对齐、自动换行
- 背景色、边框（8 种位置 × 4 种线型 × 自定义颜色）
- 亮色/暗色主题切换

## 键盘快捷键

| 操作 | 快捷键 |
|------|--------|
| 移动选择 | ↑ ↓ ← → |
| 扩展选区 | Shift + 方向键 |
| 切换单元格 | Tab / Shift+Tab |
| 编辑单元格 | F2 / 双击 |
| 复制 | Ctrl+C |
| 剪切 | Ctrl+X |
| 粘贴 | Ctrl+V |
| 撤销 | Ctrl+Z |
| 重做 | Ctrl+Y |
| 查找 | Ctrl+F |
| 全选 | Ctrl+A |
| 加粗 | Ctrl+B |
| 斜体 | Ctrl+I |
| 下划线 | Ctrl+U |
| 删除内容 | Delete / Backspace |
| 水平滚动 | Shift + 滚轮 |

## 性能架构

| 模块 | 作用 |
|------|------|
| PrefixSumIndex | 前缀和索引，O(log n) 二分查找定位行列，替代 O(n) 遍历 |
| FormulaWorkerBridge | Web Worker 公式计算桥接，批量合并发送，5 秒超时自动重建 |
| DirtyRegionTracker | 脏区域追踪，编辑时仅重绘变化区域，滚动时自动回退全量重绘 |
| DPRManager | 高 DPI 适配，Canvas 物理像素缩放，1 物理像素网格线 |

## API

应用实例暴露在 `window.app`：

```javascript
// 单元格操作
app.getModel().setCellContent(0, 0, '内容')
app.getModel().mergeCells(0, 0, 1, 1)

// 数据导入导出
app.exportToFile('data.json')
app.importFromURL('/example-data.json')

// 插件注册
app.getPluginManager().registerPlugin({
  name: 'my-plugin',
  version: '1.0.0',
  activate(api) {
    api.addToolbarButton({ label: '按钮', onClick: () => {} })
  }
})
```

## 技术栈

- TypeScript（strict 模式，ES2020）
- Vite 6.x
- HTML5 Canvas API
- Web Worker
- 零运行时依赖

## 项目结构

```
src/
├── main.ts                # 应用入口
├── app.ts                 # 主控制器，事件处理
├── model.ts               # 数据模型，单元格/公式/合并
├── renderer.ts            # Canvas 渲染，视口管理，增量渲染
├── types.ts               # TypeScript 类型定义
├── inline-editor.ts       # 内联编辑器
├── history-manager.ts     # 撤销/重做栈
├── data-manager.ts        # 数据导入导出
├── prefix-sum-index.ts    # 前缀和索引（O(log n) 定位）
├── formula-worker-bridge.ts # Web Worker 公式计算桥接
├── formula-worker.ts      # Worker 线程公式计算入口
├── dirty-region-tracker.ts # 脏区域追踪（增量渲染）
├── dpr-manager.ts         # 高 DPI 适配
├── hyperlink-manager.ts   # 超链接管理
├── image-manager.ts       # 浮动图片管理
├── format-painter.ts      # 格式刷
├── cell-context-menu.ts   # 右键菜单
├── dropdown-selector.ts   # 下拉选择器
├── row-col-reorder.ts     # 行列拖拽重排序
├── pivot-table/            # 数据透视表引擎 + 面板
├── script/                 # 脚本引擎 + 编辑器
├── plugin/                 # 插件系统（API + 管理器）
├── ui-controls.ts         # 设置面板，主题切换
├── search-dialog.ts       # 查找功能
├── themes.json            # 主题配色
└── style.css              # 全局样式
```

## 协同编辑后端

`javaServer/` 目录包含 Spring Boot WebSocket 协同编辑服务端，支持 OT 算法、房间管理和操作持久化。

## 许可证

MIT