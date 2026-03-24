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
 * 辅助函数：右键点击 Canvas 上指定单元格
 */
const rightClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;

  const x = headerWidth + col * defaultColWidth + defaultColWidth / 2;
  const y = headerHeight + row * defaultRowHeight + defaultRowHeight / 2;

  await canvas.click({ position: { x, y }, button: 'right' });
};

/**
 * 辅助函数：点击右键菜单中的指定菜单项
 */
const clickContextMenuItem = async (page: Page, label: string): Promise<void> => {
  const menu = page.locator('.cell-context-menu');
  await expect(menu).toBeVisible();
  const item = menu.locator('.cell-context-menu-item', { hasText: label });
  await item.click();
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
 * 辅助函数：通过 window.app 获取单元格数据
 */
const getCellData = async (page: Page, row: number, col: number): Promise<{
  content?: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontColor?: string;
  bgColor?: string;
  fontSize?: number;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            content?: string;
            fontBold?: boolean;
            fontItalic?: boolean;
            fontColor?: string;
            bgColor?: string;
            fontSize?: number;
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return {
        content: cell?.content,
        fontBold: cell?.fontBold,
        fontItalic: cell?.fontItalic,
        fontColor: cell?.fontColor,
        bgColor: cell?.bgColor,
        fontSize: cell?.fontSize,
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：通过 evaluate 设置单元格格式
 */
const setCellFormat = async (
  page: Page,
  row: number,
  col: number,
  format: {
    fontBold?: boolean;
    fontColor?: string;
    bgColor?: string;
    fontSize?: number;
    fontItalic?: boolean;
  },
): Promise<void> => {
  await page.evaluate(
    ([r, c, fmt]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            fontBold?: boolean;
            fontColor?: string;
            bgColor?: string;
            fontSize?: number;
            fontItalic?: boolean;
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (cell) {
        if (fmt.fontBold !== undefined) cell.fontBold = fmt.fontBold;
        if (fmt.fontColor !== undefined) cell.fontColor = fmt.fontColor;
        if (fmt.bgColor !== undefined) cell.bgColor = fmt.bgColor;
        if (fmt.fontSize !== undefined) cell.fontSize = fmt.fontSize;
        if (fmt.fontItalic !== undefined) cell.fontItalic = fmt.fontItalic;
      }
    },
    [row, col, format] as [number, number, typeof format],
  );
};

/**
 * 辅助函数：获取模型行数
 */
const getRowCount = async (page: Page): Promise<number> => {
  return await page.evaluate(() => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getRowCount: () => number };
    };
    return app.getModel().getRowCount();
  });
};

/**
 * 辅助函数：获取模型列数
 */
const getColCount = async (page: Page): Promise<number> => {
  return await page.evaluate(() => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getColCount: () => number };
    };
    return app.getModel().getColCount();
  });
};

/**
 * 辅助函数：获取格式刷当前模式
 */
const getFormatPainterMode = async (page: Page): Promise<string> => {
  return await page.evaluate(() => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getFormatPainter: () => { getMode: () => string };
    };
    return app.getFormatPainter().getMode();
  });
};

// ============================================================
// 测试：右键菜单增强 E2E 测试
// 需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14
// ============================================================

test.describe('右键菜单 - 完整菜单项显示', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 7.1: 右键点击单元格弹出完整菜单（包含所有菜单项）
  test('右键点击单元格弹出完整菜单，包含所有菜单项', async ({ page }) => {
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    // 验证所有菜单项存在
    const expectedItems = [
      '剪切', '复制', '粘贴', '选择性粘贴',
      '插入超链接',
      '插入行（上方）', '插入行（下方）',
      '插入列（左侧）', '插入列（右侧）',
      '删除行', '删除列',
      '格式刷', '清除格式',
      '排序', '筛选',
    ];

    for (const label of expectedItems) {
      const item = menu.locator('.cell-context-menu-item', { hasText: label });
      await expect(item).toBeVisible();
    }

    // 验证分隔线存在
    const separators = menu.locator('.cell-context-menu-separator');
    expect(await separators.count()).toBeGreaterThanOrEqual(4);

    // 截图对比
    await expect(menu).toHaveScreenshot('context-menu-full.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('右键菜单 - 剪切/复制/粘贴功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 7.2: 剪切菜单项功能
  test('剪切菜单项执行剪切操作', async ({ page }) => {
    // 在 A1 输入内容
    await typeInCell(page, 0, 0, 'CutTest');

    // 选中 A1，右键 → 剪切
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '剪切');
    await page.waitForTimeout(300);

    // 选中 B2，右键 → 粘贴
    await clickCell(page, 1, 1);
    await rightClickCell(page, 1, 1);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '粘贴');
    await page.waitForTimeout(300);

    // 验证 B2 有内容
    const cellB2 = await getCellData(page, 1, 1);
    expect(cellB2.content).toBe('CutTest');

    // 验证 A1 内容被清除（剪切后粘贴应清除原位置）
    const cellA1 = await getCellData(page, 0, 0);
    expect(cellA1.content).toBeFalsy();
  });

  // 需求 7.3: 复制菜单项功能
  test('复制菜单项执行复制操作', async ({ page }) => {
    // 在 A1 输入内容
    await typeInCell(page, 0, 0, 'CopyTest');

    // 选中 A1，右键 → 复制
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '复制');
    await page.waitForTimeout(300);

    // 选中 B2，右键 → 粘贴
    await clickCell(page, 1, 1);
    await rightClickCell(page, 1, 1);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '粘贴');
    await page.waitForTimeout(300);

    // 验证 B2 有内容
    const cellB2 = await getCellData(page, 1, 1);
    expect(cellB2.content).toBe('CopyTest');

    // 验证 A1 内容保留（复制不清除原位置）
    const cellA1 = await getCellData(page, 0, 0);
    expect(cellA1.content).toBe('CopyTest');
  });
});

