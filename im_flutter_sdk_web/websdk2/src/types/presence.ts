/**
 * [zh-CN] PresenceManager 对外类型定义，供在线状态 API 调用与文档生成使用。
 * [en-US] Public PresenceManager type definitions used by presence APIs and doc generation.
 */

/**
 * [zh-CN] 单设备在线状态明细。
 * [en-US] Presence details for a single device.
 */
export interface PresenceStatusDetails {
  /** [zh-CN] 设备标识（如 web/mobile）。 [en-US] Device identifier (for example, web/mobile). */
  readonly device: string;
  /** [zh-CN] 设备在线状态值。 [en-US] Presence status value of the device. */
  readonly status: number;
}

/**
 * [zh-CN] 在线状态事件载荷。
 * [en-US] Presence event payload.
 */
export interface PresenceState {
  /** [zh-CN] 状态所属用户 ID。 [en-US] User id that owns this presence state. */
  readonly userId: string;
  /** [zh-CN] 多设备状态明细列表。 [en-US] Presence details across multiple devices. */
  readonly statusDetails: ReadonlyArray<PresenceStatusDetails>;
  /** [zh-CN] 扩展描述字段。 [en-US] Extended description field. */
  readonly ext: string;
  /** [zh-CN] 状态更新时间（毫秒时间戳）。 [en-US] Update time in milliseconds timestamp. */
  readonly lastTime: number;
  /** [zh-CN] 订阅到期时间（毫秒时间戳）。 [en-US] Subscription expire time in milliseconds timestamp. */
  readonly expire: number;
}

/**
 * [zh-CN] 在线状态业务对象（对齐 Android Presence 语义）。
 * [en-US] Presence business object aligned with Android Presence semantics.
 */
export interface PresenceInfo {
  /** [zh-CN] 状态发布者（用户 ID）。 [en-US] Publisher of this presence state (user id). */
  readonly publisher: string;
  /** [zh-CN] 设备状态映射（key 为设备，value 为状态值）。 [en-US] Device-status map (key=device, value=status). */
  readonly statusList: Readonly<Record<string, number>>;
  /** [zh-CN] 扩展描述字段。 [en-US] Extended description field. */
  readonly ext: string;
  /** [zh-CN] 最新更新时间（毫秒时间戳）。 [en-US] Latest update time in milliseconds timestamp. */
  readonly latestTime: number;
  /** [zh-CN] 状态到期时间（毫秒时间戳）。 [en-US] Presence expire time in milliseconds timestamp. */
  readonly expiryTime: number;
}

/**
 * [zh-CN] 订阅/查询在线状态响应。
 * [en-US] Response for subscribe/query presence APIs.
 *
 * @remarks
 * [zh-CN] 数组中的每一项对应一个用户的在线状态；服务端未返回或非法的条目会被 SDK 过滤。
 * [en-US] Each item represents one user's presence; entries missing from the server response or malformed entries are filtered by the SDK.
 */
export type SubscribePresenceResponse = ReadonlyArray<PresenceInfo>;

/**
 * [zh-CN] 已订阅在线状态用户列表响应。
 * [en-US] Response containing subscribed user id list.
 *
 * @remarks
 * [zh-CN] 仅包含用户 ID，不包含在线状态详情；如需详情请调用 `getPresenceStatus`。
 * [en-US] Contains user ids only and does not include presence details; call `getPresenceStatus` for details.
 */
export type SubscribedPresenceListResponse = ReadonlyArray<string>;

/**
 * [zh-CN] 订阅/查询在线状态原始响应（服务端返回）。
 * [en-US] Raw subscribe/query presence response from server.
 */
export interface SubscribePresenceRawResponse {
  /** [zh-CN] 服务端结果列表。 [en-US] Result list returned by server. */
  readonly result?: ReadonlyArray<{
    /** [zh-CN] 服务端用户 ID。 [en-US] User id from server. */
    readonly uid?: string;
    /** [zh-CN] 服务端设备状态映射。 [en-US] Device-status map from server. */
    readonly status?: Record<string, unknown>;
    /** [zh-CN] 服务端扩展字段。 [en-US] Extension field from server. */
    readonly ext?: string;
    /** [zh-CN] 服务端更新时间（毫秒时间戳）。 [en-US] Update time from server in milliseconds timestamp. */
    readonly last_time?: number;
    /** [zh-CN] 服务端到期时间（毫秒时间戳）。 [en-US] Expire time from server in milliseconds timestamp. */
    readonly expiry?: number;
  }>;
}

/**
 * [zh-CN] 订阅列表原始响应（服务端返回）。
 * [en-US] Raw subscribed-list response from server.
 */
export interface SubscribedPresenceListRawResponse {
  /** [zh-CN] 服务端结果对象。 [en-US] Result object returned by server. */
  readonly result?: {
    /** [zh-CN] 订阅条目列表。 [en-US] Subscribed entry list. */
    readonly sublist?: ReadonlyArray<{
      /** [zh-CN] 服务端用户 ID。 [en-US] User id from server. */
      readonly uid?: string;
      /** [zh-CN] 服务端到期时间（毫秒时间戳）。 [en-US] Expire time from server in milliseconds timestamp. */
      readonly expiry?: number;
    }>;
    /** [zh-CN] 服务端总条目数。 [en-US] Total entry count from server. */
    readonly totalnum?: number;
  };
}
