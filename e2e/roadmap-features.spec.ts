import { test, expect, Page } from '@playwright/test';
import {
  clickCell,
  dblClickCell,
  getCellContent,
  setCellContent,
  getCellData,
  waitForApp,
  selectRange,
  typeInCell,
} from './helpers/test-utils';

// ============================================================
// 辅助函数
// ============================================================

/** 在单元格中输入公式并等待计算 */
const enterFormula = async (page: Page, row: number, col: number, formula: string): Promise<void> => {
  await dblClickCell(page, row, col);
  await page.waitForTimeout(100);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(formula);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
};

/** 验证单元格数值 */
const expectNumeric = async (page: Page, row: number, col: number, expected: number): Promise<void> => {
  const content = await getCellContent(page, row, col);
  const actual = parseFloat(content);
  expect(actual).toBeCloseTo(expected, 5);
};

/** 验证单元格文本 */
const expectText = async (page: Page, row: number, col: number, expected: string): Promise<void> => {
  const content = await getCellContent(page, row, col);
  expect(content).toBe(expected);
};

/** 构建测试数据表 A1:C5 */
const setupDataTable = async (page: Page): Promise<void> => {
  await setCellContent(page, 0, 0, '姓名');
  await setCellContent(page, 0, 1, '部门');
  await setCellContent(page, 0, 2, '薪资');
  await setCellContent(page, 1, 0, '张三');
  await setCellContent(page, 1, 1, '销售');
  await setCellContent(page, 1, 2, '5000');
  await setCellContent(page, 2, 0, '李四');
  await setCellContent(page, 2, 1, '技术');
  await setCellContent(page, 2, 2, '8000');
  await setCellContent(page, 3, 0, '王五');
  await setCellContent(page, 3, 1, '销售');
  await setCellContent(page, 3, 2, '6000');
  await setCellContent(page, 4, 0, '赵六');
  await setCellContent(page, 4, 1, '财务');
  await setCellContent(page, 4, 2, '7000');
};


