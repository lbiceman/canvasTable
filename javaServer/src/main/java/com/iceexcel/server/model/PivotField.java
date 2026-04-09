package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 透视表字段，与前端 PivotField 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PivotField {

    private int fieldIndex;
    private String fieldName;

    public PivotField() {
    }

    public PivotField(int fieldIndex, String fieldName) {
        this.fieldIndex = fieldIndex;
        this.fieldName = fieldName;
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PivotField that = (PivotField) o;
        return fieldIndex == that.fieldIndex
                && Objects.equals(fieldName, that.fieldName);
    }

    @Override
    public int hashCode() {
        return Objects.hash(fieldIndex, fieldName);
    }

    @Override
    public String toString() {
        return "PivotField{" +
                "fieldIndex=" + fieldIndex +
                ", fieldName='" + fieldName + '\'' +
                '}';
    }
}
