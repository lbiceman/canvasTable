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

/**
 * 辅助函数：构建纵向数据表 A1:C4
 * A列：姓名（张三、李四、王五、赵六）
 * B列：部门（销售、技术、销售、财务）
 * C列：薪资（5000、8000、6000、7000）
 */
const setupVerticalTable = async (page: Page): Promise<void> => {
  // A 列：姓名
  await enterFormula(page, 0, 0, '张三');
  await enterFormula(page, 1, 0, '李四');
  await enterFormula(page, 2, 0, '王五');
  await enterFormula(page, 3, 0, '赵六');
  // B 列：部门
  await enterFormula(page, 0, 1, '销售');
  await enterFormula(page, 1, 1, '技术');
  await enterFormula(page, 2, 1, '销售');
  await enterFormula(page, 3, 1, '财务');
  // C 列：薪资
  await enterFormula(page, 0, 2, '5000');
  await enterFormula(page, 1, 2, '8000');
  await enterFormula(page, 2, 2, '6000');
  await enterFormula(page, 3, 2, '7000');
};

test.describe('查找引用函数 E2E 测试', () => {
  test.describe('VLOOKUP 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('VLOOKUP 精确匹配：查找"李四"的薪资应返回 8000', async ({ page }) => {
      // 构建数据表 A1:C4
      await setupVerticalTable(page);
      // 在 E1 输入 VLOOKUP 公式，精确匹配查找"李四"对应第3列（薪资）
      await enterFormula(page, 0, 4, '=VLOOKUP("李四", A1:C4, 3, FALSE)');
      await expectNumericContent(page, 0, 4, 8000);
    });

    test('VLOOKUP 未找到：查找"不存在"应返回 #N/A', async ({ page }) => {
      // 构建数据表 A1:C4
      await setupVerticalTable(page);
      // 在 E1 输入 VLOOKUP 公式，查找不存在的值
      await enterFormula(page, 0, 4, '=VLOOKUP("不存在", A1:C4, 3, FALSE)');
      await expectStringContent(page, 0, 4, '#N/A');
    });
  });

  test.describe('HLOOKUP 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('HLOOKUP 精确匹配：查找"年龄"对应值应返回 25', async ({ page }) => {
      // 构建横向数据表 A1:C2
      // 第1行：标题（姓名、年龄、城市）
      await enterFormula(page, 0, 0, '姓名');
      await enterFormula(page, 0, 1, '年龄');
      await enterFormula(page, 0, 2, '城市');
      // 第2行：数据（张三、25、北京）
      await enterFormula(page, 1, 0, '张三');
      await enterFormula(page, 1, 1, '25');
      await enterFormula(page, 1, 2, '北京');
      // 在 E1 输入 HLOOKUP 公式，查找"年龄"在第2行的值
      await enterFormula(page, 0, 4, '=HLOOKUP("年龄", A1:C2, 2, FALSE)');
      await expectNumericContent(page, 0, 4, 25);
    });

    test('HLOOKUP 未找到：查找"不存在"应返回 #N/A', async ({ page }) => {
      // 构建横向数据表 A1:C2
      await enterFormula(page, 0, 0, '姓名');
      await enterFormula(page, 0, 1, '年龄');
      await enterFormula(page, 0, 2, '城市');
      await enterFormula(page, 1, 0, '张三');
      await enterFormula(page, 1, 1, '25');
      await enterFormula(page, 1, 2, '北京');
      // 在 E1 输入 HLOOKUP 公式，查找不存在的列标题
      await enterFormula(page, 0, 4, '=HLOOKUP("不存在", A1:C2, 2, FALSE)');
      await expectStringContent(page, 0, 4, '#N/A');
    });
  });

  test.describe('INDEX 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('INDEX(A1:C4, 2, 3) 应返回第2行第3列的值 8000', async ({ page }) => {
      // 构建数据表 A1:C4
      await setupVerticalTable(page);
      // 在 E1 输入 INDEX 公式，取第2行第3列（李四的薪资）
      await enterFormula(page, 0, 4, '=INDEX(A1:C4, 2, 3)');
      await expectNumericContent(page, 0, 4, 8000);
    });

    test('INDEX(A1:C4, 99, 1) 行越界应返回 #REF!', async ({ page }) => {
      // 构建数据表 A1:C4
      await setupVerticalTable(page);
      // 在 E1 输入 INDEX 公式，行号超出范围
      await enterFormula(page, 0, 4, '=INDEX(A1:C4, 99, 1)');
      await expectStringContent(page, 0, 4, '#REF!');
    });
  });

  test.describe('MATCH 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('MATCH("王五", A1:A4, 0) 精确匹配应返回位置 3（从1开始）', async ({ page }) => {
      // 构建数据表 A1:C4
      await setupVerticalTable(page);
      // 在 E1 输入 MATCH 公式，在 A 列查找"王五"的位置
      await enterFormula(page, 0, 4, '=MATCH("王五", A1:A4, 0)');
      await expectNumericContent(page, 0, 4, 3);
    });

    test('MATCH("不存在", A1:A4, 0) 未找到应返回 #N/A', async ({ page }) => {
      // 构建数据表 A1:C4
      await setupVerticalTable(page);
      // 在 E1 输入 MATCH 公式，查找不存在的值
      await enterFormula(page, 0, 4, '=MATCH("不存在", A1:A4, 0)');
      await expectStringContent(page, 0, 4, '#N/A');
    });
  });

  test.describe('INDEX+MATCH 组合', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('INDEX(C1:C4, MATCH("王五", A1:A4, 0)) 应返回王五的薪资 6000', async ({ page }) => {
      // 构建数据表 A1:C4
      await setupVerticalTable(page);
      // 在 E1 输入 INDEX+MATCH 组合公式，通过姓名查找对应薪资
      await enterFormula(page, 0, 4, '=INDEX(C1:C4, MATCH("王五", A1:A4, 0))');
      await expectNumericContent(page, 0, 4, 6000);
    });
  });

  test.describe('OFFSET 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('OFFSET(A1, 0, 7) 向右偏移7列应返回 H1 的值 42', async ({ page }) => {
      // H 列是第 7 列（0-indexed），在 H1（row=0, col=7）输入 42
      await enterFormula(page, 0, 7, '42');
      // 在 E1 输入 OFFSET 公式，从 A1 向右偏移 7 列到达 H1
      await enterFormula(page, 0, 4, '=OFFSET(A1, 0, 7)');
      await expectNumericContent(page, 0, 4, 42);
    });
  });

  test.describe('INDIRECT 函数', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('INDIRECT("A1") 应返回 A1 单元格的值 42', async ({ page }) => {
      // 在 A1 输入 42
      await enterFormula(page, 0, 0, '42');
      // 在 B1 输入 INDIRECT 公式，通过字符串引用 A1
      await enterFormula(page, 0, 1, '=INDIRECT("A1")');
      await expectNumericContent(page, 0, 1, 42);
    });

    test('INDIRECT("无效引用") 无效引用应返回 #REF!', async ({ page }) => {
      // 在 B1 输入 INDIRECT 公式，传入无效的引用字符串
      await enterFormula(page, 0, 1, '=INDIRECT("无效引用")');
      await expectStringContent(page, 0, 1, '#REF!');
    });
  });
});
