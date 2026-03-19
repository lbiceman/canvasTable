package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 工作表条目，包含元数据和数据
 * 与 TypeScript WorkbookSheetEntry 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SheetEntry {

    private SheetMeta meta;
    private Object data;      // 工作表数据（SpreadsheetData 的 data 部分）
    private Object metadata;  // 工作表元数据（SpreadsheetData 的 metadata 部分）

    public SheetEntry() {
    }

    public SheetEntry(SheetMeta meta, Object data, Object metadata) {
        this.meta = meta;
        this.data = data;
        this.metadata = metadata;
    }

    public SheetMeta getMeta() { return meta; }
    public void setMeta(SheetMeta meta) { this.meta = meta; }

    public Object getData() { return data; }
    public void setData(Object data) { this.data = data; }

    public Object getMetadata() { return metadata; }
    public void setMetadata(Object metadata) { this.metadata = metadata; }
}
