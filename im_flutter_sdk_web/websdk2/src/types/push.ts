/**
 * [zh-CN] PushManager 对外类型定义，供 API 调用与文档生成使用。
 * [en-US] Public PushManager type definitions used by API calls and doc generation.
 */

/**
 * [zh-CN] 会话类型常量集合。
 * [en-US] Conversation type constants.
 */
export const PUSH_CONVERSATION_TYPE = {
  SINGLE_CHAT: 'singleChat',
  GROUP_CHAT: 'groupChat',
} as const;

/**
 * [zh-CN] PushManager 支持的会话类型。
 * [en-US] Conversation types supported by PushManager.
 */
export type PushConversationType =
  (typeof PUSH_CONVERSATION_TYPE)[keyof typeof PUSH_CONVERSATION_TYPE];

/**
 * [zh-CN] 推送提醒类型常量集合。
 * [en-US] Push remind type constants.
 */
export const PUSH_REMIND_TYPE = {
  ALL: 'ALL',
  AT: 'AT',
  NONE: 'NONE',
  DEFAULT: 'DEFAULT',
} as const;

/**
 * [zh-CN] 推送提醒类型。
 * [en-US] Push remind type.
 */
export type PushRemindType = (typeof PUSH_REMIND_TYPE)[keyof typeof PUSH_REMIND_TYPE];

/**
 * [zh-CN] 可设置的提醒类型（不包含 DEFAULT）。
 * [en-US] Settable remind types (excluding DEFAULT).
 */
export type PushRemindTypeWithoutDefault = Exclude<PushRemindType, 'DEFAULT'>;

/**
 * [zh-CN] 免打扰模式常量集合。
 * [en-US] Silent mode constants.
 */
export const PUSH_SILENT_MODE = {
  REMIND_TYPE: 'REMIND_TYPE',
  DURATION: 'DURATION',
  INTERVAL: 'INTERVAL',
} as const;

/**
 * [zh-CN] 免打扰模式类型。
 * [en-US] Silent mode type.
 */
export type PushSilentMode = (typeof PUSH_SILENT_MODE)[keyof typeof PUSH_SILENT_MODE];

/**
 * [zh-CN] 时间点（24 小时制）。
 * [en-US] Time point in 24-hour format.
 */
export interface PushTimePoint {
  /** [zh-CN] 小时，范围 0-23。 [en-US] Hour in range 0-23. */
  readonly hours: number;
  /** [zh-CN] 分钟，范围 0-59。 [en-US] Minute in range 0-59. */
  readonly minutes: number;
}

/**
 * [zh-CN] 提醒类型模式输入。
 * [en-US] Input for remind-type mode.
 */
export interface PushSilentModeRemindTypeRuleInput {
  /** [zh-CN] 固定值 `REMIND_TYPE`。 [en-US] Fixed value `REMIND_TYPE`. */
  readonly mode: 'REMIND_TYPE';
  /** [zh-CN] 提醒类型，支持 `ALL/AT/NONE`。 [en-US] Remind type, supports `ALL/AT/NONE`. */
  readonly remindType: PushRemindTypeWithoutDefault;
}

/**
 * [zh-CN] 时长模式输入。
 * [en-US] Input for duration mode.
 */
export interface PushSilentModeDurationRuleInput {
  /** [zh-CN] 固定值 `DURATION`。 [en-US] Fixed value `DURATION`. */
  readonly mode: 'DURATION';
  /** [zh-CN] 持续秒数，必须为正整数。 [en-US] Duration in seconds, must be a positive integer. */
  readonly duration: number;
}

/**
 * [zh-CN] 时间区间模式输入。
 * [en-US] Input for interval mode.
 */
export interface PushSilentModeIntervalRuleInput {
  /** [zh-CN] 固定值 `INTERVAL`。 [en-US] Fixed value `INTERVAL`. */
  readonly mode: 'INTERVAL';
  /** [zh-CN] 开始时间点。 [en-US] Interval start time point. */
  readonly startTime: PushTimePoint;
  /** [zh-CN] 结束时间点。 [en-US] Interval end time point. */
  readonly endTime: PushTimePoint;
}

