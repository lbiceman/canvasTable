/**
 * SparseGrid - 稀疏网格存储
 *
 * 提供与 Cell[][] 兼容的接口，但内部使用 Map<string, Cell> 存储，
 * 空单元格不分配内存，按需创建。
 *
 * 通过 Proxy 实现 `grid[row][col]` 的二维数组访问语法，
 * 对外行为与密集数组完全一致，对内使用稀疏 Map 存储。
 *
 * 性能优化：P5 内存占用优化
 */

import type { Cell } from './types';

/** 默认空单元格（冻结对象，用于类型检查参考） */
export const DEFAULT_CELL: Readonly<Cell> = Object.freeze({
  content: '',
  rowSpan: 1,
  colSpan: 1,
  isMerged: false,
});

/** 生成稀疏存储 key */
function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * SparseRow - 稀疏行代理
 * 拦截列索引访问，从 SparseGrid 的 Map 中读写数据
 */
class SparseRowHandler implements ProxyHandler<Cell[]> {
  private grid: SparseGrid;
  private row: number;

  constructor(grid: SparseGrid, row: number) {
    this.grid = grid;
    this.row = row;
  }

  get(_target: Cell[], prop: string | symbol): unknown {
    // 处理数组方法和属性
    if (prop === 'length') {
      return this.grid.colCount;
    }
    if (prop === 'splice') {
      return (...args: unknown[]) => this.grid.spliceCol(this.row, args);
    }
    if (prop === Symbol.iterator) {
      return this.createIterator.bind(this);
    }

    // 数字索引：列访问
    const col = typeof prop === 'string' ? parseInt(prop, 10) : NaN;
    if (!isNaN(col)) {
      return this.grid.getCell(this.row, col);
    }

    // 其他属性回退到空数组原型
    return undefined;
  }

  set(_target: Cell[], prop: string | symbol, value: Cell): boolean {
    const col = typeof prop === 'string' ? parseInt(prop, 10) : NaN;
    if (!isNaN(col)) {
      this.grid.setCell(this.row, col, value);
      return true;
    }
    return true;
  }

  has(_target: Cell[], prop: string | symbol): boolean {
    const col = typeof prop === 'string' ? parseInt(prop, 10) : NaN;
    if (!isNaN(col)) {
      return col >= 0 && col < this.grid.colCount;
    }
    return prop in [];
  }

  private *createIterator(): IterableIterator<Cell> {
    for (let c = 0; c < this.grid.colCount; c++) {
      yield this.grid.getCell(this.row, c);
    }
  }
}

/**
 * SparseGridHandler - 稀疏网格代理
 * 拦截行索引访问，返回 SparseRow 代理
 */
class SparseGridHandler implements ProxyHandler<Cell[][]> {
  private grid: SparseGrid;
  /** 行代理缓存，避免重复创建 Proxy */
  private rowProxies: Map<number, Cell[]> = new Map();

  constructor(grid: SparseGrid) {
    this.grid = grid;
  }

  get(_target: Cell[][], prop: string | symbol): unknown {
    // 数组属性
    if (prop === 'length') {
      return this.grid.rowCount;
    }
    if (prop === 'splice') {
      return (...args: unknown[]) => this.grid.spliceRow(args);
    }
    if (prop === Symbol.iterator) {
      return this.createIterator.bind(this);
    }
    if (prop === 'push') {
      return (..._args: unknown[]) => {
        // expandRows 中的 push 操作：只增加行数计数
        this.grid.rowCount++;
        return this.grid.rowCount;
      };
    }

    // 数字索引：行访问
    const row = typeof prop === 'string' ? parseInt(prop, 10) : NaN;
    if (!isNaN(row)) {
      return this.getRowProxy(row);
    }

    return undefined;
  }

  set(_target: Cell[][], prop: string | symbol, value: unknown): boolean {
    const row = typeof prop === 'string' ? parseInt(prop, 10) : NaN;
    if (!isNaN(row)) {
      // 赋值整行（如 data.cells[i] = []）：清除该行所有数据
      if (Array.isArray(value) && value.length === 0) {
        this.grid.clearRow(row);
        // 确保行数足够
        if (row >= this.grid.rowCount) {
          this.grid.rowCount = row + 1;
        }
        return true;
      }
      return true;
    }
    if (prop === 'length') {
      // 设置 length（如 splice 后自动调整）
      this.grid.rowCount = value as number;
      return true;
    }
    return true;
  }

