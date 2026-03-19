package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 图表数据标签配置，与 TypeScript DataLabelConfig 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DataLabelConfig {

    private boolean visible;
    private String content;

    public DataLabelConfig() {
    }

    public DataLabelConfig(boolean visible, String content) {
        this.visible = visible;
        this.content = content;
    }

    public boolean isVisible() {
        return visible;
    }

    public void setVisible(boolean visible) {
        this.visible = visible;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        DataLabelConfig that = (DataLabelConfig) o;
        return visible == that.visible
                && Objects.equals(content, that.content);
    }

    @Override
    public int hashCode() {
        return Objects.hash(visible, content);
    }

    @Override
    public String toString() {
        return "DataLabelConfig{" +
                "visible=" + visible +
                ", content='" + content + '\'' +
                '}';
    }
}
