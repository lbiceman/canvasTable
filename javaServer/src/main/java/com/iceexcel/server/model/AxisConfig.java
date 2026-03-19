package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 图表坐标轴配置，与 TypeScript AxisConfig 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AxisConfig {

    private String title;
    private boolean autoRange;
    private Double min;
    private Double max;
    private boolean showGridLines;

    public AxisConfig() {
    }

    public AxisConfig(String title, boolean autoRange, Double min, Double max, boolean showGridLines) {
        this.title = title;
        this.autoRange = autoRange;
        this.min = min;
        this.max = max;
        this.showGridLines = showGridLines;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public boolean isAutoRange() {
        return autoRange;
    }

    public void setAutoRange(boolean autoRange) {
        this.autoRange = autoRange;
    }

    public Double getMin() {
        return min;
    }

    public void setMin(Double min) {
        this.min = min;
    }

    public Double getMax() {
        return max;
    }

    public void setMax(Double max) {
        this.max = max;
    }

    public boolean isShowGridLines() {
        return showGridLines;
    }

    public void setShowGridLines(boolean showGridLines) {
        this.showGridLines = showGridLines;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        AxisConfig that = (AxisConfig) o;
        return autoRange == that.autoRange
                && showGridLines == that.showGridLines
                && Objects.equals(title, that.title)
                && Objects.equals(min, that.min)
                && Objects.equals(max, that.max);
    }

    @Override
    public int hashCode() {
        return Objects.hash(title, autoRange, min, max, showGridLines);
    }

    @Override
    public String toString() {
        return "AxisConfig{" +
                "title='" + title + '\'' +
                ", autoRange=" + autoRange +
                ", min=" + min +
                ", max=" + max +
                ", showGridLines=" + showGridLines +
                '}';
    }
}
