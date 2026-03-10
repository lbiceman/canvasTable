package com.iceexcel.server.model;

/**
 * 调整列宽操作
 */
public class ColResizeOp extends CollabOperation {

    private int colIndex;
    private int width;

    public ColResizeOp() {
    }

    public ColResizeOp(String userId, long timestamp, int revision, int colIndex, int width) {
        super(userId, timestamp, revision);
        this.colIndex = colIndex;
        this.width = width;
    }

    @Override
    public String getType() {
        return "colResize";
    }

    public int getColIndex() { return colIndex; }
    public void setColIndex(int colIndex) { this.colIndex = colIndex; }

    public int getWidth() { return width; }
    public void setWidth(int width) { this.width = width; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ColResizeOp that = (ColResizeOp) o;
        return colIndex == that.colIndex && width == that.width
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), colIndex, width);
    }
}