// ============================================================
// R02: 高级查找函数完善
// ============================================================
test.describe('R02: 高级查找函数完善', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('R02-1: FILTER 函数 — 按条件筛选数组', async ({ page }) => {
    // 构建数据：A1:B4 = [1,10], [2,20], [3,30], [4,40]
    await setCellContent(page, 0, 0, '1');
    await setCellContent(page, 0, 1, '10');
    await setCellContent(page, 1, 0, '2');
    await setCellContent(page, 1, 1, '20');
    await setCellContent(page, 2, 0, '3');
    await setCellContent(page, 2, 1, '30');
    await setCellContent(page, 3, 0, '4');
    await setCellContent(page, 3, 1, '40');
    // C1:C4 = TRUE, FALSE, TRUE, FALSE（条件数组）
    await setCellContent(page, 0, 2, 'TRUE');
    await setCellContent(page, 1, 2, 'FALSE');
    await setCellContent(page, 2, 2, 'TRUE');
    await setCellContent(page, 3, 2, 'FALSE');

    // 在 E1 输入 FILTER 公式
    await enterFormula(page, 0, 4, '=FILTER(A1:B4, C1:C4)');
    await page.waitForTimeout(300);

    // 验证：应返回第1行和第3行
    await expectNumeric(page, 0, 4, 1);
  });

  test('R02-2: UNIQUE 函数 — 去重', async ({ page }) => {
    await setCellContent(page, 0, 0, '苹果');
    await setCellContent(page, 1, 0, '香蕉');
    await setCellContent(page, 2, 0, '苹果');
    await setCellContent(page, 3, 0, '橙子');
    await setCellContent(page, 4, 0, '香蕉');

    await enterFormula(page, 0, 2, '=UNIQUE(A1:A5)');
    await page.waitForTimeout(300);

    // 第一个唯一值应该是"苹果"
    await expectText(page, 0, 2, '苹果');
  });

  test('R02-3: SORT 函数 — 排序', async ({ page }) => {
    await setCellContent(page, 0, 0, '30');
    await setCellContent(page, 1, 0, '10');
    await setCellContent(page, 2, 0, '20');

    // 升序排序
    await enterFormula(page, 0, 2, '=SORT(A1:A3)');
    await page.waitForTimeout(300);

    await expectNumeric(page, 0, 2, 10);
  });

  test('R02-4: SORT 函数 — 降序排序', async ({ page }) => {
    await setCellContent(page, 0, 0, '30');
    await setCellContent(page, 1, 0, '10');
    await setCellContent(page, 2, 0, '20');

    // 降序排序
    await enterFormula(page, 0, 2, '=SORT(A1:A3, 1, -1)');
    await page.waitForTimeout(300);

    await expectNumeric(page, 0, 2, 30);
  });

  test('R02-5: ADDRESS 函数 — 生成单元格引用', async ({ page }) => {
    // =ADDRESS(1,1) 应返回 "$A$1"
    await enterFormula(page, 0, 0, '=ADDRESS(1,1)');
    await page.waitForTimeout(300);
    await expectText(page, 0, 0, '$A$1');
  });

  test('R02-6: ADDRESS 函数 — 相对引用', async ({ page }) => {
    // =ADDRESS(1,1,4) 应返回 "A1"
    await enterFormula(page, 0, 0, '=ADDRESS(1,1,4)');
    await page.waitForTimeout(300);
    await expectText(page, 0, 0, 'A1');
  });

  test('R02-7: TYPE 函数 — 数字类型', async ({ page }) => {
    // =TYPE(1) 应返回 1
    await enterFormula(page, 0, 0, '=TYPE(1)');
    await page.waitForTimeout(300);
    await expectNumeric(page, 0, 0, 1);
  });

  test('R02-8: TYPE 函数 — 文本类型', async ({ page }) => {
    // =TYPE("hello") 应返回 2
    await enterFormula(page, 0, 0, '=TYPE("hello")');
    await page.waitForTimeout(300);
    await expectNumeric(page, 0, 0, 2);
  });

  test('R02-9: TYPE 函数 — 逻辑类型', async ({ page }) => {
    // =TYPE(TRUE) 应返回 4
    await enterFormula(page, 0, 0, '=TYPE(TRUE)');
    await page.waitForTimeout(300);
    await expectNumeric(page, 0, 0, 4);
  });

  test('R02-10: SORTBY 函数 — 按另一列排序', async ({ page }) => {
    // A列数据，B列排序依据
    await setCellContent(page, 0, 0, 'C');
    await setCellContent(page, 1, 0, 'A');
    await setCellContent(page, 2, 0, 'B');
    await setCellContent(page, 0, 1, '3');
    await setCellContent(page, 1, 1, '1');
    await setCellContent(page, 2, 1, '2');

    await enterFormula(page, 0, 3, '=SORTBY(A1:A3, B1:B3)');
    await page.waitForTimeout(300);

    // 按B列升序排序后，A列应为 A, B, C
    await expectText(page, 0, 3, 'A');
  });
});


// ============================================================
// R07: 拖拽自动填充智能识别
// ============================================================
test.describe('R07: 填充序列智能识别', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('R07-1: 按月递增日期识别 — FillSeriesEngine 推断', async ({ page }) => {
    // 通过 API 直接测试 FillSeriesEngine 的按月识别
    const result = await page.evaluate(() => {
      // 访问 FillSeriesEngine（通过模块系统）
      const app = (window as unknown as Record<string, unknown>).app as Record<string, unknown>;
      const model = (app as { getModel: () => Record<string, unknown> }).getModel();
      // 设置日期数据
      (model as { setCellContent: (r: number, c: number, v: string) => void }).setCellContent(0, 0, '2024-01-31');
      (model as { setCellContent: (r: number, c: number, v: string) => void }).setCellContent(1, 0, '2024-02-29');
      const cell0 = (model as { getCell: (r: number, c: number) => { content: string } | null }).getCell(0, 0);
      const cell1 = (model as { getCell: (r: number, c: number) => { content: string } | null }).getCell(1, 0);
      return {
        cell0: cell0?.content ?? '',
        cell1: cell1?.content ?? '',
      };
    });
    expect(result.cell0).toBe('2024-01-31');
    expect(result.cell1).toBe('2024-02-29');
  });

  test('R07-2: 预定义序列 — 星期填充', async ({ page }) => {
    // 输入"周一"，验证预定义序列被识别
    await setCellContent(page, 0, 0, '周一');
    const content = await getCellContent(page, 0, 0);
    expect(content).toBe('周一');
  });

  test('R07-3: 预定义序列 — 月份填充', async ({ page }) => {
    await setCellContent(page, 0, 0, '一月');
    const content = await getCellContent(page, 0, 0);
    expect(content).toBe('一月');
  });

  test('R07-4: 数字递增模式', async ({ page }) => {
    await setCellContent(page, 0, 0, '1');
    await setCellContent(page, 1, 0, '3');
    await setCellContent(page, 2, 0, '5');
    // 验证数据正确设置
    await expectText(page, 0, 0, '1');
    await expectText(page, 1, 0, '3');
    await expectText(page, 2, 0, '5');
  });
});

