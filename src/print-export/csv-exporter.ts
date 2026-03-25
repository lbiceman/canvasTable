// ============================================================
// CSV 导出模块 — 纯 TypeScript 实现，零依赖
// 遵循 RFC 4180 规范，支持 UTF-8 BOM、合并单元格、打印区域过滤
// ============================================================

import type { Cell } from '../types';
import type { CellRange, CsvExportOptions } from './types';
import { PrintArea } from './print-area';

/**
 * SpreadsheetModel 的最小接口，避免循环依赖。
 */
interface SpreadsheetModelLike {
  cells: Cell[][];
  getRowCount(): number;
  getColCount(): number;
}

/**
 * CsvExporter — CSV 导出器
 *
 * 将电子表格数据导出为 CSV 格式文件。
 * - 使用 UTF-8 BOM 编码确保中文在 Excel 中正确显示
 * - 遵循 RFC 4180 规范进行字段转义
 * - 支持合并单元格处理（左上角输出内容，其余输出空字符串）
 * - 支持打印区域过滤
 */
export class CsvExporter {
  private model: SpreadsheetModelLike;

  constructor(model: SpreadsheetModelLike) {
    this.model = model;
  }

  /**
   * 导出为 CSV 并触发浏览器下载
   *
   * @param options - 导出选项（文件名、是否使用打印区域）
   * @param printArea - 打印区域实例（可选）
   * @param sheetName - 工作表名称，用于默认文件名
   */
  export(
    options: CsvExportOptions = {},
    printArea?: PrintArea,
    sheetName: string = 'Sheet1'
  ): void {
    // 确定导出范围
    const range = this.resolveRange(options, printArea);

    // 生成 CSV 字符串
    const csvContent = this.toCsvString(this.model, range);

    // 构建默认文件名：{sheetName}-{YYYY-MM-DD}.csv
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const filename = options.filename ?? `${sheetName}-${dateStr}.csv`;

    // UTF-8 BOM + CSV 内容
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

    // 触发浏览器下载
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  /**
   * 将单元格矩阵转换为 CSV 字符串
   *
   * @param model - 电子表格数据模型
   * @param range - 要导出的单元格范围
   * @returns RFC 4180 格式的 CSV 字符串（使用 \r\n 换行）
   */
  toCsvString(model: SpreadsheetModelLike, range: CellRange): string {
    const rows: string[] = [];

    for (let r = range.startRow; r <= range.endRow; r++) {
      const fields: string[] = [];

      for (let c = range.startCol; c <= range.endCol; c++) {
        const cell = model.cells[r]?.[c];
        const value = cell ? this.getDisplayValue(cell) : '';
        fields.push(this.escapeField(value));
      }

      rows.push(fields.join(','));
    }

    return rows.join('\r\n');
  }

  /**
   * RFC 4180 字段转义
   *
   * 规则：
   * - 如果字段包含逗号、换行符（\n 或 \r）或双引号，则用双引号包裹
   * - 字段内的双引号通过双写转义（" → ""）
   *
   * @param value - 原始字段值
   * @returns 转义后的字段值
   */
  escapeField(value: string): string {
    if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * 获取单元格的格式化显示值
   *
   * 处理逻辑：
   * 1. 合并单元格的非左上角位置 → 空字符串
   * 2. 有 format 和 rawValue → 简单格式化
   * 3. 其他情况 → 返回 cell.content
   *
   * @param cell - 单元格数据
   * @returns 格式化后的显示文本
   */
  getDisplayValue(cell: Cell): string {
    // 合并单元格的非左上角位置输出空字符串
    if (cell.isMerged && cell.mergeParent) {
      return '';
    }

    // 有格式和原始数值时，进行简单格式化
    if (cell.format && cell.rawValue !== undefined) {
      return this.formatValue(cell.rawValue, cell.format);
    }

    return cell.content;
  }

  /**
   * 根据导出选项确定导出范围
   */
  private resolveRange(options: CsvExportOptions, printArea?: PrintArea): CellRange {
    // 使用打印区域过滤
    if (options.usePrintArea && printArea && printArea.isSet()) {
      return printArea.getEffectiveRange(this.model);
    }

    // 默认导出所有数据
    return {
      startRow: 0,
      startCol: 0,
      endRow: this.model.getRowCount() - 1,
      endCol: this.model.getColCount() - 1,
    };
  }

  /**
   * 简单数值格式化
   *
   * 根据 CellFormat 的 category 和 pattern 对数值进行格式化。
   * 保持实现简单，避免引入复杂的格式化依赖。
   */
  private formatValue(rawValue: number, format: { category: string; pattern: string; currencySymbol?: string }): string {
    const { category, pattern, currencySymbol } = format;

    switch (category) {
      case 'percentage': {
        // 百分比：rawValue 为小数形式（如 0.15 → 15%）
        const decimals = this.getDecimalPlaces(pattern);
        return `${(rawValue * 100).toFixed(decimals)}%`;
      }

      case 'currency': {
        // 货币：添加货币符号
        const symbol = currencySymbol ?? '¥';
        const decimals = this.getDecimalPlaces(pattern);
        return `${symbol}${rawValue.toFixed(decimals)}`;
      }

      case 'number': {
        // 数字格式
        const decimals = this.getDecimalPlaces(pattern);
        const formatted = rawValue.toFixed(decimals);
        // 检查是否需要千分位分隔符
        if (pattern.includes(',')) {
          return this.addThousandsSeparator(formatted);
        }
        return formatted;
      }

      case 'date':
      case 'time':
      case 'datetime': {
        // 日期/时间：将数值视为时间戳（毫秒）转换为日期
        return this.formatDate(rawValue, pattern);
      }

      case 'scientific': {
        // 科学计数法
        const decimals = this.getDecimalPlaces(pattern);
        return rawValue.toExponential(decimals);
      }

      default:
        return String(rawValue);
    }
  }

  /**
   * 从格式模式字符串中提取小数位数
   * 例如 "#,##0.00" → 2, "0.000" → 3, "0" → 0
   */
  private getDecimalPlaces(pattern: string): number {
    const dotIndex = pattern.indexOf('.');
    if (dotIndex === -1) return 0;
    // 计算小数点后的 0 和 # 数量
    const afterDot = pattern.slice(dotIndex + 1);
    let count = 0;
    for (const ch of afterDot) {
      if (ch === '0' || ch === '#') {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * 添加千分位分隔符
   * 例如 "1234567.89" → "1,234,567.89"
   */
  private addThousandsSeparator(numStr: string): string {
    const [intPart, decPart] = numStr.split('.');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
  }

  /**
   * 简单日期格式化
   *
   * 将数值（Excel 序列号或毫秒时间戳）转换为日期字符串。
   * 支持常见的日期模式替换。
   */
  private formatDate(rawValue: number, pattern: string): string {
    // Excel 日期序列号基准：1900-01-01 = 1
    // 如果值较小（< 100000），视为 Excel 序列号；否则视为毫秒时间戳
    let date: Date;
    if (rawValue < 100000 && rawValue > 0) {
      // Excel 序列号转换（考虑 1900 闰年 bug：1900-02-29 不存在但 Excel 认为存在）
      const excelEpoch = new Date(1899, 11, 30);
      date = new Date(excelEpoch.getTime() + rawValue * 86400000);
    } else {
      date = new Date(rawValue);
    }

    if (isNaN(date.getTime())) {
      return String(rawValue);
    }

    const yyyy = String(date.getFullYear());
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const HH = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');

    // 按模式替换（从长到短避免部分匹配）
    let result = pattern;
    result = result.replace(/yyyy/g, yyyy);
    result = result.replace(/yy/g, yyyy.slice(2));
    result = result.replace(/MM/g, MM);
    result = result.replace(/dd/g, dd);
    result = result.replace(/HH/g, HH);
    result = result.replace(/mm/g, mm);
    result = result.replace(/ss/g, ss);

    return result;
  }
}
