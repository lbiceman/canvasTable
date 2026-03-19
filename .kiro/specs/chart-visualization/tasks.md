# 实现计划：图表与数据可视化

## 概述

基于现有 MVC 架构，在 `src/chart/` 目录下新增图表模块。按照数据模型 → 渲染引擎 → 交互层 → 编辑面板 → 迷你图 → 序列化集成 → 工具栏集成的顺序逐步实现，每步构建在前一步之上，确保无孤立代码。

## 任务

- [x] 1. 定义图表类型和扩展现有类型
  - [x] 1.1 创建 `src/chart/types.ts`，定义 ChartType、SparklineType、DataRange、Position、Size、TitleConfig、LegendConfig、AxisConfig、AxesConfig、DataLabelConfig、ChartConfig、ChartData、SeriesData、SparklineConfig、ChartArea 等接口和类型
    - 定义默认配色数组 CHART_COLORS_LIGHT 和 CHART_COLORS_DARK
    - 定义 ChartInstance 接口（含 status 字段）
    - _需求: 1.1, 1.2, 1.3, 2.8, 6.1, 6.7_
  - [x] 1.2 扩展 `src/types.ts` 中的 Cell 接口，添加 `sparkline?: SparklineConfig` 字段
    - 扩展 SpreadsheetData 接口，添加 `charts?: ChartConfig[]` 字段
    - 导入并重新导出 SparklineConfig 和 ChartConfig 类型
    - _需求: 6.7, 7.1, 7.4_

- [-] 2. 实现 ChartModel 图表数据模型
  - [x] 2.1 创建 `src/chart/chart-model.ts`，实现 ChartModel 类
    - 实现 createChart()：生成唯一 ID，验证数据区域包含数值数据，创建默认配置（400×300 尺寸），存储到 charts Map
    - 实现 deleteChart()：从 Map 中移除图表
    - 实现 updateChart()：合并更新配置，钳制标题字体大小到 12-24px 范围
    - 实现 getChart() 和 getAllCharts()
    - _需求: 1.1, 1.2, 1.3, 1.4, 3.7, 4.5_
  - [x] 2.2 实现 resolveChartData() 数据解析方法
    - 从 SpreadsheetModel 读取数据范围内的单元格值
    - 自动识别第一行为系列名称、第一列为类别标签
    - 单行/单列数据生成单系列
    - 返回 ChartData 对象（含 hasData 标志）
    - _需求: 1.5, 1.6, 5.5_
  - [x] 2.3 实现数据变更监听和数据范围调整
    - 实现 onDataChange() 注册回调
    - 实现 adjustDataRanges()：处理行列插入/删除时的数据范围偏移
    - 当数据范围超出表格边界时标记图表为 'invalidSource' 状态
    - 当数据范围内全部为空时标记为 'noData' 状态
    - _需求: 5.1, 5.2, 5.4, 5.5, 5.6_
  - [x] 2.4 实现 serialize() 和 deserialize() 方法
    - serialize() 输出包含所有必要字段的 JSON 数组
    - deserialize() 解析 JSON 并恢复图表，跳过无效条目并 console.warn
    - _需求: 7.1, 7.3, 7.4, 7.5, 7.6_
  - [x] 2.5 编写 ChartModel 属性测试（Property 3: 非数值数据拒绝创建）
    - **Property 3: 非数值数据区域拒绝创建图表**
    - 使用 fast-check 生成不含数值的单元格矩阵，验证 createChart 返回失败且 charts 数量不变
    - **验证: 需求 1.4**
  - [x] 2.6 编写 ChartModel 属性测试（Property 4: 数据区域标题解析）
    - **Property 4: 数据区域标题解析**
    - 生成至少 2 行 2 列的数值数据矩阵，验证 resolveChartData 正确分离标题和数据
    - **验证: 需求 1.5**
  - [x] 2.7 编写 ChartModel 属性测试（Property 5: 单行/单列生成单系列）
    - **Property 5: 单行/单列数据生成单系列图表**
    - 生成单行或单列数值数据，验证 series 长度为 1
    - **验证: 需求 1.6**
  - [x] 2.8 编写 ChartModel 属性测试（Property 12: 删除图表从模型移除）
    - **Property 12: 删除图表从模型中移除**
    - 创建图表后删除，验证 getChart 返回 null 且 getAllCharts 长度减 1
    - **验证: 需求 4.5**
  - [x] 2.9 编写 ChartModel 属性测试（Property 14: 行列操作后数据范围调整）
    - **Property 14: 行列操作后数据范围自动调整**
    - 生成随机数据范围和行列插入操作，验证范围偏移正确
    - **验证: 需求 5.2**
  - [x] 2.10 编写 ChartModel 属性测试（Property 15 和 16: 空数据和无效范围状态）
    - **Property 15: 空数据范围显示无数据状态**
    - **Property 16: 无效数据范围显示失效状态**
    - **验证: 需求 5.5, 5.6**

