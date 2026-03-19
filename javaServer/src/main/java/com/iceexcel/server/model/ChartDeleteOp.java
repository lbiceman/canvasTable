package com.iceexcel.server.model;

/**
 * 图表删除操作
 */
public class ChartDeleteOp extends CollabOperation {

    private String chartId;

    public ChartDeleteOp() {
    }

    public ChartDeleteOp(String userId, long timestamp, int revision, String chartId) {
        super(userId, timestamp, revision);
        this.chartId = chartId;
    }

    @Override
    public String getType() {
        return "chartDelete";
    }

    public String getChartId() { return chartId; }
    public void setChartId(String chartId) { this.chartId = chartId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ChartDeleteOp that = (ChartDeleteOp) o;
        return java.util.Objects.equals(chartId, that.chartId)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), chartId);
    }
}
