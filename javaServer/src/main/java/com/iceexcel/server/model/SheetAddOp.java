package com.iceexcel.server.model;

/**
 * 新增工作表操作
 */
public class SheetAddOp extends CollabOperation {

    private String sheetId;
    private String sheetName;
    private int insertIndex;

    public SheetAddOp() {}

    @Override
    public String getType() { return "sheetAdd"; }

    public String getSheetId() { return sheetId; }
    public void setSheetId(String sheetId) { this.sheetId = sheetId; }

    public String getSheetName() { return sheetName; }
    public void setSheetName(String sheetName) { this.sheetName = sheetName; }

    public int getInsertIndex() { return insertIndex; }
    public void setInsertIndex(int insertIndex) { this.insertIndex = insertIndex; }
}
