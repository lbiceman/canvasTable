# 需求文档：全操作协同支持（setBorder / setFontFamily / setStrikethrough）

## 简介

ice-excel 已有基础的协同编辑功能，前端（TypeScript）定义了 31 种协同操作类型，Java 服务端已支持其中 28 种单元格/行列操作和 4 种图表/迷你图操作（共 32 种）。经全面对比分析，前端已定义但 Java 服务端尚未支持的操作类型有 3 种：

| 操作类型 | 前端类型名 | 说明 |
|---------|-----------|------|
| setBorder | SetBorderOp | 设置单元格边框（上下左右四边的线型、颜色、宽度） |
| setFontFamily | SetFontFamilyOp | 设置单元格字体族名称 |
| setStrikethrough | SetStrikethroughOp | 设置单元格删除线开关 |

同时，前端 OT 转换器（`src/collaboration/ot.ts`）也未对这 3 种操作实现转换逻辑。本需求旨在补齐前端和后端对这 3 种操作的完整协同支持。

### 差异分析详情

**前端已有且后端已支持的操作（28 种）：**
cellEdit、cellMerge、cellSplit、rowInsert、rowDelete、rowResize、colInsert、colDelete、colResize、fontColor、bgColor、fontSize、fontBold、fontItalic、fontUnderline、fontAlign、verticalAlign、setFormat、setWrapText、setRichText、setValidation、sheetAdd、sheetDelete、sheetRename、sheetReorder、sheetDuplicate、sheetVisibility、sheetTabColor

**后端独有的操作（4 种，前端未纳入协同类型联合）：**
chartCreate、chartUpdate、chartDelete、setSparkline

**前端已定义但前后端均未完整支持的操作（3 种，本需求目标）：**
setBorder、setFontFamily、setStrikethrough

## 术语表

- **协同服务器（CollaborationServer）**：基于 Spring Boot 的 Java WebSocket 服务端，负责接收、转换和广播协同操作
- **操作（Operation）**：用户对电子表格执行的原子编辑动作，继承自 `CollabOperation` 抽象基类
- **OT 转换器（OTTransformer）**：操作转换服务，处理并发操作之间的冲突转换（前端为 `src/collaboration/ot.ts`，后端为 `OTTransformer.java`）
- **文档应用器（DocumentApplier）**：将操作应用到文档数据模型的服务
- **前端 OT 转换器（FrontendOTTransformer）**：前端 TypeScript 实现的 OT 转换模块（`src/collaboration/ot.ts` 中的 `transformSingle` 函数）
- **SetBorderOp**：设置单元格边框的操作类型，包含行列坐标和边框配置（上下左右四边的线型、颜色、宽度）
- **SetFontFamilyOp**：设置单元格字体族的操作类型，包含行列坐标和字体族名称
- **SetStrikethroughOp**：设置单元格删除线的操作类型，包含行列坐标和删除线开关状态
- **CellBorder**：边框配置数据结构，包含 top、bottom、left、right 四个方向的 BorderSide
- **BorderSide**：单边边框配置，包含 style（线型）、color（颜色）、width（宽度）
- **单元格样式操作（CellStyleOp）**：泛指作用于单个单元格 (row, col) 的样式类操作，包括 fontColor、bgColor、fontSize、fontBold、fontItalic、fontUnderline、fontAlign、verticalAlign、setBorder、setFontFamily、setStrikethrough 等

## 需求

### 需求 1：Java 服务端新增操作类型的数据模型定义

**用户故事：** 作为开发者，我希望 Java 服务端能正确反序列化前端发送的 setBorder、setFontFamily、setStrikethrough 操作，以便服务端能处理这些操作。

#### 验收标准

