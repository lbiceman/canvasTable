// ============================================================
// 打印与导出模块 — 类型定义
// ============================================================

/** 纸张大小 */
export type PaperSize = 'A4' | 'A3' | 'Letter' | 'Legal';

/** 页面方向 */
export type Orientation = 'portrait' | 'landscape';

/** 纸张尺寸映射（单位：mm） */
export const PAPER_DIMENSIONS: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
};

/** 页面边距（单位：mm，范围 0-100） */
export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** 页面配置序列化数据 */
export interface PageConfigData {
  paperSize: PaperSize;
  orientation: Orientation;
  margins: PageMargins;
}

/** 单元格范围 */
export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/** 页眉页脚区段（左/中/右） */
export interface HeaderFooterSection {
  left: string;
  center: string;
  right: string;
}

/** 页眉页脚序列化数据 */
export interface HeaderFooterData {
  header: HeaderFooterSection;
  footer: HeaderFooterSection;
}

/** 页眉页脚渲染上下文 */
export interface HeaderFooterContext {
  page: number;
  pages: number;
  date: string;
  time: string;
  sheetName: string;
}

/** 单页数据范围 */
export interface PageData {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

/** 分页计算结果 */
export interface PageBreakResult {
  pages: PageData[];
  totalPages: number;
}

/** CSV 导出选项 */
export interface CsvExportOptions {
  filename?: string;
  /** 是否仅导出打印区域 */
  usePrintArea?: boolean;
}

/** XLSX/PDF 导入结果 */
export interface ImportResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

/** CSV 导入选项 */
export interface CsvImportOptions {
  /** 手动指定编码（不指定则自动检测） */
  encoding?: string;
  /** 分隔符（默认自动检测：逗号或制表符） */
  delimiter?: string;
}

/** 大文件导入进度回调 */
export interface StreamImportProgress {
  /** 当前阶段：reading=读取文件, parsing=解析数据, building=构建模型 */
  phase: 'reading' | 'parsing' | 'building';
  /** 进度百分比 0-100 */
  percent: number;
  /** 描述信息 */
  message: string;
}

/** 排序配置 */
export interface PivotSortConfig {
  /** 排序字段类型：label=行标签, value=聚合值 */
  by: 'label' | 'value';
  /** 排序字段索引（label 时为行字段索引，value 时为值字段索引） */
  fieldIndex: number;
  /** 排序方向 */
  direction: 'asc' | 'desc';
}
