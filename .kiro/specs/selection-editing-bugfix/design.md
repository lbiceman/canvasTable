# 选区编辑 Bugfix 设计文档

## 概述

`selection-editing-enhancement` 功能引入后，`SpreadsheetRenderer` 中同时维护了 `selection`（旧单选区）和 `multiSelections`（新多选区）两套选区状态，`app.ts` 中混用 `renderer.setSelection()` 和 `renderer.setMultiSelection()` 导致状态不一致，产生选区位置错误、幽灵选区（双焦点框）等问题。此外 `handleReplace`/`handleReplaceAll` 中正则转义字符串 `'\\$&'` 被意外替换为 UUID，导致替换功能不可用。

修复策略：统一使用 `multiSelections` 作为唯一选区状态源，废弃 `renderer.selection` 单选区状态；修复正则转义字符串。

## 术语表

- **Bug_Condition (C)**: 触发 bug 的条件——任何通过 `renderer.setSelection()` 更新选区并触发 `render()` 的操作，或使用被 UUID 替换的正则转义字符串执行替换的操作
- **Property (P)**: 期望行为——选区仅通过 `multiSelections` 单一状态源渲染，无幽灵选区；替换功能使用正确的正则转义
- **Preservation**: 不变行为——Ctrl+点击多选、行列选择、全选、填充柄、拖拽移动、编辑模式等现有功能不受影响
- **`renderer.selection`**: `SpreadsheetRenderer` 中的旧单选区状态字段，类型 `Selection | null`
- **`renderer.multiSelections`**: `SpreadsheetRenderer` 中的新多选区状态字段，类型 `Selection[]`
- **`setSelection()`**: `SpreadsheetRenderer` 的旧方法，更新 `this.selection` 并调用 `render()`
- **`setMultiSelection()`**: `SpreadsheetRenderer` 的新方法，更新 `this.multiSelections` 和 `this.activeSelectionIndex`，但不调用 `render()`

## Bug 详情

### Bug 条件

Bug 在以下两类场景中触发：

**场景 A（选区状态不一致）**：`app.ts` 中先调用 `renderer.setSelection()` 更新 `this.selection` 并触发 `render()`，此时 `this.multiSelections` 尚未更新或存储了不同坐标值。`render()` 方法中的分支逻辑 `if (this.multiSelections.length > 0)` 导致旧的 `multiSelections` 数据被渲染，或两套状态同时渲染产生双焦点框。

**场景 B（正则转义损坏）**：`handleReplace`/`handleReplaceAll` 中的正则转义替换字符串 `'\\$&'` 被意外替换为 UUID 字符串 `'\\0b2c1535-9e1c-4f9a-b216-4ee26f2cbff5'`，导致生成无效正则表达式。

**形式化规约：**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UserAction
  OUTPUT: boolean

  // 场景 A：选区操作通过 setSelection() 触发渲染
  IF input.type IN ['click', 'drag', 'arrowKey', 'tabKey', 'enterKey', 'searchNavigate']
     AND codeCallsSetSelection(input)
     AND multiSelectionsStateStale(input)
  THEN RETURN true

  // 场景 B：替换操作使用损坏的正则转义
  IF input.type IN ['replace', 'replaceAll']
     AND regexEscapeStringIsUUID()
  THEN RETURN true

  RETURN false
