package com.iceexcel.server.model;

/**
 * 字体下划线操作
 */
public class FontUnderlineOp extends CollabOperation {

    private int row;
    private int col;
    private boolean underline;

    public FontUnderlineOp() {
    }

    public FontUnderlineOp(String userId, long timestamp, int revision, int row, int col, boolean underline) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.underline = underline;
    }

    @Override
    public String getType() {
        return "fontUnderline";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public boolean isUnderline() { return underline; }
    public void setUnderline(boolean underline) { this.underline = underline; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        FontUnderlineOp that = (FontUnderlineOp) o;
        return row == that.row && col == that.col && underline == that.underline
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, underline);
    }
}
