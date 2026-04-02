import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 性能基准测试 - 生成详细性能分析报告
 *
 * 收集各渲染阶段、操作类型的精确耗时数据，
 * 输出 Markdown 格式报告到 performance-report.md
 */

const DEFAULT_ROW_HEIGHT = 25;

// ============================================================
// 报告数据结构
// ============================================================

interface BenchmarkResult {
  name: string;
  category: string;
  samples: number[];
  unit: string;
}

const allResults: BenchmarkResult[] = [];

const addResult = (category: string, name: string, samples: number[], unit = 'ms') => {
  allResults.push({ name, category, samples, unit });
};

// ============================================================
// 辅助函数
// ============================================================

const injectData = async (page: Page, rowCount: number, colCount: number = 10): Promise<void> => {
  await page.evaluate(([rows, cols]) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => {
        expandRows: (n: number) => void;
        setCellContentNoHistory: (r: number, c: number, v: string) => void;
      };
      getRenderer: () => { render: () => void; updateViewport: () => void };
    };
    const model = app.getModel();
    model.expandRows(rows);
    for (let r = 0; r < rows; r += 1000) {
      for (let c = 0; c < cols; c++) {
        model.setCellContentNoHistory(r, c, `R${r}C${c}`);
      }
    }
    app.getRenderer().updateViewport();
    app.getRenderer().render();
  }, [rowCount, colCount] as [number, number]);
};

/** 测量渲染各阶段耗时（通过注入计时代码） */
const measureRenderPhases = async (page: Page): Promise<Record<string, number>> => {
  return await page.evaluate(() => {
    const app = (window as Record<string, unknown>).app as {
      getRenderer: () => Record<string, unknown> & {
        render: () => void;
        updateViewport: () => void;
      };
    };
    const renderer = app.getRenderer();
    const ctx = (renderer as Record<string, unknown>).ctx as CanvasRenderingContext2D;
    const model = (renderer as Record<string, unknown>).model as Record<string, unknown>;
    const viewport = (renderer as Record<string, unknown>).viewport as {
      startRow: number; endRow: number; startCol: number; endCol: number;
    };

    renderer.updateViewport();

    const timings: Record<string, number> = {};

    // 总渲染时间
    const totalStart = performance.now();
    renderer.render();
    timings['总渲染时间'] = performance.now() - totalStart;

    // 视口信息
    timings['视口行数'] = viewport.endRow - viewport.startRow + 1;
    timings['视口列数'] = viewport.endCol - viewport.startCol + 1;
    timings['视口单元格数'] = timings['视口行数'] * timings['视口列数'];

    // 单独测量各阶段
    // clearRect
    let t = performance.now();
    ctx.clearRect(0, 0, ctx.canvas.width / devicePixelRatio, ctx.canvas.height / devicePixelRatio);
    timings['clearRect'] = performance.now() - t;

    // getMergedCellInfo 调用开销
    t = performance.now();
    const getMergedCellInfo = (model as { getMergedCellInfo: (r: number, c: number) => unknown }).getMergedCellInfo.bind(model);
    for (let r = viewport.startRow; r <= viewport.endRow; r++) {
      for (let c = viewport.startCol; c <= viewport.endCol; c++) {
        getMergedCellInfo(r, c);
      }
    }
    timings['getMergedCellInfo (全视口)'] = performance.now() - t;

    // measureText 开销
    t = performance.now();
    for (let i = 0; i < 500; i++) {
      ctx.measureText('Sample text content 12345');
    }
    timings['measureText x500'] = performance.now() - t;

    // fillText 开销
    t = performance.now();
    for (let i = 0; i < 500; i++) {
      ctx.fillText('Sample text', 100, 100);
    }
    timings['fillText x500'] = performance.now() - t;

    // fillRect 开销
    t = performance.now();
    for (let i = 0; i < 1000; i++) {
      ctx.fillRect(0, 0, 100, 25);
    }
    timings['fillRect x1000'] = performance.now() - t;

    // beginPath + moveTo + lineTo + stroke 开销（单独）
    t = performance.now();
    for (let i = 0; i < 1000; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(100, i);
      ctx.stroke();
    }
    timings['单独 stroke x1000'] = performance.now() - t;

    // 批量 path + 一次 stroke 开销
    t = performance.now();
    ctx.beginPath();
    for (let i = 0; i < 1000; i++) {
      ctx.moveTo(0, i);
      ctx.lineTo(100, i);
    }
    ctx.stroke();
    timings['批量 path + 单次 stroke x1000'] = performance.now() - t;

    // save/restore 开销
    t = performance.now();
    for (let i = 0; i < 500; i++) {
      ctx.save();
      ctx.restore();
    }
    timings['save/restore x500'] = performance.now() - t;

    // save + clip + restore 开销
    t = performance.now();
    for (let i = 0; i < 500; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 800, 600);
      ctx.clip();
      ctx.restore();
    }
    timings['save + clip + restore x500'] = performance.now() - t;

    return timings;
  });
};

