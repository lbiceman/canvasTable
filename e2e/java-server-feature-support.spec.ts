import { test, expect, Page } from '@playwright/test';

const HEADER_WIDTH = 40;
const HEADER_HEIGHT = 28;
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 25;

const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.click({ position: { x, y } });
};

const setCellContent = async (page: Page, row: number, col: number, content: string): Promise<void> => {
  await page.evaluate(([r, c, text]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { setCellContentNoHistory: (r: number, c: number, s: string) => void };
      getRenderer: () => { render: () => void };
    };
    app.getModel().setCellContentNoHistory(r, c, text as string);
    app.getRenderer().render();
  }, [row, col, content] as [number, number, string]);
  await page.waitForTimeout(50);
};

const getColCount = async (page: Page): Promise<number> => {
  return page.evaluate(() => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getColCount: () => number };
    };
    return app.getModel().getColCount();
  });
};

const getCellContent = async (page: Page, row: number, col: number): Promise<string> => {
  return page.evaluate(([r, c]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => { content?: string } | null };
    };
    return app.getModel().getCell(r, c)?.content ?? '';
  }, [row, col] as [number, number]);
};

const getCellFormat = async (page: Page, row: number, col: number): Promise<{
  category?: string; pattern?: string; currencySymbol?: string;
} | null> => {
  return page.evaluate(([r, c]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => { format?: Record<string, unknown> } | null };
    };
    const cell = app.getModel().getCell(r, c);
    if (!cell || !cell.format) return null;
    return cell.format as { category?: string; pattern?: string; currencySymbol?: string };
  }, [row, col] as [number, number]);
};

const getCellWrapText = async (page: Page, row: number, col: number): Promise<boolean | undefined> => {
  return page.evaluate(([r, c]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => { wrapText?: boolean } | null };
    };
    return app.getModel().getCell(r, c)?.wrapText;
  }, [row, col] as [number, number]);
};

const getCellRichText = async (page: Page, row: number, col: number): Promise<Array<{
  text: string; fontBold?: boolean; fontItalic?: boolean; fontColor?: string;
}> | undefined> => {
  return page.evaluate(([r, c]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => { richText?: Array<Record<string, unknown>> } | null };
    };
    const cell = app.getModel().getCell(r, c);
    if (!cell || !cell.richText) return undefined;
    return cell.richText as Array<{ text: string; fontBold?: boolean; fontItalic?: boolean; fontColor?: string }>;
  }, [row, col] as [number, number]);
};

const getCellValidation = async (page: Page, row: number, col: number): Promise<{
  type?: string; mode?: string; options?: string[]; min?: number; max?: number;
} | undefined> => {
  return page.evaluate(([r, c]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getCell: (r: number, c: number) => { validation?: Record<string, unknown> } | null };
    };
    const cell = app.getModel().getCell(r, c);
    if (!cell || !cell.validation) return undefined;
    return cell.validation as { type?: string; mode?: string; options?: string[]; min?: number; max?: number };
  }, [row, col] as [number, number]);
};

// Remote operation helpers
const remoteInsertColumns = async (page: Page, colIndex: number, count: number): Promise<boolean> => {
  const result = await page.evaluate(([ci, cnt]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { insertColumns: (c: number, n: number) => boolean };
      getRenderer: () => { render: () => void };
    };
    const ok = app.getModel().insertColumns(ci, cnt);
    app.getRenderer().render();
    return ok;
  }, [colIndex, count] as [number, number]);
  await page.waitForTimeout(100);
  return result;
};

const remoteDeleteColumns = async (page: Page, colIndex: number, count: number): Promise<boolean> => {
  const result = await page.evaluate(([ci, cnt]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { deleteColumns: (c: number, n: number) => boolean };
      getRenderer: () => { render: () => void };
    };
    const ok = app.getModel().deleteColumns(ci, cnt);
    app.getRenderer().render();
    return ok;
  }, [colIndex, count] as [number, number]);
  await page.waitForTimeout(100);
  return result;
};

const remoteSetFormat = async (page: Page, row: number, col: number,
  format: { category: string; pattern: string; currencySymbol?: string }): Promise<void> => {
  await page.evaluate(([r, c, f]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { setCellFormat: (r: number, c: number, f: unknown) => void };
      getRenderer: () => { render: () => void };
    };
    app.getModel().setCellFormat(r, c, f);
    app.getRenderer().render();
  }, [row, col, format] as [number, number, unknown]);
  await page.waitForTimeout(100);
};

