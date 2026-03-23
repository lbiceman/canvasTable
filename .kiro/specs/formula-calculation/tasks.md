# 实现计划：公式与计算

## 概述

基于 Tokenizer → Parser → Evaluator 管线重构现有公式引擎，新增六大函数类别（数学、统计、文本、逻辑、查找引用、日期），增强公式栏交互（语法高亮、自动补全、参数提示），并支持数组公式、命名范围和循环引用检测。实现采用渐进式重构策略，在保持现有 API 兼容的前提下逐步替换内部实现。

## Tasks

- [x] 1. 公式模块基础设施：类型定义与核心管线
  - [x] 1.1 创建 `src/formula/types.ts`，定义 Token、AST 节点、FormulaValue、FormulaError、FunctionDefinition、EvaluationContext 等所有公式模块类型
    - 包含 TokenType、ASTNodeType、ErrorType 等联合类型
    - 包含 FunctionHandler、CellGetter 等函数类型
    - 包含 NamedRange、ArrayFormulaInfo 等数据结构
    - _Requirements: 1.1-1.13, 2.1-2.11, 3.1-3.14, 4.1-4.11, 5.1-5.12, 6.1-6.12_

  - [x] 1.2 创建 `src/formula/tokenizer.ts`，实现词法分析器
    - 支持 Number、String、Boolean、CellRef、RangeRef、SheetRef、Function、Operator、Paren、Comma 等 Token 类型
    - 支持绝对引用（$A$1）和跨 Sheet 引用（Sheet1!A1）
    - 处理运算符优先级标记（+、-、*、/、>、<、>=、<=、=、<>、&）
    - _Requirements: 1.1-1.10, 4.11, 7.1_

  - [ ]* 1.3 为 Tokenizer 编写属性测试
    - **Property 26: 语法高亮 token 完整性**（Tokenizer 输出的 token 拼接应还原原始字符串）
    - **Validates: Requirements 7.1, 7.9, 7.10**

  - [x] 1.4 创建 `src/formula/parser.ts`，实现递归下降解析器
    - 支持二元运算（算术、比较、字符串连接）
    - 支持一元运算（负号）
    - 支持函数调用和嵌套函数
    - 按优先级解析：比较 < 连接 < 加减 < 乘除 < 一元
    - _Requirements: 4.11, 5.1-5.6_

  - [x] 1.5 创建 `src/formula/function-registry.ts`，实现函数注册表
    - register/get/getAllNames/searchByPrefix 方法
    - 存储函数元数据（名称、类别、参数说明、最小/最大参数数量）
    - _Requirements: 7.2, 7.8_

  - [x] 1.6 创建 `src/formula/evaluator.ts`，实现 AST 求值器
    - 递归遍历 AST 节点求值
    - 支持单元格引用解析、区域引用展开
    - 支持命名范围解析
    - 错误传播机制（错误值向上传播，除非被 IFERROR 拦截）
    - _Requirements: 1.1-1.13, 4.5_

- [x] 2. 检查点 - 核心管线验证
  - 确保 Tokenizer → Parser → Evaluator 管线可以正确解析和求值简单公式（如 `=1+2`、`=A1*B1`），确保所有测试通过，如有问题请询问用户。

- [x] 3. 数学函数实现
  - [x] 3.1 创建 `src/formula/functions/math.ts`，实现 ABS、ROUND、CEILING、FLOOR、MOD、POWER、SQRT、MAX、MIN、AVERAGE 函数并注册到 FunctionRegistry
    - 每个函数包含参数验证和错误处理
    - 非数值参数返回 #VALUE!，SQRT 负数返回 #NUM!，MOD 除零返回 #DIV/0!
    - _Requirements: 1.1-1.13_

  - [ ]* 3.2 为数学函数编写属性测试
    - **Property 1: 数学函数基本恒等式**（ABS(x)>=0, ABS(x)==ABS(-x), POWER(x,1)==x, MOD 恒等式）
    - **Validates: Requirements 1.1, 1.5, 1.6, 1.7**

  - [ ]* 3.3 为舍入函数编写属性测试
    - **Property 2: ROUND/CEILING/FLOOR 舍入边界**
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [ ]* 3.4 为聚合函数编写属性测试
    - **Property 3: MAX/MIN/AVERAGE 与 SUM 的关系**
    - **Validates: Requirements 1.8, 1.9, 1.10, 2.1**

  - [ ]* 3.5 为错误处理编写属性测试
    - **Property 4: 数学函数非数值参数错误处理**
    - **Validates: Requirements 1.11**

- [x] 4. 统计函数实现
  - [x] 4.1 创建 `src/formula/functions/statistics.ts`，实现 COUNT、COUNTA、COUNTIF、COUNTIFS、SUMIF、SUMIFS、AVERAGEIF 函数
    - 实现条件匹配引擎：支持比较运算符（>、<、>=、<=、=、<>）和通配符（*、?）
    - 条件区域大小不一致返回 #VALUE!，AVERAGEIF 无匹配返回 #DIV/0!
    - _Requirements: 2.1-2.11_

  - [ ]* 4.2 为条件统计函数编写属性测试
    - **Property 5: 条件统计函数正确性**（COUNTIF/SUMIF/AVERAGEIF 与手动遍历一致）
    - **Validates: Requirements 2.3, 2.5, 2.7**

  - [ ]* 4.3 为多条件统计函数编写属性测试
    - **Property 6: 多条件统计函数正确性**（COUNTIFS/SUMIFS 交集语义）
    - **Validates: Requirements 2.4, 2.6**

  - [ ]* 4.4 为 COUNT/COUNTA 编写属性测试
    - **Property 7: COUNT/COUNTA 计数正确性**
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 4.5 为条件匹配编写属性测试
    - **Property 8: 条件匹配运算符和通配符**
    - **Validates: Requirements 2.8, 2.9**

