---
name: formatter
description: ice-excel 代码格式化工具，统一代码风格
---

# 代码格式化 Skill

使用此 skill 来统一项目代码格式，确保代码风格一致。

## 命令

### 格式化所有文件
格式化 src 目录下所有 TypeScript 和 CSS 文件。
```bash
npx vite-node skills/formatter/format.ts all
```

### 格式化单个文件
格式化指定的文件。
```bash
npx vite-node skills/formatter/format.ts file <filepath>
```

示例：
```bash
npx vite-node skills/formatter/format.ts file src/app.ts
```

### 检查格式
检查文件格式问题，不修改文件。适合在 CI 中使用。
```bash
npx vite-node skills/formatter/format.ts check
```

### 格式化 JSON
格式化 JSON 文件，统一缩进为 2 空格。
```bash
npx vite-node skills/formatter/format.ts json <filepath>
```

示例：
```bash
npx vite-node skills/formatter/format.ts json public/example-data.json
```

## 格式化规则

| 规则 | 说明 |
|------|------|
| 换行符 | 统一使用 LF（\n） |
| 行尾空格 | 自动移除 |
| 文件末尾 | 保留且仅保留一个换行 |
| 连续空行 | 最多保留两个 |

## 使用场景

| 场景 | 命令 |
|------|------|
| 提交前格式化 | `all` |
| CI 检查 | `check` |
| 修改单个文件后 | `file <path>` |
| 整理数据文件 | `json <path>` |

## 注意事项
- 格式化会直接修改文件，建议先提交或备份
- `check` 命令发现问题时会返回非零退出码
- 不会修改 node_modules 或其他目录的文件
