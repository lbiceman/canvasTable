# 执行全部 E2E 测试

## 描述
运行项目所有的 Playwright E2E 测试，验证全部功能正常后生成 HTML 测试报告。适合在发布生产前执行。

## 步骤

1. 执行命令 `npx playwright test --reporter=html`，超时时间 5 分钟
2. 如果全部通过，告知用户测试结果和报告位置（`playwright-report/index.html`）
3. 如果有失败，列出失败的测试名称和错误信息，询问用户是否需要排查

## 测试覆盖范围

- `e2e/full-toolbar.spec.ts` — 撤销/重做、合并/拆分、字体样式、对齐、颜色、键盘导航、双击编辑、搜索、右键菜单、滚轮滚动等
- `e2e/clipboard-and-formula.spec.ts` — 剪贴板复制/剪切/粘贴、公式计算（SUM/SUBTRACT/MULTIPLY/DIVIDE）
- `e2e/theme-and-settings.spec.ts` — 设置面板、主题切换、localStorage 持久化、清空数据
- `e2e/font-style.spec.ts` — 加粗、斜体、截图对比
- `e2e/horizontal-align-button-group.spec.ts` — 水平对齐、截图对比
- `e2e/cell-vertical-align.spec.ts` — 垂直对齐、截图对比

## 注意事项

- 测试依赖 Vite dev server（自动启动，端口 3000）
- 截图对比测试如需更新基准图片：`npx playwright test --update-snapshots`
- 总共 114 个测试用例，预计运行 2-3 分钟
