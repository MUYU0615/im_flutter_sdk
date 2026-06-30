# SDK 内部完全面向对象架构收敛计划

## 背景

当前仓库的 manager 设计整体仍以“公开门面 + REST 编排 + 事件分发 + DTO 归一化”为主：

- `src/managers/group-manager.ts` 已经引入 `Group`，但当前 `Group` 主要是薄 façade，真正的状态、REST 编排、用户补齐和错误处理仍集中在 manager。
- `src/managers/chatroom-manager.ts` 与 `src/managers/chatroom/chatroom.ts` 延续了与 group 类似的“manager + 轻量对象”模式。
- `src/managers/contact-manager.ts`、`src/managers/user-info-manager.ts` 仍是典型的 service-style manager，对内没有明确的领域对象边界。

这套设计对外 API 比较稳定，但内部演进空间有限：状态、事件、补齐、映射和对象职责没有彻底分层，后续继续扩展 manager 时，复杂度会持续堆在公开门面上。

本计划的目标不是立即改公开 API，而是先确立一个可以在多个模块复用的内部架构方向：SDK 内部逐步收敛为“领域对象 + 仓库 + 领域服务 + DTO 适配层”，对外继续提供 plain data 风格 API 与轻量 public handle。

## 目标

1. 在 SDK 内部建立统一的领域模型范式，使 group、chatroom、contact、user-info 后续演进不再各自发散。
2. 保持 Web SDK 对外 API 的 plain data 语义稳定，避免把内部状态对象直接暴露给调用方。
3. 把“状态真相”“对象行为”“REST 适配”“事件同步”“DTO 导出”拆成清晰层次，减少 manager 膨胀。
4. 先在最适合试点的模块上落地，再逐步同步到其他模块，而不是一次性全仓切换。

## 非目标

1. 本计划阶段不直接改公开 API 形态，不把列表 API 改成返回富对象数组。
2. 本计划阶段不承诺一次性把所有 manager 都重写完。
3. 本计划阶段不引入“读属性自动请求网络”的伪同步对象模型。
4. 本计划阶段不把内部领域对象直接暴露给 SDK 调用方。

## 核心判断

### 1. 对外继续 plain data 是必要的

- Web SDK 的调用方普遍会把列表、详情、事件 payload 放进前端 state、缓存和序列化链路。
- `GroupSummary`、`GroupDetail`、`ChatRoomSummary` 这类 plain data 更适合做快照和 diff。
- 如果直接把内部对象暴露出去，调用方会自然期待“对象属性随事件自动变化”，这会把内部状态语义泄漏到公开 API。

### 2. 内部彻底 OO 是可行的

- 领域对象可以承担状态聚合、补丁合并、失效标记、行为封装和跨事件一致性。
- repository 可以提供 identity map，解决“同一个 groupId/chatRoomId 对应多个实例”的状态分叉问题。
- manager 可以收缩成 application facade，只负责参数校验、错误归一化和公开入口组织。

### 3. `group` 应作为第一阶段试点

- `group` 已经具备 `GroupManager + Group` 的边界雏形，迁移成本最低。
- `group` 同时覆盖列表、详情、成员、事件、用户补齐，足够验证内部对象模型是否站得住。
- `chatroom` 与其同构度高，group 试点成功后最容易复制。

## 目标架构

### 一、内部领域层

- `InternalGroup` / `InternalChatRoom` / `InternalContact` / `InternalUserProfile`
- 负责维护单实体已知状态、加载状态、脏标记、事件 patch 合并、领域行为入口
- 不直接处理 HTTP 请求细节，不负责公开 DTO 映射

### 二、仓库层

- `GroupRepository` / `ChatRoomRepository` / `ContactRepository` / `UserProfileRepository`
- 负责 identity map、对象复用、批量加载、缓存协调、失效控制
- repository 是内部对象的唯一获取入口，避免外部直接 `new InternalXxx()`

### 三、领域服务层

- `GroupDomainService` / `ChatRoomDomainService` / `ContactDomainService`
- 负责跨对象流程、复杂 mutation 编排、需要多 gateway 协作的操作
- 避免把大块业务流程继续堆到 manager 或领域对象内部

### 四、基础设施层

- `group-rest-gateway.ts`、`chatroom-rest-gateway.ts`、`contact-rest-gateway.ts`、`user-info-rest-gateway.ts`
- `group-event-sync.ts`、`chatroom-event-sync.ts`、`contact-event-sync.ts`
- 负责协议/REST 访问、原始响应归一化、原始事件转内部 patch，不直接定义公开业务语义

