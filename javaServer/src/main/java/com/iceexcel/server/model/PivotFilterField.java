package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Objects;

/**
 * 透视表筛选字段，与前端 PivotFilterField 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PivotFilterField {

    private int fieldIndex;
    private String fieldName;
    private List<String> selectedValues;

    public PivotFilterField() {
    }

    public PivotFilterField(int fieldIndex, String fieldName, List<String> selectedValues) {
        this.fieldIndex = fieldIndex;
        this.fieldName = fieldName;
        this.selectedValues = selectedValues;
    }

    public int getFieldIndex() {
        return fieldIndex;
    }

    public void setFieldIndex(int fieldIndex) {
        this.fieldIndex = fieldIndex;
    }

    public String getFieldName() {
        return fieldName;
    }

    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    public List<String> getSelectedValues() {
        return selectedValues;
    }

    public void setSelectedValues(List<String> selectedValues) {
        this.selectedValues = selectedValues;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PivotFilterField that = (PivotFilterField) o;
        return fieldIndex == that.fieldIndex
                && Objects.equals(fieldName, that.fieldName)
                && Objects.equals(selectedValues, that.selectedValues);
    }

    @Override
    public int hashCode() {
        return Objects.hash(fieldIndex, fieldName, selectedValues);
    }

    @Override
    public String toString() {
        return "PivotFilterField{" +
                "fieldIndex=" + fieldIndex +
                ", fieldName='" + fieldName + '\'' +
                ", selectedValues=" + selectedValues +
                '}';
    }
}
