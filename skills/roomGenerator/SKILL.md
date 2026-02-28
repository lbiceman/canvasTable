---
name: roomGenerator
description: 生成协作房间 JSON 数据文件，用于初始化 server/data 目录下的房间数据
---

# 房间数据生成器 Skill

使用此 skill 生成符合 `room_xxx.json` 格式的协作房间数据文件，存放到 `server/data/` 目录。

## 使用方式

运行脚本时需要提供文件名（不含 `room_` 前缀和 `.json` 后缀），脚本会交互式询问生成参数。

### 生成房间数据
```bash
npx vite-node skills/roomGenerator/generate-room.ts <roomName>
```

示例：
```bash
npx vite-node skills/roomGenerator/generate-room.ts demo
```
将生成 `server/data/room_demo.json`。

### 可选参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--rows` | 数据行数（不含表头） | 10 |
| `--cols` | 列数 | 10 |
| `--theme` | 主题色 (`blue`/`green`/`orange`/`purple`) | `blue` |
| `--empty` | 生成空白表格 | false |

### 带参数示例
```bash
# 生成 20 行 8 列、绿色主题的房间数据
npx vite-node skills/roomGenerator/generate-room.ts myroom --rows 20 --cols 8 --theme green

# 生成空白表格
npx vite-node skills/roomGenerator/generate-room.ts blank --empty --rows 30 --cols 26
```

## 生成内容说明

- 表头行：带有主题色背景和白色字体
- 数据行：奇偶行交替背景色
- 单元格结构与 `room_test.json` 格式完全一致
- 自动生成 `rowHeights` 和 `colWidths` 默认值
- `operations` 为空数组，`revision` 为 0

## 使用场景

| 场景 | 命令 |
|------|------|
| 快速创建测试房间 | `generate-room.ts test2` |
| 创建大数据量房间 | `generate-room.ts big --rows 100 --cols 20` |
| 创建空白协作房间 | `generate-room.ts new --empty` |
| 创建带主题的演示房间 | `generate-room.ts demo --theme purple --rows 15` |

## 注意事项
- 如果目标文件已存在，会提示是否覆盖
- roomName 只允许英文字母、数字和下划线
- 需要安装 vite-node: `npm i -D vite-node`
