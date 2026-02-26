---
inclusion: fileMatch
fileMatchPattern: "src/renderer.ts"
---

# Canvas 渲染规范

## 渲染流程
- 所有绘制操作通过 `SpreadsheetRenderer.render()` 统一调度，按固定顺序执行：
  1. 清除画布 → 背景 → 高亮行/列 → 单元格内容 → 网格线 → 选区 → 行标题 → 列标题 → 左上角
- 修改渲染逻辑时必须维护此绘制顺序，标题层始终在单元格之上

## 视口与虚拟滚动
- 只渲染 `viewport` 范围内的可见单元格，不要遍历全量数据
- 所有坐标计算必须减去 `scrollX`/`scrollY` 偏移量，并加上 `headerWidth`/`headerHeight`
- 接近数据边界时自动扩展行列（行剩余 < 50 扩展 500，列剩余 < 10 扩展 50）

## 合并单元格绘制
- 绘制单元格时通过 `getMergedCellInfo()` 获取合并信息
- 只在合并区域的左上角单元格（`cellInfo.row === row && cellInfo.col === col`）绘制内容
- 合并区域内部的网格线需要通过 `horizontalBorders`/`verticalBorders` 数组标记跳过

## 裁剪区域
- 单元格内容和网格线绘制前必须设置 `ctx.clip()` 裁剪到数据区域，防止绘制到标题区域
- 使用 `ctx.save()` / `ctx.restore()` 配对管理裁剪状态

## 主题适配
- 所有颜色从 `themeColors` 对象读取，不要硬编码颜色值
- 单元格自定义颜色（`fontColor`/`bgColor`）优先于主题颜色
