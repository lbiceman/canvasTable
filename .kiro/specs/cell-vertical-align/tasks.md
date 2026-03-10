# 实现计划：单元格垂直对齐（cell-vertical-align）

## 概述

按照全链路实现模式，为 ice-excel 新增 `verticalAlign` 功能。从类型定义开始，逐步实现数据模型、渲染层、控制层 UI、协同操作校验与 OT 转换、TypeScript 服务端和 Java 服务端。每一步增量构建，确保代码始终可集成。

## 任务

- [x] 1. 类型定义与协同操作类型
  - [x] 1.1 在 `src/collaboration/types.ts` 中新增 `VerticalAlignOp` 接口和类型更新
    - 在 `OperationType` 联合类型中添加 `'verticalAlign'`
    - 新增 `VerticalAlignOp` 接口，继承 `BaseOperation`，包含 `type: 'verticalAlign'`、`row: number`、`col: number`、`align: 'top' | 'middle' | 'bottom'`
    - 在 `CollabOperation` 联合类型中添加 `VerticalAlignOp`
    - _需求: 2.1, 2.2, 2.3_

  - [x] 1.2 在 `src/types.ts` 中扩展 Cell 接口并重新导出 `VerticalAlignOp`
    - Cell 接口添加可选属性 `verticalAlign?: 'top' | 'middle' | 'bottom'`
    - 在 `export type { ... } from './collaboration/types'` 中添加 `VerticalAlignOp`
    - _需求: 1.1, 2.5_

  - [x] 1.3 在 `server/src/types.ts` 中同步类型定义
    - Cell 接口添加 `verticalAlign` 可选属性
    - 新增 `VerticalAlignOp` 接口，与客户端完全一致
    - 更新 `OperationType` 和 `CollabOperation` 联合类型
    - _需求: 2.4_

- [x] 2. 数据模型层实现
  - [x] 2.1 在 `src/model.ts` 中实现 `setCellVerticalAlign` 和 `setRangeVerticalAlign` 方法
    - `setCellVerticalAlign(row, col, align)`：验证位置有效性，合并单元格设置父单元格，普通单元格直接设置，标记 `isDirty`
    - `setRangeVerticalAlign(startRow, startCol, endRow, endCol, align)`：遍历选区，使用 `processedCells` Set 去重处理合并单元格
    - _需求: 3.1, 3.2, 3.3_

  - [x] 2.2 更新 `src/model.ts` 中 `getMergedCellInfo` 方法
    - 在返回值的两个分支（合并子单元格 / 普通单元格）中添加 `verticalAlign` 字段
    - _需求: 3.4_

  - [x] 2.3 更新 `src/model.ts` 中导入导出逻辑
    - `exportToJSON`：在导出条件和字段中添加 `verticalAlign`
    - `importFromJSON`：在解构和赋值中添加 `verticalAlign`
    - _需求: 3.5, 3.6_

- [x] 3. 渲染层实现
  - [x] 3.1 修改 `src/renderer.ts` 中 `renderCells` 方法，根据 `verticalAlign` 计算文本 Y 坐标
    - 获取 `cellInfo.verticalAlign`，默认为 `'middle'`
    - `'top'`：`textY = currentY + fontSize / 2 + cellPadding`
    - `'middle'`：`textY = currentY + totalHeight / 2`（保持原有逻辑）
    - `'bottom'`：`textY = currentY + totalHeight - fontSize / 2 - cellPadding`
    - 同步调整下划线绘制的 Y 坐标
    - 不修改 `fontAlign`（横向对齐）的任何逻辑，`textX` 计算保持不变
    - _需求: 4.1, 4.2, 4.3, 11.4, 11.5_

- [x] 4. 检查点 - 确保类型、模型和渲染层正确
  - 确保所有代码无编译错误，如有问题请询问用户。

- [x] 5. 工具栏 UI 与控制层
  - [x] 5.1 在 `index.html` 中添加垂直对齐工具栏按钮和下拉容器
    - 添加垂直对齐按钮元素，默认显示居中对齐
    - 添加下拉菜单容器，包含三个选项（上对齐、居中对齐、下对齐），文本使用简体中文
    - _需求: 5.1, 5.2, 10.2_

  - [x] 5.2 在 `src/style.css` 中添加垂直对齐下拉菜单样式
    - 参照现有下拉菜单（如字体大小选择器）的 CSS 样式
    - _需求: 10.1_

  - [x] 5.3 在 `src/app.ts` 中实现 `initVerticalAlignPicker` 方法
    - 初始化垂直对齐下拉菜单，绑定按钮点击事件
    - 点击外部区域关闭下拉菜单
    - _需求: 5.2, 10.3_

  - [x] 5.4 在 `src/app.ts` 中实现 `handleVerticalAlignChange` 方法
    - 更新工具栏按钮显示
    - 调用 `model.setRangeVerticalAlign()` 应用到当前选区
    - 协同模式下遍历选区提交 `VerticalAlignOp`
    - 触发 `renderer.render()` 重新渲染
    - _需求: 5.3, 5.4_

  - [x] 5.5 更新 `src/app.ts` 中 `updateSelectedCellInfo` 方法
    - 选中单元格时，同步更新垂直对齐按钮显示为当前单元格的 `verticalAlign` 值
    - _需求: 5.5_

- [x] 6. 检查点 - 确保 UI 和控制层正确
  - 确保所有代码无编译错误，工具栏按钮和下拉菜单功能正常，如有问题请询问用户。

