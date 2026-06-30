/**
 * 连接管理器基础单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'; // 测试框架
import {
  ConnectionEventName,
  ConnectionEventReason,
  ConnectionStatus,
  type ConnectionEventPayload,
} from '@/types'; // 连接事件类型
import { EventHub } from '@/core/events/event-hub'; // 事件中心
import { getMsyncRoot } from '@/protocol/msync/root';
import { NameSpace } from '@/protocol/msync/types';
import { ERROR_CODES } from '@/utils/error-codes';
import { ConnectionError } from '@/utils/errors';
import { buildConnectionManager, spyConnectOnce } from './connection-test-utils'; // 测试工具

const buildStatisticSyncPayload = (operation: number, reason?: string): Uint8Array => {
  const root = getMsyncRoot();
  const statisticsType = root.lookupType('easemob.pb.StatisticsBody');
  const metaType = root.lookupType('easemob.pb.Meta');
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');

  const statisticPayload = statisticsType.encode(
    statisticsType.create({
      operation,
      ...(reason ? { reason } : {}),
    })
  ).finish();

  const meta = metaType.create({
    id: 1,
    ns: NameSpace.STATISTIC,
    payload: statisticPayload,
  });

  return commSyncDlType.encode(
    commSyncDlType.create({
      status: {
        errorCode: 0,
      },
      metas: [meta],
      metaId: 0,
      nextKey: 0,
      isLast: true,
    })
  ).finish();
};

const buildUnreadPayload = (queueNames: ReadonlyArray<string>): Uint8Array => {
  const root = getMsyncRoot();
  const unreadType = root.lookupType('easemob.pb.CommUnreadDL');
  return unreadType.encode(
    unreadType.create({
      unread: queueNames.map((name) => ({
        queue: {
          name,
        },
        n: 1,
      })),
    })
  ).finish();
};

const buildEmptySyncPayload = (): Uint8Array => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  return commSyncDlType.encode(
    commSyncDlType.create({
      status: {
        errorCode: 0,
      },
      metas: [],
      metaId: 0,
      nextKey: 0,
      isLast: true,
    })
  ).finish();
};

describe('ConnectionManager', (): void => {
  let eventHub: EventHub; // 事件中心

  beforeEach((): void => {
    eventHub = new EventHub(); // 初始化事件中心
  });

  afterEach((): void => {
    vi.restoreAllMocks(); // 恢复 mock
  });

  it('connect 成功后状态为 connected 并派发 onConnected', async (): Promise<void> => {
    const manager = buildConnectionManager(eventHub); // 创建连接管理器
    const events: ConnectionEventPayload[] = []; // 事件记录

    eventHub.addEventHandler('test', {
      [ConnectionEventName.CONNECTED]: (payload: ConnectionEventPayload): void => {
        events.push(payload); // 记录连接成功事件
      },
    });

    const connectOnceSpy = spyConnectOnce(manager); // 监控 connectOnce
    connectOnceSpy.mockResolvedValueOnce(undefined); // 模拟连接成功

    await manager.connect(); // 执行连接

    expect(manager.getConnectionStatus()).toBe(ConnectionStatus.CONNECTED); // 校验连接状态
    expect(events).toHaveLength(1); // 校验事件数量
    expect(events[0]?.reason).toBe(ConnectionEventReason.LOGIN); // 校验事件原因
  });

  it('disconnect 后状态为 disconnected 并派发 onDisconnected', async (): Promise<void> => {
    const manager = buildConnectionManager(eventHub); // 创建连接管理器
    const events: ConnectionEventPayload[] = []; // 事件记录

    eventHub.addEventHandler('test', {
      [ConnectionEventName.DISCONNECTED]: (payload: ConnectionEventPayload): void => {
        events.push(payload); // 记录断开事件
      },
    });

    const connectOnceSpy = spyConnectOnce(manager); // 监控 connectOnce
    connectOnceSpy.mockResolvedValueOnce(undefined); // 模拟连接成功

    await manager.connect(); // 执行连接
    await manager.disconnect(); // 执行断开

    expect(manager.getConnectionStatus()).toBe(ConnectionStatus.DISCONNECTED); // 校验断开状态
    expect(events).toHaveLength(1); // 校验断开事件
    expect(events[0]?.reason).toBe(ConnectionEventReason.CLOSE); // 校验断开原因
  });

  it('连接尝试时轮询切换 WebSocket 地址', (): void => {
    const manager = buildConnectionManager(eventHub, {
      // 创建连接管理器
      serverUrl: 'wss://one.example.com', // 默认 ws 地址
      serverUrls: ['wss://one.example.com', 'wss://two.example.com'], // 轮询地址列表
    });
    const internal = manager as unknown as { pickNextServerUrl: () => string }; // 访问内部方法

    expect(internal.pickNextServerUrl()).toBe('wss://one.example.com'); // 第一次取第一个地址
    expect(internal.pickNextServerUrl()).toBe('wss://two.example.com'); // 第二次取第二个地址
    expect(internal.pickNextServerUrl()).toBe('wss://one.example.com'); // 第三次回到第一个地址
  });

  it('收到 statistics 用户在其他设备登录后应断开并附带错误码', (): void => {
    const manager = buildConnectionManager(eventHub);
    const events: ConnectionEventPayload[] = [];
    const close = vi.fn();
    const internal = manager as unknown as {
      connection: { status: ConnectionStatus };
      websocket: { close: () => void } | null;
      isLoggedIn: boolean;
      hasEverConnected: boolean;
      reconnectPaused: boolean;
      handleSyncMessage: (payload: Uint8Array) => void;
    };

    eventHub.addEventHandler('test', {
      [ConnectionEventName.DISCONNECTED]: (payload: ConnectionEventPayload): void => {
        events.push(payload);
      },
    });

    internal.connection.status = ConnectionStatus.CONNECTED;
    internal.websocket = { close };
    internal.isLoggedIn = true;
    internal.hasEverConnected = true;

    internal.handleSyncMessage(
      buildStatisticSyncPayload(2, '{"loginInfoCustomExt":"from-statistics"}')
    );

    expect(manager.getConnectionStatus()).toBe(ConnectionStatus.DISCONNECTED);
    expect(close).toHaveBeenCalledTimes(1);
    expect(internal.websocket).toBeNull();
    expect(internal.reconnectPaused).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      reason: ConnectionEventReason.ERROR,
      errorCode: ERROR_CODES.USER_LOGIN_ANOTHER_DEVICE,
      errorMessage: 'The user is already logged on another device',
    });
  });

  it.each([
    [1, ERROR_CODES.USER_REMOVED],
    [2, ERROR_CODES.USER_LOGIN_ANOTHER_DEVICE],
    [3, ERROR_CODES.USER_KICKED_BY_CHANGE_PASSWORD],
    [4, ERROR_CODES.USER_KICKED_BY_OTHER_DEVICE],
  ])('statistics operation %s 应映射到错误码 %s', (operation, expectedCode): void => {
    const manager = buildConnectionManager(eventHub);
    const internal = manager as unknown as {
      resolveStatisticDisconnectError: (
        operations: ReadonlyArray<{ operation: number; reason?: string }>
      ) => ConnectionError | null;
    };

    const result = internal.resolveStatisticDisconnectError([{ operation }]);

    expect(result).toBeInstanceOf(ConnectionError);
    expect(result?.code).toBe(expectedCode);
  });

  it('UNREAD 离线队列同步应派发 onOfflineMessageSyncStart 与 onOfflineMessageSyncFinish', (): void => {
    const manager = buildConnectionManager(eventHub);
    const events: string[] = [];
    const internal = manager as unknown as {
      messageReceiver: {
        handleSyncPayload: () => {
          queue: { name: string };
          messages: [];
          isLast: boolean;
        };
      };
      handleUnreadMessage: (payload: Uint8Array) => void;
      handleSyncMessage: (payload: Uint8Array) => void;
      sendBackqueue: (queue: Record<string, unknown>) => void;
    };

    eventHub.addEventHandler('offline-sync-test', {
      [ConnectionEventName.OFFLINE_MESSAGE_SYNC_START]: (): void => {
        events.push(ConnectionEventName.OFFLINE_MESSAGE_SYNC_START);
      },
      [ConnectionEventName.OFFLINE_MESSAGE_SYNC_FINISH]: (): void => {
        events.push(ConnectionEventName.OFFLINE_MESSAGE_SYNC_FINISH);
      },
    });
    vi.spyOn(internal, 'sendBackqueue').mockImplementation((): void => undefined);
    internal.messageReceiver = {
      handleSyncPayload: vi.fn()
        .mockReturnValueOnce({
          queue: { name: 'queue-a' },
          messages: [],
          isLast: true,
        })
        .mockReturnValueOnce({
          queue: { name: 'queue-b' },
          messages: [],
          isLast: true,
        }),
    };

    internal.handleUnreadMessage(buildUnreadPayload(['queue-a', 'queue-b', 'queue-a']));
    internal.handleSyncMessage(buildEmptySyncPayload());
    internal.handleSyncMessage(buildEmptySyncPayload());

    expect(events).toEqual([
      ConnectionEventName.OFFLINE_MESSAGE_SYNC_START,
      ConnectionEventName.OFFLINE_MESSAGE_SYNC_FINISH,
    ]);
    expect(internal.sendBackqueue).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['缺失 queue.name', {}],
    ['返回未知 queue.name', { name: 'unknown-queue' }],
  ])('SYNC %s 时应回退移除本地队首避免重复拉取', (_name, responseQueue): void => {
    const manager = buildConnectionManager(eventHub);
    const internal = manager as unknown as {
      messageReceiver: {
        handleSyncPayload: () => {
          queue: Record<string, unknown>;
          messages: [];
          isLast: boolean;
        };
      };
      handleUnreadMessage: (payload: Uint8Array) => void;
      handleSyncMessage: (payload: Uint8Array) => void;
      sendBackqueue: (queue: Record<string, unknown>) => void;
    };

    const sendBackqueueSpy = vi
      .spyOn(internal, 'sendBackqueue')
      .mockImplementation((): void => undefined);
    internal.messageReceiver = {
      handleSyncPayload: vi.fn()
        .mockReturnValueOnce({
          queue: responseQueue,
          messages: [],
          isLast: true,
        })
        .mockReturnValueOnce({
          queue: responseQueue,
          messages: [],
          isLast: true,
        }),
    };

    internal.handleUnreadMessage(buildUnreadPayload(['queue-a', 'queue-b']));
    internal.handleSyncMessage(buildEmptySyncPayload());
    internal.handleSyncMessage(buildEmptySyncPayload());

    expect(sendBackqueueSpy).toHaveBeenCalledTimes(2);
    expect(sendBackqueueSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'queue-a' })
    );
    expect(sendBackqueueSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'queue-b' })
    );
  });
});
