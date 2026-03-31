# 实现计划：全操作协同支持（setBorder / setFontFamily / setStrikethrough）

## 概述

为 ice-excel 补齐 3 种缺失操作类型的前后端完整协同支持。按照依赖关系排序：先后端数据模型，再后端服务层，再前端。所有新增代码严格遵循现有操作（如 `FontBoldOp`）的实现模式。

## 任务

- [x] 1. 后端数据模型层：新增操作类和辅助数据类
  - [x] 1.1 创建 `BorderSide.java` 和 `CellBorder.java` 数据类
    - 在 `javaServer/src/main/java/com/iceexcel/server/model/` 下创建 `BorderSide.java`，包含 style（String）、color（String）、width（int）字段，以及无参构造器、全参构造器、getter/setter、equals/hashCode
    - 创建 `CellBorder.java`，包含 top、bottom、left、right 四个可选的 `BorderSide` 字段，使用 `@JsonInclude(JsonInclude.Include.NON_NULL)` 注解
    - _需求: 1.4, 1.5_

  - [x] 1.2 创建 `SetBorderOp.java` 操作类
    - 在 `javaServer/src/main/java/com/iceexcel/server/model/` 下创建，继承 `CollabOperation`
    - 包含 row（int）、col（int）、border（CellBorder，可为 null）字段
    - 遵循 `FontBoldOp` 的实现模式：无参构造器、全参构造器、getter/setter、equals/hashCode
    - `getType()` 返回 `"setBorder"`
    - _需求: 1.1_

  - [x] 1.3 创建 `SetFontFamilyOp.java` 操作类
    - 包含 row（int）、col（int）、fontFamily（String）字段，继承 `CollabOperation`
    - `getType()` 返回 `"setFontFamily"`
    - _需求: 1.2_

  - [x] 1.4 创建 `SetStrikethroughOp.java` 操作类
    - 包含 row（int）、col（int）、strikethrough（boolean）字段，继承 `CollabOperation`
    - `getType()` 返回 `"setStrikethrough"`
    - _需求: 1.3_

  - [x] 1.5 在 `CollabOperation.java` 的 `@JsonSubTypes` 注解中注册三种新操作类型
    - 添加 `@JsonSubTypes.Type(value = SetBorderOp.class, name = "setBorder")`
    - 添加 `@JsonSubTypes.Type(value = SetFontFamilyOp.class, name = "setFontFamily")`
    - 添加 `@JsonSubTypes.Type(value = SetStrikethroughOp.class, name = "setStrikethrough")`
    - _需求: 1.6, 9.2_

  - [x] 1.6 扩展 `Cell.java`，新增 border、fontFamily、fontStrikethrough 字段
    - 新增 `border`（CellBorder 类型）、`fontFamily`（String 类型）、`fontStrikethrough`（Boolean 类型）字段及 getter/setter
    - 在 `equals()` 和 `hashCode()` 方法中加入这三个新字段
    - _需求: 2.1, 2.2, 2.3, 2.4_


