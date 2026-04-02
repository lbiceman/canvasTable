# 需求文档：P1 公式能力补齐

## 简介

为 Canvas Excel (ice-excel) 电子表格应用补齐 P1 优先级的公式能力。经过代码审查，前一轮 formula-calculation spec 已实现大部分函数（SUMIF/SUMIFS/COUNTIF/COUNTIFS/AVERAGEIF、IFERROR/IFS、INDEX/MATCH、CONCATENATE、LEFT/RIGHT/MID/FIND/SUBSTITUTE、ROUND）。本需求聚焦于尚未实现的函数（IFNA、TEXTJOIN、ROUNDUP、ROUNDDOWN、INT、TRUNC）、跨 Sheet 引用的完整性验证，以及内联编辑器中的公式自动补全集成。

## 术语表

- **FormulaEngine**：公式引擎，负责公式解析、求值和依赖管理的核心单例模块
- **FunctionRegistry**：函数注册表，集中管理所有可用函数的元数据和 handler 实现
- **FormulaBar**：公式栏组件，位于工具栏下方，已具备自动补全和语法高亮功能
- **InlineEditor**：内联编辑器，单元格双击或直接输入时出现的浮动编辑组件
- **AutoComplete**：自动补全组件，根据输入前缀从 FunctionRegistry 搜索候选项并支持键盘导航
- **Tokenizer**：词法分析器，将公式字符串分解为 Token 序列，已支持 SheetRef 类型 Token
- **Parser**：语法分析器，将 Token 序列构建为 AST，已支持 parseSheetRefOrRange 方法
- **SheetManager**：多工作表管理器，管理工作表的创建、切换和数据隔离
- **FormulaValue**：公式值类型，支持 number、string、boolean、FormulaError 和二维数组

## 需求

### 需求 1：IFNA 逻辑函数

**用户故事：** 作为电子表格用户，我希望使用 IFNA 函数捕获 #N/A 错误并返回替代值，以便在 VLOOKUP/MATCH 等查找函数未找到匹配时提供友好的默认值，而不影响其他类型错误的传播。

#### 验收标准

1. WHEN 用户输入包含 IFNA 函数的公式且第一个参数产生 #N/A 错误（如 `=IFNA(VLOOKUP("不存在", A1:B10, 2, FALSE), "未找到")`），THE FormulaEngine SHALL 返回第二个参数的值
2. WHEN 用户输入包含 IFNA 函数的公式且第一个参数产生非 #N/A 类型的错误（如 #VALUE!、#REF!、#DIV/0!），THE FormulaEngine SHALL 原样传播该错误而非返回替代值
3. WHEN 用户输入包含 IFNA 函数的公式且第一个参数正常计算无错误，THE FormulaEngine SHALL 返回第一个参数的计算结果
4. THE FunctionRegistry SHALL 将 IFNA 注册为 logic 类别函数，接受 2 个参数（value, value_if_na）

### 需求 2：TEXTJOIN 文本函数

**用户故事：** 作为电子表格用户，我希望使用 TEXTJOIN 函数将多个文本值用指定分隔符连接，并可选择忽略空值，以便比 CONCATENATE 更灵活地拼接文本数据。

#### 验收标准

1. WHEN 用户输入包含 TEXTJOIN 函数的公式（如 `=TEXTJOIN(",", TRUE, A1:A5)`），THE FormulaEngine SHALL 使用第一个参数作为分隔符将后续参数的文本值连接为一个字符串
2. WHEN TEXTJOIN 的第二个参数为 TRUE 且参数中包含空字符串，THE FormulaEngine SHALL 跳过空字符串不参与连接（不产生连续分隔符）
3. WHEN TEXTJOIN 的第二个参数为 FALSE 且参数中包含空字符串，THE FormulaEngine SHALL 保留空字符串的位置（产生连续分隔符）
4. WHEN TEXTJOIN 接收区域引用作为参数（如 `=TEXTJOIN("-", TRUE, A1:C1)`），THE FormulaEngine SHALL 将区域中的所有单元格值展平后依次连接
5. THE FunctionRegistry SHALL 将 TEXTJOIN 注册为 text 类别函数，接受至少 3 个参数（delimiter, ignore_empty, text1, ...），最大参数数量不限

### 需求 3：ROUNDUP、ROUNDDOWN、INT、TRUNC 数学函数

**用户故事：** 作为电子表格用户，我希望使用 ROUNDUP（向上舍入）、ROUNDDOWN（向下舍入）、INT（取整）和 TRUNC（截断）函数，以便对数值进行不同方向的舍入操作，满足财务计算和数据处理的精度需求。

#### 验收标准

