/**
 * 用户信息缓存
 */

import type { UserInfoSummary } from './cache-types'; // 类型定义
import { evictByLru, removeExpired } from './cache-eviction'; // 淘汰工具
import { isRecord } from './cache-utils'; // 工具方法

export class UserInfoCache {
  // 用户信息缓存类
  private readonly items: Map<string, UserInfoSummary> = new Map(); // 用户信息缓存表

  public load(rawItems: ReadonlyArray<UserInfoSummary>, now: number): void {
    // 加载缓存
    this.items.clear(); // 清空旧缓存
    for (const item of rawItems) {
      // 遍历原始数据
      const normalized = this.normalizeItem(item, now); // 规范化条目
      if (!normalized) {
        // 校验失败
        continue; // 跳过
      } // 校验结束
      this.items.set(normalized.userId, normalized); // 写入缓存
    } // 遍历结束
  } // 加载结束

  public getAll(): ReadonlyArray<UserInfoSummary> {
    // 获取全部用户
    return Array.from(this.items.values()); // 返回列表
  } // 获取结束

  public getByIds(
    userIds: ReadonlyArray<string>,
    now: number,
    updateAccess: boolean
  ): ReadonlyArray<UserInfoSummary> {
    // 按 ID 获取用户信息
    const result: UserInfoSummary[] = []; // 初始化结果
    for (const userId of userIds) {
      // 遍历用户 ID
      const item = this.items.get(userId); // 读取缓存
      if (!item) {
        // 未命中
        continue; // 跳过
      } // 未命中结束
      result.push(item); // 追加结果
      if (updateAccess) {
        // 判断是否更新访问时间
        this.items.set(userId, {
          // 更新缓存
          ...item, // 保留字段
          lastAccess: now, // 更新访问时间
        }); // 更新结束
      } // 更新判断结束
    } // 遍历结束
    return result; // 返回结果
  } // 获取结束

  public setAll(items: ReadonlyArray<UserInfoSummary>, now: number): void {
    // 批量写入用户信息
    for (const item of items) {
      // 遍历列表
      const normalized = this.normalizeItem(item, now); // 规范化条目
      if (!normalized) {
        // 校验失败
        continue; // 跳过
      } // 校验结束
      const existing = this.items.get(normalized.userId); // 读取旧值
      const lastAccess = existing?.lastAccess ?? normalized.lastAccess; // 复用访问时间
      this.items.set(normalized.userId, {
        // 写入缓存
        ...normalized, // 规范化字段
        lastAccess, // 更新访问时间
        lastUpdate: normalized.lastUpdate, // 保留服务端更新时间语义
      }); // 写入结束
    } // 遍历结束
  } // 批量写入结束

  public remove(userIds: ReadonlyArray<string>): void {
    // 删除用户信息
    for (const userId of userIds) {
      // 遍历 ID
      this.items.delete(userId); // 删除缓存
    } // 遍历结束
  } // 删除结束

  public removeExpired(
    ttlMs: number,
    now: number,
    protectedUserIds: ReadonlySet<string> = new Set()
  ): boolean {
    // 过期清理
    const allItems = Array.from(this.items.values()); // 读取列表
    const candidates = allItems.filter(item => !protectedUserIds.has(item.userId));
    const result = removeExpired(candidates, ttlMs, now); // 执行清理
    const removedUserIds = new Set(result.removed.map(item => item.userId));
    this.items.clear(); // 清空缓存
    for (const item of allItems) {
      // 重新写入
      if (removedUserIds.has(item.userId)) {
        continue;
      }
      this.items.set(item.userId, item); // 写入缓存
    } // 写入结束
    return result.removed.length > 0; // 返回是否有删除
  } // 过期清理结束

  public evictByLru(
    removeCount: number,
    protectedUserIds: ReadonlySet<string> = new Set()
  ): boolean {
    // LRU 淘汰
    const allItems = Array.from(this.items.values()); // 读取列表
    const candidates = allItems.filter(item => !protectedUserIds.has(item.userId));
    const result = evictByLru(candidates, Math.min(removeCount, candidates.length)); // 执行淘汰
    const removedUserIds = new Set(result.removed.map(item => item.userId));
    this.items.clear(); // 清空缓存
    for (const item of allItems) {
      // 重新写入
      if (removedUserIds.has(item.userId)) {
        continue;
      }
      this.items.set(item.userId, item); // 写入缓存
    } // 写入结束
    return result.removed.length > 0; // 返回是否有删除
  } // LRU 淘汰结束

  public trimMax(maxCount: number, protectedUserIds: ReadonlySet<string> = new Set()): boolean {
    // 控制最大条数
    if (maxCount <= 0 || this.items.size <= maxCount) {
      // 无需裁剪
      return false; // 返回未裁剪
    } // 判断结束
    const allItems = Array.from(this.items.values()); // 读取列表
    const removeCount = Math.max(allItems.length - maxCount, 0); // 计算移除数量
    return this.evictByLru(removeCount, protectedUserIds);
  } // 控制结束

  private normalizeItem(item: UserInfoSummary, now: number): UserInfoSummary | null {
    // 规范化条目
    if (!item || typeof item !== 'object') {
      // 校验对象
      return null; // 返回空
    } // 校验结束
    if (!isRecord(item)) {
      // 校验结构
      return null; // 返回空
    } // 校验结束
    const userId = typeof item.userId === 'string' ? item.userId : ''; // 读取用户 ID
    if (!userId) {
      // 校验用户 ID
      return null; // 返回空
    } // 校验结束
    const nickname = typeof item.nickname === 'string' ? item.nickname : undefined; // 读取昵称
    const avatarUrl = typeof item.avatarUrl === 'string' ? item.avatarUrl : undefined; // 读取头像
    const sign = typeof item.sign === 'string' ? item.sign : undefined; // 读取签名
    const ext = typeof item.ext === 'string' ? item.ext : undefined; // 读取扩展
    const userInfoUpdateTime =
      typeof item.userInfoUpdateTime === 'number' ? item.userInfoUpdateTime : undefined;
    const lastSyncAt = typeof item.lastSyncAt === 'number' ? item.lastSyncAt : undefined;
    return {
      // 返回规范化结果
      userId, // 用户 ID
      nickname, // 昵称
      avatarUrl, // 头像
      sign, // 签名
      ext, // 扩展
      userInfoUpdateTime, // 用户资料版本
      lastSyncAt, // 最近同步时间
      lastAccess: typeof item.lastAccess === 'number' ? item.lastAccess : 0, // 访问时间
      lastUpdate: typeof item.lastUpdate === 'number' ? item.lastUpdate : now, // 更新时间
    }; // 返回结束
  } // 规范化结束
} // 用户信息缓存结束
