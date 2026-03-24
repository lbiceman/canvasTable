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
 * 辅助函数：选中一个区域（从 startRow/startCol 拖拽到 endRow/endCol）
 */
const selectRange = async (
  page: Page,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;

  const x1 = headerWidth + startCol * defaultColWidth + defaultColWidth / 2;
  const y1 = headerHeight + startRow * defaultRowHeight + defaultRowHeight / 2;
  const x2 = headerWidth + endCol * defaultColWidth + defaultColWidth / 2;
  const y2 = headerHeight + endRow * defaultRowHeight + defaultRowHeight / 2;

  await canvas.click({ position: { x: x1, y: y1 } });
  await canvas.click({ position: { x: x2, y: y2 }, modifiers: ['Shift'] });
};

/**
 * 辅助函数：输入单元格内容
 */
const typeInCell = async (page: Page, row: number, col: number, text: string): Promise<void> => {
  await clickCell(page, row, col);
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
};

/**
 * 辅助函数：通过 window.app 获取单元格数据
 */
const getCellContent = async (page: Page, row: number, col: number): Promise<string> => {
  return await page.evaluate(
    ([r, c]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 访问全局 window.app
      const app = (window as unknown as Record<string, unknown>).app as {
        getModel: () => {
          getCell: (row: number, col: number) => { content?: string } | null;
        };
      };
      const cell = app.getModel().getCell(r, c);
      return cell?.content ?? '';
    },
    [row, col] as [number, number],
  );
};

/**
 * 辅助函数：填充测试数据（部门、产品、销售额）
 * 第 0 行为表头，第 1-4 行为数据
 */
const setupTestData = async (page: Page): Promise<void> => {
  // 表头
  await typeInCell(page, 0, 0, '部门');
  await typeInCell(page, 0, 1, '产品');
  await typeInCell(page, 0, 2, '销售额');

  // 数据行
  await typeInCell(page, 1, 0, '技术部');
  await typeInCell(page, 1, 1, '产品A');
  await typeInCell(page, 1, 2, '100');

  await typeInCell(page, 2, 0, '技术部');
  await typeInCell(page, 2, 1, '产品B');
  await typeInCell(page, 2, 2, '200');

  await typeInCell(page, 3, 0, '销售部');
  await typeInCell(page, 3, 1, '产品A');
  await typeInCell(page, 3, 2, '150');

  await typeInCell(page, 4, 0, '销售部');
  await typeInCell(page, 4, 1, '产品B');
  await typeInCell(page, 4, 2, '250');
};

// ============================================================
// 测试：选中数据区域后点击「数据透视表」按钮打开配置面板
// 需求: 1.1
// ============================================================
test.describe('数据透视表 - 打开配置面板', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('选中数据区域后点击透视表按钮应打开配置面板', async ({ page }) => {
    // 填充测试数据
    await setupTestData(page);

    // 选中数据区域 A1:C5
    await selectRange(page, 0, 0, 4, 2);
    await page.waitForTimeout(200);

    // 点击透视表按钮
    await page.locator('#pivot-table-btn').click();
    await page.waitForTimeout(500);

    // 验证配置面板可见（面板使用 pivot-panel-overlay 遮罩层）
    const overlay = page.locator('.pivot-panel-overlay');
    await expect(overlay).toBeVisible();

    // 验证面板标题
    const title = page.locator('.pivot-panel-title');
    await expect(title).toContainText('数据透视表');
  });
});

// ============================================================
// 测试：面板列出源数据所有列标题作为可用字段
// 需求: 1.1, 1.2
// ============================================================
test.describe('数据透视表 - 可用字段列表', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('面板应列出源数据所有列标题作为可用字段', async ({ page }) => {
    await setupTestData(page);

    // 选中数据区域并打开面板
    await selectRange(page, 0, 0, 4, 2);
    await page.waitForTimeout(200);
    await page.locator('#pivot-table-btn').click();
    await page.waitForTimeout(500);

    // 验证可用字段列表包含所有表头
    const fieldList = page.locator('.pivot-field-list-items');
    await expect(fieldList).toBeVisible();

    const fieldItems = fieldList.locator('.pivot-field-item');
    await expect(fieldItems).toHaveCount(3);

    // 验证字段名称
    await expect(fieldItems.nth(0)).toContainText('部门');
    await expect(fieldItems.nth(1)).toContainText('产品');
    await expect(fieldItems.nth(2)).toContainText('销售额');
  });
});

