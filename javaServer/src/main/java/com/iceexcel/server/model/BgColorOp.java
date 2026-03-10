package com.iceexcel.server.model;

/**
 * 背景颜色操作
 */
public class BgColorOp extends CollabOperation {

    private int row;
    private int col;
    private String color;

    public BgColorOp() {
    }

    public BgColorOp(String userId, long timestamp, int revision, int row, int col, String color) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.color = color;
    }

    @Override
    public String getType() {
        return "bgColor";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        BgColorOp that = (BgColorOp) o;
        return row == that.row && col == that.col
                && java.util.Objects.equals(color, that.color)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, color);
    }
}
