# 研究结论（Phase 0）

本文件用于记录本地缓存模块的关键决策、理由与备选方案。

## 决策 1：不做容量估算，改为超限清理重试

- **Decision**: 不计算缓存 size 或可用容量，写入触发 `QuotaExceededError` 时执行 TTL + LRU 清理并仅重试一次。
- **Rationale**: 容量估算在浏览器环境难以准确，直接处理超限错误更可靠且实现更简单。
- **Alternatives considered**: 预估 80% 可用容量（依赖估算易失准）、预估 70%/90%（更保守或风险更高）。

## 决策 2：会话缓存优先级高于用户信息缓存

- **Decision**: 容量不足时优先保留会话摘要（包含 lastMessage），优先淘汰用户信息缓存。
- **Rationale**: 会话列表直接影响首屏与主要交互体验，用户信息可在需要时补拉。
- **Alternatives considered**: 均等淘汰（可能导致首屏体验退化）。

## 决策 3：不缓存会话消息列表

- **Decision**: 本地只缓存会话摘要中的 lastMessage，不缓存会话消息列表。
- **Rationale**: 降低存储占用与淘汰复杂度，避免 localStorage 频繁写入导致卡顿。
- **Alternatives considered**: 缓存最近 20 条（占用更高且写入频繁）、按容量动态条数（实现复杂度更高）。

## 决策 4：批量读写 + 异步节流

- **Decision**: 所有缓存写入进入队列，采用批量 flush（空闲或节流时机）避免阻塞主线程。
- **Rationale**: localStorage 同步写入可能卡顿，批量与节流可降低主线程压力。
- **Alternatives considered**: 每次立即写入（实现简单但 UI 风险高）。

## 决策 5：过期丢弃机制（TTL）

- **Decision**: 缓存记录超出 TTL 后不可返回，并在访问时清理。
- **Rationale**: 防止缓存长期陈旧导致体验误导。
- **Alternatives considered**: 仅依赖 LRU（无法保证数据新鲜度）。

## 决策 6：同步更新机制

- **Decision**: 本地缓存用于首屏展示，服务端同步完成后覆盖并回写缓存。
- **Rationale**: 保障首屏速度，同时以服务端为最终真相。
- **Alternatives considered**: 仅使用缓存（数据一致性风险高）。