- [x] 3. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [-] 4. 实现 ChartEngine 图表渲染引擎
  - [x] 4.1 创建 `src/chart/chart-engine.ts`，实现 ChartEngine 类
    - 实现 render() 入口方法：根据 ChartConfig.type 分发到对应绑制方法
    - 实现 setThemeColors()：设置亮色/暗色主题配色
    - 实现公共辅助方法：renderAxes()、renderGridLines()、renderTitle()、renderLegend()、renderDataLabels()
    - 按绘制顺序：背景 → 网格线 → 坐标轴 → 数据图形 → 数据标签 → 图例 → 标题
    - _需求: 2.1, 2.2, 2.8_
  - [x] 4.2 实现柱状图和折线图渲染
    - renderBarChart()：多系列并排排列，每系列不同颜色
    - renderLineChart()：多系列不同颜色和线型，数据点标记
    - _需求: 2.3, 2.4_
  - [x] 4.3 实现饼图、散点图和面积图渲染
    - renderPieChart()：按数据值比例计算扇区角度，不同颜色填充
    - renderScatterChart()：圆形标记，X/Y 轴对应前两列
    - renderAreaChart()：折线下方半透明填充
    - _需求: 2.5, 2.6, 2.7_
  - [x] 4.4 编写 ChartEngine 属性测试（Property 6: 饼图扇区角度正确性）
    - **Property 6: 饼图扇区角度比例正确性**
    - 生成随机正数数组，验证角度之和等于 2π 且每个角度等于 (值/总和) × 2π
    - **验证: 需求 2.5**
  - [x] 4.5 编写 ChartEngine 属性测试（Property 7: 多系列颜色唯一性）
    - **Property 7: 多系列图表颜色唯一性**
    - 生成多系列数据，验证每个系列颜色互不相同
    - **验证: 需求 2.3, 2.4**

- [-] 5. 实现 ChartOverlay 图表浮动层
  - [x] 5.1 创建 `src/chart/chart-overlay.ts`，实现 ChartOverlay 类
    - 实现 hitTest()：判断坐标是否在图表区域内，返回图表 ID 和缩放手柄
    - 实现 handleMouseDown/Move/Up()：处理拖拽移动和缩放交互
    - 实现 selectChart()/deselectChart()/deleteSelectedChart()
    - 实现 renderAll()：遍历所有图表，调用 ChartEngine.render() 绘制，选中图表绘制蓝色边框和八个缩放手柄
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 5.2 实现位置和尺寸约束
    - 拖拽时钳制位置到可视区域边界内（position.x >= 0, position.y >= 0）
    - 缩放时钳制最小尺寸为 200×150 像素
    - 实现 showTypeSelector()：显示图表类型选择面板
    - _需求: 4.3, 4.7, 1.1_
  - [x] 5.3 编写 ChartOverlay 属性测试（Property 10 和 11: 尺寸和位置约束）
    - **Property 10: 图表缩放最小尺寸不变量**
    - **Property 11: 图表位置边界约束**
    - 生成随机缩放和位置操作，验证约束不被违反
    - **验证: 需求 4.3, 4.7**

- [-] 6. 实现 ChartEditor 图表编辑面板
  - [x] 6.1 创建 `src/chart/chart-editor.ts`，实现 ChartEditor 类
    - 实现 open(chartId)：构建 DOM 面板，显示当前图表配置
    - 实现 close()：关闭面板并保存配置
    - 实现 applyChange()：200ms 防抖后更新 ChartModel 并触发重绘
    - 提供标题配置（文本、字体大小 12-24px、位置）
    - 提供图例配置（显示/隐藏、位置 top/bottom/left/right）
    - 提供坐标轴配置（标题、刻度范围、网格线）
    - 提供数据标签配置（显示/隐藏、内容 value/percentage/category）
    - 提供图表类型切换功能（切换后保留数据范围）
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [x] 6.2 编写 ChartEditor 属性测试（Property 8 和 9: 类型切换和配置约束）
    - **Property 8: 图表类型切换保留数据范围**
    - **Property 9: 图表配置值约束**
    - 验证切换类型后 dataRange 不变，配置值在有效范围内
    - **验证: 需求 3.2, 3.3, 3.8**

