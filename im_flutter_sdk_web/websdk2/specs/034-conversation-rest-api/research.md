# 034 研究结论（Phase 0）

## 1. 会话 mutation 后的一致性策略

**Decision**: 延续旧 `websdk` 风格，conversation mutation 成功后默认只返回标准化 REST 结果，不立即 patch 当前会话列表；默认一致性机制由调用方按需复用 `getConversationList()` 主动刷新。

**Rationale**:

- 已核对旧 `websdk` 的 `deleteConversation`、`pinConversation`、`addConversationMark`、`removeConversationMark`、`pinMessage`、`unpinMessage` 流程，主行为是返回 REST 结果，而不是立刻改本地会话列表真相。
- 当前 `websdk2` 只有登录后 `cache + server` 同步链路，没有一套成熟的本地 mutation patch 机制；如果在 034 中临时引入，会让会话同步真相变得不一致。
- 对外显式要求“操作后如需立即一致就主动刷新”，比偷偷内部刷新更可控，也更符合已澄清决策。

**Alternatives considered**:

- mutation 成功后立即 patch 当前会话列表：被否决。虽然交互更即时，但需要重新定义 patch 真相、失败回滚与 notify 竞争关系，超出本期范围。
- mutation 成功后自动内部调用 `getConversationList()`：被否决。会增加隐式网络请求与状态不透明，不符合“默认由调用方主动刷新”的澄清结论。

## 2. Conversation cache schema 升级范围

**Decision**: 034 必须同步升级 conversation cache schema，使缓存 / 落盘层与公开 DTO 统一使用 `singleChat/groupChat/chatRoom`，并将 `marks` 纳入 `ConversationItem` 的稳定缓存字段；旧 `single/group/room` 数据在读取阶段做兼容迁移。

**Rationale**:

- 当前 `src/cache/cache-types.ts`、`ConversationCache`、`CacheManager` 仍以 `single/group/room` 为真相，与 034 的公开 canonical naming 冲突。
- 若只在公开层做映射、缓存层不改，会形成“公开 DTO / 内部兼容层 / 落盘层”三套命名并存，后续 feature 会继续反复支付转换成本。
- `marks` 属于会话摘要稳定语义，若只存在于服务端返回、不落缓存，会导致缓存读出的摘要与服务端摘要字段集合不一致。

**Alternatives considered**:

- 仅在 API 输出阶段映射命名，不改缓存：被否决。会继续放大 DTO 与缓存真相分叉。
- 本期只升级命名，不升级 `marks`：被否决。spec 已明确 `ConversationItem` 需要稳定包含 `marks`。

## 3. Cache migration 策略

**Decision**: 在 conversation cache 读取阶段执行“宽读窄写”迁移：读取旧值时接受 `single/group/room`，立即归一化为 `singleChat/groupChat/chatRoom` 的内存真相；后续 flush 一律按新 schema 写回。迁移失败时跳过损坏条目并保留其他有效数据，不因单条坏数据导致整个列表加载失败。

**Rationale**:

- 当前 `ConversationCache.normalizeItem()` 已是会话缓存的唯一入口，天然适合承接兼容读取。
- 该策略不需要单独跑一次全量 migration 任务，也不会阻塞 `ChatClient.login()` 主路径。
- “损坏条目跳过 + 保留其余条目”符合当前 cache 模块已存在的容错风格。

**Alternatives considered**:

- 登录后先做一次全量 schema rewrite：被否决。实现复杂度更高，且增加登录路径时延。
- 迁移失败直接清空 entire conversation cache：被否决。容错过于粗暴，会不必要地丢失仍可用的本地会话摘要。

## 4. Conversation REST 模块边界

**Decision**: 034 的最终收敛目标是把会话主线从 `src/apis/index.ts` 迁入独立的 `src/rest/conversation-management.ts`，并配套新增 conversation normalize / repository / sync helper；`src/apis/index.ts` 最多作为短期过渡封装，不再作为长期实现真源。

**Rationale**:

- 当前 `src/apis/index.ts` 同时承担上游 path 拼装、字段归一化与内部同步基线，不符合当前仓库 manager -> rest -> normalize 的分层风格。
- `PushManager`、`ChatRoomManager` 等后续 feature 已明确采用 `rest/` 模块承接 upstream 适配，034 应与之保持一致。
- 若未来要补 conversation marks、pinned message、clear all、by mark 等更多 endpoint，继续堆在 `src/apis/index.ts` 会让债务进一步扩大。

**Alternatives considered**:

- 保留 `src/apis/index.ts` 不动，只在 `ChatManager` 外包一层：被否决。无法真正收敛旧结构。

## 5. Thread 域建模

**Decision**: 新增 `ChatThreadManager + ChatThread`，其中 manager 负责列表、创建、句柄获取与事件注册，`ChatThread` 负责单 thread 上下文方法；thread 事件通过专属 handler map 对外暴露，同时进入全局 typed event system。

**Rationale**:

- thread 是独立资源域，而不是 conversation summary 的嵌套字段。
- 该模型与 `ChatRoomManager + ChatRoom`、`GroupManager + Group` 的现有组织方式一致，易于复用仓库已有规范。
- 用户已澄清 `ChatThreadManager` 应使用专属 handler map，这与 conversation/chat 通用 handler 面隔离更清晰。

**Alternatives considered**:

- 把 thread 全部混入 `ChatManager`：被否决。会让 manager 语义过于膨胀，且 thread 生命周期与会话列表不同。
- 只做全局事件，不做 thread 专属 handler map：被否决。违背已澄清决策。

## 6. Thread 事件 typing 策略

**Decision**: 保留事件名 `onChatThreadChange`，通过 `change` 联合类型表达 `created/updated/destroyed/joined/left/memberRemoved` 等具体变化；对外不透传旧 `operation` 原始字段。

**Rationale**:

- 统一事件名可降低调用方监听成本，变化细节交由 `change` 区分。
- 旧 `operation` 文本缺乏类型约束，且与公开 SDK 风格不一致。
- 该策略兼容 “进入全局 EventPayloadMap” 与 “thread 专属 handler map” 双重要求。

**Alternatives considered**:

- 为每种 thread 变化单独拆成多个事件名：暂不采用。虽然更细，但当前旧 `websdk` 主要以统一事件承载，034 先完成 typed 收口即可。

## 7. Real sample / fixture 策略

**Decision**: contract 与测试必须优先使用旧 `websdk` 的真实请求 / 响应样例来源；若某个 endpoint 当前缺乏完整样例，则只在 contract 中承诺已确认的最小公开字段，并在 unit / integration 中使用等价 fixture 覆盖标准化逻辑。

**Rationale**:

- Constitution 明确禁止在缺样例时凭猜测固化 API 解析。
- 当前已确认的旧工程参考包括：
  - `../websdk/packages/IM/sdk/src/apis/index.ts`
  - `../websdk/packages/IM/sdk/src/apis/threadApi.ts`
  - `../websdk/packages/IM/sdk/src/apis/silentModeApi.ts`
  - `../websdk/packages/IM/sdk/src/handleMessages/handleNotify.ts`
  - `../websdk/packages/IM/sdk/src/handleMessages/handleMucMsg.ts`
- 034 的 contract 需要显式标记哪些 path 是 SDK-facing 逻辑契约，哪些 upstream path 仍待 fixture 落地验证。

**Alternatives considered**:

- 直接把旧源码中的推测字段全写进 contract：被否决。风险过高。

## 8. PushManager 归属

**Decision**: conversation silent mode 不迁入 `ChatManager`，继续由 `PushManager` 拥有；034 只在整体规划、quickstart 与 contract 说明中把它纳入会话相关 scope。

**Rationale**:

- `021-push-manager` 已经完成新的规则模型与公开 API 收口。
- 若在 034 中改 owner，会平白引入 breaking change，并破坏当前 demo 与测试基线。
- 用户已澄清本期会话相关 scope 覆盖 silent mode，但不代表要改 manager 归属。

**Alternatives considered**:

- 将 silent mode 迁入 `ChatManager`：被否决。会造成职责回退。
