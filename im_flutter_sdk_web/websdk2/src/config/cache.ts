/**
 * 缓存模块配置常量
 */

export const CACHE_SCHEMA_VERSION = 1; // 缓存结构版本
export const CACHE_TTL_SECONDS = 60 * 60 * 24; // 默认 TTL（24 小时）
export const CACHE_FLUSH_INTERVAL_MS = 1000; // 默认 flush 间隔（毫秒）
export const CACHE_MAX_USER_INFO_COUNT = 1000; // 用户信息默认最大条数
export const CACHE_MAX_GROUP_NAMECARD_COUNT = 1000; // 群名片默认最大条数
export const CACHE_EVICTION_USER_INFO_RATIO = 0.2; // 用户信息淘汰比例
export const CACHE_EVICTION_GROUP_NAMECARD_RATIO = 0.2; // 群名片淘汰比例
export const CACHE_EVICTION_CONVERSATION_RATIO = 0.05; // 会话摘要淘汰比例
export const CACHE_EVICTION_MIN_BATCH = 1; // 最小淘汰数量
