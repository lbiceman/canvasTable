import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Tokenizer } from '../../formula/tokenizer';

// ============================================================
// Property 10: 单引号 Sheet 名称解析 round-trip
// Feature: formula-functions-p1, Property 10: 单引号 Sheet 名称解析 round-trip
// **Validates: Requirements 4.4**
// ============================================================

describe('Property 10: 单引号 Sheet 名称解析 round-trip', () => {
  const tokenizer = new Tokenizer();

  /**
   * 生成合法的 Sheet 名称（包含空格或特殊字符，但不含单引号和 !）
   * 至少 1 个字符，以字母开头
   */
  /**
   * 生成安全字符（排除单引号、!、控制字符）
   */
  const arbSafeChar = fc.integer({ min: 32, max: 126 })
    .filter((code) => {
      const ch = String.fromCharCode(code);
      return ch !== "'" && ch !== '!';
    })
    .map((code) => String.fromCharCode(code));

  /** 生成含特殊字符的 Sheet 名称（以字母前缀开头，后跟安全字符） */
  const arbSheetName = fc.tuple(
    fc.constantFrom('A', 'B', 'Sheet', 'Data', 'My', 'Q'),
    fc.array(arbSafeChar, { minLength: 0, maxLength: 15 }).map((chars) => chars.join('')),
  ).map(([prefix, rest]) => prefix + rest);

  it('单引号包裹的 Sheet 名称经 Tokenizer 解析后应还原原始名称', () => {
    fc.assert(
      fc.property(
        arbSheetName,
        (sheetName) => {
          // 构造 'SheetName'!A1 格式的输入
          const input = `'${sheetName}'!A1`;
          const tokens = tokenizer.tokenize(input);

          // 找到 SheetRef token
          const sheetRefToken = tokens.find((t) => t.type === 'SheetRef');
          expect(sheetRefToken).toBeDefined();

          if (sheetRefToken) {
            // SheetRef value 格式为 "SheetName!CellRef"
            const exclamIdx = sheetRefToken.value.lastIndexOf('!');
            expect(exclamIdx).toBeGreaterThan(0);
            const parsedName = sheetRefToken.value.substring(0, exclamIdx);
            // 解析出的 Sheet 名称应等于原始名称
            expect(parsedName).toBe(sheetName);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
