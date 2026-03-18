# 列插入/删除 OT 支持需求文档

## 介绍

本文档定义了为 Canvas Excel 协作编辑系统添加列插入/删除操作的 OT（Operational Transformation）支持的需求。当前系统仅支持行插入/删除的 OT 转换，缺少列操作的支持。本功能将实现完整的列操作 OT 转换矩阵，包括与所有现有操作类型的交叉转换，以及与合并单元格的正确交互。

## 词汇表

- **ColInsertOp**: 列插入操作，在指定列索引处插入一个或多个列
- **ColDeleteOp**: 列删除操作，删除指定列索引范围内的一个或多个列
- **OT（Operational Transformation）**: 操作转换，用于解决并发编辑冲突的算法
- **transformSingle**: 两个操作之间的转换函数，返回调整后的操作
- **Transform Matrix**: 转换矩阵，定义所有操作类型对之间的转换规则
- **Merge Cell**: 合并单元格，跨越多行多列的单元格
- **Cell Span**: 单元格跨度，包括 rowSpan（行跨度）和 colSpan（列跨度）
- **Invert Operation**: 反向操作，用于撤销操作的逆操作
- **Model**: 数据模型层，负责单元格数据和结构操作
- **OT Engine**: OT 引擎，负责操作转换和冲突解决

## 需求

### 需求 1: 列插入操作类型定义

**用户故事**: 作为开发者，我需要定义列插入操作类型，以便在协作编辑中支持列插入功能。

#### 验收标准

1. WHEN 定义 ColInsertOp 类型时，THE 操作类型 SHALL 包含以下字段：
   - type: 'colInsert'（操作类型标识）
   - colIndex: number（插入位置的列索引，必须为非负整数，从 0 开始）
   - count: number（插入的列数，必须为正整数 > 0）
   - userId: string（执行操作的用户 ID）
   - timestamp: number（操作时间戳）
   - revision: number（文档版本号）

2. THE ColInsertOp 类型 SHALL 继承 BaseOperation 接口

3. WHEN 序列化 ColInsertOp 时，THE 操作 SHALL 能被正确序列化为 JSON 字符串

4. WHEN 反序列化 ColInsertOp 时，THE 操作 SHALL 通过字段校验（colIndex 必须为非负整数，count 必须为正整数）

### 需求 2: 列删除操作类型定义

**用户故事**: 作为开发者，我需要定义列删除操作类型，以便在协作编辑中支持列删除功能。

#### 验收标准

1. WHEN 定义 ColDeleteOp 类型时，THE 操作类型 SHALL 包含以下字段：
   - type: 'colDelete'（操作类型标识）
   - colIndex: number（删除起始列索引，必须为非负整数，从 0 开始）
   - count: number（删除的列数，必须为正整数 > 0）
   - userId: string（执行操作的用户 ID）
   - timestamp: number（操作时间戳）
   - revision: number（文档版本号）

2. THE ColDeleteOp 类型 SHALL 继承 BaseOperation 接口

3. WHEN 序列化 ColDeleteOp 时，THE 操作 SHALL 能被正确序列化为 JSON 字符串

4. WHEN 反序列化 ColDeleteOp 时，THE 操作 SHALL 通过字段校验（colIndex 必须为非负整数，count 必须为正整数）

### 需求 3: 操作类型集合更新

**用户故事**: 作为开发者，我需要在操作类型集合中注册新的列操作类型。

#### 验收标准

1. WHEN 检查 VALID_OPERATION_TYPES 集合时，THE 集合 SHALL 包含 'colInsert' 和 'colDelete'

2. WHEN 序列化/反序列化操作时，THE 系统 SHALL 能正确识别 ColInsertOp 和 ColDeleteOp

3. WHEN 验证操作类型时，THE 系统 SHALL 接受 'colInsert' 和 'colDelete' 作为有效的操作类型

### 需求 4: 操作序列化和反序列化

**用户故事**: 作为开发者，我需要列操作能正确序列化和反序列化，以便通过网络传输。

#### 验收标准

1. WHEN 序列化 ColInsertOp 时，THE 操作 SHALL 被转换为 JSON 字符串，包含所有必要字段

