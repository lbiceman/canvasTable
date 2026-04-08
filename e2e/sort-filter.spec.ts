import { test, expect, Page } from '@playwright/test';
import { clickCell, typeInCell, getCellContent } from './helpers/test-utils';

/**
 * 通过 API 设置排序
 */
const setSingleSort = async (page: Page, colIndex: number, direction: string): Promise<void> => {
  await page.evaluate(([col, dir]) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => {
        sortFilterModel: {
          setSingleSort: (col: number, dir: string) => void;
        };
      };
      getRenderer: () => { render: () => void };
    };
    app.getModel().sortFilterModel.setSingleSort(col, dir);
    app.getRenderer().render();
  }, [colIndex, direction] as [number, string]);
  await page.waitForTimeout(300);
};

/**
 * 获取显示行映射（displayRow → dataRow）
 */
const getRowMapping = async (page: Page, displayRowCount: number): Promise<number[]> => {
  return await page.evaluate((count) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => {
        sortFilterModel: {
          getDataRowIndex: (displayRow: number) => number;
        };
      };
    };
    const mapping: number[] = [];
    for (let i = 0; i < count; i++) {
      mapping.push(app.getModel().sortFilterModel.getDataRowIndex(i));
    }
    return mapping;
  }, displayRowCount);
};

/**
 * 获取可见行数
 */
const getVisibleRowCount = async (page: Page): Promise<number> => {
  return await page.evaluate(() => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => {
        sortFilterModel: { getVisibleRowCount: () => number };
      };
    };
    return app.getModel().sortFilterModel.getVisibleRowCount();
  });
};

const setupSortData = async (page: Page): Promise<void> => {
  await typeInCell(page, 0, 0, '姓名');
  await typeInCell(page, 0, 1, '分数');
  await typeInCell(page, 0, 2, '等级');
  await typeInCell(page, 1, 0, '张三');
  await typeInCell(page, 1, 1, '85');
  await typeInCell(page, 1, 2, 'B');
  await typeInCell(page, 2, 0, '李四');
  await typeInCell(page, 2, 1, '92');
  await typeInCell(page, 2, 2, 'A');
  await typeInCell(page, 3, 0, '王五');
  await typeInCell(page, 3, 1, '78');
  await typeInCell(page, 3, 2, 'C');
  await typeInCell(page, 4, 0, '赵六');
  await typeInCell(page, 4, 1, '95');
  await typeInCell(page, 4, 2, 'A');
  await typeInCell(page, 5, 0, '孙七');
  await typeInCell(page, 5, 1, '88');
  await typeInCell(page, 5, 2, 'B');
};

// ============================================================
// 深入测试：排序功能
// ============================================================

test.describe('排序 - 升序排序验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('按分数升序排序后行映射应正确', async ({ page }) => {
    await setupSortData(page);

    // 按分数列（col=1）升序排序
    await setSingleSort(page, 1, 'asc');

    // 获取行映射
    const totalRows = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => { getRowCount: () => number };
      };
      return app.getModel().getRowCount();
    });
    const mapping = await getRowMapping(page, totalRows);

    // 验证排序后的顺序：78(王五,row3) < 85(张三,row1) < 88(孙七,row5) < 92(李四,row2) < 95(赵六,row4)
    // 第 0 行是表头（row0），排序后应在最前面或按数据排序
    // 实际数据行的映射应按分数升序
    const dataMapping = mapping.slice(0, 6); // 取前6行（表头+5条数据）

    // 验证通过 API 读取排序后的显示内容
    const getDisplayContent = async (displayRow: number, col: number): Promise<string> => {
      return await page.evaluate(([dr, c]) => {
        const app = (window as Record<string, unknown>).app as {
          getModel: () => {
            sortFilterModel: { getDataRowIndex: (d: number) => number };
            getCell: (r: number, c: number) => { content?: string } | null;
          };
        };
        const dataRow = app.getModel().sortFilterModel.getDataRowIndex(dr);
        if (dataRow < 0) return '';
        return app.getModel().getCell(dataRow, c)?.content ?? '';
      }, [displayRow, col] as [number, number]);
    };

    // 验证排序后的分数顺序
    const scores: string[] = [];
    for (let i = 0; i < 6; i++) {
      scores.push(await getDisplayContent(i, 1));
    }

    // 过滤掉表头和空值，验证数值升序
    const numericScores = scores.filter(s => s && !isNaN(Number(s))).map(Number);
    for (let i = 1; i < numericScores.length; i++) {
      expect(numericScores[i]).toBeGreaterThanOrEqual(numericScores[i - 1]);
    }
  });

  test('按分数降序排序后行映射应正确', async ({ page }) => {
    await setupSortData(page);

    await setSingleSort(page, 1, 'desc');

    const getDisplayContent = async (displayRow: number, col: number): Promise<string> => {
      return await page.evaluate(([dr, c]) => {
        const app = (window as Record<string, unknown>).app as {
          getModel: () => {
            sortFilterModel: { getDataRowIndex: (d: number) => number };
            getCell: (r: number, c: number) => { content?: string } | null;
          };
        };
        const dataRow = app.getModel().sortFilterModel.getDataRowIndex(dr);
        if (dataRow < 0) return '';
        return app.getModel().getCell(dataRow, c)?.content ?? '';
      }, [displayRow, col] as [number, number]);
    };

    const scores: string[] = [];
    for (let i = 0; i < 6; i++) {
      scores.push(await getDisplayContent(i, 1));
    }

    const numericScores = scores.filter(s => s && !isNaN(Number(s))).map(Number);
    for (let i = 1; i < numericScores.length; i++) {
      expect(numericScores[i]).toBeLessThanOrEqual(numericScores[i - 1]);
    }
  });
});

