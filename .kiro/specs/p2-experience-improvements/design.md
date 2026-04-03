# P2 体验完善 - 设计文档

## 现状分析

经过代码审查，以下需求已在现有代码中实现：
- **US-1 工具栏状态同步**：`updateSelectedCellInfo()` 已同步加粗/斜体/下划线/删除线/对齐/字号/颜色选择器
- **US-4 冻结窗格 UI**：工具栏已有冻结下拉选择器，需添加冻结状态视觉反馈
- **US-5 名称框交互**：`handleNameBoxEntry()` 已实现地址/范围跳转
- **US-6 打印预览**：`PrintPreviewDialog` 已实现分页预览和页眉页脚

## 需要新增/修改的功能

### 1. 右键菜单补全（修改 cell-context-menu.ts + app.ts）
- 在 `CellContextMenuCallbacks` 接口添加 `onInsertComment`、`onFormatCells` 回调
- 在 `buildMenuItems()` 中添加"插入批注"、"设置单元格格式"菜单项
- "选择性粘贴"已存在

### 2. 单元格格式对话框（新建 src/format-dialog.ts）
- 创建 `FormatDialog` 类，使用纯 DOM 构建选项卡式对话框
- 5 个选项卡：数字格式、对齐、字体、边框、填充
- 通过回调将设置应用到选中单元格
- 在 app.ts 中集成：Ctrl+1 和右键菜单"设置单元格格式"均打开此对话框

### 3. 键盘快捷键补全（修改 app.ts handleKeyDown）
- Ctrl+B：切换加粗
- Ctrl+I：切换斜体
- Ctrl+U：切换下划线
- Ctrl+1：打开格式对话框
- Ctrl+;：插入当前日期

### 4. 冻结窗格状态反馈（修改 app.ts）
- 冻结激活时，冻结按钮添加 active 类高亮

### 5. 批注功能（修改 types.ts + model.ts + renderer.ts + app.ts）
- Cell 接口添加 `comment` 字段
- Model 添加 `setCellComment` / `getCellComment` 方法
- Renderer 在有批注的单元格右上角绘制红色三角标记
- App 添加批注输入对话框

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| src/types.ts | 修改 | Cell 接口添加 comment 字段 |
| src/model.ts | 修改 | 添加批注相关方法 |
| src/renderer.ts | 修改 | 绘制批注标记三角 |
| src/cell-context-menu.ts | 修改 | 添加菜单项和回调 |
| src/format-dialog.ts | 新建 | 单元格格式对话框 |
| src/app.ts | 修改 | 集成格式对话框、快捷键、批注、冻结状态 |
| src/style.css | 修改 | 格式对话框样式、冻结按钮高亮样式 |

## 技术方案

### 格式对话框架构
```
FormatDialog
├── overlay (遮罩层)
├── dialog (对话框容器)
│   ├── title-bar (标题栏 + 关闭按钮)
│   ├── tab-bar (选项卡导航)
│   │   ├── 数字格式
│   │   ├── 对齐
│   │   ├── 字体
│   │   ├── 边框
│   │   └── 填充
│   ├── tab-content (选项卡内容区)
│   └── footer (确定/取消按钮)
```

### 数据流
1. 用户触发打开（Ctrl+1 / 右键菜单）
2. FormatDialog 读取当前选中单元格的格式信息
3. 用户修改设置
4. 点击确定 → 回调将设置应用到 Model → 触发重绘
