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
 * 辅助函数：在单元格中输入内容（公式或普通值）
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

test.describe('统计函数 E2E 测试', () => {
  test.describe('COUNT 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('COUNT(A1:A5) 应仅计数数值，返回 3', async ({ page }) => {
      // 填入混合数据：数值、文本、空单元格
      // A1=1, A2="文本"（字符串，不带等号）, A3=3, A4 跳过（空）, A5=5
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '文本');
      await enterFormula(page, 2, 0, '3');
      // A4 跳过不输入，保持空单元格
      await enterFormula(page, 4, 0, '5');

      // 在 B1 输入 COUNT 公式
      await enterFormula(page, 0, 1, '=COUNT(A1:A5)');
      // COUNT 只计数数值，文本和空单元格不计入，结果为 3
      await expectNumericContent(page, 0, 1, 3);
    });
  });

  test.describe('COUNTA 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('COUNTA(A1:A5) 应计数非空单元格，返回 4', async ({ page }) => {
      // 填入混合数据：数值、文本、空单元格
      // A1=1, A2="文本", A3=3, A4 跳过（空）, A5=5
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '文本');
      await enterFormula(page, 2, 0, '3');
      // A4 跳过不输入，保持空单元格
      await enterFormula(page, 4, 0, '5');

      // 在 B1 输入 COUNTA 公式
      await enterFormula(page, 0, 1, '=COUNTA(A1:A5)');
      // COUNTA 计数所有非空单元格（包括文本），结果为 4
      await expectNumericContent(page, 0, 1, 4);
    });
  });

  test.describe('COUNTIF 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('COUNTIF(A1:A5, ">5") 应返回 2', async ({ page }) => {
      // 在 A1:A5 填入 1, 5, 8, 3, 10
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '5');
      await enterFormula(page, 2, 0, '8');
      await enterFormula(page, 3, 0, '3');
      await enterFormula(page, 4, 0, '10');

      // 在 B1 输入 COUNTIF 公式，条件为大于 5
      await enterFormula(page, 0, 1, '=COUNTIF(A1:A5, ">5")');
      // 满足 >5 的有 8 和 10，共 2 个
      await expectNumericContent(page, 0, 1, 2);
    });

    test('COUNTIF(A1:A5, 5) 应返回 1', async ({ page }) => {
      // 在 A1:A5 填入 1, 5, 8, 3, 10
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '5');
      await enterFormula(page, 2, 0, '8');
      await enterFormula(page, 3, 0, '3');
      await enterFormula(page, 4, 0, '10');

      // 在 B1 输入 COUNTIF 公式，条件为精确等于 5
      await enterFormula(page, 0, 1, '=COUNTIF(A1:A5, 5)');
      // 等于 5 的只有 A2，共 1 个
      await expectNumericContent(page, 0, 1, 1);
    });
  });

  test.describe('COUNTIFS 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('COUNTIFS(A1:A5, ">3", B1:B5, "<40") 应返回 2', async ({ page }) => {
      // 在 A1:A5 填入 1, 5, 8, 3, 10
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '5');
      await enterFormula(page, 2, 0, '8');
      await enterFormula(page, 3, 0, '3');
      await enterFormula(page, 4, 0, '10');

      // 在 B1:B5 填入 10, 20, 30, 40, 50
      await enterFormula(page, 0, 1, '10');
      await enterFormula(page, 1, 1, '20');
      await enterFormula(page, 2, 1, '30');
      await enterFormula(page, 3, 1, '40');
      await enterFormula(page, 4, 1, '50');

      // 在 C1 输入 COUNTIFS 公式：A>3 且 B<40
      await enterFormula(page, 0, 2, '=COUNTIFS(A1:A5, ">3", B1:B5, "<40")');
      // A>3 且 B<40：A2=5,B2=20 ✓；A3=8,B3=30 ✓；其余不满足，共 2 个
      await expectNumericContent(page, 0, 2, 2);
    });
  });

  test.describe('SUMIF 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('SUMIF(A1:A5, ">5", B1:B5) 应返回 800', async ({ page }) => {
      // 在 A1:A5 填入 1, 5, 8, 3, 10
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '5');
      await enterFormula(page, 2, 0, '8');
      await enterFormula(page, 3, 0, '3');
      await enterFormula(page, 4, 0, '10');

      // 在 B1:B5 填入 100, 200, 300, 400, 500
      await enterFormula(page, 0, 1, '100');
      await enterFormula(page, 1, 1, '200');
      await enterFormula(page, 2, 1, '300');
      await enterFormula(page, 3, 1, '400');
      await enterFormula(page, 4, 1, '500');

      // 在 C1 输入 SUMIF 公式：A>5 时对应 B 求和
      await enterFormula(page, 0, 2, '=SUMIF(A1:A5, ">5", B1:B5)');
      // A>5 的有 A3=8（B3=300）和 A5=10（B5=500），合计 800
      await expectNumericContent(page, 0, 2, 800);
    });
  });

  test.describe('SUMIFS 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('SUMIFS(C1:C3, A1:A3, ">10", B1:B3, ">1") 应返回 500', async ({ page }) => {
      // 在 A1:A3 填入 10, 20, 30
      await enterFormula(page, 0, 0, '10');
      await enterFormula(page, 1, 0, '20');
      await enterFormula(page, 2, 0, '30');

      // 在 B1:B3 填入 1, 2, 3
      await enterFormula(page, 0, 1, '1');
      await enterFormula(page, 1, 1, '2');
      await enterFormula(page, 2, 1, '3');

      // 在 C1:C3 填入 100, 200, 300
      await enterFormula(page, 0, 2, '100');
      await enterFormula(page, 1, 2, '200');
      await enterFormula(page, 2, 2, '300');

      // 在 D1 输入 SUMIFS 公式：A>10 且 B>1 时对 C 求和
      await enterFormula(page, 0, 3, '=SUMIFS(C1:C3, A1:A3, ">10", B1:B3, ">1")');
      // A>10 且 B>1：A2=20,B2=2,C2=200 ✓；A3=30,B3=3,C3=300 ✓，合计 500
      await expectNumericContent(page, 0, 3, 500);
    });
  });

  test.describe('AVERAGEIF 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('AVERAGEIF(A1:A5, ">5", B1:B5) 应返回 400', async ({ page }) => {
      // 在 A1:A5 填入 1, 5, 8, 3, 10
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '5');
      await enterFormula(page, 2, 0, '8');
      await enterFormula(page, 3, 0, '3');
      await enterFormula(page, 4, 0, '10');

      // 在 B1:B5 填入 100, 200, 300, 400, 500
      await enterFormula(page, 0, 1, '100');
      await enterFormula(page, 1, 1, '200');
      await enterFormula(page, 2, 1, '300');
      await enterFormula(page, 3, 1, '400');
      await enterFormula(page, 4, 1, '500');

      // 在 C1 输入 AVERAGEIF 公式：A>5 时对应 B 求平均
      await enterFormula(page, 0, 2, '=AVERAGEIF(A1:A5, ">5", B1:B5)');
      // A>5 的有 A3=8（B3=300）和 A5=10（B5=500），平均值 (300+500)/2 = 400
      await expectNumericContent(page, 0, 2, 400);
    });

    test('AVERAGEIF 无匹配时应返回 #DIV/0!', async ({ page }) => {
      // 在 A1:A3 填入 1, 2, 3
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '2');
      await enterFormula(page, 2, 0, '3');

      // 在 B1 输入 AVERAGEIF 公式，条件无法匹配任何值
      await enterFormula(page, 0, 1, '=AVERAGEIF(A1:A3, ">100")');
      // 没有满足条件的单元格，除以零，返回 #DIV/0!
      await expectStringContent(page, 0, 1, '#DIV/0!');
    });
  });

  test.describe('条件运算符测试', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('COUNTIF 使用 > 运算符', async ({ page }) => {
      // 在 A1:A5 填入 1, 5, 8, 3, 10
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '5');
      await enterFormula(page, 2, 0, '8');
      await enterFormula(page, 3, 0, '3');
      await enterFormula(page, 4, 0, '10');

      await enterFormula(page, 0, 1, '=COUNTIF(A1:A5, ">5")');
      // 大于 5 的有 8 和 10，共 2 个
      await expectNumericContent(page, 0, 1, 2);
    });

    test('COUNTIF 使用 < 运算符', async ({ page }) => {
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '5');
      await enterFormula(page, 2, 0, '8');
      await enterFormula(page, 3, 0, '3');
      await enterFormula(page, 4, 0, '10');

      await enterFormula(page, 0, 1, '=COUNTIF(A1:A5, "<5")');
      // 小于 5 的有 1 和 3，共 2 个
      await expectNumericContent(page, 0, 1, 2);
    });

    test('COUNTIF 使用 >= 运算符', async ({ page }) => {
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '5');
      await enterFormula(page, 2, 0, '8');
      await enterFormula(page, 3, 0, '3');
      await enterFormula(page, 4, 0, '10');

      await enterFormula(page, 0, 1, '=COUNTIF(A1:A5, ">=5")');
      // 大于等于 5 的有 5、8 和 10，共 3 个
      await expectNumericContent(page, 0, 1, 3);
    });

    test('COUNTIF 使用 <= 运算符', async ({ page }) => {
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '5');
      await enterFormula(page, 2, 0, '8');
      await enterFormula(page, 3, 0, '3');
      await enterFormula(page, 4, 0, '10');

      await enterFormula(page, 0, 1, '=COUNTIF(A1:A5, "<=5")');
      // 小于等于 5 的有 1、5 和 3，共 3 个
      await expectNumericContent(page, 0, 1, 3);
    });

    test('COUNTIF 使用 = 运算符', async ({ page }) => {
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '5');
      await enterFormula(page, 2, 0, '8');
      await enterFormula(page, 3, 0, '3');
      await enterFormula(page, 4, 0, '10');

      await enterFormula(page, 0, 1, '=COUNTIF(A1:A5, "=5")');
      // 等于 5 的只有 A2，共 1 个
      await expectNumericContent(page, 0, 1, 1);
    });

    test('COUNTIF 使用 <> 运算符', async ({ page }) => {
      await enterFormula(page, 0, 0, '1');
      await enterFormula(page, 1, 0, '5');
      await enterFormula(page, 2, 0, '8');
      await enterFormula(page, 3, 0, '3');
      await enterFormula(page, 4, 0, '10');

      await enterFormula(page, 0, 1, '=COUNTIF(A1:A5, "<>5")');
      // 不等于 5 的有 1、8、3 和 10，共 4 个
      await expectNumericContent(page, 0, 1, 4);
    });
  });

  test.describe('通配符测试', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('COUNTIF 使用 * 通配符匹配以 A 开头的字符串', async ({ page }) => {
      // 在 A1:A3 填入 Apple, Banana, Avocado
      await enterFormula(page, 0, 0, 'Apple');
      await enterFormula(page, 1, 0, 'Banana');
      await enterFormula(page, 2, 0, 'Avocado');

      // 在 B1 输入 COUNTIF 公式，匹配以 A 开头的字符串
      await enterFormula(page, 0, 1, '=COUNTIF(A1:A3, "A*")');
      // 以 A 开头的有 Apple 和 Avocado，共 2 个
      await expectNumericContent(page, 0, 1, 2);
    });
  });
});