const remoteSetWrapText = async (page: Page, row: number, col: number, wrap: boolean): Promise<void> => {
  await page.evaluate(([r, c, w]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { setCellWrapText: (r: number, c: number, w: boolean) => void };
      getRenderer: () => { render: () => void };
    };
    app.getModel().setCellWrapText(r, c, w as boolean);
    app.getRenderer().render();
  }, [row, col, wrap] as [number, number, boolean]);
  await page.waitForTimeout(100);
};

const remoteSetRichText = async (page: Page, row: number, col: number,
  richText: Array<{ text: string; fontBold?: boolean; fontItalic?: boolean; fontColor?: string; fontSize?: number }>): Promise<void> => {
  await page.evaluate(([r, c, rt]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { setCellRichText: (r: number, c: number, rt: unknown) => void };
      getRenderer: () => { render: () => void };
    };
    app.getModel().setCellRichText(r, c, rt);
    app.getRenderer().render();
  }, [row, col, richText] as [number, number, unknown]);
  await page.waitForTimeout(100);
};

const remoteSetValidation = async (page: Page, row: number, col: number,
  validation: { type: string; mode: string; options?: string[]; min?: number; max?: number } | undefined): Promise<void> => {
  await page.evaluate(([r, c, v]) => {
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { setCellValidation: (r: number, c: number, v: unknown) => void };
      getRenderer: () => { render: () => void };
    };
    app.getModel().setCellValidation(r, c, v ?? undefined);
    app.getRenderer().render();
  }, [row, col, validation ?? null] as [number, number, unknown]);
  await page.waitForTimeout(100);
};

