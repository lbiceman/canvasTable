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
  fontAlign?: 'left' | 'center' | 'right';
  content?: string;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            fontAlign?: 'left' | 'center' | 'right';
            content?: string;
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return {
        fontAlign: cell?.fontAlign,
        content: cell?.content,
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：选择水平对齐选项
 * 点击水平对齐按钮打开下拉菜单，然后点击指定的对齐选项
 */
const selectHorizontalAlign = async (page: Page, align: 'left' | 'center' | 'right'): Promise<void> => {
  // 点击水平对齐按钮打开下拉菜单
  await page.locator('#horizontal-align-btn').click();
  // 等待下拉菜单出现
  await page.waitForTimeout(200);
  // 点击对应的对齐选项
  await page.locator(`.horizontal-align-option[data-align="${align}"]`).click();
};

test.describe('水平对齐下拉按钮组', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待 Canvas 渲染完成
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('初始状态：下拉菜单隐藏，默认显示左对齐', async ({ page }) => {
    // 验证主按钮文字为"左对齐"
    const alignText = page.locator('#horizontal-align-text');
    await expect(alignText).toHaveText('左对齐');

    // 验证下拉菜单默认隐藏（不含 visible 类）
    const dropdown = page.locator('#horizontal-align-dropdown');
    await expect(dropdown).not.toHaveClass(/visible/);

    // 验证"左对齐"选项默认含 active 类
    const leftOption = page.locator('#font-align-left-btn');
    await expect(leftOption).toHaveClass(/active/);
  });

  test('点击主按钮应切换下拉菜单显示/隐藏', async ({ page }) => {
    const dropdown = page.locator('#horizontal-align-dropdown');
    const btn = page.locator('#horizontal-align-btn');

    // 点击按钮，下拉菜单应显示
    await btn.click();
    await expect(dropdown).toHaveClass(/visible/);

    // 再次点击，下拉菜单应隐藏
    await btn.click();
    await expect(dropdown).not.toHaveClass(/visible/);
  });

  test('点击居中对齐应设置单元格水平对齐为 center', async ({ page }) => {
    // 选中 A1 单元格
    await clickCell(page, 0, 0);

    // 选择居中对齐
    await selectHorizontalAlign(page, 'center');

    // 验证按钮文本更新为"居中"
    const alignText = page.locator('#horizontal-align-text');
    await expect(alignText).toHaveText('居中');

    // 验证模型数据中 fontAlign 为 'center'
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.fontAlign).toBe('center');
  });

  test('点击右对齐应设置单元格水平对齐为 right', async ({ page }) => {
    await clickCell(page, 0, 0);

    await selectHorizontalAlign(page, 'right');

    const alignText = page.locator('#horizontal-align-text');
    await expect(alignText).toHaveText('右对齐');

    const cellData = await getCellData(page, 0, 0);
    expect(cellData.fontAlign).toBe('right');
  });

  test('选择选项后下拉菜单应自动关闭', async ({ page }) => {
    await clickCell(page, 0, 0);

    // 打开下拉菜单
    await page.locator('#horizontal-align-btn').click();
    const dropdown = page.locator('#horizontal-align-dropdown');
    await expect(dropdown).toHaveClass(/visible/);

    // 点击选项
    await page.locator('#font-align-center-btn').click();

    // 下拉菜单应关闭
    await expect(dropdown).not.toHaveClass(/visible/);
  });

  test('选中状态唯一性：有且仅有一个选项处于 active 状态', async ({ page }) => {
    await clickCell(page, 0, 0);

    // 选择右对齐
    await selectHorizontalAlign(page, 'right');

    // 验证只有右对齐选项有 active 类
    const leftOption = page.locator('#font-align-left-btn');
    const centerOption = page.locator('#font-align-center-btn');
    const rightOption = page.locator('#font-align-right-btn');

    await expect(leftOption).not.toHaveClass(/active/);
    await expect(centerOption).not.toHaveClass(/active/);
    await expect(rightOption).toHaveClass(/active/);
  });

  test('对多个单元格分别设置水平对齐应互不影响', async ({ page }) => {
    // A1 设置为居中
    await clickCell(page, 0, 0);
    await selectHorizontalAlign(page, 'center');

    // B1 设置为右对齐
    await clickCell(page, 0, 1);
    await selectHorizontalAlign(page, 'right');

    // A2 不做设置（保持默认）
    await clickCell(page, 1, 0);

    // 验证三个单元格的水平对齐值互不影响
    const cellA1 = await getCellData(page, 0, 0);
    const cellB1 = await getCellData(page, 0, 1);
    const cellA2 = await getCellData(page, 1, 0);

    expect(cellA1.fontAlign).toBe('center');
    expect(cellB1.fontAlign).toBe('right');
    // A2 未设置，应为 undefined 或 'left'
    expect(cellA2.fontAlign === undefined || cellA2.fontAlign === 'left').toBeTruthy();
  });

  test('选中单元格时工具栏应同步显示当前水平对齐状态', async ({ page }) => {
    const alignText = page.locator('#horizontal-align-text');

    // 选中 A1 并设置为右对齐
    await clickCell(page, 0, 0);
    await selectHorizontalAlign(page, 'right');

    // 选中 B1（默认左对齐）
    await clickCell(page, 0, 1);
    await expect(alignText).toHaveText('左对齐');

    // 重新选中 A1，工具栏应显示"右对齐"
    await clickCell(page, 0, 0);
    await expect(alignText).toHaveText('右对齐');
  });

  test('居中对齐应在 Canvas 渲染中体现（截图对比）', async ({ page }) => {
    // 输入内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('Center');
    await page.keyboard.press('Enter');

    // 重新选中 A1 并设置居中对齐
    await clickCell(page, 0, 0);
    await selectHorizontalAlign(page, 'center');

    // 点击其他单元格取消选中
    await clickCell(page, 2, 2);

    // 截图验证
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-horizontal-align-center.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('右对齐应在 Canvas 渲染中体现（截图对比）', async ({ page }) => {
    // 输入内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('Right');
    await page.keyboard.press('Enter');

    // 重新选中 A1 并设置右对齐
    await clickCell(page, 0, 0);
    await selectHorizontalAlign(page, 'right');

    // 点击其他单元格取消选中
    await clickCell(page, 2, 2);

    // 截图验证
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-horizontal-align-right.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('三种水平对齐同时存在（截图对比）', async ({ page }) => {
    // A1 输入内容并保持左对齐（默认）
    await clickCell(page, 0, 0);
    await page.keyboard.type('Left');
    await page.keyboard.press('Enter');

    // B1 输入内容并设置居中
    await clickCell(page, 0, 1);
    await page.keyboard.type('Center');
    await page.keyboard.press('Enter');
    await clickCell(page, 0, 1);
    await selectHorizontalAlign(page, 'center');

    // C1 输入内容并设置右对齐
    await clickCell(page, 0, 2);
    await page.keyboard.type('Right');
    await page.keyboard.press('Enter');
    await clickCell(page, 0, 2);
    await selectHorizontalAlign(page, 'right');

    // 点击其他单元格取消选中
    await clickCell(page, 2, 2);

    // 截图验证
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-horizontal-align-all-three.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
