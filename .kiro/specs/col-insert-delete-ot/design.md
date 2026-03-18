# 列插入/删除 OT 支持设计文档

## 概述

本文档描述为 Canvas Excel 协作编辑系统添加列插入/删除 OT 支持的技术设计。当前系统已有完整的行操作 OT 转换矩阵，本功能将以相同的模式实现列操作的对称支持。

## 架构概览

```
src/collaboration/
├── types.ts          # 新增 ColInsertOp、ColDeleteOp 类型定义
├── operations.ts     # 新增序列化/反序列化/校验逻辑
└── ot.ts             # 新增 30 个转换函数 + 修改 transformSingle

src/model.ts          # 新增 insertColumns()、deleteColumns() 方法

javaServer/.../service/
├── OTTransformer.java    # 新增 30 个 Java 转换方法
└── DocumentApplier.java  # 新增 applyColInsert()、applyColDelete()

javaServer/.../model/
├── ColInsertOp.java      # 新增 Java 操作类
└── ColDeleteOp.java      # 新增 Java 操作类
```

## 一、类型定义（types.ts）

### 1.1 新增操作类型

在 `OperationType` 联合类型中新增两个字面量：

```typescript
export type OperationType =
  | /* 现有类型 */
  | 'colInsert'
  | 'colDelete';
```

### 1.2 ColInsertOp 接口

```typescript
export interface ColInsertOp extends BaseOperation {
  type: 'colInsert';
  colIndex: number; // 插入位置（非负整数，从 0 开始）
  count: number;    // 插入列数（正整数 > 0）
}
```

### 1.3 ColDeleteOp 接口

```typescript
export interface ColDeleteOp extends BaseOperation {
  type: 'colDelete';
  colIndex: number; // 删除起始列（非负整数，从 0 开始）
  count: number;    // 删除列数（正整数 > 0）
}
```

### 1.4 更新 CollabOperation 联合类型

```typescript
export type CollabOperation =
  | /* 现有类型 */
  | ColInsertOp
  | ColDeleteOp;
```

## 二、操作序列化（operations.ts）

### 2.1 更新 VALID_OPERATION_TYPES

```typescript
const VALID_OPERATION_TYPES: ReadonlySet<OperationType> = new Set([
  /* 现有类型 */
  'colInsert',
  'colDelete',
]);
```

### 2.2 反序列化校验

在 `deserializeOperation` 中新增两个 case：

```typescript
case 'colInsert': {
  const op = parsed as ColInsertOp;
  if (typeof op.colIndex !== 'number' || op.colIndex < 0 || !Number.isInteger(op.colIndex)) throw ...;
  if (typeof op.count !== 'number' || op.count <= 0 || !Number.isInteger(op.count)) throw ...;
  return op;
}
case 'colDelete': {
  // 同上
}
```

### 2.3 invertOperation 扩展

```typescript
// ColInsert 的反向操作是 ColDelete
case 'colInsert':
  return { ...op, type: 'colDelete' } as ColDeleteOp;

// ColDelete 的反向操作是 ColInsert
case 'colDelete':
  return { ...op, type: 'colInsert' } as ColInsertOp;
```

## 三、OT 转换引擎（ot.ts）

### 3.1 新增辅助函数

```typescript
// 判断列是否在删除范围内
const isColInDeleteRange = (col: number, deleteOp: ColDeleteOp): boolean =>
  col >= deleteOp.colIndex && col < deleteOp.colIndex + deleteOp.count;

// 根据列插入操作调整列索引
const adjustColForInsert = (col: number, insertOp: ColInsertOp): number =>
  col >= insertOp.colIndex ? col + insertOp.count : col;

// 根据列删除操作调整列索引，返回 null 表示该列被删除
const adjustColForDelete = (col: number, deleteOp: ColDeleteOp): number | null => {
  if (isColInDeleteRange(col, deleteOp)) return null;
  if (col >= deleteOp.colIndex + deleteOp.count) return col - deleteOp.count;
  return col;
};
```

### 3.2 转换矩阵（30 个新转换规则）

#### opB = ColInsert（13 个转换）

| opA 类型 | 转换逻辑 |
|---------|---------|
| cellEdit | col >= colIndex → col += count |
| cellMerge | startCol/endCol 分别调整（穿过时仅 endCol 增加） |
| cellSplit | col >= colIndex → col += count（rowSpan/colSpan 不变） |
| colResize | colIndex >= colIndex → colIndex += count |
| rowInsert | 返回 opA 克隆（行列独立） |
| rowDelete | 返回 opA 克隆（行列独立） |
| rowResize | 返回 opA 克隆（行列独立） |
| colInsert | colIndex > opB.colIndex → colIndex += count |
| colDelete | colIndex > opB.colIndex → colIndex += count |
| fontColor/bgColor/fontSize/fontBold/fontItalic/fontUnderline/fontAlign/verticalAlign | col >= colIndex → col += count |