- [x] 2. 后端服务层：DocumentApplier 扩展
  - [x] 2.1 在 `DocumentApplier.java` 中新增三种操作的 apply 方法
    - 新增 `applySetBorder(List<List<Cell>>, SetBorderOp)`：调用 `ensureCellExists` 后设置 `cell.setBorder(op.getBorder())`
    - 新增 `applySetFontFamily(List<List<Cell>>, SetFontFamilyOp)`：设置 `cell.setFontFamily(op.getFontFamily())`
    - 新增 `applySetStrikethrough(List<List<Cell>>, SetStrikethroughOp)`：设置 `cell.setFontStrikethrough(op.isStrikethrough())`
    - 在 `apply(SpreadsheetData, CollabOperation)` 方法的 if-else 链中添加对应分支
    - 遵循现有 `applyFontBold` 等方法的模式
    - _需求: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 2.2 编写 DocumentApplier 单元测试
    - 测试三种新操作应用到空文档和已有数据的文档
    - 测试 SetBorderOp 的 border 为 null 的情况
    - 测试操作坐标超出文档范围时自动扩展
    - _需求: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 后端服务层：OTTransformer 扩展
  - [x] 3.1 新增三种操作与 RowInsert 的转换函数
    - 在 `OTTransformer.java` 中新增 `transformSetBorderVsRowInsert`、`transformSetFontFamilyVsRowInsert`、`transformSetStrikethroughVsRowInsert`
    - 遵循 `transformFontBoldVsRowInsert` 的模式：克隆操作，调用 `adjustRowForInsert` 调整行索引
    - 在 `transformSingle` 的 `opB instanceof RowInsertOp` 分支中添加三个 if 判断
    - _需求: 4.1, 4.10_

  - [x] 3.2 新增三种操作与 RowDelete 的转换函数
    - 新增 `transformSetBorderVsRowDelete`、`transformSetFontFamilyVsRowDelete`、`transformSetStrikethroughVsRowDelete`
    - 遵循 `transformFontBoldVsRowDelete` 的模式：行在删除范围内返回 null，否则调整行索引
    - 在 `transformSingle` 的 `opB instanceof RowDeleteOp` 分支中添加三个 if 判断
    - _需求: 4.2, 4.3, 4.10_

  - [x] 3.3 新增三种操作与 ColInsert 的转换函数
    - 新增 `transformSetBorderVsColInsert`、`transformSetFontFamilyVsColInsert`、`transformSetStrikethroughVsColInsert`
    - 遵循 `transformFontBoldVsColInsert` 的模式：克隆操作，调用 `adjustColForInsert` 调整列索引
    - 在 `transformSingle` 的 `opB instanceof ColInsertOp` 分支中添加三个 if 判断
    - _需求: 4.4, 4.10_

  - [x] 3.4 新增三种操作与 ColDelete 的转换函数
    - 新增 `transformSetBorderVsColDelete`、`transformSetFontFamilyVsColDelete`、`transformSetStrikethroughVsColDelete`
    - 遵循 `transformFontBoldVsColDelete` 的模式：列在删除范围内返回 null，否则调整列索引
    - 在 `transformSingle` 的 `opB instanceof ColDeleteOp` 分支中添加三个 if 判断
    - _需求: 4.5, 4.6, 4.10_

  - [x] 3.5 新增三种操作与 CellMerge 的转换逻辑
    - 在 `transformSingle` 的 `opB instanceof CellMergeOp` 分支中，为三种新操作添加处理
    - 使用 `isInMergeRange` 判断，在合并范围内则重定向到主单元格 `(startRow, startCol)`
    - _需求: 4.7, 4.10_

  - [x] 3.6 新增三种操作与 CellSplit 的转换逻辑
    - 在 `transformSingle` 的 `opB instanceof CellSplitOp` 分支中，为三种新操作添加处理
    - 使用 `isInSplitRange` 判断，在拆分范围内则重定向到拆分目标单元格
    - _需求: 4.8, 4.10_

  - [x] 3.7 新增同类型同单元格冲突消除逻辑
    - 在 `transformSingle` 末尾添加：两个 SetBorderOp/SetFontFamilyOp/SetStrikethroughOp 操作同一单元格时，返回 null（后到达的被消除）
    - 不同单元格时返回 `cloneOp(opA)`
    - _需求: 4.9, 4.11, 4.12_


- [x] 4. 检查点 - 后端编译与测试验证
  - 确保 Java 后端代码编译通过，所有现有测试仍然通过，如有问题请询问用户。