1. THE 协同服务器 SHALL 定义 `SetBorderOp` 操作类，包含 row（int）、col（int）、border（CellBorder 对象，可为 null）字段，并继承 `CollabOperation` 基类
2. THE 协同服务器 SHALL 定义 `SetFontFamilyOp` 操作类，包含 row（int）、col（int）、fontFamily（String）字段，并继承 `CollabOperation` 基类
3. THE 协同服务器 SHALL 定义 `SetStrikethroughOp` 操作类，包含 row（int）、col（int）、strikethrough（boolean）字段，并继承 `CollabOperation` 基类
4. THE 协同服务器 SHALL 定义 `CellBorder` 数据类，包含 top、bottom、left、right 四个可选的 `BorderSide` 字段
5. THE 协同服务器 SHALL 定义 `BorderSide` 数据类，包含 style（String）、color（String）、width（int）字段
6. THE 协同服务器 SHALL 在 `CollabOperation` 基类的 `@JsonSubTypes` 注解中注册 setBorder、setFontFamily、setStrikethrough 三种新操作类型
7. WHEN 前端发送包含 setBorder、setFontFamily 或 setStrikethrough 类型的操作 JSON 消息, THE 协同服务器 SHALL 正确反序列化为对应的 Java 操作对象

### 需求 2：Java 服务端 Cell 数据模型扩展

**用户故事：** 作为开发者，我希望 Java 服务端的 Cell 数据模型包含边框、字体族和删除线字段，以便文档状态能完整存储这些属性。

#### 验收标准

1. THE 协同服务器 SHALL 在 `Cell` 类中新增 `border`（CellBorder 类型，可为 null）字段
2. THE 协同服务器 SHALL 在 `Cell` 类中新增 `fontFamily`（String 类型，可为 null）字段
3. THE 协同服务器 SHALL 在 `Cell` 类中新增 `fontStrikethrough`（Boolean 类型，可为 null）字段
4. THE 协同服务器 SHALL 在 `Cell` 的 `equals()` 和 `hashCode()` 方法中包含新增的三个字段

### 需求 3：Java 服务端文档应用器扩展

**用户故事：** 作为开发者，我希望 DocumentApplier 能将新操作类型正确应用到文档数据模型，以便文档状态保持一致。

#### 验收标准

1. WHEN 收到 SetBorderOp 操作, THE 文档应用器 SHALL 将指定单元格的 border 字段设置为操作中的 border 值
2. WHEN 收到 SetFontFamilyOp 操作, THE 文档应用器 SHALL 将指定单元格的 fontFamily 字段设置为操作中的 fontFamily 值
3. WHEN 收到 SetStrikethroughOp 操作, THE 文档应用器 SHALL 将指定单元格的 fontStrikethrough 字段设置为操作中的 strikethrough 值
4. IF 操作指定的行列坐标超出当前文档范围, THEN THE 文档应用器 SHALL 自动扩展文档的行列以容纳该操作

### 需求 4：Java 服务端 OT 转换器扩展

**用户故事：** 作为用户，我希望边框、字体族和删除线操作在 Java 服务端多人协同时能正确处理并发冲突，以便所有客户端最终收敛到相同状态。

#### 验收标准

