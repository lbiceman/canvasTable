import { Page, expect } from '@playwright/test';

// ============================================================
// Canvas 渲染配置常量
// ============================================================
export const HEADER_WIDTH = 40;
export const HEADER_HEIGHT = 28;
export const DEFAULT_COL_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 25;

// ============================================================
// 单元格交互辅助函数
// ============================================================

/** 点击 Canvas 上指定单元格（0-indexed） */
export const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.click({ position: { x, y } });
};

/** 双击 Canvas 上指定单元格进入编辑模式 */
export const dblClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.dblclick({ position: { x, y } });
};

/** 右键点击 Canvas 上指定单元格 */
export const rightClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.click({ position: { x, y }, button: 'right' });
};

/** 在单元格中输入内容（点击选中后直接键入） */
export const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await clickCell(page, row, col);
  await page.waitForTimeout(100);
  await page.keyboard.type(text, { delay: 30 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
};


/** 通过公式栏输入内容（FormulaBar 组件替代了原 #cell-content） */
export const setContentViaFormulaBar = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await clickCell(page, row, col);
  // FormulaBar 使用 .formula-input 类名，原 #cell-content 已隐藏
  const contentInput = page.locator('.formula-input');
  await contentInput.fill(text);
  // 按 Enter 确认输入
  await contentInput.press('Enter');
  await page.waitForTimeout(200);
};

/** 通过 window.app.getModel() 获取单元格数据 */
export const getCellData = async (page: Page, row: number, col: number): Promise<{
  content?: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontStrikethrough?: boolean;
  fontColor?: string;
  bgColor?: string;
  fontSize?: number;
  fontAlign?: string;
  fontFamily?: string;
  verticalAlign?: string;
  rowSpan?: number;
  colSpan?: number;
  isMerged?: boolean;
  formulaContent?: string;
  wrapText?: boolean;
  format?: { category?: string; pattern?: string };
  border?: Record<string, unknown>;
  hyperlink?: { url?: string; displayText?: string };
}> => {
  return await page.evaluate(
    ([r, c]) => {
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => Record<string, unknown> | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      if (!cell) return {};
      return {
        content: cell.content as string | undefined,
        fontBold: cell.fontBold as boolean | undefined,
        fontItalic: cell.fontItalic as boolean | undefined,
        fontUnderline: cell.fontUnderline as boolean | undefined,
        fontStrikethrough: cell.fontStrikethrough as boolean | undefined,
        fontColor: cell.fontColor as string | undefined,
        bgColor: cell.bgColor as string | undefined,
        fontSize: cell.fontSize as number | undefined,
        fontAlign: cell.fontAlign as string | undefined,
        fontFamily: cell.fontFamily as string | undefined,
        verticalAlign: cell.verticalAlign as string | undefined,
        rowSpan: cell.rowSpan as number | undefined,
        colSpan: cell.colSpan as number | undefined,
        isMerged: cell.isMerged as boolean | undefined,
        formulaContent: cell.formulaContent as string | undefined,
        wrapText: cell.wrapText as boolean | undefined,
        format: cell.format as { category?: string; pattern?: string } | undefined,
        border: cell.border as Record<string, unknown> | undefined,
        hyperlink: cell.hyperlink as { url?: string; displayText?: string } | undefined,
      };
    },
    [row, col] as [number, number],
  );
};

/** 选择单元格区域（从 startRow,startCol 到 endRow,endCol） */
export const selectRange = async (
  page: Page,
  startRow: number, startCol: number,
  endRow: number, endCol: number,
): Promise<void> => {
  await clickCell(page, startRow, startCol);
  const canvas = page.locator('#excel-canvas');
  const endX = HEADER_WIDTH + endCol * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const endY = HEADER_HEIGHT + endRow * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  // 使用 Shift+Click 选择范围
  await canvas.click({ position: { x: endX, y: endY }, modifiers: ['Shift'] });
  await page.waitForTimeout(100);
};

/** 点击右键菜单中的指定菜单项 */
export const clickContextMenuItem = async (page: Page, label: string): Promise<void> => {
  const menu = page.locator('.cell-context-menu');
  await expect(menu).toBeVisible();
  const item = menu.locator('.cell-context-menu-item', { hasText: label });
  await item.click();
  await page.waitForTimeout(200);
};

/** 点击行号区域右键菜单 */
export const rightClickRowHeader = async (page: Page, row: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.click({ position: { x, y }, button: 'right' });
};

/** 点击列号区域右键菜单 */
export const rightClickColHeader = async (page: Page, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT / 2;
  await canvas.click({ position: { x, y }, button: 'right' });
};

/** 等待应用就绪 */
export const waitForApp = async (page: Page): Promise<void> => {
  await page.waitForSelector('#excel-canvas');
  await page.waitForTimeout(500);
};

/** 获取行数 */
export const getRowCount = async (page: Page): Promise<number> => {
  return await page.evaluate(() => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getRowCount: () => number };
    };
    return app.getModel().getRowCount();
  });
};

/** 获取列数 */
export const getColCount = async (page: Page): Promise<number> => {
  return await page.evaluate(() => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getColCount: () => number };
    };
    return app.getModel().getColCount();
  });
};
