# 需求文档

## 简介

ice-excel 项目的前端（TypeScript）已实现丰富的电子表格功能，但协同编辑链路中存在多处断层：

1. **Java 服务端 Cell 模型**缺少 hyperlink、embeddedImage、comment、formulaContent 等字段，导致文档状态同步不完整
2. **Java 服务端 SpreadsheetData 模型**缺少 pivotTableConfigs 字段
3. **前端协同层**（`applyOperationToModel`）未处理部分已定义的操作类型（colInsert、colDelete、setFormat、setWrapText、setRichText、setValidation）
4. **前端操作提交**未将 setFormat、setWrapText、setRichText、setValidation 作为协同操作发送到服务端

本需求文档旨在补全上述断层，使 Java 服务端模型与前端 JSON 格式完全兼容，同时修复前端协同层的缺失。

## 术语表

- **Java_Server**: javaServer 目录下的 Spring Boot 协同编辑后端服务
- **Frontend_Collab_Layer**: 前端协同层，包括 `src/main.ts` 中的 `applyOperationToModel` 和 `src/app.ts` 中的 `submitCollabOperation`
- **Cell_Model**: 单元格数据模型，包含内容、样式、格式等所有字段
- **SpreadsheetData_Model**: 工作表数据模型，包含单元格网格、行高、列宽等
- **CollabOperation**: 协同操作基类，所有操作类型的抽象父类

## 需求

### 需求 1：Java 服务端 Cell 模型字段补全

**用户故事：** 作为协同编辑用户，我希望超链接、内嵌图片、批注、公式内容等数据在协同同步时不丢失，以便所有用户看到完整的单元格状态。

#### 验收标准

1. THE Java_Server Cell_Model SHALL 包含 formulaContent（String 类型）字段，用于存储公式原始文本
2. THE Java_Server Cell_Model SHALL 包含 hyperlink 字段（含 url 和 displayText 属性），用于存储超链接数据
3. THE Java_Server Cell_Model SHALL 包含 embeddedImage 字段（含 base64Data、originalWidth、originalHeight、displayWidth、displayHeight 属性），用于存储内嵌图片数据
4. THE Java_Server Cell_Model SHALL 包含 comment（String 类型）字段，用于存储批注内容
5. THE Java_Server Cell_Model SHALL 包含 isAutoFormat（Boolean 类型）字段，用于标记自动检测的格式
6. WHEN Java_Server 序列化 Cell_Model 为 JSON 时，THE Java_Server SHALL 仅输出非 null 字段，与前端 JSON 格式保持一致
7. FOR ALL 前端 Cell 接口中定义的持久化字段，Java_Server Cell_Model 的 JSON 序列化结果 SHALL 与前端 JSON 导出格式双向兼容（往返一致性）

### 需求 2：Java 服务端 SpreadsheetData 模型补全

**用户故事：** 作为协同编辑用户，我希望透视表配置在协同同步时不丢失，以便所有用户看到完整的工作表状态。

#### 验收标准

1. THE Java_Server SpreadsheetData_Model SHALL 包含 pivotTableConfigs 字段（List 类型），用于存储透视表序列化配置
2. THE Java_Server SHALL 定义 PivotTableSerializedConfig 模型类，包含 sourceRange、rowFields、colFields、valueFields、filterFields、sort 等属性，与前端 PivotTableSerializedConfig 接口一致
3. WHEN Java_Server 序列化 SpreadsheetData_Model 为 JSON 时，THE Java_Server SHALL 仅在 pivotTableConfigs 非空时输出该字段

### 需求 3：前端协同层远程操作应用补全

**用户故事：** 作为协同编辑用户，我希望远程用户的列插入/删除和格式设置操作能正确应用到本地文档，以便我看到与远程用户一致的文档状态。

#### 验收标准

1. WHEN Frontend_Collab_Layer 收到 colInsert 类型的远程操作时，THE Frontend_Collab_Layer SHALL 调用 model.insertColumns 将列插入应用到本地模型
2. WHEN Frontend_Collab_Layer 收到 colDelete 类型的远程操作时，THE Frontend_Collab_Layer SHALL 调用 model.deleteColumns 将列删除应用到本地模型
3. WHEN Frontend_Collab_Layer 收到 setFormat 类型的远程操作时，THE Frontend_Collab_Layer SHALL 调用 model.setCellFormat 将格式设置应用到本地模型
4. WHEN Frontend_Collab_Layer 收到 setWrapText 类型的远程操作时，THE Frontend_Collab_Layer SHALL 调用 model.setCellWrapText 将换行设置应用到本地模型
5. WHEN Frontend_Collab_Layer 收到 setRichText 类型的远程操作时，THE Frontend_Collab_Layer SHALL 调用 model.setCellRichText 将富文本设置应用到本地模型
6. WHEN Frontend_Collab_Layer 收到 setValidation 类型的远程操作时，THE Frontend_Collab_Layer SHALL 调用 model.setCellValidation 将验证规则应用到本地模型

### 需求 4：前端协同操作提交补全

**用户故事：** 作为协同编辑用户，我希望我设置的单元格格式、换行、富文本、验证规则能同步到其他用户，以便所有用户看到一致的格式和验证状态。

#### 验收标准

1. WHEN 用户通过前端设置单元格格式（setFormat）时，THE Frontend_Collab_Layer SHALL 向服务端提交 setFormat 类型的协同操作
2. WHEN 用户通过前端设置文本换行（setWrapText）时，THE Frontend_Collab_Layer SHALL 向服务端提交 setWrapText 类型的协同操作
3. WHEN 用户通过前端设置富文本（setRichText）时，THE Frontend_Collab_Layer SHALL 向服务端提交 setRichText 类型的协同操作
4. WHEN 用户通过前端设置数据验证（setValidation）时，THE Frontend_Collab_Layer SHALL 向服务端提交 setValidation 类型的协同操作
5. THE Frontend_Collab_Layer 提交的每个协同操作 SHALL 包含 sheetId 字段，标识操作所属的工作表

### 需求 5：JSON 序列化往返一致性

**用户故事：** 作为开发者，我希望前端导出的 JSON 数据能被 Java 服务端正确解析，Java 服务端序列化的 JSON 数据能被前端正确加载，以便前后端数据格式完全兼容。

#### 验收标准

1. FOR ALL 有效的 WorkbookData JSON 文档，Java_Server 解析后再序列化 SHALL 产生与原始 JSON 语义等价的结果（往返一致性）
2. FOR ALL 有效的 SpreadsheetData JSON 文档，Java_Server 解析后再序列化 SHALL 产生与原始 JSON 语义等价的结果（往返一致性）
3. THE Java_Server SHALL 使用 Jackson 的 @JsonInclude(NON_NULL) 注解确保序列化时不输出 null 字段
4. THE Java_Server SHALL 使用 @JsonProperty("isMerged") 注解确保 boolean 字段名与前端 JSON 格式一致
5. IF Java_Server 收到包含未知字段的 JSON 数据，THEN THE Java_Server SHALL 忽略未知字段而非抛出异常（使用 Jackson 的 DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES = false）
