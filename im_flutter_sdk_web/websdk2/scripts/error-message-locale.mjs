import fs from 'node:fs/promises';
import path from 'node:path';

export const SUPPORTED_ERROR_MESSAGE_LOCALES = ['zh-CN', 'en-US'];

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const LOCALE_DIR = path.resolve(ROOT, 'docs/error-messages');
const HAN_PATTERN = /[\u4e00-\u9fff]/u;

const OPERATION_WORDS = {
  add: 'add',
  all: 'all',
  allowlist: 'allowlist',
  announcement: 'announcement',
  attachment: 'attachment',
  attribute: 'attribute',
  attributes: 'attributes',
  blocklist: 'blocklist',
  chat: 'chat',
  chatroom: 'chat room',
  clear: 'clear',
  contact: 'contact',
  conversation: 'conversation',
  create: 'create',
  delete: 'delete',
  destroy: 'destroy',
  detail: 'detail',
  download: 'download',
  file: 'file',
  global: 'global',
  group: 'group',
  history: 'history',
  info: 'info',
  invite: 'invite',
  join: 'join',
  joined: 'joined',
  language: 'language',
  last: 'last',
  leave: 'leave',
  list: 'list',
  mark: 'mark',
  member: 'member',
  members: 'members',
  message: 'message',
  mode: 'mode',
  mute: 'mute',
  muted: 'muted',
  own: 'own',
  owner: 'owner',
  parse: 'parse',
  pinned: 'pinned',
  presence: 'presence',
  publish: 'publish',
  push: 'push',
  reaction: 'reaction',
  read: 'read',
  recall: 'recall',
  remove: 'remove',
  room: 'room',
  rtc: 'RTC',
  self: 'self',
  set: 'set',
  shared: 'shared',
  silent: 'silent',
  status: 'status',
  subscribe: 'subscribe',
  subscribed: 'subscribed',
  supported: 'supported',
  text: 'text',
  thread: 'thread',
  token: 'token',
  translate: 'translate',
  translation: 'translation',
  unmute: 'unmute',
  unpin: 'unpin',
  unsubscribe: 'unsubscribe',
  update: 'update',
  upload: 'upload',
  user: 'user',
  users: 'users',
  voice: 'voice',
};

