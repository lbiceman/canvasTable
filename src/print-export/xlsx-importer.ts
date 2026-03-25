// ============================================================
// XLSX 导入模块 — 基于 ExcelJS 库
// 支持多工作表、样式反向映射、合并单元格、公式、数字格式等
// ============================================================

import ExcelJS from 'exceljs';
import type {
  Cell,
  CellBorder,
  CellFormat,
  BorderSide,
  BorderStyle,
  SheetMeta,
  WorkbookData,
  WorkbookSheetEntry,
} from '../types';
import type { ImportResult } from './types';

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
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 将 ExcelJS ARGB 格式转换为 CSS 颜色格式
 *
 * 支持格式：
 * - FFRRGGBB → #RRGGBB
 * - AARRGGBB → rgba(r,g,b,a)（当 alpha < FF 时）
 * - RRGGBB → #RRGGBB（6 位无 alpha 前缀）
 *
 * @param argb - ARGB 格式字符串
 * @returns CSS 颜色字符串，无法解析时返回 undefined
 */
export function argbToCssColor(argb: string | undefined): string | undefined {
  if (!argb) return undefined;

  const trimmed = argb.trim();

  // 8 位 ARGB 格式：AARRGGBB
  if (/^[0-9a-fA-F]{8}$/.test(trimmed)) {
    const alpha = trimmed.slice(0, 2).toUpperCase();
    const hex = trimmed.slice(2).toUpperCase();

    // 完全不透明时返回 #RRGGBB
    if (alpha === 'FF') {
      return `#${hex}`;
    }

    // 有透明度时返回 rgba
    const a = parseInt(alpha, 16) / 255;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${parseFloat(a.toFixed(2))})`;
  }

  // 6 位 RGB 格式：RRGGBB
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toUpperCase()}`;
  }

  return undefined;
}

/**
 * 生成 UUID
 * 优先使用 crypto.randomUUID()，不可用时使用简单回退方案
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 简单回退方案
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================
// ExcelJS 边框样式到 Cell 边框的反向映射
// ============================================================

/** ExcelJS 边框样式 → Cell BorderStyle + width */
function mapExcelBorderStyle(excelStyle: string): { style: BorderStyle; width: number } {
  switch (excelStyle) {
    case 'thin':
      return { style: 'solid', width: 1 };
    case 'medium':
      return { style: 'solid', width: 2 };
    case 'thick':
      return { style: 'solid', width: 3 };
    case 'dashed':
    case 'mediumDashed':
      return { style: 'dashed', width: 1 };
    case 'dotted':
      return { style: 'dotted', width: 1 };
    case 'double':
      return { style: 'double', width: 1 };
    default:
      // hair、dashDot 等不常见样式回退为 thin solid
      return { style: 'solid', width: 1 };
  }
}

/**
 * 将 ExcelJS Border 对象转换为 Cell BorderSide
 */
function mapExcelBorderSide(border: Partial<ExcelJS.Border>): BorderSide | undefined {
  if (!border.style) return undefined;

  const { style, width } = mapExcelBorderStyle(border.style);
  const color = border.color?.argb
    ? argbToCssColor(border.color.argb) ?? '#000000'
    : '#000000';

  return { style, color, width };
}

// ============================================================
// XlsxImporter 类
// ============================================================

/**
 * XlsxImporter — XLSX 导入器
 *
 * 从 .xlsx 文件解析数据并转换为 WorkbookData 格式，支持：
 * - 多工作表解析
 * - 单元格内容（文本、数值、公式）
 * - 字体样式（加粗、斜体、下划线、删除线、字号、颜色、字体族）
 * - 背景色、对齐方式、自动换行
 * - 边框样式（实线、虚线、点线、双线）
 * - 合并单元格、行高、列宽、数字格式
 */
export class XlsxImporter {
  private _sheetManager: SheetManagerLike | null;
  private _model: SpreadsheetModelLike;

  constructor(sheetManager: SheetManagerLike | null, model: SpreadsheetModelLike) {
    this._sheetManager = sheetManager;
    this._model = model;
  }

  /** 获取 SheetManager 引用（供外部集成使用） */
  get sheetManager(): SheetManagerLike | null {
    return this._sheetManager;
  }

  /** 获取 Model 引用（供外部集成使用） */
  get model(): SpreadsheetModelLike {
    return this._model;
  }

