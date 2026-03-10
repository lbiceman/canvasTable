package com.iceexcel.server.model;

/**
 * 合并单元格操作
 */
public class CellMergeOp extends CollabOperation {

    private int startRow;
    private int startCol;
    private int endRow;
    private int endCol;

    public CellMergeOp() {
    }

    public CellMergeOp(String userId, long timestamp, int revision,
                       int startRow, int startCol, int endRow, int endCol) {
        super(userId, timestamp, revision);
        this.startRow = startRow;
        this.startCol = startCol;
        this.endRow = endRow;
        this.endCol = endCol;
    }

    @Override
    public String getType() {
        return "cellMerge";
    }

    public int getStartRow() { return startRow; }
    public void setStartRow(int startRow) { this.startRow = startRow; }

    public int getStartCol() { return startCol; }
    public void setStartCol(int startCol) { this.startCol = startCol; }

    public int getEndRow() { return endRow; }
    public void setEndRow(int endRow) { this.endRow = endRow; }

    public int getEndCol() { return endCol; }
    public void setEndCol(int endCol) { this.endCol = endCol; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CellMergeOp that = (CellMergeOp) o;
        return startRow == that.startRow && startCol == that.startCol
                && endRow == that.endRow && endCol == that.endCol
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(),
                startRow, startCol, endRow, endCol);
    }
}