const COMMON_MESSAGES = new Map([
  ['参数无效：缺少必填参数', 'Invalid parameters: missing required parameter'],
  ['参数无效：格式不正确', 'Invalid parameters: incorrect format'],
  ['参数无效', 'Invalid parameters'],
  ['用户已登录', 'User is already logged in'],
  ['用户未登录', 'User is not logged in'],
  ['未登录', 'User is not logged in'],
  ['用户鉴权失败', 'User authentication failed'],
  ['用户无权限', 'User permission denied'],
  ['用户 token 已过期', 'User token has expired'],
  ['用户已在其他设备登录', 'User is logged in on another device'],
  ['用户登录设备数超过限制', 'User login device count exceeds the limit'],
  ['用户被禁言', 'User is muted'],
  ['请求服务超时', 'Service request timed out'],
  ['服务器不可达', 'Server is unreachable'],
  ['未连接服务器', 'Not connected to server'],
  ['通用错误', 'General error'],
  ['通用错误：连接已取消', 'General error: connection cancelled'],
  ['获取服务器配置信息错误', 'Failed to get server configuration'],
  ['服务器繁忙', 'Server is busy'],
  ['本地存储操作失败', 'Local storage operation failed'],
  ['服务请求通用错误', 'Generic service request error'],
  ['服务请求通用错误：业务错误未映射', 'Generic service request error: unmapped business error'],
  ['服务请求通用错误：服务端内部错误', 'Generic service request error: server internal error'],
  ['通用错误：发送器已销毁', 'General error: sender has been destroyed'],
  ['消息异常：编码失败', 'Message error: encoding failed'],
  ['消息异常：解码失败', 'Message error: decoding failed'],
  ['请求服务超时：ACK 丢失', 'Service request timed out: ACK missing'],
  ['网络错误', 'Network error'],
  ['参数无效：缺少必需字段', 'Invalid parameters: missing required field'],
  ['App Key 不合法', 'Invalid App Key'],
  ['文件太大', 'File is too large'],
  ['上传文件错误', 'File upload failed'],
  ['通用错误：上传已取消', 'General error: upload cancelled'],
  ['超过服务限制', 'Service limit exceeded'],
  ['服务已禁用', 'Service is disabled'],
  ['服务未开通或无权限', 'Service is not enabled or permission is denied'],
  ['Push token 上传失败', 'Push token upload failed'],
  ['免打扰设置失败', 'Silent mode operation failed'],
  ['推送翻译语言设置失败', 'Push language operation failed'],
  ['聊天室 ID 无效', 'Invalid chat room ID'],
  ['未加入聊天室', 'Not joined the chat room'],
  ['聊天室无权限', 'Chat room permission denied'],
  ['聊天室成员已满', 'Chat room member limit reached'],
  ['聊天室不存在', 'Chat room does not exist'],
  ['聊天室所有者不允许退出', 'Chat room owner cannot leave'],
  ['用户在聊天室黑名单中', 'User is in the chat room blocklist'],
  ['用户不存在', 'User does not exist'],
  ['目标用户不存在', 'Target user does not exist'],
  ['当前用户不存在', 'Current user does not exist'],
  ['查询的用户不存在', 'Queried user does not exist'],
  ['确认用户已注册', 'Confirm the user is registered'],
  ['确认用户 ID 正确', 'Confirm the user ID is correct'],
  ['请求过于频繁', 'Requests are too frequent'],
  ['降低请求频率后重试', 'Reduce request frequency and try again'],
  ['稍后重试', 'Try again later'],
  ['稍后重试或联系服务端排查', 'Try again later or contact the server team'],
  ['刷新 token 后重试', 'Refresh the token and try again'],
  ['unauthorized', 'Unauthorized'],
  ['refresh_token', 'Refresh token'],
  ['service_forbidden', 'Service forbidden'],
  ['check_service_permission', 'Check service permission'],
  ['subscriber_limit_exceeded', 'Subscriber limit exceeded'],
  ['reduce_subscription_targets', 'Reduce subscription targets'],
  ['target_limit_exceeded', 'Target limit exceeded'],
  ['change_subscription_target', 'Change subscription target'],
  ['server_unknown_error', 'Server unknown error'],
  ['订阅人数超限', 'Subscriber count exceeds the limit'],
  ['目标用户被订阅人数超限', 'Target user subscriber count exceeds the limit'],
  ['批量查询用户数超限', 'Batch user query count exceeds the limit'],
  ['单次查询的用户数量超过服务端允许上限', 'User count in one query exceeds the server limit'],
  ['减少单次查询的用户数量后重试', 'Reduce the user count per query and try again'],
  ['目标用户不是当前用户的好友', 'Target user is not a friend of the current user'],
  ['先添加好友再设置备注', 'Add the user as a friend before setting a remark'],
  ['非好友不能设置备注', 'Cannot set a remark for a non-friend'],
  ['备注长度超限', 'Remark length exceeds the limit'],
  ['缩短备注内容后重试', 'Shorten the remark and try again'],
  ['黑名单数量已达上限', 'Blocklist size reaches the limit'],
  ['黑名单数量已达服务端上限', 'Blocklist size reaches the server limit'],
  ['移除不再需要的黑名单用户后重试', 'Remove unnecessary blocked users and try again'],
  ['群组不存在', 'Group does not exist'],
  ['groupId 不存在或群组已被销毁', 'groupId does not exist or the group has been destroyed'],
  ['确认 groupId 正确且群组仍存在', 'Confirm the groupId is correct and the group still exists'],
  ['群组 ID 无效', 'Invalid group ID'],
  ['群组名称无效', 'Invalid group name'],
  ['群组已禁用', 'Group is disabled'],
  ['群组成员超上限', 'Group member count exceeds the limit'],
  ['已在该群组中', 'Already joined the group'],
  ['当前用户已经加入目标群组', 'Current user has already joined the target group'],
  ['用户未加入该群组', 'User has not joined the group'],
  ['无权限的群组操作', 'Group operation permission denied'],
  ['使用群主或管理员账号重试', 'Try again with the group owner or an administrator account'],
  ['群主不能退出群组', 'Group owner cannot leave the group directly'],
  ['群组或父消息不存在', 'Group or parent message does not exist'],
  ['群共享文件 ID 无效', 'Invalid group shared file ID'],
  ['群组成员属性个数超上限', 'Group member attribute count exceeds the limit'],
  ['群组成员属性更新失败', 'Failed to update group member attributes'],
  ['群组成员属性 key 长度超上限', 'Group member attribute key length exceeds the limit'],
  ['群组成员属性 value 长度超上限', 'Group member attribute value length exceeds the limit'],
  ['无权限设置群成员属性', 'Permission denied for setting group member attributes'],
  ['当前用户不在该群组中', 'Current user is not in the group'],
  ['确认目标用户已加入群组', 'Confirm the target user has joined the group'],
  ['聊天室人数已达上限，无法继续加入', 'Chat room member count has reached the limit'],
  ['使用聊天室 owner/admin 账号重试', 'Try again with a chat room owner/admin account'],
  ['当前用户不是聊天室 owner/admin，无法修改聊天室信息', 'Current user is not chat room owner/admin and cannot update chat room info'],
  ['当前用户没有销毁聊天室的权限', 'Current user has no permission to destroy the chat room'],
  ['当前用户未加入目标聊天室，无法设置属性', 'Current user has not joined the target chat room and cannot set attributes'],
  ['先加入聊天室后重试', 'Join the chat room and try again'],
  ['聊天室属性权限拒绝', 'Chat room attribute permission denied'],
  ['聊天室属性数量或总量超限', 'Chat room attribute count or total size exceeds the limit'],
  ['删除不再使用的属性后重试，或联系服务端提升配额', 'Delete unused attributes and try again, or contact the server team to increase the quota'],
  ['消息无效', 'Invalid message'],
  ['消息无效或未发送成功', 'Message is invalid or was not sent successfully'],
  ['消息不存在', 'Message does not exist'],
  ['消息为空', 'Message is empty'],
  ['会话中无消息', 'No message in the conversation'],
  ['操作不支持', 'Operation is not supported'],
  ['当前仅支持编辑文本消息和自定义消息', 'Currently only text and custom messages can be edited'],
  ['仅支持编辑文本和自定义消息', 'Only text and custom messages are supported'],
  ['无权编辑该消息', 'No permission to edit this message'],
  ['消息编辑失败', 'Message edit failed'],
  ['超过撤回时间限制', 'Message recall time limit exceeded'],
  ['撤回功能未开通', 'Message recall is not enabled'],
  ['只能对接收的消息发送已读回执', 'Read receipts can only be sent for received messages'],
  ['附件无效或消息类型不支持下载', 'Attachment is invalid or the message type does not support download'],
  ['附件不存在', 'Attachment does not exist'],
  ['附件下载失败', 'Attachment download failed'],
  ['附件已过期', 'Attachment has expired'],
  ['合并消息解析失败', 'Failed to parse combine message'],
  ['合并消息下载失败', 'Failed to download combine message'],
  ['消息不是合并消息类型', 'Message is not a combine message'],
  ['第三方内容审核拒绝', 'Rejected by third-party content moderation'],
  ['翻译服务未开通', 'Translation service is not enabled'],
  ['目标语言不合法', 'Invalid target language'],
  ['翻译文本过长', 'Translation text is too long'],
  ['翻译服务配额已达上限', 'Translation quota has been reached'],
  ['翻译服务异常', 'Translation service error'],
  ['语音文件无效', 'Invalid voice file'],
  ['语音文件不存在', 'Voice file does not exist'],
  ['语音文件格式或内容非法', 'Voice file format or content is invalid'],
  ['语音时长超过限制', 'Voice duration exceeds the limit'],
  ['语音文件过大', 'Voice file is too large'],
  ['语音转文字服务未开通', 'Voice-to-text service is not enabled'],
  ['语音转文字服务用量达到限制', 'Voice-to-text usage limit reached'],
  ['语音转文字失败', 'Voice-to-text failed'],
  ['语音文件上传失败', 'Voice file upload failed'],
  ['不能订阅自己的在线状态', 'Cannot subscribe to your own presence'],
  ['订阅列表中包含当前用户自己', 'Subscription list contains the current user'],
  ['从订阅列表中移除当前用户', 'Remove the current user from the subscription list'],
  ['参数长度超限', 'Parameter length exceeds the limit'],
  ['减少单次订阅的用户数量', 'Reduce the number of users per subscription request'],
  ['减少单次取消订阅的用户数量', 'Reduce the number of users per unsubscribe request'],
  ['调整 pageNum 或 pageSize 后重试', 'Adjust pageNum or pageSize and try again'],
  ['设置全局免打扰', 'Set global silent mode'],
  ['设置会话免打扰', 'Set conversation silent mode'],
  ['设置推送语言', 'Set push language'],
  ['上传推送 token', 'Upload push token'],
  ['获取全局免打扰', 'Get global silent mode'],
  ['获取会话免打扰', 'Get conversation silent mode'],
  ['获取推送翻译语言', 'Get push language'],
  ['分页游标、pageSize 或 includeEmptyConversations 类型非法', 'Pagination cursor, pageSize, or includeEmptyConversations type is invalid'],
  ['使用 SDK 上一次返回的 cursor，并确保 pageSize 为正整数、includeEmptyConversations 为布尔值', 'Use the cursor returned by the SDK and ensure pageSize is a positive integer and includeEmptyConversations is boolean'],
  ['会话 ID、会话类型、文本内容、扩展字段或定向接收配置非法', 'Conversation ID, conversation type, text content, extension, or receiver configuration is invalid'],
  ['传入合法的 conversationId、conversationType 和非空 content；receiverList 与 needGroupReadReceipt 仅用于群聊', 'Pass a valid conversationId, conversationType, and non-empty content; receiverList and needGroupReadReceipt are only for group chat'],
  ['当前用户登录态不可用或 token 无效', 'Current user login state is unavailable or token is invalid'],
  ['重新登录后再创建子区', 'Log in again before creating a thread'],
  ['重新登录后再查询子区列表', 'Log in again before querying the thread list'],
  ['重新登录后再查询已加入子区', 'Log in again before querying joined threads'],
  ['重新登录后再查询子区详情', 'Log in again before querying thread details'],
  ['重新登录后再加入子区', 'Log in again before joining the thread'],
  ['重新登录后再退出子区', 'Log in again before leaving the thread'],
  ['重新登录后再解散子区', 'Log in again before destroying the thread'],
  ['重新登录后再更新子区名称', 'Log in again before updating the thread name'],
  ['重新登录后再查询子区成员', 'Log in again before querying thread members'],
  ['重新登录后再移除子区成员', 'Log in again before removing a thread member'],
  ['重新登录后再查询子区最后消息', 'Log in again before querying thread last messages'],
  ['无权限创建子区', 'Permission denied to create thread'],
  ['无权限查询子区列表', 'Permission denied to query thread list'],
  ['无权限查询已加入子区', 'Permission denied to query joined threads'],
  ['无权限查询子区详情', 'Permission denied to query thread details'],
  ['无权限加入子区', 'Permission denied to join thread'],
  ['无权限退出子区', 'Permission denied to leave thread'],
  ['无权限解散子区', 'Permission denied to destroy thread'],
  ['无权限更新子区名称', 'Permission denied to update thread name'],
  ['无权限查询子区成员', 'Permission denied to query thread members'],
  ['无权限移除子区成员', 'Permission denied to remove thread member'],
  ['无权限查询子区最后消息', 'Permission denied to query thread last messages'],
  ['子区不存在', 'Thread does not exist'],
  ['子区或成员不存在', 'Thread or member does not exist'],
  ['子区数量或创建频率超过服务端限制', 'Thread count or creation frequency exceeds server limits'],
  ['服务端处理超时或网络链路超时', 'Server processing timed out or network timed out'],
  ['服务端返回未细分的 Thread 创建错误', 'Server returned an unspecified thread creation error'],
  ['服务端返回未细分的 Thread 列表查询错误', 'Server returned an unspecified thread list query error'],
  ['服务端返回未细分的已加入 Thread 查询错误', 'Server returned an unspecified joined thread query error'],
  ['服务端返回未细分的 Thread 详情查询错误', 'Server returned an unspecified thread detail query error'],
  ['服务端返回未细分的 Thread 加入错误', 'Server returned an unspecified thread join error'],
  ['服务端返回未细分的 Thread 退出错误', 'Server returned an unspecified thread leave error'],
  ['服务端返回未细分的 Thread 解散错误', 'Server returned an unspecified thread destroy error'],
  ['服务端返回未细分的 Thread 名称更新错误', 'Server returned an unspecified thread name update error'],
  ['服务端返回未细分的 Thread 成员列表查询错误', 'Server returned an unspecified thread member list query error'],
  ['服务端返回未细分的 Thread 成员移除错误', 'Server returned an unspecified thread member removal error'],
  ['服务端返回未细分的 Thread 最后消息查询错误', 'Server returned an unspecified thread last message query error'],
]);

