package com.iceexcel.server.model;

/**
 * 设置单元格文本换行操作
 */
public class SetWrapTextOp extends CollabOperation {

    private int row;
    private int col;
    private boolean wrapText;

    public SetWrapTextOp() {
    }

    public SetWrapTextOp(String userId, long timestamp, int revision, int row, int col, boolean wrapText) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.wrapText = wrapText;
    }

    @Override
    public String getType() {
        return "setWrapText";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public boolean isWrapText() { return wrapText; }
    public void setWrapText(boolean wrapText) { this.wrapText = wrapText; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SetWrapTextOp that = (SetWrapTextOp) o;
        return row == that.row && col == that.col && wrapText == that.wrapText
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, wrapText);
    }
}
