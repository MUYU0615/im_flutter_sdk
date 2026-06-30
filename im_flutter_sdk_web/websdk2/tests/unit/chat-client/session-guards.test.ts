import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ConnectionStatus } from '@/types';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('ChatClient session guards', () => {
  beforeEach((): void => {
    resetSingleton();
    vi.restoreAllMocks();
  });

  it('login 在实例失效后应拒绝继续执行', async () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    resetSingleton();

    await expect(client.login({ userId: 'alice', token: 'token-1' })).rejects.toMatchObject({
      message: 'ChatClient is not initialized',
    });
  });

  it('固定服务地址运行时缺少 serverUrls 时 login 应抛校验错误', async () => {
    const client = ChatClient.init({
      appKey: 'org#app',
      serviceConfig: {
        serverUrls: {
          restApiUrl: 'https://api.example.com',
          wsUrl: 'wss://msync.example.com/websocket',
        },
      },
    });
    (
      client as unknown as {
        config: {
          serviceConfig: {
            serverUrls?: {
              restApiUrl?: string;
              wsUrl?: string;
            };
          };
        };
      }
    ).config.serviceConfig.serverUrls = {
      restApiUrl: '',
      wsUrl: '',
    };

    await expect(client.login({ userId: 'alice', token: 'token-1' })).rejects.toMatchObject({
      message:
        'serviceConfig.serverUrls.restApiUrl and serviceConfig.serverUrls.wsUrl are required when serverUrls is configured',
    });
    expect(client.getConnectionState()).toBe(ConnectionStatus.DISCONNECTED);
  });

  it('logout 在实例失效后应拒绝继续执行', async () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    resetSingleton();

    await expect(client.logout()).rejects.toMatchObject({
      message: 'ChatClient is not initialized',
    });
  });

  it('logout 在无 core 时应完整清理会话态', async () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    const cancel = vi.fn();
    const destroyUserInfoQueue = vi.fn();
    const destroyGroupNamecardQueue = vi.fn();

    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).state = ConnectionStatus.CONNECTED;
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).authToken = 'token-1';
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).clientResource = 'web';
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).platformAdapter = { kind: 'mock' };
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).cacheManager = { kind: 'cache' };
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).cacheUserId = 'alice';
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).profileSyncUserInfoManager = { kind: 'profile-sync' };
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).contactSyncController = { cancel };
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).userInfoHydrationQueue = { destroy: destroyUserInfoQueue };
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).groupNamecardHydrationQueue = { destroy: destroyGroupNamecardQueue };
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).contactSyncWsUrls = ['wss://sync.example.com'];
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).contactSyncDnsResolved = true;
    (
      client as unknown as {
        state: ConnectionStatus;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        userInfoHydrationQueue: { destroy: () => void };
        groupNamecardHydrationQueue: { destroy: () => void };
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).logReportEnabled = true;

    await client.logout();

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(destroyUserInfoQueue).toHaveBeenCalledTimes(1);
    expect(destroyGroupNamecardQueue).toHaveBeenCalledTimes(1);
    expect(client.getConnectionState()).toBe(ConnectionStatus.DISCONNECTED);
    expect(
      client as unknown as {
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        platformAdapter: Record<string, unknown> | null;
        cacheManager: Record<string, unknown> | null;
        cacheUserId: string | null;
        profileSyncUserInfoManager: Record<string, unknown> | null;
        contactSyncController: { cancel: () => void } | null;
        contactSyncWsUrls: string[];
        contactSyncDnsResolved: boolean;
        logReportEnabled: boolean;
      }
    ).toMatchObject({
      currentUserId: null,
      restBaseUrl: null,
      authToken: null,
      clientResource: null,
      platformAdapter: null,
      cacheManager: null,
      cacheUserId: null,
      contactSyncController: null,
      contactSyncWsUrls: [],
      contactSyncDnsResolved: false,
      logReportEnabled: false,
    });
  });

  it('getRestContext 缺少 restBaseUrl 时应抛错', () => {
    const client = ChatClient.init({ appKey: 'org#app' });

    expect(() => client.getRestContext()).toThrowError('restBaseUrl is required');
  });

  it('getRestContext 缺少 token 时应抛错', () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    (
      client as unknown as {
        restBaseUrl: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';

    expect(() => client.getRestContext()).toThrowError('token is required');
  });

  it('getRestContext 缺少 userId 时应抛错', () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
      }
    ).authToken = 'token-1';

    expect(() => client.getRestContext()).toThrowError('userId is required');
  });

  it('getRestContext 缺少 clientResource 时应抛错', () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        currentUserId: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        currentUserId: string | null;
      }
    ).authToken = 'token-1';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        currentUserId: string | null;
      }
    ).currentUserId = 'alice';

    expect(() => client.getRestContext()).toThrowError('clientResource is required');
  });

  it('getRestContext 在 clientResource 缺失时应回退到 core resource', () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        currentUserId: string | null;
        core: { getClientResource: () => string } | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        currentUserId: string | null;
        core: { getClientResource: () => string } | null;
      }
    ).authToken = 'token-1';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        currentUserId: string | null;
        core: { getClientResource: () => string } | null;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        currentUserId: string | null;
        core: { getClientResource: () => string } | null;
      }
    ).core = {
      getClientResource: (): string => 'web',
    };

    expect(client.getRestContext()).toEqual({
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'alice',
      token: 'token-1',
      clientResource: 'web',
    });
  });

  it('getClientResource 应返回缓存的当前设备资源标识', () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    (
      client as unknown as {
        clientResource: string | null;
      }
    ).clientResource = 'web-1';

    expect(client.getClientResource()).toBe('web-1');
  });

  it('getClientResource 在缓存缺失时应回退到 core resource', () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    (
      client as unknown as {
        core: { getClientResource: () => string } | null;
      }
    ).core = {
      getClientResource: (): string => 'web-core',
    };

    expect(client.getClientResource()).toBe('web-core');
  });

  it('getClientResource 在未连接且无 core 时应返回 null', () => {
    const client = ChatClient.init({ appKey: 'org#app' });

    expect(client.getClientResource()).toBeNull();
  });

});