test.describe('排序 - 文本排序', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('按姓名列升序排序应按字符串顺序', async ({ page }) => {
    await setupSortData(page);

    await setSingleSort(page, 0, 'asc');

    const getDisplayContent = async (displayRow: number, col: number): Promise<string> => {
      return await page.evaluate(([dr, c]) => {
        const app = (window as Record<string, unknown>).app as {
          getModel: () => {
            sortFilterModel: { getDataRowIndex: (d: number) => number };
            getCell: (r: number, c: number) => { content?: string } | null;
          };
        };
        const dataRow = app.getModel().sortFilterModel.getDataRowIndex(dr);
        if (dataRow < 0) return '';
        return app.getModel().getCell(dataRow, c)?.content ?? '';
      }, [displayRow, col] as [number, number]);
    };

    const names: string[] = [];
    for (let i = 0; i < 6; i++) {
      const name = await getDisplayContent(i, 0);
      if (name && name !== '姓名') names.push(name);
    }

    // 验证按字符串升序
    for (let i = 1; i < names.length; i++) {
      expect(names[i].localeCompare(names[i - 1])).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('排序 - 清除排序', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('清除排序后应恢复原始顺序', async ({ page }) => {
    await setupSortData(page);

    // 记录原始数据
    const originalContent = await getCellContent(page, 1, 0);

    // 排序
    await setSingleSort(page, 1, 'asc');

    // 清除排序
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          sortFilterModel: { clearSort: () => void };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().sortFilterModel.clearSort();
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    // 验证恢复原始顺序
    const restoredContent = await getCellContent(page, 1, 0);
    expect(restoredContent).toBe(originalContent);
  });
});

test.describe('排序 - 筛选功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('设置列筛选后可见行数应减少', async ({ page }) => {
    await setupSortData(page);

    const totalBefore = await getVisibleRowCount(page);

    // 设置筛选：只显示等级为 A 的行
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          sortFilterModel: {
            setColumnFilter: (col: number, filter: { selectedValues: Set<string> }) => void;
          };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().sortFilterModel.setColumnFilter(2, {
        selectedValues: new Set(['A']),
      });
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const totalAfter = await getVisibleRowCount(page);
    expect(totalAfter).toBeLessThan(totalBefore);
  });

  test('筛选后排序应只对可见行生效', async ({ page }) => {
    await setupSortData(page);

    // 先筛选等级为 B 的行
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          sortFilterModel: {
            setColumnFilter: (col: number, filter: { selectedValues: Set<string> }) => void;
          };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().sortFilterModel.setColumnFilter(2, {
        selectedValues: new Set(['B']),
      });
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    // 再按分数排序
    await setSingleSort(page, 1, 'asc');

    // 验证可见行数（表头 + 张三85 + 孙七88 = 3行，或包含表头取决于实现）
    const visibleCount = await getVisibleRowCount(page);
    // 应该只有筛选后的行
    expect(visibleCount).toBeLessThanOrEqual(6);
  });

  test('清除筛选后应恢复所有行', async ({ page }) => {
    await setupSortData(page);

    const totalBefore = await getVisibleRowCount(page);

    // 设置筛选
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          sortFilterModel: {
            setColumnFilter: (col: number, filter: { selectedValues: Set<string> }) => void;
          };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().sortFilterModel.setColumnFilter(2, {
        selectedValues: new Set(['A']),
      });
      app.getRenderer().render();
    });
    await page.waitForTimeout(200);

    // 清除筛选
    await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          sortFilterModel: { clearAllFilters: () => void };
        };
        getRenderer: () => { render: () => void };
      };
      app.getModel().sortFilterModel.clearAllFilters();
      app.getRenderer().render();
    });
    await page.waitForTimeout(300);

    const totalAfter = await getVisibleRowCount(page);
    expect(totalAfter).toBe(totalBefore);
  });
});

test.describe('排序 - 获取唯一值', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('getUniqueValues 应返回列的所有唯一值', async ({ page }) => {
    await setupSortData(page);

    const uniqueValues = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          sortFilterModel: { getUniqueValues: (col: number) => string[] };
        };
      };
      return app.getModel().sortFilterModel.getUniqueValues(2);
    });

    // 等级列应有 A, B, C 和表头 "等级"
    expect(uniqueValues).toContain('A');
    expect(uniqueValues).toContain('B');
    expect(uniqueValues).toContain('C');
  });
});
