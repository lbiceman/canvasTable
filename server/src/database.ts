/**
 * 基于 JSON 文件的房间数据持久化模块
 * 将房间文档状态保存到磁盘，服务器重启或用户刷新后可恢复数据
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SpreadsheetData, CollabOperation } from './types.ts';

// 数据存储目录（相对于当前文件所在目录的上级，即 server/data）
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// 房间持久化数据结构
interface RoomPersistData {
  roomId: string;
  document: SpreadsheetData;
  revision: number;
  operations: CollabOperation[];
  updatedAt: number;
}

/**
 * 确保数据目录存在
 */
const ensureDataDir = (): void => {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
};

/**
 * 获取房间数据文件路径
 */
const getRoomFilePath = (roomId: string): string => {
  // 对 roomId 做简单清理，防止路径注入
  const safeId = roomId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(DATA_DIR, `room_${safeId}.json`);
};

/**
 * 保存房间数据到文件
 */
export const saveRoom = (
  roomId: string,
  document: SpreadsheetData,
  revision: number,
  operations: CollabOperation[]
): void => {
  ensureDataDir();
  const data: RoomPersistData = {
    roomId,
    document,
    revision,
    operations,
    updatedAt: Date.now(),
  };
  try {
    const filePath = getRoomFilePath(roomId);
    writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  } catch (error) {
    console.error(`保存房间 ${roomId} 数据失败:`, error);
  }
};

/**
 * 从文件加载房间数据
 * 如果文件不存在返回 null
 */
export const loadRoom = (roomId: string): RoomPersistData | null => {
  const filePath = getRoomFilePath(roomId);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as RoomPersistData;
  } catch (error) {
    console.error(`加载房间 ${roomId} 数据失败:`, error);
    return null;
  }
};
