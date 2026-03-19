import { SpreadsheetModel } from './model';
import { Modal } from './modal';
import type { SheetManager } from './sheet-manager';

// Hook测试 - 2026-02-06
export class DataManager {
  private model: SpreadsheetModel;
  private sheetManager: SheetManager | null = null;

  constructor(model: SpreadsheetModel) {
    this.model = model;
  }

  /** 设置 SheetManager 引用（多工作表模式下使用） */
  public setSheetManager(sheetManager: SheetManager): void {
    this.sheetManager = sheetManager;
  }

  // 导出数据到文件
  public exportToFile(filename?: string): void {
    // 多工作表模式：导出 WorkbookData 格式
    const jsonData = this.sheetManager
      ? JSON.stringify(this.sheetManager.serializeWorkbook(), null, 2)
      : this.model.exportToJSON();
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

  // 验证导入数据
  public validateImportData(jsonData: string): { valid: boolean; errors: string[]; warnings: string[] } {
    return SpreadsheetModel.validateImportData(jsonData);
  }

  // 验证简化格式导入数据
  public validateSimpleImportData(jsonData: string): { valid: boolean; errors: string[]; warnings: string[] } {
    return SpreadsheetModel.validateSimpleImportData(jsonData);
  }

  // 从文件导入数据（带验证）
  public importFromFile(showValidation: boolean = true): Promise<{ success: boolean; errors?: string[]; warnings?: string[] }> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve({ success: false, errors: ['未选择文件'] });
          return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const jsonData = e.target?.result as string;

            const validation = this.validateImportData(jsonData);

            if (!validation.valid) {
              if (showValidation) {
                await this.showValidationErrors(validation.errors, validation.warnings);
              }
              resolve({ success: false, errors: validation.errors, warnings: validation.warnings });
              return;
            }

            if (showValidation && validation.warnings.length > 0) {
              await this.showValidationErrors(validation.errors, validation.warnings);
            }

            const success = this.model.importFromJSON(jsonData);
            resolve({ success, errors: validation.errors, warnings: validation.warnings });
          } catch (error) {
            console.error('读取文件失败:', error);
            resolve({ success: false, errors: [`读取文件失败: ${error instanceof Error ? error.message : '未知错误'}`] });
          }
        };

        reader.onerror = () => {
          console.error('文件读取错误');
          resolve({ success: false, errors: ['文件读取错误'] });
        };

        reader.readAsText(file);
      };

      input.click();
    });
  }

  // 从简化格式文件导入数据（带验证）
  public importFromSimpleFile(showValidation: boolean = true): Promise<{ success: boolean; errors?: string[]; warnings?: string[] }> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve({ success: false, errors: ['未选择文件'] });
          return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const jsonData = e.target?.result as string;

            const validation = this.validateSimpleImportData(jsonData);

            if (!validation.valid) {
              if (showValidation) {
                await this.showValidationErrors(validation.errors, validation.warnings);
              }
              resolve({ success: false, errors: validation.errors, warnings: validation.warnings });
              return;
            }

            if (showValidation && validation.warnings.length > 0) {
              await this.showValidationErrors(validation.errors, validation.warnings);
            }

            const success = this.model.importFromSimpleJSON(jsonData);
            resolve({ success, errors: validation.errors, warnings: validation.warnings });
          } catch (error) {
            console.error('读取文件失败:', error);
            resolve({ success: false, errors: [`读取文件失败: ${error instanceof Error ? error.message : '未知错误'}`] });
          }
        };

        reader.onerror = () => {
          console.error('文件读取错误');
          resolve({ success: false, errors: ['文件读取错误'] });
        };

        reader.readAsText(file);
      };

      input.click();
    });
  }

  // 显示验证错误
  private async showValidationErrors(errors: string[], warnings: string[]): Promise<void> {
    let message = '';

    if (errors.length > 0) {
      message += '导入验证失败：\n' + errors.map(e => '• ' + e).join('\n');
    }

    if (warnings.length > 0) {
      if (message) message += '\n\n';
      message += '警告：\n' + warnings.map(w => '• ' + w).join('\n');
    }

    if (errors.length > 0) {
      await Modal.alert(message);
    } else {
      console.warn('导入警告：', warnings);
    }
  }

  // 从URL导入数据（带验证）
  public async importFromURL(url: string, showValidation: boolean = true): Promise<{ success: boolean; errors?: string[]; warnings?: string[] }> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData = await response.text();

      const validation = this.validateImportData(jsonData);

      if (!validation.valid) {
        if (showValidation) {
          await this.showValidationErrors(validation.errors, validation.warnings);
        }
        return { success: false, errors: validation.errors, warnings: validation.warnings };
      }

      if (showValidation && validation.warnings.length > 0) {
        await this.showValidationErrors(validation.errors, validation.warnings);
      }

      const success = this.model.importFromJSON(jsonData);
      return { success, errors: validation.errors, warnings: validation.warnings };
    } catch (error) {
      console.error('从URL导入数据失败:', error);
      return { success: false, errors: [`从URL导入失败: ${error instanceof Error ? error.message : '未知错误'}`] };
    }
  }

  // 保存到本地存储
  public saveToLocalStorage(key: string = 'spreadsheet-data'): boolean {
    try {
      // 多工作表模式：保存 WorkbookData 格式
      const jsonData = this.sheetManager
        ? JSON.stringify(this.sheetManager.serializeWorkbook())
        : this.model.exportToJSON();
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

      // 检测数据格式
      if (this.sheetManager) {
        try {
          const parsed = JSON.parse(jsonData) as Record<string, unknown>;
          if (parsed.version === '2.0' && Array.isArray(parsed.sheets)) {
            // WorkbookData 格式
            return this.sheetManager.deserializeWorkbook(jsonData);
          }
          // 旧版格式，尝试迁移
          return this.sheetManager.migrateFromLegacy(jsonData);
        } catch {
          return this.model.importFromJSON(jsonData);
        }
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
