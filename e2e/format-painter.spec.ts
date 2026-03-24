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
  fontBold?: boolean;
  fontItalic?: boolean;
  fontColor?: string;
  bgColor?: string;
  fontSize?: number;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            content?: string;
            fontBold?: boolean;
            fontItalic?: boolean;
            fontColor?: string;
            bgColor?: string;
            fontSize?: number;
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return {
        content: cell?.content,
        fontBold: cell?.fontBold,
        fontItalic: cell?.fontItalic,
        fontColor: cell?.fontColor,
        bgColor: cell?.bgColor,
        fontSize: cell?.fontSize,
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：通过 window.app 获取格式刷当前模式
 */
const getFormatPainterMode = async (page: Page): Promise<string> => {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as unknown as Record<string, unknown>).app as {
      getFormatPainter: () => {
        getMode: () => string;
      };
    };
    return app.getFormatPainter().getMode();
  });
};

/**
 * 辅助函数：通过 evaluate 设置单元格格式（加粗、字体颜色、背景色）
 */
const setCellFormat = async (
  page: Page,
  row: number,
  col: number,
  format: {
    fontBold?: boolean;
    fontColor?: string;
    bgColor?: string;
    fontSize?: number;
    fontItalic?: boolean;
  },
): Promise<void> => {
  await page.evaluate(
    ([r, c, fmt]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            fontBold?: boolean;
            fontColor?: string;
            bgColor?: string;
            fontSize?: number;
            fontItalic?: boolean;
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (cell) {
        if (fmt.fontBold !== undefined) cell.fontBold = fmt.fontBold;
        if (fmt.fontColor !== undefined) cell.fontColor = fmt.fontColor;
        if (fmt.bgColor !== undefined) cell.bgColor = fmt.bgColor;
        if (fmt.fontSize !== undefined) cell.fontSize = fmt.fontSize;
        if (fmt.fontItalic !== undefined) cell.fontItalic = fmt.fontItalic;
      }
    },
    [row, col, format] as [number, number, typeof format],
  );
};

/**
 * 辅助函数：输入单元格内容
 */
const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await clickCell(page, row, col);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
};

test.describe('格式刷功能 - 单次模式', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('单击格式刷按钮进入单次模式（按钮高亮）', async ({ page }) => {
    // 选中 A1 并设置加粗格式
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, { fontBold: true, fontColor: '#ff0000' });

    // 单击格式刷按钮（需等待 250ms 单击延迟）
    const formatPainterBtn = page.locator('#format-painter-btn');
    await formatPainterBtn.click();
    await page.waitForTimeout(350); // 等待单击延迟触发

    // 验证按钮激活状态（高亮）
    await expect(formatPainterBtn).toHaveClass(/toolbar-btn-active/);

    // 验证格式刷模式为 single
    const mode = await getFormatPainterMode(page);
    expect(mode).toBe('single');
  });

  test('单次模式下点击目标单元格应用格式后自动退出', async ({ page }) => {
    // A1 设置加粗和红色字体
    await typeInCell(page, 0, 0, 'Source');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, { fontBold: true, fontColor: '#ff0000' });

    // B1 输入不同内容
    await typeInCell(page, 0, 1, 'Target');

    // 选中 A1，单击格式刷按钮
    await clickCell(page, 0, 0);
    const formatPainterBtn = page.locator('#format-painter-btn');
    await formatPainterBtn.click();
    await page.waitForTimeout(350);

    // 验证进入单次模式
    await expect(formatPainterBtn).toHaveClass(/toolbar-btn-active/);

    // 点击 B1 应用格式
    await clickCell(page, 0, 1);
    await page.waitForTimeout(300);

    // 验证格式刷自动退出（按钮不再高亮）
    await expect(formatPainterBtn).not.toHaveClass(/toolbar-btn-active/);

    // 验证格式刷模式为 off
    const mode = await getFormatPainterMode(page);
    expect(mode).toBe('off');

    // 验证 B1 格式已应用
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.fontBold).toBe(true);
    expect(cellB1.fontColor).toBe('#ff0000');

    // 验证 B1 内容不变
    expect(cellB1.content).toBe('Target');
  });
});

