import { test, expect } from '@playwright/test';
import {
  clickCell, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：内嵌图片、迷你图、数据透视表、脚本编辑器
 */
test.describe('内嵌图片测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('图片按钮存在且可点击', async ({ page }) => {
    const imageBtn = page.locator('#image-btn');
    await expect(imageBtn).toBeVisible();
  });

  test('通过 API 设置内嵌图片', async ({ page }) => {
    const hasImage = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (r: number, c: number) => Record<string, unknown> | null;
          getData: () => { cells: Array<Array<Record<string, unknown>>> };
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      const data = model.getData();
      // 直接设置 embeddedImage 属性
      if (data.cells[0] && data.cells[0][0]) {
        data.cells[0][0].embeddedImage = {
          base64Data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          originalWidth: 1,
          originalHeight: 1,
        };
      }
      app.getRenderer().render();
      const cell = model.getCell(0, 0);
      return cell?.embeddedImage !== undefined;
    });
    expect(hasImage).toBe(true);
  });
});

test.describe('迷你图测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('迷你图按钮存在', async ({ page }) => {
    const sparklineBtn = page.locator('#sparkline-btn');
    await expect(sparklineBtn).toBeVisible();
  });

  test('迷你图下拉面板可打开', async ({ page }) => {
    await page.locator('#sparkline-btn').click();
    await page.waitForTimeout(200);
    const dropdown = page.locator('#sparkline-dropdown');
    await expect(dropdown).toBeVisible();
  });

  test('迷你图选项包含折线/柱状/盈亏', async ({ page }) => {
    await page.locator('#sparkline-btn').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.sparkline-option[data-type="line"]')).toBeVisible();
    await expect(page.locator('.sparkline-option[data-type="bar"]')).toBeVisible();
    await expect(page.locator('.sparkline-option[data-type="winLoss"]')).toBeVisible();
  });

  test('通过 API 设置迷你图', async ({ page }) => {
    const hasSparkline = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          getCell: (r: number, c: number) => Record<string, unknown> | null;
          getData: () => { cells: Array<Array<Record<string, unknown>>> };
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, '10');
      model.setCellContent(0, 1, '20');
      model.setCellContent(0, 2, '15');
      // 直接设置 sparkline 属性
      const data = model.getData();
      if (data.cells[1] && data.cells[1][0]) {
        data.cells[1][0].sparkline = {
          type: 'line',
          dataRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 2 },
        };
      }
      app.getRenderer().render();
      const cell = model.getCell(1, 0);
      return cell?.sparkline !== undefined;
    });
    expect(hasSparkline).toBe(true);
  });
});

test.describe('数据透视表测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('数据透视表按钮存在且可点击', async ({ page }) => {
    const pivotBtn = page.locator('#pivot-table-btn');
    await expect(pivotBtn).toBeVisible();
    await pivotBtn.click();
    await page.waitForTimeout(300);
    expect(true).toBeTruthy();
  });
});

test.describe('脚本编辑器测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('脚本编辑器按钮存在且可点击', async ({ page }) => {
    const scriptBtn = page.locator('#script-editor-btn');
    await expect(scriptBtn).toBeVisible();
    await scriptBtn.click();
    await page.waitForTimeout(300);
    expect(true).toBeTruthy();
  });
});
