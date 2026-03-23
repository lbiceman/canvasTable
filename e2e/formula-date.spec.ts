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
 * 使用 parseFloat 比较数值，避免格式差异（如 "5" vs "5.00"）
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

test.describe('日期函数 E2E 测试', () => {
  test.describe('TODAY 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('TODAY() 应返回非空的日期字符串（格式 yyyy-MM-dd）', async ({ page }) => {
      await enterFormula(page, 0, 0, '=TODAY()');
      const data = await getCellData(page, 0, 0);
      // 不能硬编码日期，只验证结果非空且符合 yyyy-MM-dd 格式
      expect(data.content.length).toBeGreaterThan(0);
      expect(data.content).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  test.describe('NOW 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('NOW() 应返回非空的日期时间字符串（格式 yyyy-MM-dd HH:mm:ss）', async ({ page }) => {
      await enterFormula(page, 0, 0, '=NOW()');
      const data = await getCellData(page, 0, 0);
      // 不能硬编码日期时间，只验证结果非空且符合 yyyy-MM-dd HH:mm:ss 格式
      expect(data.content.length).toBeGreaterThan(0);
      expect(data.content).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  test.describe('DATE 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('DATE(2024, 1, 15) 应返回 2024-01-15', async ({ page }) => {
      await enterFormula(page, 0, 0, '=DATE(2024, 1, 15)');
      await expectStringContent(page, 0, 0, '2024-01-15');
    });

    test('DATE(2024, 13, 1) 月份超出范围应自动进位，返回 2025-01-01', async ({ page }) => {
      await enterFormula(page, 0, 0, '=DATE(2024, 13, 1)');
      await expectStringContent(page, 0, 0, '2025-01-01');
    });
  });

  test.describe('YEAR 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('YEAR("2024-01-15") 应返回 2024', async ({ page }) => {
      await enterFormula(page, 0, 0, '=YEAR("2024-01-15")');
      await expectNumericContent(page, 0, 0, 2024);
    });

    test('YEAR(DATE(2024, 6, 15)) 应返回 2024', async ({ page }) => {
      await enterFormula(page, 0, 0, '=YEAR(DATE(2024, 6, 15))');
      await expectNumericContent(page, 0, 0, 2024);
    });
  });

  test.describe('MONTH 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('MONTH("2024-01-15") 应返回 1', async ({ page }) => {
      await enterFormula(page, 0, 0, '=MONTH("2024-01-15")');
      await expectNumericContent(page, 0, 0, 1);
    });

    test('MONTH(DATE(2024, 12, 25)) 应返回 12', async ({ page }) => {
      await enterFormula(page, 0, 0, '=MONTH(DATE(2024, 12, 25))');
      await expectNumericContent(page, 0, 0, 12);
    });
  });

  test.describe('DAY 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('DAY("2024-01-15") 应返回 15', async ({ page }) => {
      await enterFormula(page, 0, 0, '=DAY("2024-01-15")');
      await expectNumericContent(page, 0, 0, 15);
    });

    test('DAY(DATE(2024, 2, 29)) 应返回 29（2024 年是闰年）', async ({ page }) => {
      await enterFormula(page, 0, 0, '=DAY(DATE(2024, 2, 29))');
      await expectNumericContent(page, 0, 0, 29);
    });
  });

  test.describe('DATEDIF 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('DATEDIF("2024-01-01", "2024-12-31", "D") 应返回 365（相差天数）', async ({ page }) => {
      await enterFormula(page, 0, 0, '=DATEDIF("2024-01-01", "2024-12-31", "D")');
      await expectNumericContent(page, 0, 0, 365);
    });

    test('DATEDIF("2024-01-01", "2024-12-31", "M") 应返回 11（相差月数）', async ({ page }) => {
      await enterFormula(page, 0, 0, '=DATEDIF("2024-01-01", "2024-12-31", "M")');
      await expectNumericContent(page, 0, 0, 11);
    });

    test('DATEDIF("2024-01-01", "2024-12-31", "Y") 应返回 0（相差年数不足 1 年）', async ({ page }) => {
      await enterFormula(page, 0, 0, '=DATEDIF("2024-01-01", "2024-12-31", "Y")');
      await expectNumericContent(page, 0, 0, 0);
    });
  });

  test.describe('DATEDIF 错误处理', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('DATEDIF 开始日期晚于结束日期应返回 #NUM!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=DATEDIF("2024-12-31", "2024-01-01", "D")');
      await expectStringContent(page, 0, 0, '#NUM!');
    });

    test('DATEDIF 无效单位参数应返回 #NUM!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=DATEDIF("2024-01-01", "2024-12-31", "X")');
      await expectStringContent(page, 0, 0, '#NUM!');
    });
  });

  test.describe('EDATE 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('EDATE("2024-01-15", 3) 应返回 2024-04-15（加 3 个月）', async ({ page }) => {
      await enterFormula(page, 0, 0, '=EDATE("2024-01-15", 3)');
      await expectStringContent(page, 0, 0, '2024-04-15');
    });

    test('EDATE("2024-01-31", 1) 应返回 2024-02-29（月末调整，2024 年 2 月是闰年）', async ({ page }) => {
      await enterFormula(page, 0, 0, '=EDATE("2024-01-31", 1)');
      await expectStringContent(page, 0, 0, '2024-02-29');
    });
  });

  test.describe('EOMONTH 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('EOMONTH("2024-01-15", 0) 应返回 2024-01-31（当月最后一天）', async ({ page }) => {
      await enterFormula(page, 0, 0, '=EOMONTH("2024-01-15", 0)');
      await expectStringContent(page, 0, 0, '2024-01-31');
    });

    test('EOMONTH("2024-01-15", 1) 应返回 2024-02-29（下月最后一天，2024 年 2 月闰年）', async ({ page }) => {
      await enterFormula(page, 0, 0, '=EOMONTH("2024-01-15", 1)');
      await expectStringContent(page, 0, 0, '2024-02-29');
    });
  });

  test.describe('日期函数非法参数错误处理', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('YEAR("不是日期") 应返回 #VALUE!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=YEAR("不是日期")');
      await expectStringContent(page, 0, 0, '#VALUE!');
    });
  });
});
