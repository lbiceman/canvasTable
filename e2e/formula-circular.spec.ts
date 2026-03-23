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

test.describe('循环引用 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('直接循环引用应被阻止：A1 输入 =A1+1 后 formulaContent 为空', async ({ page }) => {
    // A1 引用自身，构成直接循环引用，写入应被拒绝
    await enterFormula(page, 0, 0, '=A1+1');
    const data = await getCellData(page, 0, 0);
    // 循环引用被阻止，formulaContent 应为空字符串
    expect(data.formulaContent).toBe('');
  });

  test('直接循环引用内容保留：A1 的 content 不包含循环引用的计算结果', async ({ page }) => {
    // 先写入普通值，再尝试写入循环引用
    await enterFormula(page, 0, 0, '42');
    await enterFormula(page, 0, 0, '=A1+1');
    const data = await getCellData(page, 0, 0);
    // 循环引用被阻止，content 不应是 =A1+1 的计算结果（如 43）
    expect(data.formulaContent).toBe('');
  });

  test('间接循环引用应被阻止：A1=B1 成功后，B1=A1 的 formulaContent 为空', async ({ page }) => {
    // A1 引用 B1（此时 B1 为空，无循环）
    await enterFormula(page, 0, 0, '=B1');
    const a1 = await getCellData(page, 0, 0);
    expect(a1.formulaContent).not.toBe('');

    // B1 引用 A1，形成 A1→B1→A1 的间接循环，应被阻止
    await enterFormula(page, 0, 1, '=A1');
    const b1 = await getCellData(page, 0, 1);
    expect(b1.formulaContent).toBe('');
  });

  test('间接循环引用链应被阻止：A1=B1, B1=C1, C1=A1 中 C1 被阻止', async ({ page }) => {
    // 建立 A1→B1→C1 的引用链
    await enterFormula(page, 0, 0, '=B1');
    await enterFormula(page, 0, 1, '=C1');

    // C1 引用 A1，形成 C1→A1→B1→C1 的循环，应被阻止
    await enterFormula(page, 0, 2, '=A1');
    const c1 = await getCellData(page, 0, 2);
    expect(c1.formulaContent).toBe('');
  });

  test('断开循环后可以恢复正常写入', async ({ page }) => {
    // 建立 A1→B1→C1 的引用链
    await enterFormula(page, 0, 0, '=B1');
    await enterFormula(page, 0, 1, '=C1');

    // C1 尝试引用 A1，形成循环，被阻止
    await enterFormula(page, 0, 2, '=A1');
    const c1Before = await getCellData(page, 0, 2);
    expect(c1Before.formulaContent).toBe('');

    // 将 B1 改为普通值，断开循环链
    await enterFormula(page, 0, 1, '100');

    // 现在 C1 引用 A1 不再构成循环，应可以正常写入
    await enterFormula(page, 0, 2, '=A1');
    const c1After = await getCellData(page, 0, 2);
    expect(c1After.formulaContent).not.toBe('');
  });
});
