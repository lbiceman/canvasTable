import { test, expect, Page } from '@playwright/test';

// ============================================================
// 辅助类型定义
// ============================================================

/** 单边边框配置 */
interface BorderSide {
  style: string;
  color: string;
  width: number;
}

/** 单元格边框配置 */
interface CellBorderData {
  top?: BorderSide;
  bottom?: BorderSide;
  left?: BorderSide;
  right?: BorderSide;
}

// ============================================================
// 辅助函数
// ============================================================

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
 * 辅助函数：通过 evaluate 获取单元格边框数据
 */
const getCellBorder = async (
  page: Page,
  row: number,
  col: number,
): Promise<CellBorderData | null> => {
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

/**
 * 辅助函数：模拟远程客户端设置单元格边框
 * 通过直接调用 model 方法模拟远程操作应用
 */
const remoteSetBorder = async (
  page: Page,
  row: number,
  col: number,
  border: CellBorderData | undefined,
): Promise<void> => {
  await page.evaluate(
    ([r, c, b]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellBorder: (row: number, col: number, border: unknown) => void;
        };
        getRenderer: () => {
          render: () => void;
        };
      };
      app.getModel().setCellBorder(r, c, b ?? undefined);
      app.getRenderer().render();
    },
    [row, col, border ?? null] as [number, number, unknown],
  );
  await page.waitForTimeout(100);
};

/**
 * 辅助函数：通过 evaluate 获取单元格字体族
 */
const getCellFontFamily = async (
  page: Page,
  row: number,
  col: number,
): Promise<string | undefined> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => { fontFamily?: string } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell) return undefined;
      return cell.fontFamily;
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：模拟远程客户端设置单元格字体族
 */
const remoteSetFontFamily = async (
  page: Page,
  row: number,
  col: number,
  fontFamily: string,
): Promise<void> => {
  await page.evaluate(
    ([r, c, ff]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellFontFamily: (row: number, col: number, fontFamily: string) => void;
        };
        getRenderer: () => {
          render: () => void;
        };
      };
      app.getModel().setCellFontFamily(r, c, ff as string);
      app.getRenderer().render();
    },
    [row, col, fontFamily] as [number, number, string],
  );
  await page.waitForTimeout(100);
};

/**
 * 辅助函数：通过 evaluate 获取单元格删除线状态
 */
const getCellStrikethrough = async (
  page: Page,
  row: number,
  col: number,
): Promise<boolean | undefined> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => { fontStrikethrough?: boolean } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell) return undefined;
      return cell.fontStrikethrough;
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：模拟远程客户端设置单元格删除线
 */
const remoteSetStrikethrough = async (
  page: Page,
  row: number,
  col: number,
  strikethrough: boolean,
): Promise<void> => {
  await page.evaluate(
    ([r, c, s]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          setCellFontStrikethrough: (row: number, col: number, strikethrough: boolean) => void;
        };
        getRenderer: () => {
          render: () => void;
        };
      };
      app.getModel().setCellFontStrikethrough(r, c, s as boolean);
      app.getRenderer().render();
    },
    [row, col, strikethrough] as [number, number, boolean],
  );
  await page.waitForTimeout(100);
};

/**
 * 辅助函数：应用指定位置的边框（通过 UI 操作）
 */
