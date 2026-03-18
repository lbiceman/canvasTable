import { describe, it, expect } from 'vitest';
import { ValidationEngine } from '../validation';
import type { ValidationRule } from '../types';

describe('ValidationEngine', () => {
  // ========== 下拉列表验证 ==========
  describe('下拉列表验证', () => {
    const dropdownRule: ValidationRule = {
      type: 'dropdown',
      mode: 'block',
      options: ['选项A', '选项B', '选项C'],
    };

    it('有效选项应通过验证', () => {
      const result = ValidationEngine.validate('选项A', dropdownRule);
      expect(result.valid).toBe(true);
    });

    it('无效选项应拒绝', () => {
      const result = ValidationEngine.validate('选项D', dropdownRule);
      expect(result.valid).toBe(false);
      expect(result.errorTitle).toBeDefined();
      expect(result.errorMessage).toBeDefined();
    });

    it('空选项列表应拒绝任何输入', () => {
      const emptyRule: ValidationRule = {
        type: 'dropdown',
        mode: 'block',
        options: [],
      };
      const result = ValidationEngine.validate('任意值', emptyRule);
      expect(result.valid).toBe(false);
    });
  });

  // ========== 数值范围验证 ==========
  describe('数值范围验证', () => {
    const rangeRule: ValidationRule = {
      type: 'numberRange',
      mode: 'block',
      min: 10,
      max: 100,
    };

    it('范围内的值应通过验证', () => {
      const result = ValidationEngine.validate('50', rangeRule);
      expect(result.valid).toBe(true);
    });

    it('低于最小值应拒绝', () => {
      const result = ValidationEngine.validate('5', rangeRule);
      expect(result.valid).toBe(false);
    });

    it('高于最大值应拒绝', () => {
      const result = ValidationEngine.validate('200', rangeRule);
      expect(result.valid).toBe(false);
    });

    it('非数值应拒绝', () => {
      const result = ValidationEngine.validate('abc', rangeRule);
      expect(result.valid).toBe(false);
    });

    it('边界值（等于 min）应通过', () => {
      const result = ValidationEngine.validate('10', rangeRule);
      expect(result.valid).toBe(true);
    });

    it('边界值（等于 max）应通过', () => {
      const result = ValidationEngine.validate('100', rangeRule);
      expect(result.valid).toBe(true);
    });

    it('仅指定 min 时，大于 min 的值应通过', () => {
      const minOnlyRule: ValidationRule = {
        type: 'numberRange',
        mode: 'block',
        min: 0,
      };
      expect(ValidationEngine.validate('999', minOnlyRule).valid).toBe(true);
      expect(ValidationEngine.validate('-1', minOnlyRule).valid).toBe(false);
    });

    it('仅指定 max 时，小于 max 的值应通过', () => {
      const maxOnlyRule: ValidationRule = {
        type: 'numberRange',
        mode: 'block',
        max: 50,
      };
      expect(ValidationEngine.validate('-100', maxOnlyRule).valid).toBe(true);
      expect(ValidationEngine.validate('51', maxOnlyRule).valid).toBe(false);
    });
  });

  // ========== 文本长度验证 ==========
  describe('文本长度验证', () => {
    const lengthRule: ValidationRule = {
      type: 'textLength',
      mode: 'block',
      min: 2,
      max: 10,
    };

    it('长度在范围内应通过', () => {
      const result = ValidationEngine.validate('hello', lengthRule);
      expect(result.valid).toBe(true);
    });

    it('长度低于最小值应拒绝', () => {
      const result = ValidationEngine.validate('a', lengthRule);
      expect(result.valid).toBe(false);
    });

    it('长度超过最大值应拒绝', () => {
      const result = ValidationEngine.validate('这是一段超长文本内容测试', lengthRule);
      expect(result.valid).toBe(false);
    });

    it('空字符串且 min=1 应拒绝', () => {
      const minOneRule: ValidationRule = {
        type: 'textLength',
        mode: 'block',
        min: 1,
      };
      expect(ValidationEngine.validate('', minOneRule).valid).toBe(false);
    });

    it('边界值（长度等于 min）应通过', () => {
      const result = ValidationEngine.validate('ab', lengthRule);
      expect(result.valid).toBe(true);
    });

    it('边界值（长度等于 max）应通过', () => {
      const result = ValidationEngine.validate('1234567890', lengthRule);
      expect(result.valid).toBe(true);
    });
  });

  // ========== 自定义验证 ==========
  describe('自定义验证', () => {
    it('当前应对任何输入返回有效', () => {
      const customRule: ValidationRule = {
        type: 'custom',
        mode: 'block',
        customExpression: 'value > 0',
      };
      const result = ValidationEngine.validate('任意内容', customRule);
      expect(result.valid).toBe(true);
    });
  });

  // ========== 错误提示信息 ==========
  describe('错误提示信息', () => {
    it('验证失败时应返回自定义错误标题和消息', () => {
      const rule: ValidationRule = {
        type: 'dropdown',
        mode: 'block',
        options: ['A'],
        errorTitle: '自定义标题',
        errorMessage: '自定义错误消息',
      };
      const result = ValidationEngine.validate('B', rule);
      expect(result.valid).toBe(false);
      expect(result.errorTitle).toBe('自定义标题');
      expect(result.errorMessage).toBe('自定义错误消息');
    });

    it('未指定自定义提示时应返回默认错误信息', () => {
      const rule: ValidationRule = {
        type: 'dropdown',
        mode: 'block',
        options: ['A'],
      };
      const result = ValidationEngine.validate('B', rule);
      expect(result.valid).toBe(false);
      expect(result.errorTitle).toBe('输入无效');
      expect(result.errorMessage).toBe('输入的值不符合验证规则');
    });
  });

  // ========== 阻止模式和警告模式的行为差异 ==========
  describe('阻止模式和警告模式的行为差异', () => {
    it('block 模式下验证失败应返回 valid=false', () => {
      const blockRule: ValidationRule = {
        type: 'dropdown',
        mode: 'block',
        options: ['A', 'B'],
        errorTitle: '阻止',
        errorMessage: '不允许输入',
      };
      const result = ValidationEngine.validate('C', blockRule);
      expect(result.valid).toBe(false);
      expect(result.errorTitle).toBe('阻止');
      expect(result.errorMessage).toBe('不允许输入');
    });

    it('warning 模式下验证失败同样返回 valid=false（由调用方决定是否允许写入）', () => {
      const warningRule: ValidationRule = {
        type: 'dropdown',
        mode: 'warning',
        options: ['A', 'B'],
        errorTitle: '警告',
        errorMessage: '建议选择列表中的值',
      };
      const result = ValidationEngine.validate('C', warningRule);
      expect(result.valid).toBe(false);
      expect(result.errorTitle).toBe('警告');
      expect(result.errorMessage).toBe('建议选择列表中的值');
    });

    it('两种模式下验证通过时结果一致', () => {
      const blockRule: ValidationRule = {
        type: 'numberRange',
        mode: 'block',
        min: 0,
        max: 100,
      };
      const warningRule: ValidationRule = {
        type: 'numberRange',
        mode: 'warning',
        min: 0,
        max: 100,
      };
      const blockResult = ValidationEngine.validate('50', blockRule);
      const warningResult = ValidationEngine.validate('50', warningRule);
      expect(blockResult.valid).toBe(true);
      expect(warningResult.valid).toBe(true);
      expect(blockResult).toEqual(warningResult);
    });

    it('两种模式下验证失败时返回相同的错误结构', () => {
      const blockRule: ValidationRule = {
        type: 'textLength',
        mode: 'block',
        min: 5,
        max: 10,
      };
      const warningRule: ValidationRule = {
        type: 'textLength',
        mode: 'warning',
        min: 5,
        max: 10,
      };
      const blockResult = ValidationEngine.validate('ab', blockRule);
      const warningResult = ValidationEngine.validate('ab', warningRule);
      // 两种模式都返回 valid=false，mode 的区别由调用方处理
      expect(blockResult.valid).toBe(false);
      expect(warningResult.valid).toBe(false);
      expect(blockResult.errorTitle).toBe(warningResult.errorTitle);
      expect(blockResult.errorMessage).toBe(warningResult.errorMessage);
    });

    it('mode 属性应正确存储在规则中供调用方读取', () => {
      const blockRule: ValidationRule = {
        type: 'dropdown',
        mode: 'block',
        options: ['X'],
      };
      const warningRule: ValidationRule = {
        type: 'dropdown',
        mode: 'warning',
        options: ['X'],
      };
      expect(blockRule.mode).toBe('block');
      expect(warningRule.mode).toBe('warning');
    });
  });

  // ========== getDropdownOptions ==========
  describe('getDropdownOptions', () => {
    it('应返回下拉列表规则的选项', () => {
      const rule: ValidationRule = {
        type: 'dropdown',
        mode: 'block',
        options: ['X', 'Y', 'Z'],
      };
      const options = ValidationEngine.getDropdownOptions(rule);
      expect(options).toEqual(['X', 'Y', 'Z']);
    });

    it('非下拉列表规则应返回空数组', () => {
      const rule: ValidationRule = {
        type: 'numberRange',
        mode: 'block',
        min: 0,
        max: 100,
      };
      const options = ValidationEngine.getDropdownOptions(rule);
      expect(options).toEqual([]);
    });

    it('返回的应是选项的副本而非引用', () => {
      const rule: ValidationRule = {
        type: 'dropdown',
        mode: 'block',
        options: ['A', 'B'],
      };
      const options = ValidationEngine.getDropdownOptions(rule);
      options.push('C');
      // 原始 options 不应被修改
      expect(rule.options).toEqual(['A', 'B']);
    });
  });
});
