#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SOURCE_PATH = path.resolve(ROOT, 'src/rest/api-errors.json');
const OUTPUT_DIR = path.resolve(ROOT, 'src/rest/error-maps');
const ERROR_CODES_OUTPUT = path.resolve(ROOT, 'src/utils/error-codes.generated.ts');

const LOCALIZED_FIELDS = new Set(['message', 'reason', 'action', 'summary', 'runtimeMessage']);

const MANAGER_OPERATIONS = {
  chat: [
    'sendMessage',
    'getHistoryMessages',
    'removeHistoryMessages',
    'getGroupMessageReadUsers',
    'markConversationRead',
    'markMessageRead',
    'recallMessage',
    'updateMessage',
    'downloadMessageAttachment',
    'downloadAndParseCombineMessage',
    'addReaction',
    'removeReaction',
    'getReactionList',
    'getReactionDetail',
    'pinMessage',
    'unpinMessage',
    'getPinnedMessageList',
    'getSupportedTranslationLanguages',
    'translateMessage',
    'voiceMessageToText',
    'voiceFileToText',
    'getConversationList',
    'getPinnedConversationList',
    'getConversationListByMark',
    'deleteConversation',
    'setConversationPinned',
    'addConversationMark',
    'removeConversationMark',
    'clearAllMessagesAndConversations',
  ],
  contact: [
    'addContact',
    'deleteContact',
    'acceptContactInvite',
    'declineContactInvite',
    'setContactRemark',
    'getBlocklist',
    'addUsersToBlocklist',
    'removeUserFromBlocklist',
  ],
  group: [
    'createGroup',
    'getGroupInfo',
    'getGroupInfoList',
    'updateGroupInfo',
    'changeGroupOwner',
    'destroyGroup',
    'leaveGroup',
    'joinGroup',
    'inviteUsersToGroup',
    'getGroupMemberList',
    'getGroupAdminList',
    'getGroupMuteList',
    'getGroupBlocklist',
    'getGroupAllowlist',
    'getGroupAnnouncement',
    'getGroupSharedFileList',
    'deleteGroupSharedFile',
    'setGroupMemberAttributes',
    'getGroupMembersAttributes',
  ],
  chatroom: [
    'getChatRoomList',
    'getChatRoomInfo',
    'updateChatRoomInfo',
    'destroyChatRoom',
    'joinChatRoom',
    'leaveChatRoom',
    'getChatRoomMemberList',
    'addChatRoomMembers',
    'removeChatRoomMembers',
    'getChatRoomAdminList',
    'setChatRoomAdmin',
    'removeChatRoomAdmin',
    'getChatRoomMuteList',
    'muteChatRoomMembers',
    'unmuteChatRoomMembers',
    'muteAllChatRoomMembers',
    'unmuteAllChatRoomMembers',
    'isCurrentUserMutedInChatRoom',
    'checkIfInChatRoomMuteList',
    'getChatRoomBlocklist',
    'blockChatRoomMembers',
    'unblockChatRoomMembers',
    'getChatRoomAllowlist',
    'addUsersToChatRoomAllowlist',
    'removeUsersFromChatRoomAllowlist',
    'checkIfInChatRoomAllowList',
    'getChatRoomAnnouncement',
    'updateChatRoomAnnouncement',
    'getChatRoomSharedFileList',
    'deleteChatRoomSharedFile',
    'getChatRoomAttributes',
    'setChatRoomAttributes',
    'setChatRoomAttribute',
    'removeChatRoomAttributes',
    'removeChatRoomAttribute',
  ],
  presence: [
    'publishPresence',
    'subscribePresences',
    'unsubscribePresence',
    'getSubscribedPresenceList',
    'getPresenceStatus',
  ],
  push: [
    'setGlobalSilentMode',
    'setConversationSilentMode',
    'setPushLanguage',
    'uploadPushToken',
    'getGlobalSilentMode',
    'getConversationSilentMode',
    'clearConversationRemindType',
    'getConversationSilentModes',
    'getConversationListByRemindType',
    'getPushLanguage',
  ],
  userInfo: [
    'updateOwnUserInfo',
    'getUserInfoByUserId',
    'getUserInfoByAttribute',
    'subscribeUsersInfo',
    'unsubscribeUsersInfo',
    'getSubscribedUsers',
  ],
  thread: [
    'createChatThread',
    'getChatThreadList',
    'getJoinedChatThreadList',
    'getChatThreadInfo',
    'joinChatThread',
    'leaveChatThread',
    'destroyChatThread',
    'updateChatThreadName',
    'getChatThreadMemberList',
    'removeChatThreadMember',
    'getChatThreadLastMessageList',
  ],
  core: [
    'getSelfIdsOnOtherPlatform',
    'getTokenExpireTimestamp',
    'getRtcTokenInfo',
    'getUserIdsWithRtcUids',
  ],
};

