package com.iceexcel.server.model;

/**
 * 字体斜体操作
 */
public class FontItalicOp extends CollabOperation {

    private int row;
    private int col;
    private boolean italic;

    public FontItalicOp() {
    }

    public FontItalicOp(String userId, long timestamp, int revision, int row, int col, boolean italic) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.italic = italic;
    }

    @Override
    public String getType() {
        return "fontItalic";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public boolean isItalic() { return italic; }
    public void setItalic(boolean italic) { this.italic = italic; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        FontItalicOp that = (FontItalicOp) o;
        return row == that.row && col == that.col && italic == that.italic
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, italic);
    }
}
