/**
 * 前台心跳重连测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'; // 测试框架
import { ConnectionEventName, ConnectionEventReason, type ConnectionEventPayload } from '@/types'; // 连接事件类型
import { EventHub } from '@/core/events/event-hub'; // 事件中心
import { buildConnectionManager, flushPromises, spyConnectOnce } from './connection-test-utils'; // 测试工具

describe('foreground heartbeat', (): void => {
  let eventHub: EventHub; // 事件中心

  beforeEach((): void => {
    eventHub = new EventHub(); // 初始化事件中心
    vi.restoreAllMocks(); // 恢复 mock
  });

  it('前台心跳失败触发 onConnecting', async (): Promise<void> => {
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

    connectOnceSpy.mockResolvedValueOnce(undefined); // 模拟前台重连成功

    await manager.handleForeground(); // 触发前台检测
    await flushPromises(); // 等待异步重连

    expect(connectingEvents).toHaveLength(1); // 校验连接中事件数量
    expect(connectingEvents[0]?.reason).toBe(ConnectionEventReason.HEARTBEAT_FAILED); // 校验心跳失败原因
  });
});
