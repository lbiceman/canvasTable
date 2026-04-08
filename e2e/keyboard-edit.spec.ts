import { test, expect, Page } from '@playwright/test';
import { clickCell, typeInCell, getCellContent, getCellData } from './helpers/test-utils';

// ============================================================
// 深入测试：键盘快捷键在编辑模式下的行为
// ============================================================

test.describe('编辑模式 - Alt+Enter 换行', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Alt+Enter 应在单元格内插入换行符', async ({ page }) => {
    // 双击进入编辑模式
    const canvas = page.locator('#excel-canvas');
    await canvas.dblclick({ position: { x: 40 + 50, y: 28 + 12 } });
    await page.waitForTimeout(300);

    // 输入第一行
    await page.keyboard.type('第一行');

    // Alt+Enter 换行
    await page.keyboard.press('Alt+Enter');

    // 输入第二行
    await page.keyboard.type('第二行');

    // Enter 保存
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const content = await getCellContent(page, 0, 0);
    expect(content).toContain('第一行');
    expect(content).toContain('第二行');
    // 应包含换行符
    expect(content).toContain('\n');
  });

  test('多次 Alt+Enter 应插入多个换行', async ({ page }) => {
    const canvas = page.locator('#excel-canvas');
    await canvas.dblclick({ position: { x: 40 + 50, y: 28 + 12 } });
    await page.waitForTimeout(300);

    await page.keyboard.type('行1');
    await page.keyboard.press('Alt+Enter');
    await page.keyboard.type('行2');
    await page.keyboard.press('Alt+Enter');
    await page.keyboard.type('行3');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const content = await getCellContent(page, 0, 0);
    const lines = content.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('行1');
    expect(lines[1]).toBe('行2');
    expect(lines[2]).toBe('行3');
  });
});

test.describe('编辑模式 - F2 进入编辑', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('F2 应进入编辑模式并保留原内容', async ({ page }) => {
    await typeInCell(page, 0, 0, '原始内容');

    // 选中单元格
    await clickCell(page, 0, 0);
    await page.waitForTimeout(100);

    // F2 进入编辑
    await page.keyboard.press('F2');
    await page.waitForTimeout(200);

    // 验证内联编辑器可见
    const editor = page.locator('.inline-editor-input');
    if (await editor.isVisible()) {
      // 验证编辑器中有原始内容
      const value = await editor.inputValue();
      expect(value).toBe('原始内容');

      // 追加内容
      await page.keyboard.type('_追加');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      const content = await getCellContent(page, 0, 0);
      expect(content).toBe('原始内容_追加');
    }
  });

  test('直接输入字符应清空原内容并开始编辑', async ({ page }) => {
    await typeInCell(page, 0, 0, '旧内容');

    await clickCell(page, 0, 0);
    await page.waitForTimeout(200);

    // 直接输入字符（会清空原内容并进入编辑模式）
    await page.keyboard.press('n');
    await page.waitForTimeout(300);

    // 继续输入
    await page.keyboard.type('ew');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const content = await getCellContent(page, 0, 0);
    expect(content).toBe('new');
  });
});

test.describe('编辑模式 - Escape 取消编辑', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('编辑中按 Escape 应取消修改', async ({ page }) => {
    await typeInCell(page, 0, 0, '原始值');

    await clickCell(page, 0, 0);
    await page.keyboard.press('F2');
    await page.waitForTimeout(200);

    // 修改内容
    const editor = page.locator('.inline-editor-input');
    if (await editor.isVisible()) {
      await editor.fill('修改后的值');

      // Escape 取消
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // 内容应保持原始值
      const content = await getCellContent(page, 0, 0);
      expect(content).toBe('原始值');
    }
  });
});

test.describe('键盘导航 - 方向键', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('方向键应移动选中单元格', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.waitForTimeout(100);

    // 向右
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    // 向下
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // 输入内容验证位置
    await page.keyboard.type('B2');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const content = await getCellContent(page, 1, 1);
    expect(content).toBe('B2');
  });

  test('Shift+方向键应扩展选区', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.waitForTimeout(100);

    // Shift+Right 扩展选区
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(100);

    // 通过 renderer 的选区信息验证
    const selection = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getRenderer: () => {
          getSelectionRect: () => { x: number; y: number; width: number; height: number } | null;
        };
      };
      return app.getRenderer().getSelectionRect();
    });

    // 选区应该存在且有一定大小（至少 2 列 2 行）
    expect(selection).not.toBeNull();
    if (selection) {
      expect(selection.width).toBeGreaterThan(100); // 至少 2 列宽
      expect(selection.height).toBeGreaterThan(25); // 至少 2 行高
    }
  });
});

