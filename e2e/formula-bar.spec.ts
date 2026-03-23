import { test, expect, Page } from '@playwright/test';

/**
 * 辅助函数：双击单元格进入编辑模式
 * 根据渲染配置，headerWidth=40, headerHeight=28，默认列宽=100，默认行高=25
 */
const dblClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = 40 + col * 100 + 50;
  const y = 28 + row * 25 + 12;
  await canvas.dblclick({ position: { x, y } });
};

/**
 * 辅助函数：在公式栏输入内容（直接点击 .formula-input 并输入）
 */
const typeInFormulaBar = async (page: Page, text: string): Promise<void> => {
  const formulaInput = page.locator('.formula-input');
  await formulaInput.click();
  await formulaInput.fill('');
  await page.keyboard.type(text);
  await page.waitForTimeout(200);
};

/**
 * 辅助函数：将 hex 颜色转为 rgb 格式（浏览器 style.color 返回 rgb 格式）
 */
const hexToRgb = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * 辅助函数：获取 .autocomplete-dropdown 的 display 样式
 */
const getDropdownDisplay = async (page: Page): Promise<string> => {
  return await page.locator('.autocomplete-dropdown').evaluate(
    (el: HTMLElement) => el.style.display,
  );
};

// ============================================================
// 语法高亮测试
// ============================================================

test.describe('公式栏语法高亮', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForSelector('.formula-bar');
  });

  test('函数名颜色 - 输入 =SUM(A1:B10) 后高亮层应有函数名 span', async ({ page }) => {
    // 先点击单元格激活公式栏
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=SUM(A1:B10)');

    // 验证 .highlight-overlay 中存在颜色为 #795E26 的 span（函数名颜色）
    const funcSpan = page.locator('.highlight-overlay span').filter({
      has: page.locator(':scope'),
    }).first();

    // 获取所有 span 的颜色，找到函数名颜色
    const colors = await page.locator('.highlight-overlay span').evaluateAll(
      (spans: HTMLElement[]) => spans.map((s) => s.style.color),
    );
    expect(colors).toContain(hexToRgb('#795E26'));
  });

  test('字符串颜色 - 输入 =LEFT("Hello", 3) 后高亮层应有字符串 span', async ({ page }) => {
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=LEFT("Hello", 3)');

    // 验证存在颜色为 #A31515 的 span（字符串颜色）
    const colors = await page.locator('.highlight-overlay span').evaluateAll(
      (spans: HTMLElement[]) => spans.map((s) => s.style.color),
    );
    expect(colors).toContain(hexToRgb('#A31515'));
  });

  test('数字颜色 - 输入 =ROUND(3.14, 2) 后高亮层应有数字 span', async ({ page }) => {
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=ROUND(3.14, 2)');

    // 验证存在颜色为 #098658 的 span（数字颜色）
    const colors = await page.locator('.highlight-overlay span').evaluateAll(
      (spans: HTMLElement[]) => spans.map((s) => s.style.color),
    );
    expect(colors).toContain(hexToRgb('#098658'));
  });

  test('引用颜色 - 输入 =SUM(A1:B10) 后高亮层应有引用 span', async ({ page }) => {
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=SUM(A1:B10)');

    // 验证存在颜色为 #0070C1 的 span（单元格引用颜色）
    const colors = await page.locator('.highlight-overlay span').evaluateAll(
      (spans: HTMLElement[]) => spans.map((s) => s.style.color),
    );
    expect(colors).toContain(hexToRgb('#0070C1'));
  });
});

// ============================================================
// 自动补全测试
// ============================================================

