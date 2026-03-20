# 实施计划：选区与编辑增强

## 概述

基于设计文档，将 11 项选区与编辑增强功能分解为增量实施步骤。每个步骤构建在前一步骤之上，优先实现核心基础设施（类型定义、多选区管理），再逐步实现各功能模块，最后统一集成与连线。使用 TypeScript strict 模式，fast-check 进行属性测试。

## Tasks

- [x] 1. 扩展类型定义与 HistoryManager
  - [x] 1.1 在 `src/types.ts` 中新增所有接口和类型定义
    - 新增 `MultiSelectionState`、`FreezeConfig`、`RowColumnGroup`、`FillDirection`、`FillPattern`、`PasteSpecialMode`、`ClipboardCellData`、`InternalClipboard` 接口/类型
    - _需求: 1.1, 1.7, 4.4, 6.1, 6.6, 9.1, 11.1_
  - [x] 1.2 在 `src/history-manager.ts` 中扩展 ActionType
    - 新增 `batchDeleteRows`、`batchDeleteCols`、`hideRows`、`hideCols`、`unhideRows`、`unhideCols`、`createGroup`、`removeGroup`、`collapseGroup`、`expandGroup`、`freeze`、`fill`、`dragMove`、`pasteSpecial`、`replace`、`replaceAll` 类型
    - _需求: 4.9, 5.5, 6.7, 7.6, 8.6, 10.8, 11.9_

- [x] 2. 实现 MultiSelectionManager
  - [x] 2.1 创建 `src/multi-selection.ts`，实现 MultiSelectionManager 类
    - 实现 `setSingle`、`addSelection`、`getSelections`、`getActiveSelection`、`getAllCells`、`containsCell`、`clear`、`getCount`、`selectAll`、`isSelectAll` 方法
    - _需求: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 3.1_
  - [ ]* 2.2 编写属性测试：添加选区保留已有选区
    - **Property 1: 添加选区保留已有选区**
    - **验证: 需求 1.1, 1.2**
  - [ ]* 2.3 编写属性测试：非 Ctrl 点击重置为单选区
    - **Property 2: 非 Ctrl 点击重置为单选区**
    - **验证: 需求 1.3**
  - [ ]* 2.4 编写属性测试：活动选区始终指向最后添加的选区
    - **Property 4: 活动选区始终指向最后添加的选区**
    - **验证: 需求 1.7**
  - [ ]* 2.5 编写属性测试：全选覆盖整个工作表
    - **Property 7: 全选覆盖整个工作表**
    - **验证: 需求 3.1**

- [x] 3. 实现 FillSeriesEngine
  - [x] 3.1 创建 `src/fill-series.ts`，实现 FillSeriesEngine 类
    - 实现 `inferPattern` 静态方法：数字等差推断、日期间隔推断、文本复制模式
    - 实现 `generate` 静态方法：根据模式和方向生成填充数据
    - _需求: 4.4, 4.5, 4.6, 4.7, 4.8_
  - [ ]* 3.2 编写属性测试：数字序列填充保持等差模式
    - **Property 8: 数字序列填充保持等差模式**
    - **验证: 需求 4.4, 4.7, 4.8**
  - [ ]* 3.3 编写属性测试：日期序列填充保持等间隔模式
    - **Property 9: 日期序列填充保持等间隔模式**
    - **验证: 需求 4.5**
  - [ ]* 3.4 编写属性测试：文本填充为循环复制
    - **Property 10: 文本填充为循环复制**
    - **验证: 需求 4.6**

- [x] 4. 实现 GroupManager
  - [x] 4.1 创建 `src/group-manager.ts`，实现 GroupManager 类
    - 实现 `createRowGroup`、`createColGroup`、`removeGroup`、`collapseGroup`、`expandGroup`、`getGroupsAt`、`getMaxLevel`、`getRowGroups`、`getColGroups` 方法
    - 嵌套层级自动计算，上限 8 级
    - _需求: 11.1, 11.2, 11.4, 11.5, 11.6, 11.8_
  - [ ]* 4.2 编写属性测试：分组创建/移除的往返一致性
    - **Property 20: 分组创建/移除的往返一致性**
    - **验证: 需求 11.1, 11.2, 11.8**
  - [ ]* 4.3 编写属性测试：嵌套分组层级正确计算且不超过上限
    - **Property 22: 嵌套分组层级正确计算且不超过上限**
    - **验证: 需求 11.6**

