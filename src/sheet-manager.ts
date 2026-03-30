// ============================================================
// SheetManager - 多工作表管理器
// 负责工作表的创建、删除、切换、排序、隐藏/显示等核心功能
// ============================================================

import { SpreadsheetModel } from './model';
import { HistoryManager } from './history-manager';
import { FormulaEngine } from './formula-engine';
import type { SheetMeta, ViewportState, RenameResult, Cell, WorkbookData, WorkbookSheetEntry } from './types';
import type { SheetPrintMetadata } from './print-export/print-metadata';
import { savePrintConfigToMetadata, loadPrintConfigFromMetadata } from './print-export/print-metadata';

/** 协同操作提交回调（由 SpreadsheetApp 注入） */
export type SheetCollabCallback = (op: Record<string, unknown>) => void;

/** 单个工作表的完整运行时数据（包含类实例，不放入 types.ts） */
interface SheetData {
  meta: SheetMeta;
  model: SpreadsheetModel;
  historyManager: HistoryManager;
  viewportState: ViewportState;
}

export class SheetManager {
  /** 有序工作表元数据列表 */
  private sheets: SheetMeta[] = [];
  /** 工作表 ID -> 完整运行时数据 */
  private sheetDataMap: Map<string, SheetData> = new Map();
  /** 当前活动工作表 ID */
  private activeSheetId: string = '';
  /** 每个工作表的打印配置（sheetId -> 打印元数据） */
  private printMetadataMap: Map<string, SheetPrintMetadata> = new Map();
  /** 协同操作提交回调 */
  private collabCallback: SheetCollabCallback | null = null;
  /** 工作表切换后回调（通知 App 更新 renderer 等） */
  private onSwitchCallback: ((sheetId: string) => void) | null = null;

  constructor() {
    // 创建默认 "Sheet1" 工作表
    const defaultSheet = this.createSheetData('Sheet1', 0);
    this.sheets.push(defaultSheet.meta);
    this.sheetDataMap.set(defaultSheet.meta.id, defaultSheet);
    this.activeSheetId = defaultSheet.meta.id;

    // 将跨 Sheet 单元格获取器注入到 FormulaEngine
    const formulaEngine = FormulaEngine.getInstance();
    formulaEngine.setSheetCellGetter((sheetName: string, row: number, col: number) => {
      return this.getCellFromSheet(sheetName, row, col);
    });
  }

  /**
   * 设置协同操作提交回调
   * 由 SpreadsheetApp 在协同模式下注入
   */
  public setCollabCallback(callback: SheetCollabCallback | null): void {
    this.collabCallback = callback;
  }

  /** 设置工作表切换回调 */
  public setOnSwitchCallback(callback: ((sheetId: string) => void) | null): void {
    this.onSwitchCallback = callback;
  }

  // ============================================================
  // 工作表 CRUD 操作
  // ============================================================

  /**
   * 新增工作表
   * @param afterSheetId 在指定工作表之后插入，默认在当前活动工作表之后
   * @returns 新创建的工作表元数据
   */
  public addSheet(afterSheetId?: string): SheetMeta {
    const name = this.generateSheetName();
    const targetId = afterSheetId ?? this.activeSheetId;
    const targetIndex = this.sheets.findIndex((s) => s.id === targetId);
    const insertIndex = targetIndex >= 0 ? targetIndex + 1 : this.sheets.length;

    const newSheet = this.createSheetData(name, insertIndex);

    // 插入到目标位置
    this.sheets.splice(insertIndex, 0, newSheet.meta);
    this.sheetDataMap.set(newSheet.meta.id, newSheet);

    // 更新所有工作表的 order
    this.recalculateOrder();

    // 自动切换到新工作表
    this.switchSheet(newSheet.meta.id);

    // 协同模式下提交操作
    if (this.collabCallback) {
      this.collabCallback({
        type: 'sheetAdd',
        sheetId: newSheet.meta.id,
        sheetName: name,
        insertIndex,
      });
    }

    return newSheet.meta;
  }

