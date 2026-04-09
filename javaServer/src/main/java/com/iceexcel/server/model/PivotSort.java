package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 透视表排序配置，与前端 PivotSort 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PivotSort {

    private String by;         // "label" | "value"
    private int fieldIndex;
    private String direction;  // "asc" | "desc"

    public PivotSort() {
    }

    public PivotSort(String by, int fieldIndex, String direction) {
        this.by = by;
        this.fieldIndex = fieldIndex;
        this.direction = direction;
    }

    public String getBy() {
        return by;
    }

    public void setBy(String by) {
        this.by = by;
    }

    public int getFieldIndex() {
        return fieldIndex;
    }

    public void setFieldIndex(int fieldIndex) {
        this.fieldIndex = fieldIndex;
    }

    public String getDirection() {
        return direction;
    }

    public void setDirection(String direction) {
        this.direction = direction;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PivotSort that = (PivotSort) o;
        return fieldIndex == that.fieldIndex
                && Objects.equals(by, that.by)
                && Objects.equals(direction, that.direction);
    }

    @Override
    public int hashCode() {
        return Objects.hash(by, fieldIndex, direction);
    }

    @Override
    public String toString() {
        return "PivotSort{" +
                "by='" + by + '\'' +
                ", fieldIndex=" + fieldIndex +
                ", direction='" + direction + '\'' +
                '}';
    }
}