- [x] 5. Checkpoint - 确保所有基础模块测试通过
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 6. 扩展 SpreadsheetModel（隐藏行列、冻结、批量删除、填充）
  - [x] 6.1 在 `src/model.ts` 中新增隐藏行列管理
    - 新增 `hiddenRows`/`hiddenCols` Set 属性
    - 实现 `hideRows`、`hideCols`、`unhideRows`、`unhideCols`、`isRowHidden`、`isColHidden`、`getHiddenRows`、`getHiddenCols` 方法
    - 坐标计算方法中排除隐藏行列
    - _需求: 10.1, 10.2, 10.6, 10.9_
  - [ ]* 6.2 编写属性测试：隐藏/取消隐藏的往返一致性
    - **Property 18: 隐藏/取消隐藏的往返一致性**
    - **验证: 需求 10.1, 10.2, 10.6**
  - [ ]* 6.3 编写属性测试：隐藏行列排除于坐标计算
    - **Property 19: 隐藏行列排除于坐标计算**
    - **验证: 需求 10.9**
  - [x] 6.4 在 `src/model.ts` 中新增冻结窗格配置
    - 新增 `freezeRows`/`freezeCols` 属性及 getter/setter
    - _需求: 9.1, 9.5, 9.6, 9.7, 9.8_
  - [ ]* 6.5 编写属性测试：冻结至当前单元格设置正确
    - **Property 17: 冻结至当前单元格设置正确**
    - **验证: 需求 9.7**
  - [x] 6.6 在 `src/model.ts` 中新增批量删除行/列方法
    - 实现 `batchDeleteRows`、`batchDeleteColumns` 方法
    - 逆序删除避免索引偏移，检查剩余行列数 ≥ 1
    - 整个批量操作作为单个 HistoryAction 记录
    - _需求: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7_
  - [ ]* 6.7 编写属性测试：批量删除保留非删除数据
    - **Property 16: 批量删除保留非删除数据**
    - **验证: 需求 8.1, 8.2, 8.3, 8.4**
  - [x] 6.8 在 `src/model.ts` 中集成 GroupManager 和填充操作
    - 实例化 GroupManager，暴露分组操作方法
    - 新增 `fillRange` 方法调用 FillSeriesEngine 执行填充并记录历史
    - _需求: 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 11.1, 11.2, 11.4, 11.5, 11.9_
  - [x] 6.9 扩展 `exportToJSON`/`importFromJSON` 序列化隐藏行列、冻结配置、分组数据
    - _需求: 10.1, 9.1, 11.1_

- [x] 7. Checkpoint - 确保 Model 层测试通过
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 8. 扩展 SpreadsheetRenderer（多选区、填充柄、冻结、隐藏指示符、分组按钮）
  - [x] 8.1 在 `src/renderer.ts` 中实现多选区渲染
    - 新增 `setMultiSelection` 方法接收选区数组和活动索引
    - 修改 `renderSelection` 遍历所有选区分别绘制背景和边框
    - 活动选区使用 `selectionBorder` 颜色，非活动选区使用半透明变体
    - _需求: 1.4_
  - [x] 8.2 在 `src/renderer.ts` 中实现填充柄绘制
    - 在活动选区右下角绘制 6×6 像素方块，使用 `themeColors.selectionBorder` 颜色
    - 鼠标悬停时变为十字光标（crosshair）
    - _需求: 4.1, 4.2_
  - [x] 8.3 在 `src/renderer.ts` 中实现冻结窗格分区渲染
    - 将画布分为四个区域（冻结角、冻结行、冻结列、正常滚动）
    - 使用 `ctx.save()`/`ctx.clip()`/`ctx.restore()` 限制各区域绘制范围
    - 在冻结边界绘制分隔线
    - _需求: 9.1, 9.2, 9.3, 9.4, 9.9_
  - [x] 8.4 在 `src/renderer.ts` 中实现隐藏行列指示符渲染
    - 视口计算和坐标方法中跳过隐藏行列
    - 在隐藏行列的相邻标题之间绘制双线指示符
    - _需求: 10.3, 10.4, 10.5_
  - [x] 8.5 在 `src/renderer.ts` 中实现分组折叠按钮渲染
    - 行标题左侧预留分组指示区域（宽度 = maxLevel × 16px）
    - 绘制层级指示线和折叠/展开按钮（-/+ 图标，12×12px）
    - _需求: 11.3, 11.7_

