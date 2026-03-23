# 需求文档：公式与计算

## 简介

为 Canvas Excel (ice-excel) 电子表格应用扩展公式与计算功能模块。当前系统仅支持 SUM、SUBTRACT、MULTIPLY、DIVIDE 四个基础函数及区域引用和跨 Sheet 引用。本需求旨在补齐数学、统计、文本、逻辑、查找引用、日期六大函数类别，增强公式栏交互体验，并支持数组公式、命名范围和循环引用检测。

## 术语表

- **FormulaEngine**：公式引擎，负责公式解析、求值和依赖管理的核心模块
- **FormulaBar**：公式栏，位于工具栏下方的公式输入与显示区域
- **CellReference**：单元格引用，如 `A1`、`B2`，用于在公式中引用单元格值
- **RangeReference**：区域引用，如 `A1:B10`，用于在公式中引用一个矩形区域
- **NamedRange**：命名范围，用户定义的名称与单元格区域的映射（如 `Sales` 映射到 `Sheet1!A1:A100`）
- **ArrayFormula**：数组公式，通过 Ctrl+Shift+Enter 输入，可对多个单元格同时计算并返回多值结果
- **CircularReference**：循环引用，公式直接或间接引用自身所在单元格，导致无限递归
- **SpreadsheetModel**：数据模型层，管理单元格数据、公式计算和业务逻辑
- **InlineEditor**：内联编辑器，单元格编辑时的浮动输入组件
- **AutoComplete**：自动补全，在公式输入时根据已输入字符提供函数名候选列表

## 需求

### 需求 1：基础数学函数扩展

**用户故事：** 作为电子表格用户，我希望使用常见的数学函数（ABS、ROUND、CEILING、FLOOR、MOD、POWER、SQRT、MAX、MIN、AVERAGE），以便对数值数据进行数学运算。

#### 验收标准

1. WHEN 用户输入包含 ABS 函数的公式（如 `=ABS(-5)`），THE FormulaEngine SHALL 返回参数的绝对值（结果为 `5`）
2. WHEN 用户输入包含 ROUND 函数的公式（如 `=ROUND(3.456, 2)`），THE FormulaEngine SHALL 将第一个参数四舍五入到第二个参数指定的小数位数（结果为 `3.46`）
3. WHEN 用户输入包含 CEILING 函数的公式（如 `=CEILING(4.2, 1)`），THE FormulaEngine SHALL 将第一个参数向上舍入到第二个参数的最近倍数（结果为 `5`）
4. WHEN 用户输入包含 FLOOR 函数的公式（如 `=FLOOR(4.8, 1)`），THE FormulaEngine SHALL 将第一个参数向下舍入到第二个参数的最近倍数（结果为 `4`）
5. WHEN 用户输入包含 MOD 函数的公式（如 `=MOD(10, 3)`），THE FormulaEngine SHALL 返回两个参数相除的余数（结果为 `1`）
6. WHEN 用户输入包含 POWER 函数的公式（如 `=POWER(2, 3)`），THE FormulaEngine SHALL 返回第一个参数的第二个参数次幂（结果为 `8`）
7. WHEN 用户输入包含 SQRT 函数的公式（如 `=SQRT(16)`），THE FormulaEngine SHALL 返回参数的平方根（结果为 `4`）
8. WHEN 用户输入包含 MAX 函数的公式（如 `=MAX(A1:A10)`），THE FormulaEngine SHALL 返回指定区域中的最大数值
9. WHEN 用户输入包含 MIN 函数的公式（如 `=MIN(A1:A10)`），THE FormulaEngine SHALL 返回指定区域中的最小数值
10. WHEN 用户输入包含 AVERAGE 函数的公式（如 `=AVERAGE(A1:A10)`），THE FormulaEngine SHALL 返回指定区域中所有数值的算术平均值
11. IF 数学函数接收到非数值参数，THEN THE FormulaEngine SHALL 返回 `#VALUE!` 错误
12. IF SQRT 函数接收到负数参数，THEN THE FormulaEngine SHALL 返回 `#NUM!` 错误
13. IF MOD 函数的除数为零，THEN THE FormulaEngine SHALL 返回 `#DIV/0!` 错误


### 需求 2：统计函数

**用户故事：** 作为数据分析用户，我希望使用统计函数（COUNT、COUNTA、COUNTIF、COUNTIFS、SUMIF、SUMIFS、AVERAGEIF），以便对数据进行条件统计和汇总分析。

#### 验收标准

