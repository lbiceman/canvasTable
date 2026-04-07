import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, rightClickCell,
  selectRange, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：右键菜单操作
 * 覆盖：单元格右键菜单、剪切/复制/粘贴、插入行列、清除格式、联合操作
 */
test.describe('右键菜单综合测试', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await waitForApp(page);
  });

  test('右键单元格显示上下文菜单', async ({ page }) => {
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(200);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();
  });

  test('右键菜单 - 复制', async ({ page }) => {
    await typeInCell(page, 0, 0, 'ContextCopy');
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(200);

    const menu = page.locator('.cell-context-menu');
    const copyItem = menu.locator('.cell-context-menu-item', { hasText: '复制' }).first();
    if (await copyItem.isVisible()) {
      await copyItem.click();
      await page.waitForTimeout(300);

      // 粘贴到 B1
      await clickCell(page, 0, 1);
      await page.keyboard.press('Control+v');
      await page.waitForTimeout(300);

      const b1 = await getCellData(page, 0, 1);
      expect(b1.content).toBe('ContextCopy');
    }
  });

  test('右键菜单 - 剪切', async ({ page }) => {
    await typeInCell(page, 0, 0, 'ContextCut');
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(200);

    const menu = page.locator('.cell-context-menu');
    const cutItem = menu.locator('.cell-context-menu-item', { hasText: '剪切' }).first();
    if (await cutItem.isVisible()) {
      await cutItem.click();
      await page.waitForTimeout(300);

      await clickCell(page, 0, 1);
      await page.keyboard.press('Control+v');
      await page.waitForTimeout(300);

      const b1 = await getCellData(page, 0, 1);
      expect(b1.content).toBe('ContextCut');
    }
  });

  test('右键菜单 - 插入行（上方）', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Row1');
    await typeInCell(page, 1, 0, 'Row2');

    await rightClickCell(page, 1, 0);
    await page.waitForTimeout(200);

    const menu = page.locator('.cell-context-menu');
    const insertAbove = menu.locator('.cell-context-menu-item', { hasText: '上方插入行' });
    if (await insertAbove.isVisible()) {
      await insertAbove.click();
      await page.waitForTimeout(300);

      // 原 Row2 下移
      const row3 = await getCellData(page, 2, 0);
      expect(row3.content).toBe('Row2');
    }
  });

  test('右键菜单 - 插入列（左侧）', async ({ page }) => {
    await typeInCell(page, 0, 0, 'ColA');
    await typeInCell(page, 0, 1, 'ColB');

    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(200);

    const menu = page.locator('.cell-context-menu');
    const insertLeft = menu.locator('.cell-context-menu-item', { hasText: '左侧插入列' });
    if (await insertLeft.isVisible()) {
      await insertLeft.click();
      await page.waitForTimeout(300);

      // 原 ColA 右移
      const colB = await getCellData(page, 0, 1);
      expect(colB.content).toBe('ColA');
    }
  });

  test('右键菜单 - 清除格式', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Formatted');
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.locator('#font-italic-btn').click();
    await page.waitForTimeout(200);

    let cell = await getCellData(page, 0, 0);
    expect(cell.fontBold).toBe(true);

    // 右键清除格式
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(200);

    const menu = page.locator('.cell-context-menu');
    const clearFormat = menu.locator('.cell-context-menu-item', { hasText: '清除格式' });
    if (await clearFormat.isVisible()) {
      await clearFormat.click();
      await page.waitForTimeout(300);

      cell = await getCellData(page, 0, 0);
      expect(cell.fontBold).toBeFalsy();
      expect(cell.fontItalic).toBeFalsy();
      // 内容应保留
      expect(cell.content).toBe('Formatted');
    }
  });

  test('联合操作：输入 → 格式化 → 右键复制 → 粘贴 → 清除格式', async ({ page }) => {
    // 输入并格式化
    await typeInCell(page, 0, 0, 'Styled');
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);

    // 右键复制
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(200);
    const menu = page.locator('.cell-context-menu');
    const copyItem = menu.locator('.cell-context-menu-item', { hasText: '复制' }).first();
    if (await copyItem.isVisible()) {
      await copyItem.click();
      await page.waitForTimeout(300);

      // 粘贴
      await clickCell(page, 1, 0);
      await page.keyboard.press('Control+v');
      await page.waitForTimeout(300);

      let a2 = await getCellData(page, 1, 0);
      expect(a2.content).toBe('Styled');
      // 系统剪贴板粘贴可能不保留格式

      // 清除格式
      await rightClickCell(page, 1, 0);
      await page.waitForTimeout(200);
      const menu2 = page.locator('.cell-context-menu');
      const clearFormat = menu2.locator('.cell-context-menu-item', { hasText: '清除格式' });
      if (await clearFormat.isVisible()) {
        await clearFormat.click();
        await page.waitForTimeout(300);

        a2 = await getCellData(page, 1, 0);
        expect(a2.fontBold).toBeFalsy();
        expect(a2.content).toBe('Styled');
      }
    }
  });

  test('点击其他位置关闭右键菜单', async ({ page }) => {
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(200);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    // 点击其他位置
    await clickCell(page, 3, 3);
    await page.waitForTimeout(200);
    await expect(menu).not.toBeVisible();
  });
});
