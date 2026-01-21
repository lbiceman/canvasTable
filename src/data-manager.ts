import { SpreadsheetModel } from './model';

export class DataManager {
  private model: SpreadsheetModel;

  constructor(model: SpreadsheetModel) {
    this.model = model;
  }

  // 导出数据到文件
  public exportToFile(filename?: string): void {
    const jsonData = this.model.exportToJSON();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `spreadsheet-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  // 导出简化数据到文件
  public exportSimpleToFile(filename?: string): void {
    const jsonData = this.model.exportSimpleJSON();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `spreadsheet-simple-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  // 从文件导入数据
  public importFromFile(): Promise<boolean> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(false);
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const jsonData = e.target?.result as string;
            const success = this.model.importFromJSON(jsonData);
            resolve(success);
          } catch (error) {
            console.error('读取文件失败:', error);
            resolve(false);
          }
        };
        
        reader.onerror = () => {
          console.error('文件读取错误');
          resolve(false);
        };
        
        reader.readAsText(file);
      };
      
      input.click();
    });
  }

  // 从简化格式文件导入数据
  public importFromSimpleFile(): Promise<boolean> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(false);
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const jsonData = e.target?.result as string;
            const success = this.model.importFromSimpleJSON(jsonData);
            resolve(success);
          } catch (error) {
            console.error('读取文件失败:', error);
            resolve(false);
          }
        };
        
        reader.onerror = () => {
          console.error('文件读取错误');
          resolve(false);
        };
        
        reader.readAsText(file);
      };
      
      input.click();
    });
  }

  // 从URL导入数据
  public async importFromURL(url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const jsonData = await response.text();
      return this.model.importFromJSON(jsonData);
    } catch (error) {
      console.error('从URL导入数据失败:', error);
      return false;
    }
  }

  // 保存到本地存储
  public saveToLocalStorage(key: string = 'spreadsheet-data'): boolean {
    try {
      const jsonData = this.model.exportToJSON();
      localStorage.setItem(key, jsonData);
      return true;
    } catch (error) {
      console.error('保存到本地存储失败:', error);
      return false;
    }
  }

  // 从本地存储加载
  public loadFromLocalStorage(key: string = 'spreadsheet-data'): boolean {
    try {
      const jsonData = localStorage.getItem(key);
      if (!jsonData) {
        return false;
      }
      
      return this.model.importFromJSON(jsonData);
    } catch (error) {
      console.error('从本地存储加载失败:', error);
      return false;
    }
  }

  // 获取数据预览
  public getDataPreview(maxRows: number = 10, maxCols: number = 10): any {
    const preview = {
      statistics: this.model.getStatistics(),
      sampleData: [] as any[]
    };

    const rowCount = Math.min(this.model.getRowCount(), maxRows);
    const colCount = Math.min(this.model.getColCount(), maxCols);

    for (let i = 0; i < rowCount; i++) {
      const row = [];
      for (let j = 0; j < colCount; j++) {
        const cell = this.model.getCell(i, j);
        row.push(cell?.content || '');
      }
      preview.sampleData.push(row);
    }

    return preview;
  }
}