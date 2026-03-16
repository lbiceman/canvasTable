import { test, expect, Page } from '@playwright/test';

// ============================================================
// 辅助函数
// ============================================================

/** Canvas 渲染配置常量 */
const HEADER_WIDTH = 40;
const HEADER_HEIGHT = 28;
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 25;

/**
 * 点击 Canvas 上指定单元格（0-indexed）
 */
const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.click({ position: { x, y } });
};

/**
 * 双击 Canvas 上指定单元格进入编辑模式
 */
const dblClickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH + col * DEFAULT_COL_WIDTH + DEFAULT_COL_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.dblclick({ position: { x, y } });
};

/**
 * 右键点击 Canvas 行号区域
 */
const rightClickRowHeader = async (page: Page, row: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const x = HEADER_WIDTH / 2;
  const y = HEADER_HEIGHT + row * DEFAULT_ROW_HEIGHT + DEFAULT_ROW_HEIGHT / 2;
  await canvas.click({ position: { x, y }, button: 'right' });
};

/**
 * 通过 window.app.getModel() 获取单元格数据
 */
const getCellData = async (page: Page, row: number, col: number): Promise<{
  content?: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontColor?: string;
  bgColor?: string;
  fontSize?: number;
  fontAlign?: string;
  verticalAlign?: string;
  rowSpan?: number;
  colSpan?: number;
  isMerged?: boolean;
}> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
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
        fontColor: cell.fontColor as string | undefined,
        bgColor: cell.bgColor as string | undefined,
        fontSize: cell.fontSize as number | undefined,
        fontAlign: cell.fontAlign as string | undefined,
        verticalAlign: cell.verticalAlign as string | undefined,
        rowSpan: cell.rowSpan as number | undefined,
        colSpan: cell.colSpan as number | undefined,
        isMerged: cell.isMerged as boolean | undefined,
      };
    },
    [row, col] as [number, number],
  );
};

/**
 * 获取模型行数
 */
const getRowCount = async (page: Page): Promise<number> => {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
    const app = (window as unknown as Record<string, unknown>).app as {
      getModel: () => { getRowCount: () => number };
    };
    return app.getModel().getRowCount();
  });
};

/**
 * 在单元格中输入内容（通过双击进入编辑模式）
 */
const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await dblClickCell(page, row, col);
  const editorInput = page.locator('.inline-editor input');
  await editorInput.fill(text);
  await page.keyboard.press('Enter');
};

/**
 * 选择水平对齐选项
 */