- [x] 5. 文本函数实现
  - [x] 5.1 创建 `src/formula/functions/text.ts`，实现 LEFT、RIGHT、MID、LEN、TRIM、UPPER、LOWER、CONCATENATE、SUBSTITUTE、FIND、SEARCH、TEXT 函数
    - FIND 区分大小写，SEARCH 不区分大小写
    - FIND/SEARCH 未找到返回 #VALUE!，MID 起始位置无效返回空字符串
    - _Requirements: 3.1-3.14_

  - [ ]* 5.2 为文本子串提取编写属性测试
    - **Property 9: 文本子串提取一致性**（LEFT+RIGHT 还原、MID==LEFT）
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ]* 5.3 为 TRIM 编写属性测试
    - **Property 10: TRIM 不变量**（幂等性、无首尾空格、无连续空格）
    - **Validates: Requirements 3.5**

  - [ ]* 5.4 为大小写转换编写属性测试
    - **Property 11: 大小写转换幂等性与互逆性**
    - **Validates: Requirements 3.6, 3.7**

  - [ ]* 5.5 为 CONCATENATE 编写属性测试
    - **Property 12: CONCATENATE 长度守恒**
    - **Validates: Requirements 3.8**

  - [ ]* 5.6 为 FIND/SEARCH 编写属性测试
    - **Property 13: FIND/SEARCH round-trip**
    - **Validates: Requirements 3.10, 3.11**

  - [ ]* 5.7 为 SUBSTITUTE 编写属性测试
    - **Property 14: SUBSTITUTE 替换完整性**
    - **Validates: Requirements 3.9**

- [x] 6. 逻辑函数实现
  - [x] 6.1 创建 `src/formula/functions/logic.ts`，实现 IF、AND、OR、NOT、IFERROR、IFS、SWITCH 函数
    - 隐式布尔转换：非零数值为 TRUE，零和空字符串为 FALSE
    - IFS 无条件为真返回 #N/A，SWITCH 无匹配且无默认值返回 #N/A
    - _Requirements: 4.1-4.11_

  - [ ]* 6.2 为 IF 编写属性测试
    - **Property 15: IF 条件分支正确性**
    - **Validates: Requirements 4.1**

  - [ ]* 6.3 为 AND/OR/NOT 编写属性测试
    - **Property 16: AND/OR 布尔聚合**（含德摩根定律）
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [ ]* 6.4 为 IFERROR 编写属性测试
    - **Property 17: IFERROR 错误拦截**
    - **Validates: Requirements 4.5**

  - [ ]* 6.5 为隐式布尔转换编写属性测试
    - **Property 18: 隐式布尔转换**
    - **Validates: Requirements 4.8**

- [x] 7. 检查点 - 四大函数类别验证
  - 确保数学、统计、文本、逻辑四类函数全部正确注册并可通过管线求值，确保所有测试通过，如有问题请询问用户。

- [x] 8. 查找引用函数实现
  - [x] 8.1 创建 `src/formula/functions/lookup.ts`，实现 VLOOKUP、HLOOKUP、INDEX、MATCH、OFFSET、INDIRECT 函数
    - VLOOKUP/HLOOKUP 支持精确匹配（FALSE）和近似匹配（TRUE）
    - 未找到匹配返回 #N/A，INDEX 越界返回 #REF!，INDIRECT 无效引用返回 #REF!
    - _Requirements: 5.1-5.12_

  - [ ]* 8.2 为 VLOOKUP/HLOOKUP 编写属性测试
    - **Property 19: VLOOKUP/HLOOKUP 精确匹配 round-trip**
    - **Validates: Requirements 5.1, 5.2, 5.8**

  - [ ]* 8.3 为 INDEX/MATCH 编写属性测试
    - **Property 20: INDEX/MATCH round-trip**
    - **Validates: Requirements 5.3, 5.4**

  - [ ]* 8.4 为 OFFSET 编写属性测试
    - **Property 21: OFFSET 等价于直接引用**
    - **Validates: Requirements 5.5**

  - [ ]* 8.5 为 INDIRECT 编写属性测试
    - **Property 22: INDIRECT round-trip**
    - **Validates: Requirements 5.6**

- [x] 9. 日期函数实现
  - [x] 9.1 创建 `src/formula/functions/date.ts`，实现 TODAY、NOW、DATE、YEAR、MONTH、DAY、DATEDIF、EDATE、EOMONTH 函数
    - 无法解析日期返回 #VALUE!，DATEDIF 开始晚于结束返回 #NUM!，无效单位返回 #NUM!
    - _Requirements: 6.1-6.12_

  - [ ]* 9.2 为 DATE/YEAR/MONTH/DAY 编写属性测试
    - **Property 23: DATE/YEAR/MONTH/DAY round-trip**
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6**

  - [ ]* 9.3 为 DATEDIF 编写属性测试
    - **Property 24: DATEDIF 天数差正确性**
    - **Validates: Requirements 6.7**

  - [ ]* 9.4 为 EOMONTH 编写属性测试
    - **Property 25: EOMONTH 返回月末**
    - **Validates: Requirements 6.9**

- [x] 10. 依赖图与循环引用检测
  - [x] 10.1 创建 `src/formula/dependency-graph.ts`，实现 DependencyGraph
    - setDependencies/getDependents/getRecalcOrder/removeDependencies 方法
    - 支持拓扑排序获取重算顺序
    - _Requirements: 10.5_

  - [x] 10.2 创建 `src/formula/circular-detector.ts`，实现 CircularDetector
    - 基于 DFS 的循环检测，返回循环路径或 null
    - 检测时间复杂度与依赖链长度成线性关系
    - _Requirements: 10.1, 10.2, 10.5_

  - [ ]* 10.3 为循环引用检测编写属性测试
    - **Property 34: 循环引用检测**（有环返回路径，无环返回 null）
    - **Validates: Requirements 10.1, 10.2**

  - [ ]* 10.4 为循环引用阻止写入编写属性测试
    - **Property 35: 循环引用阻止写入**
    - **Validates: Requirements 10.3**

  - [ ]* 10.5 为断开循环后恢复编写属性测试
    - **Property 36: 断开循环后恢复正常**
    - **Validates: Requirements 10.6**

- [x] 11. 命名范围管理器
  - [x] 11.1 创建 `src/formula/named-range.ts`，实现 NamedRangeManager
    - create/update/delete/resolve/getAll/validateName/adjustForRowColChange 方法
    - 名称验证：以字母或下划线开头，不与单元格引用冲突
    - 重复名称拒绝创建
    - _Requirements: 9.1-9.8_

  - [ ]* 11.2 为命名范围 CRUD 编写属性测试
    - **Property 30: 命名范围 CRUD round-trip**
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [ ]* 11.3 为命名范围公式等价性编写属性测试
    - **Property 31: 命名范围在公式中等价于区域引用**
    - **Validates: Requirements 9.4**

  - [ ]* 11.4 为命名范围名称验证编写属性测试
    - **Property 32: 命名范围名称验证**
    - **Validates: Requirements 9.5**

  - [ ]* 11.5 为命名范围区域自动更新编写属性测试
    - **Property 33: 命名范围区域随行列变化自动更新**
    - **Validates: Requirements 9.8**

