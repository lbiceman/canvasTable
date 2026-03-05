# 新增单元格级别功能 SKILL

## 适用场景
当需要为电子表格新增一个**单元格级别的格式属性**（如字体大小、字体颜色、背景颜色等）时，参考此 SKILL 完成全链路实现。

## 用户提示词模板

```
【功能】请实现页面顶部操作区的"XXX"功能，完整代码+注释：
【需求】
1. 按钮默认显示YYY，点击弹出下拉框/选择器
2. 选择后按钮文本更新
3. 使用当前项目技术栈实现，样式通用美观，标注集成方式
4. 多人协作编辑的时候也需要处理这个操作
5. server文件夹的服务器也需要处理这个操作
6. 修改逻辑参考字体颜色的实现方式
【注意】
1. 不要修改我需求之外的代码！
2. 修改只针对当前选择的单元格生效
```

## 实现步骤（全链路）

### 1. 类型定义

#### 1.1 Cell 接口添加可选属性
文件：`src/types.ts`
```typescript
export interface Cell {
  // ...已有字段
  newProp?: PropType; // 新增属性
}
```

#### 1.2 客户端协同操作类型
文件：`src/collaboration/types.ts`
- 在 `OperationType` 联合类型中添加新类型名
- 新增操作接口（单元格级别需包含 `row`、`col`）：
```typescript
export interface NewPropOp extends BaseOperation {
  type: 'newProp';
  row: number;
  col: number;
  value: PropType;
}
```
- 将新接口加入 `CollabOperation` 联合类型

#### 1.3 服务端类型定义（与客户端保持一致）
文件：`server/src/types.ts`
- `Cell` 接口添加 `newProp?: PropType`
- 添加相同的 `NewPropOp` 接口
- 更新 `OperationType` 和 `CollabOperation`

#### 1.4 客户端 types.ts 重新导出
文件：`src/types.ts`
- 在 `export type { ... } from './collaboration/types'` 中添加新类型

### 2. 数据模型
文件：`src/model.ts`

#### 2.1 单个单元格设置方法
```typescript
public setCellNewProp(row: number, col: number, value: PropType): void {
  // 验证位置 → 处理合并单元格（设置父单元格） → 标记 isDirty
}
```

#### 2.2 批量设置方法（参考 `setRangeFontColor`）
```typescript
public setRangeNewProp(startRow, startCol, endRow, endCol, value): void {
  // 遍历范围 → processedCells 去重 → 处理合并单元格 → 标记 isDirty
}
```

#### 2.3 更新 `getMergedCellInfo` 返回值
- 返回类型添加 `newProp?: PropType`
- 在两个分支（合并子单元格 / 普通单元格）中都返回该属性

#### 2.4 更新导入导出
- `exportToJSON`：导出条件和字段中添加 `newProp`
- `importFromJSON`：解构和赋值中添加 `newProp`

### 3. 渲染层
文件：`src/renderer.ts`

在 `renderCells()` 方法中使用 `cellInfo.newProp`，无值时回退到默认值：
```typescript
// 示例：字体大小
this.ctx.font = `${cellInfo.fontSize || this.cellFontSize}px ${fontFamily}`;
```

### 4. 控制层（事件处理）
文件：`src/app.ts`

#### 4.1 初始化 UI 控件
在 `initEventListeners()` 中调用初始化方法，生成下拉选项并绑定事件。

#### 4.2 处理变更方法（参考 `handleFontColorChange`）
```typescript
private handleNewPropChange(value: PropType): void {
  if (!this.currentSelection) return;
  // 1. 更新 UI 显示
  // 2. 调用 model.setRangeNewProp(...)
  // 3. 协同模式下遍历选区，为每个单元格提交操作
  // 4. renderer.render()
}
```

#### 4.3 更新 `updateSelectedCellInfo`
选中单元格时同步更新工具栏按钮显示为当前单元格的属性值。

### 5. 协同操作校验
文件：`src/collaboration/operations.ts`

