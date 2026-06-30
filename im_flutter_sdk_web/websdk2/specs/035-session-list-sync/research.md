# 035 研究记录（Phase 0）

## Decision 1: 不新增 ConversationManager，继续收口到 ChatManager

- **Decision**: 新会话列表能力不新增 `ConversationManager`，而是在现有 `ChatManager` 上增加 `getSessionList()` 与 `refreshSessionList()`，并沿用 `addEventHandler/removeEventHandler` 暴露同步事件。
- **Rationale**: `031-chat-manager-replace-channel` 已明确 `ChatManager` 是消息/会话域主门面；此时再拆 `ConversationManager` 会直接推翻既有收口方向，并引入新的对外入口和导出面复杂度。
- **Alternatives considered**:
  - 新增 `ConversationManager`：语义更聚焦，但与 031 的既有设计冲突，且需要重新梳理 manager 注册、导出与 demo 入口。
  - 把新会话列表直接挂在 `ChatClient`：调用链短，但会破坏 manager 分层，不利于后续事件与缓存职责归属。

## Decision 2: 新旧会话列表并行存在，旧逻辑只作为新能力回退来源

- **Decision**: 保留现有 `getConversationList/getPinnedConversationList/getConversationListByMark` 与旧 conversation cache；新增 `SessionItem` 体系与 session-list 专用缓存，仅在新能力失败或不可用时把旧会话列表映射为 `SessionItem`。
- **Rationale**: 用户明确要求新旧能力并行，且“仅会话列表回退”；直接替换旧逻辑会放大风险，无法支撑灰度与真实环境回退。
- **Alternatives considered**:
  - 直接替换旧会话列表：实现表面更干净，但失去回退抓手，也会破坏 034 已交付主路径。
  - 让新旧共用一份缓存真相：会导致新旧排序、字段与来源语义互相污染，回退边界也会变模糊。

## Decision 3: getSessionList 纯读缓存，refreshSessionList 才触发网络

- **Decision**: `getSessionList()` 固定为纯缓存读取、同步返回；`refreshSessionList()` 才主动触发 WSS 同步，并返回 `Promise<ReadonlyArray<SessionItem>>`。
- **Rationale**: 这是最清晰的调用语义，调用方可以明确区分“拿本地可用值”和“等待网络最新值”；同时也能避免像旧 `getConversationList()` 那样把“读取”和“请求”混在同一语义里。
- **Alternatives considered**:
  - `getSessionList()` 隐式触发网络：API 名字会误导调用方，也会把同步读变成隐藏异步副作用。
  - 只保留 `refreshSessionList()`：业务无法低成本读取当前缓存，登录后主页面首屏能力也会变差。

## Decision 4: 同一登录周期对 unsupported/unconfigured 只探测一次

- **Decision**: `refreshSessionList()` 默认优先尝试新链路；但若本登录周期内已确认“服务端不支持新协议”或“未配置同步链路”，则后续 `refreshSessionList()` 不再重复探测，直到下次重新登录。
- **Rationale**: 这同时满足了用户“主动刷新优先试新链路”的接入期诉求，以及 `.doc` 中“服务端不支持时一次探测后回退、不反复报错”的稳定性要求。
- **Alternatives considered**:
  - 每次 refresh 都重新探测：实现简单，但会在 unsupported 环境产生持续错误与无意义延迟。
  - 一旦失败永久禁用：会把临时网络错误与真实 unsupported 混为一谈，恢复粒度过粗。

## Decision 5: refreshSessionList 并发调用复用同一个 Promise

- **Decision**: 同一时刻多次调用 `refreshSessionList()` 时，复用当前在途同步任务，返回同一个 Promise，不重复发起新的 WSS 请求，也不重复派发开始事件。
- **Rationale**: 用户已经确认希望第二次调用直接复用在途结果；这也是最符合 `.doc` “命中已在同步中时不重复 start 回调”的实现方式。
- **Alternatives considered**:
  - 第二次调用直接报错：业务还得显式处理“正在同步中”，可用性差。
  - 第二次调用直接返回缓存：会让调用方误以为拿到了刷新后的结果，语义不一致。

## Decision 6: session-list 使用专用 cache schema/key，不复用旧 conversation cache 真相

- **Decision**: 新增 session-list 专用缓存和 `sessions_last_sync_ts` checkpoint；旧 conversation cache 继续服务旧会话列表与 034 主链路，两者不共享同一份持久真相。
- **Rationale**: `SessionItem` 的字段、排序、回退语义和来源都与旧 `ConversationSummary` 不同；若共用同一缓存，会导致 schema 迁移、回退和排序语义非常难收敛。
- **Alternatives considered**:
  - 直接扩展旧 conversation cache：迁移成本看似低，但会让新旧字段语义混杂，后续维护最难。
  - 完全不持久化 session-list：刷新后丢失登录前真相，不满足“从缓存中读取 SessionItem 列表”的要求。

## Decision 7: SessionItem 顶层展示字段固定为 conversationName / conversationAvatar

