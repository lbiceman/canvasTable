# 实施计划：P1 公式能力补齐

## 概述

基于需求文档和设计文档，将 IFNA、TEXTJOIN、ROUNDUP/ROUNDDOWN/INT/TRUNC 六个新函数、跨 Sheet 引用增强（单引号 Sheet 名称解析）以及 InlineEditor 公式自动补全集成拆分为增量编码任务。每个任务构建在前一个任务之上，最终完成所有功能的集成。

## 任务

- [x] 1. 实现 IFNA 逻辑函数
  - [x] 1.1 在 `src/formula/functions/logic.ts` 的 `registerLogicFunctions()` 中新增 IFNA 函数注册
    - 注册 `{ name: 'IFNA', category: 'logic', minArgs: 2, maxArgs: 2 }`
    - handler 逻辑：检查 `args[0]` 是否为 `#N/A` 错误，是则返回 `args[1]`，否则返回 `args[0]`
    - 非 `#N/A` 类型的错误（如 `#VALUE!`、`#REF!`）原样传播
    - _需求: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 在 `src/formula/evaluator.ts` 的 `ERROR_HANDLING_FUNCTIONS` 集合中添加 `'IFNA'`
    - 确保 Evaluator 不会在参数求值阶段提前传播错误，使 handler 能接收到 `FormulaError` 对象
    - _需求: 1.1, 1.2_
  - [ ]* 1.3 编写 IFNA 单元测试（`src/__tests__/formula/functions/logic.test.ts`）
    - 测试 `#N/A` 错误被拦截返回替代值
    - 测试非 `#N/A` 错误原样传播
    - 测试正常值直接返回
    - _需求: 1.1, 1.2, 1.3_
  - [ ]* 1.4 编写 IFNA 属性测试（`src/__tests__/formula/functions/logic.pbt.test.ts`）
    - **Property 1: IFNA 选择性错误拦截**
    - **Property 2: IFNA 非 #N/A 错误传播**
    - **验证: 需求 1.1, 1.2, 1.3**

- [x] 2. 实现 TEXTJOIN 文本函数
  - [x] 2.1 在 `src/formula/functions/text.ts` 的 `registerTextFunctions()` 中新增 TEXTJOIN 函数注册
    - 注册 `{ name: 'TEXTJOIN', category: 'text', minArgs: 3, maxArgs: -1 }`
    - handler 逻辑：提取 delimiter 和 ignore_empty 参数，从第 3 个参数开始展平区域引用（`FormulaValue[][]`）为一维字符串数组
    - 根据 `ignore_empty` 决定是否跳过空字符串，最后用 delimiter 连接
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 2.2 编写 TEXTJOIN 单元测试（`src/__tests__/formula/functions/text.test.ts`）
    - 测试基本分隔符连接
    - 测试 `ignore_empty=TRUE` 跳过空字符串
    - 测试 `ignore_empty=FALSE` 保留空字符串
    - 测试区域引用展平
    - 测试边界：空分隔符、单个参数
    - _需求: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 2.3 编写 TEXTJOIN 属性测试（`src/__tests__/formula/functions/text.pbt.test.ts`）
    - **Property 3: TEXTJOIN 分隔符连接与空值处理**
    - **验证: 需求 2.1, 2.2, 2.3, 2.4**

- [x] 3. 实现 ROUNDUP、ROUNDDOWN、INT、TRUNC 数学函数
  - [x] 3.1 在 `src/formula/functions/math.ts` 的 `registerMathFunctions()` 中新增 ROUNDUP 和 ROUNDDOWN 函数注册
    - ROUNDUP: `{ name: 'ROUNDUP', category: 'math', minArgs: 2, maxArgs: 2 }`，向远离零方向舍入 `Math.sign(num) * Math.ceil(Math.abs(num) * factor) / factor`
    - ROUNDDOWN: `{ name: 'ROUNDDOWN', category: 'math', minArgs: 2, maxArgs: 2 }`，向接近零方向舍入 `Math.sign(num) * Math.floor(Math.abs(num) * factor) / factor`
    - 非数值参数返回 `#VALUE!` 错误
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.10, 3.11_
  - [x] 3.2 在 `src/formula/functions/math.ts` 的 `registerMathFunctions()` 中新增 INT 和 TRUNC 函数注册
    - INT: `{ name: 'INT', category: 'math', minArgs: 1, maxArgs: 1 }`，使用 `Math.floor(number)` 向负无穷取整
    - TRUNC: `{ name: 'TRUNC', category: 'math', minArgs: 1, maxArgs: 2 }`，截断小数部分向零方向，`num_digits` 默认为 0
    - 非数值参数返回 `#VALUE!` 错误
    - _需求: 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.12, 3.13_
  - [ ]* 3.3 编写 ROUNDUP/ROUNDDOWN/INT/TRUNC 单元测试（`src/__tests__/formula/functions/math.test.ts`）
    - 测试需求文档中的所有示例值
    - 测试负数场景
    - 测试非数值参数返回 `#VALUE!`
    - 测试边界：零值、整数输入
    - _需求: 3.1-3.13_
  - [ ]* 3.4 编写数学函数属性测试（`src/__tests__/formula/functions/math.pbt.test.ts`）
    - **Property 4: ROUNDUP 向远离零方向舍入**
    - **Property 5: ROUNDDOWN 向接近零方向舍入**
    - **Property 6: INT 等价于 Math.floor**
    - **Property 7: TRUNC 向零方向截断**
    - **验证: 需求 3.1-3.9**

