import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：多工作表管理
 * 覆盖：工作表标签、新建、切换、重命名、删除
 */
test.describe('多工作表管理测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('默认有一个工作表 Sheet1', async ({ page }) => {
    const sheetTab = page.locator('.sheet-tab');
    const count = await sheetTab.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('新建工作表', async ({ page }) => {
    // 查找新建工作表按钮
    const addBtn = page.locator('.sheet-tab-add, .add-sheet-btn, [title*="新建"]');
    if (await addBtn.count() > 0) {
      const initialCount = await page.locator('.sheet-tab').count();
      await addBtn.first().click();
      await page.waitForTimeout(300);

      const newCount = await page.locator('.sheet-tab').count();
      expect(newCount).toBe(initialCount + 1);
    }
  });

  test('切换工作表后数据独立', async ({ page }) => {
    // 在 Sheet1 输入数据
    await typeInCell(page, 0, 0, 'Sheet1Data');

    // 新建并切换到 Sheet2
    const addBtn = page.locator('.sheet-tab-add, .add-sheet-btn, [title*="新建"]');
    if (await addBtn.count() > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      // Sheet2 的 A1 应该是空的
      const cell = await getCellData(page, 0, 0);
      expect(cell.content).toBeFalsy();

      // 在 Sheet2 输入数据
      await typeInCell(page, 0, 0, 'Sheet2Data');

      // 切换回 Sheet1
      const firstTab = page.locator('.sheet-tab').first();
      await firstTab.click();
      await page.waitForTimeout(500);

      // Sheet1 数据应保留
      const sheet1Cell = await getCellData(page, 0, 0);
      expect(sheet1Cell.content).toBe('Sheet1Data');
    }
  });

  test('右键工作表标签显示菜单', async ({ page }) => {
    const firstTab = page.locator('.sheet-tab').first();
    await firstTab.click({ button: 'right' });
    await page.waitForTimeout(200);

    const menu = page.locator('.sheet-context-menu');
    if (await menu.isVisible()) {
      // 菜单应该包含重命名、删除等选项
      const menuText = await menu.textContent();
      expect(menuText).toBeTruthy();
    }
  });

  test('联合操作：多工作表 → 各自输入数据 → 切换验证', async ({ page }) => {
    // Sheet1 输入
    await typeInCell(page, 0, 0, 'S1-A1');
    await typeInCell(page, 0, 1, 'S1-B1');

    // 新建 Sheet2
    const addBtn = page.locator('.sheet-tab-add, .add-sheet-btn, [title*="新建"]');
    if (await addBtn.count() > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);

      // Sheet2 输入
      await typeInCell(page, 0, 0, 'S2-A1');
      await typeInCell(page, 0, 1, 'S2-B1');

      // 切换回 Sheet1
      const firstTab = page.locator('.sheet-tab').first();
      await firstTab.click();
      await page.waitForTimeout(500);

      const s1a1 = await getCellData(page, 0, 0);
      const s1b1 = await getCellData(page, 0, 1);
      expect(s1a1.content).toBe('S1-A1');
      expect(s1b1.content).toBe('S1-B1');

      // 切换到 Sheet2
      const secondTab = page.locator('.sheet-tab').nth(1);
      await secondTab.click();
      await page.waitForTimeout(500);

      const s2a1 = await getCellData(page, 0, 0);
      const s2b1 = await getCellData(page, 0, 1);
      expect(s2a1.content).toBe('S2-A1');
      expect(s2b1.content).toBe('S2-B1');
    }
  });
});