1. WHEN 用户输入包含 COUNT 函数的公式（如 `=COUNT(A1:A10)`），THE FormulaEngine SHALL 返回指定区域中包含数值的单元格数量
2. WHEN 用户输入包含 COUNTA 函数的公式（如 `=COUNTA(A1:A10)`），THE FormulaEngine SHALL 返回指定区域中非空单元格的数量
3. WHEN 用户输入包含 COUNTIF 函数的公式（如 `=COUNTIF(A1:A10, ">5")`），THE FormulaEngine SHALL 返回指定区域中满足单个条件的单元格数量
4. WHEN 用户输入包含 COUNTIFS 函数的公式（如 `=COUNTIFS(A1:A10, ">5", B1:B10, "<10")`），THE FormulaEngine SHALL 返回同时满足所有条件对的单元格数量
5. WHEN 用户输入包含 SUMIF 函数的公式（如 `=SUMIF(A1:A10, ">5", B1:B10)`），THE FormulaEngine SHALL 对满足条件的对应求和区域单元格求和
6. WHEN 用户输入包含 SUMIFS 函数的公式（如 `=SUMIFS(C1:C10, A1:A10, ">5", B1:B10, "<10")`），THE FormulaEngine SHALL 对同时满足所有条件的对应求和区域单元格求和
7. WHEN 用户输入包含 AVERAGEIF 函数的公式（如 `=AVERAGEIF(A1:A10, ">5", B1:B10)`），THE FormulaEngine SHALL 返回满足条件的对应区域单元格的算术平均值
8. THE FormulaEngine SHALL 支持统计函数条件参数中的比较运算符（`>`、`<`、`>=`、`<=`、`=`、`<>`）
9. THE FormulaEngine SHALL 支持统计函数条件参数中的通配符（`*` 匹配任意字符序列，`?` 匹配单个字符）
10. IF COUNTIFS 或 SUMIFS 的条件区域大小不一致，THEN THE FormulaEngine SHALL 返回 `#VALUE!` 错误
11. IF AVERAGEIF 没有满足条件的单元格，THEN THE FormulaEngine SHALL 返回 `#DIV/0!` 错误

### 需求 3：文本函数

**用户故事：** 作为电子表格用户，我希望使用文本处理函数（LEFT、RIGHT、MID、LEN、TRIM、UPPER、LOWER、CONCATENATE、SUBSTITUTE、FIND、SEARCH、TEXT），以便对文本数据进行提取、转换和格式化操作。

#### 验收标准

1. WHEN 用户输入包含 LEFT 函数的公式（如 `=LEFT("Hello", 3)`），THE FormulaEngine SHALL 返回文本左侧指定数量的字符（结果为 `Hel`）
2. WHEN 用户输入包含 RIGHT 函数的公式（如 `=RIGHT("Hello", 3)`），THE FormulaEngine SHALL 返回文本右侧指定数量的字符（结果为 `llo`）
3. WHEN 用户输入包含 MID 函数的公式（如 `=MID("Hello", 2, 3)`），THE FormulaEngine SHALL 从指定位置开始返回指定数量的字符（结果为 `ell`）
4. WHEN 用户输入包含 LEN 函数的公式（如 `=LEN("Hello")`），THE FormulaEngine SHALL 返回文本的字符数（结果为 `5`）
5. WHEN 用户输入包含 TRIM 函数的公式（如 `=TRIM("  Hello  ")`），THE FormulaEngine SHALL 去除文本首尾空格并将中间多个连续空格缩减为单个空格
6. WHEN 用户输入包含 UPPER 函数的公式（如 `=UPPER("hello")`），THE FormulaEngine SHALL 将文本转换为全大写（结果为 `HELLO`）
7. WHEN 用户输入包含 LOWER 函数的公式（如 `=LOWER("HELLO")`），THE FormulaEngine SHALL 将文本转换为全小写（结果为 `hello`）
8. WHEN 用户输入包含 CONCATENATE 函数的公式（如 `=CONCATENATE("A", "B", "C")`），THE FormulaEngine SHALL 将所有参数连接为一个字符串（结果为 `ABC`）
9. WHEN 用户输入包含 SUBSTITUTE 函数的公式（如 `=SUBSTITUTE("Hello World", "World", "Excel")`），THE FormulaEngine SHALL 将文本中的指定子串替换为新子串（结果为 `Hello Excel`）
10. WHEN 用户输入包含 FIND 函数的公式（如 `=FIND("lo", "Hello")`），THE FormulaEngine SHALL 返回子串在文本中首次出现的位置（区分大小写，结果为 `4`）
11. WHEN 用户输入包含 SEARCH 函数的公式（如 `=SEARCH("LO", "Hello")`），THE FormulaEngine SHALL 返回子串在文本中首次出现的位置（不区分大小写，结果为 `4`）
12. WHEN 用户输入包含 TEXT 函数的公式（如 `=TEXT(1234.5, "#,##0.00")`），THE FormulaEngine SHALL 将数值按指定格式模式转换为格式化文本（结果为 `1,234.50`）
13. IF FIND 或 SEARCH 未找到子串，THEN THE FormulaEngine SHALL 返回 `#VALUE!` 错误
14. IF MID 的起始位置小于 1 或超出文本长度，THEN THE FormulaEngine SHALL 返回空字符串


