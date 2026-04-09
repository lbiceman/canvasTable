# TODO 第二轮功能需求文档

## 功能概述

实现 ice-excel 待办清单中剩余的 7 项功能，涵盖核心交互（P0）、快捷键与状态栏（P1）、类型安全（P2）三个优先级。

## 用户故事

### P0 - 核心交互

1. **Ctrl+S 保存**：用户按 Ctrl+S/Cmd+S 时，数据保存到 localStorage 并显示 toast 提示"已保存"（2秒消失）
2. **数据验证 UI**：用户通过工具栏"数据验证"按钮打开对话框，设置下拉列表/数值范围/文本长度/自定义表达式验证规则
3. **批注悬浮预览**：鼠标悬停有批注的单元格时，显示浅黄色 tooltip 展示批注内容

### P1 - 快捷键与状态栏

4. **Ctrl+P 打印**：用户按 Ctrl+P/Cmd+P 时打开打印预览对话框
5. **状态栏选区统计**：选中多个单元格时，底部状态栏显示求和/平均值/计数
6. **公式栏名称框**：名称框显示当前单元格地址，支持输入地址跳转

### P2 - 类型安全

7. **HistoryAction discriminated union**：为常用 ActionType 定义数据接口，用 discriminated union 替代 unknown

## 验收标准

- [ ] Ctrl+S 保存数据并显示 toast
- [ ] 数据验证对话框支持 4 种验证类型、验证模式、提示信息
- [ ] 批注 tooltip 跟随鼠标、浅黄色背景、最大宽度 250px
- [ ] Ctrl+P 打开打印预览
- [ ] 状态栏显示 SUM/AVG/COUNT（多选区时）
- [ ] 名称框显示地址、支持输入跳转
- [ ] HistoryAction 使用 discriminated union，不破坏 undo/redo

## 约束条件

- 不破坏现有功能
- TypeScript 严格模式，禁止 any
- UI 文本简体中文，代码注释中文，变量名英文
- CSS 使用 CSS 变量适配主题
