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
 * 辅助函数：选中单元格区域（点击起始单元格，Shift+点击结束单元格）
 */
const selectRange = async (
  page: Page,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
): Promise<void> => {
  await clickCell(page, startRow, startCol);
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;
  const x = headerWidth + endCol * defaultColWidth + defaultColWidth / 2;
  const y = headerHeight + endRow * defaultRowHeight + defaultRowHeight / 2;
  await canvas.click({ position: { x, y }, modifiers: ['Shift'] });
};

/**
 * 辅助函数：应用指定位置的边框
 */
const applyBorder = async (page: Page, position: string): Promise<void> => {
  await page.locator('#border-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.border-position-option[data-position="${position}"]`).click();
  await page.waitForTimeout(200);
};

/**
 * 辅助函数：获取单元格边框数据
 */
const getCellBorder = async (
  page: Page,
  row: number,
  col: number,
): Promise<{
  top?: { style: string; color: string; width: number };
  bottom?: { style: string; color: string; width: number };
  left?: { style: string; color: string; width: number };
  right?: { style: string; color: string; width: number };
} | null> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => { border?: Record<string, unknown> } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell || !cell.border) return null;
      return cell.border as {
        top?: { style: string; color: string; width: number };
        bottom?: { style: string; color: string; width: number };
        left?: { style: string; color: string; width: number };
        right?: { style: string; color: string; width: number };
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：获取单元格的 fontFamily 属性
 */
const getCellFontFamily = async (page: Page, row: number, col: number): Promise<string | undefined> => {
  return await page.evaluate(([r, c]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => {
        getCell: (row: number, col: number) => { fontFamily?: string } | null;
      };
    };
    const cell = app.getModel().getCell(r, c);
    return cell?.fontFamily;
  }, [row, col] as [number, number]);
};

/**
 * 辅助函数：获取单元格的 fontStrikethrough 属性
 */
const getCellStrikethrough = async (page: Page, row: number, col: number): Promise<boolean | undefined> => {
  return await page.evaluate(([r, c]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => {
        getCell: (row: number, col: number) => { fontStrikethrough?: boolean } | null;
      };
    };
    const cell = app.getModel().getCell(r, c);
    return cell?.fontStrikethrough;
  }, [row, col] as [number, number]);
};

/**
 * 辅助函数：从字体族下拉中选择指定字体
 */
