# 实现计划：单元格边框与样式（完整实现）

## 概述

基于需求文档和设计文档，将单元格边框系统、字体族选择、删除线样式功能分解为增量式编码任务。每个任务构建在前一个任务之上，确保代码始终可运行。使用 TypeScript 实现，遵循现有 MVC 架构。

## 任务

- [x] 1. 类型定义与数据模型扩展
  - [x] 1.1 在 `src/types.ts` 中新增边框相关类型定义
    - 新增 `BorderStyle` 类型（`'solid' | 'dashed' | 'dotted' | 'double'`）
    - 新增 `BorderPosition` 类型（`'top' | 'bottom' | 'left' | 'right' | 'all' | 'outer' | 'inner' | 'none'`）
    - 新增 `BorderSide` 接口（`style`、`color`、`width` 三个属性）
    - 新增 `CellBorder` 接口（`top`、`bottom`、`left`、`right` 四个可选 `BorderSide` 属性）
    - 在 `Cell` 接口中添加 `border?: CellBorder`、`fontFamily?: string`、`fontStrikethrough?: boolean`
    - 在 `ClipboardCellData` 接口中添加 `border?: CellBorder`、`fontFamily?: string`、`fontStrikethrough?: boolean`
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.1, 6.1, 10.1_

  - [x] 1.2 在 `src/history-manager.ts` 中扩展 `ActionType` 联合类型
    - 新增 `'setBorder'`、`'setFontFamily'`、`'setStrikethrough'` 三个操作类型
    - _需求: 2.6, 5.6, 6.5_

- [x] 2. SpreadsheetModel 批量样式设置方法
  - [x] 2.1 实现 `setRangeBorder()` 方法
    - 在 `src/model.ts` 中新增 `setRangeBorder(startRow, startCol, endRow, endCol, position: BorderPosition, borderSide: BorderSide | undefined)` 方法
    - 实现 `all`（全部边框）、`outer`（外框）、`inner`（内框）、`top`/`bottom`/`left`/`right`（单边）、`none`（清除）八种位置逻辑
    - 合并单元格处理：跳过被合并的子单元格，将边框应用到父单元格
    - 通过 `HistoryManager` 记录操作前后的边框状态，支持撤销/重做
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.2 实现 `setRangeFontFamily()` 方法
    - 在 `src/model.ts` 中新增 `setRangeFontFamily(startRow, startCol, endRow, endCol, fontFamily: string)` 方法
    - 遍历区域内单元格设置 `fontFamily` 属性，处理合并单元格
    - 通过 `HistoryManager` 记录操作，支持撤销/重做
    - _需求: 5.3, 5.6_

  - [x] 2.3 实现 `setRangeFontStrikethrough()` 方法
    - 在 `src/model.ts` 中新增 `setRangeFontStrikethrough(startRow, startCol, endRow, endCol, strikethrough: boolean)` 方法
    - 遍历区域内单元格设置 `fontStrikethrough` 属性，处理合并单元格
    - 通过 `HistoryManager` 记录操作，支持撤销/重做
    - _需求: 6.4, 6.5_

  - [x] 2.4 在 `src/model.ts` 的 `handleUndo()` / `handleRedo()` 中添加 `setBorder`、`setFontFamily`、`setStrikethrough` 操作的撤销/重做处理逻辑
    - _需求: 2.6, 5.6, 6.5_

- [x] 3. 检查点 - 数据模型层完成
  - 确保类型定义和 Model 方法编译通过，询问用户是否有疑问。

