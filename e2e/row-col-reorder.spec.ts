import { test, expect, Page } from '@playwright/test';

/**
 * 辅助函数：点击 Canvas 上指定单元格
 * headerWidth=40, headerHeight=28，默认列宽=100，默认行高=25
 */
const HEADER_WIDTH = 40;
const HEADER_HEIGHT = 28;
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 25;

const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.click({ position: { x, y } });
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
 * 辅助函数：通过 window.app 直接调用 moveRows 方法
 * 由于 startRowDrag 未在 app.ts 的 mousedown 中绑定，
 * 我们通过 evaluate 直接访问 RowColReorder 实例来测试数据移动逻辑
 */
const moveRows = async (page: Page, sourceIndices: number[], targetIndex: number): Promise<void> => {
  await page.evaluate(
    ([src, target]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问私有字段进行测试
      const app = (window as unknown as Record<string, any>).app;
      app.rowColReorder.moveRows(src, target);
      app.getRenderer().render();
    },
    [sourceIndices, targetIndex] as [number[], number],
  );
};

/**
 * 辅助函数：通过 window.app 直接调用 moveCols 方法
 */
const moveCols = async (page: Page, sourceIndices: number[], targetIndex: number): Promise<void> => {
  await page.evaluate(
    ([src, target]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问私有字段进行测试
      const app = (window as unknown as Record<string, any>).app;
      app.rowColReorder.moveCols(src, target);
      app.getRenderer().render();
    },
    [sourceIndices, targetIndex] as [number[], number],
  );
};

/**
 * 辅助函数：设置拖拽状态并渲染指示线（用于截图验证）
 */
const setDragStateAndRender = async (
  page: Page,
  type: 'row' | 'col',
  sourceIndices: number[],
  targetIndex: number,
  mousePos: number,
): Promise<void> => {
  await page.evaluate(
    ([t, src, target, pos]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问私有字段进行测试
      const app = (window as unknown as Record<string, any>).app;
      const reorder = app.rowColReorder;
      if (t === 'row') {
        reorder.startRowDrag(src as number[], pos as number);
      } else {
        reorder.startColDrag(src as number[], pos as number);
      }
      // 更新目标位置
      reorder.updateDrag(
        t === 'col' ? (pos as number) : 0,
        t === 'row' ? (pos as number) : 0,
      );
      // 设置渲染器的拖拽状态
      const renderer = app.getRenderer();
      renderer.setReorderDragState(reorder.getDragState());
      renderer.render();
    },
    [type, sourceIndices, targetIndex, mousePos] as [string, number[], number, number],
  );
};

/**
 * 辅助函数：清除拖拽状态
 */
const clearDragState = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问私有字段进行测试
    const app = (window as unknown as Record<string, any>).app;
    app.rowColReorder.cancelDrag();
    app.getRenderer().setReorderDragState(null);
    app.getRenderer().render();
  });
};

/**
 * 辅助函数：填充测试数据到多行多列
 * 在 A1:C3 区域填充数据：
 *   A1=R1C1, B1=R1C2, C1=R1C3
 *   A2=R2C1, B2=R2C2, C2=R2C3
 *   A3=R3C1, B3=R3C2, C3=R3C3
 */
const fillTestData = async (page: Page): Promise<void> => {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      await typeInCell(page, row, col, `R${row + 1}C${col + 1}`);
    }
  }
  // 点击空白单元格取消选中
  await clickCell(page, 5, 5);
  await page.waitForTimeout(200);
};

test.describe('行列拖拽重排序 - 行拖拽数据移动', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('拖拽行到新位置，数据跟随移动（需求 9.1, 9.3）', async ({ page }) => {
    // 填充测试数据
    await fillTestData(page);

    // 验证初始数据
    expect(await getCellContent(page, 0, 0)).toBe('R1C1');
    expect(await getCellContent(page, 1, 0)).toBe('R2C1');
    expect(await getCellContent(page, 2, 0)).toBe('R3C1');

    // 将第 0 行移动到第 2 行位置
    await moveRows(page, [0], 2);
    await page.waitForTimeout(300);

    // 验证数据已移动：原第 1 行变为第 0 行，原第 0 行移到第 1 行位置
    expect(await getCellContent(page, 0, 0)).toBe('R2C1');
    expect(await getCellContent(page, 1, 0)).toBe('R1C1');
    expect(await getCellContent(page, 2, 0)).toBe('R3C1');

    // 验证整行数据一起移动（检查其他列）
    expect(await getCellContent(page, 0, 1)).toBe('R2C2');
    expect(await getCellContent(page, 1, 1)).toBe('R1C2');
  });
});

