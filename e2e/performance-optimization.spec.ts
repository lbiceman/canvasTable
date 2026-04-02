import { test, expect, Page } from '@playwright/test';

/**
 * 性能优化 E2E 测试
 *
 * 覆盖场景：
 * 1. 大数据量渲染帧时间（10万行数据下渲染不超过阈值）
 * 2. 快速滚动流畅性（连续滚动无卡顿）
 * 3. 批量单元格编辑性能（批量写入后渲染正常）
 * 4. 公式批量计算性能（大量公式计算不阻塞 UI）
 * 5. 文本截断渲染性能（长文本单元格不卡顿）
 * 6. 网格线批量绘制性能（合并 path 一次 stroke）
 * 7. 合并单元格渲染性能
 * 8. 条件格式渲染性能
 * 9. 样式密集区域渲染性能（背景色、字体色、边框）
 * 10. 滚动 + 编辑交替操作性能
 */

const LARGE_ROW_COUNT = 100_000;
const DEFAULT_ROW_HEIGHT = 25;

// ============================================================
// 辅助函数
// ============================================================

/** 注入大量数据到模型 */
const injectLargeData = async (page: Page, rowCount: number): Promise<number> => {
  return await page.evaluate((count: number) => {
    const start = performance.now();
    const app = (window as Record<string, unknown>).app as {
      getModel: () => {
        expandRows: (n: number) => void;
        setCellContentNoHistory: (r: number, c: number, v: string) => void;
      };
      getRenderer: () => { render: () => void; updateViewport: () => void };
    };
    const model = app.getModel();
    model.expandRows(count);
    for (let r = 0; r < count; r += 1000) {
      model.setCellContentNoHistory(r, 0, `R${r}`);
    }
    app.getRenderer().updateViewport();
    app.getRenderer().render();
    return performance.now() - start;
  }, rowCount);
};

/** 测量一次完整渲染的帧时间 */
const measureRenderTime = async (page: Page): Promise<number> => {
  return await page.evaluate(() => {
    const app = (window as Record<string, unknown>).app as {
      getRenderer: () => { render: () => void; updateViewport: () => void };
    };
    const renderer = app.getRenderer();
    renderer.updateViewport();
    const start = performance.now();
    renderer.render();
    return performance.now() - start;
  });
};

/** 滚动到指定位置 */
const scrollTo = async (page: Page, x: number, y: number): Promise<void> => {
  await page.evaluate(([sx, sy]) => {
    const app = (window as Record<string, unknown>).app as {
      getRenderer: () => { scrollTo: (x: number, y: number) => void; render: () => void };
    };
    app.getRenderer().scrollTo(sx, sy);
    app.getRenderer().render();
  }, [x, y] as [number, number]);
};

/** 获取视口信息 */
const getViewport = async (page: Page): Promise<{
  startRow: number; endRow: number; startCol: number; endCol: number;
}> => {
  return await page.evaluate(() => {
    const app = (window as Record<string, unknown>).app as {
      getRenderer: () => { getViewport: () => { startRow: number; endRow: number; startCol: number; endCol: number } };
    };
    return app.getRenderer().getViewport();
  });
};

/** 获取单元格内容 */
const getCellContent = async (page: Page, row: number, col: number): Promise<string> => {
  return await page.evaluate(([r, c]) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => { content?: string } | null };
    };
    return app.getModel().getCell(r, c)?.content ?? '';
  }, [row, col] as [number, number]);
};

/** 批量设置单元格内容 */
const batchSetCells = async (
  page: Page,
  updates: Array<{ row: number; col: number; content: string }>
): Promise<number> => {
  return await page.evaluate((ups) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => { setCellContentNoHistory: (r: number, c: number, v: string) => void };
      getRenderer: () => { render: () => void };
    };
    const model = app.getModel();
    const start = performance.now();
    for (const u of ups) {
      model.setCellContentNoHistory(u.row, u.col, u.content);
    }
    app.getRenderer().render();
    return performance.now() - start;
  }, updates);
};

