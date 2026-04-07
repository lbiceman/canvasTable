import { test, expect } from '@playwright/test';
import {
  clickCell, getCellData, setContentViaFormulaBar, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：数据验证与下拉选择器
 */
test.describe('数据验证测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('设置下拉列表验证', async ({ page }) => {
    const hasValidation = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellValidation: (row: number, col: number, rule: Record<string, unknown>) => void;
          getCell: (r: number, c: number) => { validation?: Record<string, unknown> } | null;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellValidation(0, 0, {
        type: 'dropdown',
        mode: 'block',
        options: ['选项A', '选项B', '选项C'],
      });
      app.getRenderer().render();
      const cell = app.getModel().getCell(0, 0);
      return cell?.validation !== undefined;
    });
    expect(hasValidation).toBe(true);
  });

  test('设置数值范围验证', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellValidation: (row: number, col: number, rule: Record<string, unknown>) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellValidation(0, 0, {
        type: 'numberRange',
        mode: 'warning',
        min: 0,
        max: 100,
      });
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    await setContentViaFormulaBar(page, 0, 0, '50');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('50');
  });

  test('设置文本长度验证', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellValidation: (row: number, col: number, rule: Record<string, unknown>) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellValidation(0, 0, {
        type: 'textLength',
        mode: 'warning',
        min: 1,
        max: 10,
      });
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    await setContentViaFormulaBar(page, 0, 0, 'Hello');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('Hello');
  });

  test('联合操作：验证 + 格式化 + 输入', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellValidation: (row: number, col: number, rule: Record<string, unknown>) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellValidation(0, 0, {
        type: 'dropdown',
        mode: 'block',
        options: ['是', '否'],
      });
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);

    await setContentViaFormulaBar(page, 0, 0, '是');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('是');
    expect(cell.fontBold).toBe(true);
  });
});