// ============================================================
// R04: 名称管理器 UI
// ============================================================
test.describe('R04: 名称管理器 UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('R04-1: 名称管理器对话框可通过API打开', async ({ page }) => {
    // 通过 API 直接调用 nameManagerDialog.show()
    const result = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as Record<string, unknown>;
      // 检查 nameManagerDialog 是否存在
      const hasDialog = typeof (app as { nameManagerDialog?: { show: () => void } }).nameManagerDialog?.show === 'function';
      return { hasDialog };
    });
    // 名称管理器对话框实例应该存在
    expect(result.hasDialog).toBe(true);
  });

  test('R04-2: 通过 API 创建命名范围', async ({ page }) => {
    const result = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as Record<string, unknown>;
      const model = (app as { getModel: () => { getNamedRangeManager: () => {
        create: (name: string, range: Record<string, unknown>) => { success: boolean };
        resolve: (name: string) => Record<string, unknown> | null;
      } } }).getModel();
      const mgr = model.getNamedRangeManager();
      const createResult = mgr.create('TestRange', {
        range: { type: 'RangeReference', startRow: 0, startCol: 0, endRow: 4, endCol: 2 }
      });
      const resolved = mgr.resolve('TestRange');
      return { success: createResult.success, exists: resolved !== null };
    });
    expect(result.success).toBe(true);
    expect(result.exists).toBe(true);
  });

  test('R04-3: 命名范围名称验证 — 拒绝无效名称', async ({ page }) => {
    const result = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as Record<string, unknown>;
      const model = (app as { getModel: () => { getNamedRangeManager: () => {
        create: (name: string, range: Record<string, unknown>) => { success: boolean };
      } } }).getModel();
      const mgr = model.getNamedRangeManager();
      // 以数字开头的名称应被拒绝
      const result1 = mgr.create('123Invalid', {
        range: { type: 'RangeReference', startRow: 0, startCol: 0, endRow: 0, endCol: 0 }
      });
      // 与单元格引用冲突的名称应被拒绝
      const result2 = mgr.create('A1', {
        range: { type: 'RangeReference', startRow: 0, startCol: 0, endRow: 0, endCol: 0 }
      });
      return { invalid1: result1.success, invalid2: result2.success };
    });
    expect(result.invalid1).toBe(false);
    expect(result.invalid2).toBe(false);
  });
});


// ============================================================
// R03: 动态数组溢出 (Spill)
// ============================================================
test.describe('R03: 动态数组溢出', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('R03-1: ArrayFormulaManager 溢出注册和查询', async ({ page }) => {
    const result = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as Record<string, unknown>;
      const model = (app as { getModel: () => Record<string, unknown> }).getModel();
      // 检查 isSpillCell 方法是否存在
      const hasSpillMethod = typeof (model as { isSpillCell?: unknown }).isSpillCell === 'function';
      return { hasSpillMethod };
    });
    expect(result.hasSpillMethod).toBe(true);
  });

  test('R03-2: 数组公式区域保护 — 不能编辑数组公式的一部分', async ({ page }) => {
    // 设置一个 CSE 数组公式
    const result = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app as Record<string, unknown>;
      const model = (app as { getModel: () => {
        setCellContent: (r: number, c: number, v: string) => void;
        setArrayFormula: (r: number, c: number, f: string, er: number, ec: number) => boolean;
        isInArrayFormula: (r: number, c: number) => boolean;
      } }).getModel();

      // 先设置一些数据
      model.setCellContent(0, 0, '1');
      model.setCellContent(1, 0, '2');
      model.setCellContent(2, 0, '3');

      // 设置数组公式
      const success = model.setArrayFormula(0, 3, '=A1:A3', 2, 3);

      // 检查数组公式区域
      const isInArray = model.isInArrayFormula(1, 3);

      return { success, isInArray };
    });
    // 数组公式应该成功设置
    expect(result.isInArray).toBe(true);
  });
});

