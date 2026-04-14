// ============================================================
// 查找引用函数：VLOOKUP, HLOOKUP, INDEX, MATCH, OFFSET, INDIRECT,
//               XLOOKUP, CHOOSE, ROW, COLUMN, ROWS, COLUMNS, TRANSPOSE
// ============================================================

import type { FunctionRegistry } from '../function-registry';
import type { FormulaValue, FormulaError, EvaluationContext } from '../types';
import { isError, makeError } from '../evaluator';

// ============================================================
// 内部辅助函数
// ============================================================

/** 将 FormulaValue 转换为数字，失败时返回 FormulaError */
function toNumber(value: FormulaValue): number | FormulaError {
  if (isError(value)) return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    if (value.trim() === '') return 0;
    const num = Number(value);
    if (isNaN(num)) {
      return makeError('#VALUE!', `无法将 "${value}" 转换为数字`);
    }
    return num;
  }
  return makeError('#VALUE!', '无法将数组转换为数字');
}

/** 将 FormulaValue 转换为布尔值 */
function toBool(value: FormulaValue): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  // 默认 TRUE（VLOOKUP/HLOOKUP 的 range_lookup 默认行为）
  return true;
}

/**
 * 比较两个标量值，用于查找匹配
 * 返回负数表示 a < b，0 表示相等，正数表示 a > b
 * 字符串比较不区分大小写
 */
function compareValues(a: FormulaValue, b: FormulaValue): number {
  // 同为数字
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  // 同为字符串（不区分大小写）
  if (typeof a === 'string' && typeof b === 'string') {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    if (la < lb) return -1;
    if (la > lb) return 1;
    return 0;
  }
  // 混合类型：尝试都转为数字比较
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (!isError(numA) && !isError(numB)) {
    return numA - numB;
  }
  // 无法比较，转为字符串比较
  const strA = String(a).toLowerCase();
  const strB = String(b).toLowerCase();
  if (strA < strB) return -1;
  if (strA > strB) return 1;
  return 0;
}

/** 判断两个值是否精确相等（字符串不区分大小写） */
function isExactMatch(a: FormulaValue, b: FormulaValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase() === b.toLowerCase();
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
  // 混合类型：尝试数字比较
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (!isError(numA) && !isError(numB)) return numA === numB;
  return false;
}

/**
 * 确保参数是二维数组（区域引用）
 * 如果不是二维数组，返回 null
 */
function ensureArray(value: FormulaValue): FormulaValue[][] | null {
  if (Array.isArray(value)) {
    return value as FormulaValue[][];
  }
  return null;
}

/**
 * 将行序列化为字符串键（用于 UNIQUE 去重比较）
 */
function rowToKey(row: FormulaValue[]): string {
  return row.map(v => {
    if (v === null || v === undefined) return '\x00null';
    if (typeof v === 'string') return `s:${v.toLowerCase()}`;
    if (typeof v === 'number') return `n:${v}`;
    if (typeof v === 'boolean') return `b:${v}`;
    return `o:${String(v)}`;
  }).join('\x01');
}

/**
 * 获取唯一行（用于 UNIQUE 函数）
 * @param arr 二维数组
 * @param exactlyOnce 是否仅返回出现恰好一次的行
 */
function getUniqueRows(arr: FormulaValue[][], exactlyOnce: boolean): FormulaValue[][] {
  const keyCount = new Map<string, number>();
  const keyToFirstRow = new Map<string, FormulaValue[]>();

  for (const row of arr) {
    const key = rowToKey(row);
    keyCount.set(key, (keyCount.get(key) || 0) + 1);
    if (!keyToFirstRow.has(key)) {
      keyToFirstRow.set(key, row);
    }
  }

  const result: FormulaValue[][] = [];
  const seen = new Set<string>();
  for (const row of arr) {
    const key = rowToKey(row);
    if (exactlyOnce) {
      // 仅返回出现恰好一次的行
      if (keyCount.get(key) === 1) {
        result.push([...row]);
      }
    } else {
      // 返回去重后的行（保留首次出现）
      if (!seen.has(key)) {
        seen.add(key);
        result.push([...row]);
      }
    }
  }
  return result;
}

/**
 * 将二维数组展平为一维数组（用于 MATCH 的 lookup_array）
 * 如果是单行或单列区域，返回一维数组
 */
function flattenToOneDimension(arr: FormulaValue[][]): FormulaValue[] {
  if (arr.length === 0) return [];
  // 单行区域
  if (arr.length === 1) return arr[0];
  // 单列区域
  if (arr[0].length === 1) return arr.map(row => row[0]);
  // 多行多列：取第一列
  return arr.map(row => row[0]);
}

/**
 * 解析 A1 格式的单元格引用字符串为行列坐标
 * 返回 { row, col } 或 null（无效引用）
 */
