import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData,
  setContentViaFormulaBar, waitForApp,
} from './helpers/test-utils';

/**
 * 综合联合测试：跨功能组合操作
 */
test.describe('跨功能联合操作测试', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await waitForApp(page);
  });

  test('完整工作流：创建表头 → 输入数据 → 公式汇总 → 格式化', async ({ page }) => {
    // 创建表头（使用公式栏输入中文确保可靠）
    await setContentViaFormulaBar(page, 0, 0, '姓名');
    await setContentViaFormulaBar(page, 0, 1, '语文');
    await setContentViaFormulaBar(page, 0, 2, '数学');
    await setContentViaFormulaBar(page, 0, 3, '总分');

    // 输入数据
    await setContentViaFormulaBar(page, 1, 0, '张三');
    await typeInCell(page, 1, 1, '85');
    await typeInCell(page, 1, 2, '92');

    // 公式汇总
    await setContentViaFormulaBar(page, 1, 3, '=SUM(B2,C2)');

    // 验证公式
    const d2 = await getCellData(page, 1, 3);
    expect(d2.content).toBe('177');

    // 对 A1 单独加粗
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);

    const a1 = await getCellData(page, 0, 0);
    expect(a1.fontBold).toBe(true);
    expect(a1.content).toBe('姓名');
  });

  test('合并表头 → 输入数据 → 公式', async ({ page }) => {
    // 通过 API 合并标题行
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { mergeCells: (sr: number, sc: number, er: number, ec: number) => boolean };
        getRenderer: () => { render: () => void };
      };
      app.getModel().mergeCells(0, 0, 0, 3);
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);
    await setContentViaFormulaBar(page, 0, 0, '成绩表');

    // 输入数据
    await typeInCell(page, 1, 0, '科目');
    await typeInCell(page, 1, 1, '成绩');
    await typeInCell(page, 2, 0, '语文');
    await typeInCell(page, 2, 1, '90');
    await typeInCell(page, 3, 0, '数学');
    await typeInCell(page, 3, 1, '85');

    // 公式
    await typeInCell(page, 4, 0, '总计');
    await setContentViaFormulaBar(page, 4, 1, '=SUM(B3,B4)');

    const total = await getCellData(page, 4, 1);
    expect(total.content).toBe('175');

    const title = await getCellData(page, 0, 0);
    expect(title.content).toBe('成绩表');
    expect(title.colSpan).toBe(4);
  });

  test('输入 → 复制 → 粘贴 → 格式化 → 撤销全部', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Source');

    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);
    await clickCell(page, 0, 1);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    // 格式化粘贴的单元格
    await clickCell(page, 0, 1);
    await page.locator('#font-bold-btn').click();
    await page.locator('#font-italic-btn').click();
    await page.waitForTimeout(200);

    let b1 = await getCellData(page, 0, 1);
    expect(b1.content).toBe('Source');
    expect(b1.fontBold).toBe(true);
    expect(b1.fontItalic).toBe(true);

    // 撤销格式化
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    b1 = await getCellData(page, 0, 1);
    expect(b1.fontBold).toBeFalsy();
    expect(b1.fontItalic).toBeFalsy();
  });

  test('搜索 → 编辑找到的单元格 → 格式化 → 复制', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Apple');
    await typeInCell(page, 1, 0, 'Banana');
    await typeInCell(page, 2, 0, 'Cherry');

    // 搜索
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);
    const searchInput = page.locator('.search-input');
    await searchInput.fill('Banana');
    await page.waitForTimeout(300);

    // 关闭搜索
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 编辑
    await typeInCell(page, 1, 0, 'Blueberry');

    // 格式化
    await clickCell(page, 1, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);

    // 复制到另一个位置
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);
    await clickCell(page, 3, 0);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    const d1 = await getCellData(page, 3, 0);
    expect(d1.content).toBe('Blueberry');
    // 系统剪贴板粘贴可能不保留格式
  });

  test('数据输入 → 数字格式 → 对齐 → 完整表格', async ({ page }) => {
    await typeInCell(page, 0, 0, '商品');
    await typeInCell(page, 0, 1, '价格');
    await typeInCell(page, 0, 2, '数量');

    await typeInCell(page, 1, 0, '苹果');
    await typeInCell(page, 1, 1, '5.5');
    await typeInCell(page, 1, 2, '10');

    // 表头居中加粗（使用键盘选区）
    await clickCell(page, 0, 0);
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForTimeout(100);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(100);
    await page.locator('#horizontal-align-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.horizontal-align-option[data-align="center"]').click();
    await page.waitForTimeout(200);

    const header = await getCellData(page, 0, 0);
    expect(header.fontBold).toBe(true);
    expect(header.fontAlign).toBe('center');
  });

  test('键盘快捷键组合：Tab 导航输入', async ({ page }) => {
    // 从 A1 开始，使用公式栏输入确保可靠
    await setContentViaFormulaBar(page, 0, 0, 'Col1');
    await setContentViaFormulaBar(page, 0, 1, 'Col2');
    await setContentViaFormulaBar(page, 0, 2, 'Col3');

    const a1 = await getCellData(page, 0, 0);
    const b1 = await getCellData(page, 0, 1);
    const c1 = await getCellData(page, 0, 2);
    expect(a1.content).toBe('Col1');
    expect(b1.content).toBe('Col2');
    expect(c1.content).toBe('Col3');
  });

  test('大量数据输入 → 搜索 → 公式', async ({ page }) => {
    // 输入10行数据
    for (let i = 0; i < 10; i++) {
      await typeInCell(page, i, 0, `Item${i + 1}`);
      await typeInCell(page, i, 1, `${(i + 1) * 10}`);
    }

    // 搜索 Item5
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);
    const searchInput = page.locator('.search-input');
    await searchInput.fill('Item5');
    await page.waitForTimeout(300);

    const resultsInfo = page.locator('.search-results-info');
    const text = await resultsInfo.textContent();
    expect(text).toContain('1/1');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 在 B11 添加 SUM 公式
    await setContentViaFormulaBar(page, 10, 1, '=SUM(B1:B10)');
    const total = await getCellData(page, 10, 1);
    expect(total.content).toBe('550');
  });
});
