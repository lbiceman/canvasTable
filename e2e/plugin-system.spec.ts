import { test, expect, Page } from '@playwright/test';
import { clickCell, getCellContent } from './helpers/test-utils';

// ============================================================
// 深入测试：插件系统
// ============================================================

test.describe('插件系统 - 注册与激活', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('注册有效插件应成功激活', async ({ page }) => {
    const result = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getPluginManager: () => {
          registerPlugin: (plugin: {
            name: string; version: string;
            activate: (api: Record<string, unknown>) => void;
          }) => void;
          getPlugins: () => Array<{ name: string; version: string; status: string }>;
        };
      };

      app.getPluginManager().registerPlugin({
        name: 'test-plugin',
        version: '1.0.0',
        activate: () => { /* 空操作 */ },
      });

      return app.getPluginManager().getPlugins();
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    const testPlugin = result.find(p => p.name === 'test-plugin');
    expect(testPlugin).toBeDefined();
    expect(testPlugin?.status).toBe('active');
    expect(testPlugin?.version).toBe('1.0.0');
  });

  test('插件 activate 中可以通过 API 读写单元格', async ({ page }) => {
    const result = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getPluginManager: () => {
          registerPlugin: (plugin: {
            name: string; version: string;
            activate: (api: {
              setCellValue: (r: number, c: number, v: string) => void;
              getCellValue: (r: number, c: number) => string;
            }) => void;
          }) => void;
          getPlugins: () => Array<{ name: string; status: string }>;
        };
        getRenderer: () => { render: () => void };
      };

      let readValue = '';

      app.getPluginManager().registerPlugin({
        name: 'data-plugin',
        version: '1.0.0',
        activate: (api) => {
          api.setCellValue(0, 0, '插件写入');
          readValue = api.getCellValue(0, 0);
        },
      });
      app.getRenderer().render();

      const plugins = app.getPluginManager().getPlugins();
      const plugin = plugins.find(p => p.name === 'data-plugin');

      return { status: plugin?.status, readValue };
    });

    expect(result.status).toBe('active');
    expect(result.readValue).toBe('插件写入');

    const content = await getCellContent(page, 0, 0);
    expect(content).toBe('插件写入');
  });

  test('插件 activate 抛出异常应标记为 failed 状态', async ({ page }) => {
    const result = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getPluginManager: () => {
          registerPlugin: (plugin: {
            name: string; version: string;
            activate: () => void;
          }) => void;
          getPlugins: () => Array<{ name: string; status: string }>;
        };
      };

      app.getPluginManager().registerPlugin({
        name: 'bad-plugin',
        version: '1.0.0',
        activate: () => { throw new Error('激活失败'); },
      });

      return app.getPluginManager().getPlugins();
    });

    const badPlugin = result.find(p => p.name === 'bad-plugin');
    expect(badPlugin).toBeDefined();
    expect(badPlugin?.status).toBe('failed');
  });
});

test.describe('插件系统 - 验证与错误处理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('缺少 name 字段应抛出错误', async ({ page }) => {
    const error = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getPluginManager: () => {
          registerPlugin: (plugin: Record<string, unknown>) => void;
        };
      };

      try {
        app.getPluginManager().registerPlugin({
          version: '1.0.0',
          activate: () => {},
        } as unknown as { name: string; version: string; activate: () => void });
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });

    expect(error).not.toBeNull();
    expect(error).toContain('name');
  });

  test('缺少 version 字段应抛出错误', async ({ page }) => {
    const error = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getPluginManager: () => {
          registerPlugin: (plugin: Record<string, unknown>) => void;
        };
      };

      try {
        app.getPluginManager().registerPlugin({
          name: 'no-version',
          activate: () => {},
        } as unknown as { name: string; version: string; activate: () => void });
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });

    expect(error).not.toBeNull();
    expect(error).toContain('version');
  });

  test('重复注册同名插件应抛出错误', async ({ page }) => {
    const error = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getPluginManager: () => {
          registerPlugin: (plugin: {
            name: string; version: string; activate: () => void;
          }) => void;
        };
      };

      app.getPluginManager().registerPlugin({
        name: 'dup-plugin',
        version: '1.0.0',
        activate: () => {},
      });

      try {
        app.getPluginManager().registerPlugin({
          name: 'dup-plugin',
          version: '2.0.0',
          activate: () => {},
        });
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    });

    expect(error).not.toBeNull();
    expect(error).toContain('dup-plugin');
  });
});

