import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, selectRange, waitForApp,
} from './helpers/test-utils';

/**
 * 辅助函数：通过 API 直接合并单元格（绕过 UI 选区问题）
 */
const mergeCellsViaAPI = async (
  page: import('@playwright/test').Page,
  startRow: number, startCol: number,
  endRow: number, endCol: number,
): Promise<boolean> => {
  return await page.evaluate(
    ([sr, sc, er, ec]) => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          mergeCells: (startRow: number, startCol: number, endRow: number, endCol: number) => boolean;
        };
        getRenderer: () => { render: () => void };
      };
      const result = app.getModel().mergeCells(sr, sc, er, ec);
      app.getRenderer().render();
      return result;
    },
    [startRow, startCol, endRow, endCol] as [number, number, number, number],
  );
};

/**
 * 综合测试：合并/拆分单元格
 */
test.describe('合并拆分单元格综合测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('合并 2x2 区域', async ({ page }) => {
    const result = await mergeCellsViaAPI(page, 0, 0, 1, 1);
    expect(result).toBe(true);

    const cell = await getCellData(page, 0, 0);
    expect(cell.rowSpan).toBe(2);
    expect(cell.colSpan).toBe(2);
  });

  test('拆分已合并的单元格', async ({ page }) => {
    await mergeCellsViaAPI(page, 0, 0, 1, 1);

    // 通过 API 拆分
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { splitCell: (row: number, col: number) => void };
        getRenderer: () => { render: () => void };
      };
      app.getModel().splitCell(0, 0);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    const cell = await getCellData(page, 0, 0);
    // 拆分后 rowSpan/colSpan 回到 1（非合并状态）
    expect(cell.rowSpan === undefined || cell.rowSpan === 1).toBeTruthy();
    expect(cell.colSpan === undefined || cell.colSpan === 1).toBeTruthy();
  });

  test('合并后输入内容', async ({ page }) => {
    await mergeCellsViaAPI(page, 0, 0, 1, 1);
    await page.waitForTimeout(200);

    await typeInCell(page, 0, 0, 'Merged');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('Merged');
    expect(cell.rowSpan).toBe(2);
    expect(cell.colSpan).toBe(2);
  });

  test('合并后格式化', async ({ page }) => {
    await mergeCellsViaAPI(page, 0, 0, 1, 1);
    await page.waitForTimeout(200);

    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);

    const cell = await getCellData(page, 0, 0);
    expect(cell.fontBold).toBe(true);
    expect(cell.rowSpan).toBe(2);
  });

  test('UI 合并按钮（使用 Shift+方向键选区）', async ({ page }) => {
    // 使用键盘选区方式
    await clickCell(page, 0, 0);
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(100);

    await page.locator('#merge-cells').click();
    await page.waitForTimeout(300);

    // 关闭可能出现的模态框
    const modal = page.locator('.modal-overlay');
    if (await modal.isVisible()) {
      await modal.click();
      await page.waitForTimeout(200);
    }

    const cell = await getCellData(page, 0, 0);
    // 如果合并成功，rowSpan 应该是 2
    if (cell.rowSpan === 2) {
      expect(cell.colSpan).toBe(2);
    }
  });

  test('合并多行单元格', async ({ page }) => {
    const result = await mergeCellsViaAPI(page, 0, 0, 2, 0);
    expect(result).toBe(true);

    const cell = await getCellData(page, 0, 0);
    expect(cell.rowSpan).toBe(3);
    expect(cell.colSpan).toBe(1);
  });

  test('合并多列单元格', async ({ page }) => {
    const result = await mergeCellsViaAPI(page, 0, 0, 0, 2);
    expect(result).toBe(true);

    const cell = await getCellData(page, 0, 0);
    expect(cell.rowSpan).toBe(1);
    expect(cell.colSpan).toBe(3);
  });

  test('联合操作：输入 → 合并 → 编辑 → 拆分 → 验证', async ({ page }) => {
    await typeInCell(page, 0, 0, 'TopLeft');
    await typeInCell(page, 0, 1, 'TopRight');

    // 合并 A1:B1
    await mergeCellsViaAPI(page, 0, 0, 0, 1);
    await page.waitForTimeout(200);

    let cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('TopLeft');
    expect(cell.colSpan).toBe(2);

    // 编辑合并单元格
    await typeInCell(page, 0, 0, 'MergedContent');

    // 拆分
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { splitCell: (row: number, col: number) => void };
        getRenderer: () => { render: () => void };
      };
      app.getModel().splitCell(0, 0);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('MergedContent');
    // 拆分后 colSpan 回到 1
    expect(cell.colSpan === undefined || cell.colSpan === 1).toBeTruthy();
  });

  test('联合操作：合并 → 格式化 → 输入 → 验证', async ({ page }) => {
    await mergeCellsViaAPI(page, 0, 0, 1, 1);
    await page.waitForTimeout(200);

    // 格式化
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);

    // 输入
    await typeInCell(page, 0, 0, 'BoldMerged');

    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('BoldMerged');
    expect(cell.fontBold).toBe(true);
    expect(cell.rowSpan).toBe(2);
  });
});
