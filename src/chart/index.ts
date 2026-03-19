// ============================================================
// 图表模块统一导出入口
// ============================================================

// 核心类
export { ChartModel } from './chart-model';
export { ChartEngine } from './chart-engine';
export { ChartOverlay } from './chart-overlay';
export { ChartEditor } from './chart-editor';
export { SparklineRenderer } from './sparkline-renderer';

// 类型定义
export type {
  ChartType,
  SparklineType,
  DataRange,
  Position,
  Size,
  TitleConfig,
  LegendConfig,
  AxisConfig,
  AxesConfig,
  DataLabelConfig,
  ChartConfig,
  ChartData,
  SeriesData,
  SparklineConfig,
  ChartArea,
  ChartInstance,
  ThemeColors,
  DataPoint,
  SeriesInfo,
} from './types';

// 常量
export { CHART_COLORS_LIGHT, CHART_COLORS_DARK } from './types';
