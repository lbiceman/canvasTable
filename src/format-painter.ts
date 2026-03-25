import { SpreadsheetModel } from './model';
import { HistoryManager } from './history-manager';
import { CellFormat, CellBorder } from './types';

// 格式刷模式：关闭 / 单次 / 锁定
export type FormatPainterMode = 'off' | 'single' | 'locked';

// 复制的格式数据
export interface CopiedFormat {
  fontColor?: string;
  bgColor?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  format?: CellFormat;
  border?: CellBorder;
  fontFamily?: string;
  fontStrikethrough?: boolean;
}

// 单元格旧格式数据（用于撤销）
interface OldCellFormat {
  row: number;
  col: number;
  format: CopiedFormat;
}

/**
 * 格式刷工具
 * 负责复制源单元格的格式并应用到目标区域
 */
export class FormatPainter {
  private model: SpreadsheetModel;
  private historyManager: HistoryManager;
  private mode: FormatPainterMode = 'off';
  private copiedFormat: CopiedFormat | null = null;

  constructor(model: SpreadsheetModel, historyManager: HistoryManager) {
    this.model = model;
    this.historyManager = historyManager;
  }

  /**
   * 激活格式刷（单次模式）
   * 从源单元格提取格式，应用一次后自动退出
   */
  public activate(sourceRow: number, sourceCol: number): void {
    this.copiedFormat = this.extractFormat(sourceRow, sourceCol);
    this.mode = 'single';
  }

  /**
   * 激活锁定格式刷（连续模式）
   * 从源单元格提取格式，可连续多次应用
   */
  public activateLocked(sourceRow: number, sourceCol: number): void {
    this.copiedFormat = this.extractFormat(sourceRow, sourceCol);
    this.mode = 'locked';
  }

  /**
   * 从单元格提取所有格式属性
   */
  public extractFormat(row: number, col: number): CopiedFormat {
    const cell = this.model.getCell(row, col);
    if (!cell) {
      return {};
    }

    const format: CopiedFormat = {};

    // 提取所有格式属性（仅在有值时设置）
    if (cell.fontColor !== undefined) format.fontColor = cell.fontColor;
    if (cell.bgColor !== undefined) format.bgColor = cell.bgColor;
    if (cell.fontSize !== undefined) format.fontSize = cell.fontSize;
    if (cell.fontBold !== undefined) format.fontBold = cell.fontBold;
    if (cell.fontItalic !== undefined) format.fontItalic = cell.fontItalic;
    if (cell.fontUnderline !== undefined) format.fontUnderline = cell.fontUnderline;
    if (cell.fontAlign !== undefined) format.fontAlign = cell.fontAlign;
    if (cell.verticalAlign !== undefined) format.verticalAlign = cell.verticalAlign;
    if (cell.format !== undefined) format.format = { ...cell.format };
    // 提取边框属性（深拷贝每条边）
    if (cell.border !== undefined) {
      format.border = {
        ...(cell.border.top ? { top: { ...cell.border.top } } : {}),
        ...(cell.border.bottom ? { bottom: { ...cell.border.bottom } } : {}),
        ...(cell.border.left ? { left: { ...cell.border.left } } : {}),
        ...(cell.border.right ? { right: { ...cell.border.right } } : {}),
      };
    }
    // 提取字体族属性
    if (cell.fontFamily !== undefined) format.fontFamily = cell.fontFamily;
    // 提取删除线属性
    if (cell.fontStrikethrough !== undefined) format.fontStrikethrough = cell.fontStrikethrough;

    return format;
  }

  /**
   * 将格式应用到目标区域
   * 仅修改格式属性，不改变内容和公式
   * 整个操作记录为一条历史记录
   */
  public applyToRange(startRow: number, startCol: number, endRow: number, endCol: number): void {
    if (!this.copiedFormat || this.mode === 'off') {
      return;
    }

    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    // 收集目标区域所有单元格的旧格式（用于撤销）
    const oldFormats: OldCellFormat[] = [];

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        oldFormats.push({
          row: r,
          col: c,
          format: this.extractFormat(r, c),
        });
      }
    }

    // 记录一条 formatPainter 历史操作
    this.historyManager.record({
      type: 'formatPainter',
      data: {
        startRow: minRow,
        startCol: minCol,
        endRow: maxRow,
        endCol: maxCol,
        appliedFormat: { ...this.copiedFormat },
      },
      undoData: {
        cells: oldFormats,
      },
    });

    // 暂停历史记录，避免逐个单元格操作被重复记录
    this.historyManager.pauseRecording();

    try {
      // 将格式应用到目标区域的每个单元格
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          this.applyFormatToCell(r, c, this.copiedFormat);
        }
      }
    } finally {
      // 恢复历史记录
      this.historyManager.resumeRecording();
    }

    // 单次模式应用后自动退出
    if (this.mode === 'single') {
      this.deactivate();
    }
    // 锁定模式保持不变
  }

  /**
   * 退出格式刷模式
   */
  public deactivate(): void {
    this.mode = 'off';
    this.copiedFormat = null;
  }

  /**
   * 获取当前格式刷模式
   */
  public getMode(): FormatPainterMode {
    return this.mode;
  }

  /**
   * 将格式应用到单个单元格（内部方法）
   * 仅修改格式属性，保留内容和公式
   */
  private applyFormatToCell(row: number, col: number, format: CopiedFormat): void {
    const cell = this.model.getCell(row, col);
    if (!cell) return;

    // 应用各格式属性
    cell.fontColor = format.fontColor;
    cell.bgColor = format.bgColor;
    cell.fontSize = format.fontSize;
    cell.fontBold = format.fontBold;
    cell.fontItalic = format.fontItalic;
    cell.fontUnderline = format.fontUnderline;
    cell.fontAlign = format.fontAlign;
    cell.verticalAlign = format.verticalAlign;
    cell.format = format.format ? { ...format.format } : undefined;
    // 应用边框属性（深拷贝每条边）
    if (format.border) {
      cell.border = {
        ...(format.border.top ? { top: { ...format.border.top } } : {}),
        ...(format.border.bottom ? { bottom: { ...format.border.bottom } } : {}),
        ...(format.border.left ? { left: { ...format.border.left } } : {}),
        ...(format.border.right ? { right: { ...format.border.right } } : {}),
      };
    } else {
      cell.border = undefined;
    }
    // 应用字体族属性
    cell.fontFamily = format.fontFamily;
    // 应用删除线属性
    cell.fontStrikethrough = format.fontStrikethrough;
  }
}
