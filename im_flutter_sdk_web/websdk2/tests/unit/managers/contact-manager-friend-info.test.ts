import { describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { ContactManager } from '@/managers/contact-manager';

const createMockClient = (): ChatClient => {
  return {
    getContactSnapshot: () => ({
      items: [],
      source: 'cache',
      version: '',
      complete: false,
    }),
  } as unknown as ChatClient;
};

describe('ContactManager friend-info events', () => {
  it('addEventHandler/removeEventHandler 应支持 onContactInfoUpdated', () => {
    const manager = new ContactManager();
    const addEventHandler = vi.fn();
    const removeEventHandler = vi.fn();

    manager.bind(createMockClient(), {
      addEventHandler,
      removeEventHandler,
    });

    manager.addEventHandler('contact-ui', {
      onContactInfoUpdated: vi.fn(),
    });
    manager.removeEventHandler('contact-ui');

    expect(addEventHandler).toHaveBeenCalledOnce();
    expect(removeEventHandler).toHaveBeenCalledWith('contact-ui');
  });
});