function parseA1Reference(refStr: string): { row: number; col: number } | null {
  // 去除前后空格和 $ 符号
  const cleaned = refStr.trim().replace(/\$/g, '');
  const match = cleaned.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;

  const colStr = match[1].toUpperCase();
  const rowNum = parseInt(match[2], 10);
  if (rowNum < 1) return null;

  // 将列字母转换为列号（A=0, B=1, ..., Z=25, AA=26, ...）
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  col -= 1; // 转为 0-based

  const row = rowNum - 1; // 转为 0-based
  return { row, col };
}

// ============================================================
// 注册函数
// ============================================================

/** 将所有查找引用函数注册到 FunctionRegistry */
export function registerLookupFunctions(registry: FunctionRegistry): void {

  // VLOOKUP - 垂直查找
  registry.register({
    name: 'VLOOKUP',
    category: 'lookup',
    description: '在区域第一列中查找值，返回同行指定列的值',
    minArgs: 3,
    maxArgs: 4,
    params: [
      { name: 'lookup_value', description: '要查找的值', type: 'any' },
      { name: 'table_array', description: '查找区域（二维数组）', type: 'range' },
      { name: 'col_index_num', description: '返回值所在列号（从 1 开始）', type: 'number' },
      { name: 'range_lookup', description: 'TRUE=近似匹配，FALSE=精确匹配', type: 'boolean', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const lookupValue = args[0];
      if (isError(lookupValue)) return lookupValue;

      const tableArray = ensureArray(args[1]);
      if (!tableArray || tableArray.length === 0) {
        return makeError('#VALUE!', 'VLOOKUP 的第二个参数必须是区域引用');
      }

      const colIndexRaw = toNumber(args[2]);
      if (isError(colIndexRaw)) return colIndexRaw;
      const colIndex = Math.floor(colIndexRaw);

      // 列号越界检查
      if (colIndex < 1 || colIndex > tableArray[0].length) {
        return makeError('#REF!', `VLOOKUP 列号 ${colIndex} 超出区域范围`);
      }

      // 默认近似匹配
      const rangeLookup = args.length >= 4 ? toBool(args[3]) : true;

      if (rangeLookup) {
        // 近似匹配：在第一列中找到小于等于 lookup_value 的最大值
        let bestRow = -1;
        for (let i = 0; i < tableArray.length; i++) {
          const cellValue = tableArray[i][0];
          if (isError(cellValue)) continue;
          const cmp = compareValues(cellValue, lookupValue);
          if (cmp <= 0) {
            bestRow = i;
          } else {
            // 假设已排序，遇到大于目标值的就停止
            break;
          }
        }
        if (bestRow === -1) {
          return makeError('#N/A', 'VLOOKUP 未找到匹配值');
        }
        return tableArray[bestRow][colIndex - 1];
      } else {
        // 精确匹配：在第一列中找到完全相等的值
        for (let i = 0; i < tableArray.length; i++) {
          const cellValue = tableArray[i][0];
          if (isError(cellValue)) continue;
          if (isExactMatch(cellValue, lookupValue)) {
            return tableArray[i][colIndex - 1];
          }
        }
        return makeError('#N/A', 'VLOOKUP 未找到匹配值');
      }
    },
  });

  // HLOOKUP - 水平查找
  registry.register({
    name: 'HLOOKUP',
    category: 'lookup',
    description: '在区域第一行中查找值，返回同列指定行的值',
    minArgs: 3,
    maxArgs: 4,
    params: [
      { name: 'lookup_value', description: '要查找的值', type: 'any' },
      { name: 'table_array', description: '查找区域（二维数组）', type: 'range' },
      { name: 'row_index_num', description: '返回值所在行号（从 1 开始）', type: 'number' },
      { name: 'range_lookup', description: 'TRUE=近似匹配，FALSE=精确匹配', type: 'boolean', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const lookupValue = args[0];
      if (isError(lookupValue)) return lookupValue;

      const tableArray = ensureArray(args[1]);
      if (!tableArray || tableArray.length === 0) {
        return makeError('#VALUE!', 'HLOOKUP 的第二个参数必须是区域引用');
      }

      const rowIndexRaw = toNumber(args[2]);
      if (isError(rowIndexRaw)) return rowIndexRaw;
      const rowIndex = Math.floor(rowIndexRaw);

      // 行号越界检查
      if (rowIndex < 1 || rowIndex > tableArray.length) {
        return makeError('#REF!', `HLOOKUP 行号 ${rowIndex} 超出区域范围`);
      }

      // 默认近似匹配
      const rangeLookup = args.length >= 4 ? toBool(args[3]) : true;
      const firstRow = tableArray[0];

      if (rangeLookup) {
        // 近似匹配：在第一行中找到小于等于 lookup_value 的最大值
        let bestCol = -1;
        for (let j = 0; j < firstRow.length; j++) {
          const cellValue = firstRow[j];
          if (isError(cellValue)) continue;
          const cmp = compareValues(cellValue, lookupValue);
          if (cmp <= 0) {
            bestCol = j;
          } else {
            break;
          }
        }
        if (bestCol === -1) {
          return makeError('#N/A', 'HLOOKUP 未找到匹配值');
        }
        return tableArray[rowIndex - 1][bestCol];
      } else {
        // 精确匹配
        for (let j = 0; j < firstRow.length; j++) {
          const cellValue = firstRow[j];
          if (isError(cellValue)) continue;
          if (isExactMatch(cellValue, lookupValue)) {
            return tableArray[rowIndex - 1][j];
          }
        }
        return makeError('#N/A', 'HLOOKUP 未找到匹配值');
      }
    },
  });

  // INDEX - 索引取值
  registry.register({
    name: 'INDEX',
    category: 'lookup',
    description: '返回区域中指定行列交叉处的值',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'array', description: '数据区域（二维数组）', type: 'range' },
      { name: 'row_num', description: '行号（从 1 开始，0 表示整列）', type: 'number' },
      { name: 'col_num', description: '列号（从 1 开始，0 表示整行）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const arr = ensureArray(args[0]);
      if (!arr || arr.length === 0) {
        return makeError('#VALUE!', 'INDEX 的第一个参数必须是区域引用');
      }

      const rowNumRaw = toNumber(args[1]);
      if (isError(rowNumRaw)) return rowNumRaw;
      const rowNum = Math.floor(rowNumRaw);

      const colNumRaw = args.length >= 3 ? toNumber(args[2]) : 1;
      if (isError(colNumRaw)) return colNumRaw;
      const colNum = Math.floor(colNumRaw as number);

      const totalRows = arr.length;
      const totalCols = arr[0].length;

      // row_num 为 0：返回整列
      if (rowNum === 0 && colNum >= 1 && colNum <= totalCols) {
        return arr.map(row => [row[colNum - 1]]);
      }

      // col_num 为 0：返回整行
      if (colNum === 0 && rowNum >= 1 && rowNum <= totalRows) {
        return [arr[rowNum - 1]];
      }

      // 越界检查
      if (rowNum < 1 || rowNum > totalRows || colNum < 1 || colNum > totalCols) {
        return makeError('#REF!', `INDEX 行号 ${rowNum} 或列号 ${colNum} 超出区域范围`);
      }

      return arr[rowNum - 1][colNum - 1];
    },
  });

  // MATCH - 匹配查找
  registry.register({
    name: 'MATCH',
    category: 'lookup',
    description: '返回查找值在区域中的相对位置（从 1 开始）',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'lookup_value', description: '要查找的值', type: 'any' },
      { name: 'lookup_array', description: '查找区域（一维数组）', type: 'range' },
      { name: 'match_type', description: '0=精确匹配，1=小于等于（默认），-1=大于等于', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const lookupValue = args[0];
      if (isError(lookupValue)) return lookupValue;

      // 获取一维查找数组
      let lookupArray: FormulaValue[];
      const rawArray = args[1];
      if (Array.isArray(rawArray)) {
        lookupArray = flattenToOneDimension(rawArray as FormulaValue[][]);
      } else {
        // 单个值包装为数组
        lookupArray = [rawArray];
      }

      const matchTypeRaw = args.length >= 3 ? toNumber(args[2]) : 1;
      if (isError(matchTypeRaw)) return matchTypeRaw;
      const matchType = Math.floor(matchTypeRaw as number);

      if (matchType === 0) {
        // 精确匹配
        for (let i = 0; i < lookupArray.length; i++) {
          if (isError(lookupArray[i])) continue;
          if (isExactMatch(lookupArray[i], lookupValue)) {
            return i + 1; // 1-based
          }
        }
        return makeError('#N/A', 'MATCH 未找到匹配值');
      } else if (matchType === 1) {
        // 小于等于：假设升序排列，找到小于等于 lookup_value 的最大值
        let bestIndex = -1;
        for (let i = 0; i < lookupArray.length; i++) {
          if (isError(lookupArray[i])) continue;
          const cmp = compareValues(lookupArray[i], lookupValue);
          if (cmp <= 0) {
            bestIndex = i;
          } else {
            break;
          }
        }
        if (bestIndex === -1) {
          return makeError('#N/A', 'MATCH 未找到匹配值');
        }
        return bestIndex + 1;
      } else {
        // match_type === -1：大于等于：假设降序排列，找到大于等于 lookup_value 的最小值
        let bestIndex = -1;
        for (let i = 0; i < lookupArray.length; i++) {
          if (isError(lookupArray[i])) continue;
          const cmp = compareValues(lookupArray[i], lookupValue);
          if (cmp >= 0) {
            bestIndex = i;
          } else {
            break;
          }
        }
        if (bestIndex === -1) {
          return makeError('#N/A', 'MATCH 未找到匹配值');
        }
        return bestIndex + 1;
      }
    },
  });

  // OFFSET - 偏移引用
  registry.register({
    name: 'OFFSET',
    category: 'lookup',
    description: '返回从基准位置偏移指定行列后的单元格值',
    minArgs: 3,
    maxArgs: 5,
    params: [
      { name: 'reference', description: '基准单元格的值', type: 'any' },
      { name: 'rows', description: '行偏移量', type: 'number' },
      { name: 'cols', description: '列偏移量', type: 'number' },
      { name: 'height', description: '返回区域的高度', type: 'number', optional: true },
      { name: 'width', description: '返回区域的宽度', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[], context: EvaluationContext): FormulaValue => {
      const rowsRaw = toNumber(args[1]);
      if (isError(rowsRaw)) return rowsRaw;
      const rows = Math.floor(rowsRaw);

      const colsRaw = toNumber(args[2]);
      if (isError(colsRaw)) return colsRaw;
      const cols = Math.floor(colsRaw);

      // 使用当前公式所在单元格作为基准位置
      const targetRow = context.row + rows;
      const targetCol = context.col + cols;

      // 越界检查
      if (targetRow < 0 || targetCol < 0) {
        return makeError('#REF!', 'OFFSET 偏移后的位置超出有效范围');
      }

      // 如果指定了 height 和 width，返回区域
      if (args.length >= 5) {
        const heightRaw = toNumber(args[3]);
        if (isError(heightRaw)) return heightRaw;
        const height = Math.floor(heightRaw);

        const widthRaw = toNumber(args[4]);
        if (isError(widthRaw)) return widthRaw;
        const width = Math.floor(widthRaw);

        if (height < 1 || width < 1) {
          return makeError('#REF!', 'OFFSET 的高度和宽度必须大于 0');
        }

        const result: FormulaValue[][] = [];
        for (let r = 0; r < height; r++) {
          const row: FormulaValue[] = [];
          for (let c = 0; c < width; c++) {
            row.push(context.getCellValue(targetRow + r, targetCol + c));
          }
          result.push(row);
        }
        return result;
      }

      // 如果只有 height 没有 width
      if (args.length === 4) {
        const heightRaw = toNumber(args[3]);
        if (isError(heightRaw)) return heightRaw;
        const height = Math.floor(heightRaw);

        if (height < 1) {
          return makeError('#REF!', 'OFFSET 的高度必须大于 0');
        }

        if (height === 1) {
          return context.getCellValue(targetRow, targetCol);
        }

        const result: FormulaValue[][] = [];
        for (let r = 0; r < height; r++) {
          result.push([context.getCellValue(targetRow + r, targetCol)]);
        }
        return result;
      }

      // 默认返回单个单元格值
      return context.getCellValue(targetRow, targetCol);
    },
  });

  // INDIRECT - 间接引用
  registry.register({
    name: 'INDIRECT',
    category: 'lookup',
    description: '将文本字符串解析为单元格引用并返回该单元格的值',
    minArgs: 1,
    maxArgs: 2,
    params: [
      { name: 'ref_text', description: '单元格引用的文本字符串（如 "A1"）', type: 'string' },
      { name: 'a1', description: '引用样式，TRUE=A1 样式（默认）', type: 'boolean', optional: true },
    ],
    handler: (args: FormulaValue[], context: EvaluationContext): FormulaValue => {
      const refText = args[0];
      if (isError(refText)) return refText;

      if (typeof refText !== 'string') {
        return makeError('#REF!', 'INDIRECT 的参数必须是字符串');
      }

      // 解析 A1 格式的引用
      const parsed = parseA1Reference(refText);
      if (!parsed) {
        return makeError('#REF!', `INDIRECT 无法解析引用: "${refText}"`);
      }

      return context.getCellValue(parsed.row, parsed.col);
    },
  });

  // XLOOKUP - 增强版查找
  registry.register({
    name: 'XLOOKUP',
    category: 'lookup',
    description: '在查找区域中搜索匹配值，返回对应返回区域中的值',
    minArgs: 3,
    maxArgs: 6,
    params: [
      { name: 'lookup_value', description: '要查找的值', type: 'any' },
      { name: 'lookup_array', description: '查找区域', type: 'range' },
      { name: 'return_array', description: '返回区域', type: 'range' },
      { name: 'if_not_found', description: '未找到时的返回值', type: 'any', optional: true },
      { name: 'match_mode', description: '0=精确（默认），-1=精确或下一个较小，1=精确或下一个较大，2=通配符', type: 'number', optional: true },
      { name: 'search_mode', description: '1=从头搜索（默认），-1=从尾搜索', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const lookupValue = args[0];
      if (isError(lookupValue)) return lookupValue;

      // 获取查找数组
      let lookupArray: FormulaValue[];
      const rawLookup = args[1];
      if (Array.isArray(rawLookup)) {
        lookupArray = flattenToOneDimension(rawLookup as FormulaValue[][]);
      } else {
        lookupArray = [rawLookup];
      }

      // 获取返回数组
      const rawReturn = args[2];
      let returnArray: FormulaValue[];
      if (Array.isArray(rawReturn)) {
        returnArray = flattenToOneDimension(rawReturn as FormulaValue[][]);
      } else {
        returnArray = [rawReturn];
      }

      const ifNotFound = args.length >= 4 ? args[3] : makeError('#N/A', 'XLOOKUP 未找到匹配值');
      const matchMode = args.length >= 5 ? toNumber(args[4]) : 0;
      if (isError(matchMode)) return matchMode;
      const searchMode = args.length >= 6 ? toNumber(args[5]) : 1;
      if (isError(searchMode)) return searchMode;

      const matchModeInt = Math.floor(matchMode as number);
      const searchModeInt = Math.floor(searchMode as number);

      // 确定搜索方向
      const forward = searchModeInt >= 0;
      const start = forward ? 0 : lookupArray.length - 1;
      const end = forward ? lookupArray.length : -1;
      const step = forward ? 1 : -1;

      // 精确匹配
      if (matchModeInt === 0 || matchModeInt === 2) {
        for (let i = start; i !== end; i += step) {
          if (isError(lookupArray[i])) continue;
          if (isExactMatch(lookupArray[i], lookupValue)) {
            return i < returnArray.length ? returnArray[i] : makeError('#N/A', 'XLOOKUP 返回区域索引越界');
          }
        }
        return ifNotFound;
      }

      // 近似匹配：-1=下一个较小，1=下一个较大
      let bestIndex = -1;
      for (let i = 0; i < lookupArray.length; i++) {
        if (isError(lookupArray[i])) continue;
        const cmp = compareValues(lookupArray[i], lookupValue);
        if (cmp === 0) {
          return i < returnArray.length ? returnArray[i] : makeError('#N/A', 'XLOOKUP 返回区域索引越界');
        }
        if (matchModeInt === -1 && cmp < 0) {
          if (bestIndex === -1 || compareValues(lookupArray[i], lookupArray[bestIndex]) > 0) {
            bestIndex = i;
          }
        } else if (matchModeInt === 1 && cmp > 0) {
          if (bestIndex === -1 || compareValues(lookupArray[i], lookupArray[bestIndex]) < 0) {
            bestIndex = i;
          }
        }
      }

      if (bestIndex !== -1) {
        return bestIndex < returnArray.length ? returnArray[bestIndex] : makeError('#N/A', 'XLOOKUP 返回区域索引越界');
      }
      return ifNotFound;
    },
  });

  // CHOOSE - 根据索引从值列表中选择
  registry.register({
    name: 'CHOOSE',
    category: 'lookup',
    description: '根据索引号从值列表中选择对应的值',
    minArgs: 2,
    maxArgs: -1,
    params: [
      { name: 'index_num', description: '索引号（从 1 开始）', type: 'number' },
      { name: 'value1', description: '第一个候选值', type: 'any' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const indexRaw = toNumber(args[0]);
      if (isError(indexRaw)) return indexRaw;
      const index = Math.floor(indexRaw);
      if (index < 1 || index > args.length - 1) {
        return makeError('#VALUE!', `CHOOSE 索引 ${index} 超出范围（1-${args.length - 1}）`);
      }
      return args[index];
    },
  });

  // ROW - 返回当前行号
  registry.register({
    name: 'ROW',
    category: 'lookup',
    description: '返回引用的行号',
    minArgs: 0,
    maxArgs: 1,
    params: [
      { name: 'reference', description: '单元格引用（可选，默认当前单元格）', type: 'any', optional: true },
    ],
    handler: (args: FormulaValue[], context: EvaluationContext): FormulaValue => {
      if (args.length === 0) {
        // 无参数：返回当前公式所在行号（1-based）
        return context.row + 1;
      }
      // 有参数：如果是区域引用（二维数组），返回第一行的行号
      // 由于参数已被求值，无法获取原始行号，返回当前行号
      return context.row + 1;
    },
  });

  // COLUMN - 返回当前列号
  registry.register({
    name: 'COLUMN',
    category: 'lookup',
    description: '返回引用的列号',
    minArgs: 0,
    maxArgs: 1,
    params: [
      { name: 'reference', description: '单元格引用（可选，默认当前单元格）', type: 'any', optional: true },
    ],
    handler: (args: FormulaValue[], context: EvaluationContext): FormulaValue => {
      if (args.length === 0) {
        return context.col + 1;
      }
      return context.col + 1;
    },
  });

  // ROWS - 返回区域的行数
  registry.register({
    name: 'ROWS',
    category: 'lookup',
    description: '返回引用区域的行数',
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'array', description: '区域引用', type: 'range' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const arr = ensureArray(args[0]);
      if (!arr) {
        // 单个值视为 1 行
        return 1;
      }
      return arr.length;
    },
  });

  // COLUMNS - 返回区域的列数
  registry.register({
    name: 'COLUMNS',
    category: 'lookup',
    description: '返回引用区域的列数',
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'array', description: '区域引用', type: 'range' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const arr = ensureArray(args[0]);
      if (!arr || arr.length === 0) {
        return 1;
      }
      return arr[0].length;
    },
  });

  // LOOKUP - 向量查找
  registry.register({
    name: 'LOOKUP',
    category: 'lookup',
    description: '在一行或一列中查找值，返回另一行或列中同一位置的值',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'lookup_value', description: '要查找的值', type: 'any' },
      { name: 'lookup_vector', description: '查找区域（单行或单列，必须升序排列）', type: 'range' },
      { name: 'result_vector', description: '返回区域（单行或单列，与查找区域大小相同）', type: 'range', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const lookupValue = args[0];
      if (isError(lookupValue)) return lookupValue;

      // 获取查找向量
      let lookupVector: FormulaValue[];
      const rawLookup = args[1];
      if (Array.isArray(rawLookup)) {
        lookupVector = flattenToOneDimension(rawLookup as FormulaValue[][]);
      } else {
        lookupVector = [rawLookup];
      }

      // 获取结果向量（如果提供）
      let resultVector: FormulaValue[];
      if (args.length >= 3) {
        const rawResult = args[2];
        if (Array.isArray(rawResult)) {
          resultVector = flattenToOneDimension(rawResult as FormulaValue[][]);
        } else {
          resultVector = [rawResult];
        }
      } else {
        // 两参数形式：查找向量同时作为结果向量
        resultVector = lookupVector;
      }

      // 近似匹配（升序排列）：找到小于等于 lookup_value 的最大值
      let bestIndex = -1;
      for (let i = 0; i < lookupVector.length; i++) {
        const cellValue = lookupVector[i];
        if (isError(cellValue)) continue;
        const cmp = compareValues(cellValue, lookupValue);
        if (cmp <= 0) {
          bestIndex = i;
        } else {
          // 假设已升序排列，遇到大于目标值的就停止
          break;
        }
      }

      if (bestIndex === -1) {
        return makeError('#N/A', 'LOOKUP 未找到匹配值');
      }

      // 返回结果向量中对应位置的值
      if (bestIndex < resultVector.length) {
        return resultVector[bestIndex];
      }
      return makeError('#N/A', 'LOOKUP 结果向量索引越界');
    },
  });

  // TRANSPOSE - 转置数组
  registry.register({
    name: 'TRANSPOSE',
    category: 'lookup',
    description: '转置数组（行列互换）',
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'array', description: '要转置的区域', type: 'range' }],
    handler: (args: FormulaValue[]): FormulaValue => {
      const arr = ensureArray(args[0]);
      if (!arr || arr.length === 0) {
        return args[0];
      }
      const rows = arr.length;
      const cols = arr[0].length;
      const result: FormulaValue[][] = [];
      for (let c = 0; c < cols; c++) {
        const newRow: FormulaValue[] = [];
        for (let r = 0; r < rows; r++) {
          newRow.push(arr[r][c]);
        }
        result.push(newRow);
      }
      return result;
    },
  });

  // ============================================================
  // 动态数组函数：FILTER, UNIQUE, SORT, SORTBY
  // ============================================================

  // FILTER - 动态筛选数组
  registry.register({
    name: 'FILTER',
    category: 'lookup',
    description: '根据条件筛选数组，返回满足条件的行',
    minArgs: 2,
    maxArgs: 3,
    params: [
      { name: 'array', description: '要筛选的区域', type: 'range' },
      { name: 'include', description: '布尔条件数组（TRUE 的行保留）', type: 'range' },
      { name: 'if_empty', description: '无匹配时返回的值', type: 'any', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const arr = ensureArray(args[0]);
      if (!arr || arr.length === 0) {
        return makeError('#VALUE!', 'FILTER 的第一个参数必须是区域引用');
      }

      // include 可以是一维布尔数组或二维单列/单行数组
      let includeFlags: boolean[];
      const rawInclude = args[1];
      if (Array.isArray(rawInclude)) {
        const includeArr = rawInclude as FormulaValue[][];
        // 判断是单列还是单行
        if (includeArr.length === arr.length) {
          // 按行筛选
          includeFlags = includeArr.map(row => {
            const val = row[0];
            if (typeof val === 'boolean') return val;
            if (typeof val === 'number') return val !== 0;
            return false;
          });
        } else if (includeArr.length === 1 && includeArr[0].length === arr[0].length) {
          // 按列筛选（转置处理）
          includeFlags = includeArr[0].map(val => {
            if (typeof val === 'boolean') return val;
            if (typeof val === 'number') return val !== 0;
            return false;
          });
          // 按列筛选：返回满足条件的列
          const resultRows: FormulaValue[][] = [];
          for (let r = 0; r < arr.length; r++) {
            const newRow: FormulaValue[] = [];
            for (let c = 0; c < arr[r].length; c++) {
              if (includeFlags[c]) {
                newRow.push(arr[r][c]);
              }
            }
            resultRows.push(newRow);
          }
          if (resultRows.length === 0 || resultRows[0].length === 0) {
            return args.length >= 3 ? args[2] : makeError('#N/A', 'FILTER 无匹配结果');
          }
          return resultRows;
        } else {
          return makeError('#VALUE!', 'FILTER 条件数组大小与数据区域不匹配');
        }
      } else {
        return makeError('#VALUE!', 'FILTER 的第二个参数必须是区域引用');
      }

      // 按行筛选
      const result: FormulaValue[][] = [];
      for (let i = 0; i < arr.length; i++) {
        if (i < includeFlags.length && includeFlags[i]) {
          result.push([...arr[i]]);
        }
      }

      if (result.length === 0) {
        return args.length >= 3 ? args[2] : makeError('#N/A', 'FILTER 无匹配结果');
      }
      return result;
    },
  });

  // UNIQUE - 返回数组中的唯一值
  registry.register({
    name: 'UNIQUE',
    category: 'lookup',
    description: '返回数组中的唯一行',
    minArgs: 1,
    maxArgs: 3,
    params: [
      { name: 'array', description: '要去重的区域', type: 'range' },
      { name: 'by_col', description: 'TRUE=按列去重，FALSE=按行去重（默认）', type: 'boolean', optional: true },
      { name: 'exactly_once', description: 'TRUE=仅返回出现一次的行', type: 'boolean', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const arr = ensureArray(args[0]);
      if (!arr || arr.length === 0) {
        return makeError('#VALUE!', 'UNIQUE 的参数必须是区域引用');
      }

      const byCol = args.length >= 2 && typeof args[1] === 'boolean' ? args[1] : false;
      const exactlyOnce = args.length >= 3 && typeof args[2] === 'boolean' ? args[2] : false;

      if (byCol) {
        // 按列去重：转置 → 按行去重 → 转置回来
        const cols = arr[0].length;
        const rows = arr.length;
        const transposed: FormulaValue[][] = [];
        for (let c = 0; c < cols; c++) {
          const col: FormulaValue[] = [];
          for (let r = 0; r < rows; r++) {
            col.push(arr[r][c]);
          }
          transposed.push(col);
        }
        const uniqueCols = getUniqueRows(transposed, exactlyOnce);
        // 转置回来
        if (uniqueCols.length === 0) return makeError('#N/A', 'UNIQUE 无结果');
        const result: FormulaValue[][] = [];
        for (let r = 0; r < uniqueCols[0].length; r++) {
          const row: FormulaValue[] = [];
          for (let c = 0; c < uniqueCols.length; c++) {
            row.push(uniqueCols[c][r]);
          }
          result.push(row);
        }
        return result;
      }

      const result = getUniqueRows(arr, exactlyOnce);
      if (result.length === 0) return makeError('#N/A', 'UNIQUE 无结果');
      return result;
    },
  });

  // SORT - 对数组排序
  registry.register({
    name: 'SORT',
    category: 'lookup',
    description: '对数组按指定列排序',
    minArgs: 1,
    maxArgs: 4,
    params: [
      { name: 'array', description: '要排序的区域', type: 'range' },
      { name: 'sort_index', description: '排序依据的列号（从1开始，默认1）', type: 'number', optional: true },
      { name: 'sort_order', description: '1=升序（默认），-1=降序', type: 'number', optional: true },
      { name: 'by_col', description: 'TRUE=按列排序，FALSE=按行排序（默认）', type: 'boolean', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const arr = ensureArray(args[0]);
      if (!arr || arr.length === 0) {
        return makeError('#VALUE!', 'SORT 的参数必须是区域引用');
      }

      const sortIndex = args.length >= 2 ? toNumber(args[1]) : 1;
      if (isError(sortIndex)) return sortIndex;
      const colIdx = Math.floor(sortIndex as number) - 1;

      const sortOrder = args.length >= 3 ? toNumber(args[2]) : 1;
      if (isError(sortOrder)) return sortOrder;
      const ascending = (sortOrder as number) >= 0;

      const byCol = args.length >= 4 && typeof args[3] === 'boolean' ? args[3] : false;

      if (byCol) {
        // 按列排序
        if (colIdx < 0 || colIdx >= arr.length) {
          return makeError('#VALUE!', 'SORT 排序行号超出范围');
        }
        const colCount = arr[0].length;
        const indices = Array.from({ length: colCount }, (_, i) => i);
        indices.sort((a, b) => {
          const cmp = compareValues(arr[colIdx][a], arr[colIdx][b]);
          return ascending ? cmp : -cmp;
        });
        return arr.map(row => indices.map(i => row[i]));
      }

      // 按行排序
      if (colIdx < 0 || colIdx >= arr[0].length) {
        return makeError('#VALUE!', 'SORT 排序列号超出范围');
      }
      const sorted = [...arr].map(row => [...row]);
      sorted.sort((a, b) => {
        const cmp = compareValues(a[colIdx], b[colIdx]);
        return ascending ? cmp : -cmp;
      });
      return sorted;
    },
  });

  // SORTBY - 按另一列排序
  registry.register({
    name: 'SORTBY',
    category: 'lookup',
    description: '按指定的排序依据数组对数据排序',
    minArgs: 2,
    maxArgs: -1,
    params: [
      { name: 'array', description: '要排序的区域', type: 'range' },
      { name: 'by_array1', description: '排序依据数组', type: 'range' },
      { name: 'sort_order1', description: '1=升序，-1=降序（默认1）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const arr = ensureArray(args[0]);
      if (!arr || arr.length === 0) {
        return makeError('#VALUE!', 'SORTBY 的第一个参数必须是区域引用');
      }

      // 收集排序键：(byArray, order) 对
      const sortKeys: { values: FormulaValue[]; ascending: boolean }[] = [];
      let i = 1;
      while (i < args.length) {
        const byArr = ensureArray(args[i]);
        if (!byArr) {
          return makeError('#VALUE!', 'SORTBY 排序依据必须是区域引用');
        }
        const byValues = flattenToOneDimension(byArr);
        if (byValues.length !== arr.length) {
          return makeError('#VALUE!', 'SORTBY 排序依据大小与数据区域不匹配');
        }
        const order = (i + 1 < args.length) ? toNumber(args[i + 1]) : 1;
        if (isError(order)) return order;
        sortKeys.push({ values: byValues, ascending: (order as number) >= 0 });
        i += 2;
      }

      if (sortKeys.length === 0) {
        return makeError('#VALUE!', 'SORTBY 至少需要一个排序依据');
      }

      // 创建索引数组并排序
      const indices = Array.from({ length: arr.length }, (_, idx) => idx);
      indices.sort((a, b) => {
        for (const key of sortKeys) {
          const cmp = compareValues(key.values[a], key.values[b]);
          if (cmp !== 0) return key.ascending ? cmp : -cmp;
        }
        return 0;
      });

      return indices.map(idx => [...arr[idx]]);
    },
  });

  // ============================================================
  // 辅助函数：ADDRESS, TYPE
  // ============================================================

  // ADDRESS - 根据行列号生成单元格引用文本
  registry.register({
    name: 'ADDRESS',
    category: 'lookup',
    description: '根据行号和列号生成单元格引用文本',
    minArgs: 2,
    maxArgs: 5,
    params: [
      { name: 'row_num', description: '行号', type: 'number' },
      { name: 'column_num', description: '列号', type: 'number' },
      { name: 'abs_num', description: '引用类型：1=绝对，2=行绝对，3=列绝对，4=相对', type: 'number', optional: true },
      { name: 'a1', description: 'TRUE=A1样式，FALSE=R1C1样式', type: 'boolean', optional: true },
      { name: 'sheet_text', description: '工作表名称', type: 'string', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const rowRaw = toNumber(args[0]);
      if (isError(rowRaw)) return rowRaw;
      const colRaw = toNumber(args[1]);
      if (isError(colRaw)) return colRaw;
      const row = Math.floor(rowRaw as number);
      const col = Math.floor(colRaw as number);

      if (row < 1 || col < 1) {
        return makeError('#VALUE!', 'ADDRESS 行号和列号必须大于0');
      }

      const absNum = args.length >= 3 ? toNumber(args[2]) : 1;
      if (isError(absNum)) return absNum;
      const absType = Math.floor(absNum as number);

      const a1Style = args.length >= 4 ? (typeof args[3] === 'boolean' ? args[3] : true) : true;
      const sheetName = args.length >= 5 && typeof args[4] === 'string' ? args[4] : '';

      // 列号转字母
      let colStr = '';
      let c = col;
      while (c > 0) {
        c--;
        colStr = String.fromCharCode(65 + (c % 26)) + colStr;
        c = Math.floor(c / 26);
      }

      let result = '';
      if (a1Style) {
        switch (absType) {
          case 1: result = `$${colStr}$${row}`; break;    // 绝对
          case 2: result = `${colStr}$${row}`; break;     // 行绝对
          case 3: result = `$${colStr}${row}`; break;     // 列绝对
          case 4: result = `${colStr}${row}`; break;      // 相对
          default: result = `$${colStr}$${row}`; break;
        }
      } else {
        // R1C1 样式
        switch (absType) {
          case 1: result = `R${row}C${col}`; break;
          case 2: result = `R${row}C[${col}]`; break;
          case 3: result = `R[${row}]C${col}`; break;
          case 4: result = `R[${row}]C[${col}]`; break;
          default: result = `R${row}C${col}`; break;
        }
      }

      if (sheetName) {
        result = `${sheetName}!${result}`;
      }

      return result;
    },
  });

  // TYPE - 返回值的类型编号
  registry.register({
    name: 'TYPE',
    category: 'lookup',
    description: '返回值的类型编号（1=数字，2=文本，4=逻辑，16=错误，64=数组）',
    minArgs: 1,
    maxArgs: 1,
    params: [
      { name: 'value', description: '要检测类型的值', type: 'any' },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const value = args[0];
      if (isError(value)) return 16;
      if (typeof value === 'number') return 1;
      if (typeof value === 'string') return 2;
      if (typeof value === 'boolean') return 4;
      if (Array.isArray(value)) return 64;
      return 1; // 默认数字
    },
  });
}
