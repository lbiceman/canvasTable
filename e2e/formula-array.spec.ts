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
 * 辅助函数：单击单元格（选中但不进入编辑）
 */
const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = 40 + col * 100 + 50;
  const y = 28 + row * 25 + 12;
  await canvas.click({ position: { x, y } });
};

/**
 * 辅助函数：获取单元格数据（包含 isArrayFormula 字段）
 */
const getCellData = async (
  page: Page,
  row: number,
  col: number,
): Promise<{
  content: string;
  formulaContent: string;
  isArrayFormula: boolean;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            content?: string;
            formulaContent?: string;
            isArrayFormula?: boolean;
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return {
        content: cell?.content ?? '',
        formulaContent: cell?.formulaContent ?? '',
        isArrayFormula: cell?.isArrayFormula ?? false,
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：输入普通值
 */
const enterValue = async (page: Page, row: number, col: number, value: string): Promise<void> => {
  await dblClickCell(page, row, col);
  await page.waitForTimeout(100);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
};

/**
 * 辅助函数：输入数组公式（Ctrl+Shift+Enter）
 */
const enterArrayFormula = async (
  page: Page,
  row: number,
  col: number,
  formula: string,
): Promise<void> => {
  await dblClickCell(page, row, col);
  await page.waitForTimeout(100);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(formula);
  await page.keyboard.press('Control+Shift+Enter');
  await page.waitForTimeout(300);
};

test.describe('数组公式 E2E 测试', () => {
  test.describe('CSE 输入', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('Ctrl+Shift+Enter 应将公式标记为数组公式', async ({ page }) => {
      // 在 A1 使用 CSE 输入数组公式
      await enterArrayFormula(page, 0, 0, '=A1:A3*B1:B3');

      // 验证单元格被标记为数组公式
      const cellData = await getCellData(page, 0, 0);
      expect(cellData.isArrayFormula).toBe(true);
    });
  });

  test.describe('花括号显示', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('选中数组公式单元格时公式栏应显示花括号', async ({ page }) => {
      // 在 A1 输入数组公式
      await enterArrayFormula(page, 0, 0, '=A1:A3*B1:B3');

      // 单击选中该单元格（不进入编辑模式）
      await clickCell(page, 0, 0);
      await page.waitForTimeout(200);

      // 验证公式栏显示带花括号的数组公式
      const formulaInput = page.locator('.formula-input');
      const formulaValue = await formulaInput.inputValue();
      expect(formulaValue).toBe('{=A1:A3*B1:B3}');
    });
  });

  test.describe('逐元素运算', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('数组公式应对每行执行逐元素乘法运算', async ({ page }) => {
      // 在 A1:A3 填入 2, 3, 4
      await enterValue(page, 0, 0, '2');
      await enterValue(page, 1, 0, '3');
      await enterValue(page, 2, 0, '4');

      // 在 B1:B3 填入 10, 20, 30
      await enterValue(page, 0, 1, '10');
      await enterValue(page, 1, 1, '20');
      await enterValue(page, 2, 1, '30');

      // 在 C1 输入数组公式 =A1:A3*B1:B3
      await enterArrayFormula(page, 0, 2, '=A1:A3*B1:B3');

      // 验证 C1=20（2*10）
      const c1 = await getCellData(page, 0, 2);
      expect(parseFloat(c1.content)).toBeCloseTo(20, 5);

      // 验证 C2=60（3*20），数组公式自动填充
      const c2 = await getCellData(page, 1, 2);
      expect(parseFloat(c2.content)).toBeCloseTo(60, 5);

      // 验证 C3=120（4*30），数组公式自动填充
      const c3 = await getCellData(page, 2, 2);
      expect(parseFloat(c3.content)).toBeCloseTo(120, 5);
    });
  });

  test.describe('区域保护', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(500);
    });

    test('双击数组公式区域中的非起始单元格应阻止进入编辑模式', async ({ page }) => {
      // 在 A1:A3 和 B1:B3 填入数据
      await enterValue(page, 0, 0, '2');
      await enterValue(page, 1, 0, '3');
      await enterValue(page, 2, 0, '4');
      await enterValue(page, 0, 1, '10');
      await enterValue(page, 1, 1, '20');
      await enterValue(page, 2, 1, '30');

      // 在 C1 创建数组公式
      await enterArrayFormula(page, 0, 2, '=A1:A3*B1:B3');

      // 尝试双击 C2（数组公式区域中的非起始单元格）
      await dblClickCell(page, 1, 2);
      await page.waitForTimeout(200);

      // 验证 inline-editor 未显示（编辑被阻止）
      const editorDisplay = await page.locator('.inline-editor').evaluate(
        (el: HTMLElement) => el.style.display,
      );
      expect(editorDisplay).toBe('none');
    });

    test('对数组公式区域中的非起始单元格按 Delete 应阻止清空内容', async ({ page }) => {
      // 在 A1:A3 和 B1:B3 填入数据
      await enterValue(page, 0, 0, '2');
      await enterValue(page, 1, 0, '3');
      await enterValue(page, 2, 0, '4');
      await enterValue(page, 0, 1, '10');
      await enterValue(page, 1, 1, '20');
      await enterValue(page, 2, 1, '30');

      // 在 C1 创建数组公式
      await enterArrayFormula(page, 0, 2, '=A1:A3*B1:B3');

      // 记录 C2 删除前的内容
      const before = await getCellData(page, 1, 2);

      // 单击选中 C2，然后按 Delete
      await clickCell(page, 1, 2);
      await page.waitForTimeout(100);
      await page.keyboard.press('Delete');
      await page.waitForTimeout(200);

      // 验证 C2 内容未被清空（数组公式保护生效）
      const after = await getCellData(page, 1, 2);
      expect(after.content).toBe(before.content);
      expect(after.content).not.toBe('');
    });
  });
});
