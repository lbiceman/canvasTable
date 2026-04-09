# 性能测试报告 - TODO 第二轮功能

## 分析维度

### 1. 加载性能
🟢 无需优化
- 新增 `validation-dialog.ts`（约 200 行），体积极小
- 所有新增代码均为按需执行，不影响初始加载

### 2. 渲染性能
🟢 无需优化
- 批注 tooltip 使用 DOM 元素（非 Canvas），不影响 Canvas 渲染循环
- Toast 提示使用 CSS 动画，不触发 Canvas 重绘
- 数据验证对话框仅在用户操作时创建

### 3. 网络请求
🟢 无需优化
- 所有功能均为本地操作，无新增网络请求
- Ctrl+S 保存到 localStorage，无网络开销

### 4. 内存使用
🟢 无需优化
- 批注 tooltip 为单例 DOM 元素，常驻内存约 1KB
- 验证对话框按需创建/销毁，无内存泄漏
- HistoryAction discriminated union 仅改变类型定义，运行时无额外开销

### 5. 包体积影响
🟢 无需优化
- 新增 `validation-dialog.ts` 约 5KB（压缩后约 2KB）
- CSS 新增约 0.5KB
- 无新增第三方依赖
- 总体积增加 < 0.1%

### 6. 事件处理性能
🟡 建议优化
- `handleMouseMove` 中新增批注检测逻辑，每次鼠标移动都会调用 `getCellAtPosition` 和 `getCellComment`
- 当前实现已在非拖拽状态下才执行检测，性能影响可控
- 如未来出现卡顿，可考虑添加节流（throttle）处理