**cellMerge vs ColInsert 的详细逻辑：**
```
if startCol >= colIndex:
    startCol += count; endCol += count
elif endCol < colIndex:
    不变
else (startCol < colIndex <= endCol):
    startCol 不变; endCol += count  // 合并区域被穿过，向右扩展
```

#### opB = ColDelete（13 个转换）

| opA 类型 | 转换逻辑 |
|---------|---------|
| cellEdit | col 在删除范围内 → null；col >= colIndex+count → col -= count |
| cellMerge | 见下方详细逻辑 |
| cellSplit | col 在删除范围内 → null；col >= colIndex+count → col -= count（rowSpan/colSpan 不变） |
| colResize | colIndex 在删除范围内 → null；colIndex >= colIndex+count → colIndex -= count |
| rowInsert | 返回 opA 克隆 |
| rowDelete | 返回 opA 克隆 |
| rowResize | 返回 opA 克隆 |
| colInsert | colIndex > colIndex+count → colIndex -= count；colIndex 在范围内 → colIndex = opB.colIndex |
| colDelete | 见下方详细逻辑 |
| 样式操作 | col 在删除范围内 → null；col >= colIndex+count → col -= count |

**cellMerge vs ColDelete 的详细逻辑：**
```
设 delEnd = opB.colIndex + opB.count

// 完全在删除范围内
if startCol >= opB.colIndex && endCol < delEnd → null

// 左侧部分重叠（合并区域被截断）
if startCol < opB.colIndex && endCol >= opB.colIndex && endCol < delEnd → null

// 右侧部分重叠（合并区域被截断）
if startCol >= opB.colIndex && startCol < delEnd && endCol >= delEnd → null

// 删除范围完全在合并区域内部（合并区域收缩）
if startCol < opB.colIndex && delEnd <= endCol:
    endCol -= count

// 合并区域完全在删除范围右侧
if startCol >= delEnd:
    startCol -= count; endCol -= count

// 合并区域完全在删除范围左侧
if endCol < opB.colIndex → 不变
```

**colDelete vs ColDelete 的详细逻辑（需用原始值计算）：**
```
设 origColIndex = opA.colIndex, origCount = opA.count
设 delEnd = opB.colIndex + opB.count

// opA 完全在 opB 之后
if origColIndex >= delEnd:
    colIndex -= opB.count

// opA 完全在 opB 之前
if origColIndex + origCount <= opB.colIndex:
    不变

// opA 与 opB 前部分重叠
if origColIndex < opB.colIndex && origColIndex + origCount > opB.colIndex && origColIndex + origCount <= delEnd:
    count = opB.colIndex - origColIndex

// opA 与 opB 后部分重叠
if origColIndex >= opB.colIndex && origColIndex < delEnd && origColIndex + origCount > delEnd:
    newCount = origColIndex + origCount - delEnd
    colIndex = opB.colIndex
    count = newCount

// opA 完全在 opB 内部
if origColIndex >= opB.colIndex && origColIndex + origCount <= delEnd → null

// opA 完全包含 opB
if origColIndex < opB.colIndex && origColIndex + origCount > delEnd:
    count -= opB.count
```

#### opB = ColInsert/ColDelete，opA = ColInsert（2 个转换）

```
// colInsert vs colInsert
if opA.colIndex > opB.colIndex → colIndex += opB.count
else → 不变

// colInsert vs colDelete
if opA.colIndex > opB.colIndex + opB.count → colIndex -= opB.count
elif opA.colIndex <= opB.colIndex → 不变
else (在删除范围内) → colIndex = opB.colIndex
```

### 3.3 修改 transformSingle 函数

**移除现有的 colResize 短路判断**，改为在各 opB 分支中正确处理 colResize：

