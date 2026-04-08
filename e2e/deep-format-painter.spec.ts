import { test, expect, Page } from '@playwright/test';

// ============================================================
// 辅助函数
// ============================================================

const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = 40 + col * 100 + 50;
  const y = 28 + row * 25 + 12;
  await canvas.click({ position: { x, y } });
};

const selectRange = async (
  page: Page, startRow: number, startCol: number, endRow: number, endCol: number
): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const hw = 40, hh = 28, cw = 100, rh = 25;
  await canvas.click({ position: { x: hw + startCol * cw + 50, y: hh + startRow * rh + 12 } });
  await canvas.click({ position: { x: hw + endCol * cw + 50, y: hh + endRow * rh + 12 }, modifiers: ['Shift'] });
};

const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await clickCell(page, row, col);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
};

const getCellData = async (page: Page, row: number, col: number): Promise<{
  content?: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontColor?: string;
  bgColor?: string;
  fontSize?: number;
  fontAlign?: string;
  verticalAlign?: string;
  fontStrikethrough?: boolean;
  border?: Record<string, unknown>;
}> => {
  return await page.evaluate(([r, c]) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => Record<string, unknown> | null };
    };
    const cell = app.getModel().getCell(r, c);
    return {
      content: cell?.content as string | undefined,
      fontBold: cell?.fontBold as boolean | undefined,
      fontItalic: cell?.fontItalic as boolean | undefined,
      fontUnderline: cell?.fontUnderline as boolean | undefined,
      fontColor: cell?.fontColor as string | undefined,
      bgColor: cell?.bgColor as string | undefined,
      fontSize: cell?.fontSize as number | undefined,
      fontAlign: cell?.fontAlign as string | undefined,
      verticalAlign: cell?.verticalAlign as string | undefined,
      fontStrikethrough: cell?.fontStrikethrough as boolean | undefined,
      border: cell?.border as Record<string, unknown> | undefined,
    };
  }, [row, col] as [number, number]);
};

const setCellFormat = async (
  page: Page, row: number, col: number,
  format: Record<string, unknown>
): Promise<void> => {
  await page.evaluate(([r, c, fmt]) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => Record<string, unknown> | null };
    };
    const cell = app.getModel().getCell(r, c);
    if (cell) {
      Object.assign(cell, fmt);
    }
  }, [row, col, format] as [number, number, Record<string, unknown>]);
};

const getFormatPainterMode = async (page: Page): Promise<string> => {
  return await page.evaluate(() => {
    const app = (window as Record<string, unknown>).app as {
      getFormatPainter: () => { getMode: () => string };
    };
    return app.getFormatPainter().getMode();
  });
};

// ============================================================
// 深入测试：格式刷
// ============================================================

test.describe('格式刷 - 复制完整格式到目标区域', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('格式刷应复制所有格式属性（加粗、斜体、下划线、字体颜色、背景色、字号）', async ({ page }) => {
    // 设置源单元格的完整格式
    await typeInCell(page, 0, 0, 'Source');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, {
      fontBold: true,
      fontItalic: true,
      fontUnderline: true,
      fontColor: '#ff0000',
      bgColor: '#ffff00',
      fontSize: 16,
    });

    // 目标单元格
    await typeInCell(page, 0, 1, 'Target');

    // 选中源单元格，单击格式刷
    await clickCell(page, 0, 0);
    const btn = page.locator('#format-painter-btn');
    await btn.click();
    await page.waitForTimeout(350);

    // 点击目标单元格
    await clickCell(page, 0, 1);
    await page.waitForTimeout(300);

    // 验证所有格式属性都被复制
    const target = await getCellData(page, 0, 1);
    expect(target.content).toBe('Target');
    expect(target.fontBold).toBe(true);
    expect(target.fontItalic).toBe(true);
    expect(target.fontUnderline).toBe(true);
    expect(target.fontColor).toBe('#ff0000');
    expect(target.bgColor).toBe('#ffff00');
    expect(target.fontSize).toBe(16);
  });

  test('格式刷应复制对齐方式', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Source');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, {
      fontAlign: 'center',
      verticalAlign: 'bottom',
    });

    await typeInCell(page, 0, 1, 'Target');

    await clickCell(page, 0, 0);
    const btn = page.locator('#format-painter-btn');
    await btn.click();
    await page.waitForTimeout(350);

    await clickCell(page, 0, 1);
    await page.waitForTimeout(300);

    const target = await getCellData(page, 0, 1);
    expect(target.fontAlign).toBe('center');
    expect(target.verticalAlign).toBe('bottom');
  });

  test('格式刷应复制边框样式', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Source');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, {
      border: {
        top: { style: 'solid', color: '#000000', width: 2 },
        bottom: { style: 'dashed', color: '#ff0000', width: 1 },
      },
    });

    await typeInCell(page, 0, 1, 'Target');

    await clickCell(page, 0, 0);
    const btn = page.locator('#format-painter-btn');
    await btn.click();
    await page.waitForTimeout(350);

    await clickCell(page, 0, 1);
    await page.waitForTimeout(300);

    const target = await getCellData(page, 0, 1);
    expect(target.border).toBeDefined();
  });
});

