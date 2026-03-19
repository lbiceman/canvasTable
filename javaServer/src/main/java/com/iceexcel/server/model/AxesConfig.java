package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 图表坐标轴组合配置，与 TypeScript AxesConfig 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AxesConfig {

    private AxisConfig xAxis;
    private AxisConfig yAxis;

    public AxesConfig() {
    }

    public AxesConfig(AxisConfig xAxis, AxisConfig yAxis) {
        this.xAxis = xAxis;
        this.yAxis = yAxis;
    }

    public AxisConfig getXAxis() {
        return xAxis;
    }

    public void setXAxis(AxisConfig xAxis) {
        this.xAxis = xAxis;
    }

    public AxisConfig getYAxis() {
        return yAxis;
    }

    public void setYAxis(AxisConfig yAxis) {
        this.yAxis = yAxis;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        AxesConfig that = (AxesConfig) o;
        return Objects.equals(xAxis, that.xAxis)
                && Objects.equals(yAxis, that.yAxis);
    }

    @Override
    public int hashCode() {
        return Objects.hash(xAxis, yAxis);
    }

    @Override
    public String toString() {
        return "AxesConfig{" +
                "xAxis=" + xAxis +
                ", yAxis=" + yAxis +
                '}';
    }
}
