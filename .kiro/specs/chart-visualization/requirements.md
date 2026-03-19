# 需求文档：图表与数据可视化

## 简介

为 Canvas Excel（ice-excel）添加图表与数据可视化功能，支持用户基于电子表格数据创建、编辑和展示多种类型的图表。图表通过 Canvas 2D API 原生渲染，保持零运行时依赖的项目约束。图表与源数据实时联动，数据变化时图表自动更新。同时支持迷你图（Sparkline），在单元格内嵌入小型可视化图表。

## 术语表

- **ChartEngine**：图表渲染引擎，负责将图表配置和数据转换为 Canvas 绘制指令
- **ChartModel**：图表数据模型，存储图表配置、数据源引用和样式信息
- **ChartOverlay**：图表浮动层，管理图表在电子表格上方的定位、缩放和拖拽
- **ChartConfig**：图表配置对象，包含图表类型、标题、图例、坐标轴、数据标签等设置
- **DataRange**：数据范围，表示图表数据源在电子表格中的单元格区域（如 A1:D10）
- **SparklineRenderer**：迷你图渲染器，负责在单元格内绘制小型图表
- **SparklineConfig**：迷你图配置对象，包含迷你图类型、数据范围和样式
- **ChartType**：图表类型枚举，包括柱状图（bar）、折线图（line）、饼图（pie）、散点图（scatter）、面积图（area）
- **SparklineType**：迷你图类型枚举，包括折线（line）、柱状（bar）、盈亏（winLoss）
- **ChartEditor**：图表编辑面板，提供图表属性配置的用户界面

## 需求

### 需求 1：图表创建与类型支持

**用户故事：** 作为电子表格用户，我希望能够基于选中的数据区域创建多种类型的图表，以便直观地展示数据趋势和分布。

#### 验收标准

1. WHEN 用户选中一个包含数值数据的单元格区域并点击工具栏的"插入图表"按钮，THE ChartOverlay SHALL 显示图表类型选择面板，列出柱状图、折线图、饼图、散点图、面积图五种类型
2. WHEN 用户从图表类型选择面板中选择一种图表类型，THE ChartEngine SHALL 基于选中区域的数据在电子表格上方创建一个浮动图表，图表默认尺寸为 400×300 像素
3. THE ChartModel SHALL 将图表配置（类型、数据范围、位置、尺寸）存储在 SpreadsheetData 中，与单元格数据一同持久化
4. WHEN 用户选中的数据区域不包含任何数值数据，THE ChartOverlay SHALL 显示提示信息"所选区域无有效数值数据，无法创建图表"
5. THE ChartEngine SHALL 自动识别数据区域的第一行为列标题、第一列为行标题，并将其用作图表的系列名称和类别标签
6. IF 数据区域仅包含一行或一列数值数据，THEN THE ChartEngine SHALL 创建单系列图表

### 需求 2：图表 Canvas 渲染

**用户故事：** 作为电子表格用户，我希望图表通过 Canvas 原生渲染，保持高性能和视觉一致性。

#### 验收标准

1. THE ChartEngine SHALL 使用 Canvas 2D API 绘制所有图表元素，包括坐标轴、数据点、图例、标题和数据标签
2. THE ChartEngine SHALL 按照以下顺序绘制图表元素：背景 → 网格线 → 坐标轴 → 数据图形 → 数据标签 → 图例 → 标题
3. WHEN 柱状图包含多个数据系列，THE ChartEngine SHALL 将同一类别的柱子并排排列，每个系列使用不同颜色区分
4. WHEN 折线图包含多个数据系列，THE ChartEngine SHALL 为每条折线使用不同颜色和线型，并在数据点处绘制标记点
5. WHEN 饼图渲染时，THE ChartEngine SHALL 按数据值比例计算每个扇区的角度，并为每个扇区使用不同颜色填充
6. WHEN 散点图渲染时，THE ChartEngine SHALL 将数据点绘制为圆形标记，X 轴和 Y 轴分别对应数据的前两列数值
7. WHEN 面积图渲染时，THE ChartEngine SHALL 在折线下方填充半透明颜色区域
8. THE ChartEngine SHALL 从 themeColors 读取默认配色方案，支持亮色和暗色主题

