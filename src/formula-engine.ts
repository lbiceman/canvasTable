// ============================================================
// FormulaEngine 门面（Facade）
// 将内部实现委托给 Tokenizer → Parser → Evaluator 管线
// 保持现有公共 API 不变，新增循环引用检测和数组公式支持
// Requirements: 10.1-10.6, 9.4, 9.7
// ============================================================

import { Tokenizer } from './formula/tokenizer';
import { Parser } from './formula/parser';
import { Evaluator, isError, makeError } from './formula/evaluator';
import { FunctionRegistry } from './formula/function-registry';
import { DependencyGraph } from './formula/dependency-graph';
import { CircularDetector } from './formula/circular-detector';
import { NamedRangeManager } from './formula/named-range';
import { ArrayFormulaManager } from './formula/array-formula';
import { registerMathFunctions } from './formula/functions/math';
import { registerStatisticsFunctions } from './formula/functions/statistics';
import { registerTextFunctions } from './formula/functions/text';
import { registerLogicFunctions } from './formula/functions/logic';
import { registerLookupFunctions } from './formula/functions/lookup';
import { registerDateFunctions } from './formula/functions/date';
import type {
  ASTNode,
  FormulaValue,
  EvaluationContext,
  RangeReferenceNode,
  FunctionCategory,
} from './formula/types';

// ============================================================
// 保持现有导出类型不变
// ============================================================

export interface CellReference {
  row: number;
  col: number;
  sheetName?: string;
}

export interface RangeReference {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  sheetName?: string;
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

// ============================================================
// FormulaEngine 类
// ============================================================

export class FormulaEngine {
  private static instance: FormulaEngine | null = null;

  /** 当前 Sheet 单元格获取器 */
  private cellGetter: ((row: number, col: number) => { content: string } | null) | null = null;
  /** 跨 Sheet 单元格获取器 */
  private sheetCellGetter: ((sheetName: string, row: number, col: number) => { content: string } | null) | null = null;

  /** 公式结果缓存 */
  private formulaCache: Map<string, { formula: string; result: FormulaResult }> = new Map();

  /** 新管线组件 */
  private readonly tokenizer: Tokenizer;
  private readonly parser: Parser;
  private readonly functionRegistry: FunctionRegistry;
  private readonly depGraph: DependencyGraph;
  private readonly circularDetector: CircularDetector;
  private readonly namedRangeManager: NamedRangeManager;
  private readonly arrayFormulaManager: ArrayFormulaManager;

  /** 公式错误回调列表 */
  private formulaErrorCallbacks: ((message: string) => void)[] = [];

  /** 旧版依赖图（保持向后兼容） */
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private dependentsGraph: Map<string, Set<string>> = new Map();

  private constructor() {
    // 初始化管线组件
    this.tokenizer = new Tokenizer();
    this.parser = new Parser();
    this.functionRegistry = new FunctionRegistry();
    this.depGraph = new DependencyGraph();
    this.circularDetector = new CircularDetector();
    this.namedRangeManager = new NamedRangeManager();
    this.arrayFormulaManager = new ArrayFormulaManager();

    // 注册六大函数类别
    this.registerAllFunctions();
  }

  public static getInstance(): FormulaEngine {
    if (!FormulaEngine.instance) {
      FormulaEngine.instance = new FormulaEngine();
    }
    return FormulaEngine.instance;
  }

  // ============================================================
  // 公共 API - 保持现有签名不变
  // ============================================================

  public setCellGetter(getter: (row: number, col: number) => { content: string } | null): void {
    this.cellGetter = getter;
  }

