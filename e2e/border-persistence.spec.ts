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
 * 辅助函数：应用指定位置的边框
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
      const app = (window as any).app;
      const cell = app.getModel().getCell(r, c);
      if (!cell || !cell.border) return null;
      return cell.border;
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

/**
 * 辅助函数：为选中区域设置样式（边框 + 字体族 + 删除线）
 */
const applyAllStyles = async (page: Page): Promise<void> => {
  // 设置全部边框
  await applyBorder(page, 'all');
  // 设置字体族为 Arial
  await selectFontFamily(page, 'Arial');
  // 启用删除线
  await page.locator('#font-strikethrough-btn').click();
  await page.waitForTimeout(200);
};

test.describe('数据持久化与序列化', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  /**
   * 需求8.1 - JSON 导出：
   * 设置边框/字体族/删除线后导出 JSON，验证导出数据包含这些属性
   */
  test('需求8.1 - JSON 导出：导出数据应包含 border、fontFamily、fontStrikethrough 属性', async ({ page }) => {
    // 选中 A1 并设置样式
    await clickCell(page, 0, 0);
    await applyAllStyles(page);

    // 导出 JSON 并解析
    const exportedJson = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      return app.getModel().exportToJSON();
    });

    const parsed = JSON.parse(exportedJson);
    const cells = parsed.data.cells as Record<string, unknown>[];

    // 找到 A1 单元格数据（row=0, col=0）
    const a1Data = cells.find(
      (c) => c.row === 0 && c.col === 0,
    );
    expect(a1Data, 'A1 应存在于导出数据中').toBeDefined();

    // 验证 border 属性存在且包含四条边
    const border = a1Data!.border as Record<string, unknown>;
    expect(border, '导出数据应包含 border 属性').toBeDefined();
    expect(border.top).toBeDefined();
    expect(border.bottom).toBeDefined();
    expect(border.left).toBeDefined();
    expect(border.right).toBeDefined();

    // 验证 fontFamily 属性
    expect(a1Data!.fontFamily, '导出数据应包含 fontFamily 属性').toBe('Arial');

    // 验证 fontStrikethrough 属性
    expect(a1Data!.fontStrikethrough, '导出数据应包含 fontStrikethrough 属性').toBe(true);
  });

  /**
   * 需求8.2 - JSON 导入：
   * 导入包含边框/字体族/删除线数据的 JSON，验证单元格属性正确恢复
   */
  test('需求8.2 - JSON 导入：导入 JSON 后单元格属性应正确恢复', async ({ page }) => {
    // 构造包含边框/字体族/删除线的 JSON 数据
    const importJson = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      metadata: {
        rowCount: 100,
        colCount: 26,
        defaultRowHeight: 25,
        defaultColWidth: 100,
        hiddenRows: [],
        hiddenCols: [],
        freezeRows: 0,
        freezeCols: 0,
        rowGroups: [],
        colGroups: [],
      },
      data: {
        cells: [
          {
            row: 0,
            col: 0,
            content: '测试导入',
            rowSpan: 1,
            colSpan: 1,
            isMerged: false,
            border: {
              top: { style: 'dashed', color: '#ff0000', width: 2 },
              bottom: { style: 'solid', color: '#00ff00', width: 1 },
              left: { style: 'dotted', color: '#0000ff', width: 1 },
              right: { style: 'double', color: '#333333', width: 1 },
            },
            fontFamily: 'Courier New',
            fontStrikethrough: true,
          },
        ],
        rowHeights: {},
        colWidths: {},
      },
    };

    // 执行导入
    const importResult = await page.evaluate((json) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      return app.getModel().importFromJSON(JSON.stringify(json));
    }, importJson);
    expect(importResult).toBeTruthy();

    await page.waitForTimeout(300);

    // 验证 A1 边框属性正确恢复
    const border = await getCellBorder(page, 0, 0);
    expect(border).not.toBeNull();
    expect(border!.top!.style).toBe('dashed');
    expect(border!.top!.color).toBe('#ff0000');
    expect(border!.top!.width).toBe(2);
    expect(border!.bottom!.style).toBe('solid');
    expect(border!.left!.style).toBe('dotted');
    expect(border!.right!.style).toBe('double');

    // 验证 fontFamily 恢复
    const fontFamily = await page.evaluate(([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      const cell = app.getModel().getCell(r, c);
      return cell?.fontFamily;
    }, [0, 0]);
    expect(fontFamily).toBe('Courier New');

    // 验证 fontStrikethrough 恢复
    const strikethrough = await page.evaluate(([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      const cell = app.getModel().getCell(r, c);
      return cell?.fontStrikethrough;
    }, [0, 0]);
    expect(strikethrough).toBe(true);
  });

  /**
   * 需求8.3 - LocalStorage：
   * 设置样式后保存到 LocalStorage，再加载恢复，验证样式保持
   */
  test('需求8.3 - LocalStorage：保存后加载，样式应保持一致', async ({ page }) => {
    // 选中 A1 并设置样式
    await clickCell(page, 0, 0);
    await applyAllStyles(page);

    // 保存到 LocalStorage
    const saveResult = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      return app.getDataManager().saveToLocalStorage();
    });
    expect(saveResult).toBe(true);

    // 验证 LocalStorage 中的数据包含边框/字体族/删除线信息
    const storageData = await page.evaluate(() => {
      const raw = localStorage.getItem('spreadsheet-data');
      if (!raw) return null;
      return JSON.parse(raw);
    });
    expect(storageData).not.toBeNull();
    const storedCells = storageData.data.cells as Record<string, unknown>[];
    const storedA1 = storedCells.find(
      (c) => c.row === 0 && c.col === 0,
    );
    expect(storedA1, 'LocalStorage 中应包含 A1 数据').toBeDefined();
    expect(storedA1!.border, 'LocalStorage 数据应包含 border').toBeDefined();
    expect(storedA1!.fontFamily, 'LocalStorage 数据应包含 fontFamily').toBe('Arial');
    expect(storedA1!.fontStrikethrough, 'LocalStorage 数据应包含 fontStrikethrough').toBe(true);

    // 从 LocalStorage 加载恢复（模拟刷新后加载）
    const loadResult = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      return app.getDataManager().loadFromLocalStorage();
    });
    expect(loadResult).toBe(true);

    await page.waitForTimeout(300);

    // 验证 A1 边框样式保持
    const border = await getCellBorder(page, 0, 0);
    expect(border).not.toBeNull();
    expect(border!.top).toBeDefined();
    expect(border!.bottom).toBeDefined();
    expect(border!.left).toBeDefined();
    expect(border!.right).toBeDefined();

    // 验证 fontFamily 保持
    const fontFamily = await page.evaluate(([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      const cell = app.getModel().getCell(r, c);
      return cell?.fontFamily;
    }, [0, 0]);
    expect(fontFamily).toBe('Arial');

    // 验证 fontStrikethrough 保持
    const strikethrough = await page.evaluate(([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      const cell = app.getModel().getCell(r, c);
      return cell?.fontStrikethrough;
    }, [0, 0]);
    expect(strikethrough).toBe(true);
  });

  /**
   * 需求8.4 - 往返一致性：
   * 设置复杂样式，导出 JSON 后清空再导入，验证所有属性一致
   */
  test('需求8.4 - 往返一致性：导出后清空再导入，所有属性应完全一致', async ({ page }) => {
    // 选中 A1 并设置复杂样式
    await clickCell(page, 0, 0);
    await page.keyboard.type('往返测试');
    await page.keyboard.press('Enter');
    await clickCell(page, 0, 0);

    // 设置虚线边框（先切换线型为 dashed）
    await page.locator('#border-btn').click();
    await page.waitForTimeout(200);
    await page.locator('.border-style-option[data-style="dashed"]').click();
    await page.waitForTimeout(100);
    await page.locator(`.border-position-option[data-position="all"]`).click();
    await page.waitForTimeout(200);

    // 设置字体族为 Times New Roman
    await selectFontFamily(page, 'Times New Roman');

    // 启用删除线
    await page.locator('#font-strikethrough-btn').click();
    await page.waitForTimeout(200);

    // 记录原始属性
    const originalBorder = await getCellBorder(page, 0, 0);
    const originalFontFamily = await page.evaluate(([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      const cell = app.getModel().getCell(r, c);
      return cell?.fontFamily;
    }, [0, 0]);
    const originalStrikethrough = await page.evaluate(([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      const cell = app.getModel().getCell(r, c);
      return cell?.fontStrikethrough;
    }, [0, 0]);

    // 导出 JSON
    const exportedJson = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      return app.getModel().exportToJSON();
    });

    // 清空数据（导入空数据）
    const emptyJson = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      metadata: {
        rowCount: 100,
        colCount: 26,
        defaultRowHeight: 25,
        defaultColWidth: 100,
        hiddenRows: [],
        hiddenCols: [],
        freezeRows: 0,
        freezeCols: 0,
        rowGroups: [],
        colGroups: [],
      },
      data: { cells: [], rowHeights: {}, colWidths: {} },
    };
    await page.evaluate((json) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      app.getModel().importFromJSON(JSON.stringify(json));
    }, emptyJson);
    await page.waitForTimeout(200);

    // 验证清空后 A1 无边框
    const clearedBorder = await getCellBorder(page, 0, 0);
    expect(clearedBorder).toBeNull();

    // 重新导入之前导出的 JSON
    await page.evaluate((json) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      app.getModel().importFromJSON(json);
    }, exportedJson);
    await page.waitForTimeout(300);

    // 验证边框属性完全一致
    const restoredBorder = await getCellBorder(page, 0, 0);
    expect(restoredBorder).not.toBeNull();
    expect(restoredBorder!.top!.style).toBe(originalBorder!.top!.style);
    expect(restoredBorder!.top!.color).toBe(originalBorder!.top!.color);
    expect(restoredBorder!.top!.width).toBe(originalBorder!.top!.width);
    expect(restoredBorder!.bottom!.style).toBe(originalBorder!.bottom!.style);
    expect(restoredBorder!.left!.style).toBe(originalBorder!.left!.style);
    expect(restoredBorder!.right!.style).toBe(originalBorder!.right!.style);

    // 验证 fontFamily 一致
    const restoredFontFamily = await page.evaluate(([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      const cell = app.getModel().getCell(r, c);
      return cell?.fontFamily;
    }, [0, 0]);
    expect(restoredFontFamily).toBe(originalFontFamily);

    // 验证 fontStrikethrough 一致
    const restoredStrikethrough = await page.evaluate(([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      const cell = app.getModel().getCell(r, c);
      return cell?.fontStrikethrough;
    }, [0, 0]);
    expect(restoredStrikethrough).toBe(originalStrikethrough);

    // 验证内容也一致
    const restoredContent = await page.evaluate(([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as any).app;
      const cell = app.getModel().getCell(r, c);
      return cell?.content;
    }, [0, 0]);
    expect(restoredContent).toBe('往返测试');
  });
});
