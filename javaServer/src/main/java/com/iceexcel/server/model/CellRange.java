package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 单元格范围，与 TypeScript range 对象对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CellRange {

    private int startRow;
    private int startCol;
    private int endRow;
    private int endCol;

    public CellRange() {
    }

    public CellRange(int startRow, int startCol, int endRow, int endCol) {
        this.startRow = startRow;
        this.startCol = startCol;
        this.endRow = endRow;
        this.endCol = endCol;
    }

    public int getStartRow() {
        return startRow;
    }

    public void setStartRow(int startRow) {
        this.startRow = startRow;
    }

    public int getStartCol() {
        return startCol;
    }

    public void setStartCol(int startCol) {
        this.startCol = startCol;
    }

    public int getEndRow() {
        return endRow;
    }

    public void setEndRow(int endRow) {
        this.endRow = endRow;
    }

    public int getEndCol() {
        return endCol;
    }

    public void setEndCol(int endCol) {
        this.endCol = endCol;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CellRange that = (CellRange) o;
        return startRow == that.startRow
                && startCol == that.startCol
                && endRow == that.endRow
                && endCol == that.endCol;
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(startRow, startCol, endRow, endCol);
    }
}
