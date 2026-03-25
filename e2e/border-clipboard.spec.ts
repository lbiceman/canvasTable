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
 * 辅助函数：双击 Canvas 上指定单元格进入编辑模式
 */
const dblClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;
  const x = headerWidth + col * defaultColWidth + defaultColWidth / 2;
  const y = headerHeight + row * defaultRowHeight + defaultRowHeight / 2;
  await canvas.dblclick({ position: { x, y } });
};

/**
 * 辅助函数：在单元格中输入内容（通过双击进入编辑模式）
 */
const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await dblClickCell(page, row, col);
  const editorInput = page.locator('.inline-editor input');
  await editorInput.fill(text);
  await page.keyboard.press('Enter');
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
 * 辅助函数：从字体族下拉中选择指定字体
 */
const selectFontFamily = async (page: Page, fontName: string): Promise<void> => {
  await page.locator('#font-family-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.font-family-option[data-font="${fontName}"]`).click();
  await page.waitForTimeout(200);
};

/**
 * 辅助函数：获取单元格的完整数据（内容 + 格式）
 */
const getCellData = async (
  page: Page,
  row: number,
  col: number,
): Promise<{
  content?: string;
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
      const app = ((window as unknown) as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => Record<string, unknown> | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell) return {};
      return {
        content: cell.content as string | undefined,
        border: cell.border as {
          top?: { style: string; color: string; width: number };
          bottom?: { style: string; color: string; width: number };
          left?: { style: string; color: string; width: number };
          right?: { style: string; color: string; width: number };
        } | undefined,
        fontFamily: cell.fontFamily as string | undefined,
        fontStrikethrough: cell.fontStrikethrough as boolean | undefined,
      };
    },
    [row, col] as [number, number],
  );
};

