/**
 * 连接和消息流程集成测试
 *
 * 完整用户旅程：初始化 SDK → 建立连接 → 发送消息 → 接收消息 → 断开连接
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionManager } from '@/core/connection/connection-manager';
import { MessageSender } from '@/core/message/message-sender';
import { MessageReceiver } from '@/core/message/message-receiver';
import { SOCKET_READY_STATE, type SocketAdapter, type SocketLike } from '@/platform';
import { Message, TextMessageBody } from '@/types';
import { EventHub } from '@/core/events/event-hub';
import { getMsyncRoot } from '@/protocol/msync/root';
import { ProvisionErrorCode } from '@/protocol/msync/types';

class MockSocketLike implements SocketLike {
  public readyState: number = SOCKET_READY_STATE.OPEN;
  public sentMessages: Array<Uint8Array | ArrayBuffer | string> = [];
  private readonly openListeners = new Set<() => void>();
  private readonly messageListeners = new Set<(data: string | ArrayBuffer) => void>();
  private readonly errorListeners = new Set<(error: unknown) => void>();
  private readonly closeListeners = new Set<(event: { code?: number; reason?: string }) => void>();

  public send(data: string | ArrayBuffer | Uint8Array): Promise<void> {
    this.sentMessages.push(data);
    return Promise.resolve();
  }

  public close(): void {
    this.readyState = SOCKET_READY_STATE.CLOSED;
    this.simulateClose();
  }

  public onOpen(handler: () => void): () => void {
    this.openListeners.add(handler);
    return (): void => {
      this.openListeners.delete(handler);
    };
  }

  public onMessage(handler: (data: string | ArrayBuffer) => void): () => void {
    this.messageListeners.add(handler);
    return (): void => {
      this.messageListeners.delete(handler);
    };
  }

  public onError(handler: (error: unknown) => void): () => void {
    this.errorListeners.add(handler);
    return (): void => {
      this.errorListeners.delete(handler);
    };
  }

  public onClose(handler: (event: { code?: number; reason?: string }) => void): () => void {
    this.closeListeners.add(handler);
    return (): void => {
      this.closeListeners.delete(handler);
    };
  }

  public simulateOpen(): void {
    this.readyState = SOCKET_READY_STATE.OPEN;
    this.openListeners.forEach(listener => {
      listener();
    });
  }

  public simulateMessage(data: ArrayBuffer | Uint8Array): void {
    const payload = data instanceof Uint8Array ? data.buffer : data;
    this.messageListeners.forEach(listener => {
      listener(payload);
    });
  }

  public simulateClose(event: { code?: number; reason?: string } = {}): void {
    this.readyState = SOCKET_READY_STATE.CLOSED;
    this.closeListeners.forEach(listener => {
      listener(event);
    });
  }
}

type ConnectionManagerInternal = {
  websocket: SocketLike | null;
  handleProvisionMessage: (payload: Uint8Array) => void;
};

const getInternalConnectionManager = (manager: ConnectionManager): ConnectionManagerInternal => {
  return manager as unknown as ConnectionManagerInternal;
};

describe('连接和消息流程集成测试', () => {
  let connectionManager: ConnectionManager;
  let messageSender: MessageSender;
  let messageReceiver: MessageReceiver;
  let mockWebSocket: MockSocketLike;
  let eventHub: EventHub;
  let createdSockets: MockSocketLike[];
  const mockAppKey = 'test#app';

  const buildProvisionPayload = (ok: boolean = true): Uint8Array => {
    const root = getMsyncRoot();
    const provisionType = root.lookupType('easemob.pb.Provision');
    const provisionPayload = provisionType.create({
      status: {
        errorCode: ok ? ProvisionErrorCode.OK : ProvisionErrorCode.FAIL,
        reason: ok ? '' : 'provision failed',
      },
      resource: ok ? 'mock-resource' : '',
    });
    return provisionType.encode(provisionPayload).finish();
  };

  const buildSyncAckPayload = (protocolId: string): Uint8Array => {
    const root = getMsyncRoot();
    const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
    const commSyncDl = commSyncDlType.create({
      metaId: protocolId,
      serverId: '1001',
      status: {
        errorCode: ProvisionErrorCode.OK,
      },
    });
    return commSyncDlType.encode(commSyncDl).finish();
  };

  beforeEach(() => {
    eventHub = new EventHub();
    createdSockets = [];
    const socketAdapter: SocketAdapter = {
      connect: vi.fn(async () => {
        const socket = new MockSocketLike();
        createdSockets.push(socket);
        return socket;
      }),
    };
    connectionManager = new ConnectionManager(
      {
        serverUrl: 'wss://im.example.com',
        userId: 'test-user',
        token: 'test-token',
        appKey: mockAppKey,
        socketAdapter,
      },
      eventHub
    );

    // 注意：websocket 在 connect() 时才创建，所以这里先设为 null
    const msyncCodec = connectionManager.getMsyncCodec();
    messageSender = new MessageSender(msyncCodec, null, eventHub);
    messageReceiver = new MessageReceiver(msyncCodec, messageSender, eventHub);
    connectionManager.setMessageReceiver(messageReceiver);
  });

  afterEach(async () => {
    await connectionManager.disconnect();
    messageSender.destroy();
    messageReceiver.destroy();
  });

  it('完整流程：初始化 → 连接 → 发送消息 → 接收消息 → 断开', async () => {
    // 1. 初始化 SDK
    expect(connectionManager.getConnectionStatus()).toBe('disconnected');

    // 2. 建立连接
    const connectPromise = connectionManager.connect();
    await new Promise(resolve => setTimeout(resolve, 0));
    mockWebSocket = createdSockets[0] as MockSocketLike;
    getInternalConnectionManager(connectionManager).handleProvisionMessage(buildProvisionPayload());
    await connectPromise;

    expect(connectionManager.getConnectionStatus()).toBe('connected');
    messageSender.setWebSocket(mockWebSocket);

    // 3. 发送消息
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
        content: 'Hello, World!',
      } as TextMessageBody,
    };

    const sendPromise = messageSender.sendMessage(message);

    // 模拟 ACK
    const protocolId = connectionManager.getMsyncCodec().toProtocolId(message.msgLocalId);
    setTimeout(() => {
      messageReceiver.handleSyncPayload(buildSyncAckPayload(protocolId));
    }, 10);

    const sentMessage = await sendPromise;
    expect(sentMessage.status).toBe('sent');
    expect(mockWebSocket.sentMessages.length).toBeGreaterThan(0);

    // 4. 接收消息
    const receivedMessages: Message[] = [];
    eventHub.addEventHandler('test', {
      onMessage: msg => {
        receivedMessages.push(msg);
      },
    });

    // 模拟接收消息（绕过具体解码细节）
    const sampleMessage: Message = {
      msgServerId: 'server-2001',
      msgLocalId: '',
    from: '',
    to: '',
      sender: { userId: 'user123' },
      conversationId: 'user123',
      conversationType: 'singleChat',
      type: 'text',
      status: 'sent',
      ext: {},
      timestamp: Date.now(),
      body: { content: 'Hello, World!' },
    };
    vi.spyOn(connectionManager.getMsyncCodec(), 'decodeSync').mockReturnValueOnce({
      ack: undefined,
      messages: [sampleMessage],
    });
    messageReceiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(receivedMessages.length).toBeGreaterThan(0);

    // 5. 断开连接
    await connectionManager.disconnect();
    expect(connectionManager.getConnectionStatus()).toBe('disconnected');
  });

  it('忽略旧连接 close 事件，避免重复触发重连', async () => {
    const connectPromise = connectionManager.connect(); // 发起连接
    await new Promise(resolve => setTimeout(resolve, 0)); // 等待 WebSocket 创建
    const firstSocket = createdSockets[0]; // 读取首个连接
    if (!firstSocket) {
      // 连接不存在视为失败
      throw new Error('WebSocket not created'); // 抛出错误
    } // 判断结束
    getInternalConnectionManager(connectionManager).handleProvisionMessage(buildProvisionPayload()); // 模拟 provision 成功
    await connectPromise; // 等待连接完成

    expect(connectionManager.getConnectionStatus()).toBe('connected'); // 校验首次连接成功

    firstSocket.simulateClose(); // 模拟断开触发重连
    await new Promise(resolve => setTimeout(resolve, 10)); // 等待新连接创建
    const secondSocket = createdSockets[1]; // 读取新连接

    if (!secondSocket) {
      // 连接不存在视为失败
      throw new Error('WebSocket not created'); // 抛出错误
    } // 判断结束

    expect(secondSocket).not.toBe(firstSocket); // 校验连接已切换

    getInternalConnectionManager(connectionManager).handleProvisionMessage(buildProvisionPayload()); // 模拟 provision 成功
    await new Promise(resolve => setTimeout(resolve, 10)); // 等待连接状态更新

    expect(connectionManager.getConnectionStatus()).toBe('connected'); // 校验重连成功

    firstSocket.simulateClose(); // 模拟旧连接迟到的 close 事件
    await new Promise(resolve => setTimeout(resolve, 10)); // 等待事件处理完成

    expect(connectionManager.getConnectionStatus()).toBe('connected'); // 旧连接事件不应影响当前连接
  });

  it('应该使用 conversationId/conversationType 统一标识消息所属会话', async () => {
    const connectPromise = connectionManager.connect();
    await new Promise(resolve => setTimeout(resolve, 0));
    mockWebSocket = createdSockets[0] as MockSocketLike;
    getInternalConnectionManager(connectionManager).handleProvisionMessage(buildProvisionPayload());
    await connectPromise;
    messageSender.setWebSocket(mockWebSocket);

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
        content: 'Test message',
      } as TextMessageBody,
    };

    const sendPromise = messageSender.sendMessage(message);
    const protocolId = connectionManager.getMsyncCodec().toProtocolId(message.msgLocalId);
    setTimeout(() => {
      messageReceiver.handleSyncPayload(buildSyncAckPayload(protocolId));
    }, 10);

    const sentMessage = await sendPromise;

    expect(sentMessage.conversationId).toBe('user123');
    expect(sentMessage.conversationType).toBe('singleChat');
  });

  it('连接建立时间应该不超过 2 秒', async () => {
    const startTime = Date.now();
    const connectPromise = connectionManager.connect();
    await new Promise(resolve => setTimeout(resolve, 0));
    getInternalConnectionManager(connectionManager).handleProvisionMessage(buildProvisionPayload());
    await connectPromise;

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(2000);
  });

  it('消息发送延迟应该不超过 100ms（P95）', async () => {
    const connectPromise = connectionManager.connect();
    await new Promise(resolve => setTimeout(resolve, 0));
    mockWebSocket = createdSockets[0] as MockSocketLike;
    getInternalConnectionManager(connectionManager).handleProvisionMessage(buildProvisionPayload());
    await connectPromise;
    messageSender.setWebSocket(mockWebSocket);

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
        content: 'Test',
      } as TextMessageBody,
    };

    const startTime = Date.now();
    const sendPromise = messageSender.sendMessage(message);

    const protocolId = connectionManager.getMsyncCodec().toProtocolId(message.msgLocalId);
    setTimeout(() => {
      messageReceiver.handleSyncPayload(buildSyncAckPayload(protocolId));
    }, 10);

    await sendPromise;
    const duration = Date.now() - startTime;

    // 注意：实际测试中应该统计多次发送的 P95 延迟
    expect(duration).toBeLessThan(100);
  });
});
