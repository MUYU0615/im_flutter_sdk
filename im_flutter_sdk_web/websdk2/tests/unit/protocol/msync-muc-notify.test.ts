import { describe, expect, it } from 'vitest';

import { MsyncCodec } from '@/protocol/msync/codec';
import { getMsyncRoot } from '@/protocol/msync/root';
import { NameSpace } from '@/protocol/msync/types';

const buildMucSyncPayload = (options: {
  readonly operation: number;
  readonly from: string;
  readonly to?: ReadonlyArray<string>;
  readonly groupId: string;
  readonly groupName?: string;
  readonly reason?: string;
  readonly eventExt?: string;
  readonly members?: ReadonlyArray<string>;
}): Uint8Array => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  const metaType = root.lookupType('easemob.pb.Meta');
  const mucBodyType = root.lookupType('easemob.pb.MUCBody');

  const mucBody = mucBodyType.create({
    operation: options.operation,
    mucId: { name: options.groupId },
    mucName: options.groupName ?? '',
    from: { name: options.from },
    to: (options.to ?? []).map(item => ({ name: item })),
    reason: options.reason ?? '',
    eventInfo: {
      ext: options.eventExt ?? '',
    },
    members: options.members ?? [],
  });
  const meta = metaType.create({
    id: '1001',
    ns: NameSpace.MUC,
    payload: mucBodyType.encode(mucBody).finish(),
  });

  return commSyncDlType.encode(
    commSyncDlType.create({
      metaId: '0',
      metas: [meta],
    })
  ).finish();
};

describe('msync muc notify decode', () => {
  it('应把 INVITE 解码为内部群组通知', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildMucSyncPayload({
        operation: 7,
        from: 'bob',
        to: ['alice'],
        groupId: 'g1',
        groupName: 'Group 1',
        reason: 'join us',
      })
    );

    expect(result.notifies).toHaveLength(2);
    expect(result.notifies?.[0]).toEqual({
      type: 'group',
      eventName: 'onGroupNotify',
      data: {
        eventName: 'onInvitationReceived',
        payload: {
          groupId: 'g1',
          groupName: 'Group 1',
          inviterId: 'bob',
          reason: 'join us',
        },
      },
    });
    expect(result.notifies?.[1]).toMatchObject({
      type: 'multiDevice',
      eventName: 'onMultiDeviceGroup',
      data: {
        category: 'group',
        operation: 'GROUP_INVITE',
        groupId: 'g1',
        groupName: 'Group 1',
        operatorId: 'bob',
      },
    });
  });

  it('应把 GROUP_MEMBER_METADATA_UPDATE 解码为群成员属性变更', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildMucSyncPayload({
        operation: 45,
        from: 'bob',
        groupId: 'g1',
        eventExt: JSON.stringify({
          username: 'carol',
          properties: {
            nickname: 'Carol',
            group_name_card: 'Team Carol',
          },
        }),
      })
    );

    expect(result.notifies).toHaveLength(2);
    expect(result.notifies?.[0]).toEqual({
      type: 'group',
      eventName: 'onGroupNotify',
      data: {
        eventName: 'onGroupMemberAttributeChanged',
        payload: {
          groupId: 'g1',
          groupName: '',
          userId: 'carol',
          attribute: {
            nickname: 'Carol',
            group_name_card: 'Team Carol',
          },
          from: 'bob',
          source: 'direct',
        },
      },
    });
    expect(result.notifies?.[1]).toMatchObject({
      type: 'multiDevice',
      eventName: 'onMultiDeviceGroup',
      data: {
        category: 'group',
        operation: 'GROUP_MEMBER_METADATA_CHANGED',
        groupId: 'g1',
        groupName: '',
        operatorId: 'bob',
      },
    });
  });
});
