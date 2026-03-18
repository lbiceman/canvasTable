import type {
  Cell,
  ConditionalFormatRule,
  ConditionalFormatCondition,
  ConditionalFormatResult,
  DataBarParams,
  IconInfo,
} from './types';

/**
 * 条件格式引擎
 * 管理条件格式规则，评估单元格是否匹配条件并返回对应样式
 */
export class ConditionalFormatEngine {
  private rules: ConditionalFormatRule[] = [];

  /**
   * 添加条件格式规则
   * 添加后自动按优先级排序（数值越小优先级越高）
   */
  addRule(rule: ConditionalFormatRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 移除指定 ID 的条件格式规则
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  /**
   * 获取当前所有规则（只读副本）
   */
  getRules(): ConditionalFormatRule[] {
    return [...this.rules];
  }

  /**
   * 评估单元格的条件格式
   * 按优先级从高到低逐条评估，返回第一条匹配规则的样式结果
   * 如果没有匹配的规则，返回 null
   */
  evaluate(row: number, col: number, cell: Cell): ConditionalFormatResult | null {
    // 收集覆盖该单元格的所有规则（已按 priority 排序）
    const matchingRules = this.rules.filter((rule) =>
      this.isCellInRange(row, col, rule)
    );

    // 逐条评估条件，返回第一条匹配的结果
    for (const rule of matchingRules) {
      if (this.evaluateCondition(rule.condition, cell)) {
        return {
          fontColor: rule.style.fontColor,
          bgColor: rule.style.bgColor,
        };
      }
    }

    return null;
  }

  /**
   * 获取数据条渲染参数
   * 根据单元格数值在 [minValue, maxValue] 范围内的位置计算填充比例
   * minValue/maxValue 未指定时默认使用 0 和 100
   */
  getDataBarParams(
    _row: number,
    _col: number,
    cell: Cell,
    rule: ConditionalFormatRule
  ): DataBarParams | null {
    if (rule.condition.type !== 'dataBar') {
      return null;
    }

    const numValue = this.getNumericValue(cell);
    if (isNaN(numValue)) {
      return null;
    }

    const { minValue = 0, maxValue = 100, color } = rule.condition;

    // 避免除以零：当最大值等于最小值时，根据数值是否达到该值返回 0 或 1
    if (maxValue === minValue) {
      return { percentage: numValue >= minValue ? 1 : 0, color };
    }

    // 计算比例并限制在 [0, 1] 范围内
    const percentage = Math.max(0, Math.min(1, (numValue - minValue) / (maxValue - minValue)));

    return { percentage, color };
  }

  /**
   * 获取色阶颜色
   * 根据单元格数值在范围内的位置，在颜色之间进行线性插值
   * 支持两色（minColor → maxColor）和三色（minColor → midColor → maxColor）模式
   */
  getColorScaleColor(
    _row: number,
    _col: number,
    cell: Cell,
    rule: ConditionalFormatRule
  ): string | null {
    if (rule.condition.type !== 'colorScale') {
      return null;
    }

    const numValue = this.getNumericValue(cell);
    if (isNaN(numValue)) {
      return null;
    }

    const { minColor, midColor, maxColor } = rule.condition;

    // 将数值归一化到 [0, 1] 范围，默认范围 0-100
    const ratio = Math.max(0, Math.min(1, numValue / 100));

    const minRgb = this.parseHexColor(minColor);
    const maxRgb = this.parseHexColor(maxColor);

    if (!minRgb || !maxRgb) {
      return null;
    }

    // 三色模式：minColor → midColor → maxColor
    if (midColor) {
      const midRgb = this.parseHexColor(midColor);
      if (!midRgb) {
        return null;
      }

      if (ratio <= 0.5) {
        // 前半段：minColor → midColor，ratio 从 0 到 0.5 映射为 0 到 1
        const t = ratio * 2;
        return this.interpolateRgb(minRgb, midRgb, t);
      } else {
        // 后半段：midColor → maxColor，ratio 从 0.5 到 1 映射为 0 到 1
        const t = (ratio - 0.5) * 2;
        return this.interpolateRgb(midRgb, maxRgb, t);
      }
    }

    // 两色模式：minColor → maxColor
    return this.interpolateRgb(minRgb, maxRgb, ratio);
  }

  /**
   * 获取图标集图标
   * 根据单元格数值与阈值数组的比较，确定应显示的图标
   * thresholds[0] 是索引 0 和 1 的分界线，thresholds[1] 是索引 1 和 2 的分界线
   */
  getIconSetIcon(
    _row: number,
    _col: number,
    cell: Cell,
    rule: ConditionalFormatRule
  ): IconInfo | null {
    if (rule.condition.type !== 'iconSet') {
      return null;
    }

    const numValue = this.getNumericValue(cell);
    if (isNaN(numValue)) {
      return null;
    }

    const { iconType, thresholds } = rule.condition;

    // 根据阈值确定图标索引
    // thresholds[0] 是 index 0 和 1 的分界线
    // thresholds[1] 是 index 1 和 2 的分界线
    let index = 0;
    if (thresholds.length >= 2 && numValue >= thresholds[1]) {
      index = 2; // 最好
    } else if (thresholds.length >= 1 && numValue >= thresholds[0]) {
      index = 1; // 中等
    }
    // 否则 index = 0（最差）

    return { type: iconType, index };
  }

  /**
   * 解析十六进制颜色字符串为 RGB 数组
   * 支持 #RGB 和 #RRGGBB 格式
   */
  private parseHexColor(hex: string): [number, number, number] | null {
    const cleaned = hex.replace('#', '');

    if (cleaned.length === 3) {
      // 短格式 #RGB → #RRGGBB
      const r = parseInt(cleaned[0] + cleaned[0], 16);
      const g = parseInt(cleaned[1] + cleaned[1], 16);
      const b = parseInt(cleaned[2] + cleaned[2], 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
      return [r, g, b];
    }

    if (cleaned.length === 6) {
      const r = parseInt(cleaned.substring(0, 2), 16);
      const g = parseInt(cleaned.substring(2, 4), 16);
      const b = parseInt(cleaned.substring(4, 6), 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
      return [r, g, b];
    }

    return null;
  }

  /**
   * 在两个 RGB 颜色之间进行线性插值
   * t 为插值因子，0 表示 color1，1 表示 color2
   */
  private interpolateRgb(
    color1: [number, number, number],
    color2: [number, number, number],
    t: number
  ): string {
    const r = Math.round(color1[0] + (color2[0] - color1[0]) * t);
    const g = Math.round(color1[1] + (color2[1] - color1[1]) * t);
    const b = Math.round(color1[2] + (color2[2] - color1[2]) * t);

    // 转换为 #RRGGBB 格式
    const toHex = (n: number): string => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * 判断单元格是否在规则的范围内
   */
  private isCellInRange(
    row: number,
    col: number,
    rule: ConditionalFormatRule
  ): boolean {
    const { startRow, startCol, endRow, endCol } = rule.range;
    return row >= startRow && row <= endRow && col >= startCol && col <= endCol;
  }

  /**
   * 评估单个条件是否匹配
   * 对比较条件使用 cell.rawValue（数值）或 cell.content（字符串）
   */
  private evaluateCondition(
    condition: ConditionalFormatCondition,
    cell: Cell
  ): boolean {
    switch (condition.type) {
      case 'greaterThan':
        return this.getNumericValue(cell) > condition.value;

      case 'lessThan':
        return this.getNumericValue(cell) < condition.value;

      case 'equals':
        if (typeof condition.value === 'string') {
          return cell.content === condition.value;
        }
        return this.getNumericValue(cell) === condition.value;

      case 'between':
        {
          const numVal = this.getNumericValue(cell);
          return numVal >= condition.min && numVal <= condition.max;
        }

      case 'textContains':
        return cell.content.includes(condition.text);

      case 'textStartsWith':
        return cell.content.startsWith(condition.text);

      case 'textEndsWith':
        return cell.content.endsWith(condition.text);

      // 可视化条件类型（dataBar、colorScale、iconSet）不参与 evaluate 的布尔匹配
      // 它们由专门的 getDataBarParams / getColorScaleColor / getIconSetIcon 方法处理
      case 'dataBar':
      case 'colorScale':
      case 'iconSet':
        return false;

      default:
        return false;
    }
  }

  /**
   * 获取单元格的数值
   * 优先使用 rawValue，否则尝试将 content 解析为数字
   * 无法获取数值时返回 NaN
   */
  private getNumericValue(cell: Cell): number {
    if (cell.rawValue !== undefined) {
      return cell.rawValue;
    }
    const parsed = Number(cell.content);
    return isNaN(parsed) ? NaN : parsed;
  }
}
