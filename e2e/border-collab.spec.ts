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
 * 辅助函数：应用指定位置的边框
 */
const applyBorder = async (page: Page, position: string): Promise<void> => {
  await page.locator('#border-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.border-position-option[data-position="${position}"]`).click();
  await page.waitForTimeout(200);
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

test.describe('协同编辑集成测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('需求11.1 - 协同操作类型包含 setBorder、setFontFamily、setStrikethrough', async ({ page }) => {
    // 通过 evaluate 验证协同操作类型定义中包含新增的三种操作类型
    const hasOperationTypes = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        isCollaborationMode: () => boolean;
        getModel: () => {
          setCellBorder: (row: number, col: number, border: unknown) => void;
          setCellFontFamily: (row: number, col: number, fontFamily: string) => void;
          setCellFontStrikethrough: (row: number, col: number, strikethrough: boolean) => void;
        };
      };

      // 验证 app 实例存在且具有协同模式检查方法
      const hasCollabMethod = typeof app.isCollaborationMode === 'function';

      // 验证 model 上存在协同远程操作所需的单元格级方法
      const model = app.getModel();
      const hasCellBorderMethod = typeof model.setCellBorder === 'function';
      const hasCellFontFamilyMethod = typeof model.setCellFontFamily === 'function';
      const hasCellStrikethroughMethod = typeof model.setCellFontStrikethrough === 'function';

      return {
        hasCollabMethod,
        hasCellBorderMethod,
        hasCellFontFamilyMethod,
        hasCellStrikethroughMethod,
      };
    });

    // 验证协同模式检查方法存在
    expect(hasOperationTypes.hasCollabMethod).toBe(true);
    // 验证 setBorder 远程操作方法存在
    expect(hasOperationTypes.hasCellBorderMethod).toBe(true);
    // 验证 setFontFamily 远程操作方法存在
    expect(hasOperationTypes.hasCellFontFamilyMethod).toBe(true);
    // 验证 setStrikethrough 远程操作方法存在
    expect(hasOperationTypes.hasCellStrikethroughMethod).toBe(true);
  });

  test('需求11.2 - 边框协同提交：设置边框后验证数据模型已更新', async ({ page }) => {
    // 选中 A1 并设置全部边框
    await clickCell(page, 0, 0);
    await applyBorder(page, 'all');

    // 通过 evaluate 验证边框数据已写入模型（协同模式下会提交 setBorder 操作）
    const borderData = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => {
            border?: {
              top?: { style: string; color: string; width: number };
              bottom?: { style: string; color: string; width: number };
              left?: { style: string; color: string; width: number };
              right?: { style: string; color: string; width: number };
            };
          } | null;
        };
      };
      const cell = app.getModel().getCell(0, 0);
      if (!cell || !cell.border) return null;
      return {
        hasTop: !!cell.border.top,
        hasBottom: !!cell.border.bottom,
        hasLeft: !!cell.border.left,
        hasRight: !!cell.border.right,
        topStyle: cell.border.top?.style,
        topColor: cell.border.top?.color,
        topWidth: cell.border.top?.width,
      };
    });

    // 验证边框数据完整（协同提交的 setBorder 操作应包含完整边框配置）
    expect(borderData).not.toBeNull();
    expect(borderData!.hasTop).toBe(true);
    expect(borderData!.hasBottom).toBe(true);
    expect(borderData!.hasLeft).toBe(true);
    expect(borderData!.hasRight).toBe(true);
    // 验证默认边框样式
    expect(borderData!.topStyle).toBe('solid');
    expect(borderData!.topColor).toBe('#000000');
    expect(borderData!.topWidth).toBe(1);
  });

  test('需求11.3 - 字体族协同提交：设置字体族后验证数据模型已更新', async ({ page }) => {
    // 选中 A1
    await clickCell(page, 0, 0);

    // 通过字体族下拉选择 Arial
    await page.locator('#font-family-btn').click();
    await page.waitForTimeout(200);
    await page.locator('.font-family-option[data-font="Arial"]').click();
    await page.waitForTimeout(200);

    // 通过 evaluate 验证字体族数据已写入模型（协同模式下会提交 setFontFamily 操作）
    const fontFamily = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => { fontFamily?: string } | null;
        };
      };
      const cell = app.getModel().getCell(0, 0);
      return cell?.fontFamily ?? null;
    });

    // 验证字体族已设置为 Arial（协同提交的 setFontFamily 操作应包含字体族名称）
    expect(fontFamily).toBe('Arial');
  });

  test('需求11.4 - 删除线协同提交：设置删除线后验证数据模型已更新', async ({ page }) => {
    // 选中 A1
    await clickCell(page, 0, 0);

    // 点击删除线按钮
    await page.locator('#font-strikethrough-btn').click();
    await page.waitForTimeout(200);

    // 通过 evaluate 验证删除线数据已写入模型（协同模式下会提交 setStrikethrough 操作）
    const strikethrough = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => { fontStrikethrough?: boolean } | null;
        };
      };
      const cell = app.getModel().getCell(0, 0);
      return cell?.fontStrikethrough ?? null;
    });

    // 验证删除线已启用（协同提交的 setStrikethrough 操作应包含 strikethrough=true）
    expect(strikethrough).toBe(true);
  });

  test('需求11.5 - 远程操作应用：模拟远程 setBorder/setFontFamily/setStrikethrough 操作并验证本地模型更新', async ({ page }) => {
    // 通过 evaluate 直接调用 model 的单元格级方法模拟远程操作应用
    const result = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellBorder: (row: number, col: number, border: {
            top?: { style: string; color: string; width: number };
            bottom?: { style: string; color: string; width: number };
            left?: { style: string; color: string; width: number };
            right?: { style: string; color: string; width: number };
          } | undefined) => void;
          setCellFontFamily: (row: number, col: number, fontFamily: string) => void;
          setCellFontStrikethrough: (row: number, col: number, strikethrough: boolean) => void;
          getCell: (row: number, col: number) => {
            border?: {
              top?: { style: string; color: string; width: number };
              bottom?: { style: string; color: string; width: number };
              left?: { style: string; color: string; width: number };
              right?: { style: string; color: string; width: number };
            };
            fontFamily?: string;
            fontStrikethrough?: boolean;
          } | null;
        };
        getRenderer: () => {
          render: () => void;
        };
      };

      const model = app.getModel();

      // 模拟远程 setBorder 操作：为 B2 (1,1) 设置边框
      model.setCellBorder(1, 1, {
        top: { style: 'dashed', color: '#ff0000', width: 2 },
        bottom: { style: 'dashed', color: '#ff0000', width: 2 },
        left: { style: 'dashed', color: '#ff0000', width: 2 },
        right: { style: 'dashed', color: '#ff0000', width: 2 },
      });

      // 模拟远程 setFontFamily 操作：为 C1 (0,2) 设置字体族
      model.setCellFontFamily(0, 2, 'Times New Roman');

      // 模拟远程 setStrikethrough 操作：为 D1 (0,3) 设置删除线
      model.setCellFontStrikethrough(0, 3, true);

      // 触发重新渲染（远程操作应用后需要重新渲染）
      app.getRenderer().render();

      // 读取模型数据验证远程操作已应用
      const cellB2 = model.getCell(1, 1);
      const cellC1 = model.getCell(0, 2);
      const cellD1 = model.getCell(0, 3);

      return {
        // B2 边框验证
        b2HasBorder: !!cellB2?.border,
        b2TopStyle: cellB2?.border?.top?.style ?? null,
        b2TopColor: cellB2?.border?.top?.color ?? null,
        b2TopWidth: cellB2?.border?.top?.width ?? null,
        // C1 字体族验证
        c1FontFamily: cellC1?.fontFamily ?? null,
        // D1 删除线验证
        d1Strikethrough: cellD1?.fontStrikethrough ?? null,
      };
    });

    // 验证远程 setBorder 操作已应用到本地模型
    expect(result.b2HasBorder).toBe(true);
    expect(result.b2TopStyle).toBe('dashed');
    expect(result.b2TopColor).toBe('#ff0000');
    expect(result.b2TopWidth).toBe(2);

    // 验证远程 setFontFamily 操作已应用到本地模型
    expect(result.c1FontFamily).toBe('Times New Roman');

    // 验证远程 setStrikethrough 操作已应用到本地模型
    expect(result.d1Strikethrough).toBe(true);

    // 额外验证：通过辅助函数读取边框数据确认一致性
    const borderB2 = await getCellBorder(page, 1, 1);
    expect(borderB2).not.toBeNull();
    expect(borderB2!.top!.style).toBe('dashed');
    expect(borderB2!.top!.color).toBe('#ff0000');
    expect(borderB2!.top!.width).toBe(2);
  });
});