const normalizeOperationName = value =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[_./-]+/gu, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/u)
    .map(word => OPERATION_WORDS[word] ?? word)
    .join(' ');

const normalizeKeyName = value =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[_./-]+/gu, ' ')
    .trim()
    .toLowerCase();

const stripHan = value => String(value).replace(HAN_PATTERN, '').trim();

export const machineTranslateErrorText = (value, context = {}) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return value;
  }

  if (COMMON_MESSAGES.has(value)) {
    return COMMON_MESSAGES.get(value);
  }

  if (!HAN_PATTERN.test(value)) {
    return value;
  }

  const stripped = stripHan(value);
  if (stripped.length > 0 && /^[\w\s.,:;'"!?()[\]/|#*+-]+$/u.test(stripped)) {
    return stripped;
  }

  const key = normalizeKeyName(context.key ?? '');
  const operation = normalizeOperationName(context.operation ?? context.section ?? '');
  const subject = operation || key || 'request';

  if (context.field === 'summary') {
    return subject ? `${subject.charAt(0).toUpperCase()}${subject.slice(1)}` : 'API operation';
  }
  if (context.field === 'action') {
    return key ? `Check ${key} and try again` : `Check the request and try again`;
  }
  if (context.field === 'reason') {
    return key ? `${key} occurred in ${subject}` : `The ${subject} request failed`;
  }
  return key ? `${subject} failed: ${key}` : `${subject} failed`;
};