// ============================================================
// 测试：拖拽字段到行/列/值/筛选区域
// 需求: 1.2, 1.3, 1.4, 1.5
// ============================================================
test.describe('数据透视表 - 字段配置', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('通过 evaluate 配置字段到行/值区域并验证结果', async ({ page }) => {
    await setupTestData(page);

    // 选中数据区域并打开面板
    await selectRange(page, 0, 0, 4, 2);
    await page.waitForTimeout(200);
    await page.locator('#pivot-table-btn').click();
    await page.waitForTimeout(500);

    // 通过拖拽模拟：将「部门」拖到行区域
    const fieldItem = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '部门' });
    const rowZone = page.locator('[data-zone="row"].pivot-drop-zone');

    await fieldItem.dragTo(rowZone);
    await page.waitForTimeout(300);

    // 验证行区域包含「部门」字段
    const rowFieldItems = rowZone.locator('.pivot-field-item');
    await expect(rowFieldItems).toHaveCount(1);
    await expect(rowFieldItems.first()).toContainText('部门');

    // 将「销售额」拖到值区域
    const valueField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '销售额' });
    const valueZone = page.locator('[data-zone="value"].pivot-drop-zone');

    await valueField.dragTo(valueZone);
    await page.waitForTimeout(800); // 等待 500ms 防抖 + 渲染

    // 验证值区域包含「销售额」字段（默认求和）
    const valueFieldItems = valueZone.locator('.pivot-field-item');
    await expect(valueFieldItems).toHaveCount(1);
    await expect(valueFieldItems.first()).toContainText('销售额');
    await expect(valueFieldItems.first()).toContainText('求和');

    // 验证预览区域显示了结果表格
    const previewTable = page.locator('.pivot-preview-table');
    await expect(previewTable).toBeVisible();
  });
});

// ============================================================
// 测试：切换聚合方式（求和/计数/平均值/最大值/最小值）
// 需求: 1.5
// ============================================================
test.describe('数据透视表 - 切换聚合方式', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('点击值字段应弹出聚合方式选择菜单并可切换', async ({ page }) => {
    await setupTestData(page);

    // 选中数据区域并打开面板
    await selectRange(page, 0, 0, 4, 2);
    await page.waitForTimeout(200);
    await page.locator('#pivot-table-btn').click();
    await page.waitForTimeout(500);

    // 将「部门」拖到行区域
    const deptField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '部门' });
    const rowZone = page.locator('[data-zone="row"].pivot-drop-zone');
    await deptField.dragTo(rowZone);
    await page.waitForTimeout(300);

    // 将「销售额」拖到值区域
    const salesField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '销售额' });
    const valueZone = page.locator('[data-zone="value"].pivot-drop-zone');
    await salesField.dragTo(valueZone);
    await page.waitForTimeout(800);

    // 点击值区域中的字段项，弹出聚合方式菜单
    const valueFieldItem = valueZone.locator('.pivot-field-item').first();
    await valueFieldItem.click();
    await page.waitForTimeout(300);

    // 验证聚合方式菜单可见
    const aggMenu = page.locator('.pivot-agg-menu');
    await expect(aggMenu).toBeVisible();

    // 验证菜单包含五种聚合方式
    const menuItems = aggMenu.locator('.pivot-agg-menu-item');
    await expect(menuItems).toHaveCount(5);
    await expect(menuItems.nth(0)).toContainText('求和');
    await expect(menuItems.nth(1)).toContainText('计数');
    await expect(menuItems.nth(2)).toContainText('平均值');
    await expect(menuItems.nth(3)).toContainText('最大值');
    await expect(menuItems.nth(4)).toContainText('最小值');

    // 切换到「平均值」
    await menuItems.nth(2).click();
    await page.waitForTimeout(800);

    // 验证值字段显示已更新为平均值
    const updatedValueItem = valueZone.locator('.pivot-field-item').first();
    await expect(updatedValueItem).toContainText('平均值');
  });
});

