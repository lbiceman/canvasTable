package com.iceexcel.server.model;

/**
 * 单元格编辑操作
 */
public class CellEditOp extends CollabOperation {

    private int row;
    private int col;
    private String content;
    private String previousContent;

    public CellEditOp() {
    }

    public CellEditOp(String userId, long timestamp, int revision,
                      int row, int col, String content, String previousContent) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.content = content;
        this.previousContent = previousContent;
    }

    @Override
    public String getType() {
        return "cellEdit";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getPreviousContent() { return previousContent; }
    public void setPreviousContent(String previousContent) { this.previousContent = previousContent; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CellEditOp that = (CellEditOp) o;
        return row == that.row && col == that.col
                && java.util.Objects.equals(content, that.content)
                && java.util.Objects.equals(previousContent, that.previousContent)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(),
                row, col, content, previousContent);
    }
}