const localizeEntry = (entry, lang, context) => {
  const result = {};
  for (const field of ['message', 'reason', 'action']) {
    if (typeof entry[field] === 'string') {
      result[field] =
        lang === 'zh-CN'
          ? entry[field]
          : machineTranslateErrorText(entry[field], { ...context, field });
    }
  }
  return result;
};

export const buildErrorLocalePack = (source, lang) => {
  const common = {};
  const apis = {};

  for (const [category, definition] of Object.entries(source.common ?? {})) {
    common[category] = { errors: {} };
    for (const [key, entry] of Object.entries(definition.errors ?? {})) {
      common[category].errors[key] = localizeEntry(entry, lang, {
        scope: 'common',
        section: category,
        key,
      });
    }
  }

  for (const [operation, definition] of Object.entries(source.apis ?? {})) {
    apis[operation] = {
      summary:
        lang === 'zh-CN'
          ? (definition.summary ?? '')
          : machineTranslateErrorText(definition.summary ?? operation, {
              scope: 'api',
              section: operation,
              operation,
              field: 'summary',
            }),
      localErrors: {},
      errors: {},
    };

    for (const [methodName, methodErrors] of Object.entries(definition.localErrors ?? {})) {
      apis[operation].localErrors[methodName] = {};
      for (const [key, entry] of Object.entries(methodErrors)) {
        apis[operation].localErrors[methodName][key] = localizeEntry(entry, lang, {
          scope: 'api',
          section: operation,
          operation,
          methodName,
          key,
        });
      }
    }

    for (const [key, entry] of Object.entries(definition.errors ?? {})) {
      apis[operation].errors[key] = localizeEntry(entry, lang, {
        scope: 'api',
        section: operation,
        operation,
        key,
      });
    }
  }

  return {
    locale: lang,
    generatedFrom: 'src/rest/api-errors.json',
    common,
    apis,
  };
};

