---
inclusion: manual
---

# E2E 测试调试方法论

## 核心原则：截图驱动调试

当 E2E 测试失败且原因不明时，**立即在失败步骤前后插入截图**查看页面实际状态，而不是反复猜测和盲改代码。一张截图往往比十次日志更有效。

## 失败时必须执行的流程

1. 在失败操作前插入 `await page.screenshot({ path: 'debug-xxx.png' })` 截图
2. 用浏览器工具打开截图，直观判断页面状态
3. 根据截图分类问题（见下方），选择对应方案修复
4. 修复后删除调试截图

## 常见问题速查表

| 截图表现 | 问题分类 | 解决方案 |
|---------|---------|---------|
| 目标元素在页面底部/侧边看不到 | 元素在视口外 | `scrollIntoViewIfNeeded()` 或 `evaluate(el => el.click())` |
| 页面上有未预期的弹框/遮罩 | 弹框遮挡 | 操作前检测并关闭弹框 |
| 单元格/表单为空 | 数据未写入 | 改用 API 直接写入数据 |
| 只选中了单个元素而非区域 | 选区未生效 | 检查源码确认选区方式，可能需要鼠标拖拽而非 Shift+click |
| 加载中/空白区域 | 异步未完成 | 增加等待时间或用 `toBeVisible({ timeout })` |

## 解决方案详解

### 1. 元素在视口外
弹出菜单、面板底部按钮等绝对定位元素可能超出视口。

```typescript
// 优先：滚动到可见区域
await element.scrollIntoViewIfNeeded();
await element.click();

// 备选：绝对定位弹出层无法滚动时，用 JS 直接点击
await element.evaluate((el) => (el as HTMLElement).click());
```

### 2. 弹框遮挡
操作触发了未预期的模态框（错误提示、确认框等）。

```typescript
const modal = page.locator('.modal-overlay, [role="dialog"]');
if (await modal.isVisible({ timeout: 500 }).catch(() => false)) {
  const btn = modal.locator('button:has-text("确定"), button:has-text("OK"), .close-btn');
  if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(300);
  }
}
```

### 3. 数据未写入
通过 UI 输入的数据可能因焦点丢失、编辑器拦截等原因未生效。

```typescript
// 改用应用内部 API 直接写入
await page.evaluate(() => {
  app.getModel().setCellContent(0, 0, '数据');
  app.getRenderer().render();
});
```

### 4. 选区/拖拽未生效
Canvas 应用中 Shift+click 可能未被实现，需要鼠标拖拽。

```typescript
// Canvas 拖拽选区：用绝对坐标 + 分步移动
const box = await canvas.boundingBox();
await page.mouse.move(box.x + startX, box.y + startY);
await page.mouse.down();
for (let i = 1; i <= 5; i++) {
  await page.mouse.move(
    box.x + startX + (endX - startX) * i / 5,
    box.y + startY + (endY - startY) * i / 5,
  );
  await page.waitForTimeout(50);
}
await page.mouse.up();
```

### 5. 拖拽操作加验证和重试
拖拽可能静默失败，操作后必须检查目标区域状态。

```typescript
const beforeCount = await target.locator('.item').count();
await source.dragTo(target);
await page.waitForTimeout(1000);
if (await target.locator('.item').count() <= beforeCount) {
  await source.dragTo(target); // 重试
  await page.waitForTimeout(1000);
}
```

### 6. 防抖操作需要额外等待
输入、拖拽后的计算通常有 300-500ms 防抖。

```typescript
await page.waitForTimeout(1500); // 防抖 + 渲染
```

## 测试间状态隔离

```typescript
test.beforeEach(async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.waitForSelector('#app');
  await page.waitForTimeout(500);
});
```
