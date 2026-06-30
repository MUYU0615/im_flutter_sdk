// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

import { CoreSDK } from '@/core';
import { EventHub } from '@/core/events/event-hub';
import { createTextMessage } from '@/message/create-message';
import { createWebSocketAdapter } from '@/platform/socket/web-socket-adapter';
import { ChatEventName } from '@/types';
import {
  startMockServer,
  type MockServerController,
} from '../../test-utils/layered/mock-server-control';

const TEST_PORT = 19365;
const require = createRequire(import.meta.url);
const wsModule = require('ws') as { readonly WebSocket: typeof WebSocket };
const socketAdapter = createWebSocketAdapter({
  webSocketCtor: wsModule.WebSocket,
});

interface MessageSenderInternal {
  ackTimeout: number;
}

interface CoreSdkInternal {
  messageSender: MessageSenderInternal;
}

const createSdk = (eventHub: EventHub): CoreSDK => {
  if (!socketAdapter) {
    throw new Error('node ws socket adapter is unavailable');
  }
  return new CoreSDK(
    {
      serverUrl: `ws://127.0.0.1:${TEST_PORT}/websocket`,
      userId: 'mock-user',
      token: 'mock-token',
      appKey: 'org#app',
      autoReconnectNumMax: 0,
      useFixedDeviceId: true,
      deviceId: 'mock-device',
      socketAdapter,
    },
    eventHub
  );
};

const createOutboundMessage = (suffix: string): ReturnType<typeof createTextMessage> => {
  return createTextMessage(
    {
      conversationId: 'mock-user',
      conversationType: 'singleChat',
      content: `mock-sdk:${suffix}:${Date.now()}`,
    },
    { userId: 'mock-user' }
  );
};

const waitForMessage = (
  eventHub: EventHub,
  handlerId: string,
  timeoutMs: number = 5000
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      eventHub.removeEventHandler(handlerId);
      reject(new Error('等待 mock 下行消息超时'));
    }, timeoutMs);

    eventHub.addEventHandler(handlerId, {
      [ChatEventName.MESSAGE]: () => {
        clearTimeout(timeoutId);
        eventHub.removeEventHandler(handlerId);
        resolve();
      },
    });
  });
};

let mockServer: MockServerController;

describe('CoreSDK + mock server 集成测试', () => {
  beforeAll(async () => {
    mockServer = await startMockServer(TEST_PORT);
  });

  afterAll(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  it('应完成连接、发送 ACK 与下行消息主链路', async () => {
    await mockServer.setScenario('NORMAL_FLOW');
    const eventHub = new EventHub();
    const sdk = createSdk(eventHub);

    try {
      const inboundPromise = waitForMessage(eventHub, 'mock-sdk-normal-flow');

      await sdk.connect();
      expect(sdk.getConnectionStatus()).toBe('connected');

      const sent = await sdk.sendMessage(createOutboundMessage('normal'));
      expect(sent.status).toBe('sent');

      await inboundPromise;
    } finally {
      await sdk.disconnect();
      sdk.destroy();
    }
  }, 15000);

  it('provision 被拒绝时应中断连接并抛出错误', async () => {
    await mockServer.setScenario('MOCK_PROVISION_REJECTED');
    const sdk = createSdk(new EventHub());

    try {
      await expect(sdk.connect()).rejects.toThrow('Provision rejected');
      expect(sdk.getConnectionStatus()).toBe('disconnected');
    } finally {
      await sdk.disconnect();
      sdk.destroy();
    }
  }, 15000);

  it('ACK 乱序且重复时应仍能正确结算多条消息', async () => {
    await mockServer.setScenario('MOCK_OUTOFORDER_DUPLICATE');
    const eventHub = new EventHub();
    const sdk = createSdk(eventHub);

    try {
      await sdk.connect();
      expect(sdk.getConnectionStatus()).toBe('connected');

      const [first, second] = await Promise.all([
        sdk.sendMessage(createOutboundMessage('out-of-order-1')),
        sdk.sendMessage(createOutboundMessage('out-of-order-2')),
      ]);

      expect(first.status).toBe('sent');
      expect(second.status).toBe('sent');
    } finally {
      await sdk.disconnect();
      sdk.destroy();
    }
  }, 15000);

  it('超时断连场景应让 SDK 进入 disconnected', async () => {
    await mockServer.setScenario('MOCK_TIMEOUT_DISCONNECT');
    const eventHub = new EventHub();
    const sdk = createSdk(eventHub);
    const internalSdk = sdk as unknown as CoreSdkInternal;
    internalSdk.messageSender.ackTimeout = 2500;

    try {
      await sdk.connect();
      expect(sdk.getConnectionStatus()).toBe('connected');

      await expect(sdk.sendMessage(createOutboundMessage('timeout-disconnect'))).rejects.toThrow();
      expect(sdk.getConnectionStatus()).toBe('disconnected');
    } finally {
      await sdk.disconnect();
      sdk.destroy();
    }
  }, 15000);
});
