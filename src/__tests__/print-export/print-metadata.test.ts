// ============================================================
// 打印配置持久化工具 — 单元测试
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  savePrintConfigToMetadata,
  loadPrintConfigFromMetadata,
} from '../../print-export/print-metadata';
import type { SheetPrintMetadata } from '../../print-export/print-metadata';
import type { PageConfigData, HeaderFooterData, CellRange } from '../../print-export/types';

describe('print-metadata', () => {
  describe('savePrintConfigToMetadata', () => {
    it('应将打印区域写入 metadata', () => {
      const metadata: Record<string, unknown> = {};
      const printArea: CellRange = { startRow: 0, startCol: 0, endRow: 10, endCol: 5 };
      savePrintConfigToMetadata(metadata, { printArea });
      expect(metadata.printArea).toEqual(printArea);
    });

    it('应将 null 打印区域写入 metadata（表示已清除）', () => {
      const metadata: Record<string, unknown> = {};
      savePrintConfigToMetadata(metadata, { printArea: null });
      expect(metadata.printArea).toBeNull();
    });

    it('应将页面配置写入 metadata', () => {
      const metadata: Record<string, unknown> = {};
      const pageConfig: PageConfigData = {
        paperSize: 'A3',
        orientation: 'landscape',
        margins: { top: 10, bottom: 10, left: 20, right: 20 },
      };
      savePrintConfigToMetadata(metadata, { pageConfig });
      expect(metadata.pageConfig).toEqual(pageConfig);
    });

    it('应将页眉页脚写入 metadata', () => {
      const metadata: Record<string, unknown> = {};
      const headerFooter: HeaderFooterData = {
        header: { left: '标题', center: '', right: '{page}' },
        footer: { left: '', center: '第 {page} 页', right: '' },
      };
      savePrintConfigToMetadata(metadata, { headerFooter });
      expect(metadata.headerFooter).toEqual(headerFooter);
    });

    it('应同时写入所有打印配置', () => {
      const metadata: Record<string, unknown> = { rowCount: 100 };
      const printMeta: SheetPrintMetadata = {
        printArea: { startRow: 1, startCol: 1, endRow: 5, endCol: 3 },
        pageConfig: {
          paperSize: 'Letter',
          orientation: 'portrait',
          margins: { top: 20, bottom: 20, left: 15, right: 15 },
        },
        headerFooter: {
          header: { left: '', center: '', right: '' },
          footer: { left: '', center: '', right: '' },
        },
      };
      savePrintConfigToMetadata(metadata, printMeta);
      // 原有字段不受影响
      expect(metadata.rowCount).toBe(100);
      expect(metadata.printArea).toEqual(printMeta.printArea);
      expect(metadata.pageConfig).toEqual(printMeta.pageConfig);
      expect(metadata.headerFooter).toEqual(printMeta.headerFooter);
    });

    it('未提供的字段不应写入 metadata', () => {
      const metadata: Record<string, unknown> = {};
      savePrintConfigToMetadata(metadata, {});
      expect('printArea' in metadata).toBe(false);
      expect('pageConfig' in metadata).toBe(false);
      expect('headerFooter' in metadata).toBe(false);
    });
  });

  describe('loadPrintConfigFromMetadata', () => {
    it('应从 metadata 中读取打印区域', () => {
      const printArea: CellRange = { startRow: 2, startCol: 3, endRow: 8, endCol: 6 };
      const metadata: Record<string, unknown> = { printArea };
      const result = loadPrintConfigFromMetadata(metadata);
      expect(result.printArea).toEqual(printArea);
    });

    it('应从 metadata 中读取 null 打印区域', () => {
      const metadata: Record<string, unknown> = { printArea: null };
      const result = loadPrintConfigFromMetadata(metadata);
      expect(result.printArea).toBeNull();
    });

    it('应从 metadata 中读取页面配置', () => {
      const pageConfig: PageConfigData = {
        paperSize: 'Legal',
        orientation: 'landscape',
        margins: { top: 5, bottom: 5, left: 10, right: 10 },
      };
      const metadata: Record<string, unknown> = { pageConfig };
      const result = loadPrintConfigFromMetadata(metadata);
      expect(result.pageConfig).toEqual(pageConfig);
    });

    it('应从 metadata 中读取页眉页脚', () => {
      const headerFooter: HeaderFooterData = {
        header: { left: 'L', center: 'C', right: 'R' },
        footer: { left: '', center: '{page}/{pages}', right: '' },
      };
      const metadata: Record<string, unknown> = { headerFooter };
      const result = loadPrintConfigFromMetadata(metadata);
      expect(result.headerFooter).toEqual(headerFooter);
    });

    it('metadata 中无打印配置时返回空对象', () => {
      const metadata: Record<string, unknown> = { rowCount: 50, colCount: 20 };
      const result = loadPrintConfigFromMetadata(metadata);
      expect(result.printArea).toBeUndefined();
      expect(result.pageConfig).toBeUndefined();
      expect(result.headerFooter).toBeUndefined();
    });

    it('往返一致性：保存后读取应得到相同数据', () => {
      const original: SheetPrintMetadata = {
        printArea: { startRow: 0, startCol: 0, endRow: 99, endCol: 25 },
        pageConfig: {
          paperSize: 'A4',
          orientation: 'portrait',
          margins: { top: 20, bottom: 20, left: 15, right: 15 },
        },
        headerFooter: {
          header: { left: '', center: '报表标题', right: '{date}' },
          footer: { left: '', center: '第 {page} 页 / 共 {pages} 页', right: '' },
        },
      };
      const metadata: Record<string, unknown> = {};
      savePrintConfigToMetadata(metadata, original);
      const restored = loadPrintConfigFromMetadata(metadata);
      expect(restored.printArea).toEqual(original.printArea);
      expect(restored.pageConfig).toEqual(original.pageConfig);
      expect(restored.headerFooter).toEqual(original.headerFooter);
    });
  });
});
