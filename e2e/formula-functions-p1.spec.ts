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
  formulaContent?: string;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => Record<string, unknown> | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell) return {};
      return {
        content: cell.content as string | undefined,
        formulaContent: cell.formulaContent as string | undefined,
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 通过公式栏在单元格中输入内容（纯文本或公式）
 * 点击单元格 → 点击 .formula-input → 输入内容 → 按 Enter 确认
 */
const typeInFormulaBar = async (page: Page, text: string): Promise<void> => {
  const formulaInput = page.locator('.formula-input');
  await formulaInput.click();
  await formulaInput.fill(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
};

/**
 * 在指定单元格中设置内容（通过公式栏）
 */
const setCellValue = async (page: Page, row: number, col: number, value: string): Promise<void> => {
  await clickCell(page, row, col);
  await page.waitForTimeout(100);
  await typeInFormulaBar(page, value);
};

/**
 * 在指定单元格中设置公式（通过公式栏，使用 #set-content 按钮确认）
 */
const setFormula = async (page: Page, row: number, col: number, formula: string): Promise<void> => {
  await clickCell(page, row, col);
  await page.waitForTimeout(100);
  const formulaInput = page.locator('.formula-input');
  await formulaInput.click();
  await formulaInput.fill(formula);
  await page.locator('#set-content').click();
  await page.waitForTimeout(300);
};

// ============================================================
// 需求 1：IFNA 逻辑函数
// ============================================================

test.describe('需求1：IFNA 逻辑函数', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForSelector('.formula-bar');
    await page.waitForTimeout(500);
  });

  test('IFNA 捕获 #N/A 错误返回替代值', async ({ page }) => {
    // 准备查找表数据：A1=1, B1="a", A2=2, B2="b"
    await setCellValue(page, 0, 0, '1');
    await setCellValue(page, 0, 1, 'a');
    await setCellValue(page, 1, 0, '2');
    await setCellValue(page, 1, 1, 'b');

    // C1: VLOOKUP 查找不存在的值 99，应产生 #N/A，IFNA 捕获后返回 "未找到"
    await setFormula(page, 0, 2, '=IFNA(VLOOKUP(99,A1:B2,2,FALSE),"未找到")');

    const cellC1 = await getCellData(page, 0, 2);
    expect(cellC1.content).toBe('未找到');
  });

  test('IFNA 不拦截非 #N/A 错误（如 #DIV/0!）', async ({ page }) => {
    // A1 设置一个会产生 #DIV/0! 错误的公式
    await setFormula(page, 0, 0, '=1/0');

    // B1 用 IFNA 包裹 A1 引用，不应拦截 #DIV/0!
    await setFormula(page, 0, 1, '=IFNA(A1,"替代值")');

    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.content).toContain('#DIV/0!');
  });

  test('IFNA 正常值直接返回', async ({ page }) => {
    // A1 设置正常数值
    await setCellValue(page, 0, 0, '42');

    // B1 用 IFNA 包裹 A1，正常值应直接返回
    await setFormula(page, 0, 1, '=IFNA(A1,"替代值")');

    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.content).toBe('42');
  });
});

// ============================================================
// 需求 2：TEXTJOIN 文本函数
// ============================================================

test.describe('需求2：TEXTJOIN 文本函数', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForSelector('.formula-bar');
    await page.waitForTimeout(500);
  });

  test('TEXTJOIN 基本分隔符连接', async ({ page }) => {
    // 准备数据：A1="Hello", B1="World", C1="Test"
    await setCellValue(page, 0, 0, 'Hello');
    await setCellValue(page, 0, 1, 'World');
    await setCellValue(page, 0, 2, 'Test');

    // D1 使用 TEXTJOIN 连接三个单元格
    await setFormula(page, 0, 3, '=TEXTJOIN(",",TRUE,A1,B1,C1)');

    const cellD1 = await getCellData(page, 0, 3);
    expect(cellD1.content).toBe('Hello,World,Test');
  });

  test('TEXTJOIN ignore_empty=TRUE 跳过空字符串', async ({ page }) => {
    // 准备数据：A1="a", A2 为空, A3="c"
    await setCellValue(page, 0, 0, 'a');
    // A2 留空（不设置）
    await setCellValue(page, 2, 0, 'c');

    // B1 使用 TEXTJOIN 连接区域 A1:A3，忽略空值
    await setFormula(page, 0, 1, '=TEXTJOIN("-",TRUE,A1:A3)');

    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.content).toBe('a-c');
  });

  test('TEXTJOIN ignore_empty=FALSE 保留空字符串', async ({ page }) => {
    // 准备数据：A1="a", A2 为空, A3="c"
    await setCellValue(page, 0, 0, 'a');
    // A2 留空（不设置）
    await setCellValue(page, 2, 0, 'c');

    // B1 使用 TEXTJOIN 连接区域 A1:A3，不忽略空值
    await setFormula(page, 0, 1, '=TEXTJOIN("-",FALSE,A1:A3)');

    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.content).toBe('a--c');
  });
});

// ============================================================
// 需求 3：ROUNDUP / ROUNDDOWN / INT / TRUNC 数学函数
// ============================================================