- [x] 4. Canvas 渲染层实现
  - [x] 4.1 在 `src/renderer.ts` 中实现边框渲染方法 `renderCellBorders()`
    - 在 `render()` 方法中 `renderGrid()` 之后调用 `renderCellBorders()`
    - 遍历视口内可见单元格，对有 `border` 属性的单元格按 top → bottom → left → right 顺序绘制
    - 根据 `BorderStyle` 设置 Canvas `setLineDash()`：`solid` → `[]`、`dashed` → `[6, 3]`、`dotted` → `[2, 2]`
    - `double` 线型绘制两条平行线，间距 2px，每条线宽 1px
    - 使用 `BorderSide.color` 设置 `strokeStyle`，`BorderSide.width` 设置 `lineWidth`
    - 相邻单元格共享边冲突解决：宽度大者优先；宽度相同时行号/列号较大者优先
    - 仅渲染视口范围内可见单元格的边框
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 4.2 在冻结窗格渲染中集成边框绘制
    - 在 `renderFrozenPanes()` 的 `renderFrozenCell()` 辅助方法中添加边框渲染逻辑
    - 确保冻结区域的单元格边框在固定位置正确渲染
    - _需求: 4.9_

  - [x] 4.3 在 `src/renderer.ts` 的 `renderCells()` 中实现字体族应用
    - 构建 `ctx.font` 字符串时使用 `cell.fontFamily || config.fontFamily` 替换字体族部分
    - 未设置 `fontFamily` 时使用 RenderConfig 默认字体族
    - _需求: 5.4, 5.5_

  - [x] 4.4 在 `src/renderer.ts` 的 `renderCells()` 中实现删除线渲染
    - 在现有下划线绘制逻辑之后，检查 `cell.fontStrikethrough`
    - 为 `true` 时在文本垂直中心绘制水平线，线宽 1px，颜色与文本颜色一致
    - _需求: 6.3_

- [x] 5. 检查点 - 渲染层完成
  - 确保边框、字体族、删除线在 Canvas 上正确渲染，询问用户是否有疑问。

- [x] 6. 工具栏 UI 实现
  - [x] 6.1 在 `index.html` 工具栏第一行中添加边框操作按钮和下拉面板 HTML 结构
    - 添加"边框"按钮（带 SVG 图标，中文标签"边框"）
    - 下拉面板包含八个边框位置选项（上/下/左/右/全部/外框/内框/清除），每个带直观图标
    - 下拉面板包含四种线型选择区域（实线/虚线/点线/双线可视化图标）
    - 下拉面板包含边框颜色选择器（`<input type="color">` 默认 `#000000`）
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.8_

  - [x] 6.2 在 `index.html` 工具栏第一行中添加字体族下拉选择器 HTML 结构
    - 添加字体族下拉按钮和选项面板
    - 预设字体：宋体（SimSun）、微软雅黑（Microsoft YaHei）、黑体（SimHei）、楷体（KaiTi）、Arial、Times New Roman、Courier New
    - _需求: 5.2_

  - [x] 6.3 在 `index.html` 工具栏第一行中添加删除线切换按钮 HTML 结构
    - 添加删除线按钮（标记为 "S" 带中划线样式，class `font-strikethrough-btn`）
    - _需求: 6.2_

  - [x] 6.4 在 `src/style.css` 中添加边框下拉面板、字体族下拉、删除线按钮的 CSS 样式
    - 边框下拉面板样式与现有下拉面板（字体大小、数字格式）风格一致
    - 字体族下拉样式与现有下拉面板风格一致
    - 删除线按钮样式与现有加粗/斜体/下划线按钮风格一致，支持 `.active` 高亮状态
    - _需求: 7.7, 6.6_

- [x] 7. 控制器层事件绑定（SpreadsheetApp）
  - [x] 7.1 在 `src/app.ts` 中实现边框下拉面板的事件绑定
    - 绑定边框按钮点击展开/收起下拉面板
    - 绑定八个边框位置选项的点击事件，调用 `model.setRangeBorder()` 并使用当前选中的线型和颜色
    - 绑定线型选择和颜色选择器的变更事件，记录当前选中的线型/颜色状态
    - 点击面板外部区域自动关闭下拉面板
    - 应用边框后关闭下拉面板，触发 `renderer.render()` 重新渲染
    - _需求: 3.3, 3.4, 7.5, 7.6_

  - [x] 7.2 在 `src/app.ts` 中实现字体族下拉的事件绑定
    - 绑定字体族按钮点击展开/收起下拉面板
    - 绑定字体选项点击事件，调用 `model.setRangeFontFamily()` 设置选中区域字体族
    - 选中单元格时在字体族下拉中显示当前字体族名称；多个不同字体族时显示为空
    - 触发 `renderer.render()` 重新渲染
    - _需求: 5.3, 5.7_

  - [x] 7.3 在 `src/app.ts` 中实现删除线按钮的事件绑定
    - 绑定删除线按钮点击事件，切换选中区域 `fontStrikethrough` 状态
    - 调用 `model.setRangeFontStrikethrough()` 设置删除线
    - 选中已设置删除线的单元格时高亮按钮（添加 `active` CSS 类）
    - 触发 `renderer.render()` 重新渲染
    - _需求: 6.2, 6.4, 6.6_

  - [x] 7.4 在 `src/app.ts` 的 `updateSelectedCellInfo()` 方法中同步更新字体族下拉和删除线按钮状态
    - 选中单元格变化时更新字体族下拉显示文本
    - 选中单元格变化时更新删除线按钮高亮状态
    - _需求: 5.7, 6.6_

