# 需求文档

## 简介

为 ice-excel 电子表格应用新增单元格垂直对齐（verticalAlign）功能。用户可以通过工具栏按钮设置单元格内容的垂直对齐方式：上对齐（top）、居中对齐（middle）、下对齐（bottom）。该功能遵循 newCellFunc SKILL 的全链路实现模式，涵盖类型定义、数据模型、渲染层、控制层、协同编辑（OT 转换）、TypeScript 服务端和 Java 服务端。

### 与已有横向对齐功能的关系

项目已有横向对齐功能（`fontAlign`），支持左对齐（left）、居中对齐（center）、右对齐（right）。本次新增的垂直对齐功能（`verticalAlign`）是独立于横向对齐的新维度，两者互不影响、可以同时生效。例如，一个单元格可以同时设置为"右对齐 + 上对齐"。

**约束：本次实现不得修改已有的横向对齐（`fontAlign`）相关代码和逻辑，包括但不限于 `fontAlign` 属性定义、`setCellFontAlign`/`setRangeFontAlign` 方法、`FontAlignOp` 协同操作类型、OT 转换逻辑、工具栏按钮事件处理以及渲染层中 `fontAlign` 的使用方式。**

## 术语表

- **SpreadsheetApp**：电子表格主控制器，负责用户交互、事件处理和协调各模块
- **SpreadsheetModel**：电子表格数据模型，负责单元格数据存储和业务逻辑
- **SpreadsheetRenderer**：电子表格渲染器，负责 Canvas 绘制和视口管理
- **fontAlign**：已有的横向对齐属性，取值为 `'left'` | `'center'` | `'right'`，控制文本在单元格内的水平位置
- **VerticalAlign**：垂直对齐类型，取值为 `'top'` | `'middle'` | `'bottom'`
- **VerticalAlignOp**：垂直对齐协同操作，包含 row、col 和 align 字段
- **OT_Transformer**：操作转换模块，负责协同编辑时的操作冲突解决
- **CollabOperation**：协同操作联合类型，包含所有可能的操作类型
- **MergedCell**：合并单元格，由父单元格控制所有子单元格的属性
- **DocumentApplier**：Java 服务端文档操作应用模块

## 需求

### 需求 1：单元格垂直对齐属性定义

**用户故事：** 作为开发者，我希望在 Cell 接口中定义垂直对齐属性，以便数据模型能够存储每个单元格的垂直对齐方式。

#### 验收标准

1. THE Cell 接口 SHALL 包含可选属性 `verticalAlign`，类型为 `'top' | 'middle' | 'bottom'`
2. WHEN `verticalAlign` 属性未设置时，THE SpreadsheetRenderer SHALL 将垂直对齐方式默认为 `'middle'`（居中对齐）

### 需求 2：垂直对齐协同操作类型定义

**用户故事：** 作为开发者，我希望定义垂直对齐的协同操作类型，以便多人协作编辑时能够同步垂直对齐变更。

#### 验收标准

1. THE 客户端协同类型模块 SHALL 在 `OperationType` 中包含 `'verticalAlign'` 类型名
2. THE 客户端协同类型模块 SHALL 定义 `VerticalAlignOp` 接口，包含 `type`（值为 `'verticalAlign'`）、`row`（number）、`col`（number）和 `align`（`'top' | 'middle' | 'bottom'`）字段
3. THE `CollabOperation` 联合类型 SHALL 包含 `VerticalAlignOp`
4. THE TypeScript 服务端类型模块 SHALL 定义与客户端完全一致的 `VerticalAlignOp` 接口和类型更新
5. THE `src/types.ts` SHALL 重新导出 `VerticalAlignOp` 类型

### 需求 3：数据模型垂直对齐操作

**用户故事：** 作为用户，我希望设置单元格的垂直对齐方式，以便控制文本在单元格内的垂直位置。

#### 验收标准

