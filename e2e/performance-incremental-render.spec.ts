import { test, expect, Page } from '@playwright/test';

/**
 * 增量渲染 E2E 测试
 * 需求：3.1, 3.2, 3.7, 3.8
 *
 * 测试覆盖：
 * - 编辑单个单元格后页面正确更新（内容变更可见）
 * - 编辑多个不相邻单元格后所有变更正确显示
 * - 合并单元格内容变更后整个合并区域正确重绘
 * - 样式变更（背景色、字体颜色）后单元格正确更新
 * - 滚动后再编辑单元格，增量渲染与全量渲染切换正常
 */

// 常量定义
const DEFAULT_ROW_HEIGHT = 25;

// ============================================================
// 辅助函数
// ============================================================

/**
 * 辅助函数：设置单元格内容（通过 model.setCellContent）
 */
const setCellContent = async (page: Page, row: number, col: number, content: string): Promise<boolean> => {
  return await page.evaluate(
    ([r, c, val]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (row: number, col: number, content: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      const result = app.getModel().setCellContent(r, c, val);
      app.getRenderer().render();
      return result.success;
    },
    [row, col, content] as [number, number, string],
  );
};

/**
 * 辅助函数：获取单元格内容
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
 * 辅助函数：设置单元格背景色
 */
const setCellBgColor = async (page: Page, row: number, col: number, color: string): Promise<void> => {
  await page.evaluate(
    ([r, c, clr]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellBgColor: (row: number, col: number, color: string) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellBgColor(r, c, clr);
      app.getRenderer().render();
    },
    [row, col, color] as [number, number, string],
  );
};

/**
 * 辅助函数：设置单元格字体颜色
 */
const setCellFontColor = async (page: Page, row: number, col: number, color: string): Promise<void> => {
  await page.evaluate(
    ([r, c, clr]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellFontColor: (row: number, col: number, color: string) => void;
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellFontColor(r, c, clr);
      app.getRenderer().render();
    },
    [row, col, color] as [number, number, string],
  );
};

/**
 * 辅助函数：合并单元格
 */
const mergeCells = async (
  page: Page,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
): Promise<boolean> => {
  return await page.evaluate(
    ([sr, sc, er, ec]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          mergeCells: (startRow: number, startCol: number, endRow: number, endCol: number) => boolean;
        };
        getRenderer: () => { render: () => void };
      };
      const result = app.getModel().mergeCells(sr, sc, er, ec);
      app.getRenderer().render();
      return result;
    },
    [startRow, startCol, endRow, endCol] as [number, number, number, number],
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

/**
 * 辅助函数：获取单元格的合并信息
 */
const getMergedCellInfo = async (
  page: Page,
  row: number,
  col: number,
): Promise<{ rowSpan: number; colSpan: number; content: string } | null> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            rowSpan: number;
            colSpan: number;
            content?: string;
          } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell) return null;
      return {
        rowSpan: cell.rowSpan,
        colSpan: cell.colSpan,
        content: cell.content ?? '',
      };
    },
    [row, col] as [number, number],
  );
};

// ============================================================
// 测试：单个单元格编辑后增量渲染
// 需求: 3.1, 3.7
// ============================================================