/** 测量滚动性能 */
const measureScrollFrames = async (
  page: Page, steps: number, deltaY: number
): Promise<number[]> => {
  return await page.evaluate(([s, dy]) => {
    const app = (window as Record<string, unknown>).app as {
      getRenderer: () => {
        scrollBy: (dx: number, dy: number) => void;
        render: () => void;
        updateViewport: () => void;
      };
    };
    const renderer = app.getRenderer();
    const frameTimes: number[] = [];
    for (let i = 0; i < s; i++) {
      renderer.scrollBy(0, dy);
      renderer.updateViewport();
      const start = performance.now();
      renderer.render();
      frameTimes.push(performance.now() - start);
    }
    return frameTimes;
  }, [steps, deltaY] as [number, number]);
};

/** 测量批量写入性能 */
const measureBatchWrite = async (
  page: Page, count: number
): Promise<{ writeTime: number; renderTime: number }> => {
  return await page.evaluate((cnt) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => {
        setCellContentNoHistory: (r: number, c: number, v: string) => void;
      };
      getRenderer: () => { render: () => void };
    };
    const model = app.getModel();

    const writeStart = performance.now();
    for (let i = 0; i < cnt; i++) {
      model.setCellContentNoHistory(Math.floor(i / 10), i % 10, `V${i}`);
    }
    const writeTime = performance.now() - writeStart;

    const renderStart = performance.now();
    app.getRenderer().render();
    const renderTime = performance.now() - renderStart;

    return { writeTime, renderTime };
  }, count);
};

/** 测量公式计算性能 */
const measureFormulaPerf = async (
  page: Page, formulaCount: number
): Promise<{ setupTime: number; computeTime: number }> => {
  return await page.evaluate(async (cnt) => {
    const app = (window as Record<string, unknown>).app as {
      getModel: () => {
        setCellContentNoHistory: (r: number, c: number, v: string) => void;
        setCellContent: (r: number, c: number, v: string) => { success: boolean };
        getCell: (r: number, c: number) => { isComputing?: boolean; content?: string } | null;
      };
      getRenderer: () => { render: () => void };
    };
    const model = app.getModel();

    // 填充源数据
    for (let i = 0; i < cnt; i++) {
      model.setCellContentNoHistory(i, 0, String(i + 1));
    }

    const setupStart = performance.now();
    for (let i = 0; i < cnt; i++) {
      model.setCellContent(i, 1, `=A${i + 1}*2`);
    }
    app.getRenderer().render();
    const setupTime = performance.now() - setupStart;

    // 等待所有公式计算完成
    const waitStart = performance.now();
    let allDone = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      await new Promise(r => setTimeout(r, 100));
      allDone = true;
      for (let i = 0; i < cnt; i++) {
        const cell = model.getCell(i, 1);
        if (cell?.isComputing) { allDone = false; break; }
      }
      if (allDone) break;
    }
    const computeTime = performance.now() - waitStart;

    return { setupTime, computeTime };
  }, formulaCount);
};

// ============================================================
// 测试用例 - 收集性能数据
// ============================================================

