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
 * 辅助函数：应用指定位置的边框
 */
const applyBorder = async (page: Page, position: string): Promise<void> => {
  await page.locator('#border-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.border-position-option[data-position="${position}"]`).click();
  await page.waitForTimeout(200);
};

/**
 * 辅助函数：获取单元格的完整格式数据（border、fontFamily、fontStrikethrough）
 */
const getCellFormatData = async (
  page: Page,
  row: number,
  col: number,
): Promise<{
  border?: {
    top?: { style: string; color: string; width: number };
    bottom?: { style: string; color: string; width: number };
    left?: { style: string; color: string; width: number };
    right?: { style: string; color: string; width: number };
  };
  fontFamily?: string;
  fontStrikethrough?: boolean;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      const cell = app.getModel().getCell(r, c);
      return {
        border: cell?.border ?? undefined,
        fontFamily: cell?.fontFamily ?? undefined,
        fontStrikethrough: cell?.fontStrikethrough ?? undefined,
      };
    },
    [row, col] as [number, number],
  );
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

test.describe('格式刷集成 - 边框/字体族/删除线', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  /**
   * 需求9.1 - 格式刷复制：
   * A1 设置边框+字体族+删除线，使用格式刷复制 A1 格式，
   * 验证格式数据包含 border/fontFamily/fontStrikethrough
   */
  test('需求9.1 - 格式刷复制包含 border/fontFamily/fontStrikethrough', async ({ page }) => {
    // 选中 A1 并设置全部边框
    await clickCell(page, 0, 0);
    await applyBorder(page, 'all');

    // 设置字体族为 Arial
    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Arial');

    // 设置删除线
    await clickCell(page, 0, 0);
    await page.locator('#font-strikethrough-btn').click();
    await page.waitForTimeout(200);

    // 验证 A1 格式已正确设置
    const a1Format = await getCellFormatData(page, 0, 0);
    expect(a1Format.border).toBeDefined();
    expect(a1Format.border!.top).toBeDefined();
    expect(a1Format.border!.bottom).toBeDefined();
    expect(a1Format.border!.left).toBeDefined();
    expect(a1Format.border!.right).toBeDefined();
    expect(a1Format.fontFamily).toBe('Arial');
    expect(a1Format.fontStrikethrough).toBe(true);

    // 选中 A1，单击格式刷按钮激活
    await clickCell(page, 0, 0);
    const formatPainterBtn = page.locator('#format-painter-btn');
    await formatPainterBtn.click();
    await page.waitForTimeout(350);

    // 验证格式刷已激活
    await expect(formatPainterBtn).toHaveClass(/toolbar-btn-active/);

    // 通过 evaluate 验证格式刷内部复制的格式数据包含 border/fontFamily/fontStrikethrough
    const copiedFormat = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      const fp = app.getFormatPainter();
      // extractFormat 是公开方法，可直接调用验证
      const format = fp.extractFormat(0, 0);
      return {
        hasBorder: format.border !== undefined,
        hasFontFamily: format.fontFamily !== undefined,
        hasFontStrikethrough: format.fontStrikethrough !== undefined,
        fontFamily: format.fontFamily,
        fontStrikethrough: format.fontStrikethrough,
      };
    });

    expect(copiedFormat.hasBorder).toBe(true);
    expect(copiedFormat.hasFontFamily).toBe(true);
    expect(copiedFormat.hasFontStrikethrough).toBe(true);
    expect(copiedFormat.fontFamily).toBe('Arial');
    expect(copiedFormat.fontStrikethrough).toBe(true);
  });

  /**
   * 需求9.2 - 格式刷应用：
   * 格式刷复制 A1 后应用到 B1，验证 B1 的 border/fontFamily/fontStrikethrough 与 A1 一致
   */
  test('需求9.2 - 格式刷应用到 B1，验证格式与 A1 一致', async ({ page }) => {
    // A1 设置全部边框 + 字体族 Arial + 删除线
    await clickCell(page, 0, 0);
    await applyBorder(page, 'all');

    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Arial');

    await clickCell(page, 0, 0);
    await page.locator('#font-strikethrough-btn').click();
    await page.waitForTimeout(200);

    // 记录 A1 的格式数据
    const a1Format = await getCellFormatData(page, 0, 0);

    // 选中 A1，单击格式刷按钮
    await clickCell(page, 0, 0);
    const formatPainterBtn = page.locator('#format-painter-btn');
    await formatPainterBtn.click();
    await page.waitForTimeout(350);

    // 点击 B1 应用格式
    await clickCell(page, 0, 1);
    await page.waitForTimeout(300);

    // 验证格式刷自动退出
    await expect(formatPainterBtn).not.toHaveClass(/toolbar-btn-active/);

    // 验证 B1 的格式与 A1 一致
    const b1Format = await getCellFormatData(page, 0, 1);

    // 验证边框
    expect(b1Format.border).toBeDefined();
    expect(b1Format.border!.top!.style).toBe(a1Format.border!.top!.style);
    expect(b1Format.border!.top!.color).toBe(a1Format.border!.top!.color);
    expect(b1Format.border!.top!.width).toBe(a1Format.border!.top!.width);
    expect(b1Format.border!.bottom).toBeDefined();
    expect(b1Format.border!.left).toBeDefined();
    expect(b1Format.border!.right).toBeDefined();

    // 验证字体族
    expect(b1Format.fontFamily).toBe(a1Format.fontFamily);

    // 验证删除线
    expect(b1Format.fontStrikethrough).toBe(a1Format.fontStrikethrough);
  });

  /**
   * 需求9.3 - 格式刷区域应用：
   * 格式刷复制 A1 后应用到 B1:C2 区域，验证区域内所有单元格格式一致
   */
  test('需求9.3 - 格式刷应用到 B1:C2 区域，验证区域内所有单元格格式一致', async ({ page }) => {
    // A1 设置全部边框 + 字体族 Arial + 删除线
    await clickCell(page, 0, 0);
    await applyBorder(page, 'all');

    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Arial');

    await clickCell(page, 0, 0);
    await page.locator('#font-strikethrough-btn').click();
    await page.waitForTimeout(200);

    // 记录 A1 的格式数据
    const a1Format = await getCellFormatData(page, 0, 0);

    // 选中 A1，双击格式刷按钮进入锁定模式（以便应用到区域）
    await clickCell(page, 0, 0);
    const formatPainterBtn = page.locator('#format-painter-btn');
    await formatPainterBtn.click();
    await page.waitForTimeout(350);

    // 选中 B1:C2 区域应用格式（Shift+点击选择区域）
    await selectRange(page, 0, 1, 1, 2);
    await page.waitForTimeout(300);

    // 验证 B1:C2 区域内所有单元格格式与 A1 一致
    for (let row = 0; row <= 1; row++) {
      for (let col = 1; col <= 2; col++) {
        const cellFormat = await getCellFormatData(page, row, col);

        // 验证边框存在
        expect(cellFormat.border, `单元格 (${row},${col}) 应有边框`).toBeDefined();
        expect(cellFormat.border!.top, `单元格 (${row},${col}) 应有上边框`).toBeDefined();
        expect(cellFormat.border!.top!.style).toBe(a1Format.border!.top!.style);
        expect(cellFormat.border!.top!.color).toBe(a1Format.border!.top!.color);

        // 验证字体族
        expect(cellFormat.fontFamily, `单元格 (${row},${col}) fontFamily 应为 Arial`).toBe(a1Format.fontFamily);

        // 验证删除线
        expect(cellFormat.fontStrikethrough, `单元格 (${row},${col}) fontStrikethrough 应为 true`).toBe(
          a1Format.fontStrikethrough,
        );
      }
    }
  });
});
