/**
 * 连接重连测试工具
 */

import { ConnectionManager, type ConnectionConfig } from '@/core/connection/connection-manager'; // 连接管理器
import { EventHub } from '@/core/events/event-hub'; // 事件中心
import { vi } from 'vitest'; // 测试工具

export const buildConnectionManager = ( // 创建连接管理器
  eventHub: EventHub, // 事件中心
  overrides: Partial<ConnectionConfig> = {} // 覆盖配置
): ConnectionManager => {
  const baseConfig: ConnectionConfig = { // 基础配置
    serverUrl: 'wss://test.example.com', // 默认 WS 地址
    userId: 'user-1', // 默认用户 ID
    token: 'token-1', // 默认 token
    appKey: 'app#key', // 默认 appKey
  };
  return new ConnectionManager({ ...baseConfig, ...overrides }, eventHub); // 创建管理器
};

export const spyConnectOnce = (manager: ConnectionManager) => { // 监控 connectOnce
  const internal = manager as unknown as { connectOnce: (...args: never[]) => Promise<void> }; // 访问私有方法
  return vi.spyOn(internal, 'connectOnce'); // 监控连接方法
};

export const flushPromises = async (): Promise<void> => { // 刷新微任务
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0); // 释放事件循环
  });
};
