package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/**
 * 条件格式规则，与 TypeScript ConditionalFormatRule 接口对应
 * condition 字段使用 Map<String, Object> 处理多种条件类型（greaterThan、lessThan、equals、between 等）
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ConditionalFormatRule {

    private String id;
    private CellRange range;
    private Integer priority;
    private Map<String, Object> condition;
    private ConditionalFormatStyle style;

    public ConditionalFormatRule() {
    }

    public ConditionalFormatRule(String id, CellRange range, Integer priority,
                                 Map<String, Object> condition, ConditionalFormatStyle style) {
        this.id = id;
        this.range = range;
        this.priority = priority;
        this.condition = condition;
        this.style = style;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public CellRange getRange() {
        return range;
    }

    public void setRange(CellRange range) {
        this.range = range;
    }

    public Integer getPriority() {
        return priority;
    }

    public void setPriority(Integer priority) {
        this.priority = priority;
    }

    public Map<String, Object> getCondition() {
        return condition;
    }

    public void setCondition(Map<String, Object> condition) {
        this.condition = condition;
    }

    public ConditionalFormatStyle getStyle() {
        return style;
    }

    public void setStyle(ConditionalFormatStyle style) {
        this.style = style;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ConditionalFormatRule that = (ConditionalFormatRule) o;
        return java.util.Objects.equals(id, that.id)
                && java.util.Objects.equals(range, that.range)
                && java.util.Objects.equals(priority, that.priority)
                && java.util.Objects.equals(condition, that.condition)
                && java.util.Objects.equals(style, that.style);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(id, range, priority, condition, style);
    }
}
