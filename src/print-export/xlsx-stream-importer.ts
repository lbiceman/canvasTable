// ============================================================
// XLSX 大文件流式导入模块
// 使用分块处理策略避免阻塞浏览器主线程
// 支持进度回调和取消操作
// ============================================================

import ExcelJS from 'exceljs';
import type {
  Cell,
  SheetMeta,
  WorkbookData,
  WorkbookSheetEntry,
} from '../types';
import type { ImportResult, StreamImportProgress } from './types';
import { argbToCssColor, XlsxImporter } from './xlsx-importer';

// 每次处理的行数（让出主线程）
const CHUNK_SIZE = 500;

/**
 * 生成 UUID
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 进度回调类型 */
export type ProgressCallback = (progress: StreamImportProgress) => void;

/**
 * XlsxStreamImporter — 大文件流式导入器
 *
 * 针对 10MB+ 的 XLSX 文件，使用分块处理策略：
 * 1. 文件读取阶段：读取 ArrayBuffer
 * 2. 解析阶段：ExcelJS 解析工作簿
 * 3. 构建阶段：分块处理行数据，每处理 CHUNK_SIZE 行让出主线程
 */
export class XlsxStreamImporter {
  private onProgress: ProgressCallback | null = null;
  private cancelled = false;

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.onProgress = callback;
  }

  /**
   * 取消导入操作
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * 报告进度
   */
  private reportProgress(phase: StreamImportProgress['phase'], percent: number, message: string): void {
    if (this.onProgress) {
      this.onProgress({ phase, percent, message });
    }
  }

  /**
   * 让出主线程（使用 setTimeout(0)）
   */
  private yieldToMain(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * 从 File 对象流式导入 .xlsx 文件
   */
  async import(file: File): Promise<ImportResult> {
    this.cancelled = false;
    const warnings: string[] = [];

    try {
      // 阶段 1：读取文件
      this.reportProgress('reading', 0, `正在读取文件 (${(file.size / 1024 / 1024).toFixed(1)} MB)...`);
      const arrayBuffer = await file.arrayBuffer();

      if (this.cancelled) {
        return { success: false, errors: ['导入已取消'], warnings: [] };
      }

      this.reportProgress('reading', 100, '文件读取完成');

      // 阶段 2：解析工作簿
      this.reportProgress('parsing', 0, '正在解析 XLSX 文件...');
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

      if (this.cancelled) {
        return { success: false, errors: ['导入已取消'], warnings: [] };
      }

      this.reportProgress('parsing', 100, '解析完成');

      // 阶段 3：分块构建数据模型
      this.reportProgress('building', 0, '正在构建数据模型...');
      const workbookData = await this.buildWorkbookDataChunked(workbook, warnings);

      if (this.cancelled) {
        return { success: false, errors: ['导入已取消'], warnings: [] };
      }

      if (workbookData.sheets.length === 0) {
        return {
          success: false,
          errors: ['文件中没有可导入的工作表'],
          warnings,
        };
      }

      this.reportProgress('building', 100, '导入完成');

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
   * 分块构建 WorkbookData
   * 每处理 CHUNK_SIZE 行后让出主线程
   */
  private async buildWorkbookDataChunked(
    workbook: ExcelJS.Workbook,
    warnings: string[]
  ): Promise<WorkbookData> {
    const sheets: WorkbookSheetEntry[] = [];
    let firstSheetId = '';
    let sheetIndex = 0;
    const totalSheets = workbook.worksheets.length;

    for (const worksheet of workbook.worksheets) {
      if (this.cancelled) break;

      sheetIndex++;
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

      // 分块解析工作表数据
      const sheetPercent = ((sheetIndex - 1) / totalSheets) * 100;
      this.reportProgress('building', sheetPercent, `正在处理工作表 "${meta.name}" (${sheetIndex}/${totalSheets})...`);

      const data = await this.parseWorksheetChunked(worksheet, warnings, sheetIndex, totalSheets);

      sheets.push({ meta, data, metadata: {} });
    }

    return {
      version: '2.0',
      timestamp: new Date().toISOString(),
      activeSheetId: firstSheetId,
      sheets,
    };
  }

  /**
   * 分块解析单个工作表
   */
  private async parseWorksheetChunked(
    worksheet: ExcelJS.Worksheet,
    warnings: string[],
    sheetIndex: number,
    totalSheets: number
  ): Promise<Record<string, unknown>> {
    const rowCount = worksheet.rowCount || 0;
    const colCount = worksheet.columnCount || 0;

    const gridRows = Math.max(rowCount, 100);
    const gridCols = Math.max(colCount, 26);

    // 初始化单元格数组（分块创建）
    const cells: Cell[][] = [];
    for (let r = 0; r < gridRows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < gridCols; c++) {
        row.push({ content: '', rowSpan: 1, colSpan: 1, isMerged: false });
      }
      cells.push(row);

      // 每 CHUNK_SIZE 行让出主线程
      if (r > 0 && r % CHUNK_SIZE === 0) {
        await this.yieldToMain();
        if (this.cancelled) return { cells: [], rowHeights: [], colWidths: [], charts: [] };
      }
    }

    // 解析行高
    const rowHeights: number[] = [];
    for (let r = 0; r < gridRows; r++) {
      const excelRow = worksheet.getRow(r + 1);
      if (excelRow.height && excelRow.height > 0) {
        rowHeights.push(Math.round(excelRow.height / 0.75));
      } else {
        rowHeights.push(25);
      }
    }

    // 解析列宽
    const colWidths: number[] = [];
    for (let c = 0; c < gridCols; c++) {
      const excelCol = worksheet.getColumn(c + 1);
      if (excelCol.width && excelCol.width > 0) {
        colWidths.push(Math.round(excelCol.width * 7));
      } else {
        colWidths.push(100);
      }
    }

    // 解析合并单元格
    // eslint-disable-next-line -- ExcelJS worksheet.model 类型不完整
    const model = worksheet.model as unknown as Record<string, unknown>;
    const merges = model?.merges as string[] | undefined;
    if (merges && Array.isArray(merges)) {
      for (const mergeRef of merges) {
        const decoded = this.decodeMergeRange(mergeRef);
        if (!decoded) continue;
        const { top, left, bottom, right } = decoded;
        if (top < gridRows && left < gridCols) {
          cells[top][left].rowSpan = bottom - top + 1;
          cells[top][left].colSpan = right - left + 1;
          for (let r = top; r <= Math.min(bottom, gridRows - 1); r++) {
            for (let c = left; c <= Math.min(right, gridCols - 1); c++) {
              if (r === top && c === left) continue;
              cells[r][c].isMerged = true;
              cells[r][c].mergeParent = { row: top, col: left };
            }
          }
        }
      }
    }

    // 分块遍历单元格数据
    let processedRows = 0;
    // 使用临时导入器来复用样式映射逻辑
    const tempImporter = new XlsxImporter(null, {
      getCell: () => null,
      getRowCount: () => 0,
      getColCount: () => 0,
      getRowHeight: () => 25,
      getColWidth: () => 100,
    });

    worksheet.eachRow({ includeEmpty: false }, (excelRow, rowNumber) => {
      const r = rowNumber - 1;
      if (r >= gridRows) return;

      excelRow.eachCell({ includeEmpty: false }, (excelCell, colNumber) => {
        const c = colNumber - 1;
        if (c >= gridCols) return;

        const cell = cells[r][c];
        if (cell.isMerged && cell.mergeParent) return;

        // 解析单元格值
        this.parseCellValue(excelCell, cell, warnings);

        // 解析样式（复用 XlsxImporter 的映射逻辑）
        const styleProps = tempImporter.mapStyleToCell(excelCell.style);
        Object.assign(cell, styleProps);
      });

      processedRows++;
    });

    // 分块让出主线程（在大量行处理后）
    if (processedRows > CHUNK_SIZE) {
      const basePercent = ((sheetIndex - 1) / totalSheets) * 100;
      const sheetPercent = (1 / totalSheets) * 100;
      this.reportProgress('building', basePercent + sheetPercent * 0.9, `工作表数据处理完成...`);
      await this.yieldToMain();
    }

    return { cells, rowHeights, colWidths, charts: [] };
  }

  /**
   * 解析单元格值（与 XlsxImporter 逻辑一致）
   */
  private parseCellValue(excelCell: ExcelJS.Cell, cell: Cell, warnings: string[]): void {
    const value = excelCell.value;
    if (value === null || value === undefined) return;

    if (typeof value === 'object' && 'formula' in value) {
      const formulaObj = value as { formula: string; result?: unknown };
      cell.formulaContent = `=${formulaObj.formula}`;
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

    if (typeof value === 'object' && 'richText' in value) {
      const richTextObj = value as { richText: Array<{ text: string }> };
      cell.content = richTextObj.richText.map((seg) => seg.text).join('');
      return;
    }

    if (typeof value === 'object' && 'error' in value) {
      const errorObj = value as { error: string };
      cell.content = errorObj.error || '#ERROR!';
      return;
    }

    if (typeof value === 'number') {
      cell.rawValue = value;
      cell.content = String(value);
      return;
    }

    if (typeof value === 'boolean') {
      cell.content = value ? 'TRUE' : 'FALSE';
      return;
    }

    if (value instanceof Date) {
      cell.rawValue = value.getTime();
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      cell.content = `${y}-${m}-${d}`;
      return;
    }

    if (typeof value === 'string') {
      cell.content = value;
      return;
    }

    try {
      cell.content = String(value);
    } catch {
      warnings.push('单元格值类型不支持，已跳过');
    }
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

    return { top: start.row, left: start.col, bottom: end.row, right: end.col };
  }

  /**
   * 解码单元格地址（如 "A1"）为 0-based 行列号
   */
  private decodeAddress(address: string): { row: number; col: number } | null {
    const match = address.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;

    const colStr = match[1].toUpperCase();
    const rowNum = parseInt(match[2], 10) - 1;

    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    col -= 1;

    return { row: rowNum, col };
  }
}
