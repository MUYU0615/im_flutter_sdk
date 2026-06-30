# Research: ChatManager 替换 ChannelManager 并补齐消息域能力

## Decision 1: 保留 `Message.channel`，只替换公开门面与公开命名

- **Decision**: 031 继续保留 `Message.channel`、`ChannelReference` 和底层消息寻址模型，不改协议寻址结构；变更重点放在公开入口与公开 API 语义上。
- **Rationale**:
  - 当前 `Message.channel` 已深入消息创建、发送、上传、接收和协议编解码链路。
  - 用户明确要求迁移到新的 API 风格，而不是重做底层消息寻址。
  - 若同时改寻址模型，会把 031 扩大成协议层重构。
- **Alternatives considered**:
  - 同时重写消息寻址：影响面过大，超出本 feature。
  - 继续保留 `Channel` 公开实体：与收口 `ChatManager` 的目标冲突。

## Decision 2: `ChatManager` 成为消息域唯一公开门面，不拆新的子 manager

- **Decision**: 会话已读、消息已读、群消息已读、撤回、编辑、历史消息、下载、Reaction、置顶、翻译和举报等能力都收拢到 `ChatManager`。
- **Rationale**:
  - 用户要求这些能力迁移到 ChatManager。
  - 它们都以消息或会话定位为核心，属于同一消息域。
  - 现在就拆 `TranslationManager` / `ReactionManager` / `ConversationManager` 会让 031 失去“收口入口”的价值。
- **Alternatives considered**:
  - 按能力拆 manager：理论上更细，但会新增概念并拖慢迁移。
  - 继续挂在 `ChatClient` 或旧 connection 层：无法完成门面收口。

## Decision 3: 公开命名遵循新仓库规范，而不是照搬旧工程方法名

- **Decision**: 对外命名以仓库 Constitution 为准，读取类统一优先 `getXxx`，删除类优先 `removeXxx`，编辑类使用 `updateMessage`，监听仍统一用 `addEventHandler/removeEventHandler`。
- **Rationale**:
  - 旧工程存在 `fetchHistoryMessages`、`modifyMessage`、`deleteReaction`、`getServerPinnedMessages` 等历史命名，不符合当前仓库统一规则。
  - 用户已经允许根据情况调整名称。
  - 命名统一后，后续文档、类型和测试更稳定。
- **Alternatives considered**:
  - 原样保留旧工程命名：迁移更快，但会把历史命名债务直接带入新 SDK。
  - 同时保留新旧两个名称：会扩大公开接口面并增加维护成本。

## Decision 4: `addMessageListener` 需求吸收到统一事件系统，不新增第二套监听 API

- **Decision**: 消息监听继续统一使用 `chatManager.addEventHandler/removeEventHandler`，通过扩展 `ChatEventHandlerMap` 来承接 read/recall/update/reaction/pin 等消息域事件。
- **Rationale**:
  - 当前仓库所有 manager 都使用统一事件系统。
  - 用户说“参考现有功能里其他 manager 注册监听的实现”，说明核心需求是“补监听能力”，不是“换监听范式”。
  - 继续统一事件系统可以减少 demo、类型测试和文档迁移成本。
- **Alternatives considered**:
  - 新增 `addMessageListener/removeMessageListener`：会产生第二套监听心智。
  - 同时支持两套监听方式：灵活，但会增加长期维护成本。

## Decision 5: 成功返回统一业务对象，禁止透传服务端 envelope

- **Decision**: 所有新增能力只返回业务对象、业务列表、分页对象或 `void`，失败统一抛 SDKError；不得直接返回服务端 `code/data/message` 包装。
- **Rationale**:
  - 这是仓库 Constitution 的明确要求。
  - 用户也特别要求“不要把服务端的数据直接返回，内部封装成业务对象”。
  - 这样可以让未来 REST 映射、错误码变更和跨端对齐都留在 SDK 内部处理。
- **Alternatives considered**:
  - 原样透传服务端结构：实现快，但对外 API 不稳定且与现有规范冲突。
  - 返回“业务对象 + 原始响应”双轨结构：会污染对外契约。

## Decision 6: 优先复用现有内部能力，而不是重复造轮子

