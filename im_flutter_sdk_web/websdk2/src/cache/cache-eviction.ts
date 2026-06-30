/**
 * 缓存淘汰工具
 */

export interface EvictionResult<T> { // 淘汰结果结构
  readonly kept: ReadonlyArray<T>; // 保留项
  readonly removed: ReadonlyArray<T>; // 移除项
} // 淘汰结果结构结束

export const removeExpired = <T extends { lastUpdate: number }>(
  items: ReadonlyArray<T>, // 待处理列表
  ttlMs: number, // TTL 毫秒
  now: number // 当前时间
): EvictionResult<T> => { // 过期清理
  if (ttlMs <= 0) { // TTL 无效
    return { kept: items, removed: [] }; // 直接返回
  } // TTL 判断结束
  const kept: T[] = []; // 保留列表
  const removed: T[] = []; // 移除列表
  for (const item of items) { // 遍历列表
    if (now - item.lastUpdate > ttlMs) { // 判断过期
      removed.push(item); // 追加移除
    } else { // 未过期
      kept.push(item); // 追加保留
    } // 过期判断结束
  } // 遍历结束
  return { kept, removed }; // 返回结果
}; // 过期清理结束

export const evictByLru = <T extends { lastAccess: number }>(
  items: ReadonlyArray<T>, // 待处理列表
  removeCount: number // 移除数量
): EvictionResult<T> => { // LRU 淘汰
  if (removeCount <= 0 || items.length === 0) { // 无需淘汰
    return { kept: items, removed: [] }; // 返回原列表
  } // 无需淘汰判断结束
  const sorted = [...items].sort((a, b) => a.lastAccess - b.lastAccess); // 按访问时间排序
  const removed = sorted.slice(0, removeCount); // 取最旧项
  const removedSet = new Set(removed); // 构建移除集合
  const kept = items.filter((item) => !removedSet.has(item)); // 过滤保留项
  return { kept, removed }; // 返回结果
}; // LRU 淘汰结束