- **Decision**: `SessionItem` 不再公开 `display` 或 `profile` 投影，顶层直接提供 `conversationName` 与 `conversationAvatar`，供单聊、群聊、聊天室列表展示统一消费。
- **Rationale**: 用户明确要求“去掉 display，改成增加 conversationName conversationAvatar”；顶层字段与当前会话列表 UI 消费更直接，也避免 `displayName/avatarUrl` 与会话字段形成重复命名。
- **Alternatives considered**:
  - 保留 `display` 并额外增加顶层字段：表面兼容，但会让同义字段重复，业务不清楚该消费哪一份。
  - 仅保留 `display`：与最新公开字段要求冲突，且不符合现有会话列表返回结构调整方向。

## Decision 8: SessionMessageSnippet 仅暴露会话列表最小字段

- **Decision**: `SessionItem.lastMessage` 固定为 `SessionMessageSnippet`，至少暴露 `msgServerId`、`from`、`to`、`sender`、`timestamp`、`body`；可在链路能提供时补充 `conversationId`、`conversationType`、`type`、`status`、`direct`；`body` 内不得包含 `type` 字段。`from` 与 `sender.userId` 使用 userId，服务端 `from.name` 需截取 `_` 后面的内容；`sender.nickname` / `sender.avatarUrl` 随联系人资料或订阅用户资料更新；服务端缺省 `to` 时由当前用户、`from` 与 `conversationId` 推断。
- **Rationale**: 用户明确要求 `lastMessage` 符合当前消息结构，`body` 里没有 `type` 字段，并补齐 `from/to/sender`。最小字段仍足以支撑列表展示，同时避免把完整消息对象耦合到新会话列表公开面。
- **Alternatives considered**:
  - 直接复用完整公开 `Message`：字段过重，也会让会话列表与消息域对象过度耦合。
  - 只保留 message 文本：不足以覆盖图片、语音、自定义消息等列表展示场景。

## Decision 9: SessionListRemindType 采用 Push/REST 字符串枚举

- **Decision**: 协议层保留 remindType 数值语义，SDK 对外统一映射为 `DEFAULT | ALL | AT | NONE` 的 `SessionListRemindType`，与 Push/REST remindType 保持一致。
- **Rationale**: 用户已明确选择会话列表、群组与 REST/Push 设置处保持同一组公开字面值；同时保留 session-list 专用类型名并与 `session_type` 一样做协议分层，可以避免把协议数字直接暴露给业务。
- **Alternatives considered**:
  - 使用 `default | mentionOnly | mute`：能表达部分会话语义，但会与 REST/Push API 的 `ALL | AT | NONE | DEFAULT` 不一致。
  - 对外直接暴露数值：对业务不友好，也不符合本仓库“类型即文档”的原则。

## Decision 10: session-list WSS 链路复用 024 transport 心智，但保持独立业务上下文

- **Decision**: 会话列表同步在实现上复用 `024-contact-sync` 已有的 transport 思路，包括独立 WSS、request_id、批次接收、终态关闭、错误码分支与短任务模型；但 session-list 保持独立 controller/session/context，不直接混入 roster 同步状态。
- **Rationale**: 024 已经落地了“独立同步 websocket + controller/session + 错误语义”的成熟模式，直接复用心智能减少重复发明；同时会话列表与联系人同步的数据模型、checkpoint 和回退规则不同，必须保持业务隔离。
- **Alternatives considered**:
  - 完全重写一套 transport：会复制 024 已有复杂度，收益低。
  - 直接与 024 共用同一个 session/controller：业务语义不同，状态耦合风险过高。

## Decision 11: WSS 与 MSync 并发时以“更晚更新时间 + 完整快照终态”收敛

- **Decision**: 新消息、新会话创建、置顶/标记/未读与免打扰变化，在 WSS 同步期间继续正常进入本地；完整快照结束后以“更晚更新时间优先 + 删除延后到完整快照统一收敛”为准则得到最终真相。
- **Rationale**: `.doc` 已明确要求同步期间收到的 MSync 事件不能破坏 WSS 流程，同时最终结果必须与完整快照和更晚本地事实一致。
- **Alternatives considered**:
  - 同步期间冻结所有 MSync 会话更新：能简化实现，但会让在线消息和实时列表状态变迟钝。
  - 完整快照无条件覆盖 MSync 本地事实：会把同步期间更新过的新消息和未读数回滚掉。

## Decision 12: demo 采用“旧面板保留 + 新面板并行展示”

- **Decision**: demo 保留现有 `ConversationPanel`，同时新增 `SessionListPanel` 并行展示 `SessionItem` 列表、同步开始/结束日志和主动刷新入口。
- **Rationale**: 用户明确要求保留旧面板；并行展示既利于迁移对照，也方便验证“新能力失败只回退会话列表、不影响旧面板和其他路径”。
- **Alternatives considered**:
  - 直接替换旧面板：验证回退与对照会更困难。
  - 只保留调试日志不做新面板：不利于实际浏览器点击验证，也无法体现 `conversationName` / `conversationAvatar` 的最终消费方式。
