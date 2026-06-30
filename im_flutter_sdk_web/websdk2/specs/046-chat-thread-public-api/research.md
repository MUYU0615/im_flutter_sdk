# 046 研究记录（Phase 0）

## Decision 1: ChatThread 公开化以治理公开 surface 为主

- **Decision**: 本期不新增服务端 Thread 能力，不新增缓存；以当前 `ChatThreadManager`、`ChatThread`、REST adapter 和 MUC Thread 通知链路为基础，补齐公开导出、类型、JSDoc、API Reference、错误码、文档、demo 和测试。
- **Rationale**: 当前代码已有 manager、entity、REST、demo 和测试，但文档入口、JSDoc、错误码和事件模型仍处于半公开状态。正式公开的主要风险是用户可见契约不稳定。
- **Alternatives considered**:
  - 重写 Thread 模块：工作量大，且当前 REST 主路径已有基础。
  - 只补文档不改事件：会继续暴露 `onChatThreadChange + operation`，与用户和移动端对齐要求冲突。

## Decision 2: 事件只公开移动端对齐的 4 个事件

- **Decision**: 公开事件只包含 `onChatThreadCreated`、`onChatThreadDestroyed`、`onChatThreadUpdated`、`onChatThreadUserRemoved`。
- **Rationale**: 用户明确要求与移动端 `EMChatThreadChangeListener` 对齐。移动端只提供创建、解散、更新、当前用户被移出 4 类事件。
- **Alternatives considered**:
  - 公开名称更新和消息更新两个事件：更细，但与移动端 `onChatThreadUpdated` 不一致。
  - 公开成员加入/退出事件：原工程存在相关分支，但移动端 Thread 变更监听不公开这些事件。
  - 保留 `onChatThreadChange + operation`：接入成本低，但不符合最终要求。

## Decision 3: 旧 onChatThreadChange 不公开也不派发

- **Decision**: `onChatThreadChange` 仅作为历史/内部聚合模型参考，不进入公开事件 handler map，不进入 API Reference，也不对用户 handler 派发。
- **Rationale**: 正式公开前移除旧模型可以避免用户依赖 `operation` 分支，降低 API Reference 和测试矩阵复杂度。
- **Alternatives considered**:
  - 双派发并标记 deprecated：兼容性更强，但会造成重复事件和长期维护负担。
  - API Reference 隐藏但运行时派发：最危险，用户可能依赖未文档化行为。

## Decision 4: Thread raw notify 保持内部输入

- **Decision**: MUC Thread 原始通知类型继续作为内部输入处理，归一后只派发 4 个公开事件。
- **Rationale**: 原始通知字段来自服务端/原工程模型，包含 `id`、`name`、`muc_parent_id`、`operation` 等旧命名；公开层应统一为 websdk2 当前命名。
- **Alternatives considered**:
  - 公开 raw notify 类型：调试方便，但把协议细节泄漏为公开契约。
  - 删除 raw notify 类型：实现上仍需要内部输入建模，直接删除不现实。

## Decision 5: 原工程 threadApi.ts 作为 REST 对照来源

- **Decision**: REST 请求路径、参数校验、分页默认值、批量上限和字段归一对照 `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/threadApi.ts`。
- **Rationale**: 原工程已经覆盖 create/join/leave/destroy/changeName/getMembers/removeMember/getJoined/getList/getLastMessage/getDetail 等 Thread API，能减少猜测。
- **Alternatives considered**:
  - 只信当前 websdk2 实现：可能保留迁移时的字段遗漏。
  - 只信文档：当前 `docs/integration/thread.md` 已发现过期示例。

## Decision 6: 原工程 handleMucMsg.ts 只作为事件来源参考

- **Decision**: 对照原工程 Thread MUC 操作来源，但公开映射按移动端 4 事件收敛。
- **Rationale**: 原工程 `handleMucMsg.ts` 使用 `onChatThreadChange + operation` 和多设备分支，不等于 websdk2 最终公开 API。
- **Alternatives considered**:
  - 完整复刻原工程事件：与用户要求冲突。
  - 完全不参考原工程：容易漏掉服务端操作码与字段来源。

## Decision 7: 错误码使用 api-errors.json + localErrors

- **Decision**: 每个 Thread REST operation 都在 `src/rest/api-errors.json` 维护服务端业务错误；本地参数校验错误通过同 operation 下的 `localErrors.<publicMethod>` 维护。
- **Rationale**: 这是仓库对 REST 服务端错误和 API Reference 错误表的唯一结构化来源。
- **Alternatives considered**:
  - 在 JSDoc `@throws` 里维护错误码：违反仓库规则。
  - 只列通用错误：API Reference 对用户帮助不足，也不能覆盖本地校验。

## Decision 8: API Reference 完整公开 ChatThread manager/entity/types

- **Decision**: API Reference 生成入口纳入 `src/managers/chat-thread-manager.ts`、`src/managers/chat-thread/chat-thread.ts`、`src/types/chat-thread.ts`，并覆盖主入口和 `./managers/chat-thread` 子路径导出。
- **Rationale**: `package.json` 已有 `./managers/chat-thread` 子路径导出。包可导入但文档找不到会造成公开 surface 不一致。
- **Alternatives considered**:
  - 只在主入口 API Reference 展示：无法解释子路径导入。
  - 只公开 manager 不公开 entity：当前 SDK 已有对象化 manager 模式，且 `ChatThread` 已存在。

## Decision 9: 文档示例必须以类型测试或等价校验兜底

- **Decision**: 修正 `docs/integration/thread.md` 后，需要通过类型测试、文档示例测试或 API Reference 生成检查确保示例不再包含不存在的方法/参数/事件字段。
- **Rationale**: 当前文档已有 `thread.getDetail()`、`userId`、`event.operation` 等与实现不一致内容。
- **Alternatives considered**:
  - 人工审查文档：容易回归。
  - 只依赖 API Reference：集成文档仍可能过期。