2. WHEN 反序列化 JSON 字符串时，THE 操作 SHALL 被正确恢复为 ColInsertOp 对象

3. WHEN 序列化 ColDeleteOp 时，THE 操作 SHALL 被转换为 JSON 字符串，包含所有必要字段

4. WHEN 反序列化 JSON 字符串时，THE 操作 SHALL 被正确恢复为 ColDeleteOp 对象

5. THE 反序列化过程 SHALL 验证所有必要字段的存在和类型正确性

### 需求 5: 列插入与单元格编辑的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列插入操作与单元格编辑操作能正确转换，以保证编辑内容不丢失。

#### 验收标准

1. WHEN 单元格编辑操作 opA 与列插入操作 opB 并发时，THE transformSingle(opA, opB) SHALL 调整 opA 的列索引：
   - IF opA.col >= opB.colIndex，THEN opA.col SHALL 增加 opB.count
   - IF opA.col < opB.colIndex，THEN opA.col SHALL 保持不变

2. THE 调整后的操作 SHALL 保留原有的行索引、内容和其他属性

### 需求 6: 列插入与合并单元格的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列插入操作与合并单元格操作能正确转换，以保证合并区域的完整性。

#### 验收标准

1. WHEN 合并单元格操作 opA 与列插入操作 opB 并发时，THE transformSingle(opA, opB) SHALL 调整 opA 的列范围：
   - IF opA.startCol >= opB.colIndex，THEN opA.startCol SHALL 增加 opB.count AND opA.endCol SHALL 增加 opB.count
   - IF opA.endCol < opB.colIndex，THEN opA.startCol 和 opA.endCol SHALL 保持不变
   - IF opA.startCol < opB.colIndex AND opA.endCol >= opB.colIndex，THEN opA.startCol SHALL 保持不变 AND opA.endCol SHALL 增加 opB.count（合并区域被穿过）

2. THE 调整后的操作 SHALL 保留原有的行范围和其他属性

3. THE 合并区域的有效性 SHALL 得到保证（startCol <= endCol）

### 需求 7: 列插入与拆分单元格的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列插入操作与拆分单元格操作能正确转换，以保证拆分单元格的正确位置。

#### 验收标准

1. WHEN 拆分单元格操作 opA 与列插入操作 opB 并发时，THE transformSingle(opA, opB) SHALL 调整 opA 的列索引：
   - IF opA.col >= opB.colIndex，THEN opA.col SHALL 增加 opB.count
   - IF opA.col < opB.colIndex，THEN opA.col SHALL 保持不变

2. THE rowSpan 和 colSpan 属性 SHALL 保持不变（这些是历史快照，记录拆分前合并单元格的原始范围，不应被列插入修改）

3. THE 调整后的操作 SHALL 保留原有的行索引和其他属性

### 需求 8: 列插入与列宽调整的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列插入操作与列宽调整操作能正确转换，以保证列宽设置的正确应用。

#### 验收标准

1. WHEN 列宽调整操作 opA 与列插入操作 opB 并发时，THE transformSingle(opA, opB) SHALL 调整 opA 的列索引：
   - IF opA.colIndex >= opB.colIndex，THEN opA.colIndex SHALL 增加 opB.count
   - IF opA.colIndex < opB.colIndex，THEN opA.colIndex SHALL 保持不变

2. THE 调整后的操作 SHALL 保留原有的宽度值

3. THE transformSingle 中 colResize 的短路判断 SHALL 被修改，使其不再跳过 colInsert/colDelete 的转换（即当 opB 是 colInsert 或 colDelete 时，colResize 的 colIndex 需要被调整）

### 需求 9: 列插入与样式操作的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列插入操作与所有样式操作（字体颜色、背景颜色、字体大小、加粗、斜体、下划线、对齐）能正确转换。

#### 验收标准

1. WHEN 样式操作 opA（fontColor、bgColor、fontSize、fontBold、fontItalic、fontUnderline、fontAlign、verticalAlign）与列插入操作 opB 并发时，THE transformSingle(opA, opB) SHALL 调整 opA 的列索引：
   - IF opA.col >= opB.colIndex，THEN opA.col SHALL 增加 opB.count
   - IF opA.col < opB.colIndex，THEN opA.col SHALL 保持不变

