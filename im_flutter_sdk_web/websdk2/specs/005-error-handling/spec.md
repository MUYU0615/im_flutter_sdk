# 功能规格：错误处理与数字错误码

**Feature Branch**: `005-error-handling`  
**Created**: 2026-01-22  
**Status**: Draft  
**Input**: 用户需求："为参数校验、消息发送失败、REST 业务错误、传输/ajax 错误定义数字错误码。错误只通过对应 API 的 catch 捕获，不做全局 onError。"  
**Reference**: `/Users/zhangdong/code/websdk-new/packages/refactor.md` 中 "6. 重新实现 REST 接口错误处理"

> 本 spec 只定义统一错误契约与数字错误码，具体实现将在后续任务中落地。

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 参数校验错误 (Priority: P1)

开发者在参数不合法时应获得稳定的数字错误码，且在发起网络请求之前就失败。

**Independent Test**: 传入非法参数调用 API，Promise 应 reject，并包含校验错误码与明确消息。

**Acceptance Scenarios**:
1. **Given** 缺少必填字段, **When** 调用 API, **Then** reject 的错误码为 `INVALID_PARAM (110)` 且包含校验信息。
2. **Given** 字段格式非法（如 userId 不合法）, **When** 调用 API, **Then** reject 的错误码为 `INVALID_PARAM (110)` 或对应的参数错误码（如 `INVALID_USER_NAME`），且包含字段详情。

---

### 用户故事 2 - 消息发送失败 (Priority: P1)

开发者在发送消息失败时应获得明确的数字错误码，并可通过 send API 的 catch 捕获。

**Independent Test**: WebSocket 关闭时发送消息，Promise reject 并带有消息相关详情。

**Acceptance Scenarios**:
1. **Given** WebSocket 未连接, **When** 调用 `sendMessage`, **Then** reject 错误码为 `SERVER_NOT_REACHABLE (300)`。
2. **Given** ACK 超时, **When** 调用 `sendMessage`, **Then** reject 错误码为 `SERVER_TIMEOUT (301)`，`details` 含 `msgLocalId`。

---

### 用户故事 3 - REST 错误（业务 vs 传输）(Priority: P1)

REST 错误需区分传输失败（网络/超时）与业务错误，二者均使用数字错误码。

**Independent Test**: 模拟 HTTP 500 与 API 业务错误响应，断言错误码不同。

**Acceptance Scenarios**:
1. **Given** REST 请求因网络/超时失败, **When** 调用 API, **Then** reject 错误码为 `NETWORK_ERROR (2)` 或 `SERVER_* (300-303)`，且 `details` 含 http/network 信息。
2. **Given** REST 响应包含 API 业务错误, **When** 调用 API, **Then** reject 的错误码为 API 定义的业务码。

---

### 用户故事 4 - Ajax/Fetch 失败 (Priority: P2)

底层 HTTP 层的异常应被包装成 SDK 错误契约并带数字错误码。

**Independent Test**: 让 `fetch` 抛错，Promise reject 并包含传输错误码与必要信息。

**Acceptance Scenarios**:
1. **Given** `fetch` 抛出网络异常, **When** 调用 API, **Then** reject 为传输错误码且 `details` 含必要信息。

---

## Requirements *(mandatory)*

### 错误码文档生成

- 错误码必须集中定义为可解析的数据结构（例如 `API_ERRORS`）。
- 必须提供从 `API_ERRORS` 自动生成错误码文档的流程。
- 文档输出位置固定为 `docs/reference/errors.md`。
- 文档生成需有明确触发方式（例如 `npm run docs:errors`），并保证可重复生成。

### Runtime 映射与文案分离

- SDK runtime MUST NOT 默认携带面向文档的中文/英文长文案（如错误说明、原因、处理建议、API 摘要）。
- SDK runtime 只允许携带错误匹配和错误码归一化所需的最小字段：
  - `code`
  - `canonicalCode?`
  - `httpStatus?`
  - `retryable?`
  - `aliases?`
  - `matchField?`
  - `matchValue?`
  - `matchPattern?`
- `message`、`reason`、`action`、`summary` 等本地化展示文案 MUST 从 runtime 映射中剥离，不得作为默认 SDK bundle 的必需内容。
- SDK 抛出的 `Error.message` MUST 使用稳定英文运行时文案，例如 `REST business error: updateGroupInfo failed`，不得直接使用错误码文档中的本地化 `message`。
- SDK 的错误展示文案 MAY 通过可选本地化文案包提供；文案包未加载时，不得影响错误码、错误类型、`details` 结构或错误映射结果。

### Manager 级错误映射拆分

- REST API 专属错误映射 SHOULD 按能力域/Manager 拆分，避免未引入某个 Manager 时把该域错误映射一起打入应用包。
- 公共错误映射 MUST 单独维护，覆盖认证、网络、超时、HTTP fallback、通用参数校验、服务限流等跨 Manager 共享场景。
- 同一个服务端错误 key（例如 `exceed_limit`、`resource_not_found`、`group_authorization`）在不同 API 中语义可能不同，MUST 优先按 `operation` 查找 API 专属映射，不得只按 server error key 做全局匹配。
- 推荐查找顺序：
  1. 当前 `operation` 的 API 专属错误映射；
  2. 当前 Manager 的共享错误映射；
  3. 全局公共错误映射；
  4. HTTP status fallback。