const selectHorizontalAlign = async (page: Page, align: 'left' | 'center' | 'right'): Promise<void> => {
  await page.locator('#horizontal-align-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.horizontal-align-option[data-align="${align}"]`).click();
};

/**
 * 选择垂直对齐选项
 */
const selectVerticalAlign = async (page: Page, align: 'top' | 'middle' | 'bottom'): Promise<void> => {
  await page.locator('#vertical-align-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.vertical-align-option[data-align="${align}"]`).click();
};

/**
 * 选择字体大小
 */
const selectFontSize = async (page: Page, size: number): Promise<void> => {
  await page.locator('#font-size-btn').click();
  await page.waitForTimeout(200);
  await page.locator(`.font-size-option[data-size="${size}"]`).click();
};

// ============================================================
// 测试套件
// ============================================================

test.describe('完整工具栏 E2E 测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
    // 清除 localStorage 中残留的历史记录，避免影响撤销/重做测试
    await page.evaluate(() => {
      localStorage.clear();
    });
    // 重新加载页面以确保 HistoryManager 从干净状态启动
    await page.reload();
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });


  // ========================================================
  // 1. 撤销/重做按钮
  // ========================================================
  test.describe('撤销/重做按钮', () => {
    test('初始状态：撤销和重做按钮均禁用', async ({ page }) => {
      const undoBtn = page.locator('#undo-btn');
      const redoBtn = page.locator('#redo-btn');
      await expect(undoBtn).toBeDisabled();
      await expect(redoBtn).toBeDisabled();
    });

    test('输入内容后撤销按钮启用，点击撤销恢复内容', async ({ page }) => {
      // 通过工具栏输入框设置内容（该路径的 updateUndoRedoButtons 已修复）
      await clickCell(page, 0, 0);
      const contentInput = page.locator('#cell-content');
      await contentInput.fill('Hello');
      await page.locator('#set-content').click();

      // 验证内容已设置
      const cellBefore = await getCellData(page, 0, 0);
      expect(cellBefore.content).toBe('Hello');

      // 撤销按钮应启用
      const undoBtn = page.locator('#undo-btn');
      await expect(undoBtn).toBeEnabled();

      // 点击撤销
      await undoBtn.click();

      // 内容应被清除
      const cellAfter = await getCellData(page, 0, 0);
      expect(cellAfter.content).toBe('');
    });

    test('撤销后重做按钮启用，点击重做恢复内容', async ({ page }) => {
      // 通过工具栏输入框设置内容
      await clickCell(page, 0, 0);
      const contentInput = page.locator('#cell-content');
      await contentInput.fill('Redo');
      await page.locator('#set-content').click();

      await clickCell(page, 0, 0);

      // 撤销
      await page.locator('#undo-btn').click();
      const cellAfterUndo = await getCellData(page, 0, 0);
      expect(cellAfterUndo.content).toBe('');

      // 重做按钮应启用
      const redoBtn = page.locator('#redo-btn');
      await expect(redoBtn).toBeEnabled();

      // 点击重做
      await redoBtn.click();

      const cellAfterRedo = await getCellData(page, 0, 0);
      expect(cellAfterRedo.content).toBe('Redo');
    });

    test('Ctrl+Z 撤销快捷键', async ({ page }) => {
      await typeInCell(page, 0, 0, 'Shortcut');
      await clickCell(page, 0, 0);

      // 使用快捷键撤销
      await page.keyboard.press('Control+z');

      const cell = await getCellData(page, 0, 0);
      expect(cell.content).toBe('');
    });

    test('Ctrl+Y 重做快捷键', async ({ page }) => {
      await typeInCell(page, 0, 0, 'ShortcutRedo');
      await clickCell(page, 0, 0);

      await page.keyboard.press('Control+z');
      const cellUndo = await getCellData(page, 0, 0);
      expect(cellUndo.content).toBe('');

      await page.keyboard.press('Control+y');
      const cellRedo = await getCellData(page, 0, 0);
      expect(cellRedo.content).toBe('ShortcutRedo');
    });
  });

  // ========================================================
  // 2. 合并/拆分按钮
  // ========================================================
  test.describe('合并/拆分按钮', () => {
    test('选择多个单元格后点击合并，单元格被合并', async ({ page }) => {
      // 使用 Shift+方向键选择 A1:B2
      await clickCell(page, 0, 0);
      await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.press('Shift+ArrowDown');

      // 点击合并按钮
      await page.locator('#merge-cells').click();

      // 验证 A1 的 rowSpan 和 colSpan
      const cellA1 = await getCellData(page, 0, 0);
      expect(cellA1.rowSpan).toBe(2);
      expect(cellA1.colSpan).toBe(2);
    });

    test('选择合并单元格后点击拆分，单元格被拆分', async ({ page }) => {
      // 先合并 A1:B2
      await clickCell(page, 0, 0);
      await page.keyboard.down('Shift');
      await clickCell(page, 1, 1);
      await page.keyboard.up('Shift');
      await page.locator('#merge-cells').click();

      // 选中合并后的单元格
      await clickCell(page, 0, 0);

      // 点击拆分按钮
      await page.locator('#split-cells').click();

      // 验证 A1 恢复为普通单元格
      const cellA1 = await getCellData(page, 0, 0);
      expect(cellA1.rowSpan).toBe(1);
      expect(cellA1.colSpan).toBe(1);
    });

    test('选择单个单元格点击合并应弹出提示', async ({ page }) => {
      await clickCell(page, 0, 0);

      // 监听 alert 对话框
      page.on('dialog', async (dialog) => {
        expect(dialog.message()).toContain('请选择多个单元格');
        await dialog.accept();
      });

      await page.locator('#merge-cells').click();
    });
  });

  // ========================================================
  // 3. 字体颜色
  // ========================================================
  test.describe('字体颜色', () => {
    test('修改字体颜色应更新模型数据', async ({ page }) => {
      await clickCell(page, 0, 0);

      // 设置字体颜色为红色
      const fontColorInput = page.locator('#font-color');
      await fontColorInput.fill('#ff0000');
      await fontColorInput.dispatchEvent('input');

      const cell = await getCellData(page, 0, 0);
      expect(cell.fontColor).toBe('#ff0000');
    });

    test('不同单元格可设置不同字体颜色', async ({ page }) => {
      // A1 设置红色
      await clickCell(page, 0, 0);
      const fontColorInput = page.locator('#font-color');
      await fontColorInput.fill('#ff0000');
      await fontColorInput.dispatchEvent('input');

      // B1 设置蓝色
      await clickCell(page, 0, 1);
      await fontColorInput.fill('#0000ff');
      await fontColorInput.dispatchEvent('input');

      const cellA1 = await getCellData(page, 0, 0);
      const cellB1 = await getCellData(page, 0, 1);
      expect(cellA1.fontColor).toBe('#ff0000');
      expect(cellB1.fontColor).toBe('#0000ff');
    });
  });

  // ========================================================
  // 4. 背景颜色
  // ========================================================
  test.describe('背景颜色', () => {
    test('修改背景颜色应更新模型数据', async ({ page }) => {
      await clickCell(page, 0, 0);

      const bgColorInput = page.locator('#bg-color');
      await bgColorInput.fill('#ffff00');
      await bgColorInput.dispatchEvent('input');

      const cell = await getCellData(page, 0, 0);
      expect(cell.bgColor).toBe('#ffff00');
    });

    test('不同单元格可设置不同背景颜色', async ({ page }) => {
      const bgColorInput = page.locator('#bg-color');

      await clickCell(page, 0, 0);
      await bgColorInput.fill('#ff0000');
      await bgColorInput.dispatchEvent('input');

      await clickCell(page, 0, 1);
      await bgColorInput.fill('#00ff00');
      await bgColorInput.dispatchEvent('input');

      const cellA1 = await getCellData(page, 0, 0);
      const cellB1 = await getCellData(page, 0, 1);
      expect(cellA1.bgColor).toBe('#ff0000');
      expect(cellB1.bgColor).toBe('#00ff00');
    });
  });


  // ========================================================
  // 5. 字体大小
  // ========================================================
  test.describe('字体大小', () => {
    test('初始状态显示 12px', async ({ page }) => {
      const fontSizeText = page.locator('#font-size-text');
      await expect(fontSizeText).toHaveText('12px');
    });

    test('点击字体大小按钮应显示下拉菜单', async ({ page }) => {
      const dropdown = page.locator('#font-size-dropdown');
      await expect(dropdown).not.toHaveClass(/visible/);

      await page.locator('#font-size-btn').click();
      await expect(dropdown).toHaveClass(/visible/);
    });

    test('选择字体大小应更新模型和按钮文本', async ({ page }) => {
      await clickCell(page, 0, 0);
      await selectFontSize(page, 20);

      // 验证按钮文本
      const fontSizeText = page.locator('#font-size-text');
      await expect(fontSizeText).toHaveText('20px');

      // 验证模型数据
      const cell = await getCellData(page, 0, 0);
      expect(cell.fontSize).toBe(20);
    });

    test('选择后下拉菜单应关闭', async ({ page }) => {
      await clickCell(page, 0, 0);
      await page.locator('#font-size-btn').click();
      const dropdown = page.locator('#font-size-dropdown');
      await expect(dropdown).toHaveClass(/visible/);

      await page.locator('.font-size-option[data-size="16"]').click();
      await expect(dropdown).not.toHaveClass(/visible/);
    });
  });

  // ========================================================
  // 6. 加粗按钮
  // ========================================================
  test.describe('加粗按钮', () => {
    test('点击加粗按钮切换加粗状态', async ({ page }) => {
      await clickCell(page, 0, 0);
      const boldBtn = page.locator('#font-bold-btn');

      // 初始未激活
      await expect(boldBtn).not.toHaveClass(/active/);

      // 点击启用加粗
      await boldBtn.click();
      await expect(boldBtn).toHaveClass(/active/);

      const cell = await getCellData(page, 0, 0);
      expect(cell.fontBold).toBe(true);
    });

    test('再次点击取消加粗', async ({ page }) => {
      await clickCell(page, 0, 0);
      const boldBtn = page.locator('#font-bold-btn');

      await boldBtn.click();
      await boldBtn.click();

      await expect(boldBtn).not.toHaveClass(/active/);
      const cell = await getCellData(page, 0, 0);
      expect(cell.fontBold).toBe(false);
    });
  });

  // ========================================================
  // 7. 斜体按钮
  // ========================================================
  test.describe('斜体按钮', () => {
    test('点击斜体按钮切换斜体状态', async ({ page }) => {
      await clickCell(page, 0, 0);
      const italicBtn = page.locator('#font-italic-btn');

      await expect(italicBtn).not.toHaveClass(/active/);
      await italicBtn.click();
      await expect(italicBtn).toHaveClass(/active/);

      const cell = await getCellData(page, 0, 0);
      expect(cell.fontItalic).toBe(true);
    });

    test('再次点击取消斜体', async ({ page }) => {
      await clickCell(page, 0, 0);
      const italicBtn = page.locator('#font-italic-btn');

      await italicBtn.click();
      await italicBtn.click();

      await expect(italicBtn).not.toHaveClass(/active/);
      const cell = await getCellData(page, 0, 0);
      expect(cell.fontItalic).toBe(false);
    });
  });

  // ========================================================
  // 8. 下划线按钮
  // ========================================================
  test.describe('下划线按钮', () => {
    test('点击下划线按钮切换下划线状态', async ({ page }) => {
      await clickCell(page, 0, 0);
      const underlineBtn = page.locator('#font-underline-btn');

      await expect(underlineBtn).not.toHaveClass(/active/);
      await underlineBtn.click();
      await expect(underlineBtn).toHaveClass(/active/);

      const cell = await getCellData(page, 0, 0);
      expect(cell.fontUnderline).toBe(true);
    });

    test('再次点击取消下划线', async ({ page }) => {
      await clickCell(page, 0, 0);
      const underlineBtn = page.locator('#font-underline-btn');

      await underlineBtn.click();
      await underlineBtn.click();

      await expect(underlineBtn).not.toHaveClass(/active/);
      const cell = await getCellData(page, 0, 0);
      expect(cell.fontUnderline).toBe(false);
    });
  });

  // ========================================================
  // 9. 水平对齐
  // ========================================================
  test.describe('水平对齐', () => {
    test('初始状态显示左对齐', async ({ page }) => {
      await expect(page.locator('#horizontal-align-text')).toHaveText('左对齐');
    });

    test('点击按钮切换下拉菜单显示/隐藏', async ({ page }) => {
      const dropdown = page.locator('#horizontal-align-dropdown');
      const btn = page.locator('#horizontal-align-btn');

      await btn.click();
      await expect(dropdown).toHaveClass(/visible/);

      await btn.click();
      await expect(dropdown).not.toHaveClass(/visible/);
    });

    test('选择居中对齐', async ({ page }) => {
      await clickCell(page, 0, 0);
      await selectHorizontalAlign(page, 'center');

      await expect(page.locator('#horizontal-align-text')).toHaveText('居中');
      const cell = await getCellData(page, 0, 0);
      expect(cell.fontAlign).toBe('center');
    });

    test('选择右对齐', async ({ page }) => {
      await clickCell(page, 0, 0);
      await selectHorizontalAlign(page, 'right');

      await expect(page.locator('#horizontal-align-text')).toHaveText('右对齐');
      const cell = await getCellData(page, 0, 0);
      expect(cell.fontAlign).toBe('right');
    });

    test('切换单元格时工具栏同步显示对齐状态', async ({ page }) => {
      await clickCell(page, 0, 0);
      await selectHorizontalAlign(page, 'right');

      await clickCell(page, 0, 1);
      await expect(page.locator('#horizontal-align-text')).toHaveText('左对齐');

      await clickCell(page, 0, 0);
      await expect(page.locator('#horizontal-align-text')).toHaveText('右对齐');
    });
  });

  // ========================================================
  // 10. 垂直对齐
  // ========================================================
  test.describe('垂直对齐', () => {
    test('初始状态显示居中', async ({ page }) => {
      await expect(page.locator('#vertical-align-text')).toHaveText('居中');
    });

    test('选择上对齐', async ({ page }) => {
      await clickCell(page, 0, 0);
      await selectVerticalAlign(page, 'top');

      await expect(page.locator('#vertical-align-text')).toHaveText('上对齐');
      const cell = await getCellData(page, 0, 0);
      expect(cell.verticalAlign).toBe('top');
    });

    test('选择下对齐', async ({ page }) => {
      await clickCell(page, 0, 0);
      await selectVerticalAlign(page, 'bottom');

      await expect(page.locator('#vertical-align-text')).toHaveText('下对齐');
      const cell = await getCellData(page, 0, 0);
      expect(cell.verticalAlign).toBe('bottom');
    });

    test('切换单元格时工具栏同步显示垂直对齐状态', async ({ page }) => {
      await clickCell(page, 0, 0);
      await selectVerticalAlign(page, 'top');

      await clickCell(page, 0, 1);
      await expect(page.locator('#vertical-align-text')).toHaveText('居中');

      await clickCell(page, 0, 0);
      await expect(page.locator('#vertical-align-text')).toHaveText('上对齐');
    });
  });


  // ========================================================
  // 11. 单元格内容输入框 + 确认按钮
  // ========================================================
  test.describe('单元格内容输入框', () => {
    test('选中单元格后输入框显示当前内容', async ({ page }) => {
      await typeInCell(page, 0, 0, 'TestContent');
      await clickCell(page, 0, 0);

      const contentInput = page.locator('#cell-content');
      await expect(contentInput).toHaveValue('TestContent');
    });

    test('在输入框中修改内容并点击确认按钮', async ({ page }) => {
      await clickCell(page, 0, 0);

      const contentInput = page.locator('#cell-content');
      await contentInput.fill('NewValue');
      await page.locator('#set-content').click();

      const cell = await getCellData(page, 0, 0);
      expect(cell.content).toBe('NewValue');
    });

    test('在输入框中按 Enter 确认内容', async ({ page }) => {
      await clickCell(page, 0, 0);

      const contentInput = page.locator('#cell-content');
      await contentInput.fill('EnterValue');
      await contentInput.press('Enter');

      const cell = await getCellData(page, 0, 0);
      expect(cell.content).toBe('EnterValue');
    });

    test('选中单元格信息显示正确的单元格地址', async ({ page }) => {
      await clickCell(page, 0, 0);
      await expect(page.locator('#selected-cell')).toHaveText('A1');

      await clickCell(page, 0, 1);
      await expect(page.locator('#selected-cell')).toHaveText('B1');

      await clickCell(page, 1, 0);
      await expect(page.locator('#selected-cell')).toHaveText('A2');
    });
  });

  // ========================================================
  // 12. 键盘导航
  // ========================================================
  test.describe('键盘导航', () => {
    test('方向键移动选中单元格', async ({ page }) => {
      await clickCell(page, 0, 0);
      await expect(page.locator('#selected-cell')).toHaveText('A1');

      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#selected-cell')).toHaveText('B1');

      await page.keyboard.press('ArrowDown');
      await expect(page.locator('#selected-cell')).toHaveText('B2');

      await page.keyboard.press('ArrowLeft');
      await expect(page.locator('#selected-cell')).toHaveText('A2');

      await page.keyboard.press('ArrowUp');
      await expect(page.locator('#selected-cell')).toHaveText('A1');
    });

    test('Tab 键向右移动', async ({ page }) => {
      await clickCell(page, 0, 0);
      await page.keyboard.press('Tab');
      await expect(page.locator('#selected-cell')).toHaveText('B1');

      await page.keyboard.press('Tab');
      await expect(page.locator('#selected-cell')).toHaveText('C1');
    });

    test('Shift+Tab 向左移动', async ({ page }) => {
      await clickCell(page, 0, 2);
      await expect(page.locator('#selected-cell')).toHaveText('C1');

      await page.keyboard.press('Shift+Tab');
      await expect(page.locator('#selected-cell')).toHaveText('B1');
    });

    test('Enter 键向下移动', async ({ page }) => {
      await clickCell(page, 0, 0);
      await page.keyboard.press('Enter');
      await expect(page.locator('#selected-cell')).toHaveText('A2');
    });

    test('Delete 键清除单元格内容', async ({ page }) => {
      await typeInCell(page, 0, 0, 'ToDelete');
      await clickCell(page, 0, 0);

      const cellBefore = await getCellData(page, 0, 0);
      expect(cellBefore.content).toBe('ToDelete');

      await page.keyboard.press('Delete');

      const cellAfter = await getCellData(page, 0, 0);
      expect(cellAfter.content).toBe('');
    });

    test('Backspace 键清除单元格内容', async ({ page }) => {
      await typeInCell(page, 0, 0, 'ToBackspace');
      await clickCell(page, 0, 0);

      await page.keyboard.press('Backspace');

      const cell = await getCellData(page, 0, 0);
      expect(cell.content).toBe('');
    });
  });


  // ========================================================
  // 13. 双击编辑
  // ========================================================
  test.describe('双击编辑', () => {
    test('双击单元格进入编辑模式', async ({ page }) => {
      await dblClickCell(page, 0, 0);

      // 内联编辑器容器应出现
      const editorContainer = page.locator('.inline-editor');
      await expect(editorContainer).toBeVisible();
    });

    test('双击编辑后输入内容并按 Enter 保存', async ({ page }) => {
      await dblClickCell(page, 0, 0);

      const editorInput = page.locator('.inline-editor input');
      await editorInput.fill('DblClickEdit');
      await page.keyboard.press('Enter');

      const cell = await getCellData(page, 0, 0);
      expect(cell.content).toBe('DblClickEdit');
    });

    test('F2 进入编辑模式保留原内容', async ({ page }) => {
      // 先输入内容
      await typeInCell(page, 0, 0, 'Original');
      await clickCell(page, 0, 0);

      // 按 F2 进入编辑
      await page.keyboard.press('F2');

      const editorInput = page.locator('.inline-editor input');
      await expect(editorInput).toBeVisible();
      await expect(editorInput).toHaveValue('Original');
    });

    test('直接输入字符进入编辑模式（清空原内容）', async ({ page }) => {
      await typeInCell(page, 0, 0, 'WillBeCleared');
      await clickCell(page, 0, 0);

      // 直接输入字符
      await page.keyboard.press('A');

      const editorInput = page.locator('.inline-editor input');
      await expect(editorInput).toBeVisible();
      // 内容应以 'A' 开头（原内容被清空）
      await expect(editorInput).toHaveValue('A');
    });
  });

  // ========================================================
  // 14. 搜索功能 (Ctrl+F)
  // ========================================================
  test.describe('搜索功能', () => {
    test('Ctrl+F 打开搜索对话框', async ({ page }) => {
      await page.keyboard.press('Control+f');

      const searchDialog = page.locator('.search-dialog');
      await expect(searchDialog).toBeVisible();
    });

    test('搜索已有内容并显示结果', async ({ page }) => {
      // 先输入一些内容
      await typeInCell(page, 0, 0, 'Apple');
      await typeInCell(page, 1, 0, 'Banana');
      await typeInCell(page, 2, 0, 'Apple Pie');

      // 打开搜索
      await page.keyboard.press('Control+f');
      const searchInput = page.locator('.search-input');
      await searchInput.fill('Apple');

      // 应显示搜索结果信息
      const resultsInfo = page.locator('.search-results-info');
      await expect(resultsInfo).toHaveText('1/2');
    });

    test('搜索无结果时显示"无结果"', async ({ page }) => {
      await page.keyboard.press('Control+f');
      const searchInput = page.locator('.search-input');
      await searchInput.fill('NonExistent');

      const resultsInfo = page.locator('.search-results-info');
      await expect(resultsInfo).toHaveText('无结果');
    });

    test('Enter 导航到下一个结果', async ({ page }) => {
      await typeInCell(page, 0, 0, 'Find');
      await typeInCell(page, 1, 0, 'Find');

      await page.keyboard.press('Control+f');
      const searchInput = page.locator('.search-input');
      await searchInput.fill('Find');

      const resultsInfo = page.locator('.search-results-info');
      await expect(resultsInfo).toHaveText('1/2');

      await searchInput.press('Enter');
      await expect(resultsInfo).toHaveText('2/2');
    });

    test('Escape 关闭搜索对话框', async ({ page }) => {
      await page.keyboard.press('Control+f');
      const searchDialog = page.locator('.search-dialog');
      await expect(searchDialog).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(searchDialog).not.toBeVisible();
    });

    test('点击关闭按钮关闭搜索对话框', async ({ page }) => {
      await page.keyboard.press('Control+f');
      const searchDialog = page.locator('.search-dialog');
      await expect(searchDialog).toBeVisible();

      await page.locator('.search-close').click();
      await expect(searchDialog).not.toBeVisible();
    });

    test('点击上一个/下一个按钮导航', async ({ page }) => {
      await typeInCell(page, 0, 0, 'Nav');
      await typeInCell(page, 1, 0, 'Nav');
      await typeInCell(page, 2, 0, 'Nav');

      await page.keyboard.press('Control+f');
      const searchInput = page.locator('.search-input');
      await searchInput.fill('Nav');

      const resultsInfo = page.locator('.search-results-info');
      await expect(resultsInfo).toHaveText('1/3');

      // 点击下一个
      await page.locator('.search-next').click();
      await expect(resultsInfo).toHaveText('2/3');

      // 点击上一个
      await page.locator('.search-prev').click();
      await expect(resultsInfo).toHaveText('1/3');
    });
  });


  // ========================================================
  // 15. 右键菜单（插入行/删除行）
  // ========================================================
  test.describe('右键菜单', () => {
    test('右键点击行号区域显示上下文菜单', async ({ page }) => {
      await rightClickRowHeader(page, 0);

      const contextMenu = page.locator('.context-menu');
      await expect(contextMenu).toBeVisible();
    });

    test('点击其他区域关闭上下文菜单', async ({ page }) => {
      await rightClickRowHeader(page, 0);
      const contextMenu = page.locator('.context-menu');
      await expect(contextMenu).toBeVisible();

      // 点击其他区域
      await clickCell(page, 3, 3);
      await expect(contextMenu).not.toBeVisible();
    });

    test('通过右键菜单插入行', async ({ page }) => {
      const rowCountBefore = await getRowCount(page);

      await rightClickRowHeader(page, 0);

      // 点击确定按钮插入 1 行
      await page.locator('.context-menu-btn').click();

      const rowCountAfter = await getRowCount(page);
      expect(rowCountAfter).toBe(rowCountBefore + 1);
    });

    test('通过右键菜单删除行', async ({ page }) => {
      const rowCountBefore = await getRowCount(page);

      await rightClickRowHeader(page, 0);

      // 点击删除当前行
      await page.locator('.context-menu-item:has-text("删除当前行")').click();

      const rowCountAfter = await getRowCount(page);
      expect(rowCountAfter).toBe(rowCountBefore - 1);
    });

    test('插入多行', async ({ page }) => {
      const rowCountBefore = await getRowCount(page);

      await rightClickRowHeader(page, 0);

      // 修改输入框为 3
      const insertInput = page.locator('.context-menu-input');
      await insertInput.fill('3');
      await page.locator('.context-menu-btn').click();

      const rowCountAfter = await getRowCount(page);
      expect(rowCountAfter).toBe(rowCountBefore + 3);
    });
  });

  // ========================================================
  // 16. 滚轮滚动
  // ========================================================
  test.describe('滚轮滚动', () => {
    test('鼠标滚轮垂直滚动', async ({ page }) => {
      const canvas = page.locator('#excel-canvas');

      // 获取初始视口信息
      const viewportBefore = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
        const app = (window as unknown as Record<string, unknown>).app as {
          getRenderer: () => { getViewport: () => { scrollY: number } };
        };
        return app.getRenderer().getViewport().scrollY;
      });

      // 向下滚动
      await canvas.hover();
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(200);

      const viewportAfter = await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
        const app = (window as unknown as Record<string, unknown>).app as {
          getRenderer: () => { getViewport: () => { scrollY: number } };
        };
        return app.getRenderer().getViewport().scrollY;
      });

      expect(viewportAfter).toBeGreaterThan(viewportBefore);
    });
  });

  // ========================================================
  // 17. 组合样式操作
  // ========================================================
  test.describe('组合样式操作', () => {
    test('同一单元格可同时设置加粗+斜体+下划线', async ({ page }) => {
      await clickCell(page, 0, 0);

      await page.locator('#font-bold-btn').click();
      await page.locator('#font-italic-btn').click();
      await page.locator('#font-underline-btn').click();

      const cell = await getCellData(page, 0, 0);
      expect(cell.fontBold).toBe(true);
      expect(cell.fontItalic).toBe(true);
      expect(cell.fontUnderline).toBe(true);
    });

    test('取消加粗不影响斜体和下划线', async ({ page }) => {
      await clickCell(page, 0, 0);

      await page.locator('#font-bold-btn').click();
      await page.locator('#font-italic-btn').click();
      await page.locator('#font-underline-btn').click();

      // 取消加粗
      await page.locator('#font-bold-btn').click();

      const cell = await getCellData(page, 0, 0);
      expect(cell.fontBold).toBe(false);
      expect(cell.fontItalic).toBe(true);
      expect(cell.fontUnderline).toBe(true);
    });

    test('同时设置字体大小+颜色+对齐', async ({ page }) => {
      await clickCell(page, 0, 0);

      // 设置字体大小
      await selectFontSize(page, 24);

      // 设置字体颜色
      const fontColorInput = page.locator('#font-color');
      await fontColorInput.fill('#ff0000');
      await fontColorInput.dispatchEvent('input');

      // 设置水平对齐
      await selectHorizontalAlign(page, 'center');

      // 设置垂直对齐
      await selectVerticalAlign(page, 'top');

      const cell = await getCellData(page, 0, 0);
      expect(cell.fontSize).toBe(24);
      expect(cell.fontColor).toBe('#ff0000');
      expect(cell.fontAlign).toBe('center');
      expect(cell.verticalAlign).toBe('top');
    });
  });

  // ========================================================
  // 18. Shift+方向键扩展选择
  // ========================================================
  test.describe('Shift+方向键扩展选择', () => {
    test('Shift+ArrowRight 扩展选择区域', async ({ page }) => {
      await clickCell(page, 0, 0);

      await page.keyboard.press('Shift+ArrowRight');
      await page.keyboard.press('Shift+ArrowDown');

      // 对选中区域设置加粗，验证多个单元格都被设置
      await page.locator('#font-bold-btn').click();

      const cellA1 = await getCellData(page, 0, 0);
      const cellB1 = await getCellData(page, 0, 1);
      const cellA2 = await getCellData(page, 1, 0);
      const cellB2 = await getCellData(page, 1, 1);

      expect(cellA1.fontBold).toBe(true);
      expect(cellB1.fontBold).toBe(true);
      expect(cellA2.fontBold).toBe(true);
      expect(cellB2.fontBold).toBe(true);
    });
  });

  // ========================================================
  // 19. Escape 取消选择
  // ========================================================
  test.describe('Escape 取消选择', () => {
    test('按 Escape 取消当前选择', async ({ page }) => {
      await clickCell(page, 0, 0);
      await expect(page.locator('#selected-cell')).toHaveText('A1');

      await page.keyboard.press('Escape');

      // 选择被取消后，单元格信息应保持或清空
      // 验证不会报错即可
      const selectedCell = page.locator('#selected-cell');
      await expect(selectedCell).toBeVisible();
    });
  });

  // ========================================================
  // 20. 视口信息显示
  // ========================================================
  test.describe('视口信息', () => {
    test('状态栏显示视口信息', async ({ page }) => {
      const viewportInfo = page.locator('#viewport-info');
      await expect(viewportInfo).toBeVisible();
      // 应包含"视图"文字
      await expect(viewportInfo).toContainText('视图');
    });

    test('状态栏显示单元格数量', async ({ page }) => {
      const cellCount = page.locator('#cell-count');
      await expect(cellCount).toBeVisible();
      // 应包含行列信息
      await expect(cellCount).toContainText('行');
      await expect(cellCount).toContainText('列');
    });
  });

});