- [x] 12. 数组公式管理器
  - [x] 12.1 创建 `src/formula/array-formula.ts`，实现 ArrayFormulaManager
    - register/isInArrayFormula/getArrayFormula/delete/checkOverlap 方法
    - 在 `src/types.ts` 的 Cell 接口中新增 isArrayFormula 和 arrayFormulaOrigin 字段
    - _Requirements: 8.1-8.7_

  - [ ]* 12.2 为数组公式区域保护编写属性测试
    - **Property 28: 数组公式区域保护**
    - **Validates: Requirements 8.4**

  - [ ]* 12.3 为数组公式逐元素运算编写属性测试
    - **Property 29: 数组公式逐元素运算**
    - **Validates: Requirements 8.6**

- [x] 13. 检查点 - 依赖图、命名范围、数组公式验证
  - 确保循环引用检测、命名范围解析、数组公式区域保护全部正常工作，确保所有测试通过，如有问题请询问用户。

- [x] 14. FormulaEngine 门面重构
  - [x] 14.1 重构 `src/formula-engine.ts`，将内部实现委托给新的 Tokenizer → Parser → Evaluator 管线
    - 保持现有公共 API 不变（evaluate、isFormula、validateFormula、getDependents、getAffectedCells）
    - 新增 checkCircularReference 和 evaluateArrayFormula 方法
    - 在 evaluate 流程中集成循环引用检测
    - 在 evaluate 流程中集成命名范围解析
    - 保持 SUM/SUBTRACT/MULTIPLY/DIVIDE 向后兼容
    - _Requirements: 10.1-10.6, 9.4, 9.7_

  - [x] 14.2 更新 `src/model.ts` 中的 SpreadsheetModel
    - 集成 NamedRangeManager 和 ArrayFormulaManager
    - 在 setCellContent 中集成循环引用检测（检测到时阻止写入并通知 UI）
    - 在 setCellContent 中支持数组公式（Ctrl+Shift+Enter 标记）
    - 数组公式区域保护（阻止部分编辑/删除）
    - _Requirements: 8.1-8.5, 9.1-9.3, 10.3, 10.4, 10.6_

- [x] 15. 公式栏增强：语法高亮与自动补全
  - [x] 15.1 创建 `src/formula-bar/syntax-highlighter.ts`，实现 SyntaxHighlighter
    - 复用 Tokenizer 进行词法分析
    - 为函数名、单元格引用、区域引用、数字、字符串、运算符分配不同颜色类型
    - _Requirements: 7.1, 7.9, 7.10_

  - [x] 15.2 创建 `src/formula-bar/autocomplete.ts`，实现 AutoComplete 组件
    - 根据输入前缀从 FunctionRegistry 和 NamedRangeManager 搜索候选项
    - 支持键盘导航（上下方向键移动、Tab/Enter 确认、Escape 关闭）
    - _Requirements: 7.2, 7.3, 7.5, 7.6, 7.7, 9.9_

  - [x] 15.3 创建 `src/formula-bar/formula-bar.ts`，实现 FormulaBar 主组件
    - 集成 SyntaxHighlighter 实现实时语法高亮
    - 集成 AutoComplete 实现函数自动补全
    - 实现函数参数说明提示（在括号内输入时显示参数名称和描述）
    - 数组公式显示花括号标识（如 `{=SUM(A1:A10*B1:B10)}`）
    - _Requirements: 7.1-7.10, 8.2_

  - [ ]* 15.4 为自动补全前缀匹配编写属性测试
    - **Property 27: 自动补全前缀匹配**
    - **Validates: Requirements 7.2, 7.8**

- [x] 16. 集成与接线
  - [x] 16.1 在 `src/app.ts` 中集成 FormulaBar
    - 创建公式栏 DOM 元素并挂载到工具栏下方
    - 选中单元格时同步公式栏显示（显示 formulaContent 或 content）
    - 公式栏编辑时同步到单元格
    - _Requirements: 7.1-7.10_

  - [x] 16.2 在 `src/app.ts` 中集成数组公式快捷键
    - 监听 Ctrl+Shift+Enter，标记当前公式为数组公式
    - 数组公式区域保护：阻止部分编辑并显示提示
    - _Requirements: 8.1, 8.4, 8.5_

  - [x] 16.3 在 `src/app.ts` 中集成命名范围管理
    - 提供创建/编辑/删除命名范围的 UI 入口
    - 行列插入/删除时调用 adjustForRowColChange 更新命名范围
    - _Requirements: 9.1-9.3, 9.8_

- [x] 17. 最终检查点 - 全功能验证
  - 确保所有测试通过，确保现有 SUM/SUBTRACT/MULTIPLY/DIVIDE 公式行为不变，确保公式栏交互正常，如有问题请询问用户。

