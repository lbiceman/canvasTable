import { describe, it, expect, beforeEach } from 'vitest';
import { ConditionalFormatEngine } from '../conditional-format';
import type { Cell, ConditionalFormatRule } from '../types';

/**
 * 创建测试用的 Cell 对象
 * 仅填充必要字段，其余使用默认值
 */
const makeCell = (content: string, rawValue?: number): Cell => ({
  content,
  rawValue,
  rowSpan: 1,
  colSpan: 1,
  isMerged: false,
});

/**
 * 创建覆盖 (0,0)-(9,9) 范围的条件格式规则
 */
const makeRule = (
  id: string,
  priority: number,
  condition: ConditionalFormatRule['condition'],
  style: ConditionalFormatRule['style'] = {}
): ConditionalFormatRule => ({
  id,
  range: { startRow: 0, startCol: 0, endRow: 9, endCol: 9 },
  priority,
  condition,
  style,
});

describe('ConditionalFormatEngine', () => {
  let engine: ConditionalFormatEngine;

  beforeEach(() => {
    engine = new ConditionalFormatEngine();
  });

  // ========== 规则管理 ==========
  describe('addRule / removeRule / getRules', () => {
    it('添加规则后可通过 getRules 获取', () => {
      const rule = makeRule('r1', 1, { type: 'greaterThan', value: 10 });
      engine.addRule(rule);
      expect(engine.getRules()).toHaveLength(1);
      expect(engine.getRules()[0].id).toBe('r1');
    });

    it('添加多条规则后按优先级排序', () => {
      engine.addRule(makeRule('r3', 3, { type: 'greaterThan', value: 10 }));
      engine.addRule(makeRule('r1', 1, { type: 'lessThan', value: 5 }));
      engine.addRule(makeRule('r2', 2, { type: 'equals', value: 0 }));

      const rules = engine.getRules();
      expect(rules.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    });

    it('removeRule 移除指定规则', () => {
      engine.addRule(makeRule('r1', 1, { type: 'greaterThan', value: 10 }));
      engine.addRule(makeRule('r2', 2, { type: 'lessThan', value: 5 }));
      engine.removeRule('r1');

      const rules = engine.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('r2');
    });

    it('removeRule 移除不存在的 ID 不报错', () => {
      engine.addRule(makeRule('r1', 1, { type: 'greaterThan', value: 10 }));
      engine.removeRule('nonexistent');
      expect(engine.getRules()).toHaveLength(1);
    });

    it('getRules 返回副本，修改不影响内部状态', () => {
      engine.addRule(makeRule('r1', 1, { type: 'greaterThan', value: 10 }));
      const rules = engine.getRules();
      rules.pop();
      expect(engine.getRules()).toHaveLength(1);
    });
  });

  // ========== 比较条件评估 ==========
  describe('比较条件评估', () => {
    // --- greaterThan ---
    it('greaterThan: 数值大于阈值时匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'greaterThan', value: 50 }, { fontColor: '#ff0000' }));
      const result = engine.evaluate(0, 0, makeCell('60', 60));
      expect(result).not.toBeNull();
      expect(result!.fontColor).toBe('#ff0000');
    });

    it('greaterThan: 数值等于阈值时不匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'greaterThan', value: 50 }, { fontColor: '#ff0000' }));
      const result = engine.evaluate(0, 0, makeCell('50', 50));
      expect(result).toBeNull();
    });

    it('greaterThan: 数值小于阈值时不匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'greaterThan', value: 50 }, { fontColor: '#ff0000' }));
      const result = engine.evaluate(0, 0, makeCell('30', 30));
      expect(result).toBeNull();
    });

    // --- lessThan ---
    it('lessThan: 数值小于阈值时匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'lessThan', value: 50 }, { bgColor: '#00ff00' }));
      const result = engine.evaluate(0, 0, makeCell('30', 30));
      expect(result).not.toBeNull();
      expect(result!.bgColor).toBe('#00ff00');
    });

    it('lessThan: 数值等于阈值时不匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'lessThan', value: 50 }, { bgColor: '#00ff00' }));
      const result = engine.evaluate(0, 0, makeCell('50', 50));
      expect(result).toBeNull();
    });

    // --- equals ---
    it('equals: 数值相等时匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'equals', value: 42 }, { fontColor: '#0000ff' }));
      const result = engine.evaluate(0, 0, makeCell('42', 42));
      expect(result).not.toBeNull();
      expect(result!.fontColor).toBe('#0000ff');
    });

    it('equals: 字符串相等时匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'equals', value: '完成' }, { bgColor: '#00ff00' }));
      const result = engine.evaluate(0, 0, makeCell('完成'));
      expect(result).not.toBeNull();
      expect(result!.bgColor).toBe('#00ff00');
    });

    it('equals: 字符串不相等时不匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'equals', value: '完成' }, { bgColor: '#00ff00' }));
      const result = engine.evaluate(0, 0, makeCell('进行中'));
      expect(result).toBeNull();
    });

    // --- between ---
    it('between: 数值在范围内时匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'between', min: 10, max: 90 }, { fontColor: '#ff00ff' }));
      const result = engine.evaluate(0, 0, makeCell('50', 50));
      expect(result).not.toBeNull();
    });

    it('between: 数值等于边界值时匹配（包含边界）', () => {
      engine.addRule(makeRule('r1', 1, { type: 'between', min: 10, max: 90 }, { fontColor: '#ff00ff' }));
      expect(engine.evaluate(0, 0, makeCell('10', 10))).not.toBeNull();
      expect(engine.evaluate(0, 0, makeCell('90', 90))).not.toBeNull();
    });

    it('between: 数值超出范围时不匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'between', min: 10, max: 90 }, { fontColor: '#ff00ff' }));
      expect(engine.evaluate(0, 0, makeCell('5', 5))).toBeNull();
      expect(engine.evaluate(0, 0, makeCell('95', 95))).toBeNull();
    });

    // --- textContains ---
    it('textContains: 文本包含指定子串时匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'textContains', text: '错误' }, { fontColor: '#ff0000' }));
      const result = engine.evaluate(0, 0, makeCell('发生错误了'));
      expect(result).not.toBeNull();
    });

    it('textContains: 文本不包含指定子串时不匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'textContains', text: '错误' }, { fontColor: '#ff0000' }));
      const result = engine.evaluate(0, 0, makeCell('一切正常'));
      expect(result).toBeNull();
    });

    // --- textStartsWith ---
    it('textStartsWith: 文本以指定前缀开头时匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'textStartsWith', text: '重要' }, { bgColor: '#ffff00' }));
      const result = engine.evaluate(0, 0, makeCell('重要通知'));
      expect(result).not.toBeNull();
    });

    it('textStartsWith: 文本不以指定前缀开头时不匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'textStartsWith', text: '重要' }, { bgColor: '#ffff00' }));
      const result = engine.evaluate(0, 0, makeCell('普通通知'));
      expect(result).toBeNull();
    });

    // --- textEndsWith ---
    it('textEndsWith: 文本以指定后缀结尾时匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'textEndsWith', text: '完成' }, { bgColor: '#00ff00' }));
      const result = engine.evaluate(0, 0, makeCell('任务已完成'));
      expect(result).not.toBeNull();
    });

    it('textEndsWith: 文本不以指定后缀结尾时不匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'textEndsWith', text: '完成' }, { bgColor: '#00ff00' }));
      const result = engine.evaluate(0, 0, makeCell('任务进行中'));
      expect(result).toBeNull();
    });
  });

  // ========== 无 rawValue 时使用 content 解析 ==========
  describe('无 rawValue 时回退到 content 解析', () => {
    it('greaterThan: 无 rawValue 时从 content 解析数值', () => {
      engine.addRule(makeRule('r1', 1, { type: 'greaterThan', value: 50 }, { fontColor: '#ff0000' }));
      const result = engine.evaluate(0, 0, makeCell('60'));
      expect(result).not.toBeNull();
    });

    it('非数值 content 时数值比较不匹配', () => {
      engine.addRule(makeRule('r1', 1, { type: 'greaterThan', value: 50 }, { fontColor: '#ff0000' }));
      const result = engine.evaluate(0, 0, makeCell('abc'));
      expect(result).toBeNull();
    });
  });

  // ========== 多规则优先级排序 ==========
  describe('多规则优先级排序', () => {
    it('优先级数值越小的规则优先匹配', () => {
      // 两条规则都匹配 value=60，但 priority=1 的先匹配
      engine.addRule(makeRule('low', 2, { type: 'greaterThan', value: 50 }, { fontColor: '#0000ff' }));
      engine.addRule(makeRule('high', 1, { type: 'greaterThan', value: 50 }, { fontColor: '#ff0000' }));

      const result = engine.evaluate(0, 0, makeCell('60', 60));
      expect(result).not.toBeNull();
      expect(result!.fontColor).toBe('#ff0000'); // 高优先级规则的样式
    });

    it('高优先级规则不匹配时，低优先级规则可以匹配', () => {
      engine.addRule(makeRule('high', 1, { type: 'greaterThan', value: 100 }, { fontColor: '#ff0000' }));
      engine.addRule(makeRule('low', 2, { type: 'greaterThan', value: 50 }, { fontColor: '#0000ff' }));

      const result = engine.evaluate(0, 0, makeCell('60', 60));
      expect(result).not.toBeNull();
      expect(result!.fontColor).toBe('#0000ff'); // 低优先级规则匹配
    });

    it('所有规则都不匹配时返回 null', () => {
      engine.addRule(makeRule('r1', 1, { type: 'greaterThan', value: 100 }, { fontColor: '#ff0000' }));
      engine.addRule(makeRule('r2', 2, { type: 'lessThan', value: 10 }, { fontColor: '#0000ff' }));

      const result = engine.evaluate(0, 0, makeCell('50', 50));
      expect(result).toBeNull();
    });
  });

  // ========== 范围过滤 ==========
  describe('范围过滤', () => {
    it('单元格不在规则范围内时不匹配', () => {
      const rule: ConditionalFormatRule = {
        id: 'r1',
        range: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
        priority: 1,
        condition: { type: 'greaterThan', value: 0 },
        style: { fontColor: '#ff0000' },
      };
      engine.addRule(rule);

      // (1,1) 在范围内
      expect(engine.evaluate(1, 1, makeCell('10', 10))).not.toBeNull();
      // (5,5) 不在范围内
      expect(engine.evaluate(5, 5, makeCell('10', 10))).toBeNull();
    });
  });

  // ========== 数据条百分比计算 ==========
  describe('getDataBarParams', () => {
    const dataBarRule = makeRule('db1', 1, {
      type: 'dataBar',
      minValue: 0,
      maxValue: 100,
      color: '#4472c4',
    });

    it('数值在范围中间时返回正确比例', () => {
      const result = engine.getDataBarParams(0, 0, makeCell('50', 50), dataBarRule);
      expect(result).not.toBeNull();
      expect(result!.percentage).toBeCloseTo(0.5);
      expect(result!.color).toBe('#4472c4');
    });

    it('数值等于最小值时比例为 0', () => {
      const result = engine.getDataBarParams(0, 0, makeCell('0', 0), dataBarRule);
      expect(result).not.toBeNull();
      expect(result!.percentage).toBe(0);
    });

    it('数值等于最大值时比例为 1', () => {
      const result = engine.getDataBarParams(0, 0, makeCell('100', 100), dataBarRule);
      expect(result).not.toBeNull();
      expect(result!.percentage).toBe(1);
    });

    it('数值超过最大值时比例被限制为 1', () => {
      const result = engine.getDataBarParams(0, 0, makeCell('150', 150), dataBarRule);
      expect(result).not.toBeNull();
      expect(result!.percentage).toBe(1);
    });

    it('数值低于最小值时比例被限制为 0', () => {
      const result = engine.getDataBarParams(0, 0, makeCell('-10', -10), dataBarRule);
      expect(result).not.toBeNull();
      expect(result!.percentage).toBe(0);
    });

    it('minValue 和 maxValue 相等时，达到该值返回 1', () => {
      const equalRule = makeRule('db2', 1, {
        type: 'dataBar',
        minValue: 50,
        maxValue: 50,
        color: '#ff0000',
      });
      const result = engine.getDataBarParams(0, 0, makeCell('50', 50), equalRule);
      expect(result).not.toBeNull();
      expect(result!.percentage).toBe(1);
    });

    it('minValue 和 maxValue 相等时，低于该值返回 0', () => {
      const equalRule = makeRule('db2', 1, {
        type: 'dataBar',
        minValue: 50,
        maxValue: 50,
        color: '#ff0000',
      });
      const result = engine.getDataBarParams(0, 0, makeCell('30', 30), equalRule);
      expect(result).not.toBeNull();
      expect(result!.percentage).toBe(0);
    });

    it('未指定 minValue/maxValue 时使用默认值 0 和 100', () => {
      const defaultRule = makeRule('db3', 1, {
        type: 'dataBar',
        color: '#4472c4',
      });
      const result = engine.getDataBarParams(0, 0, makeCell('75', 75), defaultRule);
      expect(result).not.toBeNull();
      expect(result!.percentage).toBeCloseTo(0.75);
    });

    it('非数值单元格返回 null', () => {
      const result = engine.getDataBarParams(0, 0, makeCell('文本'), dataBarRule);
      expect(result).toBeNull();
    });

    it('条件类型不是 dataBar 时返回 null', () => {
      const otherRule = makeRule('r1', 1, { type: 'greaterThan', value: 10 });
      const result = engine.getDataBarParams(0, 0, makeCell('50', 50), otherRule);
      expect(result).toBeNull();
    });
  });

  // ========== 色阶颜色插值 ==========
  describe('getColorScaleColor', () => {
    it('两色模式：数值为 0 时返回 minColor', () => {
      const rule = makeRule('cs1', 1, {
        type: 'colorScale',
        minColor: '#ff0000',
        maxColor: '#00ff00',
      });
      const result = engine.getColorScaleColor(0, 0, makeCell('0', 0), rule);
      expect(result).toBe('#ff0000');
    });

    it('两色模式：数值为 100 时返回 maxColor', () => {
      const rule = makeRule('cs1', 1, {
        type: 'colorScale',
        minColor: '#ff0000',
        maxColor: '#00ff00',
      });
      const result = engine.getColorScaleColor(0, 0, makeCell('100', 100), rule);
      expect(result).toBe('#00ff00');
    });

    it('两色模式：数值为 50 时返回中间色', () => {
      const rule = makeRule('cs1', 1, {
        type: 'colorScale',
        minColor: '#ff0000',
        maxColor: '#00ff00',
      });
      const result = engine.getColorScaleColor(0, 0, makeCell('50', 50), rule);
      expect(result).not.toBeNull();
      // 红色 (255,0,0) 和绿色 (0,255,0) 的中间值约为 (128,128,0)
      // 精确值: r=128, g=128, b=0 → #808000
      expect(result).toBe('#808000');
    });

    it('三色模式：数值为 0 时返回 minColor', () => {
      const rule = makeRule('cs2', 1, {
        type: 'colorScale',
        minColor: '#ff0000',
        midColor: '#ffff00',
        maxColor: '#00ff00',
      });
      const result = engine.getColorScaleColor(0, 0, makeCell('0', 0), rule);
      expect(result).toBe('#ff0000');
    });

    it('三色模式：数值为 50 时返回 midColor', () => {
      const rule = makeRule('cs2', 1, {
        type: 'colorScale',
        minColor: '#ff0000',
        midColor: '#ffff00',
        maxColor: '#00ff00',
      });
      const result = engine.getColorScaleColor(0, 0, makeCell('50', 50), rule);
      expect(result).toBe('#ffff00');
    });

    it('三色模式：数值为 100 时返回 maxColor', () => {
      const rule = makeRule('cs2', 1, {
        type: 'colorScale',
        minColor: '#ff0000',
        midColor: '#ffff00',
        maxColor: '#00ff00',
      });
      const result = engine.getColorScaleColor(0, 0, makeCell('100', 100), rule);
      expect(result).toBe('#00ff00');
    });

    it('三色模式：数值为 25 时在 minColor 和 midColor 之间插值', () => {
      const rule = makeRule('cs2', 1, {
        type: 'colorScale',
        minColor: '#ff0000',
        midColor: '#ffff00',
        maxColor: '#00ff00',
      });
      const result = engine.getColorScaleColor(0, 0, makeCell('25', 25), rule);
      expect(result).not.toBeNull();
      // ratio=0.25, 前半段 t=0.5: (255,0,0) → (255,255,0), r=255, g=128, b=0
      expect(result).toBe('#ff8000');
    });

    it('数值超出范围时被限制在 [0,1]', () => {
      const rule = makeRule('cs1', 1, {
        type: 'colorScale',
        minColor: '#000000',
        maxColor: '#ffffff',
      });
      // 超过 100 时 ratio 被限制为 1
      const result = engine.getColorScaleColor(0, 0, makeCell('200', 200), rule);
      expect(result).toBe('#ffffff');
    });

    it('负数值时 ratio 被限制为 0', () => {
      const rule = makeRule('cs1', 1, {
        type: 'colorScale',
        minColor: '#000000',
        maxColor: '#ffffff',
      });
      const result = engine.getColorScaleColor(0, 0, makeCell('-50', -50), rule);
      expect(result).toBe('#000000');
    });

    it('非数值单元格返回 null', () => {
      const rule = makeRule('cs1', 1, {
        type: 'colorScale',
        minColor: '#ff0000',
        maxColor: '#00ff00',
      });
      const result = engine.getColorScaleColor(0, 0, makeCell('文本'), rule);
      expect(result).toBeNull();
    });

    it('条件类型不是 colorScale 时返回 null', () => {
      const otherRule = makeRule('r1', 1, { type: 'greaterThan', value: 10 });
      const result = engine.getColorScaleColor(0, 0, makeCell('50', 50), otherRule);
      expect(result).toBeNull();
    });
  });

  // ========== 图标集阈值判断 ==========
  describe('getIconSetIcon', () => {
    const iconRule = makeRule('ic1', 1, {
      type: 'iconSet',
      iconType: 'arrows',
      thresholds: [33, 67],
    });

    it('数值低于第一个阈值时返回 index=0（最差）', () => {
      const result = engine.getIconSetIcon(0, 0, makeCell('20', 20), iconRule);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('arrows');
      expect(result!.index).toBe(0);
    });

    it('数值在两个阈值之间时返回 index=1（中等）', () => {
      const result = engine.getIconSetIcon(0, 0, makeCell('50', 50), iconRule);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(1);
    });

    it('数值高于第二个阈值时返回 index=2（最好）', () => {
      const result = engine.getIconSetIcon(0, 0, makeCell('80', 80), iconRule);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(2);
    });

    it('数值等于第一个阈值时返回 index=1', () => {
      const result = engine.getIconSetIcon(0, 0, makeCell('33', 33), iconRule);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(1);
    });

    it('数值等于第二个阈值时返回 index=2', () => {
      const result = engine.getIconSetIcon(0, 0, makeCell('67', 67), iconRule);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(2);
    });

    it('不同图标类型正确返回', () => {
      const circlesRule = makeRule('ic2', 1, {
        type: 'iconSet',
        iconType: 'circles',
        thresholds: [30, 70],
      });
      const result = engine.getIconSetIcon(0, 0, makeCell('50', 50), circlesRule);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('circles');
    });

    it('非数值单元格返回 null', () => {
      const result = engine.getIconSetIcon(0, 0, makeCell('文本'), iconRule);
      expect(result).toBeNull();
    });

    it('条件类型不是 iconSet 时返回 null', () => {
      const otherRule = makeRule('r1', 1, { type: 'greaterThan', value: 10 });
      const result = engine.getIconSetIcon(0, 0, makeCell('50', 50), otherRule);
      expect(result).toBeNull();
    });
  });

  // ========== 可视化条件类型在 evaluate 中不匹配 ==========
  describe('可视化条件类型在 evaluate 中不匹配', () => {
    it('dataBar 条件在 evaluate 中返回 null', () => {
      engine.addRule(makeRule('db1', 1, { type: 'dataBar', color: '#4472c4' }, { bgColor: '#ff0000' }));
      const result = engine.evaluate(0, 0, makeCell('50', 50));
      expect(result).toBeNull();
    });

    it('colorScale 条件在 evaluate 中返回 null', () => {
      engine.addRule(makeRule('cs1', 1, { type: 'colorScale', minColor: '#ff0000', maxColor: '#00ff00' }, { bgColor: '#ff0000' }));
      const result = engine.evaluate(0, 0, makeCell('50', 50));
      expect(result).toBeNull();
    });

    it('iconSet 条件在 evaluate 中返回 null', () => {
      engine.addRule(makeRule('is1', 1, { type: 'iconSet', iconType: 'arrows', thresholds: [33, 67] }, { bgColor: '#ff0000' }));
      const result = engine.evaluate(0, 0, makeCell('50', 50));
      expect(result).toBeNull();
    });
  });
});