### 五、公开适配层

- `GroupManager` / `ChatRoomManager` / `ContactManager` / `UserInfoManager`
- `Group` / `ChatRoom` 等 public handle 继续保留，但仅作为绑定 ID 的轻量公开句柄
- `GroupSnapshotMapper` / `ChatRoomSnapshotMapper` / `ContactSnapshotMapper`
- 对外只暴露 DTO 或 public handle，不暴露内部实体引用

## 关键规则

1. 内部对象是真相，外部 DTO 是快照。
2. 公开列表 API 一律返回 plain data，不返回内部对象。
3. 公开 `getXxx(id)` 返回的是 public handle，不等于内部实体本身。
4. 内部对象不能偷偷持有公开层回调或 UI 状态。
5. 任何会触发网络访问的能力都必须是显式异步方法，不能伪装成本地 getter。
6. 事件进入后优先更新内部对象，再由 mapper 导出公开 payload。
7. repository 必须有清晰的生命周期策略，避免 identity map 无界增长。

## 推荐目录演进

```text
src/
├── domain/
│   ├── group/
│   │   ├── internal-group.ts
│   │   ├── group-repository.ts
│   │   ├── group-domain-service.ts
│   │   ├── group-snapshot-mapper.ts
│   │   └── group-event-sync.ts
│   ├── chatroom/
│   ├── contact/
│   └── user-info/
├── managers/
│   ├── group-manager.ts
│   ├── chatroom-manager.ts
│   ├── contact-manager.ts
│   └── user-info-manager.ts
├── rest/
│   ├── group-rest-gateway.ts
│   ├── chatroom-rest-gateway.ts
│   ├── contact-rest-gateway.ts
│   └── user-info-rest-gateway.ts
└── types/
    ├── group.ts
    ├── chatroom.ts
    ├── contact.ts
    └── user-info.ts
```

说明：

- 是否真正新建 `src/domain/`，可以在 group 试点阶段再定；若担心目录改动过大，也可以先放在 `src/managers/<domain>/internal/` 下过渡。
- 目录可以渐进迁移，但职责边界必须一次定义清楚。

## 模块落地策略

### Phase 0：架构基线与试点约束

目标：

- 先把统一规则写清楚，避免各模块实现时再次发散。
- 明确 repository、internal entity、snapshot mapper、public handle 的职责边界。
- 明确“哪些模块需要对象实体，哪些模块优先以关系/快照为核心”。

产出：

- 本计划文档
- 后续 group 试点 spec/plan
- 领域对象命名与分层约定

### Phase 1：Group 试点

目标：

- 把 `GroupManager` 从“大型编排类”收缩为 facade。
- 把现有 `Group` 从薄 façade 升级为 public handle，背后接到 `InternalGroup + GroupRepository`。
- 事件同步改为“先更新内部对象，再导出 payload”。

范围：

- `src/managers/group-manager.ts`
- `src/managers/group/group.ts`
- `src/managers/group/*`
- `src/types/group.ts`
- group 相关 tests / docs / spec artifacts

成功标准：

- 列表 API 继续返回 `GroupSummary[]`
- `getGroup(groupId)` 继续可用
- manager 中的 hydration、patch、详情补拉、实例复用逻辑转移到 repository / mapper / event sync
- 对外行为无非预期 breaking change

### Phase 2：抽取可复用抽象

目标：

- 从 group 试点中抽出可共享模式，而不是复制粘贴到 chatroom。
- 明确哪些抽象应该复用，哪些应保持领域定制。

候选抽象：

- entity state + stale marker 模式
- repository identity map 模式
- snapshot mapper 约定
- event patch 合并约定
- user info hydrate 协作约定

限制：

- 不要过度提炼成一个“万能 base class”
- 优先共享接口和模式，不优先共享复杂继承体系

### Phase 3：ChatRoom 同构迁移

目标：

- 复用 group 试点成熟模式，把 chatroom 迁到同一内部架构。
- 保持 `ChatRoomManager + ChatRoom` 的对外形态稳定，但内部改成对象真相驱动。

重点：

- 聊天室事件 patch 模型
- 与 group 同构的成员/管理员/禁言/allowlist 行为
- 详情补拉和列表快照导出

### Phase 4：Contact / UserInfo 收敛

目标：

- 不强行照搬 group/chatroom 的单实体句柄模式，而是根据领域特点设计内部对象。
- `UserInfoManager` 更偏“资料实体仓库 + 属性更新服务”。
- `ContactManager` 更偏“关系对象 + 同步控制 + roster 事件聚合”。