  /**
   * 远程新增工作表（不自动切换活动工作表）
   * 由协同引擎在接收远程 sheetAdd 操作时调用
   */
  public addSheetFromRemote(sheetId: string, sheetName: string, insertIndex: number): void {
    const newSheet = this.createSheetData(sheetName, insertIndex);
    // 使用远程指定的 ID
    newSheet.meta.id = sheetId;

    const clampedIndex = Math.max(0, Math.min(insertIndex, this.sheets.length));
    this.sheets.splice(clampedIndex, 0, newSheet.meta);
    this.sheetDataMap.set(sheetId, newSheet);
    this.recalculateOrder();
  }

  /**
   * 远程删除工作表（不自动切换活动工作表，除非删除的是当前活动工作表）
   * 由协同引擎在接收远程 sheetDelete 操作时调用
   */
  public deleteSheetFromRemote(sheetId: string): boolean {
    if (this.sheets.length <= 1) {
      return false;
    }

    const index = this.sheets.findIndex((s) => s.id === sheetId);
    if (index === -1) {
      return false;
    }

    const deletedName = this.sheets[index].name;

    // 如果删除的是当前活动工作表，需要切换
    if (sheetId === this.activeSheetId) {
      const visibleSheets = this.sheets.filter((s) => s.visible && s.id !== sheetId);
      if (visibleSheets.length > 0) {
        const leftVisible = this.sheets.slice(0, index).filter((s) => s.visible && s.id !== sheetId);
        const rightVisible = this.sheets.slice(index + 1).filter((s) => s.visible);
        if (leftVisible.length > 0) {
          this.switchSheet(leftVisible[leftVisible.length - 1].id);
        } else if (rightVisible.length > 0) {
          this.switchSheet(rightVisible[0].id);
        }
      }
    }

    this.sheets.splice(index, 1);
    this.sheetDataMap.delete(sheetId);
    this.recalculateOrder();
    this.updateFormulasOnSheetDelete(deletedName);
    return true;
  }

  /**
   * 远程复制工作表（不自动切换活动工作表）
   * 由协同引擎在接收远程 sheetDuplicate 操作时调用
   */
  public duplicateSheetFromRemote(sourceSheetId: string, newSheetId: string, newSheetName: string): SheetMeta | undefined {
    const sourceData = this.sheetDataMap.get(sourceSheetId);
    if (!sourceData) {
      return undefined;
    }

    const sourceIndex = this.sheets.findIndex((s) => s.id === sourceSheetId);
    const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : this.sheets.length;

    const newSheet = this.createSheetData(newSheetName, insertIndex);
    newSheet.meta.id = newSheetId;

    // 深拷贝源工作表数据
    const sourceJson = sourceData.model.exportToJSON();
    newSheet.model.importFromJSON(sourceJson);

    this.sheets.splice(insertIndex, 0, newSheet.meta);
    this.sheetDataMap.set(newSheetId, newSheet);
    this.recalculateOrder();

    return newSheet.meta;
  }

  /**
   * 删除工作表
   * 仅剩一个工作表时拒绝删除；删除活动工作表时自动切换到相邻工作表
   * @param sheetId 要删除的工作表 ID
   * @returns 是否成功删除
   */
  public deleteSheet(sheetId: string): boolean {
    // 仅剩一个工作表时拒绝删除
    if (this.sheets.length <= 1) {
      return false;
    }

    const index = this.sheets.findIndex((s) => s.id === sheetId);
    if (index === -1) {
      return false;
    }

    // 如果删除的是活动工作表，先切换到相邻工作表
    if (sheetId === this.activeSheetId) {
      const visibleSheets = this.sheets.filter((s) => s.visible && s.id !== sheetId);
      if (visibleSheets.length > 0) {
        // 优先切换到左侧可见工作表
        const leftVisible = this.sheets
          .slice(0, index)
          .filter((s) => s.visible && s.id !== sheetId);
        const rightVisible = this.sheets
          .slice(index + 1)
          .filter((s) => s.visible);

        if (leftVisible.length > 0) {
          this.switchSheet(leftVisible[leftVisible.length - 1].id);
        } else if (rightVisible.length > 0) {
          this.switchSheet(rightVisible[0].id);
        }
      }
    }

    // 删除前：更新所有引用该工作表的公式为 #REF!
    const deletedName = this.sheets[index].name;

    // 从列表和映射中移除
    this.sheets.splice(index, 1);
    this.sheetDataMap.delete(sheetId);

    // 更新 order
    this.recalculateOrder();

    // 更新引用被删除工作表的公式
    this.updateFormulasOnSheetDelete(deletedName);

    // 协同模式下提交操作
    if (this.collabCallback) {
      this.collabCallback({
        type: 'sheetDelete',
        sheetId,
      });
    }

    return true;
  }

