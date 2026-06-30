import { describe, expect, it, vi } from 'vitest';

import { ChatThread } from '@/managers/chat-thread';

describe('ChatThread facade', () => {
  it('应把 facade 调用绑定到 manager 与当前 thread id', async () => {
    const manager = {
      getChatThreadInfo: vi.fn().mockResolvedValue({ chatThreadId: 't1' }),
      joinChatThread: vi.fn().mockResolvedValue(undefined),
      leaveChatThread: vi.fn().mockResolvedValue(undefined),
      destroyChatThread: vi.fn().mockResolvedValue(undefined),
      updateChatThreadName: vi.fn().mockResolvedValue(undefined),
      getChatThreadMemberList: vi.fn().mockResolvedValue({ items: [] }),
      removeChatThreadMember: vi.fn().mockResolvedValue(undefined),
    };
    const chatThread = new ChatThread(
      't1',
      manager as unknown as ConstructorParameters<typeof ChatThread>[1]
    );

    await expect(chatThread.getInfo()).resolves.toEqual({ chatThreadId: 't1' });
    await expect(chatThread.refresh()).resolves.toEqual({ chatThreadId: 't1' });
    await expect(chatThread.join()).resolves.toBeUndefined();
    await expect(chatThread.leave()).resolves.toBeUndefined();
    await expect(chatThread.destroy()).resolves.toBeUndefined();
    await expect(chatThread.updateName({ name: 'new-name' })).resolves.toBeUndefined();
    await expect(chatThread.getMemberList({ pageSize: 20, cursor: 'c1' })).resolves.toEqual({
      items: [],
    });
    await expect(chatThread.removeMember({ memberId: 'bob' })).resolves.toBeUndefined();

    expect(manager.getChatThreadInfo).toHaveBeenNthCalledWith(1, { chatThreadId: 't1' });
    expect(manager.getChatThreadInfo).toHaveBeenNthCalledWith(2, { chatThreadId: 't1' });
    expect(manager.joinChatThread).toHaveBeenCalledWith({ chatThreadId: 't1' });
    expect(manager.leaveChatThread).toHaveBeenCalledWith({ chatThreadId: 't1' });
    expect(manager.destroyChatThread).toHaveBeenCalledWith({ chatThreadId: 't1' });
    expect(manager.updateChatThreadName).toHaveBeenCalledWith({
      chatThreadId: 't1',
      name: 'new-name',
    });
    expect(manager.getChatThreadMemberList).toHaveBeenCalledWith({
      chatThreadId: 't1',
      pageSize: 20,
      cursor: 'c1',
    });
    expect(manager.removeChatThreadMember).toHaveBeenCalledWith({
      chatThreadId: 't1',
      memberId: 'bob',
    });
  });
});
