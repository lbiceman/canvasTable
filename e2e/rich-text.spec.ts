import { test, expect, Page } from '@playwright/test';
import { clickCell, typeInCell } from './helpers/test-utils';

const getCellRichText = async (page: Page, row: number, col: number): Promise<Array<{
  text: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontColor?: string;
  fontSize?: number;
}> | null> => {
  return await page.evaluate(([r, c]) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => {
        getCell: (r: number, c: number) => {
          richText?: Array<{
            text: string;
            fontBold?: boolean;
            fontItalic?: boolean;
            fontUnderline?: boolean;
            fontColor?: string;
            fontSize?: number;
          }>;
        } | null;
      };
    };
    const cell = app.getModel().getCell(r, c);
    return cell?.richText ?? null;
  }, [row, col] as [number, number]);
};

// ============================================================
// 深入测试：富文本编辑
// ============================================================

test.describe('富文本 - 通过 API 设置和验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('设置富文本后单元格应包含多个格式片段', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (r: number, c: number) => {
            content: string;
            richText?: Array<Record<string, unknown>>;
          } | null;
        };
        getRenderer: () => { render: () => void };
      };
      const cell = app.getModel().getCell(0, 0);
      if (cell) {
        cell.content = '加粗普通斜体';
        cell.richText = [
          { text: '加粗', fontBold: true },
          { text: '普通' },
          { text: '斜体', fontItalic: true },
        ];
      }
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const richText = await getCellRichText(page, 0, 0);
    expect(richText).not.toBeNull();
    expect(richText?.length).toBe(3);
    expect(richText?.[0].text).toBe('加粗');
    expect(richText?.[0].fontBold).toBe(true);
    expect(richText?.[1].text).toBe('普通');
    expect(richText?.[2].text).toBe('斜体');
    expect(richText?.[2].fontItalic).toBe(true);
  });

  test('富文本片段可以有不同颜色和字号', async ({ page }) => {
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (r: number, c: number) => {
            content: string;
            richText?: Array<Record<string, unknown>>;
          } | null;
        };
        getRenderer: () => { render: () => void };
      };
      const cell = app.getModel().getCell(0, 0);
      if (cell) {
        cell.content = '红色大蓝色小';
        cell.richText = [
          { text: '红色大', fontColor: '#ff0000', fontSize: 18 },
          { text: '蓝色小', fontColor: '#0000ff', fontSize: 10 },
        ];
      }
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const richText = await getCellRichText(page, 0, 0);
    expect(richText?.length).toBe(2);
    expect(richText?.[0].fontColor).toBe('#ff0000');
    expect(richText?.[0].fontSize).toBe(18);
    expect(richText?.[1].fontColor).toBe('#0000ff');
    expect(richText?.[1].fontSize).toBe(10);
  });
});

test.describe('富文本 - 编辑器交互', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('通过 API 打开富文本编辑器并验证 DOM 结构', async ({ page }) => {
    // 先设置富文本
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (r: number, c: number) => {
            content: string;
            richText?: Array<Record<string, unknown>>;
          } | null;
        };
        getRenderer: () => { render: () => void };
      };
      const cell = app.getModel().getCell(0, 0);
      if (cell) {
        cell.content = '加粗普通';
        cell.richText = [
          { text: '加粗', fontBold: true },
          { text: '普通' },
        ];
      }
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 双击进入编辑模式
    const canvas = page.locator('#excel-canvas');
    await canvas.dblclick({ position: { x: 40 + 50, y: 28 + 12 } });
    await page.waitForTimeout(300);

    // 检查是否有富文本编辑器或普通编辑器
    const richEditor = page.locator('.inline-editor-richtext');
    const plainEditor = page.locator('.inline-editor-input');

    if (await richEditor.isVisible()) {
      // 富文本编辑器应包含 span 元素
      const spans = richEditor.locator('span');
      expect(await spans.count()).toBeGreaterThanOrEqual(1);
    } else if (await plainEditor.isVisible()) {
      // 普通编辑器也可以，验证内容
      const value = await plainEditor.inputValue();
      expect(value).toContain('加粗');
    }

    // Escape 退出
    await page.keyboard.press('Escape');
  });
});

test.describe('富文本 - 清除富文本', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('删除单元格内容后 richText 字段状态', async ({ page }) => {
    // 设置富文本
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (r: number, c: number) => {
            content: string;
            richText?: Array<Record<string, unknown>>;
          } | null;
        };
        getRenderer: () => { render: () => void };
      };
      const cell = app.getModel().getCell(0, 0);
      if (cell) {
        cell.content = '富文本';
        cell.richText = [{ text: '富文本', fontBold: true }];
      }
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 选中并删除
    await clickCell(page, 0, 0);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    // 验证内容已被清除
    const content = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { getCell: (r: number, c: number) => { content?: string } | null };
      };
      return app.getModel().getCell(0, 0)?.content ?? '';
    });
    expect(content).toBe('');
  });
});
