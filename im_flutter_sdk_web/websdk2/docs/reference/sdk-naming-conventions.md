# SDK 对外 API 命名规范

## 目标

本文档用于统一 Web SDK 对外 API 的命名风格，并作为跨端对齐时的参考基线。

核心结论：

- 事件回调优先使用 `onXxx`、`onXxxChange`、`onXxxStatusChange`
- 不建议把时态写进事件名，如 `onXxxReceived`、`onXxxUpdated`、`onXxxChanged`
- 获取列表默认使用 `getXxxList`
- 查询条件优先放进 `params` 对象，不把 `WithCursor` 这类传输细节写进方法名
- `ByXxx` 只在“确实需要区分不同主查询键”时使用

## 为什么建议其他端参考 Web 命名

相比“按各端习惯各自命名”，Web 这套命名更适合作为跨端统一基线，原因有四点：

1. 语义更稳定。事件名描述的是“订阅什么事件”，不是“内部动作已经完成到哪一步”，因此不容易随着实现细节变化而改名。
2. 扩展性更好。查询条件收敛到 `params` 后，后续新增 `cursor`、`pageSize`、`filters` 不需要持续膨胀方法名。
3. 可读性更强。`getConversationList` 比 `getConversations` 更明确表达“这是列表查询”；`onPresenceStatusChange` 比 `onPresenceStatusChanged` 更像事件主题。
4. 更符合 TypeScript/JavaScript SDK 的主流表达。Web 用户更习惯“事件主题 + 参数对象”的形式，而不是“方法名里编码完整过程”。

因此，跨端统一时建议优先统一“命名语义模型”，再处理历史 API 兼容，而不是继续保留平台各自的语言习惯差异。

## 直接结论

| 场景         | 推荐                                      | 不推荐                                  | 原因                                         |
| ------------ | ----------------------------------------- | --------------------------------------- | -------------------------------------------- |
| 单条消息事件 | `onStreamMessage`                         | `onStreamMessagesReceived`              | 单次回调载荷是一条消息，命名应与载荷粒度一致 |
| 状态变化事件 | `onPresenceStatusChange`                  | `onPresenceStatusChanged`               | 事件名表达“变化主题”，不是过去时结果         |
| 会话列表更新事件 | `onConversationListUpdate`                | `onConversationUpdated`                 | `ConversationList` 明确载荷是列表快照，`Update` 更适合作为事件主题名 |
| 分页列表查询 | `getConversationList`                     | `getConversations`                      | `List` 能稳定表达列表/分页语义               |
| 带游标分页   | `getConversationList({ cursor })`         | `getConversationListWithCursor(cursor)` | `cursor` 是参数，不是资源类型                |
| 主键维度区分 | `getMessageById` / `getMessageByServerId` | 滥用 `ByXxx`                            | 只有存在多个主查询键时才需要写进方法名       |
| 强制远端拉取 | `fetchUserInfoByUserId`                 | 所有查询都叫 `fetchXxx`                 | `fetch` 应只用于强调“主动拉远端/绕过缓存”    |

## 命名原则

### 1. 事件名描述“订阅主题”，不要描述“完成时态”

推荐：

- `onMessage`
- `onStreamMessage`
- `onConversationListUpdate`
- `onPresenceStatusChange`

不推荐：

- `onMessageReceived`
- `onStreamMessagesReceived`
- `onConversationUpdated`
- `onPresenceStatusChanged`

原因：

- 事件回调本质上是订阅入口，命名应回答“你会收到哪类事件”。
- 过去时命名通常隐含“内部处理已经完成”，但 SDK 回调触发时机未必能稳定承诺这一点。
- 过去时会让名称更长，且不同端容易出现 `Receive/Received`、`Update/Updated`、`Change/Changed` 混用。

### 2. 单复数由“单次回调载荷”决定

如果单次回调传入的是单个对象，优先使用单数：

```ts
onStreamMessage(message: StreamMessage): void
```

只有当单次回调明确传入数组/批量集合时，才使用复数：

```ts
onMessages(messages: ReadonlyArray<Message>): void
```

因此，流式消息场景若当前一次只派发一条分片消息，应使用 `onStreamMessage`，而不是 `onStreamMessagesReceived`。

### 3. `get` 是默认查询前缀，`fetch` 只用于强调远端拉取

推荐约定：

- `getXxx`：对外标准读接口，返回归一化后的业务结果
- `fetchXxx`：显式强调“主动请求远端”或“绕过缓存”

例如当前仓库里：

- `getPresenceStatus`
- `getSubscribedPresenceList`
- `getConversationSilentMode`
- `fetchUserInfoByUserId`

`fetchUserInfoByUserId` 之所以合理，是因为它表达的不是普通读快照，而是一次主动远端拉取。

