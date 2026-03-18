import type { ValidationRule, ValidationResult } from './types';

// 默认错误提示信息
const DEFAULT_ERROR_TITLE = '输入无效';
const DEFAULT_ERROR_MESSAGE = '输入的值不符合验证规则';

/**
 * 数据验证引擎
 * 负责验证单元格输入值是否符合验证规则，以及获取下拉列表选项
 */
export class ValidationEngine {
  /**
   * 验证单元格输入值是否符合验证规则
   * 注意：mode（block/warning）不在此处处理，由调用方决定行为
   */
  static validate(value: string, rule: ValidationRule): ValidationResult {
    switch (rule.type) {
      case 'dropdown':
        return ValidationEngine.validateDropdown(value, rule);
      case 'numberRange':
        return ValidationEngine.validateNumberRange(value, rule);
      case 'textLength':
        return ValidationEngine.validateTextLength(value, rule);
      case 'custom':
        return ValidationEngine.validateCustom(value, rule);
      default:
        return { valid: true };
    }
  }

  /**
   * 获取下拉列表选项
   * 如果规则类型不是 dropdown 或没有 options，返回空数组
   */
  static getDropdownOptions(rule: ValidationRule): string[] {
    if (rule.type === 'dropdown' && rule.options) {
      return [...rule.options];
    }
    return [];
  }

  /**
   * 下拉列表验证：检查值是否在选项列表中
   */
  private static validateDropdown(value: string, rule: ValidationRule): ValidationResult {
    const options = rule.options ?? [];
    if (options.includes(value)) {
      return { valid: true };
    }
    return ValidationEngine.buildErrorResult(rule);
  }

  /**
   * 数值范围验证：检查值是否为数字且在指定范围内
   */
  private static validateNumberRange(value: string, rule: ValidationRule): ValidationResult {
    const num = Number(value);
    if (isNaN(num)) {
      return ValidationEngine.buildErrorResult(rule);
    }

    const { min, max } = rule;
    if (min !== undefined && num < min) {
      return ValidationEngine.buildErrorResult(rule);
    }
    if (max !== undefined && num > max) {
      return ValidationEngine.buildErrorResult(rule);
    }

    return { valid: true };
  }

  /**
   * 文本长度验证：检查值的字符长度是否在指定范围内
   */
  private static validateTextLength(value: string, rule: ValidationRule): ValidationResult {
    const len = value.length;
    const { min, max } = rule;

    if (min !== undefined && len < min) {
      return ValidationEngine.buildErrorResult(rule);
    }
    if (max !== undefined && len > max) {
      return ValidationEngine.buildErrorResult(rule);
    }

    return { valid: true };
  }

  /**
   * 自定义验证：当前返回有效（后续可扩展表达式求值）
   */
  private static validateCustom(_value: string, _rule: ValidationRule): ValidationResult {
    // 自定义验证暂时返回有效，后续可实现表达式求值逻辑
    return { valid: true };
  }

  /**
   * 构建验证失败结果，使用规则中的自定义提示或默认提示
   */
  private static buildErrorResult(rule: ValidationRule): ValidationResult {
    return {
      valid: false,
      errorTitle: rule.errorTitle ?? DEFAULT_ERROR_TITLE,
      errorMessage: rule.errorMessage ?? DEFAULT_ERROR_MESSAGE,
    };
  }
}
