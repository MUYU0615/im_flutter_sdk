import { describe, expect, it } from 'vitest';
import { Root, type INamespace } from 'protobufjs/light';

import { JoinedGroupsCodec } from '@/protocol/joined-groups/codec';
import joinedGroupsProtoJson from '@/protocol/joined-groups/proto';
import { JoinedGroupsMessageType } from '@/protocol/joined-groups/types';

const root = Root.fromJSON(joinedGroupsProtoJson as INamespace);

const encodeProto = (typeName: string, payload: Record<string, unknown>): Uint8Array => {
  const type = root.lookupType(typeName);
  return type.encode(type.create(payload)).finish();
};

describe('JoinedGroupsCodec', () => {
  it('应编码 type=12 请求并保留 last_sync_time 与 cursor', () => {
    const codec = new JoinedGroupsCodec();
    const encoded = codec.encodeRequest({
      type: JoinedGroupsMessageType.GET_JOINED_GROUPS_REQUEST,
      header: {
        resource: 'web',
        timestamp: 1780624634000,
        requestId: 'req-1',
        protocolVersion: 1,
      },
      org: 'org',
      app: 'app',
      username: 'alice',
      lastSyncTime: 0,
      cursor: '3',
    });

    expect(codec.decode(encoded)).toEqual({
      type: JoinedGroupsMessageType.GET_JOINED_GROUPS_REQUEST,
      header: {
        resource: 'web',
        timestamp: 1780624634000,
        requestId: 'req-1',
        protocolVersion: 1,
      },
      org: 'org',
      app: 'app',
      username: 'alice',
      lastSyncTime: 0,
      cursor: '3',
    });
  });

  it('应解码 type=13 响应批次与官方 GroupItem 字段', () => {
    const codec = new JoinedGroupsCodec();
    const frame = encodeProto('easemob.joinedgroups.GetJoinedGroupsResponse', {
      type: JoinedGroupsMessageType.GET_JOINED_GROUPS_RESPONSE,
      header: {
        resource: 'web',
        timestamp: 1780624634353,
        request_id: 'req-2',
        protocol_version: 1,
      },
      groups: [
        {
          group_id: 'g1',
          group_name: 'Group 1',
          group_owner: 'owner',
          members_count: 12,
          mute_all: true,
          disabled: false,
          description: 'desc',
          group_avatar: 'https://cdn.example.com/g1.png',
          role: 1,
          mute_expiration: 1780624634999,
          remind_type: 2,
          create_at: 1780624630000,
          update_at: 1780624631000,
          joined_timestamp: 1780624632000,
        },
      ],
      is_last_batch: false,
      cursor: '3',
    });

    expect(codec.decode(frame)).toEqual({
      type: JoinedGroupsMessageType.GET_JOINED_GROUPS_RESPONSE,
      header: {
        resource: 'web',
        timestamp: 1780624634353,
        requestId: 'req-2',
        protocolVersion: 1,
      },
      groups: [
        {
          group_id: 'g1',
          group_name: 'Group 1',
          group_owner: 'owner',
          members_count: 12,
          mute_all: true,
          disabled: false,
          description: 'desc',
          group_avatar: 'https://cdn.example.com/g1.png',
          role: 1,
          mute_expiration: 1780624634999,
          remind_type: 2,
          create_at: 1780624630000,
          update_at: 1780624631000,
          joined_timestamp: 1780624632000,
        },
      ],
      isLastBatch: false,
      lastSyncFinishedTs: undefined,
      cursor: '3',
    });
  });

  it('应解码 type=5 ErrorDetail', () => {
    const codec = new JoinedGroupsCodec();
    const frame = encodeProto('easemob.joinedgroups.ErrorDetail', {
      type: JoinedGroupsMessageType.ERROR,
      header: {
        request_id: 'req-error',
        protocol_version: 1,
      },
      code: 1601,
      message: 'invalid params',
    });

    expect(codec.decode(frame)).toEqual({
      type: JoinedGroupsMessageType.ERROR,
      header: {
        resource: '',
        timestamp: 0,
        requestId: 'req-error',
        protocolVersion: 1,
      },
      code: 1601,
      message: 'invalid params',
    });
  });
});
