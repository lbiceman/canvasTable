import { test, expect } from '@playwright/test';
import {
  clickCell, typeInCell, getCellData, selectRange,
  waitForApp, setCellContent, dragSelectRange,
  HEADER_WIDTH, HEADER_HEIGHT, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT,
} from './helpers/test-utils';

/**
 * TODO 第二轮功能 E2E 测试
 * 覆盖：Ctrl+S 保存、Ctrl+P 打印、批注 tooltip、数据验证对话框、
 *       状态栏统计、公式栏名称框、HistoryAction 类型安全
 */

test.describe('Ctrl+S 保存快捷键', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('Ctrl+S 保存数据并显示 toast 提示', async ({ page }) => {
    // 输入一些数据
    await typeInCell(page, 0, 0, '保存测试');
    await clickCell(page, 1, 0);

    // 按 Ctrl+S
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(300);

    // 验证 toast 出现
    const toast = page.locator('.save-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveText('已保存');

    // 等待 toast 消失（2秒 + 动画时间）
    await page.waitForTimeout(2500);
    await expect(toast).not.toBeVisible();
  });

  test('Ctrl+S 阻止浏览器默认保存行为', async ({ page }) => {
    // 输入数据
    await typeInCell(page, 0, 0, '测试');
    await clickCell(page, 1, 0);

    // 按 Ctrl+S 不应弹出浏览器保存对话框
    // 如果 preventDefault 没有生效，浏览器会弹出保存对话框导致测试超时
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // 验证 toast 出现（说明我们的处理器执行了）
    const toast = page.locator('.save-toast');
    await expect(toast).toBeVisible();
  });

  test('在输入框聚焦时 Ctrl+S 也能保存', async ({ page }) => {
    // 聚焦到公式栏输入框
    const formulaInput = page.locator('.formula-input');
    await formulaInput.click();
    await page.waitForTimeout(100);

    // 按 Ctrl+S
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(300);

    // 验证 toast 出现
    const toast = page.locator('.save-toast');
    await expect(toast).toBeVisible();
  });
});

test.describe('Ctrl+P 打印快捷键', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('Ctrl+P 打开打印预览对话框', async ({ page }) => {
    await clickCell(page, 0, 0);

    // 按 Ctrl+P
    await page.keyboard.press('Control+p');
    await page.waitForTimeout(500);

    // 验证打印预览对话框出现
    const printDialog = page.locator('.print-preview-overlay');
    await expect(printDialog).toBeVisible();
  });

  test('在输入框聚焦时 Ctrl+P 也能打开打印预览', async ({ page }) => {
    const formulaInput = page.locator('.formula-input');
    await formulaInput.click();
    await page.waitForTimeout(100);

    await page.keyboard.press('Control+p');
    await page.waitForTimeout(500);

    const printDialog = page.locator('.print-preview-overlay');
    await expect(printDialog).toBeVisible();
  });
});

test.describe('批注悬浮预览', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('鼠标悬停有批注的单元格时显示 tooltip', async ({ page }) => {
    // 通过 API 设置批注
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { setCellComment: (r: number, c: number, comment: string) => void };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellComment(0, 0, '这是一条测试批注');
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 将鼠标移到该单元格上
    const canvas = page.locator('#excel-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    const x = box.x + HEADER_WIDTH + DEFAULT_COL_WIDTH / 2;
    const y = box.y + HEADER_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
    await page.mouse.move(x, y);
    await page.waitForTimeout(300);

    // 验证 tooltip 出现
    const tooltip = page.locator('.comment-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText('这是一条测试批注');
  });

  test('鼠标移开后 tooltip 消失', async ({ page }) => {
    // 设置批注
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { setCellComment: (r: number, c: number, comment: string) => void };
        getRenderer: () => { render: () => void };
      };
      app.getModel().setCellComment(0, 0, '批注内容');
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 移到有批注的单元格
    const canvas = page.locator('#excel-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    await page.mouse.move(
      box.x + HEADER_WIDTH + DEFAULT_COL_WIDTH / 2,
      box.y + HEADER_HEIGHT + DEFAULT_ROW_HEIGHT / 2
    );
    await page.waitForTimeout(300);

    const tooltip = page.locator('.comment-tooltip');
    await expect(tooltip).toBeVisible();

    // 移到没有批注的单元格
    await page.mouse.move(
      box.x + HEADER_WIDTH + DEFAULT_COL_WIDTH * 3 + DEFAULT_COL_WIDTH / 2,
      box.y + HEADER_HEIGHT + DEFAULT_ROW_HEIGHT * 3 + DEFAULT_ROW_HEIGHT / 2
    );
    await page.waitForTimeout(300);

    await expect(tooltip).not.toBeVisible();
  });
});