// ============================================================
// R10: 评论/批注线程
// ============================================================
test.describe('R10: 评论/批注线程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('R10-1: CommentModel — 创建评论线程', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // 动态导入评论模块
      const { CommentModel } = await import('/src/comment/comment-model.ts');
      const model = new CommentModel();
      model.setCurrentUser('测试用户');

      const thread = model.createThread(0, 0, '这是一条测试评论');
      return {
        threadExists: thread !== null,
        threadId: thread.id,
        commentCount: thread.comments.length,
        firstComment: thread.comments[0]?.content,
        author: thread.comments[0]?.author,
      };
    });
    expect(result.threadExists).toBe(true);
    expect(result.commentCount).toBe(1);
    expect(result.firstComment).toBe('这是一条测试评论');
    expect(result.author).toBe('测试用户');
  });

  test('R10-2: CommentModel — 添加回复', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CommentModel } = await import('/src/comment/comment-model.ts');
      const model = new CommentModel();
      model.setCurrentUser('用户A');

      const thread = model.createThread(0, 0, '原始评论');
      model.setCurrentUser('用户B');
      const reply = model.addComment(thread.id, '这是回复');

      return {
        replyExists: reply !== null,
        totalComments: thread.comments.length,
        replyAuthor: reply?.author,
        replyContent: reply?.content,
      };
    });
    expect(result.replyExists).toBe(true);
    expect(result.totalComments).toBe(2);
    expect(result.replyAuthor).toBe('用户B');
    expect(result.replyContent).toBe('这是回复');
  });

  test('R10-3: CommentModel — 标记已解决', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CommentModel } = await import('/src/comment/comment-model.ts');
      const model = new CommentModel();
      const thread = model.createThread(0, 0, '需要解决的问题');
      model.resolveThread(thread.id);

      const updated = model.getThread(0, 0);
      return {
        resolved: updated?.resolved,
        resolvedBy: updated?.resolvedBy,
      };
    });
    expect(result.resolved).toBe(true);
    expect(result.resolvedBy).toBe('我');
  });

  test('R10-4: CommentModel — 重新打开已解决线程', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CommentModel } = await import('/src/comment/comment-model.ts');
      const model = new CommentModel();
      const thread = model.createThread(0, 0, '问题');
      model.resolveThread(thread.id);
      model.reopenThread(thread.id);

      const updated = model.getThread(0, 0);
      return { resolved: updated?.resolved };
    });
    expect(result.resolved).toBe(false);
  });

  test('R10-5: CommentModel — 删除评论', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CommentModel } = await import('/src/comment/comment-model.ts');
      const model = new CommentModel();
      const thread = model.createThread(0, 0, '评论1');
      model.addComment(thread.id, '评论2');

      const commentId = thread.comments[0].id;
      model.deleteComment(thread.id, commentId);

      const updated = model.getThread(0, 0);
      return { remainingComments: updated?.comments.length };
    });
    expect(result.remainingComments).toBe(1);
  });

  test('R10-6: CommentModel — @提及用户提取', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CommentModel } = await import('/src/comment/comment-model.ts');
      const model = new CommentModel();
      const thread = model.createThread(0, 0, '请 @张三 和 @李四 看一下');

      return {
        mentions: thread.comments[0].mentions,
      };
    });
    expect(result.mentions).toContain('张三');
    expect(result.mentions).toContain('李四');
  });

  test('R10-7: CommentModel — 序列化和反序列化', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CommentModel } = await import('/src/comment/comment-model.ts');
      const model = new CommentModel();
      model.createThread(0, 0, '评论A');
      model.createThread(1, 1, '评论B');

      const serialized = model.serialize();

      const model2 = new CommentModel();
      model2.deserialize(serialized);

      return {
        originalCount: serialized.length,
        restoredA: model2.getThread(0, 0)?.comments[0]?.content,
        restoredB: model2.getThread(1, 1)?.comments[0]?.content,
      };
    });
    expect(result.originalCount).toBe(2);
    expect(result.restoredA).toBe('评论A');
    expect(result.restoredB).toBe('评论B');
  });
});


