// ============================================================
// FormulaWorkerBridge - Worker 通信桥接
// 主线程侧的 Worker 管理器，负责任务调度、超时控制和结果回调
// 支持单个求值、批量合并、任务取消、超时恢复和主线程回退
// 需求：2.1, 2.2, 2.5, 2.6, 2.7
// ============================================================

import { FormulaEngine } from './formula-engine';

// ============================================================
// Worker 消息协议类型定义
// ============================================================

/** 主线程 → Worker 的请求消息 */
interface WorkerRequest {
  id: string;
  type: 'evaluate' | 'batch';
  formulas: Array<{
    formula: string;
    row: number;
    col: number;
    dependencies: Record<string, string>;
  }>;
}

/** Worker → 主线程的响应消息 */
interface WorkerResponse {
  id: string;
  results: Array<{
    row: number;
    col: number;
    value: string;
    error?: string;
  }>;
}

/** 待处理任务条目 */
interface PendingTask {
  resolve: (results: WorkerResponse['results']) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** 批量队列中的条目（附带 Promise 回调） */
interface BatchEntry {
  formula: string;
  row: number;
  col: number;
  dependencies: Record<string, string>;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

// ============================================================
// 常量
// ============================================================

/** Worker 计算超时时间（毫秒） */
const WORKER_TIMEOUT_MS = 5000;

/** 批量分片大小：每个分片最多包含的公式数量 */
const BATCH_CHUNK_SIZE = 20;

// ============================================================
// FormulaWorkerBridge 类
// ============================================================

export class FormulaWorkerBridge {
  /** Worker 实例 */
  private worker: Worker | null = null;

  /** 待处理任务映射（任务 ID → resolve/reject/timer） */
  private pendingTasks: Map<string, PendingTask> = new Map();

  /** 批量队列：等待合并发送的公式条目 */
  private batchQueue: BatchEntry[] = [];

  /** 批量发送是否已调度（微任务） */
  private batchScheduled = false;

  /** 单元格位置到任务 ID 的映射，用于 cancelTask */
  private cellTaskMap: Map<string, string> = new Map();

  /** Worker 创建失败时的回退标记 */
  private useFallback = false;

  /** 任务 ID 计数器 */
  private taskIdCounter = 0;

  constructor() {
    this.createWorker();
  }

  // ============================================================
  // 公共 API
  // ============================================================

  /**
   * 提交单个公式计算任务
   * 返回计算结果字符串，超时返回 #TIMEOUT!
   */
  evaluate(
    formula: string,
    row: number,
    col: number,
    dependencies: Record<string, string>
  ): Promise<string> {
    // Worker 不可用时回退到主线程同步计算
    if (this.useFallback || !this.worker) {
      return Promise.resolve(this.evaluateOnMainThread(formula, row, col));
    }

    const id = this.generateTaskId();
    const cellKey = `${row}-${col}`;

    // 取消该单元格之前的待处理任务
    this.cancelTaskByCell(cellKey);

    return new Promise<string>((resolve, reject) => {
      // 设置超时控制
      const timer = setTimeout(() => {
        this.handleTimeout(id, row, col);
      }, WORKER_TIMEOUT_MS);

      // 注册待处理任务
      this.pendingTasks.set(id, { resolve: (results) => {
        const result = results[0];
        if (result?.error) {
          resolve(result.value); // 错误值如 #VALUE! 也作为结果返回
        } else {
          resolve(result?.value ?? '');
        }
      }, reject, timer });

      // 记录单元格与任务的映射
      this.cellTaskMap.set(cellKey, id);

      // 发送请求到 Worker
      const request: WorkerRequest = {
        id,
        type: 'evaluate',
        formulas: [{ formula, row, col, dependencies }],
      };

      this.worker!.postMessage(request);
    });
  }

  /**
   * 将公式加入批量队列，在下一个微任务中统一发送
   * 使用 queueMicrotask 合并同一事件循环中的多个请求
   */
  enqueueForBatch(
    formula: string,
    row: number,
    col: number,
    dependencies: Record<string, string>
  ): Promise<string> {
    // Worker 不可用时回退到主线程同步计算
    if (this.useFallback || !this.worker) {
      return Promise.resolve(this.evaluateOnMainThread(formula, row, col));
    }

    const cellKey = `${row}-${col}`;

    // 取消该单元格之前的待处理任务
    this.cancelTaskByCell(cellKey);

    return new Promise<string>((resolve, reject) => {
      this.batchQueue.push({ formula, row, col, dependencies, resolve, reject });

      // 调度微任务合并发送（仅调度一次）
      if (!this.batchScheduled) {
        this.batchScheduled = true;
        queueMicrotask(() => {
          this.flushBatchQueue();
        });
      }
    });
  }