const selectFontFamily = async (page: Page, fontName: string): Promise<void> => {
  await page.locator('#font-family-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.font-family-option[data-font="${fontName}"]`).click();
  await page.waitForTimeout(200);
};

test.describe('撤销重做完整测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  /**
   * 需求2.6 - 边框撤销重做：
   * 设置全部边框 → Ctrl+Z 撤销验证边框移除 → Ctrl+Y 重做验证边框恢复
   */
  test('需求2.6 - 边框撤销重做：设置全部边框 → 撤销 → 重做', async ({ page }) => {
    // 选中 A1:B2 区域并设置全部边框
    await selectRange(page, 0, 0, 1, 1);
    await applyBorder(page, 'all');

    // 验证边框已设置
    const borderBefore = await getCellBorder(page, 0, 0);
    expect(borderBefore).not.toBeNull();
    expect(borderBefore!.top).toBeDefined();
    expect(borderBefore!.bottom).toBeDefined();
    expect(borderBefore!.left).toBeDefined();
    expect(borderBefore!.right).toBeDefined();

    // Ctrl+Z 撤销
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // 验证边框已移除
    for (let row = 0; row <= 1; row++) {
      for (let col = 0; col <= 1; col++) {
        const border = await getCellBorder(page, row, col);
        expect(border, `撤销后单元格 (${row},${col}) 边框应被移除`).toBeNull();
      }
    }

    // Ctrl+Y 重做
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);

    // 验证边框已恢复
    for (let row = 0; row <= 1; row++) {
      for (let col = 0; col <= 1; col++) {
        const border = await getCellBorder(page, row, col);
        expect(border, `重做后单元格 (${row},${col}) 应有边框`).not.toBeNull();
        expect(border!.top).toBeDefined();
        expect(border!.bottom).toBeDefined();
        expect(border!.left).toBeDefined();
        expect(border!.right).toBeDefined();
      }
    }
  });

  /**
   * 需求2.6 - 外框边框撤销：
   * 设置外框边框 → 撤销 → 验证外框边框移除
   */
  test('需求2.6 - 外框边框撤销：设置外框边框 → 撤销 → 验证移除', async ({ page }) => {
    // 选中 A1:C3 区域并设置外框边框
    await selectRange(page, 0, 0, 2, 2);
    await applyBorder(page, 'outer');

    // 验证外框边框已设置（A1 应有 top + left）
    const a1Before = await getCellBorder(page, 0, 0);
    expect(a1Before).not.toBeNull();
    expect(a1Before!.top).toBeDefined();
    expect(a1Before!.left).toBeDefined();

    // Ctrl+Z 撤销
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // 验证外框边框已移除
    const a1After = await getCellBorder(page, 0, 0);
    expect(a1After, '撤销后 A1 边框应被移除').toBeNull();

    const c3After = await getCellBorder(page, 2, 2);
    expect(c3After, '撤销后 C3 边框应被移除').toBeNull();
  });

  /**
   * 需求2.6 - 清除边框撤销：
   * 设置边框 → 清除边框 → 撤销清除 → 验证边框恢复
   */
  test('需求2.6 - 清除边框撤销：设置边框 → 清除 → 撤销清除 → 验证恢复', async ({ page }) => {
    // 选中 A1:B2 区域并设置全部边框
    await selectRange(page, 0, 0, 1, 1);
    await applyBorder(page, 'all');

    // 验证边框已设置
    const borderSet = await getCellBorder(page, 0, 0);
    expect(borderSet).not.toBeNull();

    // 重新选中区域并清除边框
    await selectRange(page, 0, 0, 1, 1);
    await applyBorder(page, 'none');

    // 验证边框已清除
    const borderCleared = await getCellBorder(page, 0, 0);
    expect(borderCleared, '清除后边框应为 null').toBeNull();

    // Ctrl+Z 撤销清除操作
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // 验证边框恢复
    for (let row = 0; row <= 1; row++) {
      for (let col = 0; col <= 1; col++) {
        const border = await getCellBorder(page, row, col);
        expect(border, `撤销清除后单元格 (${row},${col}) 边框应恢复`).not.toBeNull();
        expect(border!.top).toBeDefined();
        expect(border!.bottom).toBeDefined();
        expect(border!.left).toBeDefined();
        expect(border!.right).toBeDefined();
      }
    }
  });

  /**
   * 需求5.6 - 字体族撤销重做：
   * 设置字体族为 Arial → 撤销验证恢复默认 → 重做验证重新设置为 Arial
   */
  test('需求5.6 - 字体族撤销重做：设置 Arial → 撤销 → 重做', async ({ page }) => {
    // 选中 A1 并设置字体族为 Arial
    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Arial');

    // 验证字体族已设置
    let fontFamily = await getCellFontFamily(page, 0, 0);
    expect(fontFamily).toBe('Arial');

    // Ctrl+Z 撤销
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // 验证字体族恢复为 undefined（默认）
    fontFamily = await getCellFontFamily(page, 0, 0);
    expect(fontFamily).toBeUndefined();

    // Ctrl+Y 重做
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);

    // 验证字体族重新设置为 Arial
    fontFamily = await getCellFontFamily(page, 0, 0);
    expect(fontFamily).toBe('Arial');
  });

  /**
   * 需求6.5 - 删除线撤销重做：
   * 启用删除线 → 撤销验证取消 → 重做验证重新启用
   */
  test('需求6.5 - 删除线撤销重做：启用 → 撤销 → 重做', async ({ page }) => {
    // 选中 A1 并启用删除线
    await clickCell(page, 0, 0);
    const strikethroughBtn = page.locator('#font-strikethrough-btn');
    await strikethroughBtn.click();

    // 验证删除线已启用
    expect(await getCellStrikethrough(page, 0, 0)).toBe(true);

    // Ctrl+Z 撤销
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // 验证删除线已取消（false 或 undefined）
    const afterUndo = await getCellStrikethrough(page, 0, 0);
    expect(!afterUndo).toBeTruthy();

    // Ctrl+Y 重做
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);

    // 验证删除线重新启用
    expect(await getCellStrikethrough(page, 0, 0)).toBe(true);
  });

  /**
   * 连续操作撤销：
   * 依次设置边框、字体族、删除线，连续三次 Ctrl+Z 验证全部撤销
   */
  test('连续操作撤销：依次设置边框、字体族、删除线 → 连续三次撤销', async ({ page }) => {
    // 第一步：选中 A1 并设置全部边框
    await clickCell(page, 0, 0);
    await applyBorder(page, 'all');

    // 第二步：选中 A1 并设置字体族为 Arial
    await clickCell(page, 0, 0);
    await selectFontFamily(page, 'Arial');

    // 第三步：选中 A1 并启用删除线
    await clickCell(page, 0, 0);
    const strikethroughBtn = page.locator('#font-strikethrough-btn');
    await strikethroughBtn.click();

    // 验证三项属性均已设置
    const borderSet = await getCellBorder(page, 0, 0);
    expect(borderSet).not.toBeNull();
    expect(await getCellFontFamily(page, 0, 0)).toBe('Arial');
    expect(await getCellStrikethrough(page, 0, 0)).toBe(true);

    // 第一次 Ctrl+Z：撤销删除线
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    const afterUndo1Strikethrough = await getCellStrikethrough(page, 0, 0);
    expect(!afterUndo1Strikethrough).toBeTruthy();
    expect(await getCellFontFamily(page, 0, 0)).toBe('Arial');
    expect(await getCellBorder(page, 0, 0)).not.toBeNull();

    // 第二次 Ctrl+Z：撤销字体族
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    expect(await getCellFontFamily(page, 0, 0)).toBeUndefined();
    expect(await getCellBorder(page, 0, 0)).not.toBeNull();

    // 第三次 Ctrl+Z：撤销边框
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    expect(await getCellBorder(page, 0, 0)).toBeNull();

    // 验证全部撤销完成：三项属性均恢复为初始状态
    expect(await getCellBorder(page, 0, 0)).toBeNull();
    expect(await getCellFontFamily(page, 0, 0)).toBeUndefined();
    const finalStrikethrough = await getCellStrikethrough(page, 0, 0);
    expect(!finalStrikethrough).toBeTruthy();
  });
});
