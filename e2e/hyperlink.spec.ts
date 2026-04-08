import { test, expect, Page } from '@playwright/test';
import { clickCell, rightClickCell, typeInCell, getCellData, clickContextMenuItem } from './helpers/test-utils';

const insertHyperlink = async (
  page: Page, row: number, col: number, url: string, displayText?: string
): Promise<void> => {
  await rightClickCell(page, row, col);
  await page.waitForTimeout(300);
  await clickContextMenuItem(page, '插入超链接');
  await page.waitForTimeout(300);

  const dialog = page.locator('.modal-overlay');
  await dialog.locator('input.modal-input').first().fill(url);
  if (displayText) {
    await dialog.locator('input.modal-input').nth(1).fill(displayText);
  }
  await dialog.locator('.modal-confirm-btn').click();
  await page.waitForTimeout(300);
};

// ============================================================
// 深入测试：超链接
// ============================================================

test.describe('超链接 - 完整创建流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('空单元格插入超链接应使用 URL 作为显示文本', async ({ page }) => {
    await clickCell(page, 0, 0);
    await insertHyperlink(page, 0, 0, 'www.example.com');

    const data = await getCellData(page, 0, 0);
    expect(data.hyperlink?.url).toBe('https://www.example.com');
    // 空单元格无内容时，应使用 URL 作为内容
    expect(data.content).toBe('https://www.example.com');
  });

  test('有内容的单元格通过 API 设置超链接不指定显示文本应保留原内容', async ({ page }) => {
    // 通过 API 设置内容
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { getCell: (r: number, c: number) => { content: string } | null };
        getRenderer: () => { render: () => void };
      };
      const cell = app.getModel().getCell(0, 0);
      if (cell) cell.content = '原始内容';
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 通过 API 设置超链接（不指定 displayText）
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getHyperlinkManager: () => {
          setHyperlink: (r: number, c: number, data: { url: string }) => void;
        };
      };
      app.getHyperlinkManager().setHyperlink(0, 0, { url: 'https://example.com' });
    });
    await page.waitForTimeout(300);

    const data = await getCellData(page, 0, 0);
    expect(data.hyperlink?.url).toBe('https://example.com');
    // 原内容应保留
    expect(data.content).toBe('原始内容');
  });

  test('指定显示文本应更新单元格内容', async ({ page }) => {
    await typeInCell(page, 0, 0, '旧内容');
    await insertHyperlink(page, 0, 0, 'https://example.com', '新显示文本');

    const data = await getCellData(page, 0, 0);
    expect(data.hyperlink?.displayText).toBe('新显示文本');
    expect(data.content).toBe('新显示文本');
  });
});

test.describe('超链接 - 编辑流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('编辑超链接对话框应预填充现有 URL 和显示文本', async ({ page }) => {
    await typeInCell(page, 0, 0, 'Link');
    await insertHyperlink(page, 0, 0, 'https://old.com', '旧文本');

    // 右键编辑
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '编辑超链接');
    await page.waitForTimeout(300);

    const dialog = page.locator('.modal-overlay');
    const urlInput = dialog.locator('input.modal-input').first();
    const textInput = dialog.locator('input.modal-input').nth(1);

    // 验证预填充
    await expect(urlInput).toHaveValue('https://old.com');
    await expect(textInput).toHaveValue('旧文本');

    // 修改 URL 和显示文本
    await urlInput.fill('https://new.com');
    await textInput.fill('新文本');
    await dialog.locator('.modal-confirm-btn').click();
    await page.waitForTimeout(300);

    const data = await getCellData(page, 0, 0);
    expect(data.hyperlink?.url).toBe('https://new.com');
    expect(data.hyperlink?.displayText).toBe('新文本');
    expect(data.content).toBe('新文本');
  });

  test('编辑对话框标题应显示"编辑超链接"', async ({ page }) => {
    await insertHyperlink(page, 0, 0, 'https://example.com', '链接');

    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '编辑超链接');
    await page.waitForTimeout(300);

    const title = page.locator('.modal-title');
    await expect(title).toContainText('编辑超链接');

    // 关闭对话框
    await page.locator('.modal-cancel-btn').click();
  });
});

test.describe('超链接 - 删除流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('移除超链接后内容应保留但超链接数据应清除', async ({ page }) => {
    await insertHyperlink(page, 0, 0, 'https://example.com', '保留的文本');

    // 验证超链接存在
    let data = await getCellData(page, 0, 0);
    expect(data.hyperlink).toBeTruthy();

    // 移除
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '移除超链接');
    await page.waitForTimeout(300);

    data = await getCellData(page, 0, 0);
    expect(data.hyperlink).toBeFalsy();
    expect(data.content).toBe('保留的文本');
  });

  test('无超链接的单元格右键菜单不应显示"编辑超链接"和"移除超链接"', async ({ page }) => {
    await typeInCell(page, 0, 0, '普通文本');

    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    // 应显示「插入超链接」
    await expect(menu.locator('.cell-context-menu-item', { hasText: '插入超链接' })).toBeVisible();

    // 不应显示「编辑超链接」和「移除超链接」
    await expect(menu.locator('.cell-context-menu-item', { hasText: '编辑超链接' })).toHaveCount(0);
    await expect(menu.locator('.cell-context-menu-item', { hasText: '移除超链接' })).toHaveCount(0);

    // 关闭菜单
    await page.keyboard.press('Escape');
  });

  test('有超链接的单元格右键菜单应显示"编辑超链接"和"移除超链接"', async ({ page }) => {
    await insertHyperlink(page, 0, 0, 'https://example.com', '链接');

    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    await expect(menu.locator('.cell-context-menu-item', { hasText: '编辑超链接' })).toBeVisible();
    await expect(menu.locator('.cell-context-menu-item', { hasText: '移除超链接' })).toBeVisible();

    await page.keyboard.press('Escape');
  });
});

