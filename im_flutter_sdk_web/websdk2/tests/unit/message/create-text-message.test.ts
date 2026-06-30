import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'; // 引入测试工具
import { ChatClient } from '@/chat-client'; // 引入 ChatClient
import { ChatManager } from '@/managers/chat-manager'; // 引入 ChatManager
import { isTextMessageBody } from '@/types';
import { resetChatClientSingleton, setupLoggedInClient } from './test-utils'; // 引入测试辅助方法

describe('createTextMessage', () => {
  // 文本消息创建测试
  beforeEach(() => {
    // 每个用例前准备
    resetChatClientSingleton(); // 重置单例
  });

  afterEach(() => {
    // 每个用例后清理
    vi.restoreAllMocks(); // 恢复 mock
  });

  it('should create text message with defaults', async () => {
    // 默认字段校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录
    const message = client.chatManager.createTextMessage({
      // 创建文本消息
      conversationId: 'user-2',
      conversationType: 'singleChat', // 通道信息
      content: 'hello', // 文本内容
    }); // 结束创建

    expect(message.type).toBe('text'); // 校验消息类型
    if (!isTextMessageBody(message.body)) {
      throw new Error('Expected text message body');
    }
    expect(message.body.content).toBe('hello'); // 校验消息内容
    expect(message.status).toBe('sending'); // 校验默认状态
    expect(message.sender.userId).toBe('user-1'); // 校验发送者
    expect(message.from).toBe('user-1'); // 校验 from 等于 sender.userId
    expect(message.to).toBe('user-2'); // 校验 to 等于 conversationId
    expect(message.msgLocalId).not.toBe(''); // 校验本地 ID
    expect(message.timestamp).toBeGreaterThan(0); // 校验时间戳
    expect(message.ext).toEqual({}); // 校验扩展字段
    expect(message.direct).toBe('SEND'); // 校验消息方向默认值
    expect(message.isOnline).toBe(true); // 校验创建消息默认在线
  });

  it('should pass through receiverList and priority', async () => {
    // 扩展字段透传校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录
    const groupMessage = client.chatManager.createTextMessage({
      // 创建群组文本消息
      conversationId: 'group-1',
      conversationType: 'groupChat', // 群组通道
      content: 'hello group', // 文本内容
      receiverList: ['user-2', 'user-3'], // 定向接收列表
    }); // 结束创建
    const roomMessage = client.chatManager.createTextMessage({
      // 创建聊天室消息
      conversationId: 'room-1',
      conversationType: 'chatRoom', // 聊天室通道
      content: 'hello room', // 文本内容
      priority: 'high', // 消息优先级
    }); // 结束创建

    expect(groupMessage.receiverList).toEqual(['user-2', 'user-3']); // 校验定向接收列表
    expect(groupMessage.direct).toBe('SEND'); // 校验方向字段
    expect(roomMessage.priority).toBe('high'); // 校验优先级透传
  });

  it('should pass through webhookEnv including empty string', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);
    const messageWithEnv = client.chatManager.createTextMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      content: 'hello',
      webhookEnv: 'gray',
    });
    const messageWithEmptyEnv = client.chatManager.createTextMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      content: 'hello',
      webhookEnv: '',
    });

    expect(messageWithEnv.webhookEnv).toBe('gray');
    expect(messageWithEmptyEnv.webhookEnv).toBe('');
  });

  it('should throw when content is empty', async () => {
    // 空文本校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录

    expect(
      () =>
        // 断言抛错
        client.chatManager.createTextMessage({
          // 创建文本消息
          conversationId: 'user-2',
          conversationType: 'singleChat', // 通道信息
          content: '', // 空文本
        }) // 结束创建
    ).toThrow(); // 必须抛错
  });

  it('should throw when receiverList is used in non-group channel', async () => {
    // 非群组定向校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录

    expect(
      () =>
        // 断言抛错
        client.chatManager.createTextMessage({
          // 创建文本消息
          conversationId: 'user-2',
          conversationType: 'singleChat', // 单聊通道
          content: 'hello', // 文本内容
          receiverList: ['user-3'], // 非法定向参数
        }) // 结束创建
    ).toThrow(); // 必须抛错
  });

  it('should throw when not logged in', () => {
    // 未登录校验
    resetChatClientSingleton(); // 重置单例
    const client = ChatClient.init({ appKey: 'app-key' }).use(ChatManager); // 初始化客户端

    expect(
      () =>
        // 断言抛错
        client.chatManager.createTextMessage({
          // 创建文本消息
          conversationId: 'user-2',
          conversationType: 'singleChat', // 通道信息
          content: 'hello', // 文本内容
        }) // 结束创建
    ).toThrow(); // 必须抛错
  });

  it('should not accept msgLocalId as input parameter', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);
    const message = client.chatManager.createTextMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      content: 'hello',
      msgLocalId: 'user-provided-id', // 不应被接受
    } as never);

    // msgLocalId 应由 SDK 内部生成，忽略外部传入
    expect(message.msgLocalId).not.toBe('user-provided-id');
    expect(message.msgLocalId).not.toBe('');
  });

  it('should not accept translations as input parameter', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);
    const message = client.chatManager.createTextMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      content: 'hello',
      translations: { en: 'hello' }, // 不应被接受
    } as never);

    // translations 由 SDK 翻译 API 填充，创建时不应包含
    expect((message.body as { translations?: unknown }).translations).toBeUndefined();
  });

  it('should pass through needGroupReadReceipt', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);
    const message = client.chatManager.createTextMessage({
      conversationId: 'group-1',
      conversationType: 'groupChat',
      content: 'hello',
      needGroupReadReceipt: true,
    });

    expect(message.needGroupReadReceipt).toBe(true);
  });

  it('should default reactions and groupReadCount to undefined', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);
    const message = client.chatManager.createTextMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      content: 'hello',
    });

    expect(message.reactions).toBeUndefined();
    expect(message.groupReadCount).toBeUndefined();
  });
});