- **Decision**: 031 实现时应优先复用已有 `ChatClient.sendMessage`、EventHub、合并消息下载解析器、消息格式化链路，以及已经存在的群消息已读业务模型或等价规范化逻辑。
- **Rationale**:
  - 当前仓库已经有 `CombineMessageDownloader` 和群消息已读业务类型。
  - 重复实现会制造语义分叉和测试重复。
  - 031 的价值在于公开收口和业务对象标准化，不在于重复实现底层基础设施。
- **Alternatives considered**:
  - 每个功能单独实现一套新内部逻辑：短期独立，长期更容易分叉。
  - 直接复用旧工程全部 connection 实现：会把历史结构原样带进新仓库。

## Decision 7: 事件扩展采用“动作级 payload”，而不是暴露原始 notify

- **Decision**: 新增 `onMessageRead`、`onConversationRead`、`onMessageRecalled`、`onMessageUpdated`、`onReactionChanged`、`onPinnedMessageChanged` 等业务事件，并使用稳定的业务载荷模型对外暴露。
- **Rationale**:
  - 用户要求“内部封装成业务对象”不仅适用于方法返回值，也适用于事件 payload。
  - 旧工程事件里存在原始字段、兼容字段和协议细节，直接对外暴露会把消息域变得难以维护。
  - 动作级 payload 更适合前端状态管理与跨端对齐。
- **Alternatives considered**:
  - 暴露原始下行 notify：实现快，但违背新 SDK 风格。
  - 只复用 `onMessageStatus`，不新增事件：无法满足用户要补 message listener 能力的目标。

## Decision 8: conversation CRUD 继续延后，031 只补消息域动作与查询

- **Decision**: 031 继续明确不包含 conversation 列表、conversation 删除、未读聚合等会话域能力。
- **Rationale**:
  - 本次用户需求虽然包含 `ackConversationRead`，但它仍属于消息消费后的动作，不代表 conversation 域要同时补齐。
  - 若顺手补 conversation CRUD，范围会明显失控。
  - 当前 spec 已经能把“消息域门面”定义清楚，conversation 可在后续 feature 单独规划。
- **Alternatives considered**:
  - 同期补齐 conversation CRUD：范围过大。
  - 把 `markConversationRead` 也延后：会留下明显消息域空洞。

## Decision 9: 移动端 silent-fail 在 Web SDK 中统一收敛为显式异常或幂等成功

- **Decision**: 对 `ackMessageRead`、`ackGroupMessageRead`、`ackConversationRead` 这类移动端可能返回 `false` 或静默失败的场景，Web SDK 不保留 silent-fail 公开语义，而是统一收敛为“幂等成功”或“抛出归一化错误”。
- **Rationale**:
  - 当前仓库对外 API 已经采用 Promise + 抛错风格。
  - silent-fail 对前端状态排障不友好，也不符合“完善错误码和对应处理”的目标。
  - 这样可以把移动端布尔返回统一升级为可测试的异常契约。
- **Alternatives considered**:
  - 原样返回 `false`：保留历史行为，但不符合新 SDK 风格。
  - 所有失败都静默成功：会吞掉真实错误。

## Decision 10: ChatManager 领域缺失错误码在 Web SDK 中新增常量，并优先沿用移动端数值

- **Decision**: 在 `src/utils/error-codes.ts` 中补齐 ChatManager 领域缺失错误码，并优先使用与移动端一致的数值，作为跨端排障和错误文档的共同参照。
- **Rationale**:
  - 你已经提供了移动端错误矩阵，直接复用数值可以降低跨端对齐成本。
  - 当前 `ERROR_CODES` 已有一部分通过 `api-errors.json` 和自定义常量混用，新增 ChatManager 领域常量不会破坏现有结构。
  - 这可以把 `OPERATION_UNSUPPORTED`、`MESSAGE_RECALL_TIME_LIMIT`、`TRANSLATE_*`、`REACTION_*` 等能力从“文档建议”推进到实现约束。
- **Alternatives considered**:
  - 继续只在文档中描述，不补常量：后续实现和测试会继续分散。
  - 为全部移动端错误码做 1:1 同名镜像：范围偏大，本期先补 ChatManager 用到的集合。
