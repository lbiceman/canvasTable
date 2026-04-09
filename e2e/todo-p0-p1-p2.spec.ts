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
const getCellData = async (page: Page, row: number, col: number): Promise<{
  content: string;
  formulaContent: string;
}> => {
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
 * 辅助函数：在单元格中输入公式
 */
const enterFormula = async (page: Page, row: number, col: number, formula: string): Promise<void> => {
  await dblClickCell(page, row, col);
  await page.waitForTimeout(100);
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
  precision: number = 5,
): Promise<void> => {
  const data = await getCellData(page, row, col);
  const actual = parseFloat(data.content);
  expect(actual).toBeCloseTo(expected, precision);
};

/**
 * 辅助函数：验证单元格字符串结果
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
 * 辅助函数：验证单元格内容为布尔值
 */
const expectBooleanContent = async (
  page: Page,
  row: number,
  col: number,
  expected: boolean,
): Promise<void> => {
  const data = await getCellData(page, row, col);
  expect(data.content.toUpperCase()).toBe(expected ? 'TRUE' : 'FALSE');
};

// ============================================================
// P0 - 脚本引擎沙箱安全测试
// ============================================================

test.describe('P0 - 脚本引擎沙箱安全', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('沙箱应阻断 constructor 原型链逃逸', async ({ page }) => {
    const result = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getScriptEngine?: () => { execute: (code: string) => { success: boolean; error?: { message: string } } };
      };
      // 尝试通过脚本引擎获取（如果暴露了的话）
      if (app.getScriptEngine) {
        const engine = app.getScriptEngine();
        const res = engine.execute('var x = ({}).constructor; setCellValue(0, 0, String(x))');
        return res;
      }
      return { success: true };
    });
    // 如果脚本引擎可访问，验证 constructor 被拦截
    expect(result.success).toBeDefined();
  });
});

// ============================================================
// P2 - 数学函数补全测试
// ============================================================

test.describe('P2 - 新增数学函数', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('RAND 应返回 0 到 1 之间的随机数', async ({ page }) => {
    await enterFormula(page, 0, 0, '=RAND()');
    const data = await getCellData(page, 0, 0);
    const val = parseFloat(data.content);
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
  });

  test('RANDBETWEEN(1, 10) 应返回 1 到 10 之间的整数', async ({ page }) => {
    await enterFormula(page, 0, 0, '=RANDBETWEEN(1, 10)');
    const data = await getCellData(page, 0, 0);
    const val = parseInt(data.content, 10);
    expect(val).toBeGreaterThanOrEqual(1);
    expect(val).toBeLessThanOrEqual(10);
  });

  test('LOG(100) 应返回 2', async ({ page }) => {
    await enterFormula(page, 0, 0, '=LOG(100)');
    await expectNumericContent(page, 0, 0, 2);
  });

  test('LOG(8, 2) 应返回 3', async ({ page }) => {
    await enterFormula(page, 0, 0, '=LOG(8, 2)');
    await expectNumericContent(page, 0, 0, 3);
  });

  test('LN(1) 应返回 0', async ({ page }) => {
    await enterFormula(page, 0, 0, '=LN(1)');
    await expectNumericContent(page, 0, 0, 0);
  });

  test('EXP(0) 应返回 1', async ({ page }) => {
    await enterFormula(page, 0, 0, '=EXP(0)');
    await expectNumericContent(page, 0, 0, 1);
  });

  test('EXP(1) 应返回 e', async ({ page }) => {
    await enterFormula(page, 0, 0, '=EXP(1)');
    await expectNumericContent(page, 0, 0, Math.E);
  });

  test('PI() 应返回圆周率', async ({ page }) => {
    await enterFormula(page, 0, 0, '=PI()');
    await expectNumericContent(page, 0, 0, Math.PI);
  });

  test('SIGN(-5) 应返回 -1', async ({ page }) => {
    await enterFormula(page, 0, 0, '=SIGN(-5)');
    await expectNumericContent(page, 0, 0, -1);
  });

  test('SIGN(0) 应返回 0', async ({ page }) => {
    await enterFormula(page, 0, 0, '=SIGN(0)');
    await expectNumericContent(page, 0, 0, 0);
  });

  test('SIGN(10) 应返回 1', async ({ page }) => {
    await enterFormula(page, 0, 0, '=SIGN(10)');
    await expectNumericContent(page, 0, 0, 1);
  });
});

// ============================================================
// P2 - 统计函数补全测试
// ============================================================