1. WHEN 对单个单元格设置垂直对齐时，THE SpreadsheetModel SHALL 将 `verticalAlign` 属性写入该单元格
2. WHEN 对合并单元格的子单元格设置垂直对齐时，THE SpreadsheetModel SHALL 将 `verticalAlign` 属性写入合并父单元格
3. WHEN 对选区范围设置垂直对齐时，THE SpreadsheetModel SHALL 遍历范围内所有单元格并逐一设置，合并单元格通过 processedCells 去重
4. THE SpreadsheetModel 的 `getMergedCellInfo` 方法 SHALL 在返回值中包含 `verticalAlign` 属性
5. WHEN 导出 JSON 数据时，THE SpreadsheetModel SHALL 包含 `verticalAlign` 字段
6. WHEN 导入 JSON 数据时，THE SpreadsheetModel SHALL 解析并恢复 `verticalAlign` 字段

### 需求 4：垂直对齐渲染

**用户故事：** 作为用户，我希望看到单元格内容按照设置的垂直对齐方式显示，以便直观地确认对齐效果。

#### 验收标准

1. WHEN 单元格 `verticalAlign` 为 `'top'` 时，THE SpreadsheetRenderer SHALL 将文本绘制在单元格顶部（Y 坐标为 `currentY + fontSize / 2 + cellPadding`）
2. WHEN 单元格 `verticalAlign` 为 `'middle'` 或未设置时，THE SpreadsheetRenderer SHALL 将文本绘制在单元格垂直居中位置（Y 坐标为 `currentY + totalHeight / 2`）
3. WHEN 单元格 `verticalAlign` 为 `'bottom'` 时，THE SpreadsheetRenderer SHALL 将文本绘制在单元格底部（Y 坐标为 `currentY + totalHeight - fontSize / 2 - cellPadding`）

### 需求 5：工具栏垂直对齐控件

**用户故事：** 作为用户，我希望通过工具栏按钮选择垂直对齐方式，以便快速设置单元格的垂直对齐。

#### 验收标准

1. THE 工具栏 SHALL 显示一个垂直对齐按钮，默认显示居中对齐图标或文本
2. WHEN 用户点击垂直对齐按钮时，THE SpreadsheetApp SHALL 弹出包含三个选项（上对齐、居中对齐、下对齐）的下拉菜单
3. WHEN 用户选择一个对齐方式时，THE SpreadsheetApp SHALL 对当前选区内所有单元格应用该垂直对齐方式
4. WHEN 用户选择一个对齐方式时，THE 工具栏按钮 SHALL 更新显示为当前选择的对齐方式
5. WHEN 用户选中单元格时，THE SpreadsheetApp SHALL 更新工具栏按钮显示为该单元格当前的垂直对齐方式

### 需求 6：协同编辑操作校验与序列化

**用户故事：** 作为开发者，我希望垂直对齐操作能够通过协同编辑的校验和序列化流程，以便在多人协作时正确传输。

#### 验收标准

1. THE 协同操作校验模块 SHALL 将 `'verticalAlign'` 加入 `VALID_OPERATION_TYPES`
2. WHEN 反序列化 `verticalAlign` 操作时，THE 协同操作模块 SHALL 校验 `row`（number）、`col`（number）和 `align`（`'top' | 'middle' | 'bottom'`）字段的存在和类型
3. IF `verticalAlign` 操作缺少必要字段或字段类型错误，THEN THE 协同操作模块 SHALL 抛出描述性错误信息

### 需求 7：OT 转换（客户端与 TypeScript 服务端）

**用户故事：** 作为开发者，我希望垂直对齐操作能够正确进行 OT 转换，以便在并发编辑时保持数据一致性。

#### 验收标准

1. WHEN `VerticalAlignOp` 与 `RowInsertOp` 并发时，THE OT_Transformer SHALL 根据插入位置调整 `VerticalAlignOp` 的 `row` 值
2. WHEN `VerticalAlignOp` 与 `RowDeleteOp` 并发且操作行被删除时，THE OT_Transformer SHALL 返回 `null` 表示操作无效
3. WHEN `VerticalAlignOp` 与 `RowDeleteOp` 并发且操作行未被删除时，THE OT_Transformer SHALL 调整 `VerticalAlignOp` 的 `row` 值
4. WHEN `VerticalAlignOp` 与 `CellMergeOp` 并发且操作位置在合并范围内时，THE OT_Transformer SHALL 将 `row` 和 `col` 重定向到合并区域的起始位置
5. THE 客户端 OT 模块的 `invertOperation` 方法 SHALL 支持 `verticalAlign` 类型，返回单元格当前的 `verticalAlign` 值作为反向操作
6. THE TypeScript 服务端 OT 模块 SHALL 实现与客户端完全一致的转换逻辑