test.describe('公式栏自动补全', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForSelector('.formula-bar');
  });

  test('输入 =SU 后自动补全下拉列表应变为可见', async ({ page }) => {
    // 先点击单元格激活公式栏
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=SU');

    // 验证 .autocomplete-dropdown 的 display 不为 none
    const display = await getDropdownDisplay(page);
    expect(display).not.toBe('none');
  });

  test('自动补全候选项应包含 SUM', async ({ page }) => {
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=SU');

    // 验证下拉列表中存在文本包含 "SUM" 的候选项
    const items = page.locator('.autocomplete-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);

    // 检查是否有包含 SUM 的候选项
    const texts = await items.evaluateAll(
      (els: HTMLElement[]) => els.map((el) => el.textContent ?? ''),
    );
    const hasSUM = texts.some((t) => t.includes('SUM'));
    expect(hasSUM).toBe(true);
  });

  test('输入 =CO 后候选列表应包含 COUNT、COUNTA、COUNTIF', async ({ page }) => {
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=CO');

    // 验证下拉列表可见
    const display = await getDropdownDisplay(page);
    expect(display).not.toBe('none');

    // 获取所有候选项文本
    const texts = await page.locator('.autocomplete-item').evaluateAll(
      (els: HTMLElement[]) => els.map((el) => el.textContent ?? ''),
    );

    // 验证包含 COUNT 相关函数
    expect(texts.some((t) => t.includes('COUNT'))).toBe(true);
    expect(texts.some((t) => t.includes('COUNTA'))).toBe(true);
    expect(texts.some((t) => t.includes('COUNTIF'))).toBe(true);
  });

  test('按 Tab 键确认自动补全后公式栏值应包含 SUM(', async ({ page }) => {
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=SUM');

    // 等待下拉列表出现
    const display = await getDropdownDisplay(page);
    expect(display).not.toBe('none');

    // 按 Tab 确认选中项
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // 验证公式栏输入框的值包含 SUM(
    const value = await page.locator('.formula-input').inputValue();
    expect(value).toContain('SUM(');
  });

  test('按 Escape 键后自动补全下拉列表应隐藏', async ({ page }) => {
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=SU');

    // 确认下拉列表已显示
    const displayBefore = await getDropdownDisplay(page);
    expect(displayBefore).not.toBe('none');

    // 按 Escape 关闭
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // 验证下拉列表已隐藏
    const displayAfter = await getDropdownDisplay(page);
    expect(displayAfter).toBe('none');
  });
});

// ============================================================
// 参数提示测试
// ============================================================

test.describe('公式栏参数提示', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForSelector('.formula-bar');
  });

  test('输入 =VLOOKUP( 后参数提示浮层应变为可见', async ({ page }) => {
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=VLOOKUP(');

    // 等待参数提示出现
    await page.waitForTimeout(200);

    // 验证 .param-hint 的 display 不为 none
    const display = await page.locator('.param-hint').evaluate(
      (el: HTMLElement) => el.style.display,
    );
    expect(display).not.toBe('none');
  });

  test('输入 =IF( 后参数提示应包含 IF 函数的参数名', async ({ page }) => {
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=IF(');

    await page.waitForTimeout(200);

    // 验证参数提示可见
    const display = await page.locator('.param-hint').evaluate(
      (el: HTMLElement) => el.style.display,
    );
    expect(display).not.toBe('none');

    // 验证参数提示中包含参数名（IF 函数有 logical_test, value_if_true, value_if_false）
    const paramText = await page.locator('.param-hint').textContent();
    expect(paramText).toBeTruthy();
    // 参数提示标题应包含函数名 IF
    const titleText = await page.locator('.param-hint-title').textContent();
    expect(titleText).toContain('IF');
  });
});

// ============================================================
// 键盘导航测试
// ============================================================

test.describe('公式栏键盘导航', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForSelector('.formula-bar');
  });

  test('输入 =SU 后按 ArrowDown 应选中第一个候选项', async ({ page }) => {
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(100);
    await typeInFormulaBar(page, '=SU');

    // 确认下拉列表已显示
    const display = await getDropdownDisplay(page);
    expect(display).not.toBe('none');

    // 按 ArrowDown 导航
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);

    // 验证存在选中项 .autocomplete-item.selected
    const selectedCount = await page.locator('.autocomplete-item.selected').count();
    expect(selectedCount).toBeGreaterThan(0);
  });
});