- [x] 7. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [-] 8. 实现 SparklineRenderer 迷你图渲染器
  - [x] 8.1 创建 `src/chart/sparkline-renderer.ts`，实现 SparklineRenderer 类
    - 实现静态 render() 方法：根据 SparklineConfig.type 分发绘制
    - renderLineSparkline()：连接数据点的折线，最大值/最小值高亮标记
    - renderBarSparkline()：等宽柱子，正值向上负值向下，零线基准
    - renderWinLossSparkline()：正值上方色块、负值下方色块
    - 保留 2px 内边距
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 8.2 编写 SparklineRenderer 属性测试（Property 2: SparklineConfig 序列化往返一致性）
    - **Property 2: SparklineConfig 序列化往返一致性**
    - 使用 fast-check 生成随机 SparklineConfig，验证 JSON.stringify → JSON.parse 往返一致
    - **验证: 需求 6.7, 6.8**

- [-] 9. 集成序列化和数据联动
  - [x] 9.1 在 SpreadsheetModel 中集成 ChartModel
    - 在 exportToJSON() 中包含 charts 字段
    - 在 importFromJSON() 中解析 charts 字段并调用 ChartModel.deserialize()
    - 在 validateImportData() 中处理无效 charts 字段（忽略并警告）
    - _需求: 7.1, 7.2, 7.3, 7.6_
   - [x] 9.2 实现数据变更到图表的传播
    - 在 SpreadsheetModel 的 setCellContent() 中触发 ChartModel 的数据变更回调
    - 在行列插入/删除操作中调用 ChartModel.adjustDataRanges()
    - 公式重算完成后触发图表更新
    - 迷你图数据源变化时在下一次 renderCells 自动更新
    - _需求: 5.1, 5.2, 5.3, 5.4, 6.6_
  - [x] 9.3 编写序列化属性测试（Property 1 和 18: ChartConfig 序列化）
    - **Property 1: ChartConfig 序列化往返一致性**
    - **Property 18: 序列化 ChartConfig 包含所有必要字段**
    - 使用 fast-check 生成随机 ChartConfig，验证往返一致性和字段完整性
    - **验证: 需求 1.3, 7.1, 7.3, 7.4, 7.5**
  - [x] 9.4 编写数据联动属性测试（Property 13: 数据变更传播）
    - **Property 13: 数据变更传播到图表**
    - 修改数据源范围内单元格后，验证 resolveChartData 反映新值
    - **验证: 需求 5.1, 5.3**
  - [x] 9.5 编写错误处理属性测试（Property 17: 无效 JSON 优雅处理）
    - **Property 17: 无效图表 JSON 优雅处理**
    - 生成随机无效 JSON，验证 deserialize 不抛异常且不影响有效数据
    - **验证: 需求 7.6**

- [-] 10. 集成渲染流程和交互事件
  - [x] 10.1 在 SpreadsheetRenderer.render() 中集成图表浮动层渲染
    - 在选区绘制之后、行列标题之前调用 ChartOverlay.renderAll()
    - 在 renderCells() 中集成 SparklineRenderer：检查单元格 sparkline 字段，调用静态 render() 方法
    - _需求: 2.1, 6.2_
  - [x] 10.2 在 SpreadsheetApp 中集成图表交互事件
    - 在 handleMouseDown/Move/Up 中代理到 ChartOverlay 的事件处理
    - hitTest 命中图表时阻止正常电子表格交互
    - 处理 Delete 键删除选中图表
    - 双击图表打开 ChartEditor
    - 点击图表外部取消选中
    - _需求: 4.1, 4.2, 4.4, 4.5, 4.6, 3.1_

- [ ] 11. 实现工具栏集成
  - [x] 11.1 在 `index.html` 工具栏中添加"插入图表"按钮和"迷你图"下拉按钮
    - 位于条件格式按钮之后
    - 使用与现有按钮一致的 SVG 图标风格和中文标签
    - "迷你图"下拉展示三个选项：折线迷你图、柱状迷你图、盈亏迷你图
    - _需求: 8.1, 8.4, 8.6_
  - [x] 11.2 在 SpreadsheetApp 中绑定工具栏按钮事件
    - "插入图表"按钮：未选中区域时禁用并显示 title 提示"请先选择数据区域"
    - 选中包含数据区域时启用按钮，点击后调用 ChartOverlay.showTypeSelector()
    - "迷你图"选项点击后弹出数据范围输入对话框
    - 选择数据范围后在目标单元格创建 SparklineConfig
    - _需求: 8.2, 8.3, 8.5_

- [ ] 12. 主题适配和最终集成
  - [x] 12.1 实现图表主题切换支持
    - 在 UIControls 主题切换时调用 ChartEngine.setThemeColors() 更新配色
    - 图表使用 CHART_COLORS_LIGHT / CHART_COLORS_DARK 配色方案
    - 迷你图默认使用主题色，支持自定义颜色覆盖
    - _需求: 2.8_
  - [x] 12.2 创建 `src/chart/index.ts` 统一导出模块
    - 导出 ChartModel、ChartEngine、ChartOverlay、ChartEditor、SparklineRenderer
    - 确保所有模块正确连接，无孤立代码
    - _需求: 全部_

