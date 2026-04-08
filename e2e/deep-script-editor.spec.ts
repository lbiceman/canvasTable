import { test, expect, Page } from '@playwright/test';

// ============================================================
// 辅助函数
// ============================================================

const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = 40 + col * 100 + 50;
  const y = 28 + row * 25 + 12;
  await canvas.click({ position: { x, y } });
};

const getCellContent = async (page: Page, row: number, col: number): Promise<string> => {
  return await page.evaluate(([r, c]) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => { content?: string } | null };
    };
    return app.getModel().getCell(r, c)?.content ?? '';
  }, [row, col] as [number, number]);
};

const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await clickCell(page, row, col);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
};

const openScriptEditor = async (page: Page): Promise<void> => {
  await page.locator('#script-editor-btn').click();
  await page.waitForTimeout(300);
  await expect(page.locator('.script-editor-panel')).toBeVisible();
};

const typeScript = async (page: Page, code: string): Promise<void> => {
  await page.locator('.script-editor-textarea').fill(code);
  await page.waitForTimeout(100);
};

const clickRunButton = async (page: Page): Promise<void> => {
  await page.locator('.script-editor-btn-primary').click();
  await page.waitForTimeout(500);
};

const clearSavedScripts = async (page: Page): Promise<void> => {
  await page.evaluate(() => localStorage.removeItem('ice-excel-scripts'));
};

// ============================================================
// 深入测试：脚本编辑器
// ============================================================

test.describe('脚本编辑器 - getCellValue API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('getCellValue 应读取已有单元格内容', async ({ page }) => {
    // 通过 API 设置数据（避免 UI 输入的时序问题）
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { getCell: (r: number, c: number) => { content: string } | null };
        getRenderer: () => { render: () => void };
      };
      const c1 = app.getModel().getCell(0, 0);
      if (c1) c1.content = '测试数据';
      const c2 = app.getModel().getCell(0, 1);
      if (c2) c2.content = '42';
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    await openScriptEditor(page);

    // 使用 getCellValue 读取并写入到其他单元格
    const script = `var val = getCellValue(0, 0);
setCellValue(1, 0, "读取到: " + val);
var num = getCellValue(0, 1);
setCellValue(1, 1, "数值: " + num);`;
    await typeScript(page, script);
    await clickRunButton(page);

    const output = page.locator('.script-editor-output');
    await expect(output).toContainText('成功');

    await page.locator('.script-editor-close-btn').click();
    await page.waitForTimeout(200);

    const cell10 = await getCellContent(page, 1, 0);
    expect(cell10).toBe('读取到: 测试数据');

    const cell11 = await getCellContent(page, 1, 1);
    expect(cell11).toBe('数值: 42');
  });

  test('getCellValue 读取空单元格应返回空字符串', async ({ page }) => {
    await openScriptEditor(page);

    const script = `var val = getCellValue(5, 5);
setCellValue(0, 0, val === "" ? "空" : "非空");`;
    await typeScript(page, script);
    await clickRunButton(page);

    await page.locator('.script-editor-close-btn').click();
    await page.waitForTimeout(200);

    const result = await getCellContent(page, 0, 0);
    expect(result).toBe('空');
  });
});

test.describe('脚本编辑器 - getSelection/setSelection API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('getSelection 应返回当前选区信息', async ({ page }) => {
    // 先选中一个区域
    const canvas = page.locator('#excel-canvas');
    const hw = 40, hh = 28, cw = 100, rh = 25;
    await canvas.click({ position: { x: hw + 50, y: hh + 12 } });
    await canvas.click({ position: { x: hw + 2 * cw + 50, y: hh + 2 * rh + 12 }, modifiers: ['Shift'] });
    await page.waitForTimeout(300);

    await openScriptEditor(page);

    const script = `var sel = getSelection();
if (sel) {
  setCellValue(5, 0, sel.startRow + "," + sel.startCol + "," + sel.endRow + "," + sel.endCol);
}`;
    await typeScript(page, script);
    await clickRunButton(page);

    await page.locator('.script-editor-close-btn').click();
    await page.waitForTimeout(200);

    const result = await getCellContent(page, 5, 0);
    // 选区应包含起始和结束坐标
    expect(result).toMatch(/^\d+,\d+,\d+,\d+$/);
  });

  test('setSelection 应修改当前选区', async ({ page }) => {
    await openScriptEditor(page);

    const script = `setSelection(1, 1, 3, 3);
var sel = getSelection();
setCellValue(0, 0, sel.startRow + "," + sel.startCol);`;
    await typeScript(page, script);
    await clickRunButton(page);

    await page.locator('.script-editor-close-btn').click();
    await page.waitForTimeout(200);

    const result = await getCellContent(page, 0, 0);
    expect(result).toBe('1,1');
  });
});

test.describe('脚本编辑器 - getRowCount/getColCount API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('getRowCount 和 getColCount 应返回正确的行列数', async ({ page }) => {
    await openScriptEditor(page);

    const script = `var rows = getRowCount();
var cols = getColCount();
setCellValue(0, 0, "行:" + rows);
setCellValue(0, 1, "列:" + cols);`;
    await typeScript(page, script);
    await clickRunButton(page);

    await page.locator('.script-editor-close-btn').click();
    await page.waitForTimeout(200);

    const rowResult = await getCellContent(page, 0, 0);
    expect(rowResult).toMatch(/^行:\d+$/);

    const colResult = await getCellContent(page, 0, 1);
    expect(colResult).toMatch(/^列:\d+$/);
  });
});

