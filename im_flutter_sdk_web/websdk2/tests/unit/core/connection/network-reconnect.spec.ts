/**
 * 网络切换重连测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'; // 测试框架
import {
  ConnectionEventName,
  ConnectionEventReason,
  ConnectionStatus,
  type ConnectionEventPayload,
} from '@/types'; // 连接事件类型
import { EventHub } from '@/core/events/event-hub'; // 事件中心
import { buildConnectionManager, flushPromises, spyConnectOnce } from './connection-test-utils'; // 测试工具

describe('network reconnect', (): void => {
  let eventHub: EventHub; // 事件中心

  beforeEach((): void => {
    eventHub = new EventHub(); // 初始化事件中心
    vi.restoreAllMocks(); // 恢复 mock
  });

  it('offline 时关闭连接并派发 onDisconnected', async (): Promise<void> => {
    const manager = buildConnectionManager(eventHub); // 创建连接管理器
    const disconnectedEvents: ConnectionEventPayload[] = []; // 断开事件记录

    eventHub.addEventHandler('test', {
      [ConnectionEventName.DISCONNECTED]: (payload: ConnectionEventPayload): void => {
        disconnectedEvents.push(payload); // 记录断开事件
      },
    });

    const connectOnceSpy = spyConnectOnce(manager); // 监控 connectOnce
    connectOnceSpy.mockResolvedValueOnce(undefined); // 模拟连接成功

    await manager.connect(); // 执行连接

    manager.handleOffline(); // 触发离线

    expect(manager.getConnectionStatus()).toBe(ConnectionStatus.DISCONNECTED); // 校验断开状态
    expect(disconnectedEvents).toHaveLength(1); // 校验断开事件数量
    expect(disconnectedEvents[0]?.reason).toBe(ConnectionEventReason.OFFLINE); // 校验断开原因
    expect(disconnectedEvents[0]?.isOnline).toBe(false); // 校验离线状态
  });

  it('online 恢复后触发 onConnecting', async (): Promise<void> => {
    const manager = buildConnectionManager(eventHub); // 创建连接管理器
    const connectingEvents: ConnectionEventPayload[] = []; // 连接中事件记录

    eventHub.addEventHandler('test', {
      [ConnectionEventName.CONNECTING]: (payload: ConnectionEventPayload): void => {
        connectingEvents.push(payload); // 记录连接中事件
      },
    });

    const connectOnceSpy = spyConnectOnce(manager); // 监控 connectOnce
    connectOnceSpy.mockResolvedValueOnce(undefined); // 模拟首次连接成功

    await manager.connect(); // 执行连接
    connectingEvents.length = 0; // 清理登录阶段事件
    manager.handleOffline(); // 触发离线

    connectOnceSpy.mockResolvedValueOnce(undefined); // 模拟在线恢复重连成功

    manager.handleOnline(); // 触发在线
    await flushPromises(); // 等待异步重连

    expect(connectingEvents).toHaveLength(1); // 校验连接中事件数量
    expect(connectingEvents[0]?.reason).toBe(ConnectionEventReason.OFFLINE_RECOVER); // 校验离线恢复重连原因
  });
});
