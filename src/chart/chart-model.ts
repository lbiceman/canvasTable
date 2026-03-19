// ============================================================
// 图表数据模型 — 管理图表实例的配置数据
// ============================================================

import type { SpreadsheetModel } from '../model';
import type {
  ChartType,
  ChartConfig,
  ChartInstance,
  ChartData,
  SeriesData,
  DataRange,
  Position,
  Size,
} from './types';
import { CHART_COLORS_LIGHT } from './types';

// 唯一 ID 计数器
let chartIdCounter = 0;

/**
 * 生成唯一的图表 ID
 */
function generateChartId(): string {
  chartIdCounter += 1;
  return `chart-${Date.now()}-${chartIdCounter}`;
}

/**
 * 图表数据模型
 *
 * 负责管理所有图表实例的创建、删除、更新和查询。
 * 通过 SpreadsheetModel 引用读取单元格数据以验证数据区域。
 */
export class ChartModel {
  // 图表实例存储
  private charts: Map<string, ChartInstance> = new Map();

  // SpreadsheetModel 引用，用于读取单元格数据
  private model: SpreadsheetModel;

  // 数据变更回调列表
  private changeCallbacks: Array<(chartId: string) => void> = [];

  constructor(model: SpreadsheetModel) {
    this.model = model;
  }

  /**
   * 创建图表
   *
   * 验证数据区域是否包含数值数据，生成唯一 ID，创建默认配置并存储。
   * 成功时返回图表 ID，失败时返回 null。
   *
   * @param type 图表类型
   * @param dataRange 数据区域
   * @param position 图表位置
   * @param size 图表尺寸（可选，默认 400×300）
   * @returns 图表 ID 或 null
   */
  createChart(
    type: ChartType,
    dataRange: DataRange,
    position: Position,
    size?: Size
  ): string | null {
    // 验证数据区域是否包含至少一个数值
    if (!this.hasNumericData(dataRange)) {
      return null;
    }

    const id = generateChartId();

    const config: ChartConfig = {
      id,
      type,
      dataRange,
      position,
      size: size ?? { width: 400, height: 300 },
      title: {
        text: '',
        fontSize: 16,
        position: 'top',
        visible: false,
      },
      legend: {
        visible: true,
        position: 'bottom',
      },
      axes: {
        xAxis: {
          title: '',
          autoRange: true,
          showGridLines: false,
        },
        yAxis: {
          title: '',
          autoRange: true,
          showGridLines: true,
        },
      },
      dataLabels: {
        visible: false,
        content: 'value',
      },
    };

    const instance: ChartInstance = {
      config,
      status: 'active',
    };

    this.charts.set(id, instance);
    return id;
  }

  /**
   * 删除图表
   *
   * 从 Map 中移除指定图表。
   */
  deleteChart(chartId: string): void {
    this.charts.delete(chartId);
  }

  /**
   * 更新图表配置
   *
   * 合并传入的部分配置到现有配置中。
   * 标题字体大小会被钳制到 12-24px 范围。
   */
  updateChart(chartId: string, updates: Partial<ChartConfig>): void {
    const instance = this.charts.get(chartId);
    if (!instance) {
      return;
    }

    const { config } = instance;

    // 逐字段合并更新
    if (updates.type !== undefined) {
      config.type = updates.type;
    }
    if (updates.dataRange !== undefined) {
      config.dataRange = updates.dataRange;
    }
    if (updates.position !== undefined) {
      config.position = updates.position;
    }
    if (updates.size !== undefined) {
      config.size = updates.size;
    }
    if (updates.legend !== undefined) {
      config.legend = { ...config.legend, ...updates.legend };
    }
    if (updates.axes !== undefined) {
      if (updates.axes.xAxis !== undefined) {
        config.axes.xAxis = { ...config.axes.xAxis, ...updates.axes.xAxis };
      }
      if (updates.axes.yAxis !== undefined) {
        config.axes.yAxis = { ...config.axes.yAxis, ...updates.axes.yAxis };
      }
    }
    if (updates.dataLabels !== undefined) {
      config.dataLabels = { ...config.dataLabels, ...updates.dataLabels };
    }

    // 标题配置合并，并钳制字体大小
    if (updates.title !== undefined) {
      config.title = { ...config.title, ...updates.title };
    }
    // 始终钳制标题字体大小到 12-24px
    config.title.fontSize = clampFontSize(config.title.fontSize);
  }

  /**
   * 获取单个图表配置
   *
   * 返回图表配置的副本，不存在时返回 null。
   */
  getChart(chartId: string): ChartConfig | null {
    const instance = this.charts.get(chartId);
    return instance ? instance.config : null;
  }