2. THE 调整后的操作 SHALL 保留原有的行索引、样式值和其他属性

### 需求 10: 列插入与列插入的 OT 转换

**用户故事**: 作为协作编辑用户，我需要两个并发的列插入操作能正确转换，以保证最终的列数正确。

#### 验收标准

1. WHEN 列插入操作 opA 与列插入操作 opB 并发时，THE transformSingle(opA, opB) SHALL 调整 opA 的列索引：
   - IF opA.colIndex > opB.colIndex，THEN opA.colIndex SHALL 增加 opB.count
   - IF opA.colIndex <= opB.colIndex，THEN opA.colIndex SHALL 保持不变

2. THE 调整后的操作 SHALL 保留原有的插入列数

3. THE 最终结果 SHALL 是两个插入操作都被应用，总列数增加 opA.count + opB.count

### 需求 11: 列插入与列删除的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列插入操作与列删除操作能正确转换，以保证最终的列结构正确。

#### 验收标准

1. WHEN 列删除操作 opA 与列插入操作 opB 并发时，THE transformSingle(opA, opB) SHALL 调整 opA 的列索引：
   - IF opA.colIndex > opB.colIndex，THEN opA.colIndex SHALL 增加 opB.count
   - IF opA.colIndex <= opB.colIndex，THEN opA.colIndex SHALL 保持不变

2. THE 调整后的操作 SHALL 保留原有的删除列数

### 需求 12: 列删除与单元格编辑的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列删除操作与单元格编辑操作能正确转换，以处理被删除列中的编辑。

#### 验收标准

1. WHEN 单元格编辑操作 opA 与列删除操作 opB 并发时，THE transformSingle(opA, opB) SHALL：
   - IF opA.col 在删除范围内（opA.col >= opB.colIndex AND opA.col < opB.colIndex + opB.count），THEN 返回 null（操作被删除）
   - IF opA.col >= opB.colIndex + opB.count，THEN opA.col SHALL 减少 opB.count
   - IF opA.col < opB.colIndex，THEN opA.col SHALL 保持不变

2. THE 调整后的操作 SHALL 保留原有的行索引、内容和其他属性

### 需求 13: 列删除与合并单元格的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列删除操作与合并单元格操作能正确转换，以处理被删除列中的合并单元格。

#### 验收标准

1. WHEN 合并单元格操作 opA 与列删除操作 opB 并发时，THE transformSingle(opA, opB) SHALL：
   - IF 合并区域完全在删除范围内（opA.startCol >= opB.colIndex AND opA.endCol < opB.colIndex + opB.count），THEN 返回 null（合并操作被删除）
   - IF 合并区域与删除范围左侧部分重叠（opA.startCol < opB.colIndex AND opA.endCol >= opB.colIndex AND opA.endCol < opB.colIndex + opB.count），THEN 返回 null（合并区域被部分删除，无法保持有效）
   - IF 合并区域与删除范围右侧部分重叠（opA.startCol >= opB.colIndex AND opA.startCol < opB.colIndex + opB.count AND opA.endCol >= opB.colIndex + opB.count），THEN 返回 null（合并区域被部分删除，无法保持有效）
   - IF 删除范围完全在合并区域内部（opA.startCol < opB.colIndex AND opB.colIndex + opB.count <= opA.endCol），THEN opA.endCol SHALL 减少 opB.count（合并区域收缩）
   - IF opA.startCol >= opB.colIndex + opB.count，THEN opA.startCol 和 opA.endCol SHALL 各减少 opB.count
   - IF opA.endCol < opB.colIndex，THEN opA.startCol 和 opA.endCol SHALL 保持不变

2. THE 调整后的操作 SHALL 保留原有的行范围和其他属性

### 需求 14: 列删除与拆分单元格的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列删除操作与拆分单元格操作能正确转换，以处理被删除列中的拆分单元格。

#### 验收标准

