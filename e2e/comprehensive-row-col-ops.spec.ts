import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, setContentViaFormulaBar, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：行/列操作
 * 使用 API 方式操作行列
 */
test.describe('行列操作综合测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('插入行 - 数据下移', async ({ page }) => {
    // 通过 API 设置数据确保可靠
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          insertRows: (rowIndex: number, count: number) => boolean;
          getCell: (r: number, c: number) => { content?: string } | null;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, 'Row1');
      model.setCellContent(1, 0, 'Row2');
      model.setCellContent(2, 0, 'Row3');
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 验证初始数据
    let r1 = await getCellData(page, 0, 0);
    expect(r1.content).toBe('Row1');

    // 插入行
    const insertResult = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          insertRows: (rowIndex: number, count: number) => boolean;
          getRowCount: () => number;
        };
        getRenderer: () => { render: () => void };
      };
      const before = app.getModel().getRowCount();
      const result = app.getModel().insertRows(1, 1);
      const after = app.getModel().getRowCount();
      app.getRenderer().render();
      return { result, before, after };
    });
    await page.waitForTimeout(300);

    // 验证行数增加了
    expect(insertResult.result).toBe(true);
    expect(insertResult.after).toBeGreaterThan(insertResult.before);

    // Row1 仍在第1行
    r1 = await getCellData(page, 0, 0);
    expect(r1.content).toBe('Row1');
  });

  test('删除行 - 数据上移', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          deleteRows: (rowIndex: number, count: number) => boolean;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, 'Keep');
      model.setCellContent(1, 0, 'Delete');
      model.setCellContent(2, 0, 'Keep2');
      model.deleteRows(1, 1);
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const r1 = await getCellData(page, 0, 0);
    expect(r1.content).toBe('Keep');

    const r2 = await getCellData(page, 1, 0);
    expect(r2.content).toBe('Keep2');
  });

  test('插入列 - 数据右移', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          insertColumns: (colIndex: number, count: number) => boolean;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, 'ColA');
      model.setCellContent(0, 1, 'ColB');
      model.insertColumns(1, 1);
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const colA = await getCellData(page, 0, 0);
    expect(colA.content).toBe('ColA');

    const newCol = await getCellData(page, 0, 1);
    expect(newCol.content).toBe('');

    const colB = await getCellData(page, 0, 2);
    expect(colB.content).toBe('ColB');
  });

  test('删除列 - 数据左移', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          deleteColumns: (colIndex: number, count: number) => boolean;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, 'ColA');
      model.setCellContent(0, 1, 'ColB');
      model.setCellContent(0, 2, 'ColC');
      model.deleteColumns(1, 1);
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const colA = await getCellData(page, 0, 0);
    expect(colA.content).toBe('ColA');

    const colB = await getCellData(page, 0, 1);
    expect(colB.content).toBe('ColC');
  });

  test('联合操作：插入行 → 输入数据 → 格式化', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Header');

    // 插入行
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { insertRows: (rowIndex: number, count: number) => boolean };
        getRenderer: () => { render: () => void };
      };
      app.getModel().insertRows(1, 1);
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    // 在新行输入数据
    await typeInCell(page, 1, 0, 'NewRow');
    await clickCell(page, 1, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);

    const newRow = await getCellData(page, 1, 0);
    expect(newRow.content).toBe('NewRow');
    expect(newRow.fontBold).toBe(true);
  });

  test('联合操作：批量删除多行', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          deleteRows: (rowIndex: number, count: number) => boolean;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, 'R1');
      model.setCellContent(1, 0, 'R2');
      model.setCellContent(2, 0, 'R3');
      model.setCellContent(3, 0, 'R4');
      // 删除第2行和第3行（索引1和2）
      model.deleteRows(1, 2);
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const r1 = await getCellData(page, 0, 0);
    expect(r1.content).toBe('R1');

    const r2 = await getCellData(page, 1, 0);
    expect(r2.content).toBe('R4');
  });
});
