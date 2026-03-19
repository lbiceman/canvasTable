package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 图表位置，与 TypeScript Position 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChartPosition {

    private double x;
    private double y;

    public ChartPosition() {
    }

    public ChartPosition(double x, double y) {
        this.x = x;
        this.y = y;
    }

    public double getX() {
        return x;
    }

    public void setX(double x) {
        this.x = x;
    }

    public double getY() {
        return y;
    }

    public void setY(double y) {
        this.y = y;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ChartPosition that = (ChartPosition) o;
        return Double.compare(that.x, x) == 0
                && Double.compare(that.y, y) == 0;
    }

    @Override
    public int hashCode() {
        return Objects.hash(x, y);
    }

    @Override
    public String toString() {
        return "ChartPosition{" +
                "x=" + x +
                ", y=" + y +
                '}';
    }
}