- [x] 9. 扩展 SearchDialog（查找与替换）
  - [x] 9.1 在 `src/search-dialog.ts` 中扩展替换功能
    - 新增替换输入框、"替换"按钮、"全部替换"按钮
    - 新增 `mode` 属性支持 `'find'` 和 `'findReplace'` 两种模式
    - `show(mode?)` 方法支持 Ctrl+F 打开查找模式、Ctrl+H 打开查找替换模式
    - 新增 `setReplaceHandler` 和 `setReplaceAllHandler` 回调
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7_
  - [ ]* 9.2 编写属性测试：全部替换消除所有匹配
    - **Property 11: 全部替换消除所有匹配**
    - **验证: 需求 5.2, 5.3**

- [x] 10. 实现 PasteSpecialDialog
  - [x] 10.1 创建 `src/paste-special-dialog.ts`，实现选择性粘贴对话框
    - 提供"仅粘贴值"、"仅粘贴格式"、"仅粘贴公式"、"转置粘贴"四个选项
    - 实现 `show`、`hide`、`setSelectHandler` 方法
    - UI 文本使用简体中文
    - _需求: 6.1_
  - [ ]* 10.2 编写属性测试：仅粘贴值不传递格式
    - **Property 12: 仅粘贴值不传递格式**
    - **验证: 需求 6.2**
  - [ ]* 10.3 编写属性测试：仅粘贴格式不修改内容
    - **Property 13: 仅粘贴格式不修改内容**
    - **验证: 需求 6.3**
  - [ ]* 10.4 编写属性测试：转置粘贴的对合性
    - **Property 14: 转置粘贴的对合性**
    - **验证: 需求 6.5**

- [x] 11. Checkpoint - 确保所有 UI 组件和属性测试通过
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 12. 集成多选区交互到 SpreadsheetApp
  - [x] 12.1 在 `src/app.ts` 中集成 MultiSelectionManager 替换 currentSelection
    - 将 `currentSelection: Selection | null` 替换为 `multiSelection: MultiSelectionManager`
    - 修改 `handleMouseDown`：检测 `event.ctrlKey`/`event.metaKey` 决定调用 `setSingle` 或 `addSelection`
    - 修改格式化操作遍历 `multiSelection.getAllCells()` 应用
    - 修改 Delete 操作清除所有选区内单元格内容
    - _需求: 1.1, 1.2, 1.3, 1.5, 1.6_
  - [x] 12.2 在 `src/app.ts` 中实现整行/整列选择交互
    - 行号点击：生成 startCol=0, endCol=maxCol 的选区
    - 列号点击：生成 startRow=0, endRow=maxRow 的选区
    - 支持 Ctrl+点击多选和 Shift+点击范围扩展
    - 行号区域拖拽连续选中整行
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [x] 12.3 在 `src/app.ts` 中实现全选（Ctrl+A）
    - 调用 `multiSelection.selectAll()`，高亮所有行列标题
    - 方向键按下时取消全选并定位到对应单元格
    - 调用 `event.preventDefault()` 阻止浏览器默认行为
    - _需求: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 12.4 编写属性测试：多选区操作应用到所有选区内的单元格
    - **Property 3: 多选区操作应用到所有选区内的单元格**
    - **验证: 需求 1.5, 1.6**
  - [ ]* 12.5 编写属性测试：整行/列选择覆盖范围
    - **Property 5: 整行/列选择覆盖所有列**
    - **验证: 需求 2.1, 2.2**
  - [ ]* 12.6 编写属性测试：Shift 点击扩展选区范围
    - **Property 6: Shift 点击扩展选区范围**
    - **验证: 需求 2.5, 2.6**

- [x] 13. 集成填充柄交互到 SpreadsheetApp
  - [x] 13.1 在 `src/app.ts` 中实现填充柄拖拽交互
    - `handleMouseDown`：检测点击是否在填充柄区域（选区右下角 ±4px），进入填充拖拽模式
    - `handleMouseMove`：填充拖拽模式下计算目标范围，绘制虚线预览边框
    - `handleMouseUp`：调用 FillSeriesEngine 推断模式并填充数据，记录到 HistoryManager
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