### 需求 4：逻辑函数

**用户故事：** 作为电子表格用户，我希望使用逻辑函数（IF、AND、OR、NOT、IFERROR、IFS、SWITCH），以便根据条件进行分支判断和错误处理。

#### 验收标准

1. WHEN 用户输入包含 IF 函数的公式（如 `=IF(A1>10, "大", "小")`），THE FormulaEngine SHALL 根据第一个参数的布尔值返回第二个或第三个参数的值
2. WHEN 用户输入包含 AND 函数的公式（如 `=AND(A1>0, B1<10)`），THE FormulaEngine SHALL 在所有参数均为真时返回 TRUE，否则返回 FALSE
3. WHEN 用户输入包含 OR 函数的公式（如 `=OR(A1>0, B1<10)`），THE FormulaEngine SHALL 在任一参数为真时返回 TRUE，全部为假时返回 FALSE
4. WHEN 用户输入包含 NOT 函数的公式（如 `=NOT(A1>10)`），THE FormulaEngine SHALL 返回参数布尔值的逻辑取反
5. WHEN 用户输入包含 IFERROR 函数的公式（如 `=IFERROR(A1/B1, 0)`），THE FormulaEngine SHALL 在第一个参数产生错误时返回第二个参数的值，否则返回第一个参数的计算结果
6. WHEN 用户输入包含 IFS 函数的公式（如 `=IFS(A1>90, "优", A1>60, "及格", TRUE, "不及格")`），THE FormulaEngine SHALL 按顺序评估条件-值对，返回第一个为真的条件对应的值
7. WHEN 用户输入包含 SWITCH 函数的公式（如 `=SWITCH(A1, 1, "一", 2, "二", "其他")`），THE FormulaEngine SHALL 将第一个参数与后续值-结果对匹配，返回匹配的结果值或默认值
8. IF IF 函数的条件参数无法解析为布尔值，THEN THE FormulaEngine SHALL 将非零数值视为 TRUE，零值和空字符串视为 FALSE
9. IF IFS 函数没有任何条件为真，THEN THE FormulaEngine SHALL 返回 `#N/A` 错误
10. IF SWITCH 函数没有匹配值且未提供默认值，THEN THE FormulaEngine SHALL 返回 `#N/A` 错误
11. THE FormulaEngine SHALL 支持逻辑函数中的比较表达式（`>`、`<`、`>=`、`<=`、`=`、`<>`）作为条件参数

### 需求 5：查找引用函数

**用户故事：** 作为数据分析用户，我希望使用查找引用函数（VLOOKUP、HLOOKUP、INDEX、MATCH、OFFSET、INDIRECT），以便在数据表中进行灵活的数据检索和动态引用。

#### 验收标准

1. WHEN 用户输入包含 VLOOKUP 函数的公式（如 `=VLOOKUP(A1, B1:D10, 3, FALSE)`），THE FormulaEngine SHALL 在指定区域的第一列中查找匹配值，返回同行中指定列号的值
2. WHEN 用户输入包含 HLOOKUP 函数的公式（如 `=HLOOKUP(A1, B1:J3, 2, FALSE)`），THE FormulaEngine SHALL 在指定区域的第一行中查找匹配值，返回同列中指定行号的值
3. WHEN 用户输入包含 INDEX 函数的公式（如 `=INDEX(A1:C10, 3, 2)`），THE FormulaEngine SHALL 返回指定区域中指定行号和列号交叉处的单元格值
4. WHEN 用户输入包含 MATCH 函数的公式（如 `=MATCH("目标", A1:A10, 0)`），THE FormulaEngine SHALL 返回查找值在指定区域中的相对位置（从 1 开始计数）
5. WHEN 用户输入包含 OFFSET 函数的公式（如 `=OFFSET(A1, 2, 3)`），THE FormulaEngine SHALL 返回从基准单元格偏移指定行数和列数后的单元格值
6. WHEN 用户输入包含 INDIRECT 函数的公式（如 `=INDIRECT("A1")`），THE FormulaEngine SHALL 将文本字符串解析为单元格引用并返回该单元格的值
7. WHEN VLOOKUP 或 HLOOKUP 的第四个参数为 TRUE 或省略时，THE FormulaEngine SHALL 执行近似匹配（要求数据已排序）
8. WHEN VLOOKUP 或 HLOOKUP 的第四个参数为 FALSE 时，THE FormulaEngine SHALL 执行精确匹配
9. IF VLOOKUP 或 HLOOKUP 未找到匹配值（精确匹配模式），THEN THE FormulaEngine SHALL 返回 `#N/A` 错误
10. IF INDEX 的行号或列号超出区域范围，THEN THE FormulaEngine SHALL 返回 `#REF!` 错误
11. IF MATCH 未找到匹配值，THEN THE FormulaEngine SHALL 返回 `#N/A` 错误
12. IF INDIRECT 的文本参数无法解析为有效的单元格引用，THEN THE FormulaEngine SHALL 返回 `#REF!` 错误

