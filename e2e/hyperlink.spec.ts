import { test, expect, Page } from '@playwright/test';

/**
 * 辅助函数：点击 Canvas 上指定单元格
 * headerWidth=40, headerHeight=28，默认列宽=100，默认行高=25
 */
const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;

  const x = headerWidth + col * defaultColWidth + defaultColWidth / 2;
  const y = headerHeight + row * defaultRowHeight + defaultRowHeight / 2;

  await canvas.click({ position: { x, y } });
};

/**
 * 辅助函数：右键点击 Canvas 上指定单元格
 */
const rightClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;

  const x = headerWidth + col * defaultColWidth + defaultColWidth / 2;
  const y = headerHeight + row * defaultRowHeight + defaultRowHeight / 2;

  await canvas.click({ position: { x, y }, button: 'right' });
};

/**
 * 辅助函数：通过 window.app 获取单元格数据
 */
const getCellData = async (page: Page, row: number, col: number): Promise<{
  content?: string;
  hyperlink?: { url: string; displayText?: string } | null;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            content?: string;
            hyperlink?: { url: string; displayText?: string };
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return {
        content: cell?.content,
        hyperlink: cell?.hyperlink ?? null,
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：输入单元格内容
 */
const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await clickCell(page, row, col);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
};

/**
 * 辅助函数：点击右键菜单中的指定菜单项
 */
const clickContextMenuItem = async (page: Page, label: string): Promise<void> => {
  const menu = page.locator('.cell-context-menu');
  await expect(menu).toBeVisible();
  const item = menu.locator('.cell-context-menu-item', { hasText: label });
  await item.click();
};

test.describe('超链接功能 - 通过右键菜单插入超链接', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('通过右键菜单插入超链接（输入 URL 和显示文本）', async ({ page }) => {
    // 选中 A1 并输入内容
    await typeInCell(page, 0, 0, 'TestLink');

    // 右键点击 A1
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    // 点击「插入超链接」菜单项
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    // 验证对话框出现
    const dialog = page.locator('.modal-overlay');
    await expect(dialog).toBeVisible();

    // 输入 URL
    const urlInput = dialog.locator('input.modal-input').first();
    await urlInput.fill('https://www.example.com');

    // 输入显示文本
    const textInput = dialog.locator('input.modal-input').nth(1);
    await textInput.fill('示例链接');

    // 点击确定
    const confirmBtn = dialog.locator('.modal-confirm-btn');
    await confirmBtn.click();
    await page.waitForTimeout(300);

    // 验证超链接数据已设置
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.hyperlink).not.toBeNull();
    expect(cellData.hyperlink?.url).toBe('https://www.example.com');
    expect(cellData.hyperlink?.displayText).toBe('示例链接');
    expect(cellData.content).toBe('示例链接');
  });
});

test.describe('超链接功能 - 渲染样式验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('超链接单元格渲染为蓝色下划线样式（截图对比）', async ({ page }) => {
    // 在 A1 插入超链接
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    const dialog = page.locator('.modal-overlay');
    const urlInput = dialog.locator('input.modal-input').first();
    await urlInput.fill('https://www.example.com');
    const textInput = dialog.locator('input.modal-input').nth(1);
    await textInput.fill('蓝色链接');
    await dialog.locator('.modal-confirm-btn').click();
    await page.waitForTimeout(500);

    // 点击其他单元格取消选中，避免选中框干扰截图
    await clickCell(page, 2, 2);
    await page.waitForTimeout(300);

    // 截图对比验证蓝色下划线渲染
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('hyperlink-blue-underline.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('超链接功能 - 编辑超链接', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('编辑超链接（右键 → 编辑超链接 → 修改 URL）', async ({ page }) => {
    // 先插入超链接
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    let dialog = page.locator('.modal-overlay');
    let urlInput = dialog.locator('input.modal-input').first();
    await urlInput.fill('https://www.old-url.com');
    const textInput = dialog.locator('input.modal-input').nth(1);
    await textInput.fill('旧链接');
    await dialog.locator('.modal-confirm-btn').click();
    await page.waitForTimeout(300);

    // 右键点击已有超链接的单元格
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    // 应该显示「编辑超链接」菜单项
    await clickContextMenuItem(page, '编辑超链接');
    await page.waitForTimeout(300);

    // 验证编辑对话框出现，且预填充了旧 URL
    dialog = page.locator('.modal-overlay');
    await expect(dialog).toBeVisible();
    urlInput = dialog.locator('input.modal-input').first();
    await expect(urlInput).toHaveValue('https://www.old-url.com');

    // 修改 URL
    await urlInput.fill('https://www.new-url.com');
    await dialog.locator('.modal-confirm-btn').click();
    await page.waitForTimeout(300);

    // 验证超链接已更新
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.hyperlink?.url).toBe('https://www.new-url.com');
  });
});

