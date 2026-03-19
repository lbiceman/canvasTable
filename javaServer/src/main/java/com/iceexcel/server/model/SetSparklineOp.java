package com.iceexcel.server.model;

/**
 * 设置迷你图操作
 */
public class SetSparklineOp extends CollabOperation {

    private int row;
    private int col;
    private SparklineConfigData sparkline;

    public SetSparklineOp() {
    }

    public SetSparklineOp(String userId, long timestamp, int revision, int row, int col, SparklineConfigData sparkline) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.sparkline = sparkline;
    }

    @Override
    public String getType() {
        return "setSparkline";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public SparklineConfigData getSparkline() { return sparkline; }
    public void setSparkline(SparklineConfigData sparkline) { this.sparkline = sparkline; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SetSparklineOp that = (SetSparklineOp) o;
        return row == that.row && col == that.col
                && java.util.Objects.equals(sparkline, that.sparkline)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, sparkline);
    }
}
