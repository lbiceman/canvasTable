# 合并单元格冲突解决 - 待办事项

本文档仅包含尚未实现的部分。设计方案的核心改动（数据模型扩展、转换函数、transformSingle 更新、invertOperation、操作提交逻辑）已全部实现完毕。

---

## 一、遗留 Bug 修复：CellMerge 分支缺少 fontAlign 处理

`transformSingle` 中 `opB === 'cellMerge'` 分支处理了 fontColor、bgColor、fontSize、fontBold、fontItalic、fontUnderline、verticalAlign 在合并区域内的重定向，但遗漏了 `fontAlign`。前后端均需修复。

### 1.1 TypeScript 端 `src/collaboration/ot.ts`

在 `transformSingle` 的 `opB.type === 'cellMerge'` 分支中，`case 'fontUnderline'` 之后、`case 'verticalAlign'` 之前增加：

```typescript
case 'fontAlign': {
  const result = cloneOp(opA);
  if (
    opA.row >= opB.startRow &&
    opA.row <= opB.endRow &&
    opA.col >= opB.startCol &&
    opA.col <= opB.endCol
  ) {
    result.row = opB.startRow;
    result.col = opB.startCol;
  }
  return result;
}
```

### 1.2 Java 端 `OTTransformer.java`

在 `transformSingle` 的 `opB instanceof CellMergeOp` 分支中，`FontUnderlineOp` 之后、`VerticalAlignOp` 之前增加：

```java
if (opA instanceof FontAlignOp) {
    FontAlignOp result = cloneOp((FontAlignOp) opA);
    if (isInMergeRange(result.getRow(), result.getCol(), mergeOp)) {
        result.setRow(mergeOp.getStartRow());
        result.setCol(mergeOp.getStartCol());
    }
    return result;
}
```

---

## 二、测试

### 测试框架

- TypeScript 端：vitest + fast-check（PBT）
- Java 端：JUnit 5
- 测试文件位置：
  - TS 单元测试：`src/collaboration/__tests__/ot.test.ts`（追加到现有文件）
  - TS PBT 测试：`src/collaboration/__tests__/ot-cellsplit.pbt.test.ts`（新建）
  - Java 单元测试：`javaServer/src/test/java/com/iceexcel/server/service/CoreAlgorithmSmokeTest.java`（追加到现有文件）

### 运行命令

```bash
# TypeScript 端
npx vitest run src/collaboration/__tests__/ot.test.ts
npx vitest run src/collaboration/__tests__/ot-cellsplit.pbt.test.ts

# Java 端
cd javaServer
mvn test -Dtest=CoreAlgorithmSmokeTest
```

---

### 2.1 TypeScript 单元测试

在 `ot.test.ts` 中追加以下 describe 块。使用现有的 `base`/`baseB` 常量和 `transform` 导入。

需要额外导入：
```typescript
import { CellSplitOp, FontBoldOp, FontColorOp, FontAlignOp } from '../types';
```

#### CellEdit vs CellSplit

```
describe('transform - CellEdit vs CellSplit')

测试 1：编辑在拆分区域内 → 重定向到左上角
  opA = CellEdit(row=1, col=1, content="hello", previousContent="")
  opB = CellSplit(row=0, col=0, rowSpan=3, colSpan=3)
  期望：aPrime.row === 0, aPrime.col === 0, aPrime.content === "hello"

测试 2：编辑在拆分区域外 → 不受影响
  opA = CellEdit(row=5, col=5, content="hello", previousContent="")
  opB = CellSplit(row=0, col=0, rowSpan=3, colSpan=3)
  期望：aPrime.row === 5, aPrime.col === 5

测试 3：编辑恰好在拆分区域边界上 → 重定向
  opA = CellEdit(row=2, col=2, content="edge", previousContent="")
  opB = CellSplit(row=0, col=0, rowSpan=3, colSpan=3)
  期望：aPrime.row === 0, aPrime.col === 0

测试 4：拆分 rowSpan/colSpan 为 1（非合并单元格）→ 仅主单元格匹配
  opA = CellEdit(row=0, col=0, content="x", previousContent="")
  opB = CellSplit(row=0, col=0, rowSpan=1, colSpan=1)
  期望：aPrime.row === 0, aPrime.col === 0（位置不变，因为就是左上角）

  opA = CellEdit(row=1, col=0, content="x", previousContent="")
  opB = CellSplit(row=0, col=0, rowSpan=1, colSpan=1)
  期望：aPrime.row === 1（不在范围内，不变）
```

