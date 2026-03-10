package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 单元格数据结构，与 TypeScript Cell 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Cell {

    private String content;
    private int rowSpan;
    private int colSpan;
    private boolean isMerged;
    private MergeParent mergeParent;
    private String fontColor;
    private String bgColor;
    private Integer fontSize;
    private Boolean fontBold;
    private Boolean fontItalic;
    private Boolean fontUnderline;
    private String fontAlign;

    public Cell() {
        this.content = "";
        this.rowSpan = 1;
        this.colSpan = 1;
        this.isMerged = false;
    }

    public Cell(String content, int rowSpan, int colSpan, boolean isMerged) {
        this.content = content;
        this.rowSpan = rowSpan;
        this.colSpan = colSpan;
        this.isMerged = isMerged;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public int getRowSpan() {
        return rowSpan;
    }

    public void setRowSpan(int rowSpan) {
        this.rowSpan = rowSpan;
    }

    public int getColSpan() {
        return colSpan;
    }

    public void setColSpan(int colSpan) {
        this.colSpan = colSpan;
    }

    // 使用 @JsonProperty 确保 JSON 字段名为 "isMerged"，与 TypeScript 一致
    @JsonProperty("isMerged")
    public boolean isMerged() {
        return isMerged;
    }

    @JsonProperty("isMerged")
    public void setMerged(boolean merged) {
        isMerged = merged;
    }

    public MergeParent getMergeParent() {
        return mergeParent;
    }

    public void setMergeParent(MergeParent mergeParent) {
        this.mergeParent = mergeParent;
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

    public Integer getFontSize() {
        return fontSize;
    }

    public void setFontSize(Integer fontSize) {
        this.fontSize = fontSize;
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

    public String getFontAlign() {
        return fontAlign;
    }

    public void setFontAlign(String fontAlign) {
        this.fontAlign = fontAlign;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Cell cell = (Cell) o;
        return rowSpan == cell.rowSpan
                && colSpan == cell.colSpan
                && isMerged == cell.isMerged
                && java.util.Objects.equals(content, cell.content)
                && java.util.Objects.equals(mergeParent, cell.mergeParent)
                && java.util.Objects.equals(fontColor, cell.fontColor)
                && java.util.Objects.equals(bgColor, cell.bgColor)
                && java.util.Objects.equals(fontSize, cell.fontSize)
                && java.util.Objects.equals(fontBold, cell.fontBold)
                && java.util.Objects.equals(fontItalic, cell.fontItalic)
                && java.util.Objects.equals(fontUnderline, cell.fontUnderline)
                && java.util.Objects.equals(fontAlign, cell.fontAlign);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(content, rowSpan, colSpan, isMerged, mergeParent,
                fontColor, bgColor, fontSize, fontBold, fontItalic, fontUnderline, fontAlign);
    }
}
