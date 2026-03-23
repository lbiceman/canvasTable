import { test, expect, Page } from '@playwright/test';

/**
 * 辅助函数：双击单元格进入编辑模式
 * headerWidth=40, headerHeight=28，默认列宽=100，默认行高=25
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
const getCellData = async (
  page: Page,
  row: number,
  col: number,
): Promise<{ content: string; formulaContent: string }> => {
  return await page.evaluate(
    ([r, c]) => {
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
 * 辅助函数：在单元格中输入公式并按 Enter 确认
 */
const enterFormula = async (
  page: Page,
  row: number,
  col: number,
  formula: string,
): Promise<void> => {
  await dblClickCell(page, row, col);
  await page.waitForTimeout(100);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(formula);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
};

/**
 * 辅助函数：验证单元格字符串内容（精确匹配）
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

test.describe('公式错误处理 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test.describe('#VALUE! 错误', () => {
    test('ABS("文本") 应返回 #VALUE!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=ABS("文本")');
      await expectStringContent(page, 0, 0, '#VALUE!');
    });

    test('ROUND("abc", 2) 应返回 #VALUE!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=ROUND("abc", 2)');
      await expectStringContent(page, 0, 0, '#VALUE!');
    });
  });

  test.describe('#REF! 错误', () => {
    test('INDEX(A1:B2, 99, 1) 超出范围应返回 #REF!', async ({ page }) => {
      // 在 C1 输入，避免公式引用范围包含自身导致循环引用
      await enterFormula(page, 0, 2, '=INDEX(A1:B2, 99, 1)');
      await expectStringContent(page, 0, 2, '#REF!');
    });

    test('INDIRECT("无效") 应返回 #REF!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=INDIRECT("无效")');
      await expectStringContent(page, 0, 0, '#REF!');
    });
  });

  test.describe('#DIV/0! 错误', () => {
    test('MOD(10, 0) 应返回 #DIV/0!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=MOD(10, 0)');
      await expectStringContent(page, 0, 0, '#DIV/0!');
    });

    test('1/0 应返回 #DIV/0!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=1/0');
      await expectStringContent(page, 0, 0, '#DIV/0!');
    });
  });

  test.describe('#NAME? 错误', () => {
    test('调用不存在的函数 NOTAFUNCTION 应返回 #NAME?', async ({ page }) => {
      await enterFormula(page, 0, 0, '=NOTAFUNCTION(1)');
      await expectStringContent(page, 0, 0, '#NAME?');
    });
  });

  test.describe('#NUM! 错误', () => {
    test('SQRT(-1) 应返回 #NUM!', async ({ page }) => {
      await enterFormula(page, 0, 0, '=SQRT(-1)');
      await expectStringContent(page, 0, 0, '#NUM!');
    });

    test('DATEDIF 结束日期早于开始日期应返回 #NUM!', async ({ page }) => {
      // 结束日期早于开始日期，DATEDIF 应返回 #NUM!
      await enterFormula(page, 0, 0, '=DATEDIF("2024-12-31", "2024-01-01", "D")');
      await expectStringContent(page, 0, 0, '#NUM!');
    });
  });

  test.describe('#N/A 错误', () => {
    test('MATCH 找不到匹配项应返回 #N/A', async ({ page }) => {
      // 在 B1 输入，避免公式引用范围 A1:A5 包含自身导致循环引用
      await enterFormula(page, 0, 1, '=MATCH("不存在", A1:A5, 0)');
      await expectStringContent(page, 0, 1, '#N/A');
    });
  });

  test.describe('错误传播', () => {
    test('引用含 #DIV/0! 的单元格应传播错误', async ({ page }) => {
      // A1 产生 #DIV/0! 错误
      await enterFormula(page, 0, 0, '=1/0');
      await expectStringContent(page, 0, 0, '#DIV/0!');

      // B1 引用 A1，错误应传播到 B1
      await enterFormula(page, 0, 1, '=A1+1');
      await expectStringContent(page, 0, 1, '#DIV/0!');
    });

    test('IFERROR 应拦截错误传播并返回指定值', async ({ page }) => {
      // A1 产生 #DIV/0! 错误
      await enterFormula(page, 0, 0, '=1/0');

      // C1 使用 IFERROR 拦截，应返回"已处理"而非错误
      await enterFormula(page, 0, 2, '=IFERROR(A1+1, "已处理")');
      await expectStringContent(page, 0, 2, '已处理');
    });
  });
});
