package com.iceexcel.server.model;

/**
 * 设置单元格数据验证规则操作
 */
public class SetValidationOp extends CollabOperation {

    private int row;
    private int col;
    private ValidationRule validation;

    public SetValidationOp() {
    }

    public SetValidationOp(String userId, long timestamp, int revision, int row, int col, ValidationRule validation) {
        super(userId, timestamp, revision);
        this.row = row;
        this.col = col;
        this.validation = validation;
    }

    @Override
    public String getType() {
        return "setValidation";
    }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public ValidationRule getValidation() { return validation; }
    public void setValidation(ValidationRule validation) { this.validation = validation; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SetValidationOp that = (SetValidationOp) o;
        return row == that.row && col == that.col
                && java.util.Objects.equals(validation, that.validation)
                && java.util.Objects.equals(getUserId(), that.getUserId())
                && getTimestamp() == that.getTimestamp()
                && getRevision() == that.getRevision();
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(getType(), getUserId(), getTimestamp(), getRevision(), row, col, validation);
    }
}
