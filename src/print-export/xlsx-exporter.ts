// ============================================================
// XLSX 导出模块 — 基于 ExcelJS 库
// 支持多工作表、样式映射、合并单元格、公式、数字格式等
// ============================================================

import ExcelJS from 'exceljs';
import type { Cell, CellBorder, CellFormat, BorderSide, SheetMeta, ConditionalFormatRule } from '../types';

// ============================================================
// 最小接口定义 — 避免循环依赖
// ============================================================

/** SheetManager 最小接口 */
interface SheetManagerLike {
  getVisibleSheets(): SheetMeta[];
  getModelBySheetId(id: string): SpreadsheetModelLike | undefined;
}

/** SpreadsheetModel 最小接口 */
interface SpreadsheetModelLike {
  getCell(row: number, col: number): Cell | null;
  getRowCount(): number;
  getColCount(): number;
  getRowHeight(row: number): number;
  getColWidth(col: number): number;
  getConditionalFormats?(): ConditionalFormatRule[];
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 将 CSS 颜色格式转换为 ExcelJS ARGB 格式
 *
 * 支持格式：
 * - #RGB → FFRRGGBB
 * - #RRGGBB → FFRRGGBB
 * - rgb(r,g,b) → FFRRGGBB
 * - rgba(r,g,b,a) → AARRGGBB
 *
 * @param cssColor - CSS 颜色字符串
 * @returns ARGB 格式字符串，无法解析时返回 undefined
 */
export function cssColorToArgb(cssColor: string): string | undefined {
  if (!cssColor) return undefined;

  const trimmed = cssColor.trim();

  // #RRGGBB 格式
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `FF${trimmed.slice(1).toUpperCase()}`;
  }

