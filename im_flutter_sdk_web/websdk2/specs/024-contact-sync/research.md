# 024 研究记录（Phase 0）

## Decision 1: 登录后先查版本元数据，再决定同步路径

- **Decision**: 联系人自动同步开启后，登录流程先调用联系人版本元数据接口；再基于“服务端判定结果 + 本地 `cacheIntegrity`”决定跳过同步、增量同步或强制全量同步。
- **Rationale**: 单纯依赖本地版本号会遗漏“本地缓存不完整但版本相同”的场景；单纯依赖本地完整性又会导致每次登录都走全量。两者组合后，既能减少不必要同步，又能避免联系人结果缺字段。
- **Alternatives considered**:
  - 只看服务端版本元数据：无法处理本地 `userInfo` 已淘汰导致联系人结果不完整的问题。
  - 每次登录都直接全量同步：实现简单，但冷启动成本高，也违背版本号设计初衷。

## Decision 2: `nickname/avatarUrl` 不双存，联系人缓存增加完整性标记

- **Decision**: 持久化层不在联系人域重复保存 `nickname/avatarUrl`；联系人域仅保留关系字段、同步元信息和完整性标记，展示时在运行时与 `userInfo` 缓存合并。
- **Rationale**: 仓库当前缓存预算有限（localStorage 约 5MB），双存展示字段会挤占其他缓存空间；而完整性标记可以解决“联系人关系还在，但展示资料缺失”的冷启动判断问题。
- **Alternatives considered**:
  - 在联系人域冗余保存 `nickname/avatarUrl`：展示更稳，但空间成本高，且维护两份真值会增加一致性成本。
  - 完全依赖 `userInfo` 且不记录完整性：一旦 `userInfo` 淘汰，冷启动无法判断联系人是否可直接展示。

## Decision 3: 联系人同步使用独立 protobuf websocket，会话结束即关闭

- **Decision**: 联系人自动同步使用独立 websocket 与自定义 protobuf 协议；仅在同步阶段建立链路，同步完成或失败后立即关闭。
- **Rationale**: 联系人同步与主消息链路职责不同，不应把联系人协议混进现有 `msync`；而联系人同步又不是长期订阅型业务，完成即关闭可控制资源占用。
- **Alternatives considered**:
  - 复用现有 `msync` 连接：会把联系人协议语义耦合进主消息分发链路，增加复杂度。
  - 建立常驻第二条 websocket：能减少下次重建成本，但会长期占用连接和心跳资源，不符合当前需求。

## Decision 4: 联系人协议仿照 `msync` 采用静态 protobuf 产物

- **Decision**: 新增 `src/protocol/roster/proto-source.json` 与 `src/protocol/roster/proto.ts`，通过脚本生成静态描述文件，并复用现有 `static-proto-adapter` 与 `ProtoCodecRegistry` 机制。
- **Rationale**: 仓库当前已经明确采用静态 protobuf 方案，避免运行时动态解析带来的平台兼容与构建不确定性；联系人协议应遵循同一套机制，降低维护成本。
- **Alternatives considered**:
  - 运行时直接解析 `.proto` 文本：实现直观，但与当前静态产物方案冲突，也不利于小程序/跨平台兼容。
  - 手写 encode/decode：可控性高，但协议演进成本过高，且与现有协议模块风格不一致。

## Decision 5: 全量/增量分页统一由 session 层处理

- **Decision**: `roster-sync-session` 负责维护当前同步上下文（version、cursor、responseType、requestId、page count），统一处理分页续拉、全量覆盖和增量合并。
- **Rationale**: 把分页状态放在 codec 或 manager 层都容易导致职责混乱；session 层更适合承载“本轮同步生命周期内的临时状态”。
- **Alternatives considered**:
  - 放在 `ContactManager`：会把对外 API 门面和内部分页状态耦合在一起。
  - 放在 cache 层：cache 应只关心持久化和内存状态，不适合管理 websocket 会话。

## Decision 6: 联系人新增通知只推进版本，不直接假设本地已完整

- **Decision**: 当外部通知带来新的联系人版本号时，只更新“已知最新版本”线索，不直接假设本地联系人结果已完整；真正的数据追平仍需依赖后续同步。
- **Rationale**: 新增通知只说明版本变化，不能保证客户端已拿到本次新增联系人的完整资料。
- **Alternatives considered**:
  - 收到新版本立即认为本地可展示：可能出现联系人计数已变但详情未到齐的中间态。
  - 忽略版本通知：会让后续同步无法更快发现版本落后。
