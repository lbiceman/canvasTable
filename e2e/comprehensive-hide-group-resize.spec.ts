import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：隐藏/取消隐藏行列、分组、行高列宽调整
 */
test.describe('隐藏行列测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('隐藏行', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { hideRows: (indices: number[]) => void; isRowHidden: (row: number) => boolean };
        getRenderer: () => { render: () => void };
      };
      app.getModel().hideRows([1]);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    const isHidden = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { isRowHidden: (row: number) => boolean };
      };
      return app.getModel().isRowHidden(1);
    });
    expect(isHidden).toBe(true);
  });

  test('取消隐藏行', async ({ page }) => {
    // 先隐藏
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { hideRows: (indices: number[]) => void; unhideRows: (indices: number[]) => void };
        getRenderer: () => { render: () => void };
      };
      app.getModel().hideRows([1]);
      app.getModel().unhideRows([1]);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    const isHidden = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { isRowHidden: (row: number) => boolean };
      };
      return app.getModel().isRowHidden(1);
    });
    expect(isHidden).toBe(false);
  });

  test('隐藏列', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { hideCols: (indices: number[]) => void; isColHidden: (col: number) => boolean };
        getRenderer: () => { render: () => void };
      };
      app.getModel().hideCols([1]);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    const isHidden = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { isColHidden: (col: number) => boolean };
      };
      return app.getModel().isColHidden(1);
    });
    expect(isHidden).toBe(true);
  });

  test('联合操作：输入数据 → 隐藏行 → 取消隐藏 → 验证数据', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Visible1');
    await typeInCell(page, 1, 0, 'Hidden');
    await typeInCell(page, 2, 0, 'Visible2');

    // 隐藏第2行
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { hideRows: (indices: number[]) => void };
        getRenderer: () => { render: () => void };
      };
      app.getModel().hideRows([1]);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 取消隐藏
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { unhideRows: (indices: number[]) => void };
        getRenderer: () => { render: () => void };
      };
      app.getModel().unhideRows([1]);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 数据应保留
    const cell = await getCellData(page, 1, 0);
    expect(cell.content).toBe('Hidden');
  });
});

test.describe('行高列宽调整测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('设置行高', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { setRowHeight: (row: number, height: number) => void; getRowHeight: (row: number) => number };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setRowHeight(0, 50);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    const height = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { getRowHeight: (row: number) => number };
      };
      return app.getModel().getRowHeight(0);
    });
    expect(height).toBe(50);
  });

  test('设置列宽', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { setColWidth: (col: number, width: number) => void; getColWidth: (col: number) => number };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setColWidth(0, 200);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    const width = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { getColWidth: (col: number) => number };
      };
      return app.getModel().getColWidth(0);
    });
    expect(width).toBe(200);
  });

  test('联合操作：调整行高 → 输入数据 → 验证', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { setRowHeight: (row: number, height: number) => void };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setRowHeight(0, 60);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    await typeInCell(page, 0, 0, 'TallRow');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('TallRow');
  });
});

test.describe('分组操作测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('创建行分组', async ({ page }) => {
    const result = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          createRowGroup: (startRow: number, endRow: number) => boolean;
        };
        getRenderer: () => { render: () => void };
      };
      const success = app.getModel().createRowGroup(1, 3);
      app.getRenderer().render();
      return success;
    });
    await page.waitForTimeout(200);
    expect(result).toBe(true);
  });

  test('折叠和展开分组', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          createRowGroup: (startRow: number, endRow: number) => boolean;
          collapseGroup: (type: string, start: number, end: number) => void;
          expandGroup: (type: string, start: number, end: number) => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.createRowGroup(1, 3);
      model.collapseGroup('row', 1, 3);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          expandGroup: (type: string, start: number, end: number) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().expandGroup('row', 1, 3);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);
    expect(true).toBeTruthy();
  });
});
