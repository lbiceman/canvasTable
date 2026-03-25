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

test.describe('边框数据模型验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求1 - Cell 对象的 border 属性包含正确的数据结构', async ({ page }) => {
    // 选中 A1 并设置全部边框
    await clickCell(page, 0, 0);
    await applyBorder(page, 'all');

    // 验证 border 属性存在且包含 top/bottom/left/right
    const border = await getCellBorder(page, 0, 0);
    expect(border).not.toBeNull();
    expect(border!.top).toBeDefined();
    expect(border!.bottom).toBeDefined();
    expect(border!.left).toBeDefined();
    expect(border!.right).toBeDefined();

    // 验证 BorderSide 包含 style/color/width
    expect(border!.top!.style).toBeDefined();
    expect(border!.top!.color).toBeDefined();
    expect(typeof border!.top!.width).toBe('number');
  });
});

test.describe('全部边框功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求2.1 - 选中 A1:C3 区域设置全部边框，每个单元格均有四条边', async ({ page }) => {
    // 选中 A1:C3（行0-2，列0-2）
    await selectRange(page, 0, 0, 2, 2);
    await applyBorder(page, 'all');

    // 验证区域内每个单元格都有 top/bottom/left/right 四条边框
    for (let row = 0; row <= 2; row++) {
      for (let col = 0; col <= 2; col++) {
        const border = await getCellBorder(page, row, col);
        expect(border, `单元格 (${row},${col}) 应有边框`).not.toBeNull();
        expect(border!.top, `单元格 (${row},${col}) 应有上边框`).toBeDefined();
        expect(border!.bottom, `单元格 (${row},${col}) 应有下边框`).toBeDefined();
        expect(border!.left, `单元格 (${row},${col}) 应有左边框`).toBeDefined();
        expect(border!.right, `单元格 (${row},${col}) 应有右边框`).toBeDefined();
      }
    }
  });
});

test.describe('外框边框功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求2.2 - 选中 A1:C3 区域设置外框边框，仅外圈单元格有对应方向边框', async ({ page }) => {
    await selectRange(page, 0, 0, 2, 2);
    await applyBorder(page, 'outer');

    // A1 (0,0) - 左上角：应有 top + left
    const a1 = await getCellBorder(page, 0, 0);
    expect(a1).not.toBeNull();
    expect(a1!.top).toBeDefined();
    expect(a1!.left).toBeDefined();

    // C3 (2,2) - 右下角：应有 bottom + right
    const c3 = await getCellBorder(page, 2, 2);
    expect(c3).not.toBeNull();
    expect(c3!.bottom).toBeDefined();
    expect(c3!.right).toBeDefined();

    // A3 (2,0) - 左下角：应有 bottom + left
    const a3 = await getCellBorder(page, 2, 0);
    expect(a3).not.toBeNull();
    expect(a3!.bottom).toBeDefined();
    expect(a3!.left).toBeDefined();

    // C1 (0,2) - 右上角：应有 top + right
    const c1 = await getCellBorder(page, 0, 2);
    expect(c1).not.toBeNull();
    expect(c1!.top).toBeDefined();
    expect(c1!.right).toBeDefined();

    // B2 (1,1) - 内部单元格：不应有边框
    const b2 = await getCellBorder(page, 1, 1);
    expect(b2).toBeNull();
  });
});

test.describe('内框边框功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求2.3 - 选中 A1:C3 区域设置内框边框，仅内部相邻单元格有共享边框', async ({ page }) => {
    await selectRange(page, 0, 0, 2, 2);
    await applyBorder(page, 'inner');

    // A1 (0,0) - 左上角：应有 right 和 bottom（内部共享边），不应有 top 和 left（外侧边）
    const a1 = await getCellBorder(page, 0, 0);
    expect(a1).not.toBeNull();
    expect(a1!.right).toBeDefined();
    expect(a1!.bottom).toBeDefined();
    expect(a1!.top).toBeUndefined();
    expect(a1!.left).toBeUndefined();

    // C3 (2,2) - 右下角：应有 left 和 top（内部共享边），不应有 bottom 和 right（外侧边）
    const c3 = await getCellBorder(page, 2, 2);
    expect(c3).not.toBeNull();
    expect(c3!.left).toBeDefined();
    expect(c3!.top).toBeDefined();
    expect(c3!.bottom).toBeUndefined();
    expect(c3!.right).toBeUndefined();

    // B2 (1,1) - 中心：应有四条内部共享边
    const b2 = await getCellBorder(page, 1, 1);
    expect(b2).not.toBeNull();
    expect(b2!.top).toBeDefined();
    expect(b2!.bottom).toBeDefined();
    expect(b2!.left).toBeDefined();
    expect(b2!.right).toBeDefined();
  });
});

