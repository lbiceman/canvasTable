import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FunctionRegistry } from '../../../formula/function-registry';
import { registerDateFunctions } from '../../../formula/functions/date';
import { isError } from '../../../formula/evaluator';
import type { FormulaValue, EvaluationContext } from '../../../formula/types';

// ============================================================
// 测试辅助工具
// ============================================================

/** 空的求值上下文（日期函数不需要上下文） */
const dummyContext: EvaluationContext = {
  row: 0,
  col: 0,
  getCellValue: () => 0,
  getRangeValues: () => [],
  resolveNamedRange: () => null,
};

let registry: FunctionRegistry;

/** 调用已注册函数的辅助方法 */
function callFn(name: string, args: FormulaValue[]): FormulaValue {
  const def = registry.get(name);
  if (!def) throw new Error(`函数 ${name} 未注册`);
  return def.handler(args, dummyContext);
}

beforeEach(() => {
  registry = new FunctionRegistry();
  registerDateFunctions(registry);
});

// ============================================================
// TODAY 函数测试
// ============================================================

describe('TODAY', () => {
  it('应返回当前日期（yyyy-MM-dd 格式）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 0)); // 2024-06-15
    const result = callFn('TODAY', []);
    expect(result).toBe('2024-06-15');
    vi.useRealTimers();
  });

  it('应返回正确的日期格式', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1)); // 2024-01-01
    const result = callFn('TODAY', []);
    expect(result).toBe('2024-01-01');
    vi.useRealTimers();
  });
});

// ============================================================
// NOW 函数测试
// ============================================================

describe('NOW', () => {
  it('应返回当前日期时间（yyyy-MM-dd HH:mm:ss 格式）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15, 14, 30, 45)); // 2024-06-15 14:30:45
    const result = callFn('NOW', []);
    expect(result).toBe('2024-06-15 14:30:45');
    vi.useRealTimers();
  });

  it('应正确补零', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 5, 3, 7, 9)); // 2024-01-05 03:07:09
    const result = callFn('NOW', []);
    expect(result).toBe('2024-01-05 03:07:09');
    vi.useRealTimers();
  });
});

// ============================================================
// DATE 函数测试
// ============================================================

