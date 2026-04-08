import { test, expect, Page } from '@playwright/test';
import { clickCell } from './helpers/test-utils';

/** 获取内嵌图片数据（本文件特有，返回结构与共享 getCellData 不同） */
const getCellData = async (page: Page, row: number, col: number): Promise<Record<string, unknown>> => {
  return await page.evaluate(([r, c]) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => Record<string, unknown> | null };
    };
    const cell = app.getModel().getCell(r, c);
    if (!cell) return {};
    return {
      embeddedImage: cell.embeddedImage ? {
        base64Data: (cell.embeddedImage as Record<string, unknown>).base64Data ? 'exists' : undefined,
        originalWidth: (cell.embeddedImage as Record<string, unknown>).originalWidth,
        originalHeight: (cell.embeddedImage as Record<string, unknown>).originalHeight,
        displayWidth: (cell.embeddedImage as Record<string, unknown>).displayWidth,
        displayHeight: (cell.embeddedImage as Record<string, unknown>).displayHeight,
      } : null,
    };
  }, [row, col] as [number, number]);
};

/**
 * 通过 API 设置单元格内嵌图片
 */
const setEmbeddedImage = async (
  page: Page, row: number, col: number,
  width: number, height: number
): Promise<void> => {
  await page.evaluate(([r, c, w, h]) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => Record<string, unknown> | null };
      getRenderer: () => { render: () => void };
    };
    const cell = app.getModel().getCell(r, c);
    if (cell) {
      // 创建一个 1x1 像素的最小 PNG base64
      cell.embeddedImage = {
        base64Data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        originalWidth: w,
        originalHeight: h,
      };
    }
    app.getRenderer().render();
  }, [row, col, width, height] as [number, number, number, number]);
  await page.waitForTimeout(300);
};

// ============================================================
// 深入测试：内嵌图片
// ============================================================

test.describe('内嵌图片 - 通过 API 设置和验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('设置内嵌图片后单元格应包含图片数据', async ({ page }) => {
    await setEmbeddedImage(page, 0, 0, 200, 150);

    const data = await getCellData(page, 0, 0);
    expect(data.embeddedImage).not.toBeNull();
    const img = data.embeddedImage as Record<string, unknown>;
    expect(img.base64Data).toBe('exists');
    expect(img.originalWidth).toBe(200);
    expect(img.originalHeight).toBe(150);
  });

  test('设置自定义显示尺寸', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { getCell: (r: number, c: number) => Record<string, unknown> | null };
        getRenderer: () => { render: () => void };
      };
      const cell = app.getModel().getCell(0, 0);
      if (cell) {
        cell.embeddedImage = {
          base64Data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          originalWidth: 400,
          originalHeight: 300,
          displayWidth: 100,
          displayHeight: 75,
        };
      }
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const data = await getCellData(page, 0, 0);
    const img = data.embeddedImage as Record<string, unknown>;
    expect(img.displayWidth).toBe(100);
    expect(img.displayHeight).toBe(75);
  });

  test('删除内嵌图片', async ({ page }) => {
    await setEmbeddedImage(page, 0, 0, 200, 150);

    // 验证图片存在
    let data = await getCellData(page, 0, 0);
    expect(data.embeddedImage).not.toBeNull();

    // 通过 API 删除
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { getCell: (r: number, c: number) => Record<string, unknown> | null };
        getRenderer: () => { render: () => void };
      };
      const cell = app.getModel().getCell(0, 0);
      if (cell) {
        cell.embeddedImage = undefined;
      }
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    data = await getCellData(page, 0, 0);
    expect(data.embeddedImage).toBeNull();
  });
});

test.describe('内嵌图片 - 多个单元格图片', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('多个单元格可以同时包含不同图片', async ({ page }) => {
    await setEmbeddedImage(page, 0, 0, 200, 150);
    await setEmbeddedImage(page, 1, 0, 300, 200);
    await setEmbeddedImage(page, 0, 1, 100, 100);

    const data1 = await getCellData(page, 0, 0);
    const data2 = await getCellData(page, 1, 0);
    const data3 = await getCellData(page, 0, 1);

    expect(data1.embeddedImage).not.toBeNull();
    expect(data2.embeddedImage).not.toBeNull();
    expect(data3.embeddedImage).not.toBeNull();

    expect((data1.embeddedImage as Record<string, unknown>).originalWidth).toBe(200);
    expect((data2.embeddedImage as Record<string, unknown>).originalWidth).toBe(300);
    expect((data3.embeddedImage as Record<string, unknown>).originalWidth).toBe(100);
  });
});
