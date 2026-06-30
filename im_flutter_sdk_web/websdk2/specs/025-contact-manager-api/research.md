# 025 研究记录（Phase 0）

## Decision 1: `getContacts()` 继续保持同步快照读取，不走远程 REST

- **Decision**: `ContactManager.getContacts()` 继续直接读取 024 的本地联系人快照，保持同步返回 `ReadonlyArray<Contact>`；本期不新增远程 roster 查询式 `getContacts`。
- **Rationale**: 仓库当前已经把 `getContacts()` 固化为“联系人快照读取入口”。若回退到旧工程远程查询语义，会破坏 024 的缓存/事件模型，也会让调用方在同名方法上承担新的网络时序复杂度。
- **Alternatives considered**:
  - 改为异步 REST 查询：会破坏现有同步语义，并让联系人读取和联系人同步双轨并存。
  - 同时保留同步和异步两个同名/近似名方法：API 心智负担高，且容易让调用方误用。

## Decision 2: 公开层保持 `ContactManager` 单入口，REST 适配下沉到独立模块

- **Decision**: `ContactManager` 作为唯一公开入口，负责参数校验、错误抛出与状态协调；旧工程 REST path、request body 与原始 response 归一化收敛到 `src/rest/contact-management.ts`。
- **Rationale**: 这样可以维持当前 manager 架构的一致性，同时避免把 endpoint/path/body/响应包裹细节直接塞进 `ContactManager`，导致公开门面膨胀。
- **Alternatives considered**:
  - 直接在 `ContactManager` 中拼接所有 REST 请求：实现快，但可读性差，测试也难以按“门面 vs 适配层”分层。
  - 重新引入 connection 风格联系人 API：与本期“ContactManager 唯一入口”的目标冲突。

## Decision 3: 联系人写操作按三类协调策略处理会话内一致性

- **Decision**: 联系人写操作成功后分三类处理：
  - `addContact`、`declineContactInvite` 使用 `noop`
  - `deleteContact`、`setContactRemark` 使用 `local_patch`
  - `acceptContactInvite` 使用 `controlled_refresh`
- **Rationale**: 并非所有联系人写操作都具备足够信息安全地本地补丁。删除与备注修改有明确目标和结果，适合直接修改缓存；接受邀请会新增联系人，但当前成功响应没有稳定完整载荷，更适合复用 024 同步能力做受控刷新。
- **Alternatives considered**:
  - 所有操作都只返回成功、不更新任何本地状态：无法满足“同会话内读取结果一致”的 spec 要求。
  - 所有操作都强制全量刷新：实现统一，但网络成本高，也会让简单 remark/delete 场景变得过重。
  - 接受邀请时本地插入占位联系人：可能制造字段不完整的中间态，且 `addTs` 等字段缺少可信来源。

## Decision 4: 黑名单仅维护会话级内存快照，不新增 localStorage 持久化

- **Decision**: `getBlocklist()` 首次从服务端获取 `UserInfo[]` 并统一补齐 `userInfo`，在 `ContactManager` 内维护当前会话的黑名单快照；`addUsersToBlocklist` 与 `removeUserFromBlocklist` 成功后本地修补这份快照，不新增 localStorage schema。
- **Rationale**: spec 只要求“同一登录会话后续读取一致”，没有要求黑名单跨会话冷启动缓存。保持会话级状态即可满足需求，并避免为当前阶段引入新的持久化 key、迁移和淘汰策略。
- **Alternatives considered**:
  - 每次 `getBlocklist()` 都强制请求服务端：一致性可靠，但重复调用开销更高，也无法在本地快速反映刚成功的写操作。
  - 把黑名单持久化到 localStorage：可以优化冷启动，但会增加 schema、落盘与失效策略复杂度，本期收益不足。

## Decision 5: 联系人/黑名单业务错误进入统一 REST 错误映射体系

- **Decision**: 联系人管理相关的业务错误继续使用现有 `src/rest/api-errors.json` + `src/rest/errors.ts` + `RestBusinessError` 体系，不单独定义联系人专属异常基类。
- **Rationale**: 仓库当前所有 REST 业务错误都通过统一映射层归一化。联系人管理若另起一套异常体系，会让调用方在 Promise reject 的消费上出现分裂，也不利于测试复用。
- **Alternatives considered**:
  - 新建 `ContactError`：会增加认知成本，且与现有 REST 业务错误模式不一致。
  - 对未知错误全走 `REST_BUSINESS_UNKNOWN`：无法把已确认的 `service_resource_not_found + UserNotFoundException` 稳定映射成可诊断错误。

## Decision 6: 服务端包装结构仅保留在契约/fixture 层，不外泄到公开返回

- **Decision**: `uri/timestamp/organization/application/path/action/duration/count/data` 等服务端包装字段只保留在契约文档和测试 fixture 中；对外公开返回仍是 `void`、`UserInfo[]`、`BlocklistAddResult` 等业务对象。
- **Rationale**: Constitution 明确要求 SDK 对外返回业务对象，而不是服务端 HTTP 包装。保留原始 envelope 作为 fixture 与 contract 可以支撑真实结构验证，但不能污染调用方 API。
- **Alternatives considered**:
  - 直接透传原始 envelope：最省实现成本，但违反仓库对外 API 规范。
  - 完全丢弃 envelope 信息：实现可以，但不利于基于真实响应样例编写契约测试和后续排障。