  has(_target: Cell[][], prop: string | symbol): boolean {
    const row = typeof prop === 'string' ? parseInt(prop, 10) : NaN;
    if (!isNaN(row)) {
      return row >= 0 && row < this.grid.rowCount;
    }
    return prop in [];
  }

  private getRowProxy(row: number): Cell[] {
    let proxy = this.rowProxies.get(row);
    if (!proxy) {
      const handler = new SparseRowHandler(this.grid, row);
      proxy = new Proxy([] as Cell[], handler);
      this.rowProxies.set(row, proxy);
    }
    return proxy;
  }

  private *createIterator(): IterableIterator<Cell[]> {
    for (let r = 0; r < this.grid.rowCount; r++) {
      yield this.getRowProxy(r);
    }
  }
}

/**
 * SparseGrid - 稀疏网格核心存储
 *
 * 内部使用 Map<string, Cell> 存储非空单元格，
 * 通过 Proxy 对外暴露 Cell[][] 接口，完全兼容现有代码。
 */
export class SparseGrid {
  /** 稀疏存储：仅保存非空/非默认单元格 */
  private store: Map<string, Cell> = new Map();

  /** 逻辑行数 */
  public rowCount: number;

  /** 逻辑列数 */
  public colCount: number;

  constructor(rows: number, cols: number) {
    this.rowCount = rows;
    this.colCount = cols;
  }

  /** 获取单元格，空位置返回新的默认 Cell 对象（可写） */
  getCell(row: number, col: number): Cell {
    const key = cellKey(row, col);
    const cell = this.store.get(key);
    if (cell) return cell;

    // 返回新的可写默认 Cell（因为调用方可能修改属性）
    // 但不存入 store，只有显式 setCell 才存储
    // 注意：这里需要返回一个可写对象，但不自动持久化
    // 为了兼容现有代码中 `cell.fontColor = color` 的写法，
    // 我们使用 Proxy 拦截属性写入，在首次写入时自动存入 store
    const defaultCell: Cell = {
      content: '',
      rowSpan: 1,
      colSpan: 1,
      isMerged: false,
    };

    // 创建写入拦截代理：首次设置非默认属性时自动存入 store
    const self = this;
    const proxy = new Proxy(defaultCell, {
      set(target: Cell, prop: string | symbol, value: unknown): boolean {
        (target as unknown as Record<string | symbol, unknown>)[prop] = value;
        // 任何属性写入都将此 Cell 持久化到 store
        self.store.set(key, target);
        return true;
      }
    });

    return proxy;
  }

  /** 设置单元格 */
  setCell(row: number, col: number, cell: Cell): void {
    const key = cellKey(row, col);
    // 检查是否为默认空单元格，如果是则不存储
    if (this.isDefaultCell(cell)) {
      this.store.delete(key);
    } else {
      this.store.set(key, cell);
    }
  }

  /** 检查是否为默认空单元格 */
  private isDefaultCell(cell: Cell): boolean {
    return (
      cell.content === '' &&
      cell.rowSpan === 1 &&
      cell.colSpan === 1 &&
      !cell.isMerged &&
      !cell.mergeParent &&
      !cell.fontColor &&
      !cell.bgColor &&
      !cell.fontSize &&
      !cell.fontBold &&
      !cell.fontItalic &&
      !cell.fontUnderline &&
      !cell.fontAlign &&
      !cell.verticalAlign &&
      !cell.formulaContent &&
      !cell.format &&
      !cell.richText &&
      !cell.wrapText &&
      !cell.validation &&
      !cell.sparkline &&
      !cell.hyperlink &&
      !cell.border &&
      !cell.fontFamily &&
      !cell.fontStrikethrough &&
      !cell.embeddedImage &&
      !cell.comment &&
      !cell.isArrayFormula &&
      !cell.dataType
    );
  }

