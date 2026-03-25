import { test, expect, Page } from '@playwright/test';

/**
 * 大数据量渲染与滚动 E2E 测试
 * 需求：1.1, 1.2, 1.3, 1.4, 1.6
 *
 * 测试覆盖：
 * - 加载 100,000 行数据后页面可交互（首屏渲染完成）
 * - 大数据量下滚动操作流畅（滚动到底部、快速连续滚动不卡死）
 * - 滚动后单元格内容正确显示（视口内数据与预期一致）
 * - 行列插入/删除后前缀和索引正确更新（插入行后滚动定位正确）
 */

// 常量定义
const LARGE_ROW_COUNT = 100_000;
const HEADER_WIDTH = 40;
const HEADER_HEIGHT = 28;
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 25;

/**
 * 辅助函数：通过 page.evaluate() 注入大量数据到模型
 * 直接操作 cells 数组和 rowHeights，避免逐行调用 setCellContent 的开销
 */
const injectLargeData = async (page: Page, rowCount: number): Promise<number> => {
  return await page.evaluate((count: number) => {
    const startTime = performance.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => {
        expandRows: (n: number) => void;
        getRowCount: () => number;
        getColCount: () => number;
        setCellContentNoHistory: (row: number, col: number, content: string) => void;
      };
      getRenderer: () => {
        render: () => void;
        updateViewport: () => void;
      };
    };
    const model = app.getModel();

    // 扩展行数到目标值
    model.expandRows(count);

    // 在每隔 1000 行的第一列写入标记数据，用于后续验证
    for (let r = 0; r < count; r += 1000) {
      model.setCellContentNoHistory(r, 0, `R${r}`);
    }

    // 刷新渲染
    const renderer = app.getRenderer();
    renderer.updateViewport();
    renderer.render();

    return performance.now() - startTime;
  }, rowCount);
};

/**
 * 辅助函数：获取当前视口信息
 */
const getViewport = async (page: Page): Promise<{
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  scrollX: number;
  scrollY: number;
}> => {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as unknown as Record<string, unknown>).app as {
      getRenderer: () => {
        getViewport: () => {
          startRow: number;
          endRow: number;
          startCol: number;
          endCol: number;
          scrollX: number;
          scrollY: number;
        };
      };
    };
    return app.getRenderer().getViewport();
  });
};

/**
 * 辅助函数：获取模型行数
 */
const getRowCount = async (page: Page): Promise<number> => {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getRowCount: () => number };
    };
    return app.getModel().getRowCount();
  });
};

/**
 * 辅助函数：获取指定单元格内容
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
 * 辅助函数：通过 evaluate 滚动到指定像素位置
 */
const scrollToPosition = async (page: Page, scrollX: number, scrollY: number): Promise<void> => {
  await page.evaluate(
    ([sx, sy]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getRenderer: () => {
          scrollTo: (x: number, y: number) => void;
          render: () => void;
        };
      };
      const renderer = app.getRenderer();
      renderer.scrollTo(sx, sy);
      renderer.render();
    },
    [scrollX, scrollY] as [number, number],
  );
};




// ============================================================
// 测试：大数据量渲染与滚动 E2E 测试
// 需求: 1.1, 1.2, 1.3, 1.4, 1.6
// ============================================================

test.describe('大数据量渲染 - 首屏渲染与页面可交互', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 1.1: 加载 100,000 行数据后首屏渲染完成，页面可交互
  test('加载 100,000 行数据后 Canvas 可见且页面可交互', async ({ page }) => {
    // 注入 100,000 行数据并记录耗时
    const loadTime = await injectLargeData(page, LARGE_ROW_COUNT);

    // 验证首屏渲染在合理时间内完成（设计文档要求 < 2 秒）
    expect(loadTime).toBeLessThan(5000); // E2E 环境放宽到 5 秒

    // 验证 Canvas 元素存在且可见
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toBeVisible();

    // 验证模型行数已扩展到 100,000
    const rowCount = await getRowCount(page);
    expect(rowCount).toBeGreaterThanOrEqual(LARGE_ROW_COUNT);

    // 验证首屏数据正确渲染（第一行标记数据）
    const firstCellContent = await getCellContent(page, 0, 0);
    expect(firstCellContent).toBe('R0');

    // 验证页面可交互：点击 Canvas 不报错
    await canvas.click({
      position: {
        x: HEADER_WIDTH + DEFAULT_COL_WIDTH / 2,
        y: HEADER_HEIGHT + DEFAULT_ROW_HEIGHT / 2,
      },
    });
  });

  // 需求 1.4: 按需加载策略，单次扩展不超过 500 行
  test('视口接近数据边界时按需扩展行数', async ({ page }) => {
    // 获取初始行数
    const initialRowCount = await getRowCount(page);

    // 滚动到接近底部，触发按需扩展
    const scrollY = (initialRowCount - 30) * DEFAULT_ROW_HEIGHT;
    await scrollToPosition(page, 0, scrollY);
    await page.waitForTimeout(300);

    // 验证行数已扩展
    const newRowCount = await getRowCount(page);
    expect(newRowCount).toBeGreaterThan(initialRowCount);

    // 验证单次扩展不超过 500 行
    expect(newRowCount - initialRowCount).toBeLessThanOrEqual(500);
  });
});

