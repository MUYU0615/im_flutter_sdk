/**
 * 缓存 key 生成工具
 */

export const CACHE_KEY_PREFIX = 'IMSDK'; // 缓存 key 前缀

export const CacheKeyName = {
  // 缓存 key 名称常量
  CONVERSATIONS: 'conversationMap', // 会话摘要缓存
  USER_INFO: 'userInfoMap', // 用户信息缓存
  GROUP_NAMECARD: 'groupNamecardMap', // 群名片缓存
  CONTACT_RELATIONS: 'contactRelationMap', // 联系人关系缓存
  CONTACT_VERSION: 'contactVersion', // 联系人版本状态缓存
  CONTACT_META: 'contactMeta', // 联系人元信息缓存
  SESSION_LIST: 'sessionListMap', // 新会话列表缓存
  SESSION_LIST_CHECKPOINT: 'sessionListCheckpoint', // 新会话列表 checkpoint
  JOINED_GROUP_PREVIEW: 'joinedGroupPreview', // 已加入群组预览缓存
  METADATA: 'metadata', // 元信息缓存
} as const; // 常量断言结束

export type CacheKeyName = (typeof CacheKeyName)[keyof typeof CacheKeyName]; // 缓存 key 名称类型

export interface CacheKeyContext {
  // key 构建上下文
  readonly appKey: string; // appKey
  readonly userId: string; // 用户 ID
  readonly schemaVersion: number; // 结构版本
} // key 构建上下文结束

export const buildCacheKey = (context: CacheKeyContext, name: CacheKeyName): string => {
  // 构建缓存 key
  return `${CACHE_KEY_PREFIX}_${context.appKey}_${context.userId}_${name}_v${context.schemaVersion}`; // 拼接 key
}; // 构建缓存 key 结束
