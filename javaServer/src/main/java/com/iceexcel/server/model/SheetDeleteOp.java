package com.iceexcel.server.model;

/**
 * 删除工作表操作
 */
public class SheetDeleteOp extends CollabOperation {

    private String sheetId;

    public SheetDeleteOp() {}

    @Override
    public String getType() { return "sheetDelete"; }

    public String getSheetId() { return sheetId; }
    public void setSheetId(String sheetId) { this.sheetId = sheetId; }
}
