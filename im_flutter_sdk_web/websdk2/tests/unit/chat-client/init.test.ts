import { describe, it, expect, beforeEach } from 'vitest';
import { ChatClient } from '@/chat-client';
import { ValidationError } from '@/utils/errors';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('ChatClient init', () => {
  beforeEach((): void => {
    resetSingleton();
  });

  it('should initialize with valid config', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' });
    expect(client.getConnectionState()).toBe('disconnected');
  });

  it('should default enableUserInfoSync to false', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' }) as unknown as {
      config: { enableUserInfoSync: boolean };
    };

    expect(client.config.enableUserInfoSync).toBe(false);
  });

  it('should return the same instance with the same config', (): void => {
    const first = ChatClient.init({ appKey: 'app-key' });
    const second = ChatClient.init({ appKey: 'app-key' });
    expect(first).toBe(second);
  });

  it('should reject different config for singleton', (): void => {
    ChatClient.init({ appKey: 'app-key' });
    expect(() => ChatClient.init({ appKey: 'other-key' })).toThrow(ValidationError);
  });

  it('should reject different enableUserInfoSync config for singleton', (): void => {
    ChatClient.init({ appKey: 'app-key', enableUserInfoSync: false });

    expect(() => ChatClient.init({ appKey: 'app-key', enableUserInfoSync: true })).toThrow(
      ValidationError
    );
  });

  it('should validate required appKey', (): void => {
    expect(() => ChatClient.init({ appKey: '' })).toThrow(ValidationError);
  });

  it('should require restApiUrl and wsUrl when fixed serverUrls is configured', (): void => {
    expect(() =>
      ChatClient.init({
        appKey: 'app-key',
        serviceConfig: {
          serverUrls: {
            restApiUrl: 'https://rest.example.com',
          },
        },
      })
    ).toThrow(ValidationError);
    expect(() =>
      ChatClient.init({
        appKey: 'app-key',
        serviceConfig: {
          serverUrls: {
            wsUrl: 'ws://msync.example.com/websocket',
          },
        },
      })
    ).toThrow(ValidationError);
  });

  it('should reject legacy endpoint config fields', (): void => {
    expect(() =>
      ChatClient.init({ appKey: 'app-key', enableHttpDns: false } as never)
    ).toThrow(ValidationError);
    expect(() =>
      ChatClient.init({ appKey: 'app-key', dnsConfigUrls: ['https://rs.example.com'] } as never)
    ).toThrow(ValidationError);
    expect(() =>
      ChatClient.init({
        appKey: 'app-key',
        serverUrls: {
          restApiUrl: 'https://rest.example.com',
          wsUrl: 'ws://msync.example.com/websocket',
        },
      } as never)
    ).toThrow(ValidationError);
  });

  it('should reject mixed dnsConfigUrls and serverUrls in serviceConfig', (): void => {
    expect(() =>
      ChatClient.init({
        appKey: 'app-key',
        serviceConfig: {
          dnsConfigUrls: ['https://rs.example.com'],
          serverUrls: {
            restApiUrl: 'https://rest.example.com',
            wsUrl: 'ws://msync.example.com/websocket',
          },
        },
      })
    ).toThrow(ValidationError);
  });

  it('should validate customOsPlatform range', (): void => {
    expect(() => ChatClient.init({ appKey: 'app-key', customOsPlatform: 0 })).toThrow(
      ValidationError
    );
    expect(() => ChatClient.init({ appKey: 'app-key', customOsPlatform: 101 })).toThrow(
      ValidationError
    );
  });

  it('should reject internal init config fields from public init config', (): void => {
    expect(() =>
      ChatClient.init({
        appKey: 'app-key',
        platformAdapterOptions: {
          prefer: 'react-native',
        },
      } as never)
    ).toThrow(ValidationError);
    expect(() =>
      ChatClient.init({
        appKey: 'app-key',
        cacheEncryptionMode: 'off',
      } as never)
    ).toThrow(ValidationError);
    expect(() =>
      ChatClient.init({
        appKey: 'app-key',
        profileSync: {
          userInfoWindowMs: 1000,
        },
      } as never)
    ).toThrow(ValidationError);
  });
});