  /**
   * 重命名工作表
   * 验证名称非空且不重复
   * @param sheetId 工作表 ID
   * @param newName 新名称
   * @returns 重命名结果
   */
  public renameSheet(sheetId: string, newName: string): RenameResult {
    const trimmedName = newName.trim();

    // 验证非空
    if (trimmedName.length === 0) {
      return { success: false, error: 'empty', message: '工作表名称不能为空' };
    }

    const sheetData = this.sheetDataMap.get(sheetId);
    if (!sheetData) {
      return { success: false, error: 'invalid', message: '工作表不存在' };
    }

    // 验证不重复（排除自身）
    const duplicate = this.sheets.find(
      (s) => s.id !== sheetId && s.name === trimmedName
    );
    if (duplicate) {
      return { success: false, error: 'duplicate', message: '工作表名称已存在' };
    }

    // 保存旧名称用于更新公式
    const oldName = sheetData.meta.name;

    // 应用新名称
    sheetData.meta.name = trimmedName;
    // 同步更新 sheets 列表中的引用
    const sheetMeta = this.sheets.find((s) => s.id === sheetId);
    if (sheetMeta) {
      sheetMeta.name = trimmedName;
    }

    // 更新所有引用该工作表的公式中的名称
    if (oldName !== trimmedName) {
      this.updateFormulasOnSheetRename(oldName, trimmedName);

      // 协同模式下提交操作
      if (this.collabCallback) {
        this.collabCallback({
          type: 'sheetRename',
          sheetId,
          oldName,
          newName: trimmedName,
        });
      }
    }

    return { success: true };
  }

  /**
   * 切换活动工作表
   * 保存当前视口/选区状态，切换到目标工作表，恢复其状态
   * @param sheetId 目标工作表 ID
   */
  public switchSheet(sheetId: string): void {
    if (sheetId === this.activeSheetId) {
      return;
    }

    const targetData = this.sheetDataMap.get(sheetId);
    if (!targetData) {
      return;
    }

    // 目标工作表不可见时不切换
    if (!targetData.meta.visible) {
      return;
    }

    // 切换活动工作表 ID
    this.activeSheetId = sheetId;

    // 通知外部（App）更新 renderer 等
    if (this.onSwitchCallback) {
      this.onSwitchCallback(sheetId);
    }
  }

  /**
   * 保存当前活动工作表的视口状态
   * @param state 视口状态快照
   */
  public saveViewportState(state: ViewportState): void {
    const currentData = this.sheetDataMap.get(this.activeSheetId);
    if (currentData) {
      currentData.viewportState = state;
    }
  }

  /**
   * 获取指定工作表的视口状态
   * @param sheetId 工作表 ID
   * @returns 视口状态快照
   */
  public getViewportState(sheetId: string): ViewportState | undefined {
    const data = this.sheetDataMap.get(sheetId);
    return data?.viewportState;
  }

  /**
   * 保存指定工作表的打印配置
   * @param sheetId 工作表 ID
   * @param printMeta 打印元数据
   */
  public savePrintMetadata(sheetId: string, printMeta: SheetPrintMetadata): void {
    this.printMetadataMap.set(sheetId, { ...printMeta });
  }

  /**
   * 获取指定工作表的打印配置
   * @param sheetId 工作表 ID
   * @returns 打印元数据，未设置时返回 undefined
   */
  public getPrintMetadata(sheetId: string): SheetPrintMetadata | undefined {
    return this.printMetadataMap.get(sheetId);
  }

