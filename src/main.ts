import './style.css';
import { SpreadsheetApp } from './app';
import { UIControls } from './ui-controls';
import { CollaborationEngine, CollaborationCallbacks } from './collaboration/collaboration-engine';
import { CollabOperation } from './collaboration/types';
import { SpreadsheetModel } from './model';
import { ConnectionStatus } from './collaboration/websocket-client';

// ============================================================
// 协同 UI 更新辅助函数
// ============================================================

/**
 * 更新连接状态指示器
 */
const updateConnectionUI = (status: ConnectionStatus): void => {
  const connectionEl = document.getElementById('collab-connection');
  const connectionTextEl = document.getElementById('collab-connection-text');
  if (!connectionEl || !connectionTextEl) return;

  connectionEl.className = `collab-connection ${status}`;
  const statusTextMap: Record<ConnectionStatus, string> = {
    connected: '已连接',
    connecting: '连接中',
    disconnected: '已断开',
  };
  connectionTextEl.textContent = statusTextMap[status];
};

/**
 * 更新在线用户数量
 */
const updateUserCountUI = (count: number): void => {
  const userCountEl = document.getElementById('collab-user-count');
  if (userCountEl) {
    userCountEl.textContent = String(count);
  }
};

/**
 * 刷新在线用户下拉列表
 * 展示所有在线用户（包括自己）及其对应颜色
 */
const refreshUserDropdownList = (engine: CollaborationEngine): void => {
  const listEl = document.getElementById('collab-user-list');
  if (!listEl) return;

  listEl.innerHTML = '';

  // 添加自己（始终排在第一位）
  const selfItem = document.createElement('li');
  selfItem.className = 'collab-user-item is-self';
  // 从 userId 中提取用户名（格式为 "用户名-时间戳"）
  const selfName = engine.getUserId().replace(/-\d+$/, '');
  // 使用服务端分配的颜色，未分配时使用颜色池第一个颜色
  const selfColor = engine.getSelfColor() || '#FF6B6B';
  selfItem.innerHTML = `
    <span class="collab-user-color-dot" style="background-color: ${selfColor};"></span>
    <span class="collab-user-name">${selfName}</span>
    <span class="collab-user-self-tag">（我）</span>
  `;
  listEl.appendChild(selfItem);

  // 添加远程用户
  const remoteUsers = engine.getOnlineUsers();
  for (const user of remoteUsers) {
    const item = document.createElement('li');
    item.className = 'collab-user-item';
    item.innerHTML = `
      <span class="collab-user-color-dot" style="background-color: ${user.color};"></span>
      <span class="collab-user-name">${user.userName}</span>
    `;
    listEl.appendChild(item);
  }
};

/**
 * 更新同步状态指示
 */
const updateSyncStatusUI = (pendingCount: number): void => {
  const syncEl = document.getElementById('collab-sync');
  const syncTextEl = document.getElementById('collab-sync-status');
  const isSyncing = pendingCount > 0;

  if (syncEl) {
    syncEl.style.display = isSyncing ? 'flex' : 'none';
  }
  if (syncTextEl) {
    syncTextEl.style.display = isSyncing ? 'inline' : 'none';
  }
};

/**
 * 显示协同通知（用户加入/离开）
 */
const showCollabNotification = (message: string, type: 'join' | 'leave'): void => {
  const container = document.getElementById('collab-notifications');
  if (!container) return;

  const notification = document.createElement('div');
  notification.className = `collab-notification ${type}`;
  notification.textContent = message;
  container.appendChild(notification);

  // 3秒后淡出并移除
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
};

/**
 * 将协同操作应用到本地模型
 */
const applyOperationToModel = (op: CollabOperation, model: SpreadsheetModel): void => {
  switch (op.type) {
    case 'cellEdit':
      model.setCellContentNoHistory(op.row, op.col, op.content);
      break;
    case 'cellMerge':
      model.mergeCells(op.startRow, op.startCol, op.endRow, op.endCol);
      break;
    case 'cellSplit':
      model.splitCell(op.row, op.col);
      break;
    case 'rowInsert':
      model.insertRows(op.rowIndex, op.count);
      break;
    case 'rowDelete':
      model.deleteRows(op.rowIndex, op.count);
      break;
    case 'rowResize':
      model.setRowHeight(op.rowIndex, op.height);
      break;
    case 'colResize':
      model.setColWidth(op.colIndex, op.width);
      break;
    case 'fontColor':
      model.setCellFontColor(op.row, op.col, op.color);
      break;
    case 'bgColor':
      model.setCellBgColor(op.row, op.col, op.color);
      break;
  }
};

