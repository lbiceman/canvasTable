# 实现计划：排序与筛选

## 概述

基于行索引映射（RowIndexMap）实现排序与筛选功能，不修改原始数据顺序。新增 `src/sort-filter/` 模块目录，包含类型定义、排序引擎、筛选引擎、数据模型、筛选下拉菜单和列头指示器。按增量方式实现：先核心类型和引擎，再数据模型，然后 UI 组件，最后集成到现有 MVC 架构。

## 任务

- [x] 1. 定义排序筛选类型并实现排序引擎
  - [x] 1.1 创建 `src/sort-filter/types.ts`，定义 SortDirection、SortDataType、SortRule、TextFilterOperator、NumberFilterOperator、DateFilterOperator、FilterCriterion、FilterLogic、ColumnFilter、SortFilterSnapshot 等类型
    - 使用 `type` 定义联合类型，`interface` 定义对象类型
    - 禁止使用 `any`，所有类型显式声明
    - _需求: 1.1, 2.3, 5.1, 5.2, 5.3, 6.1_

  - [x] 1.2 创建 `src/sort-filter/sort-engine.ts`，实现 SortEngine 静态类
    - 实现 `sort(rows, rules, cellGetter)` 方法：根据排序规则对行索引数组排序
    - 实现 `compareCellValues(a, b, direction)` 方法：支持数字（数值比较）、日期（时间戳比较）、文本（Unicode 比较）三种类型
    - 实现 `inferDataType(cell)` 方法：推断单元格的比较类型
    - 空单元格始终排在末尾，无论升序或降序
    - 多列排序按规则列表顺序依次比较
    - _需求: 2.1, 2.2, 2.3, 2.4, 3.2_

  - [ ]* 1.3 编写 SortEngine 属性测试 `src/__tests__/sort-engine.test.ts`
    - **Property 3: 排序结果有序性** — 排序后相邻行在排序列上的值满足排序方向的顺序关系，空值排末尾
    - **Validates: Requirements 2.1, 2.2, 2.4**
    - **Property 4: 多列排序优先级** — 多条规则按顺序依次比较
    - **Validates: Requirements 3.2**
    - **Property 5: 比较函数传递性** — compareCellValues(a,b)≤0 且 compareCellValues(b,c)≤0 则 compareCellValues(a,c)≤0
    - **Validates: Requirements 2.3**

- [x] 2. 实现筛选引擎
  - [x] 2.1 创建 `src/sort-filter/filter-engine.ts`，实现 FilterEngine 静态类
    - 实现 `filterRows(totalRows, filters, cellGetter)` 方法：根据筛选条件计算可见行索引数组
    - 实现 `evaluateCondition(cellValue, condition)` 方法：评估单个筛选条件（文本/数字/日期）
    - 实现 `evaluateColumnFilter(cellValue, filter)` 方法：评估列的复合筛选条件（AND/OR 逻辑）
    - 实现 `inferFilterType(values)` 方法：根据列数据推断可用筛选类型
    - 实现 `getUniqueValues(colIndex, totalRows, cellGetter)` 方法：获取列的唯一值列表
    - 多列筛选之间使用 AND 逻辑组合
    - _需求: 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3_

  - [ ]* 2.2 编写 FilterEngine 属性测试 `src/__tests__/filter-engine.test.ts`
    - **Property 7: 筛选条件匹配正确性** — 文本/数字/日期筛选条件的评估结果与对应语义一致
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - **Property 8: 同列多条件逻辑组合** — AND 时所有条件满足才为 true，OR 时至少一个满足即为 true
    - **Validates: Requirements 6.1**
    - **Property 9: 唯一值列表完整性** — 返回值包含所有非空单元格的去重值，无重复
    - **Validates: Requirements 4.2**
    - **Property 10: 筛选类型推断正确性** — 全数字返回 number，全日期返回 date，否则返回 text
    - **Validates: Requirements 5.5**
    - **Property 11: 多条件逻辑组合正确性** — evaluateColumnFilter 结果等于条件评估结果的逻辑与/或
    - **Validates: Requirements 6.1**
    - **Property 12: 多列筛选 AND 组合** — 可见行满足每列筛选条件，等于各列独立筛选结果的交集
    - **Validates: Requirements 6.2**