  /**
   * 移动工作表到目标位置
   * @param sheetId 要移动的工作表 ID
   * @param newIndex 目标位置索引
   */
  public reorderSheet(sheetId: string, newIndex: number): void {
    const currentIndex = this.sheets.findIndex((s) => s.id === sheetId);
    if (currentIndex === -1) {
      return;
    }

    // 拖拽到原位置不执行操作
    if (currentIndex === newIndex) {
      return;
    }

    // 限制目标索引范围
    const clampedIndex = Math.max(0, Math.min(newIndex, this.sheets.length - 1));

    // 移除并插入到新位置
    const [sheet] = this.sheets.splice(currentIndex, 1);
    this.sheets.splice(clampedIndex, 0, sheet);

    // 更新 order
    this.recalculateOrder();

    // 协同模式下提交操作
    if (this.collabCallback) {
      this.collabCallback({
        type: 'sheetReorder',
        sheetId,
        oldIndex: currentIndex,
        newIndex: clampedIndex,
      });
    }
  }

  /**
   * 深拷贝工作表
   * 生成 "原名称 (副本)" 格式名称
   * @param sheetId 源工作表 ID
   * @returns 新创建的工作表元数据，失败返回 undefined
   */
  public duplicateSheet(sheetId: string): SheetMeta | undefined {
    const sourceData = this.sheetDataMap.get(sheetId);
    if (!sourceData) {
      return undefined;
    }

    const newName = this.generateCopyName(sourceData.meta.name);
    const sourceIndex = this.sheets.findIndex((s) => s.id === sheetId);
    const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : this.sheets.length;

    // 创建新的工作表数据
    const newSheet = this.createSheetData(newName, insertIndex);

    // 深拷贝源工作表的单元格数据到新 Model
    const sourceJson = sourceData.model.exportToJSON();
    newSheet.model.importFromJSON(sourceJson);

    // 插入到源工作表右侧
    this.sheets.splice(insertIndex, 0, newSheet.meta);
    this.sheetDataMap.set(newSheet.meta.id, newSheet);

    // 更新 order
    this.recalculateOrder();

    // 自动切换到新工作表
    this.switchSheet(newSheet.meta.id);

    // 协同模式下提交操作
    if (this.collabCallback) {
      this.collabCallback({
        type: 'sheetDuplicate',
        sourceSheetId: sheetId,
        newSheetId: newSheet.meta.id,
        newSheetName: newName,
      });
    }

    return newSheet.meta;
  }

  // ============================================================
  // 隐藏/显示
  // ============================================================

  /**
   * 隐藏工作表
   * 仅剩一个可见工作表时拒绝隐藏
   * @param sheetId 要隐藏的工作表 ID
   * @returns 是否成功隐藏
   */
  public hideSheet(sheetId: string): boolean {
    const visibleSheets = this.getVisibleSheets();

    // 仅剩一个可见工作表时拒绝隐藏
    if (visibleSheets.length <= 1) {
      return false;
    }

    const sheetData = this.sheetDataMap.get(sheetId);
    if (!sheetData) {
      return false;
    }

    if (!sheetData.meta.visible) {
      return false; // 已经隐藏
    }

    // 设置为不可见
    sheetData.meta.visible = false;
    const sheetMeta = this.sheets.find((s) => s.id === sheetId);
    if (sheetMeta) {
      sheetMeta.visible = false;
    }

    // 如果隐藏的是活动工作表，切换到相邻可见工作表
    if (sheetId === this.activeSheetId) {
      const currentIndex = this.sheets.findIndex((s) => s.id === sheetId);
      const leftVisible = this.sheets
        .slice(0, currentIndex)
        .filter((s) => s.visible);
      const rightVisible = this.sheets
        .slice(currentIndex + 1)
        .filter((s) => s.visible);

      if (leftVisible.length > 0) {
        this.switchSheet(leftVisible[leftVisible.length - 1].id);
      } else if (rightVisible.length > 0) {
        this.switchSheet(rightVisible[0].id);
      }
    }

    // 协同模式下提交操作
    if (this.collabCallback) {
      this.collabCallback({
        type: 'sheetVisibility',
        sheetId,
        visible: false,
      });
    }

    return true;
  }