test.describe('性能基准测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);
  });

  test('1. 渲染各阶段耗时分析 - 空表格', async ({ page }) => {
    const phases = await measureRenderPhases(page);
    for (const [key, value] of Object.entries(phases)) {
      addResult('渲染阶段 (空表格)', key, [value], key.includes('数') ? '' : 'ms');
    }
    // 确保渲染正常
    expect(phases['总渲染时间']).toBeLessThan(100);
  });

  test('2. 渲染各阶段耗时分析 - 1万行数据', async ({ page }) => {
    await injectData(page, 10_000);
    const phases = await measureRenderPhases(page);
    for (const [key, value] of Object.entries(phases)) {
      addResult('渲染阶段 (1万行)', key, [value], key.includes('数') ? '' : 'ms');
    }
    expect(phases['总渲染时间']).toBeLessThan(100);
  });

  test('3. 渲染各阶段耗时分析 - 10万行数据', async ({ page }) => {
    await injectData(page, 100_000);
    const phases = await measureRenderPhases(page);
    for (const [key, value] of Object.entries(phases)) {
      addResult('渲染阶段 (10万行)', key, [value], key.includes('数') ? '' : 'ms');
    }
    expect(phases['总渲染时间']).toBeLessThan(100);
  });

  test('4. 滚动帧时间分布 - 1万行', async ({ page }) => {
    await injectData(page, 10_000);
    const frames = await measureScrollFrames(page, 100, 200);
    addResult('滚动性能 (1万行)', '帧时间分布', frames);
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    expect(avg).toBeLessThan(50);
  });

  test('5. 滚动帧时间分布 - 10万行', async ({ page }) => {
    await injectData(page, 100_000);
    const frames = await measureScrollFrames(page, 100, 500);
    addResult('滚动性能 (10万行)', '帧时间分布', frames);
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    expect(avg).toBeLessThan(50);
  });

  test('6. 滚动帧时间分布 - 10万行大步长', async ({ page }) => {
    await injectData(page, 100_000);
    const frames = await measureScrollFrames(page, 50, 5000);
    addResult('滚动性能 (10万行大步长)', '帧时间分布', frames);
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    expect(avg).toBeLessThan(50);
  });

  test('7. 批量写入性能', async ({ page }) => {
    for (const count of [100, 500, 1000, 5000]) {
      // 每次重新加载页面
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(300);

      const result = await measureBatchWrite(page, count);
      addResult('批量写入', `${count} 单元格 - 写入`, [result.writeTime]);
      addResult('批量写入', `${count} 单元格 - 渲染`, [result.renderTime]);
    }
    expect(true).toBe(true);
  });

  test('8. 公式计算性能', async ({ page }) => {
    for (const count of [10, 50, 100]) {
      await page.goto('/');
      await page.waitForSelector('#excel-canvas');
      await page.waitForTimeout(300);

      const result = await measureFormulaPerf(page, count);
      addResult('公式计算', `${count} 公式 - 提交`, [result.setupTime]);
      addResult('公式计算', `${count} 公式 - Worker计算`, [result.computeTime]);
    }
    expect(true).toBe(true);
  });

  test('9. 样式密集渲染性能', async ({ page }) => {
    const renderTime = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContentNoHistory: (r: number, c: number, v: string) => void;
          setCellBgColor: (r: number, c: number, color: string) => void;
          setCellFontColor: (r: number, c: number, color: string) => void;
          setCellFontBold: (r: number, c: number, bold: boolean) => void;
          setCellFontItalic: (r: number, c: number, italic: boolean) => void;
          setCellBorder: (r: number, c: number, border: unknown) => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
      const border = {
        top: { color: '#333', width: 1, style: 'solid' },
        bottom: { color: '#333', width: 1, style: 'solid' },
        left: { color: '#333', width: 1, style: 'solid' },
        right: { color: '#333', width: 1, style: 'solid' },
      };

      for (let r = 0; r < 30; r++) {
        for (let c = 0; c < 15; c++) {
          const idx = r * 15 + c;
          model.setCellContentNoHistory(r, c, `Style${idx}`);
          model.setCellBgColor(r, c, colors[idx % colors.length]);
          model.setCellFontColor(r, c, '#ffffff');
          if (idx % 2 === 0) model.setCellFontBold(r, c, true);
          if (idx % 3 === 0) model.setCellFontItalic(r, c, true);
          if (idx % 4 === 0) model.setCellBorder(r, c, border);
        }
      }

      const start = performance.now();
      app.getRenderer().render();
      return performance.now() - start;
    });
    addResult('样式密集渲染', '450 单元格 (bg+font+bold+italic+border)', [renderTime]);
    expect(renderTime).toBeLessThan(100);
  });

  test('10. 合并单元格渲染性能', async ({ page }) => {
    const renderTime = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContentNoHistory: (r: number, c: number, v: string) => void;
          mergeCells: (sr: number, sc: number, er: number, ec: number) => boolean;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      for (let i = 0; i < 30; i++) {
        const row = Math.floor(i / 5) * 4;
        const col = (i % 5) * 4;
        model.setCellContentNoHistory(row, col, `Merged-${i}`);
        model.mergeCells(row, col, row + 2, col + 2);
      }
      const start = performance.now();
      app.getRenderer().render();
      return performance.now() - start;
    });
    addResult('合并单元格渲染', '30 个 3x3 合并区域', [renderTime]);
    expect(renderTime).toBeLessThan(100);
  });

  test('11. 长文本渲染性能', async ({ page }) => {
    const renderTimes = await page.evaluate(() => {
      const app = (window as Record<string, unknown>).app as {
        getModel: () => {
          setCellContentNoHistory: (r: number, c: number, v: string) => void;
        };
        getRenderer: () => { render: () => void };
      };
      const model = app.getModel();
      const results: Record<string, number> = {};

      // 短文本
      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 10; c++) {
          model.setCellContentNoHistory(r, c, `Short${r * 10 + c}`);
        }
      }
      let start = performance.now();
      app.getRenderer().render();
      results['短文本 200 单元格'] = performance.now() - start;

      // 中等文本 (50 字符)
      const medText = 'M'.repeat(50);
      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 10; c++) {
          model.setCellContentNoHistory(r, c, medText);
        }
      }
      start = performance.now();
      app.getRenderer().render();
      results['中等文本 200 单元格 (50字符)'] = performance.now() - start;

      // 长文本 (200 字符)
      const longText = 'L'.repeat(200);
      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 10; c++) {
          model.setCellContentNoHistory(r, c, longText);
        }
      }
      start = performance.now();
      app.getRenderer().render();
      results['长文本 200 单元格 (200字符)'] = performance.now() - start;

      // 超长文本 (500 字符)
      const veryLongText = 'X'.repeat(500);
      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 10; c++) {
          model.setCellContentNoHistory(r, c, veryLongText);
        }
      }
      start = performance.now();
      app.getRenderer().render();
      results['超长文本 200 单元格 (500字符)'] = performance.now() - start;

      return results;
    });

    for (const [key, value] of Object.entries(renderTimes)) {
      addResult('长文本渲染', key, [value]);
    }
    expect(true).toBe(true);
  });

  // 最后一个测试：生成报告
  test('99. 生成性能分析报告', async () => {
    const lines: string[] = [];
    lines.push('# ICE Excel 性能分析报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    // 按 category 分组
    const categories = new Map<string, BenchmarkResult[]>();
    for (const r of allResults) {
      if (!categories.has(r.category)) categories.set(r.category, []);
      categories.get(r.category)!.push(r);
    }

    for (const [category, results] of categories) {
      lines.push(`## ${category}`);
      lines.push('');
      lines.push('| 指标 | 最小值 | 平均值 | 最大值 | P95 | 单位 |');
      lines.push('|------|--------|--------|--------|-----|------|');

      for (const r of results) {
        const sorted = [...r.samples].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
        const p95Idx = Math.floor(sorted.length * 0.95);
        const p95 = sorted[Math.min(p95Idx, sorted.length - 1)];

        const fmt = (v: number) => r.unit === '' ? String(Math.round(v)) : v.toFixed(2);
        lines.push(`| ${r.name} | ${fmt(min)} | ${fmt(avg)} | ${fmt(max)} | ${fmt(p95)} | ${r.unit} |`);
      }
      lines.push('');
    }

    // 性能建议
    lines.push('## 性能分析与优化建议');
    lines.push('');

    // 分析渲染阶段数据
    const renderPhases10w = categories.get('渲染阶段 (10万行)');
    if (renderPhases10w) {
      const totalRender = renderPhases10w.find(r => r.name === '总渲染时间');
      const mergedCellInfo = renderPhases10w.find(r => r.name === 'getMergedCellInfo (全视口)');
      const singleStroke = renderPhases10w.find(r => r.name === '单独 stroke x1000');
      const batchStroke = renderPhases10w.find(r => r.name === '批量 path + 单次 stroke x1000');
      const saveRestore = renderPhases10w.find(r => r.name === 'save/restore x500');
      const saveClipRestore = renderPhases10w.find(r => r.name === 'save + clip + restore x500');

      lines.push('### 渲染管线分析 (10万行数据)');
      lines.push('');

      if (totalRender) {
        const t = totalRender.samples[0];
        if (t < 16) {
          lines.push(`- ✅ 总渲染时间 ${t.toFixed(2)}ms，在 16ms 帧预算内，流畅`);
        } else if (t < 33) {
          lines.push(`- ⚠️ 总渲染时间 ${t.toFixed(2)}ms，超过 16ms 帧预算，30fps 可接受`);
        } else {
          lines.push(`- ❌ 总渲染时间 ${t.toFixed(2)}ms，超过 33ms，可能出现明显卡顿`);
        }
      }

      if (mergedCellInfo) {
        const t = mergedCellInfo.samples[0];
        lines.push(`- getMergedCellInfo 全视口调用耗时 ${t.toFixed(2)}ms${t > 2 ? ' ⚠️ 可考虑进一步缓存' : ' ✅'}`);
      }

      if (singleStroke && batchStroke) {
        const ratio = singleStroke.samples[0] / batchStroke.samples[0];
        lines.push(`- 批量 stroke 相比单独 stroke 快 ${ratio.toFixed(1)}x（${singleStroke.samples[0].toFixed(2)}ms vs ${batchStroke.samples[0].toFixed(2)}ms）`);
      }

      if (saveRestore && saveClipRestore) {
        lines.push(`- save/restore x500: ${saveRestore.samples[0].toFixed(2)}ms, save+clip+restore x500: ${saveClipRestore.samples[0].toFixed(2)}ms`);
      }
      lines.push('');
    }

    // 分析滚动性能
    const scroll10w = categories.get('滚动性能 (10万行)');
    if (scroll10w) {
      const frames = scroll10w[0]?.samples || [];
      if (frames.length > 0) {
        const sorted = [...frames].sort((a, b) => a - b);
        const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
        const p99 = sorted[Math.floor(sorted.length * 0.99)];
        const jank = frames.filter(f => f > 16).length;

        lines.push('### 滚动性能分析 (10万行)');
        lines.push('');
        lines.push(`- 平均帧时间: ${avg.toFixed(2)}ms`);
        lines.push(`- P99 帧时间: ${p99.toFixed(2)}ms`);
        lines.push(`- 卡顿帧 (>16ms): ${jank}/${frames.length} (${(jank / frames.length * 100).toFixed(1)}%)`);

        if (jank / frames.length > 0.1) {
          lines.push('- ⚠️ 超过 10% 的帧超过 16ms，滚动可能有轻微卡顿感');
        } else {
          lines.push('- ✅ 滚动流畅');
        }
        lines.push('');
      }
    }

    // 分析批量写入
    const batchWrite = categories.get('批量写入');
    if (batchWrite) {
      lines.push('### 批量写入性能');
      lines.push('');
      for (const r of batchWrite) {
        const t = r.samples[0];
        lines.push(`- ${r.name}: ${t.toFixed(2)}ms`);
      }
      lines.push('');
    }

    // 分析公式计算
    const formulaPerf = categories.get('公式计算');
    if (formulaPerf) {
      lines.push('### 公式计算性能');
      lines.push('');
      for (const r of formulaPerf) {
        const t = r.samples[0];
        lines.push(`- ${r.name}: ${t.toFixed(2)}ms`);
      }
      lines.push('');
    }

    // 分析长文本
    const longTextPerf = categories.get('长文本渲染');
    if (longTextPerf) {
      lines.push('### 长文本渲染性能');
      lines.push('');
      for (const r of longTextPerf) {
        const t = r.samples[0];
        const status = t < 16 ? '✅' : t < 33 ? '⚠️' : '❌';
        lines.push(`- ${status} ${r.name}: ${t.toFixed(2)}ms`);
      }
      lines.push('');
    }

    // 写入报告文件
    const reportPath = path.join(process.cwd(), 'performance-report.md');
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');

    console.log(`\n📊 性能报告已生成: ${reportPath}\n`);
    expect(allResults.length).toBeGreaterThan(0);
  });
});