/** 测量连续滚动的平均帧时间 */
const measureScrollPerformance = async (
  page: Page, steps: number, deltaY: number
): Promise<{ avgFrameTime: number; maxFrameTime: number }> => {
  return await page.evaluate(([s, dy]) => {
    const app = (window as Record<string, unknown>).app as {
      getRenderer: () => {
        scrollBy: (dx: number, dy: number) => void;
        render: () => void;
        updateViewport: () => void;
      };
    };
    const renderer = app.getRenderer();
    const frameTimes: number[] = [];
    for (let i = 0; i < s; i++) {
      renderer.scrollBy(0, dy);
      renderer.updateViewport();
      const start = performance.now();
      renderer.render();
      frameTimes.push(performance.now() - start);
    }
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const max = Math.max(...frameTimes);
    return { avgFrameTime: avg, maxFrameTime: max };
  }, [steps, deltaY] as [number, number]);
};

// ============================================================
// 测试组 1：大数据量渲染帧时间
// ============================================================

test.describe('渲染性能 - 大数据量帧时间', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('10万行数据下单帧渲染时间 < 50ms', async ({ page }) => {
    await injectLargeData(page, LARGE_ROW_COUNT);
    await page.waitForTimeout(300);

    // 测量多次渲染取平均值
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = await measureRenderTime(page);
      times.push(t);
    }
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

    // 单帧渲染应在 50ms 以内（留余量，理想 < 16ms）
    expect(avgTime).toBeLessThan(50);
  });

  test('10万行数据下滚动到中间位置后渲染时间 < 50ms', async ({ page }) => {
    await injectLargeData(page, LARGE_ROW_COUNT);
    await scrollTo(page, 0, 50_000 * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(200);

    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });

  test('10万行数据下滚动到底部后渲染时间 < 50ms', async ({ page }) => {
    await injectLargeData(page, LARGE_ROW_COUNT);
    await scrollTo(page, 0, (LARGE_ROW_COUNT - 50) * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(200);

    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });
});

// ============================================================
// 测试组 2：快速滚动流畅性
// ============================================================

test.describe('渲染性能 - 快速滚动流畅性', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await injectLargeData(page, LARGE_ROW_COUNT);
  });

  test('连续 50 步滚动平均帧时间 < 30ms', async ({ page }) => {
    const result = await measureScrollPerformance(page, 50, 500);
    expect(result.avgFrameTime).toBeLessThan(30);
  });

  test('连续 50 步滚动最大帧时间 < 80ms', async ({ page }) => {
    const result = await measureScrollPerformance(page, 50, 500);
    expect(result.maxFrameTime).toBeLessThan(80);
  });

  test('快速连续滚轮事件不导致页面卡死', async ({ page }) => {
    const canvas = page.locator('#excel-canvas');

    // 模拟 30 次快速滚轮事件
    for (let i = 0; i < 30; i++) {
      await canvas.evaluate((el) => {
        el.dispatchEvent(new WheelEvent('wheel', {
          deltaY: 800, bubbles: true, cancelable: true,
        }));
      });
    }

    await page.waitForTimeout(500);

    // 验证页面仍可交互
    const viewport = await getViewport(page);
    expect(viewport.startRow).toBeGreaterThan(0);
    await expect(canvas).toBeVisible();
  });

  test('大幅度跳跃滚动后视口数据正确', async ({ page }) => {
    // 跳到第 80000 行
    await scrollTo(page, 0, 80_000 * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(200);

    const content = await getCellContent(page, 80_000, 0);
    expect(content).toBe('R80000');

    // 跳回第 10000 行
    await scrollTo(page, 0, 10_000 * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(200);

    const content2 = await getCellContent(page, 10_000, 0);
    expect(content2).toBe('R10000');
  });
});

// ============================================================
// 测试组 3：批量单元格编辑性能
// ============================================================

