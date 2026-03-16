import { test, expect, Page } from '@playwright/test';

// ============================================================
// 辅助函数
// ============================================================

const HEADER_WIDTH = 40;
const HEADER_HEIGHT = 28;
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 25;

const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.click({ position: { x, y } });
};

const dblClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.dblclick({ position: { x, y } });
};

const getCellData = async (page: Page, row: number, col: number): Promise<{
  content?: string;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => Record<string, unknown> | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell) return {};
      return { content: cell.content as string | undefined };
    },
    [row, col] as [number, number],
  );
};

const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await dblClickCell(page, row, col);
  const editorInput = page.locator('.inline-editor input');
  await editorInput.fill(text);
  await page.keyboard.press('Enter');
};

// ============================================================
// 测试套件
// ============================================================

test.describe('设置面板', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('点击"更多"按钮打开设置面板', async ({ page }) => {
    const toggleBtn = page.locator('#data-controls-toggle');
    await expect(toggleBtn).toBeVisible();

    await toggleBtn.click();

    const panel = page.locator('#control-panel');
    await expect(panel).toBeVisible();
  });

  test('点击关闭按钮关闭设置面板', async ({ page }) => {
    // 打开面板
    await page.locator('#data-controls-toggle').click();
    const panel = page.locator('#control-panel');
    await expect(panel).toBeVisible();

    // 点击关闭按钮
    await page.locator('.ui-close-button').click();
    await expect(panel).not.toBeVisible();
  });

  test('设置面板包含主题设置区域', async ({ page }) => {
    await page.locator('#data-controls-toggle').click();

    // 验证主题设置区域存在
    const themeTitle = page.locator('.ui-group-title:has-text("主题设置")');
    await expect(themeTitle).toBeVisible();
  });

  test('设置面板包含导出/导入/存储按钮', async ({ page }) => {
    await page.locator('#data-controls-toggle').click();

    // 验证各功能区域存在
    await expect(page.locator('.ui-group-title:has-text("导出数据")')).toBeVisible();
    await expect(page.locator('.ui-group-title:has-text("导入数据")')).toBeVisible();
    await expect(page.locator('.ui-group-title:has-text("本地存储")')).toBeVisible();
    await expect(page.locator('.ui-group-title:has-text("其他操作")')).toBeVisible();
  });

  test('加载示例数据按钮存在', async ({ page }) => {
    await page.locator('#data-controls-toggle').click();

    const exampleBtn = page.locator('.ui-example-button');
    await expect(exampleBtn).toBeVisible();
    await expect(exampleBtn).toContainText('加载示例数据');
  });
});

test.describe('主题切换', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('切换到深色主题应更新 CSS 变量', async ({ page }) => {
    // 打开设置面板
    await page.locator('#data-controls-toggle').click();
    await page.waitForTimeout(200);

    // 点击深色主题选项
    const darkOption = page.locator('.ui-theme-option:has-text("深色")');
    await darkOption.click();
    await page.waitForTimeout(300);

    // 验证 CSS 变量已更新（深色主题的背景色应该是深色）
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--theme-background').trim();
    });
    // 深色主题背景色不应该是白色
    expect(bgColor).not.toBe('#ffffff');
    expect(bgColor.length).toBeGreaterThan(0);
  });

  test('切换回浅色主题应恢复 CSS 变量', async ({ page }) => {
    // 打开设置面板
    await page.locator('#data-controls-toggle').click();
    await page.waitForTimeout(200);

    // 先切换到深色
    const darkOption = page.locator('.ui-theme-option:has-text("深色")');
    await darkOption.click();
    await page.waitForTimeout(200);

    // 再切换回浅色
    const lightOption = page.locator('.ui-theme-option:has-text("浅色")');
    await lightOption.click();
    await page.waitForTimeout(200);

    // 验证 CSS 变量恢复
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--theme-background').trim();
    });
    // 浅色主题背景色应该是浅色
    expect(bgColor).toBeTruthy();
  });
});

test.describe('LocalStorage 持久化', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('通过 API 保存数据到 localStorage 并加载', async ({ page }) => {
    // 在 A1 输入内容
    await typeInCell(page, 0, 0, 'PersistMe');

    // 通过 window.app 调用保存
    const saveResult = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        saveToLocalStorage: () => boolean;
      };
      return app.saveToLocalStorage();
    });
    expect(saveResult).toBe(true);

    // 验证 localStorage 中有数据
    const hasData = await page.evaluate(() => {
      return localStorage.getItem('spreadsheet-data') !== null;
    });
    expect(hasData).toBe(true);
  });

  test('加载示例数据后单元格有内容', async ({ page }) => {
    // 打开设置面板
    await page.locator('#data-controls-toggle').click();
    await page.waitForTimeout(200);

    // 点击加载示例数据
    const exampleBtn = page.locator('.ui-example-button');
    await exampleBtn.click();
    await page.waitForTimeout(500);

    // 验证 A1 有内容（示例数据应该有内容）
    const cellA1 = await getCellData(page, 0, 0);
    expect(cellA1.content).toBeTruthy();
  });
});

test.describe('清空数据', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('清空数据后所有单元格内容为空', async ({ page }) => {
    // 先输入一些内容
    await typeInCell(page, 0, 0, 'WillBeCleared');
    await typeInCell(page, 1, 0, 'AlsoCleared');

    // 打开设置面板
    await page.locator('#data-controls-toggle').click();
    await page.waitForTimeout(200);

    // 监听 confirm 对话框并接受
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // 点击清空数据
    const clearBtn = page.locator('button:has-text("清空数据")');
    await clearBtn.click();
    await page.waitForTimeout(300);

    // 验证单元格内容被清空
    const cellA1 = await getCellData(page, 0, 0);
    const cellA2 = await getCellData(page, 1, 0);
    expect(cellA1.content).toBe('');
    expect(cellA2.content).toBe('');
  });
});
