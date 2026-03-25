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
 * 辅助函数：选中单元格区域（点击起始单元格，Shift+点击结束单元格）
 */
const selectRange = async (
  page: Page,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
): Promise<void> => {
  await clickCell(page, startRow, startCol);
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;
  const x = headerWidth + endCol * defaultColWidth + defaultColWidth / 2;
  const y = headerHeight + endRow * defaultRowHeight + defaultRowHeight / 2;
  await canvas.click({ position: { x, y }, modifiers: ['Shift'] });
};

/**
 * 辅助函数：获取单元格边框数据
 */
const getCellBorder = async (
  page: Page,
  row: number,
  col: number,
): Promise<{
  top?: { style: string; color: string; width: number };
  bottom?: { style: string; color: string; width: number };
  left?: { style: string; color: string; width: number };
  right?: { style: string; color: string; width: number };
} | null> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => { border?: Record<string, unknown> } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell || !cell.border) return null;
      return cell.border as {
        top?: { style: string; color: string; width: number };
        bottom?: { style: string; color: string; width: number };
        left?: { style: string; color: string; width: number };
        right?: { style: string; color: string; width: number };
      };
    },
    [row, col] as [number, number],
  );
};


test.describe('工具栏边框面板完整测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // ========================================================
  // 需求7.1 - 边框按钮：验证工具栏第一行存在边框操作按钮，点击后展开下拉面板
  // ========================================================
  test('需求7.1 - 工具栏第一行存在边框按钮，点击后展开下拉面板', async ({ page }) => {
    // 验证边框按钮存在于工具栏第一行
    const borderBtn = page.locator('.toolbar-row-1 #border-btn');
    await expect(borderBtn).toBeVisible();

    // 验证下拉面板初始不可见
    const dropdown = page.locator('#border-dropdown');
    await expect(dropdown).not.toBeVisible();

    // 点击边框按钮
    await borderBtn.click();
    await page.waitForTimeout(200);

    // 验证下拉面板展开（visible 类已添加）
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toHaveClass(/visible/);
  });

  // ========================================================
  // 需求7.2 - 八个位置选项：验证下拉面板包含上/下/左/右/全部/外框/内框/清除八个选项
  // ========================================================
  test('需求7.2 - 下拉面板包含八个边框位置选项', async ({ page }) => {
    // 展开下拉面板
    await page.locator('#border-btn').click();
    await page.waitForTimeout(200);

    // 验证八个位置选项均存在
    const positions = ['top', 'bottom', 'left', 'right', 'all', 'outer', 'inner', 'none'];
    for (const pos of positions) {
      const option = page.locator(`.border-position-option[data-position="${pos}"]`);
      await expect(option, `位置选项 "${pos}" 应存在`).toBeVisible();
    }

    // 验证总数为 8 个
    const allOptions = page.locator('.border-position-option');
    await expect(allOptions).toHaveCount(8);

    // 验证每个选项包含 SVG 图标
    for (const pos of positions) {
      const svg = page.locator(`.border-position-option[data-position="${pos}"] svg`);
      await expect(svg, `位置选项 "${pos}" 应包含图标`).toBeVisible();
    }
  });

  // ========================================================
  // 需求7.3 - 线型选择区域：验证面板包含实线/虚线/点线/双线四种线型图标
  // ========================================================
  test('需求7.3 - 面板包含四种线型选择选项', async ({ page }) => {
    // 展开下拉面板
    await page.locator('#border-btn').click();
    await page.waitForTimeout(200);

    // 验证四种线型选项均存在
    const styles = ['solid', 'dashed', 'dotted', 'double'];
    for (const style of styles) {
      const option = page.locator(`.border-style-option[data-style="${style}"]`);
      await expect(option, `线型选项 "${style}" 应存在`).toBeVisible();
    }

    // 验证总数为 4 个
    const allStyleOptions = page.locator('.border-style-option');
    await expect(allStyleOptions).toHaveCount(4);

    // 验证每个线型选项包含 SVG 可视化图标
    for (const style of styles) {
      const svg = page.locator(`.border-style-option[data-style="${style}"] svg`);
      await expect(svg, `线型选项 "${style}" 应包含可视化图标`).toBeVisible();
    }
  });

  // ========================================================
  // 需求7.4 - 颜色选择器：验证面板包含颜色选择器
  // ========================================================
  test('需求7.4 - 面板包含颜色选择器', async ({ page }) => {
    // 展开下拉面板
    await page.locator('#border-btn').click();
    await page.waitForTimeout(200);

    // 验证颜色选择器存在
    const colorInput = page.locator('#border-color');
    await expect(colorInput).toBeVisible();
    // 验证颜色选择器类型为 color
    await expect(colorInput).toHaveAttribute('type', 'color');
    // 验证默认颜色为黑色
    await expect(colorInput).toHaveValue('#000000');
  });

  // ========================================================
  // 需求7.5 - 点击应用：点击边框位置选项后验证边框被应用且下拉面板自动关闭
  // ========================================================
  test('需求7.5 - 点击边框位置选项后应用边框并关闭面板', async ({ page }) => {
    // 选中 A1:B2 区域
    await selectRange(page, 0, 0, 1, 1);

    // 展开下拉面板
    await page.locator('#border-btn').click();
    await page.waitForTimeout(200);

    // 验证面板已展开
    const dropdown = page.locator('#border-dropdown');
    await expect(dropdown).toBeVisible();

    // 点击"全部边框"选项
    await page.locator('.border-position-option[data-position="all"]').click();
    await page.waitForTimeout(200);

    // 验证下拉面板已自动关闭
    await expect(dropdown).not.toBeVisible();

    // 验证边框已被应用到单元格
    const border = await getCellBorder(page, 0, 0);
    expect(border).not.toBeNull();
    expect(border!.top).toBeDefined();
    expect(border!.bottom).toBeDefined();
    expect(border!.left).toBeDefined();
    expect(border!.right).toBeDefined();
  });

  // ========================================================
  // 需求7.6 - 外部点击关闭：展开面板后点击面板外部区域，验证面板自动关闭
  // ========================================================
  test('需求7.6 - 点击面板外部区域自动关闭面板', async ({ page }) => {
    // 展开下拉面板
    await page.locator('#border-btn').click();
    await page.waitForTimeout(200);

    const dropdown = page.locator('#border-dropdown');
    await expect(dropdown).toBeVisible();

    // 点击 Canvas 区域（面板外部）
    await clickCell(page, 5, 5);
    await page.waitForTimeout(200);

    // 验证面板已关闭
    await expect(dropdown).not.toBeVisible();
  });

  // ========================================================
  // 需求7.7 - 样式一致性：验证边框下拉面板的 CSS 样式与现有下拉面板风格一致
  // ========================================================
  test('需求7.7 - 边框下拉面板样式与现有下拉面板风格一致', async ({ page }) => {
    // 展开边框下拉面板
    await page.locator('#border-btn').click();
    await page.waitForTimeout(200);

    const borderDropdown = page.locator('#border-dropdown');

    // 验证基本样式属性：绝对定位、有背景色、有边框、有阴影
    const styles = await borderDropdown.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        display: computed.display,
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        zIndex: computed.zIndex,
      };
    });

    // 验证使用绝对定位（与其他下拉面板一致）
    expect(styles.position).toBe('absolute');
    // 验证面板可见时 display 为 block
    expect(styles.display).toBe('block');
    // 验证有圆角（与其他下拉面板一致）
    expect(styles.borderRadius).not.toBe('0px');
    // 验证有阴影效果
    expect(styles.boxShadow).not.toBe('none');
    // 验证 z-index 足够高
    expect(parseInt(styles.zIndex)).toBeGreaterThanOrEqual(1000);
  });

  // ========================================================
  // 需求7.8 - 中文标签：验证边框按钮使用简体中文标签"边框"
  // ========================================================
  test('需求7.8 - 边框按钮使用简体中文标签"边框"', async ({ page }) => {
    const borderBtn = page.locator('#border-btn');
    // 验证按钮文本包含"边框"
    await expect(borderBtn).toContainText('边框');
  });
});