- Manager 内部发起 REST 请求时 MUST 传入稳定 `operation`，用于精确匹配该 API 的错误映射。

### 本地化文案与 CDN

- 核心错误映射 MUST 随 SDK 版本发布，不应依赖 CDN 下载后才可正确返回 `SDKError.code`。
- 本地化文案包 MAY 通过 npm 子路径、独立包或 CDN 提供，用于业务展示更友好的错误说明、原因和处理建议。
- 本地化文案包 MUST 与 SDK runtime 映射共享同一套稳定 key，推荐 key 形式为 `${operation}.${reasonKey}`，例如 `updateGroupInfo.exceed_limit`。
- CDN 文案包加载失败时，SDK MUST 保持原有错误行为，仅降级为英文运行时 `Error.message` 和结构化 `details`。
- 文案包版本 SHOULD 与 SDK 版本绑定，避免 operation、reasonKey 或错误码 schema 跨版本不一致。

### 中英文 API Reference

- 中文 API Reference MUST 使用中文错误文案。
- 英文 API Reference MUST 使用英文错误文案，不得复用中文 `message/reason/action`。
- 文档生成脚本 MUST 校验 runtime 映射 key 与本地化文案 key 一致：
  - runtime 存在的错误映射必须有中文文案；
  - runtime 存在的公开 API 错误映射应有英文文案；
  - 文案包中不存在 runtime 映射的孤立 key 应被报告。

### 错误契约

对外错误必须符合统一格式：

- `code: number` (必填)
- `message: string` (必填)
- `details?: object` (可选，结构化信息)

### details 结构规范

为保证可验收，`details` 必须按错误类型提供固定字段：

- **参数校验**: `fields`（数组，含 `path`、`message`、`rule`）
- **消息发送**: `msgLocalId`、`msgServerId?`、`retryable?`
- **REST 传输**: `url`、`method`、`httpStatus?`、`timeout?`
- **REST 业务**: `api`、`serverCode`、`serverMessage?`、`reasonKey?`、`mapped?`、`canonicalCode?`、`retryable?`
- **连接/WS**: `stage`（dns/provision/ws/auth/heartbeat）

REST 业务错误的 `details` SHOULD NOT 默认携带本地化 `reason/action` 文案。业务展示需要本地化说明时，应通过可选文案包按 `api + reasonKey` 查询。

### 数字错误码范围（对齐 EMError 官方定义）

- `0`: 无错误（EM_NO_ERROR）
- `1-8`: 通用/网络/数据库/服务限制类错误
- `100-110`: 参数与鉴权（AppKey/用户名/Token/参数）
- `200-221`: 用户/登录/权限/设备相关错误
- `300-305`: 服务器/连接/超时/DNS 相关错误
- `400-407`: 文件/附件相关错误
- `500-511`: 消息相关错误
- `600-613`: 群组相关错误
- `700-707`: 聊天室相关错误
- `900-901`: 用户属性相关错误
- `1000-1002`: 联系人相关错误
- `1100-1101`: 在线状态（Presence）相关错误
- `1110-1113`: 翻译相关错误
- `1200/1299`: 内容审核/第三方服务相关错误
- `1300-1302`: Reaction 相关错误
- `1400-1401`: Thread 相关错误
- `1500-1502`: Push 相关错误

> 错误码以官方 EMError 列表为准：https://doc.easemob.com/document/android/error.html
> 如需扩展错误码，需在集中错误映射中登记并明确来源，避免与官方码冲突。

### Functional Requirements

- **FR-001**: 所有对外异步 API MUST reject 为统一错误契约，不得泄露原生 `Error`。
- **FR-002**: 参数校验 MUST fail fast，并返回数字校验错误码。
- **FR-003**: REST 错误 MUST 区分“传输”与“业务”，并映射到官方 EMError 错误码。
- **FR-004**: 消息发送失败 MUST 返回数字错误码，并在 `details` 中包含消息标识。
- **FR-005**: 错误 MUST 仅通过对应 API 的 Promise reject 捕获，不要求全局 onError。
- **FR-006**: runtime 错误映射 MUST 与文档/本地化文案分离，默认 SDK bundle 不携带文档长文案。
- **FR-007**: REST API 错误映射 SHOULD 支持按 Manager 拆分与按需引入。
- **FR-008**: 中文和英文 API Reference MUST 分别使用对应语言的错误说明。
- **FR-009**: SDK MAY 提供可选错误文案格式化能力，但该能力不得影响核心错误映射。

### Out of Scope

- 全局错误总线或 onError 聚合
- 自动错误恢复策略（重试/退避）超出当前实现

## Success Criteria *(mandatory)*

- **SC-001**: 开发者可通过 `try/catch` 统一处理全部错误，并读取数字 `code`。
- **SC-002**: REST API 业务错误有明确映射表与文档。
- **SC-003**: 对外 API 不抛/不 reject 原生 `Error`。
- **SC-004**: `docs/reference/errors.md` 可通过固定脚本生成，生成后无未提交 diff。
- **SC-005**: 各错误类型的 `details` 字段符合结构规范并通过单元测试校验。
- **SC-006**: 构建产物中的 runtime 错误映射不包含 `message/reason/action/summary` 等本地化文案字段。
- **SC-007**: 未引入某个 Manager 的 tree-shaking 检查不应包含该 Manager 的 API 专属错误映射。
- **SC-008**: 英文 API Reference 的错误码表不包含中文错误说明或中文处理建议。
