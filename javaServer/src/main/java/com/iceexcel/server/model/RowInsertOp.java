package com.iceexcel.server.model;

/**
 * 插入行操作
 */
public class RowInsertOp extends CollabOperation {

    private int rowIndex;
    private int count;

    public RowInsertOp() {
    }

    public RowInsertOp(String userId, long timestamp, int revision, int rowIndex, int count) {
        super(userId, timestamp, revision);
        this.rowIndex = rowIndex;
        this.count = count;
    }

    @Override
    public String getType() {
        return "rowInsert";
    }

    public int getRowIndex() { return rowIndex; }
    public void setRowIndex(int rowIndex) { this.rowIndex = rowIndex; }

    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RowInsertOp that = (RowInsertOp) o;
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
