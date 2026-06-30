import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'; // 引入测试工具
import { attachmentFileStore } from '@/upload/attachment-file-store';
import { isImageMessageBody } from '@/types';
import { createImageMessage } from '@/message/create-message';

const sender = { userId: 'user-1' };

describe('createImageMessage', () => {
  // 图片消息创建测试
  const originalCreateObjectUrl = URL.createObjectURL; // 保存原始方法

  beforeEach(() => {
    // 每个用例前准备
    attachmentFileStore.clear();
  });

  afterEach(() => {
    // 每个用例后清理
    URL.createObjectURL = originalCreateObjectUrl; // 恢复原始方法
    vi.restoreAllMocks(); // 恢复 mock
    attachmentFileStore.clear();
  });

  it('should create image message with local url when data provided', () => {
    // data 生成本地 URL
    const createObjectUrlMock = vi.fn(() => 'blob:mock-url'); // mock ObjectURL
    URL.createObjectURL = createObjectUrlMock; // 替换生成方法

    const file = new File(['image'], 'image.png', { type: 'image/png' }); // 创建 File
    const message = createImageMessage(
      {
        // 创建图片消息
        conversationId: 'user-2',
        conversationType: 'singleChat', // 通道信息
        filename: 'image.png', // 文件名
        filetype: 'image/png', // 文件类型
        width: 120, // 图片宽度
        height: 80, // 图片高度
        isGif: false, // 非 GIF
        data: file, // 本地文件
      },
      sender
    ); // 结束创建

    expect(message.type).toBe('image'); // 校验消息类型
    if (!isImageMessageBody(message.body)) {
      throw new Error('Expected image message body');
    }
    expect(message.body.localUrl).toBe('blob:mock-url'); // 校验本地 URL
    expect(message.body.isOriginalImage).toBe(false);
    expect('data' in message.body).toBe(false); // body 不暴露 data
    expect(attachmentFileStore.get(message.msgLocalId)).toBe(file); // 缓存中保存 data
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1); // 校验调用次数
  });

  it('should keep gif flag', () => {
    // GIF 标记校验
    const message = createImageMessage(
      {
        // 创建图片消息
        conversationId: 'user-2',
        conversationType: 'singleChat', // 通道信息
        originalUrl: 'https://example.com/image.gif', // 图片地址
        filename: 'image.gif', // 文件名
        filetype: 'image/gif', // 文件类型
        width: 120, // 图片宽度
        height: 80, // 图片高度
        isGif: true, // GIF 标记
      },
      sender
    ); // 结束创建

    if (!isImageMessageBody(message.body)) {
      throw new Error('Expected image message body');
    }
    expect(message.body.isGif).toBe(true); // 校验 GIF 标记
    expect(message.body.isOriginalImage).toBe(true);
    expect(message.body.localUrl).toBe('');
    expect(message.body.originalImageUrl).toBe('https://example.com/image.gif');
    expect(message.body.bigImageUrl).toBe('https://example.com/image.gif?size=large');
  });

  it('should record normalized isOriginalImage', () => {
    const message = createImageMessage(
      {
        conversationId: 'user-2',
        conversationType: 'singleChat',
        originalUrl: 'https://example.com/image.png',
        filename: 'image.png',
        filetype: 'image/png',
        width: 120,
        height: 80,
        isGif: false,
        isOriginalImage: true,
      },
      sender
    );

    if (!isImageMessageBody(message.body)) {
      throw new Error('Expected image message body');
    }
    expect(message.body.isOriginalImage).toBe(true);
    expect(message.body.localUrl).toBe('');
  });

  it('should not derive bigImageUrl in custom attachment upload mode', () => {
    const message = createImageMessage(
      {
        conversationId: 'user-2',
        conversationType: 'singleChat',
        originalUrl: 'https://cdn.example.com/custom/image.jpg?token=1',
        thumbnailUrl: 'https://cdn.example.com/custom/thumb.jpg',
        filename: 'image.png',
        filetype: 'image/png',
        width: 120,
        height: 80,
        isGif: false,
      },
      sender,
      {
        useCustomAttachmentUpload: true,
      }
    );

    if (!isImageMessageBody(message.body)) {
      throw new Error('Expected image message body');
    }
    expect(message.body.originalImageUrl).toBe('https://cdn.example.com/custom/image.jpg?token=1');
    expect(message.body.bigImageUrl).toBeUndefined();
    expect(message.body.thumbnailUrl).toBe('https://cdn.example.com/custom/thumb.jpg');
  });

  it('should throw when width is invalid', () => {
    // 宽度校验失败
    expect(
      () =>
        // 断言抛错
        createImageMessage(
          {
            // 创建图片消息
            conversationId: 'user-2',
            conversationType: 'singleChat', // 通道信息
            originalUrl: 'https://example.com/image.png', // 图片地址
            filename: 'image.png', // 文件名
            filetype: 'image/png', // 文件类型
            width: 0, // 无效宽度
            height: 80, // 图片高度
            isGif: false, // 非 GIF
          },
          sender
        ) // 结束创建
    ).toThrow(); // 必须抛错
  });

  it('should throw when originalUrl and data are both missing', () => {
    // url/data 缺失校验
    expect(
      () =>
        // 断言抛错
        createImageMessage(
          {
            // 创建图片消息
            conversationId: 'user-2',
            conversationType: 'singleChat', // 通道信息
            filename: 'image.png', // 文件名
            filetype: 'image/png', // 文件类型
            width: 120, // 图片宽度
            height: 80, // 图片高度
            isGif: false, // 非 GIF
          },
          sender
        ) // 结束创建
    ).toThrow(); // 必须抛错
  });

  it('should create image message with only data (all metadata optional)', () => {
    const createObjectUrlMock = vi.fn(() => 'blob:mock-url');
    URL.createObjectURL = createObjectUrlMock;

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const message = createImageMessage(
      {
        conversationId: 'user-2',
        conversationType: 'singleChat',
        data: file,
      },
      sender
    );

    if (!isImageMessageBody(message.body)) {
      throw new Error('Expected image message body');
    }
    expect(message.type).toBe('image');
    expect(message.body.localUrl).toBe('blob:mock-url');
    expect(message.body.isGif).toBe(false);
    expect(message.body.isOriginalImage).toBe(false);
    expect(message.body.width).toBeUndefined();
    expect(message.body.height).toBeUndefined();
    expect(message.body.filename).toBeUndefined();
    expect(message.body.filetype).toBeUndefined();
  });

  it('should create image message with only originalUrl (all metadata optional)', () => {
    const message = createImageMessage(
      {
        conversationId: 'group-1',
        conversationType: 'groupChat',
        originalUrl: 'https://example.com/photo.png',
      },
      sender
    );

    if (!isImageMessageBody(message.body)) {
      throw new Error('Expected image message body');
    }
    expect(message.type).toBe('image');
    expect(message.body.isGif).toBe(false);
    expect(message.body.originalImageUrl).toBe('https://example.com/photo.png');
    expect(message.body.width).toBeUndefined();
    expect(message.body.height).toBeUndefined();
  });

  it('should not accept secret as input parameter', () => {
    const message = createImageMessage(
      {
        conversationId: 'user-2',
        conversationType: 'singleChat',
        originalUrl: 'https://example.com/photo.png',
        secret: 'some-secret',
      } as never,
      sender
    );

    if (!isImageMessageBody(message.body)) {
      throw new Error('Expected image message body');
    }
    expect(message.body.secret).toBeUndefined();
  });

  it('should use originalUrl (not legacy originalImageUrl) as input field name', () => {
    // 旧字段名 originalImageUrl 不被识别为远程地址
    expect(() =>
      createImageMessage(
        {
          conversationId: 'user-2',
          conversationType: 'singleChat',
          originalImageUrl: 'https://example.com/photo.png',
        } as never,
        sender
      )
    ).toThrow(); // originalUrl 和 data 都缺失，应报错
  });
});
