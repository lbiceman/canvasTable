package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 迷你图配置数据，与 TypeScript SparklineConfig 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SparklineConfigData {

    private String type;
    private DataRange dataRange;
    private String color;
    private Boolean highlightMax;
    private Boolean highlightMin;

    public SparklineConfigData() {
    }

    public SparklineConfigData(String type, DataRange dataRange, String color,
                               Boolean highlightMax, Boolean highlightMin) {
        this.type = type;
        this.dataRange = dataRange;
        this.color = color;
        this.highlightMax = highlightMax;
        this.highlightMin = highlightMin;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public DataRange getDataRange() {
        return dataRange;
    }

    public void setDataRange(DataRange dataRange) {
        this.dataRange = dataRange;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public Boolean getHighlightMax() {
        return highlightMax;
    }

    public void setHighlightMax(Boolean highlightMax) {
        this.highlightMax = highlightMax;
    }

    public Boolean getHighlightMin() {
        return highlightMin;
    }

    public void setHighlightMin(Boolean highlightMin) {
        this.highlightMin = highlightMin;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SparklineConfigData that = (SparklineConfigData) o;
        return Objects.equals(type, that.type)
                && Objects.equals(dataRange, that.dataRange)
                && Objects.equals(color, that.color)
                && Objects.equals(highlightMax, that.highlightMax)
                && Objects.equals(highlightMin, that.highlightMin);
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, dataRange, color, highlightMax, highlightMin);
    }

    @Override
    public String toString() {
        return "SparklineConfigData{" +
                "type='" + type + '\'' +
                ", dataRange=" + dataRange +
                ", color='" + color + '\'' +
                ", highlightMax=" + highlightMax +
                ", highlightMin=" + highlightMin +
                '}';
    }
}
