import { test, expect, Page } from '@playwright/test';

/**
 * 高 DPI 适配 E2E 测试
 * 需求：4.1, 4.2, 4.3, 4.7
 *
 * 测试覆盖：
 * - 页面加载后 Canvas 元素的物理尺寸与 CSS 尺寸比值等于 DPR
 * - 窗口缩放后 Canvas 尺寸正确更新
 * - 网格线和文本在页面上正常渲染（无明显模糊或错位）
 */

// ============================================================
// 辅助函数
// ============================================================

/**
 * 辅助函数：获取 Canvas 的物理尺寸、CSS 尺寸和当前 DPR
 */
const getCanvasDPRInfo = async (page: Page): Promise<{
  physicalWidth: number;
  physicalHeight: number;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
}> => {
  return await page.evaluate(() => {
    const canvas = document.getElementById('excel-canvas') as HTMLCanvasElement;
    return {
      physicalWidth: canvas.width,
      physicalHeight: canvas.height,
      cssWidth: parseFloat(canvas.style.width),
      cssHeight: parseFloat(canvas.style.height),
      dpr: window.devicePixelRatio,
    };
  });
};

/**
 * 辅助函数：设置单元格内容并触发渲染
 */
const setCellContent = async (page: Page, row: number, col: number, content: string): Promise<void> => {
  await page.evaluate(
    ([r, c, val]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellContent: (row: number, col: number, content: string) => { success: boolean };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellContent(r, c, val);
      app.getRenderer().render();
    },
    [row, col, content] as [number, number, string],
  );
};

/**
 * 辅助函数：触发窗口 resize 并等待渲染更新
 */
const triggerResize = async (page: Page, width: number, height: number): Promise<void> => {
  await page.evaluate(
    ([w, h]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getRenderer: () => {
          resize: (width: number, height: number) => void;
        };
      };
      app.getRenderer().resize(w, h);
    },
    [width, height] as [number, number],
  );
};

// ============================================================
// 测试：高 DPI 适配 - Canvas 物理尺寸与 CSS 尺寸比值
// 需求: 4.1, 4.2
// ============================================================

test.describe('高 DPI 适配 - Canvas 尺寸与 DPR 比值', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 4.1, 4.2: 默认 DPR 下 Canvas 物理尺寸 = CSS 尺寸 × DPR
  test('页面加载后 Canvas 物理尺寸与 CSS 尺寸比值等于 DPR', async ({ page }) => {
    const info = await getCanvasDPRInfo(page);

    // 验证 DPR 为有效正数
    expect(info.dpr).toBeGreaterThan(0);

    // 验证 CSS 尺寸为有效正数
    expect(info.cssWidth).toBeGreaterThan(0);
    expect(info.cssHeight).toBeGreaterThan(0);

    // 验证物理尺寸 = Math.round(CSS 尺寸 × DPR)
    expect(info.physicalWidth).toBe(Math.round(info.cssWidth * info.dpr));
    expect(info.physicalHeight).toBe(Math.round(info.cssHeight * info.dpr));
  });

  // 需求 4.1, 4.2: 使用模拟的 DPR=2 验证高 DPI 适配
  test('DPR=2 时 Canvas 物理尺寸为 CSS 尺寸的 2 倍', async ({ page }) => {
    // 使用 Playwright 的 CDP 协议模拟 DPR=2
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 2,
      mobile: false,
    });

    // 重新加载页面以使 DPR 生效
    await page.reload();
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);

    const info = await getCanvasDPRInfo(page);

    // 验证 DPR 为 2
    expect(info.dpr).toBe(2);

    // 验证物理尺寸 = Math.round(CSS 尺寸 × 2)
    expect(info.physicalWidth).toBe(Math.round(info.cssWidth * 2));
    expect(info.physicalHeight).toBe(Math.round(info.cssHeight * 2));
  });

  // 需求 4.1, 4.2: 使用模拟的 DPR=3 验证高 DPI 适配
  test('DPR=3 时 Canvas 物理尺寸为 CSS 尺寸的 3 倍', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 3,
      mobile: false,
    });

    await page.reload();
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);

    const info = await getCanvasDPRInfo(page);

    // 验证 DPR 为 3
    expect(info.dpr).toBe(3);

    // 验证物理尺寸 = Math.round(CSS 尺寸 × 3)
    expect(info.physicalWidth).toBe(Math.round(info.cssWidth * 3));
    expect(info.physicalHeight).toBe(Math.round(info.cssHeight * 3));
  });
});

// ============================================================
// 测试：高 DPI 适配 - 窗口缩放后 Canvas 尺寸更新
// 需求: 4.7
// ============================================================

