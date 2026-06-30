import { describe, expect, it } from 'vitest';

import { MsyncCodec } from '@/protocol/msync/codec';
import { NameSpace } from '@/protocol/msync/types';
import { getMsyncRoot } from '@/protocol/msync/root';

const buildRosterSyncPayload = (options: {
  readonly operation: number;
  readonly from: string;
  readonly to: string;
  readonly reason?: string;
  readonly rosterVersion?: string;
}): Uint8Array => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  const rosterBodyType = root.lookupType('easemob.pb.RosterBody');
  const metaType = root.lookupType('easemob.pb.Meta');

  const rosterBody = rosterBodyType.create({
    operation: options.operation,
    from: { name: options.from },
    to: [{ name: options.to }],
    reason: options.reason ?? '',
    rosterVer: options.rosterVersion ?? '',
  });
  const meta = metaType.create({
    id: '1001',
    ns: NameSpace.ROSTER,
    payload: rosterBodyType.encode(rosterBody).finish(),
  });

  return commSyncDlType.encode(
    commSyncDlType.create({
      metaId: '0',
      metas: [meta],
    })
  ).finish();
};

describe('msync roster notify decode', () => {
  it('应把 roster ADD 解码为 onContactInvited', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildRosterSyncPayload({
        operation: 2,
        from: 'bob',
        to: 'alice',
        reason: 'hello',
        rosterVersion: 'rv-1',
      })
    );

    expect(result.notifies).toEqual([
      {
        type: 'contact',
        eventName: 'onContactInvited',
        data: {
          type: 'subscribe',
          from: 'bob',
          to: 'alice',
          status: 'hello',
          rosterVersion: 'rv-1',
          userInfo: {
            userId: 'bob',
          },
        },
      },
    ]);
  });

  it('应把 roster REMOVE / ACCEPT / REMOTE_ACCEPT / REMOTE_DECLINE 映射为兼容联系人事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const removed = codec.decodeSync(
      buildRosterSyncPayload({
        operation: 3,
        from: 'bob',
        to: 'alice',
      })
    );
    const accepted = codec.decodeSync(
      buildRosterSyncPayload({
        operation: 4,
        from: 'bob',
        to: 'alice',
      })
    );
    const agreed = codec.decodeSync(
      buildRosterSyncPayload({
        operation: 8,
        from: 'bob',
        to: 'alice',
      })
    );
    const refused = codec.decodeSync(
      buildRosterSyncPayload({
        operation: 9,
        from: 'bob',
        to: 'alice',
      })
    );

    expect(removed.notifies).toHaveLength(2);
    expect(removed.notifies?.[0]).toMatchObject({
      type: 'contact',
      eventName: 'onContactDeleted',
      data: {
        type: 'unsubscribed',
        userInfo: {
          userId: 'bob',
        },
      },
    });
    expect(removed.notifies?.[1]).toMatchObject({
      type: 'multiDevice',
      eventName: 'onMultiDeviceContact',
      data: {
        category: 'contact',
        operation: 'CONTACT_REMOVE',
        targetUserId: 'alice',
        rosterVersion: undefined,
        ext: '',
        deviceId: undefined,
      },
    });

    expect(accepted.notifies).toHaveLength(2);
    expect(accepted.notifies?.[0]).toMatchObject({
      type: 'contact',
      eventName: 'onContactAdded',
      data: {
        type: 'subscribed',
        userInfo: {
          userId: 'bob',
        },
      },
    });
    expect(accepted.notifies?.[1]).toMatchObject({
      type: 'multiDevice',
      eventName: 'onMultiDeviceContact',
      data: {
        category: 'contact',
        operation: 'CONTACT_ACCEPT',
        targetUserId: 'alice',
        rosterVersion: undefined,
        ext: '',
        deviceId: undefined,
      },
    });

    expect(agreed.notifies).toHaveLength(2);
    expect(agreed.notifies?.[0]).toMatchObject({
      type: 'contact',
      eventName: 'onContactAgreed',
      data: {
        type: 'subscribed',
        userInfo: {
          userId: 'bob',
        },
      },
    });
    expect(agreed.notifies?.[1]).toMatchObject({
      type: 'multiDevice',
      eventName: 'onMultiDeviceContact',
      data: {
        category: 'contact',
        operation: 'CONTACT_ACCEPT',
        targetUserId: 'alice',
        rosterVersion: undefined,
        ext: '',
        deviceId: undefined,
      },
    });

    expect(refused.notifies).toHaveLength(2);
    expect(refused.notifies?.[0]).toMatchObject({
      type: 'contact',
      eventName: 'onContactRefuse',
      data: {
        type: 'unsubscribed',
        userInfo: {
          userId: 'bob',
        },
      },
    });
    expect(refused.notifies?.[1]).toMatchObject({
      type: 'multiDevice',
      eventName: 'onMultiDeviceContact',
      data: {
        category: 'contact',
        operation: 'CONTACT_DECLINE',
        targetUserId: 'alice',
        rosterVersion: undefined,
        ext: '',
        deviceId: undefined,
      },
    });
  });
});
