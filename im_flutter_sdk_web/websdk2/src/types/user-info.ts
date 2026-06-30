/**
 * [zh-CN] UserInfoManager 对外类型定义。
 * [en-US] Public types for UserInfoManager.
 */

/**
 * [zh-CN] 用户资料属性名。
 * [en-US] Public user profile attribute names.
 */
export type UserInfoAttribute =
  | 'nickname'
  | 'avatarUrl'
  | 'mail'
  | 'phone'
  | 'gender'
  | 'sign'
  | 'birth'
  | 'ext';

/**
 * [zh-CN] 单个用户资料属性允许的值类型。
 * [en-US] Allowed value types for a single user profile attribute.
 */
export type UserInfoAttributeValue = string | number | boolean;

/**
 * [zh-CN] UserInfoManager 查询/更新成功后返回的标准化用户资料对象。
 * [en-US] Normalized user profile returned by UserInfoManager fetch/update APIs.
 */
export interface UserInfo {
  /** [zh-CN] 用户 ID。 [en-US] User ID. */
  readonly userId: string;
  /** [zh-CN] 昵称。 [en-US] Nickname. */
  readonly nickname?: string;
  /** [zh-CN] 头像地址。 [en-US] Avatar URL. */
  readonly avatarUrl?: string;
  /** [zh-CN] 邮箱。 [en-US] Email. */
  readonly mail?: string;
  /** [zh-CN] 手机号。 [en-US] Phone number. */
  readonly phone?: string;
  /** [zh-CN] 性别或自定义标识。 [en-US] Gender or custom gender marker. */
  readonly gender?: UserInfoAttributeValue;
  /** [zh-CN] 签名。 [en-US] Signature. */
  readonly sign?: string;
  /** [zh-CN] 生日。 [en-US] Birthday. */
  readonly birth?: string;
  /** [zh-CN] 扩展字段。 [en-US] Extension field. */
  readonly ext?: string;
}

/**
 * [zh-CN] 用户资料事件监听器。
 * [en-US] User profile event listener.
 */
export interface UserInfoListener {
  /**
   * [zh-CN] 当前用户资料更新时触发。
   * [en-US] Triggered when the current user's profile is updated.
   */
  readonly onOwnInfoUpdated?: (userInfo: UserInfo) => void;
  /**
   * [zh-CN] 他人资料通过消息补位更新时触发。
   * [en-US] Triggered when other users' profiles are hydrated from messages.
   */
  readonly onUserInfoUpdated?: (userInfos: ReadonlyArray<UserInfo>) => void;
}

/**
 * [zh-CN] 按用户 ID 查询默认字段的参数。
 * [en-US] Parameters for fetching default profile fields by user IDs.
 */
export interface FetchUserInfoByUserIdParams {
  /** [zh-CN] 目标用户 ID 列表。 [en-US] Target user ID list. */
  readonly userIds: ReadonlyArray<string>;
}

/**
 * [zh-CN] 按用户 ID 与属性集查询资料的参数。
 * [en-US] Parameters for fetching profiles by user IDs with an explicit attribute projection.
 */
export interface FetchUserInfoByAttributeParams {
  /** [zh-CN] 目标用户 ID 列表。 [en-US] Target user ID list. */
  readonly userIds: ReadonlyArray<string>;
  /** [zh-CN] 需要查询的资料属性。 [en-US] Requested profile attributes. */
  readonly attributes: ReadonlyArray<UserInfoAttribute>;
}

/**
 * [zh-CN] 批量订阅陌生人资料变化的参数。
 * [en-US] Parameters for subscribing to stranger profile change notifications.
 */
export interface SubscribeUsersInfoParams {
  /** [zh-CN] 待订阅的用户 ID 列表。 [en-US] Target user ID list to subscribe. */
  readonly userIds: ReadonlyArray<string>;
}

/**
 * [zh-CN] 批量取消订阅陌生人资料变化的参数。
 * [en-US] Parameters for unsubscribing stranger profile change notifications.
 */
export interface UnsubscribeUsersInfoParams {
  /** [zh-CN] 待取消订阅的用户 ID 列表。 [en-US] Target user ID list to unsubscribe. */
  readonly userIds: ReadonlyArray<string>;
}

