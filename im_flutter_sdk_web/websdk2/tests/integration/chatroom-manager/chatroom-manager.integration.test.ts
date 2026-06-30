// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatRoomManager } from '@/managers/chatroom-manager';
import {
  startMockRestServer,
  type MockRestRequest,
  type MockRestServerController,
} from '../../test-utils/layered/mock-rest-server';

type ClientWithManagers = ChatClient & {
  readonly chatRoomManager: ChatRoomManager;
};

type ChatClientInternal = {
  restBaseUrl: string | null;
  authToken: string | null;
  currentUserId: string | null;
  clientResource: string | null;
};

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const primeRestContext = (client: ChatClient, baseUrl: string): void => {
  const internal = client as unknown as ChatClientInternal;
  internal.restBaseUrl = baseUrl;
  internal.authToken = 'mock-token';
  internal.currentUserId = 'alice';
  internal.clientResource = 'web';
};

const expectJsonBody = (request: MockRestRequest): Record<string, unknown> => {
  if (
    !request.jsonBody ||
    typeof request.jsonBody !== 'object' ||
    Array.isArray(request.jsonBody)
  ) {
    throw new Error('Expected JSON object body');
  }
  return request.jsonBody as Record<string, unknown>;
};

describe('chatroom-manager integration', () => {
  let server: MockRestServerController;
  let client: ClientWithManagers;

  beforeEach(async () => {
    resetSingleton();
    server = await startMockRestServer();
    client = ChatClient.init({ appKey: 'org#app' }).use(ChatRoomManager) as ClientWithManagers;
    primeRestContext(client, server.baseUrl);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    resetSingleton();
  });

  it('ChatRoom.getAdminList 应通过真实 RestClient 链路补齐用户资料', async () => {
    server.on('GET', '/org/app/chatrooms/r1/admin', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      return {
        status: 200,
        body: {
          data: ['bob'],
        },
      };
    });
    server.on('POST', '/org/app/metadata/user/get', request => {
      expect(expectJsonBody(request)).toEqual({
        targets: ['bob'],
      });
      return {
        status: 200,
        body: {
          data: {
            bob: {
              nickname: 'Bob',
              avatarurl: 'https://cdn.example.com/bob.png',
            },
          },
        },
      };
    });

    const admins = await client.chatRoomManager.getChatRoom('r1').getAdminList();

    expect(admins).toEqual([
      {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    ]);
  });
});