- [x] 4. 检查点 - 确保所有新函数测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 5. 增强 Tokenizer 支持单引号包裹的 Sheet 名称
  - [x] 5.1 在 `src/formula/tokenizer.ts` 的 `tokenize()` 主循环中添加单引号检测分支
    - 当遇到 `'` 字符时，调用新增的 `readQuotedSheetRef()` 方法
    - `readQuotedSheetRef` 从 `'` 读取到匹配的 `'`，然后期望 `!`，再读取单元格引用
    - 生成 `SheetRef` 类型 Token，value 中的 Sheet 名称不包含外层单引号
    - _需求: 4.4_
  - [ ]* 5.2 编写 Tokenizer 单引号 Sheet 名称解析测试（`src/__tests__/formula/tokenizer.test.ts`）
    - 测试 `'Sheet 1'!A1` 格式解析
    - 测试含特殊字符的 Sheet 名称
    - 测试单引号未闭合的错误处理
    - _需求: 4.4_
  - [ ]* 5.3 编写 Tokenizer 属性测试（`src/__tests__/formula/tokenizer.pbt.test.ts`）
    - **Property 10: 单引号 Sheet 名称解析 round-trip**
    - **验证: 需求 4.4**

- [x] 6. 验证跨 Sheet 引用完整性
  - [x] 6.1 验证并补全 `src/formula/evaluator.ts` 中跨 Sheet 引用求值逻辑
    - 确保引用不存在的 Sheet 名称时返回 `#REF!` 错误
    - 确保跨 Sheet 引用与函数组合使用正常（如 `=SUM(Sheet2!A1:B10)`）
    - 检查 `src/sheet-manager.ts` 中 `updateFormulasOnSheetDelete` 和 `updateFormulasOnSheetRename` 的正确性
    - _需求: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7_
  - [ ]* 6.2 编写跨 Sheet 引用属性测试（`src/__tests__/formula/evaluator.pbt.test.ts`）
    - **Property 8: 跨 Sheet 引用正确获取数据**
    - **Property 9: 引用不存在的工作表返回 #REF!**
    - **Property 11: 重命名工作表后公式引用更新**
    - **Property 12: 删除工作表后公式返回 #REF!**
    - **验证: 需求 4.1, 4.2, 4.3, 4.5, 4.6**

- [x] 7. 检查点 - 确保 Tokenizer 和跨 Sheet 引用测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 8. 实现 InlineEditor 公式自动补全集成
  - [x] 8.1 在 `src/inline-editor.ts` 中添加 AutoComplete 和 FunctionRegistry 依赖注入
    - 新增 `setAutoComplete(autoComplete: AutoComplete, registry: FunctionRegistry): void` 公共方法
    - 新增私有属性：`dropdownEl`（下拉列表 DOM）、`paramHintEl`（参数提示浮层）、`autoComplete`、`functionRegistry`
    - 在 `show()` 方法中初始化下拉列表和参数提示 DOM 元素（如尚未创建）
    - _需求: 5.5_
  - [x] 8.2 在 `src/inline-editor.ts` 中实现自动补全触发和渲染逻辑
    - 监听 `input` 事件，提取当前输入中的函数名前缀（复用 FormulaBar 的 `extractFunctionPrefix` 逻辑）
    - 当输入以 `=` 开头且有函数名前缀时，调用 `autoComplete.search(prefix)` 获取候选项
    - 渲染候选列表到 `dropdownEl`，定位在编辑器下方
    - 候选列表为空时隐藏下拉列表
    - _需求: 5.1_
  - [x] 8.3 在 `src/inline-editor.ts` 中实现键盘导航和确认逻辑
    - 当自动补全列表可见时拦截键盘事件：
      - `ArrowUp/ArrowDown` → 调用 `autoComplete.moveUp()/moveDown()` 并更新选中项高亮
      - `Tab/Enter` → 调用 `autoComplete.confirm()` 插入函数名和左括号
      - `Escape` → 调用 `autoComplete.dismiss()` 关闭候选列表（不退出编辑模式）
    - 当自动补全列表不可见时恢复原有键盘行为
    - _需求: 5.2, 5.3, 5.4_
  - [x] 8.4 在 `src/inline-editor.ts` 中实现参数提示功能
    - 当用户从自动补全列表选择函数后，显示该函数的参数说明提示
    - 复用 FormulaBar 的 `detectParamContext` 和 `renderParamHint` 逻辑
    - 参数提示浮层定位在编辑器下方（或下拉列表下方）
    - _需求: 5.6_
  - [x] 8.5 在 `src/main.ts` 或 `src/app.ts` 中将 AutoComplete 和 FunctionRegistry 实例注入到 InlineEditor
    - 找到 InlineEditor 初始化位置，调用 `setAutoComplete()` 注入依赖
    - 确保 InlineEditor 和 FormulaBar 共享同一个 AutoComplete 实例和 FunctionRegistry 实例
    - _需求: 5.5_
  - [ ]* 8.6 编写 InlineEditor 自动补全集成测试（`src/__tests__/inline-editor-autocomplete.test.ts`）
    - 测试输入 `=SU` 时显示候选列表
    - 测试上下方向键导航
    - 测试 Tab 键确认插入函数名和左括号
    - 测试 Escape 键关闭候选列表
    - 测试非公式输入不触发自动补全
    - _需求: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 8.7 编写 InlineEditor 自动补全属性测试（`src/__tests__/inline-editor-autocomplete.pbt.test.ts`）
    - **Property 13: InlineEditor 自动补全集成**
    - **验证: 需求 5.1, 5.2, 5.3**

- [x] 9. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点任务确保增量验证
- 属性测试使用 fast-check 库，验证设计文档中定义的通用正确性属性
- 单元测试验证具体示例和边界条件
