package com.iceexcel.server.model;

import java.util.Objects;

/**
 * 单边边框配置，包含线型、颜色和宽度
 */
public class BorderSide {

    private String style;  // 线型：solid, dashed, dotted, double
    private String color;  // 颜色：CSS 颜色值
    private int width;     // 宽度：像素值

    public BorderSide() {
    }

    public BorderSide(String style, String color, int width) {
        this.style = style;
        this.color = color;
        this.width = width;
    }

    public String getStyle() {
        return style;
    }

    public void setStyle(String style) {
        this.style = style;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public int getWidth() {
        return width;
    }

    public void setWidth(int width) {
        this.width = width;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        BorderSide that = (BorderSide) o;
        return width == that.width
                && Objects.equals(style, that.style)
                && Objects.equals(color, that.color);
    }

    @Override
    public int hashCode() {
        return Objects.hash(style, color, width);
    }

    @Override
    public String toString() {
        return "BorderSide{" +
                "style='" + style + '\'' +
                ", color='" + color + '\'' +
                ", width=" + width +
                '}';
    }
}
