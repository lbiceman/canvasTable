package com.iceexcel.server.model;

/**
 * 字体对齐操作
 */
public class FontAlignOp extends CollabOperation {

    private int row;
    private int col;
    private String align; // "left", "center", "right"

    public FontAlignOp() {
    }

    public FontAlignOp(String userId, long timestamp, int revision, int row, int col, String align) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.align = align;
    }

    @Override
    public String getType() {
        return "fontAlign";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public String getAlign() { return align; }
    public void setAlign(String align) { this.align = align; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        FontAlignOp that = (FontAlignOp) o;
        return row == that.row && col == that.col
                && java.util.Objects.equals(align, that.align)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, align);
    }
}
