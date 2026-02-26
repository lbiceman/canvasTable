---
name: devTools
description: ice-excel 开发调试工具，提供测试数据生成、文件分析、类型检查等功能
---

# 开发调试工具 Skill

使用此 skill 来辅助 ice-excel 项目的开发、测试和调试工作。

## 命令

### 生成测试数据
生成指定行列数的测试数据 JSON，用于性能测试或功能验证。
```bash
npx vite-node skills/devTools/dev-tools.ts generate [rows] [cols]
```

示例：生成 1000 行 50 列的测试数据
```bash
npx vite-node skills/devTools/dev-tools.ts generate 1000 50 > public/test-large.json
```

### 分析数据文件
分析 JSON 数据文件的结构，显示行列数、格式类型、合并单元格数量等信息。
```bash
npx vite-node skills/devTools/dev-tools.ts analyze <file.json>
```

示例：
```bash
npx vite-node skills/devTools/dev-tools.ts analyze public/example-data.json
```

### TypeScript 类型检查
运行 TypeScript 编译器检查类型错误，不生成输出文件。
```bash
npx vite-node skills/devTools/dev-tools.ts check
```

### 代码行数统计
统计 src 目录下所有 TypeScript 文件的代码行数。
```bash
npx vite-node skills/devTools/dev-tools.ts lines
```

## 使用场景

| 场景 | 命令 |
|------|------|
| 测试大数据量渲染性能 | `generate 10000 100` |
| 检查导入文件格式是否正确 | `analyze <file>` |
| 提交前检查类型错误 | `check` |
| 了解项目代码规模 | `lines` |

## 注意事项
- 需要安装 vite-node: `npm i -D vite-node`
- generate 命令输出到 stdout，使用 `>` 重定向到文件
- 大数据量测试建议先用 1000 行验证，再逐步增加