1. WHEN 拆分单元格操作 opA 与列删除操作 opB 并发时，THE transformSingle(opA, opB) SHALL：
   - IF opA.col 在删除范围内（opA.col >= opB.colIndex AND opA.col < opB.colIndex + opB.count），THEN 返回 null（拆分操作被删除）
   - IF opA.col >= opB.colIndex + opB.count，THEN opA.col SHALL 减少 opB.count
   - IF opA.col < opB.colIndex，THEN opA.col SHALL 保持不变

2. THE rowSpan 和 colSpan 属性 SHALL 保持不变（这些是历史快照，不应被列删除修改）

3. THE 调整后的操作 SHALL 保留原有的行索引和其他属性

### 需求 15: 列删除与列宽调整的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列删除操作与列宽调整操作能正确转换，以处理被删除列的宽度设置。

#### 验收标准

1. WHEN 列宽调整操作 opA 与列删除操作 opB 并发时，THE transformSingle(opA, opB) SHALL：
   - IF opA.colIndex 在删除范围内（opA.colIndex >= opB.colIndex AND opA.colIndex < opB.colIndex + opB.count），THEN 返回 null（列宽调整被删除）
   - IF opA.colIndex >= opB.colIndex + opB.count，THEN opA.colIndex SHALL 减少 opB.count
   - IF opA.colIndex < opB.colIndex，THEN opA.colIndex SHALL 保持不变

2. THE 调整后的操作 SHALL 保留原有的宽度值

### 需求 16: 列删除与样式操作的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列删除操作与所有样式操作能正确转换，以处理被删除列中的样式设置。

#### 验收标准

1. WHEN 样式操作 opA 与列删除操作 opB 并发时，THE transformSingle(opA, opB) SHALL：
   - IF opA.col 在删除范围内（opA.col >= opB.colIndex AND opA.col < opB.colIndex + opB.count），THEN 返回 null（样式操作被删除）
   - IF opA.col >= opB.colIndex + opB.count，THEN opA.col SHALL 减少 opB.count
   - IF opA.col < opB.colIndex，THEN opA.col SHALL 保持不变

2. THE 调整后的操作 SHALL 保留原有的行索引、样式值和其他属性

### 需求 17: 列删除与列删除的 OT 转换

**用户故事**: 作为协作编辑用户，我需要两个并发的列删除操作能正确转换，以保证最终的列结构正确。

#### 验收标准

1. WHEN 列删除操作 opA 与列删除操作 opB 并发时，THE transformSingle(opA, opB) SHALL（设 origA = opA 的原始值）：
   - IF opA.colIndex >= opB.colIndex + opB.count，THEN opA.colIndex SHALL 减少 opB.count（opA 完全在 opB 之后）
   - IF opA.colIndex + opA.count <= opB.colIndex，THEN opA.colIndex 和 opA.count SHALL 保持不变（opA 完全在 opB 之前）
   - IF opA.colIndex < opB.colIndex AND opA.colIndex + opA.count > opB.colIndex AND opA.colIndex + opA.count <= opB.colIndex + opB.count，THEN opA.count = opB.colIndex - opA.colIndex（opA 与 opB 前部分重叠，仅保留 opA 在 opB 之前的部分）
   - IF opA.colIndex >= opB.colIndex AND opA.colIndex < opB.colIndex + opB.count AND opA.colIndex + opA.count > opB.colIndex + opB.count，THEN newCount = origA.colIndex + origA.count - (opB.colIndex + opB.count)，opA.colIndex = opB.colIndex，opA.count = newCount（opA 与 opB 后部分重叠，先用原始值计算剩余数量，再调整索引）
   - IF opA.colIndex >= opB.colIndex AND opA.colIndex + opA.count <= opB.colIndex + opB.count，THEN 返回 null（opA 完全在 opB 内部，被完全删除）
   - IF opA.colIndex < opB.colIndex AND opA.colIndex + opA.count > opB.colIndex + opB.count，THEN opA.count = opA.count - opB.count（opA 完全包含 opB，删除数量减少）

2. THE 调整后的操作 SHALL 保留原有的删除列数（在有效范围内）

### 需求 18: 列删除与列插入的 OT 转换

**用户故事**: 作为协作编辑用户，我需要列删除操作与列插入操作能正确转换，以保证最终的列结构正确。