- [x] 5. 前端 operations.ts 扩展：序列化/反序列化支持
  - [x] 5.1 在 `operations.ts` 中添加三种新操作的支持
    - 在 `VALID_OPERATION_TYPES` 集合中添加 `'setBorder'`、`'setFontFamily'`、`'setStrikethrough'`
    - 在 `deserializeOperation` 的 switch 中添加三个 case，分别调用校验函数
    - 新增 `validateSetBorderOp`：校验 row（number）、col（number），border 允许为 null/undefined
    - 新增 `validateSetFontFamilyOp`：校验 row（number）、col（number）、fontFamily（string）
    - 新增 `validateSetStrikethroughOp`：校验 row（number）、col（number）、strikethrough（boolean）
    - 需要从 `./types` 导入 `SetBorderOp`、`SetFontFamilyOp`、`SetStrikethroughOp` 类型
    - _需求: 9.1, 9.4_

  - [ ]* 5.2 编写 operations.ts 单元测试
    - 测试三种新操作的序列化/反序列化
    - 测试 SetBorderOp 的 border 为 null 和部分方向为 null 的情况
    - 测试缺少必填字段时抛出错误
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6. 前端 ot.ts 扩展：OT 转换逻辑
  - [x] 6.1 新增三种操作与 RowInsert 的转换函数和 case 分支
    - 新增 `transformSetBorderVsRowInsert`、`transformSetFontFamilyVsRowInsert`、`transformSetStrikethroughVsRowInsert`
    - 遵循 `transformFontBoldVsRowInsert` 的模式
    - 在 `transformSingle` 的 `opB.type === 'rowInsert'` 分支的 switch 中添加三个 case
    - 需要从 `./types` 导入 `SetBorderOp`、`SetFontFamilyOp`、`SetStrikethroughOp` 类型
    - _需求: 5.1, 5.10, 5.13_

  - [x] 6.2 新增三种操作与 RowDelete 的转换函数和 case 分支
    - 新增 `transformSetBorderVsRowDelete`、`transformSetFontFamilyVsRowDelete`、`transformSetStrikethroughVsRowDelete`
    - 遵循 `transformFontBoldVsRowDelete` 的模式：行在删除范围内返回 null，否则调整行索引
    - 在 `transformSingle` 的 `opB.type === 'rowDelete'` 分支的 switch 中添加三个 case
    - _需求: 5.2, 5.3, 5.10, 5.13_

  - [x] 6.3 新增三种操作与 ColInsert 的转换函数和 case 分支
    - 新增 `transformSetBorderVsColInsert`、`transformSetFontFamilyVsColInsert`、`transformSetStrikethroughVsColInsert`
    - 遵循 `transformFontBoldVsColInsert` 的模式
    - 在 `transformSingle` 的 `opB.type === 'colInsert'` 分支的 switch 中添加三个 case
    - _需求: 5.4, 5.10, 5.13_

  - [x] 6.4 新增三种操作与 ColDelete 的转换函数和 case 分支
    - 新增 `transformSetBorderVsColDelete`、`transformSetFontFamilyVsColDelete`、`transformSetStrikethroughVsColDelete`
    - 遵循 `transformFontBoldVsColDelete` 的模式：列在删除范围内返回 null，否则调整列索引
    - 在 `transformSingle` 的 `opB.type === 'colDelete'` 分支的 switch 中添加三个 case
    - _需求: 5.5, 5.6, 5.10, 5.13_

  - [x] 6.5 新增三种操作与 CellMerge 的转换 case 分支
    - 在 `transformSingle` 的 `opB.type === 'cellMerge'` 分支的 switch 中添加三个 case
    - 使用 `isInMergeRange` 判断，在合并范围内则重定向到主单元格
    - _需求: 5.7, 5.10, 5.13_

  - [x] 6.6 新增三种操作与 CellSplit 的转换 case 分支
    - 在 `transformSingle` 的 `opB.type === 'cellSplit'` 分支中，将三种新操作加入 `transformStyleOpVsCellSplit` 的 fall-through case
    - _需求: 5.8, 5.10, 5.13_

  - [x] 6.7 新增同类型同单元格冲突消除逻辑
    - 在 `transformSingle` 末尾添加三组同类型冲突判断
    - 同类型同单元格返回 null，不同单元格返回 `cloneOp(opA)`
    - _需求: 5.9, 5.11, 5.12_


- [x] 7. 前端 ot.ts 扩展：操作反转（Undo）支持
  - [x] 7.1 扩展 `ModelReader` 接口，新增 border、fontFamily、fontStrikethrough 字段
    - 在 `getCell` 返回类型中添加 `border?: CellBorder`、`fontFamily?: string`、`fontStrikethrough?: boolean`
    - 需要从 `../types` 导入 `CellBorder` 类型
    - _需求: 6.5_

  - [x] 7.2 在 `invertOperation` 函数中添加三种新操作的反转逻辑
    - `setBorder`：读取当前单元格的 border 值作为反向操作的 border
    - `setFontFamily`：读取当前单元格的 fontFamily 值（默认 ''）作为反向操作的 fontFamily
    - `setStrikethrough`：读取当前单元格的 fontStrikethrough 值（默认 false）作为反向操作的 strikethrough
    - 单元格不存在时使用默认值
    - _需求: 6.1, 6.2, 6.3, 6.4_

- [x] 8. 检查点 - 前端编译验证
  - 确保 TypeScript 编译通过，所有现有测试仍然通过，如有问题请询问用户。

- [ ] 9. 后端属性基测试（Property-Based Testing）
  - [ ]* 9.1 编写 Java 服务端序列化往返一致性属性测试
    - 在 `javaServer/src/test/java/com/iceexcel/server/service/` 下创建测试类
    - 使用 jqwik 库，实现 `arbitrarySetBorderOp()`、`arbitrarySetFontFamilyOp()`、`arbitrarySetStrikethroughOp()`、`arbitraryCellBorder()`、`arbitraryBorderSide()` 生成器
    - 测试三种操作的 JSON 序列化→反序列化往返一致性，包括 border 为 null、部分方向为 null 的边界情况
    - **Property 1: 新操作类型序列化往返一致性**
    - **验证需求: 1.7, 7.1, 7.2, 7.3, 7.4, 7.5**

  - [ ]* 9.2 编写 Java 服务端 OT 收敛性属性测试
    - 实现 `arbitraryNewStyleOp()`、`arbitraryStructuralOp()`、`arbitrarySmallDocument()` 生成器
    - 测试：对于任意初始文档 S 和并发操作 A、B（至少一个为新操作类型），`apply(apply(S, A), b')` 与 `apply(apply(S, B), a')` 产生相同状态
    - **Property 2: 后端 OT 收敛性（新操作类型）**
    - **验证需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.10**

  - [ ]* 9.3 编写 Java 服务端同类型冲突消除属性测试
    - 测试：两个同类型同单元格操作，`transformSingle(A, B)` 返回 null
    - **Property 4: 同类型同单元格操作冲突消除**
    - **验证需求: 4.9, 4.11, 4.12**

  - [ ]* 9.4 编写 Java 服务端文档应用器正确性属性测试
    - 测试：应用操作后目标单元格属性等于操作携带的值，其他单元格不受影响
    - **Property 6: 文档应用器正确性**
    - **验证需求: 3.1, 3.2, 3.3, 3.4**