建议：

- `UserInfo` 内部可抽象为 `InternalUserProfile`
- `Contact` 内部优先考虑 `InternalContactRelation`，而不是只做用户对象别名
- `ContactManager.getContacts()` 继续返回 plain data 快照，不急于引入公开 `Contact` handle

### Phase 5：Chat 域评估

目标：

- 在 group/chatroom/contact/user-info 稳定后，再评估 chat/message/conversation 是否进入同一方向。
- 避免在会话模型尚未定稿前，过早引入内部 conversation 实体。

## 决策边界

### A. public handle 与内部实体分离

明确禁止：

- 让 `groupManager.getGroup(id)` 直接返回 `InternalGroup`
- 让列表项直接持有可执行方法
- 让事件 payload 直接暴露内部实体引用

### B. DTO 导出必须是单向的

- 内部对象可以导出 `GroupSummary` / `GroupDetail`
- 外部 DTO 不应反向回灌为内部对象实例
- 如果需要 patch，只能通过 repository / domain service 执行

### C. 事件更新优先内部一致性

- 原始事件进入后先定位实体
- 能直接 patch 的直接 patch
- 信息不足时标记 stale 或触发受控补拉
- 最后再派发公开事件

### D. 用户资料补齐从“调用时补齐”逐步演进为“对象层协作”

- 当前 manager 内分散的 hydrate 逻辑应逐步下沉
- 但不要求一步到位把所有 `UserInfo` 都变成重对象
- 先把“资料缺口补齐”收敛为可复用的 repository 协作模式

## 风险

1. 内部对象与公开 DTO 语义混淆，导致对外 API 无意中泄漏状态模型。
2. repository 生命周期不清晰，导致 identity map 常驻增长或陈旧对象难以回收。
3. 事件顺序与 REST 拉取结果竞争，导致内部状态被旧快照覆盖。
4. 为了复用而过早抽象，最终形成难维护的通用基类体系。
5. contact/user-info 领域特性与 group/chatroom 不完全同构，直接复制模式会失真。

## 验证策略

本计划本身不涉及实现代码，但后续每个试点 feature 都必须显式覆盖以下验证：

- 单元测试：repository、snapshot mapper、event patch merge、状态失效逻辑
- 集成测试：manager facade 与 repository / gateway / event hub 协作
- 类型测试：public handle、DTO、manager 导出边界
- E2E：仅在影响 demo 主路径时评估和补充

group 试点额外要求：

- 列表返回保持 plain data
- `getGroup(groupId)` 行为保持兼容
- 事件 payload 不回退为内部对象引用

## 032 试点落地进展（2026-04-22）

当前 `032-group-internal-oo-pilot` 已完成的模式验证：

- group 域已在 `src/managers/group/internal/` 下落地 `InternalGroup + GroupRepository + GroupSnapshotMapper + GroupEventSync`
- `GroupManager` 公开 facade 与 `Group` public handle 继续保持不变，列表仍返回 plain data 快照
- 同一 `groupId` 的列表、详情、事件和 handle 读取已经围绕同一 runtime 真相协作
- 会话切换、`onUserRemoved` / `onGroupDestroyed`、主动 `group.leave()` / `group.destroy()` 已接入 runtime 清理
- 关键事件链路已验证“先收敛 internal runtime，再导出公开 payload”，并在成员类事件上落地了 `memberCount` 增量 patch

后续模块承接约束：

- `033-chatroom-internal-oo-alignment` 应优先复用 repository identity map、snapshot mapper、event sync、runtime invalidation 四个模式
- `034-contact-userinfo-domain-alignment` 应复用“internal truth / external snapshot”边界，但不强制复制 `Group`/`ChatRoom` 式 public handle
- 后续模块默认沿用 `stale` 与 `delete runtime` 分离策略，避免把所有失效都退化为一次性补拉

## 后续拆分建议

建议按以下顺序继续写正式 feature spec：

1. `032-group-internal-oo-pilot`
2. `033-chatroom-internal-oo-alignment`
3. `034-contact-userinfo-domain-alignment`

如果 032 试点结果不理想，应先复盘并调整统一规则，再继续 033/034，而不是硬推到所有模块。

## 当前结论

这个方向可行，但必须坚持两条底线：

1. 内部对象化，不等于对外富对象化。
2. 先试点、再抽象、再复制，不做全仓一次性重写。

按当前仓库现状，最合理的执行顺序是：先用 group 验证模式，再同步 chatroom，最后处理 contact/user-info。
