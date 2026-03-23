import { test, expect, Page } from '@playwright/test';

/**
 * 辅助函数：双击单元格进入编辑模式
 * 根据渲染配置，headerWidth=40, headerHeight=28，默认列宽=100，默认行高=25
 * 双击第 row 行第 col 列的单元格中心（0-indexed）
 */
const dblClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = 40 + col * 100 + 50;
  const y = 28 + row * 25 + 12;
  await canvas.dblclick({ position: { x, y } });
};

/**
 * 辅助函数：通过 window.app 获取单元格数据
 */
const getCellData = async (page: Page, row: number, col: number): Promise<{
  content: string;
  formulaContent: string;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            content?: string;
            formulaContent?: string;
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return {
        content: cell?.content ?? '',
        formulaContent: cell?.formulaContent ?? '',
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：在单元格中输入公式
 */
const enterFormula = async (page: Page, row: number, col: number, formula: string): Promise<void> => {
  await dblClickCell(page, row, col);
  await page.waitForTimeout(100);
  // 清除现有内容
  await page.keyboard.press('Control+A');
  await page.keyboard.type(formula);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
};

/**
 * 辅助函数：验证单元格数值结果
 * 使用 parseFloat 比较数值，避免格式差异
 */
const expectNumericContent = async (
  page: Page,
  row: number,
  col: number,
  expected: number,
): Promise<void> => {
  const data = await getCellData(page, row, col);
  const actual = parseFloat(data.content);
  expect(actual).toBeCloseTo(expected, 5);
};

/**
 * 辅助函数：验证单元格字符串结果（精确匹配）
 */
const expectStringContent = async (
  page: Page,
  row: number,
  col: number,
  expected: string,
): Promise<void> => {
  const data = await getCellData(page, row, col);
  expect(data.content).toBe(expected);
};

test.describe('文本函数 E2E 测试', () => {
  test.describe('LEFT 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('LEFT("Hello", 3) 应返回 "Hel"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=LEFT("Hello", 3)');
      await expectStringContent(page, 0, 0, 'Hel');
    });

    test('LEFT("Hello", 0) 应返回空字符串', async ({ page }) => {
      await enterFormula(page, 0, 0, '=LEFT("Hello", 0)');
      await expectStringContent(page, 0, 0, '');
    });
  });

  test.describe('RIGHT 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('RIGHT("Hello", 3) 应返回 "llo"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=RIGHT("Hello", 3)');
      await expectStringContent(page, 0, 0, 'llo');
    });

    test('RIGHT("Hello", 5) 应返回 "Hello"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=RIGHT("Hello", 5)');
      await expectStringContent(page, 0, 0, 'Hello');
    });
  });

  test.describe('MID 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('MID("Hello", 2, 3) 应返回 "ell"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=MID("Hello", 2, 3)');
      await expectStringContent(page, 0, 0, 'ell');
    });

    test('MID("Hello", 1, 5) 应返回 "Hello"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=MID("Hello", 1, 5)');
      await expectStringContent(page, 0, 0, 'Hello');
    });
  });

  test.describe('LEN 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('LEN("Hello") 应返回 5', async ({ page }) => {
      await enterFormula(page, 0, 0, '=LEN("Hello")');
      await expectNumericContent(page, 0, 0, 5);
    });

    test('LEN("") 应返回 0', async ({ page }) => {
      await enterFormula(page, 0, 0, '=LEN("")');
      await expectNumericContent(page, 0, 0, 0);
    });
  });

  test.describe('TRIM 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('TRIM("  Hello  ") 应去除首尾空格返回 "Hello"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=TRIM("  Hello  ")');
      await expectStringContent(page, 0, 0, 'Hello');
    });

    test('TRIM("Hello  World") 应将多余空格压缩为单个返回 "Hello World"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=TRIM("Hello  World")');
      await expectStringContent(page, 0, 0, 'Hello World');
    });
  });

  test.describe('UPPER 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('UPPER("hello") 应返回 "HELLO"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=UPPER("hello")');
      await expectStringContent(page, 0, 0, 'HELLO');
    });

    test('UPPER("Hello World") 应返回 "HELLO WORLD"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=UPPER("Hello World")');
      await expectStringContent(page, 0, 0, 'HELLO WORLD');
    });
  });

  test.describe('LOWER 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('LOWER("HELLO") 应返回 "hello"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=LOWER("HELLO")');
      await expectStringContent(page, 0, 0, 'hello');
    });

    test('LOWER("Hello World") 应返回 "hello world"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=LOWER("Hello World")');
      await expectStringContent(page, 0, 0, 'hello world');
    });
  });

  test.describe('CONCATENATE 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('CONCATENATE("A", "B", "C") 应返回 "ABC"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=CONCATENATE("A", "B", "C")');
      await expectStringContent(page, 0, 0, 'ABC');
    });

    test('CONCATENATE("Hello", " ", "World") 应返回 "Hello World"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=CONCATENATE("Hello", " ", "World")');
      await expectStringContent(page, 0, 0, 'Hello World');
    });
  });

  test.describe('SUBSTITUTE 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('SUBSTITUTE("Hello World", "World", "Excel") 应返回 "Hello Excel"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=SUBSTITUTE("Hello World", "World", "Excel")');
      await expectStringContent(page, 0, 0, 'Hello Excel');
    });

    test('SUBSTITUTE("aaa", "a", "b") 应返回 "bbb"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=SUBSTITUTE("aaa", "a", "b")');
      await expectStringContent(page, 0, 0, 'bbb');
    });
  });

  test.describe('FIND 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('FIND("lo", "Hello") 应区分大小写返回 4', async ({ page }) => {
      await enterFormula(page, 0, 0, '=FIND("lo", "Hello")');
      await expectNumericContent(page, 0, 0, 4);
    });

    test('FIND("LO", "Hello") 大小写不匹配应返回 #VALUE!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=FIND("LO", "Hello")');
      await expectStringContent(page, 0, 0, '#VALUE!');
    });
  });

  test.describe('SEARCH 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('SEARCH("LO", "Hello") 应不区分大小写返回 4', async ({ page }) => {
      await enterFormula(page, 0, 0, '=SEARCH("LO", "Hello")');
      await expectNumericContent(page, 0, 0, 4);
    });

    test('SEARCH("xyz", "Hello") 未找到应返回 #VALUE!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=SEARCH("xyz", "Hello")');
      await expectStringContent(page, 0, 0, '#VALUE!');
    });
  });

  test.describe('TEXT 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('TEXT(1234.5, "#,##0.00") 应返回 "1,234.50"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=TEXT(1234.5, "#,##0.00")');
      await expectStringContent(page, 0, 0, '1,234.50');
    });

    test('TEXT(0.75, "0%") 应返回 "75%"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=TEXT(0.75, "0%")');
      await expectStringContent(page, 0, 0, '75%');
    });
  });
});
