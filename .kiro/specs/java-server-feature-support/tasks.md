# 实施计划：Java 服务端与前端协同层功能补全

## 概述

基于需求文档和设计文档，将实施分为 4 个阶段：Java 服务端 Cell 模型补全、SpreadsheetData 模型补全、前端协同层远程操作应用补全、前端协同操作提交补全。每个阶段包含实现任务和可选的测试任务。

## 任务

- [x] 1. Java 服务端 Cell 模型字段补全
  - [x] 1.1 创建 HyperlinkData 模型类
    - 在 `javaServer/src/main/java/com/iceexcel/server/model/` 下创建 `HyperlinkData.java`
    - 包含 `url`（String）和 `displayText`（String）字段
    - 添加 `@JsonInclude(NON_NULL)` 注解
    - 实现 getter/setter、equals、hashCode
    - _需求: 1.2, 1.6_

  - [x] 1.2 创建 EmbeddedImageData 模型类
    - 在 `javaServer/src/main/java/com/iceexcel/server/model/` 下创建 `EmbeddedImageData.java`
    - 包含 `base64Data`（String）、`originalWidth`（Integer）、`originalHeight`（Integer）、`displayWidth`（Integer）、`displayHeight`（Integer）字段
    - 添加 `@JsonInclude(NON_NULL)` 注解
    - 实现 getter/setter、equals、hashCode
    - _需求: 1.3, 1.6_

  - [x] 1.3 在 Cell.java 中新增 5 个字段
    - 新增 `formulaContent`（String）、`hyperlink`（HyperlinkData）、`embeddedImage`（EmbeddedImageData）、`comment`（String）、`isAutoFormat`（Boolean）字段
    - `isAutoFormat` 使用 `@JsonProperty("isAutoFormat")` 注解确保 JSON 字段名正确
    - 更新 equals 和 hashCode 方法包含新增字段
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 5.4_

  - [ ]* 1.4 编写 Cell 模型序列化属性测试
    - 在 `javaServer/src/test/java/com/iceexcel/server/model/` 下创建 `CellSerializationPropertyTest.java`
    - **Property 1: JSON 序列化往返一致性** — 随机生成包含新增字段的 Cell 对象，序列化后反序列化应与原始对象 equals 相等
    - **验证: 需求 1.7, 5.1, 5.2**
    - **Property 2: JSON 序列化 null 字段排除** — 随机生成部分字段为 null 的 Cell，序列化 JSON 中不应包含 null 值的键
    - **验证: 需求 1.6, 5.3**
    - **Property 3: 未知字段反序列化容错** — 在有效 Cell JSON 中注入随机未知字段，反序列化应成功且已知字段值不变
    - **验证: 需求 5.5**

- [x] 2. Java 服务端 SpreadsheetData 模型补全
  - [x] 2.1 创建透视表相关模型类
    - 创建 `PivotTableSerializedConfig.java`（含 sourceRange、rowFields、colFields、valueFields、filterFields、sort）
    - 创建 `PivotField.java`（含 fieldIndex、fieldName）
    - 创建 `PivotValueField.java`（含 fieldIndex、fieldName、aggregateFunc）
    - 创建 `PivotFilterField.java`（含 fieldIndex、fieldName、selectedValues）
    - 创建 `PivotSort.java`（含 by、fieldIndex、direction）
    - 所有类添加 `@JsonInclude(NON_NULL)` 注解，实现 getter/setter、equals、hashCode
    - _需求: 2.2_

  - [x] 2.2 在 SpreadsheetData.java 中新增 pivotTableConfigs 字段
    - 新增 `pivotTableConfigs`（`List<PivotTableSerializedConfig>`）字段
    - 更新 equals 和 hashCode 方法
    - _需求: 2.1, 2.3_

  - [ ]* 2.3 编写 SpreadsheetData 模型序列化属性测试
    - 在 `CellSerializationPropertyTest.java` 中新增测试方法
    - **Property 1（扩展）: SpreadsheetData JSON 往返一致性** — 随机生成包含 pivotTableConfigs 的 SpreadsheetData，序列化后反序列化应 equals 相等
    - **验证: 需求 2.3, 5.1, 5.2**

- [x] 3. 检查点 - 确保 Java 服务端模型编译通过
  - 确保所有 Java 模型类编译无错误，如有问题请向用户确认。