END FUNCTION
```

### 示例

- 用户单击单元格 B2：`setSelection(1,1,1,1)` 触发 `render()`，但 `multiSelections` 仍保留上次操作的旧数据 → 渲染出幽灵选区
- 用户拖拽选区从 A1 到 C3：`multiSelection.setSingle()` 存储原始坐标 `{0,0,2,2}`，`setSelection()` 存储合并单元格调整后的不同坐标 → 选区位置不一致
- 用户按方向键 ArrowDown：`multiSelection.setSingle()` 更新后，`setSelection()` 再次触发 `render()`，`multiSelections` 和 `selection` 可能不同步 → 双焦点框
- 用户点击"替换"按钮，搜索文本含特殊字符 `$`：正则转义生成 `\\0b2c1535-...` 而非 `\\$&` → 正则表达式无效，替换失败

## 期望行为

### 保持不变的行为

**不变行为：**
- Ctrl+点击多选区功能必须继续正常工作，每个选区独立渲染
- 行号/列号点击选择整行/整列，支持 Ctrl+点击多选和 Shift+点击范围扩展
- Ctrl+A 全选功能正常，高亮所有行列标题
- 双击单元格进入编辑模式，内联编辑器位置正确
- 填充柄拖拽填充功能正常
- Ctrl+F 搜索高亮和导航功能正常
- 拖拽移动选区功能正常
- Delete 键删除和格式化操作正确应用到所有选区内单元格

**范围：**
所有不涉及 `renderer.setSelection()` 调用路径和正则转义字符串的功能不受此修复影响。包括：
- 图表交互（ChartOverlay）
- 行高/列宽调整
- 主题切换和设置面板
- 数据导入/导出
- 协同编辑光标广播

## 假设的根本原因

基于 bug 分析，最可能的原因如下：

1. **双状态源冲突**：`renderer.ts` 中 `selection` 和 `multiSelections` 两个字段同时存在，`render()` 方法中 `if (this.multiSelections.length > 0)` 分支逻辑无法正确处理两者同时有值的情况。当 `setSelection()` 先触发 `render()` 时，`multiSelections` 中的旧数据被渲染。

2. **渲染时序问题**：`setSelection()` 内部调用 `render()`，但 `setMultiSelection()` 不调用 `render()`。`app.ts` 中先调用 `setSelection()` 再调用 `setMultiSelection()`，导致第一次 `render()` 使用过时的 `multiSelections` 数据。

3. **坐标不一致**：`handleMouseDown` 和 `handleMouseMove` 中，`multiSelection.setSingle()` 存储原始点击坐标，而 `renderer.setSelection()` 存储经过合并单元格调整后的坐标，两套状态保存了不同的值。

4. **正则转义字符串被工具替换**：`handleReplace`/`handleReplaceAll` 中的 `'\\$&'`（正则替换中引用匹配文本的特殊语法）被某种自动化工具或代码生成过程意外替换为 UUID 字符串。

## 正确性属性

Property 1: Bug Condition - 选区状态统一渲染

_For any_ 用户选区操作（单击、拖拽、键盘导航、搜索导航），修复后的代码 SHALL 仅通过 `multiSelections` 单一状态源渲染选区，不再通过 `renderer.selection` 渲染，确保页面上不出现幽灵选区或双焦点框，且选区位置与用户操作目标一致。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Bug Condition - 搜索替换功能恢复

_For any_ 包含正则特殊字符的搜索文本，修复后的 `handleReplace` 和 `handleReplaceAll` SHALL 使用正确的正则转义 `'\\$&'` 生成有效的正则表达式，成功执行替换操作并返回正确结果。

**Validates: Requirements 2.5, 2.6**

Property 3: Preservation - 多选区与现有功能保持不变

_For any_ 不涉及 bug 条件的输入（Ctrl+点击多选、行列选择、全选、编辑模式、填充柄、拖拽移动、Delete 删除、搜索高亮），修复后的代码 SHALL 产生与修复前完全相同的行为，保持所有现有功能正常工作。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## 修复实现

### 所需变更

假设根本原因分析正确：

**文件**: `src/renderer.ts`

**函数**: `setMultiSelection()`、`setSelection()`

**具体变更**:
1. **`setMultiSelection()` 增加清除 `selection` 和触发渲染**：在设置 `multiSelections` 和 `activeSelectionIndex` 后，清除 `this.selection = null`，并调用 `this.render()` 触发重绘，使其成为选区更新的唯一入口
2. **`setSelection()` 标记为 deprecated 并委托到 `setMultiSelection()`**：保留方法签名以兼容，内部改为调用 `this.setMultiSelection([{startRow, startCol, endRow, endCol}], 0)`，不再直接设置 `this.selection`

**文件**: `src/app.ts`

**函数**: `handleMouseDown()`

**具体变更**:
3. **移除所有 `renderer.setSelection()` 调用**：在行号点击、列号点击、合并单元格点击、普通单元格点击、下拉验证点击等位置，移除 `renderer.setSelection()` 调用，统一在 `multiSelection.setSingle()` / `multiSelection.addSelection()` 之后仅调用 `renderer.setMultiSelection()` 更新渲染器状态（`setMultiSelection` 修改后会自动触发 `render()`）

**函数**: `handleMouseMove()`

**具体变更**:
4. **拖拽选区时移除 `renderer.setSelection()` 调用**：将 `renderer.setSelection(startRow, startCol, endRow, endCol)` 替换为 `renderer.setMultiSelection(this.multiSelection.getSelections(), 0)`

**函数**: `handleArrowKey()`、`handleTabKey()`、`handleEnterKey()`

**具体变更**:
5. **键盘导航统一使用 `setMultiSelection()`**：移除所有 `renderer.setSelection()` 调用，替换为 `renderer.setMultiSelection(this.multiSelection.getSelections(), 0)`

**函数**: `handleSearchNavigate()`

**具体变更**:
6. **搜索导航统一使用 `setMultiSelection()`**：移除 `renderer.setSelection()` 调用，替换为 `renderer.setMultiSelection(this.multiSelection.getSelections(), 0)`

**函数**: `handleReplace()`、`handleReplaceAll()`

**具体变更**:
7. **修复正则转义字符串**：将 `'\\0b2c1535-9e1c-4f9a-b216-4ee26f2cbff5'` 替换为 `'\\$&'`（正确的正则替换引用语法）

## 测试策略

### 验证方法

测试策略分两阶段：首先在未修复代码上复现 bug 以确认根因，然后验证修复后的正确性和行为保持。

### 探索性 Bug 条件检查

**目标**：在实施修复前复现 bug，确认或否定根因分析。如果否定，需要重新假设。

**测试计划**：编写测试模拟各种选区操作，检查 `renderer.selection` 和 `renderer.multiSelections` 的状态一致性，以及正则转义的正确性。在未修复代码上运行以观察失败。

**测试用例**:
1. **单击单元格测试**：模拟单击 B2，检查 `renderer.selection` 和 `renderer.multiSelections` 是否一致（未修复代码上会失败）
2. **拖拽选区测试**：模拟从 A1 拖拽到 C3，检查两套状态的坐标值是否一致（未修复代码上会失败）
3. **方向键导航测试**：模拟按 ArrowDown，检查渲染后是否只有一个选区框（未修复代码上会失败）
4. **替换功能测试**：模拟搜索包含 `$` 的文本并替换，检查正则表达式是否有效（未修复代码上会失败）

**预期反例**:
- `renderer.selection` 和 `renderer.multiSelections` 存储不同坐标值
- `render()` 被调用时 `multiSelections` 包含过时数据
- 正则转义生成包含 UUID 的无效模式

### Fix Checking

**目标**：验证对所有触发 bug 条件的输入，修复后的函数产生期望行为。

**伪代码：**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := executeAction_fixed(input)
  IF input.type IN ['click', 'drag', 'arrowKey', 'tabKey', 'enterKey', 'searchNavigate'] THEN
    ASSERT renderer.selection == null
    ASSERT renderer.multiSelections.length > 0
    ASSERT renderedSelectionCount == 1 (when no Ctrl key)
    ASSERT renderedSelectionPosition == expectedPosition
  END IF
  IF input.type IN ['replace', 'replaceAll'] THEN
    ASSERT replaceResult.success == true
    ASSERT cellContent == expectedReplacedContent
  END IF
END FOR
```

