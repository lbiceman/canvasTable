import type { ValidationRule, ValidationResult } from './types';
import { FormulaEngine } from './formula-engine';

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
   * 自定义验证：通过公式引擎求值表达式，结果为 true 则验证通过
   * 支持如 =AND(A1>0, A1<100) 的公式表达式
   */
  private static validateCustom(_value: string, rule: ValidationRule): ValidationResult {
    const expression = rule.customExpression;
    if (!expression) {
      // 无表达式时默认通过
      return { valid: true };
    }

    try {
      const engine = FormulaEngine.getInstance();
      // 确保表达式以 = 开头
      const formula = expression.startsWith('=') ? expression : `=${expression}`;
      // 使用公式引擎求值，默认在 (0,0) 位置求值
      const result = engine.evaluate(formula, 0, 0);

      // 公式求值出错时视为验证失败
      if (result.isError) {
        return ValidationEngine.buildErrorResult(rule);
      }

      // 将结果转为布尔值：数字非零为 true，字符串 "TRUE" 为 true
      const { value } = result;
      let isValid = false;
      if (typeof value === 'number') {
        isValid = value !== 0;
      } else if (typeof value === 'string') {
        isValid = value.toUpperCase() === 'TRUE' || (value !== '' && !value.startsWith('#'));
      }

      if (isValid) {
        return { valid: true };
      }
      return ValidationEngine.buildErrorResult(rule);
    } catch {
      // 公式求值异常时视为验证失败
      return ValidationEngine.buildErrorResult(rule);
    }
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