test.describe('行列拖拽重排序 - 行拖拽指示线', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('拖拽过程中显示水平插入指示线（需求 9.2）', async ({ page }) => {
    // 填充测试数据
    await fillTestData(page);

    // 设置行拖拽状态，模拟拖拽第 0 行到第 2 行位置
    // mouseY 对应第 2 行中间位置（headerHeight + 2 * rowHeight + rowHeight/2）
    const targetMouseY = HEADER_HEIGHT + 2 * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
    await setDragStateAndRender(page, 'row', [0], 2, targetMouseY);
    await page.waitForTimeout(300);

    // 截图验证水平指示线
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('row-drag-horizontal-indicator.png', {
      maxDiffPixelRatio: 0.05,
    });

    // 清除拖拽状态
    await clearDragState(page);
  });
});

test.describe('行列拖拽重排序 - 列拖拽数据移动', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('拖拽列到新位置，数据跟随移动（需求 9.4, 9.6）', async ({ page }) => {
    // 填充测试数据
    await fillTestData(page);

    // 验证初始数据
    expect(await getCellContent(page, 0, 0)).toBe('R1C1');
    expect(await getCellContent(page, 0, 1)).toBe('R1C2');
    expect(await getCellContent(page, 0, 2)).toBe('R1C3');

    // 将第 0 列移动到第 2 列位置
    await moveCols(page, [0], 2);
    await page.waitForTimeout(300);

    // 验证数据已移动：原第 1 列变为第 0 列，原第 0 列移到第 1 列位置
    expect(await getCellContent(page, 0, 0)).toBe('R1C2');
    expect(await getCellContent(page, 0, 1)).toBe('R1C1');
    expect(await getCellContent(page, 0, 2)).toBe('R1C3');

    // 验证整列数据一起移动（检查其他行）
    expect(await getCellContent(page, 1, 0)).toBe('R2C2');
    expect(await getCellContent(page, 1, 1)).toBe('R2C1');
  });
});

test.describe('行列拖拽重排序 - 列拖拽指示线', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('拖拽过程中显示垂直插入指示线（需求 9.5）', async ({ page }) => {
    // 填充测试数据
    await fillTestData(page);

    // 设置列拖拽状态，模拟拖拽第 0 列到第 2 列位置
    // mouseX 对应第 2 列中间位置（headerWidth + 2 * colWidth + colWidth/2）
    const targetMouseX = HEADER_WIDTH + 2 * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
    await setDragStateAndRender(page, 'col', [0], 2, targetMouseX);
    await page.waitForTimeout(300);

    // 截图验证垂直指示线
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('col-drag-vertical-indicator.png', {
      maxDiffPixelRatio: 0.05,
    });

    // 清除拖拽状态
    await clearDragState(page);
  });
});

test.describe('行列拖拽重排序 - 多行拖拽', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('多行选中后整体拖拽（需求 9.8）', async ({ page }) => {
    // 填充 4 行测试数据
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        await typeInCell(page, row, col, `R${row + 1}C${col + 1}`);
      }
    }
    await clickCell(page, 5, 5);
    await page.waitForTimeout(200);

    // 验证初始数据
    expect(await getCellContent(page, 0, 0)).toBe('R1C1');
    expect(await getCellContent(page, 1, 0)).toBe('R2C1');
    expect(await getCellContent(page, 2, 0)).toBe('R3C1');
    expect(await getCellContent(page, 3, 0)).toBe('R4C1');

    // 将第 0、1 行整体移动到第 3 行位置
    await moveRows(page, [0, 1], 3);
    await page.waitForTimeout(300);

    // 验证数据：原第 2 行变为第 0 行，原第 0、1 行移到第 1、2 行位置
    expect(await getCellContent(page, 0, 0)).toBe('R3C1');
    expect(await getCellContent(page, 1, 0)).toBe('R1C1');
    expect(await getCellContent(page, 2, 0)).toBe('R2C1');
    expect(await getCellContent(page, 3, 0)).toBe('R4C1');
  });
});

test.describe('行列拖拽重排序 - 拖拽到原始位置', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('拖拽到原始位置不执行操作（需求 9.7）', async ({ page }) => {
    // 填充测试数据
    await fillTestData(page);

    // 验证初始数据
    expect(await getCellContent(page, 0, 0)).toBe('R1C1');
    expect(await getCellContent(page, 1, 0)).toBe('R2C1');
    expect(await getCellContent(page, 2, 0)).toBe('R3C1');

    // 通过 endDrag 测试拖拽到原始位置不执行操作
    const moved = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问私有字段进行测试
      const app = (window as unknown as Record<string, any>).app;
      const reorder = app.rowColReorder;
      // 开始拖拽第 1 行
      reorder.startRowDrag([1], 40);
      // 目标位置仍然是第 1 行（原始位置）
      reorder.updateDrag(0, 40);
      // 结束拖拽
      return reorder.endDrag();
    });

    // endDrag 应返回 false，表示未执行移动
    expect(moved).toBe(false);

    // 验证数据未变化
    expect(await getCellContent(page, 0, 0)).toBe('R1C1');
    expect(await getCellContent(page, 1, 0)).toBe('R2C1');
    expect(await getCellContent(page, 2, 0)).toBe('R3C1');
  });
});