// ============================================================
// 测试：筛选字段值勾选过滤
// 需求: 1.6
// ============================================================
test.describe('数据透视表 - 筛选字段', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('拖拽字段到筛选区域应显示值勾选列表', async ({ page }) => {
    await setupTestData(page);

    // 选中数据区域并打开面板
    await selectRange(page, 0, 0, 4, 2);
    await page.waitForTimeout(200);
    await page.locator('#pivot-table-btn').click();
    await page.waitForTimeout(500);

    // 将「部门」拖到筛选区域
    const deptField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '部门' });
    const filterZone = page.locator('[data-zone="filter"].pivot-drop-zone');
    await deptField.dragTo(filterZone);
    await page.waitForTimeout(300);

    // 验证筛选区域显示了勾选列表
    const checkList = page.locator('.pivot-filter-checklist');
    await expect(checkList).toBeVisible();

    // 验证包含「全选」和各唯一值的复选框
    const checkItems = checkList.locator('.pivot-filter-check-item');
    // 应有：全选 + 技术部 + 销售部 = 3 项
    await expect(checkItems).toHaveCount(3);

    // 验证默认全选状态
    const selectAllCb = checkItems.nth(0).locator('input[type="checkbox"]');
    await expect(selectAllCb).toBeChecked();
  });

  test('取消勾选筛选值应过滤透视表结果', async ({ page }) => {
    await setupTestData(page);

    // 选中数据区域并打开面板
    await selectRange(page, 0, 0, 4, 2);
    await page.waitForTimeout(200);
    await page.locator('#pivot-table-btn').click();
    await page.waitForTimeout(500);

    // 先配置行字段和值字段
    const prodField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '产品' });
    const rowZone = page.locator('[data-zone="row"].pivot-drop-zone');
    await prodField.dragTo(rowZone);
    await page.waitForTimeout(300);

    const salesField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '销售额' });
    const valueZone = page.locator('[data-zone="value"].pivot-drop-zone');
    await salesField.dragTo(valueZone);
    await page.waitForTimeout(800);

    // 将「部门」拖到筛选区域
    const deptField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '部门' });
    const filterZone = page.locator('[data-zone="filter"].pivot-drop-zone');
    await deptField.dragTo(filterZone);
    await page.waitForTimeout(300);

    // 取消勾选「销售部」（第 3 个复选框，索引 2）
    const checkList = page.locator('.pivot-filter-checklist');
    const salesDeptCb = checkList.locator('.pivot-filter-check-item').nth(2).locator('input[type="checkbox"]');
    await salesDeptCb.uncheck();
    await page.waitForTimeout(800); // 等待防抖重新计算

    // 验证预览表格存在且结果已过滤（只包含技术部数据）
    const previewTable = page.locator('.pivot-preview-table');
    await expect(previewTable).toBeVisible();
  });
});

// ============================================================
// 测试：空数据区域显示错误提示
// 需求: 1.10
// ============================================================
test.describe('数据透视表 - 空数据区域错误提示', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('选中空数据区域点击透视表按钮应显示错误提示', async ({ page }) => {
    // 不输入任何数据，直接选中空区域
    await selectRange(page, 0, 0, 2, 2);
    await page.waitForTimeout(200);

    // 监听 alert 对话框
    const dialogPromise = page.waitForEvent('dialog');

    // 点击透视表按钮
    await page.locator('#pivot-table-btn').click();

    // 验证弹出错误提示
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('请选择包含表头的非空数据区域');
    await dialog.accept();

    // 验证面板未打开
    const overlay = page.locator('.pivot-panel-overlay');
    await expect(overlay).toHaveCount(0);
  });

  test('仅选中单行（无数据行）应显示错误提示', async ({ page }) => {
    // 只输入表头，没有数据行
    await typeInCell(page, 0, 0, '部门');
    await typeInCell(page, 0, 1, '销售额');

    // 选中仅表头行
    await selectRange(page, 0, 0, 0, 1);
    await page.waitForTimeout(200);

    // 监听 alert 对话框
    const dialogPromise = page.waitForEvent('dialog');

    await page.locator('#pivot-table-btn').click();

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('请选择包含表头的非空数据区域');
    await dialog.accept();
  });
});

