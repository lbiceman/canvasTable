package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 超链接数据，与前端 HyperlinkData 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class HyperlinkData {

    private String url;
    private String displayText;

    public HyperlinkData() {
    }

    public HyperlinkData(String url, String displayText) {
        this.url = url;
        this.displayText = displayText;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getDisplayText() {
        return displayText;
    }

    public void setDisplayText(String displayText) {
        this.displayText = displayText;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        HyperlinkData that = (HyperlinkData) o;
        return Objects.equals(url, that.url)
                && Objects.equals(displayText, that.displayText);
    }

    @Override
    public int hashCode() {
        return Objects.hash(url, displayText);
    }

    @Override
    public String toString() {
        return "HyperlinkData{" +
                "url='" + url + '\'' +
                ", displayText='" + displayText + '\'' +
                '}';
    }
}
