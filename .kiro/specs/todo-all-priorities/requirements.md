# 需求文档：TODO 全优先级功能开发

## 功能概述

根据 `docs/TODO.md` 中的待办任务，按 P0-P5 优先级逐步完成所有功能开发。

## 现状分析

经代码审查，以下功能**已实现**，无需开发：
- ✅ P0: 拖拽移动单元格/选区（app.ts: isDragMoving, executeDragMove）
- ✅ P0: 单元格内换行 Alt+Enter（inline-editor.ts: insertNewlineAtCursor + renderer.ts wrapText 渲染）
- ✅ P0: 行/列隐藏与取消隐藏（model.ts: hideRows/hideCols/unhideRows/unhideCols + 右键菜单）
- ✅ P0: 右键菜单列操作（app.ts: createColContextMenu 含插入/删除/隐藏/分组/排序/筛选）
- ✅ P1: 公式输入自动补全/提示（formula-bar/autocomplete.ts + inline-editor.ts）
- ✅ P1: 公式错误用户友好提示（model.ts: notifyFormulaError + app.ts: showFormulaError）
- ✅ P1: 跨工作表引用公式（formula/tokenizer.ts: SheetRef + parser.ts: parseSheetRefString）
- ✅ P5: 工具栏字体选择器（ui-controls.ts: fontFamilyPicker + app.ts: initFontFamilyPicker）

## 需要开发的功能

### P1 - 财务函数补全
- PMT, FV, PV, NPV, IRR, NPER, RATE 等常用财务函数
- 注册到 FunctionRegistry，支持自动补全

### P2 - 数据处理
1. **多级排序 UI**：排序对话框支持多条件排序
2. **高级筛选**：自定义条件组合筛选（AND/OR），支持正则
3. **数据分列**：按分隔符拆分单元格内容到多列
4. **去重功能**：选区内去除重复行

### P3 - 导入导出
1. **XLSX 导出样式保真度提升**：边框、合并单元格完整导出
2. **PDF 导出分页优化**：智能分页避免截断合并单元格
3. **CSV 导入编码自动检测优化**：提升编码识别准确率

### P4 - 协同编辑
1. **协同冲突解决提示**：操作冲突可视化提示
2. **编辑历史/版本回溯**：保存历史版本快照
3. **操作权限控制**：只读/可编辑权限区分

### P5 - 用户体验
1. **颜色选择器增强**：自定义颜色输入（HEX/RGB），最近使用颜色
2. **单元格快速样式预设**：预定义样式一键应用
3. **列宽拖拽提示**：拖拽调整列宽时显示当前宽度数值

## 验收标准

1. 所有新增功能通过 E2E 测试
2. 不破坏已有功能（现有测试全部通过）
3. 代码风格与项目一致（TypeScript strict, 中文注释）
4. 零新增运行时依赖

## 约束条件

- TypeScript + Vite 6.x + Canvas API
- MVC 架构：Model / Renderer / App
- 零运行时依赖（exceljs/jspdf 已有）
- UI 文本使用简体中文