#### 验收标准

1. WHEN 列插入操作 opA 与列删除操作 opB 并发时，THE transformSingle(opA, opB) SHALL：
   - IF opA.colIndex > opB.colIndex + opB.count，THEN opA.colIndex SHALL 减少 opB.count
   - IF opA.colIndex <= opB.colIndex，THEN opA.colIndex SHALL 保持不变
   - IF opA.colIndex 在删除范围内（opA.colIndex > opB.colIndex AND opA.colIndex <= opB.colIndex + opB.count），THEN opA.colIndex = opB.colIndex（插入位置调整为删除范围的起始位置）

2. THE 调整后的操作 SHALL 保留原有的插入列数

### 需求 19: 行列操作的交叉转换

**用户故事**: 作为协作编辑用户，我需要行操作与列操作能正确转换，以保证行列操作的独立性。

#### 验收标准

1. WHEN 行操作与列操作并发时，THE transformSingle 函数 SHALL 返回原操作的克隆（不做任何调整），因为行和列是独立的维度

2. 具体的转换组合包括：
   - RowInsertOp vs ColInsertOp：返回 RowInsertOp 克隆
   - RowInsertOp vs ColDeleteOp：返回 RowInsertOp 克隆
   - RowDeleteOp vs ColInsertOp：返回 RowDeleteOp 克隆
   - RowDeleteOp vs ColDeleteOp：返回 RowDeleteOp 克隆
   - RowResizeOp vs ColInsertOp：返回 RowResizeOp 克隆
   - RowResizeOp vs ColDeleteOp：返回 RowResizeOp 克隆
   - ColInsertOp vs RowInsertOp：返回 ColInsertOp 克隆
   - ColInsertOp vs RowDeleteOp：返回 ColInsertOp 克隆
   - ColInsertOp vs RowResizeOp：返回 ColInsertOp 克隆
   - ColDeleteOp vs RowInsertOp：返回 ColDeleteOp 克隆
   - ColDeleteOp vs RowDeleteOp：返回 ColDeleteOp 克隆
   - ColDeleteOp vs RowResizeOp：返回 ColDeleteOp 克隆

3. THE 行操作 SHALL 不影响列操作的列索引

4. THE 列操作 SHALL 不影响行操作的行索引

### 需求 20: 列操作与单元格编辑的反向转换（opB 为 CellEdit）

**用户故事**: 作为开发者，我需要定义当 opB 是单元格编辑操作时，列操作如何转换。

#### 验收标准

1. WHEN 列插入操作 opA 与单元格编辑操作 opB 并发时，THE transformSingle(opA, opB) SHALL 返回 opA 的克隆（列操作不受单元格编辑影响）

2. WHEN 列删除操作 opA 与单元格编辑操作 opB 并发时，THE transformSingle(opA, opB) SHALL 返回 opA 的克隆（列操作不受单元格编辑影响）

### 需求 21: 列操作与合并单元格的反向转换（opB 为 CellMerge）

**用户故事**: 作为开发者，我需要定义当 opB 是合并单元格操作时，列操作如何转换。

#### 验收标准

1. WHEN 列插入操作 opA 与合并单元格操作 opB 并发时，THE transformSingle(opA, opB) SHALL 返回 opA 的克隆（列操作不受合并操作影响）

2. WHEN 列删除操作 opA 与合并单元格操作 opB 并发时，THE transformSingle(opA, opB) SHALL 返回 opA 的克隆（列操作不受合并操作影响）

### 需求 22: 列操作与拆分单元格的反向转换（opB 为 CellSplit）

**用户故事**: 作为开发者，我需要定义当 opB 是拆分单元格操作时，列操作如何转换。

#### 验收标准

1. WHEN 列插入操作 opA 与拆分单元格操作 opB 并发时，THE transformSingle(opA, opB) SHALL 返回 opA 的克隆（列操作不受拆分操作影响）

2. WHEN 列删除操作 opA 与拆分单元格操作 opB 并发时，THE transformSingle(opA, opB) SHALL 返回 opA 的克隆（列操作不受拆分操作影响）

### 需求 23: 列操作与样式操作的反向转换（opB 为样式操作）