  /**
   * 从 File 对象导入 .xlsx 文件
   *
   * 流程：
   * 1. 读取 File 为 ArrayBuffer
   * 2. 使用 ExcelJS 加载工作簿
   * 3. 转换为 WorkbookData 格式
   * 4. 返回 ImportResult
   */
  async import(file: File): Promise<ImportResult> {
    const warnings: string[] = [];

    try {
      // 1. 读取文件为 ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // 2. 使用 ExcelJS 解析工作簿
      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.load(arrayBuffer);
      } catch {
        return {
          success: false,
          errors: ['文件格式无效，请选择有效的 .xlsx 文件'],
          warnings: [],
        };
      }

      // 3. 检测不支持的功能并添加警告
      this.detectUnsupportedFeatures(workbook, warnings);

      // 4. 转换为 WorkbookData 格式
      const workbookData = this.toWorkbookData(workbook, warnings);

      // 5. 验证至少有一个工作表
      if (workbookData.sheets.length === 0) {
        return {
          success: false,
          errors: ['文件中没有可导入的工作表'],
          warnings,
        };
      }

      return {
        success: true,
        errors: [],
        warnings,
        ...({ workbookData } as Record<string, unknown>),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '未知错误';
      return {
        success: false,
        errors: [`文件已损坏，无法读取：${message}`],
        warnings: [],
      };
    }
  }

  /**
   * 检测 .xlsx 文件中不支持的功能
   */
  private detectUnsupportedFeatures(workbook: ExcelJS.Workbook, warnings: string[]): void {
    // 检测 VBA 宏（ExcelJS 不直接暴露 vbaProject，但可以检查属性）
    // eslint-disable-next-line -- ExcelJS 内部属性无类型定义
    const wb = workbook as unknown as Record<string, unknown>;
    if (wb['vbaProject'] || wb['_vbaProject']) {
      warnings.push('文件包含 VBA 宏，已跳过（不支持）');
    }

    // 检测数据透视表（ExcelJS 不解析数据透视表，但可以提示）
    workbook.eachSheet((worksheet) => {
      // eslint-disable-next-line -- ExcelJS worksheet 内部属性无类型定义
      const ws = worksheet as unknown as Record<string, unknown>;
      if (ws['pivotTables'] && Array.isArray(ws['pivotTables']) && (ws['pivotTables'] as unknown[]).length > 0) {
        warnings.push(`工作表 "${worksheet.name}" 包含数据透视表，已跳过（不支持）`);
      }
    });
  }

  /**
   * 将 ExcelJS Workbook 转换为 WorkbookData 格式
   */
  private toWorkbookData(workbook: ExcelJS.Workbook, warnings: string[]): WorkbookData {
    const sheets: WorkbookSheetEntry[] = [];
    let firstSheetId = '';

    workbook.eachSheet((worksheet, sheetIndex) => {
      const sheetId = generateUUID();
      if (sheetIndex === 1) {
        firstSheetId = sheetId;
      }

      const meta: SheetMeta = {
        id: sheetId,
        name: worksheet.name || `Sheet${sheetIndex}`,
        visible: worksheet.state !== 'hidden' && worksheet.state !== 'veryHidden',
        tabColor: this.extractTabColor(worksheet),
        order: sheets.length,
      };

      // 解析工作表数据
      const data = this.parseWorksheetData(worksheet, warnings);

      sheets.push({
        meta,
        data,
        metadata: {},
      });
    });

    return {
      version: '2.0',
      timestamp: new Date().toISOString(),
      activeSheetId: firstSheetId,
      sheets,
    };
  }

  /**
   * 提取工作表标签颜色
   */
  private extractTabColor(worksheet: ExcelJS.Worksheet): string | null {
    // eslint-disable-next-line -- ExcelJS 内部属性无完整类型定义
    const props = worksheet.properties as unknown as Record<string, unknown>;
    if (props?.tabColor) {
      const tabColor = props.tabColor as Record<string, unknown>;
      if (tabColor.argb) {
        return argbToCssColor(tabColor.argb as string) ?? null;
      }
    }
    return null;
  }

  /**
   * 解析单个工作表的数据
   * 返回与 DataManager 兼容的数据格式
   */
  private parseWorksheetData(
    worksheet: ExcelJS.Worksheet,
    warnings: string[]
  ): Record<string, unknown> {
    // 确定数据范围
    const rowCount = worksheet.rowCount || 0;
    const colCount = worksheet.columnCount || 0;

    // 默认网格大小（与 SpreadsheetModel 默认值一致）
    const gridRows = Math.max(rowCount, 100);
    const gridCols = Math.max(colCount, 26);

    // 初始化单元格二维数组
    const cells: Cell[][] = [];
    for (let r = 0; r < gridRows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < gridCols; c++) {
        row.push(this.createEmptyCell());
      }
      cells.push(row);
    }