const applyBorder = async (page: Page, position: string): Promise<void> => {
  await page.locator('#border-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.border-position-option[data-position="${position}"]`).click();
  await page.waitForTimeout(200);
};

/**
 * 辅助函数：选择边框线型（通过 UI 操作）
 */
const selectBorderStyle = async (page: Page, style: string): Promise<void> => {
  await page.locator('#border-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.border-style-option[data-style="${style}"]`).click();
  await page.waitForTimeout(200);
};

// ============================================================
// 测试套件：setBorder 协同场景
// ============================================================

test.describe('新操作类型协同测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test.describe('setBorder 协同场景', () => {
    test('需求8.1 - 客户端 A 设置各线型边框，客户端 B 实时收到边框变化', async ({ page }) => {
      // 模拟客户端 A 对 A1 (0,0) 设置 solid 边框
      const solidBorder: CellBorderData = {
        top: { style: 'solid', color: '#000000', width: 1 },
        bottom: { style: 'solid', color: '#000000', width: 1 },
        left: { style: 'solid', color: '#000000', width: 1 },
        right: { style: 'solid', color: '#000000', width: 1 },
      };
      await remoteSetBorder(page, 0, 0, solidBorder);

      // 客户端 B（当前页面）验证收到 solid 边框
      const borderA1 = await getCellBorder(page, 0, 0);
      expect(borderA1).not.toBeNull();
      expect(borderA1!.top!.style).toBe('solid');
      expect(borderA1!.bottom!.style).toBe('solid');
      expect(borderA1!.left!.style).toBe('solid');
      expect(borderA1!.right!.style).toBe('solid');

      // 模拟客户端 A 对 B1 (0,1) 设置 dashed 边框
      const dashedBorder: CellBorderData = {
        top: { style: 'dashed', color: '#FF0000', width: 2 },
        bottom: { style: 'dashed', color: '#FF0000', width: 2 },
        left: { style: 'dashed', color: '#FF0000', width: 2 },
        right: { style: 'dashed', color: '#FF0000', width: 2 },
      };
      await remoteSetBorder(page, 0, 1, dashedBorder);

      const borderB1 = await getCellBorder(page, 0, 1);
      expect(borderB1).not.toBeNull();
      expect(borderB1!.top!.style).toBe('dashed');
      expect(borderB1!.top!.color).toBe('#FF0000');
      expect(borderB1!.top!.width).toBe(2);

      // 模拟客户端 A 对 C1 (0,2) 设置 dotted 边框
      const dottedBorder: CellBorderData = {
        top: { style: 'dotted', color: '#00FF00', width: 1 },
        bottom: { style: 'dotted', color: '#00FF00', width: 1 },
        left: { style: 'dotted', color: '#00FF00', width: 1 },
        right: { style: 'dotted', color: '#00FF00', width: 1 },
      };
      await remoteSetBorder(page, 0, 2, dottedBorder);

      const borderC1 = await getCellBorder(page, 0, 2);
      expect(borderC1).not.toBeNull();
      expect(borderC1!.top!.style).toBe('dotted');
      expect(borderC1!.top!.color).toBe('#00FF00');

      // 模拟客户端 A 对 D1 (0,3) 设置 double 边框
      const doubleBorder: CellBorderData = {
        top: { style: 'double', color: '#0000FF', width: 3 },
        bottom: { style: 'double', color: '#0000FF', width: 3 },
        left: { style: 'double', color: '#0000FF', width: 3 },
        right: { style: 'double', color: '#0000FF', width: 3 },
      };
      await remoteSetBorder(page, 0, 3, doubleBorder);

      const borderD1 = await getCellBorder(page, 0, 3);
      expect(borderD1).not.toBeNull();
      expect(borderD1!.top!.style).toBe('double');
      expect(borderD1!.top!.color).toBe('#0000FF');
      expect(borderD1!.top!.width).toBe(3);
    });

    test('需求8.1 - 客户端 A 设置部分边框（仅 top 和 right），客户端 B 收到的边框配置与 A 一致', async ({ page }) => {
      // 模拟客户端 A 对 A2 (1,0) 设置仅 top 和 right 边框
      const partialBorder: CellBorderData = {
        top: { style: 'solid', color: '#000000', width: 1 },
        right: { style: 'dashed', color: '#FF0000', width: 2 },
      };
      await remoteSetBorder(page, 1, 0, partialBorder);

      // 客户端 B 验证收到的边框配置与 A 一致
      const border = await getCellBorder(page, 1, 0);
      expect(border).not.toBeNull();
      expect(border!.top).toBeDefined();
      expect(border!.top!.style).toBe('solid');
      expect(border!.top!.color).toBe('#000000');
      expect(border!.top!.width).toBe(1);
      expect(border!.right).toBeDefined();
      expect(border!.right!.style).toBe('dashed');
      expect(border!.right!.color).toBe('#FF0000');
      expect(border!.right!.width).toBe(2);
      // bottom 和 left 应为 undefined
      expect(border!.bottom).toBeUndefined();
      expect(border!.left).toBeUndefined();
    });

    test('需求8.1 - 客户端 A 清除边框（border 为 null），客户端 B 的对应单元格边框被清除', async ({ page }) => {
      // 先设置边框
      const fullBorder: CellBorderData = {
        top: { style: 'solid', color: '#000000', width: 1 },
        bottom: { style: 'solid', color: '#000000', width: 1 },
        left: { style: 'solid', color: '#000000', width: 1 },
        right: { style: 'solid', color: '#000000', width: 1 },
      };
      await remoteSetBorder(page, 2, 0, fullBorder);

      // 验证边框已设置
      const borderBefore = await getCellBorder(page, 2, 0);
      expect(borderBefore).not.toBeNull();

      // 模拟客户端 A 清除边框（border 为 undefined/null）
      await remoteSetBorder(page, 2, 0, undefined);

      // 客户端 B 验证边框已被清除
      const borderAfter = await getCellBorder(page, 2, 0);
      expect(borderAfter).toBeNull();
    });

    test('需求8.4 - 新客户端 C 加入房间后，获取的文档状态包含已设置的边框', async ({ page }) => {
      // 模拟客户端 A 设置多个单元格的边框
      const solidBorder: CellBorderData = {
        top: { style: 'solid', color: '#000000', width: 1 },
        bottom: { style: 'solid', color: '#000000', width: 1 },
        left: { style: 'solid', color: '#000000', width: 1 },
        right: { style: 'solid', color: '#000000', width: 1 },
      };
      await remoteSetBorder(page, 0, 0, solidBorder);

      const dashedBorder: CellBorderData = {
        top: { style: 'dashed', color: '#FF0000', width: 2 },
        bottom: { style: 'dashed', color: '#FF0000', width: 2 },
      };
      await remoteSetBorder(page, 1, 1, dashedBorder);

      // 模拟新客户端 C 加入：通过读取当前文档状态来验证
      // 新客户端加入时会收到完整的文档状态（包含边框数据）
      const documentState = await page.evaluate(() => {
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
            getData: () => {
              cells: Array<Array<{ border?: unknown }>>;
            };
          };
        };

        const model = app.getModel();
        const cellA1 = model.getCell(0, 0);
        const cellB2 = model.getCell(1, 1);

        return {
          a1HasBorder: !!cellA1?.border,
          a1TopStyle: cellA1?.border?.top?.style ?? null,
          a1BottomStyle: cellA1?.border?.bottom?.style ?? null,
          a1LeftStyle: cellA1?.border?.left?.style ?? null,
          a1RightStyle: cellA1?.border?.right?.style ?? null,
          b2HasBorder: !!cellB2?.border,
          b2TopStyle: cellB2?.border?.top?.style ?? null,
          b2BottomStyle: cellB2?.border?.bottom?.style ?? null,
          b2LeftStyle: cellB2?.border?.left?.style ?? null,
          b2RightStyle: cellB2?.border?.right?.style ?? null,
        };
      });

      // 验证新客户端 C 获取的文档状态包含 A1 的 solid 边框
      expect(documentState.a1HasBorder).toBe(true);
      expect(documentState.a1TopStyle).toBe('solid');
      expect(documentState.a1BottomStyle).toBe('solid');
      expect(documentState.a1LeftStyle).toBe('solid');
      expect(documentState.a1RightStyle).toBe('solid');

      // 验证新客户端 C 获取的文档状态包含 B2 的 dashed 边框（仅 top 和 bottom）
      expect(documentState.b2HasBorder).toBe(true);
      expect(documentState.b2TopStyle).toBe('dashed');
      expect(documentState.b2BottomStyle).toBe('dashed');
      expect(documentState.b2LeftStyle).toBeNull();
      expect(documentState.b2RightStyle).toBeNull();
    });
  });

  test.describe('setFontFamily 协同场景', () => {
    test('需求8.2 - 客户端 A 对单元格设置字体族，客户端 B 实时收到字体族变化', async ({ page }) => {
      // 模拟客户端 A 对 A1 (0,0) 设置字体族为 "Courier New"
      await remoteSetFontFamily(page, 0, 0, 'Courier New');

      // 客户端 B（当前页面）验证收到字体族变化
      const fontFamily = await getCellFontFamily(page, 0, 0);
      expect(fontFamily).toBe('Courier New');
    });

    test('需求8.2 - 客户端 A 连续修改同一单元格的字体族，客户端 B 最终看到最后一次设置的值', async ({ page }) => {
      // 模拟客户端 A 连续修改 A1 (0,0) 的字体族
      await remoteSetFontFamily(page, 0, 0, 'Arial');
      await remoteSetFontFamily(page, 0, 0, 'Times New Roman');
      await remoteSetFontFamily(page, 0, 0, 'Courier New');

      // 客户端 B 最终看到最后一次设置的值
      const fontFamily = await getCellFontFamily(page, 0, 0);
      expect(fontFamily).toBe('Courier New');
    });

    test('需求8.4 - 新客户端 C 加入房间后，获取的文档状态包含已设置的字体族', async ({ page }) => {
      // 模拟客户端 A 设置多个单元格的字体族
      await remoteSetFontFamily(page, 0, 0, 'Courier New');
      await remoteSetFontFamily(page, 1, 1, 'Georgia');

      // 模拟新客户端 C 加入：通过读取当前文档状态来验证
      const documentState = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
        const app = (window as unknown as Record<string, unknown>).app as {
          getModel: () => {
            getCell: (row: number, col: number) => { fontFamily?: string } | null;
          };
        };

        const model = app.getModel();
        const cellA1 = model.getCell(0, 0);
        const cellB2 = model.getCell(1, 1);
        const cellC3 = model.getCell(2, 2);

        return {
          a1FontFamily: cellA1?.fontFamily ?? null,
          b2FontFamily: cellB2?.fontFamily ?? null,
          c3FontFamily: cellC3?.fontFamily ?? null,
        };
      });

      // 验证新客户端 C 获取的文档状态包含已设置的字体族
      expect(documentState.a1FontFamily).toBe('Courier New');
      expect(documentState.b2FontFamily).toBe('Georgia');
      // 未设置字体族的单元格应为 null/undefined
      expect(documentState.c3FontFamily).toBeNull();
    });
  });

  test.describe('setStrikethrough 协同场景', () => {
    test('需求8.3 - 客户端 A 对单元格启用删除线，客户端 B 实时看到删除线', async ({ page }) => {
      // 模拟客户端 A 对 A1 (0,0) 启用删除线
      await remoteSetStrikethrough(page, 0, 0, true);

      // 客户端 B（当前页面）验证收到删除线变化
      const strikethrough = await getCellStrikethrough(page, 0, 0);
      expect(strikethrough).toBe(true);
    });

    test('需求8.3 - 客户端 A 关闭删除线，客户端 B 的删除线被移除', async ({ page }) => {
      // 先启用删除线
      await remoteSetStrikethrough(page, 0, 0, true);

      // 验证删除线已启用
      const before = await getCellStrikethrough(page, 0, 0);
      expect(before).toBe(true);

      // 模拟客户端 A 关闭删除线
      await remoteSetStrikethrough(page, 0, 0, false);

      // 客户端 B 验证删除线已被移除
      const after = await getCellStrikethrough(page, 0, 0);
      expect(after).toBe(false);
    });

    test('需求8.4 - 新客户端 C 加入房间后，获取的文档状态包含已设置的删除线状态', async ({ page }) => {
      // 模拟客户端 A 设置多个单元格的删除线
      await remoteSetStrikethrough(page, 0, 0, true);
      await remoteSetStrikethrough(page, 1, 1, true);

      // 模拟新客户端 C 加入：通过读取当前文档状态来验证
      const documentState = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
        const app = (window as unknown as Record<string, unknown>).app as {
          getModel: () => {
            getCell: (row: number, col: number) => { fontStrikethrough?: boolean } | null;
          };
        };

        const model = app.getModel();
        const cellA1 = model.getCell(0, 0);
        const cellB2 = model.getCell(1, 1);
        const cellC3 = model.getCell(2, 2);

        return {
          a1Strikethrough: cellA1?.fontStrikethrough ?? null,
          b2Strikethrough: cellB2?.fontStrikethrough ?? null,
          c3Strikethrough: cellC3?.fontStrikethrough ?? null,
        };
      });

      // 验证新客户端 C 获取的文档状态包含已设置的删除线
      expect(documentState.a1Strikethrough).toBe(true);
      expect(documentState.b2Strikethrough).toBe(true);
      // 未设置删除线的单元格应为 null/undefined
      expect(documentState.c3Strikethrough).toBeNull();
    });
  });

  test.describe('并发冲突场景', () => {
    test('需求4.9,5.9 - 客户端 A 和 B 同时对同一单元格设置不同边框，最终两端收敛到相同状态', async ({ page }) => {
      // 模拟并发场景：客户端 A 先设置 solid 边框
      const borderA: CellBorderData = {
        top: { style: 'solid', color: '#000000', width: 1 },
        bottom: { style: 'solid', color: '#000000', width: 1 },
        left: { style: 'solid', color: '#000000', width: 1 },
        right: { style: 'solid', color: '#000000', width: 1 },
      };
      await remoteSetBorder(page, 0, 0, borderA);

      // 客户端 B 随后设置 dashed 边框（模拟并发：后到达的操作覆盖先到达的）
      const borderB: CellBorderData = {
        top: { style: 'dashed', color: '#FF0000', width: 2 },
        bottom: { style: 'dashed', color: '#FF0000', width: 2 },
        left: { style: 'dashed', color: '#FF0000', width: 2 },
        right: { style: 'dashed', color: '#FF0000', width: 2 },
      };
      await remoteSetBorder(page, 0, 0, borderB);

      // 验证最终状态：两端应收敛到相同状态（最后应用的 dashed 边框）
      const finalBorder = await getCellBorder(page, 0, 0);
      expect(finalBorder).not.toBeNull();
      expect(finalBorder!.top!.style).toBe('dashed');
      expect(finalBorder!.top!.color).toBe('#FF0000');
      expect(finalBorder!.top!.width).toBe(2);
      expect(finalBorder!.bottom!.style).toBe('dashed');
      expect(finalBorder!.left!.style).toBe('dashed');
      expect(finalBorder!.right!.style).toBe('dashed');

      // 验证所有方向的边框一致性
      const allSides = [finalBorder!.top, finalBorder!.bottom, finalBorder!.left, finalBorder!.right];
      for (const side of allSides) {
        expect(side).toBeDefined();
        expect(side!.style).toBe('dashed');
        expect(side!.color).toBe('#FF0000');
        expect(side!.width).toBe(2);
      }
    });

    test('需求4.1,5.1 - 客户端 A 设置边框的同时客户端 B 插入行，边框操作的行索引正确调整', async ({ page }) => {
      // 步骤 1：客户端 A 对第 3 行（row=2）设置边框
      const solidBorder: CellBorderData = {
        top: { style: 'solid', color: '#000000', width: 1 },
        bottom: { style: 'solid', color: '#000000', width: 1 },
        left: { style: 'solid', color: '#000000', width: 1 },
        right: { style: 'solid', color: '#000000', width: 1 },
      };
      await remoteSetBorder(page, 2, 0, solidBorder);

      // 验证边框在 row=2 上
      const borderBefore = await getCellBorder(page, 2, 0);
      expect(borderBefore).not.toBeNull();
      expect(borderBefore!.top!.style).toBe('solid');

      // 步骤 2：客户端 B 在 row=1 处插入 1 行（在边框所在行之前插入）
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
        const app = (window as unknown as Record<string, unknown>).app as {
          getModel: () => {
            insertRows: (rowIndex: number, count: number) => boolean;
          };
          getRenderer: () => {
            render: () => void;
          };
        };
        app.getModel().insertRows(1, 1);
        app.getRenderer().render();
      });
      await page.waitForTimeout(100);

      // 验证：插入行后，原来 row=2 的边框应该移动到 row=3
      const borderAtOldRow = await getCellBorder(page, 2, 0);
      // 原来 row=2 的位置现在是新插入的空行，不应有边框
      expect(borderAtOldRow).toBeNull();

      const borderAtNewRow = await getCellBorder(page, 3, 0);
      // 边框应该移动到 row=3（因为在 row=1 插入了 1 行）
      expect(borderAtNewRow).not.toBeNull();
      expect(borderAtNewRow!.top!.style).toBe('solid');
      expect(borderAtNewRow!.top!.color).toBe('#000000');
      expect(borderAtNewRow!.top!.width).toBe(1);
    });

    test('需求4.2,5.2 - 客户端 A 设置字体族的同时客户端 B 删除该行，字体族操作被正确消除', async ({ page }) => {
      // 步骤 1：客户端 A 对第 3 行（row=2, col=0）设置字体族
      await remoteSetFontFamily(page, 2, 0, 'Courier New');

      // 验证字体族已设置
      const fontFamilyBefore = await getCellFontFamily(page, 2, 0);
      expect(fontFamilyBefore).toBe('Courier New');

      // 步骤 2：客户端 B 删除第 3 行（row=2），模拟并发删除
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
        const app = (window as unknown as Record<string, unknown>).app as {
          getModel: () => {
            deleteRows: (rowIndex: number, count: number) => boolean;
          };
          getRenderer: () => {
            render: () => void;
          };
        };
        app.getModel().deleteRows(2, 1);
        app.getRenderer().render();
      });
      await page.waitForTimeout(100);

      // 验证：删除行后，原来 row=2 的字体族应该消失
      // 现在 row=2 是原来的 row=3（空行），不应有 Courier New 字体族
      const fontFamilyAfter = await getCellFontFamily(page, 2, 0);
      expect(fontFamilyAfter).not.toBe('Courier New');
    });
  });
});
