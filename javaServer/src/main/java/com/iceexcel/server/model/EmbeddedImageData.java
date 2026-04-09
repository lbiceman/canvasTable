package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Objects;

/**
 * 内嵌图片数据，与前端 EmbeddedImage 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmbeddedImageData {

    private String base64Data;
    private Integer originalWidth;
    private Integer originalHeight;
    private Integer displayWidth;
    private Integer displayHeight;

    public EmbeddedImageData() {
    }

    public EmbeddedImageData(String base64Data, Integer originalWidth, Integer originalHeight,
                             Integer displayWidth, Integer displayHeight) {
        this.base64Data = base64Data;
        this.originalWidth = originalWidth;
        this.originalHeight = originalHeight;
        this.displayWidth = displayWidth;
        this.displayHeight = displayHeight;
    }

    public String getBase64Data() {
        return base64Data;
    }

    public void setBase64Data(String base64Data) {
        this.base64Data = base64Data;
    }

    public Integer getOriginalWidth() {
        return originalWidth;
    }

    public void setOriginalWidth(Integer originalWidth) {
        this.originalWidth = originalWidth;
    }

    public Integer getOriginalHeight() {
        return originalHeight;
    }

    public void setOriginalHeight(Integer originalHeight) {
        this.originalHeight = originalHeight;
    }

    public Integer getDisplayWidth() {
        return displayWidth;
    }

    public void setDisplayWidth(Integer displayWidth) {
        this.displayWidth = displayWidth;
    }

    public Integer getDisplayHeight() {
        return displayHeight;
    }

    public void setDisplayHeight(Integer displayHeight) {
        this.displayHeight = displayHeight;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        EmbeddedImageData that = (EmbeddedImageData) o;
        return Objects.equals(base64Data, that.base64Data)
                && Objects.equals(originalWidth, that.originalWidth)
                && Objects.equals(originalHeight, that.originalHeight)
                && Objects.equals(displayWidth, that.displayWidth)
                && Objects.equals(displayHeight, that.displayHeight);
    }

    @Override
    public int hashCode() {
        return Objects.hash(base64Data, originalWidth, originalHeight, displayWidth, displayHeight);
    }

    @Override
    public String toString() {
        return "EmbeddedImageData{" +
                "base64Data='" + (base64Data != null ? base64Data.substring(0, Math.min(base64Data.length(), 20)) + "..." : "null") + '\'' +
                ", originalWidth=" + originalWidth +
                ", originalHeight=" + originalHeight +
                ", displayWidth=" + displayWidth +
                ", displayHeight=" + displayHeight +
                '}';
    }
}