test.describe('高 DPI 适配 - 窗口缩放后 Canvas 尺寸更新', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 4.7: 窗口缩放后 Canvas 物理尺寸和 CSS 尺寸同步更新
  test('窗口缩放后 Canvas 尺寸正确更新', async ({ page }) => {
    // 获取初始尺寸
    const initialInfo = await getCanvasDPRInfo(page);

    // 模拟窗口缩放：将 Canvas 尺寸缩小为 800×400
    const newWidth = 800;
    const newHeight = 400;
    await triggerResize(page, newWidth, newHeight);
    await page.waitForTimeout(300);

    // 获取缩放后的尺寸
    const resizedInfo = await getCanvasDPRInfo(page);

    // 验证 CSS 尺寸已更新
    expect(resizedInfo.cssWidth).toBe(newWidth);
    expect(resizedInfo.cssHeight).toBe(newHeight);

    // 验证物理尺寸 = Math.round(新 CSS 尺寸 × DPR)
    expect(resizedInfo.physicalWidth).toBe(Math.round(newWidth * resizedInfo.dpr));
    expect(resizedInfo.physicalHeight).toBe(Math.round(newHeight * resizedInfo.dpr));

    // 验证尺寸确实发生了变化（与初始不同）
    expect(resizedInfo.cssWidth).not.toBe(initialInfo.cssWidth);
  });

  // 需求 4.7: 多次缩放后尺寸始终正确
  test('多次窗口缩放后 Canvas 尺寸始终正确', async ({ page }) => {
    const sizes = [
      { width: 600, height: 300 },
      { width: 1200, height: 600 },
      { width: 900, height: 450 },
    ];

    for (const { width, height } of sizes) {
      await triggerResize(page, width, height);
      await page.waitForTimeout(200);

      const info = await getCanvasDPRInfo(page);

      // 每次缩放后验证 CSS 尺寸和物理尺寸
      expect(info.cssWidth).toBe(width);
      expect(info.cssHeight).toBe(height);
      expect(info.physicalWidth).toBe(Math.round(width * info.dpr));
      expect(info.physicalHeight).toBe(Math.round(height * info.dpr));
    }
  });

  // 需求 4.7: DPR=2 下窗口缩放后尺寸正确
  test('DPR=2 下窗口缩放后 Canvas 尺寸正确', async ({ page }) => {
    // 模拟 DPR=2
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 2,
      mobile: false,
    });

    await page.reload();
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);

    // 缩放到新尺寸
    const newWidth = 700;
    const newHeight = 350;
    await triggerResize(page, newWidth, newHeight);
    await page.waitForTimeout(300);

    const info = await getCanvasDPRInfo(page);

    // 验证 DPR=2 下物理尺寸为 CSS 尺寸的 2 倍
    expect(info.dpr).toBe(2);
    expect(info.cssWidth).toBe(newWidth);
    expect(info.cssHeight).toBe(newHeight);
    expect(info.physicalWidth).toBe(Math.round(newWidth * 2));
    expect(info.physicalHeight).toBe(Math.round(newHeight * 2));
  });
});

// ============================================================
// 测试：高 DPI 适配 - 网格线和文本渲染正常
// 需求: 4.3, 4.7
// ============================================================

test.describe('高 DPI 适配 - 网格线和文本渲染', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 需求 4.3: 默认 DPR 下网格线和文本正常渲染
  test('默认 DPR 下网格线和文本正常渲染', async ({ page }) => {
    // 写入一些测试数据以验证文本渲染
    await setCellContent(page, 0, 0, '测试文本');
    await setCellContent(page, 1, 1, '12345');
    await setCellContent(page, 2, 2, 'Hello World');
    await page.waitForTimeout(300);

    // 截图对比验证网格线和文本渲染无模糊或错位
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('hidpi-default-dpr-render.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  // 需求 4.3: DPR=2 下网格线和文本正常渲染
  test('DPR=2 下网格线和文本正常渲染', async ({ page }) => {
    // 模拟 DPR=2
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 2,
      mobile: false,
    });

    await page.reload();
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);

    // 写入测试数据
    await setCellContent(page, 0, 0, '高清文本');
    await setCellContent(page, 1, 1, '67890');
    await setCellContent(page, 2, 2, 'Retina Test');
    await page.waitForTimeout(300);

    // 截图对比验证高 DPI 下渲染清晰
    const canvas = page.locator('#excel-canvas');
    await expect(canvas).toHaveScreenshot('hidpi-dpr2-render.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  // 需求 4.3, 4.7: ctx.scale 已正确应用（验证绘制上下文变换）
  test('Canvas 绘制上下文的 DPR 缩放已正确应用', async ({ page }) => {
    // 验证 ctx.getTransform() 的缩放分量等于 DPR
    const transform = await page.evaluate(() => {
      const canvas = document.getElementById('excel-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { scaleX: 0, scaleY: 0, dpr: 0 };
      const t = ctx.getTransform();
      return {
        scaleX: t.a,
        scaleY: t.d,
        dpr: window.devicePixelRatio,
      };
    });

    // ctx.scale(dpr, dpr) 后，变换矩阵的 a 和 d 分量应等于 DPR
    expect(transform.scaleX).toBeCloseTo(transform.dpr, 2);
    expect(transform.scaleY).toBeCloseTo(transform.dpr, 2);
  });
});