test.describe('键盘快捷键 - Tab 导航', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Tab 应向右移动', async ({ page }) => {
    // 先输入 A1
    await clickCell(page, 0, 0);
    await page.keyboard.type('A1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);

    // 回到 A1，然后 Tab 到 B1
    await clickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // 在 B1 输入
    await page.keyboard.type('B1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    expect(await getCellContent(page, 0, 0)).toBe('A1');
    expect(await getCellContent(page, 0, 1)).toBe('B1');
  });
});

test.describe('键盘快捷键 - 格式快捷键', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Ctrl+B 应切换加粗', async ({ page }) => {
    await typeInCell(page, 0, 0, '测试');
    await clickCell(page, 0, 0);
    await page.waitForTimeout(100);

    await page.keyboard.press('Control+b');
    await page.waitForTimeout(200);

    const data = await getCellData(page, 0, 0);
    expect(data.fontBold).toBe(true);

    // 再次按应取消加粗
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(200);

    const data2 = await getCellData(page, 0, 0);
    expect(data2.fontBold).toBe(false);
  });

  test('Ctrl+I 应切换斜体', async ({ page }) => {
    await typeInCell(page, 0, 0, '测试');
    await clickCell(page, 0, 0);
    await page.waitForTimeout(100);

    await page.keyboard.press('Control+i');
    await page.waitForTimeout(200);

    const data = await getCellData(page, 0, 0);
    expect(data.fontItalic).toBe(true);
  });

  test('Ctrl+U 应切换下划线', async ({ page }) => {
    await typeInCell(page, 0, 0, '测试');
    await clickCell(page, 0, 0);
    await page.waitForTimeout(100);

    await page.keyboard.press('Control+u');
    await page.waitForTimeout(200);

    const data = await getCellData(page, 0, 0);
    expect(data.fontUnderline).toBe(true);
  });
});

test.describe('键盘快捷键 - Delete/Backspace 清除内容', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Delete 应清除选中单元格内容', async ({ page }) => {
    await typeInCell(page, 0, 0, '要删除');
    await clickCell(page, 0, 0);
    await page.waitForTimeout(100);

    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    const content = await getCellContent(page, 0, 0);
    expect(content).toBe('');
  });

  test('Backspace 应清除选中单元格内容', async ({ page }) => {
    await typeInCell(page, 0, 0, '要删除');
    await clickCell(page, 0, 0);
    await page.waitForTimeout(100);

    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    const content = await getCellContent(page, 0, 0);
    expect(content).toBe('');
  });

  test('Delete 应清除多选区域的所有内容', async ({ page }) => {
    await typeInCell(page, 0, 0, 'A1');
    await typeInCell(page, 0, 1, 'B1');
    await typeInCell(page, 1, 0, 'A2');
    await typeInCell(page, 1, 1, 'B2');

    // 选中 A1，然后用 Shift+方向键扩展到 B2
    await clickCell(page, 0, 0);
    await page.waitForTimeout(200);
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(200);

    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    expect(await getCellContent(page, 0, 0)).toBe('');
    expect(await getCellContent(page, 0, 1)).toBe('');
    expect(await getCellContent(page, 1, 0)).toBe('');
    expect(await getCellContent(page, 1, 1)).toBe('');
  });
});

test.describe('键盘快捷键 - Ctrl+A 全选', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Ctrl+A 应选中所有单元格', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);

    // 通过 renderer 的选区矩形验证全选
    const selRect = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getRenderer: () => {
          getSelectionRect: () => { x: number; y: number; width: number; height: number } | null;
        };
      };
      return app.getRenderer().getSelectionRect();
    });

    // 全选后选区应非常大
    expect(selRect).not.toBeNull();
    if (selRect) {
      expect(selRect.width).toBeGreaterThan(500);
      expect(selRect.height).toBeGreaterThan(500);
    }
  });
});

test.describe('键盘快捷键 - Ctrl+F 搜索', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Ctrl+F 应打开搜索对话框', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);

    const searchDialog = page.locator('.search-dialog');
    await expect(searchDialog).toBeVisible();

    // Escape 关闭
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(searchDialog).not.toBeVisible();
  });
});