1. WHEN SetBorderOp 与 RowInsertOp 并发, THE OT 转换器 SHALL 调整 SetBorderOp 的行索引（行索引 >= 插入行时加上插入数量）
2. WHEN SetBorderOp 与 RowDeleteOp 并发且边框操作的行在删除范围内, THE OT 转换器 SHALL 将 SetBorderOp 转换为空操作（返回 null）
3. WHEN SetBorderOp 与 RowDeleteOp 并发且边框操作的行在删除范围之后, THE OT 转换器 SHALL 调整 SetBorderOp 的行索引（减去删除数量）
4. WHEN SetBorderOp 与 ColInsertOp 并发, THE OT 转换器 SHALL 调整 SetBorderOp 的列索引（列索引 >= 插入列时加上插入数量）
5. WHEN SetBorderOp 与 ColDeleteOp 并发且边框操作的列在删除范围内, THE OT 转换器 SHALL 将 SetBorderOp 转换为空操作（返回 null）
6. WHEN SetBorderOp 与 ColDeleteOp 并发且边框操作的列在删除范围之后, THE OT 转换器 SHALL 调整 SetBorderOp 的列索引（减去删除数量）
7. WHEN SetBorderOp 与 CellMergeOp 并发且边框操作的单元格在合并范围内, THE OT 转换器 SHALL 将 SetBorderOp 的行列坐标重定向到合并区域的主单元格
8. WHEN SetBorderOp 与 CellSplitOp 并发且边框操作的单元格在拆分范围内, THE OT 转换器 SHALL 将 SetBorderOp 的行列坐标重定向到拆分操作的目标单元格
9. WHEN 两个 SetBorderOp 操作同一单元格并发, THE OT 转换器 SHALL 以服务端先到达的操作优先（后到达的操作被消除）
10. THE OT 转换器 SHALL 对 SetFontFamilyOp 和 SetStrikethroughOp 应用与 SetBorderOp 相同的行列索引调整规则（RowInsert、RowDelete、ColInsert、ColDelete、CellMerge、CellSplit）
11. WHEN 两个 SetFontFamilyOp 操作同一单元格并发, THE OT 转换器 SHALL 以服务端先到达的操作优先
12. WHEN 两个 SetStrikethroughOp 操作同一单元格并发, THE OT 转换器 SHALL 以服务端先到达的操作优先

### 需求 5：前端 OT 转换器扩展

**用户故事：** 作为用户，我希望前端 OT 转换器也能正确处理 setBorder、setFontFamily、setStrikethrough 操作的并发冲突，以便本地乐观更新与服务端状态保持一致。

#### 验收标准

1. WHEN SetBorderOp 与 RowInsertOp 并发, THE 前端 OT 转换器 SHALL 调整 SetBorderOp 的行索引（行索引 >= 插入行时加上插入数量）
2. WHEN SetBorderOp 与 RowDeleteOp 并发且边框操作的行在删除范围内, THE 前端 OT 转换器 SHALL 将 SetBorderOp 转换为空操作（返回 null）
3. WHEN SetBorderOp 与 RowDeleteOp 并发且边框操作的行在删除范围之后, THE 前端 OT 转换器 SHALL 调整 SetBorderOp 的行索引（减去删除数量）
4. WHEN SetBorderOp 与 ColInsertOp 并发, THE 前端 OT 转换器 SHALL 调整 SetBorderOp 的列索引（列索引 >= 插入列时加上插入数量）
5. WHEN SetBorderOp 与 ColDeleteOp 并发且边框操作的列在删除范围内, THE 前端 OT 转换器 SHALL 将 SetBorderOp 转换为空操作（返回 null）
6. WHEN SetBorderOp 与 ColDeleteOp 并发且边框操作的列在删除范围之后, THE 前端 OT 转换器 SHALL 调整 SetBorderOp 的列索引（减去删除数量）
7. WHEN SetBorderOp 与 CellMergeOp 并发且边框操作的单元格在合并范围内, THE 前端 OT 转换器 SHALL 将 SetBorderOp 的行列坐标重定向到合并区域的主单元格
8. WHEN SetBorderOp 与 CellSplitOp 并发且边框操作的单元格在拆分范围内, THE 前端 OT 转换器 SHALL 将 SetBorderOp 的行列坐标重定向到拆分操作的目标单元格
9. WHEN 两个 SetBorderOp 操作同一单元格并发, THE 前端 OT 转换器 SHALL 以服务端先到达的操作优先（后到达的操作被消除）
10. THE 前端 OT 转换器 SHALL 对 SetFontFamilyOp 和 SetStrikethroughOp 应用与 SetBorderOp 相同的行列索引调整规则（RowInsert、RowDelete、ColInsert、ColDelete、CellMerge、CellSplit）
11. WHEN 两个 SetFontFamilyOp 操作同一单元格并发, THE 前端 OT 转换器 SHALL 以服务端先到达的操作优先
12. WHEN 两个 SetStrikethroughOp 操作同一单元格并发, THE 前端 OT 转换器 SHALL 以服务端先到达的操作优先
13. THE 前端 OT 转换器 SHALL 在 `transformSingle` 函数的 RowInsert、RowDelete、ColInsert、ColDelete、CellMerge、CellSplit 分支中为 setBorder、setFontFamily、setStrikethrough 添加 case 处理