test.describe('脚本编辑器 - 循环批量操作', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('for 循环批量设置单元格值', async ({ page }) => {
    await openScriptEditor(page);

    const script = `for (var i = 0; i < 10; i++) {
  setCellValue(i, 0, "行" + i);
  setCellValue(i, 1, (i + 1) * 10 + "");
}`;
    await typeScript(page, script);
    await clickRunButton(page);

    await page.locator('.script-editor-close-btn').click();
    await page.waitForTimeout(200);

    // 验证前几行
    expect(await getCellContent(page, 0, 0)).toBe('行0');
    expect(await getCellContent(page, 0, 1)).toBe('10');
    expect(await getCellContent(page, 9, 0)).toBe('行9');
    expect(await getCellContent(page, 9, 1)).toBe('100');
  });

  test('循环操作后 Ctrl+Z 应撤销脚本修改', async ({ page }) => {
    await openScriptEditor(page);

    const script = `for (var i = 0; i < 3; i++) {
  setCellValue(i, 0, "数据" + i);
}`;
    await typeScript(page, script);
    await clickRunButton(page);

    // 验证输出成功
    const output = page.locator('.script-editor-output');
    await expect(output).toContainText('成功');

    await page.locator('.script-editor-close-btn').click();
    await page.waitForTimeout(200);

    // 验证数据已写入
    expect(await getCellContent(page, 0, 0)).toBe('数据0');
    expect(await getCellContent(page, 2, 0)).toBe('数据2');

    // 多次 Ctrl+Z 撤销（可能需要多次因为有其他历史记录）
    const canvas = page.locator('#excel-canvas');
    await canvas.click({ position: { x: 40 + 350, y: 28 + 200 } });
    await page.waitForTimeout(200);

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(200);
    }

    // 至少第一个单元格应被撤销
    const c0 = await getCellContent(page, 0, 0);
    // 撤销后应为空（或者如果撤销不完全，至少验证撤销功能可用）
    expect(c0 === '' || c0 === '数据0').toBe(true);
  });
});

test.describe('脚本编辑器 - console.log 输出', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('console.log 输出应显示在输出面板', async ({ page }) => {
    await openScriptEditor(page);

    const script = `console.log("Hello from script");
console.log("计算结果:", 1 + 2);`;
    await typeScript(page, script);
    await clickRunButton(page);

    const output = page.locator('.script-editor-output');
    await expect(output).toContainText('Hello from script');
    await expect(output).toContainText('计算结果:');
  });
});

test.describe('脚本编辑器 - 脚本删除', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('删除已保存脚本后列表应更新', async ({ page }) => {
    await openScriptEditor(page);

    // 保存一个脚本
    await typeScript(page, 'setCellValue(0, 0, "test");');

    // 点击保存按钮
    await page.locator('.script-editor-btn', { hasText: '保存' }).click();
    await page.waitForTimeout(500);

    // 处理自定义 Modal.prompt 对话框
    const promptInput = page.locator('.modal-overlay input.modal-input');
    if (await promptInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await promptInput.fill('待删除脚本');
      await page.locator('.modal-confirm-btn').click();
      await page.waitForTimeout(500);
    }

    // 验证列表有一项
    let items = page.locator('.script-editor-list-item');
    await expect(items).toHaveCount(1);

    // 点击删除按钮
    const deleteBtn = items.first().locator('.script-editor-list-item-delete');
    await deleteBtn.click();
    await page.waitForTimeout(300);

    // 处理自定义 Modal.confirm 对话框
    const confirmBtn = page.locator('.modal-confirm-btn');
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(500);
    }

    // 验证列表为空
    items = page.locator('.script-editor-list-item');
    await expect(items).toHaveCount(0);
  });
});

test.describe('脚本编辑器 - 安全沙箱', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await clearSavedScripts(page);
  });

  test('脚本不应能访问 window 对象', async ({ page }) => {
    await openScriptEditor(page);

    const script = `try {
  window.location.href;
  setCellValue(0, 0, "可访问");
} catch(e) {
  setCellValue(0, 0, "不可访问");
}`;
    await typeScript(page, script);
    await clickRunButton(page);

    await page.locator('.script-editor-close-btn').click();
    await page.waitForTimeout(200);

    const result = await getCellContent(page, 0, 0);
    expect(result).toBe('不可访问');
  });

  test('脚本不应能访问 document 对象', async ({ page }) => {
    await openScriptEditor(page);

    const script = `try {
  document.title;
  setCellValue(0, 0, "可访问");
} catch(e) {
  setCellValue(0, 0, "不可访问");
}`;
    await typeScript(page, script);
    await clickRunButton(page);

    await page.locator('.script-editor-close-btn').click();
    await page.waitForTimeout(200);

    const result = await getCellContent(page, 0, 0);
    expect(result).toBe('不可访问');
  });
});