  /** 清除指定行所有数据 */
  clearRow(row: number): void {
    // 删除该行所有列的数据
    const prefix = `${row},`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** 行 splice 操作（删除/插入行） */
  spliceRow(args: unknown[]): Cell[][] {
    const start = args[0] as number;
    const deleteCount = args[1] as number;

    if (deleteCount > 0) {
      // 删除行：移除 store 中对应行的数据，并将后续行的 key 前移
      const newStore = new Map<string, Cell>();

      for (const [key, cell] of this.store) {
        const [r, c] = key.split(',').map(Number);
        if (r >= start && r < start + deleteCount) {
          // 被删除的行，跳过
          continue;
        }
        if (r >= start + deleteCount) {
          // 后续行前移
          newStore.set(cellKey(r - deleteCount, c), cell);
        } else {
          newStore.set(key, cell);
        }
      }

      this.store = newStore;
      this.rowCount -= deleteCount;
    }

    return [];
  }

  /** 列 splice 操作（删除/插入列） */
  spliceCol(row: number, args: unknown[]): Cell[] {
    const start = args[0] as number;
    const deleteCount = (args[1] as number) || 0;

    if (deleteCount > 0) {
      // 删除列：移除该行中对应列的数据，并将后续列的 key 前移
      const rowPrefix = `${row},`;
      const keysToDelete: string[] = [];
      const keysToShift: Array<{ oldKey: string; newKey: string; cell: Cell }> = [];

      for (const [key, cell] of this.store) {
        if (!key.startsWith(rowPrefix)) continue;
        const col = parseInt(key.split(',')[1], 10);
        if (col >= start && col < start + deleteCount) {
          keysToDelete.push(key);
        } else if (col >= start + deleteCount) {
          keysToShift.push({
            oldKey: key,
            newKey: cellKey(row, col - deleteCount),
            cell,
          });
        }
      }

      for (const k of keysToDelete) this.store.delete(k);
      for (const { oldKey, newKey, cell } of keysToShift) {
        this.store.delete(oldKey);
        this.store.set(newKey, cell);
      }
    }

    // 处理插入（splice 的第 3+ 参数）
    if (args.length > 2) {
      const insertCount = args.length - 2;
      // 将后续列后移
      const rowPrefix = `${row},`;
      const keysToShift: Array<{ oldKey: string; newKey: string; cell: Cell }> = [];

      for (const [key, cell] of this.store) {
        if (!key.startsWith(rowPrefix)) continue;
        const col = parseInt(key.split(',')[1], 10);
        if (col >= start) {
          keysToShift.push({
            oldKey: key,
            newKey: cellKey(row, col + insertCount),
            cell,
          });
        }
      }

      // 从后往前移动，避免覆盖
      keysToShift.sort((a, b) => {
        const colA = parseInt(a.oldKey.split(',')[1], 10);
        const colB = parseInt(b.oldKey.split(',')[1], 10);
        return colB - colA;
      });

      for (const { oldKey, newKey, cell } of keysToShift) {
        this.store.delete(oldKey);
        this.store.set(newKey, cell);
      }

      // 插入新单元格
      for (let i = 0; i < insertCount; i++) {
        const newCell = args[2 + i] as Cell;
        if (newCell && !this.isDefaultCell(newCell)) {
          this.store.set(cellKey(row, start + i), newCell);
        }
      }
    }

    return [];
  }

  /** 创建 Cell[][] 兼容的 Proxy */
  createProxy(): Cell[][] {
    const handler = new SparseGridHandler(this);
    return new Proxy([] as Cell[][], handler);
  }

  /** 获取存储的非空单元格数量（用于调试/统计） */
  get size(): number {
    return this.store.size;
  }

  /** 遍历所有非空单元格 */
  forEach(callback: (row: number, col: number, cell: Cell) => void): void {
    for (const [key, cell] of this.store) {
      const [r, c] = key.split(',').map(Number);
      callback(r, c, cell);
    }
  }

  /** 检查指定位置是否有非空单元格 */
  has(row: number, col: number): boolean {
    return this.store.has(cellKey(row, col));
  }

  /** 直接获取存储的 Cell（不创建代理，用于性能敏感路径） */
  getRaw(row: number, col: number): Cell | undefined {
    return this.store.get(cellKey(row, col));
  }
}
