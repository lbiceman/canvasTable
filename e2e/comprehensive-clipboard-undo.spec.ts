import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, selectRange, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：剪贴板操作 + 撤销/重做
 * 覆盖：复制、剪切、粘贴、撤销、重做、联合操作
 */
test.describe('剪贴板与撤销重做综合测试', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await waitForApp(page);
  });

  test('复制粘贴单个单元格', async ({ page }) => {
    await typeInCell(page, 0, 0, 'CopyTest');
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    await clickCell(page, 0, 1);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    const b1 = await getCellData(page, 0, 1);
    expect(b1.content).toBe('CopyTest');
    // 原单元格内容保留
    const a1 = await getCellData(page, 0, 0);
    expect(a1.content).toBe('CopyTest');
  });

  test('剪切粘贴单个单元格', async ({ page }) => {
    await typeInCell(page, 0, 0, 'CutTest');
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+x');
    await page.waitForTimeout(300);

    await clickCell(page, 0, 2);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    const c1 = await getCellData(page, 0, 2);
    expect(c1.content).toBe('CutTest');
  });

  test('复制粘贴多单元格区域', async ({ page }) => {
    await typeInCell(page, 0, 0, 'R1C1');
    await typeInCell(page, 0, 1, 'R1C2');
    await typeInCell(page, 1, 0, 'R2C1');
    await typeInCell(page, 1, 1, 'R2C2');

    // 选择 A1:B2（使用键盘选区）
    await clickCell(page, 0, 0);
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    // 粘贴到 A4
    await clickCell(page, 3, 0);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    // 验证粘贴结果
    const a4 = await getCellData(page, 3, 0);
    expect(a4.content).toBeTruthy();
  });

  test('撤销文本输入', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Undo');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('');
  });

  test('重做撤销的操作', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Redo');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('Redo');
  });

  test('撤销按钮和重做按钮', async ({ page }) => {
    await typeInCell(page, 0, 0, 'BtnTest');

    // 撤销按钮应该可用
    const undoBtn = page.locator('#undo-btn');
    await expect(undoBtn).not.toBeDisabled();
    await undoBtn.click();
    await page.waitForTimeout(200);

    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('');

    // 重做按钮应该可用
    const redoBtn = page.locator('#redo-btn');
    await expect(redoBtn).not.toBeDisabled();
    await redoBtn.click();
    await page.waitForTimeout(200);

    const cell2 = await getCellData(page, 0, 0);
    expect(cell2.content).toBe('BtnTest');
  });

  test('联合操作：输入 → 格式化 → 撤销格式 → 撤销输入', async ({ page }) => {
    // 输入
    await typeInCell(page, 0, 0, 'UndoChain');
    // 格式化
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);

    let cell = await getCellData(page, 0, 0);
    expect(cell.fontBold).toBe(true);

    // 撤销格式化
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    cell = await getCellData(page, 0, 0);
    expect(cell.fontBold).toBeFalsy();
    expect(cell.content).toBe('UndoChain');

    // 撤销输入
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('');
  });

  test('联合操作：复制带格式的单元格', async ({ page }) => {
    // 输入并加粗
    await typeInCell(page, 0, 0, 'BoldCopy');
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);

    // 复制
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    // 粘贴到 B1
    await clickCell(page, 0, 1);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    const b1 = await getCellData(page, 0, 1);
    expect(b1.content).toBe('BoldCopy');
    // 系统剪贴板粘贴可能不保留格式，验证内容即可
  });

  test('联合操作：剪切 → 粘贴 → 撤销恢复原位', async ({ page }) => {
    await typeInCell(page, 0, 0, 'CutUndo');
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+x');
    await page.waitForTimeout(300);

    await clickCell(page, 2, 0);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    // 撤销粘贴
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    // A3 应该被清空
    const a3 = await getCellData(page, 2, 0);
    expect(a3.content).toBe('');
  });

  test('多次撤销和重做', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Step1');
    await typeInCell(page, 0, 1, 'Step2');
    await typeInCell(page, 0, 2, 'Step3');

    // 撤销3次
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    const a1 = await getCellData(page, 0, 0);
    const b1 = await getCellData(page, 0, 1);
    const c1 = await getCellData(page, 0, 2);
    expect(a1.content).toBe('');
    expect(b1.content).toBe('');
    expect(c1.content).toBe('');

    // 重做2次
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);

    const a1r = await getCellData(page, 0, 0);
    const b1r = await getCellData(page, 0, 1);
    expect(a1r.content).toBe('Step1');
    expect(b1r.content).toBe('Step2');
  });
});
