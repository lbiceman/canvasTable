package com.iceexcel.server.model;

/**
 * 删除列操作
 */
public class ColDeleteOp extends CollabOperation {

    private int colIndex;
    private int count;

    public ColDeleteOp() {
    }

    public ColDeleteOp(String userId, long timestamp, int revision, int colIndex, int count) {
        super(userId, timestamp, revision);
        this.colIndex = colIndex;
        this.count = count;
    }

    @Override
    public String getType() {
        return "colDelete";
    }

    public int getColIndex() { return colIndex; }
    public void setColIndex(int colIndex) { this.colIndex = colIndex; }

    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ColDeleteOp that = (ColDeleteOp) o;
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
