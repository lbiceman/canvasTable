package com.iceexcel.server.model;

/**
 * 字体加粗操作
 */
public class FontBoldOp extends CollabOperation {

    private int row;
    private int col;
    private boolean bold;

    public FontBoldOp() {
    }

    public FontBoldOp(String userId, long timestamp, int revision, int row, int col, boolean bold) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.bold = bold;
    }

    @Override
    public String getType() {
        return "fontBold";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public boolean isBold() { return bold; }
    public void setBold(boolean bold) { this.bold = bold; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        FontBoldOp that = (FontBoldOp) o;
        return row == that.row && col == that.col && bold == that.bold
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, bold);
    }
}
