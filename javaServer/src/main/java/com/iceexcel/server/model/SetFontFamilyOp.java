package com.iceexcel.server.model;

/**
 * 设置单元格字体族操作
 */
public class SetFontFamilyOp extends CollabOperation {

    private int row;
    private int col;
    private String fontFamily;

    public SetFontFamilyOp() {
    }

    public SetFontFamilyOp(String userId, long timestamp, int revision, int row, int col, String fontFamily) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.fontFamily = fontFamily;
    }

    @Override
    public String getType() {
        return "setFontFamily";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public String getFontFamily() { return fontFamily; }
    public void setFontFamily(String fontFamily) { this.fontFamily = fontFamily; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SetFontFamilyOp that = (SetFontFamilyOp) o;
        return row == that.row && col == that.col
                && java.util.Objects.equals(fontFamily, that.fontFamily)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, fontFamily);
    }
}