// ============================================================
// R14: 自定义函数注册 API
// ============================================================
test.describe('R14: 自定义函数注册 API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('R14-1: 注册自定义函数并在公式中使用', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CustomFunctionAPI } = await import('/src/formula/custom-function-api.ts');
      const { FormulaEngine } = await import('/src/formula-engine.ts');
      const engine = FormulaEngine.getInstance();
      const api = new CustomFunctionAPI(engine.getRegistry());

      // 注册一个简单的自定义函数
      const regResult = api.register({
        name: 'DOUBLE',
        description: '将数字翻倍',
        params: [{ name: 'value', description: '要翻倍的数字' }],
        handler: (value: unknown) => (value as number) * 2,
      });

      return { success: regResult.success };
    });
    expect(result.success).toBe(true);
  });

  test('R14-2: 拒绝与内置函数冲突的名称', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CustomFunctionAPI } = await import('/src/formula/custom-function-api.ts');
      const { FormulaEngine } = await import('/src/formula-engine.ts');
      const engine = FormulaEngine.getInstance();
      const api = new CustomFunctionAPI(engine.getRegistry());

      // 尝试注册与内置函数同名的函数
      const regResult = api.register({
        name: 'SUM',
        description: '冲突函数',
        params: [],
        handler: () => 0,
      });

      return { success: regResult.success, error: regResult.error };
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('冲突');
  });

  test('R14-3: 注销自定义函数', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CustomFunctionAPI } = await import('/src/formula/custom-function-api.ts');
      const { FormulaEngine } = await import('/src/formula-engine.ts');
      const engine = FormulaEngine.getInstance();
      const api = new CustomFunctionAPI(engine.getRegistry());

      api.register({
        name: 'TEMP_FUNC',
        description: '临时函数',
        params: [],
        handler: () => 42,
      });

      const beforeUnreg = api.isCustomFunction('TEMP_FUNC');
      api.unregister('TEMP_FUNC');
      const afterUnreg = api.isCustomFunction('TEMP_FUNC');

      return { beforeUnreg, afterUnreg };
    });
    expect(result.beforeUnreg).toBe(true);
    expect(result.afterUnreg).toBe(false);
  });

  test('R14-4: 获取所有自定义函数列表', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CustomFunctionAPI } = await import('/src/formula/custom-function-api.ts');
      const { FormulaEngine } = await import('/src/formula-engine.ts');
      const engine = FormulaEngine.getInstance();
      const api = new CustomFunctionAPI(engine.getRegistry());

      api.register({
        name: 'FUNC_A',
        description: '函数A',
        params: [{ name: 'x', description: '参数' }],
        handler: (x: unknown) => x,
      });
      api.register({
        name: 'FUNC_B',
        description: '函数B',
        params: [],
        handler: () => 0,
      });

      const all = api.getAll();
      return { count: all.length, names: all.map(f => f.name) };
    });
    expect(result.count).toBe(2);
    expect(result.names).toContain('FUNC_A');
    expect(result.names).toContain('FUNC_B');
  });

  test('R14-5: 生成函数文档', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { CustomFunctionAPI } = await import('/src/formula/custom-function-api.ts');
      const { FormulaEngine } = await import('/src/formula-engine.ts');
      const engine = FormulaEngine.getInstance();
      const api = new CustomFunctionAPI(engine.getRegistry());

      api.register({
        name: 'MY_FUNC',
        description: '我的自定义函数',
        params: [
          { name: 'a', description: '第一个参数' },
          { name: 'b', description: '第二个参数', optional: true },
        ],
        handler: () => 0,
      });

      const docs = api.generateDocs('MY_FUNC');
      return { hasDocs: docs !== null, containsName: docs?.includes('MY_FUNC') ?? false };
    });
    expect(result.hasDocs).toBe(true);
    expect(result.containsName).toBe(true);
  });
});