- [x] 8. 检查点 - 工具栏交互完成
  - 确保边框设置、字体族选择、删除线切换功能可通过工具栏正常操作，询问用户是否有疑问。

- [x] 9. 集成模块扩展
  - [x] 9.1 在 `src/format-painter.ts` 中扩展格式刷集成
    - 在 `CopiedFormat` 接口中添加 `border?: CellBorder`、`fontFamily?: string`、`fontStrikethrough?: boolean`
    - 在 `extractFormat()` 方法中提取 `border`、`fontFamily`、`fontStrikethrough` 属性
    - 在 `applyFormatToCell()` 方法中应用 `border`、`fontFamily`、`fontStrikethrough` 属性
    - _需求: 9.1, 9.2, 9.3_

  - [x] 9.2 在 `src/app.ts` 中扩展剪贴板复制/粘贴逻辑
    - 复制时将 `border`、`fontFamily`、`fontStrikethrough` 存入内部剪贴板 `ClipboardCellData`
    - 粘贴时将内部剪贴板中的 `border`、`fontFamily`、`fontStrikethrough` 应用到目标单元格
    - "仅粘贴格式"选择性粘贴时包含 `border`、`fontFamily`、`fontStrikethrough`
    - _需求: 10.2, 10.3, 10.4_

  - [x] 9.3 在 `src/data-manager.ts` 中扩展 JSON 导入/导出和 LocalStorage 持久化
    - `exportToJSON()` 中将 `border`、`fontFamily`、`fontStrikethrough` 包含在导出数据中
    - `importFromJSON()` 中解析并恢复 `border`、`fontFamily`、`fontStrikethrough` 属性
    - LocalStorage 通过 `exportToJSON()` / `importFromJSON()` 自动包含新属性
    - _需求: 8.1, 8.2, 8.3, 8.4_

  - [x] 9.4 在 `src/collaboration/types.ts` 中扩展协同编辑操作类型
    - 在 `OperationType` 中新增 `'setBorder'`、`'setFontFamily'`、`'setStrikethrough'`
    - 新增 `SetBorderOp`、`SetFontFamilyOp`、`SetStrikethroughOp` 接口
    - 将新操作类型添加到 `CollabOperation` 联合类型
    - _需求: 11.1_

  - [x] 9.5 在 `src/app.ts` 中扩展协同操作提交和远程操作处理
    - 边框/字体族/删除线设置时，协同模式下通过 `CollaborationEngine` 提交对应操作
    - 收到远程 `setBorder`/`setFontFamily`/`setStrikethrough` 操作时应用到本地模型并重新渲染
    - _需求: 11.2, 11.3, 11.4, 11.5_

