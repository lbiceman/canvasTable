/**
 * 服务端 OT 处理逻辑
 * 接收客户端操作、分配递增修订号、对过期操作执行转换、维护操作历史
 *
 * 需求: 4.1, 4.2, 4.5
 */
import { CollabOperation } from './types.ts';
import { transformAgainst } from './ot.ts';

export interface OTServerState {
  // 已确认操作历史
  operations: CollabOperation[];
  // 当前修订号（等于 operations.length）
  revision: number;
}

export interface ReceiveResult {
  // 服务器分配的修订号
  revision: number;
  // 转换后的操作（用于广播给其他客户端）
  transformedOp: CollabOperation;
}

/**
 * 创建 OT 服务端实例
 */
export const createOTServer = (): OTServerState => ({
  operations: [],
  revision: 0,
});

/**
 * 接收客户端操作并处理
 *
 * 1. 如果客户端的修订号落后于服务器当前修订号，
 *    对操作执行转换以适配当前文档状态
 * 2. 分配递增的修订号
 * 3. 将操作加入历史
 *
 * @param state - OT 服务端状态
 * @param clientRevision - 客户端发送操作时的修订号
 * @param op - 客户端提交的操作
 * @returns 处理结果，包含新修订号和转换后的操作；如果操作被消除则返回 null
 */
export const receiveOperation = (
  state: OTServerState,
  clientRevision: number,
  op: CollabOperation
): ReceiveResult | null => {
  // 获取客户端修订号之后的所有已确认操作
  // 这些是客户端尚未看到的操作，需要对新操作进行转换
  const concurrentOps = state.operations.slice(clientRevision);

  // 对操作执行转换，使其适配当前文档状态
  const transformedOp = transformAgainst(op, concurrentOps);

  // 如果操作在转换后被消除（例如编辑的行被删除），返回 null
  if (transformedOp === null) {
    return null;
  }

  // 分配递增修订号
  state.revision += 1;
  transformedOp.revision = state.revision;

  // 将操作加入历史
  state.operations.push(transformedOp);

  return {
    revision: state.revision,
    transformedOp,
  };
};

/**
 * 获取指定修订号之后的所有操作（用于客户端重连同步）
 */
export const getOperationsSince = (
  state: OTServerState,
  sinceRevision: number
): CollabOperation[] => {
  return state.operations.slice(sinceRevision);
};
