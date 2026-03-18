package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 富文本片段，与 TypeScript RichTextSegment 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RichTextSegment {

    private String text;
    private Boolean fontBold;
    private Boolean fontItalic;
    private Boolean fontUnderline;
    private String fontColor;
    private Integer fontSize;

    public RichTextSegment() {
    }

    public RichTextSegment(String text) {
        this.text = text;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public Boolean getFontBold() {
        return fontBold;
    }

    public void setFontBold(Boolean fontBold) {
        this.fontBold = fontBold;
    }

    public Boolean getFontItalic() {
        return fontItalic;
    }

    public void setFontItalic(Boolean fontItalic) {
        this.fontItalic = fontItalic;
    }

    public Boolean getFontUnderline() {
        return fontUnderline;
    }

    public void setFontUnderline(Boolean fontUnderline) {
        this.fontUnderline = fontUnderline;
    }

    public String getFontColor() {
        return fontColor;
    }

    public void setFontColor(String fontColor) {
        this.fontColor = fontColor;
    }

    public Integer getFontSize() {
        return fontSize;
    }

    public void setFontSize(Integer fontSize) {
        this.fontSize = fontSize;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RichTextSegment that = (RichTextSegment) o;
        return java.util.Objects.equals(text, that.text)
                && java.util.Objects.equals(fontBold, that.fontBold)
                && java.util.Objects.equals(fontItalic, that.fontItalic)
                && java.util.Objects.equals(fontUnderline, that.fontUnderline)
                && java.util.Objects.equals(fontColor, that.fontColor)
                && java.util.Objects.equals(fontSize, that.fontSize);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(text, fontBold, fontItalic, fontUnderline, fontColor, fontSize);
    }
}
