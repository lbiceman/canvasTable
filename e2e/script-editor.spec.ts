import { test, expect, Page } from '@playwright/test';

/**
 * 辅助函数：点击 Canvas 上指定单元格
 * headerWidth=40, headerHeight=28，默认列宽=100，默认行高=25
 */
const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;

  const x = headerWidth + col * defaultColWidth + defaultColWidth / 2;
  const y = headerHeight + row * defaultRowHeight + defaultRowHeight / 2;

  await canvas.click({ position: { x, y } });
};

/**
 * 辅助函数：通过 window.app 获取单元格内容
 */
const getCellContent = async (page: Page, row: number, col: number): Promise<string> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => { content?: string } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return cell?.content ?? '';
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：输入单元格内容
 */
const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await clickCell(page, row, col);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
};

/**
 * 辅助函数：打开脚本编辑器面板
 */
const openScriptEditor = async (page: Page): Promise<void> => {
  await page.locator('#script-editor-btn').click();
  await page.waitForTimeout(300);
  await expect(page.locator('.script-editor-panel')).toBeVisible();
};

/**
 * 辅助函数：在脚本编辑器中输入代码
 */
const typeScript = async (page: Page, code: string): Promise<void> => {
  const textarea = page.locator('.script-editor-textarea');
  await textarea.fill(code);
  await page.waitForTimeout(100);
};

/**
 * 辅助函数：点击运行按钮
 */
const clickRunButton = async (page: Page): Promise<void> => {
  const runBtn = page.locator('.script-editor-btn-primary');
  await runBtn.click();
  await page.waitForTimeout(500);
};

/**
 * 辅助函数：清除 localStorage 中的已保存脚本
 */
const clearSavedScripts = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    localStorage.removeItem('ice-excel-scripts');
  });
};

