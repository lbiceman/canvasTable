package com.iceexcel.server.model;

/**
 * 调整行高操作
 */
public class RowResizeOp extends CollabOperation {

    private int rowIndex;
    private int height;

    public RowResizeOp() {
    }

    public RowResizeOp(String userId, long timestamp, int revision, int rowIndex, int height) {
        super(userId, timestamp, revision);
        this.rowIndex = rowIndex;
        this.height = height;
    }

    @Override
    public String getType() {
        return "rowResize";
    }

    public int getRowIndex() { return rowIndex; }
    public void setRowIndex(int rowIndex) { this.rowIndex = rowIndex; }

    public int getHeight() { return height; }
    public void setHeight(int height) { this.height = height; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RowResizeOp that = (RowResizeOp) o;
        return rowIndex == that.rowIndex && height == that.height
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), rowIndex, height);
    }
}
