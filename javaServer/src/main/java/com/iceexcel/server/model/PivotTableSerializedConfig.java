package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Objects;

/**
 * 透视表序列化配置，与前端 PivotTableSerializedConfig 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PivotTableSerializedConfig {

    private CellRange sourceRange;
    private List<PivotField> rowFields;
    private List<PivotField> colFields;
    private List<PivotValueField> valueFields;
    private List<PivotFilterField> filterFields;
    private PivotSort sort;

    public PivotTableSerializedConfig() {
    }

    public CellRange getSourceRange() {
        return sourceRange;
    }

    public void setSourceRange(CellRange sourceRange) {
        this.sourceRange = sourceRange;
    }

    public List<PivotField> getRowFields() {
        return rowFields;
    }

    public void setRowFields(List<PivotField> rowFields) {
        this.rowFields = rowFields;
    }

    public List<PivotField> getColFields() {
        return colFields;
    }

    public void setColFields(List<PivotField> colFields) {
        this.colFields = colFields;
    }

    public List<PivotValueField> getValueFields() {
        return valueFields;
    }

    public void setValueFields(List<PivotValueField> valueFields) {
        this.valueFields = valueFields;
    }

    public List<PivotFilterField> getFilterFields() {
        return filterFields;
    }

    public void setFilterFields(List<PivotFilterField> filterFields) {
        this.filterFields = filterFields;
    }

    public PivotSort getSort() {
        return sort;
    }

    public void setSort(PivotSort sort) {
        this.sort = sort;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PivotTableSerializedConfig that = (PivotTableSerializedConfig) o;
        return Objects.equals(sourceRange, that.sourceRange)
                && Objects.equals(rowFields, that.rowFields)
                && Objects.equals(colFields, that.colFields)
                && Objects.equals(valueFields, that.valueFields)
                && Objects.equals(filterFields, that.filterFields)
                && Objects.equals(sort, that.sort);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sourceRange, rowFields, colFields, valueFields, filterFields, sort);
    }

    @Override
    public String toString() {
        return "PivotTableSerializedConfig{" +
                "sourceRange=" + sourceRange +
                ", rowFields=" + rowFields +
                ", colFields=" + colFields +
                ", valueFields=" + valueFields +
                ", filterFields=" + filterFields +
                ", sort=" + sort +
                '}';
    }
}