### 需求 6：前端操作反转（Undo）支持

**用户故事：** 作为用户，我希望在协同模式下对边框、字体族和删除线操作执行撤销时，能正确生成反向操作。

#### 验收标准

1. WHEN 用户撤销 SetBorderOp 操作, THE 前端 OT 转换器 SHALL 生成一个反向 SetBorderOp，其 border 值为操作前的原始边框值
2. WHEN 用户撤销 SetFontFamilyOp 操作, THE 前端 OT 转换器 SHALL 生成一个反向 SetFontFamilyOp，其 fontFamily 值为操作前的原始字体族值
3. WHEN 用户撤销 SetStrikethroughOp 操作, THE 前端 OT 转换器 SHALL 生成一个反向 SetStrikethroughOp，其 strikethrough 值为操作前的原始删除线状态
4. THE 前端 `invertOperation` 函数 SHALL 在其 switch 语句中为 setBorder、setFontFamily、setStrikethrough 添加反转逻辑
5. THE 前端 `ModelReader` 接口 SHALL 扩展以支持读取单元格的 border、fontFamily、fontStrikethrough 属性

### 需求 7：操作序列化往返一致性

**用户故事：** 作为开发者，我希望新操作类型的 JSON 序列化和反序列化保持往返一致性，以便操作在网络传输中不丢失信息。

#### 验收标准

1. FOR ALL 有效的 SetBorderOp 对象, 序列化为 JSON 后再反序列化 SHALL 产生与原始操作等价的对象
2. FOR ALL 有效的 SetFontFamilyOp 对象, 序列化为 JSON 后再反序列化 SHALL 产生与原始操作等价的对象
3. FOR ALL 有效的 SetStrikethroughOp 对象, 序列化为 JSON 后再反序列化 SHALL 产生与原始操作等价的对象
4. WHEN SetBorderOp 的 border 字段为 null, THE 协同服务器 SHALL 正确序列化和反序列化该空值
5. WHEN SetBorderOp 的 border 中某些方向（如 top、left）为 null 而其他方向有值, THE 协同服务器 SHALL 正确序列化和反序列化该部分边框配置

### 需求 8：端到端协同广播

**用户故事：** 作为用户，我希望在一个客户端设置边框、字体族或删除线后，其他客户端能实时看到变化。

#### 验收标准

1. WHEN 客户端发送 setBorder 操作, THE 协同服务器 SHALL 将该操作应用到服务端文档状态并广播给同一房间内的所有其他客户端
2. WHEN 客户端发送 setFontFamily 操作, THE 协同服务器 SHALL 将该操作应用到服务端文档状态并广播给同一房间内的所有其他客户端
3. WHEN 客户端发送 setStrikethrough 操作, THE 协同服务器 SHALL 将该操作应用到服务端文档状态并广播给同一房间内的所有其他客户端
4. WHEN 新客户端加入房间, THE 协同服务器 SHALL 发送包含边框、字体族和删除线属性的完整文档状态

### 需求 9：前后端操作类型一致性保障

**用户故事：** 作为开发者，我希望前端和后端的操作类型定义保持一致，以便避免因类型不匹配导致的协同故障。

#### 验收标准

1. THE 协同服务器 SHALL 支持前端 `OperationType` 联合类型中定义的所有 31 种操作类型的反序列化
2. THE 协同服务器 SHALL 对所有 31 种操作类型在 `CollabOperation` 的 `@JsonSubTypes` 注解中进行注册
3. IF 协同服务器收到未注册的操作类型, THEN THE 协同服务器 SHALL 记录警告日志并忽略该操作，不中断其他操作的处理
4. THE 前端 OT 转换器 SHALL 对所有 31 种操作类型在 `transformSingle` 函数中提供处理逻辑（至少返回 cloneOp 作为默认行为）
