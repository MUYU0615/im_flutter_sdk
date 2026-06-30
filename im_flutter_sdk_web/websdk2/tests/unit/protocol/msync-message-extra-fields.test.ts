/**
 * MSync 扩展字段映射测试
 */

import { describe, expect, it } from 'vitest';
import { MsyncCodec } from '@/protocol/msync/codec';
import { RouteType } from '@/protocol/msync/types';
import type { Message } from '@/types';

interface CodecInternals {
  resolveRouteType: (message: Message) => number;
  resolveDirectedUsers: (message: Message) => string[];
  resolveMetaExt: (message: Message) => Array<Record<string, unknown>>;
}

const createCodec = (): MsyncCodec => {
  return new MsyncCodec({
    appKey: 'test-app',
    userId: 'test-user',
    token: 'test-token',
  });
};

const createBaseMessage = (partial: Partial<Message>): Message => {
  return {
    msgServerId: '',
    msgLocalId: 'local-1',
    from: '',
    to: '',
    sender: { userId: 'test-user' },
    conversationId: 'user-2',
    conversationType: 'singleChat',
    type: 'text',
    status: 'sending',
    ext: {},
    timestamp: Date.now(),
    body: { content: 'hello' },
    direct: 'SEND',
    ...partial,
  };
};

describe('Msync message extra fields', () => {
  it('receiverList 应优先映射为 ROUTE_DIRECT', () => {
    const codec = createCodec();
    const internals = codec as unknown as CodecInternals;
    const message = createBaseMessage({
      conversationId: 'group-1',
      conversationType: 'groupChat',
      receiverList: ['u1', 'u2'],
      deliverOnlineOnly: true,
    });

    expect(internals.resolveDirectedUsers(message)).toEqual(['u1', 'u2']);
    expect(internals.resolveRouteType(message)).toBe(RouteType.ROUTE_DIRECT);
  });

  it('deliverOnlineOnly 应映射为 ROUTE_ONLINE', () => {
    const codec = createCodec();
    const internals = codec as unknown as CodecInternals;
    const message = createBaseMessage({
      type: 'cmd',
      body: { action: 'typing', deliverOnlineOnly: true },
      deliverOnlineOnly: true,
    });

    expect(internals.resolveRouteType(message)).toBe(RouteType.ROUTE_ONLINE);
  });

  it('聊天室 priority 应映射到 chatroom_msg_tag', () => {
    const codec = createCodec();
    const internals = codec as unknown as CodecInternals;
    const message = createBaseMessage({
      conversationId: 'room-1',
      conversationType: 'chatRoom',
      priority: 'high',
    });
    const metaExt = internals.resolveMetaExt(message);
    const priorityExt = metaExt.find(item => item.key === 'chatroom_msg_tag');

    expect(priorityExt).toBeDefined();
    expect(Number(priorityExt?.varintValue)).toBe(0);
  });
});
