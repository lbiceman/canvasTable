package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 工作簿数据结构
 * 与 TypeScript WorkbookData 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WorkbookData {

    private String version;
    private String timestamp;
    private String activeSheetId;
    private List<SheetEntry> sheets;

    public WorkbookData() {
        this.version = "2.0";
        this.sheets = new ArrayList<>();
    }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public String getActiveSheetId() { return activeSheetId; }
    public void setActiveSheetId(String activeSheetId) { this.activeSheetId = activeSheetId; }

    public List<SheetEntry> getSheets() { return sheets; }
    public void setSheets(List<SheetEntry> sheets) { this.sheets = sheets; }

    /**
     * 按 sheetId 查找对应的 SheetEntry
     */
    public SheetEntry getSheetEntry(String sheetId) {
        if (sheets == null) return null;
        for (SheetEntry entry : sheets) {
            if (entry.getMeta() != null && sheetId.equals(entry.getMeta().getId())) {
                return entry;
            }
        }
        return null;
    }

    /**
     * 从旧版单工作表数据迁移为 WorkbookData
     */
    public static WorkbookData migrateFromLegacy(SpreadsheetData legacy) {
        WorkbookData workbook = new WorkbookData();
        workbook.setVersion("2.0");

        String sheetId = UUID.randomUUID().toString();
        workbook.setActiveSheetId(sheetId);

        SheetMeta meta = new SheetMeta(sheetId, "Sheet1", true, null, 0);
        SheetEntry entry = new SheetEntry();
        entry.setMeta(meta);
        // 旧版数据直接作为 data 存储
        entry.setData(legacy);

        List<SheetEntry> sheets = new ArrayList<>();
        sheets.add(entry);
        workbook.setSheets(sheets);

        return workbook;
    }
}
