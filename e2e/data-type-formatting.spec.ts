import { test, expect, Page } from '@playwright/test';

/**
 * 辅助函数：点击 Canvas 上指定单元格
 * headerWidth=40, headerHeight=28，默认列宽=100，默认行高=25
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
  content?: string;
  dataType?: string;
  rawValue?: number;
  wrapText?: boolean;
  format?: { category?: string; pattern?: string; currencySymbol?: string };
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            content?: string;
            dataType?: string;
            rawValue?: number;
            wrapText?: boolean;
            format?: { category?: string; pattern?: string; currencySymbol?: string };
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return {
        content: cell?.content,
        dataType: cell?.dataType,
        rawValue: cell?.rawValue,
        wrapText: cell?.wrapText,
        format: cell?.format,
      };
    },
    [row, col] as [number, number],
  );
};

test.describe('数字格式下拉菜单', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('选择货币格式应更新单元格格式', async ({ page }) => {
    // 输入数字内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('1234.56');
    await page.keyboard.press('Enter');

    // 重新选中 A1
    await clickCell(page, 0, 0);

    // 打开数字格式下拉菜单
    const formatBtn = page.locator('#number-format-btn');
    await formatBtn.click();

    // 选择货币格式
    const currencyOption = page.locator('.number-format-option[data-format="currency"]');
    await currencyOption.click();

    // 验证模型数据
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.format?.category).toBe('currency');
  });

  test('选择百分比格式应更新单元格格式', async ({ page }) => {
    // 输入数字内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('0.75');
    await page.keyboard.press('Enter');

    // 重新选中 A1
    await clickCell(page, 0, 0);

    // 打开数字格式下拉菜单并选择百分比
    await page.locator('#number-format-btn').click();
    const percentOption = page.locator('.number-format-option[data-format="percentage"]');
    await percentOption.click();

    // 验证模型数据
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.format?.category).toBe('percentage');
  });

  test('不同单元格可设置不同格式互不影响', async ({ page }) => {
    // A1 输入数字并设置货币格式
    await clickCell(page, 0, 0);
    await page.keyboard.type('100');
    await page.keyboard.press('Enter');
    await clickCell(page, 0, 0);
    await page.locator('#number-format-btn').click();
    await page.locator('.number-format-option[data-format="currency"]').click();

    // B1 输入数字，不设置格式
    await clickCell(page, 0, 1);
    await page.keyboard.type('200');
    await page.keyboard.press('Enter');

    // 验证 A1 有货币格式，B1 为自动检测的 number 格式（非货币）
    const cellA1 = await getCellData(page, 0, 0);
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellA1.format?.category).toBe('currency');
    expect(cellB1.format?.category).not.toBe('currency');
  });

  test('数字格式应在 Canvas 渲染中体现（截图对比）', async ({ page }) => {
    // 输入数字并设置货币格式
    await clickCell(page, 0, 0);
    await page.keyboard.type('1234.56');
    await page.keyboard.press('Enter');
    await clickCell(page, 0, 0);
    await page.locator('#number-format-btn').click();
    await page.locator('.number-format-option[data-format="currency"]').click();

    // 等待渲染
    await page.waitForTimeout(300);

    // 截图验证
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-currency-format.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('自动换行功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('点击换行按钮应切换单元格的换行状态', async ({ page }) => {
    // 选中 A1
    await clickCell(page, 0, 0);

    // 验证初始状态：换行按钮未激活
    const wrapBtn = page.locator('#wrap-text-btn');
    await expect(wrapBtn).not.toHaveClass(/active/);

    // 点击换行按钮
    await wrapBtn.click();

    // 验证按钮变为激活状态
    await expect(wrapBtn).toHaveClass(/active/);

    // 验证模型数据中 wrapText 为 true
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.wrapText).toBe(true);
  });

  test('再次点击换行按钮应取消换行', async ({ page }) => {
    await clickCell(page, 0, 0);

    const wrapBtn = page.locator('#wrap-text-btn');

    // 第一次点击：启用换行
    await wrapBtn.click();
    await expect(wrapBtn).toHaveClass(/active/);

    // 第二次点击：取消换行
    await wrapBtn.click();
    await expect(wrapBtn).not.toHaveClass(/active/);

    // 验证模型数据中 wrapText 为 false
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.wrapText).toBe(false);
  });

  test('对多个单元格分别设置换行应互不影响', async ({ page }) => {
    const wrapBtn = page.locator('#wrap-text-btn');

    // 选中 A1 并启用换行
    await clickCell(page, 0, 0);
    await wrapBtn.click();

    // 选中 B1，不启用换行
    await clickCell(page, 0, 1);

    // 验证 A1 换行，B1 未换行
    const cellA1 = await getCellData(page, 0, 0);
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellA1.wrapText).toBe(true);
    expect(cellB1.wrapText).toBeFalsy();
  });

  test('换行状态应在 Canvas 渲染中体现（截图对比）', async ({ page }) => {
    // 输入长文本内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('这是一段很长的文本内容用于测试自动换行功能');
    await page.keyboard.press('Enter');

    // 重新选中 A1 并启用换行
    await clickCell(page, 0, 0);
    await page.locator('#wrap-text-btn').click();

    // 等待渲染
    await page.waitForTimeout(300);

    // 截图验证
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-wrap-text.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('自动类型检测', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('输入纯数字应自动检测为 number 类型', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('12345');
    await page.keyboard.press('Enter');

    const cellData = await getCellData(page, 0, 0);
    expect(cellData.dataType).toBe('number');
    expect(cellData.rawValue).toBe(12345);
  });

  test('输入百分比应自动检测为 percentage 类型', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('75%');
    await page.keyboard.press('Enter');

    const cellData = await getCellData(page, 0, 0);
    expect(cellData.dataType).toBe('percentage');
    expect(cellData.rawValue).toBeCloseTo(0.75, 4);
  });

  test('输入普通文本应检测为 text 类型', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('hello world');
    await page.keyboard.press('Enter');

    const cellData = await getCellData(page, 0, 0);
    expect(cellData.dataType).toBe('text');
  });
});
