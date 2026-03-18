package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 单元格格式信息，与 TypeScript CellFormat 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CellFormat {

    private String category;
    private String pattern;
    private String currencySymbol;

    public CellFormat() {
    }

    public CellFormat(String category, String pattern, String currencySymbol) {
        this.category = category;
        this.pattern = pattern;
        this.currencySymbol = currencySymbol;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getPattern() {
        return pattern;
    }

    public void setPattern(String pattern) {
        this.pattern = pattern;
    }

    public String getCurrencySymbol() {
        return currencySymbol;
    }

    public void setCurrencySymbol(String currencySymbol) {
        this.currencySymbol = currencySymbol;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CellFormat that = (CellFormat) o;
        return java.util.Objects.equals(category, that.category)
                && java.util.Objects.equals(pattern, that.pattern)
                && java.util.Objects.equals(currencySymbol, that.currencySymbol);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(category, pattern, currencySymbol);
    }
}