- [x] 3. 检查点 - 确保排序引擎和筛选引擎测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. 实现排序筛选数据模型
  - [x] 4.1 创建 `src/sort-filter/sort-filter-model.ts`，实现 SortFilterModel 类
    - 维护 sortRules、filterConditions（Map<number, ColumnFilter>）、rowIndexMap、reverseMap
    - 实现排序操作：setSingleSort、addSortRule、removeSortRule、clearSort、getSortRules
    - 实现筛选操作：setColumnFilter、clearColumnFilter、clearAllFilters、getColumnFilter、getAllFilters、hasActiveFilters、hasActiveSort
    - 实现行索引映射：getDataRowIndex、getDisplayRowIndex（隐藏行返回 -1）、getVisibleRowCount、getTotalRowCount、getRowIndexMap
    - 实现 recalculate()：先筛选确定可见行，再对可见行排序，生成 RowIndexMap
    - 实现快照：getSnapshot、restoreSnapshot（用于撤销/重做）
    - 实现 getUniqueValues(colIndex)：供 FilterDropdown 使用
    - 无排序筛选时 RowIndexMap 为恒等映射
    - 构造函数接收 SpreadsheetModel 引用
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.3, 3.4, 3.5, 6.4, 6.5, 8.1_

  - [ ]* 4.2 编写 SortFilterModel 属性测试 `src/__tests__/sort-filter-model.test.ts`
    - **Property 1: 无排序筛选时为恒等映射** — 清除所有规则后 getDataRowIndex(i) === i
    - **Validates: Requirements 1.2**
    - **Property 2: 行索引映射的双向一致性** — getDisplayRowIndex(getDataRowIndex(d)) === d，隐藏行返回 -1
    - **Validates: Requirements 1.5**
    - **Property 6: 清除排序与筛选恢复恒等映射** — 无论之前状态如何，清除后恢复恒等映射
    - **Validates: Requirements 3.5, 6.5**
    - **Property 13: 筛选先行排序后置** — recalculate 结果等价于先筛选再排序
    - **Validates: Requirements 8.1**
    - **Property 15: 撤销/重做快照往返** — getSnapshot → restoreSnapshot 后状态完全一致
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [x] 5. 检查点 - 确保数据模型测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 6. 集成排序筛选模型到现有架构
  - [x] 6.1 扩展 `src/model.ts`（SpreadsheetModel）
    - 新增 `public readonly sortFilterModel: SortFilterModel` 属性，在构造函数中初始化
    - 新增 `getCellByDisplayRow(displayRow, col)` 方法：通过 RowIndexMap 映射后获取单元格
    - _需求: 1.4, 8.4_

  - [x] 6.2 扩展 `src/history-manager.ts`（HistoryManager）
    - 在 ActionType 联合类型中新增 `'setSort'` 和 `'setFilter'`
    - 撤销/重做数据结构使用 SortFilterSnapshot
    - _需求: 9.1, 9.2_

  - [x] 6.3 修改 `src/renderer.ts`（SpreadsheetRenderer）渲染逻辑
    - 新增 `setSortFilterModel(model)` 方法，存储 SortFilterModel 引用
    - 修改 `renderCells()`：当排序/筛选激活时，遍历 RowIndexMap 而非连续行索引
    - 修改 `renderRowHeaders()`：筛选激活时显示实际数据行号（非连续），提示隐藏行
    - 筛选导致所有行隐藏时，在数据区域显示"无匹配结果"提示文本
    - _需求: 2.5, 7.3, 7.4, 7.5_

- [x] 7. 实现列头指示器（Canvas 渲染）
  - [x] 7.1 创建 `src/sort-filter/column-header-indicator.ts`，实现 ColumnHeaderIndicator 静态类
    - 实现 `renderFilterIcon(ctx, x, y, width, height, isActive)` 方法：绘制筛选漏斗图标，激活时使用不同颜色
    - 实现 `renderSortArrow(ctx, x, y, width, height, direction)` 方法：绘制排序方向箭头（升序向上、降序向下）
    - 实现 `hitTestFilterIcon(clickX, clickY, colX, colY, colWidth, headerHeight)` 方法：检测点击是否命中筛选图标区域
    - _需求: 7.1, 7.2_

  - [x] 7.2 修改 `src/renderer.ts` 的 `renderColHeaders()` 方法
    - 在列头区域调用 ColumnHeaderIndicator 渲染排序/筛选状态图标
    - 从 SortFilterModel 读取各列的排序方向和筛选激活状态
    - _需求: 7.1, 7.2_