// ============================================================
// 测试：点击「脚本编辑器」按钮打开编辑器面板
// 需求: 2.1
// ============================================================
test.describe('脚本编辑器 - 打开面板', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('点击脚本编辑器按钮应打开编辑器面板', async ({ page }) => {
    // 点击脚本编辑器按钮
    await page.locator('#script-editor-btn').click();
    await page.waitForTimeout(300);

    // 验证面板可见
    const panel = page.locator('.script-editor-panel');
    await expect(panel).toBeVisible();

    // 验证面板包含标题
    const title = panel.locator('.script-editor-title');
    await expect(title).toContainText('脚本编辑器');

    // 验证面板包含代码编辑区域（textarea）
    const textarea = panel.locator('.script-editor-textarea');
    await expect(textarea).toBeVisible();

    // 验证面板包含运行按钮
    const runBtn = panel.locator('.script-editor-btn-primary');
    await expect(runBtn).toContainText('运行');

    // 验证面板包含输出区域
    const output = panel.locator('.script-editor-output');
    await expect(output).toBeVisible();
  });

  test('脚本编辑器面板截图对比', async ({ page }) => {
    await openScriptEditor(page);

    const panel = page.locator('.script-editor-panel');
    await expect(panel).toHaveScreenshot('script-editor-panel-opened.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

// ============================================================
// 测试：编写脚本并点击运行（验证单元格被修改）
// 需求: 2.2, 2.3
// ============================================================
test.describe('脚本编辑器 - 运行脚本修改单元格', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('编写脚本设置单元格值并运行，验证单元格被修改', async ({ page }) => {
    // 打开脚本编辑器
    await openScriptEditor(page);

    // 编写脚本：设置 A1 和 B1 的值
    const script = `setCellValue(0, 0, "Hello");
setCellValue(0, 1, "World");`;
    await typeScript(page, script);

    // 点击运行
    await clickRunButton(page);

    // 验证输出面板显示成功信息
    const output = page.locator('.script-editor-output');
    await expect(output).toContainText('成功');

    // 关闭编辑器面板
    const closeBtn = page.locator('.script-editor-close-btn');
    await closeBtn.click();
    await page.waitForTimeout(200);

    // 验证单元格内容已被修改
    const cellA1 = await getCellContent(page, 0, 0);
    expect(cellA1).toBe('Hello');

    const cellB1 = await getCellContent(page, 0, 1);
    expect(cellB1).toBe('World');
  });

  test('脚本运行后单元格变更截图对比', async ({ page }) => {
    await openScriptEditor(page);

    // 编写脚本：批量设置多个单元格
    const script = `setCellValue(0, 0, "姓名");
setCellValue(0, 1, "分数");
setCellValue(1, 0, "张三");
setCellValue(1, 1, "95");
setCellValue(2, 0, "李四");
setCellValue(2, 1, "88");`;
    await typeScript(page, script);
    await clickRunButton(page);

    // 关闭编辑器
    await page.locator('.script-editor-close-btn').click();
    await page.waitForTimeout(300);

    // 点击空白单元格取消选中
    await clickCell(page, 5, 5);
    await page.waitForTimeout(200);

    // 截图对比验证单元格已被脚本修改
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('script-editor-cells-modified.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

// ============================================================
// 测试：脚本语法错误时输出面板显示错误信息
// 需求: 2.4
// ============================================================
test.describe('脚本编辑器 - 语法错误显示', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('脚本语法错误时输出面板应显示错误信息', async ({ page }) => {
    await openScriptEditor(page);

    // 编写包含语法错误的脚本
    const badScript = `setCellValue(0, 0, "test"
// 缺少右括号，语法错误`;
    await typeScript(page, badScript);

    // 点击运行
    await clickRunButton(page);

    // 验证输出面板显示错误信息（包含 ❌ 标记）
    const output = page.locator('.script-editor-output');
    await expect(output).toContainText('错误');

    // 验证输出面板有错误样式
    await expect(output).toHaveClass(/script-editor-output-error/);
  });

  test('运行时错误也应在输出面板显示', async ({ page }) => {
    await openScriptEditor(page);

    // 编写会产生运行时错误的脚本
    const errorScript = `undefinedFunction();`;
    await typeScript(page, errorScript);

    await clickRunButton(page);

    // 验证输出面板显示错误
    const output = page.locator('.script-editor-output');
    await expect(output).toContainText('错误');
  });
});

// ============================================================
// 测试：脚本执行后可通过 Ctrl+Z 撤销所有修改
// 需求: 2.5
// ============================================================
test.describe('脚本编辑器 - 撤销脚本执行', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('脚本执行后 Ctrl+Z 应撤销所有修改', async ({ page }) => {
    // 先在 A1 输入初始内容
    await typeInCell(page, 0, 0, '原始值');

    // 打开脚本编辑器并运行脚本修改多个单元格
    await openScriptEditor(page);

    const script = `setCellValue(0, 0, "脚本修改A1");
setCellValue(0, 1, "脚本修改B1");
setCellValue(1, 0, "脚本修改A2");`;
    await typeScript(page, script);
    await clickRunButton(page);

    // 关闭编辑器
    await page.locator('.script-editor-close-btn').click();
    await page.waitForTimeout(200);

    // 验证单元格已被修改
    let cellA1 = await getCellContent(page, 0, 0);
    expect(cellA1).toBe('脚本修改A1');
    let cellB1 = await getCellContent(page, 0, 1);
    expect(cellB1).toBe('脚本修改B1');

    // 点击 Canvas 确保焦点在 Canvas 上
    await clickCell(page, 3, 3);
    await page.waitForTimeout(100);

    // 执行 Ctrl+Z 撤销
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    // 验证所有脚本修改已被撤销（A1 恢复为原始值，B1 和 A2 恢复为空）
    cellA1 = await getCellContent(page, 0, 0);
    expect(cellA1).toBe('原始值');

    cellB1 = await getCellContent(page, 0, 1);
    expect(cellB1).toBe('');

    const cellA2 = await getCellContent(page, 1, 0);
    expect(cellA2).toBe('');
  });
});

// ============================================================
// 测试：保存脚本到列表、加载已保存脚本
// 需求: 2.8
// ============================================================
test.describe('脚本编辑器 - 保存与加载脚本', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('保存脚本后应在已保存列表中显示', async ({ page }) => {
    await openScriptEditor(page);

    // 编写脚本
    const script = `setCellValue(0, 0, "测试保存");`;
    await typeScript(page, script);

    // 点击保存按钮（会弹出 prompt 对话框）
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        await dialog.accept('我的测试脚本');
      }
    });

    const saveBtn = page.locator('.script-editor-btn', { hasText: '保存' });
    await saveBtn.click();
    await page.waitForTimeout(300);

    // 验证输出面板显示保存成功
    const output = page.locator('.script-editor-output');
    await expect(output).toContainText('已保存');

    // 验证已保存脚本列表中包含该脚本
    const listItems = page.locator('.script-editor-list-item');
    await expect(listItems).toHaveCount(1);

    const itemName = listItems.first().locator('.script-editor-list-item-name');
    await expect(itemName).toContainText('我的测试脚本');
  });

  test('点击已保存脚本应加载到编辑器', async ({ page }) => {
    await openScriptEditor(page);

    // 先保存一个脚本
    const script = `setCellValue(0, 0, "加载测试");`;
    await typeScript(page, script);

    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        await dialog.accept('加载测试脚本');
      }
    });

    const saveBtn = page.locator('.script-editor-btn', { hasText: '保存' });
    await saveBtn.click();
    await page.waitForTimeout(300);

    // 清空编辑器
    const textarea = page.locator('.script-editor-textarea');
    await textarea.fill('');
    await page.waitForTimeout(100);

    // 点击已保存脚本名称加载
    const itemName = page.locator('.script-editor-list-item-name').first();
    await itemName.click();
    await page.waitForTimeout(200);

    // 验证编辑器中已加载脚本代码
    await expect(textarea).toHaveValue(script);

    // 验证输出面板显示加载成功
    const output = page.locator('.script-editor-output');
    await expect(output).toContainText('已加载');
  });
});

