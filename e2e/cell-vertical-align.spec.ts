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
 * 辅助函数：通过 window.app 获取单元格数据
 */
const getCellData = async (page: Page, row: number, col: number): Promise<{
  verticalAlign?: 'top' | 'middle' | 'bottom';
  content?: string;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            verticalAlign?: 'top' | 'middle' | 'bottom';
            content?: string;
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return {
        verticalAlign: cell?.verticalAlign,
        content: cell?.content,
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：选择垂直对齐选项
 * 点击垂直对齐按钮打开下拉菜单，然后点击指定的对齐选项
 */
const selectVerticalAlign = async (page: Page, align: 'top' | 'middle' | 'bottom'): Promise<void> => {
  // 点击垂直对齐按钮打开下拉菜单
  await page.locator('#vertical-align-btn').click();
  // 等待下拉菜单出现
  await page.waitForTimeout(200);
  // 点击对应的对齐选项
  await page.locator(`.vertical-align-option[data-align="${align}"]`).click();
};

test.describe('垂直对齐功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待 Canvas 渲染完成
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('点击上对齐应设置单元格垂直对齐为 top', async ({ page }) => {
    // 选中 A1 单元格
    await clickCell(page, 0, 0);

    // 验证初始状态：垂直对齐文本显示"居中"
    const alignText = page.locator('#vertical-align-text');
    await expect(alignText).toHaveText('居中');

    // 选择上对齐
    await selectVerticalAlign(page, 'top');

    // 验证按钮文本更新为"上对齐"
    await expect(alignText).toHaveText('上对齐');

    // 验证模型数据中 verticalAlign 为 'top'
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.verticalAlign).toBe('top');
  });

  test('点击下对齐应设置单元格垂直对齐为 bottom', async ({ page }) => {
    // 选中 A1 单元格
    await clickCell(page, 0, 0);

    // 选择下对齐
    await selectVerticalAlign(page, 'bottom');

    // 验证按钮文本更新
    const alignText = page.locator('#vertical-align-text');
    await expect(alignText).toHaveText('下对齐');

    // 验证模型数据
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.verticalAlign).toBe('bottom');
  });

  test('切换回居中对齐应恢复默认状态', async ({ page }) => {
    // 选中 A1 并设置为上对齐
    await clickCell(page, 0, 0);
    await selectVerticalAlign(page, 'top');

    // 再切换回居中对齐
    await selectVerticalAlign(page, 'middle');

    // 验证按钮文本恢复
    const alignText = page.locator('#vertical-align-text');
    await expect(alignText).toHaveText('居中');

    // 验证模型数据
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.verticalAlign).toBe('middle');
  });

  test('对多个单元格分别设置垂直对齐应互不影响', async ({ page }) => {
    // 选中 A1 并设置为上对齐
    await clickCell(page, 0, 0);
    await selectVerticalAlign(page, 'top');

    // 选中 B1 并设置为下对齐
    await clickCell(page, 0, 1);
    await selectVerticalAlign(page, 'bottom');

    // 选中 A2，不做任何设置（保持默认）
    await clickCell(page, 1, 0);

    // 验证三个单元格的垂直对齐值互不影响
    const cellA1 = await getCellData(page, 0, 0);
    const cellB1 = await getCellData(page, 0, 1);
    const cellA2 = await getCellData(page, 1, 0);

    expect(cellA1.verticalAlign).toBe('top');
    expect(cellB1.verticalAlign).toBe('bottom');
    // A2 未设置，应为 undefined 或 'middle'
    expect(cellA2.verticalAlign === undefined || cellA2.verticalAlign === 'middle').toBeTruthy();
  });

  test('选中单元格时工具栏应同步显示当前垂直对齐状态', async ({ page }) => {
    const alignText = page.locator('#vertical-align-text');

    // 选中 A1 并设置为上对齐
    await clickCell(page, 0, 0);
    await selectVerticalAlign(page, 'top');

    // 选中 B1（默认居中）
    await clickCell(page, 0, 1);
    await expect(alignText).toHaveText('居中');

    // 重新选中 A1，工具栏应显示"上对齐"
    await clickCell(page, 0, 0);
    await expect(alignText).toHaveText('上对齐');
  });

  test('上对齐应在 Canvas 渲染中体现（截图对比）', async ({ page }) => {
    // 先输入内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('Top');
    await page.keyboard.press('Enter');

    // 重新选中 A1 并设置上对齐
    await clickCell(page, 0, 0);
    await selectVerticalAlign(page, 'top');

    // 点击其他单元格取消选中，避免选中框影响截图
    await clickCell(page, 2, 2);

    // 截图验证
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-vertical-align-top.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('下对齐应在 Canvas 渲染中体现（截图对比）', async ({ page }) => {
    // 先输入内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('Bottom');
    await page.keyboard.press('Enter');

    // 重新选中 A1 并设置下对齐
    await clickCell(page, 0, 0);
    await selectVerticalAlign(page, 'bottom');

    // 点击其他单元格取消选中
    await clickCell(page, 2, 2);

    // 截图验证
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-vertical-align-bottom.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('三种垂直对齐同时存在（截图对比）', async ({ page }) => {
    // A1 输入内容并设置上对齐
    await clickCell(page, 0, 0);
    await page.keyboard.type('Top');
    await page.keyboard.press('Enter');
    await clickCell(page, 0, 0);
    await selectVerticalAlign(page, 'top');

    // B1 输入内容并保持居中（默认）
    await clickCell(page, 0, 1);
    await page.keyboard.type('Middle');
    await page.keyboard.press('Enter');

    // C1 输入内容并设置下对齐
    await clickCell(page, 0, 2);
    await page.keyboard.type('Bottom');
    await page.keyboard.press('Enter');
    await clickCell(page, 0, 2);
    await selectVerticalAlign(page, 'bottom');

    // 点击其他单元格取消选中
    await clickCell(page, 2, 2);

    // 截图验证
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-vertical-align-all-three.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
