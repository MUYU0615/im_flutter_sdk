# 027 GroupManager 测试回填计划

## 背景

当前 027 `GroupManager` 已有部分单元测试、类型测试、事件测试与一条 mock 公开入口回归，但按 `specs/027-group-manager-api/tasks.md` 的测试分层要求，仍缺少成体系的回填，尤其是：

- `tests/integration/group-manager/` 专用集成测试文件尚未落地
- `tests/contract/group-manager.contract.test.ts` 尚未落地
- 现有单元测试对部分公开 API、参数校验、旧命名移除、对象化返回、顺序保持与失败回退覆盖不足
- 现有类型测试对 manager 注册方式、旧别名不可见、更多对象化返回类型约束覆盖不足

## 目标

按 027 既有 spec/plan/tasks 的约束，补齐以下测试层：

1. 单元测试
2. mock 集成测试
3. 专项集成测试
4. 契约测试
5. 类型回归测试

本次优先从单元测试开始，分层推进；每层完成后执行对应验证，再进入下一层。

## 范围

### 单元测试

- `tests/unit/managers/group-manager.test.ts`
  - 核心公开 API 参数校验
  - `acceptGroupInvite/rejectGroupInvite` 不允许外部传 `invitee`
  - 旧别名不可见/不再走公开路径
  - 成员、管理员、黑名单、allowlist、禁言对象化返回
  - 去重、顺序保持、资料补拉失败回退
  - 高阶 API 的 Promise 主语义与统一错误模型
- `tests/unit/managers/group.test.ts`
  - `Group` 与 `GroupManager` 职责边界
  - 更多单群 façade 委托覆盖
  - 单群参数绑定与边界校验
- `tests/unit/rest/group-management.test.ts`
  - `createGroup`、`getGroupInfo`、`updateGroupInfo`、`changeGroupOwner`
  - `destroyGroup`、`leaveGroup`、`joinGroup`
  - 共享 `userIds` 归一化、分页对象、布尔接口和高阶接口的 endpoint/body/query 组装

### mock 集成测试

- `tests/integration/mock/manager-public-api.test.ts`
  - `client.use(GroupManager)` 入口回归
  - `ChatClient.init({ managers: [GroupManager] })` 入口回归
  - `groupManager.getGroup(groupId)` 主路径
  - 典型对象化读取与错误映射回归

### 专项集成测试

- `tests/integration/group-manager/group-manager.integration.test.ts`
  - `client.groupManager` 主路径
  - 基础 mutation
  - 分页读取
  - UserInfoManager/CacheManager 协作
  - 资料补拉失败不吞主结果
- `tests/integration/group-manager/group-events.integration.test.ts`
  - GroupManager 事件注册
  - MUC event -> GroupManager payload
  - 必要时群详情补拉

### 契约测试

- `tests/contract/group-manager.contract.test.ts`
  - 群列表、群详情、基础 mutation
  - 成员/管理员/黑名单/allowlist/禁言 endpoint 逻辑契约
  - 公告、共享文件、成员属性等高阶 endpoint 的结构约束与样例占位

### 类型测试

- `tests/types/group-manager-types.test.ts`
  - `client.use(GroupManager)` / `client.groupManager`
  - `groupManager.getGroup(groupId): Group`
  - `ReadonlyArray<string>` 批量入参
  - 对象化返回类型
  - 旧别名不可见

## 执行顺序

1. 补齐单元测试
2. 运行 group 相关单测与 type-check
3. 补齐 mock 集成与专项集成
4. 运行 group 相关集成测试
5. 补齐 contract 与 types
6. 运行完整 group 相关验证
7. 更新版本号、`CHANGELOG.md`
8. 提交 `git commit`

## 验证命令

- `npm run test:run -- tests/unit/managers/group-manager.test.ts tests/unit/managers/group.test.ts tests/unit/rest/group-management.test.ts tests/types/group-manager-types.test.ts`
- `npm run test:run -- tests/unit/chat-client/group-events.test.ts tests/unit/group/group-event-mapper.test.ts tests/unit/group/group-event-user-info-resolver.test.ts tests/unit/protocol/msync-muc-notify.test.ts tests/unit/core/message/message-receiver-group.test.ts`
- `npm run test:run -- tests/integration/mock/manager-public-api.test.ts tests/integration/group-manager/group-manager.integration.test.ts tests/integration/group-manager/group-events.integration.test.ts`
- `npm run test:run -- tests/contract/group-manager.contract.test.ts`
- `npm run type-check`
- `npm run lint`

## 风险

- 部分 contract 测试依赖真实响应样例的边界约束，若现有 spec 仍只提供逻辑契约，则本次只能先固化可确认结构与 fixture 占位
- 个别公开 API 可能已实现但尚未完全对齐 tasks 描述；补测时若发现行为与 spec 不一致，需要先停下确认是补测试还是修实现
- 027 仍有未勾选实现任务；测试回填过程中可能暴露现有实现缺口，导致工作从“补测试”扩展到“小范围修实现”
