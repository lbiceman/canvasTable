package com.iceexcel.server.model;

/**
 * 图表更新操作（位置、尺寸、配置变更）
 */
public class ChartUpdateOp extends CollabOperation {

    private String chartId;
    private ChartConfigData chartConfig;

    public ChartUpdateOp() {
    }

    public ChartUpdateOp(String userId, long timestamp, int revision, String chartId, ChartConfigData chartConfig) {
        super(userId, timestamp, revision);
        this.chartId = chartId;
        this.chartConfig = chartConfig;
    }

    @Override
    public String getType() {
        return "chartUpdate";
    }

    public String getChartId() { return chartId; }
    public void setChartId(String chartId) { this.chartId = chartId; }

    public ChartConfigData getChartConfig() { return chartConfig; }
    public void setChartConfig(ChartConfigData chartConfig) { this.chartConfig = chartConfig; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ChartUpdateOp that = (ChartUpdateOp) o;
        return java.util.Objects.equals(chartId, that.chartId)
                && java.util.Objects.equals(chartConfig, that.chartConfig)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), chartId, chartConfig);
    }
}
