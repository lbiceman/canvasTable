import { describe, it, expect, beforeEach } from 'vitest';
import { FunctionRegistry } from '../../../formula/function-registry';
import { registerTextFunctions } from '../../../formula/functions/text';
import { isError } from '../../../formula/evaluator';
import type { FormulaValue, EvaluationContext } from '../../../formula/types';

// ============================================================
// 测试辅助工具
// ============================================================

/** 空的求值上下文（文本函数不需要上下文） */
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
  registerTextFunctions(registry);
});

// ============================================================
// LEFT 函数测试
// ============================================================

describe('LEFT', () => {
  it('应从左侧提取指定数量的字符', () => {
    expect(callFn('LEFT', ['Hello', 3])).toBe('Hel');
  });

  it('默认提取 1 个字符', () => {
    expect(callFn('LEFT', ['Hello'])).toBe('H');
  });

  it('num_chars 为 0 应返回空字符串', () => {
    expect(callFn('LEFT', ['Hello', 0])).toBe('');
  });

  it('num_chars 超过文本长度应返回完整文本', () => {
    expect(callFn('LEFT', ['Hi', 10])).toBe('Hi');
  });

  it('数值参数应先转为字符串', () => {
    expect(callFn('LEFT', [123, 2])).toBe('12');
  });

  it('负数 num_chars 应返回 #VALUE!', () => {
    const result = callFn('LEFT', ['Hello', -1]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// RIGHT 函数测试
// ============================================================

describe('RIGHT', () => {
  it('应从右侧提取指定数量的字符', () => {
    expect(callFn('RIGHT', ['Hello', 3])).toBe('llo');
  });

  it('默认提取 1 个字符', () => {
    expect(callFn('RIGHT', ['Hello'])).toBe('o');
  });

  it('num_chars 为 0 应返回空字符串', () => {
    expect(callFn('RIGHT', ['Hello', 0])).toBe('');
  });

  it('num_chars 超过文本长度应返回完整文本', () => {
    expect(callFn('RIGHT', ['Hello', 5])).toBe('Hello');
  });

  it('数值参数应先转为字符串', () => {
    expect(callFn('RIGHT', [123, 2])).toBe('23');
  });
});

// ============================================================
// MID 函数测试
// ============================================================

describe('MID', () => {
  it('应从指定位置提取字符', () => {
    expect(callFn('MID', ['Hello', 2, 3])).toBe('ell');
  });

  it('从位置 1 开始提取全部', () => {
    expect(callFn('MID', ['Hello', 1, 5])).toBe('Hello');
  });

  it('起始位置小于 1 应返回空字符串', () => {
    expect(callFn('MID', ['Hello', 0, 3])).toBe('');
  });

  it('起始位置超出文本长度应返回空字符串', () => {
    expect(callFn('MID', ['Hello', 10, 3])).toBe('');
  });

  it('num_chars 超出剩余长度应返回到末尾', () => {
    expect(callFn('MID', ['Hello', 4, 10])).toBe('lo');
  });
});

// ============================================================
// LEN 函数测试
// ============================================================

describe('LEN', () => {
  it('应返回字符串长度', () => {
    expect(callFn('LEN', ['Hello'])).toBe(5);
  });

  it('空字符串长度为 0', () => {
    expect(callFn('LEN', [''])).toBe(0);
  });

  it('数值参数应先转为字符串', () => {
    expect(callFn('LEN', [123])).toBe(3);
  });
});

// ============================================================
// TRIM 函数测试
// ============================================================

describe('TRIM', () => {
  it('应去除首尾空格', () => {
    expect(callFn('TRIM', ['  Hello  '])).toBe('Hello');
  });

  it('应将中间连续空格缩减为单个', () => {
    expect(callFn('TRIM', ['Hello  World'])).toBe('Hello World');
  });

  it('应同时处理首尾和中间空格', () => {
    expect(callFn('TRIM', ['  Hello   World  '])).toBe('Hello World');
  });

  it('无多余空格的文本应保持不变', () => {
    expect(callFn('TRIM', ['Hello'])).toBe('Hello');
  });
});

// ============================================================
// UPPER 函数测试
// ============================================================

describe('UPPER', () => {
  it('应将文本转为大写', () => {
    expect(callFn('UPPER', ['hello'])).toBe('HELLO');
  });

  it('混合大小写应全部转为大写', () => {
    expect(callFn('UPPER', ['Hello World'])).toBe('HELLO WORLD');
  });

  it('已是大写应保持不变', () => {
    expect(callFn('UPPER', ['HELLO'])).toBe('HELLO');
  });
});

// ============================================================
// LOWER 函数测试
// ============================================================

describe('LOWER', () => {
  it('应将文本转为小写', () => {
    expect(callFn('LOWER', ['HELLO'])).toBe('hello');
  });

  it('混合大小写应全部转为小写', () => {
    expect(callFn('LOWER', ['Hello World'])).toBe('hello world');
  });

  it('已是小写应保持不变', () => {
    expect(callFn('LOWER', ['hello'])).toBe('hello');
  });
});

// ============================================================
// CONCATENATE 函数测试
// ============================================================

describe('CONCATENATE', () => {
  it('应连接多个字符串', () => {
    expect(callFn('CONCATENATE', ['A', 'B', 'C'])).toBe('ABC');
  });

  it('应连接含空格的字符串', () => {
    expect(callFn('CONCATENATE', ['Hello', ' ', 'World'])).toBe('Hello World');
  });

  it('应将数值参数转为字符串后连接', () => {
    expect(callFn('CONCATENATE', ['Value: ', 42])).toBe('Value: 42');
  });

  it('单个参数应返回该参数的字符串形式', () => {
    expect(callFn('CONCATENATE', ['Hello'])).toBe('Hello');
  });

  it('错误值参数应传播错误', () => {
    const err = { type: '#VALUE!' as const, message: '测试错误' };
    const result = callFn('CONCATENATE', ['Hello', err]);
    expect(isError(result)).toBe(true);
  });
});

// ============================================================
// SUBSTITUTE 函数测试
// ============================================================

describe('SUBSTITUTE', () => {
  it('应替换所有出现的子串', () => {
    expect(callFn('SUBSTITUTE', ['Hello World', 'World', 'Excel'])).toBe('Hello Excel');
  });

  it('应替换所有出现（多次）', () => {
    expect(callFn('SUBSTITUTE', ['aaa', 'a', 'b'])).toBe('bbb');
  });

  it('指定 instance_num 应只替换第 N 次出现', () => {
    expect(callFn('SUBSTITUTE', ['aaa', 'a', 'b', 2])).toBe('aba');
  });

  it('未找到旧文本应返回原文本', () => {
    expect(callFn('SUBSTITUTE', ['Hello', 'xyz', 'abc'])).toBe('Hello');
  });

  it('旧文本为空应返回原文本', () => {
    expect(callFn('SUBSTITUTE', ['Hello', '', 'abc'])).toBe('Hello');
  });

  it('instance_num 小于 1 应返回 #VALUE!', () => {
    const result = callFn('SUBSTITUTE', ['aaa', 'a', 'b', 0]);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });
});

// ============================================================
// FIND 函数测试
// ============================================================

describe('FIND', () => {
  it('应返回子串的位置（区分大小写）', () => {
    expect(callFn('FIND', ['lo', 'Hello'])).toBe(4);
  });

  it('大小写不匹配应返回 #VALUE!', () => {
    const result = callFn('FIND', ['LO', 'Hello']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });

  it('未找到应返回 #VALUE!', () => {
    const result = callFn('FIND', ['xyz', 'Hello']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });

  it('应支持 start_num 参数', () => {
    expect(callFn('FIND', ['l', 'Hello World', 5])).toBe(10);
  });

  it('从位置 1 开始查找', () => {
    expect(callFn('FIND', ['H', 'Hello', 1])).toBe(1);
  });
});

// ============================================================
// SEARCH 函数测试
// ============================================================

describe('SEARCH', () => {
  it('应返回子串的位置（不区分大小写）', () => {
    expect(callFn('SEARCH', ['LO', 'Hello'])).toBe(4);
  });

  it('小写查找大写文本', () => {
    expect(callFn('SEARCH', ['lo', 'HELLO'])).toBe(4);
  });

  it('未找到应返回 #VALUE!', () => {
    const result = callFn('SEARCH', ['xyz', 'Hello']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });

  it('应支持 start_num 参数', () => {
    expect(callFn('SEARCH', ['l', 'Hello World', 5])).toBe(10);
  });
});

// ============================================================
// TEXT 函数测试
// ============================================================

describe('TEXT', () => {
  it('应支持千分位格式', () => {
    expect(callFn('TEXT', [1234.5, '#,##0.00'])).toBe('1,234.50');
  });

  it('应支持百分比格式', () => {
    expect(callFn('TEXT', [0.75, '0%'])).toBe('75%');
  });

  it('应支持固定小数位格式', () => {
    expect(callFn('TEXT', [3.14159, '0.00'])).toBe('3.14');
  });

  it('应支持整数千分位格式', () => {
    expect(callFn('TEXT', [1000000, '#,##0'])).toBe('1,000,000');
  });

  it('非数值参数应返回 #VALUE!', () => {
    const result = callFn('TEXT', ['abc', '0.00']);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.type).toBe('#VALUE!');
  });

  it('负数应正确格式化', () => {
    expect(callFn('TEXT', [-1234.5, '#,##0.00'])).toBe('-1,234.50');
  });

  it('百分比带小数位', () => {
    expect(callFn('TEXT', [0.1234, '0.00%'])).toBe('12.34%');
  });
});

// ============================================================
// 函数注册验证
// ============================================================

describe('registerTextFunctions', () => {
  it('应注册全部 12 个文本函数', () => {
    const names = [
      'LEFT', 'RIGHT', 'MID', 'LEN', 'TRIM',
      'UPPER', 'LOWER', 'CONCATENATE', 'SUBSTITUTE',
      'FIND', 'SEARCH', 'TEXT',
    ];
    for (const name of names) {
      expect(registry.get(name)).toBeDefined();
    }
  });

  it('每个函数应有正确的 category', () => {
    const names = [
      'LEFT', 'RIGHT', 'MID', 'LEN', 'TRIM',
      'UPPER', 'LOWER', 'CONCATENATE', 'SUBSTITUTE',
      'FIND', 'SEARCH', 'TEXT',
    ];
    for (const name of names) {
      expect(registry.get(name)?.category).toBe('text');
    }
  });
});
