---
inclusion: fileMatch
fileMatchPattern: "src/data-manager.ts,src/model.ts"
---

# 数据持久化规范

## JSON 数据格式

### 完整格式（exportToJSON / importFromJSON）
```json
{
  "cells": [[Cell, Cell, ...], ...],
  "rowHeights": [number, ...],
  "colWidths": [number, ...],
  "rowCount": number,
  "colCount": number
}
```
- 包含所有单元格数据、行高、列宽
- 适用于完整备份和恢复

### 简化格式（exportSimpleJSON / importFromSimpleJSON）
```json
{
  "data": [["A1", "B1", ...], ["A2", "B2", ...], ...]
}
```
- 仅包含单元格文本内容的二维数组
- 适用于与其他系统交换数据

## 存储方式

### 文件导出
- 使用 `Blob` + `URL.createObjectURL()` 创建下载链接
- 文件名格式：`spreadsheet-{日期}.json` 或 `spreadsheet-simple-{日期}.json`
- 下载完成后必须调用 `URL.revokeObjectURL()` 释放资源

### 文件导入
- 使用 `<input type="file" accept=".json">` 选择文件
- 通过 `FileReader.readAsText()` 读取内容
- 返回 `Promise<boolean>` 表示导入是否成功

### 本地存储
- 默认 key：`spreadsheet-data`
- 存储完整格式 JSON
- 注意 localStorage 容量限制（通常 5MB）

### URL 导入
- 使用 `fetch()` 获取远程 JSON
- 需处理网络错误和 HTTP 状态码

## 导入后处理
- 导入成功后需调用 `renderer.render()` 重绘
- 需调用 `updateScrollbars()` 更新滚动条
- 需调用 `updateStatusBar()` 更新状态栏
- 历史记录应在导入后清空（`historyManager.clear()`）

## 错误处理
- JSON 解析失败时返回 `false`，不修改现有数据
- 文件读取错误时在控制台输出错误信息
- 所有导入方法都应有 try-catch 保护
