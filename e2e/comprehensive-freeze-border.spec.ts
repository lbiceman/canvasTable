import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, waitForApp,
} from './helpers/test-utils';

/** 获取冻结状态 */
const getFreezeState = async (page: import('@playwright/test').Page) => {
  return await page.evaluate(() => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getFreezeRows: () => number; getFreezeCols: () => number };
    };
    return {
      rows: app.getModel().getFreezeRows(),
      cols: app.getModel().getFreezeCols(),
    };
  });
};

test.describe('冻结窗格测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('冻结首行', async ({ page }) => {
    await page.locator('#freeze-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.freeze-option[data-freeze="firstRow"]').click();
    await page.waitForTimeout(300);

    const state = await getFreezeState(page);
    expect(state.rows).toBe(1);
  });

  test('冻结首列', async ({ page }) => {
    await page.locator('#freeze-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.freeze-option[data-freeze="firstCol"]').click();
    await page.waitForTimeout(300);

    const state = await getFreezeState(page);
    expect(state.cols).toBe(1);
  });

  test('冻结至当前单元格', async ({ page }) => {
    await clickCell(page, 2, 2);
    await page.locator('#freeze-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.freeze-option[data-freeze="currentCell"]').click();
    await page.waitForTimeout(300);

    const state = await getFreezeState(page);
    expect(state.rows).toBe(2);
    expect(state.cols).toBe(2);
  });

  test('取消冻结', async ({ page }) => {
    // 先冻结
    await page.locator('#freeze-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.freeze-option[data-freeze="firstRow"]').click();
    await page.waitForTimeout(300);

    // 取消冻结
    await page.locator('#freeze-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.freeze-option[data-freeze="none"]').click();
    await page.waitForTimeout(300);

    const state = await getFreezeState(page);
    expect(state.rows).toBe(0);
    expect(state.cols).toBe(0);
  });

  test('联合操作：冻结 → 输入数据 → 取消冻结', async ({ page }) => {
    await page.locator('#freeze-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.freeze-option[data-freeze="firstRow"]').click();
    await page.waitForTimeout(300);

    await typeInCell(page, 0, 0, 'FrozenHeader');
    await typeInCell(page, 1, 0, 'DataRow');

    const header = await getCellData(page, 0, 0);
    expect(header.content).toBe('FrozenHeader');

    await page.locator('#freeze-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.freeze-option[data-freeze="none"]').click();
    await page.waitForTimeout(300);

    const headerAfter = await getCellData(page, 0, 0);
    expect(headerAfter.content).toBe('FrozenHeader');
  });
});

test.describe('边框设置测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('设置全部边框（通过 API）', async ({ page }) => {
    // 通过 API 设置边框确保可靠
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellBorder: (row: number, col: number, border: Record<string, unknown>) => void;
        };
        getRenderer: () => { render: () => void };
      };
      const border = {
        top: { style: 'solid', color: '#000000', width: 1 },
        bottom: { style: 'solid', color: '#000000', width: 1 },
        left: { style: 'solid', color: '#000000', width: 1 },
        right: { style: 'solid', color: '#000000', width: 1 },
      };
      app.getModel().setCellBorder(0, 0, border);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    const cell = await getCellData(page, 0, 0);
    expect(cell.border).toBeDefined();
  });

  test('边框下拉面板可打开', async ({ page }) => {
    await page.locator('#border-btn').click();
    await page.waitForTimeout(200);

    const dropdown = page.locator('#border-dropdown');
    await expect(dropdown).toBeVisible();
  });

  test('切换边框线型', async ({ page }) => {
    await page.locator('#border-btn').click();
    await page.waitForTimeout(200);

    // 选择虚线
    const dashedOption = page.locator('.border-style-option[data-style="dashed"]');
    await dashedOption.click();
    await page.waitForTimeout(100);

    // 验证虚线选项被激活
    await expect(dashedOption).toHaveClass(/active/);
  });

  test('联合操作：边框 + 格式化 + 内容', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Bordered');
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);

    // 通过 API 设置边框
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellBorder: (row: number, col: number, border: Record<string, unknown>) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellBorder(0, 0, {
        top: { style: 'solid', color: '#000000', width: 1 },
        bottom: { style: 'solid', color: '#000000', width: 1 },
        left: { style: 'solid', color: '#000000', width: 1 },
        right: { style: 'solid', color: '#000000', width: 1 },
      });
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('Bordered');
    expect(cell.fontBold).toBe(true);
    expect(cell.border).toBeDefined();
  });
});
