// 操作类型
export type ActionType = 
  | 'setCellContent'
  | 'mergeCells'
  | 'splitCell'
  | 'setFontColor'
  | 'setBgColor'
  | 'insertRows'
  | 'deleteRows'
  | 'clearContent';

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
    }
    return action || null;
  }

  // 获取重做操作
  public getRedoAction(): HistoryAction | null {
    const action = this.redoStack.pop();
    if (action) {
      this.undoStack.push(action);
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
