/**
 * 达到上限后在线恢复重连测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'; // 测试框架
import {
  ConnectionEventName,
  ConnectionEventReason,
  type ConnectionEventPayload,
} from '@/types'; // 连接事件类型
import { EventHub } from '@/core/events/event-hub'; // 事件中心
import { buildConnectionManager, flushPromises, spyConnectOnce } from './connection-test-utils'; // 测试工具

describe('online resume', (): void => {
  let eventHub: EventHub; // 事件中心

  beforeEach((): void => {
    eventHub = new EventHub(); // 初始化事件中心
    vi.restoreAllMocks(); // 恢复 mock
  });

  it('达到上限后 online 事件恢复重连', async (): Promise<void> => {
    const manager = buildConnectionManager(eventHub, { autoReconnectNumMax: 1 }); // 创建连接管理器
    const reconnectFailedEvents: ConnectionEventPayload[] = []; // 失败事件记录
    const connectingEvents: ConnectionEventPayload[] = []; // 连接中事件记录

    eventHub.addEventHandler('test', {
      [ConnectionEventName.RECONNECT_FAILED]: (payload: ConnectionEventPayload): void => {
        reconnectFailedEvents.push(payload); // 记录失败事件
      },
      [ConnectionEventName.CONNECTING]: (payload: ConnectionEventPayload): void => {
        connectingEvents.push(payload); // 记录连接中事件
      },
    });

    const connectOnceSpy = spyConnectOnce(manager); // 监控 connectOnce
    connectOnceSpy.mockResolvedValueOnce(undefined); // 模拟首次连接成功

    await manager.connect(); // 执行连接
    connectingEvents.length = 0; // 清理登录阶段事件

    connectOnceSpy.mockRejectedValueOnce(new Error('reconnect failed')); // 模拟重连失败

    (manager as unknown as { handleDisconnection: (reason: ConnectionEventReason) => void })
      .handleDisconnection(ConnectionEventReason.ERROR); // 触发真实断连重连
    await flushPromises(); // 等待异步重连

    expect(reconnectFailedEvents).toHaveLength(1); // 校验失败事件
    expect(reconnectFailedEvents[0]?.reason).toBe(ConnectionEventReason.LIMIT); // 校验失败原因
    connectingEvents.length = 0; // 清理失败前连接事件

    connectOnceSpy.mockResolvedValueOnce(undefined); // 模拟 online 恢复连接成功

    manager.handleOnline(); // 触发在线恢复
    await flushPromises(); // 等待异步重连

    expect(connectingEvents).toHaveLength(1); // 校验连接中事件
    expect(connectingEvents[0]?.reason).toBe(ConnectionEventReason.ONLINE); // 校验在线原因
  });
});