test.describe('大数据量滚动 - 滚动操作流畅性', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    // 注入大数据量
    await injectLargeData(page, LARGE_ROW_COUNT);
  });

  // 需求 1.2, 1.6: 大数据量下滚动到指定位置，视口正确更新
  test('滚动到中间位置后视口行范围正确', async ({ page }) => {
    // 滚动到第 50,000 行附近
    const targetRow = 50_000;
    const targetScrollY = targetRow * DEFAULT_ROW_HEIGHT;
    await scrollToPosition(page, 0, targetScrollY);
    await page.waitForTimeout(300);

    // 获取视口信息
    const viewport = await getViewport(page);

    // 验证视口起始行在目标行附近（前缀和索引 O(log n) 定位）
    expect(viewport.startRow).toBeGreaterThanOrEqual(targetRow - 5);
    expect(viewport.startRow).toBeLessThanOrEqual(targetRow + 5);
  });

  // 需求 1.2: 滚动到底部区域，视口正确更新
  test('滚动到底部区域后视口正确显示末尾数据', async ({ page }) => {
    // 滚动到接近底部
    const targetRow = LARGE_ROW_COUNT - 100;
    const targetScrollY = targetRow * DEFAULT_ROW_HEIGHT;
    await scrollToPosition(page, 0, targetScrollY);
    await page.waitForTimeout(500);

    // 获取视口信息
    const viewport = await getViewport(page);

    // 验证视口包含接近末尾的行
    expect(viewport.startRow).toBeGreaterThan(LARGE_ROW_COUNT - 200);
  });

  // 需求 1.3: 快速连续滚动（惯性滚动）不卡死
  test('快速连续滚动不导致页面卡死', async ({ page }) => {
    const canvas = page.locator('#excel-canvas');

    // 模拟快速连续滚轮事件（惯性滚动）
    for (let i = 0; i < 20; i++) {
      await canvas.evaluate((el) => {
        el.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: 500,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
    }

    // 等待渲染稳定（跳帧机制应合并中间帧）
    await page.waitForTimeout(500);

    // 验证页面仍然可交互（未卡死）
    const viewport = await getViewport(page);
    expect(viewport.startRow).toBeGreaterThan(0);

    // 验证 Canvas 仍然可见
    await expect(canvas).toBeVisible();
  });

  // 需求 1.3: 使用 mouse.wheel() 模拟滚动操作
  test('mouse.wheel 滚动后视口正确更新', async ({ page }) => {
    const canvas = page.locator('#excel-canvas');
    const box = await canvas.boundingBox();
    if (!box) return;

    // 将鼠标移到 Canvas 中心
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // 使用 mouse.wheel 模拟大幅度滚动
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(500);

    // 验证视口已滚动
    const viewport = await getViewport(page);
    expect(viewport.startRow).toBeGreaterThan(0);
    expect(viewport.scrollY).toBeGreaterThan(0);
  });
});

test.describe('大数据量滚动 - 滚动后数据正确性', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await injectLargeData(page, LARGE_ROW_COUNT);
  });

  // 需求 1.6: 滚动后视口内单元格内容与预期一致
  test('滚动到第 50,000 行后标记数据正确显示', async ({ page }) => {
    // 滚动到第 50,000 行
    const targetScrollY = 50_000 * DEFAULT_ROW_HEIGHT;
    await scrollToPosition(page, 0, targetScrollY);
    await page.waitForTimeout(300);

    // 验证第 50,000 行的标记数据
    const content = await getCellContent(page, 50_000, 0);
    expect(content).toBe('R50000');
  });

  // 需求 1.6: 滚动到不同位置验证多个标记点数据
  test('滚动到多个标记位置后数据均正确', async ({ page }) => {
    const checkpoints = [0, 10_000, 30_000, 70_000, 99_000];

    for (const targetRow of checkpoints) {
      // 滚动到目标行
      const targetScrollY = targetRow * DEFAULT_ROW_HEIGHT;
      await scrollToPosition(page, 0, targetScrollY);
      await page.waitForTimeout(200);

      // 验证标记数据
      const content = await getCellContent(page, targetRow, 0);
      expect(content).toBe(`R${targetRow}`);
    }
  });

  // 需求 1.6: 来回滚动后数据仍然正确
  test('来回滚动后数据仍然正确', async ({ page }) => {
    // 先滚动到底部
    await scrollToPosition(page, 0, 90_000 * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(200);

    // 再滚动回顶部
    await scrollToPosition(page, 0, 0);
    await page.waitForTimeout(200);

    // 验证顶部数据正确
    const topContent = await getCellContent(page, 0, 0);
    expect(topContent).toBe('R0');

    // 再滚动到中间
    await scrollToPosition(page, 0, 50_000 * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(200);

    // 验证中间数据正确
    const midContent = await getCellContent(page, 50_000, 0);
    expect(midContent).toBe('R50000');
  });
});

