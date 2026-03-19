package com.iceexcel.server.model;

/**
 * 隐藏/显示工作表操作
 */
public class SheetVisibilityOp extends CollabOperation {

    private String sheetId;
    private boolean visible;

    public SheetVisibilityOp() {}

    @Override
    public String getType() { return "sheetVisibility"; }

    public String getSheetId() { return sheetId; }
    public void setSheetId(String sheetId) { this.sheetId = sheetId; }

    public boolean isVisible() { return visible; }
    public void setVisible(boolean visible) { this.visible = visible; }
}
