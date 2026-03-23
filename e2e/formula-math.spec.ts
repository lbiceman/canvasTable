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

test.describe('数学函数 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test.describe('ABS 函数', () => {
    test('ABS(-5) 应返回 5', async ({ page }) => {
      await enterFormula(page, 0, 0, '=ABS(-5)');
      await expectNumericContent(page, 0, 0, 5);
    });

    test('ABS(3) 应返回 3', async ({ page }) => {
      await enterFormula(page, 0, 0, '=ABS(3)');
      await expectNumericContent(page, 0, 0, 3);
    });

    test('ABS(0) 应返回 0', async ({ page }) => {
      await enterFormula(page, 0, 0, '=ABS(0)');
      await expectNumericContent(page, 0, 0, 0);
    });
  });

  test.describe('ROUND 函数', () => {
    test('ROUND(3.456, 2) 应返回 3.46', async ({ page }) => {
      await enterFormula(page, 0, 0, '=ROUND(3.456, 2)');
      await expectNumericContent(page, 0, 0, 3.46);
    });

    test('ROUND(3.455, 2) 应返回 3.46', async ({ page }) => {
      await enterFormula(page, 0, 0, '=ROUND(3.455, 2)');
      await expectNumericContent(page, 0, 0, 3.46);
    });

    test('ROUND(3.444, 2) 应返回 3.44', async ({ page }) => {
      await enterFormula(page, 0, 0, '=ROUND(3.444, 2)');
      await expectNumericContent(page, 0, 0, 3.44);
    });
  });

  test.describe('CEILING 函数', () => {
    test('CEILING(4.2, 1) 应返回 5', async ({ page }) => {
      await enterFormula(page, 0, 0, '=CEILING(4.2, 1)');
      await expectNumericContent(page, 0, 0, 5);
    });

    test('CEILING(4.8, 0.5) 应返回 5', async ({ page }) => {
      await enterFormula(page, 0, 0, '=CEILING(4.8, 0.5)');
      await expectNumericContent(page, 0, 0, 5);
    });

    test('CEILING(-2.5, 1) 应返回 -2', async ({ page }) => {
      await enterFormula(page, 0, 0, '=CEILING(-2.5, 1)');
      await expectNumericContent(page, 0, 0, -2);
    });
  });

  test.describe('FLOOR 函数', () => {
    test('FLOOR(4.8, 1) 应返回 4', async ({ page }) => {
      await enterFormula(page, 0, 0, '=FLOOR(4.8, 1)');
      await expectNumericContent(page, 0, 0, 4);
    });

    test('FLOOR(4.2, 0.5) 应返回 4', async ({ page }) => {
      await enterFormula(page, 0, 0, '=FLOOR(4.2, 0.5)');
      await expectNumericContent(page, 0, 0, 4);
    });

    test('FLOOR(-2.5, 1) 应返回 -3', async ({ page }) => {
      await enterFormula(page, 0, 0, '=FLOOR(-2.5, 1)');
      await expectNumericContent(page, 0, 0, -3);
    });
  });

  test.describe('MOD 函数', () => {
    test('MOD(10, 3) 应返回 1', async ({ page }) => {
      await enterFormula(page, 0, 0, '=MOD(10, 3)');
      await expectNumericContent(page, 0, 0, 1);
    });

    test('MOD(10, 5) 应返回 0', async ({ page }) => {
      await enterFormula(page, 0, 0, '=MOD(10, 5)');
      await expectNumericContent(page, 0, 0, 0);
    });

    test('MOD(10, 0) 应返回 #DIV/0!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=MOD(10, 0)');
      await expectStringContent(page, 0, 0, '#DIV/0!');
    });
  });

  test.describe('POWER 函数', () => {
    test('POWER(2, 3) 应返回 8', async ({ page }) => {
      await enterFormula(page, 0, 0, '=POWER(2, 3)');
      await expectNumericContent(page, 0, 0, 8);
    });

    test('POWER(5, 0) 应返回 1', async ({ page }) => {
      await enterFormula(page, 0, 0, '=POWER(5, 0)');
      await expectNumericContent(page, 0, 0, 1);
    });

    test('POWER(9, 0.5) 应返回 3', async ({ page }) => {
      await enterFormula(page, 0, 0, '=POWER(9, 0.5)');
      await expectNumericContent(page, 0, 0, 3);
    });
  });

  test.describe('SQRT 函数', () => {
    test('SQRT(16) 应返回 4', async ({ page }) => {
      await enterFormula(page, 0, 0, '=SQRT(16)');
      await expectNumericContent(page, 0, 0, 4);
    });

    test('SQRT(0) 应返回 0', async ({ page }) => {
      await enterFormula(page, 0, 0, '=SQRT(0)');
      await expectNumericContent(page, 0, 0, 0);
    });

    test('SQRT(-1) 应返回 #NUM!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=SQRT(-1)');
      await expectStringContent(page, 0, 0, '#NUM!');
    });
  });

  test.describe('MAX 函数', () => {
    test('MAX(A1:A5) 应返回区域最大值 5', async ({ page }) => {
      // 在 A1:A5 填入 3, 1, 4, 1, 5
      await enterFormula(page, 0, 0, '3');
      await enterFormula(page, 1, 0, '1');
      await enterFormula(page, 2, 0, '4');
      await enterFormula(page, 3, 0, '1');
      await enterFormula(page, 4, 0, '5');

      // 在 B1 输入 MAX 公式
      await enterFormula(page, 0, 1, '=MAX(A1:A5)');
      await expectNumericContent(page, 0, 1, 5);
    });

    test('MAX(10, 20, 5) 应返回 20', async ({ page }) => {
      await enterFormula(page, 0, 0, '=MAX(10, 20, 5)');
      await expectNumericContent(page, 0, 0, 20);
    });
  });

  test.describe('MIN 函数', () => {
    test('MIN(A1:A5) 应返回区域最小值 1', async ({ page }) => {
      // 在 A1:A5 填入 3, 1, 4, 1, 5
      await enterFormula(page, 0, 0, '3');
      await enterFormula(page, 1, 0, '1');
      await enterFormula(page, 2, 0, '4');
      await enterFormula(page, 3, 0, '1');
      await enterFormula(page, 4, 0, '5');

      // 在 B1 输入 MIN 公式
      await enterFormula(page, 0, 1, '=MIN(A1:A5)');
      await expectNumericContent(page, 0, 1, 1);
    });

    test('MIN(10, 20, 5) 应返回 5', async ({ page }) => {
      await enterFormula(page, 0, 0, '=MIN(10, 20, 5)');
      await expectNumericContent(page, 0, 0, 5);
    });
  });

  test.describe('AVERAGE 函数', () => {
    test('AVERAGE(A1:A5) 应返回区域平均值 30', async ({ page }) => {
      // 在 A1:A5 填入 10, 20, 30, 40, 50
      await enterFormula(page, 0, 0, '10');
      await enterFormula(page, 1, 0, '20');
      await enterFormula(page, 2, 0, '30');
      await enterFormula(page, 3, 0, '40');
      await enterFormula(page, 4, 0, '50');

      // 在 B1 输入 AVERAGE 公式
      await enterFormula(page, 0, 1, '=AVERAGE(A1:A5)');
      await expectNumericContent(page, 0, 1, 30);
    });

    test('AVERAGE(2, 4, 6) 应返回 4', async ({ page }) => {
      await enterFormula(page, 0, 0, '=AVERAGE(2, 4, 6)');
      await expectNumericContent(page, 0, 0, 4);
    });
  });

  test.describe('非数值参数错误处理', () => {
    test('ABS("abc") 应返回 #VALUE!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=ABS("abc")');
      await expectStringContent(page, 0, 0, '#VALUE!');
    });
  });
});
