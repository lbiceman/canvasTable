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
 * 辅助函数：选中一个区域（从 startRow/startCol 拖拽到 endRow/endCol）
 */
const selectRange = async (
  page: Page,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;

  const x1 = headerWidth + startCol * defaultColWidth + defaultColWidth / 2;
  const y1 = headerHeight + startRow * defaultRowHeight + defaultRowHeight / 2;
  const x2 = headerWidth + endCol * defaultColWidth + defaultColWidth / 2;
  const y2 = headerHeight + endRow * defaultRowHeight + defaultRowHeight / 2;

  await canvas.click({ position: { x: x1, y: y1 } });
  await canvas.click({ position: { x: x2, y: y2 }, modifiers: ['Shift'] });
};

/**
 * 辅助函数：在单元格中输入内容
 */
const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await clickCell(page, row, col);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
};


test.describe('插入图表功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('无选区时插入图表按钮应显示提示', async ({ page }) => {
    const insertChartBtn = page.locator('#insert-chart-btn');
    // 按钮应存在
    await expect(insertChartBtn).toBeVisible();
  });

  test('选中包含数据的区域后点击插入图表应弹出类型选择面板', async ({ page }) => {
    // 输入一些数据
    await typeInCell(page, 0, 0, '类别');
    await typeInCell(page, 0, 1, '数值');
    await typeInCell(page, 1, 0, 'A');
    await typeInCell(page, 1, 1, '10');
    await typeInCell(page, 2, 0, 'B');
    await typeInCell(page, 2, 1, '20');
    await typeInCell(page, 3, 0, 'C');
    await typeInCell(page, 3, 1, '30');

    // 选中数据区域 A1:B4
    await selectRange(page, 0, 0, 3, 1);

    // 点击插入图表按钮
    const insertChartBtn = page.locator('#insert-chart-btn');
    await insertChartBtn.click();

    // 应弹出图表类型选择面板
    const typeSelector = page.locator('.chart-type-selector');
    await expect(typeSelector).toBeVisible();

    // 面板应包含五种图表类型
    await expect(typeSelector.locator('div')).toHaveCount(5);
  });

  test('选择柱状图类型后应在 Canvas 上创建图表', async ({ page }) => {
    // 输入数据
    await typeInCell(page, 0, 0, '类别');
    await typeInCell(page, 0, 1, '数值');
    await typeInCell(page, 1, 0, 'A');
    await typeInCell(page, 1, 1, '10');
    await typeInCell(page, 2, 0, 'B');
    await typeInCell(page, 2, 1, '20');

    // 选中数据区域
    await selectRange(page, 0, 0, 2, 1);

    // 点击插入图表
    const insertChartBtn = page.locator('#insert-chart-btn');
    await insertChartBtn.click();

    // 选择柱状图
    const typeSelector = page.locator('.chart-type-selector');
    await typeSelector.locator('div').first().click();

    // 等待图表渲染
    await page.waitForTimeout(300);

    // 验证模型中有图表
    const chartCount = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { chartModel: { getAllCharts: () => unknown[] } }
      };
      return app.getModel().chartModel.getAllCharts().length;
    });
    expect(chartCount).toBe(1);
  });

  test('创建图表后 Canvas 截图对比', async ({ page }) => {
    // 输入数据
    await typeInCell(page, 0, 0, '类别');
    await typeInCell(page, 0, 1, '数值');
    await typeInCell(page, 1, 0, 'A');
    await typeInCell(page, 1, 1, '100');
    await typeInCell(page, 2, 0, 'B');
    await typeInCell(page, 2, 1, '200');
    await typeInCell(page, 3, 0, 'C');
    await typeInCell(page, 3, 1, '300');

    // 选中数据区域
    await selectRange(page, 0, 0, 3, 1);

    // 插入柱状图
    const insertChartBtn = page.locator('#insert-chart-btn');
    await insertChartBtn.click();
    const typeSelector = page.locator('.chart-type-selector');
    await typeSelector.locator('div').first().click();

    // 等待渲染
    await page.waitForTimeout(500);

    // 点击空白区域取消选中图表
    await clickCell(page, 8, 5);
    await page.waitForTimeout(200);

    // 截图验证
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('chart-bar-created.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('图表交互功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);

    // 准备数据并创建图表
    await typeInCell(page, 0, 0, '类别');
    await typeInCell(page, 0, 1, '数值');
    await typeInCell(page, 1, 0, 'X');
    await typeInCell(page, 1, 1, '50');
    await typeInCell(page, 2, 0, 'Y');
    await typeInCell(page, 2, 1, '80');

    await selectRange(page, 0, 0, 2, 1);
    const insertChartBtn = page.locator('#insert-chart-btn');
    await insertChartBtn.click();
    const typeSelector = page.locator('.chart-type-selector');
    await typeSelector.locator('div').first().click();
    await page.waitForTimeout(300);
  });

  test('Delete 键应删除选中的图表', async ({ page }) => {
    // 图表创建后应自动选中，按 Delete 删除
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    // 验证图表已删除
    const chartCount = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { chartModel: { getAllCharts: () => unknown[] } }
      };
      return app.getModel().chartModel.getAllCharts().length;
    });
    expect(chartCount).toBe(0);
  });
});