- [x] 18. E2E 测试 - 全函数覆盖
  - [x] 18.1 创建 `e2e/formula-math.spec.ts`，编写数学函数 Playwright E2E 测试，逐一测试全部 10 个数学函数
    - 测试 ABS：在单元格输入 `=ABS(-5)`，验证显示 `5`；输入 `=ABS(3)`，验证显示 `3`；输入 `=ABS(0)`，验证显示 `0`
    - 测试 ROUND：输入 `=ROUND(3.456, 2)`，验证显示 `3.46`；输入 `=ROUND(3.455, 2)`，验证显示 `3.46`；输入 `=ROUND(3.444, 2)`，验证显示 `3.44`
    - 测试 CEILING：输入 `=CEILING(4.2, 1)`，验证显示 `5`；输入 `=CEILING(4.8, 0.5)`，验证显示 `5`；输入 `=CEILING(-2.5, 1)`，验证显示 `-2`
    - 测试 FLOOR：输入 `=FLOOR(4.8, 1)`，验证显示 `4`；输入 `=FLOOR(4.2, 0.5)`，验证显示 `4`；输入 `=FLOOR(-2.5, 1)`，验证显示 `-3`
    - 测试 MOD：输入 `=MOD(10, 3)`，验证显示 `1`；输入 `=MOD(10, 5)`，验证显示 `0`；输入 `=MOD(10, 0)`，验证显示 `#DIV/0!`
    - 测试 POWER：输入 `=POWER(2, 3)`，验证显示 `8`；输入 `=POWER(5, 0)`，验证显示 `1`；输入 `=POWER(9, 0.5)`，验证显示 `3`
    - 测试 SQRT：输入 `=SQRT(16)`，验证显示 `4`；输入 `=SQRT(0)`，验证显示 `0`；输入 `=SQRT(-1)`，验证显示 `#NUM!`
    - 测试 MAX：在 A1:A5 填入 `3,1,4,1,5`，输入 `=MAX(A1:A5)`，验证显示 `5`；输入 `=MAX(10, 20, 5)`，验证显示 `20`
    - 测试 MIN：在 A1:A5 填入 `3,1,4,1,5`，输入 `=MIN(A1:A5)`，验证显示 `1`；输入 `=MIN(10, 20, 5)`，验证显示 `5`
    - 测试 AVERAGE：在 A1:A5 填入 `10,20,30,40,50`，输入 `=AVERAGE(A1:A5)`，验证显示 `30`；输入 `=AVERAGE(2, 4, 6)`，验证显示 `4`
    - 测试非数值参数错误：输入 `=ABS("abc")`，验证显示 `#VALUE!`
    - _Requirements: 1.1-1.13_

  - [x] 18.2 创建 `e2e/formula-statistics.spec.ts`，编写统计函数 Playwright E2E 测试，逐一测试全部 7 个统计函数
    - 测试 COUNT：在 A1:A5 填入 `1, "文本", 3, , 5`（含空单元格和文本），输入 `=COUNT(A1:A5)`，验证显示 `3`（仅计数数值）
    - 测试 COUNTA：在 A1:A5 填入 `1, "文本", 3, , 5`（含空单元格），输入 `=COUNTA(A1:A5)`，验证显示 `4`（计数非空）
    - 测试 COUNTIF：在 A1:A5 填入 `1, 5, 8, 3, 10`，输入 `=COUNTIF(A1:A5, ">5")`，验证显示 `2`；输入 `=COUNTIF(A1:A5, 5)`，验证显示 `1`
    - 测试 COUNTIFS：在 A1:A5 填入 `1, 5, 8, 3, 10`，B1:B5 填入 `10, 20, 30, 40, 50`，输入 `=COUNTIFS(A1:A5, ">3", B1:B5, "<40")`，验证显示 `2`
    - 测试 SUMIF：在 A1:A5 填入 `1, 5, 8, 3, 10`，B1:B5 填入 `100, 200, 300, 400, 500`，输入 `=SUMIF(A1:A5, ">5", B1:B5)`，验证显示 `800`（300+500）
    - 测试 SUMIFS：在 A1:A3 填入 `10, 20, 30`，B1:B3 填入 `1, 2, 3`，C1:C3 填入 `100, 200, 300`，输入 `=SUMIFS(C1:C3, A1:A3, ">10", B1:B3, ">1")`，验证显示 `500`（200+300）
    - 测试 AVERAGEIF：在 A1:A5 填入 `1, 5, 8, 3, 10`，B1:B5 填入 `100, 200, 300, 400, 500`，输入 `=AVERAGEIF(A1:A5, ">5", B1:B5)`，验证显示 `400`（(300+500)/2）
    - 测试条件运算符：验证 `>`、`<`、`>=`、`<=`、`=`、`<>` 在 COUNTIF 中的正确性
    - 测试通配符：在 A1:A3 填入 `"Apple", "Banana", "Avocado"`，输入 `=COUNTIF(A1:A3, "A*")`，验证显示 `2`
    - 测试错误情况：AVERAGEIF 无匹配时验证显示 `#DIV/0!`
    - _Requirements: 2.1-2.11_

  - [x] 18.3 创建 `e2e/formula-text.spec.ts`，编写文本函数 Playwright E2E 测试，逐一测试全部 12 个文本函数
    - 测试 LEFT：输入 `=LEFT("Hello", 3)`，验证显示 `Hel`；输入 `=LEFT("Hello", 0)`，验证显示空字符串
    - 测试 RIGHT：输入 `=RIGHT("Hello", 3)`，验证显示 `llo`；输入 `=RIGHT("Hello", 5)`，验证显示 `Hello`
    - 测试 MID：输入 `=MID("Hello", 2, 3)`，验证显示 `ell`；输入 `=MID("Hello", 1, 5)`，验证显示 `Hello`
    - 测试 LEN：输入 `=LEN("Hello")`，验证显示 `5`；输入 `=LEN("")`，验证显示 `0`
    - 测试 TRIM：输入 `=TRIM("  Hello  ")`，验证显示 `Hello`；输入 `=TRIM("Hello  World")`，验证显示 `Hello World`
    - 测试 UPPER：输入 `=UPPER("hello")`，验证显示 `HELLO`；输入 `=UPPER("Hello World")`，验证显示 `HELLO WORLD`
    - 测试 LOWER：输入 `=LOWER("HELLO")`，验证显示 `hello`；输入 `=LOWER("Hello World")`，验证显示 `hello world`
    - 测试 CONCATENATE：输入 `=CONCATENATE("A", "B", "C")`，验证显示 `ABC`；输入 `=CONCATENATE("Hello", " ", "World")`，验证显示 `Hello World`
    - 测试 SUBSTITUTE：输入 `=SUBSTITUTE("Hello World", "World", "Excel")`，验证显示 `Hello Excel`；输入 `=SUBSTITUTE("aaa", "a", "b")`，验证显示 `bbb`
    - 测试 FIND：输入 `=FIND("lo", "Hello")`，验证显示 `4`（区分大小写）；输入 `=FIND("LO", "Hello")`，验证显示 `#VALUE!`
    - 测试 SEARCH：输入 `=SEARCH("LO", "Hello")`，验证显示 `4`（不区分大小写）；输入 `=SEARCH("xyz", "Hello")`，验证显示 `#VALUE!`
    - 测试 TEXT：输入 `=TEXT(1234.5, "#,##0.00")`，验证显示 `1,234.50`；输入 `=TEXT(0.75, "0%")`，验证显示 `75%`
    - _Requirements: 3.1-3.14_

  - [x] 18.4 创建 `e2e/formula-logic.spec.ts`，编写逻辑函数 Playwright E2E 测试，逐一测试全部 7 个逻辑函数
    - 测试 IF：输入 `=IF(1>0, "是", "否")`，验证显示 `是`；输入 `=IF(1<0, "是", "否")`，验证显示 `否`；输入 `=IF(0, "真", "假")`，验证显示 `假`（隐式布尔转换）
    - 测试 AND：输入 `=AND(TRUE, TRUE)`，验证显示 `TRUE`；输入 `=AND(TRUE, FALSE)`，验证显示 `FALSE`；输入 `=AND(1>0, 2>1)`，验证显示 `TRUE`
    - 测试 OR：输入 `=OR(FALSE, TRUE)`，验证显示 `TRUE`；输入 `=OR(FALSE, FALSE)`，验证显示 `FALSE`；输入 `=OR(1>0, 1<0)`，验证显示 `TRUE`
    - 测试 NOT：输入 `=NOT(TRUE)`，验证显示 `FALSE`；输入 `=NOT(FALSE)`，验证显示 `TRUE`；输入 `=NOT(0)`，验证显示 `TRUE`
    - 测试 IFERROR：输入 `=IFERROR(1/0, "错误")`，验证显示 `错误`；输入 `=IFERROR(10, "错误")`，验证显示 `10`；输入 `=IFERROR(SQRT(-1), 0)`，验证显示 `0`
    - 测试 IFS：输入 `=IFS(FALSE, "A", TRUE, "B")`，验证显示 `B`；在 A1 输入 `85`，输入 `=IFS(A1>90, "优", A1>60, "及格", TRUE, "不及格")`，验证显示 `及格`
    - 测试 SWITCH：输入 `=SWITCH(2, 1, "一", 2, "二", "其他")`，验证显示 `二`；输入 `=SWITCH(9, 1, "一", 2, "二", "其他")`，验证显示 `其他`
    - 测试 IFS 无匹配错误：输入 `=IFS(FALSE, "A", FALSE, "B")`，验证显示 `#N/A`
    - 测试 SWITCH 无匹配无默认值错误：输入 `=SWITCH(9, 1, "一", 2, "二")`，验证显示 `#N/A`
    - _Requirements: 4.1-4.11_

  - [x] 18.5 创建 `e2e/formula-lookup.spec.ts`，编写查找引用函数 Playwright E2E 测试，逐一测试全部 6 个查找引用函数
    - 测试数据准备：在 A1:C4 构建数据表（A 列：姓名，B 列：部门，C 列：工资）
    - 测试 VLOOKUP 精确匹配：输入 `=VLOOKUP("张三", A1:C4, 3, FALSE)`，验证返回对应工资值；输入 `=VLOOKUP("不存在", A1:C4, 3, FALSE)`，验证显示 `#N/A`
    - 测试 VLOOKUP 近似匹配：构建有序数据，输入 `=VLOOKUP(85, A1:B5, 2, TRUE)`，验证返回近似匹配结果
    - 测试 HLOOKUP：构建横向数据表，输入 `=HLOOKUP("目标", A1:E3, 2, FALSE)`，验证返回正确行值；未找到时验证显示 `#N/A`
    - 测试 INDEX：输入 `=INDEX(A1:C4, 2, 3)`，验证返回第 2 行第 3 列的值；输入 `=INDEX(A1:C4, 99, 1)`，验证显示 `#REF!`
    - 测试 MATCH：输入 `=MATCH("张三", A1:A4, 0)`，验证返回正确位置（从 1 开始）；输入 `=MATCH("不存在", A1:A4, 0)`，验证显示 `#N/A`
    - 测试 INDEX+MATCH 组合：输入 `=INDEX(C1:C4, MATCH("张三", A1:A4, 0))`，验证返回正确工资值
    - 测试 OFFSET：在 A1 输入 `100`，输入 `=OFFSET(A1, 2, 3)`，验证返回偏移后单元格的值
    - 测试 INDIRECT：在 A1 输入 `42`，输入 `=INDIRECT("A1")`，验证显示 `42`；输入 `=INDIRECT("无效引用")`，验证显示 `#REF!`
    - _Requirements: 5.1-5.12_

  - [x] 18.6 创建 `e2e/formula-date.spec.ts`，编写日期函数 Playwright E2E 测试，逐一测试全部 9 个日期函数
    - 测试 TODAY：输入 `=TODAY()`，验证显示当前日期（格式 yyyy-MM-dd）
    - 测试 NOW：输入 `=NOW()`，验证显示当前日期和时间（格式 yyyy-MM-dd HH:mm:ss）
    - 测试 DATE：输入 `=DATE(2024, 1, 15)`，验证显示 `2024-01-15`；输入 `=DATE(2024, 13, 1)`，验证自动进位到下一年
    - 测试 YEAR：输入 `=YEAR("2024-01-15")`，验证显示 `2024`；输入 `=YEAR(DATE(2024, 6, 15))`，验证显示 `2024`
    - 测试 MONTH：输入 `=MONTH("2024-01-15")`，验证显示 `1`；输入 `=MONTH(DATE(2024, 12, 25))`，验证显示 `12`
    - 测试 DAY：输入 `=DAY("2024-01-15")`，验证显示 `15`；输入 `=DAY(DATE(2024, 2, 29))`，验证显示 `29`（闰年）
    - 测试 DATEDIF：输入 `=DATEDIF("2024-01-01", "2024-12-31", "D")`，验证显示 `365`；输入 `=DATEDIF("2024-01-01", "2024-12-31", "M")`，验证显示 `11`；输入 `=DATEDIF("2024-01-01", "2024-12-31", "Y")`，验证显示 `0`
    - 测试 DATEDIF 错误：输入 `=DATEDIF("2024-12-31", "2024-01-01", "D")`，验证显示 `#NUM!`（开始晚于结束）；输入 `=DATEDIF("2024-01-01", "2024-12-31", "X")`，验证显示 `#NUM!`（无效单位）
    - 测试 EDATE：输入 `=EDATE("2024-01-15", 3)`，验证显示 `2024-04-15`；输入 `=EDATE("2024-01-31", 1)`，验证显示 `2024-02-29`（闰年月末调整）
    - 测试 EOMONTH：输入 `=EOMONTH("2024-01-15", 0)`，验证显示 `2024-01-31`；输入 `=EOMONTH("2024-01-15", 1)`，验证显示 `2024-02-29`（闰年）
    - 测试日期函数非法参数：输入 `=YEAR("不是日期")`，验证显示 `#VALUE!`
    - _Requirements: 6.1-6.12_

  - [x] 18.7 创建 `e2e/formula-bar.spec.ts`，编写公式栏交互 E2E 测试
    - 测试语法高亮：输入 `=SUM(A1:B10)` 后验证函数名 `SUM` 使用函数高亮色、`A1:B10` 使用引用高亮色
    - 测试语法高亮字符串：输入 `=LEFT("Hello", 3)` 后验证 `"Hello"` 使用字符串高亮色
    - 测试语法高亮数字：输入 `=ROUND(3.14, 2)` 后验证 `3.14` 和 `2` 使用数字高亮色
    - 测试自动补全触发：输入 `=SU` 验证弹出候选列表包含 SUM、SUMIF、SUMIFS、SUBSTITUTE 等
    - 测试自动补全选择：从候选列表选择 SUM，验证公式栏插入 `SUM(`
    - 测试自动补全前缀过滤：输入 `=CO` 验证候选列表包含 COUNT、COUNTA、COUNTIF、COUNTIFS、CONCATENATE
    - 测试参数提示：输入 `=VLOOKUP(` 后验证显示参数说明（lookup_value, table_array, col_index_num, range_lookup）
    - 测试参数提示切换：输入 `=IF(` 后验证显示 IF 的参数说明（logical_test, value_if_true, value_if_false）
    - 测试键盘导航 - 上下方向键：验证在候选列表中上下移动选中项
    - 测试键盘导航 - Tab 确认：验证按 Tab 键确认选中的候选项
    - 测试键盘导航 - Enter 确认：验证按 Enter 键确认选中的候选项
    - 测试键盘导航 - Escape 关闭：验证按 Escape 键关闭候选列表
    - _Requirements: 7.1-7.10_

  - [x] 18.8 创建 `e2e/formula-array.spec.ts`，编写数组公式 E2E 测试
    - 测试 CSE 输入：在单元格输入 `=A1:A5*B1:B5`，按 Ctrl+Shift+Enter，验证公式被标记为数组公式
    - 测试花括号显示：确认数组公式后，选中该单元格，验证公式栏显示 `{=A1:A5*B1:B5}`
    - 测试逐元素运算：在 A1:A3 填入 `2,3,4`，B1:B3 填入 `10,20,30`，CSE 输入 `=A1:A3*B1:B3`，验证结果区域显示 `20,60,120`
    - 测试区域保护 - 编辑阻止：尝试双击数组公式区域中的非起始单元格进行编辑，验证被阻止并显示提示
    - 测试区域保护 - 部分删除阻止：选中数组公式区域中的部分单元格按 Delete，验证被阻止
    - 测试整体删除：选中整个数组公式区域按 Delete，验证全部清除
    - 测试结果区域重叠：数组公式结果区域与已有数据重叠时，验证弹出确认对话框
    - _Requirements: 8.1-8.7_

  - [x] 18.9 创建 `e2e/formula-circular.spec.ts`，编写循环引用 E2E 测试
    - 测试直接循环引用：在 A1 输入 `=A1+1`，验证被阻止并显示循环引用警告
    - 测试直接循环引用内容保留：验证 A1 的原有内容未被修改
    - 测试间接循环引用：A1 输入 `=B1`（成功），B1 输入 `=A1`，验证 B1 被阻止并显示警告
    - 测试间接循环引用链：A1 输入 `=B1`，B1 输入 `=C1`，C1 输入 `=A1`，验证 C1 被阻止
    - 测试断开循环后恢复：在上述场景中修改 B1 为普通值，然后 C1 输入 `=A1`，验证可以正常写入
    - _Requirements: 10.1-10.6_

  - [x] 18.10 创建 `e2e/formula-errors.spec.ts`，编写错误处理 E2E 测试，覆盖所有 6 种错误类型
    - 测试 `#VALUE!` 错误：输入 `=ABS("文本")`，验证显示 `#VALUE!`；输入 `=ROUND("abc", 2)`，验证显示 `#VALUE!`
    - 测试 `#REF!` 错误：输入 `=INDEX(A1:B2, 99, 1)`，验证显示 `#REF!`；输入 `=INDIRECT("无效")`，验证显示 `#REF!`
    - 测试 `#DIV/0!` 错误：输入 `=MOD(10, 0)`，验证显示 `#DIV/0!`；输入 `=1/0`，验证显示 `#DIV/0!`
    - 测试 `#NAME?` 错误：输入 `=未定义名称`，验证显示 `#NAME?`；输入 `=NOTAFUNCTION(1)`，验证显示 `#NAME?`
    - 测试 `#NUM!` 错误：输入 `=SQRT(-1)`，验证显示 `#NUM!`；输入 `=DATEDIF("2024-12-31", "2024-01-01", "D")`，验证显示 `#NUM!`
    - 测试 `#N/A` 错误：输入 `=VLOOKUP("不存在", A1:B3, 2, FALSE)`，验证显示 `#N/A`；输入 `=MATCH("不存在", A1:A5, 0)`，验证显示 `#N/A`
    - 测试错误传播：在 A1 输入 `=1/0`（产生 `#DIV/0!`），在 B1 输入 `=A1+1`，验证 B1 也显示 `#DIV/0!`
    - 测试 IFERROR 拦截错误传播：在 C1 输入 `=IFERROR(A1+1, "已处理")`，验证显示 `已处理`
    - _Requirements: 1.11-1.13, 2.10-2.11, 3.13-3.14, 4.9-4.10, 5.9-5.12, 6.10-6.12_

  - [x] 18.11 创建 `e2e/formula-nested.spec.ts`，编写嵌套公式与跨函数组合 E2E 测试
    - 测试数学+逻辑嵌套：在 A1:A5 填入 `10,20,30,40,50`，输入 `=IF(SUM(A1:A5)>100, "大", "小")`，验证显示 `大`
    - 测试文本+逻辑嵌套：输入 `=IF(LEN("Hello")>3, UPPER("hello"), LOWER("HELLO"))`，验证显示 `HELLO`
    - 测试统计+数学嵌套：在 A1:A5 填入 `1,2,3,4,5`，输入 `=ROUND(AVERAGE(A1:A5), 0)`，验证显示 `3`
    - 测试查找+文本嵌套：构建数据表，输入 `=UPPER(VLOOKUP("张三", A1:C4, 2, FALSE))`，验证返回大写部门名
    - 测试多层嵌套：输入 `=IF(AND(ABS(-5)>3, OR(1>0, 2<0)), CONCATENATE("结果:", "通过"), "失败")`，验证显示 `结果:通过`
    - 测试 IFERROR+VLOOKUP 组合：输入 `=IFERROR(VLOOKUP("不存在", A1:B3, 2, FALSE), "未找到")`，验证显示 `未找到`
    - 测试日期+数学嵌套：输入 `=YEAR(DATE(2024, 1, 15)) + 1`，验证显示 `2025`
    - _Requirements: 1.1-1.13, 2.1-2.11, 3.1-3.14, 4.1-4.11, 5.1-5.12, 6.1-6.12_