```typescript
// 删除这段短路逻辑：
// if (opA.type === 'colResize' || opB.type === 'colResize') {
//   return cloneOp(opA);
// }

// 新增 opB = colInsert 分支
if (opB.type === 'colInsert') {
  switch (opA.type) {
    case 'cellEdit': return transformCellEditVsColInsert(opA, opB);
    case 'cellMerge': return transformCellMergeVsColInsert(opA, opB);
    case 'cellSplit': return transformCellSplitVsColInsert(opA, opB);
    case 'colResize': return transformColResizeVsColInsert(opA, opB);
    case 'rowInsert': return cloneOp(opA);
    case 'rowDelete': return cloneOp(opA);
    case 'rowResize': return cloneOp(opA);
    case 'colInsert': return transformColInsertVsColInsert(opA, opB);
    case 'colDelete': return transformColDeleteVsColInsert(opA, opB);
    case 'fontColor': return transformFontColorVsColInsert(opA, opB);
    // ... 其余样式操作
  }
}

// 新增 opB = colDelete 分支（结构相同）
if (opB.type === 'colDelete') { ... }

// 保留 colResize 作为 opB 时的处理（opA 不受 colResize 影响）
if (opB.type === 'colResize') {
  return cloneOp(opA);
}
```

## 四、模型层（model.ts）

### 4.1 insertColumns(colIndex, count)

```typescript
public insertColumns(colIndex: number, count: number): boolean {
  // 参数校验
  if (colIndex < 0 || colIndex > this.getColCount() || count <= 0) return false;

  // 每行插入空单元格
  for (const row of this.data.cells) {
    const newCells = Array.from({ length: count }, () => ({
      content: '', rowSpan: 1, colSpan: 1, isMerged: false
    }));
    row.splice(colIndex, 0, ...newCells);
  }

  // 插入默认列宽
  this.data.colWidths.splice(colIndex, 0, ...Array(count).fill(DEFAULT_COL_WIDTH));

  // 更新合并/拆分单元格引用
  this.updateMergeReferencesAfterInsertCols(colIndex, count);

  this.clearAllCache();
  this.isDirty = true;
  return true;
}
```

**updateMergeReferencesAfterInsertCols 逻辑：**
- 遍历所有合并单元格，调整 startCol/endCol（与 cellMerge vs colInsert 转换逻辑一致）
- 遍历所有拆分单元格，调整 col（col >= colIndex → col += count）

### 4.2 deleteColumns(colIndex, count)

```typescript
public deleteColumns(colIndex: number, count: number): boolean {
  // 参数校验
  if (colIndex < 0 || colIndex >= this.getColCount() || count <= 0) return false;
  const actualCount = Math.min(count, this.getColCount() - colIndex);
  if (this.getColCount() - actualCount < 1) return false;

  // 先处理受影响的合并/拆分单元格
  this.splitMergedCellsInCols(colIndex, actualCount);

  // 每行删除指定列范围
  for (const row of this.data.cells) {
    row.splice(colIndex, actualCount);
  }

  // 删除列宽
  this.data.colWidths.splice(colIndex, actualCount);

  // 更新合并/拆分单元格引用
  this.updateMergeReferencesAfterDeleteCols(colIndex, actualCount);

  this.clearAllCache();
  this.isDirty = true;
  return true;
}
```

## 五、后端 Java 实现

### 5.1 新增操作类（model 包）

**ColInsertOp.java** 和 **ColDeleteOp.java**，结构与 RowInsertOp/RowDeleteOp 对称：

```java
public class ColInsertOp extends CollabOperation {
    private int colIndex;
    private int count;
    // getter/setter
}
```

需在 `CollabOperation` 的 Jackson 多态配置中注册新类型：
```java
@JsonSubTypes({
    // 现有类型...
    @JsonSubTypes.Type(value = ColInsertOp.class, name = "colInsert"),
    @JsonSubTypes.Type(value = ColDeleteOp.class, name = "colDelete"),
})
```

### 5.2 OTTransformer.java 扩展

新增辅助方法（与前端对称）：
```java
private static boolean isColInDeleteRange(int col, ColDeleteOp deleteOp) { ... }
private static int adjustColForInsert(int col, ColInsertOp insertOp) { ... }
private static Integer adjustColForDelete(int col, ColDeleteOp deleteOp) { ... }
```

新增 30 个转换方法，命名规范与现有行操作一致：
```java
// 示例
private static CellEditOp transformCellEditVsColInsert(CellEditOp op, ColInsertOp insertOp) {
    CellEditOp result = cloneOp(op);
    result.setCol(adjustColForInsert(op.getCol(), insertOp));
    return result;
}
```

在 `transformSingle` 方法中新增两个 if 分支（opB instanceof ColInsertOp / ColDeleteOp），并移除 colResize 的短路判断。

### 5.3 DocumentApplier.java 扩展

