// ============================================================
// CsvExporter 单元测试
// ============================================================

import { describe, it, expect } from 'vitest';
import { CsvExporter } from '../../print-export/csv-exporter';
import { PrintArea } from '../../print-export/print-area';
import type { Cell } from '../../types';

/** 创建一个空单元格 */
const emptyCell = (): Cell => ({
  content: '',
  rowSpan: 1,
  colSpan: 1,
  isMerged: false,
});

/** 创建一个带内容的单元格 */
const cell = (content: string, extra: Partial<Cell> = {}): Cell => ({
  ...emptyCell(),
  content,
  ...extra,
});

/** 创建一个简单的模型 */
const createModel = (cells: Cell[][]) => ({
  cells,
  getRowCount: () => cells.length,
  getColCount: () => (cells[0]?.length ?? 0),
});

describe('CsvExporter', () => {
  describe('escapeField', () => {
    it('普通文本不需要转义', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      expect(exporter.escapeField('hello')).toBe('hello');
    });

    it('包含逗号的字段用双引号包裹', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      expect(exporter.escapeField('a,b')).toBe('"a,b"');
    });

    it('包含换行符的字段用双引号包裹', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      expect(exporter.escapeField('line1\nline2')).toBe('"line1\nline2"');
    });

    it('包含回车符的字段用双引号包裹', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      expect(exporter.escapeField('line1\rline2')).toBe('"line1\rline2"');
    });

    it('包含双引号的字段进行双写转义', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      expect(exporter.escapeField('say "hello"')).toBe('"say ""hello"""');
    });

    it('空字符串不需要转义', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      expect(exporter.escapeField('')).toBe('');
    });

    it('中文内容不需要转义', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      expect(exporter.escapeField('你好世界')).toBe('你好世界');
    });
  });

  describe('getDisplayValue', () => {
    it('普通单元格返回 content', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      const c = cell('Hello');
      expect(exporter.getDisplayValue(c)).toBe('Hello');
    });

    it('合并单元格的非左上角位置返回空字符串', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      const mergedChild = cell('should not show', {
        isMerged: true,
        mergeParent: { row: 0, col: 0 },
      });
      expect(exporter.getDisplayValue(mergedChild)).toBe('');
    });

    it('合并单元格的左上角（父单元格）正常输出内容', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      const mergeParent = cell('Parent', {
        rowSpan: 2,
        colSpan: 2,
        isMerged: false,
      });
      expect(exporter.getDisplayValue(mergeParent)).toBe('Parent');
    });

    it('有格式的数值单元格返回格式化后的值', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      const c = cell('', {
        rawValue: 0.15,
        format: { category: 'percentage', pattern: '0.00%' },
      });
      expect(exporter.getDisplayValue(c)).toBe('15.00%');
    });

    it('货币格式返回带符号的值', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      const c = cell('', {
        rawValue: 1234.5,
        format: { category: 'currency', pattern: '¥#,##0.00', currencySymbol: '¥' },
      });
      expect(exporter.getDisplayValue(c)).toBe('¥1234.50');
    });

    it('数字格式带千分位分隔符', () => {
      const model = createModel([[emptyCell()]]);
      const exporter = new CsvExporter(model);
      const c = cell('', {
        rawValue: 1234567.89,
        format: { category: 'number', pattern: '#,##0.00' },
      });
      expect(exporter.getDisplayValue(c)).toBe('1,234,567.89');
    });
  });

  describe('toCsvString', () => {
    it('空表格生成空字符串', () => {
      const model = createModel([]);
      const exporter = new CsvExporter(model);
      // 空范围（endRow < startRow）
      const result = exporter.toCsvString(model, {
        startRow: 0, startCol: 0, endRow: -1, endCol: -1,
      });
      expect(result).toBe('');
    });

    it('单个单元格生成正确的 CSV', () => {
      const model = createModel([[cell('Hello')]]);
      const exporter = new CsvExporter(model);
      const result = exporter.toCsvString(model, {
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
      });
      expect(result).toBe('Hello');
    });

    it('多行多列使用逗号和 CRLF 分隔', () => {
      const model = createModel([
        [cell('A1'), cell('B1')],
        [cell('A2'), cell('B2')],
      ]);
      const exporter = new CsvExporter(model);
      const result = exporter.toCsvString(model, {
        startRow: 0, startCol: 0, endRow: 1, endCol: 1,
      });
      expect(result).toBe('A1,B1\r\nA2,B2');
    });

    it('中文内容正确导出', () => {
      const model = createModel([
        [cell('姓名'), cell('年龄')],
        [cell('张三'), cell('25')],
      ]);
      const exporter = new CsvExporter(model);
      const result = exporter.toCsvString(model, {
        startRow: 0, startCol: 0, endRow: 1, endCol: 1,
      });
      expect(result).toBe('姓名,年龄\r\n张三,25');
    });

    it('合并单元格仅在左上角输出内容', () => {
      const parentCell = cell('Merged', { rowSpan: 2, colSpan: 2 });
      const childCell = (r: number, c: number) => cell('', {
        isMerged: true,
        mergeParent: { row: 0, col: 0 },
      });

      const model = createModel([
        [parentCell, childCell(0, 1)],
        [childCell(1, 0), childCell(1, 1)],
      ]);
      const exporter = new CsvExporter(model);
      const result = exporter.toCsvString(model, {
        startRow: 0, startCol: 0, endRow: 1, endCol: 1,
      });
      expect(result).toBe('Merged,\r\n,');
    });

    it('包含特殊字符的字段正确转义', () => {
      const model = createModel([
        [cell('has,comma'), cell('has"quote')],
      ]);
      const exporter = new CsvExporter(model);
      const result = exporter.toCsvString(model, {
        startRow: 0, startCol: 0, endRow: 0, endCol: 1,
      });
      expect(result).toBe('"has,comma","has""quote"');
    });
  });

  describe('打印区域过滤', () => {
    it('usePrintArea 为 true 且打印区域已设置时，仅导出打印区域', () => {
      const model = createModel([
        [cell('A1'), cell('B1'), cell('C1')],
        [cell('A2'), cell('B2'), cell('C2')],
        [cell('A3'), cell('B3'), cell('C3')],
      ]);
      const exporter = new CsvExporter(model);
      const printArea = new PrintArea();
      printArea.set({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });

      const result = exporter.toCsvString(
        model,
        printArea.getEffectiveRange(model),
      );
      expect(result).toBe('A1,B1\r\nA2,B2');
    });
  });
});
