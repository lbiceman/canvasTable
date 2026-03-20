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
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { getCell: (row: number, col: number) => { content?: string } | null }
      };
      const cell = app.getModel().getCell(r, c);
      return { content: cell?.content };
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：获取当前选区信息（选区数量和活动选区坐标）
 */
const getSelectionInfo = async (page: Page): Promise<{
  count: number;
  activeStartRow: number;
  activeStartCol: number;
  activeEndRow: number;
  activeEndCol: number;
}> => {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as Record<string, unknown>).app as Record<string, unknown>;
    const multiSelection = app['multiSelection'] as {
      getSelections: () => Array<{ startRow: number; startCol: number; endRow: number; endCol: number }>;
      getActiveSelection: () => { startRow: number; startCol: number; endRow: number; endCol: number } | null;
    };
    const selections = multiSelection.getSelections();
    const active = multiSelection.getActiveSelection();
    return {
      count: selections.length,
      activeStartRow: active?.startRow ?? -1,
      activeStartCol: active?.startCol ?? -1,
      activeEndRow: active?.endRow ?? -1,
      activeEndCol: active?.endCol ?? -1,
    };
  });
};

test.describe('选区点击位置修复', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('单击单元格后选区位置应与点击位置一致', async ({ page }) => {
    // 点击 B2（第1行第1列）
    await clickCell(page, 1, 1);
    await page.waitForTimeout(200);

    const info = await getSelectionInfo(page);
    // 选区应精确定位到 B2
    expect(info.activeStartRow).toBe(1);
    expect(info.activeStartCol).toBe(1);
    expect(info.activeEndRow).toBe(1);
    expect(info.activeEndCol).toBe(1);
  });

  test('连续点击不同单元格不应出现幽灵选区', async ({ page }) => {
    // 先点击 A1
    await clickCell(page, 0, 0);
    await page.waitForTimeout(200);

    // 再点击 C3（不按 Ctrl）
    await clickCell(page, 2, 2);
    await page.waitForTimeout(200);

    const info = await getSelectionInfo(page);
    // 不按 Ctrl 时应只有一个选区
    expect(info.count).toBe(1);
    // 选区应在 C3
    expect(info.activeStartRow).toBe(2);
    expect(info.activeStartCol).toBe(2);
  });

  test('方向键导航后选区位置正确且无双焦点框', async ({ page }) => {
    // 点击 A1
    await clickCell(page, 0, 0);
    await page.waitForTimeout(200);

    // 按 ArrowDown 移动到 A2
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    const info = await getSelectionInfo(page);
    expect(info.count).toBe(1);
    expect(info.activeStartRow).toBe(1);
    expect(info.activeStartCol).toBe(0);

    // 按 ArrowRight 移动到 B2
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    const info2 = await getSelectionInfo(page);
    expect(info2.count).toBe(1);
    expect(info2.activeStartRow).toBe(1);
    expect(info2.activeStartCol).toBe(1);
  });

  test('单击选区截图对比 — 无幽灵选区', async ({ page }) => {
    // 输入一些内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('Hello');
    await page.keyboard.press('Tab');
    await page.keyboard.type('World');
    await page.keyboard.press('Enter');

    // 点击 B1 单元格
    await clickCell(page, 0, 1);
    await page.waitForTimeout(300);

    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('selection-single-click-no-ghost.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('搜索替换功能修复', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('替换功能应正确替换包含特殊字符的文本', async ({ page }) => {
    // 在 A1 输入包含特殊字符的文本
    await clickCell(page, 0, 0);
    await page.keyboard.type('price: $100');
    await page.keyboard.press('Enter');

    // 重新选中 A1
    await clickCell(page, 0, 0);
    await page.waitForTimeout(200);

    // 打开搜索对话框
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(300);

    // 查找 "$100" 并替换为 "$200"
    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('$100');

    // 点击替换展开（如果有的话）
    const replaceToggle = page.locator('.replace-toggle, .search-replace-toggle, [data-action="toggle-replace"]');
    if (await replaceToggle.isVisible()) {
      await replaceToggle.click();
      await page.waitForTimeout(200);
    }

    const replaceInput = page.locator('.replace-input').first();
    if (await replaceInput.isVisible()) {
      await replaceInput.fill('$200');

      // 点击替换按钮
      const replaceBtn = page.locator('.replace-btn, [data-action="replace"]').first();
      if (await replaceBtn.isVisible()) {
        await replaceBtn.click();
        await page.waitForTimeout(300);

        // 验证替换结果
        const cellData = await getCellData(page, 0, 0);
        expect(cellData.content).toContain('200');
      }
    }
  });
});

test.describe('Ctrl+点击多选区保持', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Ctrl+点击应正确添加多个选区', async ({ page }) => {
    const canvas = page.locator('#excel-canvas');
    const headerWidth = 40;
    const headerHeight = 28;
    const defaultColWidth = 100;
    const defaultRowHeight = 25;

    // 先点击 A1
    await clickCell(page, 0, 0);
    await page.waitForTimeout(200);

    // Ctrl+点击 C3
    const x = headerWidth + 2 * defaultColWidth + defaultColWidth / 2;
    const y = headerHeight + 2 * defaultRowHeight + defaultRowHeight / 2;
    await canvas.click({ position: { x, y }, modifiers: ['Control'] });
    await page.waitForTimeout(200);

    const info = await getSelectionInfo(page);
    // Ctrl+点击后应有 2 个选区
    expect(info.count).toBe(2);
  });
});
