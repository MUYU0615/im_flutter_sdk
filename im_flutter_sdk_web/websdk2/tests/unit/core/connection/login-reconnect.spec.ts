/**
 * 登录阶段重连测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'; // 测试框架
import { ConnectionEventName, type ConnectionEventPayload } from '@/types'; // 连接事件类型
import { EventHub } from '@/core/events/event-hub'; // 事件中心
import { buildConnectionManager, spyConnectOnce } from './connection-test-utils'; // 测试工具
import { ConnectionError } from '@/utils/errors'; // 连接错误
import { ERROR_CODES } from '@/utils/error-codes'; // 错误码
import { MsyncCommand, ProvisionErrorCode } from '@/protocol/msync/types';
import { SOCKET_READY_STATE, type SocketAdapter, type SocketMessageData, type SocketSendData } from '@/platform';

class FakeSocket {
  public readyState: number = SOCKET_READY_STATE.OPEN;
  public readonly sentPayloads: SocketSendData[] = [];
  private readonly messageListeners = new Set<(data: SocketMessageData) => void>();
  private readonly closeListeners = new Set<(event: { code?: number; reason?: string }) => void>();

  public send(data: SocketSendData): Promise<void> {
    this.sentPayloads.push(data);
    return Promise.resolve();
  }

  public close(code?: number, reason?: string): void {
    this.readyState = SOCKET_READY_STATE.CLOSED;
    this.emitClose({ code, reason });
  }

  public onOpen(): () => void {
    return (): void => undefined;
  }

  public onMessage(handler: (data: SocketMessageData) => void): () => void {
    this.messageListeners.add(handler);
    return (): void => {
      this.messageListeners.delete(handler);
    };
  }

  public onError(): () => void {
    return (): void => undefined;
  }

  public onClose(handler: (event: { code?: number; reason?: string }) => void): () => void {
    this.closeListeners.add(handler);
    return (): void => {
      this.closeListeners.delete(handler);
    };
  }

  public emitMessage(data: SocketMessageData): void {
    for (const listener of this.messageListeners) {
      listener(data);
    }
  }

  public emitClose(event: { code?: number; reason?: string } = {}): void {
    for (const listener of this.closeListeners) {
      listener(event);
    }
  }
}

const encodeVarint = (value: number): number[] => {
  const bytes: number[] = [];
  let current = value;
  while (current >= 0x80) {
    bytes.push((current & 0x7f) | 0x80);
    current >>>= 7;
  }
  bytes.push(current);
  return bytes;
};

const buildProvisionFrame = (statusCode: number, reason: string): Uint8Array => {
  const reasonBytes = [...new TextEncoder().encode(reason)];
  const statusPayload = [
    0x08,
    ...encodeVarint(statusCode),
    0x12,
    ...encodeVarint(reasonBytes.length),
    ...reasonBytes,
  ];
  const provisionPayload = [0x42, ...encodeVarint(statusPayload.length), ...statusPayload];
  return new Uint8Array([
    0x40,
    MsyncCommand.PROVISION,
    0x4a,
    ...encodeVarint(provisionPayload.length),
    ...provisionPayload,
  ]);
};

describe('login reconnect', (): void => {
  let eventHub: EventHub; // 事件中心

  beforeEach((): void => {
    eventHub = new EventHub(); // 初始化事件中心
    vi.restoreAllMocks(); // 恢复 mock
  });

  it('登录阶段失败抛错且不派发 onDisconnected/onReconnectFailed', async (): Promise<void> => {
    const manager = buildConnectionManager(eventHub, { autoReconnectNumMax: 1 }); // 创建连接管理器
    const disconnectedEvents: ConnectionEventPayload[] = []; // 断开事件记录
    const reconnectFailedEvents: ConnectionEventPayload[] = []; // 失败事件记录

    eventHub.addEventHandler('test', {
      [ConnectionEventName.DISCONNECTED]: (payload: ConnectionEventPayload): void => {
        disconnectedEvents.push(payload); // 记录断开事件
      },
      [ConnectionEventName.RECONNECT_FAILED]: (payload: ConnectionEventPayload): void => {
        reconnectFailedEvents.push(payload); // 记录失败事件
      },
    });

    const connectOnceSpy = spyConnectOnce(manager); // 监控 connectOnce
    connectOnceSpy.mockRejectedValueOnce(new Error('connect failed')); // 模拟连接失败

    await expect(manager.connect()).rejects.toThrow(); // 校验登录抛错

    expect(disconnectedEvents).toHaveLength(0); // 登录阶段不派发断开
    expect(reconnectFailedEvents).toHaveLength(0); // 登录阶段不派发失败
  });

  it('autoReconnectNumMax=0 登录仍尝试一次', async (): Promise<void> => {
    const manager = buildConnectionManager(eventHub, { autoReconnectNumMax: 0 }); // 创建连接管理器
    const connectOnceSpy = spyConnectOnce(manager); // 监控 connectOnce

    connectOnceSpy.mockRejectedValueOnce(new Error('connect failed')); // 模拟连接失败

    await expect(manager.connect()).rejects.toThrow(); // 校验登录抛错

    expect(connectOnceSpy).toHaveBeenCalledTimes(1); // 校验仅尝试一次
  });

  it('业务错误不重试并直接结束登录', async (): Promise<void> => {
    const manager = buildConnectionManager(eventHub, { autoReconnectNumMax: 3 }); // 创建连接管理器
    const connectOnceSpy = spyConnectOnce(manager); // 监控 connectOnce
    const nonRetryableError = new ConnectionError('Provision rejected', { // 构造不可重试错误
      code: ERROR_CODES.AUTH_UNAUTHORIZED, // 设置鉴权错误码
      details: {
        retryable: false, // 标记不可重试
      },
    });

    connectOnceSpy.mockRejectedValueOnce(nonRetryableError); // 模拟业务错误

    await expect(manager.connect()).rejects.toThrow(); // 校验登录抛错

    expect(connectOnceSpy).toHaveBeenCalledTimes(1); // 校验不再重试
  });

  it('错误 token 的 provision rejected 应直接返回鉴权错误且忽略普通关闭文本帧', async (): Promise<void> => {
    const socket = new FakeSocket();
    const connect = vi.fn<SocketAdapter['connect']>().mockResolvedValue(socket);
    const manager = buildConnectionManager(eventHub, {
      autoReconnectNumMax: 3,
      socketAdapter: { connect },
    });
    const internal = manager as unknown as {
      handleProvisionMessage: (payload: Uint8Array) => void;
      msyncCodec: {
        decodeMsync: (data: Uint8Array) => { command: number; payload: Uint8Array };
        decodeProvision: (payload: Uint8Array) => {
          ok: boolean;
          statusCode: number;
          reason?: string;
        };
      };
    };
    const handleProvisionMessageSpy = vi.spyOn(internal, 'handleProvisionMessage');
    const provisionFrame = buildProvisionFrame(
      ProvisionErrorCode.UNAUTHORIZED,
      'Sorry, who are you?'
    );
    const decodedFrame = internal.msyncCodec.decodeMsync(provisionFrame);

    expect(decodedFrame.command).toBe(MsyncCommand.PROVISION);
    expect(internal.msyncCodec.decodeProvision(decodedFrame.payload)).toMatchObject({
      ok: false,
      statusCode: ProvisionErrorCode.UNAUTHORIZED,
      reason: 'Sorry, who are you?',
    });

    const loginPromise = manager.connect();
    await vi.waitFor((): void => {
      expect(socket.sentPayloads).toHaveLength(1);
    });

    socket.emitMessage(provisionFrame);
    socket.emitMessage('[3000,"normal closed"]');
    socket.emitClose({ code: 1000, reason: '' });

    await expect(loginPromise).rejects.toMatchObject({
      message: 'Provision rejected',
      code: ERROR_CODES.AUTH_UNAUTHORIZED,
      details: {
        retryable: false,
        statusCode: ProvisionErrorCode.UNAUTHORIZED,
        reason: 'Sorry, who are you?',
      },
    });
    expect(handleProvisionMessageSpy).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
