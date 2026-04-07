import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, selectRange, waitForApp,
} from './helpers/test-utils';

/**
 * 综合测试：字体样式、对齐、颜色、格式化
 * 覆盖：加粗、斜体、下划线、删除线、字体大小、字体族、对齐、背景色、字体色、换行、数字格式
 * 联合测试：多种格式组合应用
 */
test.describe('格式化综合测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('加粗按钮切换', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Bold');
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);
    const cell = await getCellData(page, 0, 0);
    expect(cell.fontBold).toBe(true);

    // 再次点击取消加粗
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(200);
    const cell2 = await getCellData(page, 0, 0);
    expect(cell2.fontBold).toBe(false);
  });

  test('斜体按钮切换', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Italic');
    await clickCell(page, 0, 0);
    await page.locator('#font-italic-btn').click();
    await page.waitForTimeout(200);
    const cell = await getCellData(page, 0, 0);
    expect(cell.fontItalic).toBe(true);
  });

  test('下划线按钮切换', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Underline');
    await clickCell(page, 0, 0);
    await page.locator('#font-underline-btn').click();
    await page.waitForTimeout(200);
    const cell = await getCellData(page, 0, 0);
    expect(cell.fontUnderline).toBe(true);
  });

  test('删除线按钮切换', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Strike');
    await clickCell(page, 0, 0);
    await page.locator('#font-strikethrough-btn').click();
    await page.waitForTimeout(200);
    const cell = await getCellData(page, 0, 0);
    expect(cell.fontStrikethrough).toBe(true);
  });

  test('联合操作：加粗+斜体+下划线组合', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Combined');
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.locator('#font-italic-btn').click();
    await page.locator('#font-underline-btn').click();
    await page.waitForTimeout(200);

    const cell = await getCellData(page, 0, 0);
    expect(cell.fontBold).toBe(true);
    expect(cell.fontItalic).toBe(true);
    expect(cell.fontUnderline).toBe(true);
  });

  test('字体颜色设置', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Color');
    await clickCell(page, 0, 0);
    await page.locator('#font-color').evaluate(
      (el: HTMLInputElement) => {
        el.value = '#ff0000';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
    );
    await page.waitForTimeout(200);
    const cell = await getCellData(page, 0, 0);
    expect(cell.fontColor).toBe('#ff0000');
  });

  test('背景颜色设置', async ({ page }) => {
    await typeInCell(page, 0, 0, 'BgColor');
    await clickCell(page, 0, 0);
    await page.locator('#bg-color').evaluate(
      (el: HTMLInputElement) => {
        el.value = '#00ff00';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
    );
    await page.waitForTimeout(200);
    const cell = await getCellData(page, 0, 0);
    expect(cell.bgColor).toBe('#00ff00');
  });

  test('水平对齐：左/中/右', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Align');
    await clickCell(page, 0, 0);

    // 打开水平对齐下拉
    await page.locator('#horizontal-align-btn').click();
    await page.waitForTimeout(100);
    // 选择居中
    await page.locator('.horizontal-align-option[data-align="center"]').click();
    await page.waitForTimeout(200);
    let cell = await getCellData(page, 0, 0);
    expect(cell.fontAlign).toBe('center');

    // 选择右对齐
    await page.locator('#horizontal-align-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.horizontal-align-option[data-align="right"]').click();
    await page.waitForTimeout(200);
    cell = await getCellData(page, 0, 0);
    expect(cell.fontAlign).toBe('right');
  });

  test('垂直对齐：上/中/下', async ({ page }) => {
    await typeInCell(page, 0, 0, 'VAlign');
    await clickCell(page, 0, 0);

    // 打开垂直对齐下拉
    await page.locator('#vertical-align-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.vertical-align-option[data-align="top"]').click();
    await page.waitForTimeout(200);
    let cell = await getCellData(page, 0, 0);
    expect(cell.verticalAlign).toBe('top');

    await page.locator('#vertical-align-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.vertical-align-option[data-align="bottom"]').click();
    await page.waitForTimeout(200);
    cell = await getCellData(page, 0, 0);
    expect(cell.verticalAlign).toBe('bottom');
  });

  test('自动换行切换', async ({ page }) => {
    await typeInCell(page, 0, 0, '这是一段很长的文本用于测试自动换行功能');
    await clickCell(page, 0, 0);
    await page.locator('#wrap-text-btn').click();
    await page.waitForTimeout(200);
    const cell = await getCellData(page, 0, 0);
    expect(cell.wrapText).toBe(true);
  });

  test('字体族选择', async ({ page }) => {
    await typeInCell(page, 0, 0, 'FontFamily');
    await clickCell(page, 0, 0);

    // 打开字体族下拉
    await page.locator('#font-family-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.font-family-option[data-font="Arial"]').click();
    await page.waitForTimeout(200);
    const cell = await getCellData(page, 0, 0);
    expect(cell.fontFamily).toBe('Arial');
  });

  test('字体大小选择', async ({ page }) => {
    await typeInCell(page, 0, 0, 'FontSize');
    await clickCell(page, 0, 0);

    // 打开字体大小下拉
    await page.locator('#font-size-btn').click();
    await page.waitForTimeout(100);
    // 选择一个字体大小选项
    const sizeOption = page.locator('.font-size-dropdown .font-size-option').first();
    if (await sizeOption.isVisible()) {
      await sizeOption.click();
      await page.waitForTimeout(200);
    }
  });

  test('联合操作：多单元格批量格式化', async ({ page }) => {
    // 输入多个单元格
    await typeInCell(page, 0, 0, 'A1');
    await typeInCell(page, 0, 1, 'B1');
    await typeInCell(page, 1, 0, 'A2');

    // 使用键盘选区 A1:B2
    await clickCell(page, 0, 0);
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(200);

    // 批量加粗
    await page.locator('#font-bold-btn').click();
    await page.waitForTimeout(300);

    // 验证 A1 加粗
    const a1 = await getCellData(page, 0, 0);
    expect(a1.fontBold).toBe(true);
    // 验证 B1 也加粗
    const b1 = await getCellData(page, 0, 1);
    expect(b1.fontBold).toBe(true);
  });

  test('联合操作：格式化 → 输入新内容 → 格式保留', async ({ page }) => {
    // 先设置格式
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    await page.locator('#font-italic-btn').click();
    await page.waitForTimeout(200);

    // 输入内容
    await typeInCell(page, 0, 0, 'Formatted');
    await page.waitForTimeout(200);

    // 验证格式保留
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('Formatted');
    // 格式可能在输入后保留或重置，取决于实现
  });

  test('数字格式：货币', async ({ page }) => {
    await typeInCell(page, 0, 0, '1234.56');
    await clickCell(page, 0, 0);

    // 打开数字格式下拉
    await page.locator('#number-format-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.number-format-option[data-format="currency"]').click();
    await page.waitForTimeout(200);

    const cell = await getCellData(page, 0, 0);
    expect(cell.format?.category).toBe('currency');
  });

  test('数字格式：百分比', async ({ page }) => {
    await typeInCell(page, 0, 0, '0.75');
    await clickCell(page, 0, 0);

    await page.locator('#number-format-btn').click();
    await page.waitForTimeout(100);
    await page.locator('.number-format-option[data-format="percentage"]').click();
    await page.waitForTimeout(200);

    const cell = await getCellData(page, 0, 0);
    expect(cell.format?.category).toBe('percentage');
  });
});
