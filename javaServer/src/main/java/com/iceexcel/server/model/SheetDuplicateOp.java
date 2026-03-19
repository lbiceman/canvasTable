package com.iceexcel.server.model;

/**
 * 复制工作表操作
 */
public class SheetDuplicateOp extends CollabOperation {

    private String sourceSheetId;
    private String newSheetId;
    private String newSheetName;

    public SheetDuplicateOp() {}

    @Override
    public String getType() { return "sheetDuplicate"; }

    public String getSourceSheetId() { return sourceSheetId; }
    public void setSourceSheetId(String sourceSheetId) { this.sourceSheetId = sourceSheetId; }

    public String getNewSheetId() { return newSheetId; }
    public void setNewSheetId(String newSheetId) { this.newSheetId = newSheetId; }

    public String getNewSheetName() { return newSheetName; }
    public void setNewSheetName(String newSheetName) { this.newSheetName = newSheetName; }
}