```java
// 在 apply() 方法中新增
} else if (op instanceof ColInsertOp) {
    applyColInsert(cells, colWidths, (ColInsertOp) op);
} else if (op instanceof ColDeleteOp) {
    applyColDelete(cells, colWidths, (ColDeleteOp) op);
}

private static void applyColInsert(List<List<Cell>> cells, List<Integer> colWidths, ColInsertOp op) {
    // 每行插入空单元格
    for (List<Cell> row : cells) {
        for (int i = 0; i < op.getCount(); i++) {
            row.add(op.getColIndex(), new Cell());
        }
    }
    // 插入默认列宽
    for (int i = 0; i < op.getCount(); i++) {
        colWidths.add(op.getColIndex(), DEFAULT_COL_WIDTH);
    }
    // 更新合并/拆分单元格引用
}

private static void applyColDelete(List<List<Cell>> cells, List<Integer> colWidths, ColDeleteOp op) {
    // 每行删除指定列范围
    for (List<Cell> row : cells) {
        for (int i = 0; i < op.getCount(); i++) {
            if (op.getColIndex() < row.size()) row.remove(op.getColIndex());
        }
    }
    // 删除列宽
    for (int i = 0; i < op.getCount(); i++) {
        if (op.getColIndex() < colWidths.size()) colWidths.remove(op.getColIndex());
    }
    // 更新合并/拆分单元格引用
}
```

## 六、测试设计

### 6.1 单元测试（src/collaboration/__tests__/）

新增测试文件 `col-operations.test.ts`，覆盖：

- **类型校验**：ColInsertOp/ColDeleteOp 的序列化/反序列化/字段校验
- **30 个转换规则**：每个转换函数至少 3 个测试用例（正常、边界、null 返回）
- **invertOperation**：列操作的反向操作正确性
- **收敛性属性测试**：随机生成操作对，验证 `apply(apply(doc, opA), transform(opB, opA)) === apply(apply(doc, opB), transform(opA, opB))`

### 6.2 关键边界测试用例

```typescript
// cellMerge vs colInsert：插入点穿过合并区域
// 合并区域 [2,5]，在列 3 插入 2 列 → [2,7]
expect(transform(merge(2,5), colInsert(3,2))).toEqual(merge(2,7));

// cellMerge vs colDelete：删除范围完全在合并区域内
// 合并区域 [1,6]，删除列 2-4 → [1,3]
expect(transform(merge(1,6), colDelete(2,3))).toEqual(merge(1,3));

// colDelete vs colDelete：部分重叠
// 删除 [2,5]，已删除 [3,6] → 删除 [2,2]（仅保留未被删除的部分）
expect(transform(colDelete(2,4), colDelete(3,4))).toEqual(colDelete(2,1));
```

### 6.3 Java 后端测试

在 `CoreAlgorithmSmokeTest.java` 中新增列操作的烟雾测试，验证前后端转换结果一致。

## 七、实现顺序

1. **types.ts** — 新增 ColInsertOp、ColDeleteOp 类型（无依赖）
2. **operations.ts** — 新增序列化/反序列化/invertOperation（依赖 types.ts）
3. **ot.ts** — 新增 30 个转换函数，修改 transformSingle（依赖 types.ts）
4. **model.ts** — 新增 insertColumns/deleteColumns（独立）
5. **Java 模型类** — ColInsertOp.java、ColDeleteOp.java（独立）
6. **OTTransformer.java** — 新增转换方法（依赖 Java 模型类）
7. **DocumentApplier.java** — 新增应用逻辑（依赖 Java 模型类）
8. **测试** — 单元测试和集成测试（依赖所有实现）

## 八、关键设计决策

### 8.1 colResize 短路判断的修改

现有代码中 `transformSingle` 对 `colResize` 有短路判断（直接返回 opA 克隆），这在 opB 是 colInsert/colDelete 时是错误的——colResize 的 colIndex 需要被调整。修改方案：

- 移除短路判断
- 在 opB = colInsert/colDelete 分支中正确处理 colResize
- 保留 opB = colResize 时返回 opA 克隆的逻辑（colResize 不影响其他操作）

### 8.2 rowSpan/colSpan 在列操作中保持不变

CellSplitOp 的 rowSpan/colSpan 是历史快照（记录拆分前合并单元格的原始范围），不代表当前文档结构，因此列操作不应修改这些字段。

### 8.3 合并单元格部分重叠时返回 null

当列删除操作部分删除合并单元格时（合并区域被截断），无法保持合并区域的有效性，因此返回 null 丢弃该合并操作。这与行删除操作的处理方式一致。

### 8.4 前后端对称性

Java 后端的转换逻辑必须与 TypeScript 前端完全一致，通过属性测试验证收敛性。
