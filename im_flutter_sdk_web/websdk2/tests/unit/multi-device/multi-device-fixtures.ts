import { getMsyncRoot } from '@/protocol/msync/root';
import { NameSpace } from '@/protocol/msync/types';

const encodeJsonPayload = (payload: Record<string, unknown>): Uint8Array => {
  return new TextEncoder().encode(JSON.stringify(payload));
};

const buildCommSyncPayload = (ns: number, payload: Uint8Array): Uint8Array => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  const metaType = root.lookupType('easemob.pb.Meta');

  const meta = metaType.create({
    id: '1001',
    ns,
    payload,
  });

  return commSyncDlType
    .encode(
      commSyncDlType.create({
        metaId: '0',
        metas: [meta],
      })
    )
    .finish();
};

export const buildRosterSyncPayload = (options: {
  readonly operation: number;
  readonly from: string;
  readonly to: string;
  readonly reason?: string;
  readonly rosterVersion?: string;
  readonly fromClientResource?: string;
  readonly toClientResource?: string;
}): Uint8Array => {
  const root = getMsyncRoot();
  const rosterBodyType = root.lookupType('easemob.pb.RosterBody');
  const rosterBody = rosterBodyType.create({
    operation: options.operation,
    from: {
      name: options.from,
      ...(options.fromClientResource ? { clientResource: options.fromClientResource } : {}),
    },
    to: [
      {
        name: options.to,
        ...(options.toClientResource ? { clientResource: options.toClientResource } : {}),
      },
    ],
    reason: options.reason ?? '',
    rosterVer: options.rosterVersion ?? '',
  });

  return buildCommSyncPayload(NameSpace.ROSTER, rosterBodyType.encode(rosterBody).finish());
};

export const buildGroupMucSyncPayload = (options: {
  readonly operation: number;
  readonly from: string;
  readonly groupId: string;
  readonly groupName?: string;
  readonly reason?: string;
  readonly eventExt?: string;
  readonly members?: ReadonlyArray<string>;
  readonly to?: ReadonlyArray<string>;
  readonly fromClientResource?: string;
  readonly isChatroom?: boolean;
}): Uint8Array => {
  const root = getMsyncRoot();
  const mucBodyType = root.lookupType('easemob.pb.MUCBody');
  const mucBody = mucBodyType.create({
    operation: options.operation,
    isChatroom: options.isChatroom ?? false,
    mucId: { name: options.groupId },
    mucName: options.groupName ?? '',
    from: {
      name: options.from,
      ...(options.fromClientResource ? { clientResource: options.fromClientResource } : {}),
    },
    to: (options.to ?? []).map(item => ({ name: item })),
    reason: options.reason ?? '',
    eventInfo: {
      ext: options.eventExt ?? '',
    },
    members: options.members ?? [],
  });

  return buildCommSyncPayload(NameSpace.MUC, mucBodyType.encode(mucBody).finish());
};

export const buildThreadMucSyncPayload = (options: {
  readonly operation: number;
  readonly from: string;
  readonly threadId: string;
  readonly parentId: string;
  readonly threadName?: string;
  readonly members?: ReadonlyArray<string>;
  readonly to?: ReadonlyArray<string>;
  readonly fromClientResource?: string;
}): Uint8Array => {
  const root = getMsyncRoot();
  const mucBodyType = root.lookupType('easemob.pb.MUCBody');
  const mucBody = mucBodyType.create({
    operation: options.operation,
    isThread: true,
    mucId: { name: options.threadId },
    mucParentId: { name: options.parentId },
    mucName: options.threadName ?? '',
    from: {
      name: options.from,
      ...(options.fromClientResource ? { clientResource: options.fromClientResource } : {}),
    },
    to: (options.to ?? []).map(item => ({ name: item })),
    members: options.members ?? [],
  });

  return buildCommSyncPayload(NameSpace.MUC, mucBodyType.encode(mucBody).finish());
};

export const buildConversationNotifySyncPayload = (options: {
  readonly operation: string;
  readonly id: string;
  readonly type?: string;
  readonly from?: string;
  readonly res?: string;
  readonly ts?: number;
  readonly ext?: string;
}): Uint8Array => {
  return buildCommSyncPayload(
    NameSpace.NOTIFY,
    encodeJsonPayload({
      type: 'conv',
      data: {
        op: options.operation,
        id: options.id,
        type: options.type,
        from: options.from,
        res: options.res,
        ts: options.ts,
        ext: options.ext,
      },
    })
  );
};

export const buildMessageRemovedNotifySyncPayload = (options: {
  readonly chatType?: string;
  readonly to: string;
  readonly resource?: string;
  readonly msgIdList?: ReadonlyArray<string>;
  readonly deleteTime?: number;
  readonly lastMsgId?: string;
  readonly messageRoamingType?: string;
}): Uint8Array => {
  return buildCommSyncPayload(
    NameSpace.NOTIFY,
    encodeJsonPayload({
      type: 'roaming_delete',
      data: {
        chatType: options.chatType,
        to: options.to,
        resource: options.resource,
        msgIdList: options.msgIdList,
        deleteTime: options.deleteTime,
        lastMsgId: options.lastMsgId,
        messageRoamingType: options.messageRoamingType,
      },
    })
  );
};