test.describe('渲染性能 - 批量编辑', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('批量写入 1000 个单元格 < 500ms', async ({ page }) => {
    const updates = Array.from({ length: 1000 }, (_, i) => ({
      row: Math.floor(i / 10),
      col: i % 10,
      content: `V${i}`,
    }));

    const elapsed = await batchSetCells(page, updates);
    expect(elapsed).toBeLessThan(500);

    // 验证数据正确
    const first = await getCellContent(page, 0, 0);
    expect(first).toBe('V0');
    const last = await getCellContent(page, 99, 9);
    expect(last).toBe('V999');
  });

  test('批量写入 5000 个单元格 < 2000ms', async ({ page }) => {
    const updates = Array.from({ length: 5000 }, (_, i) => ({
      row: Math.floor(i / 20),
      col: i % 20,
      content: `D${i}`,
    }));

    const elapsed = await batchSetCells(page, updates);
    expect(elapsed).toBeLessThan(2000);
  });

  test('批量写入后渲染帧时间正常', async ({ page }) => {
    const updates = Array.from({ length: 1000 }, (_, i) => ({
      row: Math.floor(i / 10),
      col: i % 10,
      content: `Cell-${i}`,
    }));
    await batchSetCells(page, updates);

    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });
});

// ============================================================
// 测试组 4：公式批量计算性能
// ============================================================

test.describe('计算性能 - 公式批量计算', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('100 个 SUM 公式计算完成 < 5s', async ({ page }) => {
    // 填充源数据
    const dataUpdates = Array.from({ length: 100 }, (_, i) => ({
      row: i, col: 0, content: String(i + 1),
    }));
    await batchSetCells(page, dataUpdates);

    // 设置 100 个 SUM 公式
    const elapsed = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        model.setCellContent(i, 1, `=SUM(A1:A${i + 1})`);
      }
      app.getRenderer().render();
      return performance.now() - start;
    });

    expect(elapsed).toBeLessThan(5000);

    // 等待 Worker 计算完成
    await page.waitForTimeout(3000);

    // 验证最后一个公式结果正确：SUM(1..100) = 5050
    const result = await getCellContent(page, 99, 1);
    expect(result).toBe('5050');
  });

  test('公式依赖更新后重算不阻塞 UI', async ({ page }) => {
    // 设置数据和公式
    await batchSetCells(page, [
      { row: 0, col: 0, content: '10' },
      { row: 1, col: 0, content: '20' },
      { row: 2, col: 0, content: '30' },
    ]);

    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellContent(0, 1, '=SUM(A1:A3)');
      app.getRenderer().render();
    });

    await page.waitForTimeout(2000);
    expect(await getCellContent(page, 0, 1)).toBe('60');

    // 修改源数据并重新设置公式以触发重算
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContent(0, 0, '100');
      // 重新设置公式以触发 Worker 重算
      model.setCellContent(0, 1, '=SUM(A1:A3)');
      app.getRenderer().render();
    });

    // Worker 重算需要时间，轮询等待结果更新
    let updated = '';
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(200);
      updated = await getCellContent(page, 0, 1);
      if (updated === '150') break;
    }

    // 渲染仍然流畅
    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);

    // 结果正确更新
    expect(updated).toBe('150');
  });
});

// ============================================================
// 测试组 5：长文本截断渲染性能
// ============================================================

test.describe('渲染性能 - 长文本截断', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('100 个长文本单元格渲染帧时间 < 50ms', async ({ page }) => {
    // 写入 100 个长文本单元格（每个 200 字符）
    const longText = 'A'.repeat(200);
    const updates = Array.from({ length: 100 }, (_, i) => ({
      row: Math.floor(i / 10),
      col: i % 10,
      content: longText,
    }));
    await batchSetCells(page, updates);

    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });

  test('长文本截断后内容正确显示（不为空）', async ({ page }) => {
    const longText = '这是一段很长的中文文本用于测试截断功能是否正常工作'.repeat(5);
    await batchSetCells(page, [{ row: 0, col: 0, content: longText }]);

    const content = await getCellContent(page, 0, 0);
    expect(content).toBe(longText);

    // 渲染不报错
    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });

  test('混合长短文本渲染性能正常', async ({ page }) => {
    const updates: Array<{ row: number; col: number; content: string }> = [];
    for (let i = 0; i < 200; i++) {
      const isLong = i % 3 === 0;
      updates.push({
        row: Math.floor(i / 10),
        col: i % 10,
        content: isLong ? 'X'.repeat(300) : `Short${i}`,
      });
    }
    await batchSetCells(page, updates);

    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });
});