- [ ] 13. Java 后端图表协同支持 — 模型类
  - [x] 13.1 创建图表相关 Java 模型类
    - 创建 `DataRange.java`：startRow、startCol、endRow、endCol 字段
    - 创建 `ChartPosition.java`：x、y 字段（double 类型）
    - 创建 `ChartSize.java`：width、height 字段（double 类型）
    - 创建 `TitleConfig.java`：text、fontSize、position、visible 字段
    - 创建 `LegendConfig.java`：visible、position 字段
    - 创建 `AxisConfig.java`：title、autoRange、min、max、showGridLines 字段
    - 创建 `AxesConfig.java`：xAxis、yAxis 字段
    - 创建 `DataLabelConfig.java`：visible、content 字段
    - 所有类放在 `com.iceexcel.server.model` 包下，使用 `@JsonInclude(NON_NULL)`
  - [x] 13.2 创建 `ChartConfigData.java` 和 `SparklineConfigData.java`
    - `ChartConfigData`：id、type、dataRange、position、size、title、legend、axes、dataLabels 字段
    - `SparklineConfigData`：type、dataRange、color、highlightMax、highlightMin 字段
  - [x] 13.3 扩展现有 Java 模型
    - 在 `Cell.java` 中添加 `sparkline` 字段（SparklineConfigData 类型），含 getter/setter，更新 equals/hashCode
    - 在 `SpreadsheetData.java` 中添加 `charts` 字段（`List<ChartConfigData>` 类型），含 getter/setter，更新 equals/hashCode

- [ ] 14. Java 后端图表协同支持 — 操作类型
  - [x] 14.1 创建图表协同操作类
    - 创建 `ChartCreateOp.java`：继承 CollabOperation，包含 chartConfig（ChartConfigData）字段，type 返回 "chartCreate"
    - 创建 `ChartUpdateOp.java`：继承 CollabOperation，包含 chartId 和 chartConfig 字段，type 返回 "chartUpdate"
    - 创建 `ChartDeleteOp.java`：继承 CollabOperation，包含 chartId 字段，type 返回 "chartDelete"
    - 创建 `SetSparklineOp.java`：继承 CollabOperation，包含 row、col、sparkline（SparklineConfigData）字段，type 返回 "setSparkline"
  - [x] 14.2 在 `CollabOperation.java` 的 `@JsonSubTypes` 注解中注册新操作类型
    - 添加 ChartCreateOp（"chartCreate"）、ChartUpdateOp（"chartUpdate"）、ChartDeleteOp（"chartDelete"）、SetSparklineOp（"setSparkline"）

- [ ] 15. Java 后端图表协同支持 — DocumentApplier 和 OTTransformer
  - [x] 15.1 在 `DocumentApplier.java` 中添加图表操作应用逻辑
    - `applyChartCreate()`：将 chartConfig 添加到 SpreadsheetData.charts 列表（如果 charts 为 null 则初始化）
    - `applyChartUpdate()`：根据 chartId 查找并替换 charts 列表中的配置
    - `applyChartDelete()`：根据 chartId 从 charts 列表中移除
    - `applySetSparkline()`：设置目标单元格的 sparkline 字段（sparkline 为 null 时清除）
    - 在 apply() 方法中添加 instanceof 分支
  - [x] 15.2 在 `OTTransformer.java` 中添加图表操作的 OT 变换逻辑
    - ChartCreateOp/ChartUpdateOp vs RowInsert/RowDelete：调整 chartConfig.dataRange 的行索引
    - ChartCreateOp/ChartUpdateOp vs ColInsert/ColDelete：调整 chartConfig.dataRange 的列索引
    - ChartDeleteOp vs 任意操作：不变
    - SetSparklineOp vs RowInsert/RowDelete：调整 row 索引和 sparkline.dataRange 行索引
    - SetSparklineOp vs ColInsert/ColDelete：调整 col 索引和 sparkline.dataRange 列索引
    - ChartUpdateOp vs ChartDeleteOp（同 chartId）：更新操作被取消（返回 null）
    - 在 transform() 主方法中添加新操作类型的分发逻辑

- [x] 16. 最终检查点 - 确保所有测试通过
  - 确保前端和后端所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保可追溯性
- 检查点确保增量验证，及早发现问题
- 属性测试验证正确性属性的普遍成立性，单元测试验证具体示例和边界情况