    // 解析行高
    const rowHeights: number[] = [];
    for (let r = 0; r < gridRows; r++) {
      const excelRow = worksheet.getRow(r + 1);
      // ExcelJS 行高单位为"磅"，转换为像素（× 1.333）
      if (excelRow.height && excelRow.height > 0) {
        rowHeights.push(Math.round(excelRow.height / 0.75));
      } else {
        rowHeights.push(25); // 默认行高
      }
    }

    // 解析列宽
    const colWidths: number[] = [];
    for (let c = 0; c < gridCols; c++) {
      const excelCol = worksheet.getColumn(c + 1);
      // ExcelJS 列宽单位为"字符"，转换为像素（× 7）
      if (excelCol.width && excelCol.width > 0) {
        colWidths.push(Math.round(excelCol.width * 7));
      } else {
        colWidths.push(100); // 默认列宽
      }
    }

    // 解析合并单元格区域
    const mergeRanges = this.parseMergeRanges(worksheet);

    // 标记合并单元格
    for (const range of mergeRanges) {
      const { top, left, bottom, right } = range;
      const rowSpan = bottom - top + 1;
      const colSpan = right - left + 1;

      // 确保范围在网格内
      if (top < gridRows && left < gridCols) {
        // 设置父单元格的 rowSpan/colSpan
        cells[top][left].rowSpan = rowSpan;
        cells[top][left].colSpan = colSpan;

        // 标记子单元格
        for (let r = top; r <= Math.min(bottom, gridRows - 1); r++) {
          for (let c = left; c <= Math.min(right, gridCols - 1); c++) {
            if (r === top && c === left) continue;
            cells[r][c].isMerged = true;
            cells[r][c].mergeParent = { row: top, col: left };
          }
        }
      }
    }

    // 遍历工作表中的单元格，填充数据和样式
    worksheet.eachRow({ includeEmpty: false }, (excelRow, rowNumber) => {
      const r = rowNumber - 1; // 转为 0-based
      if (r >= gridRows) return;

      excelRow.eachCell({ includeEmpty: false }, (excelCell, colNumber) => {
        const c = colNumber - 1; // 转为 0-based
        if (c >= gridCols) return;

        const cell = cells[r][c];

        // 跳过被合并的子单元格（保留 mergeParent 信息）
        if (cell.isMerged && cell.mergeParent) return;

        // 解析单元格值
        this.parseCellValue(excelCell, cell, warnings);

        // 解析单元格样式
        const styleProps = this.mapStyleToCell(excelCell.style);
        Object.assign(cell, styleProps);
      });
    });