**用户故事**: 作为开发者，我需要定义当 opB 是样式操作时，列操作如何转换。

#### 验收标准

1. WHEN 列插入/删除操作 opA 与样式操作 opB（fontColor、bgColor、fontSize、fontBold、fontItalic、fontUnderline、fontAlign、verticalAlign）并发时，THE transformSingle(opA, opB) SHALL 返回 opA 的克隆（列操作不受样式操作影响）

### 需求 24: 操作反向（Invert Operation）支持

**用户故事**: 作为开发者，我需要列插入/删除操作支持反向操作，以便实现撤销功能。

#### 验收标准

1. WHEN 调用 invertOperation(colInsertOp) 时，THE 函数 SHALL 返回一个 ColDeleteOp：
   - colIndex 保持相同
   - count 保持相同
   - 其他字段（userId、timestamp、revision）保持相同

2. WHEN 调用 invertOperation(colDeleteOp) 时，THE 函数 SHALL 返回一个 ColInsertOp：
   - colIndex 保持相同
   - count 保持相同
   - 其他字段（userId、timestamp、revision）保持相同

3. THE 反向操作 SHALL 满足：invertOperation(invertOperation(op)) 等价于原操作

### 需求 25: 模型层列操作实现

**用户故事**: 作为开发者，我需要在 SpreadsheetModel 中实现列插入/删除的基础操作，以支持 OT 转换的应用。

#### 验收标准

1. WHEN 调用 model.insertColumns(colIndex, count) 时，THE 方法 SHALL：
   - 在指定列索引处插入指定数量的空列
   - 调整所有受影响的单元格的列索引
   - 调整所有受影响的合并单元格的列范围
   - 调整所有受影响的拆分单元格的列索引和 colSpan
   - 返回 true 表示成功，false 表示失败（参数无效）

2. WHEN 调用 model.deleteColumns(colIndex, count) 时，THE 方法 SHALL：
   - 删除指定列索引范围内的列
   - 删除被删除列中的所有单元格数据
   - 调整所有受影响的单元格的列索引
   - 处理与删除范围重叠的合并单元格（标记为失效或删除）
   - 处理与删除范围重叠的拆分单元格（标记为失效或删除）
   - 返回 true 表示成功，false 表示失败（参数无效）

3. THE 列操作 SHALL 清除相关的缓存（如行高、列宽缓存）

### 需求 26: 前端 OT 转换完整性

**用户故事**: 作为开发者，我需要在前端 OT 引擎中实现所有列操作的转换规则，以支持完整的协作编辑。

#### 验收标准

1. THE transformSingle 函数 SHALL 支持以下转换组合（共 30 个新的转换）：
   - 13 个操作类型 × 2 个列操作 = 26 个转换
   - 2 个列操作 × 2 个列操作 = 4 个转换
   - 总计 30 个新的转换规则

2. WHEN 应用 ColInsertOp 时，THE 所有受影响的操作 SHALL 被正确转换

3. WHEN 应用 ColDeleteOp 时，THE 所有受影响的操作 SHALL 被正确转换

4. THE 转换结果 SHALL 满足 OT 的收敛性要求（两个用户最终看到相同的文档状态）

### 需求 27: 后端 OT 转换完整性

**用户故事**: 作为开发者，我需要在后端 OT 引擎中实现所有列操作的转换规则，以保证前后端转换逻辑一致。

#### 验收标准

1. THE Java 后端 OTTransformer 类 SHALL 实现所有 30 个新的转换规则

2. THE 后端转换逻辑 SHALL 与前端 TypeScript 实现完全一致

3. WHEN 前后端同时处理相同的操作序列时，THE 最终的文档状态 SHALL 相同

4. THE 后端 DocumentApplier 类 SHALL 支持应用 ColInsertOp 和 ColDeleteOp

### 需求 28: 后端 DocumentApplier 列操作应用逻辑

**用户故事**: 作为开发者，我需要在后端 DocumentApplier 中实现列插入/删除的具体应用逻辑。

#### 验收标准