test.describe('需求3：ROUNDUP / ROUNDDOWN / INT / TRUNC 数学函数', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForSelector('.formula-bar');
    await page.waitForTimeout(500);
  });

  // --- ROUNDUP ---
  test('ROUNDUP 正数向远离零方向舍入', async ({ page }) => {
    await setFormula(page, 0, 0, '=ROUNDUP(3.141,2)');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('3.15');
  });

  test('ROUNDUP 负数向远离零方向舍入', async ({ page }) => {
    await setFormula(page, 0, 0, '=ROUNDUP(-3.141,2)');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('-3.15');
  });

  // --- ROUNDDOWN ---
  test('ROUNDDOWN 正数向接近零方向舍入', async ({ page }) => {
    await setFormula(page, 0, 0, '=ROUNDDOWN(3.149,2)');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('3.14');
  });

  test('ROUNDDOWN 负数向接近零方向舍入', async ({ page }) => {
    await setFormula(page, 0, 0, '=ROUNDDOWN(-3.149,2)');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('-3.14');
  });

  // --- INT ---
  test('INT 正数取整（向下取整）', async ({ page }) => {
    await setFormula(page, 0, 0, '=INT(3.7)');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('3');
  });

  test('INT 负数取整（向负无穷方向）', async ({ page }) => {
    await setFormula(page, 0, 0, '=INT(-3.2)');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('-4');
  });

  // --- TRUNC ---
  test('TRUNC 正数截断小数部分', async ({ page }) => {
    await setFormula(page, 0, 0, '=TRUNC(3.7)');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('3');
  });

  test('TRUNC 负数截断小数部分（向零方向）', async ({ page }) => {
    await setFormula(page, 0, 0, '=TRUNC(-3.7)');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('-3');
  });

  test('TRUNC 指定小数位数截断', async ({ page }) => {
    await setFormula(page, 0, 0, '=TRUNC(3.149,2)');
    const cell = await getCellData(page, 0, 0);
    expect(cell.content).toBe('3.14');
  });

  // --- 非数值参数错误 ---
  test('数学函数接收非数值参数返回 #VALUE! 错误', async ({ page }) => {
    // 在 A1 输入文本
    await setCellValue(page, 0, 0, 'abc');

    // ROUNDUP 使用非数值参数
    await setFormula(page, 0, 1, '=ROUNDUP(A1,2)');
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.content).toContain('#VALUE!');

    // INT 使用非数值参数
    await setFormula(page, 0, 2, '=INT(A1)');
    const cellC1 = await getCellData(page, 0, 2);
    expect(cellC1.content).toContain('#VALUE!');

    // TRUNC 使用非数值参数
    await setFormula(page, 0, 3, '=TRUNC(A1)');
    const cellD1 = await getCellData(page, 0, 3);
    expect(cellD1.content).toContain('#VALUE!');
  });
});

// ============================================================
// 需求 5：内联编辑器公式自动补全
// ============================================================

test.describe('需求5：内联编辑器公式自动补全', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForSelector('.formula-bar');
    await page.waitForTimeout(500);
  });

  test('在单元格中输入 =SU 时显示自动补全候选列表', async ({ page }) => {
    // 双击 A1 进入编辑模式
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(200);

    // 内联编辑器使用 textarea
    const editor = page.locator('.inline-editor textarea');
    await editor.waitFor({ state: 'visible', timeout: 3000 });

    // 逐字输入 =SU 触发自动补全（需要逐字输入以触发 input 事件）
    await editor.press('=');
    await page.waitForTimeout(50);
    await editor.pressSequentially('SU', { delay: 100 });
    await page.waitForTimeout(200);

    // 等待自动补全下拉列表出现（InlineEditor 创建的 .autocomplete-dropdown）
    // 注意：页面上可能有两个 .autocomplete-dropdown（公式栏和内联编辑器各一个）
    // 内联编辑器的下拉列表是 body 直接子元素
    const dropdown = page.locator('body > .autocomplete-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // 候选列表应包含 SUM 相关函数
    const items = dropdown.locator('.autocomplete-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    // 至少有一个候选项包含 "SUM"
    const names = await dropdown.locator('.autocomplete-name').allTextContents();
    const hasSUM = names.some((name: string) => name.includes('SUM'));
    expect(hasSUM).toBe(true);

    // 按 Escape 关闭自动补全（不退出编辑模式）
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await expect(dropdown).toBeHidden();
  });

  test('Tab 键确认自动补全选中项', async ({ page }) => {
    // 双击 A1 进入编辑模式
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(200);

    const editor = page.locator('.inline-editor textarea');
    await editor.waitFor({ state: 'visible', timeout: 3000 });

    // 输入 =SU 触发自动补全
    await editor.press('=');
    await page.waitForTimeout(50);
    await editor.pressSequentially('SU', { delay: 100 });
    await page.waitForTimeout(200);

    // 等待下拉列表出现
    const dropdown = page.locator('body > .autocomplete-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    // 记录第一个候选项的名称
    const firstName = await dropdown.locator('.autocomplete-name').first().textContent();

    // 按 Tab 确认选中项
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // 下拉列表应关闭
    await expect(dropdown).toBeHidden({ timeout: 2000 });

    // 编辑器中应包含选中的函数名和左括号
    const value = await editor.inputValue();
    expect(value).toContain(`${firstName}(`);

    // 按 Escape 退出编辑模式
    await page.keyboard.press('Escape');
  });
});
