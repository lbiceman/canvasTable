import { describe, it, expect } from 'vitest';
import { SpreadsheetModel } from '../model';
import type { CellFormat, ValidationRule } from '../types';

describe('Model 层格式集成测试', () => {
  // ========== setCellContent 自动类型检测 ==========
  describe('setCellContent 自动类型检测', () => {
    it('输入纯数字后自动检测 dataType=number', () => {
      const model = new SpreadsheetModel(10, 10);
      model.setCellContent(0, 0, '1234');
      const cell = model.getCell(0, 0);
      expect(cell).not.toBeNull();
      expect(cell!.dataType).toBe('number');
      expect(cell!.rawValue).toBe(1234);
    });

    it('输入百分比后自动检测 dataType=percentage', () => {
      const model = new SpreadsheetModel(10, 10);
      model.setCellContent(0, 0, '50%');
      const cell = model.getCell(0, 0);
      expect(cell!.dataType).toBe('percentage');
      expect(cell!.rawValue).toBeCloseTo(0.5);
    });

    it('输入货币后自动检测 dataType=currency', () => {
      const model = new SpreadsheetModel(10, 10);
      model.setCellContent(0, 0, '¥100');
      const cell = model.getCell(0, 0);
      expect(cell!.dataType).toBe('currency');
      expect(cell!.rawValue).toBe(100);
    });

    it('输入日期后自动检测 dataType=date', () => {
      const model = new SpreadsheetModel(10, 10);
      model.setCellContent(0, 0, '2024-01-15');
      const cell = model.getCell(0, 0);
      expect(cell!.dataType).toBe('date');
      expect(cell!.rawValue).toBeDefined();
    });

    it('输入文本后 dataType=text', () => {
      const model = new SpreadsheetModel(10, 10);
      model.setCellContent(0, 0, 'hello');
      const cell = model.getCell(0, 0);
      expect(cell!.dataType).toBe('text');
    });

    it('手动设置格式后跳过自动检测', () => {
      const model = new SpreadsheetModel(10, 10);
      const format: CellFormat = { category: 'currency', pattern: '¥#,##0.00', currencySymbol: '¥' };
      model.setCellFormat(0, 0, format);
      // 再输入纯数字，不应覆盖已有格式
      model.setCellContent(0, 0, '999');
      const cell = model.getCell(0, 0);
      expect(cell!.format).toEqual(format);
    });
  });

  // ========== setCellFormat / setRangeFormat ==========
  describe('setCellFormat / setRangeFormat', () => {
    it('setCellFormat 设置单元格格式', () => {
      const model = new SpreadsheetModel(10, 10);
      const format: CellFormat = { category: 'number', pattern: '#,##0.00' };
      model.setCellFormat(0, 0, format);
      const cell = model.getCell(0, 0);
      expect(cell!.format).toEqual(format);
    });

    it('setRangeFormat 批量设置格式', () => {
      const model = new SpreadsheetModel(10, 10);
      const format: CellFormat = { category: 'percentage', pattern: '0.00%' };
      model.setRangeFormat(0, 0, 2, 2, format);
      for (let i = 0; i <= 2; i++) {
        for (let j = 0; j <= 2; j++) {
          const cell = model.getCell(i, j);
          expect(cell!.format).toEqual(format);
        }
      }
    });

    it('无效位置不报错', () => {
      const model = new SpreadsheetModel(10, 10);
      const format: CellFormat = { category: 'number', pattern: '#,##0' };
      // 不应抛出异常
      model.setCellFormat(-1, -1, format);
      model.setCellFormat(999, 999, format);
    });
  });

  // ========== setCellWrapText / setRangeWrapText ==========
  describe('setCellWrapText / setRangeWrapText', () => {
    it('setCellWrapText 设置换行', () => {
      const model = new SpreadsheetModel(10, 10);
      model.setCellWrapText(0, 0, true);
      const cell = model.getCell(0, 0);
      expect(cell!.wrapText).toBe(true);
    });

    it('setCellWrapText 取消换行', () => {
      const model = new SpreadsheetModel(10, 10);
      model.setCellWrapText(0, 0, true);
      model.setCellWrapText(0, 0, false);
      const cell = model.getCell(0, 0);
      expect(cell!.wrapText).toBe(false);
    });

    it('setRangeWrapText 批量设置换行', () => {
      const model = new SpreadsheetModel(10, 10);
      model.setRangeWrapText(0, 0, 1, 1, true);
      for (let i = 0; i <= 1; i++) {
        for (let j = 0; j <= 1; j++) {
          const cell = model.getCell(i, j);
          expect(cell!.wrapText).toBe(true);
        }
      }
    });
  });

  // ========== setCellValidation ==========
  describe('setCellValidation', () => {
    it('设置下拉列表验证规则', () => {
      const model = new SpreadsheetModel(10, 10);
      const rule: ValidationRule = {
        type: 'dropdown',
        mode: 'block',
        options: ['A', 'B', 'C'],
      };
      model.setCellValidation(0, 0, rule);
      const cell = model.getCell(0, 0);
      expect(cell!.validation).toBeDefined();
      expect(cell!.validation!.type).toBe('dropdown');
      expect(cell!.validation!.options).toEqual(['A', 'B', 'C']);
    });

    it('清除验证规则', () => {
      const model = new SpreadsheetModel(10, 10);
      const rule: ValidationRule = {
        type: 'dropdown',
        mode: 'block',
        options: ['A'],
      };
      model.setCellValidation(0, 0, rule);
      model.setCellValidation(0, 0, undefined);
      const cell = model.getCell(0, 0);
      expect(cell!.validation).toBeUndefined();
    });
  });

  // ========== 验证集成 ==========
  describe('验证集成', () => {
    it('阻止模式下无效输入被拒绝', () => {
      const model = new SpreadsheetModel(10, 10);
      const rule: ValidationRule = {
        type: 'dropdown',
        mode: 'block',
        options: ['A', 'B'],
      };
      model.setCellValidation(0, 0, rule);
      const result = model.setCellContent(0, 0, 'C');
      expect(result.success).toBe(false);
      expect(result.validationResult).toBeDefined();
      expect(result.validationResult!.valid).toBe(false);
      // 内容不应被写入
      const cell = model.getCell(0, 0);
      expect(cell!.content).toBe('');
    });

    it('阻止模式下有效输入被接受', () => {
      const model = new SpreadsheetModel(10, 10);
      const rule: ValidationRule = {
        type: 'dropdown',
        mode: 'block',
        options: ['A', 'B'],
      };
      model.setCellValidation(0, 0, rule);
      const result = model.setCellContent(0, 0, 'A');
      expect(result.success).toBe(true);
      const cell = model.getCell(0, 0);
      expect(cell!.content).toBe('A');
    });

    it('警告模式下无效输入允许写入但返回警告', () => {
      const model = new SpreadsheetModel(10, 10);
      const rule: ValidationRule = {
        type: 'dropdown',
        mode: 'warning',
        options: ['A', 'B'],
      };
      model.setCellValidation(0, 0, rule);
      const result = model.setCellContent(0, 0, 'C');
      expect(result.success).toBe(true);
      expect(result.validationResult).toBeDefined();
      expect(result.validationResult!.valid).toBe(false);
      // 内容应被写入
      const cell = model.getCell(0, 0);
      expect(cell!.content).toBe('C');
    });

    it('数值范围验证集成', () => {
      const model = new SpreadsheetModel(10, 10);
      const rule: ValidationRule = {
        type: 'numberRange',
        mode: 'block',
        min: 0,
        max: 100,
      };
      model.setCellValidation(0, 0, rule);
      // 有效值
      expect(model.setCellContent(0, 0, '50').success).toBe(true);
      // 无效值
      expect(model.setCellContent(0, 0, '200').success).toBe(false);
    });
  });
});