test.describe('超链接功能 - 移除超链接', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('移除超链接（右键 → 移除超链接 → 验证内容保留）', async ({ page }) => {
    // 先插入超链接
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    const dialog = page.locator('.modal-overlay');
    const urlInput = dialog.locator('input.modal-input').first();
    await urlInput.fill('https://www.example.com');
    const textInput = dialog.locator('input.modal-input').nth(1);
    await textInput.fill('要移除的链接');
    await dialog.locator('.modal-confirm-btn').click();
    await page.waitForTimeout(300);

    // 验证超链接已设置
    let cellData = await getCellData(page, 0, 0);
    expect(cellData.hyperlink).not.toBeNull();

    // 右键点击 → 移除超链接
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '移除超链接');
    await page.waitForTimeout(300);

    // 验证超链接已移除，但内容保留
    cellData = await getCellData(page, 0, 0);
    expect(cellData.hyperlink).toBeNull();
    expect(cellData.content).toBe('要移除的链接');
  });
});

test.describe('超链接功能 - URL 自动补全', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('URL 自动补全 https:// 前缀', async ({ page }) => {
    // 右键插入超链接，输入不带协议前缀的 URL
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    const dialog = page.locator('.modal-overlay');
    const urlInput = dialog.locator('input.modal-input').first();
    await urlInput.fill('www.example.com');
    const textInput = dialog.locator('input.modal-input').nth(1);
    await textInput.fill('自动补全测试');
    await dialog.locator('.modal-confirm-btn').click();
    await page.waitForTimeout(300);

    // 验证 URL 已自动补全 https:// 前缀
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.hyperlink?.url).toBe('https://www.example.com');
  });

  test('已有 https:// 前缀的 URL 不重复添加', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    const dialog = page.locator('.modal-overlay');
    const urlInput = dialog.locator('input.modal-input').first();
    await urlInput.fill('https://www.example.com');
    await dialog.locator('.modal-confirm-btn').click();
    await page.waitForTimeout(300);

    const cellData = await getCellData(page, 0, 0);
    expect(cellData.hyperlink?.url).toBe('https://www.example.com');
  });

  test('http:// 前缀的 URL 保持不变', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    const dialog = page.locator('.modal-overlay');
    const urlInput = dialog.locator('input.modal-input').first();
    await urlInput.fill('http://www.example.com');
    await dialog.locator('.modal-confirm-btn').click();
    await page.waitForTimeout(300);

    const cellData = await getCellData(page, 0, 0);
    expect(cellData.hyperlink?.url).toBe('http://www.example.com');
  });

  test('mailto: 前缀的 URL 保持不变', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    const dialog = page.locator('.modal-overlay');
    const urlInput = dialog.locator('input.modal-input').first();
    await urlInput.fill('mailto:test@example.com');
    await dialog.locator('.modal-confirm-btn').click();
    await page.waitForTimeout(300);

    const cellData = await getCellData(page, 0, 0);
    expect(cellData.hyperlink?.url).toBe('mailto:test@example.com');
  });
});
