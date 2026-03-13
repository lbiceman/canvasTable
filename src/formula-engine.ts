export interface CellReference {
  row: number;
  col: number;
}

export interface RangeReference {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export type Reference = CellReference | RangeReference;

export interface FormulaResult {
  value: number | string;
  isError: boolean;
  errorMessage?: string;
}

export interface Dependency {
  row: number;
  col: number;
}

export class FormulaEngine {
  private static instance: FormulaEngine | null = null;
  private cellGetter: ((row: number, col: number) => { content: string } | null) | null = null;
  private formulaCache: Map<string, { formula: string; result: FormulaResult }> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private dependentsGraph: Map<string, Set<string>> = new Map();

  private constructor() {}

  public static getInstance(): FormulaEngine {
    if (!FormulaEngine.instance) {
      FormulaEngine.instance = new FormulaEngine();
    }
    return FormulaEngine.instance;
  }

  public setCellGetter(getter: (row: number, col: number) => { content: string } | null): void {
    this.cellGetter = getter;
  }

  public clearCache(): void {
    this.formulaCache.clear();
    this.dependencyGraph.clear();
    this.dependentsGraph.clear();
  }

  public clearCellCache(row: number, col: number): void {
    const key = this.getCellKey(row, col);
    this.formulaCache.delete(key);
  }

  private getCellKey(row: number, col: number): string {
    return `${row}-${col}`;
  }

  private colToIndex(colStr: string): number {
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    return col - 1;
  }

  private parseCellReference(ref: string): CellReference | null {
    const match = ref.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;

    const colStr = match[1].toUpperCase();
    const row = parseInt(match[2], 10) - 1;
    const col = this.colToIndex(colStr);

    return { row, col };
  }

  private parseRangeReference(ref: string): RangeReference | null {
    const parts = ref.split(':');
    if (parts.length !== 2) return null;

    const startRef = this.parseCellReference(parts[0].trim());
    const endRef = this.parseCellReference(parts[1].trim());

    if (!startRef || !endRef) return null;

    return {
      startRow: Math.min(startRef.row, endRef.row),
      startCol: Math.min(startRef.col, endRef.col),
      endRow: Math.max(startRef.row, endRef.row),
      endCol: Math.max(startRef.col, endRef.col),
    };
  }

  private parseReference(ref: string): Reference | null {
    const trimmed = ref.trim();

    const rangeRef = this.parseRangeReference(trimmed);
    if (rangeRef) return rangeRef;

    const cellRef = this.parseCellReference(trimmed);
    if (cellRef) return cellRef;

    return null;
  }

  public parseFormula(formula: string): { functionName: string; args: string[] } | null {
    const trimmed = formula.trim();
    if (!trimmed.startsWith('=')) {
      return null;
    }

    const content = trimmed.substring(1).trim();
    const funcMatch = content.match(/^(\w+)\((.*)\)$/i);

    if (!funcMatch) {
      return null;
    }

    const functionName = funcMatch[1].toUpperCase();
    const argsStr = funcMatch[2];

    const args: string[] = [];
    let current = '';
    let parenDepth = 0;

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];

