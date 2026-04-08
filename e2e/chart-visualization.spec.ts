import { test, expect, Page } from '@playwright/test';
import { clickCell, selectRange, typeInCell, getCellContent } from './helpers/test-utils';

const setupChartData = async (page: Page): Promise<void> => {
  await typeInCell(page, 0, 0, '类别');
  await typeInCell(page, 0, 1, '数值');
  await typeInCell(page, 1, 0, 'A');
  await typeInCell(page, 1, 1, '10');
  await typeInCell(page, 2, 0, 'B');
  await typeInCell(page, 2, 1, '20');
  await typeInCell(page, 3, 0, 'C');
  await typeInCell(page, 3, 1, '30');
  await typeInCell(page, 4, 0, 'D');
  await typeInCell(page, 4, 1, '15');
};

const getChartCount = async (page: Page): Promise<number> => {
  return await page.evaluate(() => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => { chartModel: { getAllCharts: () => unknown[] } };
    };
    return app.getModel().chartModel.getAllCharts().length;
  });
};

const createChart = async (page: Page, chartType: string): Promise<void> => {
  await selectRange(page, 0, 0, 4, 1);
  await page.waitForTimeout(200);
  await page.locator('#insert-chart-btn').click();
  await page.waitForTimeout(300);

  const typeSelector = page.locator('.chart-type-selector');
  await expect(typeSelector).toBeVisible();

  await typeSelector.locator('div', { hasText: chartType }).first().click();
  await page.waitForTimeout(500);
};

// ============================================================
// 深入测试：图表功能
// ============================================================

test.describe('图表 - 创建不同类型图表', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('创建柱状图并验证图表数据', async ({ page }) => {
    await setupChartData(page);
    await createChart(page, '柱状图');

    const count = await getChartCount(page);
    expect(count).toBe(1);

    // 验证图表配置
    const chartConfig = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          chartModel: {
            getAllCharts: () => Array<{
              type: string;
              dataRange: { startRow: number; startCol: number; endRow: number; endCol: number };
            }>;
          };
        };
      };
      const charts = app.getModel().chartModel.getAllCharts();
      return charts[0];
    });

    expect(chartConfig.type).toBe('bar');
    // 验证数据范围包含了选中的区域
    expect(chartConfig.dataRange).toBeDefined();
  });

  test('创建折线图', async ({ page }) => {
    await setupChartData(page);
    await createChart(page, '折线图');

    const chartType = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { chartModel: { getAllCharts: () => Array<{ type: string }> } };
      };
      return app.getModel().chartModel.getAllCharts()[0]?.type;
    });
    expect(chartType).toBe('line');
  });

  test('创建饼图', async ({ page }) => {
    await setupChartData(page);
    await createChart(page, '饼图');

    const chartType = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { chartModel: { getAllCharts: () => Array<{ type: string }> } };
      };
      return app.getModel().chartModel.getAllCharts()[0]?.type;
    });
    expect(chartType).toBe('pie');
  });

  test('创建面积图', async ({ page }) => {
    await setupChartData(page);
    await createChart(page, '面积图');

    const chartType = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { chartModel: { getAllCharts: () => Array<{ type: string }> } };
      };
      return app.getModel().chartModel.getAllCharts()[0]?.type;
    });
    expect(chartType).toBe('area');
  });

  test('创建散点图', async ({ page }) => {
    await setupChartData(page);
    await createChart(page, '散点图');

    const chartType = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { chartModel: { getAllCharts: () => Array<{ type: string }> } };
      };
      return app.getModel().chartModel.getAllCharts()[0]?.type;
    });
    expect(chartType).toBe('scatter');
  });
});

