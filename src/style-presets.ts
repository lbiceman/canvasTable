// ============================================================
// 单元格快速样式预设
// 预定义样式组合（标题、强调、数据等），一键应用
// ============================================================

/** 样式预设定义 */
export interface StylePreset {
  name: string;
  label: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontSize?: number;
  fontColor?: string;
  bgColor?: string;
  fontAlign?: 'left' | 'center' | 'right';
  fontFamily?: string;
}

/** 预定义样式列表 */
export const STYLE_PRESETS: StylePreset[] = [
  {
    name: 'title',
    label: '标题',
    fontBold: true,
    fontSize: 18,
    fontColor: '#1a1a1a',
    fontAlign: 'center',
  },
  {
    name: 'subtitle',
    label: '副标题',
    fontBold: true,
    fontSize: 14,
    fontColor: '#444444',
    fontAlign: 'center',
  },
  {
    name: 'header',
    label: '表头',
    fontBold: true,
    fontSize: 13,
    fontColor: '#FFFFFF',
    bgColor: '#4472C4',
    fontAlign: 'center',
  },
  {
    name: 'emphasis',
    label: '强调',
    fontBold: true,
    fontColor: '#C00000',
  },
  {
    name: 'data-number',
    label: '数据',
    fontAlign: 'right',
    fontColor: '#333333',
  },
  {
    name: 'success',
    label: '成功',
    fontColor: '#006100',
    bgColor: '#C6EFCE',
  },
  {
    name: 'warning',
    label: '警告',
    fontColor: '#9C5700',
    bgColor: '#FFEB9C',
  },
  {
    name: 'error',
    label: '错误',
    fontColor: '#9C0006',
    bgColor: '#FFC7CE',
  },
  {
    name: 'neutral',
    label: '中性',
    fontColor: '#333333',
    bgColor: '#F2F2F2',
  },
  {
    name: 'clear',
    label: '清除样式',
  },
];

/**
 * 样式预设引擎
 * 将预设样式应用到指定单元格范围
 */
export class StylePresetEngine {
  /**
   * 应用样式预设到模型
   * @param model 数据模型（需要 setCellFontBold 等方法）
   * @param preset 样式预设
   * @param startRow 起始行
   * @param startCol 起始列
   * @param endRow 结束行
   * @param endCol 结束列
   */
  static apply(
    model: StylePresetModel,
    preset: StylePreset,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): void {
    // "清除样式" 预设
    if (preset.name === 'clear') {
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          model.clearCellFormat(r, c);
        }
      }
      return;
    }

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (preset.fontBold !== undefined) model.setCellFontBold(r, c, preset.fontBold);
        if (preset.fontItalic !== undefined) model.setCellFontItalic(r, c, preset.fontItalic);
        if (preset.fontUnderline !== undefined) model.setCellFontUnderline(r, c, preset.fontUnderline);
        if (preset.fontSize !== undefined) model.setCellFontSize(r, c, preset.fontSize);
        if (preset.fontColor !== undefined) model.setCellFontColor(r, c, preset.fontColor);
        if (preset.bgColor !== undefined) model.setCellBgColor(r, c, preset.bgColor);
        if (preset.fontAlign !== undefined) model.setCellFontAlign(r, c, preset.fontAlign);
        if (preset.fontFamily !== undefined) model.setCellFontFamily(r, c, preset.fontFamily);
      }
    }
  }
}

/** 样式预设所需的模型接口（避免直接依赖 SpreadsheetModel） */
export interface StylePresetModel {
  setCellFontBold(row: number, col: number, bold: boolean): void;
  setCellFontItalic(row: number, col: number, italic: boolean): void;
  setCellFontUnderline(row: number, col: number, underline: boolean): void;
  setCellFontSize(row: number, col: number, size: number): void;
  setCellFontColor(row: number, col: number, color: string): void;
  setCellBgColor(row: number, col: number, color: string): void;
  setCellFontAlign(row: number, col: number, align: string): void;
  setCellFontFamily(row: number, col: number, family: string): void;
  clearCellFormat(row: number, col: number): void;
}