// ============================================================
// 测试：语法高亮（关键字/字符串/注释/数字不同颜色）
// 需求: 2.7
// ============================================================
test.describe('脚本编辑器 - 语法高亮', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('语法高亮应为关键字/字符串/注释/数字使用不同颜色', async ({ page }) => {
    await openScriptEditor(page);

    // 编写包含各种语法元素的代码
    const code = `// 这是注释
var count = 42;
var name = "hello";
if (true) {
  setCellValue(0, 0, name);
}`;
    await typeScript(page, code);
    await page.waitForTimeout(300);

    // 验证高亮层中存在不同类型的 span 元素
    const highlightPre = page.locator('.script-editor-highlight');

    // 验证关键字高亮（如 var, if, true）
    const keywordSpans = highlightPre.locator('.script-editor-keyword');
    expect(await keywordSpans.count()).toBeGreaterThan(0);

    // 验证字符串高亮（如 "hello"）
    const stringSpans = highlightPre.locator('.script-editor-string');
    expect(await stringSpans.count()).toBeGreaterThan(0);

    // 验证注释高亮（如 // 这是注释）
    const commentSpans = highlightPre.locator('.script-editor-comment');
    expect(await commentSpans.count()).toBeGreaterThan(0);

    // 验证数字高亮（如 42）
    const numberSpans = highlightPre.locator('.script-editor-number');
    expect(await numberSpans.count()).toBeGreaterThan(0);

    // 验证各类型 span 的颜色不同
    const keywordColor = await keywordSpans.first().evaluate(
      (el) => getComputedStyle(el).color
    );
    const stringColor = await stringSpans.first().evaluate(
      (el) => getComputedStyle(el).color
    );
    const commentColor = await commentSpans.first().evaluate(
      (el) => getComputedStyle(el).color
    );
    const numberColor = await numberSpans.first().evaluate(
      (el) => getComputedStyle(el).color
    );

    // 验证至少关键字和字符串颜色不同
    expect(keywordColor).not.toBe(stringColor);
    // 验证注释和数字颜色不同
    expect(commentColor).not.toBe(numberColor);
  });

  test('语法高亮截图对比', async ({ page }) => {
    await openScriptEditor(page);

    const code = `// 批量设置单元格
for (var i = 0; i < 5; i++) {
  setCellValue(i, 0, "行" + i);
  setCellValue(i, 1, 100);
}`;
    await typeScript(page, code);
    await page.waitForTimeout(300);

    // 截图对比语法高亮效果
    const panel = page.locator('.script-editor-panel');
    await expect(panel).toHaveScreenshot('script-editor-syntax-highlight.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
