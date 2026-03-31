package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 单元格边框配置，包含四个方向的边框
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CellBorder {

    private BorderSide top;
    private BorderSide bottom;
    private BorderSide left;
    private BorderSide right;

    public CellBorder() {
    }

    public CellBorder(BorderSide top, BorderSide bottom, BorderSide left, BorderSide right) {
        this.top = top;
        this.bottom = bottom;
        this.left = left;
        this.right = right;
    }

    public BorderSide getTop() {
        return top;
    }

    public void setTop(BorderSide top) {
        this.top = top;
    }

    public BorderSide getBottom() {
        return bottom;
    }

    public void setBottom(BorderSide bottom) {
        this.bottom = bottom;
    }

    public BorderSide getLeft() {
        return left;
    }

    public void setLeft(BorderSide left) {
        this.left = left;
    }

    public BorderSide getRight() {
        return right;
    }

    public void setRight(BorderSide right) {
        this.right = right;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CellBorder that = (CellBorder) o;
        return Objects.equals(top, that.top)
                && Objects.equals(bottom, that.bottom)
                && Objects.equals(left, that.left)
                && Objects.equals(right, that.right);
    }

    @Override
    public int hashCode() {
        return Objects.hash(top, bottom, left, right);
    }

    @Override
    public String toString() {
        return "CellBorder{" +
                "top=" + top +
                ", bottom=" + bottom +
                ", left=" + left +
                ", right=" + right +
                '}';
    }
}