- [x] 19. 浏览器 MCP 手动验证 - 全函数覆盖
  - [x] 19.1 启动开发服务器并打开应用
    - 使用 `npm run dev` 启动开发服务器（端口 3000）
    - 通过 chrome_devtools 导航到 `http://localhost:3000`
    - 截图验证页面正常加载，公式栏可见且位于工具栏下方

  - [x] 19.2 验证所有数学函数（10 个：ABS, ROUND, CEILING, FLOOR, MOD, POWER, SQRT, MAX, MIN, AVERAGE）
    - 双击 A1，输入 `=ABS(-5)` 并按 Enter，截图验证显示 `5`
    - 双击 A2，输入 `=ABS(0)` 并按 Enter，截图验证显示 `0`
    - 双击 A3，输入 `=ROUND(3.456, 2)` 并按 Enter，截图验证显示 `3.46`
    - 双击 A4，输入 `=ROUND(3.455, 2)` 并按 Enter，截图验证显示 `3.46`
    - 双击 A5，输入 `=CEILING(4.2, 1)` 并按 Enter，截图验证显示 `5`
    - 双击 A6，输入 `=FLOOR(4.8, 1)` 并按 Enter，截图验证显示 `4`
    - 双击 A7，输入 `=MOD(10, 3)` 并按 Enter，截图验证显示 `1`
    - 双击 A8，输入 `=POWER(2, 3)` 并按 Enter，截图验证显示 `8`
    - 双击 A9，输入 `=SQRT(16)` 并按 Enter，截图验证显示 `4`
    - 在 B1:B5 填入 `3, 1, 4, 1, 5`，双击 B6，输入 `=MAX(B1:B5)` 并按 Enter，截图验证显示 `5`
    - 双击 B7，输入 `=MIN(B1:B5)` 并按 Enter，截图验证显示 `1`
    - 在 C1:C5 填入 `10, 20, 30, 40, 50`，双击 C6，输入 `=AVERAGE(C1:C5)` 并按 Enter，截图验证显示 `30`

  - [x] 19.3 验证所有统计函数（7 个：COUNT, COUNTA, COUNTIF, COUNTIFS, SUMIF, SUMIFS, AVERAGEIF）
    - 清空工作表，在 A1:A5 填入 `1, "文本", 3, , 5`（A4 留空）
    - 双击 D1，输入 `=COUNT(A1:A5)` 并按 Enter，截图验证显示 `3`
    - 双击 D2，输入 `=COUNTA(A1:A5)` 并按 Enter，截图验证显示 `4`
    - 在 A1:A5 重新填入 `1, 5, 8, 3, 10`，B1:B5 填入 `100, 200, 300, 400, 500`
    - 双击 D3，输入 `=COUNTIF(A1:A5, ">5")` 并按 Enter，截图验证显示 `2`
    - 双击 D4，输入 `=COUNTIFS(A1:A5, ">3", B1:B5, "<400")` 并按 Enter，截图验证显示 `2`
    - 双击 D5，输入 `=SUMIF(A1:A5, ">5", B1:B5)` 并按 Enter，截图验证显示 `800`
    - 双击 D6，输入 `=SUMIFS(B1:B5, A1:A5, ">3", B1:B5, ">200")` 并按 Enter，截图验证结果正确
    - 双击 D7，输入 `=AVERAGEIF(A1:A5, ">5", B1:B5)` 并按 Enter，截图验证显示 `400`

  - [x] 19.4 验证所有文本函数（12 个：LEFT, RIGHT, MID, LEN, TRIM, UPPER, LOWER, CONCATENATE, SUBSTITUTE, FIND, SEARCH, TEXT）
    - 双击 E1，输入 `=LEFT("Hello", 3)` 并按 Enter，截图验证显示 `Hel`
    - 双击 E2，输入 `=RIGHT("Hello", 3)` 并按 Enter，截图验证显示 `llo`
    - 双击 E3，输入 `=MID("Hello", 2, 3)` 并按 Enter，截图验证显示 `ell`
    - 双击 E4，输入 `=LEN("Hello")` 并按 Enter，截图验证显示 `5`
    - 双击 E5，输入 `=TRIM("  Hello  ")` 并按 Enter，截图验证显示 `Hello`
    - 双击 E6，输入 `=UPPER("hello")` 并按 Enter，截图验证显示 `HELLO`
    - 双击 E7，输入 `=LOWER("HELLO")` 并按 Enter，截图验证显示 `hello`
    - 双击 E8，输入 `=CONCATENATE("A", "B", "C")` 并按 Enter，截图验证显示 `ABC`
    - 双击 E9，输入 `=SUBSTITUTE("Hello World", "World", "Excel")` 并按 Enter，截图验证显示 `Hello Excel`
    - 双击 E10，输入 `=FIND("lo", "Hello")` 并按 Enter，截图验证显示 `4`
    - 双击 E11，输入 `=SEARCH("LO", "Hello")` 并按 Enter，截图验证显示 `4`（不区分大小写）
    - 双击 E12，输入 `=TEXT(1234.5, "#,##0.00")` 并按 Enter，截图验证显示 `1,234.50`

  - [x] 19.5 验证所有逻辑函数（7 个：IF, AND, OR, NOT, IFERROR, IFS, SWITCH）
    - 双击 F1，输入 `=IF(1>0, "是", "否")` 并按 Enter，截图验证显示 `是`
    - 双击 F2，输入 `=AND(TRUE, TRUE)` 并按 Enter，截图验证显示 `TRUE`
    - 双击 F3，输入 `=AND(TRUE, FALSE)` 并按 Enter，截图验证显示 `FALSE`
    - 双击 F4，输入 `=OR(FALSE, TRUE)` 并按 Enter，截图验证显示 `TRUE`
    - 双击 F5，输入 `=NOT(TRUE)` 并按 Enter，截图验证显示 `FALSE`
    - 双击 F6，输入 `=IFERROR(1/0, "错误")` 并按 Enter，截图验证显示 `错误`
    - 双击 F7，输入 `=IFERROR(10, "错误")` 并按 Enter，截图验证显示 `10`
    - 双击 F8，输入 `=IFS(FALSE, "A", TRUE, "B")` 并按 Enter，截图验证显示 `B`
    - 双击 F9，输入 `=SWITCH(2, 1, "一", 2, "二", "其他")` 并按 Enter，截图验证显示 `二`
    - 双击 F10，输入 `=SWITCH(9, 1, "一", 2, "二", "其他")` 并按 Enter，截图验证显示 `其他`

  - [x] 19.6 验证所有查找引用函数（6 个：VLOOKUP, HLOOKUP, INDEX, MATCH, OFFSET, INDIRECT）
    - 清空工作表，构建数据表：A1:C4 填入（A 列：张三/李四/王五/赵六，B 列：销售/技术/销售/财务，C 列：5000/8000/6000/7000）
    - 双击 G1，输入 `=VLOOKUP("李四", A1:C4, 3, FALSE)` 并按 Enter，截图验证显示 `8000`
    - 双击 G2，输入 `=VLOOKUP("不存在", A1:C4, 3, FALSE)` 并按 Enter，截图验证显示 `#N/A`
    - 构建横向数据表用于 HLOOKUP 测试，双击 G3，输入 HLOOKUP 公式，截图验证返回正确值
    - 双击 G4，输入 `=INDEX(A1:C4, 2, 3)` 并按 Enter，截图验证显示 `8000`
    - 双击 G5，输入 `=MATCH("王五", A1:A4, 0)` 并按 Enter，截图验证显示 `3`
    - 双击 G6，输入 `=INDEX(C1:C4, MATCH("王五", A1:A4, 0))` 并按 Enter，截图验证显示 `6000`
    - 在 H1 输入 `42`，双击 G7，输入 `=OFFSET(A1, 0, 7)` 并按 Enter，截图验证显示 `42`（即 H1 的值）
    - 双击 G8，输入 `=INDIRECT("H1")` 并按 Enter，截图验证显示 `42`
    - 双击 G9，输入 `=INDIRECT("无效引用")` 并按 Enter，截图验证显示 `#REF!`

  - [x] 19.7 验证所有日期函数（9 个：TODAY, NOW, DATE, YEAR, MONTH, DAY, DATEDIF, EDATE, EOMONTH）
    - 双击 H2，输入 `=TODAY()` 并按 Enter，截图验证显示当前日期
    - 双击 H3，输入 `=NOW()` 并按 Enter，截图验证显示当前日期和时间
    - 双击 H4，输入 `=DATE(2024, 1, 15)` 并按 Enter，截图验证显示 `2024-01-15`
    - 双击 H5，输入 `=YEAR("2024-06-15")` 并按 Enter，截图验证显示 `2024`
    - 双击 H6，输入 `=MONTH("2024-06-15")` 并按 Enter，截图验证显示 `6`
    - 双击 H7，输入 `=DAY("2024-06-15")` 并按 Enter，截图验证显示 `15`
    - 双击 H8，输入 `=DATEDIF("2024-01-01", "2024-12-31", "D")` 并按 Enter，截图验证显示 `365`
    - 双击 H9，输入 `=EDATE("2024-01-15", 3)` 并按 Enter，截图验证显示 `2024-04-15`
    - 双击 H10，输入 `=EOMONTH("2024-01-15", 0)` 并按 Enter，截图验证显示 `2024-01-31`

  - [x] 19.8 验证公式栏交互（语法高亮、自动补全、参数提示）
    - 双击单元格进入编辑模式，输入 `=SU`，截图验证自动补全候选列表出现且包含 SUM
    - 按上下方向键移动选中项，截图验证选中项变化
    - 按 Tab 确认选中 SUM，截图验证公式栏显示 `=SUM(`
    - 输入 `=VLOOKUP(`，截图验证显示参数说明提示
    - 输入完整公式 `=SUM(A1:A5)` 后，截图验证语法高亮：函数名、引用、运算符颜色不同
    - 按 Escape 验证候选列表关闭

  - [x] 19.9 验证错误处理与循环引用
    - 双击空单元格，输入 `=SQRT(-1)` 并按 Enter，截图验证显示 `#NUM!`
    - 双击空单元格，输入 `=1/0` 并按 Enter，截图验证显示 `#DIV/0!`
    - 双击空单元格，输入 `=ABS("文本")` 并按 Enter，截图验证显示 `#VALUE!`
    - 双击空单元格，输入 `=VLOOKUP("不存在", A1:B3, 2, FALSE)` 并按 Enter，截图验证显示 `#N/A`
    - 双击空单元格，输入 `=INDEX(A1:B2, 99, 1)` 并按 Enter，截图验证显示 `#REF!`
    - 在空单元格（如 I1）输入 `=I1+1`（自引用），截图验证循环引用警告提示出现
    - 验证 I1 内容未被修改（循环引用阻止写入）
    - 在 J1 输入 `=K1`，在 K1 输入 `=J1`，截图验证间接循环引用被检测并阻止

  - [x] 19.10 验证嵌套公式与复杂场景
    - 在 A1:A5 填入 `10, 20, 30, 40, 50`
    - 双击 L1，输入 `=IF(SUM(A1:A5)>100, "大", "小")` 并按 Enter，截图验证显示 `大`
    - 双击 L2，输入 `=ROUND(AVERAGE(A1:A5), 0)` 并按 Enter，截图验证显示 `30`
    - 双击 L3，输入 `=IFERROR(VLOOKUP("不存在", A1:B5, 2, FALSE), "未找到")` 并按 Enter，截图验证显示 `未找到`
    - 双击 L4，输入 `=CONCATENATE("总计:", SUM(A1:A5))` 并按 Enter，截图验证显示 `总计:150`
    - 双击 L5，输入 `=IF(AND(MAX(A1:A5)>40, MIN(A1:A5)>5), "全部达标", "未达标")` 并按 Enter，截图验证显示 `全部达标`
    - 截图验证整体页面状态，确认所有公式结果正确显示

## Notes

- 标记 `*` 的任务为可选测试任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点任务用于阶段性验证，确保增量开发的正确性
- 属性测试验证设计文档中定义的 36 个正确性属性
- 单元测试和属性测试互补：单元测试验证具体示例和边界条件，属性测试验证跨所有输入的通用属性
- E2E 测试覆盖全部 51 个函数，每个函数至少有 2 个测试用例（正常值和边界/错误情况）
- 浏览器 MCP 验证覆盖全部 6 大函数类别，通过截图确认 UI 渲染正确性