### 需求 8：协同引擎与操作应用

**用户故事：** 作为开发者，我希望垂直对齐操作能够在协同引擎和服务端正确应用，以便所有客户端看到一致的结果。

#### 验收标准

1. THE 协同引擎的 `createModelReader` SHALL 在 `getCell` 返回值中包含 `verticalAlign` 属性
2. WHEN 收到 `verticalAlign` 操作时，THE `src/main.ts` 的 `applyOperationToModel` SHALL 调用 `model.setCellVerticalAlign` 方法
3. WHEN 收到 `verticalAlign` 操作时，THE TypeScript 服务端的 `applyOperationToDocument` SHALL 将 `align` 值写入对应单元格的 `verticalAlign` 属性

### 需求 9：Java 服务端支持

**用户故事：** 作为开发者，我希望 Java 服务端能够处理垂直对齐操作，以便 Java 服务端部署时也能支持该功能的协同编辑。

#### 验收标准

1. THE Java 服务端 SHALL 新建 `VerticalAlignOp.java` 操作模型类，包含 `row`（int）、`col`（int）和 `align`（String）字段，`getType()` 返回 `"verticalAlign"`
2. THE `CollabOperation.java` 的 `@JsonSubTypes` 注解 SHALL 注册 `VerticalAlignOp` 类型映射（name = `"verticalAlign"`）
3. THE `Cell.java` SHALL 添加 `verticalAlign`（String 类型）字段及对应的 getter/setter，并更新 `equals()` 和 `hashCode()` 方法
4. THE Java 服务端 `OTTransformer` SHALL 实现 `VerticalAlignOp` 与 `RowInsertOp`、`RowDeleteOp`、`CellMergeOp` 的转换逻辑，与 TypeScript 端保持一致
5. WHEN 收到 `verticalAlign` 操作时，THE Java 服务端 `DocumentApplier` SHALL 将 `align` 值写入对应单元格的 `verticalAlign` 属性

### 需求 10：样式与界面

**用户故事：** 作为用户，我希望垂直对齐的工具栏控件样式与现有控件保持一致，以便获得统一的使用体验。

#### 验收标准

1. THE 垂直对齐下拉菜单 SHALL 使用与现有下拉菜单（如字体大小选择器）一致的 CSS 样式
2. THE 垂直对齐按钮和下拉菜单中的文本 SHALL 使用简体中文（上对齐、居中对齐、下对齐）
3. WHEN 用户点击下拉菜单外部区域时，THE 下拉菜单 SHALL 自动关闭

### 需求 11：不影响已有横向对齐功能

**用户故事：** 作为用户，我希望新增的垂直对齐功能不会影响已有的横向对齐功能，以便两种对齐方式可以独立使用、互不干扰。

#### 验收标准

1. THE 垂直对齐功能实现 SHALL 保持 `fontAlign` 属性定义、`setCellFontAlign` 方法和 `setRangeFontAlign` 方法的代码不变
2. THE 垂直对齐功能实现 SHALL 保持 `FontAlignOp` 协同操作类型及其 OT 转换逻辑不变
3. THE 垂直对齐功能实现 SHALL 保持工具栏中横向对齐按钮（`font-align-left-btn`、`font-align-center-btn`、`font-align-right-btn`）的事件处理逻辑不变
4. THE SpreadsheetRenderer SHALL 在渲染单元格时独立处理 `fontAlign`（横向）和 `verticalAlign`（纵向），两者互不覆盖
5. WHEN 同时设置 `fontAlign` 和 `verticalAlign` 时，THE SpreadsheetRenderer SHALL 同时应用两种对齐方式（例如右对齐 + 上对齐）
6. THE `verticalAlign` 属性 SHALL 作为 Cell 接口中独立于 `fontAlign` 的新属性存在，两者无任何耦合关系
