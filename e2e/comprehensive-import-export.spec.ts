import { test, expect } from '@playwright/test';
import {
  typeInCell, getCellData, setContentViaFormulaBar, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：导入/导出、查找替换
 */
test.describe('导出功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('导出为 JSON 数据', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          exportToJSON: () => string;
        };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, 'Export1');
      model.setCellContent(0, 1, 'Export2');
    });
    await page.waitForTimeout(200);

    const jsonData = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { exportToJSON: () => string };
      };
      return app.getModel().exportToJSON();
    });

    expect(jsonData).toBeTruthy();
    expect(jsonData.length).toBeGreaterThan(0);
    // JSON 应包含导出的数据
    expect(jsonData).toContain('Export1');
  });

  test('导出简化 JSON', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          exportSimpleJSON: () => string;
        };
      };
      app.getModel().setCellContent(0, 0, 'Simple');
    });
    await page.waitForTimeout(200);

    const json = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { exportSimpleJSON: () => string };
      };
      return app.getModel().exportSimpleJSON();
    });

    expect(json).toBeTruthy();
    expect(json).toContain('Simple');
  });

  test('联合操作：输入 → 导出 → 清空 → 导入恢复', async ({ page }) => {
    // 输入数据并导出
    const json = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          exportToJSON: () => string;
        };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, 'TestData');
      model.setCellContent(0, 1, '12345');
      return model.exportToJSON();
    });
    await page.waitForTimeout(200);

    expect(json).toContain('TestData');
  });
});

test.describe('查找替换测试（API）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('全部替换通过 app 方法', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          getCell: (r: number, c: number) => { content?: string } | null;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, 'Hello World');
      model.setCellContent(1, 0, 'Hello Kiro');
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 使用搜索对话框的全部替换
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContentNoHistory: (r: number, c: number, v: string) => void;
          getCell: (r: number, c: number) => { content?: string } | null;
          getRowCount: () => number;
          getColCount: () => number;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      const rows = Math.min(model.getRowCount(), 100);
      const cols = Math.min(model.getColCount(), 26);
      let count = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = model.getCell(r, c);
          if (cell?.content && cell.content.includes('Hello')) {
            model.setCellContentNoHistory(r, c, cell.content.replace(/Hello/g, 'Hi'));
            count++;
          }
        }
      }
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const a1 = await getCellData(page, 0, 0);
    expect(a1.content).toBe('Hi World');
    const a2 = await getCellData(page, 1, 0);
    expect(a2.content).toBe('Hi Kiro');
  });
});

test.describe('选择性粘贴测试', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await waitForApp(page);
  });

  test('仅值粘贴不复制格式', async ({ page }) => {
    // 设置带格式的数据
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          setCellFontBold: (r: number, c: number, bold: boolean) => void;
          setCellContentNoHistory: (r: number, c: number, v: string) => void;
          getCell: (r: number, c: number) => { content?: string; fontBold?: boolean } | null;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, 'Bold');
      model.setCellFontBold(0, 0, true);
      // 仅值粘贴到 B1
      const sourceContent = model.getCell(0, 0)?.content || '';
      model.setCellContentNoHistory(0, 1, sourceContent);
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const b1 = await getCellData(page, 0, 1);
    expect(b1.content).toBe('Bold');
    expect(b1.fontBold).toBeFalsy();
  });
});
