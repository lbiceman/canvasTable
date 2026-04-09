package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 透视表值字段，与前端 PivotValueField 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PivotValueField {

    private int fieldIndex;
    private String fieldName;
    private String aggregateFunc;

    public PivotValueField() {
    }

    public PivotValueField(int fieldIndex, String fieldName, String aggregateFunc) {
        this.fieldIndex = fieldIndex;
        this.fieldName = fieldName;
        this.aggregateFunc = aggregateFunc;
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

    public String getAggregateFunc() {
        return aggregateFunc;
    }

    public void setAggregateFunc(String aggregateFunc) {
        this.aggregateFunc = aggregateFunc;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PivotValueField that = (PivotValueField) o;
        return fieldIndex == that.fieldIndex
                && Objects.equals(fieldName, that.fieldName)
                && Objects.equals(aggregateFunc, that.aggregateFunc);
    }

    @Override
    public int hashCode() {
        return Objects.hash(fieldIndex, fieldName, aggregateFunc);
    }

    @Override
    public String toString() {
        return "PivotValueField{" +
                "fieldIndex=" + fieldIndex +
                ", fieldName='" + fieldName + '\'' +
                ", aggregateFunc='" + aggregateFunc + '\'' +
                '}';
    }
}