### 4. 获取列表默认用 `getXxxList`，不是 `getXxxs`

这是本文档的明确推荐。

推荐：

- `getConversationList`
- `getSubscribedPresenceList`
- `getChannelList`

不推荐：

- `getConversations`
- `getSubscribedPresences`
- `getChannels`

原因：

1. `List` 明确表达“返回的是列表结果”，尤其适合分页、游标和排序场景。
2. 复数名词在 SDK 中语义容易漂移，既可能表示“所有对象集合”，也可能表示“当前页结果”。
3. 后续如果返回值从 `T[]` 演进成 `{ list, cursor }` 或 `PageResult<T>`，`getXxxList` 仍成立，而 `getXxxs` 会显得含糊。
4. 跨语言沟通时，`List` 比英文复数更稳定，尤其适合文档、测试名、接口对照表统一。

补充约定：

- 新增对外列表查询 API，默认统一用 `getXxxList`
- 已经发布的历史 API 如果是同步访问器且兼容成本高，可以暂时保留，但不再作为新增接口标准

### 5. 参数条件优先放到 `params`，不要把传输细节写进方法名

推荐：

```ts
getConversationList({
  cursor,
  pageSize,
  remindType,
});
```

不推荐：

```ts
getConversationListWithCursor(cursor, pageSize);
getConversationListByRemindTypeWithCursor(remindType, cursor, pageSize);
```

原因：

- `cursor`、`pageSize`、`filters` 属于查询条件，不是资源种类。
- 条件一旦增多，方法名会爆炸。
- `params` 对象更适合类型演进、默认值、可选项扩展和跨端保持一致。

### 6. `ByXxx` 只在需要区分“查询主键”时使用

推荐使用 `ByXxx` 的场景：

- `getMessageById`
- `getMessageByServerId`
- `fetchUserInfoByUserId`

不推荐使用 `ByXxx` 的场景：

- `getConversationListByCursor`
- `getPresenceStatusByUsernames`

判断标准：

- 如果 `Xxx` 代表资源身份维度，且确实存在多个查询入口，需要保留 `ByXxx`
- 如果 `Xxx` 只是普通筛选条件或分页条件，应放进 `params`

## 当前仓库中的落地参考

当前仓库里已经有几类可作为基线的命名：

- 事件类：`onStreamMessage`、`onConversationListUpdate`、`onPresenceStatusChange`
- 列表类：`getSubscribedPresenceList`、`getConversationListByRemindType`
- 状态类：`getPresenceStatus`、`getGlobalSilentMode`
- 显式远端拉取类：`fetchUserInfoByUserId`

说明：

- `onStreamMessage`、`onConversationListUpdate`、`onPresenceStatusChange` 体现了“事件主题化命名”
- `getSubscribedPresenceList`、`getConversationListByRemindType` 体现了“列表查询优先 `List`”
- `fetchUserInfoByUserId` 体现了“只有确实强调远端获取时才使用 `fetch`”

历史上仓库里也存在 `getChannels()` 这类同步访问器命名。随着 `ChannelManager` 下线，这类命名不再作为公开推荐；如果从零设计或推动跨端统一，仍建议优先采用 `getChannelList` 这一类更稳定的公开命名。

## 跨端统一建议

如果其他端当前使用的是：

- `onStreamMessagesReceived`
- `onConversationUpdated`
- `onPresenceStatusChanged`
- `getConversations`
- `getConversationListWithCursor`

建议统一收敛为：

- `onStreamMessage`
- `onConversationListUpdate`
- `onPresenceStatusChange`
- `getConversationList`
- `getConversationList({ cursor })`

迁移策略建议：

1. 新 API 直接采用本文规范，不再新增另一套风格。
2. 历史 API 可先保留别名，但文档、示例、测试、类型定义优先展示新名字。
3. 跨端对齐时优先统一“语义和参数结构”，再逐步去掉旧命名。
4. 如果必须保留平台兼容层，兼容层应放在适配层，不应继续污染新的公开主 API。

## 最终推荐

面向后续新增 API，本项目建议采用以下标准：

- 事件回调：`onXxx` / `onXxxChange`
- 单条流式消息回调：`onStreamMessage`
- 列表查询：`getXxxList`
- 状态/配置查询：`getXxxStatus` / `getXxxMode`
- 强制远端拉取：`fetchXxx`
- 主键区分：必要时使用 `ByXxx`
- 分页/筛选/游标：放进 `params` 对象

如果要给跨端统一命名一个最简短的执行口径，可以直接使用下面这句：

> 事件名用主题名，不用过去时；列表查询用 `getXxxList`，不用 `getXxxs`；查询条件进 `params`，不要写进方法名。