- [x] 4. 前端协同层远程操作应用补全
  - [x] 4.1 在 applyOperationToModel 中补全 colInsert/colDelete 处理
    - 在 `src/main.ts` 的 `applyOperationToModel` 函数的 switch 语句中新增 `colInsert` 和 `colDelete` case
    - `colInsert`: 调用 `targetModel.insertColumns(op.colIndex, op.count)`
    - `colDelete`: 调用 `targetModel.deleteColumns(op.colIndex, op.count)`
    - _需求: 3.1, 3.2_

  - [x] 4.2 在 applyOperationToModel 中补全 setFormat/setWrapText/setRichText/setValidation 处理
    - 在 `src/main.ts` 的 `applyOperationToModel` 函数的 switch 语句中新增 4 个 case
    - `setFormat`: 调用 `targetModel.setCellFormat(op.row, op.col, op.format)`
    - `setWrapText`: 调用 `targetModel.setCellWrapText(op.row, op.col, op.wrapText)`
    - `setRichText`: 调用 `targetModel.setCellRichText(op.row, op.col, op.richText)`
    - `setValidation`: 调用 `targetModel.setCellValidation(op.row, op.col, op.validation)`
    - _需求: 3.3, 3.4, 3.5, 3.6_

  - [x] 4.3 补全 applyOperationToModel 中的类型导入
    - 在 `src/main.ts` 顶部导入语句中添加 `SetFormatOp`、`SetWrapTextOp`、`SetRichTextOp`、`SetValidationOp`、`ColInsertOp`、`ColDeleteOp` 类型
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 5. 前端协同操作提交补全
  - [x] 5.1 在 applyFormatDialogValues 中添加 setFormat 协同操作提交
    - 在 `src/app.ts` 的 `applyFormatDialogValues` 方法中，`setCellFormat` 调用后添加协同操作提交
    - 遍历选区内每个单元格，调用 `submitCollabOperation` 提交 `setFormat` 类型操作，包含 `sheetId`、`row`、`col`、`format`
    - _需求: 4.1, 4.5_

  - [x] 5.2 在 handleWrapTextChange 中添加 setWrapText 协同操作提交
    - 在 `src/app.ts` 的 `handleWrapTextChange` 方法中，`setRangeWrapText` 调用后添加协同操作提交
    - 遍历选区内每个单元格，调用 `submitCollabOperation` 提交 `setWrapText` 类型操作，包含 `sheetId`、`row`、`col`、`wrapText`
    - _需求: 4.2, 4.5_

  - [x] 5.3 在 setCellValidation 调用处添加 setValidation 协同操作提交
    - 在 `src/app.ts` 中验证规则设置的回调中，`setCellValidation` 调用后添加协同操作提交
    - 遍历选区内每个单元格，调用 `submitCollabOperation` 提交 `setValidation` 类型操作，包含 `sheetId`、`row`、`col`、`validation`
    - _需求: 4.4, 4.5_

  - [x] 5.4 在 applyFormatDialogValues 中添加 setWrapText 协同操作提交
    - 在 `src/app.ts` 的 `applyFormatDialogValues` 方法中，`setRangeWrapText` 调用后添加协同操作提交
    - 遍历选区内每个单元格，调用 `submitCollabOperation` 提交 `setWrapText` 类型操作
    - _需求: 4.2, 4.5_

- [x] 6. 检查点 - 确保前端编译通过
  - 确保所有 TypeScript 文件编译无错误，如有问题请向用户确认。

- [ ] 7. 属性测试与单元测试（Java 服务端）
  - [ ] 7.1 编写 HyperlinkData 单元测试
    - 在 `javaServer/src/test/java/com/iceexcel/server/model/` 下创建 `HyperlinkDataTest.java`
    - 测试序列化/反序列化、null 字段排除、equals/hashCode
    - _需求: 1.2, 1.6_

  - [ ] 7.2 编写 EmbeddedImageData 单元测试
    - 在 `javaServer/src/test/java/com/iceexcel/server/model/` 下创建 `EmbeddedImageDataTest.java`
    - 测试序列化/反序列化、可选字段（displayWidth/displayHeight）为 null 时不输出
    - _需求: 1.3, 1.6_

  - [ ] 7.3 编写 PivotTableSerializedConfig 单元测试
    - 在 `javaServer/src/test/java/com/iceexcel/server/model/` 下创建 `PivotTableSerializedConfigTest.java`
    - 测试完整配置和最小配置的序列化/反序列化
    - _需求: 2.2_

  - [ ] 7.4 编写 Cell 模型新增字段单元测试
    - 在 `javaServer/src/test/java/com/iceexcel/server/model/` 下创建 `CellModelTest.java`
    - 测试新增 5 个字段的 getter/setter、JSON 序列化/反序列化、isAutoFormat 的 @JsonProperty 注解
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 5.4_

- [x] 8. 最终检查点 - 确保所有测试通过
  - 确保所有 Java 单元测试和属性测试通过，确保前端编译无错误，如有问题请向用户确认。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 交付
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点任务确保增量验证
- 属性测试使用 jqwik 库（已在 pom.xml 中配置，版本 1.9.2）
- 不包含 Node.js 服务端相关任务，聚焦 Java 服务端模型和前端协同层
