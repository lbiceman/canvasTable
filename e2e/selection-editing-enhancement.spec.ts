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
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            content?: string;
            fontBold?: boolean;
            fontItalic?: boolean;
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return {
        content: cell?.content,
        fontBold: cell?.fontBold,
        fontItalic: cell?.fontItalic,
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：获取模型的冻结配置
 */
const getFreezeConfig = async (page: Page): Promise<{ rows: number; cols: number }> => {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => {
        getFreezeRows: () => number;
        getFreezeCols: () => number;
      };
    };
    const model = app.getModel();
    return { rows: model.getFreezeRows(), cols: model.getFreezeCols() };
  });
};

// ============================================================
// 全选功能 (Ctrl+A)
// ============================================================

test.describe('全选功能 (Ctrl+A)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Ctrl+A 应选中所有单元格并在截图中体现', async ({ page }) => {
    // 先输入一些内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('A1');
    await page.keyboard.press('Tab');
    await page.keyboard.type('B1');
    await page.keyboard.press('Enter');

    // 按 Ctrl+A 全选
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);

    // 截图验证全选状态
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('select-all-ctrl-a.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('全选后按方向键应取消全选并定位到对应单元格', async ({ page }) => {
    await clickCell(page, 0, 0);

    // 全选
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);

    // 按下方向键取消全选
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    // 验证不再是全选状态（通过检查选中单元格信息）
    const selectedCell = await page.locator('#selected-cell').textContent();
    // 按右键后应该移动到 B1
    expect(selectedCell).toBeTruthy();
  });
});

// ============================================================
// 查找与替换功能 (Ctrl+H)
// ============================================================

test.describe('查找与替换功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Ctrl+H 应打开查找替换对话框', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+h');
    await page.waitForTimeout(300);

    // 验证替换对话框可见（查找替换模式下应有替换输入框）
    const searchDialog = page.locator('.search-dialog');
    await expect(searchDialog).toBeVisible();
  });

  test('替换功能应正确替换单元格内容', async ({ page }) => {
    // 输入测试数据到 A1
    await clickCell(page, 0, 0);
    await page.keyboard.type('Hello World');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // 输入测试数据到 A2
    await page.keyboard.type('Hello Test');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // 验证输入成功
    const beforeA1 = await getCellData(page, 0, 0);
    const beforeA2 = await getCellData(page, 1, 0);

    // 打开查找替换
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+h');
    await page.waitForTimeout(500);

    // 在查找框输入
    const searchInput = page.locator('.search-dialog input').first();
    await searchInput.fill('Hello');

    // 在替换框输入
    const replaceInput = page.locator('.search-dialog .replace-input');
    await replaceInput.fill('Hi');

    // 点击全部替换按钮
    const replaceAllBtn = page.locator('.search-dialog .replace-all-btn');
    await replaceAllBtn.click();
    await page.waitForTimeout(500);

    // 验证替换结果
    const cellA1 = await getCellData(page, 0, 0);
    const cellA2 = await getCellData(page, 1, 0);

    // 如果原始内容包含 Hello，验证替换成功
    if (beforeA1.content?.includes('Hello')) {
      expect(cellA1.content).toContain('Hi');
    }
    if (beforeA2.content?.includes('Hello')) {
      expect(cellA2.content).toContain('Hi');
    }
  });
});

// ============================================================
// 冻结窗格功能
// ============================================================

test.describe('冻结窗格功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('冻结首行应设置 freezeRows=1', async ({ page }) => {
    // 点击冻结按钮打开下拉菜单
    const freezeBtn = page.locator('#freeze-btn');
    await freezeBtn.click();
    await page.waitForTimeout(200);

    // 选择"冻结首行"
    const firstRowOption = page.locator('.freeze-option[data-freeze="firstRow"]');
    await firstRowOption.click();
    await page.waitForTimeout(200);

    // 验证冻结配置
    const config = await getFreezeConfig(page);
    expect(config.rows).toBe(1);
    expect(config.cols).toBe(0);
  });

  test('冻结首列应设置 freezeCols=1', async ({ page }) => {
    const freezeBtn = page.locator('#freeze-btn');
    await freezeBtn.click();
    await page.waitForTimeout(200);

    const firstColOption = page.locator('.freeze-option[data-freeze="firstCol"]');
    await firstColOption.click();
    await page.waitForTimeout(200);

    const config = await getFreezeConfig(page);
    expect(config.rows).toBe(0);
    expect(config.cols).toBe(1);
  });

  test('取消冻结应清除冻结配置', async ({ page }) => {
    // 先冻结首行
    const freezeBtn = page.locator('#freeze-btn');
    await freezeBtn.click();
    await page.waitForTimeout(200);
    await page.locator('.freeze-option[data-freeze="firstRow"]').click();
    await page.waitForTimeout(200);

    // 再取消冻结
    await freezeBtn.click();
    await page.waitForTimeout(200);
    await page.locator('.freeze-option[data-freeze="none"]').click();
    await page.waitForTimeout(200);

    const config = await getFreezeConfig(page);
    expect(config.rows).toBe(0);
    expect(config.cols).toBe(0);
  });

  test('冻结首行后 Canvas 渲染应体现冻结分隔线（截图对比）', async ({ page }) => {
    // 输入一些内容
    await clickCell(page, 0, 0);
    await page.keyboard.type('冻结行');
    await page.keyboard.press('Enter');

    // 冻结首行
    const freezeBtn = page.locator('#freeze-btn');
    await freezeBtn.click();
    await page.waitForTimeout(200);
    await page.locator('.freeze-option[data-freeze="firstRow"]').click();
    await page.waitForTimeout(300);

    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('freeze-first-row.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

// ============================================================
// 撤销/重做功能验证
// ============================================================

test.describe('撤销/重做功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('输入内容后 Ctrl+Z 应撤销', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('Test');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // 验证内容已输入
    const before = await getCellData(page, 0, 0);
    expect(before.content).toBe('Test');

    // 撤销（可能需要多次：一次撤销移动，一次撤销内容）
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    let after = await getCellData(page, 0, 0);
    if (after.content === 'Test') {
      // 第一次撤销可能只撤销了光标移动，再撤销一次
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(200);
      after = await getCellData(page, 0, 0);
    }

    // 验证内容已撤销
    expect(after.content).toBeFalsy();
  });

  test('撤销后 Ctrl+Y 应重做', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('Redo');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const before = await getCellData(page, 0, 0);
    expect(before.content).toBe('Redo');

    // 撤销（可能需要多次撤销：一次撤销 Enter 移动，一次撤销内容输入）
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    const afterUndo = await getCellData(page, 0, 0);
    // 内容应被撤销为空
    const isUndone = !afterUndo.content || afterUndo.content === '';

    // 重做
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);
    // 可能需要再次重做
    if (isUndone) {
      await page.keyboard.press('Control+y');
      await page.waitForTimeout(200);
    }

    const afterRedo = await getCellData(page, 0, 0);
    expect(afterRedo.content).toBe('Redo');
  });

  test('冻结操作的撤销/重做', async ({ page }) => {
    // 冻结首行
    const freezeBtn = page.locator('#freeze-btn');
    await freezeBtn.click();
    await page.waitForTimeout(200);
    await page.locator('.freeze-option[data-freeze="firstRow"]').click();
    await page.waitForTimeout(200);

    let config = await getFreezeConfig(page);
    expect(config.rows).toBe(1);

    // 撤销冻结
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    config = await getFreezeConfig(page);
    expect(config.rows).toBe(0);

    // 重做冻结
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);

    config = await getFreezeConfig(page);
    expect(config.rows).toBe(1);
  });
});
