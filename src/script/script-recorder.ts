// ============================================================
// 脚本录制器
// 录制用户操作序列并生成可编辑脚本
// ============================================================

/** 录制的操作类型 */
export type RecordedActionType =
  | 'setCellValue'
  | 'setFormat'
  | 'setBold'
  | 'setItalic'
  | 'setUnderline'
  | 'setFontColor'
  | 'setBgColor'
  | 'setFontSize'
  | 'setAlign'
  | 'insertRow'
  | 'deleteRow'
  | 'insertCol'
  | 'deleteCol'
  | 'setSelection';

/** 录制的操作 */
export interface RecordedAction {
  type: RecordedActionType;
  timestamp: number;
  params: Record<string, unknown>;
}

/** 录制状态 */
export type RecorderState = 'idle' | 'recording' | 'paused';

/** 录制状态变更回调 */
export type RecorderStateCallback = (state: RecorderState) => void;

/**
 * 脚本录制器
 * 录制用户操作并转换为可执行脚本
 */
export class ScriptRecorder {
  private actions: RecordedAction[] = [];
  private state: RecorderState = 'idle';
  private stateCallbacks: RecorderStateCallback[] = [];
  private startTime: number = 0;

  /** 获取当前录制状态 */
  public getState(): RecorderState {
    return this.state;
  }

  /** 是否正在录制 */
  public isRecording(): boolean {
    return this.state === 'recording';
  }

  /** 开始录制 */
  public start(): void {
    this.actions = [];
    this.state = 'recording';
    this.startTime = Date.now();
    this.notifyStateChange();
  }

  /** 暂停录制 */
  public pause(): void {
    if (this.state === 'recording') {
      this.state = 'paused';
      this.notifyStateChange();
    }
  }

  /** 恢复录制 */
  public resume(): void {
    if (this.state === 'paused') {
      this.state = 'recording';
      this.notifyStateChange();
    }
  }

  /** 停止录制并返回录制的操作 */
  public stop(): RecordedAction[] {
    this.state = 'idle';
    this.notifyStateChange();
    return [...this.actions];
  }

  /** 记录一个操作 */
  public record(type: RecordedActionType, params: Record<string, unknown>): void {
    if (this.state !== 'recording') return;

    this.actions.push({
      type,
      timestamp: Date.now() - this.startTime,
      params,
    });
  }

  /** 获取已录制的操作数量 */
  public getActionCount(): number {
    return this.actions.length;
  }

  /** 注册状态变更回调 */
  public onStateChange(callback: RecorderStateCallback): void {
    this.stateCallbacks.push(callback);
  }

  /** 移除状态变更回调 */
  public offStateChange(callback: RecorderStateCallback): void {
    const index = this.stateCallbacks.indexOf(callback);
    if (index !== -1) {
      this.stateCallbacks.splice(index, 1);
    }
  }

  /** 通知状态变更 */
  private notifyStateChange(): void {
    for (const cb of this.stateCallbacks) {
      cb(this.state);
    }
  }

  /**
   * 将录制的操作转换为可执行脚本代码
   */
  public toScript(actions?: RecordedAction[]): string {
    const ops = actions || this.actions;
    if (ops.length === 0) return '// 没有录制到任何操作\n';

    const lines: string[] = [
      '// 自动录制的脚本',
      `// 录制时间: ${new Date().toLocaleString()}`,
      `// 操作数量: ${ops.length}`,
      '',
    ];

    for (const action of ops) {
      const line = this.actionToCode(action);
      if (line) {
        lines.push(line);
      }
    }

    return lines.join('\n') + '\n';
  }

  /** 将单个操作转换为脚本代码 */
  private actionToCode(action: RecordedAction): string {
    const { type, params } = action;

    switch (type) {
      case 'setCellValue':
        return `setCellValue(${params.row}, ${params.col}, ${JSON.stringify(params.value)});`;

      case 'setSelection':
        return `setSelection(${params.startRow}, ${params.startCol}, ${params.endRow}, ${params.endCol});`;

      case 'setBold':
        return `// 设置加粗: 行${params.row}, 列${params.col}, 值=${params.value}`;

      case 'setItalic':
        return `// 设置斜体: 行${params.row}, 列${params.col}, 值=${params.value}`;

      case 'setUnderline':
        return `// 设置下划线: 行${params.row}, 列${params.col}, 值=${params.value}`;

      case 'setFontColor':
        return `// 设置字体颜色: 行${params.row}, 列${params.col}, 颜色=${params.color}`;

      case 'setBgColor':
        return `// 设置背景色: 行${params.row}, 列${params.col}, 颜色=${params.color}`;

      case 'setFontSize':
        return `// 设置字号: 行${params.row}, 列${params.col}, 大小=${params.size}`;

      case 'setAlign':
        return `// 设置对齐: 行${params.row}, 列${params.col}, 对齐=${params.align}`;

      case 'setFormat':
        return `// 设置格式: 行${params.row}, 列${params.col}`;

      case 'insertRow':
        return `// 插入行: 位置=${params.index}`;

      case 'deleteRow':
        return `// 删除行: 位置=${params.index}`;

      case 'insertCol':
        return `// 插入列: 位置=${params.index}`;

      case 'deleteCol':
        return `// 删除列: 位置=${params.index}`;

      default:
        return `// 未知操作: ${type}`;
    }
  }
}
