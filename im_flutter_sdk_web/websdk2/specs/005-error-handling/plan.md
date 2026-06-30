# 实施方案：错误处理与数字错误码

**Branch**: `005-error-handling` | **Date**: 2026-01-22 | **Spec**: `specs/005-error-handling/spec.md`  
**Input**: 规范文档 `/specs/005-error-handling/spec.md`

## 概述

引入统一错误契约与数字错误码，覆盖参数校验、消息发送失败、REST 业务错误与传输/ajax 失败。错误通过 API 的 Promise reject 传递，不使用全局 onError 汇总。本方案仅定义实现方向，代码改动在后续任务中落地。

## 技术背景

- **语言/版本**: TypeScript 5.x
- **错误契约**: `{ code: number, message: string, details? }`
- **传播方式**: 仅通过 API Promise reject
- **参考**: `/Users/zhangdong/code/websdk-new/packages/refactor.md` 中 "6. 重新实现 REST 接口错误处理"

## 设计要点

1. **集中式数字错误码表**
   - 错误码表对齐官方 EMError 列表，不再自定义码段。
   - REST 业务错误按 API 维护集中映射表，统一映射到 EMError 现有码值。
   - 从集中错误码表自动生成文档 `docs/reference/errors.md`。
   - **结构标准**：以 API 名为一级 key，包含 `summary/errors`，并共享公共错误（校验/传输）。
   - **触发方式**：提供固定脚本（如 `npm run docs:errors`）用于生成/校验文档一致性。
   - **扩展码策略**：如需新增非官方错误码，必须在映射表中标注来源并避免冲突。
   - **runtime 最小化**：SDK runtime 只加载错误匹配和错误码归一化所需字段，文档长文案不进入默认 bundle。

2. **错误类对齐**
   - SDK 基础错误类携带数字码 + details。
   - 派生错误类按错误类型归类（ValidationError、MessageSendError、RestTransportError、RestBusinessError、ConnectionError）。
   - `details` 按错误类型提供固定字段（见 spec 的结构规范）。

3. **REST 错误划分**
   - 传输失败（网络/超时/HTTP 非 2xx）→ 映射到 EMError 的网络/服务器错误码（如 `NETWORK_ERROR`/`SERVER_*`）。
   - 业务错误（响应 payload 中的错误）→ API 对应的 EMError 业务码。

4. **消息发送错误**
   - 未连接、ACK 超时、发送失败 → 映射到 `500-511` 范围内的 EMError。
   - details 中包含 `msgLocalId`/`msgServerId`。

5. **校验错误**
   - 校验失败 → 映射到 EMError 参数/鉴权类错误码（如 `INVALID_PARAM`）。

6. **错误映射与文案分层**
   - 将当前完整错误码源拆成三类产物：
     1. **源数据**：包含 runtime 映射字段和 zh-CN/en-US 文案，用于生成 runtime 映射、文档和可选文案包。
     2. **runtime error map**：进入 SDK，按 Manager 拆分，只包含 `code/canonicalCode/httpStatus/retryable/aliases/match*` 等最小字段。
     3. **locale packs**：不默认进入 SDK，可通过 npm 子路径、独立包或 CDN 加载，包含 `message/reason/action/summary`。
   - `api-errors.json` 不应继续作为 runtime 直接 import 的完整数据源。
   - `src/utils/error-codes.ts` 不应依赖包含文案的完整 JSON；如需常量，应依赖裁剪后的 runtime map 或生成的纯数字常量。

7. **按 Manager 拆分 runtime 错误映射**
   - 拆分建议：
     - `common`：认证、网络、超时、HTTP fallback、通用校验、限流。
     - `chat`：消息、reaction、已读回执、置顶、翻译、合并消息等 ChatManager API。
     - `contact`：联系人与黑名单 API。
     - `group`：群组 API。
     - `chatroom`：聊天室 API。
     - `presence`：在线状态 API。
     - `push`：推送 API。
     - `user-info`：用户资料 API。
     - `thread`：子区/Thread API。
   - 每个 Manager 只 import 自身 runtime error map 与 `common`。
   - 同一个 server error key 在不同 API 下语义不同，resolver 必须以 `operation` 优先，避免 `exceed_limit` 等 key 被跨 API 误判。
   - 推荐解析顺序：
     1. `operation` 专属映射；
     2. manager 共享映射；
     3. global common 映射；
     4. HTTP status fallback。

8. **本地化文案与 CDN 策略**
   - SDK 核心错误映射不依赖 CDN；CDN 仅用于可选本地化展示文案。
   - 文案包 key 推荐为 `${operation}.${reasonKey}`，例如 `updateGroupInfo.exceed_limit`。
   - 文案包加载失败时，SDK 仍返回稳定英文运行时 message 和结构化 details。
   - 文案包版本需与 SDK 版本绑定，避免 schema 和 operation 不一致。

9. **中英文文档生成**
   - 文档生成脚本应从源数据或 locale pack 读取对应语言文案。
   - 中文 API Reference 使用 zh-CN 文案。
   - 英文 API Reference 使用 en-US 文案。
   - 生成前应校验：
     - runtime 映射 key 在 zh-CN 文案中存在；
     - 公开 API 错误映射在 en-US 文案中存在；
     - 文案包没有孤立 key；
     - 英文文档错误码表不含中文字符。

## 推荐产物结构

```text
src/rest/error-maps/
  common.ts
  chat.ts
  contact.ts
  group.ts
  chatroom.ts
  presence.ts
  push.ts
  user-info.ts
  thread.ts

src/rest/error-codes.generated.ts

docs/error-messages/
  zh-CN.json
  en-US.json

scripts/
  generate-runtime-error-maps.mjs
  generate-error-locale-packs.mjs
  check-error-locale-coverage.mjs
```

> 具体文件名可在落地阶段调整，但原则是：runtime 只 import 裁剪后的映射，文档和文案生成读取完整源或 locale pack。

## 实施说明

- 所有对外异步 API 必须 reject 为 SDKError；不允许原生 Error 漏出。
- 同步 API 直接 throw SDKError。

## 测试策略

- 按错误类型建立单元测试：校验、消息发送、REST 传输、REST 业务。
- 断言数字错误码、消息、details。
- 仅验证 Promise reject，不依赖全局 onError。

## 风险与权衡

- **风险**: 模块间错误码使用不一致。
  - **应对**: 集中定义错误码，强制从统一工厂创建错误。

- **风险**: 与旧错误类型不兼容。
  - **应对**: 落地阶段提供迁移说明。

- **风险**: 按 Manager 拆分后，同一服务端错误 key 在不同 API 中被错误复用。
  - **应对**: resolver 以 `operation` 为第一匹配维度，并为重复 key 添加单元测试。

- **风险**: CDN 文案包版本与 SDK runtime 映射不一致。
  - **应对**: 文案包 URL 或 package version 与 SDK version 绑定；加载失败只影响展示，不影响 `SDKError.code`。

- **风险**: 文档源和 runtime 映射分离后出现 key 漏配。
  - **应对**: 新增覆盖检查脚本，CI 校验 zh-CN/en-US 文案覆盖和 runtime map key 一致性。