const ERROR_CODE_EXPRESSIONS = {
  VALIDATION_REQUIRED: 'common.validation.errors.MISSING_REQUIRED.code',
  VALIDATION_INVALID_FORMAT: 'common.validation.errors.INVALID_FORMAT.code',
  VALIDATION_UNKNOWN: 'common.validation.errors.UNKNOWN.code',
  AUTH_ALREADY_LOGIN: 'common.auth.errors.ALREADY_LOGIN.code',
  AUTH_NOT_LOGIN: 'common.auth.errors.NOT_LOGIN.code',
  AUTH_UNAUTHORIZED: 'common.auth.errors.UNAUTHORIZED.code',
  AUTH_FORBIDDEN: 'common.auth.errors.FORBIDDEN.code',
  AUTH_TOKEN_EXPIRED: 'common.auth.errors.TOKEN_EXPIRED.code',
  AUTH_BIND_ANOTHER_DEVICE: 'common.auth.errors.BIND_ANOTHER_DEVICE.code',
  AUTH_LOGIN_TOO_MANY_DEVICES: 'common.auth.errors.LOGIN_TOO_MANY_DEVICES.code',
  AUTH_USER_MUTED: 'common.auth.errors.USER_MUTED.code',
  CONNECTION_TIMEOUT: 'common.connection.errors.TIMEOUT.code',
  CONNECTION_WEBSOCKET_ERROR: 'common.connection.errors.WEBSOCKET_ERROR.code',
  CONNECTION_NOT_CREATED: 'common.connection.errors.NOT_CREATED.code',
  CONNECTION_CLOSED_BEFORE_READY: 'common.connection.errors.CLOSED_BEFORE_READY.code',
  CONNECTION_CANCELLED: 'common.connection.errors.CANCELLED.code',
  CONNECTION_PROVISION_TIMEOUT: 'common.connection.errors.PROVISION_TIMEOUT.code',
  CONNECTION_PROVISION_REJECTED: 'common.connection.errors.PROVISION_REJECTED.code',
  CONNECTION_PROVISION_CLOSED: 'common.connection.errors.PROVISION_CLOSED.code',
  CONNECTION_DNSLIST_FAILED: 'common.connection.errors.DNSLIST_FAILED.code',
  STORAGE_OPERATION_FAILED: 'common.storage.errors.OPERATION_FAILED.code',
  MESSAGE_NOT_CONNECTED: 'common.message.errors.NOT_CONNECTED.code',
  MESSAGE_ACK_TIMEOUT: 'common.message.errors.ACK_TIMEOUT.code',
  MESSAGE_SEND_FAILED: 'common.message.errors.SEND_FAILED.code',
  MESSAGE_SENDER_DESTROYED: 'common.message.errors.SENDER_DESTROYED.code',
  MESSAGE_ENCODE_FAILED: 'common.message.errors.ENCODE_FAILED.code',
  MESSAGE_DECODE_FAILED: 'common.message.errors.DECODE_FAILED.code',
  MESSAGE_ACK_MISSING: 'common.message.errors.ACK_MISSING.code',
  OPERATION_UNSUPPORTED: 111,
  SERVER_BUSY: 'common.connection.errors.SERVER_BUSY.code',
  ATTACHMENT_NOT_FOUND: 400,
  ATTACHMENT_INVALID: 401,
  ATTACHMENT_EXPIRED: 407,
  MESSAGE_INCLUDE_ILLEGAL_CONTENT: 501,
  MESSAGE_SEND_TRAFFIC_LIMIT: 502,
  MESSAGE_RECALL_TIME_LIMIT: 504,
  SERVICE_NOT_ENABLED: 505,
  MESSAGE_EXPIRED: 506,
  MESSAGE_ILLEGAL_WHITELIST: 507,
  MESSAGE_EXTERNAL_LOGIC_BLOCKED: 508,
  MESSAGE_CURRENT_LIMITING: 509,
  MESSAGE_SIZE_LIMIT: 510,
  MESSAGE_EDIT_FAILED: 511,
  INVALID_CONVERSATION: 107,
  USER_LOGIN_ANOTHER_DEVICE: 206,
  USER_REMOVED: 207,
  USER_KICKED_BY_CHANGE_PASSWORD: 216,
  USER_KICKED_BY_OTHER_DEVICE: 217,
  USER_ALREADY_LOGIN_ANOTHER: 218,
  USER_MUTED_BY_ADMIN: 219,
  USER_DEVICE_CHANGED: 220,
  USER_NOT_ON_ROSTER: 221,
  SERVER_SERVING_DISABLED: 305,
  FILE_DOWNLOAD_FAILED: 403,
  FILE_TOO_LARGE: 405,
  FILE_CONTENT_IMPROPER: 406,
  THIRD_MODERATION_FAILED: 1200,
  THIRD_DEFAULT_FAILED: 1299,
  STREAM_SEND_NOT_SUPPORTED: 'common.message.errors.SEND_FAILED.code',
  STREAM_CHUNK_INVALID: 'common.message.errors.DECODE_FAILED.code',
  STREAM_TIMEOUT_BY_SERVER: 'common.message.errors.DECODE_FAILED.code',
  STREAM_STATE_CONFLICT: 'common.message.errors.DECODE_FAILED.code',
  COMBINE_INVALID_INPUT: 'common.validation.errors.INVALID_FORMAT.code',
  COMBINE_LEVEL_EXCEEDED: 'common.unknown.errors.SERVICE_LIMIT_EXCEEDED.code',
  COMBINE_ITEM_LIMIT_EXCEEDED: 'common.unknown.errors.SERVICE_LIMIT_EXCEEDED.code',
  COMBINE_ENCODE_FAILED: 'common.message.errors.ENCODE_FAILED.code',
  COMBINE_UPLOAD_FAILED: 'common.upload.errors.REQUEST_FAILED.code',
  COMBINE_DOWNLOAD_FAILED: 'common.transport.errors.NETWORK_ERROR.code',
  COMBINE_PARSE_FAILED: 'common.message.errors.DECODE_FAILED.code',
  REST_NETWORK_ERROR: 'common.transport.errors.NETWORK_ERROR.code',
  REST_TIMEOUT: 'common.transport.errors.TIMEOUT.code',
  REST_HTTP_ERROR: 'common.transport.errors.HTTP_ERROR.code',
  REST_BUSINESS_UNKNOWN: 'common.transport.errors.BUSINESS_UNKNOWN.code',
  PUSH_TOKEN_UPLOAD_FAILED: 'common.push.errors.TOKEN_UPLOAD_FAILED.code',
  PUSH_SILENT_MODE_OPERATION_FAILED: 'common.push.errors.SILENT_MODE_OPERATION_FAILED.code',
  PUSH_LANGUAGE_OPERATION_FAILED: 'common.push.errors.PUSH_LANGUAGE_OPERATION_FAILED.code',
  USER_INFO_SUBSCRIPTION_LIMIT_EXCEEDED:
    'apis.subscribeUsersInfo.errors.subscriber_limit_exceeded.code',
  USER_INFO_SUBSCRIPTION_TARGET_LIMIT_EXCEEDED:
    'apis.subscribeUsersInfo.errors.target_limit_exceeded.code',
  USERINFO_USERCOUNT_EXCEED: 'apis.getUserInfoByUserId.errors.usercount_exceed.code',
  USERINFO_DATALENGTH_EXCEED: 'apis.updateOwnUserInfo.errors.data_length_exceed.code',
  CONTACT_ADD_USER_NOT_FOUND: 'apis.addContact.errors.USER_NOT_FOUND.code',
  CONTACT_ADD_ALREADY_FRIEND: 'apis.addContact.errors.ALREADY_FRIEND.code',
  CONTACT_ADD_BLOCKED_BY_USER: 'apis.addContact.errors.BLOCKED_BY_USER.code',
  CONTACT_SET_REMARK_NOT_FRIEND: 'apis.setContactRemark.errors.illegal_argument.code',
  CONTACT_REACH_LIMIT: 'apis.addContact.errors.CONTACT_REACH_LIMIT.code',
  CONTACT_REACH_LIMIT_PEER: 'apis.addContact.errors.CONTACT_REACH_LIMIT_PEER.code',
  CONTACT_BLOCKLIST_USER_NOT_FOUND: 'apis.addUsersToBlocklist.errors.service_resource_not_found.code',
  GROUP_INVALID_ID: 'apis.joinGroup.errors.group_invalid_id.code',
  GROUP_ALREADY_JOINED: 'apis.joinGroup.errors.already_joined.code',
  GROUP_NOT_JOINED: 'apis.leaveGroup.errors.not_joined.code',
  GROUP_PERMISSION_DENIED: 'apis.inviteUsersToGroup.errors.group_authorization.code',
  GROUP_MEMBERS_FULL: 'apis.joinGroup.errors.group_full.code',
  GROUP_SHARED_FILE_INVALID_ID: 'apis.deleteGroupSharedFile.errors.file_not_found.code',
  GROUP_NOT_EXIST: 'apis.getGroupInfo.errors.resource_not_found.code',
  GROUP_DISABLED: 'apis.updateGroupInfo.errors.group_disabled.code',
  GROUP_NAME_VIOLATION: 'apis.createGroup.errors.group_name_violation.code',
  GROUP_MEMBER_ATTRIBUTES_REACH_LIMIT:
    'apis.setGroupMemberAttributes.errors.attributes_reach_limit.code',
  GROUP_MEMBER_ATTRIBUTES_UPDATE_FAILED:
    'apis.setGroupMemberAttributes.errors.attributes_update_failed.code',
  GROUP_MEMBER_ATTRIBUTES_KEY_REACH_LIMIT:
    'apis.setGroupMemberAttributes.errors.attributes_key_reach_limit.code',
  GROUP_MEMBER_ATTRIBUTES_VALUE_REACH_LIMIT:
    'apis.setGroupMemberAttributes.errors.attributes_value_reach_limit.code',
  GROUP_USER_IN_BLOCKLIST: 'apis.joinGroup.errors.group_user_in_blocklist.code',
  CHATROOM_INVALID_ID: 'common.chatroom.errors.CHATROOM_INVALID_ID.code',
  CHATROOM_NOT_JOINED: 'common.chatroom.errors.CHATROOM_NOT_JOINED.code',
  CHATROOM_PERMISSION_DENIED: 'common.chatroom.errors.CHATROOM_PERMISSION_DENIED.code',
  CHATROOM_MEMBERS_FULL: 'common.chatroom.errors.CHATROOM_MEMBERS_FULL.code',
  CHATROOM_NOT_EXIST: 'common.chatroom.errors.CHATROOM_NOT_EXIST.code',
  CHATROOM_OWNER_NOT_ALLOW_LEAVE: 'common.chatroom.errors.CHATROOM_OWNER_NOT_ALLOW_LEAVE.code',
  CHATROOM_USER_IN_BLOCKLIST: 'common.chatroom.errors.CHATROOM_USER_IN_BLOCKLIST.code',
  CONTACT_SYNC_METADATA_FAILED: 1700,
  CONTACT_SYNC_SOCKET_FAILED: 1701,
  CONTACT_SYNC_CURSOR_INVALID: 1702,
  CONTACT_SYNC_PROTO_DECODE_FAILED: 1703,
  CONTACT_SYNC_CANCELLED: 1704,
  SESSION_LIST_SOCKET_FAILED: 811001,
  SESSION_LIST_PROTO_DECODE_FAILED: 811002,
  SESSION_LIST_REQUEST_INVALID: 811003,
  SESSION_LIST_FETCH_FAILED: 811004,
  SESSION_LIST_SERVICE_DISABLED: 811005,
  SESSION_LIST_CANCELLED: 811006,
  PRESENCE_PARAM_LENGTH_EXCEED: 'apis.publishPresence.errors.PRESENCE_PARAM_EXCEED.code',
  PRESENCE_CANNOT_SUBSCRIBE_YOURSELF:
    'apis.subscribePresences.errors.cannot_subscribe_yourself.code',
  TRANSLATE_PARAM_INVALID: 1110,
  TRANSLATE_SERVICE_NOT_ENABLED: 1111,
  TRANSLATE_USAGE_LIMIT: 1112,
  TRANSLATE_FAILED: 1113,
  VOICE_TO_TEXT_FILE_INVALID: 407,
  VOICE_TO_TEXT_FILE_DURATION_TOO_LONG: 408,
  VOICE_TO_TEXT_FAILED: 409,
  VOICE_TO_TEXT_FILE_NOT_FOUND: 410,
  VOICE_TO_TEXT_FILE_TOO_LARGE: 411,
  REACTION_REACH_LIMIT: 1300,
  REACTION_ALREADY_OPERATED: 1301,
  REACTION_OPERATION_ILLEGAL: 1302,
  UPLOAD_REQUIRED_FIELD_MISSING: 'common.upload.errors.REQUIRED_FIELD_MISSING.code',
  UPLOAD_INVALID_APPKEY: 'common.upload.errors.INVALID_APPKEY.code',
  UPLOAD_SIZE_EXCEEDED: 'common.upload.errors.SIZE_EXCEEDED.code',
  UPLOAD_REQUEST_FAILED: 'common.upload.errors.REQUEST_FAILED.code',
  UPLOAD_TIMEOUT: 'common.upload.errors.TIMEOUT.code',
  UPLOAD_ABORTED: 'common.upload.errors.ABORTED.code',
  SERVICE_LIMIT_EXCEEDED: 'common.unknown.errors.SERVICE_LIMIT_EXCEEDED.code',
  UNKNOWN: 'common.unknown.errors.UNKNOWN.code',
};

