const proto = {
  nested: {
    easemob: {
      nested: {
        joinedgroups: {
          nested: {
            GatewayHeader: {
              fields: {
                resource: { type: 'string', id: 1 },
                timestamp: { type: 'int64', id: 2 },
                request_id: { type: 'string', id: 3 },
                protocol_version: { type: 'int32', id: 4 },
              },
            },
            GetJoinedGroupsRequest: {
              fields: {
                type: { type: 'int32', id: 1 },
                header: { type: 'GatewayHeader', id: 2 },
                org: { type: 'string', id: 3 },
                app: { type: 'string', id: 4 },
                username: { type: 'string', id: 5 },
                last_sync_time: { type: 'int64', id: 6 },
                cursor: { type: 'string', id: 7 },
              },
            },
            GroupItem: {
              fields: {
                group_id: { type: 'string', id: 1 },
                group_name: { type: 'string', id: 2 },
                group_owner: { type: 'string', id: 3 },
                members_count: { type: 'int64', id: 4 },
                mute_all: { type: 'bool', id: 5 },
                disabled: { type: 'bool', id: 6 },
                description: { type: 'string', id: 7 },
                group_avatar: { type: 'string', id: 8 },
                role: { type: 'uint32', id: 9 },
                mute_expiration: { type: 'int64', id: 10 },
                remind_type: { type: 'int32', id: 11 },
                create_at: { type: 'uint64', id: 12 },
                update_at: { type: 'uint64', id: 13 },
                joined_timestamp: { type: 'int64', id: 14 },
              },
            },
            GetJoinedGroupsResponse: {
              fields: {
                type: { type: 'int32', id: 1 },
                header: { type: 'GatewayHeader', id: 2 },
                groups: { rule: 'repeated', type: 'GroupItem', id: 3 },
                is_last_batch: { type: 'bool', id: 4 },
                last_sync_finished_ts: { type: 'int64', id: 5 },
                cursor: { type: 'string', id: 6 },
              },
            },
            ErrorDetail: {
              fields: {
                type: { type: 'int32', id: 1 },
                header: { type: 'GatewayHeader', id: 2 },
                code: { type: 'uint32', id: 3 },
                message: { type: 'string', id: 4 },
              },
            },
          },
        },
      },
    },
  },
} as const;

export default proto;
