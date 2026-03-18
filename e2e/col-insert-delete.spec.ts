import { test, expect, Page } from '@playwright/test';

// ============================================================
// 渲染配置常量
// ============================================================
const HEADER_WIDTH = 40;
const HEADER_HEIGHT = 28;
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 25;

// ============================================================
// 辅助函数
// ============================================================

/** 点击 Canvas 上指定单元格（0-indexed） */
const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.click({ position: { x, y } });
};

/** 双击单元格进入编辑模式 */
const dblClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.dblclick({ position: { x, y } });
};

/** 在单元格中输入内容 */
const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await dblClickCell(page, row, col);
  const editorInput = page.locator('.inline-editor input');
  await editorInput.fill(text);
  await page.keyboard.press('Enter');
};

/** 右键点击列头区域（col 为 0-indexed） */
const rightClickColHeader = async (page: Page, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT / 2;
  await canvas.click({ position: { x, y }, button: 'right' });
};

/** 获取模型列数 */
const getColCount = async (page: Page): Promise<number> => {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getColCount: () => number };
    };
    return app.getModel().getColCount();
  });
};

/** 获取单元格数据 */
const getCellData = async (page: Page, row: number, col: number): Promise<{
  content?: string;
  rowSpan?: number;
  colSpan?: number;
  isMerged?: boolean;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { getCell: (row: number, col: number) => Record<string, unknown> | null };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell) return {};
      return {
        content: cell.content as string | undefined,
        rowSpan: cell.rowSpan as number | undefined,
        colSpan: cell.colSpan as number | undefined,
        isMerged: cell.isMerged as boolean | undefined,
      };
    },
    [row, col] as [number, number],
  );
};

/** 获取列宽 */
const getColWidth = async (page: Page, col: number): Promise<number> => {
  return await page.evaluate(
    (c) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { getColWidth: (col: number) => number };
      };
      return app.getModel().getColWidth(c);
    },
    col,
  );
};

// ============================================================
// 测试套件
// ============================================================