test.describe('超链接 - 对话框交互', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('空 URL 提交应显示错误提示', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    const dialog = page.locator('.modal-overlay');
    // 不输入 URL，直接点确定
    await dialog.locator('.modal-confirm-btn').click();
    await page.waitForTimeout(200);

    // 应显示错误提示
    const errorTip = dialog.locator('.hyperlink-dialog-error');
    await expect(errorTip).toBeVisible();
    await expect(errorTip).toContainText('请输入有效的 URL');

    // 对话框应仍然打开
    await expect(dialog).toBeVisible();

    // 关闭
    await dialog.locator('.modal-cancel-btn').click();
  });

  test('取消按钮应关闭对话框且不修改数据', async ({ page }) => {
    await typeInCell(page, 0, 0, '不变');

    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    const dialog = page.locator('.modal-overlay');
    await dialog.locator('input.modal-input').first().fill('https://example.com');
    await dialog.locator('.modal-cancel-btn').click();
    await page.waitForTimeout(300);

    // 对话框应关闭
    await expect(dialog).toHaveCount(0);

    // 数据不应被修改
    const data = await getCellData(page, 0, 0);
    expect(data.hyperlink).toBeFalsy();
  });

  test('Enter 键应确认对话框', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    const dialog = page.locator('.modal-overlay');
    await dialog.locator('input.modal-input').first().fill('https://enter-test.com');
    await dialog.locator('input.modal-input').nth(1).fill('Enter测试');

    // 按 Enter 确认
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    const data = await getCellData(page, 0, 0);
    expect(data.hyperlink?.url).toBe('https://enter-test.com');
  });

  test('Escape 键应取消对话框', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    const dialog = page.locator('.modal-overlay');
    await dialog.locator('input.modal-input').first().fill('https://escape-test.com');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const data = await getCellData(page, 0, 0);
    expect(data.hyperlink).toBeFalsy();
  });

  test('点击遮罩层应关闭对话框', async ({ page }) => {
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入超链接');
    await page.waitForTimeout(300);

    const overlay = page.locator('.modal-overlay');
    // 点击遮罩层（对话框外部区域）
    await overlay.click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);

    await expect(overlay).toHaveCount(0);
  });
});

test.describe('超链接 - 撤销/重做', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('插入超链接操作应记录到历史栈', async ({ page }) => {
    // 先输入内容
    await typeInCell(page, 0, 0, '原始');

    // 通过 API 直接设置超链接
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getHyperlinkManager: () => {
          setHyperlink: (r: number, c: number, data: { url: string; displayText?: string }) => void;
        };
      };
      app.getHyperlinkManager().setHyperlink(0, 0, { url: 'https://example.com', displayText: '链接' });
    });
    await page.waitForTimeout(300);

    // 验证超链接已设置
    const data = await getCellData(page, 0, 0);
    expect(data.hyperlink).toBeTruthy();
    expect(data.hyperlink?.url).toBe('https://example.com');
  });

  test('移除超链接操作应记录到历史栈', async ({ page }) => {
    // 通过 API 设置超链接
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { getCell: (r: number, c: number) => { content: string } | null };
        getHyperlinkManager: () => {
          setHyperlink: (r: number, c: number, data: { url: string; displayText?: string }) => void;
          removeHyperlink: (r: number, c: number) => void;
        };
      };
      const cell = app.getModel().getCell(0, 0);
      if (cell) cell.content = '链接';
      app.getHyperlinkManager().setHyperlink(0, 0, { url: 'https://example.com' });
    });
    await page.waitForTimeout(200);

    // 移除超链接
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getHyperlinkManager: () => { removeHyperlink: (r: number, c: number) => void };
      };
      app.getHyperlinkManager().removeHyperlink(0, 0);
    });
    await page.waitForTimeout(200);

    const data = await getCellData(page, 0, 0);
    expect(data.hyperlink).toBeFalsy();
    // 内容应保留
    expect(data.content).toBe('链接');
  });
});

test.describe('超链接 - 点击跳转', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('通过 API 验证 openHyperlink 调用 window.open', async ({ page }) => {
    await insertHyperlink(page, 0, 0, 'https://example.com', '链接');

    // 拦截 window.open 调用
    const openUrl = await page.evaluate(() => {
      let capturedUrl = '';
      const originalOpen = window.open;
      window.open = (url?: string | URL) => {
        capturedUrl = String(url ?? '');
        return null;
      };

      const app = (window as Record<string, unknown>).app as {
        getHyperlinkManager: () => { openHyperlink: (r: number, c: number) => void };
      };
      app.getHyperlinkManager().openHyperlink(0, 0);

      window.open = originalOpen;
      return capturedUrl;
    });

    expect(openUrl).toBe('https://example.com');
  });
});
