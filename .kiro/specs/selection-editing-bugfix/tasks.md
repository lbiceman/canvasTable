# 实施计划

- [x] 1. 编写 Bug 条件探索测试（选区状态不一致）
  - **Property 1: Bug Condition** - 选区双状态源导致幽灵选区与位置错误
  - **CRITICAL**: 此测试必须在未修复代码上 FAIL — 失败即确认 bug 存在
  - **DO NOT** 在测试失败时尝试修复测试或代码
  - **NOTE**: 此测试编码了期望行为 — 修复后测试通过即验证修复正确
  - **GOAL**: 暴露反例，证明 `renderer.selection` 和 `renderer.multiSelections` 双状态源导致不一致
  - **Scoped PBT Approach**: 使用 fast-check 生成随机单元格坐标和操作类型（单击、拖拽、方向键、Tab、Enter、搜索导航），验证以下属性：
    - 对于任意选区操作，调用 `renderer.setSelection()` 后 `renderer.selection` 和 `renderer.multiSelections[0]` 应存储相同坐标（未修复代码会失败，因为两者存储不同值）
    - 对于 `handleReplace`/`handleReplaceAll`，正则转义字符串应生成有效的 `RegExp` 对象（未修复代码会失败，因为 UUID 替换导致无效正则）
  - 测试文件：`src/__tests__/selection-bugfix.test.ts`
  - 使用 vitest + fast-check 编写属性基测试
  - 需要使用 jsdom 环境模拟 Canvas API
  - 在未修复代码上运行测试
  - **EXPECTED OUTCOME**: 测试 FAIL（这是正确的 — 证明 bug 存在）
  - 记录发现的反例（如 `renderer.selection` 存储 `{0,0,2,2}` 而 `multiSelections[0]` 存储 `{0,0,1,1}`）
  - 任务完成条件：测试已编写、已运行、失败已记录
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. 编写保持性属性测试（修复前）
  - **Property 2: Preservation** - 非 Bug 条件功能行为保持不变
  - **IMPORTANT**: 遵循观察优先方法论
  - 观察：在未修复代码上运行以下非 bug 输入，记录实际输出：
    - Ctrl+点击多选区：`multiSelection.addSelection()` 后 `getSelections()` 返回多个选区
    - 行号点击选择整行：选区 `startCol=0, endCol=maxCol`
    - 列号点击选择整列：选区 `startRow=0, endRow=maxRow`
    - Ctrl+A 全选：`isSelectAll()` 返回 `true`
    - Delete 键删除：选区内单元格内容被清空
  - 使用 fast-check 生成随机非 bug 输入（Ctrl+点击坐标、行号/列号索引），编写属性基测试：
    - 对于任意 Ctrl+点击操作，`multiSelection.getSelections().length` 应递增
    - 对于任意行号点击，选区应覆盖整行（`startCol=0, endCol=maxCol`）
    - 对于任意列号点击，选区应覆盖整列（`startRow=0, endRow=maxRow`）
    - 对于 Ctrl+A，`isSelectAll()` 应返回 `true`
  - 测试文件：`src/__tests__/selection-preservation.test.ts`
  - 在未修复代码上运行测试
  - **EXPECTED OUTCOME**: 测试 PASS（确认基线行为可保持）
  - 任务完成条件：测试已编写、已运行、在未修复代码上通过
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. 修复选区双状态源与正则转义 Bug

  - [x] 3.1 修改 `renderer.ts` 中 `setMultiSelection()` 增加清除 `selection` 和触发渲染
    - 在 `setMultiSelection()` 方法中，设置 `multiSelections` 和 `activeSelectionIndex` 后，增加 `this.selection = null` 清除旧状态
    - 增加 `this.render()` 调用触发重绘，使 `setMultiSelection()` 成为选区更新的唯一渲染入口
    - _Bug_Condition: isBugCondition(input) where setMultiSelection() 不清除 selection 且不触发 render()_
    - _Expected_Behavior: setMultiSelection() 调用后 selection === null 且自动触发 render()_
    - _Preservation: 所有通过 setMultiSelection() 更新选区的现有代码路径不受影响_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 修改 `renderer.ts` 中 `setSelection()` 标记为 deprecated 并委托到 `setMultiSelection()`
    - 保留 `setSelection(startRow, startCol, endRow, endCol)` 方法签名以兼容
    - 内部改为调用 `this.setMultiSelection([{startRow, startCol, endRow, endCol}], 0)`
    - 不再直接设置 `this.selection`，不再直接调用 `this.render()`（由 `setMultiSelection()` 统一处理）
    - _Bug_Condition: isBugCondition(input) where setSelection() 直接设置 this.selection 并独立触发 render()_
    - _Expected_Behavior: setSelection() 委托到 setMultiSelection()，selection 始终为 null_
    - _Preservation: 所有调用 setSelection() 的代码路径行为不变，只是内部实现改为委托_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 修改 `app.ts` 中 `handleMouseDown()` 移除所有 `renderer.setSelection()` 调用
    - 行号点击、列号点击、合并单元格点击、普通单元格点击、下拉验证点击等位置
    - 移除 `renderer.setSelection()` 调用，统一在 `multiSelection.setSingle()` / `multiSelection.addSelection()` 之后仅调用 `renderer.setMultiSelection()` 更新渲染器状态
    - `setMultiSelection()` 修改后会自动触发 `render()`，无需额外调用
    - _Bug_Condition: isBugCondition(input) where handleMouseDown 同时调用 setSelection() 和 setMultiSelection()_
    - _Expected_Behavior: handleMouseDown 仅通过 setMultiSelection() 更新渲染器_
    - _Preservation: 点击操作的选区结果不变，仅渲染路径统一_
    - _Requirements: 2.1, 2.3_

  - [x] 3.4 修改 `app.ts` 中 `handleMouseMove()` 拖拽选区时移除 `renderer.setSelection()` 调用
    - 将 `renderer.setSelection(startRow, startCol, endRow, endCol)` 替换为 `renderer.setMultiSelection(this.multiSelection.getSelections(), 0)`
    - 同时修复行号拖拽和列号拖拽中的 `renderer.setSelection()` 调用
    - _Bug_Condition: isBugCondition(input) where handleMouseMove 中 multiSelection 存储原始坐标而 setSelection 存储调整后坐标_
    - _Expected_Behavior: 拖拽时仅通过 setMultiSelection() 更新渲染器，坐标一致_
    - _Preservation: 拖拽选区的视觉效果和最终选区结果不变_
    - _Requirements: 2.2, 2.3_

  - [x] 3.5 修改 `app.ts` 中 `handleArrowKey()`、`handleTabKey()`、`handleEnterKey()` 键盘导航统一使用 `setMultiSelection()`
    - 移除所有 `renderer.setSelection()` 调用
    - 替换为 `renderer.setMultiSelection(this.multiSelection.getSelections(), 0)`
    - _Bug_Condition: isBugCondition(input) where 键盘导航先更新 multiSelection 再调用 setSelection() 导致不同步_
    - _Expected_Behavior: 键盘导航仅通过 setMultiSelection() 更新渲染器，无双焦点框_
    - _Preservation: 键盘导航的移动逻辑和目标单元格不变_
    - _Requirements: 2.4_

  - [x] 3.6 修改 `app.ts` 中 `handleSearchNavigate()` 搜索导航统一使用 `setMultiSelection()`
    - 移除 `renderer.setSelection()` 调用
    - 替换为 `renderer.setMultiSelection(this.multiSelection.getSelections(), 0)`
    - _Bug_Condition: isBugCondition(input) where 搜索导航调用 setSelection() 导致双状态不一致_
    - _Expected_Behavior: 搜索导航仅通过 setMultiSelection() 更新渲染器_
    - _Preservation: 搜索导航的定位和高亮行为不变_
    - _Requirements: 2.4_

  - [x] 3.7 修复 `app.ts` 中 `handleReplace()` 和 `handleReplaceAll()` 的正则转义字符串
    - 将 `'\\cd23a17b-c4a6-4c81-ba53-23d4e3c6c80e'` 替换为 `'\\$&'`（正确的正则替换引用语法）
    - 两个函数中的正则转义均需修复
    - _Bug_Condition: isBugCondition(input) where 正则转义字符串被替换为 UUID 导致无效 RegExp_
    - _Expected_Behavior: 正则转义使用 '\\$&' 正确转义特殊字符，替换功能正常工作_
    - _Preservation: 不含正则特殊字符的搜索替换行为不变_
    - _Requirements: 2.5, 2.6_

  - [x] 3.8 验证 Bug 条件探索测试现在通过
    - **Property 1: Expected Behavior** - 选区统一渲染与替换功能恢复
    - **IMPORTANT**: 重新运行任务 1 中的同一测试 — 不要编写新测试
    - 任务 1 中的测试编码了期望行为
    - 当此测试通过时，确认期望行为已满足
    - 运行 `src/__tests__/selection-bugfix.test.ts`
    - **EXPECTED OUTCOME**: 测试 PASS（确认 bug 已修复）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.9 验证保持性测试仍然通过
    - **Property 2: Preservation** - 非 Bug 条件功能行为保持不变
    - **IMPORTANT**: 重新运行任务 2 中的同一测试 — 不要编写新测试
    - 运行 `src/__tests__/selection-preservation.test.ts`
    - **EXPECTED OUTCOME**: 测试 PASS（确认无回归）
    - 确认修复后所有保持性测试仍然通过
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4. 检查点 - 确保所有测试通过
  - 运行全部属性基测试，确保 bug 条件测试和保持性测试均通过
  - 如有问题，询问用户确认
