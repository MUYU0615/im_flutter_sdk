/**
 * 会话摘要缓存
 */

import type { ConversationSummary, MessageSnippet } from './cache-types'; // 类型定义
import type { ConversationMark, ConversationType } from '../types/conversation';
import { evictByLru, removeExpired } from './cache-eviction'; // 淘汰工具
import { isRecord } from './cache-utils'; // 工具方法

const normalizeConversationType = (value: unknown): ConversationType | null => {
  if (value === 'single' || value === 'chat' || value === 'singleChat') {
    return 'singleChat';
  }
  if (value === 'group' || value === 'groupchat' || value === 'groupChat') {
    return 'groupChat';
  }
  if (value === 'room' || value === 'chatroom' || value === 'chatRoom') {
    return 'chatRoom';
  }
  return null;
};

const normalizeConversationMarks = (value: unknown): ReadonlyArray<ConversationMark> => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<ConversationMark>();
  const normalized: ConversationMark[] = [];
  const items = value as ReadonlyArray<unknown>;
  for (const item of items) {
    const raw = typeof item === 'string' && item.startsWith('mark_') ? item.slice(5) : item;
    const parsed =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number.parseInt(raw, 10)
          : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 19) {
      continue;
    }
    const mark = parsed as ConversationMark;
    if (seen.has(mark)) {
      continue;
    }
    seen.add(mark);
    normalized.push(mark);
  }
  return normalized;
};

export class ConversationCache { // 会话缓存类
  private items: ConversationSummary[] = []; // 会话列表缓存

  public load(rawItems: ReadonlyArray<ConversationSummary>, now: number): void { // 加载缓存
    const normalized: ConversationSummary[] = []; // 规范化列表
    for (const item of rawItems) { // 遍历原始数据
      const normalizedItem = this.normalizeItem(item, now); // 规范化条目
      if (normalizedItem) { // 校验通过
        normalized.push(normalizedItem); // 追加条目
      } // 校验结束
    } // 遍历结束
    this.items = normalized; // 覆盖缓存
  } // 加载结束

  public getAll(): ReadonlyArray<ConversationSummary> { // 获取全部会话
    return this.items; // 返回缓存列表
  } // 获取结束

  public setAll(items: ReadonlyArray<ConversationSummary>): void { // 覆盖会话列表
    this.items = [...items]; // 写入缓存
  } // 覆盖结束

  public updateLastAccess(conversationIds: ReadonlyArray<{ conversationId: string; type: ConversationType }>, now: number): boolean { // 更新访问时间
    if (conversationIds.length === 0) { // 无需更新
      return false; // 返回未更新
    } // 空列表判断结束
    let changed = false; // 变更标识
    for (const target of conversationIds) { // 遍历目标
      const index = this.findIndex(target.conversationId, target.type); // 查找索引
      if (index < 0) { // 未命中
        continue; // 跳过
      } // 未命中判断结束
      const current = this.items[index]; // 读取当前项
      if (!current) {
        continue;
      }
      if (current.lastAccess === now) { // 时间未变化
        continue; // 跳过
      } // 时间判断结束
      this.items[index] = { // 更新条目
        ...current, // 保留字段
        lastAccess: now, // 更新访问时间
      }; // 更新结束
      changed = true; // 标记变更
    } // 遍历结束
    return changed; // 返回结果
  } // 更新结束

  public removeExpired(ttlMs: number, now: number): boolean { // 过期清理
    const result = removeExpired(this.items, ttlMs, now); // 执行清理
    this.items = [...result.kept]; // 更新缓存
    return result.removed.length > 0; // 返回是否有删除
  } // 过期清理结束

  public evictByLru(removeCount: number): boolean { // LRU 淘汰
    const result = evictByLru(this.items, removeCount); // 执行淘汰
    this.items = [...result.kept]; // 更新缓存
    return result.removed.length > 0; // 返回是否有删除
  } // LRU 淘汰结束

  public trimMax(maxCount?: number): boolean { // 限制最大条数
    if (!maxCount || this.items.length <= maxCount) { // 无需裁剪
      return false; // 返回未裁剪
    } // 判断结束
    const sorted = [...this.items].sort((a, b) => a.lastAccess - b.lastAccess); // 按访问时间排序
    const removeCount = Math.max(this.items.length - maxCount, 0); // 计算需要移除数量
    const removed = sorted.slice(0, removeCount); // 取最旧项
    const removedSet = new Set(removed); // 构建移除集合
    this.items = this.items.filter((item) => !removedSet.has(item)); // 保留剩余项
    return removed.length > 0; // 返回是否有删除
  } // 裁剪结束

  private findIndex(conversationId: string, type: ConversationType): number { // 查找索引
    return this.items.findIndex((item) => item.conversationId === conversationId && item.type === type); // 返回索引
  } // 查找索引结束

  private normalizeItem(item: ConversationSummary, now: number): ConversationSummary | null { // 规范化条目
    if (!item || typeof item !== 'object') { // 校验对象
      return null; // 返回空
    } // 校验结束
    const record = item; // 使用原对象
    if (typeof record.conversationId !== 'string' || record.conversationId.length === 0) { // 校验会话 ID
      return null; // 返回空
    } // 校验结束
    const normalizedType = normalizeConversationType(record.type);
    if (!normalizedType) { // 校验会话类型
      return null; // 返回空
    } // 校验结束
    const lastMessage = this.normalizeMessage(record.lastMessage); // 规范化消息摘要
    return { // 返回规范化结果
      conversationId: record.conversationId, // 会话 ID
      type: normalizedType, // 会话类型
      lastMessage, // 最后消息
      unreadCount: typeof record.unreadCount === 'number' ? record.unreadCount : 0, // 未读数
      isPinned: typeof record.isPinned === 'boolean' ? record.isPinned : undefined, // 是否置顶
      pinnedTime: typeof record.pinnedTime === 'number' ? record.pinnedTime : undefined, // 置顶时间
      marks: normalizeConversationMarks(record.marks), // 会话标记
      lastAccess: typeof record.lastAccess === 'number' ? record.lastAccess : 0, // 访问时间
      lastUpdate: typeof record.lastUpdate === 'number' ? record.lastUpdate : now, // 更新时间
    }; // 返回结束
  } // 规范化结束

  private normalizeMessage(message: MessageSnippet | null): MessageSnippet | null { // 规范化消息摘要
    if (!message || typeof message !== 'object') { // 校验消息
      return null; // 返回空
    } // 校验结束
    if (!isRecord(message)) { // 校验对象结构
      return null; // 返回空
    } // 校验结束
    const msgId = typeof message.msgId === 'string' ? message.msgId : ''; // 读取消息 ID
    const type = typeof message.type === 'string' ? message.type : ''; // 读取类型
    const timestamp = typeof message.timestamp === 'number' ? message.timestamp : 0; // 读取时间戳
    const body = isRecord(message.body) ? message.body : {}; // 读取消息体
    const userInfoUpdateTime =
      typeof message.userInfoUpdateTime === 'number' ? message.userInfoUpdateTime : undefined;
    const namecardUpdateTime =
      typeof message.namecardUpdateTime === 'number' ? message.namecardUpdateTime : undefined;
    if (!msgId) { // 校验消息 ID
      return null; // 返回空
    } // 校验结束
    return { // 返回规范化结果
      msgId, // 消息 ID
      type, // 消息类型
      body, // 消息体
      timestamp, // 时间戳
      userInfoUpdateTime, // 用户资料版本
      namecardUpdateTime, // 群名片版本
    }; // 返回结束
  } // 规范化消息结束
} // 会话缓存结束
