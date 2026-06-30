/**
 * 消息发送器单元测试
 *
 * 测试发送消息与失败语义
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageSender } from '@/core/message/message-sender';
import { InternalEventName, Message, TextMessageBody } from '@/types';
import { EventHub } from '@/core/events/event-hub';
import { MsyncCodec } from '@/protocol/msync/codec';
import { attachmentFileStore } from '@/upload/attachment-file-store';
import {
  getMessageProfileVersionSidecar,
  setMessageProfileVersionSidecar,
} from '@/core/message/profile-sync/profile-version-sidecar';

// Mock WebSocket
class MockWebSocket {
  readyState: number = WebSocket.OPEN;
  sentMessages: ArrayBuffer[] = [];

  send(data: string | ArrayBuffer): void {
    this.sentMessages.push(data as ArrayBuffer);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
  }
}

describe('MessageSender', () => {
  let sender: MessageSender;
  let mockWebSocket: MockWebSocket;
  let eventHub: EventHub;
  let msyncCodec: MsyncCodec;

  beforeEach(() => {
    mockWebSocket = new MockWebSocket();
    eventHub = new EventHub();
    msyncCodec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });
    sender = new MessageSender(msyncCodec, mockWebSocket as any, eventHub);
  });

  afterEach(() => {
    sender.destroy();
    attachmentFileStore.clear();
  });

  describe('发送消息', () => {
    it('应该成功发送消息', async () => {
      const conversationId = 'user123';
      const conversationType = 'singleChat' as const;

      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-123',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId,
        conversationType,
        type: 'text',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          content: 'Hello',
        } as TextMessageBody,
      };

      const sendPromise = sender.sendMessage(message);

      // 模拟 ACK
      setTimeout(() => {
        sender.handleAck(msyncCodec.toProtocolId('local-123'));
      }, 10);

      const result = await sendPromise;

      expect(result.status).toBe('sent');
      expect(mockWebSocket.sentMessages.length).toBe(1);
    });

    it('发送中的克隆消息应保留资料版本 sidecar', async () => {
      const conversationId = 'user123';
      const conversationType = 'singleChat' as const;

      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-profile-sync-1',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId,
        conversationType,
        type: 'text',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          content: 'Hello profile sync',
        } as TextMessageBody,
      };

      setMessageProfileVersionSidecar(message, {
        userInfoUpdateTime: 1776825600,
      });

      const encodeSpy = vi.spyOn(msyncCodec, 'encodeChatMessage');
      const sendPromise = sender.sendMessage(message);

      setTimeout(() => {
        sender.handleAck(msyncCodec.toProtocolId(message.msgLocalId));
      }, 10);

      await sendPromise;

      expect(encodeSpy).toHaveBeenCalledTimes(1);
      const encodedMessage = encodeSpy.mock.calls[0]?.[0] as Message;
      expect(encodedMessage).not.toBe(message);
      expect(getMessageProfileVersionSidecar(encodedMessage)).toEqual({
        userInfoUpdateTime: 1776825600,
      });
    });

    it('发送失败时不应自动重试', async () => {
      const conversationId = 'user123';
      const conversationType = 'singleChat' as const;

      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-123',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId,
        conversationType,
        type: 'text',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          content: 'Hello',
        } as TextMessageBody,
      };

      // 模拟发送失败
      mockWebSocket.send = vi.fn(() => {
        throw new Error('Send failed');
      });

      const sendPromise = sender.sendMessage(message);

      await expect(sendPromise).rejects.toThrow();

      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
    });

    it('发送成功后应清理附件缓存', async () => {
      const conversationId = 'user123';
      const conversationType = 'singleChat' as const;

      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-file-1',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId,
        conversationType,
        type: 'file',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          url: 'https://example.com/file.txt',
          filename: 'file.txt',
          filetype: 'text/plain',
        },
      };

      const file = new File(['demo'], 'file.txt', { type: 'text/plain' });
      attachmentFileStore.set(message.msgLocalId, file);

      const sendPromise = sender.sendMessage(message);

      setTimeout(() => {
        sender.handleAck(msyncCodec.toProtocolId('local-file-1'));
      }, 10);

      await sendPromise;

      expect(attachmentFileStore.get(message.msgLocalId)).toBeUndefined();
    });

    it('发送失败时应保留附件缓存', async () => {
      const conversationId = 'user123';
      const conversationType = 'singleChat' as const;

      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-file-2',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId,
        conversationType,
        type: 'file',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          url: 'https://example.com/file.txt',
          filename: 'file.txt',
          filetype: 'text/plain',
        },
      };

      const file = new File(['demo'], 'file.txt', { type: 'text/plain' });
      attachmentFileStore.set(message.msgLocalId, file);

      const sendPromise = (sender as any).doSendMessage(message);

      setTimeout(() => {
        sender.handleSendError(msyncCodec.toProtocolId('local-file-2'), new Error('send failed'));
      }, 10);

      await expect(sendPromise).rejects.toThrow();
      expect(attachmentFileStore.get(message.msgLocalId)).toBe(file);
    });

    it('发送失败时不应产生指数退避重试延迟', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      global.setTimeout = vi.fn((fn: Function, delay?: number) => {
        // 只记录重试相关的延迟（排除 ACK 超时 30000ms）
        if (delay && delay > 0 && delay < 10000) {
          delays.push(delay);
        }
        return originalSetTimeout(fn, delay ?? 0);
      }) as any;

      const conversationId = 'user123';
      const conversationType = 'singleChat' as const;

      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-123',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId,
        conversationType,
        type: 'text',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          content: 'Hello',
        } as TextMessageBody,
      };

      mockWebSocket.send = vi.fn(() => {
        throw new Error('Send failed');
      });

      try {
        await sender.sendMessage(message);
      } catch {
        // Expected to fail
      }

      expect(delays).toEqual([]);

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('消息状态回调', () => {
    it('应该触发发送中回调', async () => {
      const onSending = vi.fn();

      const conversationId = 'user123';
      const conversationType = 'singleChat' as const;

      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-123',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId,
        conversationType,
        type: 'text',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          content: 'Hello',
        } as TextMessageBody,
      };

      const sendPromise = sender.sendMessage(message, {
        onSending,
      });

      setTimeout(() => {
        sender.handleAck(msyncCodec.toProtocolId('local-123'));
      }, 10);

      await sendPromise;

      expect(onSending).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sending',
          msgLocalId: 'local-123',
        })
      );
    });

    it('onSending 应返回预处理后的最终消息快照', async () => {
      const attachmentUploader = {
        prepareMessage: vi.fn(async (message: Message): Promise<Message> => {
          return {
            ...message,
            body: {
              localUrl: 'blob:local-image',
              originalImageUrl: 'https://example.com/chatfiles/uuid-1',
              bigImageUrl: 'https://example.com/chatfiles/uuid-1?size=large',
              thumbnailUrl: 'https://example.com/chatfiles/uuid-1?size=small',
              filename: 'image.png',
              filetype: 'image/jpeg',
              width: 720,
              height: 1280,
              isGif: false,
              isOriginalImage: false,
            },
          };
        }),
      };
      sender = new MessageSender(
        msyncCodec,
        mockWebSocket as any,
        eventHub,
        attachmentUploader as any
      );

      const onSending = vi.fn();

      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-image-prepare-1',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId: 'user123',
        conversationType: 'singleChat',
        type: 'image',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          localUrl: 'blob:local-image',
          filename: 'image.png',
          filetype: 'image/png',
          width: 1080,
          height: 1920,
          isGif: false,
          isOriginalImage: false,
        },
      };

      const sendPromise = sender.sendMessage(message, {
        onSending,
      });

      setTimeout(() => {
        sender.handleAck(msyncCodec.toProtocolId('local-image-prepare-1'));
      }, 10);

      await sendPromise;

      expect(onSending).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sending',
          body: expect.objectContaining({
            width: 720,
            height: 1280,
            isOriginalImage: false,
            filetype: 'image/jpeg',
          }),
        })
      );
    });

    it('应该触发已发送回调', async () => {
      const onSent = vi.fn();
      eventHub.addEventHandler('test', {
        [InternalEventName.MESSAGE_SENT]: onSent,
      });

      const conversationId = 'user123';
      const conversationType = 'singleChat' as const;

      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-123',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId,
        conversationType,
        type: 'text',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          content: 'Hello',
        } as TextMessageBody,
      };

      const sendPromise = sender.sendMessage(message);

      setTimeout(() => {
        sender.handleAck(msyncCodec.toProtocolId('local-123'));
      }, 10);

      await sendPromise;

      expect(onSent).toHaveBeenCalled();
    });

    it('onSuccess 应返回本次发送成功的消息', async () => {
      const onSuccess = vi.fn();
      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-success-1',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId: 'user123',
        conversationType: 'singleChat',
        type: 'text',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          content: 'Hello',
        } as TextMessageBody,
      };

      const sendPromise = sender.sendMessage(message, {
        onSuccess,
      });

      setTimeout(() => {
        sender.handleAck(msyncCodec.toProtocolId('local-success-1'), 'server-success-1');
      }, 10);

      const result = await sendPromise;

      expect(onSuccess).toHaveBeenCalledWith(result);
      expect(result.msgServerId).toBe('server-success-1');
    });

    it('应该触发发送失败回调', async () => {
      const onFailed = vi.fn();

      const conversationId = 'user123';
      const conversationType = 'singleChat' as const;

      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-123',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId,
        conversationType,
        type: 'text',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          content: 'Hello',
        } as TextMessageBody,
      };

      mockWebSocket.send = vi.fn(() => {
        throw new Error('Send failed');
      });

      try {
        await sender.sendMessage(message, {
          onFailed,
        });
      } catch {
        // Expected to fail
      }

      expect(onFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          msgLocalId: 'local-123',
        }),
        expect.any(Error)
      );
    });

    it('onFailed 应返回本次发送失败的消息和错误', async () => {
      const onFailed = vi.fn();
      const message: Message = {
        msgServerId: '',
        msgLocalId: 'local-failed-1',
    from: '',
    to: '',
        sender: {
          userId: 'test-user',
        },
        conversationId: 'user123',
        conversationType: 'singleChat',
        type: 'text',
        status: 'sending',
        ext: {},
        timestamp: Date.now(),
        body: {
          content: 'Hello',
        } as TextMessageBody,
      };

      mockWebSocket.send = vi.fn(() => {
        throw new Error('Send failed');
      });

      await expect(
        sender.sendMessage(message, {
          onFailed,
        })
      ).rejects.toThrow();

      expect(onFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          msgLocalId: 'local-failed-1',
    from: '',
    to: '',
          status: 'failed',
        }),
        expect.any(Error)
      );
    });

    it('ACK 超时失败时应保留附件上传后的远端资源信息', async () => {
      vi.useFakeTimers();
      try {
        const attachmentUploader = {
          prepareMessage: vi.fn(async (message: Message): Promise<Message> => {
            return {
              ...message,
              body: {
                localUrl: 'blob:local-image',
                originalImageUrl: 'https://example.com/chatfiles/uuid-1',
                bigImageUrl: 'https://example.com/chatfiles/uuid-1?size=large',
                thumbnailUrl: 'https://example.com/chatfiles/uuid-1?size=small',
                filename: 'image.png',
                filetype: 'image/png',
                width: 720,
                height: 1280,
                isGif: false,
                isOriginalImage: false,
              },
            };
          }),
        };
        sender = new MessageSender(
          msyncCodec,
          mockWebSocket as any,
          eventHub,
          attachmentUploader as any
        );
        (sender as unknown as { ackTimeout: number }).ackTimeout = 1;

        const onFailed = vi.fn();

        const message: Message = {
          msgServerId: '',
          msgLocalId: 'local-image-timeout-1',
    from: '',
    to: '',
          sender: {
            userId: 'test-user',
          },
          conversationId: 'user123',
          conversationType: 'singleChat',
          type: 'image',
          status: 'sending',
          ext: {},
          timestamp: Date.now(),
          body: {
            localUrl: 'blob:local-image',
            filename: 'image.png',
            filetype: 'image/png',
            width: 1080,
            height: 1920,
            isGif: false,
            isOriginalImage: false,
          },
        };

        const sendPromise = sender.sendMessage(message, {
          onFailed,
        });
        const rejectionExpectation = expect(sendPromise).rejects.toThrow('Message ACK timeout');
        await vi.advanceTimersByTimeAsync(5000);
        await rejectionExpectation;

        const failedStatus = onFailed.mock.calls[0]?.[0] as Message | undefined;
        expect(failedStatus?.body).toMatchObject({
          originalImageUrl: 'https://example.com/chatfiles/uuid-1',
          bigImageUrl: 'https://example.com/chatfiles/uuid-1?size=large',
          thumbnailUrl: 'https://example.com/chatfiles/uuid-1?size=small',
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe('MessageSender 补充测试', () => {
  let sender: MessageSender;
  let eventHub: EventHub;
  let msyncCodec: MsyncCodec;

  beforeEach(() => {
    eventHub = new EventHub();
    msyncCodec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });
  });

  afterEach(() => {
    sender?.destroy();
  });

  const makeMessage = (overrides: Partial<Message> = {}): Message => ({
    msgServerId: '',
    msgLocalId: `local-${Date.now()}`,
    from: '',
    to: '',
    sender: { userId: 'test-user' },
    conversationId: 'user123',
    conversationType: 'singleChat',
    type: 'text',
    status: 'sending',
    ext: {},
    timestamp: Date.now(),
    body: { content: 'Hello' } as TextMessageBody,
    ...overrides,
  });

  describe('sendMessage websocket 为 null', () => {
    it('websocket 为 null 时抛出 MESSAGE_NOT_CONNECTED', async () => {
      sender = new MessageSender(msyncCodec, null, eventHub);
      const message = makeMessage({ msgLocalId: 'local-null-ws' });
      await expect(sender.sendMessage(message)).rejects.toMatchObject({
        code: expect.anything(),
      });
      try {
        await sender.sendMessage(message);
      } catch (e: any) {
        expect(e.message).toContain('not connected');
      }
    });
  });

  describe('sendMessage stream 消息', () => {
    it('stream 类型消息抛出 STREAM_SEND_NOT_SUPPORTED', async () => {
      const mockWs = { readyState: WebSocket.OPEN, send: vi.fn() };
      sender = new MessageSender(msyncCodec, mockWs as any, eventHub);
      const message = makeMessage({
        msgLocalId: 'local-stream-1',
        stream: { streamId: 's1', sequence: 0, status: 'streaming' },
      } as any);
      await expect(sender.sendMessage(message)).rejects.toThrow('Stream message send is not supported');
    });
  });

  describe('sendAction', () => {
    it('发送 action 并通过 handleAck 解析', async () => {
      const mockWs = { readyState: WebSocket.OPEN, send: vi.fn() };
      sender = new MessageSender(msyncCodec, mockWs as any, eventHub);
      const actionPromise = sender.sendAction({
        kind: 'recall',
        conversationId: 'conv1',
        conversationType: 'singleChat',
        messageId: 'msg1',
      });
      // 找到 pending protocolId 并 ack
      const pendingMessages = (sender as any).pendingMessages as Map<string, any>;
      const protocolId = [...pendingMessages.keys()][0];
      sender.handleAck(protocolId!, 'server-id-1');
      const result = await actionPromise;
      expect(result.serverId).toBe('server-id-1');
      expect(result.statusCode).toBe(0);
    });
  });

  describe('sendChatRoomOperation', () => {
    it('发送聊天室操作并通过 handleAck 解析', async () => {
      const mockWs = { readyState: WebSocket.OPEN, send: vi.fn() };
      sender = new MessageSender(msyncCodec, mockWs as any, eventHub);
      const encodeSpy = vi.spyOn(msyncCodec, 'encodeChatRoomOperation');

      const operationPromise = sender.sendChatRoomOperation({
        operation: 'join',
        chatRoomId: 'room-1',
        ext: 'hello',
        leaveOtherRooms: false,
      });
      const pendingMessages = (sender as any).pendingMessages as Map<string, any>;
      const protocolId = [...pendingMessages.keys()][0];

      expect(encodeSpy).toHaveBeenCalledWith(
        {
          operation: 'join',
          chatRoomId: 'room-1',
          ext: 'hello',
          leaveOtherRooms: false,
        },
        protocolId
      );
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      sender.handleAck(protocolId!, 'server-id-chatroom');
      await expect(operationPromise).resolves.toEqual({
        protocolId,
        serverId: 'server-id-chatroom',
        statusCode: 0,
      });
    });
  });

  describe('handleAckFailure', () => {
    it('action pending 时使用 createAckError 生成错误', async () => {
      const mockWs = { readyState: WebSocket.OPEN, send: vi.fn() };
      sender = new MessageSender(msyncCodec, mockWs as any, eventHub);
      const customError = new Error('custom ack error');
      const actionPromise = sender.sendAction(
        { kind: 'recall', conversationId: 'c1', conversationType: 'singleChat', messageId: 'm1' },
        () => customError
      );
      const pendingMessages = (sender as any).pendingMessages as Map<string, any>;
      const protocolId = [...pendingMessages.keys()][0];
      sender.handleAckFailure(protocolId!, 403, 'forbidden', new Error('fallback'));
      await expect(actionPromise).rejects.toBe(customError);
    });

    it('message pending 时委托给 handleSendError', async () => {
      const mockWs = { readyState: WebSocket.OPEN, send: vi.fn() };
      sender = new MessageSender(msyncCodec, mockWs as any, eventHub);
      const message = makeMessage({ msgLocalId: 'local-ack-fail' });
      const sendPromise = (sender as any).doSendMessage(message);
      const protocolId = msyncCodec.toProtocolId('local-ack-fail');
      sender.handleAckFailure(protocolId, 500, 'server error', new Error('ack fail'));
      await expect(sendPromise).rejects.toThrow('ack fail');
    });
  });

  describe('handleSendError', () => {
    it('action pending 时直接 reject', async () => {
      const mockWs = { readyState: WebSocket.OPEN, send: vi.fn() };
      sender = new MessageSender(msyncCodec, mockWs as any, eventHub);
      const actionPromise = sender.sendAction({
        kind: 'conversationRead',
        conversationId: 'c1',
        conversationType: 'singleChat',
      });
      const pendingMessages = (sender as any).pendingMessages as Map<string, any>;
      const protocolId = [...pendingMessages.keys()][0];
      sender.handleSendError(protocolId!, new Error('send error'));
      await expect(actionPromise).rejects.toThrow('send error');
    });
  });

  describe('handleAck', () => {
    it('未知 protocolId 不抛错', () => {
      const mockWs = { readyState: WebSocket.OPEN, send: vi.fn() };
      sender = new MessageSender(msyncCodec, mockWs as any, eventHub);
      expect(() => sender.handleAck('unknown-protocol-id', 'server-1')).not.toThrow();
    });

    it('带 replacedMessage 时合并到结果', async () => {
      const mockWs = { readyState: WebSocket.OPEN, send: vi.fn() };
      sender = new MessageSender(msyncCodec, mockWs as any, eventHub);
      const message = makeMessage({ msgLocalId: 'local-replace' });
      const sendPromise = (sender as any).doSendMessage(message);
      const protocolId = msyncCodec.toProtocolId('local-replace');
      const replacedMessage: Partial<Message> = {
        type: 'text',
        body: { content: 'replaced content' } as TextMessageBody,
        ext: { replaced: true },
        timestamp: 99999,
        msgServerId: 'replaced-server-id',
      };
      sender.handleAck(protocolId, undefined, replacedMessage as Message);
      const result = await sendPromise;
      expect(result.body).toEqual({ content: 'replaced content' });
      expect(result.msgServerId).toBe('replaced-server-id');
      expect(result.timestamp).toBe(99999);
    });
  });
});
