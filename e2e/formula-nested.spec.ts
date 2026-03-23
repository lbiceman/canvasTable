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

/**
 * 辅助函数：验证单元格数值结果
 * 使用 parseFloat 比较，避免格式差异
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

test.describe('嵌套公式与跨函数组合 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('数学+逻辑嵌套：IF(SUM(A1:A5)>100, "大", "小") 应返回"大"', async ({ page }) => {
    // 在 A1:A5 填入 10, 20, 30, 40, 50，总和为 150 > 100
    await enterFormula(page, 0, 0, '10');
    await enterFormula(page, 1, 0, '20');
    await enterFormula(page, 2, 0, '30');
    await enterFormula(page, 3, 0, '40');
    await enterFormula(page, 4, 0, '50');

    // 在 B1 输入嵌套公式
    await enterFormula(page, 0, 1, '=IF(SUM(A1:A5)>100, "大", "小")');
    await expectStringContent(page, 0, 1, '大');
  });

  test('文本+逻辑嵌套：IF(LEN("Hello")>3, UPPER("hello"), LOWER("HELLO")) 应返回 HELLO', async ({
    page,
  }) => {
    // LEN("Hello") = 5 > 3，条件为真，执行 UPPER("hello")
    await enterFormula(page, 0, 0, '=IF(LEN("Hello")>3, UPPER("hello"), LOWER("HELLO"))');
    await expectStringContent(page, 0, 0, 'HELLO');
  });

  test('统计+数学嵌套：ROUND(AVERAGE(A1:A5), 0) 应返回 3', async ({ page }) => {
    // 在 A1:A5 填入 1, 2, 3, 4, 5，平均值为 3.0
    await enterFormula(page, 0, 0, '1');
    await enterFormula(page, 1, 0, '2');
    await enterFormula(page, 2, 0, '3');
    await enterFormula(page, 3, 0, '4');
    await enterFormula(page, 4, 0, '5');

    // 在 B1 输入嵌套公式，ROUND(3.0, 0) = 3
    await enterFormula(page, 0, 1, '=ROUND(AVERAGE(A1:A5), 0)');
    await expectNumericContent(page, 0, 1, 3);
  });

  test('多层嵌套：IF(AND(ABS(-5)>3, OR(1>0, 2<0)), CONCATENATE("结果:", "通过"), "失败") 应返回"结果:通过"', async ({
    page,
  }) => {
    // ABS(-5)=5>3 为真，OR(1>0, 2<0)=true，AND 为真，执行 CONCATENATE
    await enterFormula(
      page,
      0,
      0,
      '=IF(AND(ABS(-5)>3, OR(1>0, 2<0)), CONCATENATE("结果:", "通过"), "失败")',
    );
    await expectStringContent(page, 0, 0, '结果:通过');
  });

  test('IFERROR+VLOOKUP 组合：查找不存在的值应返回"未找到"', async ({ page }) => {
    // 在 A1:B3 构建查找数据
    await enterFormula(page, 0, 0, '张三');
    await enterFormula(page, 0, 1, '100');
    await enterFormula(page, 1, 0, '李四');
    await enterFormula(page, 1, 1, '200');
    await enterFormula(page, 2, 0, '王五');
    await enterFormula(page, 2, 1, '300');

    // 在 C1 输入 IFERROR+VLOOKUP，查找不存在的值
    await enterFormula(page, 0, 2, '=IFERROR(VLOOKUP("不存在", A1:B3, 2, FALSE), "未找到")');
    await expectStringContent(page, 0, 2, '未找到');
  });

  test('日期+数学嵌套：YEAR(DATE(2024, 1, 15)) + 1 应返回 2025', async ({ page }) => {
    // DATE(2024, 1, 15) 生成日期，YEAR 提取年份 2024，加 1 得 2025
    await enterFormula(page, 0, 0, '=YEAR(DATE(2024, 1, 15)) + 1');
    await expectNumericContent(page, 0, 0, 2025);
  });
});
