package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 选择区域，与 TypeScript Selection 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Selection {

    private int startRow;
    private int startCol;
    private int endRow;
    private int endCol;

    public Selection() {
    }

    public Selection(int startRow, int startCol, int endRow, int endCol) {
        this.startRow = startRow;
        this.startCol = startCol;
        this.endRow = endRow;
        this.endCol = endCol;
    }

    public int getStartRow() { return startRow; }
    public void setStartRow(int startRow) { this.startRow = startRow; }

    public int getStartCol() { return startCol; }
    public void setStartCol(int startCol) { this.startCol = startCol; }

    public int getEndRow() { return endRow; }
    public void setEndRow(int endRow) { this.endRow = endRow; }

    public int getEndCol() { return endCol; }
    public void setEndCol(int endCol) { this.endCol = endCol; }
}
