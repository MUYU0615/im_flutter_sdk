# 027 研究结论（Phase 0）

## 1) GroupManager 作为群组域唯一公开入口

- **Decision**: 所有旧 `groupApi.ts` 的群组域能力统一下沉到 `GroupManager`，不保留 connection 风格公开 API 或别名。
- **Rationale**: 仓库当前已形成 manager 作为公开门面的主架构；若 group 继续保留 connection 层入口，会让 027 成为唯一一个逆行模块。
- **Alternatives considered**:
  - 保留一层 connection 兼容别名：迁移期更平滑，但会长期污染公开 API 面。
  - 把群能力塞入 `ChannelManager`：会混淆会话抽象与群管理抽象，职责边界不清。

## 2) 公开命名与批量参数收敛

- **Decision**: 列表查询统一使用 `getXxxList`，allowlist 取代 whitelist，成员/黑名单/allowlist/禁言等用户集合写接口统一使用 `userIds: string[]`。
- **Rationale**: 027 的主要价值之一就是移除旧命名与单/多用户双轨；如果继续保留 `username/usernames`、single/multi API 和白名单旧词，迁移不会真正完成。
- **Alternatives considered**:
  - 兼容保留旧参数名：短期少改代码，但文档、类型与测试都要长期双维护。
  - 某些接口保留单用户快捷入口：会让 API 规律被破坏，调用方仍需记忆例外。

## 3) 对象化用户补齐统一复用 UserInfoManager

- **Decision**: 原本只返回 `userId` 的群接口与群事件统一复用 `UserInfo` 作为用户对象；先读缓存，缺失时批量调用 `fetchUserInfoByUserId`，失败时回退最小 `UserInfo`。
- **Rationale**: 仓库在 025/026 已经形成稳定的资料补齐模式；GroupManager 直接复用这条链路，风险最低，行为最一致。
- **Alternatives considered**:
  - 群域单独定义 `User` 类型：会和现有 `UserInfo` 视图重复造型。
  - 读取类接口返回对象、事件仍只给字符串：调用体验分裂，事件层仍需业务自行补资料。

## 4) 事件名按 Web SDK 规范收敛，事件载荷保持 Web 对象化语义

- **Decision**: 群事件采用 Web SDK 收敛后的多事件模型，如 `onInvitationReceived`、`onRequestToJoinReceived`、`onGroupDestroyed`、`onAllowListAdded`、`onMembersJoined`、`onGroupInfoChanged` 等；事件载荷中用户相关字段使用 `UserInfo` 或对象数组，而不是纯字符串签名。
- **Rationale**: 这样既覆盖移动端的群事件业务语义，又能按 Web SDK 命名规范移除 `WhiteList`、单数成员事件、`Specification` 等旧命名，并保持联系人域已经建立起来的对象化返回原则。
- **Alternatives considered**:
  - 仅保留一个 `onGroupEvent` 总入口：统一性强，但与移动端事件模型不一致。
  - 完全照抄移动端参数签名：会让 Web 事件再次退回纯 ID 模型，与你本次“返回对象”的要求冲突。
  - 同时提供移动端原始签名和 Web 对象化签名两套事件：灵活，但公开面会膨胀。

## 5) 群对象类事件采用“必要时补拉详情”的策略

- **Decision**: `onGroupInfoChanged` 与 `onGroupDisabledChanged` 返回完整标准化群对象；若 MUC 原始事件不足以组装完整对象，则在派发前受控补拉一次群详情。
- **Rationale**: 这两类事件语义上需要完整 `GroupDetail` 视图。若只给 patch，后续很容易再次分裂成“有些群事件给完整对象，有些只给片段”。
- **Alternatives considered**:
  - 只返回事件原始 patch：网络最省，但对调用方最不稳定。
  - 总是补拉详情：对象最完整，但所有事件都增加网络成本，不符合性能目标。

## 6) MUC 事件解码沿用现有 msync codec 模式扩展

- **Decision**: 参考当前 `RosterBody -> ContactEventName` 的实现方式，在 `src/protocol/msync/codec.ts` 内增加 `MUCBody` 解码与 operation->GroupEvent 映射，再通过 `message-receiver` / `EventHub` 派发。
- **Rationale**: 现有联系人事件已验证“编解码层 -> EventHub -> Manager”的链路是可维护的；GroupManager 重用该模式，能减少新事件系统引入的结构性风险。
- **Alternatives considered**:
  - 在 `ChatClient` 内直接解析 MUC 并派发：实现快，但会把编解码和业务映射耦合进入口类。
  - 在 GroupManager 内直接订阅原始包：会让 manager 侵入协议层。

## 7) 未确认 REST 返回结构前，只定义逻辑契约，不拍板 envelope 字段

- **Decision**: 在 plan 阶段先定义 SDK 逻辑契约与待确认 upstream endpoint 列表；未获得真实样例前，不对群列表/详情、管理员列表、禁言列表、黑名单、allowlist、公告、共享文件列表、成员属性读取等接口的 envelope 做具体字段承诺。
- **Rationale**: Constitution 明确要求 REST 解析基于真实样例；这类接口数量多、旧工程也存在多种返回变体，提前猜字段只会放大返工。
- **Alternatives considered**:
  - 按旧工程现有调用直接猜返回结构：推进更快，但违反仓库规则。
  - 等所有样例齐全再写计划：会阻断当前 Speckit 流程，收益不高。