#### CellMerge vs CellSplit

```
describe('transform - CellMerge vs CellSplit')

测试 1：合并区域与拆分区域重叠 → 合并失效
  opA = CellMerge(startRow=0, startCol=0, endRow=3, endCol=3)
  opB = CellSplit(row=1, col=1, rowSpan=2, colSpan=2)
  期望：aPrime === null

测试 2：合并区域与拆分区域不重叠 → 合并正常
  opA = CellMerge(startRow=5, startCol=5, endRow=7, endCol=7)
  opB = CellSplit(row=0, col=0, rowSpan=3, colSpan=3)
  期望：aPrime 不为 null，startRow/startCol/endRow/endCol 不变

测试 3：合并区域完全包含拆分区域 → 合并失效
  opA = CellMerge(startRow=0, startCol=0, endRow=5, endCol=5)
  opB = CellSplit(row=1, col=1, rowSpan=2, colSpan=2)
  期望：aPrime === null

测试 4：拆分区域完全包含合并区域 → 合并失效
  opA = CellMerge(startRow=1, startCol=1, endRow=2, endCol=2)
  opB = CellSplit(row=0, col=0, rowSpan=5, colSpan=5)
  期望：aPrime === null
```

#### CellSplit vs CellSplit

```
describe('transform - CellSplit vs CellSplit')

测试 1：同一位置 → 后者失效
  opA = CellSplit(row=0, col=0, rowSpan=3, colSpan=3)
  opB = CellSplit(row=0, col=0, rowSpan=3, colSpan=3)
  期望：aPrime === null, bPrime === null

测试 2：不同位置 → 互不影响
  opA = CellSplit(row=0, col=0, rowSpan=2, colSpan=2)
  opB = CellSplit(row=5, col=5, rowSpan=3, colSpan=3)
  期望：aPrime 不为 null，bPrime 不为 null，位置不变
```

#### CellSplit vs CellEdit

```
describe('transform - CellSplit vs CellEdit')

测试 1：拆分不受编辑影响
  opA = CellSplit(row=0, col=0, rowSpan=3, colSpan=3)
  opB = CellEdit(row=1, col=1, content="hello", previousContent="")
  期望：aPrime.row === 0, aPrime.col === 0, aPrime.rowSpan === 3
```

#### CellSplit vs CellMerge

```
describe('transform - CellSplit vs CellMerge')

测试 1：拆分位置在合并区域内 → 拆分失效
  opA = CellSplit(row=1, col=1, rowSpan=2, colSpan=2)
  opB = CellMerge(startRow=0, startCol=0, endRow=3, endCol=3)
  期望：aPrime === null

测试 2：拆分位置在合并区域外 → 拆分正常
  opA = CellSplit(row=5, col=5, rowSpan=2, colSpan=2)
  opB = CellMerge(startRow=0, startCol=0, endRow=3, endCol=3)
  期望：aPrime 不为 null，位置不变
```

#### 格式操作 vs CellSplit

```
describe('transform - StyleOp vs CellSplit')

测试 1：FontBold 在拆分区域内 → 重定向到左上角
  opA = FontBold(row=1, col=1, bold=true)
  opB = CellSplit(row=0, col=0, rowSpan=3, colSpan=3)
  期望：aPrime.row === 0, aPrime.col === 0, aPrime.bold === true

测试 2：FontColor 在拆分区域外 → 不受影响
  opA = FontColor(row=5, col=5, color="#FF0000")
  opB = CellSplit(row=0, col=0, rowSpan=3, colSpan=3)
  期望：aPrime.row === 5, aPrime.col === 5
```

#### FontAlign vs CellMerge（修复验证）