/**
 * [zh-CN] 免打扰输入规则联合类型。
 * [en-US] Union type for silent-mode input rules.
 */
export type PushSilentModeRuleInput =
  | PushSilentModeRemindTypeRuleInput
  | PushSilentModeDurationRuleInput
  | PushSilentModeIntervalRuleInput;

/**
 * [zh-CN] 免打扰规则查询视图（字段可并存）。
 * [en-US] Silent mode rule view (fields can coexist).
 */
export interface PushSilentModeRuleView {
  /** [zh-CN] 当前提醒类型。 [en-US] Current remind type. */
  readonly remindType?: PushRemindType;
  /** [zh-CN] 到期时间戳（毫秒）。 [en-US] Expire timestamp in milliseconds. */
  readonly expireTimestamp?: number;
  /** [zh-CN] 每日免打扰开始时间。 [en-US] Daily silent mode start time. */
  readonly silentModeStartTime?: PushTimePoint;
  /** [zh-CN] 每日免打扰结束时间。 [en-US] Daily silent mode end time. */
  readonly silentModeEndTime?: PushTimePoint;
}

/**
 * [zh-CN] 仅提醒类型视图。
 * [en-US] Remind-type-only view.
 */
export type PushSilentModeRemindTypeRuleView = Readonly<{
  /** [zh-CN] 当前提醒类型。 [en-US] Current remind type. */
  remindType: PushRemindType;
}>;

/**
 * [zh-CN] 仅时长视图。
 * [en-US] Duration-only view.
 */
export type PushSilentModeDurationRuleView = Readonly<{
  /** [zh-CN] 到期时间戳（毫秒）。 [en-US] Expire timestamp in milliseconds. */
  expireTimestamp: number;
}>;

/**
 * [zh-CN] 仅时间区间视图。
 * [en-US] Interval-only view.
 */
export type PushSilentModeIntervalRuleView = Readonly<{
  /** [zh-CN] 每日免打扰开始时间。 [en-US] Daily silent mode start time. */
  silentModeStartTime: PushTimePoint;
  /** [zh-CN] 每日免打扰结束时间。 [en-US] Daily silent mode end time. */
  silentModeEndTime: PushTimePoint;
}>;

/**
 * [zh-CN] 全局免打扰响应。
 * [en-US] Global silent mode response.
 */
export interface GlobalSilentModeResponse {
  /** [zh-CN] 作用域，固定为 `global`。 [en-US] Scope, fixed to `global`. */
  readonly scope: 'global';
  /** [zh-CN] 全局免打扰规则。 [en-US] Global silent mode rule. */
  readonly rule: PushSilentModeRuleView;
}

/**
 * [zh-CN] 单会话免打扰响应。
 * [en-US] Conversation silent mode response.
 */
export interface ConversationSilentModeResponse {
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType: PushConversationType;
  /** [zh-CN] 会话免打扰规则。 [en-US] Conversation silent mode rule. */
  readonly rule: PushSilentModeRuleView;
}

/**
 * [zh-CN] 会话标识。
 * [en-US] Conversation identifier.
 */
export interface ConversationIdentifier {
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType: PushConversationType;
}

/**
 * [zh-CN] 批量会话免打扰响应。
 * [en-US] Batch conversation silent mode response.
 */
export interface BatchConversationSilentModeResponse {
  /** [zh-CN] 会话结果列表。 [en-US] Conversation result list. */
  readonly conversations: ReadonlyArray<ConversationSilentModeResponse>;
}

/**
 * [zh-CN] 推送语言响应。
 * [en-US] Push language response.
 */
export interface PushLanguageResponse {
  /** [zh-CN] 当前生效语言。 [en-US] Current effective language. */
  readonly language: string;
}