### 需求 3：图表编辑与配置

**用户故事：** 作为电子表格用户，我希望能够自定义图表的标题、图例、坐标轴和数据标签，以便生成符合需求的可视化效果。

#### 验收标准

1. WHEN 用户双击一个已创建的图表，THE ChartEditor SHALL 打开图表编辑面板，显示当前图表的所有可配置属性
2. THE ChartEditor SHALL 提供标题配置区域，允许用户设置图表标题文本、字体大小（12-24px）和显示位置（顶部或底部）
3. THE ChartEditor SHALL 提供图例配置区域，允许用户设置图例的显示/隐藏状态和位置（上、下、左、右）
4. THE ChartEditor SHALL 提供坐标轴配置区域，允许用户设置 X 轴和 Y 轴的标题文本、刻度范围（自动或手动）和网格线显示/隐藏
5. THE ChartEditor SHALL 提供数据标签配置区域，允许用户设置数据标签的显示/隐藏状态和显示内容（数值、百分比或类别名称）
6. WHEN 用户在图表编辑面板中修改任意配置项，THE ChartEngine SHALL 在 200 毫秒内重新渲染图表以反映变更
7. WHEN 用户点击图表编辑面板的"确定"按钮或点击面板外部区域，THE ChartEditor SHALL 关闭编辑面板并保存配置到 ChartModel
8. THE ChartEditor SHALL 提供图表类型切换功能，允许用户在五种图表类型之间切换，切换后保留原有数据范围

### 需求 4：图表交互操作

**用户故事：** 作为电子表格用户，我希望能够拖拽移动图表位置和调整图表大小，以便灵活布局工作表。

#### 验收标准

1. WHEN 用户在图表区域按下鼠标并拖拽，THE ChartOverlay SHALL 移动图表到新位置，移动过程中显示半透明预览
2. WHEN 用户将鼠标悬停在图表边缘或角落，THE ChartOverlay SHALL 显示对应方向的缩放光标（nw-resize、ne-resize、sw-resize、se-resize、n-resize、s-resize、e-resize、w-resize）
3. WHEN 用户拖拽图表边缘或角落，THE ChartOverlay SHALL 调整图表尺寸，最小尺寸为 200×150 像素
4. WHEN 用户单击图表区域，THE ChartOverlay SHALL 显示图表选中状态（蓝色边框和八个缩放手柄）
5. WHEN 用户在图表选中状态下按 Delete 键，THE ChartModel SHALL 删除该图表并从 SpreadsheetData 中移除对应配置
6. WHEN 用户在图表外部区域点击，THE ChartOverlay SHALL 取消图表选中状态并隐藏缩放手柄
7. IF 图表拖拽位置超出可视区域边界，THEN THE ChartOverlay SHALL 将图表位置限制在可视区域内

### 需求 5：图表与数据联动

**用户故事：** 作为电子表格用户，我希望图表能够自动响应源数据的变化，以便始终展示最新的数据状态。

#### 验收标准

1. WHEN 用户修改图表数据源范围内任意单元格的数值，THE ChartEngine SHALL 在 300 毫秒内自动重新渲染图表以反映数据变化
2. WHEN 用户在数据源范围内插入或删除行列，THE ChartModel SHALL 自动调整数据范围引用以保持数据对应关系
3. WHEN 用户通过公式计算更新数据源范围内的单元格值，THE ChartEngine SHALL 在公式重算完成后自动更新图表
4. THE ChartModel SHALL 通过注册 SpreadsheetModel 的数据变更回调来监听数据源区域的变化
5. WHILE 图表数据源范围内的所有单元格均为空，THE ChartEngine SHALL 显示"暂无数据"占位提示，替代空白图表
6. IF 用户删除了图表数据源范围所在的整行或整列导致数据范围无效，THEN THE ChartModel SHALL 将图表标记为"数据源失效"状态，并在图表上显示警告图标和提示文本