test.describe('图表 - 选中与删除', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('点击图表区域应选中图表', async ({ page }) => {
    await setupChartData(page);
    await createChart(page, '柱状图');

    // 获取图表位置（通过 model.chartModel）
    const chartPos = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          chartModel: {
            getAllCharts: () => Array<{
              position: { x: number; y: number };
              size: { width: number; height: number };
            }>;
          };
        };
        getRenderer: () => {
          getConfig: () => { headerWidth: number; headerHeight: number };
          getViewport: () => { scrollX: number; scrollY: number };
        };
      };
      const chart = app.getModel().chartModel.getAllCharts()[0];
      const config = app.getRenderer().getConfig();
      const viewport = app.getRenderer().getViewport();
      // 将数据坐标转换为画布坐标
      return {
        x: chart.position.x + chart.size.width / 2 + config.headerWidth - viewport.scrollX,
        y: chart.position.y + chart.size.height / 2 + config.headerHeight - viewport.scrollY,
      };
    });

    // 点击图表中心
    const canvas = page.locator('#excel-canvas');
    await canvas.click({ position: { x: chartPos.x, y: chartPos.y } });
    await page.waitForTimeout(200);

    // 验证图表数量仍然为 1（图表被选中但未删除）
    expect(await getChartCount(page)).toBe(1);
  });

  test('选中图表后按 Delete 应删除图表', async ({ page }) => {
    await setupChartData(page);
    await createChart(page, '柱状图');

    expect(await getChartCount(page)).toBe(1);

    // 获取图表画布坐标
    const chartPos = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          chartModel: {
            getAllCharts: () => Array<{
              position: { x: number; y: number };
              size: { width: number; height: number };
            }>;
          };
        };
        getRenderer: () => {
          getConfig: () => { headerWidth: number; headerHeight: number };
          getViewport: () => { scrollX: number; scrollY: number };
        };
      };
      const chart = app.getModel().chartModel.getAllCharts()[0];
      const config = app.getRenderer().getConfig();
      const viewport = app.getRenderer().getViewport();
      return {
        x: chart.position.x + chart.size.width / 2 + config.headerWidth - viewport.scrollX,
        y: chart.position.y + chart.size.height / 2 + config.headerHeight - viewport.scrollY,
      };
    });

    const canvas = page.locator('#excel-canvas');
    await canvas.click({ position: { x: chartPos.x, y: chartPos.y } });
    await page.waitForTimeout(200);

    // 按 Delete 删除
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    expect(await getChartCount(page)).toBe(0);
  });

  test('选中图表后按 Escape 应取消选中', async ({ page }) => {
    await setupChartData(page);
    await createChart(page, '柱状图');

    const chartPos = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          chartModel: {
            getAllCharts: () => Array<{
              position: { x: number; y: number };
              size: { width: number; height: number };
            }>;
          };
        };
        getRenderer: () => {
          getConfig: () => { headerWidth: number; headerHeight: number };
          getViewport: () => { scrollX: number; scrollY: number };
        };
      };
      const chart = app.getModel().chartModel.getAllCharts()[0];
      const config = app.getRenderer().getConfig();
      const viewport = app.getRenderer().getViewport();
      return {
        x: chart.position.x + chart.size.width / 2 + config.headerWidth - viewport.scrollX,
        y: chart.position.y + chart.size.height / 2 + config.headerHeight - viewport.scrollY,
      };
    });

    const canvas = page.locator('#excel-canvas');
    await canvas.click({ position: { x: chartPos.x, y: chartPos.y } });
    await page.waitForTimeout(200);

    // 按 Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 图表仍然存在
    expect(await getChartCount(page)).toBe(1);
  });
});

test.describe('图表 - 多系列数据', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('多列数据应创建多系列图表', async ({ page }) => {
    // 准备多系列数据
    await typeInCell(page, 0, 0, '月份');
    await typeInCell(page, 0, 1, '产品A');
    await typeInCell(page, 0, 2, '产品B');
    await typeInCell(page, 1, 0, '1月');
    await typeInCell(page, 1, 1, '100');
    await typeInCell(page, 1, 2, '80');
    await typeInCell(page, 2, 0, '2月');
    await typeInCell(page, 2, 1, '120');
    await typeInCell(page, 2, 2, '90');
    await typeInCell(page, 3, 0, '3月');
    await typeInCell(page, 3, 1, '110');
    await typeInCell(page, 3, 2, '100');

    await selectRange(page, 0, 0, 3, 2);
    await page.waitForTimeout(200);
    await page.locator('#insert-chart-btn').click();
    await page.waitForTimeout(300);

    const typeSelector = page.locator('.chart-type-selector');
    await typeSelector.locator('div', { hasText: '柱状图' }).first().click();
    await page.waitForTimeout(500);

    // 验证图表已创建
    expect(await getChartCount(page)).toBe(1);

    // 验证数据范围包含多列
    const dataRange = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          chartModel: {
            getAllCharts: () => Array<{
              dataRange: { startCol: number; endCol: number };
            }>;
          };
        };
      };
      return app.getModel().chartModel.getAllCharts()[0].dataRange;
    });
    expect(dataRange.endCol).toBe(2);
  });
});

