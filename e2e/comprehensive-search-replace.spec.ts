import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：搜索与替换
 * 覆盖：Ctrl+F 打开搜索、查找、导航、替换、全部替换
 */
test.describe('搜索与替换综合测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('Ctrl+F 打开搜索对话框', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);

    const dialog = page.locator('.search-dialog');
    await expect(dialog).toBeVisible();
  });

  test('搜索已有内容', async ({ page }) => {
    // 输入数据
    await typeInCell(page, 0, 0, 'Apple');
    await typeInCell(page, 1, 0, 'Banana');
    await typeInCell(page, 2, 0, 'Apple Pie');

    // 打开搜索
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);

    const searchInput = page.locator('.search-input');
    await searchInput.fill('Apple');
    await page.waitForTimeout(300);

    // 应该找到结果
    const resultsInfo = page.locator('.search-results-info');
    const text = await resultsInfo.textContent();
    expect(text).toContain('1/2');
  });

  test('搜索无结果', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Hello');

    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);

    const searchInput = page.locator('.search-input');
    await searchInput.fill('NotExist');
    await page.waitForTimeout(300);

    const resultsInfo = page.locator('.search-results-info');
    const text = await resultsInfo.textContent();
    expect(text).toContain('无结果');
  });

  test('搜索导航：下一个/上一个', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Test');
    await typeInCell(page, 1, 0, 'Test');
    await typeInCell(page, 2, 0, 'Test');

    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);

    const searchInput = page.locator('.search-input');
    await searchInput.fill('Test');
    await page.waitForTimeout(300);

    // 点击下一个
    await page.locator('.search-next').click();
    await page.waitForTimeout(200);
    const resultsInfo = page.locator('.search-results-info');
    let text = await resultsInfo.textContent();
    expect(text).toContain('2/3');

    // 点击上一个
    await page.locator('.search-prev').click();
    await page.waitForTimeout(200);
    text = await resultsInfo.textContent();
    expect(text).toContain('1/3');
  });

  test('Enter 下一个，Shift+Enter 上一个', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Find');
    await typeInCell(page, 1, 0, 'Find');

    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);

    const searchInput = page.locator('.search-input');
    await searchInput.fill('Find');
    await page.waitForTimeout(300);

    // Enter 下一个
    await searchInput.press('Enter');
    await page.waitForTimeout(200);
    const resultsInfo = page.locator('.search-results-info');
    let text = await resultsInfo.textContent();
    expect(text).toContain('2/2');

    // Shift+Enter 上一个
    await searchInput.press('Shift+Enter');
    await page.waitForTimeout(200);
    text = await resultsInfo.textContent();
    expect(text).toContain('1/2');
  });

  test('Escape 关闭搜索对话框', async ({ page }) => {
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);

    const dialog = page.locator('.search-dialog');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(dialog).not.toBeVisible();
  });

  test('联合操作：输入数据 → 搜索 → 导航 → 关闭 → 编辑', async ({ page }) => {
    // 输入数据
    await typeInCell(page, 0, 0, 'Alpha');
    await typeInCell(page, 1, 0, 'Beta');
    await typeInCell(page, 2, 0, 'Alpha');

    // 搜索
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);
    const searchInput = page.locator('.search-input');
    await searchInput.fill('Alpha');
    await page.waitForTimeout(300);

    // 导航到第二个
    await page.locator('.search-next').click();
    await page.waitForTimeout(200);

    // 关闭搜索
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 编辑当前选中的单元格
    await typeInCell(page, 2, 0, 'Gamma');
    const cell = await getCellData(page, 2, 0);
    expect(cell.content).toBe('Gamma');
  });
});