// ============================================================
// 测试：透视表结果写入新工作表
// 需求: 1.7, 1.9, 1.10
// ============================================================
test.describe('数据透视表 - 写入新工作表', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('配置透视表后点击写入工作表应创建新工作表并写入结果', async ({ page }) => {
    await setupTestData(page);

    // 选中数据区域并打开面板
    await selectRange(page, 0, 0, 4, 2);
    await page.waitForTimeout(200);
    await page.locator('#pivot-table-btn').click();
    await page.waitForTimeout(500);

    // 将「部门」拖到行区域
    const deptField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '部门' });
    const rowZone = page.locator('[data-zone="row"].pivot-drop-zone');
    await deptField.dragTo(rowZone);
    await page.waitForTimeout(300);

    // 将「销售额」拖到值区域
    const salesField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '销售额' });
    const valueZone = page.locator('[data-zone="value"].pivot-drop-zone');
    await salesField.dragTo(valueZone);
    await page.waitForTimeout(800);

    // 验证预览表格已生成
    const previewTable = page.locator('.pivot-preview-table');
    await expect(previewTable).toBeVisible();

    // 点击「写入工作表」按钮
    const writeBtn = page.locator('.pivot-panel-btn-primary', { hasText: '写入工作表' });
    await writeBtn.click();
    await page.waitForTimeout(500);

    // 验证面板已关闭
    const overlay = page.locator('.pivot-panel-overlay');
    await expect(overlay).toHaveCount(0);

    // 验证新工作表标签已创建（名称为「透视表结果」）
    const sheetTabBar = page.locator('#sheet-tab-bar');
    await expect(sheetTabBar).toContainText('透视表结果');

    // 点击新工作表标签切换到结果表
    const resultTab = sheetTabBar.locator('.sheet-tab', { hasText: '透视表结果' });
    await resultTab.click();
    await page.waitForTimeout(300);

    // 验证新工作表中写入了表头
    const headerContent = await getCellContent(page, 0, 0);
    expect(headerContent).toBe('部门');

    // 验证写入了数据行（技术部的销售额求和 = 100 + 200 = 300）
    const techDeptLabel = await getCellContent(page, 1, 0);
    expect(techDeptLabel).toBe('技术部');
    const techDeptValue = await getCellContent(page, 1, 1);
    expect(techDeptValue).toBe('300');

    // 验证销售部数据（150 + 250 = 400）
    const salesDeptLabel = await getCellContent(page, 2, 0);
    expect(salesDeptLabel).toBe('销售部');
    const salesDeptValue = await getCellContent(page, 2, 1);
    expect(salesDeptValue).toBe('400');

    // 验证总计行
    const totalLabel = await getCellContent(page, 3, 0);
    expect(totalLabel).toBe('总计');
    const totalValue = await getCellContent(page, 3, 1);
    expect(totalValue).toBe('700');
  });
});

// ============================================================
// 测试：截图对比验证
// 需求: 1.1, 1.2, 1.3
// ============================================================
test.describe('数据透视表 - 截图对比', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('透视表配置面板截图对比', async ({ page }) => {
    await setupTestData(page);

    // 选中数据区域并打开面板
    await selectRange(page, 0, 0, 4, 2);
    await page.waitForTimeout(200);
    await page.locator('#pivot-table-btn').click();
    await page.waitForTimeout(500);

    // 截图对比配置面板
    const panel = page.locator('.pivot-panel');
    await expect(panel).toHaveScreenshot('pivot-panel-opened.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('透视表预览结果截图对比', async ({ page }) => {
    await setupTestData(page);

    // 选中数据区域并打开面板
    await selectRange(page, 0, 0, 4, 2);
    await page.waitForTimeout(200);
    await page.locator('#pivot-table-btn').click();
    await page.waitForTimeout(500);

    // 配置行字段和值字段
    const deptField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '部门' });
    const rowZone = page.locator('[data-zone="row"].pivot-drop-zone');
    await deptField.dragTo(rowZone);
    await page.waitForTimeout(300);

    const salesField = page.locator('.pivot-field-list-items .pivot-field-item', { hasText: '销售额' });
    const valueZone = page.locator('[data-zone="value"].pivot-drop-zone');
    await salesField.dragTo(valueZone);
    await page.waitForTimeout(800);

    // 截图对比预览区域
    const preview = page.locator('.pivot-preview');
    await expect(preview).toHaveScreenshot('pivot-preview-result.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