      if (char === '(') {
        parenDepth++;
        current += char;
      } else if (char === ')') {
        parenDepth--;
        current += char;
      } else if (char === ',' && parenDepth === 0) {
        if (current.trim()) {
          args.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return { functionName, args };
  }

  private extractDependencies(formula: string): Dependency[] {
    const parsed = this.parseFormula(formula);
    if (!parsed) return [];

    const dependencies: Dependency[] = [];

    for (const arg of parsed.args) {
      const ref = this.parseReference(arg);
      if (!ref) continue;

      if ('startRow' in ref) {
        for (let row = ref.startRow; row <= ref.endRow; row++) {
          for (let col = ref.startCol; col <= ref.endCol; col++) {
            dependencies.push({ row, col });
          }
        }
      } else {
        dependencies.push({ row: ref.row, col: ref.col });
      }
    }

    return dependencies;
  }

  private buildDependencyGraph(formula: string, row: number, col: number): void {
    const cellKey = this.getCellKey(row, col);
    const dependencies = this.extractDependencies(formula);

    this.dependencyGraph.set(cellKey, new Set());

    for (const dep of dependencies) {
      const depKey = this.getCellKey(dep.row, dep.col);
      this.dependencyGraph.get(cellKey)!.add(depKey);

      if (!this.dependentsGraph.has(depKey)) {
        this.dependentsGraph.set(depKey, new Set());
      }
      this.dependentsGraph.get(depKey)!.add(cellKey);
    }
  }

  public getDependents(row: number, col: number): Dependency[] {
    const cellKey = this.getCellKey(row, col);
    const dependents = this.dependentsGraph.get(cellKey);

    if (!dependents) return [];

    return Array.from(dependents).map(key => {
      const [r, c] = key.split('-').map(Number);
      return { row: r, col: c };
    });
  }

  public getAffectedCells(row: number, col: number): Dependency[] {
    const affected = new Set<string>();
    const queue: string[] = [this.getCellKey(row, col)];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (affected.has(current)) continue;
      affected.add(current);

      const dependents = this.dependentsGraph.get(current);
      if (dependents) {
        dependents.forEach(dep => {
          if (!affected.has(dep)) {
            queue.push(dep);
          }
        });
      }
    }

    return Array.from(affected).map(key => {
      const [r, c] = key.split('-').map(Number);
      return { row: r, col: c };
    });
  }

  private parseNumber(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === '') return null;

    const num = parseFloat(trimmed);
    if (isNaN(num)) return null;

    return num;
  }

  public calculateSum(args: string[]): FormulaResult {
    let sum = 0;
    let hasValidNumber = false;
    const errors: string[] = [];

    for (const arg of args) {
      const ref = this.parseReference(arg);

      if (!ref) {
        const num = this.parseNumber(arg);
        if (num !== null) {
          sum += num;
          hasValidNumber = true;
        } else if (arg.trim() !== '') {
          errors.push(`无效的引用: ${arg}`);
        }
        continue;
      }

      if ('startRow' in ref) {
        for (let row = ref.startRow; row <= ref.endRow; row++) {
          for (let col = ref.startCol; col <= ref.endCol; col++) {
            const cell = this.cellGetter?.(row, col);
            const content = cell?.content ?? '';
            const num = this.parseNumber(content);

            if (num !== null) {
              sum += num;
              hasValidNumber = true;
            }
          }
        }
      } else {
        const cell = this.cellGetter?.(ref.row, ref.col);
        const content = cell?.content ?? '';
        const num = this.parseNumber(content);

        if (num !== null) {
          sum += num;
          hasValidNumber = true;
        }
      }
    }

    if (errors.length > 0 && !hasValidNumber) {
      return {
        value: '#错误!',
        isError: true,
        errorMessage: errors[0]
      };
    }

    return { value: sum, isError: false };
  }

  private getNumbersFromArgs(args: string[]): { numbers: number[]; errors: string[] } {
    const numbers: number[] = [];
    const errors: string[] = [];

    for (const arg of args) {
      const ref = this.parseReference(arg);

      if (!ref) {
        const num = this.parseNumber(arg);
        if (num !== null) {
          numbers.push(num);
        } else if (arg.trim() !== '') {
          errors.push(`无效的引用或值: ${arg}`);
        }
        continue;
      }

      if ('startRow' in ref) {
        for (let row = ref.startRow; row <= ref.endRow; row++) {
          for (let col = ref.startCol; col <= ref.endCol; col++) {
            const cell = this.cellGetter?.(row, col);
            const content = cell?.content ?? '';
            const num = this.parseNumber(content);
            if (num !== null) {
              numbers.push(num);
            }
          }
        }
      } else {
        const cell = this.cellGetter?.(ref.row, ref.col);
        const content = cell?.content ?? '';
        const num = this.parseNumber(content);
        if (num !== null) {
          numbers.push(num);
        }
      }
    }

    return { numbers, errors };
  }

