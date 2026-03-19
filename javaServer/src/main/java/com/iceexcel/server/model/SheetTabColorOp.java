package com.iceexcel.server.model;

/**
 * 设置标签颜色操作
 */
public class SheetTabColorOp extends CollabOperation {

    private String sheetId;
    private String tabColor;

    public SheetTabColorOp() {}

    @Override
    public String getType() { return "sheetTabColor"; }

    public String getSheetId() { return sheetId; }
    public void setSheetId(String sheetId) { this.sheetId = sheetId; }

    public String getTabColor() { return tabColor; }
    public void setTabColor(String tabColor) { this.tabColor = tabColor; }
}
