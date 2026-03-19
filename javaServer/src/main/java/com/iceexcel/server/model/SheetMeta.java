package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 工作表元数据
 * 与 TypeScript SheetMeta 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SheetMeta {

    private String id;
    private String name;
    private boolean visible;
    private String tabColor;
    private int order;

    public SheetMeta() {
        this.visible = true;
    }

    public SheetMeta(String id, String name, boolean visible, String tabColor, int order) {
        this.id = id;
        this.name = name;
        this.visible = visible;
        this.tabColor = tabColor;
        this.order = order;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public boolean isVisible() { return visible; }
    public void setVisible(boolean visible) { this.visible = visible; }

    public String getTabColor() { return tabColor; }
    public void setTabColor(String tabColor) { this.tabColor = tabColor; }

    public int getOrder() { return order; }
    public void setOrder(int order) { this.order = order; }
}