test.describe('右键菜单 - 剪贴板为空时粘贴禁用', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 7.6: 剪贴板为空时粘贴和选择性粘贴显示为禁用状态
  test('剪贴板为空时粘贴和选择性粘贴菜单项显示为禁用状态', async ({ page }) => {
    // 直接右键（未执行任何复制/剪切操作，剪贴板为空）
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    // 验证粘贴菜单项有 disabled 类
    const pasteItem = menu.locator('.cell-context-menu-item', { hasText: '粘贴' }).first();
    await expect(pasteItem).toHaveClass(/cell-context-menu-item-disabled/);

    // 验证选择性粘贴菜单项有 disabled 类
    const pasteSpecialItem = menu.locator('.cell-context-menu-item', { hasText: '选择性粘贴' });
    await expect(pasteSpecialItem).toHaveClass(/cell-context-menu-item-disabled/);
  });
});

test.describe('右键菜单 - 插入行/列', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 7.7, 7.8: 插入行（上方/下方）
  test('插入行（上方）在当前行上方插入空行', async ({ page }) => {
    // 在 A1 输入内容
    await typeInCell(page, 0, 0, 'Row1');
    const rowCountBefore = await getRowCount(page);

    // 选中 A1，右键 → 插入行（上方）
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入行（上方）');
    await page.waitForTimeout(300);

    // 验证行数增加
    const rowCountAfter = await getRowCount(page);
    expect(rowCountAfter).toBe(rowCountBefore + 1);

    // 原来 A1 的内容应该下移到 A2
    const cellA2 = await getCellData(page, 1, 0);
    expect(cellA2.content).toBe('Row1');

    // 新插入的 A1 应该为空
    const cellA1 = await getCellData(page, 0, 0);
    expect(cellA1.content).toBeFalsy();
  });

  test('插入行（下方）在当前行下方插入空行', async ({ page }) => {
    // 在 A1 和 A2 输入内容
    await typeInCell(page, 0, 0, 'Row1');
    await typeInCell(page, 1, 0, 'Row2');

    // 选中 A1，右键 → 插入行（下方）
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入行（下方）');
    await page.waitForTimeout(300);

    // A1 内容不变
    const cellA1 = await getCellData(page, 0, 0);
    expect(cellA1.content).toBe('Row1');

    // 新插入的 A2 应该为空
    const cellA2 = await getCellData(page, 1, 0);
    expect(cellA2.content).toBeFalsy();

    // 原来 A2 的内容应该下移到 A3
    const cellA3 = await getCellData(page, 2, 0);
    expect(cellA3.content).toBe('Row2');
  });

  // 需求 7.9, 7.10: 插入列（左侧/右侧）
  test('插入列（左侧）在当前列左侧插入空列', async ({ page }) => {
    // 在 A1 输入内容
    await typeInCell(page, 0, 0, 'Col1');
    const colCountBefore = await getColCount(page);

    // 选中 A1，右键 → 插入列（左侧）
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入列（左侧）');
    await page.waitForTimeout(300);

    // 验证列数增加
    const colCountAfter = await getColCount(page);
    expect(colCountAfter).toBe(colCountBefore + 1);

    // 原来 A1 的内容应该右移到 B1
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.content).toBe('Col1');

    // 新插入的 A1 应该为空
    const cellA1 = await getCellData(page, 0, 0);
    expect(cellA1.content).toBeFalsy();
  });

  test('插入列（右侧）在当前列右侧插入空列', async ({ page }) => {
    // 在 A1 和 B1 输入内容
    await typeInCell(page, 0, 0, 'Col1');
    await typeInCell(page, 0, 1, 'Col2');

    // 选中 A1，右键 → 插入列（右侧）
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '插入列（右侧）');
    await page.waitForTimeout(300);

    // A1 内容不变
    const cellA1 = await getCellData(page, 0, 0);
    expect(cellA1.content).toBe('Col1');

    // 新插入的 B1 应该为空
    const cellB1 = await getCellData(page, 0, 1);
    expect(cellB1.content).toBeFalsy();

    // 原来 B1 的内容应该右移到 C1
    const cellC1 = await getCellData(page, 0, 2);
    expect(cellC1.content).toBe('Col2');
  });
});

