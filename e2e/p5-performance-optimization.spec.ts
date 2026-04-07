import { test, expect, Page } from '@playwright/test';

/**
 * P5 性能持续优化 — E2E 测试
 *
 * 验证四项性能优化不破坏现有功能：
 * 1. 稀疏存储：单元格读写、样式等基本操作
 * 2. 样式密集渲染：背景色、字体样式正确显示
 * 3. 公式 Worker 批量调度：公式计算结果正确
 * 4. 冻结窗格缓存：冻结区域正确渲染
 */

/** 点击 Canvas 上指定单元格 */
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

/** 通过 window.app 获取单元格内容 */
const getCellContent = async (page: Page, row: number, col: number): Promise<string> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { getCell: (row: number, col: number) => { content: string } | null };
      };
      return app.getModel().getCell(r, c)?.content ?? '';
    },
    [row, col] as [number, number],
  );
};

/** 通过 window.app 获取单元格完整数据 */
const getCellData = async (page: Page, row: number, col: number): Promise<{
  content: string;
  fontBold?: boolean;
  bgColor?: string;
  rowSpan: number;
  colSpan: number;
  isMerged: boolean;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            content: string; fontBold?: boolean; bgColor?: string;
            rowSpan: number; colSpan: number; isMerged: boolean;
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return {
        content: cell?.content ?? '',
        fontBold: cell?.fontBold,
        bgColor: cell?.bgColor,
        rowSpan: cell?.rowSpan ?? 1,
        colSpan: cell?.colSpan ?? 1,
        isMerged: cell?.isMerged ?? false,
      };
    },
    [row, col] as [number, number],
  );
};

test.describe('P5 稀疏存储 - 基本单元格操作', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('空单元格应返回默认值', async ({ page }) => {
    const cellData = await getCellData(page, 5, 5);
    expect(cellData.content).toBe('');
    expect(cellData.rowSpan).toBe(1);
    expect(cellData.colSpan).toBe(1);
    expect(cellData.isMerged).toBe(false);
  });

  test('输入内容后应正确存储和读取', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('Hello');
    await page.keyboard.press('Enter');
    const content = await getCellContent(page, 0, 0);
    expect(content).toBe('Hello');
  });

  test('多个单元格独立存储', async ({ page }) => {
    // 在 A1 输入
    await clickCell(page, 0, 0);
    await page.keyboard.type('Cell A1');
    await page.keyboard.press('Enter');

    // 在 B1 输入（点击 B1 而不是依赖 Enter 导航）
    await clickCell(page, 0, 1);
    await page.keyboard.type('Cell B1');
    await page.keyboard.press('Enter');

    expect(await getCellContent(page, 0, 0)).toBe('Cell A1');
    expect(await getCellContent(page, 0, 1)).toBe('Cell B1');
    expect(await getCellContent(page, 0, 2)).toBe('');
  });

  test('删除内容后单元格应恢复为空', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('Temp');
    await page.keyboard.press('Enter');
    await clickCell(page, 0, 0);
    await page.keyboard.press('Delete');
    expect(await getCellContent(page, 0, 0)).toBe('');
  });
});

test.describe('P5 稀疏存储 - 样式操作', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('设置加粗样式应正确存储', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('Bold');
    await page.keyboard.press('Enter');
    await clickCell(page, 0, 0);
    await page.locator('#font-bold-btn').click();
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.fontBold).toBe(true);
    expect(cellData.content).toBe('Bold');
  });

  test('设置背景色应正确存储', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('Colored');
    await page.keyboard.press('Enter');
    await clickCell(page, 0, 0);

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { setCellBgColor: (r: number, c: number, color: string) => void };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellBgColor(0, 0, '#ff0000');
      app.getRenderer().render();
    });

    const cellData = await getCellData(page, 0, 0);
    expect(cellData.bgColor).toBe('#ff0000');
  });
});

