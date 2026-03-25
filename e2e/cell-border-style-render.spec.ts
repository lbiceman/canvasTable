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
 * 辅助函数：选择边框线型后应用边框
 * 先打开下拉面板，选择线型，再点击位置选项
 */
const applyBorderWithStyle = async (
  page: Page,
  style: string,
  position: string,
): Promise<void> => {
  await page.locator('#border-btn').click();
  await page.waitForTimeout(200);
  // 选择线型
  await page.locator(`.border-style-option[data-style="${style}"]`).click();
  await page.waitForTimeout(100);
  // 点击位置选项应用边框
  await page.locator(`.border-position-option[data-position="${position}"]`).click();
  await page.waitForTimeout(200);
};

/**
 * 辅助函数：设置边框颜色后应用边框
 */
const applyBorderWithColor = async (
  page: Page,
  color: string,
  position: string,
): Promise<void> => {
  await page.locator('#border-btn').click();
  await page.waitForTimeout(200);
  // 设置颜色
  await page.locator('#border-color').fill(color);
  await page.waitForTimeout(100);
  // 点击位置选项应用边框
  await page.locator(`.border-position-option[data-position="${position}"]`).click();
  await page.waitForTimeout(200);
};

/**
 * 辅助函数：应用指定位置的边框（使用当前默认线型和颜色）
 */
const applyBorder = async (page: Page, position: string): Promise<void> => {
  await page.locator('#border-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.border-position-option[data-position="${position}"]`).click();
  await page.waitForTimeout(200);
};

/**
 * 辅助函数：获取单元格边框数据
 */
const getCellBorder = async (
  page: Page,
  row: number,
  col: number,
): Promise<{
  top?: { style: string; color: string; width: number };
  bottom?: { style: string; color: string; width: number };
  left?: { style: string; color: string; width: number };
  right?: { style: string; color: string; width: number };
} | null> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => { border?: Record<string, unknown> } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell || !cell.border) return null;
      return cell.border as {
        top?: { style: string; color: string; width: number };
        bottom?: { style: string; color: string; width: number };
        left?: { style: string; color: string; width: number };
        right?: { style: string; color: string; width: number };
      };
    },
    [row, col] as [number, number],
  );
};


test.describe('边框线型选择验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求3.1 - 选择实线后应用边框，border.top.style 为 solid', async ({ page }) => {
    await clickCell(page, 0, 0);
    await applyBorderWithStyle(page, 'solid', 'top');

    const border = await getCellBorder(page, 0, 0);
    expect(border).not.toBeNull();
    expect(border!.top).toBeDefined();
    expect(border!.top!.style).toBe('solid');
  });

  test('需求3.1 - 选择虚线后应用边框，border.top.style 为 dashed', async ({ page }) => {
    await clickCell(page, 0, 0);
    await applyBorderWithStyle(page, 'dashed', 'top');

    const border = await getCellBorder(page, 0, 0);
    expect(border).not.toBeNull();
    expect(border!.top).toBeDefined();
    expect(border!.top!.style).toBe('dashed');
  });

  test('需求3.1 - 选择点线后应用边框，border.top.style 为 dotted', async ({ page }) => {
    await clickCell(page, 0, 0);
    await applyBorderWithStyle(page, 'dotted', 'top');

    const border = await getCellBorder(page, 0, 0);
    expect(border).not.toBeNull();
    expect(border!.top).toBeDefined();
    expect(border!.top!.style).toBe('dotted');
  });

  test('需求3.1 - 选择双线后应用边框，border.top.style 为 double', async ({ page }) => {
    await clickCell(page, 0, 0);
    await applyBorderWithStyle(page, 'double', 'top');

    const border = await getCellBorder(page, 0, 0);
    expect(border).not.toBeNull();
    expect(border!.top).toBeDefined();
    expect(border!.top!.style).toBe('double');
  });
});

test.describe('边框颜色选择验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求3.2 - 设置边框颜色为 #ff0000，验证 border.top.color', async ({ page }) => {
    await clickCell(page, 0, 0);
    await applyBorderWithColor(page, '#ff0000', 'top');

    const border = await getCellBorder(page, 0, 0);
    expect(border).not.toBeNull();
    expect(border!.top).toBeDefined();
    expect(border!.top!.color).toBe('#ff0000');
  });
});

test.describe('边框默认值验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求3.4 - 首次打开面板，默认线型 solid、默认颜色 #000000、默认宽度 1', async ({ page }) => {
    // 使用默认值直接应用边框
    await clickCell(page, 0, 0);
    await applyBorder(page, 'top');

    const border = await getCellBorder(page, 0, 0);
    expect(border).not.toBeNull();
    expect(border!.top).toBeDefined();
    expect(border!.top!.style).toBe('solid');
    expect(border!.top!.color).toBe('#000000');
    expect(border!.top!.width).toBe(1);
  });
});


test.describe('边框渲染截图验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求4.1 - 设置全部边框后 Canvas 截图对比', async ({ page }) => {
    // 选中 A1:C3 区域并设置全部边框
    await selectRange(page, 0, 0, 2, 2);
    await applyBorder(page, 'all');
    await page.waitForTimeout(300);

    // Canvas 截图对比，验证边框线绘制在网格线之上
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('border-all-render.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('需求4.2 - solid 实线渲染截图对比', async ({ page }) => {
    await selectRange(page, 0, 0, 2, 2);
    await applyBorderWithStyle(page, 'solid', 'all');
    await page.waitForTimeout(300);

    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('border-solid-render.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('需求4.3 - dashed 虚线渲染截图对比', async ({ page }) => {
    await selectRange(page, 0, 0, 2, 2);
    await applyBorderWithStyle(page, 'dashed', 'all');
    await page.waitForTimeout(300);

    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('border-dashed-render.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('需求4.4 - dotted 点线渲染截图对比', async ({ page }) => {
    await selectRange(page, 0, 0, 2, 2);
    await applyBorderWithStyle(page, 'dotted', 'all');
    await page.waitForTimeout(300);

    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('border-dotted-render.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('需求4.5 - double 双线渲染截图对比', async ({ page }) => {
    await selectRange(page, 0, 0, 2, 2);
    await applyBorderWithStyle(page, 'double', 'all');
    await page.waitForTimeout(300);

    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('border-double-render.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