- [x] 7. 协同操作校验与序列化
  - [x] 7.1 更新 `src/collaboration/operations.ts` 中的校验和反序列化逻辑
    - `VALID_OPERATION_TYPES` 添加 `'verticalAlign'`
    - `deserializeOperation` switch 添加 `'verticalAlign'` case
    - 新增 `validateVerticalAlignOp` 校验函数，校验 `row`（number）、`col`（number）、`align`（`'top' | 'middle' | 'bottom'` 之一），缺少或类型错误时抛出描述性错误
    - _需求: 6.1, 6.2, 6.3_

- [x] 8. 客户端 OT 转换
  - [x] 8.1 在 `src/collaboration/ot.ts` 中实现 `VerticalAlignOp` 的 OT 转换
    - 新增 `transformVerticalAlignVsRowInsert` 函数：根据插入位置调整 `row`
    - 新增 `transformVerticalAlignVsRowDelete` 函数：行被删除时返回 `null`，否则调整 `row`
    - 更新 `transformSingle`：在 `rowInsert`、`rowDelete`、`cellMerge` 三个分支中添加 `'verticalAlign'` case
    - `cellMerge` 分支：合并范围内重定向 `row` 和 `col` 到父单元格
    - _需求: 7.1, 7.2, 7.3, 7.4_

  - [x] 8.2 更新 `src/collaboration/ot.ts` 中 `invertOperation` 和 `ModelReader`
    - `invertOperation` 添加 `'verticalAlign'` case，返回当前单元格的 `verticalAlign` 值（默认 `'middle'`）
    - `ModelReader` 接口的 `getCell` 返回值添加 `verticalAlign?: string`
    - _需求: 7.5_

- [x] 9. 协同引擎与操作应用
  - [x] 9.1 更新 `src/collaboration/collaboration-engine.ts` 中 `createModelReader`
    - `getCell` 返回值添加 `verticalAlign: cell.verticalAlign`
    - _需求: 8.1_

  - [x] 9.2 更新 `src/main.ts` 中 `applyOperationToModel`
    - switch 添加 `'verticalAlign'` case，调用 `model.setCellVerticalAlign(op.row, op.col, op.align)`
    - _需求: 8.2_

- [x] 10. 检查点 - 确保协同编辑功能正确
  - 确保所有代码无编译错误，协同操作校验、OT 转换和操作应用逻辑完整，如有问题请询问用户。

- [x] 11. TypeScript 服务端实现
  - [x] 11.1 更新 `server/src/ot.ts` 中 OT 转换逻辑
    - 实现与客户端完全一致的 `VerticalAlignOp` 转换逻辑（不含 `invertOperation` 和 `ModelReader`）
    - 新增 `transformVerticalAlignVsRowInsert` 和 `transformVerticalAlignVsRowDelete` 函数
    - 更新 `transformSingle`：在 `rowInsert`、`rowDelete`、`cellMerge` 分支中添加 `'verticalAlign'` case
    - _需求: 7.6_

  - [x] 11.2 更新 `server/src/room-manager.ts` 中 `applyOperationToDocument`
    - switch 添加 `'verticalAlign'` case，将 `op.align` 写入 `cells[op.row][op.col].verticalAlign`
    - _需求: 8.3_

- [x] 12. Java 服务端实现
  - [x] 12.1 新建 `javaServer/src/main/java/com/iceexcel/server/model/VerticalAlignOp.java`
    - 参照 `FontAlignOp.java`，包含 `row`（int）、`col`（int）、`align`（String）字段
    - `getType()` 返回 `"verticalAlign"`
    - _需求: 9.1_

  - [x] 12.2 更新 `javaServer/src/main/java/com/iceexcel/server/model/CollabOperation.java`
    - `@JsonSubTypes` 注解添加 `@JsonSubTypes.Type(value = VerticalAlignOp.class, name = "verticalAlign")`
    - _需求: 9.2_

  - [x] 12.3 更新 `javaServer/src/main/java/com/iceexcel/server/model/Cell.java`
    - 添加 `verticalAlign`（String）字段及 getter/setter
    - 更新 `equals()` 和 `hashCode()` 方法
    - _需求: 9.3_

  - [x] 12.4 更新 `javaServer/src/main/java/com/iceexcel/server/service/OTTransformer.java`
    - 新增 `transformVerticalAlignVsRowInsert` 和 `transformVerticalAlignVsRowDelete` 方法
    - `transformSingle` 中 `RowInsertOp`、`RowDeleteOp`、`CellMergeOp` 三个分支添加 `VerticalAlignOp` 处理
    - 与 TypeScript 端保持一致的转换逻辑
    - _需求: 9.4_

  - [x] 12.5 更新 `javaServer/src/main/java/com/iceexcel/server/service/DocumentApplier.java`
    - `apply` 方法添加 `VerticalAlignOp` 分支
    - 新增 `applyVerticalAlign` 方法，将 `align` 值写入对应单元格的 `verticalAlign` 属性
    - _需求: 9.5_

- [x] 13. 最终检查点 - 确保所有代码无编译错误
  - 确保所有代码无编译错误，全链路功能完整，如有问题请询问用户。

## 备注

- 带 `*` 标记的任务为可选任务，可跳过以加速 MVP
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证
- 实现过程中不得修改已有的横向对齐（`fontAlign`）相关代码（需求 11）
