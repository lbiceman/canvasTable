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
 * 辅助函数：通过 window.app 注册一个有效插件
 * 该插件会添加一个工具栏按钮和一个右键菜单项
 */
const registerTestPlugin = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).app;
    const pm = app.getPluginManager();
    pm.registerPlugin({
      name: 'test-plugin',
      version: '1.0.0',
      activate(api: { addToolbarButton: Function; addContextMenuItem: Function }) {
        api.addToolbarButton({
          label: '测试按钮',
          icon: '🧪',
          onClick: () => { /* noop */ },
        });
        api.addContextMenuItem({
          label: '测试菜单项',
          onClick: () => { /* noop */ },
        });
      },
      deactivate() { /* noop */ },
    });
  });
};

test.describe('插件系统 - 注册有效插件', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 测试通过 window.app 注册一个有效插件，验证 getPlugins 返回 active 状态
  // 需求: 3.1, 3.4, 3.7
  test('注册有效插件后 getPlugins 返回 active 状态', async ({ page }) => {
    await registerTestPlugin(page);

    const plugins = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).app;
      return app.getPluginManager().getPlugins();
    });

    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe('test-plugin');
    expect(plugins[0].version).toBe('1.0.0');
    expect(plugins[0].status).toBe('active');
  });
});

test.describe('插件系统 - 工具栏按钮', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 测试插件添加工具栏按钮（按钮可见且可点击）
  // 需求: 3.2
  test('插件添加的工具栏按钮可见且可点击', async ({ page }) => {
    await registerTestPlugin(page);
    await page.waitForTimeout(300);

    // 验证工具栏中出现插件按钮
    const pluginBtn = page.locator('.plugin-toolbar-btn', { hasText: '测试按钮' });
    await expect(pluginBtn).toBeVisible();

    // 验证按钮可点击（不抛出异常）
    await pluginBtn.click();

    // 截图对比
    const toolbar = page.locator('.toolbar');
    await expect(toolbar).toHaveScreenshot('plugin-toolbar-button.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('插件系统 - 右键菜单项', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 测试插件添加右键菜单项（菜单项可见且可点击）
  // 需求: 3.2
  test('插件添加的右键菜单项可见且可点击', async ({ page }) => {
    await registerTestPlugin(page);
    await page.waitForTimeout(300);

    // 右键点击单元格打开菜单
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    // 验证菜单中包含插件添加的菜单项
    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    const pluginMenuItem = menu.locator('.cell-context-menu-item', { hasText: '测试菜单项' });
    await expect(pluginMenuItem).toBeVisible();

    // 点击菜单项（不抛出异常）
    await pluginMenuItem.click();
  });
});

test.describe('插件系统 - 卸载插件', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 测试卸载插件后工具栏按钮和菜单项被移除
  // 需求: 3.5
  test('卸载插件后工具栏按钮和菜单项被移除', async ({ page }) => {
    await registerTestPlugin(page);
    await page.waitForTimeout(300);

    // 确认按钮存在
    const pluginBtn = page.locator('.plugin-toolbar-btn', { hasText: '测试按钮' });
    await expect(pluginBtn).toBeVisible();

    // 卸载插件
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).app;
      app.getPluginManager().unloadPlugin('test-plugin');
    });
    await page.waitForTimeout(300);

    // 验证工具栏按钮已移除
    await expect(pluginBtn).toHaveCount(0);

    // 验证插件状态变为 unloaded
    const plugins = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).app;
      return app.getPluginManager().getPlugins();
    });
    const testPlugin = plugins.find((p: { name: string }) => p.name === 'test-plugin');
    expect(testPlugin).toBeDefined();
    expect(testPlugin.status).toBe('unloaded');

    // 右键打开菜单，验证插件菜单项已移除
    await rightClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const menu = page.locator('.cell-context-menu');
    await expect(menu).toBeVisible();

    const pluginMenuItem = menu.locator('.cell-context-menu-item', { hasText: '测试菜单项' });
    await expect(pluginMenuItem).toHaveCount(0);

    // 截图对比 - 卸载后的工具栏
    const toolbar = page.locator('.toolbar');
    await expect(toolbar).toHaveScreenshot('plugin-unloaded-toolbar.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe('插件系统 - 注册无效插件', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 测试注册缺少必要字段的插件抛出错误
  // 需求: 3.3
  test('注册缺少 name 字段的插件抛出错误', async ({ page }) => {
    const result = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).app;
      const pm = app.getPluginManager();
      try {
        pm.registerPlugin({
          version: '1.0.0',
          activate() { /* noop */ },
        });
        return { threw: false };
      } catch (e: unknown) {
        return { threw: true, message: (e as Error).message };
      }
    });

    expect(result.threw).toBe(true);
    expect(result.message).toContain('name');
  });

  test('注册缺少 version 字段的插件抛出错误', async ({ page }) => {
    const result = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).app;
      const pm = app.getPluginManager();
      try {
        pm.registerPlugin({
          name: 'bad-plugin',
          activate() { /* noop */ },
        });
        return { threw: false };
      } catch (e: unknown) {
        return { threw: true, message: (e as Error).message };
      }
    });

    expect(result.threw).toBe(true);
    expect(result.message).toContain('version');
  });

  test('注册缺少 activate 方法的插件抛出错误', async ({ page }) => {
    const result = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).app;
      const pm = app.getPluginManager();
      try {
        pm.registerPlugin({
          name: 'bad-plugin',
          version: '1.0.0',
        });
        return { threw: false };
      } catch (e: unknown) {
        return { threw: true, message: (e as Error).message };
      }
    });

    expect(result.threw).toBe(true);
    expect(result.message).toContain('activate');
  });

  test('无效插件不出现在 getPlugins 列表中', async ({ page }) => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).app;
      const pm = app.getPluginManager();
      try {
        pm.registerPlugin({ version: '1.0.0', activate() {} });
      } catch { /* 预期抛出 */ }
    });

    const plugins = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).app;
      return app.getPluginManager().getPlugins();
    });

    expect(plugins).toHaveLength(0);
  });
});

test.describe('插件系统 - activate 异常处理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // 测试插件 activate 异常时标记为 failed 状态
  // 需求: 3.6
  test('activate 抛出异常的插件标记为 failed 状态', async ({ page }) => {
    const result = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (window as any).app;
      const pm = app.getPluginManager();

      // 注册一个 activate 会抛出异常的插件（registerPlugin 本身不应抛出）
      let threw = false;
      try {
        pm.registerPlugin({
          name: 'failing-plugin',
          version: '1.0.0',
          activate() {
            throw new Error('插件激活失败');
          },
        });
      } catch {
        threw = true;
      }

      const plugins = pm.getPlugins();
      return { threw, plugins };
    });

    // registerPlugin 不应向外抛出异常（异常被内部捕获）
    expect(result.threw).toBe(false);

    // 插件应出现在列表中，状态为 failed
    const failingPlugin = result.plugins.find(
      (p: { name: string }) => p.name === 'failing-plugin',
    );
    expect(failingPlugin).toBeDefined();
    expect(failingPlugin.status).toBe('failed');
  });
});
