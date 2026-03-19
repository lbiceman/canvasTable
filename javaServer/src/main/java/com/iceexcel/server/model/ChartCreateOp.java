package com.iceexcel.server.model;

/**
 * 图表创建操作
 */
public class ChartCreateOp extends CollabOperation {

    private ChartConfigData chartConfig;

    public ChartCreateOp() {
    }

    public ChartCreateOp(String userId, long timestamp, int revision, ChartConfigData chartConfig) {
        super(userId, timestamp, revision);
        this.chartConfig = chartConfig;
    }

    @Override
    public String getType() {
        return "chartCreate";
    }

    public ChartConfigData getChartConfig() { return chartConfig; }
    public void setChartConfig(ChartConfigData chartConfig) { this.chartConfig = chartConfig; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ChartCreateOp that = (ChartCreateOp) o;
        return java.util.Objects.equals(chartConfig, that.chartConfig)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), chartConfig);
    }
}