test.describe('单边边框功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求2.4 - 上边框：仅设置 top 方向', async ({ page }) => {
    await selectRange(page, 0, 0, 2, 2);
    await applyBorder(page, 'top');

    const border = await getCellBorder(page, 0, 0);
    expect(border).not.toBeNull();
    expect(border!.top).toBeDefined();
    // 其他方向不应被设置
    expect(border!.bottom).toBeUndefined();
    expect(border!.left).toBeUndefined();
    expect(border!.right).toBeUndefined();
  });

  test('需求2.4 - 下边框：仅设置 bottom 方向', async ({ page }) => {
    await selectRange(page, 0, 0, 2, 2);
    await applyBorder(page, 'bottom');

    const border = await getCellBorder(page, 1, 1);
    expect(border).not.toBeNull();
    expect(border!.bottom).toBeDefined();
    expect(border!.top).toBeUndefined();
    expect(border!.left).toBeUndefined();
    expect(border!.right).toBeUndefined();
  });

  test('需求2.4 - 左边框：仅设置 left 方向', async ({ page }) => {
    await selectRange(page, 0, 0, 2, 2);
    await applyBorder(page, 'left');

    const border = await getCellBorder(page, 1, 1);
    expect(border).not.toBeNull();
    expect(border!.left).toBeDefined();
    expect(border!.top).toBeUndefined();
    expect(border!.bottom).toBeUndefined();
    expect(border!.right).toBeUndefined();
  });

  test('需求2.4 - 右边框：仅设置 right 方向', async ({ page }) => {
    await selectRange(page, 0, 0, 2, 2);
    await applyBorder(page, 'right');

    const border = await getCellBorder(page, 1, 1);
    expect(border).not.toBeNull();
    expect(border!.right).toBeDefined();
    expect(border!.top).toBeUndefined();
    expect(border!.bottom).toBeUndefined();
    expect(border!.left).toBeUndefined();
  });
});

test.describe('清除边框功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求2.5 - 先设置全部边框再清除，border 应被移除', async ({ page }) => {
    // 先设置全部边框
    await selectRange(page, 0, 0, 2, 2);
    await applyBorder(page, 'all');

    // 验证边框已设置
    const borderBefore = await getCellBorder(page, 0, 0);
    expect(borderBefore).not.toBeNull();

    // 重新选中区域并清除边框
    await selectRange(page, 0, 0, 2, 2);
    await applyBorder(page, 'none');

    // 验证区域内所有单元格边框已被移除
    for (let row = 0; row <= 2; row++) {
      for (let col = 0; col <= 2; col++) {
        const border = await getCellBorder(page, row, col);
        expect(border, `单元格 (${row},${col}) 边框应被清除`).toBeNull();
      }
    }
  });
});

test.describe('合并单元格边框功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求2.7 - 合并 A1:B2 后设置边框，应用到父单元格', async ({ page }) => {
    // 选中 A1:B2 并合并
    await selectRange(page, 0, 0, 1, 1);
    await page.locator('#merge-cells').click();
    await page.waitForTimeout(300);

    // 选中合并区域并设置全部边框
    await clickCell(page, 0, 0);
    await applyBorder(page, 'all');

    // 验证父单元格 (0,0) 有边框
    const parentBorder = await getCellBorder(page, 0, 0);
    expect(parentBorder).not.toBeNull();
    expect(parentBorder!.top).toBeDefined();
    expect(parentBorder!.bottom).toBeDefined();
    expect(parentBorder!.left).toBeDefined();
    expect(parentBorder!.right).toBeDefined();

    // 验证被合并的子单元格无独立边框
    const childBorder = await getCellBorder(page, 1, 1);
    expect(childBorder).toBeNull();
  });
});