  /**
   * 显示工作表
   * @param sheetId 要显示的工作表 ID
   */
  public showSheet(sheetId: string): void {
    const sheetData = this.sheetDataMap.get(sheetId);
    if (!sheetData) {
      return;
    }

    sheetData.meta.visible = true;
    const sheetMeta = this.sheets.find((s) => s.id === sheetId);
    if (sheetMeta) {
      sheetMeta.visible = true;
    }

    // 协同模式下提交操作
    if (this.collabCallback) {
      this.collabCallback({
        type: 'sheetVisibility',
        sheetId,
        visible: true,
      });
    }
  }

  // ============================================================
  // 颜色标记
  // ============================================================

  /**
   * 设置/清除标签颜色
   * @param sheetId 工作表 ID
   * @param color 颜色值，null 表示清除
   */
  public setTabColor(sheetId: string, color: string | null): void {
    const sheetData = this.sheetDataMap.get(sheetId);
    if (!sheetData) {
      return;
    }

    sheetData.meta.tabColor = color;
    const sheetMeta = this.sheets.find((s) => s.id === sheetId);
    if (sheetMeta) {
      sheetMeta.tabColor = color;
    }

    // 协同模式下提交操作
    if (this.collabCallback) {
      this.collabCallback({
        type: 'sheetTabColor',
        sheetId,
        tabColor: color,
      });
    }
  }

  // ============================================================
  // 查询方法
  // ============================================================

  /** 获取当前活动工作表元数据 */
  public getActiveSheet(): SheetMeta {
    const sheet = this.sheets.find((s) => s.id === this.activeSheetId);
    // 活动工作表始终存在（构造函数保证）
    return sheet!;
  }

  /** 获取当前活动工作表的 SpreadsheetModel */
  public getActiveModel(): SpreadsheetModel {
    const data = this.sheetDataMap.get(this.activeSheetId);
    return data!.model;
  }

  /** 获取当前活动工作表的 HistoryManager */
  public getActiveHistoryManager(): HistoryManager {
    const data = this.sheetDataMap.get(this.activeSheetId);
    return data!.historyManager;
  }

  /** 按名称查找工作表 */
  public getSheetByName(name: string): SheetMeta | undefined {
    return this.sheets.find((s) => s.name === name);
  }

  /** 按 ID 查找工作表 */
  public getSheetById(id: string): SheetMeta | undefined {
    return this.sheets.find((s) => s.id === id);
  }

  /** 获取所有可见工作表（按 order 排序） */
  public getVisibleSheets(): SheetMeta[] {
    return this.sheets.filter((s) => s.visible);
  }

  /** 获取所有工作表（按 order 排序） */
  public getAllSheets(): SheetMeta[] {
    return [...this.sheets];
  }

  /** 获取所有隐藏的工作表 */
  public getHiddenSheets(): SheetMeta[] {
    return this.sheets.filter((s) => !s.visible);
  }

  /** 获取指定工作表的 SpreadsheetModel */
  public getModelBySheetId(sheetId: string): SpreadsheetModel | undefined {
    const data = this.sheetDataMap.get(sheetId);
    return data?.model;
  }

  /** 获取指定工作表的 HistoryManager */
  public getHistoryManagerBySheetId(sheetId: string): HistoryManager | undefined {
    const data = this.sheetDataMap.get(sheetId);
    return data?.historyManager;
  }

  // ============================================================
  // 跨 Sheet 公式支持
  // ============================================================

  /**
   * 从指定工作表获取单元格数据（供 FormulaEngine 跨 Sheet 引用使用）
   * @param sheetName 工作表名称
   * @param row 行号
   * @param col 列号
   * @returns 单元格数据，不存在时返回 null
   */
  public getCellFromSheet(sheetName: string, row: number, col: number): Cell | null {
    const sheetMeta = this.getSheetByName(sheetName);
    if (!sheetMeta) {
      return null;
    }

    const sheetData = this.sheetDataMap.get(sheetMeta.id);
    if (!sheetData) {
      return null;
    }

    return sheetData.model.getCell(row, col);
  }

