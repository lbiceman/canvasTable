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
 * 辅助函数：选中单元格区域（点击起始单元格，Shift+点击结束单元格）
 */
const selectRange = async (
  page: Page,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
): Promise<void> => {
  await clickCell(page, startRow, startCol);
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;
  const x = headerWidth + endCol * defaultColWidth + defaultColWidth / 2;
  const y = headerHeight + endRow * defaultRowHeight + defaultRowHeight / 2;
  await canvas.click({ position: { x, y }, modifiers: ['Shift'] });
};

/**
 * 辅助函数：获取单元格的 fontFamily 属性
 */
const getCellFontFamily = async (page: Page, row: number, col: number): Promise<string | undefined> => {
  return await page.evaluate(([r, c]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as any).app;
    const cell = app.getModel().getCell(r, c);
    return cell?.fontFamily;
  }, [row, col]);
};

/**
 * 辅助函数：从字体族下拉中选择指定字体
 */
const selectFontFamily = async (page: Page, fontName: string): Promise<void> => {
  await page.locator('#font-family-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.font-family-option[data-font="${fontName}"]`).click();
  await page.waitForTimeout(200);
};

test.describe('字体族选择功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求5.1 - fontFamily 属性：设置字体族后 Cell 对象包含 fontFamily 字符串属性', async ({ page }) => {
    // 选中 A1 并设置字体族为 Arial
    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Arial');

    // 验证 Cell 对象包含 fontFamily 属性且为字符串
    const fontFamily = await getCellFontFamily(page, 0, 0);
    expect(fontFamily).toBeDefined();
    expect(typeof fontFamily).toBe('string');
    expect(fontFamily).toBe('Arial');
  });

  test('需求5.2 - 预设字体列表：字体族下拉包含全部 7 种预设字体选项', async ({ page }) => {
    // 点击字体族下拉按钮展开面板
    await page.locator('#font-family-btn').click();
    await page.waitForTimeout(200);

    // 验证下拉面板可见
    const dropdown = page.locator('#font-family-dropdown');
    await expect(dropdown).toBeVisible();

    // 验证包含全部 7 种预设字体选项
    const expectedFonts = [
      'SimSun',
      'Microsoft YaHei',
      'SimHei',
      'KaiTi',
      'Arial',
      'Times New Roman',
      'Courier New',
    ];

    for (const font of expectedFonts) {
      const option = page.locator(`.font-family-option[data-font="${font}"]`);
      await expect(option, `应包含字体选项: ${font}`).toBeVisible();
    }

    // 验证选项总数为 7
    const options = page.locator('.font-family-option');
    await expect(options).toHaveCount(7);
  });

  test('需求5.3 - 设置字体族：选中 A1:B2 区域，选择 Arial，验证区域内所有单元格 fontFamily 为 Arial', async ({ page }) => {
    // 选中 A1:B2 区域（行0-1，列0-1）
    await selectRange(page, 0, 0, 1, 1);
    await selectFontFamily(page, 'Arial');

    // 验证区域内所有单元格的 fontFamily 均为 Arial
    for (let row = 0; row <= 1; row++) {
      for (let col = 0; col <= 1; col++) {
        const fontFamily = await getCellFontFamily(page, row, col);
        expect(fontFamily, `单元格 (${row},${col}) 的 fontFamily 应为 Arial`).toBe('Arial');
      }
    }
  });

  test('需求5.4 - 字体族渲染：输入文本后设置不同字体族，Canvas 截图对比', async ({ page }) => {
    // 在 A1 输入文本
    await clickCell(page, 0, 0);
    await page.keyboard.type('FontTest');
    await page.keyboard.press('Enter');

    // 重新选中 A1 并设置字体族为 Courier New（等宽字体，视觉差异明显）
    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Courier New');

    // 截图验证字体渲染效果
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-font-family-courier.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('需求5.5 - 默认字体族：未设置 fontFamily 的单元格使用默认字体族渲染', async ({ page }) => {
    // 在 A1 输入文本但不设置字体族
    await clickCell(page, 0, 0);
    await page.keyboard.type('DefaultFont');
    await page.keyboard.press('Enter');

    // 验证 fontFamily 属性未设置（undefined）
    const fontFamily = await getCellFontFamily(page, 0, 0);
    expect(fontFamily).toBeUndefined();

    // 截图验证使用默认字体族渲染
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('cell-font-family-default.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('需求5.6 - 撤销重做：设置字体族后 Ctrl+Z 撤销，Ctrl+Y 重做', async ({ page }) => {
    // 选中 A1 并设置字体族为 Arial
    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Arial');

    // 验证字体族已设置
    let fontFamily = await getCellFontFamily(page, 0, 0);
    expect(fontFamily).toBe('Arial');

    // Ctrl+Z 撤销
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // 验证字体族恢复为 undefined
    fontFamily = await getCellFontFamily(page, 0, 0);
    expect(fontFamily).toBeUndefined();

    // Ctrl+Y 重做
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);

    // 验证字体族重新设置为 Arial
    fontFamily = await getCellFontFamily(page, 0, 0);
    expect(fontFamily).toBe('Arial');
  });

  test('需求5.7 - 状态同步：选中已设置字体族的单元格，下拉显示对应字体名称', async ({ page }) => {
    // 在 A1 设置字体族为 Arial
    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Arial');

    // 选中其他单元格再回到 A1
    await clickCell(page, 1, 0);
    await page.waitForTimeout(200);
    await clickCell(page, 0, 0);
    await page.waitForTimeout(200);

    // 验证字体族下拉显示文本为 "Arial"
    const fontFamilyText = page.locator('#font-family-text');
    await expect(fontFamilyText).toHaveText('Arial');

    // 在 B1 设置字体族为 SimSun
    await clickCell(page, 0, 1);
    await selectFontFamily(page, 'SimSun');

    // 选中 A1:B1（两个不同字体族的单元格）
    await selectRange(page, 0, 0, 0, 1);
    await page.waitForTimeout(200);

    // 验证字体族下拉显示为空（多个不同字体族时）
    await expect(fontFamilyText).toHaveText('');
  });
});