- [x] 14. 集成查找替换交互到 SpreadsheetApp
  - [x] 14.1 在 `src/app.ts` 中集成查找替换功能
    - 新增 Ctrl+H 快捷键打开查找替换模式
    - 实现替换回调：替换当前匹配单元格内容，记录到 HistoryManager
    - 实现全部替换回调：遍历所有匹配并替换，记录到 HistoryManager，返回替换计数
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 15. 集成选择性粘贴到 SpreadsheetApp
  - [x] 15.1 在 `src/app.ts` 中实现选择性粘贴交互
    - 扩展内部剪贴板为 `InternalClipboard` 结构，保存完整单元格信息
    - 新增 Ctrl+Shift+V 快捷键打开选择性粘贴对话框
    - 实现四种粘贴模式处理逻辑（仅值、仅格式、仅公式、转置）
    - 公式粘贴时根据偏移调整单元格引用
    - 记录到 HistoryManager
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 16. 集成拖拽移动到 SpreadsheetApp
  - [x] 16.1 在 `src/app.ts` 中实现拖拽移动交互
    - `handleMouseDown`：检测点击位置是否在选区边框上（±3px），进入拖拽移动模式
    - `handleMouseMove`：计算目标位置，渲染半透明预览
    - `handleMouseUp`：检查目标区域非空时弹出确认对话框，执行移动操作
    - 处理源区域与目标区域重叠的情况（先复制到临时缓冲区）
    - 记录到 HistoryManager
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [ ]* 16.2 编写属性测试：拖拽移动的数据守恒
    - **Property 15: 拖拽移动的数据守恒**
    - **验证: 需求 7.3**

- [x] 17. 集成批量删除、隐藏行列、冻结窗格、分组折叠到 SpreadsheetApp
  - [x] 17.1 在 `src/app.ts` 中实现批量删除行/列交互
    - 右键菜单新增"删除选中行"/"删除选中列"选项，仅在选中整行/整列时启用
    - 调用 `model.batchDeleteRows`/`model.batchDeleteColumns`
    - _需求: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  - [x] 17.2 在 `src/app.ts` 中实现隐藏行/列交互
    - 右键菜单新增"隐藏行"、"隐藏列"、"取消隐藏行"、"取消隐藏列"选项
    - 调用 `model.hideRows`/`model.hideCols`/`model.unhideRows`/`model.unhideCols`
    - 记录到 HistoryManager
    - _需求: 10.1, 10.2, 10.6, 10.7, 10.8_
  - [x] 17.3 在 `src/app.ts` 中实现冻结窗格菜单交互
    - 工具栏菜单提供"冻结首行"、"冻结首列"、"冻结至当前单元格"、"取消冻结"选项
    - 调用 `model.setFreezeRows`/`model.setFreezeCols`
    - _需求: 9.5, 9.6, 9.7, 9.8_
  - [x] 17.4 在 `src/app.ts` 中实现分组折叠交互
    - 右键菜单或工具栏提供"分组"、"取消分组"选项
    - 分组折叠/展开按钮点击事件处理
    - 折叠时调用 `model.hideRows`/`model.hideCols`，展开时调用 `unhideRows`/`unhideCols`
    - 记录到 HistoryManager
    - _需求: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_
  - [ ]* 17.5 编写属性测试：折叠/展开分组的往返一致性
    - **Property 21: 折叠/展开分组的往返一致性**
    - **验证: 需求 11.4, 11.5**

- [x] 18. Checkpoint - 确保所有集成功能测试通过
  - 确保所有测试通过，如有疑问请询问用户。

- [x] 19. 撤销/重做集成验证
  - [x] 19.1 在 `src/app.ts` 中扩展撤销/重做处理逻辑
    - 在 `handleUndo`/`handleRedo` 中新增对所有新 ActionType 的处理分支
    - 确保每种新操作的撤销/重做正确恢复数据
    - _需求: 4.9, 5.5, 6.7, 7.6, 8.6, 10.8, 11.9_
  - [ ]* 19.2 编写属性测试：撤销操作恢复原始状态
    - **Property 23: 撤销操作恢复原始状态**
    - **验证: 需求 4.9, 5.5, 6.7, 7.6, 8.6, 10.8, 11.9**

- [x] 20. 最终 Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有疑问请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号以确保可追溯性
- Checkpoint 任务确保增量验证
- 属性测试验证通用正确性属性，单元测试验证具体示例和边界条件
- 所有 UI 文本使用简体中文，代码注释使用中文