/** @internal 用户资料 notify 来源。 */
export type UserInfoNotifySource = 'subscription' | 'contact' | 'own';

/** @internal 原始用户资料 notify 类型。 */
export type UserInfoRawNotifyType =
  | 'subscribe_metadata_updated'
  | 'contact_metadata_updated'
  | 'user_metadata_updated';

/** @internal MessageReceiver 转发给 ChatClient 的用户资料原始 notify。 */
export interface UserInfoRawNotifyEvent {
  readonly notifyType: UserInfoRawNotifyType;
  readonly userId: string;
  readonly metadata: Record<string, unknown>;
  readonly lastModified: number;
}

/** @internal 归一化后的用户资料补丁。 */
export interface UserInfoNotifyPatch {
  readonly userId: string;
  readonly attributes: Partial<UserInfo>;
  readonly lastModified: number;
  readonly source: UserInfoNotifySource;
}

/**
 * [zh-CN] 当前用户整对象更新参数。
 * [en-US] Patch-style update parameters for the current user's profile.
 */
export interface UpdateOwnInfoParams {
  /** [zh-CN] 昵称；传空字符串表示清空。 [en-US] Nickname; pass an empty string to clear it. */
  readonly nickname?: string;
  /** [zh-CN] 头像地址；传空字符串表示清空。 [en-US] Avatar URL; pass an empty string to clear it. */
  readonly avatarUrl?: string;
  /** [zh-CN] 邮箱；传空字符串表示清空。 [en-US] Email; pass an empty string to clear it. */
  readonly mail?: string;
  /** [zh-CN] 手机号；传空字符串表示清空。 [en-US] Phone number; pass an empty string to clear it. */
  readonly phone?: string;
  /** [zh-CN] 性别；`false` / `0` 也是合法值。 [en-US] Gender; `false` and `0` are valid values. */
  readonly gender?: UserInfoAttributeValue;
  /** [zh-CN] 签名；传空字符串表示清空。 [en-US] Signature; pass an empty string to clear it. */
  readonly sign?: string;
  /** [zh-CN] 生日；传空字符串表示清空。 [en-US] Birthday; pass an empty string to clear it. */
  readonly birth?: string;
  /** [zh-CN] 扩展字段；传空字符串表示清空。 [en-US] Extension field; pass an empty string to clear it. */
  readonly ext?: string;
}

/**
 * [zh-CN] 当前用户单属性更新参数模型。
 * [en-US] Data model for updating a single attribute of the current user's profile.
 */
export interface UpdateOwnInfoByAttributeParams {
  /** [zh-CN] 目标属性。 [en-US] Target attribute. */
  readonly attribute: UserInfoAttribute;
  /** [zh-CN] 属性值。 [en-US] Attribute value. */
  readonly value: UserInfoAttributeValue;
}

/** @internal 服务端用户资料属性结构。 */
export interface ServerUserInfoAttributes {
  readonly nickname?: unknown;
  readonly avatarurl?: unknown;
  readonly avatarUrl?: unknown;
  readonly mail?: unknown;
  readonly phone?: unknown;
  readonly gender?: unknown;
  readonly sign?: unknown;
  readonly birth?: unknown;
  readonly ext?: unknown;
}

/** @internal 查询接口真实响应 envelope。 */
export interface UserInfoFetchResponseEnvelope {
  readonly timestamp?: unknown;
  readonly data?: unknown;
  readonly lastModified?: unknown;
  readonly duration?: unknown;
}

/** @internal 更新接口真实响应 envelope。 */
export interface UserInfoUpdateResponseEnvelope {
  readonly timestamp?: unknown;
  readonly data?: unknown;
  readonly lastModified?: unknown;
  readonly duration?: unknown;
}

/** @internal 订阅相关接口真实响应 envelope。 */
export interface UserInfoSubscriptionResponseEnvelope {
  readonly path?: unknown;
  readonly uri?: unknown;
  readonly status?: unknown;
  readonly timestamp?: unknown;
  readonly organization?: unknown;
  readonly application?: unknown;
  readonly entities?: unknown;
  readonly count?: unknown;
  readonly data?: unknown;
  readonly duration?: unknown;
  readonly applicationName?: unknown;
}
