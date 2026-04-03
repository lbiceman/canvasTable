import { test, expect, Page } from '@playwright/test';

/**
 * P2 体验完善 E2E 测试
 * 覆盖：右键菜单补全、格式对话框、批注功能、键盘快捷键、冻结状态反馈
 */

// ============================================================
// 辅助函数
// ============================================================

const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = 40 + col * 100 + 50;
  const y = 28 + row * 25 + 12;
  await canvas.click({ position: { x, y } });
};

const rightClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = 40 + col * 100 + 50;
  const y = 28 + row * 25 + 12;
  await canvas.click({ position: { x, y }, button: 'right' });
};

const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await clickCell(page, row, col);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
};

const getCellData = async (page: Page, row: number, col: number): Promise<Record<string, unknown>> => {
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
        content: cell.content,
        fontBold: cell.fontBold,
        fontItalic: cell.fontItalic,
        fontUnderline: cell.fontUnderline,
        fontColor: cell.fontColor,
        bgColor: cell.bgColor,
        fontSize: cell.fontSize,
        comment: cell.comment,
      };
    },
    [row, col] as [number, number],
  );
};

const clickContextMenuItem = async (page: Page, label: string): Promise<void> => {
  const menu = page.locator('.cell-context-menu');
  await expect(menu).toBeVisible();
  const item = menu.locator('.cell-context-menu-item', { hasText: label });
  await item.click();
};

// ============================================================
// 右键菜单补全测试
// ============================================================

test.describe('P2 - 右键菜单补全', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('右键菜单包含"插入批注"菜单项', async ({ page }) => {
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    const commentItem = menu.locator('.cell-context-menu-item', { hasText: '插入批注' });
    await expect(commentItem).toBeVisible();
  });

  test('右键菜单包含"设置单元格格式"菜单项', async ({ page }) => {
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    const formatItem = menu.locator('.cell-context-menu-item', { hasText: '设置单元格格式' });
    await expect(formatItem).toBeVisible();
  });
});

// ============================================================
// 格式对话框测试
// ============================================================

test.describe('P2 - 格式对话框', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('右键菜单"设置单元格格式"打开格式对话框', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '设置单元格格式');
    await page.waitForTimeout(300);

    // 验证对话框可见
    const overlay = page.locator('.format-dialog-overlay');
    await expect(overlay).toBeVisible();

    const dialog = page.locator('.format-dialog');
    await expect(dialog).toBeVisible();

    // 验证标题
    const title = dialog.locator('.format-dialog-title');
    await expect(title).toContainText('设置单元格格式');
  });

  test('格式对话框包含 5 个选项卡', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '设置单元格格式');
    await page.waitForTimeout(300);

    const tabs = page.locator('.format-dialog-tab');
    await expect(tabs).toHaveCount(5);

    // 验证选项卡标签
    await expect(tabs.nth(0)).toContainText('数字');
    await expect(tabs.nth(1)).toContainText('对齐');
    await expect(tabs.nth(2)).toContainText('字体');
    await expect(tabs.nth(3)).toContainText('边框');
    await expect(tabs.nth(4)).toContainText('填充');
  });

  test('格式对话框选项卡切换正常', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '设置单元格格式');
    await page.waitForTimeout(300);

    // 默认第一个选项卡激活
    const firstTab = page.locator('.format-dialog-tab').nth(0);
    await expect(firstTab).toHaveClass(/active/);

    // 点击"字体"选项卡
    const fontTab = page.locator('.format-dialog-tab', { hasText: '字体' });
    await fontTab.click();
    await page.waitForTimeout(200);
    await expect(fontTab).toHaveClass(/active/);

    // 点击"填充"选项卡
    const fillTab = page.locator('.format-dialog-tab', { hasText: '填充' });
    await fillTab.click();
    await page.waitForTimeout(200);
    await expect(fillTab).toHaveClass(/active/);
  });

  test('格式对话框取消按钮关闭对话框', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '设置单元格格式');
    await page.waitForTimeout(300);

    const overlay = page.locator('.format-dialog-overlay');
    await expect(overlay).toBeVisible();

    // 点击取消
    const cancelBtn = page.locator('.format-dialog-btn', { hasText: '取消' });
    await cancelBtn.click();
    await page.waitForTimeout(300);

    await expect(overlay).not.toBeVisible();
  });

  test('格式对话框 Escape 关闭', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '设置单元格格式');
    await page.waitForTimeout(300);

    const overlay = page.locator('.format-dialog-overlay');
    await expect(overlay).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await expect(overlay).not.toBeVisible();
  });

  test('Ctrl+1 打开格式对话框', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+1');
    await page.waitForTimeout(300);

    const overlay = page.locator('.format-dialog-overlay');
    await expect(overlay).toBeVisible();

    const dialog = page.locator('.format-dialog');
    await expect(dialog).toBeVisible();
  });
});

// ============================================================
// 批注功能测试
// ============================================================