1. WHEN 应用 ColInsertOp 时，THE DocumentApplier SHALL：
   - 在 SpreadsheetData 的 cells 数组中每行插入新的空单元格
   - 在 colWidths 数组中插入新的列宽条目（使用默认列宽）
   - 调整所有受影响的合并单元格范围
   - 调整所有受影响的拆分单元格位置和 colSpan
   - 返回修改后的 SpreadsheetData

2. WHEN 应用 ColDeleteOp 时，THE DocumentApplier SHALL：
   - 从 SpreadsheetData 的 cells 数组中每行删除指定列范围的数据
   - 从 colWidths 数组中删除对应的列宽条目
   - 调整所有受影响的单元格列索引
   - 删除或标记为失效与删除范围重叠的合并单元格
   - 删除或标记为失效与删除范围重叠的拆分单元格
   - 返回修改后的 SpreadsheetData

3. THE 应用逻辑 SHALL 与前端 SpreadsheetModel 的实现保持一致

### 需求 29: 列操作与合并单元格的边界情况处理

**用户故事**: 作为协作编辑用户，我需要列操作与合并单元格的各种边界情况能正确处理。

#### 验收标准

1. WHEN 列插入操作穿过合并单元格的边界时，THE 合并单元格 SHALL 被正确扩展

2. WHEN 列删除操作穿过合并单元格的边界时，THE 合并单元格 SHALL 被标记为失效或删除

3. WHEN 列删除操作完全删除合并单元格时，THE 合并单元格 SHALL 被删除

4. WHEN 列删除操作部分删除合并单元格时，THE 合并单元格 SHALL 被标记为失效

5. THE 所有边界情况 SHALL 在前后端保持一致

### 需求 30: 列操作与拆分单元格的边界情况处理

**用户故事**: 作为协作编辑用户，我需要列操作与拆分单元格的各种边界情况能正确处理。

#### 验收标准

1. WHEN 列插入操作穿过拆分单元格的边界时，THE 拆分单元格的 colSpan SHALL 被正确调整

2. WHEN 列删除操作穿过拆分单元格的边界时，THE 拆分单元格 SHALL 被标记为失效或删除

3. WHEN 列删除操作完全删除拆分单元格时，THE 拆分单元格 SHALL 被删除

4. WHEN 列删除操作部分删除拆分单元格时，THE 拆分单元格 SHALL 被标记为失效

5. THE 所有边界情况 SHALL 在前后端保持一致

### 需求 31: 性能要求

**用户故事**: 作为用户，我需要列操作的 OT 转换能快速完成，以保证协作编辑的流畅性。

#### 验收标准

1. WHEN 执行单个 transformSingle 操作时，THE 执行时间 SHALL 在 1ms 以内

2. WHEN 执行 transform 函数处理操作序列时，THE 执行时间 SHALL 与操作数量成线性关系

3. WHEN 处理大规模文档（1M 行 × 16K 列）时，THE 列操作 SHALL 不显著影响性能

4. THE 内存使用 SHALL 不因列操作而显著增加

### 需求 32: 兼容性要求

**用户故事**: 作为开发者，我需要列操作与现有的行操作、单元格操作完全兼容。

#### 验收标准

1. WHEN 混合使用行操作和列操作时，THE 两种操作 SHALL 独立工作，不相互干扰

2. WHEN 混合使用列操作和单元格操作时，THE 两种操作 SHALL 正确转换

3. WHEN 混合使用列操作和合并单元格操作时，THE 两种操作 SHALL 正确转换

4. THE 现有的行操作测试 SHALL 继续通过

5. THE 现有的单元格操作测试 SHALL 继续通过

### 需求 33: 测试覆盖

**用户故事**: 作为开发者，我需要列操作的 OT 转换有完整的测试覆盖，以保证功能的正确性。

#### 验收标准

1. THE 所有 30 个新的转换规则 SHALL 有单元测试覆盖

2. WHEN 运行单元测试时，THE 所有测试 SHALL 通过

3. THE 集成测试 SHALL 覆盖列操作与其他操作的交互

4. THE 属性测试（Property-Based Testing）SHALL 验证 OT 的收敛性和幂等性

5. THE 测试覆盖率 SHALL 达到 95% 以上
