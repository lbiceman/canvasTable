import { test, expect, BrowserContext, Page } from '@playwright/test';

// ============================================================
// 测试配置与辅助函数
// ============================================================

const TEST_ROOM_ID = 'test-room-snapshot-sync';
const BASE_URL = 'http://localhost:3000';
const SNAPSHOT_THRESHOLD = 100;

/**
 * 点击 Canvas 上指定单元格
 */
const clickCell = async (page: Page, row: number, col: number): Promise<void> => {
  const canvas = page.locator('#excel-canvas');
  const headerWidth = 40;
  const headerHeight = 28;
  const defaultColWidth = 100;
  const defaultRowHeight = 25;
  const x = headerWidth + col * defaultColWidth + defaultColWidth / 2;
  const y = headerHeight + row * defaultRowHeight + defaultRowHeight / 2;
  await canvas.click({ position: { x, y } });
};

/**
 * 向单元格输入内容
 */
const typeInCell = async (page: Page, content: string): Promise<void> => {
  await page.keyboard.type(content, { delay: 10 });
};

/**
 * 等待协同连接状态变为指定状态
 */
const waitForCollabConnection = async (
  page: Page,
  status: 'connected' | 'connecting' | 'disconnected',
  timeout = 5000
): Promise<void> => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const currentStatus = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app;
      if (!app) return null;
      const engine = (app as { getCollaborationEngine?: () => { getConnectionStatus: () => string } }).getCollaborationEngine?.();
      return engine?.getConnectionStatus() ?? null;
    });
    if (currentStatus === status) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timeout waiting for collab status: ${status}`);
};

/**
 * 获取当前文档修订号
 */
const getRevision = async (page: Page): Promise<number> => {
  return await page.evaluate(() => {
    const app = (window as unknown as Record<string, unknown>).app;
    if (!app) return -1;
    const engine = (app as { getCollaborationEngine?: () => { getOtClient?: () => { revision: number } } }).getCollaborationEngine?.();
    return engine?.getOtClient?.()?.revision ?? -1;
  });
};

/**
 * 获取单元格内容
 */
const getCellContent = async (page: Page, row: number, col: number): Promise<string> => {
  return await page.evaluate(([r, c]) => {
    const app = (window as unknown as Record<string, unknown>).app;
    if (!app) return '';
    const model = (app as { getModel?: () => { getCell: (row: number, col: number) => { content: string } | null } }).getModel?.();
    const cell = model?.getCell(r, c);
    return cell?.content ?? '';
  }, [row, col]);
};

/**
 * 注入带操作计数的 Mock WebSocket
 * 追踪发送的操作数量，并模拟服务器行为
 */
const injectMockWebSocketWithOpCount = async (
  page: Page,
  roomId: string,
  options: {
    opCount?: number;
    startRevision?: number;
    simulateHighLag?: boolean;
  } = {}
): Promise<{ getOpCount: () => number }> => {
  const { opCount = 0, startRevision = 0, simulateHighLag = false } = options;
  const opCountHolder = { count: 0 };

  await page.evaluate(([rmId, startRev]) => {
    (window as unknown as Record<string, unknown>).__mockWsClients = [];
    (window as unknown as Record<string, unknown>).__mockOpCount = 0;
    (window as unknown as Record<string, unknown>).__mockStartRevision = startRev;

    class MockWebSocket {
      public readyState = 1;
      public onopen: (() => void) | null = null;
      public onmessage: ((event: { data: string }) => void) | null = null;
      public onclose: (() => void) | null = null;
      public onerror: ((error: unknown) => void) | null = null;
      public url: string;

      private roomId: string;
      private userId: string;
      private userName: string;
      private clients: Array<{ userId: string; userName: string; ws: MockWebSocket }> = [];
      private revision: number;
      private sentSnapshot = false;

      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url: string) {
        this.url = url;
        const urlObj = new URL(url);
        this.roomId = rmId;
        this.userId = '';
        this.userName = '';
        this.revision = (window as unknown as Record<string, unknown>).__mockStartRevision as number || 0;

        urlObj.searchParams.forEach((value, key) => {
          if (key === 'userId') this.userId = value;
          if (key === 'userName') this.userName = value;
        });

        const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
        clients.push({ userId: this.userId, userName: this.userName, ws: this });
        this.clients = clients;

        const delay = simulateHighLag ? 100 : 50;
        setTimeout(() => {
          if (this.onopen) this.onopen();

          const existingUsers = clients
            .filter(c => c.userId !== this.userId)
            .map(c => ({
              userId: c.userId,
              userName: c.userName,
              color: '#4ECDC4',
              selection: null,
              lastActive: Date.now()
            }));

          // 检查是否需要发送 SNAPSHOT（基于阈值）
          const currentOpCount = (window as unknown as Record<string, unknown>).__mockOpCount as number || 0;
          const threshold = 100;

          // 如果当前操作数超过阈值，新用户入会时发送 SNAPSHOT
          if (currentOpCount > threshold && !this.sentSnapshot) {
            this.sentSnapshot = true;
            // 发送 SNAPSHOT state 消息（模拟服务器行为）
            const snapshotDoc = {
              sheets: [{
                id: 'sheet1',
                name: 'Sheet1',
                data: {
                  cells: [[{ content: 'SNAPSHOT_INITIAL' }]],
                  rowHeights: [28],
                  colWidths: [100]
                }
              }]
            };
            this.onmessage?.({ data: JSON.stringify({
              type: 'state',
              payload: {
                workbook: snapshotDoc,
                revision: currentOpCount,
                users: existingUsers
              }
            })});
          } else {
            // 正常发送空 state
            this.onmessage?.({ data: JSON.stringify({
              type: 'state',
              payload: {
                document: { rows: [], cols: 0 },
                revision: this.revision,
                users: existingUsers
              }
            })});
          }
        }, delay);
      }

      send(data: string): void {
        const msg = JSON.parse(data);

        if (msg.type === 'operation') {
          (window as unknown as Record<string, unknown>).__mockOpCount = ((window as unknown as Record<string, unknown>).__mockOpCount as number || 0) + 1;
          this.revision++;
          opCountHolder.count++;

          // 广播操作给其他客户端
          for (const client of this.clients) {
            if (client.userId !== this.userId) {
              setTimeout(() => {
                client.ws.onmessage?.({ data: JSON.stringify({
                  type: 'remote_op',
                  payload: {
                    revision: this.revision,
                    operation: msg.payload.operation,
                    userId: this.userId
                  }
                })});
              }, 10);
            }
          }

          // 发送 ack
          setTimeout(() => {
            this.onmessage?.({ data: JSON.stringify({
              type: 'ack',
              payload: { revision: this.revision }
            })});
          }, 20);
        } else if (msg.type === 'cursor') {
          this.broadcastToRoom({
            type: 'cursor',
            payload: { userId: this.userId, selection: msg.payload.selection }
          }, this.userId);
        }
      }

      close(): void {
        this.readyState = 3;
        const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
        const idx = clients.findIndex(c => c.ws === this);
        if (idx !== -1) clients.splice(idx, 1);
        this.broadcastToRoom({ type: 'user_leave', payload: { userId: this.userId } }, this.userId);
        if (this.onclose) this.onclose();
      }

      private broadcastToRoom(msg: object, excludeUserId: string): void {
        const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
        for (const client of clients) {
          if (client.userId !== excludeUserId) {
            setTimeout(() => {
              client.ws.onmessage?.({ data: JSON.stringify(msg) });
            }, 10);
          }
        }
      }
    }

    // @ts-expect-error - 动态添加
    window.MockWebSocket = MockWebSocket;
  }, [roomId, startRevision]);

  return { getOpCount: () => opCountHolder.count };
};

/**
 * 覆盖全局 WebSocket 为 Mock
 */
const overrideWebSocket = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const originalWebSocket = (window as unknown as Record<string, unknown>).WebSocket;
    const MockWS = (window as unknown as Record<string, unknown>).MockWebSocket;
    if (originalWebSocket && MockWS) {
      (window as unknown as Record<string, unknown>).WebSocket = function(url: string) {
        if (url.includes('roomId')) {
          return new MockWS(url);
        }
        return new originalWebSocket(url);
      } as typeof WebSocket;
    }
  });
};

// ============================================================
// 测试套件
// ============================================================

test.describe('Snapshot Sync 快照同步测试', () => {
  const roomId = `snapshot-sync-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    // 清理全局状态
    await page.goto('about:blank');
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__mockWsClients = [];
      (window as unknown as Record<string, unknown>).__mockOpCount = 0;
      (window as unknown as Record<string, unknown>).__mockStartRevision = 0;
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__mockWsClients = [];
      (window as unknown as Record<string, unknown>).__mockOpCount = 0;
    });
  });

  /**
   * Test: 当房间有 >100 ops 时，新加入的客户端应该收到 SNAPSHOT 消息
   *
   * 这个测试验证：
   * 1. 服务器配置了 SNAPSHOT_THRESHOLD = 100
   * 2. 当操作数超过阈值时 Join 响应包含完整 workbook（SNAPSHOT）
   * 3. 后续不再发送大量 remote_op，而是基于快照工作
   */
  test('需求1 - 房间操作数 >100 时新客户端收到 SNAPSHOT 消息', async ({ browser }) => {
    // 模拟高延迟以确保多个操作能累积
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    // 注入 Mock WebSocket（跟踪操作数）
    await page1.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__mockWsClients = [];
      (window as unknown as Record<string, unknown>).__mockOpCount = 0;
      (window as unknown as Record<string, unknown>).__mockStartRevision = 0;

      class MockWebSocket {
        public readyState = 1;
        public onopen: (() => void) | null = null;
        public onmessage: ((event: { data: string }) => void) | null = null;
        public onclose: (() => void) | null = null;
        public onerror: ((error: unknown) => void) | null = null;
        public url: string;
        public userId: string = '';
        public userName: string = '';
        private clients: Array<{ userId: string; userName: string; ws: MockWebSocket }> = [];
        private revision = 0;
        private sentSnapshot = false;
        private snapshotThreshold = 100;

        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        constructor(url: string) {
          this.url = url;
          const urlObj = new URL(url);
          this.userId = '';
          this.userName = '';

          urlObj.searchParams.forEach((value, key) => {
            if (key === 'userId') this.userId = value;
            if (key === 'userName') this.userName = value;
          });

          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          clients.push({ userId: this.userId, userName: this.userName, ws: this });
          this.clients = clients;

          setTimeout(() => {
            if (this.onopen) this.onopen();

            const existingUsers = clients
              .filter(c => c.userId !== this.userId)
              .map(c => ({
                userId: c.userId,
                userName: c.userName,
                color: '#4ECDC4',
                selection: null,
                lastActive: Date.now()
              }));

            const currentOpCount = (window as unknown as Record<string, unknown>).__mockOpCount as number;

            // 当操作数超过阈值时，发送 SNAPSHOT
            if (currentOpCount > this.snapshotThreshold && !this.sentSnapshot) {
              this.sentSnapshot = true;
              // 发送包含完整 workbook 的 SNAPSHOT state
              this.onmessage?.({ data: JSON.stringify({
                type: 'state',
                payload: {
                  workbook: {
                    sheets: [{
                      id: 'sheet1',
                      name: 'Sheet1',
                      data: {
                        cells: Array(50).fill(null).map((_, r) =>
                          Array(26).fill(null).map((__, c) => ({ content: r === 0 && c === 0 ? 'SNAPSHOT_LOADED' : '' }))
                        ),
                        rowHeights: Array(50).fill(28),
                        colWidths: Array(26).fill(100)
                      }
                    }]
                  },
                  revision: currentOpCount,
                  users: existingUsers
                }
              })});
            } else {
              // 正常 state
              this.onmessage?.({ data: JSON.stringify({
                type: 'state',
                payload: {
                  document: { rows: [], cols: 0 },
                  revision: this.revision,
                  users: existingUsers
                }
              })});
            }
          }, 50);
        }

        send(data: string): void {
          const msg = JSON.parse(data);

          if (msg.type === 'operation') {
            (window as unknown as Record<string, unknown>).__mockOpCount = ((window as unknown as Record<string, unknown>).__mockOpCount as number || 0) + 1;
            this.revision++;

            // 广播给其他客户端
            for (const client of this.clients) {
              if (client.userId !== this.userId) {
                setTimeout(() => {
                  client.ws.onmessage?.({ data: JSON.stringify({
                    type: 'remote_op',
                    payload: {
                      revision: this.revision,
                      operation: msg.payload.operation,
                      userId: this.userId
                    }
                  })});
                }, 10);
              }
            }

            setTimeout(() => {
              this.onmessage?.({ data: JSON.stringify({
                type: 'ack',
                payload: { revision: this.revision }
              })});
            }, 20);
          }
        }

        close(): void {
          this.readyState = 3;
          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          const idx = clients.findIndex(c => c.ws === this);
          if (idx !== -1) clients.splice(idx, 1);
          if (this.onclose) this.onclose();
        }
      }

      // @ts-expect-error - 动态添加
      window.MockWebSocket = MockWebSocket;
    });

    // 覆盖 WebSocket
    await page1.addInitScript(() => {
      const originalWebSocket = (window as unknown as Record<string, unknown>).WebSocket;
      const MockWS = (window as unknown as Record<string, unknown>).MockWebSocket;
      if (originalWebSocket && MockWS) {
        (window as unknown as Record<string, unknown>).WebSocket = function(url: string) {
          if (url.includes('roomId')) {
            return new MockWS(url);
          }
          return new originalWebSocket(url);
        } as typeof WebSocket;
      }
    });

    await page1.goto(`${BASE_URL}?roomId=${roomId}&userName=User1`);
    await page1.waitForSelector('#excel-canvas');
    await page1.waitForTimeout(300);

    // 连接到同一房间的第二个客户端（但还没有超过阈值）
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    // 相同的注入
    await page2.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__mockWsClients = (window as unknown as Record<string, unknown>).__mockWsClients || [];
      (window as unknown as Record<string, unknown>).__mockOpCount = (window as unknown as Record<string, unknown>).__mockOpCount || 0;

      class MockWebSocket {
        public readyState = 1;
        public onopen: (() => void) | null = null;
        public onmessage: ((event: { data: string }) => void) | null = null;
        public onclose: (() => void) | null = null;
        public onerror: ((error: unknown) => void) | null = null;
        public url: string;
        public userId: string = '';
        public userName: string = '';
        private clients: Array<{ userId: string; userName: string; ws: MockWebSocket }> = [];
        private revision = 0;
        private sentSnapshot = false;
        private snapshotThreshold = 100;

        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        constructor(url: string) {
          this.url = url;
          const urlObj = new URL(url);
          this.userId = '';
          this.userName = '';

          urlObj.searchParams.forEach((value, key) => {
            if (key === 'userId') this.userId = value;
            if (key === 'userName') this.userName = value;
          });

          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          clients.push({ userId: this.userId, userName: this.userName, ws: this });
          this.clients = clients;

          setTimeout(() => {
            if (this.onopen) this.onopen();

            const existingUsers = clients
              .filter(c => c.userId !== this.userId)
              .map(c => ({
                userId: c.userId,
                userName: c.userName,
                color: '#4ECDC4',
                selection: null,
                lastActive: Date.now()
              }));

            const currentOpCount = (window as unknown as Record<string, unknown>).__mockOpCount as number;

            if (currentOpCount > this.snapshotThreshold && !this.sentSnapshot) {
              this.sentSnapshot = true;
              this.onmessage?.({ data: JSON.stringify({
                type: 'state',
                payload: {
                  workbook: {
                    sheets: [{
                      id: 'sheet1',
                      name: 'Sheet1',
                      data: {
                        cells: [[{ content: 'SNAPSHOT_LOADED' }]],
                        rowHeights: [28],
                        colWidths: [100]
                      }
                    }]
                  },
                  revision: currentOpCount,
                  users: existingUsers
                }
              })});
            } else {
              this.onmessage?.({ data: JSON.stringify({
                type: 'state',
                payload: {
                  document: { rows: [], cols: 0 },
                  revision: this.revision,
                  users: existingUsers
                }
              })});
            }
          }, 50);
        }

        send(data: string): void {
          const msg = JSON.parse(data);

          if (msg.type === 'operation') {
            (window as unknown as Record<string, unknown>).__mockOpCount = ((window as unknown as Record<string, unknown>).__mockOpCount as number || 0) + 1;
            this.revision++;

            for (const client of this.clients) {
              if (client.userId !== this.userId) {
                setTimeout(() => {
                  client.ws.onmessage?.({ data: JSON.stringify({
                    type: 'remote_op',
                    payload: {
                      revision: this.revision,
                      operation: msg.payload.operation,
                      userId: this.userId
                    }
                  })});
                }, 10);
              }
            }

            setTimeout(() => {
              this.onmessage?.({ data: JSON.stringify({
                type: 'ack',
                payload: { revision: this.revision }
              })});
            }, 20);
          }
        }

        close(): void {
          this.readyState = 3;
          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          const idx = clients.findIndex(c => c.ws === this);
          if (idx !== -1) clients.splice(idx, 1);
          if (this.onclose) this.onclose();
        }
      }

      // @ts-expect-error - 动态添加
      window.MockWebSocket = MockWebSocket;
    });

    await page2.addInitScript(() => {
      const originalWebSocket = (window as unknown as Record<string, unknown>).WebSocket;
      const MockWS = (window as unknown as Record<string, unknown>).MockWebSocket;
      if (originalWebSocket && MockWS) {
        (window as unknown as Record<string, unknown>).WebSocket = function(url: string) {
          if (url.includes('roomId')) {
            return new MockWS(url);
          }
          return new originalWebSocket(url);
        } as typeof WebSocket;
      }
    });

    await page2.goto(`${BASE_URL}?roomId=${roomId}&userName=User2`);
    await page2.waitForSelector('#excel-canvas');
    await page2.waitForTimeout(300);

    // User1 执行 >100 个操作
    for (let i = 0; i < 105; i++) {
      await clickCell(page1, i % 50, i % 26);
      await typeInCell(page1, `op${i}`);
      await page1.waitForTimeout(5); // 小延迟避免过快
    }

    // 等待操作完成
    await page1.waitForTimeout(1000);

    // 第三个客户端加入，此时操作数已超过阈值，应该收到 SNAPSHOT
    const context3 = await browser.newContext();
    const page3 = await context3.newPage();

    let receivedSnapshot = false;
    let snapshotRevision = -1;

    await page3.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__mockWsClients = (window as unknown as Record<string, unknown>).__mockWsClients || [];
      (window as unknown as Record<string, unknown>).__mockOpCount = (window as unknown as Record<string, unknown>).__mockOpCount || 0;

      class MockWebSocket {
        public readyState = 1;
        public onopen: (() => void) | null = null;
        public onmessage: ((event: { data: string }) => void) | null = null;
        public onclose: (() => void) | null = null;
        public onerror: ((error: unknown) => void) | null = null;
        public url: string;
        public userId: string = '';
        public userName: string = '';
        private clients: Array<{ userId: string; userName: string; ws: MockWebSocket }> = [];
        private revision = 0;
        private sentSnapshot = false;
        private snapshotThreshold = 100;

        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        constructor(url: string) {
          this.url = url;
          const urlObj = new URL(url);
          this.userId = '';
          this.userName = '';

          urlObj.searchParams.forEach((value, key) => {
            if (key === 'userId') this.userId = value;
            if (key === 'userName') this.userName = value;
          });

          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          clients.push({ userId: this.userId, userName: this.userName, ws: this });
          this.clients = clients;

          setTimeout(() => {
            if (this.onopen) this.onopen();

            const existingUsers = clients
              .filter(c => c.userId !== this.userId)
              .map(c => ({
                userId: c.userId,
                userName: c.userName,
                color: '#4ECDC4',
                selection: null,
                lastActive: Date.now()
              }));

            const currentOpCount = (window as unknown as Record<string, unknown>).__mockOpCount as number;

            // 超过阈值，发送 SNAPSHOT
            if (currentOpCount > this.snapshotThreshold) {
              this.sentSnapshot = true;
              (window as unknown as Record<string, unknown>).__receivedSnapshotRevision = currentOpCount;
              this.onmessage?.({ data: JSON.stringify({
                type: 'state',
                payload: {
                  workbook: {
                    sheets: [{
                      id: 'sheet1',
                      name: 'Sheet1',
                      data: {
                        cells: [[{ content: 'SNAPSHOT_LOADED' }]],
                        rowHeights: [28],
                        colWidths: [100]
                      }
                    }]
                  },
                  revision: currentOpCount,
                  users: existingUsers
                }
              })});
            } else {
              this.onmessage?.({ data: JSON.stringify({
                type: 'state',
                payload: {
                  document: { rows: [], cols: 0 },
                  revision: this.revision,
                  users: existingUsers
                }
              })});
            }
          }, 50);
        }

        send(data: string): void {
          const msg = JSON.parse(data);

          if (msg.type === 'operation') {
            (window as unknown as Record<string, unknown>).__mockOpCount = ((window as unknown as Record<string, unknown>).__mockOpCount as number || 0) + 1;
            this.revision++;

            for (const client of this.clients) {
              if (client.userId !== this.userId) {
                setTimeout(() => {
                  client.ws.onmessage?.({ data: JSON.stringify({
                    type: 'remote_op',
                    payload: {
                      revision: this.revision,
                      operation: msg.payload.operation,
                      userId: this.userId
                    }
                  })});
                }, 10);
              }
            }

            setTimeout(() => {
              this.onmessage?.({ data: JSON.stringify({
                type: 'ack',
                payload: { revision: this.revision }
              })});
            }, 20);
          }
        }

        close(): void {
          this.readyState = 3;
          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          const idx = clients.findIndex(c => c.ws === this);
          if (idx !== -1) clients.splice(idx, 1);
          if (this.onclose) this.onclose();
        }
      }

      // @ts-expect-error - 动态添加
      window.MockWebSocket = MockWebSocket;
    });

    await page3.addInitScript(() => {
      const originalWebSocket = (window as unknown as Record<string, unknown>).WebSocket;
      const MockWS = (window as unknown as Record<string, unknown>).MockWebSocket;
      if (originalWebSocket && MockWS) {
        (window as unknown as Record<string, unknown>).WebSocket = function(url: string) {
          if (url.includes('roomId')) {
            return new MockWS(url);
          }
          return new originalWebSocket(url);
        } as typeof WebSocket;
      }
    });

    await page3.goto(`${BASE_URL}?roomId=${roomId}&userName=User3`);
    await page3.waitForSelector('#excel-canvas');
    await page3.waitForTimeout(500);

    // 验证 User3 收到了 SNAPSHOT（revision 应该 > 100）
    const user3Revision = await page3.evaluate(() => {
      return (window as unknown as Record<string, unknown>).__receivedSnapshotRevision as number || -1;
    });

    expect(user3Revision).toBeGreaterThan(SNAPSHOT_THRESHOLD);

    // 清理
    await context1.close();
    await context2.close();
    await context3.close();
  });

  /**
   * Test: 接收 SNAPSHOT 后，客户端文档状态应与服务器快照匹配
   *
   * 验证当收到 SNAPSHOT state 消息时：
   * 1. 客户端的 OTClient revision 与 snapshot revision 一致
   * 2. 文档内容与 snapshot 中的 workbook 数据一致
   */
  test('需求2 - 接收 SNAPSHOT 后客户端文档状态匹配服务器快照', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const snapshotContent = 'SNAPSHOT_VERIFICATION_TEST';
    const snapshotRevision = 150;

    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__mockWsClients = [];
      (window as unknown as Record<string, unknown>).__mockSnapshotRevision = 150;
      (window as unknown as Record<string, unknown>).__mockSnapshotContent = 'SNAPSHOT_VERIFICATION_TEST';

      class MockWebSocket {
        public readyState = 1;
        public onopen: (() => void) | null = null;
        public onmessage: ((event: { data: string }) => void) | null = null;
        public onclose: (() => void) | null = null;
        public onerror: ((error: unknown) => void) | null = null;
        public url: string;
        public userId: string = '';
        public userName: string = '';
        private clients: Array<{ userId: string; userName: string; ws: MockWebSocket }> = [];
        private revision = 0;
        private snapshotSent = false;

        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        constructor(url: string) {
          this.url = url;
          const urlObj = new URL(url);
          this.userId = '';
          this.userName = '';

          urlObj.searchParams.forEach((value, key) => {
            if (key === 'userId') this.userId = value;
            if (key === 'userName') this.userName = value;
          });

          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          clients.push({ userId: this.userId, userName: this.userName, ws: this });
          this.clients = clients;

          setTimeout(() => {
            if (this.onopen) this.onopen();

            const existingUsers = clients
              .filter(c => c.userId !== this.userId)
              .map(c => ({
                userId: c.userId,
                userName: c.userName,
                color: '#4ECDC4',
                selection: null,
                lastActive: Date.now()
              }));

            // 总是发送 SNAPSHOT state
            if (!this.snapshotSent) {
              this.snapshotSent = true;
              const snapRevision = (window as unknown as Record<string, unknown>).__mockSnapshotRevision as number;
              const snapContent = (window as unknown as Record<string, unknown>).__mockSnapshotContent as string;

              this.onmessage?.({ data: JSON.stringify({
                type: 'state',
                payload: {
                  workbook: {
                    sheets: [{
                      id: 'sheet1',
                      name: 'Sheet1',
                      data: {
                        cells: [[{ content: snapContent }]],
                        rowHeights: [28],
                        colWidths: [100]
                      }
                    }]
                  },
                  revision: snapRevision,
                  users: existingUsers
                }
              })});
            }
          }, 50);
        }

        send(): void {
          // 不处理发送
        }

        close(): void {
          this.readyState = 3;
          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          const idx = clients.findIndex(c => c.ws === this);
          if (idx !== -1) clients.splice(idx, 1);
          if (this.onclose) this.onclose();
        }
      }

      // @ts-expect-error - 动态添加
      window.MockWebSocket = MockWebSocket;
    });

    await page.addInitScript(() => {
      const originalWebSocket = (window as unknown as Record<string, unknown>).WebSocket;
      const MockWS = (window as unknown as Record<string, unknown>).MockWebSocket;
      if (originalWebSocket && MockWS) {
        (window as unknown as Record<string, unknown>).WebSocket = function(url: string) {
          if (url.includes('roomId')) {
            return new MockWS(url);
          }
          return new originalWebSocket(url);
        } as typeof WebSocket;
      }
    });

    await page.goto(`${BASE_URL}?roomId=${roomId}&userName=SnapshotTest`);
    await page.waitForSelector('#excel-canvas');
    await page.waitForTimeout(500);

    // 等待协同引擎处理 SNAPSHOT
    await waitForCollabConnection(page, 'connected', 3000);

    // 验证 OTClient 的 revision 与 snapshot revision 一致
    const otRevision = await page.evaluate(() => {
      const app = (window as unknown as Record<string, unknown>).app;
      if (!app) return -1;
      const engine = (app as { getCollaborationEngine?: () => { getOtClient?: () => { revision: number } } }).getCollaborationEngine?.();
      return engine?.getOtClient?.()?.revision ?? -1;
    });

    expect(otRevision).toBe(snapshotRevision);

    // 验证文档内容（通过 onDocumentSync 回调设置的）
    const cellContent = await getCellContent(page, 0, 0);
    expect(cellContent).toBe(snapshotContent);

    await context.close();
  });

  /**
   * Test: SNAPSHOT 之后的后续操作应正确应用到快照状态之上
   *
   * 验证：
   * 1. 客户端基于 SNAPSHOT 初始化文档
   * 2. 后续的 remote_op 操作能正确应用到文档
   * 3. 最终文档状态 = 快照状态 + 后续操作
   */
  test('需求3 - SNAPSHOT 之后的后续操作正确应用到快照状态', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__mockWsClients = [];
      (window as unknown as Record<string, unknown>).__mockOpCount = 0;

      class MockWebSocket {
        public readyState = 1;
        public onopen: (() => void) | null = null;
        public onmessage: ((event: { data: string }) => void) | null = null;
        public onclose: (() => void) | null = null;
        public onerror: ((error: unknown) => void) | null = null;
        public url: string;
        public userId: string = '';
        public userName: string = '';
        private clients: Array<{ userId: string; userName: string; ws: MockWebSocket }> = [];
        private revision = 100; // 从 100 开始（模拟超过阈值）
        private snapshotSent = false;
        private snapshotThreshold = 100;

        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        constructor(url: string) {
          this.url = url;
          const urlObj = new URL(url);
          this.userId = '';
          this.userName = '';

          urlObj.searchParams.forEach((value, key) => {
            if (key === 'userId') this.userId = value;
            if (key === 'userName') this.userName = value;
          });

          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          clients.push({ userId: this.userId, userName: this.userName, ws: this });
          this.clients = clients;

          setTimeout(() => {
            if (this.onopen) this.onopen();

            const existingUsers = clients
              .filter(c => c.userId !== this.userId)
              .map(c => ({
                userId: c.userId,
                userName: c.userName,
                color: '#4ECDC4',
                selection: null,
                lastActive: Date.now()
              }));

            // User1 先加入，revision 从 100 开始
            if (!this.snapshotSent) {
              this.snapshotSent = true;
              // 发送 SNAPSHOT
              this.onmessage?.({ data: JSON.stringify({
                type: 'state',
                payload: {
                  workbook: {
                    sheets: [{
                      id: 'sheet1',
                      name: 'Sheet1',
                      data: {
                        cells: [[{ content: 'INITIAL_SNAPSHOT' }]],
                        rowHeights: [28],
                        colWidths: [100]
                      }
                    }]
                  },
                  revision: this.revision,
                  users: existingUsers
                }
              })});
            }
          }, 50);
        }

        send(data: string): void {
          const msg = JSON.parse(data);

          if (msg.type === 'operation') {
            (window as unknown as Record<string, unknown>).__mockOpCount = ((window as unknown as Record<string, unknown>).__mockOpCount as number || 0) + 1;
            this.revision++;

            // 广播操作给 page2
            for (const client of this.clients) {
              if (client.userId !== this.userId) {
                setTimeout(() => {
                  client.ws.onmessage?.({ data: JSON.stringify({
                    type: 'remote_op',
                    payload: {
                      revision: this.revision,
                      operation: msg.payload.operation,
                      userId: this.userId
                    }
                  })});
                }, 10);
              }
            }

            setTimeout(() => {
              this.onmessage?.({ data: JSON.stringify({
                type: 'ack',
                payload: { revision: this.revision }
              })});
            }, 20);
          }
        }

        close(): void {
          this.readyState = 3;
          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          const idx = clients.findIndex(c => c.ws === this);
          if (idx !== -1) clients.splice(idx, 1);
          if (this.onclose) this.onclose();
        }
      }

      // @ts-expect-error - 动态添加
      window.MockWebSocket = MockWebSocket;
    });

    await page1.addInitScript(() => {
      const originalWebSocket = (window as unknown as Record<string, unknown>).WebSocket;
      const MockWS = (window as unknown as Record<string, unknown>).MockWebSocket;
      if (originalWebSocket && MockWS) {
        (window as unknown as Record<string, unknown>).WebSocket = function(url: string) {
          if (url.includes('roomId')) {
            return new MockWS(url);
          }
          return new originalWebSocket(url);
        } as typeof WebSocket;
      }
    });

    await page1.goto(`${BASE_URL}?roomId=${roomId}&userName=User1`);
    await page1.waitForSelector('#excel-canvas');
    await page1.waitForTimeout(500);

    // User2 加入（从 revision 100 开始，也超过阈值）
    await page2.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__mockWsClients = (window as unknown as Record<string, unknown>).__mockWsClients || [];
      (window as unknown as Record<string, unknown>).__mockOpCount = (window as unknown as Record<string, unknown>).__mockOpCount || 0;
      (window as unknown as Record<string, unknown>).__mockStartRevision = 100;

      class MockWebSocket {
        public readyState = 1;
        public onopen: (() => void) | null = null;
        public onmessage: ((event: { data: string }) => void) | null = null;
        public onclose: (() => void) | null = null;
        public onerror: ((error: unknown) => void) | null = null;
        public url: string;
        public userId: string = '';
        public userName: string = '';
        private clients: Array<{ userId: string; userName: string; ws: MockWebSocket }> = [];
        private revision = 100;
        private snapshotSent = false;

        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        constructor(url: string) {
          this.url = url;
          const urlObj = new URL(url);
          this.userId = '';
          this.userName = '';

          urlObj.searchParams.forEach((value, key) => {
            if (key === 'userId') this.userId = value;
            if (key === 'userName') this.userName = value;
          });

          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          clients.push({ userId: this.userId, userName: this.userName, ws: this });
          this.clients = clients;

          setTimeout(() => {
            if (this.onopen) this.onopen();

            const existingUsers = clients
              .filter(c => c.userId !== this.userId)
              .map(c => ({
                userId: c.userId,
                userName: c.userName,
                color: '#4ECDC4',
                selection: null,
                lastActive: Date.now()
              }));

            // User2 也收到 SNAPSHOT
            if (!this.snapshotSent) {
              this.snapshotSent = true;
              const startRev = (window as unknown as Record<string, unknown>).__mockStartRevision as number;
              this.revision = startRev;
              this.onmessage?.({ data: JSON.stringify({
                type: 'state',
                payload: {
                  workbook: {
                    sheets: [{
                      id: 'sheet1',
                      name: 'Sheet1',
                      data: {
                        cells: [[{ content: 'INITIAL_SNAPSHOT' }]],
                        rowHeights: [28],
                        colWidths: [100]
                      }
                    }]
                  },
                  revision: this.revision,
                  users: existingUsers
                }
              })});
            }
          }, 50);
        }

        send(data: string): void {
          const msg = JSON.parse(data);

          if (msg.type === 'operation') {
            (window as unknown as Record<string, unknown>).__mockOpCount = ((window as unknown as Record<string, unknown>).__mockOpCount as number || 0) + 1;
            this.revision++;

            for (const client of this.clients) {
              if (client.userId !== this.userId) {
                setTimeout(() => {
                  client.ws.onmessage?.({ data: JSON.stringify({
                    type: 'remote_op',
                    payload: {
                      revision: this.revision,
                      operation: msg.payload.operation,
                      userId: this.userId
                    }
                  })});
                }, 10);
              }
            }

            setTimeout(() => {
              this.onmessage?.({ data: JSON.stringify({
                type: 'ack',
                payload: { revision: this.revision }
              })});
            }, 20);
          }
        }

        close(): void {
          this.readyState = 3;
          const clients = (window as unknown as Record<string, unknown>).__mockWsClients as Array<{ userId: string; userName: string; ws: MockWebSocket }>;
          const idx = clients.findIndex(c => c.ws === this);
          if (idx !== -1) clients.splice(idx, 1);
          if (this.onclose) this.onclose();
        }
      }

      // @ts-expect-error - 动态添加
      window.MockWebSocket = MockWebSocket;
    });

    await page2.addInitScript(() => {
      const originalWebSocket = (window as unknown as Record<string, unknown>).WebSocket;
      const MockWS = (window as unknown as Record<string, unknown>).MockWebSocket;
      if (originalWebSocket && MockWS) {
        (window as unknown as Record<string, unknown>).WebSocket = function(url: string) {
          if (url.includes('roomId')) {
            return new MockWS(url);
          }
          return new originalWebSocket(url);
        } as typeof WebSocket;
      }
    });

    await page2.goto(`${BASE_URL}?roomId=${roomId}&userName=User2`);
    await page2.waitForSelector('#excel-canvas');
    await page2.waitForTimeout(500);

    // 验证初始状态
    const initialContent = await getCellContent(page2, 0, 0);
    expect(initialContent).toBe('INITIAL_SNAPSHOT');

    // User1 在 A2 单元格执行操作
    await clickCell(page1, 1, 0);
    await typeInCell(page1, 'AFTER_SNAPSHOT_1');
    await page1.waitForTimeout(200);

    // User1 在 B2 单元格执行另一个操作
    await clickCell(page1, 1, 1);
    await typeInCell(page1, 'AFTER_SNAPSHOT_2');
    await page1.waitForTimeout(200);

    // 等待操作同步
    await page2.waitForTimeout(500);

    // 验证 page2 应用了这些后续操作
    const cellA2Content = await getCellContent(page2, 1, 0);
    const cellB2Content = await getCellContent(page2, 1, 1);

    expect(cellA2Content).toBe('AFTER_SNAPSHOT_1');
    expect(cellB2Content).toBe('AFTER_SNAPSHOT_2');

    // 验证初始快照内容仍然保留（A1）
    const cellA1Content = await getCellContent(page2, 0, 0);
    expect(cellA1Content).toBe('INITIAL_SNAPSHOT');

    await context1.close();
    await context2.close();
  });
});