### 需求 6：日期函数

**用户故事：** 作为电子表格用户，我希望使用日期函数（TODAY、NOW、DATE、YEAR、MONTH、DAY、DATEDIF、EDATE、EOMONTH），以便进行日期计算和日期信息提取。

#### 验收标准

1. WHEN 用户输入包含 TODAY 函数的公式（如 `=TODAY()`），THE FormulaEngine SHALL 返回当前日期（格式为 yyyy-MM-dd）
2. WHEN 用户输入包含 NOW 函数的公式（如 `=NOW()`），THE FormulaEngine SHALL 返回当前日期和时间（格式为 yyyy-MM-dd HH:mm:ss）
3. WHEN 用户输入包含 DATE 函数的公式（如 `=DATE(2024, 1, 15)`），THE FormulaEngine SHALL 根据年、月、日参数构造日期值
4. WHEN 用户输入包含 YEAR 函数的公式（如 `=YEAR("2024-01-15")`），THE FormulaEngine SHALL 返回日期的年份部分
5. WHEN 用户输入包含 MONTH 函数的公式（如 `=MONTH("2024-01-15")`），THE FormulaEngine SHALL 返回日期的月份部分（1-12）
6. WHEN 用户输入包含 DAY 函数的公式（如 `=DAY("2024-01-15")`），THE FormulaEngine SHALL 返回日期的日部分（1-31）
7. WHEN 用户输入包含 DATEDIF 函数的公式（如 `=DATEDIF("2024-01-01", "2024-12-31", "D")`），THE FormulaEngine SHALL 根据第三个参数指定的单位（"Y" 年、"M" 月、"D" 天）返回两个日期之间的差值
8. WHEN 用户输入包含 EDATE 函数的公式（如 `=EDATE("2024-01-15", 3)`），THE FormulaEngine SHALL 返回指定日期加上指定月数后的日期
9. WHEN 用户输入包含 EOMONTH 函数的公式（如 `=EOMONTH("2024-01-15", 0)`），THE FormulaEngine SHALL 返回指定日期加上指定月数后所在月份的最后一天
10. IF 日期函数接收到无法解析为日期的参数，THEN THE FormulaEngine SHALL 返回 `#VALUE!` 错误
11. IF DATEDIF 的开始日期晚于结束日期，THEN THE FormulaEngine SHALL 返回 `#NUM!` 错误
12. IF DATEDIF 的单位参数不是 "Y"、"M"、"D" 之一，THEN THE FormulaEngine SHALL 返回 `#NUM!` 错误


### 需求 7：公式栏增强

**用户故事：** 作为电子表格用户，我希望公式栏具备语法高亮、自动补全、函数提示和参数说明功能，以便更高效、更准确地编写公式。

#### 验收标准

1. WHILE 用户在公式栏中编辑以 `=` 开头的内容，THE FormulaBar SHALL 对函数名、单元格引用、数字常量和字符串常量分别使用不同颜色进行语法高亮显示
2. WHILE 用户在公式栏中输入函数名的前缀字符，THE AutoComplete SHALL 显示匹配的函数名候选列表
3. WHEN 用户从自动补全列表中选择一个函数，THE FormulaBar SHALL 将完整函数名和左括号插入到公式中
4. WHILE 用户在公式栏中输入已识别函数的括号内参数，THE FormulaBar SHALL 在公式栏下方显示该函数的参数说明提示（包含参数名称和简要描述）
5. WHEN 用户按下 Escape 键，THE AutoComplete SHALL 关闭候选列表
6. WHEN 用户按下上下方向键，THE AutoComplete SHALL 在候选列表中移动选中项
7. WHEN 用户按下 Tab 或 Enter 键且候选列表可见，THE AutoComplete SHALL 确认选中的候选项
8. THE FormulaBar SHALL 对所有已注册的函数（数学、统计、文本、逻辑、查找引用、日期函数）提供自动补全支持
9. THE FormulaBar SHALL 对单元格引用（如 `A1`、`B2:C10`）使用与函数名不同的高亮颜色
10. THE FormulaBar SHALL 对字符串常量（双引号包裹的文本）使用与其他元素不同的高亮颜色

