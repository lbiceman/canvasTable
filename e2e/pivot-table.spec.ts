import { test, expect, Page } from '@playwright/test';
import { clickCell, selectRange, getCellContent } from './helpers/test-utils';

/**
 * 通过 model.setCellContent API 批量写入数据（比 typeInCell 更可靠）
 */
const setupTestData = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => {
        setCellContent: (r: number, c: number, v: string) => void;
      };
      getRenderer: () => { render: () => void };
    };
    const m = app.getModel();
    // 表头
    m.setCellContent(0, 0, '部门');
    m.setCellContent(0, 1, '产品');
    m.setCellContent(0, 2, '销售额');
    // 数据
    m.setCellContent(1, 0, '技术部');
    m.setCellContent(1, 1, '产品A');
    m.setCellContent(1, 2, '100');
    m.setCellContent(2, 0, '技术部');
    m.setCellContent(2, 1, '产品B');
    m.setCellContent(2, 2, '200');
    m.setCellContent(3, 0, '销售部');
    m.setCellContent(3, 1, '产品A');
    m.setCellContent(3, 2, '150');
    m.setCellContent(4, 0, '销售部');
    m.setCellContent(4, 1, '产品B');
    m.setCellContent(4, 2, '250');
    app.getRenderer().render();
  });
  await page.waitForTimeout(300);
};

/**
 * 打开透视表面板：先验证数据写入，再选区，再点击按钮
 */
const openPivotPanel = async (page: Page): Promise<void> => {
  // 验证表头确实写入了
  const header = await getCellContent(page, 0, 0);
  if (header !== '部门') {
    throw new Error(`表头未正确写入，A1 内容为: "${header}"`);
  }

  // 点击空白处取消任何编辑状态
  await clickCell(page, 8, 8);
  await page.waitForTimeout(300);

  // 关闭可能存在的任何模态框
  const existingModal = page.locator('.modal-overlay');
  if (await existingModal.isVisible({ timeout: 300 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // 用鼠标拖拽选中 A1:C5（从 A1 中心拖到 C5 中心）
  const canvas = page.locator('#excel-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  const hw = 40, hh = 28, cw = 100, rh = 25;
  const startX = box.x + hw + cw / 2;
  const startY = box.y + hh + rh / 2;
  const endX = box.x + hw + 2 * cw + cw / 2;
  const endY = box.y + hh + 4 * rh + rh / 2;

  // 真正的鼠标拖拽：按下 → 移动 → 释放
  await page.mouse.move(startX, startY);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(100);
  // 分步移动，模拟真实拖拽
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    await page.mouse.move(
      startX + (endX - startX) * t,
      startY + (endY - startY) * t,
    );
    await page.waitForTimeout(50);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  // 点击透视表按钮
  await page.locator('#pivot-table-btn').click();
  await page.waitForTimeout(1500);

  // 检查透视表面板是否已打开
  const pivotOverlay = page.locator('.pivot-panel-overlay');
  if (await pivotOverlay.isVisible({ timeout: 500 }).catch(() => false)) {
    return;
  }

  // 如果有模态框（可能是错误提示），关闭它并报错
  const modalOverlay = page.locator('.modal-overlay');
  if (await modalOverlay.isVisible({ timeout: 500 }).catch(() => false)) {
    const confirmBtn = page.locator('.modal-confirm-btn');
    if (await confirmBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(300);
    }
  }

  await expect(pivotOverlay).toBeVisible({ timeout: 5000 });
};

const dragFieldToZone = async (page: Page, fieldName: string, zone: string): Promise<void> => {
  // 只从可用字段列表中选择（避免匹配到已拖入区域的同名字段）
  const field = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: fieldName });
  const dropZone = page.locator(`[data-zone="${zone}"].pivot-drop-zone`);

  // 获取拖拽前目标区域的字段数
  const beforeCount = await dropZone.locator('.pivot-field-item').count();

  await field.dragTo(dropZone);
  await page.waitForTimeout(1500);

  // 如果弹出了模态框，关闭它
  const modal = page.locator('.modal-overlay');
  if (await modal.isVisible({ timeout: 300 }).catch(() => false)) {
    const confirmBtn = page.locator('.modal-confirm-btn');
    if (await confirmBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(300);
    }
  }

  // 验证目标区域字段数增加了
  const afterCount = await dropZone.locator('.pivot-field-item').count();
  if (afterCount <= beforeCount) {
    const retryField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: fieldName });
    if (await retryField.count() > 0) {
      await retryField.dragTo(dropZone);
      await page.waitForTimeout(1500);
    }
  }
};

/**
 * 点击值字段切换聚合方式（先滚动到可见区域）
 */
const switchAggregation = async (page: Page, aggName: string): Promise<void> => {
  const valueZone = page.locator('[data-zone="value"].pivot-drop-zone');
  const valueItem = valueZone.locator('.pivot-field-item').first();
  await valueItem.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await valueItem.click();
  await page.waitForTimeout(500);

  const menuItem = page.locator('.pivot-agg-menu .pivot-agg-menu-item', { hasText: aggName });
  // 聚合菜单是绝对定位弹出层，可能在视口外，用 evaluate 直接点击
  await menuItem.evaluate((el) => (el as HTMLElement).click());
  await page.waitForTimeout(1500);
};

/**
 * 点击写入工作表按钮（先滚动到可见区域，处理弹框）
 */
const clickWriteToSheet = async (page: Page): Promise<void> => {
  const writeBtn = page.locator('.pivot-panel-btn-primary', { hasText: '写入工作表' });
  await writeBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await writeBtn.click();
  await page.waitForTimeout(800);

  const modal = page.locator('.modal-overlay');
  if (await modal.isVisible({ timeout: 500 }).catch(() => false)) {
    const btn = page.locator('.modal-confirm-btn');
    if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(300);
    }
  }
};

