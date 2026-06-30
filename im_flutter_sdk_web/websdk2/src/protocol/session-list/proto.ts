const proto = {
  nested: {
    easemob: {
      nested: {
        sessionlist: {
          nested: {
            GatewayHeader: {
              fields: {
                resource: { type: 'string', id: 1 },
                timestamp: { type: 'int64', id: 2 },
                request_id: { type: 'string', id: 3 },
                protocol_version: { type: 'int32', id: 4 },
              },
            },
            JID: {
              fields: {
                app_key: { type: 'string', id: 1 },
                name: { type: 'string', id: 2 },
                domain: { type: 'string', id: 3 },
                client_resource: { type: 'string', id: 4 },
              },
            },
            Meta: {
              fields: {
                id: { type: 'uint64', id: 1 },
                from: { type: 'JID', id: 2 },
                timestamp: { type: 'uint64', id: 4 },
                payload: { type: 'bytes', id: 6 },
              },
            },
            SessionItem: {
              fields: {
                session_id: { type: 'string', id: 1 },
                session_type: { type: 'int32', id: 2 },
                last_message: { type: 'Meta', id: 3 },
                updated_at: { type: 'int64', id: 6 },
                pinned_time: { type: 'int64', id: 7 },
                unread_count: { type: 'uint32', id: 8 },
                marks: { rule: 'repeated', type: 'string', id: 9 },
                read_receipt: { type: 'int64', id: 10 },
                remind_type: { type: 'int32', id: 11 },
                group_name: { type: 'string', id: 12 },
                group_avatar: { type: 'string', id: 13 },
                metadata: { type: 'string', id: 14 },
              },
            },
            GetSessionListRequest: {
              fields: {
                type: { type: 'int32', id: 1 },
                header: { type: 'GatewayHeader', id: 2 },
                org: { type: 'string', id: 3 },
                app: { type: 'string', id: 4 },
                username: { type: 'string', id: 5 },
                last_sync_time: { type: 'int64', id: 6 },
                need_empty_session: { type: 'bool', id: 7 },
                need_session_mark: { type: 'bool', id: 8 },
              },
            },
            GetSessionListResponse: {
              fields: {
                type: { type: 'int32', id: 1 },
                header: { type: 'GatewayHeader', id: 2 },
                sessions: { rule: 'repeated', type: 'SessionItem', id: 3 },
                is_last_batch: { type: 'bool', id: 4 },
                last_sync_finished_ts: { type: 'int64', id: 5 },
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