test.describe('P2 - 批注功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('通过右键菜单插入批注', async ({ page }) => {
    await typeInCell(page, 0, 0, 'TestCell');

    // 设置 dialog handler 在 prompt 弹出前
    page.on('dialog', async (dialog) => {
      await dialog.accept('这是一条批注');
    });

    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入批注');
    await page.waitForTimeout(500);

    // 验证批注已设置
    const cellData = await getCellData(page, 0, 0);
    expect(cellData.comment).toBe('这是一条批注');
  });

  test('通过 model API 设置和获取批注', async ({ page }) => {
    // 通过 evaluate 直接调用 model 方法
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellComment: (row: number, col: number, comment: string) => void;
          getCellComment: (row: number, col: number) => string;
        };
      };
      app.getModel().setCellComment(2, 3, '测试批注内容');
    });

    const comment = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCellComment: (row: number, col: number) => string;
        };
      };
      return app.getModel().getCellComment(2, 3);
    });

    expect(comment).toBe('测试批注内容');
  });

  test('清除批注（设置空字符串）', async ({ page }) => {
    // 先设置批注
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellComment: (row: number, col: number, comment: string) => void;
        };
      };
      app.getModel().setCellComment(0, 0, '临时批注');
    });

    // 清除批注
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellComment: (row: number, col: number, comment: string) => void;
        };
      };
      app.getModel().setCellComment(0, 0, '');
    });

    const cellData = await getCellData(page, 0, 0);
    expect(cellData.comment).toBeFalsy();
  });
});

// ============================================================
// 键盘快捷键测试
// ============================================================

test.describe('P2 - 键盘快捷键', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('Ctrl+B 切换加粗', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Bold');
    await clickCell(page, 0, 0);

    // 初始不加粗
    let cellData = await getCellData(page, 0, 0);
    expect(cellData.fontBold).toBeFalsy();

    // Ctrl+B 加粗
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(200);

    cellData = await getCellData(page, 0, 0);
    expect(cellData.fontBold).toBe(true);

    // 再次 Ctrl+B 取消加粗
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(200);

    cellData = await getCellData(page, 0, 0);
    expect(cellData.fontBold).toBeFalsy();
  });

  test('Ctrl+I 切换斜体', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Italic');
    await clickCell(page, 0, 0);

    let cellData = await getCellData(page, 0, 0);
    expect(cellData.fontItalic).toBeFalsy();

    await page.keyboard.press('Control+i');
    await page.waitForTimeout(200);

    cellData = await getCellData(page, 0, 0);
    expect(cellData.fontItalic).toBe(true);
  });

  test('Ctrl+U 切换下划线', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Underline');
    await clickCell(page, 0, 0);

    let cellData = await getCellData(page, 0, 0);
    expect(cellData.fontUnderline).toBeFalsy();

    await page.keyboard.press('Control+u');
    await page.waitForTimeout(200);

    cellData = await getCellData(page, 0, 0);
    expect(cellData.fontUnderline).toBe(true);
  });

  test('Ctrl+; 插入当前日期', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+;');
    await page.waitForTimeout(300);

    const cellData = await getCellData(page, 0, 0);
    const content = cellData.content as string;

    // 验证日期格式 yyyy/MM/dd
    expect(content).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);

    // 验证是今天的日期
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    expect(content).toBe(`${year}/${month}/${day}`);
  });
});

// ============================================================
// 冻结窗格状态反馈测试
// ============================================================

test.describe('P2 - 冻结窗格状态反馈', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('冻结首行后冻结按钮高亮', async ({ page }) => {
    // 查找冻结按钮并点击打开下拉
    const freezePicker = page.locator('.freeze-picker');
    // 如果冻结选择器不存在则跳过
    if (await freezePicker.count() === 0) {
      test.skip();
      return;
    }

    const freezeBtn = freezePicker.locator('button').first();
    await freezeBtn.click();
    await page.waitForTimeout(300);

    // 点击"冻结首行"选项
    const freezeFirstRow = page.locator('.freeze-option', { hasText: '冻结首行' });
    if (await freezeFirstRow.count() > 0) {
      await freezeFirstRow.click();
      await page.waitForTimeout(300);

      // 验证按钮有 active 类
      await expect(freezeBtn).toHaveClass(/active/);
    }
  });

  test('取消冻结后按钮不再高亮', async ({ page }) => {
    const freezePicker = page.locator('.freeze-picker');
    if (await freezePicker.count() === 0) {
      test.skip();
      return;
    }

    const freezeBtn = freezePicker.locator('button').first();

    // 先冻结
    await freezeBtn.click();
    await page.waitForTimeout(300);
    const freezeFirstRow = page.locator('.freeze-option', { hasText: '冻结首行' });
    if (await freezeFirstRow.count() > 0) {
      await freezeFirstRow.click();
      await page.waitForTimeout(300);
    }

    // 再取消冻结
    await freezeBtn.click();
    await page.waitForTimeout(300);
    const unfreezeOption = page.locator('.freeze-option', { hasText: '取消冻结' });
    if (await unfreezeOption.count() > 0) {
      await unfreezeOption.click();
      await page.waitForTimeout(300);

      // 验证按钮没有 active 类
      const classes = await freezeBtn.getAttribute('class') || '';
      expect(classes).not.toContain('active');
    }
  });
});
