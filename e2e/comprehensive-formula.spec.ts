import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, setContentViaFormulaBar, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：公式计算
 * 覆盖：基础公式、范围引用、公式联动、错误处理、公式与格式联合
 */
test.describe('公式计算综合测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('SUM 公式', async ({ page }) => {
    await typeInCell(page, 0, 0, '10');
    await typeInCell(page, 1, 0, '20');
    await typeInCell(page, 2, 0, '30');

    await setContentViaFormulaBar(page, 3, 0, '=SUM(A1:A3)');
    const cell = await getCellData(page, 3, 0);
    expect(cell.content).toBe('60');
  });

  test('SUM 公式 - 逗号分隔参数', async ({ page }) => {
    await typeInCell(page, 0, 0, '5');
    await typeInCell(page, 0, 1, '15');

    await setContentViaFormulaBar(page, 0, 2, '=SUM(A1,B1)');
    const cell = await getCellData(page, 0, 2);
    expect(cell.content).toBe('20');
  });

  test('SUBTRACT 公式', async ({ page }) => {
    await typeInCell(page, 0, 0, '100');
    await typeInCell(page, 1, 0, '30');

    await setContentViaFormulaBar(page, 2, 0, '=SUBTRACT(A1,A2)');
    const cell = await getCellData(page, 2, 0);
    expect(cell.content).toBe('70');
  });

  test('MULTIPLY 公式', async ({ page }) => {
    await typeInCell(page, 0, 0, '8');
    await typeInCell(page, 1, 0, '9');

    await setContentViaFormulaBar(page, 2, 0, '=MULTIPLY(A1,A2)');
    const cell = await getCellData(page, 2, 0);
    expect(cell.content).toBe('72');
  });

  test('DIVIDE 公式', async ({ page }) => {
    await typeInCell(page, 0, 0, '144');
    await typeInCell(page, 1, 0, '12');

    await setContentViaFormulaBar(page, 2, 0, '=DIVIDE(A1,A2)');
    const cell = await getCellData(page, 2, 0);
    expect(cell.content).toBe('12');
  });

  test('公式引用更新：修改源单元格后公式结果更新', async ({ page }) => {
    await typeInCell(page, 0, 0, '10');
    await typeInCell(page, 1, 0, '20');
    await setContentViaFormulaBar(page, 2, 0, '=SUM(A1,A2)');

    let cell = await getCellData(page, 2, 0);
    expect(cell.content).toBe('30');

    // 通过 setCellContent 修改 A1 并手动重算
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (row: number, col: number, value: string) => { success: boolean };
          recalculateFormulas: () => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, '50');
      model.recalculateFormulas();
      app.getRenderer().render();
    });
    await page.waitForTimeout(500);

    cell = await getCellData(page, 2, 0);
    expect(cell.content).toBe('70');
  });

  test('公式链：A3=SUM(A1,A2), A4=SUM(A3,A1)', async ({ page }) => {
    await typeInCell(page, 0, 0, '10');
    await typeInCell(page, 1, 0, '20');
    await setContentViaFormulaBar(page, 2, 0, '=SUM(A1,A2)');
    await setContentViaFormulaBar(page, 3, 0, '=SUM(A3,A1)');

    const a3 = await getCellData(page, 2, 0);
    expect(a3.content).toBe('30');

    const a4 = await getCellData(page, 3, 0);
    expect(a4.content).toBe('40');
  });

  test('DIVIDE 除以零错误处理', async ({ page }) => {
    await typeInCell(page, 0, 0, '10');
    await typeInCell(page, 1, 0, '0');

    await setContentViaFormulaBar(page, 2, 0, '=DIVIDE(A1,A2)');
    await page.waitForTimeout(300);

    const cell = await getCellData(page, 2, 0);
    expect(cell.content !== 'Infinity').toBeTruthy();
  });

  test('无效公式错误处理', async ({ page }) => {
    await setContentViaFormulaBar(page, 0, 0, '=INVALID(A1)');
    await page.waitForTimeout(300);

    // 公式错误提示应出现
    const formulaError = page.locator('#formula-error');
    const isVisible = await formulaError.isVisible();
    // 无效公式不应被设置
    const cell = await getCellData(page, 0, 0);
    expect(cell.content === '' || isVisible).toBeTruthy();
  });

  test('联合操作：公式 + 格式化', async ({ page }) => {
    await setContentViaFormulaBar(page, 0, 0, '100');
    await setContentViaFormulaBar(page, 1, 0, '200');
    await setContentViaFormulaBar(page, 2, 0, '=SUM(A1,A2)');

    // 对公式单元格加粗
    await clickCell(page, 2, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);

    const cell = await getCellData(page, 2, 0);
    expect(cell.content).toBe('300');
    expect(cell.fontBold).toBe(true);
  });

  test('联合操作：公式 + 复制粘贴', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await typeInCell(page, 0, 0, '10');
    await typeInCell(page, 1, 0, '20');
    await setContentViaFormulaBar(page, 2, 0, '=SUM(A1,A2)');

    // 复制公式单元格
    await clickCell(page, 2, 0);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    // 粘贴到 B3
    await clickCell(page, 2, 1);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    // B3 应该有内容（可能是值或调整后的公式）
    const b3 = await getCellData(page, 2, 1);
    expect(b3.content).toBeDefined();
  });

  test('联合操作：输入数据 → 公式 → 验证级联计算', async ({ page }) => {
    // 构建公式链
    await setContentViaFormulaBar(page, 0, 0, '10');
    await setContentViaFormulaBar(page, 1, 0, '20');
    await setContentViaFormulaBar(page, 2, 0, '=SUM(A1,A2)');
    await setContentViaFormulaBar(page, 3, 0, '=MULTIPLY(A3,2)');

    const a3 = await getCellData(page, 2, 0);
    expect(a3.content).toBe('30');

    const a4 = await getCellData(page, 3, 0);
    expect(a4.content).toBe('60');

    // 通过 API 修改源数据并重算，验证级联更新
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (row: number, col: number, value: string) => { success: boolean };
          recalculateFormulas: () => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, '50');
      model.recalculateFormulas();
      app.getRenderer().render();
    });
    await page.waitForTimeout(500);

    const a3After = await getCellData(page, 2, 0);
    expect(a3After.content).toBe('70');

    const a4After = await getCellData(page, 3, 0);
    expect(a4After.content).toBe('140');
  });
});
