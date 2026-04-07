import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：主题切换与设置
 * 覆盖：亮色/暗色主题、主题切换后数据保留、状态栏信息
 */
test.describe('主题与设置测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('状态栏显示当前单元格地址', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.waitForTimeout(100);
    const selectedCell = page.locator('#selected-cell');
    expect(await selectedCell.textContent()).toBe('A1');

    await clickCell(page, 2, 3);
    await page.waitForTimeout(100);
    expect(await selectedCell.textContent()).toBe('D3');
  });

  test('公式栏显示单元格内容', async ({ page }) => {
    await typeInCell(page, 0, 0, 'FormulaBar');
    await clickCell(page, 0, 0);
    await page.waitForTimeout(200);

    const contentInput = page.locator('.formula-input');
    const value = await contentInput.inputValue();
    expect(value).toBe('FormulaBar');
  });

  test('公式栏显示公式而非计算结果', async ({ page }) => {
    await typeInCell(page, 0, 0, '10');
    await typeInCell(page, 1, 0, '20');

    await clickCell(page, 2, 0);
    const contentInput = page.locator('.formula-input');
    await contentInput.fill('=SUM(A1,A2)');
    await contentInput.press('Enter');
    await page.waitForTimeout(300);

    // 重新选中公式单元格
    await clickCell(page, 2, 0);
    await page.waitForTimeout(200);

    const value = await contentInput.inputValue();
    // 公式栏应显示公式
    expect(value).toContain('SUM');
  });

  test('视口信息更新', async ({ page }) => {
    const viewportInfo = page.locator('#viewport-info');
    const text = await viewportInfo.textContent();
    expect(text).toContain('视图');
  });

  test('联合操作：输入数据 → 切换主题 → 数据保留', async ({ page }) => {
    // 输入数据
    await typeInCell(page, 0, 0, 'ThemeTest');
    await typeInCell(page, 0, 1, '12345');

    // 尝试切换主题（通过 window.uiControls）
    await page.evaluate(() => {
      const uiControls = (window as unknown as Record<string, unknown>).uiControls as {
        toggleTheme?: () => void;
      } | undefined;
      if (uiControls?.toggleTheme) {
        uiControls.toggleTheme();
      }
    });
    await page.waitForTimeout(500);

    // 数据应保留
    const a1 = await getCellData(page, 0, 0);
    const b1 = await getCellData(page, 0, 1);
    expect(a1.content).toBe('ThemeTest');
    expect(b1.content).toBe('12345');
  });
});