test.describe('数据验证对话框', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('工具栏"数据验证"按钮存在', async ({ page }) => {
    const btn = page.locator('#validation-btn');
    await expect(btn).toBeVisible();
  });

  test('点击"数据验证"按钮打开对话框', async ({ page }) => {
    await clickCell(page, 0, 0);
    const btn = page.locator('#validation-btn');
    await btn.click();
    await page.waitForTimeout(300);

    // 验证对话框出现
    const overlay = page.locator('.format-dialog-overlay');
    await expect(overlay).toBeVisible();

    // 验证标题
    const title = page.locator('.format-dialog-title');
    await expect(title).toContainText('数据验证');
  });

  test('设置下拉列表验证规则', async ({ page }) => {
    await clickCell(page, 0, 0);
    const btn = page.locator('#validation-btn');
    await btn.click();
    await page.waitForTimeout(300);

    // 默认类型应该是下拉列表
    // 输入选项
    const optionsInput = page.locator('.format-dialog-overlay .format-dialog-input').first();
    await optionsInput.fill('选项A, 选项B, 选项C');

    // 点击确定
    const confirmBtn = page.locator('.format-dialog-btn-primary');
    await confirmBtn.click();
    await page.waitForTimeout(300);

    // 验证规则已设置
    const cellData = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { getCell: (r: number, c: number) => Record<string, unknown> | null };
      };
      const cell = app.getModel().getCell(0, 0);
      return cell?.validation as Record<string, unknown> | undefined;
    });
    expect(cellData).toBeDefined();
    expect(cellData?.type).toBe('dropdown');
  });

  test('清除验证按钮清除已有规则', async ({ page }) => {
    // 先设置验证规则
    await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { setCellValidation: (r: number, c: number, rule: unknown) => void };
      };
      app.getModel().setCellValidation(0, 0, {
        type: 'dropdown',
        mode: 'block',
        options: ['A', 'B'],
      });
    });

    await clickCell(page, 0, 0);
    const btn = page.locator('#validation-btn');
    await btn.click();
    await page.waitForTimeout(300);

    // 点击清除验证
    const clearBtn = page.locator('.format-dialog-btn', { hasText: '清除验证' });
    await clearBtn.click();
    await page.waitForTimeout(300);

    // 验证规则已清除
    const cellData = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => { getCell: (r: number, c: number) => Record<string, unknown> | null };
      };
      const cell = app.getModel().getCell(0, 0);
      return cell?.validation;
    });
    expect(cellData).toBeUndefined();
  });

  test('Escape 关闭对话框', async ({ page }) => {
    await clickCell(page, 0, 0);
    const btn = page.locator('#validation-btn');
    await btn.click();
    await page.waitForTimeout(300);

    const overlay = page.locator('.format-dialog-overlay');
    await expect(overlay).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await expect(overlay).not.toBeVisible();
  });
});

test.describe('状态栏选区统计', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('选中多个数值单元格时显示统计信息', async ({ page }) => {
    // 通过键盘输入数值
    await typeInCell(page, 0, 0, '10');
    await typeInCell(page, 1, 0, '20');
    await typeInCell(page, 2, 0, '30');

    // 使用键盘 Shift+Arrow 选择范围（更可靠）
    await clickCell(page, 0, 0);
    await page.waitForTimeout(200);
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(500);

    // 通过 evaluate 检查统计结果
    const result = await page.evaluate(() => {
      const statsEl = document.getElementById('selection-stats');
      return {
        display: statsEl?.style.display,
        text: statsEl?.textContent,
      };
    });

    expect(result.display).toBe('inline');
    expect(result.text).toContain('求和');
    expect(result.text).toContain('60');
    expect(result.text).toContain('平均值');
    expect(result.text).toContain('计数');
  });

  test('单个单元格不显示统计', async ({ page }) => {
    await setCellContent(page, 0, 0, '100');
    await clickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const statsEl = page.locator('#selection-stats');
    // 单个单元格时统计应该隐藏
    await expect(statsEl).not.toBeVisible();
  });
});

test.describe('公式栏名称框', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('名称框显示当前选中单元格地址', async ({ page }) => {
    await clickCell(page, 0, 0);
    await page.waitForTimeout(200);

    const nameBox = page.locator('.name-box');
    await expect(nameBox).toHaveValue('A1');
  });

  test('点击其他单元格时名称框更新', async ({ page }) => {
    await clickCell(page, 2, 3);
    await page.waitForTimeout(200);

    const nameBox = page.locator('.name-box');
    await expect(nameBox).toHaveValue('D3');
  });

  test('输入地址按 Enter 跳转到对应单元格', async ({ page }) => {
    const nameBox = page.locator('.name-box');
    await nameBox.click();
    await nameBox.fill('C5');
    await nameBox.press('Enter');
    await page.waitForTimeout(300);

    // 验证名称框更新为 C5
    await expect(nameBox).toHaveValue('C5');
  });

  test('输入区域地址跳转', async ({ page }) => {
    const nameBox = page.locator('.name-box');
    await nameBox.click();
    await nameBox.fill('A1:B3');
    await nameBox.press('Enter');
    await page.waitForTimeout(300);

    // 验证选区已更新（名称框应显示 A1，因为 A1 是选区起始）
    await expect(nameBox).toHaveValue('A1');
  });
});