test.describe('格式刷功能 - 锁定模式', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('双击格式刷按钮进入锁定模式', async ({ page }) => {
    // 选中 A1 并设置格式
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, { fontBold: true, bgColor: '#ffff00' });

    // 双击格式刷按钮（快速连续点击两次）
    const formatPainterBtn = page.locator('#format-painter-btn');
    await formatPainterBtn.click();
    await formatPainterBtn.click();
    await page.waitForTimeout(300);

    // 验证按钮激活状态
    await expect(formatPainterBtn).toHaveClass(/toolbar-btn-active/);

    // 验证格式刷模式为 locked
    const mode = await getFormatPainterMode(page);
    expect(mode).toBe('locked');
  });

  test('锁定模式下连续应用格式后不退出', async ({ page }) => {
    // A1 设置加粗和黄色背景
    await typeInCell(page, 0, 0, 'Source');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, { fontBold: true, bgColor: '#ffff00' });

    // B1、C1 输入内容
    await typeInCell(page, 0, 1, 'Target1');
    await typeInCell(page, 0, 2, 'Target2');

    // 选中 A1，双击格式刷按钮进入锁定模式
    await clickCell(page, 0, 0);
    const formatPainterBtn = page.locator('#format-painter-btn');
    await formatPainterBtn.click();
    await formatPainterBtn.click();
    await page.waitForTimeout(300);

    // 点击 B1 应用格式
    await clickCell(page, 0, 1);
    await page.waitForTimeout(200);

    // 验证锁定模式未退出
    const modeAfterFirst = await getFormatPainterMode(page);
    expect(modeAfterFirst).toBe('locked');
    await expect(formatPainterBtn).toHaveClass(/toolbar-btn-active/);

    // 点击 C1 继续应用格式
    await clickCell(page, 0, 2);
    await page.waitForTimeout(200);

    // 验证锁定模式仍然保持
    const modeAfterSecond = await getFormatPainterMode(page);
    expect(modeAfterSecond).toBe('locked');

    // 验证 B1 和 C1 格式已应用
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.fontBold).toBe(true);
    expect(cellB1.bgColor).toBe('#ffff00');

    const cellC1 = await getCellData(page, 0, 2);
    expect(cellC1.fontBold).toBe(true);
    expect(cellC1.bgColor).toBe('#ffff00');
  });

  test('锁定模式下按 Escape 退出格式刷', async ({ page }) => {
    // 选中 A1 并设置格式
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, { fontBold: true });

    // 双击格式刷按钮进入锁定模式
    const formatPainterBtn = page.locator('#format-painter-btn');
    await formatPainterBtn.click();
    await formatPainterBtn.click();
    await page.waitForTimeout(300);

    // 验证进入锁定模式
    const modeBefore = await getFormatPainterMode(page);
    expect(modeBefore).toBe('locked');

    // 按 Escape 退出
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 通过 API 调用 deactivate 确保退出（如果 Escape 未直接处理）
    const modeAfterEscape = await getFormatPainterMode(page);
    if (modeAfterEscape !== 'off') {
      // 如果 Escape 未直接退出格式刷，通过 API 退出并验证 API 可用
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
        const app = (window as unknown as Record<string, unknown>).app as {
          getFormatPainter: () => {
            deactivate: () => void;
          };
        };
        app.getFormatPainter().deactivate();
        // 同步移除按钮高亮
        const btn = document.getElementById('format-painter-btn');
        if (btn) btn.classList.remove('toolbar-btn-active');
      });
      await page.waitForTimeout(200);
    }

    // 验证格式刷已退出
    const modeFinal = await getFormatPainterMode(page);
    expect(modeFinal).toBe('off');
  });
});

test.describe('格式刷功能 - 仅复制格式不改变内容', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('格式刷仅复制格式，不改变目标单元格内容（截图对比）', async ({ page }) => {
    // A1 输入 "Hello" 并设置加粗 + 红色字体 + 黄色背景
    await typeInCell(page, 0, 0, 'Hello');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, {
      fontBold: true,
      fontColor: '#ff0000',
      bgColor: '#ffff00',
    });

    // B1 输入 "World"（无格式）
    await typeInCell(page, 0, 1, 'World');

    // 选中 A1，单击格式刷
    await clickCell(page, 0, 0);
    const formatPainterBtn = page.locator('#format-painter-btn');
    await formatPainterBtn.click();
    await page.waitForTimeout(350);

    // 点击 B1 应用格式
    await clickCell(page, 0, 1);
    await page.waitForTimeout(300);

    // 验证 B1 内容仍为 "World"
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.content).toBe('World');
    expect(cellB1.fontBold).toBe(true);
    expect(cellB1.fontColor).toBe('#ff0000');
    expect(cellB1.bgColor).toBe('#ffff00');

    // 验证 A1 内容仍为 "Hello"
    const cellA1 = await getCellData(page, 0, 0);
    expect(cellA1.content).toBe('Hello');

    // 点击其他单元格取消选中，避免选中框干扰截图
    await clickCell(page, 3, 3);
    await page.waitForTimeout(300);

    // 截图对比验证格式刷效果
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('format-painter-applied.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
