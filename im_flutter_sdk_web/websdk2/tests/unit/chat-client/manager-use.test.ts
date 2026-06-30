import { describe, it, expect, beforeEach } from 'vitest';
import { ChatClient } from '@/chat-client';
import type { ManagerBase } from '@/types/manager';
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

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('ChatClient manager use', () => {
  beforeEach((): void => {
    resetSingleton();
  });

  it('should register manager via use and attach to client', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const clientWithManager = client.use(TestChatManager);

    expect(clientWithManager).toBe(client);
    expect(clientWithManager.chatManager).toBeInstanceOf(TestChatManager);
    expect(clientWithManager.chatManager.boundClient).toBe(client);
  });

  it('should be idempotent for same manager constructor', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const first = client.use(TestChatManager).chatManager;
    const second = client.use(TestChatManager).chatManager;

    expect(first).toBe(second);
  });

  it('should reject manager key conflicts for different constructors', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' });
    client.use(TestChatManager);

    expect(() => client.use(AnotherChatManager)).toThrow(ValidationError);
  });
});