// ============================================================
// 测试组 6：网格线绘制性能
// ============================================================

test.describe('渲染性能 - 网格线绘制', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('空表格渲染帧时间 < 20ms', async ({ page }) => {
    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(20);
  });

  test('大数据量下网格线渲染不成为瓶颈', async ({ page }) => {
    await injectLargeData(page, 50_000);

    // 滚动到中间位置
    await scrollTo(page, 0, 25_000 * DEFAULT_ROW_HEIGHT);
    await page.waitForTimeout(200);

    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });
});

// ============================================================
// 测试组 7：合并单元格渲染性能
// ============================================================

test.describe('渲染性能 - 合并单元格', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('50 个合并单元格渲染帧时间 < 50ms', async ({ page }) => {
    // 创建 50 个 2x2 合并单元格
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContentNoHistory: (r: number, c: number, v: string) => void;
          mergeCells: (sr: number, sc: number, er: number, ec: number) => boolean;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      for (let i = 0; i < 50; i++) {
        const row = Math.floor(i / 5) * 3;
        const col = (i % 5) * 3;
        model.setCellContentNoHistory(row, col, `Merge${i}`);
        model.mergeCells(row, col, row + 1, col + 1);
      }
      app.getRenderer().render();
    });

    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });

  test('合并单元格内容编辑后渲染正常', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContentNoHistory: (r: number, c: number, v: string) => void;
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
          mergeCells: (sr: number, sc: number, er: number, ec: number) => boolean;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      model.setCellContentNoHistory(0, 0, 'Original');
      model.mergeCells(0, 0, 2, 2);
      app.getRenderer().render();
    });

    // 编辑合并单元格
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellContent(0, 0, 'Updated');
      app.getRenderer().render();
    });

    const content = await getCellContent(page, 0, 0);
    expect(content).toBe('Updated');

    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });
});

// ============================================================
// 测试组 8：条件格式渲染性能
// ============================================================

test.describe('渲染性能 - 条件格式', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('带条件格式的区域渲染帧时间 < 50ms', async ({ page }) => {
    // 填充数据并添加条件格式规则
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContentNoHistory: (r: number, c: number, v: string) => void;
          addConditionalFormat: (rule: {
            id: string; range: { startRow: number; startCol: number; endRow: number; endCol: number };
            condition: { type: string; value: number }; style: { bgColor: string };
          }) => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();

      // 填充 500 个数值单元格
      for (let r = 0; r < 50; r++) {
        for (let c = 0; c < 10; c++) {
          model.setCellContentNoHistory(r, c, String(r * 10 + c));
        }
      }

      // 添加条件格式：大于 250 的单元格标红
      model.addConditionalFormat({
        id: 'cf-perf-test',
        range: { startRow: 0, startCol: 0, endRow: 49, endCol: 9 },
        condition: { type: 'greaterThan', value: 250 },
        style: { bgColor: '#ffcccc' },
      });

      app.getRenderer().render();
    });

    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });
});

// ============================================================
// 测试组 9：样式密集区域渲染性能
// ============================================================

