package com.iceexcel.server.model;

/**
 * 字体大小操作
 */
public class FontSizeOp extends CollabOperation {

    private int row;
    private int col;
    private int size;

    public FontSizeOp() {
    }

    public FontSizeOp(String userId, long timestamp, int revision, int row, int col, int size) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.size = size;
    }

    @Override
    public String getType() {
        return "fontSize";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        FontSizeOp that = (FontSizeOp) o;
        return row == that.row && col == that.col && size == that.size
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, size);
    }
}
