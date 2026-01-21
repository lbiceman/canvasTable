# Canvas Excel 使用文档

一个基于 Canvas 的高性能电子表格应用，支持无限滚动、单元格合并、主题切换和数据导入导出。

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 基本操作

### 单元格选择

- 单击单元格：选中单个单元格
- 拖拽选择：按住鼠标拖动可选择多个单元格
- 点击行号：选中整行
- 点击列号：选中整列

### 编辑单元格

1. 双击单元格进入编辑模式
2. 输入内容后按 Enter 确认
3. 或使用顶部工具栏的输入框编辑选中单元格内容

### 滚动浏览

- 鼠标滚轮：垂直滚动
- Shift + 滚轮：水平滚动
- 拖拽滚动条：快速定位
- 支持无限滚动，数据按需加载

## 单元格合并与拆分

### 合并单元格

1. 选择要合并的多个单元格
2. 点击工具栏的「合并」按钮
3. 合并后只保留左上角单元格的内容

### 拆分单元格

1. 选中已合并的单元格
2. 点击工具栏的「拆分」按钮
3. 拆分后只有左上角单元格保留原内容

## 数据管理

点击右上角「更多」按钮打开控制面板。

### 导出数据

- 导出完整数据：包含合并信息、行高列宽等完整格式
- 导出简化数据：仅导出单元格内容（A1 格式）

### 导入数据

- 导入完整数据：支持完整格式的 JSON 文件
- 导入简化数据：支持简化格式的 JSON 文件

### 本地存储

- 保存到本地：将数据保存到浏览器本地存储
- 从本地加载：从浏览器本地存储恢复数据

### 其他操作

- 查看统计：显示表格统计信息
- 清空数据：清除所有单元格内容
- 加载示例数据：加载预置的示例数据

## 主题设置

在控制面板中可切换主题：

- ☀️ 浅色主题：适合日间使用
- 🌙 深色主题：适合夜间使用

## 数据格式

### 完整格式

```json
{
  "version": "1.0",
  "timestamp": "2025-01-21T00:00:00.000Z",
  "metadata": {
    "rowCount": 1000,
    "colCount": 26,
    "defaultRowHeight": 25,
    "defaultColWidth": 100
  },
  "data": {
    "cells": [
      {
        "row": 0,
        "col": 0,
        "content": "标题",
        "rowSpan": 1,
        "colSpan": 2,
        "isMerged": false
      }
    ],
    "rowHeights": [],
    "colWidths": []
  }
}
```

### 简化格式

```json
{
  "A1": "姓名",
  "B1": "年龄",
  "A2": "张三",
  "B2": "28"
}
```

## 键盘快捷键

| 操作 | 快捷键 |
|------|--------|
| 确认输入 | Enter |
| 水平滚动 | Shift + 滚轮 |

## API 接口

应用实例暴露在 `window.app`，可在控制台调用：

```javascript
// 导出数据
app.exportToFile('my-data.json')

// 获取统计信息
app.getStatistics()

// 清空数据
app.clearAllData()

// 设置单元格内容
app.getModel().setCellContent(0, 0, '内容')

// 合并单元格 (行0-1, 列0-1)
app.getModel().mergeCells(0, 0, 1, 1)

// 从 URL 导入数据
app.importFromURL('/example-data.json')
```

## 技术特性

- 基于 Canvas 渲染，支持大数据量
- 虚拟滚动，仅渲染可见区域
- 支持最大 100 万行 × 16384 列
- TypeScript 类型安全
- Vite 构建，热更新开发

## 项目结构

```
src/
├── main.ts          # 应用入口
├── app.ts           # 主应用类
├── model.ts         # 数据模型
├── renderer.ts      # Canvas 渲染器
├── inline-editor.ts # 内联编辑器
├── data-manager.ts  # 数据导入导出
├── ui-controls.ts   # UI 控制面板
├── types.ts         # 类型定义
├── themes.json      # 主题配置
└── style.css        # 样式文件
```
