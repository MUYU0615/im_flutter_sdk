# ChatRoomManager 错误契约与 API 文档收口计划

## 背景

当前 028 聊天室域已完成 REST 适配、公开 API、文档主体和 demo 调试面板，但“错误”这一层仍未形成完整 contract：

- `docs/reference/chatroom-api.md` 已收集一批 upstream 可能错误与原因
- `src/rest/client.ts` 已具备基于 `operation` 的业务错误映射入口
- `src/rest/api-errors.json` 目前仅覆盖联系人、部分群组、presence、push 等 operation，尚未覆盖 chatroom operation
- `scripts/generate-api-reference.js` 当前只从 JSDoc `@throws` 渲染“可能错误”，还不能自动消费 operation 级错误清单
- `scripts/generate-errors-docs.js` 当前能从 `src/rest/api-errors.json` 生成总错误表，但粒度还不足以支撑“每个 API 的错误原因/处理方式”文档输出

结果是：

1. ChatRoomManager 的大部分 REST 业务错误尚未映射成稳定 SDK 错误码
2. fallback 错误分支会丢失部分服务端业务语义
3. API reference 无法稳定列出“每个 API 可能有哪些错误、原因、建议处理方式”

## 目标

本阶段目标是把 ChatRoomManager 相关 REST 错误正式纳入 SDK contract，并让代码、测试、错误总表、API reference 四处一致。

具体目标：

1. 为每个公开 chatroom operation 建立明确的错误清单
2. 将 chatroom upstream 业务错误稳定映射为统一 SDK 错误码
3. 对未映射错误保留完整 server details，避免语义丢失
4. 让 API reference 自动列出每个 API 的“可能错误 / 原因 / 建议处理方式”
5. 为后续 group/contact/其他 manager 复用同一套机制铺路

## 非目标

- 本阶段不重构所有已有模块的错误映射，只优先覆盖 chatroom operation，并抽出可复用机制
- 本阶段不改动 WebSocket / provision / message ack 侧错误体系
- 本阶段不追求把所有历史 JSDoc 一次性改造成结构化注释；优先先让 chatroom 能跑通一整套链路

## 设计原则

### 1. 单一真源

错误清单必须以 `src/rest/api-errors.json`（或其受控升级版结构）为唯一真源。

JSDoc、错误总表、API reference、运行时映射都只能消费这份真源，不能各写各的。

### 2. operation 级 contract

错误必须按 operation 建模，而不是只按 manager 或模块建模。

例如：

- `createChatRoom`
- `updateChatRoomInfo`
- `joinChatRoom`
- `getAttributes`
- `updateAnnouncement`

每个 operation 都要有自己的错误定义。

### 3. 业务错误与传输错误分层

- 参数校验错误：本地 `ValidationError`
- 鉴权/权限错误：`AuthenticationError` 或明确的业务错误映射
- 服务端业务错误：`RestBusinessError`
- 网络/超时/非业务 HTTP 错误：`RestTransportError`

### 4. 文档自动生成优先

“每个 API 可能的错误”必须由结构化数据生成，而不是长期依赖手写 Markdown 维护。

## 当前问题拆解

### 问题 1：chatroom operation 未进入 `api-errors.json`

影响：

- `resolveApiBusinessError()` 无法命中
- `RestClient` 只能退回到通用 401/403/303
- 业务语义无法沉淀为稳定 SDK code

### 问题 2：fallback 错误信息保留不足

当前未命中 operation 级映射时，fallback 分支仅保留：

- `url`
- `method`
- `httpStatus`

缺少：

- `serverCode`
- `serverMessage`
- `api`
- 是否“未映射业务错误”

### 问题 3：API reference 只看 `@throws`

当前脚本只能生成类似“错误码 110/1500”这种摘要描述，不能直接绑定 operation 清单，也不能展示：

- 原始服务端错误 key/code
- 触发原因
- 建议处理方式
- 是否可重试

## 方案设计

## 方案一：扩展 `src/rest/api-errors.json` 为结构化 operation 错误真源

### 推荐做法

保留现有文件位置不变，但升级每条错误定义结构。

建议每个 operation 的错误项至少包含：

```json
{
  "summary": "更新聊天室公告",
  "range": "110,210,606",
  "errors": {
    "group_authorization": {
      "code": 210,
      "message": "用户无权限：需要聊天室管理员权限",
      "httpStatus": 401,
      "reason": "当前用户不是聊天室 owner/admin，服务端拒绝修改公告",
      "action": "确认当前登录用户在该聊天室中具备管理员或所有者权限",
      "retryable": false
    },
    "resource_not_found": {
      "code": 606,
      "message": "聊天室不存在",
      "httpStatus": 404,
      "reason": "chatRoomId 不存在或已被销毁",
      "action": "确认 chatRoomId 正确且聊天室仍存在",
      "retryable": false
    }
  }
}
```