### Preservation Checking

**目标**：验证对所有不触发 bug 条件的输入，修复后的函数产生与原函数相同的结果。

**伪代码：**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT executeAction_original(input) == executeAction_fixed(input)
END FOR
```

**测试方法**：推荐使用属性基测试（Property-Based Testing）进行保持性检查，因为：
- 自动生成大量测试用例覆盖输入域
- 捕获手动单元测试可能遗漏的边界情况
- 对所有非 bug 输入的行为不变性提供强保证

**测试计划**：先在未修复代码上观察 Ctrl+点击多选、行列选择等非 bug 输入的行为，然后编写属性基测试捕获该行为。

**测试用例**:
1. **Ctrl+点击多选保持**：验证 Ctrl+点击添加多选区在修复后继续正常工作
2. **行列选择保持**：验证行号/列号点击选择整行/整列在修复后继续正常工作
3. **全选保持**：验证 Ctrl+A 全选在修复后继续正常工作
4. **编辑模式保持**：验证双击进入编辑模式在修复后继续正常工作

### 单元测试

- 测试 `setMultiSelection()` 修改后是否正确清除 `selection` 并触发 `render()`
- 测试 `setSelection()` deprecated 后是否正确委托到 `setMultiSelection()`
- 测试各种选区操作后 `renderer.selection` 始终为 `null`
- 测试 `handleReplace` 和 `handleReplaceAll` 使用正确的正则转义

### 属性基测试

- 生成随机单元格坐标和操作类型，验证修复后选区状态始终通过 `multiSelections` 单一源管理
- 生成随机搜索文本（包含正则特殊字符），验证正则转义后生成有效的 `RegExp` 对象
- 生成随机非 bug 操作序列，验证修复前后行为一致

### 集成测试

- 测试完整的单击→拖拽→键盘导航流程，验证全程无幽灵选区
- 测试搜索→导航→替换→全部替换完整流程
- 测试多选区操作（Ctrl+点击）与单选区操作交替使用的场景