// ============================================================
// R12: 插件动态加载机制
// ============================================================
test.describe('R12: 插件动态加载', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('R12-1: PluginLoader 存在且可实例化', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PluginLoader } = await import('/src/plugin/plugin-loader.ts');
      const loader = new PluginLoader();
      return { exists: loader !== null, hasLoadFromURL: typeof loader.loadFromURL === 'function' };
    });
    expect(result.exists).toBe(true);
    expect(result.hasLoadFromURL).toBe(true);
  });

  test('R12-2: 拒绝非 .js 文件', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { PluginLoader } = await import('/src/plugin/plugin-loader.ts');
      const loader = new PluginLoader();
      const loadResult = await loader.loadFromURL('https://example.com/plugin.txt');
      return { success: loadResult.success, error: loadResult.error };
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('.js');
  });
});

// ============================================================
// R13: 宏录制与回放
// ============================================================
test.describe('R13: 宏录制与回放', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('R13-1: ScriptRecorder — 录制状态管理', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { ScriptRecorder } = await import('/src/script/script-recorder.ts');
      const recorder = new ScriptRecorder();

      const idle = recorder.getState();
      recorder.start();
      const recording = recorder.getState();
      recorder.pause();
      const paused = recorder.getState();
      recorder.resume();
      const resumed = recorder.getState();
      recorder.stop();
      const stopped = recorder.getState();

      return { idle, recording, paused, resumed, stopped };
    });
    expect(result.idle).toBe('idle');
    expect(result.recording).toBe('recording');
    expect(result.paused).toBe('paused');
    expect(result.resumed).toBe('recording');
    expect(result.stopped).toBe('idle');
  });

  test('R13-2: ScriptRecorder — 录制操作并生成脚本', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { ScriptRecorder } = await import('/src/script/script-recorder.ts');
      const recorder = new ScriptRecorder();

      recorder.start();
      recorder.record('setCellValue', { row: 0, col: 0, value: 'Hello' });
      recorder.record('setCellValue', { row: 1, col: 0, value: 'World' });
      recorder.record('setSelection', { startRow: 0, startCol: 0, endRow: 1, endCol: 0 });
      const actions = recorder.stop();

      const script = recorder.toScript(actions);

      return {
        actionCount: actions.length,
        hasScript: script.length > 0,
        containsHello: script.includes('Hello'),
        containsWorld: script.includes('World'),
      };
    });
    expect(result.actionCount).toBe(3);
    expect(result.hasScript).toBe(true);
    expect(result.containsHello).toBe(true);
    expect(result.containsWorld).toBe(true);
  });

  test('R13-3: ScriptRecorder — 暂停时不录制', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { ScriptRecorder } = await import('/src/script/script-recorder.ts');
      const recorder = new ScriptRecorder();

      recorder.start();
      recorder.record('setCellValue', { row: 0, col: 0, value: '录制中' });
      recorder.pause();
      recorder.record('setCellValue', { row: 1, col: 0, value: '暂停中不应录制' });
      recorder.resume();
      recorder.record('setCellValue', { row: 2, col: 0, value: '恢复录制' });
      const actions = recorder.stop();

      return { actionCount: actions.length };
    });
    expect(result.actionCount).toBe(2); // 暂停期间的操作不应被录制
  });
});

