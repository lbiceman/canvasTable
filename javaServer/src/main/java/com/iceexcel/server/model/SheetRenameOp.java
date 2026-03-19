package com.iceexcel.server.model;

/**
 * 重命名工作表操作
 */
public class SheetRenameOp extends CollabOperation {

    private String sheetId;
    private String oldName;
    private String newName;

    public SheetRenameOp() {}

    @Override
    public String getType() { return "sheetRename"; }

    public String getSheetId() { return sheetId; }
    public void setSheetId(String sheetId) { this.sheetId = sheetId; }

    public String getOldName() { return oldName; }
    public void setOldName(String oldName) { this.oldName = oldName; }

    public String getNewName() { return newName; }
    public void setNewName(String newName) { this.newName = newName; }
}