  // #RGB 简写格式
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `FF${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  // rgb(r, g, b) 格式
  const rgbMatch = trimmed.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, '0');
    return `FF${r}${g}${b}`.toUpperCase();
  }

  // rgba(r, g, b, a) 格式
  const rgbaMatch = trimmed.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
  if (rgbaMatch) {
    const a = Math.round(parseFloat(rgbaMatch[4]) * 255).toString(16).padStart(2, '0');
    const r = parseInt(rgbaMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbaMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbaMatch[3], 10).toString(16).padStart(2, '0');
    return `${a}${r}${g}${b}`.toUpperCase();
  }

  return undefined;
}


// ============================================================
// XlsxExporter 类
// ============================================================

/**
 * XlsxExporter — XLSX 导出器
 *
 * 将工作簿数据导出为 .xlsx 文件，支持：
 * - 多工作表导出（仅可见工作表）
 * - 单元格内容（文本、数值、公式）
 * - 字体样式（加粗、斜体、下划线、删除线、字号、颜色、字体族）
 * - 背景色、对齐方式、自动换行
 * - 边框样式（实线、虚线、点线、双线）
 * - 合并单元格、行高、列宽、数字格式
 */
export class XlsxExporter {
  private sheetManager: SheetManagerLike | null;
  private model: SpreadsheetModelLike;

  constructor(sheetManager: SheetManagerLike | null, model: SpreadsheetModelLike) {
    this.sheetManager = sheetManager;
    this.model = model;
  }

  /**
   * 导出为 XLSX 并触发浏览器下载
   *
   * @param filename - 自定义文件名（可选），默认为 `{工作簿名称}-{日期}.xlsx`
   */
  async export(filename?: string): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook();

      if (this.sheetManager) {
        // 多工作表模式：遍历所有可见工作表
        const visibleSheets = this.sheetManager.getVisibleSheets();
        for (const sheetMeta of visibleSheets) {
          const sheetModel = this.sheetManager.getModelBySheetId(sheetMeta.id);
          if (sheetModel) {
            this.exportSheet(workbook, sheetMeta.name, sheetModel);
          }
        }
      } else {
        // 单工作表模式
        this.exportSheet(workbook, 'Sheet1', this.model);
      }

      // 写入缓冲区
      const buffer = await workbook.xlsx.writeBuffer();

      // 构建默认文件名
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const defaultName = `工作簿-${dateStr}.xlsx`;
      const finalFilename = filename ?? defaultName;

      // 触发浏览器下载
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = finalFilename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '未知错误';
      // 使用 window.alert 作为后备方案
      window.alert(`XLSX 导出失败：${message}`);
    }
  }

  /**
   * 将单个工作表数据导出到 ExcelJS Workbook
   */
  private exportSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    model: SpreadsheetModelLike
  ): void {
    const worksheet = workbook.addWorksheet(sheetName);
    const rowCount = model.getRowCount();
    const colCount = model.getColCount();

    // 查找实际数据范围（避免导出大量空行空列）
    const { maxRow, maxCol } = this.findDataRange(model, rowCount, colCount);

    // 设置列宽（ExcelJS 使用"字符"单位，大约为像素 / 7）
    for (let c = 0; c < maxCol; c++) {
      const pixelWidth = model.getColWidth(c);
      const col = worksheet.getColumn(c + 1); // ExcelJS 列号从 1 开始
      col.width = pixelWidth / 7;
    }

    // 收集需要合并的区域（避免重复合并）
    const mergedRegions = new Set<string>();

    // 遍历单元格，设置值和样式
    for (let r = 0; r < maxRow; r++) {
      const row = worksheet.getRow(r + 1); // ExcelJS 行号从 1 开始

      // 设置行高（ExcelJS 使用"磅"单位，大约为像素 * 0.75）
      const pixelHeight = model.getRowHeight(r);
      row.height = pixelHeight * 0.75;

      for (let c = 0; c < maxCol; c++) {
        const cellData = model.getCell(r, c);
        if (!cellData) continue;

        // 跳过被合并的子单元格（非左上角）
        if (cellData.isMerged && cellData.mergeParent) continue;

        const excelCell = row.getCell(c + 1);

        // 设置单元格值
        this.setCellValue(excelCell, cellData);

        // 设置单元格样式
        const style = this.mapCellStyle(cellData);
        if (style.font) excelCell.font = style.font;
        if (style.fill) excelCell.fill = style.fill;
        if (style.alignment) excelCell.alignment = style.alignment;
        if (style.border) excelCell.border = style.border;
        if (style.numFmt) excelCell.numFmt = style.numFmt;

        // 处理合并单元格
        if (cellData.rowSpan > 1 || cellData.colSpan > 1) {
          const mergeKey = `${r}:${c}`;
          if (!mergedRegions.has(mergeKey)) {
            mergedRegions.add(mergeKey);
            // ExcelJS mergeCells 参数：top, left, bottom, right（1-based）
            worksheet.mergeCells(
              r + 1,
              c + 1,
              r + cellData.rowSpan,
              c + cellData.colSpan
            );
          }
        }
      }
    }

    // 导出条件格式规则
    if (model.getConditionalFormats) {
      this.exportConditionalFormats(worksheet, model.getConditionalFormats());
    }
  }

  /**
   * 导出条件格式规则到 ExcelJS 工作表
   * 将 ice-excel ConditionalFormatRule 转换为 ExcelJS 条件格式
   */
  private exportConditionalFormats(
    worksheet: ExcelJS.Worksheet,
    rules: ConditionalFormatRule[]
  ): void {
    for (const rule of rules) {
      const { startRow, startCol, endRow, endCol } = rule.range;
      // 转换为 Excel 单元格引用（1-based）
      const ref = `${this.colToLetter(startCol)}${startRow + 1}:${this.colToLetter(endCol)}${endRow + 1}`;

      const excelRule = this.mapConditionToExcel(rule);
      if (!excelRule) continue;

      // ExcelJS 条件格式 API
      worksheet.addConditionalFormatting({
        ref,
        rules: [excelRule],
      });
    }
  }

  /**
   * 将 ice-excel 条件格式规则映射为 ExcelJS 条件格式规则
   */
  private mapConditionToExcel(
    rule: ConditionalFormatRule
  ): ExcelJS.ConditionalFormattingRule | null {
    const condition = rule.condition;
    const style: Partial<ExcelJS.Style> = {};

    // 构建样式
    if (rule.style.fontColor) {
      const argb = cssColorToArgb(rule.style.fontColor);
      if (argb) {
        style.font = { color: { argb } };
      }
    }
    if (rule.style.bgColor) {
      const argb = cssColorToArgb(rule.style.bgColor);
      if (argb) {
        style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      }
    }

    switch (condition.type) {
      case 'greaterThan':
        return {
          type: 'cellIs',
          operator: 'greaterThan',
          formulae: [condition.value],
          style,
          priority: rule.priority,
        } as ExcelJS.ConditionalFormattingRule;

      case 'lessThan':
        return {
          type: 'cellIs',
          operator: 'lessThan',
          formulae: [condition.value],
          style,
          priority: rule.priority,
        } as ExcelJS.ConditionalFormattingRule;

      case 'equals':
        return {
          type: 'cellIs',
          operator: 'equal',
          formulae: [condition.value],
          style,
          priority: rule.priority,
        } as ExcelJS.ConditionalFormattingRule;

      case 'between':
        return {
          type: 'cellIs',
          operator: 'between',
          formulae: [condition.min, condition.max],
          style,
          priority: rule.priority,
        } as ExcelJS.ConditionalFormattingRule;

      case 'textContains':
        return {
          type: 'containsText',
          operator: 'containsText',
          text: condition.text,
          style,
          priority: rule.priority,
        } as ExcelJS.ConditionalFormattingRule;

      default:
        return null;
    }
  }

  /**
   * 将 0-based 列索引转换为 Excel 列字母（如 0→A, 25→Z, 26→AA）
   */
  private colToLetter(col: number): string {
    let result = '';
    let n = col;
    while (n >= 0) {
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26) - 1;
    }
    return result;
  }

  /**
   * 查找实际数据范围，避免导出大量空白区域
   */
  private findDataRange(
    model: SpreadsheetModelLike,
    rowCount: number,
    colCount: number
  ): { maxRow: number; maxCol: number } {
    let maxRow = 0;
    let maxCol = 0;

    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cell = model.getCell(r, c);
        if (cell && this.hasCellData(cell)) {
          if (r + 1 > maxRow) maxRow = r + 1;
          if (c + 1 > maxCol) maxCol = c + 1;
        }
      }
    }

    // 至少导出 1 行 1 列
    return { maxRow: Math.max(maxRow, 1), maxCol: Math.max(maxCol, 1) };
  }

  /**
   * 判断单元格是否有实际数据或样式
   */
  private hasCellData(cell: Cell): boolean {
    return !!(
      cell.content ||
      cell.formulaContent ||
      cell.fontBold ||
      cell.fontItalic ||
      cell.fontUnderline ||
      cell.fontStrikethrough ||
      cell.fontColor ||
      cell.bgColor ||
      cell.fontSize ||
      cell.fontFamily ||
      cell.fontAlign ||
      cell.verticalAlign ||
      cell.wrapText ||
      cell.border ||
      cell.format ||
      cell.rawValue !== undefined ||
      cell.rowSpan > 1 ||
      cell.colSpan > 1 ||
      cell.isMerged
    );
  }

  /**
   * 设置 ExcelJS 单元格的值
   */
  private setCellValue(excelCell: ExcelJS.Cell, cellData: Cell): void {
    // 优先级：公式 > 富文本 > 数值 > 文本
    if (cellData.formulaContent) {
      // 公式：去掉开头的 = 号
      const formula = cellData.formulaContent.startsWith('=')
        ? cellData.formulaContent.slice(1)
        : cellData.formulaContent;
      excelCell.value = { formula, result: cellData.rawValue ?? cellData.content };
    } else if (cellData.richText && cellData.richText.length > 0) {
      // 富文本：转换为 ExcelJS 富文本格式
      excelCell.value = {
        richText: cellData.richText.map(seg => {
          const richSeg: { text: string; font?: Partial<ExcelJS.Font> } = { text: seg.text };
          const font: Partial<ExcelJS.Font> = {};
          let hasFont = false;
          if (seg.fontBold) { font.bold = true; hasFont = true; }
          if (seg.fontItalic) { font.italic = true; hasFont = true; }
          if (seg.fontUnderline) { font.underline = true; hasFont = true; }
          if (seg.fontSize) { font.size = seg.fontSize; hasFont = true; }
          if (seg.fontColor) {
            const argb = cssColorToArgb(seg.fontColor);
            if (argb) { font.color = { argb }; hasFont = true; }
          }
          if (hasFont) richSeg.font = font;
          return richSeg;
        }),
      };
    } else if (cellData.rawValue !== undefined) {
      // 数值
      excelCell.value = cellData.rawValue;
    } else if (cellData.content) {
      // 文本
      excelCell.value = cellData.content;
    }
  }


  /**
   * 将 Cell 样式映射到 ExcelJS 样式对象
   *
   * 映射关系参见设计文档中的 "Cell 到 XLSX 的属性映射" 表格
   */
  mapCellStyle(cell: Cell): Partial<ExcelJS.Style> {
    const style: Partial<ExcelJS.Style> = {};

    // 字体样式映射
    const font = this.buildFont(cell);
    if (font) style.font = font;

    // 背景色映射
    if (cell.bgColor) {
      const argb = cssColorToArgb(cell.bgColor);
      if (argb) {
        style.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb },
        };
      }
    }

    // 对齐方式映射
    const alignment = this.buildAlignment(cell);
    if (alignment) style.alignment = alignment;

    // 边框映射
    if (cell.border) {
      style.border = this.mapBorder(cell.border);
    }

    // 数字格式映射
    if (cell.format) {
      const numFmt = this.mapNumberFormat(cell.format);
      if (numFmt) style.numFmt = numFmt;
    }

    return style;
  }

  /**
   * 构建 ExcelJS 字体对象
   */
  private buildFont(cell: Cell): Partial<ExcelJS.Font> | undefined {
    const hasFont = cell.fontBold || cell.fontItalic || cell.fontUnderline ||
      cell.fontStrikethrough || cell.fontSize || cell.fontColor ||
      cell.fontFamily;

    if (!hasFont) return undefined;

    const font: Partial<ExcelJS.Font> = {};

    if (cell.fontBold) font.bold = true;
    if (cell.fontItalic) font.italic = true;
    if (cell.fontUnderline) font.underline = true;
    if (cell.fontStrikethrough) font.strike = true;
    if (cell.fontSize) font.size = cell.fontSize;
    if (cell.fontFamily) font.name = cell.fontFamily;

    if (cell.fontColor) {
      const argb = cssColorToArgb(cell.fontColor);
      if (argb) font.color = { argb };
    }

    return font;
  }

  /**
   * 构建 ExcelJS 对齐对象
   */
  private buildAlignment(cell: Cell): Partial<ExcelJS.Alignment> | undefined {
    const hasAlignment = cell.fontAlign || cell.verticalAlign || cell.wrapText;
    if (!hasAlignment) return undefined;

    const alignment: Partial<ExcelJS.Alignment> = {};

    if (cell.fontAlign) alignment.horizontal = cell.fontAlign;
    if (cell.verticalAlign) alignment.vertical = cell.verticalAlign;
    if (cell.wrapText) alignment.wrapText = true;

    return alignment;
  }

  /**
   * 将 CellBorder 映射到 ExcelJS Borders 对象
   *
   * BorderStyle 映射规则：
   * - solid: thin (width≤1) / medium (width≤2) / thick (width>2)
   * - dashed → dashed
   * - dotted → dotted
   * - double → double
   */
  mapBorder(border: CellBorder): Partial<ExcelJS.Borders> {
    const result: Partial<ExcelJS.Borders> = {};

    if (border.top) result.top = this.mapBorderSide(border.top);
    if (border.bottom) result.bottom = this.mapBorderSide(border.bottom);
    if (border.left) result.left = this.mapBorderSide(border.left);
    if (border.right) result.right = this.mapBorderSide(border.right);

    return result;
  }

  /**
   * 将单条边框映射到 ExcelJS Border 对象
   */
  private mapBorderSide(side: BorderSide): Partial<ExcelJS.Border> {
    const excelBorder: Partial<ExcelJS.Border> = {};

    // 线型映射
    excelBorder.style = this.mapBorderStyle(side.style, side.width);

    // 颜色映射
    if (side.color) {
      const argb = cssColorToArgb(side.color);
      if (argb) excelBorder.color = { argb };
    }

    return excelBorder;
  }

  /**
   * 将 Cell BorderStyle + width 映射到 ExcelJS BorderStyle
   */
  private mapBorderStyle(style: string, width: number): ExcelJS.BorderStyle {
    switch (style) {
      case 'solid':
        if (width <= 1) return 'thin';
        if (width <= 2) return 'medium';
        return 'thick';
      case 'dashed':
        // 宽度感知：中等虚线使用 mediumDashed
        if (width >= 2) return 'mediumDashed';
        return 'dashed';
      case 'dotted':
        return 'dotted';
      case 'double':
        return 'double';
      default:
        return 'thin';
    }
  }

  /**
   * 将 CellFormat 映射到 ExcelJS 数字格式字符串
   *
   * ExcelJS 直接使用 Excel 格式模式字符串（如 "#,##0.00"、"yyyy-MM-dd"）
   */
  mapNumberFormat(format: CellFormat): string {
    // 如果有自定义 pattern，直接使用
    if (format.pattern) {
      // 货币格式：在 pattern 前添加货币符号
      if (format.category === 'currency' && format.currencySymbol) {
        // 检查 pattern 中是否已包含货币符号
        if (!format.pattern.includes(format.currencySymbol)) {
          return `${format.currencySymbol}${format.pattern}`;
        }
      }
      return format.pattern;
    }

    // 根据 category 返回默认格式
    switch (format.category) {
      case 'number':
        return '#,##0.00';
      case 'currency':
        return `${format.currencySymbol ?? '¥'}#,##0.00`;
      case 'percentage':
        return '0.00%';
      case 'scientific':
        return '0.00E+00';
      case 'date':
        return 'yyyy-MM-dd';
      case 'time':
        return 'HH:mm:ss';
      case 'datetime':
        return 'yyyy-MM-dd HH:mm:ss';
      default:
        return '';
    }
  }
}