  /**
   * 取消指定单元格的待处理任务
   * 通过 "row-col" 格式的 key 找到对应的 pending task 并 reject
   */
  cancelTask(row: number, col: number): void {
    const cellKey = `${row}-${col}`;
    this.cancelTaskByCell(cellKey);

    // 同时从批量队列中移除该单元格的条目
    this.batchQueue = this.batchQueue.filter((entry) => {
      if (`${entry.row}-${entry.col}` === cellKey) {
        entry.reject(new Error('任务已取消'));
        return false;
      }
      return true;
    });
  }

  /**
   * 销毁 Worker，清理所有资源
   */
  dispose(): void {
    // 拒绝所有待处理任务
    for (const [id, task] of this.pendingTasks) {
      clearTimeout(task.timer);
      task.reject(new Error('Worker 已销毁'));
      this.pendingTasks.delete(id);
    }

    // 拒绝批量队列中的所有条目
    for (const entry of this.batchQueue) {
      entry.reject(new Error('Worker 已销毁'));
    }
    this.batchQueue = [];
    this.batchScheduled = false;

    // 清理单元格映射
    this.cellTaskMap.clear();

    // 终止 Worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  // ============================================================
  // 私有方法 - Worker 生命周期管理
  // ============================================================

  /**
   * 创建 Worker 实例
   * 创建失败时设置 fallback 标记，后续调用直接在主线程计算
   */
  private createWorker(): void {
    try {
      this.worker = new Worker(
        new URL('./formula-worker.ts', import.meta.url),
        { type: 'module' }
      );

      // 监听 Worker 返回的计算结果
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      // 监听 Worker 运行时错误
      this.worker.onerror = (event: ErrorEvent) => {
        console.error('Worker 运行时错误:', event.message);
        // 重建 Worker 以恢复服务
        this.resetWorker();
      };

      this.useFallback = false;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      console.warn(`Worker 创建失败，回退到主线程同步计算: ${message}`);
      this.worker = null;
      this.useFallback = true;
    }
  }

  /**
   * 终止并重建 Worker（超时恢复）
   * 终止旧 Worker，拒绝所有待处理任务，创建新 Worker
   */
  private resetWorker(): void {
    // 终止旧 Worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // 拒绝所有待处理任务（超时或错误导致的重建）
    for (const [_id, task] of this.pendingTasks) {
      clearTimeout(task.timer);
      task.reject(new Error('Worker 已重置'));
    }
    this.pendingTasks.clear();
    this.cellTaskMap.clear();

    // 创建新 Worker
    this.createWorker();
  }

  // ============================================================
  // 私有方法 - 消息处理
  // ============================================================

  /**
   * 处理 Worker 返回的响应消息
   */
  private handleWorkerMessage(response: WorkerResponse): void {
    const { id, results } = response;

    const task = this.pendingTasks.get(id);
    if (!task) {
      // 任务可能已被取消或超时，忽略响应
      return;
    }

    // 清除超时定时器
    clearTimeout(task.timer);
    this.pendingTasks.delete(id);

    // 清理单元格映射
    for (const result of results) {
      const cellKey = `${result.row}-${result.col}`;
      if (this.cellTaskMap.get(cellKey) === id) {
        this.cellTaskMap.delete(cellKey);
      }
    }

    // 回调结果
    task.resolve(results);
  }

  /**
   * 处理任务超时
   * 终止 Worker，在对应单元格显示 #TIMEOUT!，自动重建新 Worker
   */
  private handleTimeout(taskId: string, row: number, col: number): void {
    const task = this.pendingTasks.get(taskId);
    if (!task) return;

    // 从待处理任务中移除
    this.pendingTasks.delete(taskId);

    // 清理单元格映射
    const cellKey = `${row}-${col}`;
    if (this.cellTaskMap.get(cellKey) === taskId) {
      this.cellTaskMap.delete(cellKey);
    }

    // 返回超时错误结果
    task.resolve([{ row, col, value: '#TIMEOUT!', error: '公式计算超时（5秒）' }]);

    console.warn(`公式计算超时: 单元格 (${row}, ${col})，终止 Worker 并重建`);

    // 终止旧 Worker 并重建
    this.resetWorker();
  }

  // ============================================================
  // 私有方法 - 批量队列管理
  // ============================================================

  /**
   * 刷新批量队列：将队列按固定大小分片发送到 Worker
   *
   * 性能优化：将大批量请求拆分为多个小分片，减少单次 postMessage 的序列化开销。
   * 每个分片独立发送和超时控制，Worker 端逐个处理。
   * 同时对分片内的依赖数据去重，减少传输数据量。
   */
  private flushBatchQueue(): void {
    this.batchScheduled = false;

    if (this.batchQueue.length === 0) return;

    // Worker 不可用时回退到主线程
    if (this.useFallback || !this.worker) {
      for (const entry of this.batchQueue) {
        const result = this.evaluateOnMainThread(entry.formula, entry.row, entry.col);
        entry.resolve(result);
      }
      this.batchQueue = [];
      return;
    }

    // 取出当前队列中的所有条目
    const allEntries = this.batchQueue;
    this.batchQueue = [];

    // 按 BATCH_CHUNK_SIZE 分片发送
    for (let i = 0; i < allEntries.length; i += BATCH_CHUNK_SIZE) {
      const chunkEntries = allEntries.slice(i, i + BATCH_CHUNK_SIZE);
      this.sendBatchChunk(chunkEntries);
    }
  }

  /**
   * 发送单个批量分片到 Worker
   * 对分片内的依赖数据去重，减少 postMessage 序列化开销
   */
  private sendBatchChunk(entries: BatchEntry[]): void {
    if (!this.worker) return;

    const id = this.generateTaskId();

    // 去重依赖数据：多个公式可能引用相同的单元格
    const deduplicatedEntries = entries.map(({ formula, row, col, dependencies }) => ({
      formula,
      row,
      col,
      dependencies: this.deduplicateDependencies(dependencies),
    }));

    // 构建批量请求
    const request: WorkerRequest = {
      id,
      type: 'batch',
      formulas: deduplicatedEntries,
    };

    // 设置超时控制
    const timer = setTimeout(() => {
      this.handleBatchTimeout(id, entries);
    }, WORKER_TIMEOUT_MS);

    // 注册待处理任务
    this.pendingTasks.set(id, {
      resolve: (results) => {
        // 将结果分发到各个条目的 Promise
        const resultMap = new Map<string, WorkerResponse['results'][0]>();
        for (const result of results) {
          resultMap.set(`${result.row}-${result.col}`, result);
        }

        for (const entry of entries) {
          const cellKey = `${entry.row}-${entry.col}`;
          const result = resultMap.get(cellKey);
          if (result) {
            entry.resolve(result.value);
          } else {
            entry.resolve('');
          }
          // 清理单元格映射
          if (this.cellTaskMap.get(cellKey) === id) {
            this.cellTaskMap.delete(cellKey);
          }
        }
      },
      reject: (error) => {
        for (const entry of entries) {
          entry.reject(error);
        }
      },
      timer,
    });

    // 记录所有单元格与任务的映射
    for (const entry of entries) {
      const cellKey = `${entry.row}-${entry.col}`;
      this.cellTaskMap.set(cellKey, id);
    }

    // 发送请求到 Worker
    this.worker.postMessage(request);
  }

  /**
   * 去重依赖数据：移除值为空字符串的依赖项
   * 空字符串是默认值，Worker 端对缺失的 key 也返回空字符串，
   * 因此可以安全移除以减少序列化数据量
   */
  private deduplicateDependencies(
    dependencies: Record<string, string>
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key in dependencies) {
      if (dependencies[key] !== '') {
        result[key] = dependencies[key];
      }
    }
    return result;
  }