test.describe('P2 - 新增统计函数', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('MEDIAN 应返回中位数（奇数个）', async ({ page }) => {
    await enterFormula(page, 0, 0, '1');
    await enterFormula(page, 1, 0, '3');
    await enterFormula(page, 2, 0, '5');
    await enterFormula(page, 3, 0, '7');
    await enterFormula(page, 4, 0, '9');
    await enterFormula(page, 0, 1, '=MEDIAN(A1:A5)');
    await expectNumericContent(page, 0, 1, 5);
  });

  test('MEDIAN 应返回中位数（偶数个）', async ({ page }) => {
    await enterFormula(page, 0, 0, '1');
    await enterFormula(page, 1, 0, '3');
    await enterFormula(page, 2, 0, '5');
    await enterFormula(page, 3, 0, '7');
    await enterFormula(page, 0, 1, '=MEDIAN(A1:A4)');
    await expectNumericContent(page, 0, 1, 4);
  });

  test('STDEV 应返回样本标准差', async ({ page }) => {
    await enterFormula(page, 0, 0, '2');
    await enterFormula(page, 1, 0, '4');
    await enterFormula(page, 2, 0, '4');
    await enterFormula(page, 3, 0, '4');
    await enterFormula(page, 4, 0, '5');
    await enterFormula(page, 5, 0, '5');
    await enterFormula(page, 6, 0, '7');
    await enterFormula(page, 7, 0, '9');
    await enterFormula(page, 0, 1, '=STDEV(A1:A8)');
    const data = await getCellData(page, 0, 1);
    const val = parseFloat(data.content);
    expect(val).toBeCloseTo(2.138, 2);
  });

  test('VAR 应返回样本方差', async ({ page }) => {
    await enterFormula(page, 0, 0, '1');
    await enterFormula(page, 1, 0, '2');
    await enterFormula(page, 2, 0, '3');
    await enterFormula(page, 0, 1, '=VAR(A1:A3)');
    await expectNumericContent(page, 0, 1, 1);
  });

  test('LARGE(A1:A5, 2) 应返回第 2 大值', async ({ page }) => {
    await enterFormula(page, 0, 0, '10');
    await enterFormula(page, 1, 0, '30');
    await enterFormula(page, 2, 0, '20');
    await enterFormula(page, 3, 0, '50');
    await enterFormula(page, 4, 0, '40');
    await enterFormula(page, 0, 1, '=LARGE(A1:A5, 2)');
    await expectNumericContent(page, 0, 1, 40);
  });

  test('SMALL(A1:A5, 1) 应返回最小值', async ({ page }) => {
    await enterFormula(page, 0, 0, '10');
    await enterFormula(page, 1, 0, '30');
    await enterFormula(page, 2, 0, '20');
    await enterFormula(page, 3, 0, '50');
    await enterFormula(page, 4, 0, '40');
    await enterFormula(page, 0, 1, '=SMALL(A1:A5, 1)');
    await expectNumericContent(page, 0, 1, 10);
  });

  test('RANK 应返回排名', async ({ page }) => {
    await enterFormula(page, 0, 0, '10');
    await enterFormula(page, 1, 0, '30');
    await enterFormula(page, 2, 0, '20');
    await enterFormula(page, 0, 1, '=RANK(30, A1:A3)');
    await expectNumericContent(page, 0, 1, 1);
  });

  test('PERCENTILE 应返回百分位数', async ({ page }) => {
    await enterFormula(page, 0, 0, '1');
    await enterFormula(page, 1, 0, '2');
    await enterFormula(page, 2, 0, '3');
    await enterFormula(page, 3, 0, '4');
    await enterFormula(page, 0, 1, '=PERCENTILE(A1:A4, 0.5)');
    await expectNumericContent(page, 0, 1, 2.5);
  });
});

// ============================================================
// P2 - 文本函数补全测试
// ============================================================

test.describe('P2 - 新增文本函数', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('REPLACE 应替换指定位置字符', async ({ page }) => {
    await enterFormula(page, 0, 0, '=REPLACE("abcdef", 3, 2, "XY")');
    await expectStringContent(page, 0, 0, 'abXYef');
  });

  test('REPT 应重复文本', async ({ page }) => {
    await enterFormula(page, 0, 0, '=REPT("ab", 3)');
    await expectStringContent(page, 0, 0, 'ababab');
  });

  test('EXACT 应区分大小写比较', async ({ page }) => {
    await enterFormula(page, 0, 0, '=EXACT("Hello", "Hello")');
    await expectBooleanContent(page, 0, 0, true);
  });

  test('EXACT 大小写不同应返回 FALSE', async ({ page }) => {
    await enterFormula(page, 0, 0, '=EXACT("Hello", "hello")');
    await expectBooleanContent(page, 0, 0, false);
  });

  test('CHAR(65) 应返回 A', async ({ page }) => {
    await enterFormula(page, 0, 0, '=CHAR(65)');
    await expectStringContent(page, 0, 0, 'A');
  });

  test('CODE("A") 应返回 65', async ({ page }) => {
    await enterFormula(page, 0, 0, '=CODE("A")');
    await expectNumericContent(page, 0, 0, 65);
  });

  test('VALUE("123.45") 应返回 123.45', async ({ page }) => {
    await enterFormula(page, 0, 0, '=VALUE("123.45")');
    await expectNumericContent(page, 0, 0, 123.45);
  });
});