/**
 * [zh-CN] 免打扰会话条目。
 * [en-US] Muted conversation item.
 */
export interface MutedConversationItem {
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType: PushConversationType;
  /** [zh-CN] 提醒类型（不含 DEFAULT）。 [en-US] Remind type (without DEFAULT). */
  readonly remindType: PushRemindTypeWithoutDefault;
}

/**
 * [zh-CN] 免打扰会话分页响应。
 * [en-US] Paged muted conversation response.
 */
export interface MutedConversationPageResponse {
  /** [zh-CN] 当前页会话列表。 [en-US] Conversation list for current page. */
  readonly conversations: ReadonlyArray<MutedConversationItem>;
  /** [zh-CN] 下一页游标，空字符串表示无更多数据。 [en-US] Next-page cursor; empty string means no more data. */
  readonly cursor: string;
}

/**
 * [zh-CN] 上传 Push Token 参数。
 * [en-US] Upload push token parameters.
 */
export interface UploadPushTokenParams {
  /** [zh-CN] 设备唯一标识。 [en-US] Unique device identifier. */
  readonly deviceId: string;
  /** [zh-CN] 设备推送 token。 [en-US] Device push token. */
  readonly deviceToken: string;
  /** [zh-CN] 推送通道名称（例如 FCM）。 [en-US] Push notifier name (for example, FCM). */
  readonly notifierName: string;
}

/**
 * [zh-CN] 设置全局免打扰参数。
 * [en-US] Parameters for setting global silent mode.
 */
export interface SetGlobalSilentModeParams {
  /** [zh-CN] 免打扰规则输入。 [en-US] Silent mode rule input. */
  readonly rule: PushSilentModeRuleInput;
}

/**
 * [zh-CN] 查询全局免打扰参数。
 * [en-US] Parameters for querying global silent mode.
 */
export type GetGlobalSilentModeParams = Record<string, never>;

/**
 * [zh-CN] 设置会话免打扰参数。
 * [en-US] Parameters for setting conversation silent mode.
 */
export interface SetConversationSilentModeParams {
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType: PushConversationType;
  /** [zh-CN] 会话免打扰规则。 [en-US] Conversation silent mode rule. */
  readonly rule: PushSilentModeRuleInput;
}

/**
 * [zh-CN] 查询会话免打扰参数。
 * [en-US] Parameters for querying conversation silent mode.
 */
export interface GetConversationSilentModeParams {
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType: PushConversationType;
}

/**
 * [zh-CN] 清除会话提醒类型参数。
 * [en-US] Parameters for clearing conversation remind type.
 */
export interface ClearConversationRemindTypeParams {
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType: PushConversationType;
}

/**
 * [zh-CN] 批量查询会话免打扰参数。
 * [en-US] Parameters for batch querying conversation silent modes.
 */
export interface GetConversationSilentModesParams {
  /** [zh-CN] 会话列表，单次最多 20 条。 [en-US] Conversation list, maximum 20 items per request. */
  readonly conversationList: ReadonlyArray<ConversationIdentifier>;
}

/**
 * [zh-CN] 设置推送语言参数。
 * [en-US] Parameters for setting push language.
 */
export interface SetPushLanguageParams {
  /** [zh-CN] 语言值（例如 `zh-Hans`、`en`）。 [en-US] Language value (for example, `zh-Hans`, `en`). */
  readonly language: string;
}

/**
 * [zh-CN] 查询推送语言参数。
 * [en-US] Parameters for querying push language.
 */
export type GetPushLanguageParams = Record<string, never>;

/**
 * [zh-CN] 分页查询提醒类型会话参数。
 * [en-US] Parameters for paging conversations by remind type.
 */
export interface GetConversationListByRemindTypeParams {
  /** [zh-CN] 分页大小，必须为正整数。 [en-US] Page size, must be a positive integer. */
  readonly pageSize: number;
  /** [zh-CN] 分页游标（可选）。 [en-US] Paging cursor (optional). */
  readonly cursor?: string;
}