export const getErrorLocalePackPath = lang => path.resolve(LOCALE_DIR, `${lang}.json`);

export const writeErrorLocalePack = async (source, lang) => {
  const outputPath = getErrorLocalePackPath(lang);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(buildErrorLocalePack(source, lang), null, 2)}\n`, 'utf8');
  return outputPath;
};

export const readErrorLocalePack = async lang => {
  const normalizedLang = SUPPORTED_ERROR_MESSAGE_LOCALES.includes(lang) ? lang : 'zh-CN';
  const outputPath = getErrorLocalePackPath(normalizedLang);
  return JSON.parse(await fs.readFile(outputPath, 'utf8'));
};

export const getLocalizedApiDefinition = (localePack, operation) =>
  localePack.apis?.[operation] ?? {};

export const getLocalizedCommonEntry = (localePack, category, key) =>
  localePack.common?.[category]?.errors?.[key] ?? {};

export const getLocalizedApiEntry = (localePack, operation, key, methodName) => {
  if (methodName) {
    const localEntry = localePack.apis?.[operation]?.localErrors?.[methodName]?.[key];
    if (localEntry) {
      return localEntry;
    }
  }
  return localePack.apis?.[operation]?.errors?.[key] ?? {};
};

export const assertLocalePackHasNoChinese = (localePack, filePath) => {
  const raw = JSON.stringify(localePack);
  if (HAN_PATTERN.test(raw)) {
    throw new Error(`${filePath} contains Chinese characters`);
  }
};
