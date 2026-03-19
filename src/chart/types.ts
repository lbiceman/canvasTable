// ============================================================
// 图表与数据可视化 — 类型定义
// ============================================================

// 图表类型
export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area';

// 迷你图类型
export type SparklineType = 'line' | 'bar' | 'winLoss';

// 数据范围（引用电子表格单元格区域）
export interface DataRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// 图表位置（像素坐标，相对于电子表格数据区域左上角）
export interface Position {
  x: number;
  y: number;
}

// 图表尺寸（最小 200×150 像素）
export interface Size {
  width: number;   // 最小 200
  height: number;  // 最小 150
}

// 标题配置
export interface TitleConfig {
  text: string;
  fontSize: number;    // 范围 12-24
  position: 'top' | 'bottom';
  visible: boolean;
}

// 图例配置
export interface LegendConfig {
  visible: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
}

// 坐标轴配置
export interface AxisConfig {
  title: string;
  autoRange: boolean;
  min?: number;
  max?: number;
  showGridLines: boolean;
}

// 坐标轴组合配置
export interface AxesConfig {
  xAxis: AxisConfig;
  yAxis: AxisConfig;
}

// 数据标签配置
export interface DataLabelConfig {
  visible: boolean;
  content: 'value' | 'percentage' | 'category';
}

// 完整图表配置
export interface ChartConfig {
  id: string;
  type: ChartType;
  dataRange: DataRange;
  position: Position;
  size: Size;
  title: TitleConfig;
  legend: LegendConfig;
  axes: AxesConfig;
  dataLabels: DataLabelConfig;
}

// 系列数据
export interface SeriesData {
  name: string;       // 系列名称
  values: number[];   // 数值数组
  color: string;      // 系列颜色
}

// 解析后的图表数据
export interface ChartData {
  categories: string[];   // 类别标签（X 轴）
  series: SeriesData[];   // 数据系列
  hasData: boolean;       // 是否包含有效数据
}

// 迷你图配置（存储在 Cell 对象中）
export interface SparklineConfig {
  type: SparklineType;
  dataRange: DataRange;
  color?: string;          // 自定义颜色，默认使用主题色
  highlightMax?: boolean;  // 高亮最大值（折线图）
  highlightMin?: boolean;  // 高亮最小值（折线图）
}

// 图表绘制区域（内部使用）
export interface ChartArea {
  x: number;
  y: number;
  width: number;
  height: number;
  plotX: number;       // 绘图区域 X（去除标题、图例、轴标签后）
  plotY: number;       // 绘图区域 Y
  plotWidth: number;   // 绘图区域宽度
  plotHeight: number;  // 绘图区域高度
}

// 图表实例（含运行时状态）
export interface ChartInstance {
  config: ChartConfig;
  status: 'active' | 'noData' | 'invalidSource';
}

// ============================================================
// 默认配色方案
// ============================================================

// 亮色主题默认图表配色
export const CHART_COLORS_LIGHT: readonly string[] = [
  '#4285F4', '#EA4335', '#FBBC04', '#34A853',
  '#FF6D01', '#46BDC6', '#7B61FF', '#F538A0',
];

// 暗色主题默认图表配色
export const CHART_COLORS_DARK: readonly string[] = [
  '#8AB4F8', '#F28B82', '#FDD663', '#81C995',
  '#FCAD70', '#78D9EC', '#AF8FFF', '#FF8BCB',
];

// ============================================================
// 图表渲染引擎辅助类型
// ============================================================

// 主题颜色配置（图表渲染使用）
export interface ThemeColors {
  background: string;       // 图表背景色
  foreground: string;       // 文字前景色
  gridLine: string;         // 网格线颜色
  chartColors: readonly string[];  // 系列配色数组
}

// 数据点（用于数据标签定位）
export interface DataPoint {
  x: number;
  y: number;
  value: number;
  category: string;
  seriesName: string;
}

// 系列信息（用于图例绘制）
export interface SeriesInfo {
  name: string;
  color: string;
}