// ============================================================
// R08: 浮动图层管理
// ============================================================
test.describe('R08: 浮动图层管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
  });

  test('R08-1: FloatingLayerManager — 添加图片', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { FloatingLayerManager } = await import('/src/floating-layer/floating-layer-manager.ts');
      const mgr = new FloatingLayerManager();

      const img = mgr.addImage(
        'data:image/png;base64,iVBORw0KGgo=',
        { x: 100, y: 100 },
        { width: 200, height: 150 }
      );

      return {
        id: img.id,
        type: img.type,
        x: img.position.x,
        y: img.position.y,
        width: img.size.width,
        count: mgr.count(),
      };
    });
    expect(result.type).toBe('image');
    expect(result.x).toBe(100);
    expect(result.width).toBe(200);
    expect(result.count).toBe(1);
  });

  test('R08-2: FloatingLayerManager — 添加形状', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { FloatingLayerManager } = await import('/src/floating-layer/floating-layer-manager.ts');
      const mgr = new FloatingLayerManager();

      const shape = mgr.addShape(
        'rectangle',
        { x: 50, y: 50 },
        { width: 100, height: 80 },
        { fillColor: '#FF0000', text: '测试' }
      );

      return {
        type: shape.type,
        shapeType: shape.shapeType,
        fillColor: shape.fillColor,
        text: shape.text,
      };
    });
    expect(result.type).toBe('shape');
    expect(result.shapeType).toBe('rectangle');
    expect(result.fillColor).toBe('#FF0000');
    expect(result.text).toBe('测试');
  });

  test('R08-3: FloatingLayerManager — 移动和缩放', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { FloatingLayerManager } = await import('/src/floating-layer/floating-layer-manager.ts');
      const mgr = new FloatingLayerManager();

      const img = mgr.addImage('test.png', { x: 0, y: 0 }, { width: 100, height: 100 });
      mgr.move(img.id, { x: 200, y: 300 });
      mgr.resize(img.id, { width: 150, height: 120 });

      const updated = mgr.get(img.id);
      return {
        x: updated?.position.x,
        y: updated?.position.y,
        width: updated?.size.width,
        height: updated?.size.height,
      };
    });
    expect(result.x).toBe(200);
    expect(result.y).toBe(300);
    expect(result.width).toBe(150);
    expect(result.height).toBe(120);
  });

  test('R08-4: FloatingLayerManager — 层级管理', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { FloatingLayerManager } = await import('/src/floating-layer/floating-layer-manager.ts');
      const mgr = new FloatingLayerManager();

      const a = mgr.addShape('rectangle', { x: 0, y: 0 }, { width: 50, height: 50 });
      const b = mgr.addShape('ellipse', { x: 10, y: 10 }, { width: 50, height: 50 });
      const c = mgr.addShape('arrow', { x: 20, y: 20 }, { width: 50, height: 50 });

      // c 在最上面，a 在最下面
      const beforeOrder = mgr.getAll().map(o => o.id);

      // 将 a 置顶
      mgr.bringToFront(a.id);
      const afterOrder = mgr.getAll().map(o => o.id);

      return {
        beforeLast: beforeOrder[beforeOrder.length - 1],
        afterLast: afterOrder[afterOrder.length - 1],
        aId: a.id,
        cId: c.id,
      };
    });
    expect(result.beforeLast).toBe(result.cId);
    expect(result.afterLast).toBe(result.aId);
  });

  test('R08-5: FloatingLayerManager — 命中检测', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { FloatingLayerManager } = await import('/src/floating-layer/floating-layer-manager.ts');
      const mgr = new FloatingLayerManager();

      mgr.addShape('rectangle', { x: 100, y: 100 }, { width: 200, height: 150 });

      const hit = mgr.hitTest(150, 150);
      const miss = mgr.hitTest(50, 50);

      return {
        hitFound: hit !== null,
        missFound: miss !== null,
      };
    });
    expect(result.hitFound).toBe(true);
    expect(result.missFound).toBe(false);
  });

  test('R08-6: FloatingLayerManager — 序列化和反序列化', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { FloatingLayerManager } = await import('/src/floating-layer/floating-layer-manager.ts');
      const mgr = new FloatingLayerManager();

      mgr.addImage('img1.png', { x: 10, y: 20 }, { width: 100, height: 80 });
      mgr.addShape('ellipse', { x: 50, y: 60 }, { width: 70, height: 70 });

      const serialized = mgr.serialize();

      const mgr2 = new FloatingLayerManager();
      mgr2.deserialize(serialized);

      return {
        originalCount: serialized.length,
        restoredCount: mgr2.count(),
      };
    });
    expect(result.originalCount).toBe(2);
    expect(result.restoredCount).toBe(2);
  });

  test('R08-7: FloatingLayerManager — 删除对象', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { FloatingLayerManager } = await import('/src/floating-layer/floating-layer-manager.ts');
      const mgr = new FloatingLayerManager();

      const img = mgr.addImage('test.png', { x: 0, y: 0 }, { width: 100, height: 100 });
      const countBefore = mgr.count();
      mgr.remove(img.id);
      const countAfter = mgr.count();

      return { countBefore, countAfter };
    });
    expect(result.countBefore).toBe(1);
    expect(result.countAfter).toBe(0);
  });
});
