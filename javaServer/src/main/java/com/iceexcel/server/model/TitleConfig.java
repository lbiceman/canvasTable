package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 图表标题配置，与 TypeScript TitleConfig 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TitleConfig {

    private String text;
    private int fontSize;
    private String position;
    private boolean visible;

    public TitleConfig() {
    }

    public TitleConfig(String text, int fontSize, String position, boolean visible) {
        this.text = text;
        this.fontSize = fontSize;
        this.position = position;
        this.visible = visible;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public int getFontSize() {
        return fontSize;
    }

    public void setFontSize(int fontSize) {
        this.fontSize = fontSize;
    }

    public String getPosition() {
        return position;
    }

    public void setPosition(String position) {
        this.position = position;
    }

    public boolean isVisible() {
        return visible;
    }

    public void setVisible(boolean visible) {
        this.visible = visible;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TitleConfig that = (TitleConfig) o;
        return fontSize == that.fontSize
                && visible == that.visible
                && Objects.equals(text, that.text)
                && Objects.equals(position, that.position);
    }

    @Override
    public int hashCode() {
        return Objects.hash(text, fontSize, position, visible);
    }

    @Override
    public String toString() {
        return "TitleConfig{" +
                "text='" + text + '\'' +
                ", fontSize=" + fontSize +
                ", position='" + position + '\'' +
                ", visible=" + visible +
                '}';
    }
}