- 将新类型加入 `VALID_OPERATION_TYPES`
- 在 `deserializeOperation` 的 switch 中添加 case
- 添加校验函数：
```typescript
const validateNewPropOp = (obj: Record<string, unknown>): void => {
  if (typeof obj.row !== 'number') throw new Error('newProp: 缺少 row');
  if (typeof obj.col !== 'number') throw new Error('newProp: 缺少 col');
  if (typeof obj.value !== 'expectedType') throw new Error('newProp: 缺少 value');
};
```

### 6. OT 转换（客户端 + 服务端）
文件：`src/collaboration/ot.ts` 和 `server/src/ot.ts`

#### 6.1 导入新类型

#### 6.2 添加 vs RowInsert / RowDelete 转换函数
```typescript
const transformNewPropVsRowInsert = (op: NewPropOp, insertOp: RowInsertOp): NewPropOp => {
  const result = cloneOp(op);
  result.row = adjustRowForInsert(op.row, insertOp);
  return result;
};

const transformNewPropVsRowDelete = (op: NewPropOp, deleteOp: RowDeleteOp): NewPropOp | null => {
  const newRow = adjustRowForDelete(op.row, deleteOp);
  if (newRow === null) return null;
  const result = cloneOp(op);
  result.row = newRow;
  return result;
};
```

#### 6.3 更新 `transformSingle`
- 在 `opB === 'rowInsert'` 和 `opB === 'rowDelete'` 的 switch 中添加 case
- 在 `opB === 'cellMerge'` 中添加合并范围内坐标调整逻辑

#### 6.4 更新 `invertOperation`（客户端 ot.ts）
```typescript
case 'newProp': {
  const cell = model.getCell(op.row, op.col);
  return { ...op, value: cell?.newProp ?? defaultValue, timestamp: Date.now() };
}
```

#### 6.5 更新 `ModelReader` 接口
`getCell` 返回值添加 `newProp?: PropType`

### 7. 协同引擎
文件：`src/collaboration/collaboration-engine.ts`

更新 `createModelReader` 中 `getCell` 返回值，包含新属性。

### 8. 服务端操作应用
文件：`server/src/room-manager.ts`

在 `applyOperationToDocument` 的 switch 中添加：
```typescript
case 'newProp': {
  if (op.row < cells.length && op.col < cells[0].length) {
    cells[op.row][op.col].newProp = op.value;
  }
  break;
}
```

### 9. 入口文件
文件：`src/main.ts`

在 `applyOperationToModel` 的 switch 中添加：
```typescript
case 'newProp':
  model.setCellNewProp(op.row, op.col, op.value);
  break;
```

### 10. UI（HTML + CSS）
- `index.html`：在工具栏中添加按钮和下拉容器
- `src/style.css`：添加对应的样式（参考 `.font-size-picker` / `.font-color-picker`）

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/types.ts` | Cell 接口 + 重新导出 |
| `src/collaboration/types.ts` | 操作类型定义 |
| `server/src/types.ts` | Cell + 操作类型（与客户端一致） |
| `src/model.ts` | set/setRange + getMergedCellInfo + 导入导出 |
| `src/renderer.ts` | renderCells 中使用新属性 |
| `src/app.ts` | UI 初始化 + 事件处理 + updateSelectedCellInfo |
| `src/collaboration/operations.ts` | 校验 + 反序列化 |
| `src/collaboration/ot.ts` | OT 转换 + invertOperation + ModelReader |
| `server/src/ot.ts` | 服务端 OT 转换 |
| `src/collaboration/collaboration-engine.ts` | createModelReader |
| `server/src/room-manager.ts` | applyOperationToDocument |
| `src/main.ts` | applyOperationToModel |
| `index.html` | 工具栏 UI |
| `src/style.css` | 样式 |

## 注意事项
- 单元格级别属性必须处理合并单元格（设置到父单元格）
- 协同操作需要为选区内每个单元格单独提交操作
- OT 转换需要处理 RowInsert/RowDelete/CellMerge 三种冲突场景
- 服务端和客户端的类型定义、OT 逻辑必须保持一致
- 验证时先跑 `npx tsc --noEmit`，再到 `server/` 目录跑服务端编译