### 最低必要字段

- `code`
- `message`
- `httpStatus`
- `reason`
- `action`
- `retryable`

可选字段：

- `serverCode`
- `provisional`
- `aliases`

### chatroom 首批覆盖 operation

- `createChatRoom`
- `getChatRoomList`
- `getJoinedChatRoomList`
- `getChatRoomInfo`
- `updateChatRoomInfo`
- `joinChatRoom`
- `leaveChatRoom`
- `destroyChatRoom`
- `getMemberList`
- `addMembers`
- `removeMembers`
- `getAdminList`
- `setAdmin`
- `removeAdmin`
- `getMuteList`
- `muteMembers`
- `unmuteMembers`
- `muteAllMembers`
- `unmuteAllMembers`
- `isCurrentUserMuted`
- `getBlocklist`
- `blockMembers`
- `unblockMembers`
- `getAllowlist`
- `addUsersToAllowlist`
- `removeUsersFromAllowlist`
- `checkIfInAllowList`
- `getAnnouncement`
- `updateAnnouncement`
- `getSharedFileList`
- `deleteSharedFile`
- `getAttributes`
- `setAttributes`
- `setAttribute`
- `removeAttributes`
- `removeAttribute`

## 方案二：增强 `RestClient` 的错误归一化

### 推荐规则

1. 若命中 operation 级错误清单：
   - 抛 `RestBusinessError`
   - 使用清单内稳定 SDK `code`
   - `details` 保留 `api/serverCode/serverMessage/httpStatus/retryable/reason/action`

2. 若未命中，但 payload 中存在明显业务错误标记（如 `error/error_description/code`）：
   - 抛 `RestBusinessError`
   - `code` 使用 `REST_BUSINESS_UNKNOWN`
   - `details.unmapped = true`
   - 保留 `serverCode/serverMessage/httpStatus/api`

3. 若仅是纯 HTTP 失败，无业务 payload：
   - 抛 `RestTransportError`

### 目的

即使漏配了错误清单，调用方和测试也仍然知道：

- 这是业务错误还是传输错误
- upstream 原始错误是什么
- 哪些错误尚未被 SDK contract 化

## 方案三：让公开 API 文档从 operation 错误清单生成

### 推荐链路

1. 公开 manager 方法 JSDoc 继续保留 `@throws`
   - 但 JSDoc 只写摘要
   - 不再手写完整错误枚举

2. `scripts/generate-api-reference.js` 增加 ability：
   - 识别方法对应的 REST operation
   - 从 `api-errors.json` 读取 operation 错误清单
   - 自动渲染“可能错误”表格

3. API reference 每个方法输出如下结构：

- 错误码
- SDK 错误类型
- 服务端原始错误 key/code
- 触发原因
- 建议处理方式
- 是否可重试

### 推荐输出示例

| Code | Type                | Server Key            | Reason                         | Action                                           | Retryable |
| ---- | ------------------- | --------------------- | ------------------------------ | ------------------------------------------------ | --------- |
| 210  | `RestBusinessError` | `group_authorization` | 当前用户没有聊天室公告修改权限 | 使用 owner/admin 账号重试                        | No        |
| 606  | `RestBusinessError` | `resource_not_found`  | 聊天室不存在                   | 校验 `chatRoomId`                                | No        |
| 303  | `RestBusinessError` | `unmapped`            | 服务端返回了未收录业务错误     | 查看 `details.serverCode/serverMessage` 并补映射 | Maybe     |

## 方案四：收紧测试与门禁

### 必做测试

#### A. 运行时错误映射测试

文件建议：

- `tests/unit/errors/error-handling.test.ts`
- `tests/unit/rest/chatroom-management-errors.test.ts`

覆盖：

- 命中 operation 清单时正确映射
- 未命中时 fallback 为 `RestBusinessError + REST_BUSINESS_UNKNOWN`
- 401/403 与 operation 映射优先级
- `error_description` / `message` / `code` 多形态兼容

#### B. manager 层透传测试

文件建议：

- `tests/unit/managers/chatroom-manager.test.ts`

覆盖：

- 底层 `SDKError` 原样透传
- `details.api/serverCode/serverMessage` 不被 manager 层吃掉

#### C. 文档生成测试

文件建议：

