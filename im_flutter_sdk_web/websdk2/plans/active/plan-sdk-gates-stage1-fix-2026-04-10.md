# SDK 第一阶段门禁修复计划

## 背景

根据 [sdk-review-2026-04-09.md](/Users/zhangdong/code/websdk2/docs/reviews/sdk-review-2026-04-09.md)，当前仓库存在以下第一阶段问题：

- `npm run type-check` 失败
- `npm run lint` 失败
- `npm run build` 失败
- `npm run test:coverage` 失败

其中 `test:run` 已在提权环境复核通过，因此本阶段目标不是“补一轮泛泛测试”，而是把已经约定的工程门禁拉回绿色，并为后续第二阶段的导出/构建策略治理建立稳定基线。

## 目标

本阶段只做以下四件事：

1. 修复当前 `src/` 与 `tests/` 中阻塞 `type-check` 的错误
2. 修复当前 `src/` 中阻塞 `lint` 的错误
3. 修复当前阻塞 `build` 的问题，确保能产出类型声明
4. 补齐必要测试，使 `test:coverage` 达到当前全局阈值

不在本阶段处理：

- Manager 子路径导出补齐
- protobuf 外置策略重构
- `ChatClient` 单例重构
- Group 上传 API Promise 语义重构
- 文档体系全面清理

这些内容保留到后续阶段，避免把“先恢复门禁”与“再做结构治理”混在一批里。

## 当前失败项拆分

### A. Type-check / build 阻塞项

已确认的源码错误：

- `src/cache/cache-crypto.ts`
- `src/cache/conversation-cache.ts`

已确认的测试错误涉及：

- `tests/unit/chat-client/group-events.test.ts`
- `tests/unit/core/connection/connection-test-utils.ts`
- `tests/unit/core/message/stream-message-*.test.ts`
- `tests/unit/group/group-event-user-info-resolver.test.ts`
- `tests/unit/platform/*.test.ts`
- `tests/unit/protocol/*.test.ts`
- `tests/unit/rest/*.test.ts`
- `tests/unit/upload/multipart-upload.test.ts`

结论：

- 先修源码类型错误，恢复 `build`
- 再修测试类型错误，恢复 `type-check`

### B. Lint 阻塞项

已确认的源码告警/错误：

- `src/chat-client.ts`
- `src/managers/group-manager.ts`
- `src/managers/group/group-event-mapper.ts`
- `src/rest/group-management.ts`

结论：

- 这批问题以返回类型补齐、去掉无意义 `async`、去掉无效类型断言为主，风险相对可控

### C. Coverage 阻塞项

当前真实覆盖率：

- `statements 82.75%`
- `branches 76.56%`
- `functions 84.22%`
- `lines 82.75%`

当前明显短板模块：

- `src/managers/group-manager.ts`
- `src/managers/group/group.ts`
- `src/rest/group-management.ts`

结论：

- 本阶段优先补群组域测试
- 测试范围围绕“共享文件、成员属性、权限变更”展开
- 目标是以最小新增测试把全局阈值拉过线，而不是一次性把群组域补到理想覆盖

## 计划中的修改分组

### 1. 静态门禁恢复

修改范围：

- `src/cache/cache-crypto.ts`
- `src/cache/conversation-cache.ts`
- 相关失败测试文件

目标：

- `npm run build` 通过
- `npm run type-check` 通过

### 2. 代码规范恢复

修改范围：

- `src/chat-client.ts`
- `src/managers/group-manager.ts`
- `src/managers/group/group-event-mapper.ts`
- `src/rest/group-management.ts`

目标：

- `npm run lint` 通过

### 3. 覆盖率补强

建议优先补以下测试文件：

- `tests/unit/managers/group-manager.test.ts`
- `tests/unit/managers/group.test.ts`
- `tests/unit/rest/group-management.test.ts`

必要时新增：

- `tests/unit/managers/group-shared-file.test.ts`
- `tests/unit/rest/group-management-shared-file.test.ts`

覆盖重点：

- `uploadGroupSharedFile`
- `downloadGroupSharedFile`
- `deleteGroupSharedFile`
- `setGroupMemberAttributes`
- `getGroupMemberAttributes`
- `getGroupMembersAttributes`
- 关键权限 mutation 的正常/异常路径

### 4. 门禁回归验证

最终验证命令：

- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run test:coverage`

如当前环境再次受本地端口监听限制，测试命令需在提权环境复核。

## 测试分层判断

### 单元测试

适用，且本阶段必须补。

原因：

- 本阶段主要在修静态问题与群组域覆盖率，最有效的方式是单元测试补齐分支与函数覆盖。

### 集成测试

本阶段默认不新增，优先复用现有集成测试。

原因：

- 当前 `test:run` 已通过，说明主链路回归基本可用。
- 本阶段目标是恢复门禁，不做新的业务能力扩展。

### E2E

本阶段不新增。

原因：

- 没有新增面向 demo 主路径的用户能力。

### 契约测试

本阶段默认不新增。

原因：

- 本阶段不调整对外导出面和协议契约。

### 类型测试

以修现有测试类型错误为主，必要时补极少量类型回归。

原因：

- 当前 `type-check` 已失败，优先恢复已有类型面稳定性。

## 风险与约束

1. 仓库当前已有用户未提交改动，不能覆盖或回退现有脏文件。
2. 覆盖率命令在沙箱内会因本地监听端口失败，最终结果要以提权复核为准。
3. 若群组域测试补齐后覆盖率仍不足，再评估是否需要扩大到 `chat-client.ts` 或 `rest/dns-config.ts` 等次级短板模块。

## 预期产出

- 代码修复：恢复 `build/type-check/lint`
- 测试补齐：恢复 `test:coverage`
- 计划完成后，再进入第二阶段的导出面和构建策略治理
