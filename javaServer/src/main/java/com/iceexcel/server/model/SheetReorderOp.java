package com.iceexcel.server.model;

/**
 * 排序工作表操作
 */
public class SheetReorderOp extends CollabOperation {

    private String sheetId;
    private int oldIndex;
    private int newIndex;

    public SheetReorderOp() {}

    @Override
    public String getType() { return "sheetReorder"; }

    public String getSheetId() { return sheetId; }
    public void setSheetId(String sheetId) { this.sheetId = sheetId; }

    public int getOldIndex() { return oldIndex; }
    public void setOldIndex(int oldIndex) { this.oldIndex = oldIndex; }

    public int getNewIndex() { return newIndex; }
    public void setNewIndex(int newIndex) { this.newIndex = newIndex; }
}