1. WHEN 用户输入包含 ROUNDUP 函数的公式（如 `=ROUNDUP(3.141, 2)`），THE FormulaEngine SHALL 将数值向远离零的方向舍入到指定小数位数（结果为 `3.15`）
2. WHEN 用户输入包含 ROUNDUP 函数的公式且数值为负数（如 `=ROUNDUP(-3.141, 2)`），THE FormulaEngine SHALL 将数值向远离零的方向舍入（结果为 `-3.15`）
3. WHEN 用户输入包含 ROUNDDOWN 函数的公式（如 `=ROUNDDOWN(3.149, 2)`），THE FormulaEngine SHALL 将数值向接近零的方向舍入到指定小数位数（结果为 `3.14`）
4. WHEN 用户输入包含 ROUNDDOWN 函数的公式且数值为负数（如 `=ROUNDDOWN(-3.149, 2)`），THE FormulaEngine SHALL 将数值向接近零的方向舍入（结果为 `-3.14`）
5. WHEN 用户输入包含 INT 函数的公式（如 `=INT(3.7)`），THE FormulaEngine SHALL 返回小于或等于参数的最大整数（结果为 `3`）
6. WHEN 用户输入包含 INT 函数的公式且参数为负数（如 `=INT(-3.2)`），THE FormulaEngine SHALL 返回小于或等于参数的最大整数（结果为 `-4`）
7. WHEN 用户输入包含 TRUNC 函数的公式（如 `=TRUNC(3.7)`），THE FormulaEngine SHALL 截断小数部分返回整数部分（结果为 `3`）
8. WHEN 用户输入包含 TRUNC 函数的公式且参数为负数（如 `=TRUNC(-3.7)`），THE FormulaEngine SHALL 截断小数部分返回整数部分（结果为 `-3`）
9. WHEN 用户输入包含 TRUNC 函数的公式且指定小数位数（如 `=TRUNC(3.149, 2)`），THE FormulaEngine SHALL 截断到指定小数位数（结果为 `3.14`）
10. IF ROUNDUP、ROUNDDOWN、INT 或 TRUNC 函数接收到非数值参数，THEN THE FormulaEngine SHALL 返回 `#VALUE!` 错误
11. THE FunctionRegistry SHALL 将 ROUNDUP 和 ROUNDDOWN 注册为 math 类别函数，各接受 2 个参数（number, num_digits）
12. THE FunctionRegistry SHALL 将 INT 注册为 math 类别函数，接受 1 个参数（number）
13. THE FunctionRegistry SHALL 将 TRUNC 注册为 math 类别函数，接受 1 至 2 个参数（number, [num_digits]），num_digits 默认为 0

### 需求 4：跨 Sheet 引用验证与完整性

**用户故事：** 作为多工作表用户，我希望在公式中使用 `Sheet1!A1` 和 `Sheet1!A1:B10` 语法引用其他工作表的数据，并在工作表名称无效或不存在时获得明确的错误提示，以便安全地进行跨表数据计算。

#### 验收标准

1. WHEN 用户输入包含跨 Sheet 单元格引用的公式（如 `=Sheet1!A1`），THE FormulaEngine SHALL 从指定工作表获取对应单元格的值参与计算
2. WHEN 用户输入包含跨 Sheet 区域引用的公式（如 `=SUM(Sheet1!A1:B10)`），THE FormulaEngine SHALL 从指定工作表获取对应区域的所有单元格值参与计算
3. IF 公式中引用的工作表名称在 SheetManager 中不存在，THEN THE FormulaEngine SHALL 返回 `#REF!` 错误并附带描述性错误消息
4. WHEN 工作表名称包含空格或特殊字符时（如 `'Sheet 1'!A1`），THE Tokenizer SHALL 正确解析带单引号包裹的工作表名称
5. WHEN 用户重命名工作表，THE FormulaEngine SHALL 保持引用该工作表的公式正常工作（通过 SheetManager 的名称映射解析）
6. WHEN 用户删除一个被其他工作表公式引用的工作表，THE FormulaEngine SHALL 将引用该工作表的公式求值结果更新为 `#REF!` 错误
7. THE FormulaEngine SHALL 支持跨 Sheet 引用与函数的组合使用（如 `=VLOOKUP(A1, Sheet2!A1:C10, 3, FALSE)`）

### 需求 5：内联编辑器公式自动补全

**用户故事：** 作为电子表格用户，我希望在单元格内直接输入公式时也能获得自动补全候选列表，以便无需切换到公式栏即可快速输入函数名。

#### 验收标准

1. WHILE 用户在 InlineEditor 中输入以 `=` 开头的内容并键入函数名前缀字符，THE InlineEditor SHALL 在编辑器下方显示匹配的函数名候选列表
2. WHEN 用户在 InlineEditor 的自动补全列表中按下上下方向键，THE InlineEditor SHALL 在候选列表中移动选中项
3. WHEN 用户在 InlineEditor 的自动补全列表中按下 Tab 键，THE InlineEditor SHALL 将选中的函数名和左括号插入到编辑内容中
4. WHEN 用户在 InlineEditor 中按下 Escape 键且自动补全列表可见，THE InlineEditor SHALL 关闭候选列表而不退出编辑模式
5. THE InlineEditor SHALL 复用 FormulaBar 中已有的 AutoComplete 组件和 FunctionRegistry 实例，保持候选项列表与公式栏一致
6. WHEN 用户从自动补全列表中选择函数后继续输入参数，THE InlineEditor SHALL 在编辑器下方显示该函数的参数说明提示