  /**
   * 获取所有图表配置
   */
  getAllCharts(): ChartConfig[] {
    return Array.from(this.charts.values()).map((inst) => inst.config);
  }

  /**
   * 获取图表实例（含状态信息）
   */
  getChartInstance(chartId: string): ChartInstance | null {
    return this.charts.get(chartId) ?? null;
  }

  /**
   * 注册数据变更回调
   */
  onDataChange(callback: (chartId: string) => void): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * 通知所有注册的回调：指定图表的数据已变更
   */
  private notifyDataChange(chartId: string): void {
    for (const cb of this.changeCallbacks) {
      cb(chartId);
    }
  }

  /**
   * 处理行列插入/删除时的数据范围偏移
   *
   * 遍历所有图表，根据操作类型和位置调整数据范围。
   * 调整完成后检查图表状态并通知变更。
   *
   * @param operation 操作类型
   * @param index 插入/删除的起始位置
   * @param count 插入/删除的数量
   */
  adjustDataRanges(
    operation: 'rowInsert' | 'rowDelete' | 'colInsert' | 'colDelete',
    index: number,
    count: number
  ): void {
    for (const [chartId, instance] of this.charts) {
      const range = instance.config.dataRange;

      switch (operation) {
        case 'rowInsert':
          this.adjustRowInsert(range, index, count);
          break;
        case 'rowDelete':
          if (this.isRowDeleteInvalid(range, index, count)) {
            instance.status = 'invalidSource';
          } else {
            this.adjustRowDelete(range, index, count);
          }
          break;
        case 'colInsert':
          this.adjustColInsert(range, index, count);
          break;
        case 'colDelete':
          if (this.isColDeleteInvalid(range, index, count)) {
            instance.status = 'invalidSource';
          } else {
            this.adjustColDelete(range, index, count);
          }
          break;
      }

      // 调整后检查图表状态
      this.checkChartStatus(chartId);
      this.notifyDataChange(chartId);
    }
  }