```
describe('transform - FontAlign vs CellMerge')

测试 1：FontAlign 在合并区域内 → 重定向到左上角
  opA = FontAlign(row=1, col=1, align='center')
  opB = CellMerge(startRow=0, startCol=0, endRow=2, endCol=2)
  期望：aPrime.row === 0, aPrime.col === 0, aPrime.align === 'center'

测试 2：FontAlign 在合并区域外 → 不受影响
  opA = FontAlign(row=5, col=5, align='right')
  opB = CellMerge(startRow=0, startCol=0, endRow=2, endCol=2)
  期望：aPrime.row === 5, aPrime.col === 5
```

#### invertOperation 更新验证

```
describe('invertOperation - CellMerge 反向操作携带范围')

测试 1：CellMerge 的反向操作是带 rowSpan/colSpan 的 CellSplit
  op = CellMerge(startRow=0, startCol=0, endRow=2, endCol=3)
  inv = invertOperation(op, model)
  期望：inv.type === 'cellSplit'
  期望：inv.row === 0, inv.col === 0
  期望：inv.rowSpan === 3, inv.colSpan === 4
```

---

### 2.2 TypeScript PBT 测试

新建文件 `src/collaboration/__tests__/ot-cellsplit.pbt.test.ts`。

#### OT 对称性（收敛性）

```
Property: 对于任意 CellSplit 和 CellEdit 操作对，
  transform(A, B) 和 transform(B, A) 都不会抛异常，
  且如果两者都不为 null，类型保持不变。

生成器：
  opA = arbitraryCellSplitOp()  // 已有
  opB = arbitraryCellEditOp()   // 已有

断言：
  const [aPrime, bPrime] = transform(opA, opB)
  // 不抛异常
  // 如果 aPrime 不为 null，则 aPrime.type === opA.type
  // 如果 bPrime 不为 null，则 bPrime.type === opB.type
```

#### CellSplit 幂等性

```
Property: 对于任意两个相同位置的 CellSplit，transform 后至少一个为 null

生成器：
  splitOp = arbitraryCellSplitOp()
  opB = { ...splitOp }  // 相同位置

断言：
  const [aPrime, bPrime] = transform(splitOp, opB)
  expect(aPrime === null || bPrime === null).toBe(true)
```

#### CellEdit 重定向一致性

```
Property: 对于任意 CellEdit 在 CellSplit 区域内，
  转换后的 editOp 的 row/col 等于 splitOp 的 row/col

生成器：
  splitOp = CellSplit(row, col, rowSpan >= 2, colSpan >= 2)
  editRow = row + offset (0 <= offset < rowSpan)
  editCol = col + offset (0 <= offset < colSpan)
  editOp = CellEdit(editRow, editCol, ...)

断言：
  const [aPrime] = transform(editOp, splitOp)
  expect(aPrime.row).toBe(splitOp.row)
  expect(aPrime.col).toBe(splitOp.col)
```

---

### 2.3 Java 单元测试

在 `CoreAlgorithmSmokeTest.java` 中追加以下测试方法。

#### CellSplitOp 序列化

```
@Test
void cellSplitOp_jsonRoundTrip_withSpan()
  op = new CellSplitOp("user1", 1000L, 1, 0, 0, 3, 3)
  序列化 → 反序列化
  期望：deserialized.equals(op)
  期望：deserialized.getRowSpan() == 3
  期望：deserialized.getColSpan() == 3

@Test
void cellSplitOp_jsonRoundTrip_defaultSpan()
  op = new CellSplitOp("user1", 1000L, 1, 0, 0)  // 使用旧构造函数
  序列化 → 反序列化
  期望：deserialized.getRowSpan() == 1
  期望：deserialized.getColSpan() == 1
```

#### OT 转换

