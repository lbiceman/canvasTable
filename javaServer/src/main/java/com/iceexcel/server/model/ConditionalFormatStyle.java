package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 条件格式样式，与 TypeScript ConditionalFormatStyle 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ConditionalFormatStyle {

    private String fontColor;
    private String bgColor;

    public ConditionalFormatStyle() {
    }

    public ConditionalFormatStyle(String fontColor, String bgColor) {
        this.fontColor = fontColor;
        this.bgColor = bgColor;
    }

    public String getFontColor() {
        return fontColor;
    }

    public void setFontColor(String fontColor) {
        this.fontColor = fontColor;
    }

    public String getBgColor() {
        return bgColor;
    }

    public void setBgColor(String bgColor) {
        this.bgColor = bgColor;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ConditionalFormatStyle that = (ConditionalFormatStyle) o;
        return java.util.Objects.equals(fontColor, that.fontColor)
                && java.util.Objects.equals(bgColor, that.bgColor);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(fontColor, bgColor);
    }
}