const readJson = async filePath => JSON.parse(await fs.readFile(filePath, 'utf8'));

const stripEntry = entry => {
  const result = {};
  for (const [key, value] of Object.entries(entry)) {
    if (LOCALIZED_FIELDS.has(key) || value === undefined) {
      continue;
    }
    result[key] = value;
  }
  return result;
};

const stripDefinitions = definitions => {
  const result = {};
  for (const [name, definition] of Object.entries(definitions)) {
    const errors = {};
    for (const [key, entry] of Object.entries(definition.errors ?? {})) {
      errors[key] = stripEntry(entry);
    }

    const localErrors = {};
    for (const [methodName, methodErrors] of Object.entries(definition.localErrors ?? {})) {
      localErrors[methodName] = {};
      for (const [key, entry] of Object.entries(methodErrors)) {
        localErrors[methodName][key] = stripEntry(entry);
      }
    }

    result[name] = {
      ...(definition.range !== undefined ? { range: definition.range } : {}),
      ...(Object.keys(localErrors).length > 0 ? { localErrors } : {}),
      errors,
    };
  }
  return result;
};

const pickApis = (apis, names) => {
  const result = {};
  for (const name of names) {
    if (apis[name]) {
      result[name] = apis[name];
    }
  }
  return result;
};

const stringifyConst = value => JSON.stringify(value, null, 2);