test.describe('右键菜单 - 删除行/列', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 7.7 相关: 删除行
  test('删除行移除当前行', async ({ page }) => {
    // 在 A1 和 A2 输入内容
    await typeInCell(page, 0, 0, 'Row1');
    await typeInCell(page, 1, 0, 'Row2');
    const rowCountBefore = await getRowCount(page);

    // 选中 A1，右键 → 删除行
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '删除行');
    await page.waitForTimeout(300);

    // 验证行数减少
    const rowCountAfter = await getRowCount(page);
    expect(rowCountAfter).toBe(rowCountBefore - 1);

    // 原来 A2 的内容应该上移到 A1
    const cellA1 = await getCellData(page, 0, 0);
    expect(cellA1.content).toBe('Row2');
  });

  // 需求 7.9 相关: 删除列
  test('删除列移除当前列', async ({ page }) => {
    // 在 A1 和 B1 输入内容
    await typeInCell(page, 0, 0, 'Col1');
    await typeInCell(page, 0, 1, 'Col2');
    const colCountBefore = await getColCount(page);

    // 选中 A1，右键 → 删除列
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '删除列');
    await page.waitForTimeout(300);

    // 验证列数减少
    const colCountAfter = await getColCount(page);
    expect(colCountAfter).toBe(colCountBefore - 1);

    // 原来 B1 的内容应该左移到 A1
    const cellA1 = await getCellData(page, 0, 0);
    expect(cellA1.content).toBe('Col2');
  });
});

test.describe('右键菜单 - 格式刷', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 7.11: 格式刷菜单项激活格式刷模式
  test('格式刷菜单项激活格式刷模式', async ({ page }) => {
    // 在 A1 设置格式
    await typeInCell(page, 0, 0, 'Styled');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, { fontBold: true, fontColor: '#ff0000' });

    // 选中 A1，右键 → 格式刷
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '格式刷');
    await page.waitForTimeout(300);

    // 验证格式刷模式已激活
    const mode = await getFormatPainterMode(page);
    expect(mode).toBe('single');
  });
});

test.describe('右键菜单 - 清除格式', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 7.12: 清除格式（保留内容，清除样式）
  test('清除格式保留内容但清除所有样式', async ({ page }) => {
    // 在 A1 输入内容并设置格式
    await typeInCell(page, 0, 0, 'Formatted');
    await clickCell(page, 0, 0);
    await setCellFormat(page, 0, 0, {
      fontBold: true,
      fontItalic: true,
      fontColor: '#ff0000',
      bgColor: '#ffff00',
      fontSize: 20,
    });

    // 验证格式已设置
    let cellData = await getCellData(page, 0, 0);
    expect(cellData.fontBold).toBe(true);
    expect(cellData.fontColor).toBe('#ff0000');

    // 选中 A1，右键 → 清除格式
    await clickCell(page, 0, 0);
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);
    await clickContextMenuItem(page, '清除格式');
    await page.waitForTimeout(300);

    // 验证内容保留
    cellData = await getCellData(page, 0, 0);
    expect(cellData.content).toBe('Formatted');

    // 验证格式已清除
    expect(cellData.fontBold).toBeFalsy();
    expect(cellData.fontItalic).toBeFalsy();
    expect(cellData.fontColor).toBeFalsy();
    expect(cellData.bgColor).toBeFalsy();
    expect(cellData.fontSize).toBeFalsy();
  });
});

test.describe('右键菜单 - 视口边界约束', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 7.13: 菜单不超出视口边界
  test('右键菜单在视口边缘位置不超出视口边界', async ({ page }) => {
    // 获取视口尺寸
    const viewportSize = page.viewportSize();
    const vpWidth = viewportSize?.width ?? 1280;
    const vpHeight = viewportSize?.height ?? 720;

    // 在 Canvas 右下角区域右键点击（模拟靠近视口边缘的场景）
    const canvas = page.locator('#excel-canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) return;

    // 在 Canvas 右下角附近右键
    const clickX = Math.min(canvasBox.x + canvasBox.width - 10, vpWidth - 10);
    const clickY = Math.min(canvasBox.y + canvasBox.height - 10, vpHeight - 10);

    await canvas.click({
      position: {
        x: clickX - canvasBox.x,
        y: clickY - canvasBox.y,
      },
      button: 'right',
    });
    await page.waitForTimeout(300);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    // 获取菜单的位置和尺寸
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    if (menuBox) {
      // 验证菜单右边缘不超出视口
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(vpWidth);
      // 验证菜单下边缘不超出视口
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(vpHeight);
    }
  });
});

test.describe('右键菜单 - 关闭菜单', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 7.14: 点击外部关闭菜单
  test('点击菜单外部区域关闭菜单', async ({ page }) => {
    // 右键打开菜单
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    // 点击菜单外部区域（点击 Canvas 上的其他位置）
    await clickCell(page, 5, 5);
    await page.waitForTimeout(300);

    // 验证菜单已关闭
    await expect(menu).not.toBeVisible();
  });

  // 需求 7.14: 按 Escape 关闭菜单
  test('按 Escape 键关闭菜单', async ({ page }) => {
    // 右键打开菜单
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    // 按 Escape 关闭
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // 验证菜单已关闭
    await expect(menu).not.toBeVisible();
  });
});
