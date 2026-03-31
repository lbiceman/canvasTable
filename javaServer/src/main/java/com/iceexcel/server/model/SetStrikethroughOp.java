package com.iceexcel.server.model;

/**
 * 设置单元格删除线操作
 */
public class SetStrikethroughOp extends CollabOperation {

    private int row;
    private int col;
    private boolean strikethrough;

    public SetStrikethroughOp() {
    }

    public SetStrikethroughOp(String userId, long timestamp, int revision, int row, int col, boolean strikethrough) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.strikethrough = strikethrough;
    }

    @Override
    public String getType() {
        return "setStrikethrough";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public boolean isStrikethrough() { return strikethrough; }
    public void setStrikethrough(boolean strikethrough) { this.strikethrough = strikethrough; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SetStrikethroughOp that = (SetStrikethroughOp) o;
        return row == that.row && col == that.col
                && strikethrough == that.strikethrough
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, strikethrough);
    }
}
