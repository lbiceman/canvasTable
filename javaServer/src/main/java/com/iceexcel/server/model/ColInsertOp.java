package com.iceexcel.server.model;

/**
 * 插入列操作
 */
public class ColInsertOp extends CollabOperation {

    private int colIndex;
    private int count;

    public ColInsertOp() {
    }

    public ColInsertOp(String userId, long timestamp, int revision, int colIndex, int count) {
        super(userId, timestamp, revision);
        this.colIndex = colIndex;
        this.count = count;
    }

    @Override
    public String getType() {
        return "colInsert";
    }

    public int getColIndex() { return colIndex; }
    public void setColIndex(int colIndex) { this.colIndex = colIndex; }

    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ColInsertOp that = (ColInsertOp) o;
        return colIndex == that.colIndex && count == that.count
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), colIndex, count);
    }
}
