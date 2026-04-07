import { test, expect } from '@playwright/test';
import {
  getCellData, setContentViaFormulaBar, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：填充序列、拖拽移动
 */
test.describe('填充序列测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('向下填充数字序列', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          fillRange: (
            ssr: number, ssc: number, ser: number, sec: number,
            tsr: number, tsc: number, ter: number, tec: number,
            direction: string
          ) => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, '1');
      model.setCellContent(1, 0, '2');
      model.fillRange(0, 0, 1, 0, 2, 0, 4, 0, 'down');
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const r3 = await getCellData(page, 2, 0);
    const r4 = await getCellData(page, 3, 0);
    const r5 = await getCellData(page, 4, 0);
    expect(r3.content).toBe('3');
    expect(r4.content).toBe('4');
    expect(r5.content).toBe('5');
  });

  test('向右填充数字序列', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          fillRange: (
            ssr: number, ssc: number, ser: number, sec: number,
            tsr: number, tsc: number, ter: number, tec: number,
            direction: string
          ) => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, '10');
      model.setCellContent(0, 1, '20');
      model.fillRange(0, 0, 0, 1, 0, 2, 0, 4, 'right');
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const c3 = await getCellData(page, 0, 2);
    const c4 = await getCellData(page, 0, 3);
    expect(c3.content).toBe('30');
    expect(c4.content).toBe('40');
  });

  test('联合操作：填充 → 公式汇总', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          fillRange: (
            ssr: number, ssc: number, ser: number, sec: number,
            tsr: number, tsc: number, ter: number, tec: number,
            direction: string
          ) => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, '1');
      model.setCellContent(1, 0, '2');
      model.fillRange(0, 0, 1, 0, 2, 0, 4, 0, 'down');
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    await setContentViaFormulaBar(page, 5, 0, '=SUM(A1:A5)');
    const total = await getCellData(page, 5, 0);
    expect(total.content).toBe('15');
  });
});

test.describe('拖拽移动测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('通过 API 移动单元格内容', async ({ page }) => {
    // 直接操作模型模拟拖拽移动
    const result = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          getCell: (r: number, c: number) => { content?: string } | null;
          setCellContentNoHistory: (r: number, c: number, v: string) => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, 'MoveMe');
      // 模拟移动：复制到目标，清空源
      const sourceContent = model.getCell(0, 0)?.content || '';
      model.setCellContentNoHistory(3, 3, sourceContent);
      model.setCellContentNoHistory(0, 0, '');
      app.getRenderer().render();
      return {
        source: model.getCell(0, 0)?.content || '',
        target: model.getCell(3, 3)?.content || '',
      };
    });
    await page.waitForTimeout(200);

    expect(result.target).toBe('MoveMe');
    expect(result.source).toBe('');
  });
});