test.describe('Java Server Feature Support E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  // colInsert / colDelete
  test.describe('colInsert/colDelete remote ops', () => {
    test('colInsert inserts columns and shifts data', async ({ page }) => {
      await setCellContent(page, 0, 0, 'A');
      await setCellContent(page, 0, 1, 'B');
      await setCellContent(page, 0, 2, 'C');
      expect(await remoteInsertColumns(page, 1, 2)).toBe(true);
      // Verify data shift is correct
      expect(await getCellContent(page, 0, 0)).toBe('A');
      expect(await getCellContent(page, 0, 1)).toBe('');
      expect(await getCellContent(page, 0, 2)).toBe('');
      expect(await getCellContent(page, 0, 3)).toBe('B');
      expect(await getCellContent(page, 0, 4)).toBe('C');
    });

    test('colInsert at first column', async ({ page }) => {
      await setCellContent(page, 0, 0, 'First');
      expect(await remoteInsertColumns(page, 0, 1)).toBe(true);
      expect(await getCellContent(page, 0, 0)).toBe('');
      expect(await getCellContent(page, 0, 1)).toBe('First');
    });

    test('colInsert at end', async ({ page }) => {
      const before = await getColCount(page);
      expect(await remoteInsertColumns(page, before, 3)).toBe(true);
      expect(await getColCount(page)).toBeGreaterThan(before);
    });

    test('colDelete removes columns and shifts data', async ({ page }) => {
      await setCellContent(page, 0, 0, 'A');
      await setCellContent(page, 0, 1, 'B');
      await setCellContent(page, 0, 2, 'C');
      await setCellContent(page, 0, 3, 'D');
      expect(await remoteDeleteColumns(page, 1, 2)).toBe(true);
      // Verify data shift is correct
      expect(await getCellContent(page, 0, 0)).toBe('A');
      expect(await getCellContent(page, 0, 1)).toBe('D');
    });

    test('colDelete first column', async ({ page }) => {
      await setCellContent(page, 0, 0, 'First');
      await setCellContent(page, 0, 1, 'Second');
      expect(await remoteDeleteColumns(page, 0, 1)).toBe(true);
      expect(await getCellContent(page, 0, 0)).toBe('Second');
    });

    test('colInsert then colDelete restores data', async ({ page }) => {
      await setCellContent(page, 0, 0, 'Keep');
      await setCellContent(page, 0, 1, 'This');
      await remoteInsertColumns(page, 1, 3);
      // Data should shift right
      expect(await getCellContent(page, 0, 0)).toBe('Keep');
      expect(await getCellContent(page, 0, 4)).toBe('This');
      // Delete the inserted columns
      await remoteDeleteColumns(page, 1, 3);
      expect(await getCellContent(page, 0, 0)).toBe('Keep');
      expect(await getCellContent(page, 0, 1)).toBe('This');
    });

    test('colInsert affects all rows', async ({ page }) => {
      await setCellContent(page, 0, 0, 'R0C0');
      await setCellContent(page, 0, 1, 'R0C1');
      await setCellContent(page, 1, 0, 'R1C0');
      await setCellContent(page, 1, 1, 'R1C1');
      await remoteInsertColumns(page, 1, 1);
      expect(await getCellContent(page, 0, 0)).toBe('R0C0');
      expect(await getCellContent(page, 0, 1)).toBe('');
      expect(await getCellContent(page, 0, 2)).toBe('R0C1');
      expect(await getCellContent(page, 1, 0)).toBe('R1C0');
      expect(await getCellContent(page, 1, 1)).toBe('');
      expect(await getCellContent(page, 1, 2)).toBe('R1C1');
    });

    test('colDelete cannot delete all columns', async ({ page }) => {
      const count = await getColCount(page);
      expect(await remoteDeleteColumns(page, 0, count)).toBe(false);
      expect(await getColCount(page)).toBe(count);
    });

    test('colInsert with invalid params returns false', async ({ page }) => {
      const count = await getColCount(page);
      expect(await remoteInsertColumns(page, -1, 1)).toBe(false);
      expect(await remoteInsertColumns(page, 0, 0)).toBe(false);
      expect(await getColCount(page)).toBe(count);
    });
  });

  // setFormat remote ops
  test.describe('setFormat remote ops', () => {
    test('set number format', async ({ page }) => {
      await setCellContent(page, 0, 0, '1234.5');
      await remoteSetFormat(page, 0, 0, { category: 'number', pattern: '#,##0.00' });
      const f = await getCellFormat(page, 0, 0);
      expect(f).not.toBeNull();
      expect(f!.category).toBe('number');
      expect(f!.pattern).toBe('#,##0.00');
    });

    test('set currency format', async ({ page }) => {
      await remoteSetFormat(page, 0, 0, { category: 'currency', pattern: '\u00a5#,##0.00', currencySymbol: '\u00a5' });
      const f = await getCellFormat(page, 0, 0);
      expect(f!.category).toBe('currency');
      expect(f!.currencySymbol).toBe('\u00a5');
    });

    test('set date format', async ({ page }) => {
      await remoteSetFormat(page, 0, 0, { category: 'date', pattern: 'yyyy-MM-dd' });
      const f = await getCellFormat(page, 0, 0);
      expect(f!.category).toBe('date');
      expect(f!.pattern).toBe('yyyy-MM-dd');
    });

    test('set percentage format', async ({ page }) => {
      await remoteSetFormat(page, 0, 0, { category: 'percentage', pattern: '0.00%' });
      const f = await getCellFormat(page, 0, 0);
      expect(f!.category).toBe('percentage');
    });

    test('overwrite existing format', async ({ page }) => {
      await remoteSetFormat(page, 0, 0, { category: 'number', pattern: '#,##0' });
      await remoteSetFormat(page, 0, 0, { category: 'date', pattern: 'yyyy/MM/dd' });
      const f = await getCellFormat(page, 0, 0);
      expect(f!.category).toBe('date');
      expect(f!.pattern).toBe('yyyy/MM/dd');
    });

    test('different formats on different cells', async ({ page }) => {
      await remoteSetFormat(page, 0, 0, { category: 'number', pattern: '#,##0' });
      await remoteSetFormat(page, 0, 1, { category: 'date', pattern: 'yyyy-MM-dd' });
      await remoteSetFormat(page, 1, 0, { category: 'percentage', pattern: '0%' });
      expect((await getCellFormat(page, 0, 0))!.category).toBe('number');
      expect((await getCellFormat(page, 0, 1))!.category).toBe('date');
      expect((await getCellFormat(page, 1, 0))!.category).toBe('percentage');
    });
  });

  // setWrapText remote ops
  test.describe('setWrapText remote ops', () => {
    test('enable wrap text', async ({ page }) => {
      await remoteSetWrapText(page, 0, 0, true);
      expect(await getCellWrapText(page, 0, 0)).toBe(true);
    });

    test('disable wrap text', async ({ page }) => {
      await remoteSetWrapText(page, 0, 0, true);
      await remoteSetWrapText(page, 0, 0, false);
      expect(await getCellWrapText(page, 0, 0)).toBe(false);
    });

    test('wrap text on multiple cells', async ({ page }) => {
      await remoteSetWrapText(page, 0, 0, true);
      await remoteSetWrapText(page, 0, 1, false);
      await remoteSetWrapText(page, 1, 0, true);
      expect(await getCellWrapText(page, 0, 0)).toBe(true);
      expect(await getCellWrapText(page, 0, 1)).toBe(false);
      expect(await getCellWrapText(page, 1, 0)).toBe(true);
    });
  });

  // setRichText remote ops
  test.describe('setRichText remote ops', () => {
    test('set multi-segment rich text', async ({ page }) => {
      const rt = [
        { text: 'Hello ', fontBold: true, fontColor: '#FF0000' },
        { text: 'World', fontItalic: true, fontColor: '#0000FF' },
      ];
      await remoteSetRichText(page, 0, 0, rt);
      const result = await getCellRichText(page, 0, 0);
      expect(result).toBeDefined();
      expect(result!.length).toBe(2);
      expect(result![0].text).toBe('Hello ');
      expect(result![0].fontBold).toBe(true);
      expect(result![1].text).toBe('World');
      expect(result![1].fontItalic).toBe(true);
    });

    test('overwrite rich text', async ({ page }) => {
      await remoteSetRichText(page, 0, 0, [{ text: 'Old', fontBold: true }, { text: ' Text', fontItalic: true }]);
      await remoteSetRichText(page, 0, 0, [{ text: 'New', fontColor: '#00FF00' }, { text: ' Content', fontSize: 16 }]);
      const result = await getCellRichText(page, 0, 0);
      expect(result).toBeDefined();
      expect(result![0].text).toBe('New');
      expect(result![1].text).toBe(' Content');
    });
  });

  // setValidation remote ops
  test.describe('setValidation remote ops', () => {
    test('set dropdown validation', async ({ page }) => {
      await remoteSetValidation(page, 0, 0, { type: 'dropdown', mode: 'block', options: ['A', 'B', 'C'] });
      const v = await getCellValidation(page, 0, 0);
      expect(v).toBeDefined();
      expect(v!.type).toBe('dropdown');
      expect(v!.mode).toBe('block');
      expect(v!.options).toEqual(['A', 'B', 'C']);
    });

    test('set number range validation', async ({ page }) => {
      await remoteSetValidation(page, 0, 0, { type: 'numberRange', mode: 'warning', min: 0, max: 100 });
      const v = await getCellValidation(page, 0, 0);
      expect(v!.type).toBe('numberRange');
      expect(v!.min).toBe(0);
      expect(v!.max).toBe(100);
    });

    test('set text length validation', async ({ page }) => {
      await remoteSetValidation(page, 0, 0, { type: 'textLength', mode: 'block', min: 1, max: 50 });
      const v = await getCellValidation(page, 0, 0);
      expect(v!.type).toBe('textLength');
      expect(v!.min).toBe(1);
      expect(v!.max).toBe(50);
    });

    test('clear validation', async ({ page }) => {
      await remoteSetValidation(page, 0, 0, { type: 'dropdown', mode: 'block', options: ['A'] });
      expect(await getCellValidation(page, 0, 0)).toBeDefined();
      await remoteSetValidation(page, 0, 0, undefined);
      expect(await getCellValidation(page, 0, 0)).toBeUndefined();
    });

    test('overwrite validation', async ({ page }) => {
      await remoteSetValidation(page, 0, 0, { type: 'dropdown', mode: 'block', options: ['A'] });
      await remoteSetValidation(page, 0, 0, { type: 'numberRange', mode: 'warning', min: 10, max: 200 });
      const v = await getCellValidation(page, 0, 0);
      expect(v!.type).toBe('numberRange');
      expect(v!.min).toBe(10);
    });

    test('different validations on different cells', async ({ page }) => {
      await remoteSetValidation(page, 0, 0, { type: 'dropdown', mode: 'block', options: ['Y', 'N'] });
      await remoteSetValidation(page, 0, 1, { type: 'numberRange', mode: 'warning', min: 0, max: 999 });
      await remoteSetValidation(page, 1, 0, { type: 'textLength', mode: 'block', min: 5, max: 20 });
      expect((await getCellValidation(page, 0, 0))!.type).toBe('dropdown');
      expect((await getCellValidation(page, 0, 1))!.type).toBe('numberRange');
      expect((await getCellValidation(page, 1, 0))!.type).toBe('textLength');
    });
  });

  // UI-driven collab operation submission
  test.describe('collab operation submission via UI', () => {
    test('format applied via model API', async ({ page }) => {
      await setCellContent(page, 0, 0, '1234.56');
      await remoteSetFormat(page, 0, 0, { category: 'number', pattern: '#,##0.00' });
      const f = await getCellFormat(page, 0, 0);
      expect(f!.category).toBe('number');
    });

    test('wrap text toggle via button', async ({ page }) => {
      await clickCell(page, 0, 0);
      await page.waitForTimeout(100);
      const wrapBtn = page.locator('#wrap-text-btn');
      if (await wrapBtn.isVisible()) {
        await wrapBtn.click();
        await page.waitForTimeout(200);
        expect(await getCellWrapText(page, 0, 0)).toBe(true);
        await wrapBtn.click();
        await page.waitForTimeout(200);
        expect(await getCellWrapText(page, 0, 0)).toBe(false);
      }
    });

    test('validation applied via model API', async ({ page }) => {
      await remoteSetValidation(page, 0, 0, { type: 'dropdown', mode: 'block', options: ['X', 'Y', 'Z'] });
      const v = await getCellValidation(page, 0, 0);
      expect(v!.type).toBe('dropdown');
      expect(v!.options).toEqual(['X', 'Y', 'Z']);
    });

    test('format on 2x2 selection', async ({ page }) => {
      const fmt = { category: 'currency', pattern: '$#,##0', currencySymbol: '$' };
      for (let r = 0; r <= 1; r++)
        for (let c = 0; c <= 1; c++)
          await remoteSetFormat(page, r, c, fmt);
      for (let r = 0; r <= 1; r++)
        for (let c = 0; c <= 1; c++) {
          const f = await getCellFormat(page, r, c);
          expect(f!.category).toBe('currency');
        }
    });
  });

  // Cross-operation scenarios
  test.describe('cross-operation scenarios', () => {
    test('colInsert shifts format data', async ({ page }) => {
      await setCellContent(page, 0, 1, '999');
      await remoteSetFormat(page, 0, 1, { category: 'number', pattern: '#,##0' });
      expect((await getCellFormat(page, 0, 1))!.category).toBe('number');
      await remoteInsertColumns(page, 0, 1);
      expect((await getCellFormat(page, 0, 2))!.category).toBe('number');
      expect(await getCellFormat(page, 0, 0)).toBeNull();
    });

    test('colDelete removes formatted column', async ({ page }) => {
      await remoteSetFormat(page, 0, 1, { category: 'date', pattern: 'yyyy-MM-dd' });
      await remoteDeleteColumns(page, 1, 1);
      expect(await getCellFormat(page, 0, 1)).toBeNull();
    });

    test('colInsert shifts validation', async ({ page }) => {
      await remoteSetValidation(page, 0, 0, { type: 'dropdown', mode: 'block', options: ['X', 'Y'] });
      await remoteInsertColumns(page, 0, 1);
      const v = await getCellValidation(page, 0, 1);
      expect(v).toBeDefined();
      expect(v!.type).toBe('dropdown');
      expect(await getCellValidation(page, 0, 0)).toBeUndefined();
    });

    test('colInsert shifts wrap text', async ({ page }) => {
      await remoteSetWrapText(page, 0, 1, true);
      await remoteInsertColumns(page, 0, 1);
      expect(await getCellWrapText(page, 0, 2)).toBe(true);
    });

    test('colDelete removes validated column', async ({ page }) => {
      await remoteSetValidation(page, 0, 1, { type: 'numberRange', mode: 'block', min: 0, max: 100 });
      await remoteDeleteColumns(page, 1, 1);
      expect(await getCellValidation(page, 0, 1)).toBeUndefined();
    });

    test('consecutive setFormat keeps last', async ({ page }) => {
      await remoteSetFormat(page, 0, 0, { category: 'number', pattern: '#,##0' });
      await remoteSetFormat(page, 0, 0, { category: 'date', pattern: 'yyyy-MM-dd' });
      await remoteSetFormat(page, 0, 0, { category: 'percentage', pattern: '0.00%' });
      expect((await getCellFormat(page, 0, 0))!.category).toBe('percentage');
    });

    test('same cell with format + wrapText + validation', async ({ page }) => {
      await setCellContent(page, 0, 0, '12345');
      await remoteSetFormat(page, 0, 0, { category: 'number', pattern: '#,##0' });
      await remoteSetWrapText(page, 0, 0, true);
      await remoteSetValidation(page, 0, 0, { type: 'numberRange', mode: 'warning', min: 0, max: 99999 });
      expect((await getCellFormat(page, 0, 0))!.category).toBe('number');
      expect(await getCellWrapText(page, 0, 0)).toBe(true);
      expect((await getCellValidation(page, 0, 0))!.type).toBe('numberRange');
    });
  });

  // Document state persistence
  test.describe('document state persistence', () => {
    test('all properties visible after setting', async ({ page }) => {
      await remoteSetFormat(page, 0, 0, { category: 'number', pattern: '#,##0.00' });
      await remoteSetWrapText(page, 0, 1, true);
      await remoteSetValidation(page, 1, 0, { type: 'dropdown', mode: 'block', options: ['A', 'B'] });
      await remoteSetRichText(page, 1, 1, [
        { text: 'Rich', fontBold: true },
        { text: ' Text', fontItalic: true },
      ]);
      expect((await getCellFormat(page, 0, 0))!.category).toBe('number');
      expect(await getCellWrapText(page, 0, 1)).toBe(true);
      expect((await getCellValidation(page, 1, 0))!.type).toBe('dropdown');
      expect(await getCellRichText(page, 1, 1)).toBeDefined();
    });

    test('colInsert/colDelete state consistency', async ({ page }) => {
      await setCellContent(page, 0, 0, 'Col0');
      await setCellContent(page, 0, 1, 'Col1');
      await setCellContent(page, 0, 2, 'Col2');
      await setCellContent(page, 0, 3, 'Col3');
      await remoteSetFormat(page, 0, 1, { category: 'number', pattern: '#,##0' });
      await remoteSetFormat(page, 0, 3, { category: 'date', pattern: 'yyyy-MM-dd' });
      await remoteInsertColumns(page, 2, 1);
      expect(await getCellContent(page, 0, 0)).toBe('Col0');
      expect(await getCellContent(page, 0, 1)).toBe('Col1');
      expect(await getCellContent(page, 0, 2)).toBe('');
      expect(await getCellContent(page, 0, 3)).toBe('Col2');
      expect(await getCellContent(page, 0, 4)).toBe('Col3');
      expect((await getCellFormat(page, 0, 1))!.category).toBe('number');
      expect((await getCellFormat(page, 0, 4))!.category).toBe('date');
    });
  });

  // Edge cases
  test.describe('edge cases', () => {
    test('setFormat on invalid position does not crash', async ({ page }) => {
      await page.evaluate(() => {
        const app = (window as unknown as Record<string, unknown>).app as {
          getModel: () => { setCellFormat: (r: number, c: number, f: unknown) => void };
        };
        app.getModel().setCellFormat(-1, -1, { category: 'number', pattern: '#,##0' });
        app.getModel().setCellFormat(999999, 999999, { category: 'number', pattern: '#,##0' });
      });
    });

    test('setWrapText on empty cell', async ({ page }) => {
      await remoteSetWrapText(page, 5, 5, true);
      expect(await getCellWrapText(page, 5, 5)).toBe(true);
    });

    test('setValidation on empty cell', async ({ page }) => {
      await remoteSetValidation(page, 5, 5, { type: 'dropdown', mode: 'block', options: ['Yes', 'No'] });
      expect((await getCellValidation(page, 5, 5))!.type).toBe('dropdown');
    });
  });
});