  /**
   * 处理批量任务超时
   */
  private handleBatchTimeout(taskId: string, entries: BatchEntry[]): void {
    const task = this.pendingTasks.get(taskId);
    if (!task) return;

    this.pendingTasks.delete(taskId);

    // 为所有条目返回超时错误
    for (const entry of entries) {
      const cellKey = `${entry.row}-${entry.col}`;
      if (this.cellTaskMap.get(cellKey) === taskId) {
        this.cellTaskMap.delete(cellKey);
      }
      entry.resolve('#TIMEOUT!');
    }

    console.warn(`批量公式计算超时（${entries.length} 个公式），终止 Worker 并重建`);

    // 终止旧 Worker 并重建
    this.resetWorker();
  }

  // ============================================================
  // 私有方法 - 任务取消
  // ============================================================

  /**
   * 通过单元格 key 取消对应的待处理任务
   */
  private cancelTaskByCell(cellKey: string): void {
    const taskId = this.cellTaskMap.get(cellKey);
    if (!taskId) return;

    this.cellTaskMap.delete(cellKey);

    // 注意：如果该任务是批量任务，不能直接删除整个 pending task
    // 因为其他单元格可能还在等待同一个批量任务的结果
    // 这里只清理映射关系，让结果返回时忽略已取消的单元格
  }

  // ============================================================
  // 私有方法 - 主线程回退计算
  // ============================================================

  /**
   * 在主线程同步计算公式（Worker 不可用时的回退方案）
   */
  private evaluateOnMainThread(formula: string, row: number, col: number): string {
    try {
      const engine = FormulaEngine.getInstance();
      return engine.getDisplayValue(formula, row, col);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '主线程计算错误';
      console.error(`主线程公式计算失败: ${message}`);
      return '#ERROR!';
    }
  }

  // ============================================================
  // 私有方法 - 工具函数
  // ============================================================

  /**
   * 生成唯一任务 ID（使用递增计数器）
   */
  private generateTaskId(): string {
    return `task-${++this.taskIdCounter}`;
  }
}