    return {
      cells,
      rowHeights,
      colWidths,
      charts: [],
    };
  }

  /**
   * 解析合并单元格区域
   * 返回 { top, left, bottom, right } 数组（0-based）
   */
  private parseMergeRanges(
    worksheet: ExcelJS.Worksheet
  ): Array<{ top: number; left: number; bottom: number; right: number }> {
    const ranges: Array<{ top: number; left: number; bottom: number; right: number }> = [];

    // eslint-disable-next-line -- ExcelJS worksheet.model 类型不完整
    const model = worksheet.model as unknown as Record<string, unknown>;
    const merges = model?.merges as string[] | undefined;

    if (merges && Array.isArray(merges)) {
      for (const mergeRef of merges) {
        // 格式如 "A1:C3"
        const decoded = this.decodeMergeRange(mergeRef);
        if (decoded) {
          ranges.push(decoded);
        }
      }
    }

    return ranges;
  }

  /**
   * 解码合并单元格引用字符串（如 "A1:C3"）为 0-based 坐标
   */
  private decodeMergeRange(
    ref: string
  ): { top: number; left: number; bottom: number; right: number } | null {
    const parts = ref.split(':');
    if (parts.length !== 2) return null;

    const start = this.decodeAddress(parts[0]);
    const end = this.decodeAddress(parts[1]);
    if (!start || !end) return null;

    return {
      top: start.row,
      left: start.col,
      bottom: end.row,
      right: end.col,
    };
  }

  /**
   * 解码单元格地址（如 "A1"）为 0-based 行列号
   */
  private decodeAddress(address: string): { row: number; col: number } | null {
    const match = address.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;

    const colStr = match[1].toUpperCase();
    const rowNum = parseInt(match[2], 10) - 1; // 转为 0-based

    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    col -= 1; // 转为 0-based

    return { row: rowNum, col };
  }

  /**
   * 解析 ExcelJS 单元格的值
   */
  private parseCellValue(excelCell: ExcelJS.Cell, cell: Cell, warnings: string[]): void {
    const value = excelCell.value;

    if (value === null || value === undefined) return;

    // 公式类型
    if (typeof value === 'object' && 'formula' in value) {
      const formulaObj = value as { formula: string; result?: unknown };
      cell.formulaContent = `=${formulaObj.formula}`;
      // 使用公式结果作为显示内容
      if (formulaObj.result !== undefined && formulaObj.result !== null) {
        if (typeof formulaObj.result === 'number') {
          cell.rawValue = formulaObj.result;
          cell.content = String(formulaObj.result);
        } else {
          cell.content = String(formulaObj.result);
        }
      }
      return;
    }

    // 共享公式（ExcelJS 中的 sharedFormula）
    if (typeof value === 'object' && 'sharedFormula' in value) {
      const sharedObj = value as { sharedFormula: string; result?: unknown };
      cell.formulaContent = `=${sharedObj.sharedFormula}`;
      if (sharedObj.result !== undefined && sharedObj.result !== null) {
        if (typeof sharedObj.result === 'number') {
          cell.rawValue = sharedObj.result;
          cell.content = String(sharedObj.result);
        } else {
          cell.content = String(sharedObj.result);
        }
      }
      return;
    }

    // 富文本类型
    if (typeof value === 'object' && 'richText' in value) {
      const richTextObj = value as { richText: Array<{ text: string }> };
      cell.content = richTextObj.richText.map((seg) => seg.text).join('');
      return;
    }

    // 错误类型
    if (typeof value === 'object' && 'error' in value) {
      const errorObj = value as { error: string };
      cell.content = errorObj.error || '#ERROR!';
      return;
    }

    // 数值类型
    if (typeof value === 'number') {
      cell.rawValue = value;
      cell.content = String(value);
      return;
    }

    // 布尔类型
    if (typeof value === 'boolean') {
      cell.content = value ? 'TRUE' : 'FALSE';
      return;
    }

    // 日期类型
    if (value instanceof Date) {
      cell.rawValue = value.getTime();
      cell.content = this.formatDate(value);
      return;
    }

    // 字符串类型
    if (typeof value === 'string') {
      cell.content = value;
      return;
    }

    // 未知类型，尝试转为字符串
    try {
      cell.content = String(value);
    } catch {
      warnings.push(`单元格值类型不支持，已跳过`);
    }
  }

  /**
   * 格式化日期为 yyyy-MM-dd 字符串
   */
  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * 将 ExcelJS 样式映射回 Cell 属性（反向映射）
   *
   * 这是 XlsxExporter.mapCellStyle() 的逆操作
   */
  private mapStyleToCell(style: Partial<ExcelJS.Style>): Partial<Cell> {
    const result: Partial<Cell> = {};

    // 字体样式映射
    if (style.font) {
      this.mapFontToCell(style.font, result);
    }

    // 背景色映射
    if (style.fill) {
      this.mapFillToCell(style.fill, result);
    }

    // 对齐方式映射
    if (style.alignment) {
      this.mapAlignmentToCell(style.alignment, result);
    }

    // 边框映射
    if (style.border) {
      const border = this.mapBorderToCell(style.border);
      if (border) {
        result.border = border;
      }
    }

    // 数字格式映射
    if (style.numFmt) {
      const format = this.mapNumberFormatToCell(style.numFmt);
      if (format) {
        result.format = format;
      }
    }

    return result;
  }

  /**
   * 将 ExcelJS Font 映射到 Cell 字体属性
   */
  private mapFontToCell(font: Partial<ExcelJS.Font>, result: Partial<Cell>): void {
    if (font.bold) result.fontBold = true;
    if (font.italic) result.fontItalic = true;
    if (font.underline) result.fontUnderline = true;
    if (font.strike) result.fontStrikethrough = true;
    if (font.size) result.fontSize = font.size;
    if (font.name) result.fontFamily = font.name;

    if (font.color?.argb) {
      const cssColor = argbToCssColor(font.color.argb);
      if (cssColor) result.fontColor = cssColor;
    }
  }

  /**
   * 将 ExcelJS Fill 映射到 Cell 背景色
   */
  private mapFillToCell(fill: ExcelJS.Fill, result: Partial<Cell>): void {
    // 仅处理 pattern 类型的填充
    if (fill.type === 'pattern' && fill.pattern === 'solid') {
      const patternFill = fill as ExcelJS.FillPattern;
      if (patternFill.fgColor?.argb) {
        const cssColor = argbToCssColor(patternFill.fgColor.argb);
        if (cssColor) result.bgColor = cssColor;
      }
    }
  }

  /**
   * 将 ExcelJS Alignment 映射到 Cell 对齐属性
   */
  private mapAlignmentToCell(
    alignment: Partial<ExcelJS.Alignment>,
    result: Partial<Cell>
  ): void {
    // 水平对齐
    if (alignment.horizontal) {
      const hAlign = alignment.horizontal;
      if (hAlign === 'left' || hAlign === 'center' || hAlign === 'right') {
        result.fontAlign = hAlign;
      }
      // justify、fill 等不支持的对齐方式忽略
    }

    // 垂直对齐
    if (alignment.vertical) {
      const vAlign = alignment.vertical;
      if (vAlign === 'top' || vAlign === 'middle' || vAlign === 'bottom') {
        result.verticalAlign = vAlign;
      }
      // distributed 等不支持的对齐方式忽略
    }

    // 自动换行
    if (alignment.wrapText) {
      result.wrapText = true;
    }
  }

  /**
   * 将 ExcelJS Borders 映射到 CellBorder
   */
  private mapBorderToCell(borders: Partial<ExcelJS.Borders>): CellBorder | undefined {
    const border: CellBorder = {};
    let hasBorder = false;

    if (borders.top) {
      const side = mapExcelBorderSide(borders.top);
      if (side) {
        border.top = side;
        hasBorder = true;
      }
    }

    if (borders.bottom) {
      const side = mapExcelBorderSide(borders.bottom);
      if (side) {
        border.bottom = side;
        hasBorder = true;
      }
    }

    if (borders.left) {
      const side = mapExcelBorderSide(borders.left);
      if (side) {
        border.left = side;
        hasBorder = true;
      }
    }

    if (borders.right) {
      const side = mapExcelBorderSide(borders.right);
      if (side) {
        border.right = side;
        hasBorder = true;
      }
    }

    return hasBorder ? border : undefined;
  }

  /**
   * 将 ExcelJS 数字格式字符串映射到 CellFormat
   *
   * 通过模式匹配检测格式类别：
   * - 包含 '%' → percentage
   * - 包含货币符号 → currency
   * - 包含日期模式 → date
   * - 包含时间模式 → time
   * - 包含科学计数法 → scientific
   * - 包含数字模式 → number
   * - 其他 → general（返回 undefined）
   */
  private mapNumberFormatToCell(numFmt: string): CellFormat | undefined {
    if (!numFmt || numFmt === 'General' || numFmt === 'general') {
      return undefined;
    }

    // 百分比格式
    if (numFmt.includes('%')) {
      return { category: 'percentage', pattern: numFmt };
    }

    // 货币格式（检测常见货币符号）
    if (/[$¥€£]/.test(numFmt)) {
      // 提取货币符号
      const symbolMatch = numFmt.match(/[$¥€£]/);
      const currencySymbol = symbolMatch ? symbolMatch[0] : undefined;
      return { category: 'currency', pattern: numFmt, currencySymbol };
    }

    // 日期格式（包含年月日模式字符）
    // 注意：需要排除时间格式中的 'm'（分钟），日期中的 m 通常与 y 或 d 一起出现
    if (/[yYdD]/.test(numFmt) && /[mM]/.test(numFmt)) {
      return { category: 'date', pattern: numFmt };
    }

    // 纯日期（只有年或只有月日）
    if (/[yY]{2,4}/.test(numFmt) || /[dD]{1,2}/.test(numFmt)) {
      return { category: 'date', pattern: numFmt };
    }

    // 时间格式（包含时分秒模式字符）
    if (/[hH]/.test(numFmt) && /[ms]/.test(numFmt)) {
      return { category: 'time', pattern: numFmt };
    }

    // 科学计数法
    if (/[eE][+\-]/.test(numFmt) || /0\..*E/.test(numFmt)) {
      return { category: 'scientific', pattern: numFmt };
    }

    // 数字格式（包含 # 或 0 的数字占位符）
    if (/[#0]/.test(numFmt)) {
      return { category: 'number', pattern: numFmt };
    }

    // 无法识别的格式，返回 undefined（视为 general）
    return undefined;
  }

  /**
   * 创建空单元格对象
   */
  private createEmptyCell(): Cell {
    return {
      content: '',
      rowSpan: 1,
      colSpan: 1,
      isMerged: false,
    };
  }
}
