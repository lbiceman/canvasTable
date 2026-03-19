package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

/**
 * 协同操作抽象基类，与 TypeScript BaseOperation 接口对应。
 * 使用 Jackson 多态序列化，以 "type" 字段区分子类型。
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.EXISTING_PROPERTY, property = "type")
@JsonSubTypes({
        @JsonSubTypes.Type(value = CellEditOp.class, name = "cellEdit"),
        @JsonSubTypes.Type(value = CellMergeOp.class, name = "cellMerge"),
        @JsonSubTypes.Type(value = CellSplitOp.class, name = "cellSplit"),
        @JsonSubTypes.Type(value = RowInsertOp.class, name = "rowInsert"),
        @JsonSubTypes.Type(value = RowDeleteOp.class, name = "rowDelete"),
        @JsonSubTypes.Type(value = RowResizeOp.class, name = "rowResize"),
        @JsonSubTypes.Type(value = ColResizeOp.class, name = "colResize"),
        @JsonSubTypes.Type(value = FontColorOp.class, name = "fontColor"),
        @JsonSubTypes.Type(value = BgColorOp.class, name = "bgColor"),
        @JsonSubTypes.Type(value = FontSizeOp.class, name = "fontSize"),
        @JsonSubTypes.Type(value = FontBoldOp.class, name = "fontBold"),
        @JsonSubTypes.Type(value = FontItalicOp.class, name = "fontItalic"),
        @JsonSubTypes.Type(value = FontUnderlineOp.class, name = "fontUnderline"),
        @JsonSubTypes.Type(value = FontAlignOp.class, name = "fontAlign"),
        @JsonSubTypes.Type(value = VerticalAlignOp.class, name = "verticalAlign"),
        @JsonSubTypes.Type(value = ColInsertOp.class, name = "colInsert"),
        @JsonSubTypes.Type(value = ColDeleteOp.class, name = "colDelete"),
        @JsonSubTypes.Type(value = SetFormatOp.class, name = "setFormat"),
        @JsonSubTypes.Type(value = SetWrapTextOp.class, name = "setWrapText"),
        @JsonSubTypes.Type(value = SetRichTextOp.class, name = "setRichText"),
        @JsonSubTypes.Type(value = SetValidationOp.class, name = "setValidation"),
        @JsonSubTypes.Type(value = ChartCreateOp.class, name = "chartCreate"),
        @JsonSubTypes.Type(value = ChartUpdateOp.class, name = "chartUpdate"),
        @JsonSubTypes.Type(value = ChartDeleteOp.class, name = "chartDelete"),
        @JsonSubTypes.Type(value = SetSparklineOp.class, name = "setSparkline"),
        @JsonSubTypes.Type(value = SheetAddOp.class, name = "sheetAdd"),
        @JsonSubTypes.Type(value = SheetDeleteOp.class, name = "sheetDelete"),
        @JsonSubTypes.Type(value = SheetRenameOp.class, name = "sheetRename"),
        @JsonSubTypes.Type(value = SheetReorderOp.class, name = "sheetReorder"),
        @JsonSubTypes.Type(value = SheetDuplicateOp.class, name = "sheetDuplicate"),
        @JsonSubTypes.Type(value = SheetVisibilityOp.class, name = "sheetVisibility"),
        @JsonSubTypes.Type(value = SheetTabColorOp.class, name = "sheetTabColor")
})
public abstract class CollabOperation {

    private String userId;
    private long timestamp;
    private int revision;
    /** 操作所属的工作表 ID（Sheet 级操作可为 null） */
    private String sheetId;

    public CollabOperation() {
    }

    public CollabOperation(String userId, long timestamp, int revision) {
        this.userId = userId;
        this.timestamp = timestamp;
        this.revision = revision;
    }

    /**
     * 返回操作类型名称（由子类实现）
     */
    public abstract String getType();

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    public int getRevision() {
        return revision;
    }

    public void setRevision(int revision) {
        this.revision = revision;
    }

    public String getSheetId() {
        return sheetId;
    }

    public void setSheetId(String sheetId) {
        this.sheetId = sheetId;
    }
}