  public calculateSubtract(args: string[]): FormulaResult {
    const { numbers, errors } = this.getNumbersFromArgs(args);

    if (numbers.length === 0) {
      return {
        value: '#错误!',
        isError: true,
        errorMessage: errors[0] || '减法运算至少需要一个数值'
      };
    }

    let result = numbers[0];
    for (let i = 1; i < numbers.length; i++) {
      result -= numbers[i];
    }

    return { value: result, isError: false };
  }

  public calculateMultiply(args: string[]): FormulaResult {
    const { numbers, errors } = this.getNumbersFromArgs(args);

    if (numbers.length === 0) {
      return {
        value: '#错误!',
        isError: true,
        errorMessage: errors[0] || '乘法运算至少需要一个数值'
      };
    }

    let result = numbers[0];
    for (let i = 1; i < numbers.length; i++) {
      result *= numbers[i];
    }

    return { value: result, isError: false };
  }

  public calculateDivide(args: string[]): FormulaResult {
    const { numbers, errors } = this.getNumbersFromArgs(args);

    if (numbers.length === 0) {
      return {
        value: '#错误!',
        isError: true,
        errorMessage: errors[0] || '除法运算至少需要一个数值'
      };
    }

    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] === 0) {
        return {
          value: '#DIV/0!',
          isError: true,
          errorMessage: '除数不能为零'
        };
      }
    }

    let result = numbers[0];
    for (let i = 1; i < numbers.length; i++) {
      result /= numbers[i];
    }

    return { value: result, isError: false };
  }

  public evaluate(formula: string, row: number, col: number): FormulaResult {
    if (!formula.startsWith('=')) {
      return { value: formula, isError: false };
    }

    const cellKey = this.getCellKey(row, col);
    const cached = this.formulaCache.get(cellKey);
    if (cached && cached.formula === formula) {
      return cached.result;
    }

    const parsed = this.parseFormula(formula);

    if (!parsed) {
      return {
        value: '#错误!',
        isError: true,
        errorMessage: '无效的公式语法'
      };
    }

    this.buildDependencyGraph(formula, row, col);

    let result: FormulaResult;

    switch (parsed.functionName) {
      case 'SUM':
        result = this.calculateSum(parsed.args);
        break;
      case 'SUBTRACT':
        result = this.calculateSubtract(parsed.args);
        break;
      case 'MULTIPLY':
        result = this.calculateMultiply(parsed.args);
        break;
      case 'DIVIDE':
        result = this.calculateDivide(parsed.args);
        break;
      default:
        result = {
          value: '#错误!',
          isError: true,
          errorMessage: `不支持的函数: ${parsed.functionName}`
        };
    }

    this.formulaCache.set(cellKey, { formula, result });

    return result;
  }

  public isFormula(content: string): boolean {
    return content.trim().startsWith('=');
  }

  public getDisplayValue(content: string, row: number, col: number): string {
    if (!this.isFormula(content)) {
      return content;
    }

    const result = this.evaluate(content, row, col);
    return result.value.toString();
  }

  public validateFormula(formula: string): { valid: boolean; error?: string } {
    if (!formula.startsWith('=')) {
      return { valid: true };
    }

    const parsed = this.parseFormula(formula);

    if (!parsed) {
      return {
        valid: false,
        error: '无效的公式语法。请使用格式: =SUM(A1:A10)'
      };
    }

    const supportedFunctions = ['SUM', 'SUBTRACT', 'MULTIPLY', 'DIVIDE'];
    if (!supportedFunctions.includes(parsed.functionName)) {
      return {
        valid: false,
        error: `不支持的函数: ${parsed.functionName}。当前仅支持 ${supportedFunctions.join(', ')} 函数`
      };
    }

    for (const arg of parsed.args) {
      const ref = this.parseReference(arg);
      if (!ref) {
        const num = this.parseNumber(arg);
        if (num === null && arg.trim() !== '') {
          return {
            valid: false,
            error: `无效的引用或值: ${arg}`
          };
        }
      }
    }

    return { valid: true };
  }
}