test.describe('插件系统 - 卸载', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('卸载插件应调用 deactivate 并标记为 unloaded', async ({ page }) => {
    const result = await page.evaluate(() => {
      let deactivateCalled = false;

      const app = (window as Record<string, unknown>).app as {
        getPluginManager: () => {
          registerPlugin: (plugin: {
            name: string; version: string;
            activate: () => void;
            deactivate: () => void;
          }) => void;
          unloadPlugin: (name: string) => void;
          getPlugins: () => Array<{ name: string; status: string }>;
        };
      };

      app.getPluginManager().registerPlugin({
        name: 'unload-test',
        version: '1.0.0',
        activate: () => {},
        deactivate: () => { deactivateCalled = true; },
      });

      app.getPluginManager().unloadPlugin('unload-test');

      const plugins = app.getPluginManager().getPlugins();
      const plugin = plugins.find(p => p.name === 'unload-test');

      return { deactivateCalled, status: plugin?.status };
    });

    expect(result.deactivateCalled).toBe(true);
    expect(result.status).toBe('unloaded');
  });
});

test.describe('插件系统 - 工具栏按钮', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('插件可以添加工具栏按钮', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getPluginManager: () => {
          registerPlugin: (plugin: {
            name: string; version: string;
            activate: (api: {
              addToolbarButton: (config: { label: string; onClick: () => void }) => HTMLButtonElement;
            }) => void;
          }) => void;
        };
      };

      app.getPluginManager().registerPlugin({
        name: 'toolbar-plugin',
        version: '1.0.0',
        activate: (api) => {
          api.addToolbarButton({
            label: '插件按钮',
            onClick: () => {
              // 点击时设置单元格
              const appRef = (window as Record<string, unknown>).app as {
                getModel: () => { getCell: (r: number, c: number) => { content: string } };
                getRenderer: () => { render: () => void };
              };
              appRef.getModel().getCell(0, 0).content = '按钮点击';
              appRef.getRenderer().render();
            },
          });
        },
      });
    });
    await page.waitForTimeout(300);

    // 验证按钮已添加
    const pluginBtn = page.locator('button', { hasText: '插件按钮' });
    await expect(pluginBtn).toBeVisible();

    // 点击按钮
    await pluginBtn.click();
    await page.waitForTimeout(300);

    const content = await getCellContent(page, 0, 0);
    expect(content).toBe('按钮点击');
  });

  test('卸载插件应移除其添加的工具栏按钮', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getPluginManager: () => {
          registerPlugin: (plugin: {
            name: string; version: string;
            activate: (api: {
              addToolbarButton: (config: { label: string; onClick: () => void }) => HTMLButtonElement;
            }) => void;
          }) => void;
          unloadPlugin: (name: string) => void;
        };
      };

      app.getPluginManager().registerPlugin({
        name: 'removable-plugin',
        version: '1.0.0',
        activate: (api) => {
          api.addToolbarButton({
            label: '可移除按钮',
            onClick: () => {},
          });
        },
      });
    });
    await page.waitForTimeout(300);

    // 验证按钮存在
    let btn = page.locator('button', { hasText: '可移除按钮' });
    await expect(btn).toBeVisible();

    // 卸载插件
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getPluginManager: () => { unloadPlugin: (name: string) => void };
      };
      app.getPluginManager().unloadPlugin('removable-plugin');
    });
    await page.waitForTimeout(300);

    // 按钮应被移除
    btn = page.locator('button', { hasText: '可移除按钮' });
    await expect(btn).toHaveCount(0);
  });
});
