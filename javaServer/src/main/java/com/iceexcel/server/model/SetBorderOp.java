package com.iceexcel.server.model;

/**
 * 设置单元格边框操作
 */
public class SetBorderOp extends CollabOperation {

    private int row;
    private int col;
    private CellBorder border;  // 可为 null，表示清除边框

    public SetBorderOp() {
    }

    public SetBorderOp(String userId, long timestamp, int revision, int row, int col, CellBorder border) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.border = border;
    }

    @Override
    public String getType() {
        return "setBorder";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public CellBorder getBorder() { return border; }
    public void setBorder(CellBorder border) { this.border = border; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SetBorderOp that = (SetBorderOp) o;
        return row == that.row && col == that.col
                && java.util.Objects.equals(border, that.border)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, border);
    }
}
