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
 * 辅助函数：通过 window.app 获取单元格数据
 */
const getCellData = async (page: Page, row: number, col: number): Promise<{
  content?: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontColor?: string;
  bgColor?: string;
  hyperlink?: { url: string; displayText?: string } | null;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            content?: string;
            fontBold?: boolean;
            fontItalic?: boolean;
            fontColor?: string;
            bgColor?: string;
            hyperlink?: { url: string; displayText?: string };
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return {
        content: cell?.content,
        fontBold: cell?.fontBold,
        fontItalic: cell?.fontItalic,
        fontColor: cell?.fontColor,
        bgColor: cell?.bgColor,
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

test.describe('工具栏新按钮存在性验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('工具栏应包含所有新增按钮', async ({ page }) => {
    // 验证格式刷按钮
    await expect(page.locator('#format-painter-btn')).toBeVisible();
    // 验证超链接按钮
    await expect(page.locator('#hyperlink-btn')).toBeVisible();
    // 验证图片按钮
    await expect(page.locator('#image-btn')).toBeVisible();
    // 验证透视表按钮
    await expect(page.locator('#pivot-table-btn')).toBeVisible();
    // 验证脚本编辑器按钮
    await expect(page.locator('#script-editor-btn')).toBeVisible();
  });

  test('工具栏新按钮截图对比', async ({ page }) => {
    const toolbar = page.locator('.toolbar-row-1');
    await expect(toolbar).toHaveScreenshot('extension-toolbar-buttons.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});


test.describe('格式刷功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('单击格式刷按钮应进入单次模式（按钮高亮）', async ({ page }) => {
    // 选中 A1 并设置加粗
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();

    // 点击格式刷按钮
    const formatPainterBtn = page.locator('#format-painter-btn');
    await formatPainterBtn.click();

    // 验证按钮激活状态
    await expect(formatPainterBtn).toHaveClass(/active/);
  });

  test('格式刷应用后应自动退出单次模式', async ({ page }) => {
    // A1 设置加粗
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();

    // 激活格式刷
    const formatPainterBtn = page.locator('#format-painter-btn');
    await formatPainterBtn.click();
    await expect(formatPainterBtn).toHaveClass(/active/);

    // 点击 B1 应用格式
    await clickCell(page, 0, 1);
    await page.waitForTimeout(200);

    // 验证格式刷按钮退出激活状态
    await expect(formatPainterBtn).not.toHaveClass(/active/);

    // 验证 B1 已加粗
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.fontBold).toBe(true);
  });

  test('格式刷不应改变目标单元格内容', async ({ page }) => {
    // A1 输入内容并加粗
    await typeInCell(page, 0, 0, 'Source');
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();

    // B1 输入不同内容
    await typeInCell(page, 0, 1, 'Target');

    // 选中 A1，激活格式刷
    await clickCell(page, 0, 0);
    await page.locator('#format-painter-btn').click();

    // 点击 B1 应用格式
    await clickCell(page, 0, 1);
    await page.waitForTimeout(200);

    // 验证 B1 内容不变，格式已应用
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.content).toBe('Target');
    expect(cellB1.fontBold).toBe(true);
  });
});

test.describe('脚本编辑器面板', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('点击脚本编辑器按钮应打开编辑器面板', async ({ page }) => {
    const scriptBtn = page.locator('#script-editor-btn');
    await scriptBtn.click();
    await page.waitForTimeout(300);

    // 验证脚本编辑器面板可见
    const panel = page.locator('.script-editor-panel');
    await expect(panel).toBeVisible();
  });

  test('脚本编辑器面板可关闭', async ({ page }) => {
    // 打开面板
    await page.locator('#script-editor-btn').click();
    await page.waitForTimeout(300);

    const panel = page.locator('.script-editor-panel');
    await expect(panel).toBeVisible();

    // 点击关闭按钮
    const closeBtn = panel.locator('.script-editor-header button').last();
    await closeBtn.click();
    await page.waitForTimeout(200);

    // 验证面板隐藏
    await expect(panel).not.toBeVisible();
  });
});

test.describe('右键菜单功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('右键点击单元格应弹出菜单', async ({ page }) => {
    const canvas = page.locator('#excel-canvas');
    const headerWidth = 40;
    const headerHeight = 28;
    const x = headerWidth + 50;
    const y = headerHeight + 12;

    // 右键点击
    await canvas.click({ position: { x, y }, button: 'right' });
    await page.waitForTimeout(300);

    // 验证菜单可见（cell-context-menu 或 context-menu）
    const menu = page.locator('.cell-context-menu, .context-menu');
    await expect(menu.first()).toBeVisible();
  });

  test('点击外部区域应关闭右键菜单', async ({ page }) => {
    const canvas = page.locator('#excel-canvas');
    const headerWidth = 40;
    const headerHeight = 28;

    // 右键打开菜单
    await canvas.click({ position: { x: headerWidth + 50, y: headerHeight + 12 }, button: 'right' });
    await page.waitForTimeout(300);

    const menu = page.locator('.cell-context-menu, .context-menu');
    await expect(menu.first()).toBeVisible();

    // 点击 Canvas 其他位置关闭菜单
    await canvas.click({ position: { x: headerWidth + 250, y: headerHeight + 100 } });
    await page.waitForTimeout(300);

    // 验证菜单已关闭
    await expect(menu).toHaveCount(0);
  });
});

test.describe('透视表按钮', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('点击透视表按钮应打开配置面板', async ({ page }) => {
    // 先输入一些数据作为源数据
    await typeInCell(page, 0, 0, '姓名');
    await typeInCell(page, 0, 1, '销售额');
    await typeInCell(page, 1, 0, '张三');
    await typeInCell(page, 1, 1, '100');

    // 选中数据区域
    await clickCell(page, 0, 0);

    // 点击透视表按钮
    await page.locator('#pivot-table-btn').click();
    await page.waitForTimeout(300);

    // 验证透视表面板可见
    const panel = page.locator('.pivot-table-panel');
    await expect(panel).toBeVisible();
  });
});
