package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 图表完整配置数据，与 TypeScript ChartConfig 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChartConfigData {

    private String id;
    private String type;
    private DataRange dataRange;
    private ChartPosition position;
    private ChartSize size;
    private TitleConfig title;
    private LegendConfig legend;
    private AxesConfig axes;
    private DataLabelConfig dataLabels;

    public ChartConfigData() {
    }

    public ChartConfigData(String id, String type, DataRange dataRange, ChartPosition position,
                           ChartSize size, TitleConfig title, LegendConfig legend,
                           AxesConfig axes, DataLabelConfig dataLabels) {
        this.id = id;
        this.type = type;
        this.dataRange = dataRange;
        this.position = position;
        this.size = size;
        this.title = title;
        this.legend = legend;
        this.axes = axes;
        this.dataLabels = dataLabels;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    public ChartPosition getPosition() {
        return position;
    }

    public void setPosition(ChartPosition position) {
        this.position = position;
    }

    public ChartSize getSize() {
        return size;
    }

    public void setSize(ChartSize size) {
        this.size = size;
    }

    public TitleConfig getTitle() {
        return title;
    }

    public void setTitle(TitleConfig title) {
        this.title = title;
    }

    public LegendConfig getLegend() {
        return legend;
    }

    public void setLegend(LegendConfig legend) {
        this.legend = legend;
    }

    public AxesConfig getAxes() {
        return axes;
    }

    public void setAxes(AxesConfig axes) {
        this.axes = axes;
    }

    public DataLabelConfig getDataLabels() {
        return dataLabels;
    }

    public void setDataLabels(DataLabelConfig dataLabels) {
        this.dataLabels = dataLabels;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ChartConfigData that = (ChartConfigData) o;
        return Objects.equals(id, that.id)
                && Objects.equals(type, that.type)
                && Objects.equals(dataRange, that.dataRange)
                && Objects.equals(position, that.position)
                && Objects.equals(size, that.size)
                && Objects.equals(title, that.title)
                && Objects.equals(legend, that.legend)
                && Objects.equals(axes, that.axes)
                && Objects.equals(dataLabels, that.dataLabels);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, type, dataRange, position, size, title, legend, axes, dataLabels);
    }

    @Override
    public String toString() {
        return "ChartConfigData{" +
                "id='" + id + '\'' +
                ", type='" + type + '\'' +
                ", dataRange=" + dataRange +
                ", position=" + position +
                ", size=" + size +
                ", title=" + title +
                ", legend=" + legend +
                ", axes=" + axes +
                ", dataLabels=" + dataLabels +
                '}';
    }
}
