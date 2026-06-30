# 033 用户资料订阅 API / 事件改名变更计划

**Date**: 2026-04-29  
**Scope**: 基于 033 已落地实现，收敛公开 API、事件名与事件载荷，修正文档与实现不一致处

## 变更目标

1. `UserInfoManager` 公开 API 改名：
   - `subscribeUserInfoChanges` -> `subscribeUsersInfo`
   - `unsubscribeUserInfoChanges` -> `unsubscribeUsersInfo`
   - `getSubscribedUserInfoList` -> `getSubscribedUsers`
2. 订阅资料变化事件不再单独使用 `onSubscribedUserInfoChanged`
   - 统一收敛到现有 `onUserInfoUpdated`
   - 对外 payload 与现有收消息补位事件保持一致：`ReadonlyArray<UserInfo>`
   - 订阅通知场景派发单元素数组 `[userInfo]`
3. 好友资料变化事件改名：
   - `onFriendInfoChanged` -> `onContactInfoUpdated`
4. 好友资料变化事件 payload 收敛：
   - 删除顶层 `userId`
   - 删除 `lastModified`
   - 删除 `source`
   - 保留 `userInfo`
   - 保留 `contact?`
5. 同步修正文档、示例、类型测试、集成测试、契约测试与注释中的旧名称

## 影响面

- `src/managers/user-info-manager.ts`
- `src/chat-client.ts`
- `src/types/user-info.ts`
- `src/types/contact.ts`
- `src/types/event-system.ts`
- `src/index.ts`
- `docs/reference/api.md`
- `docs/reference/user-info-manager-api.md`
- `docs/reference/contact-manager-api.md`
- `docs/reference/api-error-reference.md`
- `docs/reference/userinfo-manager-error-codes.md`
- `tests/unit/**`
- `tests/integration/**`
- `tests/types/**`
- `tests/contract/**`

## 实施步骤

1. 调整公开类型与事件名常量，删除/替换旧事件类型。
2. 调整 `UserInfoManager` 公开方法名与 operation name 相关引用。
3. 修改 `ChatClient` 的 notify 路由：
   - `subscribe_metadata_updated` 改派发 `onUserInfoUpdated([userInfo])`
   - `contact_metadata_updated` 改派发 `onContactInfoUpdated({ userInfo, contact? })`
4. 批量更新测试与文档，修复当前文档中 `onSubscribedUserInfoChanged` 顶层错误声明 `userId` 的不一致问题。
5. 运行验证：
   - `npm run test:run`
   - `npm run lint`
   - `npm run type-check`
   - `npm run docs:api:check`
6. 验证通过后再更新版本号、`CHANGELOG.md`，最后提交中文 commit。

## 风险点

- 这是 breaking change，旧方法名和旧事件名会全部失效。
- `onUserInfoUpdated` 现有语义是“批量用户资料更新”；订阅通知改为单元素数组后，调用方需按数组语义消费。
- `onContactInfoUpdated` 若仅依赖 `contact`，仍需处理 `contact` 为空的情况；因此 `userInfo` 必须保留为主语义。

## 验收标准

- 代码中不再暴露旧 API 名称和旧事件名。
- 订阅 notify 与消息补位更新统一走 `onUserInfoUpdated`，payload 结构一致。
- 联系人资料变化公开事件统一为 `onContactInfoUpdated`，payload 仅含 `userInfo` 和可选 `contact`。
- 文档、示例、类型测试与实现保持一致。