test.describe('P5 公式计算 - Worker 批量调度', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('简单公式应正确计算', async ({ page }) => {
    // 通过 API 设置数据和公式
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, content: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, '10');
      model.setCellContent(1, 0, '20');
      model.setCellContent(2, 0, '=A1+A2');
      app.getRenderer().render();
    });

    // 等待 Worker 计算完成
    await page.waitForTimeout(2000);

    const result = await getCellContent(page, 2, 0);
    expect(result).toBe('30');
  });

  test('多个公式应批量正确计算', async ({ page }) => {
    // 通过 API 批量设置数据和公式
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, content: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, '1');
      model.setCellContent(1, 0, '2');
      model.setCellContent(2, 0, '3');
      model.setCellContent(0, 1, '=A1*10');
      model.setCellContent(1, 1, '=A2*10');
      model.setCellContent(2, 1, '=A3*10');
      app.getRenderer().render();
    });

    // 等待 Worker 计算完成
    await page.waitForTimeout(2000);

    expect(await getCellContent(page, 0, 1)).toBe('10');
    expect(await getCellContent(page, 1, 1)).toBe('20');
    expect(await getCellContent(page, 2, 1)).toBe('30');
  });

  test('SUM 函数应正确计算范围', async ({ page }) => {
    // 通过 API 设置数据
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, content: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, '5');
      model.setCellContent(1, 0, '10');
      model.setCellContent(2, 0, '15');
      model.setCellContent(3, 0, '=SUM(A1:A3)');
      app.getRenderer().render();
    });

    await page.waitForTimeout(2000);
    expect(await getCellContent(page, 3, 0)).toBe('30');
  });
});

test.describe('P5 渲染优化 - 页面渲染验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Canvas 应正常渲染且无报错', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg: { type: () => string; text: () => string }) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await clickCell(page, 0, 0);
    await page.keyboard.type('Test');
    await page.keyboard.press('Enter');

    const canvas = page.locator('#excel-canvas');
    await canvas.hover();
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(300);

    const jsErrors = errors.filter(
      (e) => !e.includes('[性能警告]') && !e.includes('Worker')
    );
    expect(jsErrors).toHaveLength(0);
  });

  test('滚动后单元格内容应保持正确', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('Scroll Test');
    await page.keyboard.press('Enter');

    const canvas = page.locator('#excel-canvas');
    await canvas.hover();
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(300);

    expect(await getCellContent(page, 0, 0)).toBe('Scroll Test');
  });
});

test.describe('P5 冻结窗格 - 缓存渲染验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('设置冻结窗格后应正常渲染', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('Frozen');
    await page.keyboard.press('Enter');

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setFreezeRows: (n: number) => void;
          setFreezeCols: (n: number) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setFreezeRows(2);
      app.getModel().setFreezeCols(2);
      app.getRenderer().render();
    });

    await page.waitForTimeout(300);
    expect(await getCellContent(page, 0, 0)).toBe('Frozen');
  });

  test('冻结窗格后滚动应保持冻结区域数据', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('Header');
    await page.keyboard.press('Enter');

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { setFreezeRows: (n: number) => void };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setFreezeRows(1);
      app.getRenderer().render();
    });

    const canvas = page.locator('#excel-canvas');
    await canvas.hover();
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(300);

    expect(await getCellContent(page, 0, 0)).toBe('Header');
  });
});

test.describe('P5 边界情况', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('撤销/重做应正常工作', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.type('Undo Test');
    await page.keyboard.press('Enter');
    expect(await getCellContent(page, 0, 0)).toBe('Undo Test');

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    expect(await getCellContent(page, 0, 0)).toBe('');

    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);
    expect(await getCellContent(page, 0, 0)).toBe('Undo Test');
  });

  test('大量单元格操作不应导致崩溃', async ({ page }) => {
    const success = await page.evaluate(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const app = (window as unknown as Record<string, unknown>).app as {
          getModel: () => {
            setCellContent: (r: number, c: number, content: string) => { success: boolean };
          };
          getRenderer: () => { render: () => void };
        };
        const model = app.getModel();
        for (let i = 0; i < 100; i++) {
          model.setCellContent(i, 0, `Row ${i}`);
        }
        app.getRenderer().render();
        return true;
      } catch {
        return false;
      }
    });

    expect(success).toBe(true);
    expect(await getCellContent(page, 0, 0)).toBe('Row 0');
    expect(await getCellContent(page, 99, 0)).toBe('Row 99');
  });
});
