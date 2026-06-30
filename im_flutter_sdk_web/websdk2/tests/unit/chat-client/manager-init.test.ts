import { describe, it, expect, beforeEach } from 'vitest';
import { ChatClient } from '@/chat-client';
import type { ManagerBase, ManagerInstance } from '@/types/manager';
import { ValidationError } from '@/utils/errors';

class TestChatManager implements ManagerBase<ChatClient> {
  public static readonly key = 'chatManager' as const;
  public boundClient: ChatClient | null = null;

  public bind(client: ChatClient, _context?: unknown): void {
    this.boundClient = client;
  }
}

class AnotherChatManager implements ManagerBase<ChatClient> {
  public static readonly key = 'chatManager' as const;
  public boundClient: ChatClient | null = null;

  public bind(client: ChatClient, _context?: unknown): void {
    this.boundClient = client;
  }
}

class KeylessManager implements ManagerBase<ChatClient> {
  public bind(_client: ChatClient, _context?: unknown): void {
    void _client;
  }
}

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('ChatClient init managers', () => {
  beforeEach((): void => {
    resetSingleton();
  });

  it('should register manager constructors via init', (): void => {
    const client = ChatClient.init({
      appKey: 'app-key',
      managers: [TestChatManager] as const,
    });

    expect(client.chatManager).toBeInstanceOf(TestChatManager);
    expect(client.chatManager.boundClient).toBe(client);
  });

  it('should register manager instances via init', (): void => {
    const manager = new TestChatManager();
    const client = ChatClient.init({
      appKey: 'app-key',
      managers: [manager] as const,
    });

    expect(client.chatManager).toBe(manager);
    expect(manager.boundClient).toBe(client);
  });

  it('should reject duplicate keys in init managers list', (): void => {
    expect(() =>
      ChatClient.init({
        appKey: 'app-key',
        managers: [TestChatManager, AnotherChatManager] as const,
      })
    ).toThrow(ValidationError);
  });

  it('should reject instance conflicts for existing registrations', (): void => {
    ChatClient.init({ appKey: 'app-key', managers: [TestChatManager] as const });
    const otherInstance = new TestChatManager();

    expect(() =>
      ChatClient.init({
        appKey: 'app-key',
        managers: [otherInstance] as const,
      })
    ).toThrow(ValidationError);
  });

  it('should reject manager instances without constructor key', (): void => {
    const manager = new KeylessManager();

    expect(() =>
      ChatClient.init({
        appKey: 'app-key',
        managers: [manager as unknown as ManagerInstance<ChatClient>] as const,
      })
    ).toThrow(ValidationError);
  });
});