- [x] 10. E2E 自动化测试（Playwright）— 100% 需求覆盖
  - [x] 10.1 创建 `e2e/cell-border-style.spec.ts` 边框数据模型与批量设置测试
    - 参考 `e2e/font-style.spec.ts` 的测试模式和辅助函数（`clickCell`、`getCellData`）
    - 测试「需求1 - 数据模型」：通过 `evaluate` 验证 Cell 对象包含 `border` 属性，CellBorder 包含 top/bottom/left/right，BorderSide 包含 style/color/width
    - 测试「需求2.1 - 全部边框」：选中 A1:C3 区域，选择"全部边框"，验证区域内每个单元格的 border 均包含 top/bottom/left/right 四条边
    - 测试「需求2.2 - 外框边框」：选中 A1:C3 区域，选择"外框边框"，验证仅外圈单元格有对应方向边框（A1 有 top+left，C3 有 bottom+right 等），内部单元格（B2）无边框
    - 测试「需求2.3 - 内框边框」：选中 A1:C3 区域，选择"内框边框"，验证仅内部相邻单元格有共享边框，外圈单元格无外侧边框
    - 测试「需求2.4 - 单边边框」：分别测试"上边框"/"下边框"/"左边框"/"右边框"，验证仅设置对应方向的单条边框
    - 测试「需求2.5 - 清除边框」：先设置全部边框，再选择"清除边框"，验证 border 属性被移除（为 undefined）
    - 测试「需求2.7 - 合并单元格」：合并 A1:B2 后设置全部边框，验证边框应用到合并区域的父单元格，被合并的子单元格无独立边框
    - _需求: 1.1-1.6, 2.1-2.5, 2.7_

  - [x] 10.2 创建 `e2e/cell-border-style-render.spec.ts` 边框样式、颜色与渲染测试
    - 测试「需求3.1 - 线型选择」：在边框下拉面板中分别选择实线/虚线/点线/双线，应用后验证 `border.top.style` 分别为 `solid`/`dashed`/`dotted`/`double`
    - 测试「需求3.2 - 颜色选择」：通过颜色选择器设置边框颜色为 `#ff0000`，应用后验证 `border.top.color` 为 `#ff0000`
    - 测试「需求3.4 - 默认值」：首次打开边框面板，验证默认线型为 `solid`、默认颜色为 `#000000`、默认宽度为 1
    - 测试「需求4.1 - 边框渲染」：设置全部边框后 Canvas 截图对比，验证边框线绘制在网格线之上
    - 测试「需求4.2-4.5 - 四种线型渲染」：分别设置 solid/dashed/dotted/double 线型，Canvas 截图对比验证四种线型的视觉效果
    - 测试「需求4.7 - 相邻边框冲突」：A1 设置宽度 2 的边框，B1 设置宽度 1 的边框，验证共享边渲染宽度 2 的边框
    - 测试「需求4.8 - 虚拟滚动」：设置远离视口的单元格（如第 100 行）边框，滚动到该位置后验证边框正确渲染
    - 测试「需求4.9 - 冻结窗格」：冻结首行后设置首行单元格边框，向下滚动验证冻结区域边框固定渲染
    - _需求: 3.1-3.4, 4.1-4.9_

  - [x] 10.3 创建 `e2e/font-family.spec.ts` 字体族选择完整测试
    - 测试「需求5.1 - fontFamily 属性」：设置字体族后通过 `evaluate` 验证 Cell 对象包含 `fontFamily` 字符串属性
    - 测试「需求5.2 - 预设字体列表」：点击字体族下拉，验证包含全部 7 种预设字体选项（宋体、微软雅黑、黑体、楷体、Arial、Times New Roman、Courier New）
    - 测试「需求5.3 - 设置字体族」：选中 A1:B2 区域，从下拉列表选择 "Arial"，验证区域内所有单元格 `fontFamily` 为 "Arial"
    - 测试「需求5.4 - 字体族渲染」：输入文本后设置不同字体族，Canvas 截图对比验证字体渲染效果变化
    - 测试「需求5.5 - 默认字体族」：未设置 fontFamily 的单元格，验证使用默认字体族渲染（通过截图对比）
    - 测试「需求5.6 - 撤销重做」：设置字体族后 Ctrl+Z 撤销，验证 fontFamily 恢复；Ctrl+Y 重做，验证 fontFamily 重新设置
    - 测试「需求5.7 - 状态同步」：选中已设置 Arial 的单元格，验证字体族下拉显示 "Arial"；选中多个不同字体族的单元格，验证下拉显示为空
    - _需求: 5.1-5.7_

  - [x] 10.4 创建 `e2e/font-strikethrough.spec.ts` 删除线样式完整测试
    - 测试「需求6.1 - fontStrikethrough 属性」：设置删除线后通过 `evaluate` 验证 Cell 对象包含 `fontStrikethrough` 布尔属性
    - 测试「需求6.2 - 删除线按钮」：验证工具栏存在删除线按钮（标记为 "S" 带中划线样式），点击后切换状态
    - 测试「需求6.3 - 删除线渲染」：输入文本后启用删除线，Canvas 截图对比验证文本中心有水平删除线
    - 测试「需求6.4 - 切换逻辑」：点击删除线按钮启用（fontStrikethrough=true），再次点击取消（fontStrikethrough=false）
    - 测试「需求6.5 - 撤销重做」：设置删除线后 Ctrl+Z 撤销，验证 fontStrikethrough 恢复为 false；Ctrl+Y 重做，验证重新设置为 true
    - 测试「需求6.6 - 按钮高亮」：选中已设置删除线的单元格，验证按钮有 `active` CSS 类；选中未设置的单元格，验证按钮无 `active` 类
    - _需求: 6.1-6.6_

  - [x] 10.5 创建 `e2e/border-toolbar-panel.spec.ts` 工具栏边框面板完整测试
    - 测试「需求7.1 - 边框按钮」：验证工具栏第一行存在边框操作按钮，点击后展开下拉面板
    - 测试「需求7.2 - 八个位置选项」：验证下拉面板包含上/下/左/右/全部/外框/内框/清除八个选项，每个带图标
    - 测试「需求7.3 - 线型选择区域」：验证面板包含实线/虚线/点线/双线四种线型可视化图标
    - 测试「需求7.4 - 颜色选择器」：验证面板包含颜色选择器，显示当前颜色色块预览
    - 测试「需求7.5 - 点击应用」：点击边框位置选项后验证边框被应用且下拉面板自动关闭
    - 测试「需求7.6 - 外部点击关闭」：展开面板后点击面板外部区域，验证面板自动关闭
    - 测试「需求7.7 - 样式一致性」：验证边框下拉面板的 CSS 样式与现有下拉面板（字体大小、数字格式）风格一致
    - 测试「需求7.8 - 中文标签」：验证边框按钮使用简体中文标签"边框"
    - _需求: 7.1-7.8_

  - [x] 10.6 创建 `e2e/border-persistence.spec.ts` 数据持久化测试
    - 测试「需求8.1 - JSON 导出」：设置边框/字体族/删除线后导出 JSON，验证导出数据包含 `border`、`fontFamily`、`fontStrikethrough` 属性
    - 测试「需求8.2 - JSON 导入」：导入包含边框/字体族/删除线数据的 JSON，验证单元格属性正确恢复
    - 测试「需求8.3 - LocalStorage」：设置样式后刷新页面，验证 LocalStorage 中的数据包含边框/字体族/删除线信息，页面恢复后样式保持
    - 测试「需求8.4 - 往返一致性」：设置复杂边框（不同线型、颜色）+ 字体族 + 删除线，导出 JSON 后清空数据再导入，验证所有属性与原始数据完全一致
    - _需求: 8.1-8.4_

  - [x] 10.7 创建 `e2e/border-format-painter.spec.ts` 格式刷集成测试
    - 测试「需求9.1 - 格式刷复制」：A1 设置边框+字体族+删除线，使用格式刷复制 A1 格式，验证格式数据包含 border/fontFamily/fontStrikethrough
    - 测试「需求9.2 - 格式刷应用」：格式刷复制 A1 后应用到 B1，验证 B1 的 border/fontFamily/fontStrikethrough 与 A1 一致
    - 测试「需求9.3 - 格式刷区域应用」：格式刷复制后应用到 B1:C2 区域，验证区域内所有单元格格式一致
    - _需求: 9.1-9.3_

  - [x] 10.8 创建 `e2e/border-clipboard.spec.ts` 剪贴板集成测试
    - 测试「需求10.1 - ClipboardCellData 扩展」：复制含边框/字体族/删除线的单元格，通过 `evaluate` 验证内部剪贴板数据包含 border/fontFamily/fontStrikethrough
    - 测试「需求10.2 - 复制」：A1 设置边框+字体族+删除线后 Ctrl+C 复制，验证内部剪贴板存储了完整格式数据
    - 测试「需求10.3 - 粘贴」：复制 A1 后 Ctrl+V 粘贴到 B1，验证 B1 的 border/fontFamily/fontStrikethrough 与 A1 一致
    - 测试「需求10.4 - 仅粘贴格式」：A1 有内容+边框+字体族，B1 有不同内容，执行"仅粘贴格式"到 B1，验证 B1 内容不变但格式（border/fontFamily/fontStrikethrough）与 A1 一致
    - _需求: 10.1-10.4_

  - [x] 10.9 创建 `e2e/border-undo-redo.spec.ts` 撤销重做完整测试
    - 测试「需求2.6 - 边框撤销重做」：设置全部边框 → Ctrl+Z 撤销验证边框移除 → Ctrl+Y 重做验证边框恢复
    - 测试「需求2.6 - 外框边框撤销」：设置外框边框 → 撤销 → 验证外框边框移除
    - 测试「需求2.6 - 清除边框撤销」：设置边框 → 清除边框 → 撤销清除 → 验证边框恢复
    - 测试「需求5.6 - 字体族撤销重做」：设置字体族为 Arial → 撤销验证恢复默认 → 重做验证重新设置为 Arial
    - 测试「需求6.5 - 删除线撤销重做」：启用删除线 → 撤销验证取消 → 重做验证重新启用
    - 测试「连续操作撤销」：依次设置边框、字体族、删除线，连续三次 Ctrl+Z 验证全部撤销
    - _需求: 2.6, 5.6, 6.5_

  - [x] 10.10 创建 `e2e/border-collab.spec.ts` 协同编辑集成测试
    - 测试「需求11.1 - 操作类型」：通过 `evaluate` 验证协同操作类型包含 `setBorder`、`setFontFamily`、`setStrikethrough`
    - 测试「需求11.2 - 边框协同提交」：协同模式下设置边框，通过 `evaluate` 验证 CollaborationEngine 提交了 `setBorder` 操作
    - 测试「需求11.3 - 字体族协同提交」：协同模式下设置字体族，验证提交了 `setFontFamily` 操作
    - 测试「需求11.4 - 删除线协同提交」：协同模式下设置删除线，验证提交了 `setStrikethrough` 操作
    - 测试「需求11.5 - 远程操作应用」：模拟收到远程 `setBorder`/`setFontFamily`/`setStrikethrough` 操作，验证本地模型更新并触发重新渲染
    - _需求: 11.1-11.5_

