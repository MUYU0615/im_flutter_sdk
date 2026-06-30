/**
 * 发送超时不重连测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'; // 测试框架
import {
  ConnectionEventName,
  ConnectionEventReason,
  InternalEventName,
  type ConnectionEventPayload,
  type SendTimeoutEventPayload,
} from '@/types'; // 连接事件类型
import { EventHub } from '@/core/events/event-hub'; // 事件中心
import { buildConnectionManager, flushPromises, spyConnectOnce } from './connection-test-utils'; // 测试工具

describe('send timeout no reconnect', (): void => {
  let eventHub: EventHub; // 事件中心

  beforeEach((): void => {
    eventHub = new EventHub(); // 初始化事件中心
    vi.restoreAllMocks(); // 恢复 mock
  });

  it('发送超时不应触发 onConnecting', async (): Promise<void> => {
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

    connectOnceSpy.mockResolvedValueOnce(undefined); // 模拟重连成功

    const payload: SendTimeoutEventPayload = {
      reason: ConnectionEventReason.SEND_TIMEOUT, // 超时原因
      timestamp: Date.now(), // 超时时间
    };

    eventHub.dispatch(InternalEventName.SEND_TIMEOUT, payload); // 派发发送超时事件
    await flushPromises(); // 等待异步重连

    expect(connectingEvents).toHaveLength(0); // 校验未触发重连
    expect(connectOnceSpy).toHaveBeenCalledTimes(1); // 仅登录时连接一次
  });
});