// ============================================================
// 协同模式初始化
// ============================================================

/**
 * 初始化协同模式
 * 根据 URL 参数 roomId 决定是否启用
 */
const initCollaboration = (app: SpreadsheetApp): void => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('roomId');

  if (!roomId) return;

  // 获取用户名（从 URL 参数或生成默认名）
  const userName = urlParams.get('userName') || `用户${Math.floor(Math.random() * 1000)}`;

  // WebSocket 服务器地址（默认本地开发服务器）
  const wsUrl = urlParams.get('wsUrl') || `ws://${window.location.hostname}:8080`;

  // 显示协同状态 UI
  const collabStatusEl = document.getElementById('collab-status');
  if (collabStatusEl) {
    collabStatusEl.style.display = 'flex';
  }

  // 创建协同引擎
  const engine = new CollaborationEngine();
  const model = app.getModel();

  // 设置回调
  const callbacks: CollaborationCallbacks = {
    onRemoteOperation: () => {
      app.render();
    },
    onConnectionStatusChange: (status: ConnectionStatus) => {
      updateConnectionUI(status);
    },
    onUserJoin: (user) => {
      showCollabNotification(`${user.userName} 加入了编辑`, 'join');
      // +1 算上自己（getOnlineUsers 只返回远程用户）
      updateUserCountUI(engine.getOnlineUsers().length + 1);
      refreshUserDropdownList(engine);
    },
    onUserLeave: (userId) => {
      showCollabNotification(`${userId} 离开了编辑`, 'leave');
      // 延迟更新用户数（等待 CursorAwareness 的 2 秒延迟移除）
      setTimeout(() => {
        updateUserCountUI(engine.getOnlineUsers().length + 1);
        refreshUserDropdownList(engine);
      }, 2100);
    },
    onDocumentSync: (data) => {
      // 用服务器文档状态替换本地数据
      model.importFromJSON(JSON.stringify({
        version: '1.0',
        metadata: {
          rowCount: data.cells.length,
          colCount: data.cells[0]?.length || 100,
        },
        data: {
          cells: [],
          rowHeights: {},
          colWidths: {},
        },
      }));
      app.resetAndRender();
      updateConnectionUI('connected');
      // 同步完成后更新在线用户数（+1 算上自己）
      updateUserCountUI(engine.getOnlineUsers().length + 1);
      refreshUserDropdownList(engine);
    },
    onSyncStatusChange: (pendingCount: number) => {
      updateSyncStatusUI(pendingCount);
    },
    onCursorUpdate: () => {
      app.render();
    },
  };

  // 设置协同引擎到 app
  app.setCollaborationEngine(engine);

  // 初始化协同引擎
  engine.init(wsUrl, roomId, userName, model, applyOperationToModel, callbacks);

  // 初始化 UI 状态
  updateConnectionUI('connecting');
  updateUserCountUI(1);

  // hover 时刷新在线用户下拉列表
  const collabUsersEl = document.getElementById('collab-users');
  if (collabUsersEl) {
    collabUsersEl.addEventListener('mouseenter', () => {
      refreshUserDropdownList(engine);
    });
  }

  console.log(`协同模式已启用 - 房间: ${roomId}, 用户: ${userName}`);
};

// ============================================================
// 应用入口
// ============================================================

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
  // 初始化应用
  const app = new SpreadsheetApp('app');

  // 创建UI控件
  const uiControls = new UIControls(app);

  // 初始化协同模式（如果 URL 包含 roomId 参数）
  initCollaboration(app);

  // 将应用实例暴露到全局，方便调试和测试
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as unknown as Record<string, unknown>).app = app;
  (window as unknown as Record<string, unknown>).uiControls = uiControls;

  console.log('Canvas Excel 应用已启动', app);
});
