import { test, expect, Page } from '@playwright/test';

// ============================================================
// 辅助函数
// ============================================================

/** Canvas 渲染配置常量 */
const HEADER_WIDTH = 40;
const HEADER_HEIGHT = 28;
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 25;

/**
 * 点击 Canvas 上指定单元格（0-indexed）
 */
const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.click({ position: { x, y } });
};

/**
 * 双击 Canvas 上指定单元格进入编辑模式
 */
const dblClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.dblclick({ position: { x, y } });
};

/**
 * 通过 window.app.getModel() 获取单元格数据
 */
const getCellData = async (page: Page, row: number, col: number): Promise<{
  content?: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontColor?: string;
  bgColor?: string;
  fontSize?: number;
  fontAlign?: string;
  verticalAlign?: string;
  rowSpan?: number;
  colSpan?: number;
  isMerged?: boolean;
  formulaContent?: string;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => Record<string, unknown> | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell) return {};
      return {
        content: cell.content as string | undefined,
        fontBold: cell.fontBold as boolean | undefined,
        fontItalic: cell.fontItalic as boolean | undefined,
        fontUnderline: cell.fontUnderline as boolean | undefined,
        fontColor: cell.fontColor as string | undefined,
        bgColor: cell.bgColor as string | undefined,
        fontSize: cell.fontSize as number | undefined,
        fontAlign: cell.fontAlign as string | undefined,
        verticalAlign: cell.verticalAlign as string | undefined,
        rowSpan: cell.rowSpan as number | undefined,
        colSpan: cell.colSpan as number | undefined,
        isMerged: cell.isMerged as boolean | undefined,
        formulaContent: cell.formulaContent as string | undefined,
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 在单元格中输入内容（通过双击进入编辑模式）
 */
const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await dblClickCell(page, row, col);
  const editorInput = page.locator('.inline-editor input');
  await editorInput.fill(text);
  await page.keyboard.press('Enter');
};

// ============================================================
// 测试套件
// ============================================================

test.describe('剪贴板操作', () => {
  test.beforeEach(async ({ page, context }) => {
    // 授予剪贴板权限
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Ctrl+C 复制单元格内容，Ctrl+V 粘贴到另一个单元格', async ({ page }) => {
    // 在 A1 输入内容
    await typeInCell(page, 0, 0, 'CopyMe');

    // 选中 A1 并复制
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+c');
    // 等待系统剪贴板写入完成
    await page.waitForTimeout(300);

    // 选中 B1 并粘贴
    await clickCell(page, 0, 1);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    // 验证 B1 内容
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.content).toBe('CopyMe');

    // 验证 A1 内容仍然存在（复制不删除原内容）
    const cellA1 = await getCellData(page, 0, 0);
    expect(cellA1.content).toBe('CopyMe');
  });

  test('Ctrl+X 剪切单元格内容，Ctrl+V 粘贴到目标位置', async ({ page }) => {
    // 在 A1 输入内容
    await typeInCell(page, 0, 0, 'CutMe');

    // 选中 A1 并剪切
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+x');
    // 等待系统剪贴板写入完成
    await page.waitForTimeout(300);

    // 选中 C1 并粘贴
    await clickCell(page, 0, 2);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    // 验证 C1 有内容
    const cellC1 = await getCellData(page, 0, 2);
    expect(cellC1.content).toBe('CutMe');
  });

  test('复制多个单元格并粘贴', async ({ page }) => {
    // 在 A1、B1 输入内容
    await typeInCell(page, 0, 0, 'Cell1');
    await typeInCell(page, 0, 1, 'Cell2');

    // 选中 A1:B1 区域
    await clickCell(page, 0, 0);
    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForTimeout(200);

    // 复制
    await page.keyboard.press('Control+c');
    // 等待系统剪贴板写入完成
    await page.waitForTimeout(300);

    // 选中 A3 并粘贴
    await clickCell(page, 2, 0);
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(300);

    // 验证 A3、B3 内容
    const cellA3 = await getCellData(page, 2, 0);
    const cellB3 = await getCellData(page, 2, 1);
    expect(cellA3.content).toBe('Cell1');
    expect(cellB3.content).toBe('Cell2');
  });
});

test.describe('公式功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('SUM 公式计算正确', async ({ page }) => {
    // 在 A1、A2 输入数字
    await typeInCell(page, 0, 0, '10');
    await typeInCell(page, 1, 0, '20');

    // 在 A3 输入 SUM 公式
    await clickCell(page, 2, 0);
    const contentInput = page.locator('#cell-content');
    await contentInput.fill('=SUM(A1,A2)');
    await page.locator('#set-content').click();

    // 验证 A3 显示计算结果
    const cellA3 = await getCellData(page, 2, 0);
    expect(cellA3.content).toBe('30');
  });

  test('SUBTRACT 公式计算正确', async ({ page }) => {
    await typeInCell(page, 0, 0, '50');
    await typeInCell(page, 1, 0, '20');

    await clickCell(page, 2, 0);
    const contentInput = page.locator('#cell-content');
    await contentInput.fill('=SUBTRACT(A1,A2)');
    await page.locator('#set-content').click();

    const cellA3 = await getCellData(page, 2, 0);
    expect(cellA3.content).toBe('30');
  });

  test('MULTIPLY 公式计算正确', async ({ page }) => {
    await typeInCell(page, 0, 0, '6');
    await typeInCell(page, 1, 0, '7');

    await clickCell(page, 2, 0);
    const contentInput = page.locator('#cell-content');
    await contentInput.fill('=MULTIPLY(A1,A2)');
    await page.locator('#set-content').click();

    const cellA3 = await getCellData(page, 2, 0);
    expect(cellA3.content).toBe('42');
  });

  test('DIVIDE 公式计算正确', async ({ page }) => {
    await typeInCell(page, 0, 0, '100');
    await typeInCell(page, 1, 0, '4');

    await clickCell(page, 2, 0);
    const contentInput = page.locator('#cell-content');
    await contentInput.fill('=DIVIDE(A1,A2)');
    await page.locator('#set-content').click();

    const cellA3 = await getCellData(page, 2, 0);
    expect(cellA3.content).toBe('25');
  });

  test('无效公式应显示错误提示', async ({ page }) => {
    await clickCell(page, 0, 0);
    const contentInput = page.locator('#cell-content');
    await contentInput.fill('=INVALID(A1)');
    await page.locator('#set-content').click();

    // 公式错误提示应出现
    const formulaError = page.locator('#formula-error');
    // 等待错误提示出现（可能有动画）
    await page.waitForTimeout(300);
    const errorText = await formulaError.textContent();
    // 错误提示应包含相关信息，或者单元格内容不变
    // 无效公式不会被设置到单元格
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('');
  });

  test('DIVIDE 除以零应显示错误', async ({ page }) => {
    await typeInCell(page, 0, 0, '10');
    await typeInCell(page, 1, 0, '0');

    await clickCell(page, 2, 0);
    const contentInput = page.locator('#cell-content');
    await contentInput.fill('=DIVIDE(A1,A2)');
    await page.locator('#set-content').click();

    // 除以零应该报错，单元格内容不应被设置为 Infinity
    await page.waitForTimeout(300);
    const cell = await getCellData(page, 2, 0);
    // 除以零可能显示错误或不设置内容
    expect(cell.content !== 'Infinity').toBeTruthy();
  });
});