- 新增 `tests/contract/api-reference-errors.contract.test.ts`

覆盖：

- 生成出的 chatroom API reference 确实带“可能错误”章节
- 文档内容与 `api-errors.json` 对齐

### 门禁建议

后续可新增一条轻量规则：

- 对外公开 manager 方法若声明为 REST operation，则必须在错误真源里存在对应 operation 定义

## 文件级实施范围

### 1. 错误数据源

- `src/rest/api-errors.json`
- `src/utils/error-codes.ts`
- `docs/reference/errors.md`

### 2. 运行时错误归一化

- `src/rest/errors.ts`
- `src/rest/client.ts`
- 必要时 `src/utils/errors.ts`

### 3. ChatRoomManager 公开 API 注释

- `src/managers/chatroom-manager.ts`
- 如需补充类型注释，则 `src/types/chatroom.ts`

### 4. 文档生成脚本

- `scripts/generate-api-reference.js`
- `scripts/check-api-doc-comments.js`
- 可选：`scripts/generate-errors-docs.js`

### 5. 输出文档

- `docs/reference/errors.md`
- `docs/reference/api-reference.zh-CN.md`
- `docs/reference/api-reference.en-US.md`
- 手写参考文档如有必要同步补充说明：
  - `docs/reference/chatroom-manager-api.md`

### 6. 测试

- `tests/unit/errors/error-handling.test.ts`
- `tests/unit/managers/chatroom-manager.test.ts`
- 新增 `tests/unit/rest/chatroom-management-errors.test.ts`
- 新增 `tests/contract/api-reference-errors.contract.test.ts`

## 分阶段执行建议

### Phase 1：先把 contract 立起来

产出：

- chatroom operation 错误清单
- 统一数据结构
- `docs/reference/errors.md` 可生成

验证：

- `npm run docs:errors`
- 错误清单结构校验通过

### Phase 2：再接运行时

产出：

- `RestClient` 新错误归一化逻辑
- chatroom REST 错误映射测试

验证：

- `npm run test:run -- tests/unit/errors/error-handling.test.ts tests/unit/rest/chatroom-management-errors.test.ts tests/unit/managers/chatroom-manager.test.ts`

### Phase 3：最后接 API reference

产出：

- API reference 自动带错误表
- chatroom manager 方法 `@throws` 与 operation 错误清单协同

验证：

- `npm run docs:api:md`
- `npm run docs:api:check`
- 新 contract test 通过

## 风险

1. **错误码冲突**
   - chatroom 新增错误码需要对齐官方 EMError；若官方无对应码，必须登记为扩展码

2. **operation 命名漂移**
   - 运行时 `operation`、文档生成脚本、错误清单键名必须完全一致，否则会出现“代码能跑但文档空白”的漂移

3. **文档生成复杂度上升**
   - 若脚本直接从 AST 推断 operation，需要增加规则；建议优先采用“方法名 == operation”或显式注释绑定，避免过度推断

4. **历史 API 不完整**
   - 先只对 chatroom 收口，不要试图一次性把全仓库所有 manager 都做完

## 推荐决策

我建议采用以下执行策略：

1. 以 `src/rest/api-errors.json` 为错误真源，不新增第二份 chatroom 错误配置文件
2. 先只覆盖 ChatRoomManager 全部公开 operation
3. 运行时 fallback 从“通用 HTTP 错误”升级为“未映射业务错误也保留 server details”
4. API reference 的“可能错误”改为由错误真源自动生成，JSDoc 只保留摘要说明
5. 本次先做中文/英文 md reference；HTML 文档沿用现有链路

## 执行后验收标准

完成后应满足：

1. `docs/reference/chatroom-manager-api.md`、自动生成 API reference、错误总表三者口径一致
2. 每个 chatroom 公开 API 都能明确看到：
   - 可能错误
   - 错误码
   - 原因
   - 建议处理方式
3. upstream 返回 `group_authorization`、`resource_not_found`、`MetadataException` 等时，不再只得到通用 `303`
4. 未映射错误也能在 SDKError.details 中看到原始 server 信息

## 建议验证命令

- `npm run test:run -- tests/unit/errors/error-handling.test.ts tests/unit/managers/chatroom-manager.test.ts`
- `npm run test:run -- tests/unit/rest/chatroom-management-errors.test.ts`
- `npm run docs:errors`
- `npm run docs:api:md`
- `npm run docs:api:check`
- `npm run lint`
- `npm run type-check`

## 当前状态

本文件仅为执行前计划，尚未开始修改运行时错误映射或文档生成逻辑。
