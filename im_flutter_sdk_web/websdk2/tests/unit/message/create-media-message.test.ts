import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'; // 引入测试工具
import { resetChatClientSingleton, setupLoggedInClient } from './test-utils'; // 引入测试辅助方法
import { ChatManager } from '@/managers/chat-manager'; // 引入 ChatManager
import {
  isFileMessageBody,
  isLocationMessageBody,
  isVideoMessageBody,
  isVoiceMessageBody,
} from '@/types';

describe('create media messages', () => {
  // 多媒体消息创建测试
  beforeEach(() => {
    // 每个用例前准备
    resetChatClientSingleton(); // 重置单例
  });

  afterEach(() => {
    // 每个用例后清理
    vi.restoreAllMocks(); // 恢复 mock
  });

  it('should create file message with miniapp local url', async () => {
    // 文件消息校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录

    const message = client.chatManager.createFileMessage({
      // 创建文件消息
      conversationId: 'group-1',
      conversationType: 'groupChat', // 通道信息
      filename: 'file.txt', // 文件名
      filetype: 'text/plain', // 文件类型
      data: { path: '/tmp/file.txt', name: 'file.txt', type: 'text/plain' }, // 本地文件对象
    }); // 结束创建

    expect(message.type).toBe('file'); // 校验消息类型
    if (!isFileMessageBody(message.body)) {
      throw new Error('Expected file message body');
    }
    expect(message.body.url).toBe('/tmp/file.txt'); // 校验本地 URL
  });

  it('should create voice message with url', async () => {
    // 语音消息校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录

    const message = client.chatManager.createVoiceMessage({
      // 创建语音消息
      conversationId: 'user-2',
      conversationType: 'singleChat', // 通道信息
      originalUrl: 'https://example.com/voice.mp3', // 语音地址
      filename: 'voice.mp3', // 文件名
      filetype: 'audio/mpeg', // 文件类型
      duration: 12, // 语音时长
    }); // 结束创建

    expect(message.type).toBe('voice'); // 校验消息类型
    if (!isVoiceMessageBody(message.body)) {
      throw new Error('Expected voice message body');
    }
    expect(message.body.duration).toBe(12); // 校验时长
  });

  it('should create video message with miniapp local url', async () => {
    // 视频消息校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录

    const message = client.chatManager.createVideoMessage({
      // 创建视频消息
      conversationId: 'room-1',
      conversationType: 'chatRoom', // 通道信息
      filename: 'video.mp4', // 文件名
      filetype: 'video/mp4', // 文件类型
      duration: 30, // 视频时长
      width: 1920, // 视频宽度
      height: 1080, // 视频高度
      data: { path: '/tmp/video.mp4', name: 'video.mp4', type: 'video/mp4' }, // 本地文件对象
    }); // 结束创建

    expect(message.type).toBe('video'); // 校验消息类型
    if (!isVideoMessageBody(message.body)) {
      throw new Error('Expected video message body');
    }
    expect(message.body.url).toBe('/tmp/video.mp4'); // 校验本地 URL
    expect(message.body.secret).toBeUndefined(); // secret 不作为创建入参
    expect('thumbnailSecret' in message.body).toBe(false); // 不再暴露缩略图独立密钥
  });

  it('should create location message', async () => {
    // 位置消息校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录

    const message = client.chatManager.createLocationMessage({
      // 创建位置消息
      conversationId: 'user-2',
      conversationType: 'singleChat', // 通道信息
      latitude: 39.9, // 纬度
      longitude: 116.4, // 经度
      address: '北京市朝阳区', // 地址描述
    }); // 结束创建

    expect(message.type).toBe('location'); // 校验消息类型
    if (!isLocationMessageBody(message.body)) {
      throw new Error('Expected location message body');
    }
    expect(message.body.latitude).toBe(39.9); // 校验纬度
    expect(message.body.longitude).toBe(116.4); // 校验经度
  });

  it('should pass through webhookEnv for non-text messages', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);

    const fileMessage = client.chatManager.createFileMessage({
      conversationId: 'group-1',
      conversationType: 'groupChat',
      originalUrl: 'https://example.com/file.txt',
      webhookEnv: 'gray',
    });
    const locationMessage = client.chatManager.createLocationMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      latitude: 39.9,
      longitude: 116.4,
      webhookEnv: '',
    });

    expect(fileMessage.webhookEnv).toBe('gray');
    expect(locationMessage.webhookEnv).toBe('');
  });

  it('should throw when voice url and data are missing', async () => {
    // 缺少 url/data 校验
    const client = (await setupLoggedInClient()).use(ChatManager); // 初始化并登录

    expect(
      () =>
        // 断言抛错
        client.chatManager.createVoiceMessage({
          // 创建语音消息
          conversationId: 'user-2',
          conversationType: 'singleChat', // 通道信息
          filename: 'voice.mp3', // 文件名
          filetype: 'audio/mpeg', // 文件类型
          duration: 12, // 语音时长
        }) // 结束创建
    ).toThrow(); // 必须抛错
  });

  it('should create file message with only data (filename/filetype optional)', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    const client = (await setupLoggedInClient()).use(ChatManager);
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    const message = client.chatManager.createFileMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      data: file,
    });

    expect(message.type).toBe('file');
    expect((message.body as { url: string }).url).toBe('blob:mock-url');
    expect((message.body as { filename?: string }).filename).toBeUndefined();
    expect((message.body as { filetype?: string }).filetype).toBeUndefined();
    expect((message.body as { secret?: string }).secret).toBeUndefined();
  });

  it('should create voice message with only data (filename/filetype optional)', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    const client = (await setupLoggedInClient()).use(ChatManager);
    const file = new File(['audio'], 'voice.mp3', { type: 'audio/mpeg' });
    const message = client.chatManager.createVoiceMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      data: file,
      duration: 5,
    });

    expect(message.type).toBe('voice');
    expect((message.body as { filename?: string }).filename).toBeUndefined();
    expect((message.body as { filetype?: string }).filetype).toBeUndefined();
    expect((message.body as { secret?: string }).secret).toBeUndefined();
  });

  it('should create video message with only data (filename/filetype optional)', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    const client = (await setupLoggedInClient()).use(ChatManager);
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    const message = client.chatManager.createVideoMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      data: file,
      duration: 10,
    });

    expect(message.type).toBe('video');
    expect((message.body as { filename?: string }).filename).toBeUndefined();
    expect((message.body as { filetype?: string }).filetype).toBeUndefined();
    expect((message.body as { secret?: string }).secret).toBeUndefined();
  });

  it('should use originalUrl field name for file/voice/video messages', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);

    const fileMsg = client.chatManager.createFileMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      originalUrl: 'https://example.com/doc.pdf',
    });
    expect((fileMsg.body as { url: string }).url).toBe('https://example.com/doc.pdf');

    const voiceMsg = client.chatManager.createVoiceMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      originalUrl: 'https://example.com/voice.mp3',
      duration: 5,
    });
    expect((voiceMsg.body as { url: string }).url).toBe('https://example.com/voice.mp3');

    const videoMsg = client.chatManager.createVideoMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      originalUrl: 'https://example.com/video.mp4',
      duration: 10,
    });
    expect((videoMsg.body as { url: string }).url).toBe('https://example.com/video.mp4');
  });
});
