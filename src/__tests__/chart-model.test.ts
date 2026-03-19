import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpreadsheetModel } from '../model';
import { ChartModel } from '../chart/chart-model';
import type { DataRange } from '../chart/types';

/**
 * 辅助函数：在 SpreadsheetModel 中填充数值数据
 */
function fillNumericData(
  model: SpreadsheetModel,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): void {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      model.setCellContent(r, c, String((r + 1) * 10 + c));
    }
  }
}

describe('ChartModel', () => {
  let spreadsheetModel: SpreadsheetModel;
  let chartModel: ChartModel;

  beforeEach(() => {
    spreadsheetModel = new SpreadsheetModel(20, 10);
    chartModel = new ChartModel(spreadsheetModel);
  });

  // ========== createChart ==========
  describe('createChart', () => {
    it('数据区域包含数值时应成功创建图表并返回 ID', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };

      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 100 });

      expect(id).not.toBeNull();
      expect(typeof id).toBe('string');
    });

    it('创建的图表应使用默认尺寸 400×300', () => {
      fillNumericData(spreadsheetModel, 0, 0, 2, 2);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };

      const id = chartModel.createChart('line', dataRange, { x: 0, y: 0 });
      const chart = chartModel.getChart(id!);

      expect(chart).not.toBeNull();
      expect(chart!.size.width).toBe(400);
      expect(chart!.size.height).toBe(300);
    });

    it('创建的图表应使用正确的默认配置', () => {
      fillNumericData(spreadsheetModel, 0, 0, 2, 2);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };

      const id = chartModel.createChart('pie', dataRange, { x: 50, y: 50 });
      const chart = chartModel.getChart(id!);

      expect(chart!.type).toBe('pie');
      expect(chart!.title.visible).toBe(false);
      expect(chart!.legend.visible).toBe(true);
      expect(chart!.legend.position).toBe('bottom');
      expect(chart!.axes.xAxis.autoRange).toBe(true);
      expect(chart!.axes.yAxis.autoRange).toBe(true);
      expect(chart!.dataLabels.visible).toBe(false);
    });

    it('可以指定自定义尺寸', () => {
      fillNumericData(spreadsheetModel, 0, 0, 2, 2);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };

      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 }, { width: 600, height: 450 });
      const chart = chartModel.getChart(id!);

      expect(chart!.size.width).toBe(600);
      expect(chart!.size.height).toBe(450);
    });

    it('数据区域不包含数值时应返回 null', () => {
      spreadsheetModel.setCellContent(0, 0, 'hello');
      spreadsheetModel.setCellContent(0, 1, 'world');
      spreadsheetModel.setCellContent(1, 0, 'foo');
      spreadsheetModel.setCellContent(1, 1, 'bar');
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };

      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 });

      expect(id).toBeNull();
      expect(chartModel.getAllCharts()).toHaveLength(0);
    });

    it('数据区域全部为空时应返回 null', () => {
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };

      const id = chartModel.createChart('line', dataRange, { x: 0, y: 0 });

      expect(id).toBeNull();
    });

    it('数据区域中只要有一个数值就应成功创建', () => {
      spreadsheetModel.setCellContent(0, 0, 'header');
      spreadsheetModel.setCellContent(0, 1, 'text');
      spreadsheetModel.setCellContent(1, 0, 'label');
      spreadsheetModel.setCellContent(1, 1, '42');
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };

      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 });

      expect(id).not.toBeNull();
    });

    it('每次创建的图表 ID 应唯一', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };

      const id1 = chartModel.createChart('bar', dataRange, { x: 0, y: 0 });
      const id2 = chartModel.createChart('line', dataRange, { x: 100, y: 100 });

      expect(id1).not.toBeNull();
      expect(id2).not.toBeNull();
      expect(id1).not.toBe(id2);
    });
  });

  // ========== deleteChart ==========
  describe('deleteChart', () => {
    it('删除图表后 getChart 应返回 null', () => {
      fillNumericData(spreadsheetModel, 0, 0, 2, 2);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.deleteChart(id);

      expect(chartModel.getChart(id)).toBeNull();
    });

    it('删除图表后 getAllCharts 长度应减少', () => {
      fillNumericData(spreadsheetModel, 0, 0, 2, 2);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
      chartModel.createChart('bar', dataRange, { x: 0, y: 0 });
      const id2 = chartModel.createChart('line', dataRange, { x: 100, y: 100 })!;

      expect(chartModel.getAllCharts()).toHaveLength(2);
      chartModel.deleteChart(id2);
      expect(chartModel.getAllCharts()).toHaveLength(1);
    });

    it('删除不存在的图表不应报错', () => {
      expect(() => chartModel.deleteChart('non-existent')).not.toThrow();
    });
  });

  // ========== updateChart ==========
  describe('updateChart', () => {
    it('应正确更新图表类型', () => {
      fillNumericData(spreadsheetModel, 0, 0, 2, 2);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.updateChart(id, { type: 'line' });

      expect(chartModel.getChart(id)!.type).toBe('line');
    });

    it('应正确合并标题配置', () => {
      fillNumericData(spreadsheetModel, 0, 0, 2, 2);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.updateChart(id, { title: { text: '测试标题', fontSize: 18, position: 'top', visible: true } });

      const chart = chartModel.getChart(id)!;
      expect(chart.title.text).toBe('测试标题');
      expect(chart.title.fontSize).toBe(18);
      expect(chart.title.visible).toBe(true);
    });

    it('标题字体大小应被钳制到 12-24px 范围（过小）', () => {
      fillNumericData(spreadsheetModel, 0, 0, 2, 2);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.updateChart(id, { title: { text: '', fontSize: 8, position: 'top', visible: true } });

      expect(chartModel.getChart(id)!.title.fontSize).toBe(12);
    });

    it('标题字体大小应被钳制到 12-24px 范围（过大）', () => {
      fillNumericData(spreadsheetModel, 0, 0, 2, 2);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.updateChart(id, { title: { text: '', fontSize: 30, position: 'top', visible: true } });

      expect(chartModel.getChart(id)!.title.fontSize).toBe(24);
    });

    it('更新不存在的图表不应报错', () => {
      expect(() => chartModel.updateChart('non-existent', { type: 'pie' })).not.toThrow();
    });

    it('应正确更新图例配置', () => {
      fillNumericData(spreadsheetModel, 0, 0, 2, 2);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.updateChart(id, { legend: { visible: false, position: 'right' } });

      const chart = chartModel.getChart(id)!;
      expect(chart.legend.visible).toBe(false);
      expect(chart.legend.position).toBe('right');
    });

    it('应正确更新位置和尺寸', () => {
      fillNumericData(spreadsheetModel, 0, 0, 2, 2);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.updateChart(id, {
        position: { x: 200, y: 300 },
        size: { width: 500, height: 400 },
      });

      const chart = chartModel.getChart(id)!;
      expect(chart.position).toEqual({ x: 200, y: 300 });
      expect(chart.size).toEqual({ width: 500, height: 400 });
    });
  });

  // ========== resolveChartData ==========
  describe('resolveChartData', () => {
    it('图表不存在时应返回空数据且 hasData 为 false', () => {
      const result = chartModel.resolveChartData('non-existent');

      expect(result.categories).toEqual([]);
      expect(result.series).toEqual([]);
      expect(result.hasData).toBe(false);
    });

    it('至少 2 行 2 列时应正确解析系列名称和类别标签', () => {
      // 第一行为系列名称，第一列为类别标签
      spreadsheetModel.setCellContent(0, 0, '');       // 左上角空
      spreadsheetModel.setCellContent(0, 1, '销售额');  // 系列名称
      spreadsheetModel.setCellContent(0, 2, '利润');    // 系列名称
      spreadsheetModel.setCellContent(1, 0, 'Q1');     // 类别标签
      spreadsheetModel.setCellContent(1, 1, '100');
      spreadsheetModel.setCellContent(1, 2, '50');
      spreadsheetModel.setCellContent(2, 0, 'Q2');     // 类别标签
      spreadsheetModel.setCellContent(2, 1, '200');
      spreadsheetModel.setCellContent(2, 2, '80');

      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;
      const result = chartModel.resolveChartData(id);

      expect(result.categories).toEqual(['Q1', 'Q2']);
      expect(result.series).toHaveLength(2);
      expect(result.series[0].name).toBe('销售额');
      expect(result.series[0].values).toEqual([100, 200]);
      expect(result.series[1].name).toBe('利润');
      expect(result.series[1].values).toEqual([50, 80]);
      expect(result.hasData).toBe(true);
    });

    it('单行数据应生成单系列', () => {
      spreadsheetModel.setCellContent(0, 0, '10');
      spreadsheetModel.setCellContent(0, 1, '20');
      spreadsheetModel.setCellContent(0, 2, '30');

      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 0, endCol: 2 };
      const id = chartModel.createChart('line', dataRange, { x: 0, y: 0 })!;
      const result = chartModel.resolveChartData(id);

      expect(result.series).toHaveLength(1);
      expect(result.series[0].name).toBe('系列1');
      expect(result.series[0].values).toEqual([10, 20, 30]);
      expect(result.hasData).toBe(true);
    });

    it('单列数据应生成单系列', () => {
      spreadsheetModel.setCellContent(0, 0, '5');
      spreadsheetModel.setCellContent(1, 0, '15');
      spreadsheetModel.setCellContent(2, 0, '25');

      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 0 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;
      const result = chartModel.resolveChartData(id);

      expect(result.series).toHaveLength(1);
      expect(result.series[0].name).toBe('系列1');
      expect(result.series[0].values).toEqual([5, 15, 25]);
      expect(result.hasData).toBe(true);
    });

    it('非数值单元格在多系列模式下应解析为 0', () => {
      spreadsheetModel.setCellContent(0, 0, '');
      spreadsheetModel.setCellContent(0, 1, 'A');
      spreadsheetModel.setCellContent(1, 0, 'X');
      spreadsheetModel.setCellContent(1, 1, 'abc');  // 非数值

      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
      // 需要在区域内有数值才能创建图表，先放一个数值
      spreadsheetModel.setCellContent(1, 1, '42');
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;
      // 改回非数值
      spreadsheetModel.setCellContent(1, 1, 'abc');

      const result = chartModel.resolveChartData(id);

      expect(result.series[0].values).toEqual([0]);
      expect(result.hasData).toBe(false);
    });

    it('系列颜色应使用 CHART_COLORS_LIGHT 循环分配', () => {
      // 创建一个有多个系列的数据
      spreadsheetModel.setCellContent(0, 0, '');
      for (let c = 1; c <= 3; c++) {
        spreadsheetModel.setCellContent(0, c, `S${c}`);
      }
      for (let r = 1; r <= 2; r++) {
        spreadsheetModel.setCellContent(r, 0, `C${r}`);
        for (let c = 1; c <= 3; c++) {
          spreadsheetModel.setCellContent(r, c, String(r * c * 10));
        }
      }

      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 2, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;
      const result = chartModel.resolveChartData(id);

      expect(result.series[0].color).toBe('#4285F4');
      expect(result.series[1].color).toBe('#EA4335');
      expect(result.series[2].color).toBe('#FBBC04');
    });

    it('hasData 在至少有一个有效数值时应为 true', () => {
      spreadsheetModel.setCellContent(0, 0, '');
      spreadsheetModel.setCellContent(0, 1, 'S1');
      spreadsheetModel.setCellContent(1, 0, 'C1');
      spreadsheetModel.setCellContent(1, 1, '99');

      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;
      const result = chartModel.resolveChartData(id);

      expect(result.hasData).toBe(true);
    });
  });

  // ========== onDataChange ==========
  describe('onDataChange', () => {
    it('注册的回调应在 adjustDataRanges 后被调用', () => {
      fillNumericData(spreadsheetModel, 2, 2, 5, 5);
      const dataRange: DataRange = { startRow: 2, startCol: 2, endRow: 5, endCol: 5 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      const calledWith: string[] = [];
      chartModel.onDataChange((chartId) => {
        calledWith.push(chartId);
      });

      chartModel.adjustDataRanges('rowInsert', 0, 1);

      expect(calledWith).toContain(id);
    });

    it('多个回调都应被调用', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      chartModel.createChart('bar', dataRange, { x: 0, y: 0 });

      let count1 = 0;
      let count2 = 0;
      chartModel.onDataChange(() => { count1++; });
      chartModel.onDataChange(() => { count2++; });

      chartModel.adjustDataRanges('rowInsert', 0, 1);

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });
  });

  // ========== adjustDataRanges ==========
  describe('adjustDataRanges', () => {
    // --- 行插入 ---
    it('行插入在数据范围之前应整体下移', () => {
      fillNumericData(spreadsheetModel, 5, 0, 8, 3);
      const dataRange: DataRange = { startRow: 5, startCol: 0, endRow: 8, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('rowInsert', 2, 3);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startRow).toBe(8);
      expect(chart.dataRange.endRow).toBe(11);
    });

    it('行插入在 startRow 位置应整体下移', () => {
      fillNumericData(spreadsheetModel, 3, 0, 6, 3);
      const dataRange: DataRange = { startRow: 3, startCol: 0, endRow: 6, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('rowInsert', 3, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startRow).toBe(5);
      expect(chart.dataRange.endRow).toBe(8);
    });

    it('行插入在数据范围内部应仅扩展 endRow', () => {
      fillNumericData(spreadsheetModel, 2, 0, 6, 3);
      const dataRange: DataRange = { startRow: 2, startCol: 0, endRow: 6, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('rowInsert', 4, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startRow).toBe(2);
      expect(chart.dataRange.endRow).toBe(8);
    });

    it('行插入在数据范围之后应不变', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('rowInsert', 5, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startRow).toBe(0);
      expect(chart.dataRange.endRow).toBe(3);
    });

    // --- 行删除 ---
    it('行删除完全包含数据范围应标记为 invalidSource', () => {
      fillNumericData(spreadsheetModel, 2, 0, 5, 3);
      const dataRange: DataRange = { startRow: 2, startCol: 0, endRow: 5, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('rowDelete', 1, 6);

      const instance = chartModel.getChartInstance(id)!;
      expect(instance.status).toBe('invalidSource');
    });

    it('行删除在数据范围之前应上移', () => {
      fillNumericData(spreadsheetModel, 5, 0, 8, 3);
      const dataRange: DataRange = { startRow: 5, startCol: 0, endRow: 8, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('rowDelete', 1, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startRow).toBe(3);
      expect(chart.dataRange.endRow).toBe(6);
    });

    it('行删除在数据范围内部应缩小 endRow', () => {
      fillNumericData(spreadsheetModel, 2, 0, 8, 3);
      const dataRange: DataRange = { startRow: 2, startCol: 0, endRow: 8, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('rowDelete', 4, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startRow).toBe(2);
      expect(chart.dataRange.endRow).toBe(6);
    });

    it('行删除在数据范围之后应不变', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('rowDelete', 5, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startRow).toBe(0);
      expect(chart.dataRange.endRow).toBe(3);
    });

    // --- 列插入 ---
    it('列插入在数据范围之前应整体右移', () => {
      fillNumericData(spreadsheetModel, 0, 3, 3, 6);
      const dataRange: DataRange = { startRow: 0, startCol: 3, endRow: 3, endCol: 6 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('colInsert', 1, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startCol).toBe(5);
      expect(chart.dataRange.endCol).toBe(8);
    });

    it('列插入在数据范围内部应仅扩展 endCol', () => {
      fillNumericData(spreadsheetModel, 0, 1, 3, 5);
      const dataRange: DataRange = { startRow: 0, startCol: 1, endRow: 3, endCol: 5 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('colInsert', 3, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startCol).toBe(1);
      expect(chart.dataRange.endCol).toBe(7);
    });

    it('列插入在数据范围之后应不变', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('colInsert', 5, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startCol).toBe(0);
      expect(chart.dataRange.endCol).toBe(3);
    });

    // --- 列删除 ---
    it('列删除完全包含数据范围应标记为 invalidSource', () => {
      fillNumericData(spreadsheetModel, 0, 2, 3, 5);
      const dataRange: DataRange = { startRow: 0, startCol: 2, endRow: 3, endCol: 5 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('colDelete', 1, 6);

      const instance = chartModel.getChartInstance(id)!;
      expect(instance.status).toBe('invalidSource');
    });

    it('列删除在数据范围之前应左移', () => {
      fillNumericData(spreadsheetModel, 0, 4, 3, 7);
      const dataRange: DataRange = { startRow: 0, startCol: 4, endRow: 3, endCol: 7 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('colDelete', 1, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startCol).toBe(2);
      expect(chart.dataRange.endCol).toBe(5);
    });

    it('列删除在数据范围内部应缩小 endCol', () => {
      fillNumericData(spreadsheetModel, 0, 1, 3, 7);
      const dataRange: DataRange = { startRow: 0, startCol: 1, endRow: 3, endCol: 7 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('colDelete', 3, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startCol).toBe(1);
      expect(chart.dataRange.endCol).toBe(5);
    });

    it('列删除在数据范围之后应不变', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.adjustDataRanges('colDelete', 5, 2);

      const chart = chartModel.getChart(id)!;
      expect(chart.dataRange.startCol).toBe(0);
      expect(chart.dataRange.endCol).toBe(3);
    });
  });

  // ========== checkChartStatus ==========
  describe('checkChartStatus', () => {
    it('数据范围超出表格行边界时应标记为 invalidSource', () => {
      // 创建一个 5x5 的小表格
      const smallModel = new SpreadsheetModel(5, 5);
      const smallChartModel = new ChartModel(smallModel);
      fillNumericData(smallModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      const id = smallChartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      // 手动修改数据范围使其超出边界
      smallChartModel.getChart(id)!.dataRange.endRow = 10;
      // 重置状态以便 checkChartStatus 可以重新检测
      smallChartModel.getChartInstance(id)!.status = 'active';
      smallChartModel.checkChartStatus(id);

      expect(smallChartModel.getChartInstance(id)!.status).toBe('invalidSource');
    });

    it('数据范围超出表格列边界时应标记为 invalidSource', () => {
      const smallModel = new SpreadsheetModel(5, 5);
      const smallChartModel = new ChartModel(smallModel);
      fillNumericData(smallModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      const id = smallChartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      smallChartModel.getChart(id)!.dataRange.endCol = 10;
      smallChartModel.getChartInstance(id)!.status = 'active';
      smallChartModel.checkChartStatus(id);

      expect(smallChartModel.getChartInstance(id)!.status).toBe('invalidSource');
    });

    it('数据范围内全部为空时应标记为 noData', () => {
      // 创建图表时需要有数据，之后清空
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      // 清空数据范围内所有单元格
      for (let r = 0; r <= 3; r++) {
        for (let c = 0; c <= 3; c++) {
          spreadsheetModel.setCellContent(r, c, '');
        }
      }

      chartModel.checkChartStatus(id);

      expect(chartModel.getChartInstance(id)!.status).toBe('noData');
    });

    it('数据范围内有数据时应标记为 active', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      chartModel.checkChartStatus(id);

      expect(chartModel.getChartInstance(id)!.status).toBe('active');
    });

    it('对不存在的图表调用不应报错', () => {
      expect(() => chartModel.checkChartStatus('non-existent')).not.toThrow();
    });

    it('已标记为 invalidSource 的图表应保持该状态', () => {
      fillNumericData(spreadsheetModel, 2, 0, 5, 3);
      const dataRange: DataRange = { startRow: 2, startCol: 0, endRow: 5, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 0, y: 0 })!;

      // 通过行删除标记为 invalidSource
      chartModel.adjustDataRanges('rowDelete', 1, 6);

      expect(chartModel.getChartInstance(id)!.status).toBe('invalidSource');

      // 再次检查状态应保持不变
      chartModel.checkChartStatus(id);
      expect(chartModel.getChartInstance(id)!.status).toBe('invalidSource');
    });
  });

  // ========== serialize ==========
  describe('serialize', () => {
    it('无图表时应返回空数组', () => {
      const result = chartModel.serialize();
      expect(result).toEqual([]);
    });

    it('应返回包含所有图表配置的数组', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };

      chartModel.createChart('bar', dataRange, { x: 100, y: 200 });
      chartModel.createChart('line', dataRange, { x: 300, y: 400 });

      const result = chartModel.serialize();
      expect(result).toHaveLength(2);
    });

    it('序列化结果应包含所有必要字段', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 200 })!;

      // 设置一些自定义配置
      chartModel.updateChart(id, {
        title: { text: '测试标题', fontSize: 18, position: 'top', visible: true },
        legend: { visible: false, position: 'right' },
        dataLabels: { visible: true, content: 'percentage' },
      });

      const result = chartModel.serialize();
      expect(result).toHaveLength(1);

      const config = result[0];
      expect(config.id).toBe(id);
      expect(config.type).toBe('bar');
      expect(config.dataRange).toEqual({ startRow: 0, startCol: 0, endRow: 3, endCol: 3 });
      expect(config.position).toEqual({ x: 100, y: 200 });
      expect(config.size).toEqual({ width: 400, height: 300 });
      expect(config.title).toEqual({ text: '测试标题', fontSize: 18, position: 'top', visible: true });
      expect(config.legend).toEqual({ visible: false, position: 'right' });
      expect(config.axes).toBeDefined();
      expect(config.axes.xAxis).toBeDefined();
      expect(config.axes.yAxis).toBeDefined();
      expect(config.dataLabels).toEqual({ visible: true, content: 'percentage' });
    });

    it('序列化结果应为独立副本（修改不影响原始数据）', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 200 })!;

      const result = chartModel.serialize();
      result[0].position.x = 999;

      const original = chartModel.getChart(id)!;
      expect(original.position.x).toBe(100);
    });
  });

  // ========== deserialize ==========
  describe('deserialize', () => {
    it('应正确恢复有效的图表配置', () => {
      const data = [
        {
          id: 'chart-1',
          type: 'bar',
          dataRange: { startRow: 0, startCol: 0, endRow: 3, endCol: 3 },
          position: { x: 100, y: 200 },
          size: { width: 400, height: 300 },
          title: { text: '销售数据', fontSize: 16, position: 'top', visible: true },
          legend: { visible: true, position: 'bottom' },
          axes: {
            xAxis: { title: '', autoRange: true, showGridLines: false },
            yAxis: { title: '', autoRange: true, showGridLines: true },
          },
          dataLabels: { visible: false, content: 'value' },
        },
      ];

      chartModel.deserialize(data);

      const charts = chartModel.getAllCharts();
      expect(charts).toHaveLength(1);
      expect(charts[0].id).toBe('chart-1');
      expect(charts[0].type).toBe('bar');
      expect(charts[0].title.text).toBe('销售数据');
    });

    it('应清空现有图表再恢复', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      chartModel.createChart('bar', dataRange, { x: 0, y: 0 });
      chartModel.createChart('line', dataRange, { x: 100, y: 100 });

      expect(chartModel.getAllCharts()).toHaveLength(2);

      const data = [
        {
          id: 'new-chart',
          type: 'pie',
          dataRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
          position: { x: 50, y: 50 },
          size: { width: 300, height: 250 },
        },
      ];

      chartModel.deserialize(data);

      const charts = chartModel.getAllCharts();
      expect(charts).toHaveLength(1);
      expect(charts[0].id).toBe('new-chart');
    });

    it('缺少可选配置时应使用默认值', () => {
      const data = [
        {
          id: 'chart-minimal',
          type: 'line',
          dataRange: { startRow: 0, startCol: 0, endRow: 5, endCol: 3 },
          position: { x: 0, y: 0 },
          size: { width: 400, height: 300 },
        },
      ];

      chartModel.deserialize(data);

      const chart = chartModel.getChart('chart-minimal')!;
      expect(chart).not.toBeNull();
      // 默认标题配置
      expect(chart.title).toEqual({ text: '', fontSize: 16, position: 'top', visible: false });
      // 默认图例配置
      expect(chart.legend).toEqual({ visible: true, position: 'bottom' });
      // 默认坐标轴配置
      expect(chart.axes.xAxis.autoRange).toBe(true);
      expect(chart.axes.yAxis.showGridLines).toBe(true);
      // 默认数据标签配置
      expect(chart.dataLabels).toEqual({ visible: false, content: 'value' });
    });

    it('应跳过非对象条目并 console.warn', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const data = [
        'not-an-object',
        42,
        null,
        {
          id: 'valid-chart',
          type: 'bar',
          dataRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
          position: { x: 0, y: 0 },
          size: { width: 400, height: 300 },
        },
      ];

      chartModel.deserialize(data);

      expect(chartModel.getAllCharts()).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledTimes(3);

      warnSpy.mockRestore();
    });

    it('应跳过缺少必要字段的条目并 console.warn', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const data = [
        { id: 'no-type', dataRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }, position: { x: 0, y: 0 }, size: { width: 400, height: 300 } },
        { type: 'bar', dataRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }, position: { x: 0, y: 0 }, size: { width: 400, height: 300 } },
        { id: 'no-range', type: 'bar', position: { x: 0, y: 0 }, size: { width: 400, height: 300 } },
        { id: 'no-position', type: 'bar', dataRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }, size: { width: 400, height: 300 } },
        { id: 'no-size', type: 'bar', dataRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 }, position: { x: 0, y: 0 } },
      ];

      chartModel.deserialize(data);

      expect(chartModel.getAllCharts()).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledTimes(5);

      warnSpy.mockRestore();
    });

    it('应跳过无效图表类型的条目', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const data = [
        {
          id: 'invalid-type',
          type: 'radar',
          dataRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
          position: { x: 0, y: 0 },
          size: { width: 400, height: 300 },
        },
      ];

      chartModel.deserialize(data);

      expect(chartModel.getAllCharts()).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('应跳过 dataRange 字段类型无效的条目', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const data = [
        {
          id: 'bad-range',
          type: 'bar',
          dataRange: { startRow: 'abc', startCol: 0, endRow: 2, endCol: 2 },
          position: { x: 0, y: 0 },
          size: { width: 400, height: 300 },
        },
      ];

      chartModel.deserialize(data);

      expect(chartModel.getAllCharts()).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('序列化后再反序列化应保持一致（往返测试）', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      const id = chartModel.createChart('bar', dataRange, { x: 100, y: 200 }, { width: 500, height: 400 })!;

      chartModel.updateChart(id, {
        title: { text: '往返测试', fontSize: 20, position: 'bottom', visible: true },
        legend: { visible: false, position: 'left' },
        axes: {
          xAxis: { title: 'X轴', autoRange: false, showGridLines: true, min: 0, max: 100 },
          yAxis: { title: 'Y轴', autoRange: true, showGridLines: false },
        },
        dataLabels: { visible: true, content: 'category' },
      });

      // 序列化
      const serialized = chartModel.serialize();

      // 反序列化到同一个 chartModel
      chartModel.deserialize(serialized);

      // 验证恢复后的数据
      const restored = chartModel.getChart(id)!;
      expect(restored).not.toBeNull();
      expect(restored.type).toBe('bar');
      expect(restored.dataRange).toEqual({ startRow: 0, startCol: 0, endRow: 3, endCol: 3 });
      expect(restored.position).toEqual({ x: 100, y: 200 });
      expect(restored.size).toEqual({ width: 500, height: 400 });
      expect(restored.title).toEqual({ text: '往返测试', fontSize: 20, position: 'bottom', visible: true });
      expect(restored.legend).toEqual({ visible: false, position: 'left' });
      expect(restored.axes.xAxis).toEqual({ title: 'X轴', autoRange: false, showGridLines: true, min: 0, max: 100 });
      expect(restored.axes.yAxis).toEqual({ title: 'Y轴', autoRange: true, showGridLines: false });
      expect(restored.dataLabels).toEqual({ visible: true, content: 'category' });
    });

    it('空数组应清空所有图表', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };
      chartModel.createChart('bar', dataRange, { x: 0, y: 0 });

      expect(chartModel.getAllCharts()).toHaveLength(1);

      chartModel.deserialize([]);

      expect(chartModel.getAllCharts()).toHaveLength(0);
    });

    it('混合有效和无效条目时应只恢复有效条目', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const data = [
        {
          id: 'valid-1',
          type: 'bar',
          dataRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 2 },
          position: { x: 0, y: 0 },
          size: { width: 400, height: 300 },
        },
        { id: 'invalid', type: 'unknown' },
        {
          id: 'valid-2',
          type: 'line',
          dataRange: { startRow: 1, startCol: 1, endRow: 5, endCol: 4 },
          position: { x: 200, y: 100 },
          size: { width: 600, height: 450 },
          title: { text: '有效图表', fontSize: 14, position: 'top', visible: true },
        },
      ];

      chartModel.deserialize(data);

      const charts = chartModel.getAllCharts();
      expect(charts).toHaveLength(2);
      expect(charts.find((c) => c.id === 'valid-1')).toBeDefined();
      expect(charts.find((c) => c.id === 'valid-2')).toBeDefined();
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });
  });

  // ========== getChart / getAllCharts ==========
  describe('getChart / getAllCharts', () => {
    it('getChart 对不存在的 ID 应返回 null', () => {
      expect(chartModel.getChart('non-existent')).toBeNull();
    });

    it('getAllCharts 初始应返回空数组', () => {
      expect(chartModel.getAllCharts()).toEqual([]);
    });

    it('getAllCharts 应返回所有已创建的图表', () => {
      fillNumericData(spreadsheetModel, 0, 0, 3, 3);
      const dataRange: DataRange = { startRow: 0, startCol: 0, endRow: 3, endCol: 3 };

      chartModel.createChart('bar', dataRange, { x: 0, y: 0 });
      chartModel.createChart('line', dataRange, { x: 100, y: 100 });
      chartModel.createChart('pie', dataRange, { x: 200, y: 200 });

      const charts = chartModel.getAllCharts();
      expect(charts).toHaveLength(3);

      const types = charts.map((c) => c.type);
      expect(types).toContain('bar');
      expect(types).toContain('line');
      expect(types).toContain('pie');
    });
  });
});
