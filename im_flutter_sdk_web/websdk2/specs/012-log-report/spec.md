# 功能规格：日志分级与 DNS 控制上报

**Feature Branch**: `012-log-report`  
**Created**: 2026-02-04  
**Status**: Draft  
**Input**: 用户需求：“新建 012 spec，用于日志功能；日志仅保留 debug/warn/error；从 DNS 接口读取 enableReportLogs?: 'true' | 'false' 决定是否上报；开启后定时上传；获取 DNS 前日志先缓存；登录成功与退出时立即上报一次。”

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 日志级别收敛与重分类 (Priority: P1)

开发者需要 SDK 仅保留 debug/warn/error 三个级别，并把现有 info 日志进行降级或升级处理，降低噪声、突出重要事件。

**Why this priority**: 日志级别是开发体验与线上排障的基础能力，必须优先统一。

**Independent Test**: 编译期不再允许 `logger.info`；运行期仅输出 debug/warn/error 的日志。

**Acceptance Scenarios**:

1. **Given** 现有 `logger.info` 调用, **When** 完成级别收敛, **Then** 所有 info 事件被重分类为 debug 或 warn。
2. **Given** 关键链路事件（连接建立/断开/重连失败等）, **When** 输出日志, **Then** 日志级别为 warn。
3. **Given** 非关键过程性信息, **When** 输出日志, **Then** 日志级别为 debug。

---

### 用户故事 2 - DNS 开关控制上报与定时上传 (Priority: P1)

开发者希望通过 DNS 接口返回的开关控制日志上报，开启后自动定时上传，并在 DNS 结果可用之前缓存日志。

**Why this priority**: 是否上报由服务端统一控制，必须可动态生效。

**Independent Test**: DNS 返回 `enableReportLogs='true'` 时定时上报启动；返回 `false` 或缺失时不上报，但日志仍缓存。

**Acceptance Scenarios**:

1. **Given** DNS 返回 `enableReportLogs='true'`, **When** DNS 解析成功, **Then** 启动 5 分钟定时上报。
2. **Given** DNS 返回 `enableReportLogs='false'` 或字段缺失, **When** DNS 解析成功, **Then** 不启动上报定时器。
3. **Given** DNS 解析成功前产生日志, **When** 上报开关开启, **Then** 之前缓存的日志被纳入上报。

---

### 用户故事 3 - 登录成功与退出时即时上报 (Priority: P2)

开发者希望在登录成功与退出时立即上报一次日志，确保关键时间点日志不被延迟。

**Why this priority**: 登录/退出是高价值节点，及时上报有助于定位问题。

**Independent Test**: 在开启上报的前提下，登录成功与退出会触发一次立即上报。

**Acceptance Scenarios**:

1. **Given** `enableReportLogs='true'` 且存在缓存日志, **When** 登录成功, **Then** 触发一次立即上报。
2. **Given** `enableReportLogs='true'` 且存在缓存日志, **When** 退出/登出, **Then** 触发一次立即上报。

---

### Out of Scope

- 服务端日志接收与存储策略调整
- 日志格式化与 UI 展示能力
- 日志采样与动态下发策略

### Edge Cases

- DNS 请求失败或超时，无法获取 `enableReportLogs`
- `enableReportLogs` 值非法（非 'true' | 'false'）
- 上报时缺少访问令牌或上下文信息
- 日志上报失败的重试与回退
- 上报期间退出导致未完成日志残留

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: SDK 日志级别仅保留 debug/warn/error；移除 INFO 作为独立级别。
- **FR-002**: 现有 `logger.info` 日志必须重分类：非关键信息降级为 debug；关键事件升级为 warn。
- **FR-003**: DNS 配置响应结构新增字段 `enableReportLogs?: 'true' | 'false'`，并在类型与校验中体现。
- **FR-004**: DNS 解析成功后读取 `enableReportLogs`，仅在值为 `'true'` 时启用日志上报。
- **FR-005**: 上报定时器间隔固定为 5 分钟；上报未开启时不得创建定时器。
- **FR-006**: DNS 解析成功前产生的日志必须缓存；开启上报后需包含这部分缓存日志。
- **FR-007**: 登录成功与退出时各触发一次即时上报（仅在上报开启时）。
- **FR-008**: 上报逻辑参考旧 SDK `reportLog/reportData`：
  - 单次上报内容最大 2MB，超出分片上传
  - 分片之间间隔 3 秒
  - 上报失败时日志应回退保留
- **FR-009**: 日志内容不得包含敏感信息（token、密码等），符合安全合规要求。
- **FR-010**: 日志必须进行脱敏处理，任何包含身份标识、鉴权信息、隐私字段的内容必须被掩码或移除。
- **FR-011**: 所有对外 API 调用（REST/WS/上传下载等）必须输出最小必要日志，用于定位调用结果与错误原因。
- **FR-012**: 日志遵循最小必要原则：仅记录排障所需字段，避免冗余与隐私泄露，同时确保关键链路可追踪。

### Key Entities *(include if feature involves data)*

- **DnsConfig**: DNS 响应结构，新增 `enableReportLogs` 开关字段。
- **LogEntry**: 日志条目（level/time/message/args）。
- **ReportState**: 上报状态（enabled/timer/buffer）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: TypeScript 类型层不再允许使用 `INFO` 日志级别。
- **SC-002**: DNS 返回 `'true'` 时 5 分钟内至少触发一次定时上报；返回 `'false'` 时不触发。
- **SC-003**: DNS 成功前产生的日志在开启上报后可被上传。
- **SC-004**: 登录成功与退出时各触发一次立即上报。
- **SC-005**: 上报失败后日志不丢失，下一次上报仍可发送。
- **SC-006**: 对外 API 调用日志覆盖率达到 100%，且日志字段满足脱敏与最小必要原则。