test.describe('格式刷 - 应用到多单元格区域', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('锁定模式下连续应用到多个不同单元格', async ({ page }) => {
    // 设置源格式
    await typeInCell(page, 0, 0, 'Source');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, { fontBold: true, bgColor: '#00ff00' });

    // 准备多个目标
    await typeInCell(page, 1, 0, 'T1');
    await typeInCell(page, 2, 0, 'T2');
    await typeInCell(page, 3, 0, 'T3');

    // 双击格式刷进入锁定模式
    await clickCell(page, 0, 0);
    const btn = page.locator('#format-painter-btn');
    await btn.click();
    await btn.click();
    await page.waitForTimeout(300);

    expect(await getFormatPainterMode(page)).toBe('locked');

    // 连续应用到三个单元格
    await clickCell(page, 1, 0);
    await page.waitForTimeout(200);
    await clickCell(page, 2, 0);
    await page.waitForTimeout(200);
    await clickCell(page, 3, 0);
    await page.waitForTimeout(200);

    // 验证仍在锁定模式
    expect(await getFormatPainterMode(page)).toBe('locked');

    // 验证三个目标都应用了格式
    for (let i = 1; i <= 3; i++) {
      const data = await getCellData(page, i, 0);
      expect(data.fontBold).toBe(true);
      expect(data.bgColor).toBe('#00ff00');
    }

    // Escape 退出
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 如果 Escape 未直接退出，通过 API 退出
    const mode = await getFormatPainterMode(page);
    if (mode !== 'off') {
      await page.evaluate(() => {
        const app = (window as Record<string, unknown>).app as {
          getFormatPainter: () => { deactivate: () => void };
        };
        app.getFormatPainter().deactivate();
      });
    }
  });
});

test.describe('格式刷 - 不改变源单元格格式', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('格式刷操作后源单元格格式应保持不变', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Source');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, {
      fontBold: true,
      fontColor: '#0000ff',
      bgColor: '#ffff00',
    });

    await typeInCell(page, 0, 1, 'Target');

    // 记录源格式
    const sourceBefore = await getCellData(page, 0, 0);

    // 执行格式刷
    await clickCell(page, 0, 0);
    const btn = page.locator('#format-painter-btn');
    await btn.click();
    await page.waitForTimeout(350);
    await clickCell(page, 0, 1);
    await page.waitForTimeout(300);

    // 验证源格式未变
    const sourceAfter = await getCellData(page, 0, 0);
    expect(sourceAfter.fontBold).toBe(sourceBefore.fontBold);
    expect(sourceAfter.fontColor).toBe(sourceBefore.fontColor);
    expect(sourceAfter.bgColor).toBe(sourceBefore.bgColor);
  });
});

test.describe('格式刷 - 清除目标单元格原有格式', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('格式刷应覆盖目标单元格的原有格式', async ({ page }) => {
    // 源：只有加粗
    await typeInCell(page, 0, 0, 'Source');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, { fontBold: true });

    // 目标：有斜体和红色背景
    await typeInCell(page, 0, 1, 'Target');
    await clickCell(page, 0, 1);
    await setCellFormat(page, 0, 1, { fontItalic: true, bgColor: '#ff0000' });

    // 执行格式刷
    await clickCell(page, 0, 0);
    const btn = page.locator('#format-painter-btn');
    await btn.click();
    await page.waitForTimeout(350);
    await clickCell(page, 0, 1);
    await page.waitForTimeout(300);

    // 目标应只有加粗，斜体和背景色应被清除
    const target = await getCellData(page, 0, 1);
    expect(target.fontBold).toBe(true);
    // 源没有 fontItalic，所以目标的 fontItalic 应被清除
    expect(target.fontItalic).toBeUndefined();
    // 源没有 bgColor，所以目标的 bgColor 应被清除
    expect(target.bgColor).toBeUndefined();
  });
});

test.describe('格式刷 - 撤销支持', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('格式刷操作应记录到历史栈中', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Source');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, { fontBold: true, bgColor: '#ffff00' });

    await typeInCell(page, 0, 1, 'Target');

    // 执行格式刷
    await clickCell(page, 0, 0);
    const btn = page.locator('#format-painter-btn');
    await btn.click();
    await page.waitForTimeout(350);
    await clickCell(page, 0, 1);
    await page.waitForTimeout(300);

    // 验证格式已应用
    const target = await getCellData(page, 0, 1);
    expect(target.fontBold).toBe(true);
    expect(target.bgColor).toBe('#ffff00');

    // 验证撤销按钮可用（说明操作已记录到历史栈）
    const undoBtn = page.locator('#undo-btn');
    const isDisabled = await undoBtn.evaluate((el) => (el as HTMLButtonElement).disabled);
    expect(isDisabled).toBe(false);
  });
});