```
@Test
void transform_cellEditVsCellSplit_redirectsToTopLeft()
  edit = new CellEditOp("user1", 1000L, 1, 1, 1, "hello", "")
  split = new CellSplitOp("user2", 1000L, 1, 0, 0, 3, 3)
  result = OTTransformer.transform(edit, split)
  期望：result[0] 不为 null
  期望：((CellEditOp) result[0]).getRow() == 0
  期望：((CellEditOp) result[0]).getCol() == 0

@Test
void transform_cellEditVsCellSplit_outsideRange_noChange()
  edit = new CellEditOp("user1", 1000L, 1, 5, 5, "hello", "")
  split = new CellSplitOp("user2", 1000L, 1, 0, 0, 3, 3)
  result = OTTransformer.transform(edit, split)
  期望：((CellEditOp) result[0]).getRow() == 5

@Test
void transform_cellMergeVsCellSplit_overlapping_returnsNull()
  merge = new CellMergeOp("user1", 1000L, 1, 0, 0, 3, 3)
  split = new CellSplitOp("user2", 1000L, 1, 1, 1, 2, 2)
  result = OTTransformer.transform(merge, split)
  期望：result[0] == null

@Test
void transform_cellMergeVsCellSplit_noOverlap_unchanged()
  merge = new CellMergeOp("user1", 1000L, 1, 5, 5, 7, 7)
  split = new CellSplitOp("user2", 1000L, 1, 0, 0, 3, 3)
  result = OTTransformer.transform(merge, split)
  期望：result[0] 不为 null

@Test
void transform_cellSplitVsCellSplit_samePosition_returnsNull()
  splitA = new CellSplitOp("user1", 1000L, 1, 0, 0, 3, 3)
  splitB = new CellSplitOp("user2", 1000L, 1, 0, 0, 3, 3)
  result = OTTransformer.transform(splitA, splitB)
  期望：result[0] == null
  期望：result[1] == null

@Test
void transform_cellSplitVsCellMerge_insideMerge_returnsNull()
  split = new CellSplitOp("user1", 1000L, 1, 1, 1, 2, 2)
  merge = new CellMergeOp("user2", 1000L, 1, 0, 0, 3, 3)
  result = OTTransformer.transform(split, merge)
  期望：result[0] == null

@Test
void transform_fontColorVsCellSplit_redirectsToTopLeft()
  fontColor = new FontColorOp("user1", 1000L, 1, 1, 1, "#FF0000")
  split = new CellSplitOp("user2", 1000L, 1, 0, 0, 3, 3)
  result = OTTransformer.transform(fontColor, split)
  期望：((FontColorOp) result[0]).getRow() == 0
  期望：((FontColorOp) result[0]).getCol() == 0

@Test
void transform_fontAlignVsCellMerge_redirectsToTopLeft()
  fontAlign = new FontAlignOp("user1", 1000L, 1, 1, 1, "center")
  merge = new CellMergeOp("user2", 1000L, 1, 0, 0, 2, 2)
  result = OTTransformer.transform(fontAlign, merge)
  期望：((FontAlignOp) result[0]).getRow() == 0
  期望：((FontAlignOp) result[0]).getCol() == 0
```

#### DocumentApplier 兼容性

```
@Test
void apply_cellSplit_withSpanFields_worksCorrectly()
  doc = createSmallDoc(5, 5)
  // 先合并
  DocumentApplier.apply(doc, new CellMergeOp("user1", 1000L, 1, 0, 0, 2, 2))
  // 再拆分（带 rowSpan/colSpan）
  DocumentApplier.apply(doc, new CellSplitOp("user1", 2000L, 2, 0, 0, 3, 3))
  期望：doc.getCells().get(0).get(0).getRowSpan() == 1
  期望：doc.getCells().get(0).get(0).getColSpan() == 1
  期望：doc.getCells().get(1).get(1).isMerged() == false
```

---

### 2.4 端到端一致性验证

手动或通过脚本对比前后端转换结果：

```
场景 1：编辑 vs 拆分
  输入：CellEdit(1,1,"hello","") + CellSplit(0,0,3,3)
  TS 端 transform 结果 vs Java 端 transform 结果
  期望：两端 aPrime.row/col 相同

场景 2：合并 vs 拆分（重叠）
  输入：CellMerge(0,0,3,3) + CellSplit(1,1,2,2)
  期望：两端 aPrime 都为 null

场景 3：拆分 vs 拆分（同位置）
  输入：CellSplit(0,0,3,3) + CellSplit(0,0,3,3)
  期望：两端 aPrime 和 bPrime 都为 null
```
