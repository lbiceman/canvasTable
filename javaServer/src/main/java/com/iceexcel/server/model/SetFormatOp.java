package com.iceexcel.server.model;

/**
 * 设置单元格格式操作
 */
public class SetFormatOp extends CollabOperation {

    private int row;
    private int col;
    private CellFormat format;

    public SetFormatOp() {
    }

    public SetFormatOp(String userId, long timestamp, int revision, int row, int col, CellFormat format) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.format = format;
    }

    @Override
    public String getType() {
        return "setFormat";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public CellFormat getFormat() { return format; }
    public void setFormat(CellFormat format) { this.format = format; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SetFormatOp that = (SetFormatOp) o;
        return row == that.row && col == that.col
                && java.util.Objects.equals(format, that.format)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, format);
    }
}