  /**
   * 检查图表状态
   *
   * 根据数据范围是否超出表格边界、数据是否全部为空来更新状态。
   */
  checkChartStatus(chartId: string): void {
    const instance = this.charts.get(chartId);
    if (!instance) {
      return;
    }

    // 如果已经被标记为 invalidSource（如行列删除导致），保持该状态
    if (instance.status === 'invalidSource') {
      return;
    }

    const { startRow, startCol, endRow, endCol } = instance.config.dataRange;
    const rowCount = this.model.getRowCount();
    const colCount = this.model.getColCount();

    // 检查数据范围是否超出表格边界
    if (startRow >= rowCount || startCol >= colCount || endRow >= rowCount || endCol >= colCount ||
        startRow < 0 || startCol < 0) {
      instance.status = 'invalidSource';
      return;
    }

    // 检查数据范围内是否全部为空
    let allEmpty = true;
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cell = this.model.getCell(row, col);
        if (cell && cell.content !== '') {
          allEmpty = false;
          break;
        }
      }
      if (!allEmpty) break;
    }

    if (allEmpty) {
      instance.status = 'noData';
      return;
    }

    instance.status = 'active';
  }

  /**
   * 行插入时调整数据范围
   */
  private adjustRowInsert(range: DataRange, index: number, count: number): void {
    if (index <= range.startRow) {
      // 插入位置在数据范围之前或起始行，整体下移
      range.startRow += count;
      range.endRow += count;
    } else if (index > range.startRow && index <= range.endRow) {
      // 插入位置在数据范围内部，仅扩展结束行
      range.endRow += count;
    }
    // 插入位置在数据范围之后，不变
  }

  /**
   * 行删除时调整数据范围
   */
  private adjustRowDelete(range: DataRange, index: number, count: number): void {
    if (index <= range.startRow) {
      // 删除位置在数据范围之前或起始行
      range.startRow = Math.max(index, range.startRow - count);
      range.endRow -= count;
    } else if (index > range.startRow && index <= range.endRow) {
      // 删除位置在数据范围内部
      range.endRow = Math.max(range.startRow, range.endRow - count);
    }
    // 删除位置在数据范围之后，不变
  }

  /**
   * 判断行删除是否完全包含数据范围
   */
  private isRowDeleteInvalid(range: DataRange, index: number, count: number): boolean {
    const deleteEnd = index + count - 1;
    return index <= range.startRow && deleteEnd >= range.endRow;
  }

  /**
   * 列插入时调整数据范围
   */
  private adjustColInsert(range: DataRange, index: number, count: number): void {
    if (index <= range.startCol) {
      range.startCol += count;
      range.endCol += count;
    } else if (index > range.startCol && index <= range.endCol) {
      range.endCol += count;
    }
  }

  /**
   * 列删除时调整数据范围
   */
  private adjustColDelete(range: DataRange, index: number, count: number): void {
    if (index <= range.startCol) {
      range.startCol = Math.max(index, range.startCol - count);
      range.endCol -= count;
    } else if (index > range.startCol && index <= range.endCol) {
      range.endCol = Math.max(range.startCol, range.endCol - count);
    }
  }

  /**
   * 判断列删除是否完全包含数据范围
   */
  private isColDeleteInvalid(range: DataRange, index: number, count: number): boolean {
    const deleteEnd = index + count - 1;
    return index <= range.startCol && deleteEnd >= range.endCol;
  }

  /**
   * 解析图表数据
   *
   * 从 SpreadsheetModel 读取数据范围内的单元格值，自动识别标题行和标签列，
   * 返回包含类别标签、系列数据和有效数据标志的 ChartData 对象。
   *
   * @param chartId 图表 ID
   * @returns ChartData 对象
   */
  resolveChartData(chartId: string): ChartData {
    const instance = this.charts.get(chartId);
    if (!instance) {
      return { categories: [], series: [], hasData: false };
    }

    const { startRow, startCol, endRow, endCol } = instance.config.dataRange;
    const rowCount = endRow - startRow + 1;
    const colCount = endCol - startCol + 1;

    // 仅一行数据：生成单系列，values 为该行所有数值
    if (rowCount === 1) {
      return this.resolveSingleRow(startRow, startCol, endCol);
    }

    // 仅一列数据：生成单系列，values 为该列所有数值
    if (colCount === 1) {
      return this.resolveSingleCol(startCol, startRow, endRow);
    }

    // 至少 2 行 2 列：第一行为系列名称，第一列为类别标签
    return this.resolveMultiSeries(startRow, startCol, endRow, endCol);
  }

  /**
   * 解析单行数据为单系列
   */
  private resolveSingleRow(row: number, startCol: number, endCol: number): ChartData {
    const values: number[] = [];
    const categories: string[] = [];

    for (let col = startCol; col <= endCol; col++) {
      const cell = this.model.getCell(row, col);
      const content = cell?.content ?? '';
      const num = parseFloat(content);
      if (!isNaN(num)) {
        values.push(num);
        categories.push(String(col - startCol + 1));
      }
    }

    const hasData = values.length > 0;
    const series: SeriesData[] = hasData
      ? [{ name: '系列1', values, color: CHART_COLORS_LIGHT[0] }]
      : [];

    return { categories, series, hasData };
  }

  /**
   * 解析单列数据为单系列
   */
  private resolveSingleCol(col: number, startRow: number, endRow: number): ChartData {
    const values: number[] = [];
    const categories: string[] = [];

    for (let row = startRow; row <= endRow; row++) {
      const cell = this.model.getCell(row, col);
      const content = cell?.content ?? '';
      const num = parseFloat(content);
      if (!isNaN(num)) {
        values.push(num);
        categories.push(String(row - startRow + 1));
      }
    }

    const hasData = values.length > 0;
    const series: SeriesData[] = hasData
      ? [{ name: '系列1', values, color: CHART_COLORS_LIGHT[0] }]
      : [];

    return { categories, series, hasData };
  }

  /**
   * 解析多行多列数据为多系列
   *
   * 第一行（startRow）为系列名称，第一列（startCol）为类别标签，
   * 数据从 (startRow+1, startCol+1) 开始。
   */
  private resolveMultiSeries(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): ChartData {
    // 提取类别标签（第一列，从 startRow+1 开始）
    const categories: string[] = [];
    for (let row = startRow + 1; row <= endRow; row++) {
      const cell = this.model.getCell(row, startCol);
      categories.push(cell?.content ?? '');
    }

    // 提取系列名称和数据（从 startCol+1 开始）
    const series: SeriesData[] = [];
    let hasData = false;

    for (let col = startCol + 1; col <= endCol; col++) {
      // 系列名称取自第一行
      const headerCell = this.model.getCell(startRow, col);
      const seriesName = headerCell?.content ?? `系列${col - startCol}`;

      // 系列数据从 startRow+1 开始
      const values: number[] = [];
      for (let row = startRow + 1; row <= endRow; row++) {
        const cell = this.model.getCell(row, col);
        const content = cell?.content ?? '';
        const num = parseFloat(content);
        values.push(isNaN(num) ? 0 : num);
        if (!isNaN(num)) {
          hasData = true;
        }
      }

      // 使用 CHART_COLORS_LIGHT 循环分配颜色
      const colorIndex = (col - startCol - 1) % CHART_COLORS_LIGHT.length;
      series.push({
        name: seriesName,
        values,
        color: CHART_COLORS_LIGHT[colorIndex],
      });
    }

    return { categories, series, hasData };
  }

  /**
   * 序列化所有图表配置
   *
   * 遍历 charts Map，返回所有图表的 config 对象数组。
   * 返回的数组可直接用于 JSON.stringify。
   */
  serialize(): ChartConfig[] {
    return Array.from(this.charts.values()).map((instance) => {
      const { config } = instance;
      return {
        id: config.id,
        type: config.type,
        dataRange: { ...config.dataRange },
        position: { ...config.position },
        size: { ...config.size },
        title: { ...config.title },
        legend: { ...config.legend },
        axes: {
          xAxis: { ...config.axes.xAxis },
          yAxis: { ...config.axes.yAxis },
        },
        dataLabels: { ...config.dataLabels },
      };
    });
  }

  /**
   * 从 JSON 数据恢复图表
   *
   * 接收一个 unknown 数组，逐个验证并恢复有效的图表配置。
   * 无效条目会被跳过并通过 console.warn 记录警告。
   * 调用前会清空现有 charts。
   */
  deserialize(data: unknown[]): void {
    // 清空现有图表
    this.charts.clear();

    for (let i = 0; i < data.length; i++) {
      const entry = data[i];

      // 验证条目是否为对象
      if (!isNonNullObject(entry)) {
        console.warn(`图表反序列化：索引 ${i} 的条目不是有效对象，已跳过`);
        continue;
      }

      // 验证必要字段
      if (!isValidChartEntry(entry)) {
        console.warn(`图表反序列化：索引 ${i} 的条目缺少必要字段或字段类型无效，已跳过`);
        continue;
      }

      // 构建完整的 ChartConfig，缺少可选配置时使用默认值
      const config: ChartConfig = {
        id: entry.id,
        type: entry.type,
        dataRange: {
          startRow: entry.dataRange.startRow,
          startCol: entry.dataRange.startCol,
          endRow: entry.dataRange.endRow,
          endCol: entry.dataRange.endCol,
        },
        position: {
          x: entry.position.x,
          y: entry.position.y,
        },
        size: {
          width: entry.size.width,
          height: entry.size.height,
        },
        title: isValidTitleConfig(entry.title)
          ? {
              text: entry.title.text,
              fontSize: entry.title.fontSize,
              position: entry.title.position,
              visible: entry.title.visible,
            }
          : { text: '', fontSize: 16, position: 'top', visible: false },
        legend: isValidLegendConfig(entry.legend)
          ? {
              visible: entry.legend.visible,
              position: entry.legend.position,
            }
          : { visible: true, position: 'bottom' },
        axes: isValidAxesConfig(entry.axes)
          ? {
              xAxis: {
                title: entry.axes.xAxis.title,
                autoRange: entry.axes.xAxis.autoRange,
                showGridLines: entry.axes.xAxis.showGridLines,
                ...(typeof entry.axes.xAxis.min === 'number' ? { min: entry.axes.xAxis.min } : {}),
                ...(typeof entry.axes.xAxis.max === 'number' ? { max: entry.axes.xAxis.max } : {}),
              },
              yAxis: {
                title: entry.axes.yAxis.title,
                autoRange: entry.axes.yAxis.autoRange,
                showGridLines: entry.axes.yAxis.showGridLines,
                ...(typeof entry.axes.yAxis.min === 'number' ? { min: entry.axes.yAxis.min } : {}),
                ...(typeof entry.axes.yAxis.max === 'number' ? { max: entry.axes.yAxis.max } : {}),
              },
            }
          : {
              xAxis: { title: '', autoRange: true, showGridLines: false },
              yAxis: { title: '', autoRange: true, showGridLines: true },
            },
        dataLabels: isValidDataLabelConfig(entry.dataLabels)
          ? {
              visible: entry.dataLabels.visible,
              content: entry.dataLabels.content,
            }
          : { visible: false, content: 'value' },
      };

      const instance: ChartInstance = {
        config,
        status: 'active',
      };

      this.charts.set(config.id, instance);
    }
  }

  /**
   * 检查数据区域是否包含至少一个数值数据
   *
   * 遍历区域内所有单元格，检查是否有至少一个可解析为数值的内容。
   */
  private hasNumericData(dataRange: DataRange): boolean {
    const { startRow, startCol, endRow, endCol } = dataRange;

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cell = this.model.getCell(row, col);
        if (cell && cell.content !== '') {
          const num = parseFloat(cell.content);
          if (!isNaN(num)) {
            return true;
          }
        }
      }
    }

    return false;
  }
}