### 需求 6：迷你图（Sparkline）

**用户故事：** 作为电子表格用户，我希望能够在单元格内嵌入迷你图，以便在紧凑空间内展示数据趋势。

#### 验收标准

1. WHEN 用户选中一个目标单元格并通过工具栏"迷你图"菜单选择迷你图类型（折线、柱状、盈亏），THE SparklineRenderer SHALL 在该单元格内绘制对应类型的迷你图
2. THE SparklineRenderer SHALL 在单元格渲染阶段（renderCells）绘制迷你图，迷你图占据单元格内部区域并保留 2px 内边距
3. WHEN 迷你图类型为折线时，THE SparklineRenderer SHALL 绘制一条连接所有数据点的折线，并在最大值和最小值处标记高亮点
4. WHEN 迷你图类型为柱状时，THE SparklineRenderer SHALL 绘制等宽柱子，正值向上、负值向下，以零线为基准
5. WHEN 迷你图类型为盈亏时，THE SparklineRenderer SHALL 将正值绘制为等高的上方色块、负值绘制为等高的下方色块
6. WHEN 迷你图数据源范围内的单元格值发生变化，THE SparklineRenderer SHALL 在下一次渲染周期自动更新迷你图
7. THE SparklineConfig SHALL 存储在目标单元格的 Cell 对象中，与单元格数据一同序列化和反序列化
8. FOR ALL 有效的 SparklineConfig 对象，序列化后再反序列化 SHALL 产生等价的 SparklineConfig 对象（往返一致性）

### 需求 7：图表数据序列化

**用户故事：** 作为电子表格用户，我希望图表配置能够随电子表格数据一起保存和加载，以便在重新打开文件时恢复图表状态。

#### 验收标准

1. THE ChartModel SHALL 将所有图表配置序列化为 JSON 格式，存储在 SpreadsheetData 的 charts 字段中
2. WHEN DataManager 执行导出操作，THE DataManager SHALL 将图表配置包含在导出的 JSON 数据中
3. WHEN DataManager 执行导入操作且 JSON 数据包含 charts 字段，THE ChartModel SHALL 解析图表配置并恢复所有图表
4. THE ChartConfig 的 JSON 序列化 SHALL 包含以下字段：id、type、dataRange、position、size、title、legend、axes、dataLabels
5. FOR ALL 有效的 ChartConfig 对象，序列化为 JSON 后再解析 SHALL 产生等价的 ChartConfig 对象（往返一致性）
6. IF 导入的 JSON 数据中 charts 字段格式无效，THEN THE DataManager SHALL 忽略无效的图表配置并在控制台记录警告信息，不影响其余数据的正常加载

### 需求 8：图表工具栏集成

**用户故事：** 作为电子表格用户，我希望通过工具栏快速访问图表功能，以便高效地创建和管理图表。

#### 验收标准

1. THE SpreadsheetApp SHALL 在工具栏中添加"插入图表"按钮和"迷你图"下拉按钮，位于条件格式按钮之后
2. WHEN 用户未选中任何单元格区域时点击"插入图表"按钮，THE SpreadsheetApp SHALL 禁用该按钮并显示 title 提示"请先选择数据区域"
3. WHEN 用户选中包含数据的区域时，THE SpreadsheetApp SHALL 启用"插入图表"按钮
4. THE "迷你图"下拉按钮 SHALL 展示三个选项：折线迷你图、柱状迷你图、盈亏迷你图
5. WHEN 用户点击迷你图选项，THE SpreadsheetApp SHALL 弹出数据范围输入对话框，允许用户指定迷你图的数据源范围
6. THE 工具栏按钮 SHALL 使用与现有按钮一致的 SVG 图标风格和中文标签文本
