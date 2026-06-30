import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'; // 引入测试工具
import { resetChatClientSingleton, setupLoggedInClient } from './test-utils'; // 引入测试辅助方法
import { isCmdMessageBody, isCustomMessageBody } from '@/types';
import { ChatManager } from '@/managers/chat-manager'; // 引入 ChatManager

describe('create cmd/custom messages', () => {
  // 命令/自定义消息测试
  beforeEach(() => {
    // 每个用例前准备
    resetChatClientSingleton(); // 重置单例
  });

  afterEach(() => {
    // 每个用例后清理
    vi.restoreAllMocks(); // 恢复 mock
  });

  it('should create cmd message', async () => {
    // 命令消息校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录

    const message = client.chatManager.createCmdMessage({
      // 创建命令消息
      conversationId: 'user-2',
      conversationType: 'singleChat', // 通道信息
      action: 'typing', // 命令动作
      deliverOnlineOnly: true, // 仅在线投递
    }); // 结束创建

    expect(message.type).toBe('cmd'); // 校验消息类型
    if (!isCmdMessageBody(message.body)) {
      throw new Error('Expected cmd message body');
    }
    expect(message.body.action).toBe('typing'); // 校验动作字段
    expect(message.body.params).toBeUndefined(); // 命令创建不再写入参数
    expect(message.body.deliverOnlineOnly).toBe(true); // 校验兼容字段透传
    expect(message.deliverOnlineOnly).toBe(true); // 校验顶层字段透传
  });

  it('should ignore cmd params from untyped runtime input', async () => {
    // 命令参数收敛校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录

    const message = client.chatManager.createCmdMessage({
      // 模拟 JS 运行时仍传入旧字段
      conversationId: 'user-2',
      conversationType: 'singleChat',
      action: 'typing',
      params: { legacy: 'true' },
    } as unknown as Parameters<typeof client.chatManager.createCmdMessage>[0]); // 结束创建

    if (!isCmdMessageBody(message.body)) {
      throw new Error('Expected cmd message body');
    }
    expect(message.body.params).toBeUndefined(); // 旧字段不再进入命令消息体
  });

  it('should create custom message with ext', async () => {
    // 自定义消息校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录

    const message = client.chatManager.createCustomMessage({
      // 创建自定义消息
      conversationId: 'user-2',
      conversationType: 'singleChat', // 通道信息
      event: 'order.created', // 事件名称
      params: { orderId: '1' }, // 自定义参数
      ext: { source: 'web' }, // 扩展字段
    }); // 结束创建

    expect(message.type).toBe('custom'); // 校验消息类型
    if (!isCustomMessageBody(message.body)) {
      throw new Error('Expected custom message body');
    }
    expect(message.body.event).toBe('order.created'); // 校验事件字段
    expect(message.ext).toEqual({ source: 'web' }); // 校验扩展字段
  });

  it('should throw when ext is not JSON serializable', async () => {
    // 扩展字段校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录
    const ext: Record<string, unknown> = {}; // 构造循环引用
    ext.self = ext; // 制造循环引用

    expect(
      () =>
        // 断言抛错
        client.chatManager.createCmdMessage({
          // 创建命令消息
          conversationId: 'user-2',
          conversationType: 'singleChat', // 通道信息
          action: 'typing', // 命令动作
          ext, // 扩展字段
        }) // 结束创建
    ).toThrow(); // 必须抛错
  });
});