  /**
   * 删除工作表后，将所有引用该工作表的公式更新为 #REF!
   * @param deletedSheetName 被删除的工作表名称
   */
  private updateFormulasOnSheetDelete(deletedSheetName: string): void {
    const pattern = this.buildSheetRefPattern(deletedSheetName);

    for (const [, sheetData] of this.sheetDataMap) {
      const data = sheetData.model.getData();
      const rows = data.cells.length;
      const cols = data.cells[0]?.length ?? 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = data.cells[r][c];
          if (!cell) continue;

          // 检查 formulaContent（原始公式文本）
          const formula = cell.formulaContent;
          if (!formula || !formula.startsWith('=')) continue;

          if (pattern.test(formula)) {
            // 将引用被删除工作表的公式标记为 #REF!
            cell.formulaContent = undefined;
            cell.content = '#REF!';
          }
        }
      }
    }
  }

  /**
   * 重命名工作表后，更新所有引用该工作表的公式中的名称
   * @param oldName 旧名称
   * @param newName 新名称
   */
  private updateFormulasOnSheetRename(oldName: string, newName: string): void {
    const pattern = this.buildSheetRefPattern(oldName);

    // 构建替换用的新前缀
    const newPrefix = this.needsQuoting(newName) ? `'${newName}'!` : `${newName}!`;

    for (const [_sheetId, sheetData] of this.sheetDataMap) {
      const model = sheetData.model;
      const data = model.getData();
      const rows = data.cells.length;
      const cols = data.cells[0]?.length ?? 0;
      const formulaEngine = FormulaEngine.getInstance();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = data.cells[r][c];
          if (!cell) continue;

          const formula = cell.formulaContent;
          if (!formula || !formula.startsWith('=')) continue;

          if (pattern.test(formula)) {
            // 替换公式中的旧工作表名称为新名称
            const updatedFormula = this.replaceSheetNameInFormula(formula, oldName, newPrefix);
            cell.formulaContent = updatedFormula;

            // 重新计算公式
            formulaEngine.clearCellCache(r, c);
            const result = formulaEngine.evaluate(updatedFormula, r, c);
            cell.content = result.value.toString();
          }
        }
      }
    }
  }

  /**
   * 构建匹配指定工作表名称引用的正则表达式
   * 匹配 SheetName! 和 'SheetName'! 两种格式
   */
  private buildSheetRefPattern(sheetName: string): RegExp {
    // 转义正则特殊字符
    const escaped = sheetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 匹配 SheetName! 或 'SheetName'!
    return new RegExp(`(?:'${escaped}'|${escaped})!`, 'i');
  }

  /**
   * 判断工作表名称是否需要用单引号包裹
   * 包含空格或特殊字符时需要包裹
   */
  private needsQuoting(name: string): boolean {
    return !/^[A-Za-z0-9_\u4e00-\u9fff]+$/.test(name);
  }

  /**
   * 替换公式中的旧工作表名称引用为新前缀
   */
  private replaceSheetNameInFormula(formula: string, oldName: string, newPrefix: string): string {
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 替换 'OldName'! 和 OldName! 两种格式
    const quotedPattern = new RegExp(`'${escaped}'!`, 'gi');
    const unquotedPattern = new RegExp(`${escaped}!`, 'gi');

    let result = formula.replace(quotedPattern, newPrefix);
    result = result.replace(unquotedPattern, newPrefix);
    return result;
  }

  /**
   * 触发跨 Sheet 依赖重算
   * 当某个工作表的数据变化时，重新计算所有引用该工作表的公式
   * @param changedSheetName 数据发生变化的工作表名称
   */
  public recalculateCrossSheetDependencies(changedSheetName: string): void {
    const pattern = this.buildSheetRefPattern(changedSheetName);
    const formulaEngine = FormulaEngine.getInstance();

    for (const [_sheetId, sheetData] of this.sheetDataMap) {
      const model = sheetData.model;
      const data = model.getData();
      const rows = data.cells.length;
      const cols = data.cells[0]?.length ?? 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = data.cells[r][c];
          if (!cell) continue;

          const formula = cell.formulaContent;
          if (!formula || !formula.startsWith('=')) continue;

          if (pattern.test(formula)) {
            // 清除缓存并重新计算
            formulaEngine.clearCellCache(r, c);
            const result = formulaEngine.evaluate(formula, r, c);
            cell.content = result.value.toString();
          }
        }
      }
    }
  }

  // ============================================================
  // 序列化（Task 3.4 实现，当前为存根方法）
  // ============================================================

  /** 将所有工作表数据序列化为 WorkbookData JSON */
  public serializeWorkbook(): WorkbookData {
    const sheets: WorkbookSheetEntry[] = this.sheets.map((meta) => {
      const sheetData = this.sheetDataMap.get(meta.id);
      let data: Record<string, unknown> = {};
      let metadata: Record<string, unknown> = {};

      if (sheetData) {
        try {
          // 调用 model.exportToJSON() 获取完整 JSON 字符串
          const jsonStr = sheetData.model.exportToJSON();
          const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
          // 提取 data 和 metadata 部分
          data = (parsed.data as Record<string, unknown>) ?? {};
          metadata = (parsed.metadata as Record<string, unknown>) ?? {};
        } catch (e) {
          console.error(`序列化工作表 "${meta.name}" 失败:`, e);
        }
      }

      // 将打印配置写入 metadata
      const printMeta = this.printMetadataMap.get(meta.id);
      if (printMeta) {
        savePrintConfigToMetadata(metadata, printMeta);
      }

      return {
        meta: { ...meta },
        data,
        metadata,
      };
    });

    return {
      version: '2.0' as const,
      timestamp: new Date().toISOString(),
      activeSheetId: this.activeSheetId,
      sheets,
    };
  }

  /** 从 WorkbookData JSON 恢复所有工作表 */
  public deserializeWorkbook(json: string): boolean {
    try {
      const workbook = JSON.parse(json) as Record<string, unknown>;

      // 验证基本格式
      if (!workbook.version || !Array.isArray(workbook.sheets)) {
        console.error('无效的 WorkbookData 格式');
        return false;
      }

      const sheetsArray = workbook.sheets as Array<Record<string, unknown>>;
      if (sheetsArray.length === 0) {
        console.error('WorkbookData 中没有工作表');
        return false;
      }

      // 清除现有工作表
      this.sheets = [];
      this.sheetDataMap.clear();
      this.printMetadataMap.clear();
      this.activeSheetId = '';

      // 恢复每个工作表
      for (const entry of sheetsArray) {
        const meta = entry.meta as Record<string, unknown>;
        if (!meta || !meta.id || !meta.name) {
          console.warn('跳过无效的工作表条目');
          continue;
        }

        // 创建新的工作表数据
        const sheetData = this.createSheetData(
          meta.name as string,
          (meta.order as number) ?? this.sheets.length
        );

        // 覆盖自动生成的 meta，使用原始 meta 数据
        sheetData.meta.id = meta.id as string;
        sheetData.meta.name = meta.name as string;
        sheetData.meta.visible = (meta.visible as boolean) ?? true;
        sheetData.meta.tabColor = (meta.tabColor as string | null) ?? null;
        sheetData.meta.order = (meta.order as number) ?? this.sheets.length;

        // 构造 v1.0 格式的 JSON 字符串，供 model.importFromJSON() 使用
        const modelJson = JSON.stringify({
          version: '1.0',
          metadata: entry.metadata ?? {},
          data: entry.data ?? {},
        });

        sheetData.model.importFromJSON(modelJson);

        // 从 metadata 中提取打印配置
        const entryMetadata = (entry.metadata ?? {}) as Record<string, unknown>;
        const printMeta = loadPrintConfigFromMetadata(entryMetadata);
        if (printMeta.printArea !== undefined || printMeta.pageConfig || printMeta.headerFooter) {
          this.printMetadataMap.set(sheetData.meta.id, printMeta);
        }

        this.sheets.push(sheetData.meta);
        this.sheetDataMap.set(sheetData.meta.id, sheetData);
      }

      // 设置活动工作表
      const targetActiveId = workbook.activeSheetId as string;
      if (targetActiveId && this.sheetDataMap.has(targetActiveId)) {
        this.activeSheetId = targetActiveId;
      } else if (this.sheets.length > 0) {
        // 回退到第一个可见工作表
        const firstVisible = this.sheets.find((s) => s.visible);
        this.activeSheetId = firstVisible ? firstVisible.id : this.sheets[0].id;
      }

      return true;
    } catch (error) {
      console.error('反序列化工作簿失败:', error);
      return false;
    }
  }

  /** 检测 v1.0 格式，自动包装为单工作表 WorkbookData */
  public migrateFromLegacy(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;

      // 如果已经是 v2.0 格式（有 sheets 数组），直接反序列化
      if (Array.isArray(parsed.sheets)) {
        return this.deserializeWorkbook(json);
      }

      // 旧版格式（无 version 或 version 为 "1.0"，无 sheets 数组）
      // 将整个 JSON 包装为单工作表的 WorkbookData
      const sheetId = crypto.randomUUID();
      const workbookData: WorkbookData = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        activeSheetId: sheetId,
        sheets: [
          {
            meta: {
              id: sheetId,
              name: 'Sheet1',
              visible: true,
              tabColor: null,
              order: 0,
            },
            data: (parsed.data as Record<string, unknown>) ?? {},
            metadata: (parsed.metadata as Record<string, unknown>) ?? {},
          },
        ],
      };

      return this.deserializeWorkbook(JSON.stringify(workbookData));
    } catch (error) {
      console.error('旧版数据迁移失败:', error);
      return false;
    }
  }

  // ============================================================
  // 名称生成工具方法
  // ============================================================

  /**
   * 生成不重复的默认工作表名称（SheetN 格式）
   * 跳过已存在的名称，找到最小可用数字
   */
  public generateSheetName(): string {
    const existingNames = new Set(this.sheets.map((s) => s.name));
    let n = 1;
    while (existingNames.has(`Sheet${n}`)) {
      n++;
    }
    return `Sheet${n}`;
  }

  /**
   * 生成复制工作表的名称
   * 格式为 "原名称 (副本)"，若已存在则追加数字后缀 "原名称 (副本 2)"
   * @param originalName 源工作表名称
   */
  public generateCopyName(originalName: string): string {
    const existingNames = new Set(this.sheets.map((s) => s.name));
    const baseCopyName = `${originalName} (副本)`;

    if (!existingNames.has(baseCopyName)) {
      return baseCopyName;
    }

    let n = 2;
    while (existingNames.has(`${originalName} (副本 ${n})`)) {
      n++;
    }
    return `${originalName} (副本 ${n})`;
  }

  // ============================================================
  // 内部辅助方法
  // ============================================================

  /**
   * 创建一个新的工作表数据对象
   * @param name 工作表名称
   * @param order 排序序号
   */
  private createSheetData(name: string, order: number): SheetData {
    // crypto.randomUUID() 在非安全上下文(HTTP)下不可用，提供 fallback
    const id = (typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
    const meta: SheetMeta = {
      id,
      name,
      visible: true,
      tabColor: null,
      order,
    };

    const model = new SpreadsheetModel();
    const historyManager = new HistoryManager();

    const viewportState: ViewportState = {
      scrollX: 0,
      scrollY: 0,
      selection: null,
      activeCell: null,
    };

    return { meta, model, historyManager, viewportState };
  }

  /** 重新计算所有工作表的 order 值 */
  private recalculateOrder(): void {
    this.sheets.forEach((sheet, index) => {
      sheet.order = index;
      const data = this.sheetDataMap.get(sheet.id);
      if (data) {
        data.meta.order = index;
      }
    });
  }
}
