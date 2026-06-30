import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatManager } from '@/managers/chat-manager';
import { ValidationError } from '@/utils/errors';
import { resetChatClientSingleton, setupLoggedInClient } from './test-utils';

describe('needGroupReadReceipt', () => {
  beforeEach(() => {
    resetChatClientSingleton();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass through needGroupReadReceipt for groupChat', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);
    const message = client.chatManager.createTextMessage({
      conversationId: 'group-1',
      conversationType: 'groupChat',
      content: 'hello',
      needGroupReadReceipt: true,
    });

    expect(message.needGroupReadReceipt).toBe(true);
  });

  it('should allow needGroupReadReceipt=false for groupChat', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);
    const message = client.chatManager.createTextMessage({
      conversationId: 'group-1',
      conversationType: 'groupChat',
      content: 'hello',
      needGroupReadReceipt: false,
    });

    expect(message.needGroupReadReceipt).toBe(false);
  });

  it('should default needGroupReadReceipt to undefined when not provided', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);
    const message = client.chatManager.createTextMessage({
      conversationId: 'group-1',
      conversationType: 'groupChat',
      content: 'hello',
    });

    expect(message.needGroupReadReceipt).toBeUndefined();
  });

  it('should throw when needGroupReadReceipt is used in singleChat', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);

    expect(() =>
      client.chatManager.createTextMessage({
        conversationId: 'user-2',
        conversationType: 'singleChat',
        content: 'hello',
        needGroupReadReceipt: true,
      })
    ).toThrow(ValidationError);
  });

  it('should throw when needGroupReadReceipt is used in chatRoom', async () => {
    const client = (await setupLoggedInClient()).use(ChatManager);

    expect(() =>
      client.chatManager.createTextMessage({
        conversationId: 'room-1',
        conversationType: 'chatRoom',
        content: 'hello',
        needGroupReadReceipt: true,
      })
    ).toThrow(ValidationError);
  });

  it('should work with image message in groupChat', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    const client = (await setupLoggedInClient()).use(ChatManager);
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const message = client.chatManager.createImageMessage({
      conversationId: 'group-1',
      conversationType: 'groupChat',
      data: file,
      needGroupReadReceipt: true,
    });

    expect(message.needGroupReadReceipt).toBe(true);
  });
});

describe('Message reactions and groupReadCount', () => {
  it('should default reactions to undefined on created message', async () => {
    resetChatClientSingleton();
    const client = (await setupLoggedInClient()).use(ChatManager);
    const message = client.chatManager.createTextMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      content: 'hello',
    });

    expect(message.reactions).toBeUndefined();
    expect(message.groupReadCount).toBeUndefined();
  });
});