  public setSheetCellGetter(getter: (sheetName: string, row: number, col: number) => { content: string } | null): void {
    this.sheetCellGetter = getter;
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

  /**
   * 解析公式（保持向后兼容）
   * 仅支持简单的 =FUNC(args) 格式
   */
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


  /**
   * 验证公式语法
   * 使用新管线进行验证，同时保持旧版函数的兼容
   */
  public validateFormula(formula: string): { valid: boolean; error?: string } {
    if (!formula.startsWith('=')) {
      return { valid: true };
    }

    const expression = formula.substring(1).trim();
    if (expression === '') {
      return { valid: false, error: '公式内容为空' };
    }

    try {
      const tokens = this.tokenizer.tokenize(expression);
      this.parser.parse(tokens);
      return { valid: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知解析错误';
      return { valid: false, error: message };
    }
  }

  /**
   * 求值公式 - 核心方法
   * 使用 Tokenizer → Parser → Evaluator 管线
   */
  public evaluate(formula: string, row: number, col: number): FormulaResult {
    if (!formula.startsWith('=')) {
      return { value: formula, isError: false };
    }

    // 1. 检查缓存
    const cellKey = this.getCellKey(row, col);
    const cached = this.formulaCache.get(cellKey);
    if (cached && cached.formula === formula) {
      return cached.result;
    }

    // 2. 去除前导 =
    const expression = formula.substring(1).trim();

    let result: FormulaResult;

    try {
      // 3. 词法分析
      const tokens = this.tokenizer.tokenize(expression);

      // 4. 语法分析
      const ast = this.parser.parse(tokens);

      // 5. 从 AST 提取依赖
      const dependencies = this.extractDependenciesFromAST(ast);

      // 6. 更新依赖图（旧版兼容）
      this.updateDependencyGraphs(cellKey, dependencies);

      // 7. 循环引用检测
      const depKeys = dependencies.map(d => this.getCellKey(d.row, d.col));
      const circularPath = this.circularDetector.detect(cellKey, depKeys, this.depGraph);
      if (circularPath !== null) {
        const pathStr = circularPath.join(' → ');
        const errorMsg = `循环引用: ${pathStr}`;
        this.notifyFormulaError(errorMsg);
        result = { value: '#REF!', isError: true, errorMessage: errorMsg };
        this.formulaCache.set(cellKey, { formula, result });
        return result;
      }

      // 8. 更新新版依赖图
      this.depGraph.setDependencies(cellKey, depKeys);

      // 9. 创建求值上下文
      const context = this.createEvaluationContext(row, col);

      // 10. 求值 AST
      const evaluator = new Evaluator(context, this.functionRegistry);
      const rawResult = evaluator.evaluate(ast);

      // 11. 映射结果到 FormulaResult
      result = this.mapToFormulaResult(rawResult);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '公式计算错误';
      result = { value: '#错误!', isError: true, errorMessage: message };
    }

    // 12. 缓存并返回
    this.formulaCache.set(cellKey, { formula, result });
    return result;
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

  // ============================================================
  // 新增 API
  // ============================================================

  /**
   * 检测循环引用
   * @returns 循环路径数组或 null
   */
  public checkCircularReference(row: number, col: number, formula: string): string[] | null {
    if (!formula.startsWith('=')) return null;

    const expression = formula.substring(1).trim();
    try {
      const tokens = this.tokenizer.tokenize(expression);
      const ast = this.parser.parse(tokens);
      const dependencies = this.extractDependenciesFromAST(ast);
      const cellKey = this.getCellKey(row, col);
      const depKeys = dependencies.map(d => this.getCellKey(d.row, d.col));
      return this.circularDetector.detect(cellKey, depKeys, this.depGraph);
    } catch {
      return null;
    }
  }

  /**
   * 求值数组公式，返回二维结果
   */
  public evaluateArrayFormula(formula: string, row: number, col: number): FormulaValue[][] {
    if (!formula.startsWith('=')) return [[formula]];

    const expression = formula.substring(1).trim();
    try {
      const tokens = this.tokenizer.tokenize(expression);
      const ast = this.parser.parse(tokens);
      const context = this.createEvaluationContext(row, col);
      const evaluator = new Evaluator(context, this.functionRegistry);
      const rawResult = evaluator.evaluate(ast);

      // 如果结果已经是二维数组，直接返回
      if (Array.isArray(rawResult)) {
        return rawResult as FormulaValue[][];
      }
      // 标量结果包装为 1x1 数组
      return [[rawResult]];
    } catch {
      return [[makeError('#VALUE!', '数组公式计算错误')]];
    }
  }

  /** 获取函数注册表 */
  public getRegistry(): FunctionRegistry {
    return this.functionRegistry;
  }

  /** 获取命名范围管理器 */
  public getNamedRangeManager(): NamedRangeManager {
    return this.namedRangeManager;
  }

  /** 获取数组公式管理器 */
  /**
   * 清除指定单元格的依赖关系（当单元格从公式变为普通值时调用）
   */
  public clearCellDependencies(row: number, col: number): void {
    const cellKey = this.getCellKey(row, col);
    this.depGraph.removeDependencies(cellKey);
    this.formulaCache.delete(cellKey);
  }

  public getArrayFormulaManager(): ArrayFormulaManager {
    return this.arrayFormulaManager;
  }

  /** 注册公式错误回调 */
  public onFormulaError(callback: (message: string) => void): void {
    this.formulaErrorCallbacks.push(callback);
  }


  // ============================================================
  // 旧版公共方法 - 保持向后兼容
  // ============================================================

  public calculateSum(args: string[]): FormulaResult {
    return this.calculateLegacyFunction('SUM', args);
  }

  public calculateSubtract(args: string[]): FormulaResult {
    return this.calculateLegacyFunction('SUBTRACT', args);
  }

  public calculateMultiply(args: string[]): FormulaResult {
    return this.calculateLegacyFunction('MULTIPLY', args);
  }

  public calculateDivide(args: string[]): FormulaResult {
    return this.calculateLegacyFunction('DIVIDE', args);
  }

  // ============================================================
  // 内部辅助方法
  // ============================================================

  private getCellKey(row: number, col: number): string {
    return `${row}-${col}`;
  }

  /** 注册所有函数到 FunctionRegistry */
  private registerAllFunctions(): void {
    // 注册六大函数类别
    registerMathFunctions(this.functionRegistry);
    registerStatisticsFunctions(this.functionRegistry);
    registerTextFunctions(this.functionRegistry);
    registerLogicFunctions(this.functionRegistry);
    registerLookupFunctions(this.functionRegistry);
    registerDateFunctions(this.functionRegistry);

    // 注册 SUM（新管线原生支持）
    this.registerSumFunction();

    // 注册旧版自定义函数（SUBTRACT、MULTIPLY、DIVIDE）
    this.registerLegacyFunctions();
  }

  /** 注册 SUM 函数 */
  private registerSumFunction(): void {
    this.functionRegistry.register({
      name: 'SUM',
      category: 'math' as FunctionCategory,
      description: '对所有参数求和',
      minArgs: 1,
      maxArgs: -1,
      params: [{ name: 'values', description: '数值或区域', type: 'any' }],
      handler: (args: FormulaValue[]): FormulaValue => {
        let sum = 0;
        for (const arg of args) {
          if (isError(arg)) continue;
          if (typeof arg === 'number') {
            sum += arg;
          } else if (typeof arg === 'boolean') {
            sum += arg ? 1 : 0;
          } else if (typeof arg === 'string') {
            const num = Number(arg);
            if (!isNaN(num) && arg.trim() !== '') {
              sum += num;
            }
          } else if (Array.isArray(arg)) {
            // 二维数组（区域引用）
            for (const row of arg as FormulaValue[][]) {
              for (const cell of row) {
                if (typeof cell === 'number') {
                  sum += cell;
                }
                // 区域中的字符串、布尔值被忽略
              }
            }
          }
        }
        return sum;
      },
    });
  }

  /** 注册旧版自定义函数（SUBTRACT、MULTIPLY、DIVIDE） */
  private registerLegacyFunctions(): void {
    // SUBTRACT - 减法
    this.functionRegistry.register({
      name: 'SUBTRACT',
      category: 'math' as FunctionCategory,
      description: '从第一个参数中减去后续参数',
      minArgs: 1,
      maxArgs: -1,
      params: [{ name: 'values', description: '数值或区域', type: 'any' }],
      handler: (args: FormulaValue[]): FormulaValue => {
        const numbers = this.flattenArgsToNumbers(args);
        if (numbers.length === 0) {
          return makeError('#VALUE!', '减法运算至少需要一个数值');
        }
        let result = numbers[0];
        for (let i = 1; i < numbers.length; i++) {
          result -= numbers[i];
        }
        return result;
      },
    });

    // MULTIPLY - 乘法
    this.functionRegistry.register({
      name: 'MULTIPLY',
      category: 'math' as FunctionCategory,
      description: '将所有参数相乘',
      minArgs: 1,
      maxArgs: -1,
      params: [{ name: 'values', description: '数值或区域', type: 'any' }],
      handler: (args: FormulaValue[]): FormulaValue => {
        const numbers = this.flattenArgsToNumbers(args);
        if (numbers.length === 0) {
          return makeError('#VALUE!', '乘法运算至少需要一个数值');
        }
        let result = numbers[0];
        for (let i = 1; i < numbers.length; i++) {
          result *= numbers[i];
        }
        return result;
      },
    });

    // DIVIDE - 除法
    this.functionRegistry.register({
      name: 'DIVIDE',
      category: 'math' as FunctionCategory,
      description: '将第一个参数除以后续参数',
      minArgs: 1,
      maxArgs: -1,
      params: [{ name: 'values', description: '数值或区域', type: 'any' }],
      handler: (args: FormulaValue[]): FormulaValue => {
        const numbers = this.flattenArgsToNumbers(args);
        if (numbers.length === 0) {
          return makeError('#VALUE!', '除法运算至少需要一个数值');
        }
        for (let i = 1; i < numbers.length; i++) {
          if (numbers[i] === 0) {
            return makeError('#DIV/0!', '除数不能为零');
          }
        }
        let result = numbers[0];
        for (let i = 1; i < numbers.length; i++) {
          result /= numbers[i];
        }
        return result;
      },
    });
  }

  /** 将参数列表展平为数字数组（用于旧版函数） */
  private flattenArgsToNumbers(args: FormulaValue[]): number[] {
    const result: number[] = [];
    for (const arg of args) {
      if (isError(arg)) continue;
      if (typeof arg === 'number') {
        result.push(arg);
      } else if (typeof arg === 'boolean') {
        result.push(arg ? 1 : 0);
      } else if (typeof arg === 'string') {
        const num = Number(arg);
        if (!isNaN(num) && arg.trim() !== '') {
          result.push(num);
        }
      } else if (Array.isArray(arg)) {
        for (const row of arg as FormulaValue[][]) {
          for (const cell of row) {
            if (typeof cell === 'number') {
              result.push(cell);
            }
          }
        }
      }
    }
    return result;
  }


  /**
   * 旧版函数计算（通过构造公式字符串走新管线）
   * 用于 calculateSum/calculateSubtract/calculateMultiply/calculateDivide
   */
  private calculateLegacyFunction(funcName: string, args: string[]): FormulaResult {
    // 构造公式字符串并通过新管线求值
    const formula = `=${funcName}(${args.join(',')})`;
    // 使用 row=-1, col=-1 表示非单元格上下文
    return this.evaluateInternal(formula, -1, -1);
  }

  /**
   * 内部求值（不更新依赖图，用于旧版兼容方法）
   */
  private evaluateInternal(formula: string, row: number, col: number): FormulaResult {
    if (!formula.startsWith('=')) {
      return { value: formula, isError: false };
    }

    const expression = formula.substring(1).trim();

    try {
      const tokens = this.tokenizer.tokenize(expression);
      const ast = this.parser.parse(tokens);
      const context = this.createEvaluationContext(row, col);
      const evaluator = new Evaluator(context, this.functionRegistry);
      const rawResult = evaluator.evaluate(ast);
      return this.mapToFormulaResult(rawResult);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '公式计算错误';
      return { value: '#错误!', isError: true, errorMessage: message };
    }
  }

  /** 创建求值上下文 */
  private createEvaluationContext(row: number, col: number): EvaluationContext {
    return {
      row,
      col,
      getCellValue: (r: number, c: number, sheetName?: string): FormulaValue => {
        return this.getCellValueForEval(r, c, sheetName);
      },
      getRangeValues: (range: RangeReferenceNode): FormulaValue[][] => {
        return this.getRangeValuesForEval(range);
      },
      resolveNamedRange: (name: string): RangeReferenceNode | null => {
        const resolved = this.namedRangeManager.resolve(name);
        if (!resolved) return null;
        return resolved.range;
      },
    };
  }

  /**
   * 获取单元格值（供求值上下文使用）
   * 如果单元格内容是公式，递归求值
   */
  private getCellValueForEval(row: number, col: number, sheetName?: string): FormulaValue {
    const content = this.getCellContent(row, col, sheetName);

    if (content === '#REF!') {
      // 跨 Sheet 引用时，#REF! 表示工作表不存在或单元格超出范围
      const msg = sheetName
        ? `引用的工作表 "${sheetName}" 不存在或单元格超出范围`
        : '单元格引用无效';
      return makeError('#REF!', msg);
    }

    // 如果内容是公式，递归求值
    if (content.startsWith('=')) {
      const result = this.evaluate(content, row, col);
      if (result.isError) {
        // 将错误字符串映射回 FormulaError
        return this.stringToFormulaError(String(result.value), result.errorMessage);
      }
      return this.parseResultValue(result.value);
    }

    // 非公式内容：先检查是否是错误字符串（如 #DIV/0!、#VALUE! 等）
    // 这种情况发生在公式计算结果已写入 content 字段时
    const errorResult = this.stringToFormulaError(content);
    if (typeof errorResult === 'object' && errorResult !== null && 'type' in errorResult) {
      return errorResult;
    }

    // 尝试转为数字
    if (content === '') return '';
    const num = Number(content);
    if (!isNaN(num) && content.trim() !== '') {
      return num;
    }
    // 布尔值
    const upper = content.toUpperCase();
    if (upper === 'TRUE') return true;
    if (upper === 'FALSE') return false;

    return content;
  }

  /**
   * 获取区域值（供求值上下文使用）
   */
  private getRangeValuesForEval(range: RangeReferenceNode): FormulaValue[][] {
    const result: FormulaValue[][] = [];
    for (let r = range.startRow; r <= range.endRow; r++) {
      const row: FormulaValue[] = [];
      for (let c = range.startCol; c <= range.endCol; c++) {
        row.push(this.getCellValueForEval(r, c, range.sheetName));
      }
      result.push(row);
    }
    return result;
  }

  /**
   * 获取单元格内容（支持跨 Sheet 引用）
   */
  private getCellContent(row: number, col: number, sheetName?: string): string {
    if (sheetName) {
      if (!this.sheetCellGetter) {
        return '#REF!';
      }
      const cell = this.sheetCellGetter(sheetName, row, col);
      if (cell === null) {
        return '#REF!';
      }
      return cell.content ?? '';
    }
    const cell = this.cellGetter?.(row, col);
    return cell?.content ?? '';
  }

  /** 将 FormulaValue 映射为 FormulaResult */
  private mapToFormulaResult(value: FormulaValue): FormulaResult {
    if (isError(value)) {
      return {
        value: value.type,
        isError: true,
        errorMessage: value.message,
      };
    }
    if (typeof value === 'boolean') {
      return { value: value ? 'TRUE' : 'FALSE', isError: false };
    }
    if (typeof value === 'number') {
      return { value, isError: false };
    }
    if (typeof value === 'string') {
      return { value, isError: false };
    }
    // 数组结果：取左上角值
    if (Array.isArray(value) && value.length > 0) {
      const firstRow = value[0] as FormulaValue[];
      if (Array.isArray(firstRow) && firstRow.length > 0) {
        return this.mapToFormulaResult(firstRow[0]);
      }
    }
    return { value: String(value), isError: false };
  }

  /** 将错误字符串转为 FormulaError */
  private stringToFormulaError(errorStr: string, message?: string): FormulaValue {
    const errorTypes = ['#VALUE!', '#REF!', '#DIV/0!', '#NAME?', '#NUM!', '#N/A', '#NULL!'] as const;
    for (const errType of errorTypes) {
      if (errorStr === errType) {
        return makeError(errType, message ?? errorStr);
      }
    }
    // 旧版中文错误
    if (errorStr === '#错误!') {
      return makeError('#VALUE!', message ?? '公式错误');
    }
    return errorStr;
  }

  /** 将结果值解析为适当的 FormulaValue 类型 */
  private parseResultValue(value: number | string): FormulaValue {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // 尝试转为数字
      const num = Number(value);
      if (!isNaN(num) && value.trim() !== '') return num;
      // 布尔值
      const upper = value.toUpperCase();
      if (upper === 'TRUE') return true;
      if (upper === 'FALSE') return false;
      return value;
    }
    return value;
  }

  /** 从 AST 提取依赖的单元格 */
  private extractDependenciesFromAST(node: ASTNode): Dependency[] {
    const deps: Dependency[] = [];
    this.walkAST(node, deps);
    return deps;
  }

  /** 递归遍历 AST 收集单元格引用 */
  private walkAST(node: ASTNode, deps: Dependency[]): void {
    switch (node.type) {
      case 'CellReference':
        deps.push({ row: node.row, col: node.col });
        break;
      case 'RangeReference':
        // 命名范围（startRow === -1）不直接产生依赖，在求值时解析
        if (node.startRow >= 0) {
          for (let r = node.startRow; r <= node.endRow; r++) {
            for (let c = node.startCol; c <= node.endCol; c++) {
              deps.push({ row: r, col: c });
            }
          }
        }
        break;
      case 'FunctionCall':
        for (const arg of node.args) {
          this.walkAST(arg, deps);
        }
        break;
      case 'BinaryExpression':
        this.walkAST(node.left, deps);
        this.walkAST(node.right, deps);
        break;
      case 'UnaryExpression':
        this.walkAST(node.operand, deps);
        break;
      case 'ArrayLiteral':
        for (const row of node.elements) {
          for (const elem of row) {
            this.walkAST(elem, deps);
          }
        }
        break;
      // 字面量节点无依赖
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
        break;
    }
  }

  /** 更新旧版依赖图（保持 getDependents/getAffectedCells 兼容） */
  private updateDependencyGraphs(cellKey: string, dependencies: Dependency[]): void {
    // 清除旧的反向依赖
    const oldDeps = this.dependencyGraph.get(cellKey);
    if (oldDeps) {
      for (const depKey of oldDeps) {
        const dependents = this.dependentsGraph.get(depKey);
        if (dependents) {
          dependents.delete(cellKey);
          if (dependents.size === 0) {
            this.dependentsGraph.delete(depKey);
          }
        }
      }
    }

    // 设置新的正向依赖
    const newDeps = new Set<string>();
    for (const dep of dependencies) {
      const depKey = this.getCellKey(dep.row, dep.col);
      newDeps.add(depKey);

      // 更新反向依赖
      if (!this.dependentsGraph.has(depKey)) {
        this.dependentsGraph.set(depKey, new Set());
      }
      this.dependentsGraph.get(depKey)!.add(cellKey);
    }
    this.dependencyGraph.set(cellKey, newDeps);
  }

  /** 通知公式错误 */
  private notifyFormulaError(message: string): void {
    for (const callback of this.formulaErrorCallbacks) {
      callback(message);
    }
  }



}