describe('DATE', () => {
  it('应根据年月日构造日期字符串', () => {
    expect(callFn('DATE', [2024, 1, 15])).toBe('2024-01-15');
  });

  it('应支持月份溢出自动进位', () => {
    // month=13 → 下一年1月
    expect(callFn('DATE', [2024, 13, 1])).toBe('2025-01-01');
  });

  it('应支持日溢出自动进位', () => {
    // 2024年2月有29天，day=30 → 3月1日
    expect(callFn('DATE', [2024, 2, 30])).toBe('2024-03-01');
  });

  it('应支持闰年2月29日', () => {
    expect(callFn('DATE', [2024, 2, 29])).toBe('2024-02-29');
  });

  it('非数值参数应返回 #VALUE!', () => {
    const result = callFn('DATE', ['abc', 1, 1]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// YEAR 函数测试
// ============================================================

describe('YEAR', () => {
  it('应从日期字符串提取年份', () => {
    expect(callFn('YEAR', ['2024-01-15'])).toBe(2024);
  });

  it('应支持 DATE 函数返回值', () => {
    const dateStr = callFn('DATE', [2024, 6, 15]);
    expect(callFn('YEAR', [dateStr])).toBe(2024);
  });

  it('无效日期应返回 #VALUE!', () => {
    const result = callFn('YEAR', ['不是日期']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// MONTH 函数测试
// ============================================================

describe('MONTH', () => {
  it('应从日期字符串提取月份', () => {
    expect(callFn('MONTH', ['2024-01-15'])).toBe(1);
  });

  it('应返回 12 月', () => {
    expect(callFn('MONTH', ['2024-12-25'])).toBe(12);
  });

  it('无效日期应返回 #VALUE!', () => {
    const result = callFn('MONTH', ['不是日期']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// DAY 函数测试
// ============================================================

describe('DAY', () => {
  it('应从日期字符串提取日', () => {
    expect(callFn('DAY', ['2024-01-15'])).toBe(15);
  });

  it('应支持闰年2月29日', () => {
    expect(callFn('DAY', ['2024-02-29'])).toBe(29);
  });

  it('无效日期应返回 #VALUE!', () => {
    const result = callFn('DAY', ['不是日期']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// DATEDIF 函数测试
// ============================================================

describe('DATEDIF', () => {
  it('应计算天数差（单位 D）', () => {
    expect(callFn('DATEDIF', ['2024-01-01', '2024-12-31', 'D'])).toBe(365);
  });

  it('应计算月数差（单位 M）', () => {
    expect(callFn('DATEDIF', ['2024-01-01', '2024-12-31', 'M'])).toBe(11);
  });

  it('应计算年数差（单位 Y）', () => {
    expect(callFn('DATEDIF', ['2024-01-01', '2024-12-31', 'Y'])).toBe(0);
  });

  it('跨年应正确计算年数', () => {
    expect(callFn('DATEDIF', ['2020-01-01', '2024-01-01', 'Y'])).toBe(4);
  });

  it('开始日期晚于结束日期应返回 #NUM!', () => {
    const result = callFn('DATEDIF', ['2024-12-31', '2024-01-01', 'D']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#NUM!');
  });

  it('无效单位应返回 #NUM!', () => {
    const result = callFn('DATEDIF', ['2024-01-01', '2024-12-31', 'X']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#NUM!');
  });

  it('无效日期应返回 #VALUE!', () => {
    const result = callFn('DATEDIF', ['不是日期', '2024-12-31', 'D']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });

  it('相同日期天数差应为 0', () => {
    expect(callFn('DATEDIF', ['2024-06-15', '2024-06-15', 'D'])).toBe(0);
  });

  it('单位不区分大小写', () => {
    expect(callFn('DATEDIF', ['2024-01-01', '2024-12-31', 'd'])).toBe(365);
    expect(callFn('DATEDIF', ['2024-01-01', '2024-12-31', 'm'])).toBe(11);
    expect(callFn('DATEDIF', ['2024-01-01', '2024-12-31', 'y'])).toBe(0);
  });
});

// ============================================================
// EDATE 函数测试
// ============================================================

describe('EDATE', () => {
  it('应返回指定月数后的日期', () => {
    expect(callFn('EDATE', ['2024-01-15', 3])).toBe('2024-04-15');
  });

  it('月末日期应调整到目标月最后一天', () => {
    // 1月31日 + 1个月 → 2月29日（2024闰年）
    expect(callFn('EDATE', ['2024-01-31', 1])).toBe('2024-02-29');
  });

  it('应支持负数月份（向前）', () => {
    expect(callFn('EDATE', ['2024-06-15', -3])).toBe('2024-03-15');
  });

  it('应支持跨年', () => {
    expect(callFn('EDATE', ['2024-11-15', 3])).toBe('2025-02-15');
  });

  it('无效日期应返回 #VALUE!', () => {
    const result = callFn('EDATE', ['不是日期', 3]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// EOMONTH 函数测试
// ============================================================

describe('EOMONTH', () => {
  it('应返回当月最后一天（偏移 0）', () => {
    expect(callFn('EOMONTH', ['2024-01-15', 0])).toBe('2024-01-31');
  });

  it('应返回下月最后一天（偏移 1）', () => {
    // 2024年2月是闰年，最后一天是29日
    expect(callFn('EOMONTH', ['2024-01-15', 1])).toBe('2024-02-29');
  });

  it('应支持负数偏移', () => {
    expect(callFn('EOMONTH', ['2024-06-15', -1])).toBe('2024-05-31');
  });

  it('应支持跨年', () => {
    expect(callFn('EOMONTH', ['2024-11-15', 2])).toBe('2025-01-31');
  });

  it('非闰年2月应返回28日', () => {
    expect(callFn('EOMONTH', ['2023-01-15', 1])).toBe('2023-02-28');
  });

  it('无效日期应返回 #VALUE!', () => {
    const result = callFn('EOMONTH', ['不是日期', 0]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// 函数注册验证
// ============================================================

describe('registerDateFunctions', () => {
  it('应注册全部 9 个日期函数', () => {
    const names = ['TODAY', 'NOW', 'DATE', 'YEAR', 'MONTH', 'DAY', 'DATEDIF', 'EDATE', 'EOMONTH'];
    for (const name of names) {
      expect(registry.get(name)).toBeDefined();
    }
  });

  it('每个函数应有正确的 category', () => {
    const names = ['TODAY', 'NOW', 'DATE', 'YEAR', 'MONTH', 'DAY', 'DATEDIF', 'EDATE', 'EOMONTH'];
    for (const name of names) {
      expect(registry.get(name)?.category).toBe('date');
    }
  });
});
