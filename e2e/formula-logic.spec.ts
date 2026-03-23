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
 * 辅助函数：在单元格中输入公式或值
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

test.describe('逻辑函数 E2E 测试', () => {
  test.describe('IF 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('IF(1>0, "是", "否") 条件为真应返回 "是"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=IF(1>0, "是", "否")');
      await expectStringContent(page, 0, 0, '是');
    });

    test('IF(1<0, "是", "否") 条件为假应返回 "否"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=IF(1<0, "是", "否")');
      await expectStringContent(page, 0, 0, '否');
    });

    test('IF(0, "真", "假") 隐式布尔转换 0 为假应返回 "假"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=IF(0, "真", "假")');
      await expectStringContent(page, 0, 0, '假');
    });
  });

  test.describe('AND 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('AND(TRUE, TRUE) 全为真应返回 TRUE', async ({ page }) => {
      await enterFormula(page, 0, 0, '=AND(TRUE, TRUE)');
      await expectStringContent(page, 0, 0, 'TRUE');
    });

    test('AND(TRUE, FALSE) 含假应返回 FALSE', async ({ page }) => {
      await enterFormula(page, 0, 0, '=AND(TRUE, FALSE)');
      await expectStringContent(page, 0, 0, 'FALSE');
    });

    test('AND(1>0, 2>1) 表达式全为真应返回 TRUE', async ({ page }) => {
      await enterFormula(page, 0, 0, '=AND(1>0, 2>1)');
      await expectStringContent(page, 0, 0, 'TRUE');
    });
  });

  test.describe('OR 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('OR(FALSE, TRUE) 含真应返回 TRUE', async ({ page }) => {
      await enterFormula(page, 0, 0, '=OR(FALSE, TRUE)');
      await expectStringContent(page, 0, 0, 'TRUE');
    });

    test('OR(FALSE, FALSE) 全为假应返回 FALSE', async ({ page }) => {
      await enterFormula(page, 0, 0, '=OR(FALSE, FALSE)');
      await expectStringContent(page, 0, 0, 'FALSE');
    });

    test('OR(1>0, 1<0) 含真表达式应返回 TRUE', async ({ page }) => {
      await enterFormula(page, 0, 0, '=OR(1>0, 1<0)');
      await expectStringContent(page, 0, 0, 'TRUE');
    });
  });

  test.describe('NOT 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('NOT(TRUE) 应返回 FALSE', async ({ page }) => {
      await enterFormula(page, 0, 0, '=NOT(TRUE)');
      await expectStringContent(page, 0, 0, 'FALSE');
    });

    test('NOT(FALSE) 应返回 TRUE', async ({ page }) => {
      await enterFormula(page, 0, 0, '=NOT(FALSE)');
      await expectStringContent(page, 0, 0, 'TRUE');
    });

    test('NOT(0) 隐式布尔转换 0 为假，取反应返回 TRUE', async ({ page }) => {
      await enterFormula(page, 0, 0, '=NOT(0)');
      await expectStringContent(page, 0, 0, 'TRUE');
    });
  });

  test.describe('IFERROR 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('IFERROR(1/0, "错误") 发生错误时应返回 "错误"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=IFERROR(1/0, "错误")');
      await expectStringContent(page, 0, 0, '错误');
    });

    test('IFERROR(10, "错误") 无错误时应返回原值 10', async ({ page }) => {
      await enterFormula(page, 0, 0, '=IFERROR(10, "错误")');
      await expectNumericContent(page, 0, 0, 10);
    });

    test('IFERROR(SQRT(-1), 0) SQRT 错误时应返回备用值 0', async ({ page }) => {
      await enterFormula(page, 0, 0, '=IFERROR(SQRT(-1), 0)');
      await expectNumericContent(page, 0, 0, 0);
    });
  });

  test.describe('IFS 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('IFS(FALSE, "A", TRUE, "B") 应返回第一个为真的条件对应值 "B"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=IFS(FALSE, "A", TRUE, "B")');
      await expectStringContent(page, 0, 0, 'B');
    });

    test('IFS 根据 A1 值 85 判断等级应返回 "及格"', async ({ page }) => {
      // 先在 A1 输入数值 85
      await enterFormula(page, 0, 0, '85');
      // 在 B1 输入 IFS 公式引用 A1
      await enterFormula(page, 0, 1, '=IFS(A1>90, "优", A1>60, "及格", TRUE, "不及格")');
      await expectStringContent(page, 0, 1, '及格');
    });

    test('IFS(FALSE, "A", FALSE, "B") 无匹配条件应返回 #N/A', async ({ page }) => {
      await enterFormula(page, 0, 0, '=IFS(FALSE, "A", FALSE, "B")');
      await expectStringContent(page, 0, 0, '#N/A');
    });
  });

  test.describe('SWITCH 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('SWITCH(2, 1, "一", 2, "二", "其他") 匹配到 2 应返回 "二"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=SWITCH(2, 1, "一", 2, "二", "其他")');
      await expectStringContent(page, 0, 0, '二');
    });

    test('SWITCH(9, 1, "一", 2, "二", "其他") 无匹配时应返回默认值 "其他"', async ({ page }) => {
      await enterFormula(page, 0, 0, '=SWITCH(9, 1, "一", 2, "二", "其他")');
      await expectStringContent(page, 0, 0, '其他');
    });

    test('SWITCH(9, 1, "一", 2, "二") 无匹配且无默认值应返回 #N/A', async ({ page }) => {
      await enterFormula(page, 0, 0, '=SWITCH(9, 1, "一", 2, "二")');
      await expectStringContent(page, 0, 0, '#N/A');
    });
  });
});
