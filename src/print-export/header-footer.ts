// ============================================================
// 页眉页脚模块 — 处理页眉页脚模板的解析与变量替换
// ============================================================

import type {
  HeaderFooterSection,
  HeaderFooterData,
  HeaderFooterContext,
} from './types';

/**
 * 所有支持的占位符标记及其对应的上下文字段名。
 * 使用数组保证替换顺序确定性。
 */
const PLACEHOLDERS: ReadonlyArray<{ token: string; key: keyof HeaderFooterContext }> = [
  { token: '{page}', key: 'page' },
  { token: '{pages}', key: 'pages' },
  { token: '{date}', key: 'date' },
  { token: '{time}', key: 'time' },
  { token: '{sheetName}', key: 'sheetName' },
];

/**
 * 替换模板字符串中的所有占位符。
 *
 * 遍历所有已知占位符，使用 split/join 方式替换全部出现位置，
 * 确保不会遗留任何未替换的占位符标记。
 *
 * @param template - 包含占位符的模板字符串
 * @param context  - 渲染上下文，提供占位符的实际值
 */
const replacePlaceholders = (template: string, context: HeaderFooterContext): string => {
  let result = template;
  for (const { token, key } of PLACEHOLDERS) {
    result = result.split(token).join(String(context[key]));
  }
  return result;
};

/**
 * 渲染一个页眉/页脚区段（左/中/右），替换其中的占位符。
 */
const renderSection = (
  section: HeaderFooterSection,
  context: HeaderFooterContext
): HeaderFooterSection => ({
  left: replacePlaceholders(section.left, context),
  center: replacePlaceholders(section.center, context),
  right: replacePlaceholders(section.right, context),
});

/**
 * 创建空的页眉/页脚区段
 */
const emptySection = (): HeaderFooterSection => ({
  left: '',
  center: '',
  right: '',
});

/**
 * HeaderFooter — 页眉页脚类
 *
 * 管理页眉和页脚的模板文本，支持占位符变量替换。
 * 占位符包括：{page}、{pages}、{date}、{time}、{sheetName}。
 */
export class HeaderFooter {
  header: HeaderFooterSection;
  footer: HeaderFooterSection;

  constructor(
    header: HeaderFooterSection = emptySection(),
    footer: HeaderFooterSection = emptySection()
  ) {
    this.header = { ...header };
    this.footer = { ...footer };
  }

  /**
   * 渲染页眉文本，将模板中的占位符替换为上下文中的实际值。
   *
   * @param context - 渲染上下文（页码、总页数、日期、时间、工作表名）
   */
  renderHeader(context: HeaderFooterContext): HeaderFooterSection {
    return renderSection(this.header, context);
  }

  /**
   * 渲染页脚文本，将模板中的占位符替换为上下文中的实际值。
   *
   * @param context - 渲染上下文（页码、总页数、日期、时间、工作表名）
   */
  renderFooter(context: HeaderFooterContext): HeaderFooterSection {
    return renderSection(this.footer, context);
  }

  /**
   * 判断页眉页脚是否为空。
   *
   * 当且仅当所有六个文本字段（header.left、header.center、header.right、
   * footer.left、footer.center、footer.right）均为空字符串时返回 true。
   */
  isEmpty(): boolean {
    return (
      this.header.left === '' &&
      this.header.center === '' &&
      this.header.right === '' &&
      this.footer.left === '' &&
      this.footer.center === '' &&
      this.footer.right === ''
    );
  }

  /**
   * 序列化为 JSON（用于持久化）
   */
  serialize(): HeaderFooterData {
    return {
      header: { ...this.header },
      footer: { ...this.footer },
    };
  }

  /**
   * 从 JSON 反序列化，创建 HeaderFooter 实例。
   *
   * @param data - 序列化数据
   */
  static deserialize(data: HeaderFooterData): HeaderFooter {
    return new HeaderFooter(data.header, data.footer);
  }
}