test.describe('渲染性能 - 样式密集区域', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('200 个带样式单元格渲染帧时间 < 50ms', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContentNoHistory: (r: number, c: number, v: string) => void;
          setCellBgColor: (r: number, c: number, color: string) => void;
          setCellFontColor: (r: number, c: number, color: string) => void;
          setCellFontBold: (r: number, c: number, bold: boolean) => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];

      for (let i = 0; i < 200; i++) {
        const r = Math.floor(i / 10);
        const c = i % 10;
        model.setCellContentNoHistory(r, c, `S${i}`);
        model.setCellBgColor(r, c, colors[i % colors.length]);
        model.setCellFontColor(r, c, '#ffffff');
        if (i % 2 === 0) model.setCellFontBold(r, c, true);
      }
      app.getRenderer().render();
    });

    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });

  test('带边框的单元格区域渲染帧时间 < 50ms', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContentNoHistory: (r: number, c: number, v: string) => void;
          setCellBorder: (r: number, c: number, border: {
            top?: { color: string; width: number; style: string };
            bottom?: { color: string; width: number; style: string };
            left?: { color: string; width: number; style: string };
            right?: { color: string; width: number; style: string };
          } | undefined) => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      const border = {
        top: { color: '#000000', width: 1, style: 'solid' },
        bottom: { color: '#000000', width: 1, style: 'solid' },
        left: { color: '#000000', width: 1, style: 'solid' },
        right: { color: '#000000', width: 1, style: 'solid' },
      };

      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 10; c++) {
          model.setCellContentNoHistory(r, c, `B${r}-${c}`);
          model.setCellBorder(r, c, border);
        }
      }
      app.getRenderer().render();
    });

    const renderTime = await measureRenderTime(page);
    expect(renderTime).toBeLessThan(50);
  });
});

// ============================================================
// 测试组 10：滚动 + 编辑交替操作性能
// ============================================================

test.describe('渲染性能 - 滚动与编辑交替', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    await injectLargeData(page, LARGE_ROW_COUNT);
  });

  test('滚动后编辑再滚动，渲染帧时间稳定', async ({ page }) => {
    const frameTimes: number[] = [];

    // 滚动
    await scrollTo(page, 0, 10_000 * DEFAULT_ROW_HEIGHT);
    frameTimes.push(await measureRenderTime(page));

    // 编辑
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellContent(10_000, 0, 'Edited');
      app.getRenderer().render();
    });
    frameTimes.push(await measureRenderTime(page));

    // 再滚动
    await scrollTo(page, 0, 30_000 * DEFAULT_ROW_HEIGHT);
    frameTimes.push(await measureRenderTime(page));

    // 再编辑
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellContent(30_000, 0, 'Edited2');
      app.getRenderer().render();
    });
    frameTimes.push(await measureRenderTime(page));

    // 所有帧时间都应 < 50ms
    for (const t of frameTimes) {
      expect(t).toBeLessThan(50);
    }
  });

  test('交替操作后数据完整性正确', async ({ page }) => {
    // 在不同位置编辑
    await scrollTo(page, 0, 5_000 * DEFAULT_ROW_HEIGHT);
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellContent(5_000, 1, 'Edit-A');
      app.getRenderer().render();
    });

    await scrollTo(page, 0, 50_000 * DEFAULT_ROW_HEIGHT);
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (r: number, c: number, v: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellContent(50_000, 1, 'Edit-B');
      app.getRenderer().render();
    });

    // 验证两处编辑都保留
    expect(await getCellContent(page, 5_000, 1)).toBe('Edit-A');
    expect(await getCellContent(page, 50_000, 1)).toBe('Edit-B');

    // 原始标记数据也保留
    expect(await getCellContent(page, 5_000, 0)).toBe('R5000');
    expect(await getCellContent(page, 50_000, 0)).toBe('R50000');
  });

  test('连续 10 次滚动-编辑循环后页面不卡死', async ({ page }) => {
    for (let i = 0; i < 10; i++) {
      const targetRow = i * 10_000;
      await scrollTo(page, 0, targetRow * DEFAULT_ROW_HEIGHT);

      await page.evaluate(([r]) => {
        const app = (window as Record<string, unknown>).app as {
          getModel: () => {
            setCellContent: (r: number, c: number, v: string) => { success: boolean };
          };
          getRenderer: () => { render: () => void };
        };
        app.getModel().setCellContent(r, 2, `Loop${r}`);
        app.getRenderer().render();
      }, [targetRow] as [number]);
    }

    // 页面仍可交互
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toBeVisible();

    // 最后一次编辑的数据正确
    expect(await getCellContent(page, 90_000, 2)).toBe('Loop90000');
  });
});