- [ ] 10. 前端属性基测试（Property-Based Testing）
  - [ ]* 10.1 编写前端 OT 收敛性属性测试
    - 在 `src/collaboration/__tests__/` 下创建测试文件
    - 使用 fast-check 库，实现 `arbitrarySetBorderOp()`、`arbitrarySetFontFamilyOp()`、`arbitrarySetStrikethroughOp()`、`arbitraryNewStyleOp()`、`arbitraryStructuralOp()`、`arbitrarySmallSpreadsheetState()` 生成器
    - 测试前端 OT 转换的收敛性
    - **Property 3: 前端 OT 收敛性（新操作类型）**
    - **验证需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.10, 5.13**

  - [ ]* 10.2 编写前端同类型冲突消除属性测试
    - 测试：两个同类型同单元格操作，`transformSingle(A, B)` 返回 null
    - **Property 4: 同类型同单元格操作冲突消除**
    - **验证需求: 5.9, 5.11, 5.12**

  - [ ]* 10.3 编写前端操作反转往返一致性属性测试
    - 测试：apply(op) 后 apply(invert(op)) 恢复原始状态
    - **Property 5: 操作反转往返一致性**
    - **验证需求: 6.1, 6.2, 6.3**

- [x] 11. E2E 端到端协同测试
  - [x] 11.1 创建 `e2e/collab-new-ops.spec.ts` 测试文件，覆盖 setBorder 协同场景
    - 在 `e2e/` 目录下创建测试文件，参考现有 `e2e/border-collab.spec.ts` 的模式
    - 测试场景：客户端 A 对单元格设置边框（solid/dashed/dotted/double 各线型），客户端 B 实时收到边框变化
    - 测试场景：客户端 A 设置部分边框（仅 top 和 right），客户端 B 收到的边框配置与 A 一致
    - 测试场景：客户端 A 清除边框（border 为 null），客户端 B 的对应单元格边框被清除
    - 测试场景：新客户端 C 加入房间后，获取的文档状态包含已设置的边框
    - _需求: 8.1, 8.4_

  - [x] 11.2 在 `e2e/collab-new-ops.spec.ts` 中添加 setFontFamily 协同场景
    - 测试场景：客户端 A 对单元格设置字体族（如 "Courier New"），客户端 B 实时收到字体族变化
    - 测试场景：客户端 A 连续修改同一单元格的字体族，客户端 B 最终看到最后一次设置的值
    - 测试场景：新客户端 C 加入房间后，获取的文档状态包含已设置的字体族
    - _需求: 8.2, 8.4_

  - [x] 11.3 在 `e2e/collab-new-ops.spec.ts` 中添加 setStrikethrough 协同场景
    - 测试场景：客户端 A 对单元格启用删除线（strikethrough: true），客户端 B 实时看到删除线
    - 测试场景：客户端 A 关闭删除线（strikethrough: false），客户端 B 的删除线被移除
    - 测试场景：新客户端 C 加入房间后，获取的文档状态包含已设置的删除线状态
    - _需求: 8.3, 8.4_

  - [x] 11.4 在 `e2e/collab-new-ops.spec.ts` 中添加并发冲突场景
    - 测试场景：客户端 A 和 B 同时对同一单元格设置不同边框，最终两端收敛到相同状态
    - 测试场景：客户端 A 设置边框的同时客户端 B 插入行，边框操作的行索引正确调整
    - 测试场景：客户端 A 设置字体族的同时客户端 B 删除该行，字体族操作被正确消除
    - _需求: 4.1, 4.2, 4.9, 5.1, 5.2, 5.9_

- [x] 12. 最终检查点 - 全部测试通过
  - 确保 Java 后端和前端 TypeScript 的所有测试通过，E2E 测试全部绿色，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号，确保可追溯性
- 检查点任务确保增量验证
- 属性基测试验证通用正确性属性，单元测试验证具体示例和边界情况
- 所有新增代码严格遵循现有操作（如 `FontBoldOp`）的实现模式，保持代码一致性
