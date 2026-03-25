import { test, expect, Page } from '@playwright/test';

/**
 * 辅助函数：点击 Canvas 上指定单元格
 * 根据渲染配置，headerWidth=40, headerHeight=28，默认列宽=100，默认行高=25
 * 点击第 row 行第 col 列的单元格中心（0-indexed）
 */
const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;

  const x = headerWidth + col * defaultColWidth + defaultColWidth / 2;
  const y = headerHeight + row * defaultRowHeight + defaultRowHeight / 2;

  await canvas.click({ position: { x, y } });
};

/**
 * 辅助函数：获取单元格的 fontStrikethrough 属性
 */
const getCellStrikethrough = async (page: Page, row: number, col: number): Promise<boolean | undefined> => {
  return await page.evaluate(([r, c]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as any).app;
    const cell = app.getModel().getCell(r, c);
    return cell?.fontStrikethrough;
  }, [row, col]);
};

test.describe('删除线样式功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待 Canvas 渲染完成
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  /**
   * 需求6.1 - fontStrikethrough 属性：
   * 设置删除线后验证 Cell 对象包含 fontStrikethrough 布尔属性
   */
  test('设置删除线后 Cell 对象应包含 fontStrikethrough 布尔属性', async ({ page }) => {
    // 选中 A1 单元格
    await clickCell(page, 0, 0);

    // 点击删除线按钮
    const strikethroughBtn = page.locator('#font-strikethrough-btn');
    await strikethroughBtn.click();

    // 验证 fontStrikethrough 为 true（布尔类型）
    const value = await getCellStrikethrough(page, 0, 0);
    expect(value).toBe(true);
    expect(typeof value).toBe('boolean');
  });

  /**
   * 需求6.2 - 删除线按钮：
   * 验证工具栏存在删除线按钮（标记为 "S" 带中划线样式），点击后切换状态
   */
  test('工具栏应存在删除线按钮，点击后切换删除线状态', async ({ page }) => {
    // 验证删除线按钮存在
    const strikethroughBtn = page.locator('#font-strikethrough-btn');
    await expect(strikethroughBtn).toBeVisible();

    // 验证按钮包含带中划线样式的 "S" 文本
    const btnText = strikethroughBtn.locator('span[style*="line-through"]');
    await expect(btnText).toBeVisible();
    await expect(btnText).toHaveText('S');

    // 选中 A1 并点击删除线按钮
    await clickCell(page, 0, 0);
    await strikethroughBtn.click();

    // 验证删除线已启用
    const value = await getCellStrikethrough(page, 0, 0);
    expect(value).toBe(true);
  });

  /**
   * 需求6.3 - 删除线渲染：
   * 输入文本后启用删除线，Canvas 截图对比
   */
  test('启用删除线后 Canvas 应渲染删除线效果（截图对比）', async ({ page }) => {
    // 输入文本内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('Strikethrough');
    await page.keyboard.press('Enter');

    // 重新选中 A1 并启用删除线
    await clickCell(page, 0, 0);
    const strikethroughBtn = page.locator('#font-strikethrough-btn');
    await strikethroughBtn.click();

    // 截图验证删除线渲染效果
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-strikethrough.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  /**
   * 需求6.4 - 切换逻辑：
   * 点击启用（true），再次点击取消（false）
   */
  test('点击删除线按钮应切换状态：启用→取消', async ({ page }) => {
    await clickCell(page, 0, 0);

    const strikethroughBtn = page.locator('#font-strikethrough-btn');

    // 第一次点击：启用删除线
    await strikethroughBtn.click();
    expect(await getCellStrikethrough(page, 0, 0)).toBe(true);
    await expect(strikethroughBtn).toHaveClass(/active/);

    // 第二次点击：取消删除线
    await strikethroughBtn.click();
    expect(await getCellStrikethrough(page, 0, 0)).toBe(false);
    await expect(strikethroughBtn).not.toHaveClass(/active/);
  });

  /**
   * 需求6.5 - 撤销重做：
   * 设置删除线后 Ctrl+Z 撤销，Ctrl+Y 重做
   */
  test('删除线设置应支持撤销和重做', async ({ page }) => {
    await clickCell(page, 0, 0);

    const strikethroughBtn = page.locator('#font-strikethrough-btn');

    // 启用删除线
    await strikethroughBtn.click();
    expect(await getCellStrikethrough(page, 0, 0)).toBe(true);

    // Ctrl+Z 撤销：删除线应恢复为 false/undefined
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    const afterUndo = await getCellStrikethrough(page, 0, 0);
    expect(!afterUndo).toBeTruthy(); // false 或 undefined

    // Ctrl+Y 重做：删除线应重新设置为 true
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);
    expect(await getCellStrikethrough(page, 0, 0)).toBe(true);
  });

  /**
   * 需求6.6 - 按钮高亮：
   * 选中已设置删除线的单元格，验证按钮有 active CSS 类；
   * 选中未设置的单元格，验证按钮无 active 类
   */
  test('选中已设置删除线的单元格时按钮应高亮显示', async ({ page }) => {
    const strikethroughBtn = page.locator('#font-strikethrough-btn');

    // 选中 A1 并启用删除线
    await clickCell(page, 0, 0);
    await strikethroughBtn.click();
    await expect(strikethroughBtn).toHaveClass(/active/);

    // 选中 B1（未设置删除线）
    await clickCell(page, 0, 1);
    await expect(strikethroughBtn).not.toHaveClass(/active/);

    // 重新选中 A1（已设置删除线），按钮应恢复高亮
    await clickCell(page, 0, 0);
    await expect(strikethroughBtn).toHaveClass(/active/);
  });
});
