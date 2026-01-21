export class InlineEditor {
  private editorElement: HTMLDivElement;
  private inputElement: HTMLInputElement;
  private isActive: boolean = false;
  private currentRow: number = -1;
  private currentCol: number = -1;
  private saveCallback: ((value: string) => void) | null = null;
  
  constructor() {
    // 创建编辑器元素
    this.editorElement = document.createElement('div');
    this.editorElement.className = 'inline-editor';
    this.editorElement.style.display = 'none';
    
    // 创建输入框元素
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    
    // 添加输入框到编辑器
    this.editorElement.appendChild(this.inputElement);
    
    // 添加编辑器到文档
    document.body.appendChild(this.editorElement);
    
    // 初始化事件监听
    this.initEventListeners();
  }
  
  // 初始化事件监听
  private initEventListeners(): void {
    // 按下回车键保存内容
    this.inputElement.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.save();
      } else if (event.key === 'Escape') {
        this.cancel();
      }
    });
    
    // 失去焦点时保存内容
    this.inputElement.addEventListener('blur', () => {
      this.save();
    });
  }
  
  // 显示编辑器
  public show(x: number, y: number, width: number, height: number, value: string, row: number, col: number, callback: (value: string) => void): void {
    // 设置编辑器位置和大小
    this.editorElement.style.left = `${x}px`;
    this.editorElement.style.top = `${y}px`;
    this.editorElement.style.width = `${width}px`;
    this.editorElement.style.height = `${height}px`;
    
    // 设置输入框内容
    this.inputElement.value = value;
    
    // 显示编辑器
    this.editorElement.style.display = 'block';
    
    // 设置当前单元格位置
    this.currentRow = row;
    this.currentCol = col;
    
    // 设置保存回调函数
    this.saveCallback = callback;
    
    // 设置活动状态
    this.isActive = true;
    
    // 聚焦输入框并选中所有内容
    this.inputElement.focus();
    this.inputElement.select();
  }
  
  // 隐藏编辑器
  public hide(): void {
    this.editorElement.style.display = 'none';
    this.isActive = false;
    this.currentRow = -1;
    this.currentCol = -1;
    this.saveCallback = null;
  }
  
  // 保存内容
  public save(): void {
    if (this.isActive && this.saveCallback) {
      this.saveCallback(this.inputElement.value);
      this.hide();
    }
  }
  
  // 取消编辑
  public cancel(): void {
    this.hide();
  }
  
  // 检查是否正在编辑
  public isEditing(): boolean {
    return this.isActive;
  }
  
  // 获取当前编辑的单元格位置
  public getCurrentCell(): { row: number; col: number } | null {
    if (this.isActive) {
      return { row: this.currentRow, col: this.currentCol };
    }
    return null;
  }
}