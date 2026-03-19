package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 图表图例配置，与 TypeScript LegendConfig 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LegendConfig {

    private boolean visible;
    private String position;

    public LegendConfig() {
    }

    public LegendConfig(boolean visible, String position) {
        this.visible = visible;
        this.position = position;
    }

    public boolean isVisible() {
        return visible;
    }

    public void setVisible(boolean visible) {
        this.visible = visible;
    }

    public String getPosition() {
        return position;
    }

    public void setPosition(String position) {
        this.position = position;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        LegendConfig that = (LegendConfig) o;
        return visible == that.visible
                && Objects.equals(position, that.position);
    }

    @Override
    public int hashCode() {
        return Objects.hash(visible, position);
    }

    @Override
    public String toString() {
        return "LegendConfig{" +
                "visible=" + visible +
                ", position='" + position + '\'' +
                '}';
    }
}
