package com.iceexcel.server.model;

/**
 * 删除行操作
 */
public class RowDeleteOp extends CollabOperation {

    private int rowIndex;
    private int count;

    public RowDeleteOp() {
    }

    public RowDeleteOp(String userId, long timestamp, int revision, int rowIndex, int count) {
        super(userId, timestamp, revision);
        this.rowIndex = rowIndex;
        this.count = count;
    }

    @Override
    public String getType() {
        return "rowDelete";
    }

    public int getRowIndex() { return rowIndex; }
    public void setRowIndex(int rowIndex) { this.rowIndex = rowIndex; }

    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RowDeleteOp that = (RowDeleteOp) o;
        return rowIndex == that.rowIndex && count == that.count
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), rowIndex, count);
    }
}
