// ============================================================
// 打印配置持久化工具 — 在 metadata 中存储/读取打印配置
// ============================================================

import type { PageConfigData, HeaderFooterData, CellRange } from './types';

/**
 * 工作表打印元数据接口
 */
export interface SheetPrintMetadata {
  printArea?: CellRange | null;
  pageConfig?: PageConfigData;
  headerFooter?: HeaderFooterData;
}

/** metadata 中打印配置的键名 */
const KEY_PRINT_AREA = 'printArea';
const KEY_PAGE_CONFIG = 'pageConfig';
const KEY_HEADER_FOOTER = 'headerFooter';

/**
 * 将打印配置写入 metadata 对象。
 * 仅写入非空/非默认的配置项，避免污染 metadata。
 *
 * @param metadata - 工作表的 metadata 对象（会被就地修改）
 * @param printMeta - 打印配置数据
 */
export const savePrintConfigToMetadata = (
  metadata: Record<string, unknown>,
  printMeta: SheetPrintMetadata
): void => {
  // 打印区域：null 表示未设置，写入以保留"已清除"状态
  if (printMeta.printArea !== undefined) {
    metadata[KEY_PRINT_AREA] = printMeta.printArea;
  }

  // 页面配置
  if (printMeta.pageConfig) {
    metadata[KEY_PAGE_CONFIG] = printMeta.pageConfig;
  }

  // 页眉页脚
  if (printMeta.headerFooter) {
    metadata[KEY_HEADER_FOOTER] = printMeta.headerFooter;
  }
};

/**
 * 从 metadata 对象中读取打印配置。
 * 缺失的字段返回 undefined，调用方可据此决定是否使用默认值。
 *
 * @param metadata - 工作表的 metadata 对象
 * @returns 解析出的打印配置
 */
export const loadPrintConfigFromMetadata = (
  metadata: Record<string, unknown>
): SheetPrintMetadata => {
  const result: SheetPrintMetadata = {};

  // 读取打印区域
  if (KEY_PRINT_AREA in metadata) {
    result.printArea = metadata[KEY_PRINT_AREA] as CellRange | null;
  }

  // 读取页面配置
  if (KEY_PAGE_CONFIG in metadata) {
    result.pageConfig = metadata[KEY_PAGE_CONFIG] as PageConfigData;
  }

  // 读取页眉页脚
  if (KEY_HEADER_FOOTER in metadata) {
    result.headerFooter = metadata[KEY_HEADER_FOOTER] as HeaderFooterData;
  }

  return result;
};
