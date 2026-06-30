import { describe, expect, it } from 'vitest';

import { MsyncCodec } from '@/protocol/msync/codec';
import { getMsyncRoot } from '@/protocol/msync/root';
import { EncryptType, MsyncCommand, NameSpace } from '@/protocol/msync/types';
import { longToString } from '@/protocol/msync/utils';

const createCodec = (): MsyncCodec =>
  new MsyncCodec({
    appKey: 'org#app',
    userId: 'alice',
    token: 'token',
    deviceId: 'web',
  });

const decodeChatRoomOperation = (
  bytes: Uint8Array
): {
  readonly msync: Record<string, unknown>;
  readonly meta: Record<string, unknown>;
  readonly mucBody: Record<string, unknown>;
} => {
  const root = getMsyncRoot();
  const msyncType = root.lookupType('easemob.pb.MSync');
  const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
  const mucBodyType = root.lookupType('easemob.pb.MUCBody');

  const msync = msyncType.decode(bytes) as unknown as Record<string, unknown>;
  const commSyncUl = commSyncUlType.decode(msync.payload as Uint8Array) as unknown as {
    meta: Record<string, unknown>;
  };
  const mucBody = mucBodyType.decode(commSyncUl.meta.payload as Uint8Array) as unknown as Record<
    string,
    unknown
  >;
  return { msync, meta: commSyncUl.meta, mucBody };
};

describe('msync chatroom operation encode', () => {
  it('joinChatRoom 应编码为 MUC JOIN 并携带 ext 与 leaveOtherRooms', () => {
    const codec = createCodec();
    const { msync, meta, mucBody } = decodeChatRoomOperation(
      codec.encodeChatRoomOperation(
        {
          operation: 'join',
          chatRoomId: 'room-1',
          ext: 'hello',
          leaveOtherRooms: true,
        },
        '1001'
      )
    );

    expect(msync.command).toBe(MsyncCommand.SYNC);
    expect(msync.version).toBe(0);
    expect(msync.encryptType).toEqual([EncryptType.ENCRYPT_NONE]);
    expect(longToString(msync.traceId)).not.toBe('');
    expect(meta).toMatchObject({
      ns: NameSpace.MUC,
      from: {
        appKey: 'org#app',
        name: 'alice',
        domain: 'easemob.com',
        clientResource: 'webim_web_web',
      },
      to: {
        domain: 'easemob.com',
      },
    });
    expect(longToString(meta.id)).toBe('1001');
    expect(mucBody).toMatchObject({
      mucId: {
        appKey: 'org#app',
        name: 'room-1',
        domain: 'conference.easemob.com',
      },
      operation: 2,
      from: {
        name: 'alice',
      },
      isChatroom: true,
      ext: 'hello',
      leaveOtherRooms: true,
    });
  });

  it('leaveChatRoom 应编码为 MUC LEAVE 且不携带 join 专用字段', () => {
    const codec = createCodec();
    const { msync, meta, mucBody } = decodeChatRoomOperation(
      codec.encodeChatRoomOperation(
        {
          operation: 'leave',
          chatRoomId: 'room-2',
          ext: 'ignored',
          leaveOtherRooms: true,
        },
        '1002'
      )
    );

    expect(msync.command).toBe(MsyncCommand.SYNC);
    expect(meta).toMatchObject({
      ns: NameSpace.MUC,
      to: {
        domain: 'easemob.com',
      },
    });
    expect(longToString(meta.id)).toBe('1002');
    expect(mucBody).toMatchObject({
      mucId: {
        appKey: 'org#app',
        name: 'room-2',
        domain: 'conference.easemob.com',
      },
      operation: 3,
      from: {
        name: 'alice',
      },
      isChatroom: true,
    });
    expect(mucBody.ext).toBe('');
    expect(mucBody.leaveOtherRooms).toBe(false);
  });
});