test.describe('增量渲染 - 单个单元格编辑', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 3.1: 编辑单个单元格后内容变更可见
  test('编辑单个单元格后内容正确显示', async ({ page }) => {
    // 在 A1 设置内容
    const success = await setCellContent(page, 0, 0, 'Hello');
    expect(success).toBe(true);

    // 验证模型中内容正确
    const content = await getCellContent(page, 0, 0);
    expect(content).toBe('Hello');

    // 等待渲染完成后截图验证
    await page.waitForTimeout(200);
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('incremental-single-cell-edit.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  // 需求 3.1, 3.7: 编辑单元格后再次编辑，内容正确更新
  test('多次编辑同一单元格后内容正确更新', async ({ page }) => {
    // 第一次编辑
    await setCellContent(page, 0, 0, 'First');
    expect(await getCellContent(page, 0, 0)).toBe('First');

    // 第二次编辑覆盖
    await setCellContent(page, 0, 0, 'Second');
    expect(await getCellContent(page, 0, 0)).toBe('Second');

    // 等待渲染完成后截图验证
    await page.waitForTimeout(200);
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('incremental-single-cell-overwrite.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

// ============================================================
// 测试：多个不相邻单元格编辑后增量渲染
// 需求: 3.2, 3.7
// ============================================================

test.describe('增量渲染 - 多个不相邻单元格编辑', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 3.2: 编辑多个不相邻单元格后所有变更正确显示
  test('编辑多个不相邻单元格后所有内容正确显示', async ({ page }) => {
    // 在不相邻的单元格中设置内容：A1, C3, E5
    await setCellContent(page, 0, 0, 'Cell-A1');
    await setCellContent(page, 2, 2, 'Cell-C3');
    await setCellContent(page, 4, 4, 'Cell-E5');

    // 验证所有单元格内容正确
    expect(await getCellContent(page, 0, 0)).toBe('Cell-A1');
    expect(await getCellContent(page, 2, 2)).toBe('Cell-C3');
    expect(await getCellContent(page, 4, 4)).toBe('Cell-E5');

    // 截图验证所有变更可见
    await page.waitForTimeout(200);
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('incremental-multiple-cells-edit.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  // 需求 3.2: 批量设置多个不相邻单元格，验证脏区域分别重绘
  test('批量设置多个不相邻单元格后数据均正确', async ({ page }) => {
    // 通过 evaluate 批量设置多个单元格
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (row: number, col: number, content: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      // 在不相邻位置设置内容
      model.setCellContent(0, 0, 'Top-Left');
      model.setCellContent(5, 3, 'Middle');
      model.setCellContent(9, 6, 'Bottom-Right');
      app.getRenderer().render();
    });

    // 验证所有内容正确
    expect(await getCellContent(page, 0, 0)).toBe('Top-Left');
    expect(await getCellContent(page, 5, 3)).toBe('Middle');
    expect(await getCellContent(page, 9, 6)).toBe('Bottom-Right');
  });
});

// ============================================================
// 测试：合并单元格内容变更后增量渲染
// 需求: 3.8
// ============================================================

test.describe('增量渲染 - 合并单元格', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 3.8: 合并单元格内容变更后整个合并区域正确重绘
  test('合并单元格后编辑内容，整个合并区域正确重绘', async ({ page }) => {
    // 先在 A1 设置内容
    await setCellContent(page, 0, 0, 'Merged');

    // 合并 A1:B2（2行2列）
    const merged = await mergeCells(page, 0, 0, 1, 1);
    expect(merged).toBe(true);

    // 验证合并信息
    const mergeInfo = await getMergedCellInfo(page, 0, 0);
    expect(mergeInfo).not.toBeNull();
    expect(mergeInfo!.rowSpan).toBe(2);
    expect(mergeInfo!.colSpan).toBe(2);

    // 修改合并单元格内容
    await setCellContent(page, 0, 0, 'Updated Merged');
    expect(await getCellContent(page, 0, 0)).toBe('Updated Merged');

    // 截图验证合并区域正确重绘
    await page.waitForTimeout(200);
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('incremental-merged-cell-edit.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  // 需求 3.8: 合并区域内子单元格编辑时通知整个合并区域重绘
  test('通过合并区域内子单元格位置编辑，父单元格内容正确更新', async ({ page }) => {
    // 先设置内容并合并 A1:C3（3行3列）
    await setCellContent(page, 0, 0, 'Big Merge');
    await mergeCells(page, 0, 0, 2, 2);

    // 通过子单元格位置（B2）编辑，应更新父单元格 A1
    await setCellContent(page, 1, 1, 'Via Child');

    // 验证父单元格内容已更新
    const content = await getCellContent(page, 0, 0);
    expect(content).toBe('Via Child');

    // 截图验证
    await page.waitForTimeout(200);
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('incremental-merged-child-edit.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

// ============================================================
// 测试：样式变更后增量渲染
// 需求: 3.7
// ============================================================

test.describe('增量渲染 - 样式变更', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 3.7: 背景色变更后单元格正确更新
  test('设置单元格背景色后渲染正确更新', async ({ page }) => {
    // 先设置内容
    await setCellContent(page, 0, 0, 'BgColor');
    await page.waitForTimeout(100);

    // 设置背景色为红色
    await setCellBgColor(page, 0, 0, '#ff0000');

    // 验证模型中背景色已设置
    const bgColor = await page.evaluate(([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => { bgColor?: string } | null;
        };
      };
      return app.getModel().getCell(r, c)?.bgColor ?? '';
    }, [0, 0] as [number, number]);
    expect(bgColor).toBe('#ff0000');

    // 截图验证背景色渲染
    await page.waitForTimeout(200);
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('incremental-bgcolor-change.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  // 需求 3.7: 字体颜色变更后单元格正确更新
  test('设置单元格字体颜色后渲染正确更新', async ({ page }) => {
    // 先设置内容
    await setCellContent(page, 0, 0, 'FontColor');
    await page.waitForTimeout(100);

    // 设置字体颜色为蓝色
    await setCellFontColor(page, 0, 0, '#0000ff');

    // 验证模型中字体颜色已设置
    const fontColor = await page.evaluate(([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => { fontColor?: string } | null;
        };
      };
      return app.getModel().getCell(r, c)?.fontColor ?? '';
    }, [0, 0] as [number, number]);
    expect(fontColor).toBe('#0000ff');

    // 截图验证字体颜色渲染
    await page.waitForTimeout(200);
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('incremental-fontcolor-change.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  // 需求 3.7: 同时变更背景色和字体颜色
  test('同时设置背景色和字体颜色后渲染正确', async ({ page }) => {
    // 设置内容
    await setCellContent(page, 0, 0, 'Styled');
    await page.waitForTimeout(100);

    // 设置背景色和字体颜色
    await setCellBgColor(page, 0, 0, '#ffff00');
    await setCellFontColor(page, 0, 0, '#ff0000');

    // 截图验证组合样式渲染
    await page.waitForTimeout(200);
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('incremental-combined-style-change.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

// ============================================================
// 测试：滚动后编辑单元格，增量渲染与全量渲染切换
// 需求: 3.1, 3.2, 3.7, 3.8
// ============================================================

test.describe('增量渲染 - 滚动后编辑', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 3.1, 3.2: 滚动后编辑单元格，增量渲染正常工作
  test('滚动到新位置后编辑单元格，内容正确显示', async ({ page }) => {
    // 先在顶部设置一些内容
    await setCellContent(page, 0, 0, 'Top');

    // 滚动到下方（约第 40 行）
    await scrollToPosition(page, 0, 40 * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(300);

    // 在滚动后的可见区域编辑单元格
    await setCellContent(page, 42, 0, 'After Scroll');
    expect(await getCellContent(page, 42, 0)).toBe('After Scroll');

    // 截图验证滚动后编辑的内容可见
    await page.waitForTimeout(200);
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('incremental-scroll-then-edit.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  // 需求 3.1: 滚动回顶部后之前编辑的内容仍然正确
  test('滚动后编辑再滚回，所有内容保持正确', async ({ page }) => {
    // 在顶部设置内容
    await setCellContent(page, 0, 0, 'Original');

    // 滚动到下方并编辑
    await scrollToPosition(page, 0, 50 * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(300);
    await setCellContent(page, 52, 0, 'Scrolled Edit');

    // 滚回顶部
    await scrollToPosition(page, 0, 0);
    await page.waitForTimeout(300);

    // 验证顶部内容仍然正确
    expect(await getCellContent(page, 0, 0)).toBe('Original');

    // 再滚回去验证下方内容
    await scrollToPosition(page, 0, 50 * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(300);
    expect(await getCellContent(page, 52, 0)).toBe('Scrolled Edit');
  });

  // 需求 3.7, 3.8: 滚动后对合并单元格进行样式变更
  test('滚动后编辑合并单元格并设置样式，渲染正确', async ({ page }) => {
    // 在第 20 行创建合并单元格并设置内容
    await setCellContent(page, 20, 0, 'Scroll Merge');
    await mergeCells(page, 20, 0, 21, 1);

    // 滚动到合并单元格可见的位置
    await scrollToPosition(page, 0, 18 * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(300);

    // 修改合并单元格内容和样式
    await setCellContent(page, 20, 0, 'Styled Merge');
    await setCellBgColor(page, 20, 0, '#90ee90');
    await setCellFontColor(page, 20, 0, '#006400');

    // 验证内容正确
    expect(await getCellContent(page, 20, 0)).toBe('Styled Merge');

    // 截图验证
    await page.waitForTimeout(200);
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('incremental-scroll-merge-style.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  // 需求 3.1: 连续滚动和编辑交替操作，渲染状态正确切换
  test('连续滚动和编辑交替操作，渲染状态正确', async ({ page }) => {
    // 第一次：编辑（增量渲染）
    await setCellContent(page, 0, 0, 'Edit1');

    // 第二次：滚动（全量渲染）
    await scrollToPosition(page, 0, 20 * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(200);

    // 第三次：编辑（增量渲染）
    await setCellContent(page, 22, 0, 'Edit2');

    // 第四次：滚动（全量渲染）
    await scrollToPosition(page, 0, 0);
    await page.waitForTimeout(200);

    // 第五次：编辑（增量渲染）
    await setCellContent(page, 1, 0, 'Edit3');

    // 验证所有编辑内容正确
    expect(await getCellContent(page, 0, 0)).toBe('Edit1');
    expect(await getCellContent(page, 1, 0)).toBe('Edit3');
    expect(await getCellContent(page, 22, 0)).toBe('Edit2');

    // 截图验证最终状态
    await page.waitForTimeout(200);
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('incremental-scroll-edit-alternating.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