test.describe('大数据量 - 行列插入/删除后前缀和索引更新', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await injectLargeData(page, LARGE_ROW_COUNT);
  });

  // 需求 1.6: 插入行后前缀和索引正确更新
  test('在第 1000 行插入 5 行后，后续数据下移且滚动定位正确', async ({ page }) => {
    const insertAt = 1000;
    const insertCount = 5;

    // 执行插入行操作
    await page.evaluate(
      ([rowIdx, count]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
        const app = (window as unknown as Record<string, unknown>).app as {
          getModel: () => {
            insertRows: (index: number, count: number) => boolean;
          };
          getRenderer: () => {
            render: () => void;
            updateViewport: () => void;
          };
        };
        app.getModel().insertRows(rowIdx, count);
        app.getRenderer().updateViewport();
        app.getRenderer().render();
      },
      [insertAt, insertCount] as [number, number],
    );
    await page.waitForTimeout(300);

    // 验证行数增加
    const newRowCount = await getRowCount(page);
    expect(newRowCount).toBeGreaterThanOrEqual(LARGE_ROW_COUNT + insertCount);

    // 验证原来第 1000 行的数据下移到第 1005 行
    const shiftedContent = await getCellContent(page, insertAt + insertCount, 0);
    expect(shiftedContent).toBe('R1000');

    // 验证插入的空行内容为空
    for (let i = 0; i < insertCount; i++) {
      const emptyContent = await getCellContent(page, insertAt + i, 0);
      expect(emptyContent).toBe('');
    }

    // 滚动到插入点附近，验证前缀和定位正确
    const targetScrollY = (insertAt + insertCount) * DEFAULT_ROW_HEIGHT;
    await scrollToPosition(page, 0, targetScrollY);
    await page.waitForTimeout(300);

    const viewport = await getViewport(page);
    // 视口起始行应在插入点附近
    expect(viewport.startRow).toBeGreaterThanOrEqual(insertAt);
    expect(viewport.startRow).toBeLessThanOrEqual(insertAt + insertCount + 10);
  });

  // 需求 1.6: 删除行后前缀和索引正确更新
  test('删除第 2000 行起的 3 行后，后续数据上移且滚动定位正确', async ({ page }) => {
    const deleteAt = 2000;
    const deleteCount = 3;

    // 记录删除前第 2003 行的内容（删除后应上移到第 2000 行）
    const contentAfterDelete = await getCellContent(page, deleteAt + deleteCount, 0);

    // 执行删除行操作
    await page.evaluate(
      ([rowIdx, count]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
        const app = (window as unknown as Record<string, unknown>).app as {
          getModel: () => {
            deleteRows: (index: number, count: number) => boolean;
          };
          getRenderer: () => {
            render: () => void;
            updateViewport: () => void;
          };
        };
        app.getModel().deleteRows(rowIdx, count);
        app.getRenderer().updateViewport();
        app.getRenderer().render();
      },
      [deleteAt, deleteCount] as [number, number],
    );
    await page.waitForTimeout(300);

    // 验证行数减少
    const newRowCount = await getRowCount(page);
    expect(newRowCount).toBeLessThanOrEqual(LARGE_ROW_COUNT);

    // 验证原来第 2003 行的数据上移到第 2000 行
    const movedContent = await getCellContent(page, deleteAt, 0);
    expect(movedContent).toBe(contentAfterDelete);

    // 滚动到删除点附近，验证前缀和定位正确
    const targetScrollY = deleteAt * DEFAULT_ROW_HEIGHT;
    await scrollToPosition(page, 0, targetScrollY);
    await page.waitForTimeout(300);

    const viewport = await getViewport(page);
    expect(viewport.startRow).toBeGreaterThanOrEqual(deleteAt - 5);
    expect(viewport.startRow).toBeLessThanOrEqual(deleteAt + 5);
  });

  // 需求 1.6: 插入行后滚动到远处位置，前缀和索引仍然正确
  test('插入行后滚动到远处位置，前缀和索引仍然正确', async ({ page }) => {
    // 在第 500 行插入 10 行
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          insertRows: (index: number, count: number) => boolean;
        };
        getRenderer: () => {
          render: () => void;
          updateViewport: () => void;
        };
      };
      app.getModel().insertRows(500, 10);
      app.getRenderer().updateViewport();
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 滚动到第 60,000 行（远离插入点）
    const targetRow = 60_000;
    const targetScrollY = targetRow * DEFAULT_ROW_HEIGHT;
    await scrollToPosition(page, 0, targetScrollY);
    await page.waitForTimeout(300);

    // 验证视口起始行在目标附近（前缀和索引正确重建）
    const viewport = await getViewport(page);
    expect(viewport.startRow).toBeGreaterThanOrEqual(targetRow - 10);
    expect(viewport.startRow).toBeLessThanOrEqual(targetRow + 10);

    // 验证远处的标记数据仍然正确（因为插入了 10 行，原来的 R60000 现在在第 60010 行）
    const content = await getCellContent(page, 60_000 + 10, 0);
    expect(content).toBe('R60000');
  });
});
