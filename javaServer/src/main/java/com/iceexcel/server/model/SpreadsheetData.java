package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;

/**
 * 表格数据结构，与 TypeScript SpreadsheetData 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SpreadsheetData {

    private List<List<Cell>> cells;
    private List<Integer> rowHeights;
    private List<Integer> colWidths;

    public SpreadsheetData() {
        this.cells = new ArrayList<>();
        this.rowHeights = new ArrayList<>();
        this.colWidths = new ArrayList<>();
    }

    public SpreadsheetData(List<List<Cell>> cells, List<Integer> rowHeights, List<Integer> colWidths) {
        this.cells = cells;
        this.rowHeights = rowHeights;
        this.colWidths = colWidths;
    }

    public List<List<Cell>> getCells() {
        return cells;
    }

    public void setCells(List<List<Cell>> cells) {
        this.cells = cells;
    }

    public List<Integer> getRowHeights() {
        return rowHeights;
    }

    public void setRowHeights(List<Integer> rowHeights) {
        this.rowHeights = rowHeights;
    }

    public List<Integer> getColWidths() {
        return colWidths;
    }

    public void setColWidths(List<Integer> colWidths) {
        this.colWidths = colWidths;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SpreadsheetData that = (SpreadsheetData) o;
        return java.util.Objects.equals(cells, that.cells)
                && java.util.Objects.equals(rowHeights, that.rowHeights)
                && java.util.Objects.equals(colWidths, that.colWidths);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(cells, rowHeights, colWidths);
    }
}
