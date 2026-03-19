package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 图表尺寸，与 TypeScript Size 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChartSize {

    private double width;
    private double height;

    public ChartSize() {
    }

    public ChartSize(double width, double height) {
        this.width = width;
        this.height = height;
    }

    public double getWidth() {
        return width;
    }

    public void setWidth(double width) {
        this.width = width;
    }

    public double getHeight() {
        return height;
    }

    public void setHeight(double height) {
        this.height = height;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ChartSize that = (ChartSize) o;
        return Double.compare(that.width, width) == 0
                && Double.compare(that.height, height) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(width, height);
    }

    @Override
    public String toString() {
        return "ChartSize{" +
                "width=" + width +
                ", height=" + height +
                '}';
    }
}
