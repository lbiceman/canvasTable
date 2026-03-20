// 操作类型
export type ActionType =
  | 'setCellContent'
  | 'mergeCells'
  | 'splitCell'
  | 'setFontColor'
  | 'setBgColor'
  | 'setFontSize'
  | 'setFontBold'
  | 'setFontItalic'
  | 'setFontUnderline'
  | 'setFontAlign'
  | 'setVerticalAlign'
  | 'insertRows'
  | 'deleteRows'
  | 'clearContent'
  | 'resizeRow'
  | 'resizeCol'
  | 'setFormat'
  | 'setWrapText'
  | 'setRichText'
  | 'setValidation'
  | 'setConditionalFormat'
  | 'setSort'
  | 'setFilter'
  // 批量删除行/列
  | 'batchDeleteRows'
  | 'batchDeleteCols'
  // 隐藏/取消隐藏行/列
  | 'hideRows'
  | 'hideCols'
  | 'unhideRows'
  | 'unhideCols'
  // 分组操作
  | 'createGroup'
  | 'removeGroup'
  | 'collapseGroup'
  | 'expandGroup'
  // 冻结窗格
  | 'freeze'
  // 填充
  | 'fill'
  // 拖拽移动
  | 'dragMove'
  // 选择性粘贴
  | 'pasteSpecial'
  // 查找替换
  | 'replace'
  | 'replaceAll';


// 历史记录项
export interface HistoryAction {
  type: ActionType;
  data: any;
  undoData: any;
}

// 历史记录管理器
export class HistoryManager {
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];
  private maxHistory: number = 100;
  private isRecording: boolean = true;
  private storageKey: string = 'spreadsheet-history';
  private isLoaded: boolean = false;

  constructor() {
    this.loadFromStorage();
  }

  // 从本地存储加载历史记录
  private loadFromStorage(): void {
    try {
      const savedUndo = localStorage.getItem(`${this.storageKey}-undo`);
      const savedRedo = localStorage.getItem(`${this.storageKey}-redo`);
      
      if (savedUndo) {
        this.undoStack = JSON.parse(savedUndo);
      }
      if (savedRedo) {
        this.redoStack = JSON.parse(savedRedo);
      }
      this.isLoaded = true;
    } catch (e) {
      console.warn('Failed to load history from storage:', e);
      this.undoStack = [];
      this.redoStack = [];
    }
  }

  // 保存到本地存储
  private saveToStorage(): void {
    try {
      localStorage.setItem(`${this.storageKey}-undo`, JSON.stringify(this.undoStack));
      localStorage.setItem(`${this.storageKey}-redo`, JSON.stringify(this.redoStack));
    } catch (e) {
      console.warn('Failed to save history to storage:', e);
    }
  }

  // 清除存储的历史记录
  public clearStorage(): void {
    try {
      localStorage.removeItem(`${this.storageKey}-undo`);
      localStorage.removeItem(`${this.storageKey}-redo`);
    } catch (e) {
      console.warn('Failed to clear history storage:', e);
    }
  }

  // 记录操作
  public record(action: HistoryAction): void {
    if (!this.isRecording) return;

    this.undoStack.push(action);

    // 新操作会清空重做栈
    this.redoStack = [];

    // 限制历史记录数量
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    // 持久化存储
    if (this.isLoaded) {
      this.saveToStorage();
    }
  }

  // 是否可以撤销
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  // 是否可以重做
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // 获取撤销操作
  public getUndoAction(): HistoryAction | null {
    const action = this.undoStack.pop();
    if (action) {
      this.redoStack.push(action);
      // 持久化存储
      if (this.isLoaded) {
        this.saveToStorage();
      }
    }
    return action || null;
  }

  // 获取重做操作
  public getRedoAction(): HistoryAction | null {
    const action = this.redoStack.pop();
    if (action) {
      this.undoStack.push(action);
      // 持久化存储
      if (this.isLoaded) {
        this.saveToStorage();
      }
    }
    return action || null;
  }

  // 暂停记录
  public pauseRecording(): void {
    this.isRecording = false;
  }

  // 恢复记录
  public resumeRecording(): void {
    this.isRecording = true;
  }

  // 清空历史
  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    // 清除持久化存储
    if (this.isLoaded) {
      this.clearStorage();
    }
  }

  // 获取撤销栈长度
  public getUndoCount(): number {
    return this.undoStack.length;
  }

  // 获取重做栈长度
  public getRedoCount(): number {
    return this.redoStack.length;
  }
}
