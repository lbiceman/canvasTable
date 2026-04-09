// ============================================================
// 财务函数：PMT, FV, PV, NPV, IRR, NPER, RATE
// ============================================================

import type { FunctionRegistry } from '../function-registry';
import type { FormulaValue, FormulaError } from '../types';
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
    if (isNaN(num)) return makeError('#VALUE!', `无法将 "${value}" 转换为数字`);
    return num;
  }
  return makeError('#VALUE!', '无法将值转换为数字');
}

/** 展平参数为一维数字数组（用于 NPV/IRR） */
function flattenToNumbers(args: FormulaValue[]): number[] {
  const result: number[] = [];
  for (const arg of args) {
    if (isError(arg)) continue;
    if (typeof arg === 'number') {
      result.push(arg);
    } else if (Array.isArray(arg)) {
      for (const row of arg as FormulaValue[][]) {
        for (const cell of row) {
          if (typeof cell === 'number') result.push(cell);
        }
      }
    } else if (typeof arg === 'string') {
      const num = Number(arg);
      if (!isNaN(num) && arg.trim() !== '') result.push(num);
    }
  }
  return result;
}

// ============================================================
// 注册函数
// ============================================================

/** 将所有财务函数注册到 FunctionRegistry */
export function registerFinancialFunctions(registry: FunctionRegistry): void {

  // PMT - 计算贷款的每期还款额
  // PMT(rate, nper, pv, [fv], [type])
  registry.register({
    name: 'PMT',
    category: 'financial',
    description: '计算贷款的每期还款额',
    minArgs: 3,
    maxArgs: 5,
    params: [
      { name: 'rate', description: '每期利率', type: 'number' },
      { name: 'nper', description: '总期数', type: 'number' },
      { name: 'pv', description: '现值（贷款本金）', type: 'number' },
      { name: 'fv', description: '终值（默认 0）', type: 'number', optional: true },
      { name: 'type', description: '付款时间（0=期末, 1=期初，默认 0）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const rate = toNumber(args[0]);
      if (isError(rate)) return rate;
      const nper = toNumber(args[1]);
      if (isError(nper)) return nper;
      const pv = toNumber(args[2]);
      if (isError(pv)) return pv;
      const fv = args.length > 3 ? toNumber(args[3]) : 0;
      if (isError(fv)) return fv;
      const type = args.length > 4 ? toNumber(args[4]) : 0;
      if (isError(type)) return type;

      if (nper === 0) return makeError('#NUM!', 'NPER 不能为 0');

      if (rate === 0) {
        return -(pv + fv) / nper;
      }

      const pvif = Math.pow(1 + rate, nper);
      const pmt = rate * (pv * pvif + fv) / ((pvif - 1) * (1 + rate * type));
      return -pmt;
    },
  });

  // FV - 计算投资的终值
  // FV(rate, nper, pmt, [pv], [type])
  registry.register({
    name: 'FV',
    category: 'financial',
    description: '计算投资的终值',
    minArgs: 3,
    maxArgs: 5,
    params: [
      { name: 'rate', description: '每期利率', type: 'number' },
      { name: 'nper', description: '总期数', type: 'number' },
      { name: 'pmt', description: '每期付款额', type: 'number' },
      { name: 'pv', description: '现值（默认 0）', type: 'number', optional: true },
      { name: 'type', description: '付款时间（0=期末, 1=期初，默认 0）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const rate = toNumber(args[0]);
      if (isError(rate)) return rate;
      const nper = toNumber(args[1]);
      if (isError(nper)) return nper;
      const pmt = toNumber(args[2]);
      if (isError(pmt)) return pmt;
      const pv = args.length > 3 ? toNumber(args[3]) : 0;
      if (isError(pv)) return pv;
      const type = args.length > 4 ? toNumber(args[4]) : 0;
      if (isError(type)) return type;

      if (rate === 0) {
        return -(pv + pmt * nper);
      }

      const pvif = Math.pow(1 + rate, nper);
      return -(pv * pvif + pmt * (1 + rate * type) * ((pvif - 1) / rate));
    },
  });

  // PV - 计算投资的现值
  // PV(rate, nper, pmt, [fv], [type])
  registry.register({
    name: 'PV',
    category: 'financial',
    description: '计算投资的现值',
    minArgs: 3,
    maxArgs: 5,
    params: [
      { name: 'rate', description: '每期利率', type: 'number' },
      { name: 'nper', description: '总期数', type: 'number' },
      { name: 'pmt', description: '每期付款额', type: 'number' },
      { name: 'fv', description: '终值（默认 0）', type: 'number', optional: true },
      { name: 'type', description: '付款时间（0=期末, 1=期初，默认 0）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const rate = toNumber(args[0]);
      if (isError(rate)) return rate;
      const nper = toNumber(args[1]);
      if (isError(nper)) return nper;
      const pmt = toNumber(args[2]);
      if (isError(pmt)) return pmt;
      const fv = args.length > 3 ? toNumber(args[3]) : 0;
      if (isError(fv)) return fv;
      const type = args.length > 4 ? toNumber(args[4]) : 0;
      if (isError(type)) return type;

      if (rate === 0) {
        return -(fv + pmt * nper);
      }

      const pvif = Math.pow(1 + rate, nper);
      return -(fv + pmt * (1 + rate * type) * ((pvif - 1) / rate)) / pvif;
    },
  });

  // NPV - 净现值
  // NPV(rate, value1, [value2], ...)
  registry.register({
    name: 'NPV',
    category: 'financial',
    description: '基于一系列等间隔现金流和折现率计算净现值',
    minArgs: 2,
    maxArgs: -1,
    params: [
      { name: 'rate', description: '折现率', type: 'number' },
      { name: 'value1', description: '现金流', type: 'any' },
      { name: 'value2', description: '更多现金流', type: 'any', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const rate = toNumber(args[0]);
      if (isError(rate)) return rate;
      if (rate === -1) return makeError('#NUM!', '折现率不能为 -100%');

      const cashFlows = flattenToNumbers(args.slice(1));
      if (cashFlows.length === 0) return makeError('#VALUE!', '至少需要一个现金流');

      let npv = 0;
      for (let i = 0; i < cashFlows.length; i++) {
        npv += cashFlows[i] / Math.pow(1 + rate, i + 1);
      }
      return npv;
    },
  });

  // IRR - 内部收益率
  // IRR(values, [guess])
  registry.register({
    name: 'IRR',
    category: 'financial',
    description: '计算一系列现金流的内部收益率',
    minArgs: 1,
    maxArgs: 2,
    params: [
      { name: 'values', description: '现金流数组（必须包含正值和负值）', type: 'range' },
      { name: 'guess', description: '初始猜测值（默认 0.1）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const cashFlows = flattenToNumbers([args[0]]);
      if (cashFlows.length < 2) return makeError('#NUM!', '至少需要两个现金流');

      const hasPositive = cashFlows.some(v => v > 0);
      const hasNegative = cashFlows.some(v => v < 0);
      if (!hasPositive || !hasNegative) {
        return makeError('#NUM!', '现金流必须包含正值和负值');
      }

      let guess = args.length > 1 ? toNumber(args[1]) : 0.1;
      if (isError(guess)) return guess;

      // 牛顿迭代法求解 IRR
      const maxIterations = 100;
      const tolerance = 1e-10;
      let rate = guess;

      for (let iter = 0; iter < maxIterations; iter++) {
        let npv = 0;
        let dnpv = 0;
        for (let i = 0; i < cashFlows.length; i++) {
          const factor = Math.pow(1 + rate, i);
          npv += cashFlows[i] / factor;
          if (i > 0) {
            dnpv -= i * cashFlows[i] / Math.pow(1 + rate, i + 1);
          }
        }

        if (Math.abs(npv) < tolerance) return rate;
        if (dnpv === 0) return makeError('#NUM!', 'IRR 计算不收敛');

        const newRate = rate - npv / dnpv;
        if (Math.abs(newRate - rate) < tolerance) return newRate;
        rate = newRate;
      }

      return makeError('#NUM!', 'IRR 计算不收敛');
    },
  });

  // NPER - 计算投资的期数
  // NPER(rate, pmt, pv, [fv], [type])
  registry.register({
    name: 'NPER',
    category: 'financial',
    description: '计算投资的总期数',
    minArgs: 3,
    maxArgs: 5,
    params: [
      { name: 'rate', description: '每期利率', type: 'number' },
      { name: 'pmt', description: '每期付款额', type: 'number' },
      { name: 'pv', description: '现值', type: 'number' },
      { name: 'fv', description: '终值（默认 0）', type: 'number', optional: true },
      { name: 'type', description: '付款时间（0=期末, 1=期初，默认 0）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const rate = toNumber(args[0]);
      if (isError(rate)) return rate;
      const pmt = toNumber(args[1]);
      if (isError(pmt)) return pmt;
      const pv = toNumber(args[2]);
      if (isError(pv)) return pv;
      const fv = args.length > 3 ? toNumber(args[3]) : 0;
      if (isError(fv)) return fv;
      const type = args.length > 4 ? toNumber(args[4]) : 0;
      if (isError(type)) return type;

      if (rate === 0) {
        if (pmt === 0) return makeError('#NUM!', 'PMT 和 RATE 不能同时为 0');
        return -(pv + fv) / pmt;
      }

      const z = pmt * (1 + rate * type);
      const numerator = z - fv * rate;
      const denominator = pv * rate + z;

      if (numerator <= 0 || denominator <= 0) {
        // 尝试负值情况
        if (numerator / denominator <= 0) {
          return makeError('#NUM!', '无法计算期数');
        }
      }

      return Math.log(numerator / denominator) / Math.log(1 + rate);
    },
  });

  // RATE - 计算投资的每期利率
  // RATE(nper, pmt, pv, [fv], [type], [guess])
  registry.register({
    name: 'RATE',
    category: 'financial',
    description: '计算投资的每期利率',
    minArgs: 3,
    maxArgs: 6,
    params: [
      { name: 'nper', description: '总期数', type: 'number' },
      { name: 'pmt', description: '每期付款额', type: 'number' },
      { name: 'pv', description: '现值', type: 'number' },
      { name: 'fv', description: '终值（默认 0）', type: 'number', optional: true },
      { name: 'type', description: '付款时间（0=期末, 1=期初，默认 0）', type: 'number', optional: true },
      { name: 'guess', description: '初始猜测值（默认 0.1）', type: 'number', optional: true },
    ],
    handler: (args: FormulaValue[]): FormulaValue => {
      const nper = toNumber(args[0]);
      if (isError(nper)) return nper;
      const pmt = toNumber(args[1]);
      if (isError(pmt)) return pmt;
      const pv = toNumber(args[2]);
      if (isError(pv)) return pv;
      const fv = args.length > 3 ? toNumber(args[3]) : 0;
      if (isError(fv)) return fv;
      const type = args.length > 4 ? toNumber(args[4]) : 0;
      if (isError(type)) return type;
      let guess = args.length > 5 ? toNumber(args[5]) : 0.1;
      if (isError(guess)) return guess;

      if (nper <= 0) return makeError('#NUM!', 'NPER 必须大于 0');

      // 牛顿迭代法求解 RATE
      const maxIterations = 100;
      const tolerance = 1e-10;
      let rate = guess;

      for (let iter = 0; iter < maxIterations; iter++) {
        if (rate <= -1) rate = -0.99;

        const pvif = Math.pow(1 + rate, nper);
        const y = pv * pvif + pmt * (1 + rate * type) * ((pvif - 1) / rate) + fv;

        // 导数
        const dpvif = nper * Math.pow(1 + rate, nper - 1);
        const dy = pv * dpvif +
          pmt * type * ((pvif - 1) / rate) +
          pmt * (1 + rate * type) * ((dpvif * rate - (pvif - 1)) / (rate * rate));

        if (Math.abs(y) < tolerance) return rate;
        if (dy === 0) return makeError('#NUM!', 'RATE 计算不收敛');

        const newRate = rate - y / dy;
        if (Math.abs(newRate - rate) < tolerance) return newRate;
        rate = newRate;
      }

      return makeError('#NUM!', 'RATE 计算不收敛');
    },
  });
}