- [x] 11. MCP 浏览器可视化验证测试 — 100% 需求覆盖
  - [x] 11.1 使用 Chrome DevTools MCP 验证工具栏 UI（需求 7 全覆盖）
    - 启动开发服务器，通过 `mcp_chrome_devtools_navigate_page` 打开应用页面
    - 通过 `mcp_chrome_devtools_take_snapshot` 获取页面快照，确认工具栏第一行存在边框按钮（中文标签"边框"）、字体族下拉、删除线按钮（"S" 带中划线）
    - 通过 `mcp_chrome_devtools_click` 点击边框按钮，`take_snapshot` 验证下拉面板包含八个边框位置选项（上/下/左/右/全部/外框/内框/清除）
    - 验证面板包含四种线型选择图标（实线/虚线/点线/双线）和颜色选择器
    - 通过 `mcp_chrome_devtools_take_screenshot` 截图保存边框下拉面板展开状态到 `e2e/screenshots/border-panel-open.png`
    - 点击面板外部区域，验证面板自动关闭
    - 通过 `mcp_chrome_devtools_click` 点击字体族下拉，`take_snapshot` 验证包含全部 7 种预设字体选项
    - 通过 `mcp_chrome_devtools_take_screenshot` 截图保存字体族下拉展开状态到 `e2e/screenshots/font-family-panel.png`
    - _需求: 5.2, 6.2, 7.1-7.8_

  - [x] 11.2 使用 Chrome DevTools MCP 验证边框批量设置与渲染（需求 1-4 全覆盖）
    - 通过 `mcp_chrome_devtools_click` 点击 Canvas 选中 A1 单元格，输入文本内容
    - 选中 A1:C3 区域（Shift+点击 C3），点击边框按钮选择"全部边框"
    - 通过 `mcp_chrome_devtools_take_screenshot` 截图验证全部边框渲染效果，保存到 `e2e/screenshots/border-all.png`
    - 通过 `mcp_chrome_devtools_evaluate_script` 执行 `window.app.getModel().getCell(0,0)` 验证 border 属性包含 top/bottom/left/right，每条边包含 style/color/width
    - 清除边框后选择"外框边框"，截图验证仅外圈有边框，保存到 `e2e/screenshots/border-outer.png`
    - 通过 `evaluate_script` 验证内部单元格（1,1）无边框，外圈单元格有对应方向边框
    - 清除后选择"内框边框"，截图验证仅内部有边框，保存到 `e2e/screenshots/border-inner.png`
    - 分别测试上/下/左/右单边边框，每次通过 `evaluate_script` 验证仅对应方向有边框
    - 在线型选择区域切换为虚线，应用边框后 `evaluate_script` 验证 `border.top.style === 'dashed'`
    - 切换为点线，验证 `style === 'dotted'`；切换为双线，验证 `style === 'double'`
    - 通过颜色选择器设置颜色为红色，应用后 `evaluate_script` 验证 `border.top.color` 为红色值
    - 通过 `mcp_chrome_devtools_take_screenshot` 截图验证不同线型和颜色的渲染效果，保存到 `e2e/screenshots/border-styles.png`
    - _需求: 1.1-1.6, 2.1-2.5, 3.1-3.4, 4.1-4.6_

  - [x] 11.3 使用 Chrome DevTools MCP 验证边框高级渲染场景（需求 4.7-4.9, 2.6-2.7）
    - 设置 A1 边框宽度为 2，B1 边框宽度为 1，通过 `take_screenshot` 截图验证共享边渲染宽度 2 的边框
    - 通过 `evaluate_script` 验证相邻边框冲突解决逻辑正确
    - 滚动到远离视口的区域（第 100 行），通过 `evaluate_script` 设置该区域边框，截图验证虚拟滚动下边框正确渲染
    - 冻结首行后设置首行边框，向下滚动，截图验证冻结区域边框固定渲染，保存到 `e2e/screenshots/border-frozen.png`
    - 合并 A1:B2 后设置全部边框，通过 `evaluate_script` 验证父单元格有边框，子单元格无独立边框
    - 设置边框后 Ctrl+Z 撤销，`evaluate_script` 验证边框移除；Ctrl+Y 重做，验证边框恢复
    - _需求: 2.6, 2.7, 4.7, 4.8, 4.9_

  - [x] 11.4 使用 Chrome DevTools MCP 验证字体族完整功能（需求 5 全覆盖）
    - 在 A1 输入文本，通过 `mcp_chrome_devtools_click` 选择字体族下拉中的 "Arial"
    - 通过 `evaluate_script` 验证 `getCell(0,0).fontFamily === 'Arial'`
    - 通过 `take_screenshot` 截图验证 Arial 字体渲染效果，保存到 `e2e/screenshots/font-arial.png`
    - 选择其他字体（宋体、微软雅黑等），分别截图验证渲染效果
    - 选中已设置 Arial 的单元格，通过 `take_snapshot` 验证字体族下拉显示 "Arial"
    - 选中多个不同字体族的单元格，验证下拉显示为空
    - 未设置 fontFamily 的单元格，截图验证使用默认字体族渲染
    - 设置字体族后 Ctrl+Z 撤销，`evaluate_script` 验证 fontFamily 恢复；Ctrl+Y 重做验证重新设置
    - _需求: 5.1-5.7_

  - [x] 11.5 使用 Chrome DevTools MCP 验证删除线完整功能（需求 6 全覆盖）
    - 在 A1 输入文本，通过 `mcp_chrome_devtools_click` 点击删除线按钮
    - 通过 `evaluate_script` 验证 `getCell(0,0).fontStrikethrough === true`
    - 通过 `take_snapshot` 验证删除线按钮有 `active` CSS 类
    - 通过 `take_screenshot` 截图验证文本中心有水平删除线，保存到 `e2e/screenshots/strikethrough.png`
    - 再次点击删除线按钮，`evaluate_script` 验证 `fontStrikethrough === false`，`take_snapshot` 验证按钮无 `active` 类
    - 选中未设置删除线的单元格，验证按钮无 `active` 类
    - 设置删除线后 Ctrl+Z 撤销，验证取消；Ctrl+Y 重做，验证重新启用
    - _需求: 6.1-6.6_

  - [x] 11.6 使用 Chrome DevTools MCP 验证数据持久化（需求 8 全覆盖）
    - 设置边框+字体族+删除线后，通过 `evaluate_script` 调用导出 JSON 方法，验证导出数据包含 border/fontFamily/fontStrikethrough
    - 通过 `evaluate_script` 清空数据后导入刚才导出的 JSON，验证所有属性正确恢复（往返一致性）
    - 设置样式后通过 `mcp_chrome_devtools_navigate_page` 刷新页面，验证 LocalStorage 持久化后样式保持
    - 通过 `evaluate_script` 读取 LocalStorage 数据，验证包含边框/字体族/删除线信息
    - _需求: 8.1-8.4_

  - [x] 11.7 使用 Chrome DevTools MCP 验证格式刷与剪贴板集成（需求 9-10 全覆盖）
    - A1 设置边框+字体族+删除线，使用格式刷复制 A1 格式并应用到 B1
    - 通过 `evaluate_script` 验证 B1 的 border/fontFamily/fontStrikethrough 与 A1 一致
    - A1 设置样式后 Ctrl+C 复制，选中 C1 后 Ctrl+V 粘贴
    - 通过 `evaluate_script` 验证 C1 的 border/fontFamily/fontStrikethrough 与 A1 一致
    - D1 输入不同内容，执行"仅粘贴格式"到 D1，验证 D1 内容不变但格式与 A1 一致
    - 通过 `take_screenshot` 截图验证格式刷和粘贴后的渲染效果，保存到 `e2e/screenshots/border-format-painter.png`
    - _需求: 9.1-9.3, 10.1-10.4_

  - [x] 11.8 使用 Chrome DevTools MCP 验证协同编辑集成（需求 11 全覆盖）
    - 通过 `evaluate_script` 验证协同操作类型包含 `setBorder`、`setFontFamily`、`setStrikethrough`
    - 协同模式下设置边框，通过 `evaluate_script` 监听 CollaborationEngine 验证提交了 `setBorder` 操作，包含正确的单元格位置和边框配置
    - 协同模式下设置字体族，验证提交了 `setFontFamily` 操作，包含字体族名称
    - 协同模式下设置删除线，验证提交了 `setStrikethrough` 操作，包含删除线状态
    - 通过 `evaluate_script` 模拟收到远程 `setBorder` 操作，验证本地模型更新且 Canvas 重新渲染
    - 模拟收到远程 `setFontFamily` 和 `setStrikethrough` 操作，验证本地模型更新
    - 通过 `take_screenshot` 截图验证远程操作应用后的渲染效果
    - _需求: 11.1-11.5_

- [x] 12. 最终检查点 - 全部功能与测试完成（100% 需求覆盖验证）
  - 确保所有功能正常工作：边框设置与渲染、字体族选择、删除线切换、撤销/重做、格式刷、剪贴板、数据持久化、协同编辑集成。
  - 确保 E2E 测试（10 个测试文件）全部通过，覆盖全部 11 个需求的所有验收标准。
  - 确保 MCP 浏览器验证（8 个验证任务）截图符合预期，覆盖全部 11 个需求。
  - 询问用户是否有疑问。

- [-] 13. 提交代码
  - 使用 `git add` 添加所有变更文件
  - 使用 `git commit` 提交代码，提交信息为中文，格式：`feat: 实现单元格边框与样式功能（边框设置/字体族选择/删除线/格式刷/剪贴板/协同编辑集成）`

## 备注

- 所有任务引用的需求编号对应 `requirements.md` 中的验收标准
- 检查点任务用于阶段性验证，确保增量开发的正确性
- 实现过程中所有上下文文档（需求、设计）均可参考