// ============================================================
// 深入测试：数据透视表
// ============================================================

test.describe('数据透视表 - 多行字段分组', () => {
  test.beforeEach(async ({ page }) => {
    // 清除 localStorage 避免残留数据干扰
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('配置两个行字段应产生嵌套分组结果', async ({ page }) => {
    await setupTestData(page);
    await openPivotPanel(page);

    // 验证字段列表有 3 个字段
    const fieldItems = page.locator('.pivot-field-list-items .pivot-field-item');
    const fieldCount = await fieldItems.count();
    expect(fieldCount).toBe(3);

    await dragFieldToZone(page, '部门', 'row');

    // 验证行区域有 1 个字段
    const rowZone = page.locator('[data-zone="row"].pivot-drop-zone');
    const rowItems = rowZone.locator('.pivot-field-item');
    expect(await rowItems.count()).toBe(1);

    await dragFieldToZone(page, '产品', 'row');
    expect(await rowItems.count()).toBe(2);

    await dragFieldToZone(page, '销售额', 'value');

    const previewTable = page.locator('.pivot-preview-table');
    await previewTable.scrollIntoViewIfNeeded();
    await expect(previewTable).toBeVisible({ timeout: 5000 });

    const rows = previewTable.locator('tr');
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
  });
});

test.describe('数据透视表 - 聚合方式验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('切换到计数聚合应显示正确的计数值', async ({ page }) => {
    await setupTestData(page);
    await openPivotPanel(page);

    await dragFieldToZone(page, '部门', 'row');
    await dragFieldToZone(page, '销售额', 'value');

    await switchAggregation(page, '计数');
    await clickWriteToSheet(page);

    const resultTab = page.locator('#sheet-tab-bar .sheet-tab', { hasText: '透视表结果' });
    await resultTab.click();
    await page.waitForTimeout(300);

    expect(await getCellContent(page, 1, 1)).toBe('2');
    expect(await getCellContent(page, 2, 1)).toBe('2');
    expect(await getCellContent(page, 3, 1)).toBe('4');
  });

  test('切换到平均值聚合应显示正确的平均值', async ({ page }) => {
    await setupTestData(page);
    await openPivotPanel(page);

    await dragFieldToZone(page, '部门', 'row');
    await dragFieldToZone(page, '销售额', 'value');

    await switchAggregation(page, '平均值');
    await clickWriteToSheet(page);

    const resultTab = page.locator('#sheet-tab-bar .sheet-tab', { hasText: '透视表结果' });
    await resultTab.click();
    await page.waitForTimeout(300);

    expect(await getCellContent(page, 1, 1)).toBe('150');
    expect(await getCellContent(page, 2, 1)).toBe('200');
  });

  test('切换到最大值聚合应显示正确结果', async ({ page }) => {
    await setupTestData(page);
    await openPivotPanel(page);

    await dragFieldToZone(page, '部门', 'row');
    await dragFieldToZone(page, '销售额', 'value');

    await switchAggregation(page, '最大值');
    await clickWriteToSheet(page);

    const resultTab = page.locator('#sheet-tab-bar .sheet-tab', { hasText: '透视表结果' });
    await resultTab.click();
    await page.waitForTimeout(300);

    expect(await getCellContent(page, 1, 1)).toBe('200');
    expect(await getCellContent(page, 2, 1)).toBe('250');
  });
});

test.describe('数据透视表 - 筛选功能深入验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('取消勾选筛选值后透视表结果应只包含选中值的数据', async ({ page }) => {
    await setupTestData(page);
    await openPivotPanel(page);

    await dragFieldToZone(page, '产品', 'row');
    await dragFieldToZone(page, '销售额', 'value');
    await dragFieldToZone(page, '部门', 'filter');

    // 滚动到筛选区域
    const checkList = page.locator('.pivot-filter-checklist');
    await checkList.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const items = checkList.locator('.pivot-filter-check-item');
    for (let i = 0; i < await items.count(); i++) {
      const text = await items.nth(i).textContent();
      if (text?.includes('销售部')) {
        await items.nth(i).locator('input[type="checkbox"]').uncheck();
        break;
      }
    }
    await page.waitForTimeout(1500);

    await clickWriteToSheet(page);

    const resultTab = page.locator('#sheet-tab-bar .sheet-tab', { hasText: '透视表结果' });
    await resultTab.click();
    await page.waitForTimeout(300);

    expect(await getCellContent(page, 1, 1)).toBe('100');
    expect(await getCellContent(page, 2, 1)).toBe('200');
  });
});

test.describe('数据透视表 - 从区域移除字段', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('从行区域移除字段后预览应更新', async ({ page }) => {
    await setupTestData(page);
    await openPivotPanel(page);

    await dragFieldToZone(page, '部门', 'row');
    await dragFieldToZone(page, '产品', 'row');
    await dragFieldToZone(page, '销售额', 'value');

    const rowZone = page.locator('[data-zone="row"].pivot-drop-zone');
    let rowItems = rowZone.locator('.pivot-field-item');
    expect(await rowItems.count()).toBe(2);

    const prodItem = rowZone.locator('.pivot-field-item', { hasText: '产品' });
    const removeBtn = prodItem.locator('.pivot-field-remove');
    await removeBtn.click();
    await page.waitForTimeout(800);

    rowItems = rowZone.locator('.pivot-field-item');
    expect(await rowItems.count()).toBe(1);
    await expect(rowItems.first()).toContainText('部门');
  });
});
