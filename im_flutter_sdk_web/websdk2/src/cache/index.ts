/**
 * 缓存模块导出
 */

export { CacheManager } from './cache-manager'; // 导出缓存管理器
export { GroupNamecardCache } from './group-namecard-cache'; // 导出群名片缓存
export { SessionListCache } from './session-list-cache';
export type {
  // 导出缓存类型
  CacheConfig, // 缓存配置
  CacheMetadata, // 缓存元信息
  CacheDump, // 缓存落盘结构
  ContactCacheIntegrity, // 联系人缓存完整性
  ContactCacheIncompleteReason, // 联系人缓存不完整原因
  ContactCacheMeta, // 联系人缓存元信息
  ContactRelationRecord, // 联系人关系记录
  ContactSyncMode, // 联系人同步模式
  ContactVersionSource, // 联系人版本来源
  ContactVersionState, // 联系人版本状态
  ConversationSummary, // 会话摘要
  ConversationListUpdatePayload, // 会话列表更新载荷
  ConversationListUpdatePatch, // 会话列表更新补丁
  ConversationListUpdateReason, // 会话列表更新原因
  GroupNamecardCacheRecord, // 群名片缓存
  MessageSnippet, // 消息摘要
  SessionListCacheRecord,
  SessionListCapabilityState,
  SessionListCheckpoint,
  UserInfoSummary, // 用户信息摘要
} from './cache-types'; // 类型来源
export type { ConversationType } from '../types/conversation';