test.describe('列插入/删除 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(300);
    // 清除 localStorage 残留数据，确保每个测试从干净状态启动
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(300);
  });

  // ========================================================
  // 10.4 列插入基础功能
  // ========================================================
  test.describe('列插入基础功能', () => {
    test('右键点击列头弹出上下文菜单，菜单包含"插入列"选项', async ({ page }) => {
      await rightClickColHeader(page, 0);

      const colMenu = page.locator('.col-context-menu');
      await expect(colMenu).toBeVisible();
      // 菜单中包含"列"文字（插入 N 列）
      await expect(colMenu).toContainText('列');
    });

    test('点击确定后列数增加 1', async ({ page }) => {
      const colCountBefore = await getColCount(page);

      await rightClickColHeader(page, 0);
      await page.locator('.col-context-menu .context-menu-btn').click();

      const colCountAfter = await getColCount(page);
      expect(colCountAfter).toBe(colCountBefore + 1);
    });

    test('插入列后原列数据向右移动', async ({ page }) => {
      // 在 A1（col=0）输入内容
      await typeInCell(page, 0, 0, 'A1内容');
      // 等待内容写入稳定
      await page.waitForTimeout(200);

      // 验证内容已写入 A1
      const cellA1Before = await getCellData(page, 0, 0);
      expect(cellA1Before.content).toBe('A1内容');

      // 右键点击 A 列头，插入 1 列
      await rightClickColHeader(page, 0);
      await page.locator('.col-context-menu .context-menu-btn').click();
      await page.waitForTimeout(200);

      // 原 A1 的内容应移到 B1（col=1）
      const cellB1 = await getCellData(page, 0, 1);
      expect(cellB1.content).toBe('A1内容');

      // 新 A1 应为空
      const cellA1 = await getCellData(page, 0, 0);
      expect(cellA1.content).toBe('');
    });

    test('插入多列（输入 3）后列数增加 3', async ({ page }) => {
      const colCountBefore = await getColCount(page);

      await rightClickColHeader(page, 0);
      const insertInput = page.locator('.col-context-menu .context-menu-input');
      await insertInput.fill('3');
      await page.locator('.col-context-menu .context-menu-btn').click();

      const colCountAfter = await getColCount(page);
      expect(colCountAfter).toBe(colCountBefore + 3);
    });

    test('点击其他区域关闭列上下文菜单', async ({ page }) => {
      await rightClickColHeader(page, 0);
      const colMenu = page.locator('.col-context-menu');
      await expect(colMenu).toBeVisible();

      // 点击单元格区域关闭菜单
      await clickCell(page, 3, 3);
      await expect(colMenu).not.toBeVisible();
    });
  });

  // ========================================================
  // 10.5 列删除基础功能
  // ========================================================
  test.describe('列删除基础功能', () => {
    test('右键点击列头弹出上下文菜单，菜单包含"删除当前列"选项', async ({ page }) => {
      await rightClickColHeader(page, 0);

      const colMenu = page.locator('.col-context-menu');
      await expect(colMenu).toBeVisible();
      await expect(colMenu).toContainText('删除当前列');
    });

    test('点击"删除当前列"后列数减少 1', async ({ page }) => {
      const colCountBefore = await getColCount(page);

      await rightClickColHeader(page, 0);
      await page.locator('.col-context-menu .context-menu-item:has-text("删除当前列")').click();

      const colCountAfter = await getColCount(page);
      expect(colCountAfter).toBe(colCountBefore - 1);
    });

    test('删除列后右侧列数据向左移动', async ({ page }) => {
      // 在 B1（col=1）输入内容
      await typeInCell(page, 0, 1, 'B1内容');

      // 右键点击 A 列头，删除 A 列
      await rightClickColHeader(page, 0);
      await page.locator('.col-context-menu .context-menu-item:has-text("删除当前列")').click();

      // 原 B1 的内容应移到 A1（col=0）
      const cellA1 = await getCellData(page, 0, 0);
      expect(cellA1.content).toBe('B1内容');
    });

    test('删除含有数据的列后数据消失', async ({ page }) => {
      // 在 A1 输入内容
      await typeInCell(page, 0, 0, '将被删除');

      // 右键点击 A 列头，删除 A 列
      await rightClickColHeader(page, 0);
      await page.locator('.col-context-menu .context-menu-item:has-text("删除当前列")').click();

      // 原 A1 的内容应消失（现在 A1 是原来的 B1）
      const cellA1 = await getCellData(page, 0, 0);
      expect(cellA1.content).toBe('');
    });
  });

  // ========================================================
  // 10.6 列操作与单元格数据的交互
  // ========================================================
  test.describe('列操作与单元格数据的交互', () => {
    test('在 B1 输入内容，插入 A 列后内容出现在 C1', async ({ page }) => {
      await typeInCell(page, 0, 1, 'B1数据');

      // 右键点击 A 列头（col=0），插入 1 列
      await rightClickColHeader(page, 0);
      await page.locator('.col-context-menu .context-menu-btn').click();

      // 原 B1 内容应移到 C1（col=2）
      const cellC1 = await getCellData(page, 0, 2);
      expect(cellC1.content).toBe('B1数据');
    });

    test('在 B1 输入内容，删除 A 列后内容出现在 A1', async ({ page }) => {
      await typeInCell(page, 0, 1, 'B1数据');

      // 右键点击 A 列头（col=0），删除 A 列
      await rightClickColHeader(page, 0);
      await page.locator('.context-menu-item:has-text("删除当前列")').click();

      // 原 B1 内容应移到 A1（col=0）
      const cellA1 = await getCellData(page, 0, 0);
      expect(cellA1.content).toBe('B1数据');
    });

    test('在 A1 输入内容，删除 A 列后 A1 内容消失', async ({ page }) => {
      await typeInCell(page, 0, 0, 'A1数据');

      // 右键点击 A 列头（col=0），删除 A 列
      await rightClickColHeader(page, 0);
      await page.locator('.context-menu-item:has-text("删除当前列")').click();

      // 原 A1 内容应消失
      const cellA1 = await getCellData(page, 0, 0);
      expect(cellA1.content).toBe('');
    });
  });

  // ========================================================
  // 10.7 列操作与合并单元格的交互
  // ========================================================
  test.describe('列操作与合并单元格的交互', () => {
    test('合并 B1:C1，在 A 列插入列后合并区域变为 C1:D1', async ({ page }) => {
      // 选中 B1:C1（row=0, col=1 到 col=2），使用键盘方式扩展选择
      await clickCell(page, 0, 1);
      await page.waitForTimeout(100);
      await page.keyboard.press('Shift+ArrowRight');
      await page.locator('#merge-cells').click();

      // 验证合并成功
      const mergedCell = await getCellData(page, 0, 1);
      expect(mergedCell.colSpan).toBe(2);

      // 右键点击 A 列头（col=0），插入 1 列
      await rightClickColHeader(page, 0);
      await page.locator('.col-context-menu .context-menu-btn').click();

      // 合并区域应移到 C1:D1（col=2, colSpan=2）
      const cellC1 = await getCellData(page, 0, 2);
      expect(cellC1.colSpan).toBe(2);
      expect(cellC1.isMerged).toBeFalsy();
    });

    test('合并 B1:D1，在合并区域内（C 列）插入列后合并区域扩展', async ({ page }) => {
      // 选中 B1:D1（row=0, col=1 到 col=3），使用键盘方式扩展选择
      await clickCell(page, 0, 1);
      await page.waitForTimeout(100);
      await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.press('Shift+ArrowRight');
      await page.locator('#merge-cells').click();

      // 验证合并成功（colSpan=3）
      const mergedCell = await getCellData(page, 0, 1);
      expect(mergedCell.colSpan).toBe(3);

      // 右键点击 C 列头（col=2，在合并区域内），插入 1 列
      await rightClickColHeader(page, 2);
      await page.locator('.col-context-menu .context-menu-btn').click();

      // 合并区域应扩展为 colSpan=4（B1:E1）
      const cellB1 = await getCellData(page, 0, 1);
      expect(cellB1.colSpan).toBe(4);
    });
  });

  // ========================================================
  // 10.8 列操作与列宽的交互
  // ========================================================
  test.describe('列操作与列宽的交互', () => {
    test('插入列后新列使用默认列宽', async ({ page }) => {
      // 右键点击 A 列头（col=0），插入 1 列
      await rightClickColHeader(page, 0);
      await page.locator('.col-context-menu .context-menu-btn').click();

      // 新插入的 A 列（col=0）应使用默认列宽 100
      const newColWidth = await getColWidth(page, 0);
      expect(newColWidth).toBe(100);
    });

    test('删除列后相邻列宽度不变', async ({ page }) => {
      // 获取 B 列（col=1）的初始宽度
      const bColWidthBefore = await getColWidth(page, 1);

      // 右键点击 A 列头（col=0），删除 A 列
      await rightClickColHeader(page, 0);
      await page.locator('.context-menu-item:has-text("删除当前列")').click();

      // 原 B 列（现在是 A 列，col=0）宽度应不变
      const aColWidthAfter = await getColWidth(page, 0);
      expect(aColWidthAfter).toBe(bColWidthBefore);
    });
  });

  // ========================================================
  // 10.9 视觉快照测试
  // ========================================================
  test.describe('视觉快照测试', () => {
    test('插入列后截图对比', async ({ page }) => {
      // 在 A1 输入内容
      await typeInCell(page, 0, 0, '原A列');

      // 插入 A 列
      await rightClickColHeader(page, 0);
      await page.locator('.col-context-menu .context-menu-btn').click();

      // 点击其他单元格取消选中
      await clickCell(page, 3, 3);

      const canvas = page.locator('#excel-canvas');
      await expect(canvas).toHaveScreenshot('col-insert-win32.png', {
        maxDiffPixelRatio: 0.05,
      });
    });

    test('删除列后截图对比', async ({ page }) => {
      // 在 B1 输入内容
      await typeInCell(page, 0, 1, '原B列');

      // 删除 A 列
      await rightClickColHeader(page, 0);
      await page.locator('.context-menu-item:has-text("删除当前列")').click();

      // 点击其他单元格取消选中
      await clickCell(page, 3, 3);

      const canvas = page.locator('#excel-canvas');
      await expect(canvas).toHaveScreenshot('col-delete-win32.png', {
        maxDiffPixelRatio: 0.05,
      });
    });
  });
});
