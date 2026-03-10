package com.iceexcel.server.model;

/**
 * 拆分单元格操作
 */
public class CellSplitOp extends CollabOperation {

    private int row;
    private int col;

    public CellSplitOp() {
    }

    public CellSplitOp(String userId, long timestamp, int revision, int row, int col) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
    }

    @Override
    public String getType() {
        return "cellSplit";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CellSplitOp that = (CellSplitOp) o;
        return row == that.row && col == that.col
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col);
    }
}