const writeTs = async (filePath, exportName, value) => {
  const content = `// Auto-generated by scripts/generate-runtime-error-maps.mjs. Do not edit manually.\n\nexport const ${exportName} = ${stringifyConst(value)} as const;\n`;
  await fs.writeFile(filePath, content, 'utf8');
};

const resolvePathValue = (root, expression) => {
  if (typeof expression === 'number') {
    return expression;
  }
  return expression.split('.').reduce((value, segment) => value?.[segment], root);
};

const buildErrorCodes = source => {
  const result = {};
  for (const [name, expression] of Object.entries(ERROR_CODE_EXPRESSIONS)) {
    const value = resolvePathValue(source, expression);
    if (typeof value !== 'number') {
      throw new Error(`Unable to resolve ERROR_CODES.${name} from ${expression}`);
    }
    result[name] = value;
  }
  return result;
};

const stringifyErrorCodesType = errorCodes =>
  Object.keys(errorCodes)
    .map(name => `  readonly ${name}: number;`)
    .join('\n');

const toExportName = scope => {
  if (scope === 'userInfo') {
    return 'USER_INFO_ERROR_MAP';
  }
  return `${scope.replace(/([A-Z])/g, '_$1').toUpperCase()}_ERROR_MAP`;
};

const main = async () => {
  const source = await readJson(SOURCE_PATH);
  const strippedCommon = stripDefinitions(source.common);
  const strippedApis = stripDefinitions(source.apis);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await writeTs(path.resolve(OUTPUT_DIR, 'common.ts'), 'COMMON_ERROR_MAP', {
    common: strippedCommon,
    apis: {},
  });

  for (const [scope, operations] of Object.entries(MANAGER_OPERATIONS)) {
    const fileName = scope.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    await writeTs(path.resolve(OUTPUT_DIR, `${fileName}.ts`), toExportName(scope), {
      common: {},
      apis: pickApis(strippedApis, operations),
    });
  }

  const errorCodes = buildErrorCodes(source);
  await fs.writeFile(
    ERROR_CODES_OUTPUT,
    `// Auto-generated by scripts/generate-runtime-error-maps.mjs. Do not edit manually.\n\nexport const ERROR_CODES: {\n${stringifyErrorCodesType(errorCodes)}\n} = ${stringifyConst(errorCodes)};\n\nexport type ErrorCode = number;\n`,
    'utf8'
  );
};

await main();
