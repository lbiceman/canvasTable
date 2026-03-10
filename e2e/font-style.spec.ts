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
  fontBold?: boolean;
  fontItalic?: boolean;
  content?: string;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as Record<string, unknown>).app as { getModel: () => { getCell: (row: number, col: number) => { fontBold?: boolean; fontItalic?: boolean; content?: string } | null } };
      const cell = app.getModel().getCell(r, c);
      return {
        fontBold: cell?.fontBold,
        fontItalic: cell?.fontItalic,
        content: cell?.content,
      };
    },
    [row, col] as [number, number],
  );
};

test.describe('字体加粗功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待 Canvas 渲染完成
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('点击加粗按钮应切换单元格的加粗状态', async ({ page }) => {
    // 选中 A1 单元格（第0行第0列）
    await clickCell(page, 0, 0);

    // 验证初始状态：加粗按钮未激活
    const boldBtn = page.locator('#font-bold-btn');
    await expect(boldBtn).not.toHaveClass(/active/);

    // 点击加粗按钮
    await boldBtn.click();

    // 验证按钮变为激活状态
    await expect(boldBtn).toHaveClass(/active/);

    // 验证模型数据中 fontBold 为 true
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.fontBold).toBe(true);
  });

  test('再次点击加粗按钮应取消加粗', async ({ page }) => {
    await clickCell(page, 0, 0);

    const boldBtn = page.locator('#font-bold-btn');

    // 第一次点击：启用加粗
    await boldBtn.click();
    await expect(boldBtn).toHaveClass(/active/);

    // 第二次点击：取消加粗
    await boldBtn.click();
    await expect(boldBtn).not.toHaveClass(/active/);

    // 验证模型数据中 fontBold 为 false
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.fontBold).toBe(false);
  });

  test('对多个单元格分别设置加粗应互不影响', async ({ page }) => {
    const boldBtn = page.locator('#font-bold-btn');

    // 选中 A1 并加粗
    await clickCell(page, 0, 0);
    await boldBtn.click();

    // 选中 B1（第0行第1列），不加粗
    await clickCell(page, 0, 1);

    // 验证 A1 加粗，B1 未加粗
    const cellA1 = await getCellData(page, 0, 0);
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellA1.fontBold).toBe(true);
    expect(cellB1.fontBold).toBeFalsy();
  });

  test('加粗状态应在 Canvas 渲染中体现（截图对比）', async ({ page }) => {
    // 先输入内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('Bold');
    await page.keyboard.press('Enter');

    // 重新选中 A1 并加粗
    await clickCell(page, 0, 0);
    const boldBtn = page.locator('#font-bold-btn');
    await boldBtn.click();

    // 截图验证（视觉回归测试）
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-bold.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('字体斜体功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('点击斜体按钮应切换单元格的斜体状态', async ({ page }) => {
    // 选中 A1
    await clickCell(page, 0, 0);

    // 验证初始状态：斜体按钮未激活
    const italicBtn = page.locator('#font-italic-btn');
    await expect(italicBtn).not.toHaveClass(/active/);

    // 点击斜体按钮
    await italicBtn.click();

    // 验证按钮变为激活状态
    await expect(italicBtn).toHaveClass(/active/);

    // 验证模型数据中 fontItalic 为 true
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.fontItalic).toBe(true);
  });

  test('再次点击斜体按钮应取消斜体', async ({ page }) => {
    await clickCell(page, 0, 0);

    const italicBtn = page.locator('#font-italic-btn');

    // 第一次点击：启用斜体
    await italicBtn.click();
    await expect(italicBtn).toHaveClass(/active/);

    // 第二次点击：取消斜体
    await italicBtn.click();
    await expect(italicBtn).not.toHaveClass(/active/);

    // 验证模型数据中 fontItalic 为 false
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.fontItalic).toBe(false);
  });

  test('对多个单元格分别设置斜体应互不影响', async ({ page }) => {
    const italicBtn = page.locator('#font-italic-btn');

    // 选中 A1 并设置斜体
    await clickCell(page, 0, 0);
    await italicBtn.click();

    // 选中 B1，不设置斜体
    await clickCell(page, 0, 1);

    // 验证 A1 斜体，B1 未斜体
    const cellA1 = await getCellData(page, 0, 0);
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellA1.fontItalic).toBe(true);
    expect(cellB1.fontItalic).toBeFalsy();
  });

  test('斜体状态应在 Canvas 渲染中体现（截图对比）', async ({ page }) => {
    // 先输入内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('Italic');
    await page.keyboard.press('Enter');

    // 重新选中 A1 并设置斜体
    await clickCell(page, 0, 0);
    const italicBtn = page.locator('#font-italic-btn');
    await italicBtn.click();

    // 截图验证
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-italic.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('加粗与斜体组合', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('同一单元格可同时设置加粗和斜体', async ({ page }) => {
    await clickCell(page, 0, 0);

    const boldBtn = page.locator('#font-bold-btn');
    const italicBtn = page.locator('#font-italic-btn');

    // 先加粗，再斜体
    await boldBtn.click();
    await italicBtn.click();

    // 验证两个按钮都激活
    await expect(boldBtn).toHaveClass(/active/);
    await expect(italicBtn).toHaveClass(/active/);

    // 验证模型数据
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.fontBold).toBe(true);
    expect(cellData.fontItalic).toBe(true);
  });

  test('取消加粗不影响斜体状态', async ({ page }) => {
    await clickCell(page, 0, 0);

    const boldBtn = page.locator('#font-bold-btn');
    const italicBtn = page.locator('#font-italic-btn');

    // 同时设置加粗和斜体
    await boldBtn.click();
    await italicBtn.click();

    // 取消加粗
    await boldBtn.click();

    // 验证：加粗取消，斜体保留
    await expect(boldBtn).not.toHaveClass(/active/);
    await expect(italicBtn).toHaveClass(/active/);

    const cellData = await getCellData(page, 0, 0);
    expect(cellData.fontBold).toBe(false);
    expect(cellData.fontItalic).toBe(true);
  });

  test('加粗+斜体应在 Canvas 渲染中体现（截图对比）', async ({ page }) => {
    // 输入内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('BoldItalic');
    await page.keyboard.press('Enter');

    // 重新选中并设置加粗+斜体
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.locator('#font-italic-btn').click();

    // 截图验证
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-bold-italic.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
