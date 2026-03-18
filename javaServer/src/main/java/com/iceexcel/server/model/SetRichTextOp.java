package com.iceexcel.server.model;

import java.util.List;

/**
 * 设置单元格富文本操作
 */
public class SetRichTextOp extends CollabOperation {

    private int row;
    private int col;
    private List<RichTextSegment> richText;

    public SetRichTextOp() {
    }

    public SetRichTextOp(String userId, long timestamp, int revision, int row, int col, List<RichTextSegment> richText) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.richText = richText;
    }

    @Override
    public String getType() {
        return "setRichText";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public List<RichTextSegment> getRichText() { return richText; }
    public void setRichText(List<RichTextSegment> richText) { this.richText = richText; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SetRichTextOp that = (SetRichTextOp) o;
        return row == that.row && col == that.col
                && java.util.Objects.equals(richText, that.richText)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, richText);
    }
}