/**
 * 钳制标题字体大小到 12-24px 范围
 */
function clampFontSize(size: number): number {
  return Math.min(24, Math.max(12, size));
}

// ============================================================
// 类型守卫辅助函数（用于 deserialize 验证）
// ============================================================

/** 有效的图表类型集合 */
const VALID_CHART_TYPES = new Set<string>(['bar', 'line', 'pie', 'scatter', 'area']);

/** 有效的图例位置集合 */
const VALID_LEGEND_POSITIONS = new Set<string>(['top', 'bottom', 'left', 'right']);

/** 有效的标题位置集合 */
const VALID_TITLE_POSITIONS = new Set<string>(['top', 'bottom']);

/** 有效的数据标签内容类型集合 */
const VALID_DATA_LABEL_CONTENTS = new Set<string>(['value', 'percentage', 'category']);

/**
 * 检查值是否为非 null 对象
 */
function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 验证 DataRange 结构
 */
function isValidDataRange(value: unknown): value is DataRange {
  if (!isNonNullObject(value)) return false;
  return (
    typeof value.startRow === 'number' &&
    typeof value.startCol === 'number' &&
    typeof value.endRow === 'number' &&
    typeof value.endCol === 'number'
  );
}

/**
 * 验证 Position 结构
 */
function isValidPosition(value: unknown): value is Position {
  if (!isNonNullObject(value)) return false;
  return typeof value.x === 'number' && typeof value.y === 'number';
}