### 需求 8：数组公式

**用户故事：** 作为高级用户，我希望通过 Ctrl+Shift+Enter 输入数组公式，以便对多个单元格同时执行计算并返回多值结果。

#### 验收标准

1. WHEN 用户在编辑单元格时按下 Ctrl+Shift+Enter，THE SpreadsheetModel SHALL 将当前公式标记为数组公式
2. WHEN 数组公式被确认输入，THE FormulaBar SHALL 在公式两端显示花括号（如 `{=SUM(A1:A10*B1:B10)}`）以标识数组公式
3. WHEN 数组公式的计算结果为多值数组，THE SpreadsheetModel SHALL 将结果自动填充到以输入单元格为起点的相应区域
4. WHILE 数组公式占据多个单元格，THE SpreadsheetModel SHALL 阻止用户单独编辑或删除数组公式区域中的部分单元格
5. WHEN 用户选中数组公式区域并按下 Delete 键，THE SpreadsheetModel SHALL 删除整个数组公式及其所有结果单元格
6. THE FormulaEngine SHALL 支持数组公式中的逐元素运算（如 `{=A1:A10*B1:B10}` 对两个区域逐元素相乘）
7. IF 数组公式的结果区域与已有数据重叠，THEN THE SpreadsheetModel SHALL 在填充前提示用户确认覆盖

### 需求 9：命名范围

**用户故事：** 作为电子表格用户，我希望定义和使用命名范围（如 `Sales` 映射到 `A1:A100`），以便用有意义的名称替代单元格引用，提高公式的可读性。

#### 验收标准

1. THE SpreadsheetModel SHALL 提供创建命名范围的接口，接受名称字符串和单元格区域引用作为参数
2. THE SpreadsheetModel SHALL 提供编辑已有命名范围的接口，允许修改名称或区域引用
3. THE SpreadsheetModel SHALL 提供删除命名范围的接口
4. WHEN 用户在公式中使用已定义的命名范围名称（如 `=SUM(Sales)`），THE FormulaEngine SHALL 将名称解析为对应的单元格区域并参与计算
5. THE SpreadsheetModel SHALL 验证命名范围名称的合法性：名称以字母或下划线开头，仅包含字母、数字、下划线和句点，且不与单元格引用冲突
6. IF 用户创建的命名范围名称与已有名称重复，THEN THE SpreadsheetModel SHALL 拒绝创建并返回重复名称错误
7. IF 公式中引用的命名范围名称未定义，THEN THE FormulaEngine SHALL 返回 `#NAME?` 错误
8. WHEN 命名范围引用的区域因行列插入或删除而发生偏移，THE SpreadsheetModel SHALL 自动更新命名范围的区域引用
9. THE AutoComplete SHALL 在公式输入时将已定义的命名范围名称纳入自动补全候选列表

### 需求 10：循环引用检测与提示

**用户故事：** 作为电子表格用户，我希望系统能检测并提示循环引用，以便避免公式陷入无限递归导致计算错误。

#### 验收标准

1. WHEN 用户输入的公式直接引用自身所在单元格（如在 A1 中输入 `=A1+1`），THE FormulaEngine SHALL 检测到直接循环引用
2. WHEN 用户输入的公式通过多个单元格间接引用回自身（如 A1 引用 B1，B1 引用 A1），THE FormulaEngine SHALL 检测到间接循环引用
3. WHEN 循环引用被检测到，THE FormulaEngine SHALL 阻止该公式的写入并保留单元格原有内容
4. WHEN 循环引用被检测到，THE SpreadsheetModel SHALL 通过错误回调通知用户界面显示循环引用警告信息
5. THE FormulaEngine SHALL 在公式求值前通过依赖图的深度优先遍历完成循环检测，检测时间复杂度与依赖链长度成线性关系
6. WHEN 用户修改单元格内容导致已有的循环引用链断开，THE FormulaEngine SHALL 正常接受新公式并重新计算受影响的单元格