// 授予剪贴板权限
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('剪贴板集成 - 边框/字体族/删除线', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  /**
   * 需求10.1 - ClipboardCellData 扩展：
   * 复制含边框/字体族/删除线的单元格，验证内部剪贴板数据包含这些属性
   */
  test('需求10.1 - 复制后内部剪贴板数据包含 border/fontFamily/fontStrikethrough', async ({ page }) => {
    // A1 设置全部边框
    await clickCell(page, 0, 0);
    await applyBorder(page, 'all');

    // 设置字体族为 Arial
    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Arial');

    // 设置删除线
    await clickCell(page, 0, 0);
    await page.locator('#font-strikethrough-btn').click();
    await page.waitForTimeout(200);

    // 选中 A1 并 Ctrl+C 复制
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    // 通过 evaluate 验证内部剪贴板数据包含 border/fontFamily/fontStrikethrough
    const clipboardInfo = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app 内部剪贴板
      const app = ((window as unknown) as Record<string, unknown>).app as Record<string, unknown>;
      const clipboard = app['internalClipboard'] as {
        cells: Array<Array<Record<string, unknown>>>;
      } | null;
      if (!clipboard || !clipboard.cells[0]?.[0]) return null;
      const cellData = clipboard.cells[0][0];
      return {
        hasBorder: cellData.border !== undefined && cellData.border !== null,
        hasFontFamily: cellData.fontFamily !== undefined,
        hasFontStrikethrough: cellData.fontStrikethrough !== undefined,
        fontFamily: cellData.fontFamily as string,
        fontStrikethrough: cellData.fontStrikethrough as boolean,
      };
    });

    expect(clipboardInfo).not.toBeNull();
    expect(clipboardInfo!.hasBorder).toBe(true);
    expect(clipboardInfo!.hasFontFamily).toBe(true);
    expect(clipboardInfo!.hasFontStrikethrough).toBe(true);
    expect(clipboardInfo!.fontFamily).toBe('Arial');
    expect(clipboardInfo!.fontStrikethrough).toBe(true);
  });

  /**
   * 需求10.2 - 复制：
   * A1 设置边框+字体族+删除线后 Ctrl+C 复制，验证内部剪贴板存储了完整格式数据
   */
  test('需求10.2 - Ctrl+C 复制后内部剪贴板存储完整格式数据', async ({ page }) => {
    // A1 输入内容并设置样式
    await typeInCell(page, 0, 0, '测试内容');

    // 设置全部边框
    await clickCell(page, 0, 0);
    await applyBorder(page, 'all');

    // 设置字体族
    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Times New Roman');

    // 设置删除线
    await clickCell(page, 0, 0);
    await page.locator('#font-strikethrough-btn').click();
    await page.waitForTimeout(200);

    // Ctrl+C 复制
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    // 验证内部剪贴板存储了完整格式数据
    const clipboardCell = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app 内部剪贴板
      const app = ((window as unknown) as Record<string, unknown>).app as Record<string, unknown>;
      const clipboard = app['internalClipboard'] as {
        cells: Array<Array<Record<string, unknown>>>;
      } | null;
      if (!clipboard || !clipboard.cells[0]?.[0]) return null;
      const cellData = clipboard.cells[0][0];
      return {
        content: cellData.content as string,
        border: cellData.border as Record<string, unknown>,
        fontFamily: cellData.fontFamily as string,
        fontStrikethrough: cellData.fontStrikethrough as boolean,
      };
    });

    expect(clipboardCell).not.toBeNull();
    expect(clipboardCell!.content).toBe('测试内容');
    // 验证边框数据完整（四条边）
    expect(clipboardCell!.border).toBeDefined();
    const border = clipboardCell!.border as Record<string, { style: string; color: string; width: number }>;
    expect(border.top).toBeDefined();
    expect(border.bottom).toBeDefined();
    expect(border.left).toBeDefined();
    expect(border.right).toBeDefined();
    expect(border.top.style).toBe('solid');
    expect(border.top.color).toBe('#000000');
    expect(border.top.width).toBe(1);
    // 验证字体族和删除线
    expect(clipboardCell!.fontFamily).toBe('Times New Roman');
    expect(clipboardCell!.fontStrikethrough).toBe(true);
  });

  /**
   * 需求10.3 - 粘贴：
   * 复制 A1 后 Ctrl+V 粘贴到 B1，验证 B1 的格式与 A1 一致
   */
  test('需求10.3 - Ctrl+V 粘贴后目标单元格格式与源单元格一致', async ({ page }) => {
    // A1 输入内容并设置样式
    await typeInCell(page, 0, 0, 'Hello');

    // 设置全部边框
    await clickCell(page, 0, 0);
    await applyBorder(page, 'all');

    // 设置字体族
    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Arial');

    // 设置删除线
    await clickCell(page, 0, 0);
    await page.locator('#font-strikethrough-btn').click();
    await page.waitForTimeout(200);

    // 记录 A1 的格式数据
    const a1Data = await getCellData(page, 0, 0);

    // 选中 A1 并 Ctrl+C 复制
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    // 选中 B1 并 Ctrl+V 粘贴
    await clickCell(page, 0, 1);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    // 验证 B1 的格式与 A1 一致
    const b1Data = await getCellData(page, 0, 1);

    // 验证内容
    expect(b1Data.content).toBe('Hello');

    // 验证边框
    expect(b1Data.border).toBeDefined();
    expect(b1Data.border!.top!.style).toBe(a1Data.border!.top!.style);
    expect(b1Data.border!.top!.color).toBe(a1Data.border!.top!.color);
    expect(b1Data.border!.top!.width).toBe(a1Data.border!.top!.width);
    expect(b1Data.border!.bottom).toBeDefined();
    expect(b1Data.border!.left).toBeDefined();
    expect(b1Data.border!.right).toBeDefined();

    // 验证字体族
    expect(b1Data.fontFamily).toBe(a1Data.fontFamily);

    // 验证删除线
    expect(b1Data.fontStrikethrough).toBe(a1Data.fontStrikethrough);
  });

  /**
   * 需求10.4 - 仅粘贴格式：
   * A1 有内容+样式，B1 有不同内容，执行"仅粘贴格式"到 B1，
   * 验证 B1 内容不变但格式与 A1 一致
   */
  test('需求10.4 - 仅粘贴格式后目标单元格内容不变但格式与源一致', async ({ page }) => {
    // A1 输入内容并设置样式
    await typeInCell(page, 0, 0, '源内容');

    // 设置全部边框
    await clickCell(page, 0, 0);
    await applyBorder(page, 'all');

    // 设置字体族
    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'SimHei');

    // 设置删除线
    await clickCell(page, 0, 0);
    await page.locator('#font-strikethrough-btn').click();
    await page.waitForTimeout(200);

    // B1 输入不同内容
    await typeInCell(page, 0, 1, '目标内容');

    // 记录 A1 的格式数据
    const a1Data = await getCellData(page, 0, 0);

    // 选中 A1 并 Ctrl+C 复制
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    // 选中 B1，通过 evaluate 调用 handlePasteSpecial('formats') 执行仅粘贴格式
    await clickCell(page, 0, 1);
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app 的 handlePasteSpecial 方法
      const app = ((window as unknown) as Record<string, unknown>).app as Record<string, unknown>;
      const fn = app['handlePasteSpecial'] as (mode: string) => void;
      fn.call(app, 'formats');
    });
    await page.waitForTimeout(300);

    // 验证 B1 内容不变
    const b1Data = await getCellData(page, 0, 1);
    expect(b1Data.content).toBe('目标内容');

    // 验证 B1 格式与 A1 一致
    expect(b1Data.border).toBeDefined();
    expect(b1Data.border!.top!.style).toBe(a1Data.border!.top!.style);
    expect(b1Data.border!.top!.color).toBe(a1Data.border!.top!.color);
    expect(b1Data.border!.top!.width).toBe(a1Data.border!.top!.width);
    expect(b1Data.border!.bottom).toBeDefined();
    expect(b1Data.border!.left).toBeDefined();
    expect(b1Data.border!.right).toBeDefined();

    // 验证字体族
    expect(b1Data.fontFamily).toBe(a1Data.fontFamily);

    // 验证删除线
    expect(b1Data.fontStrikethrough).toBe(a1Data.fontStrikethrough);
  });
});