/**
 * 验证 Size 结构
 */
function isValidSize(value: unknown): value is Size {
  if (!isNonNullObject(value)) return false;
  return typeof value.width === 'number' && typeof value.height === 'number';
}

/**
 * 验证图表条目的必要字段
 */
function isValidChartEntry(
  value: Record<string, unknown>
): value is Record<string, unknown> & {
  id: string;
  type: ChartType;
  dataRange: DataRange;
  position: Position;
  size: Size;
} {
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    VALID_CHART_TYPES.has(value.type) &&
    isValidDataRange(value.dataRange) &&
    isValidPosition(value.position) &&
    isValidSize(value.size)
  );
}

/**
 * 验证 TitleConfig 结构
 */
function isValidTitleConfig(
  value: unknown
): value is { text: string; fontSize: number; position: 'top' | 'bottom'; visible: boolean } {
  if (!isNonNullObject(value)) return false;
  return (
    typeof value.text === 'string' &&
    typeof value.fontSize === 'number' &&
    typeof value.position === 'string' &&
    VALID_TITLE_POSITIONS.has(value.position) &&
    typeof value.visible === 'boolean'
  );
}

/**
 * 验证 LegendConfig 结构
 */
function isValidLegendConfig(
  value: unknown
): value is { visible: boolean; position: 'top' | 'bottom' | 'left' | 'right' } {
  if (!isNonNullObject(value)) return false;
  return (
    typeof value.visible === 'boolean' &&
    typeof value.position === 'string' &&
    VALID_LEGEND_POSITIONS.has(value.position)
  );
}

/**
 * 验证单个 AxisConfig 结构
 */
function isValidAxisConfig(
  value: unknown
): value is { title: string; autoRange: boolean; showGridLines: boolean; min?: number; max?: number } {
  if (!isNonNullObject(value)) return false;
  return (
    typeof value.title === 'string' &&
    typeof value.autoRange === 'boolean' &&
    typeof value.showGridLines === 'boolean'
  );
}

/**
 * 验证 AxesConfig 结构
 */
function isValidAxesConfig(
  value: unknown
): value is { xAxis: { title: string; autoRange: boolean; showGridLines: boolean; min?: number; max?: number }; yAxis: { title: string; autoRange: boolean; showGridLines: boolean; min?: number; max?: number } } {
  if (!isNonNullObject(value)) return false;
  return isValidAxisConfig(value.xAxis) && isValidAxisConfig(value.yAxis);
}

/**
 * 验证 DataLabelConfig 结构
 */
function isValidDataLabelConfig(
  value: unknown
): value is { visible: boolean; content: 'value' | 'percentage' | 'category' } {
  if (!isNonNullObject(value)) return false;
  return (
    typeof value.visible === 'boolean' &&
    typeof value.content === 'string' &&
    VALID_DATA_LABEL_CONTENTS.has(value.content)
  );
}