- [x] 8. 实现筛选下拉菜单（DOM 组件）
  - [x] 8.1 创建 `src/sort-filter/filter-dropdown.ts`，实现 FilterDropdown 类
    - 使用原生 DOM 构建筛选面板（不依赖 UI 框架）
    - 包含排序按钮区域：升序排序、降序排序
    - 包含值筛选区域：显示列的所有唯一值复选框列表，默认全选
    - 包含搜索输入框：实时过滤复选框列表中的选项
    - 包含"全选"和"清除"快捷操作按钮
    - 包含条件筛选区域：根据列数据类型显示文本/数字/日期筛选条件选项
    - 包含确认和取消按钮
    - 实现 `show(x, y, colIndex)` 方法：在指定位置显示下拉菜单
    - 实现 `hide()` 方法：关闭菜单
    - 点击外部区域时关闭且不应用更改
    - UI 文本使用简体中文
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3_

  - [x] 8.2 在 `src/style.css` 中添加筛选下拉菜单样式
    - 使用 CSS 变量适配明暗主题
    - 复选框列表、搜索框、条件筛选区域的布局样式
    - _需求: 4.1_

- [x] 9. 集成排序筛选交互到控制器
  - [x] 9.1 修改 `src/app.ts`（SpreadsheetApp）集成排序筛选
    - 初始化 FilterDropdown 实例和 SortFilterModel
    - 将 SortFilterModel 设置到 SpreadsheetRenderer
    - 在列头鼠标事件中检测筛选图标点击，调用 FilterDropdown.show()
    - 实现 handleSort(colIndex, direction)：记录旧快照到撤销栈，应用排序，触发重新渲染
    - 实现 handleFilterApply()：记录旧快照到撤销栈，应用筛选，触发重新渲染
    - 排序/筛选状态变化时更新选区和活跃单元格位置映射
    - 在状态栏显示筛选摘要信息（"显示 M / N 行"）
    - _需求: 4.1, 7.3, 8.2, 8.3_

  - [x] 9.2 修改 `src/app.ts` 撤销/重做逻辑支持排序筛选
    - 在 handleUndo/handleRedo 中处理 'setSort' 和 'setFilter' 类型
    - 从 HistoryAction 中恢复 SortFilterSnapshot，调用 restoreSnapshot
    - 恢复后重新计算 RowIndexMap 并触发渲染
    - _需求: 9.1, 9.2, 9.3, 9.4_

  - [x] 9.3 修改 `src/app.ts` 单元格编辑逻辑适配排序筛选
    - 单元格编辑时通过 RowIndexMap 映射到正确的数据行
    - 编辑后值不满足筛选条件时，下次刷新隐藏该行
    - _需求: 8.4, 8.5_

- [x] 10. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 11. 集成测试与筛选后编辑验证
  - [ ]* 11.1 编写集成属性测试 `src/__tests__/sort-filter-integration.test.ts`
    - **Property 14: 编辑后筛选一致性** — 修改可见行使其不满足筛选条件后，重新计算时该行从可见行移除
    - **Validates: Requirements 8.5**
    - **Property 8 (值筛选): 值筛选正确性** — 筛选后可见行的列值属于选中值集合，隐藏行不属于
    - **Validates: Requirements 4.3**

  - [ ]* 11.2 编写单元测试覆盖边界情况
    - 空表格排序/筛选不报错
    - 排序列超出范围时忽略该规则
    - 筛选导致所有行隐藏时 RowIndexMap 为空
    - getDataRowIndex/getDisplayRowIndex 越界返回 -1
    - between 条件 value > value2 时自动交换
    - 混合数据类型排序的正确处理

- [x] 12. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号，确保需求可追溯
- 属性测试验证通用正确性属性，单元测试聚焦边界情况
- 检查点确保增量验证，及时发现问题
- 所有 UI 文本使用简体中文，代码注释使用中文
- 禁止使用 `any` 类型，使用 `interface` 定义对象类型
