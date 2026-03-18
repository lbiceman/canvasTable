package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * 数据验证规则，与 TypeScript ValidationRule 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ValidationRule {

    private String type;
    private String mode;
    private List<String> options;
    private Double min;
    private Double max;
    private String customExpression;
    private String inputTitle;
    private String inputMessage;
    private String errorTitle;
    private String errorMessage;

    public ValidationRule() {
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public List<String> getOptions() {
        return options;
    }

    public void setOptions(List<String> options) {
        this.options = options;
    }

    public Double getMin() {
        return min;
    }

    public void setMin(Double min) {
        this.min = min;
    }

    public Double getMax() {
        return max;
    }

    public void setMax(Double max) {
        this.max = max;
    }

    public String getCustomExpression() {
        return customExpression;
    }

    public void setCustomExpression(String customExpression) {
        this.customExpression = customExpression;
    }

    public String getInputTitle() {
        return inputTitle;
    }

    public void setInputTitle(String inputTitle) {
        this.inputTitle = inputTitle;
    }

    public String getInputMessage() {
        return inputMessage;
    }

    public void setInputMessage(String inputMessage) {
        this.inputMessage = inputMessage;
    }

    public String getErrorTitle() {
        return errorTitle;
    }

    public void setErrorTitle(String errorTitle) {
        this.errorTitle = errorTitle;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ValidationRule that = (ValidationRule) o;
        return java.util.Objects.equals(type, that.type)
                && java.util.Objects.equals(mode, that.mode)
                && java.util.Objects.equals(options, that.options)
                && java.util.Objects.equals(min, that.min)
                && java.util.Objects.equals(max, that.max)
                && java.util.Objects.equals(customExpression, that.customExpression)
                && java.util.Objects.equals(inputTitle, that.inputTitle)
                && java.util.Objects.equals(inputMessage, that.inputMessage)
                && java.util.Objects.equals(errorTitle, that.errorTitle)
                && java.util.Objects.equals(errorMessage, that.errorMessage);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(type, mode, options, min, max, customExpression,
                inputTitle, inputMessage, errorTitle, errorMessage);
    }
}