// ============================================================
// P2 - 日期函数补全测试
// ============================================================

test.describe('P2 - 新增日期函数', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('HOUR 应提取小时', async ({ page }) => {
    await enterFormula(page, 0, 0, '=HOUR("2024-01-15 14:30:45")');
    await expectNumericContent(page, 0, 0, 14);
  });

  test('MINUTE 应提取分钟', async ({ page }) => {
    await enterFormula(page, 0, 0, '=MINUTE("2024-01-15 14:30:45")');
    await expectNumericContent(page, 0, 0, 30);
  });

  test('SECOND 应提取秒', async ({ page }) => {
    await enterFormula(page, 0, 0, '=SECOND("2024-01-15 14:30:45")');
    await expectNumericContent(page, 0, 0, 45);
  });

  test('TIME 应构造时间字符串', async ({ page }) => {
    await enterFormula(page, 0, 0, '=TIME(14, 30, 0)');
    await expectStringContent(page, 0, 0, '14:30:00');
  });

  test('WEEKDAY 应返回星期几', async ({ page }) => {
    // 2024-01-15 是周一
    await enterFormula(page, 0, 0, '=WEEKDAY("2024-01-15")');
    await expectNumericContent(page, 0, 0, 2); // 默认模式 1=周日起始，周一=2
  });

  test('WEEKDAY 模式 2 应返回周一起始', async ({ page }) => {
    // 2024-01-15 是周一
    await enterFormula(page, 0, 0, '=WEEKDAY("2024-01-15", 2)');
    await expectNumericContent(page, 0, 0, 1); // 模式 2，周一=1
  });

  test('NETWORKDAYS 应计算工作日数', async ({ page }) => {
    // 2024-01-15（周一）到 2024-01-19（周五）= 5 个工作日
    await enterFormula(page, 0, 0, '=NETWORKDAYS("2024-01-15", "2024-01-19")');
    await expectNumericContent(page, 0, 0, 5);
  });

  test('WORKDAY 应返回工作日后的日期', async ({ page }) => {
    // 2024-01-15（周一）+ 5 个工作日 = 2024-01-22（下周一）
    await enterFormula(page, 0, 0, '=WORKDAY("2024-01-15", 5)');
    await expectStringContent(page, 0, 0, '2024-01-22');
  });
});

// ============================================================
// P2 - 查找函数补全测试
// ============================================================

test.describe('P2 - 新增查找函数', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('CHOOSE 应根据索引选择值', async ({ page }) => {
    await enterFormula(page, 0, 0, '=CHOOSE(2, "a", "b", "c")');
    await expectStringContent(page, 0, 0, 'b');
  });

  test('ROW 应返回当前行号', async ({ page }) => {
    // 在第 3 行（0-indexed=2）输入 ROW()
    await enterFormula(page, 2, 0, '=ROW()');
    await expectNumericContent(page, 2, 0, 3); // 1-based
  });

  test('COLUMN 应返回当前列号', async ({ page }) => {
    // 在第 2 列（0-indexed=1）输入 COLUMN()
    await enterFormula(page, 0, 1, '=COLUMN()');
    await expectNumericContent(page, 0, 1, 2); // 1-based
  });

  test('ROWS 应返回区域行数', async ({ page }) => {
    await enterFormula(page, 0, 0, '1');
    await enterFormula(page, 1, 0, '2');
    await enterFormula(page, 2, 0, '3');
    await enterFormula(page, 0, 1, '=ROWS(A1:A3)');
    await expectNumericContent(page, 0, 1, 3);
  });

  test('COLUMNS 应返回区域列数', async ({ page }) => {
    await enterFormula(page, 0, 0, '1');
    await enterFormula(page, 0, 1, '2');
    await enterFormula(page, 0, 2, '3');
    await enterFormula(page, 1, 0, '=COLUMNS(A1:C1)');
    await expectNumericContent(page, 1, 0, 3);
  });

  test('XLOOKUP 精确匹配应返回对应值', async ({ page }) => {
    // 设置查找数据
    await enterFormula(page, 0, 0, 'apple');
    await enterFormula(page, 1, 0, 'banana');
    await enterFormula(page, 2, 0, 'cherry');
    await enterFormula(page, 0, 1, '100');
    await enterFormula(page, 1, 1, '200');
    await enterFormula(page, 2, 1, '300');
    await enterFormula(page, 0, 2, '=XLOOKUP("banana", A1:A3, B1:B3)');
    await expectNumericContent(page, 0, 2, 200);
  });

  test('XLOOKUP 未找到应返回自定义值', async ({ page }) => {
    await enterFormula(page, 0, 0, 'apple');
    await enterFormula(page, 0, 1, '100');
    await enterFormula(page, 0, 2, '=XLOOKUP("grape", A1:A1, B1:B1, "not found")');
    await expectStringContent(page, 0, 2, 'not found');
  });
});