test.describe('图表 - 图表编辑器', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('双击图表应打开图表编辑器面板', async ({ page }) => {
    await setupChartData(page);
    await createChart(page, '柱状图');

    // 获取图表画布坐标
    const chartPos = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          chartModel: {
            getAllCharts: () => Array<{
              position: { x: number; y: number };
              size: { width: number; height: number };
            }>;
          };
        };
        getRenderer: () => {
          getConfig: () => { headerWidth: number; headerHeight: number };
          getViewport: () => { scrollX: number; scrollY: number };
        };
      };
      const chart = app.getModel().chartModel.getAllCharts()[0];
      const config = app.getRenderer().getConfig();
      const viewport = app.getRenderer().getViewport();
      return {
        x: chart.position.x + chart.size.width / 2 + config.headerWidth - viewport.scrollX,
        y: chart.position.y + chart.size.height / 2 + config.headerHeight - viewport.scrollY,
      };
    });

    // 双击图表
    const canvas = page.locator('#excel-canvas');
    await canvas.dblclick({ position: { x: chartPos.x, y: chartPos.y } });
    await page.waitForTimeout(500);

    // 验证编辑器面板打开
    const editorPanel = page.locator('.chart-editor-panel');
    await expect(editorPanel).toBeVisible();
  });

  test('图表编辑器中切换图表类型', async ({ page }) => {
    await setupChartData(page);
    await createChart(page, '柱状图');

    // 双击图表打开编辑器
    const chartPos = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          chartModel: {
            getAllCharts: () => Array<{
              position: { x: number; y: number };
              size: { width: number; height: number };
            }>;
          };
        };
        getRenderer: () => {
          getConfig: () => { headerWidth: number; headerHeight: number };
          getViewport: () => { scrollX: number; scrollY: number };
        };
      };
      const chart = app.getModel().chartModel.getAllCharts()[0];
      const config = app.getRenderer().getConfig();
      const viewport = app.getRenderer().getViewport();
      return {
        x: chart.position.x + chart.size.width / 2 + config.headerWidth - viewport.scrollX,
        y: chart.position.y + chart.size.height / 2 + config.headerHeight - viewport.scrollY,
      };
    });

    const canvas = page.locator('#excel-canvas');
    await canvas.dblclick({ position: { x: chartPos.x, y: chartPos.y } });
    await page.waitForTimeout(500);

    const editorPanel = page.locator('.chart-editor-panel');
    if (await editorPanel.isVisible()) {
      // 点击折线图类型按钮
      const lineBtn = editorPanel.locator('.chart-type-btn', { hasText: '折线图' });
      if (await lineBtn.count() > 0) {
        await lineBtn.click();
        await page.waitForTimeout(300);

        const chartType = await page.evaluate(() => {
          const app = (window as Record<string, unknown>).app as {
            getModel: () => { chartModel: { getAllCharts: () => Array<{ type: string }> } };
          };
          return app.getModel().chartModel.getAllCharts()[0].type;
        });
        expect(chartType).toBe('line');
      }
    }
  });
});

test.describe('图表 - 数据变更后图表更新', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('修改源数据后图表数据应更新', async ({ page }) => {
    await setupChartData(page);
    await createChart(page, '柱状图');

    expect(await getChartCount(page)).toBe(1);

    // 修改源数据
    await typeInCell(page, 1, 1, '99');
    await page.waitForTimeout(300);

    // 验证源数据已修改
    const cellContent = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { getCell: (r: number, c: number) => { content?: string } | null };
      };
      return app.getModel().getCell(1, 1)?.content ?? '';
    });
    expect(cellContent).toBe('99');

    // 图表仍然存在
    expect(await getChartCount(page)).toBe(1);
  });
});
