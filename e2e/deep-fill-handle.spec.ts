import { test, expect, Page } from '@playwright/test';

// ============================================================
// 辅助函数
// ============================================================

const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = 40 + col * 100 + 50;
  const y = 28 + row * 25 + 12;
  await canvas.click({ position: { x, y } });
};

const getCellContent = async (page: Page, row: number, col: number): Promise<string> => {
  return await page.evaluate(([r, c]) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => { content?: string } | null };
    };
    return app.getModel().getCell(r, c)?.content ?? '';
  }, [row, col] as [number, number]);
};

const setCell = async (page: Page, row: number, col: number, value: string): Promise<void> => {
  await page.evaluate(([r, c, v]) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => { content: string } | null };
      getRenderer: () => { render: () => void };
    };
    const cell = app.getModel().getCell(r, c);
    if (cell) cell.content = v;
    app.getRenderer().render();
  }, [row, col, value] as [number, number, string]);
};

// ============================================================
// 深入测试：填充柄 - 通过 API 验证填充逻辑
// ============================================================

test.describe('填充柄 - 文本复制填充', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('fillRange 向下填充单个文本应复制内容', async ({ page }) => {
    await setCell(page, 0, 0, '测试');

    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          fillRange: (
            sr: number, sc: number, er: number, ec: number,
            dr: number, dc: number, der: number, dec: number,
            dir: string
          ) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().fillRange(0, 0, 0, 0, 1, 0, 3, 0, 'down');
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    expect(await getCellContent(page, 1, 0)).toBe('测试');
    expect(await getCellContent(page, 2, 0)).toBe('测试');
    expect(await getCellContent(page, 3, 0)).toBe('测试');
  });

  test('fillRange 向右填充单个文本应复制内容', async ({ page }) => {
    await setCell(page, 0, 0, '数据');

    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          fillRange: (
            sr: number, sc: number, er: number, ec: number,
            dr: number, dc: number, der: number, dec: number,
            dir: string
          ) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().fillRange(0, 0, 0, 0, 0, 1, 0, 3, 'right');
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    expect(await getCellContent(page, 0, 1)).toBe('数据');
    expect(await getCellContent(page, 0, 2)).toBe('数据');
    expect(await getCellContent(page, 0, 3)).toBe('数据');
  });
});

test.describe('填充柄 - 数字序列递增', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('两个连续数字向下填充应自动递增', async ({ page }) => {
    await setCell(page, 0, 0, '1');
    await setCell(page, 1, 0, '2');

    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          fillRange: (
            sr: number, sc: number, er: number, ec: number,
            dr: number, dc: number, der: number, dec: number,
            dir: string
          ) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().fillRange(0, 0, 1, 0, 2, 0, 5, 0, 'down');
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    expect(await getCellContent(page, 2, 0)).toBe('3');
    expect(await getCellContent(page, 3, 0)).toBe('4');
    expect(await getCellContent(page, 4, 0)).toBe('5');
    expect(await getCellContent(page, 5, 0)).toBe('6');
  });

  test('等差数列向下填充应保持步长', async ({ page }) => {
    await setCell(page, 0, 0, '10');
    await setCell(page, 1, 0, '20');

    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          fillRange: (
            sr: number, sc: number, er: number, ec: number,
            dr: number, dc: number, der: number, dec: number,
            dir: string
          ) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().fillRange(0, 0, 1, 0, 2, 0, 4, 0, 'down');
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    expect(await getCellContent(page, 2, 0)).toBe('30');
    expect(await getCellContent(page, 3, 0)).toBe('40');
    expect(await getCellContent(page, 4, 0)).toBe('50');
  });

  test('数字序列向右填充应自动递增', async ({ page }) => {
    await setCell(page, 0, 0, '1');
    await setCell(page, 0, 1, '3');

    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          fillRange: (
            sr: number, sc: number, er: number, ec: number,
            dr: number, dc: number, der: number, dec: number,
            dir: string
          ) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().fillRange(0, 0, 0, 1, 0, 2, 0, 4, 'right');
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    expect(await getCellContent(page, 0, 2)).toBe('5');
    expect(await getCellContent(page, 0, 3)).toBe('7');
    expect(await getCellContent(page, 0, 4)).toBe('9');
  });
});

test.describe('填充柄 - 多列填充', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('多列区域向下填充应分别处理每列', async ({ page }) => {
    await setCell(page, 0, 0, 'A');
    await setCell(page, 0, 1, '1');
    await setCell(page, 1, 0, 'B');
    await setCell(page, 1, 1, '2');

    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          fillRange: (
            sr: number, sc: number, er: number, ec: number,
            dr: number, dc: number, der: number, dec: number,
            dir: string
          ) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().fillRange(0, 0, 1, 1, 2, 0, 3, 1, 'down');
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 第一列文本循环
    expect(await getCellContent(page, 2, 0)).toBe('A');
    expect(await getCellContent(page, 3, 0)).toBe('B');

    // 第二列数字递增
    expect(await getCellContent(page, 2, 1)).toBe('3');
    expect(await getCellContent(page, 3, 1)).toBe('4');
  });
});

test.describe('填充柄 - 填充操作撤销', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('fillRange 操作应支持撤销', async ({ page }) => {
    await setCell(page, 0, 0, 'X');

    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          fillRange: (
            sr: number, sc: number, er: number, ec: number,
            dr: number, dc: number, der: number, dec: number,
            dir: string
          ) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().fillRange(0, 0, 0, 0, 1, 0, 2, 0, 'down');
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    expect(await getCellContent(page, 1, 0)).toBe('X');
    expect(await getCellContent(page, 2, 0)).toBe('X');

    // 撤销
    await clickCell(page, 5, 5);
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    expect(await getCellContent(page, 1, 0)).toBe('');
    expect(await getCellContent(page, 2, 0)).toBe('');
    // 源数据应保留
    expect(await getCellContent(page, 0, 0)).toBe('X');
  });
});
