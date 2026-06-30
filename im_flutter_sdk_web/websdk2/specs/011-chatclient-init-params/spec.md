# 功能规格：ChatClient 初始化参数扩展

**Feature Branch**: `011-chatclient-init-params`  
**Created**: 2026-01-30  
**Status**: Draft  
**Input**: 用户需求：“新增 ChatClient 初始化参数，覆盖 DNS_CONFIG 服务发现、设备标识、服务地址、内容替换、自动登录与端侧信息上报等能力。”

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 控制 DNS 与服务地址 (Priority: P1)

开发者需要在初始化时选择默认 DNS_CONFIG、指定 DNS_CONFIG 地址或固定 REST/WS 服务地址。

**Why this priority**: 连接与服务地址是 SDK 可用性的基础能力，必须优先支持。

**Independent Test**: 配置 `serviceConfig.serverUrls.restApiUrl/wsUrl` 后可固定地址直连；配置 `serviceConfig.dnsConfigUrls` 后仍走 DNS_CONFIG 解析。

**Acceptance Scenarios**:
1. **Given** 未配置 `serviceConfig`, **When** 初始化并登录, **Then** SDK 使用内置 DNS_CONFIG 列表解析公有云服务地址。
2. **Given** 配置 `serviceConfig.dnsConfigUrls`, **When** 初始化并登录, **Then** SDK 使用指定 DNS_CONFIG 地址解析服务地址。
3. **Given** 配置 `serviceConfig.serverUrls.restApiUrl/wsUrl`, **When** 初始化并登录, **Then** SDK 使用指定服务地址直连，不请求 DNS_CONFIG。
4. **Given** `serviceConfig.serverUrls` 缺少 `restApiUrl` 或 `wsUrl`, **When** 初始化, **Then** 抛出明确校验错误。

---

### 用户故事 2 - 设备标识与多端登录策略 (Priority: P1)

开发者需要控制设备标识生成策略以影响多端登录互踢行为。

**Why this priority**: 设备标识是多端登录策略的重要输入。

**Independent Test**: 设置 `useFixedDeviceId=false` 后创建两个实例，生成的设备标识不同。

**Acceptance Scenarios**:
1. **Given** `useFixedDeviceId=true`, **When** 初始化, **Then** 同一浏览器内复用已生成的设备标识。
2. **Given** `useFixedDeviceId=false`, **When** 初始化, **Then** 每实例生成不同设备标识。
3. **Given** `deviceId` 被显式传入, **When** 初始化, **Then** 以该值作为设备标识基值参与生成。

---

### 用户故事 3 - 自定义平台与设备名称 (Priority: P2)

开发者需要按业务要求设置自定义平台与设备名称。

**Why this priority**: 自定义平台用于多端设备标识策略与数据上报区分。

**Independent Test**: 设置 `customOsPlatform=10` 且 `customDeviceName=foo`，生成的设备标识带自定义平台前缀。

**Acceptance Scenarios**:
1. **Given** `customOsPlatform` 在 1-100 之间, **When** 初始化, **Then** 设备标识使用自定义平台前缀。
2. **Given** `customOsPlatform` 超出范围, **When** 初始化, **Then** 抛出明确校验错误。
3. **Given** 未设置 `customOsPlatform`, **When** 传入 `customDeviceName`, **Then** 该参数被忽略并记录说明（可选）。

---

### 用户故事 4 - 内容替换回传策略 (Priority: P2)

开发者需要控制内容审核替换后是否回传替换内容给发送方。

**Why this priority**: 审核策略直接影响发送端显示与业务逻辑。

**Independent Test**: 设置 `useReplacedMessageContents=true`，发送消息后返回替换内容。

**Acceptance Scenarios**:
1. **Given** `useReplacedMessageContents=true`, **When** 发送消息被替换, **Then** 返回替换后的内容。
2. **Given** `useReplacedMessageContents=false`, **When** 发送消息被替换, **Then** 返回原始内容。

---

### 用户故事 5 - 自动登录与 UIKit 版本上报 (Priority: P3)

开发者需要在特定环境开启自动登录，并上报 UIKit 版本用于数据统计。

**Why this priority**: 自动登录与版本上报为辅助能力，但影响产品体验与监控。

**Independent Test**: 在 uni-app 环境设置 `autoLogin=true` 能触发自动登录流程；设置 `uiKitVersion` 可在上报中携带。

**Acceptance Scenarios**:
1. **Given** `autoLogin=true` 且运行在 uni-app, **When** 初始化, **Then** 启用自动登录流程。
2. **Given** `autoLogin=true` 但非 uni-app, **When** 初始化, **Then** 忽略该参数或给出提示。
3. **Given** `uiKitVersion` 被设置, **When** 初始化, **Then** 上报中携带版本信息。

---

### Out of Scope

- 自动登录的具体业务流程细节
- 服务端审核策略配置
- 设备标识的服务端策略变更

### Edge Cases

- `serviceConfig.serverUrls.restApiUrl/wsUrl` 缺失或格式非法
- `customOsPlatform` 超出范围
- `deviceId` 为空字符串
- 同时设置 `serviceConfig.dnsConfigUrls` 与 `serviceConfig.serverUrls` 的优先级处理

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 初始化参数新增以下字段（使用新命名）：
  - `serviceConfig?: { dnsConfigUrls?: string[]; serverUrls?: ServerUrlsConfig }`
  - `useFixedDeviceId?: boolean`
  - `deviceId?: string`
  - `useReplacedMessageContents?: boolean`
  - `customDeviceName?: string`
  - `customOsPlatform?: number`
  - `autoLogin?: boolean`
  - `uiKitVersion?: string`
  - `loginExtensionInfo?: string`
- **FR-002**: `serviceConfig` 缺省时 MUST 使用 SDK 内置 DNS_CONFIG 列表；配置 `serviceConfig.dnsConfigUrls` 时 MUST 使用指定 DNS_CONFIG 地址；配置 `serviceConfig.serverUrls` 时 MUST 固定服务地址直连。
- **FR-002A**: `serviceConfig.serverUrls` 存在时 MUST 同时提供 `restApiUrl` 与 `wsUrl`；`syncRestApiUrl` 与 `syncWsUrl` 可选。
- **FR-002B**: `serviceConfig.dnsConfigUrls` 与 `serviceConfig.serverUrls` MUST NOT 同时配置；同时配置时 MUST 抛出明确校验错误。
- **FR-003**: `useFixedDeviceId` 默认值为 `true`；为 `true` 时需复用本地缓存的设备标识。
- **FR-004**: `deviceId` 默认值为 `'webim'`，用于设备标识生成。
- **FR-005**: `customOsPlatform` 取值范围为 1-100；超出范围需抛出校验错误。
- **FR-006**: 当 `customOsPlatform` 存在时，允许通过 `customDeviceName` 覆盖设备名称。
- **FR-007**: `useReplacedMessageContents` 默认值为 `false`，用于控制审核替换内容回传策略。
- **FR-008**: `autoLogin` 默认值为 `false`，仅在 uni-app 环境生效。
- **FR-009**: `uiKitVersion` 默认值为空字符串或 `undefined`，用于数据上报。
- **FR-010**: 旧的顶层 `enableHttpDns`、`dnsConfigUrls`、`serverUrls` 参数 MUST 移除；使用旧字段时 MUST 抛出明确校验错误并提示迁移到 `serviceConfig`。
- **FR-011**: `loginExtensionInfo` 为可选字符串，最大长度 1024 字符；超出长度 MUST 抛出校验错误。该值在 provision 握手时写入 `reason` 字段，多设备登录被踢时传递给被踢设备。

### 命名迁移说明

| 旧参数名 | 新参数名 |
| --- | --- |
| isHttpDNS | serviceConfig（无配置或 `dnsConfigUrls` 走 DNS_CONFIG；`serverUrls` 固定直连） |
| isFixedDeviceId | useFixedDeviceId |
| apiUrl | restApiUrl |
| url | wsUrl |
| isAutoLogin | autoLogin |
| customOSPlatform | customOsPlatform |
| uikitVersion | uiKitVersion |
| deviceId | deviceId |
| useReplacedMessageContents | useReplacedMessageContents |
| customDeviceName | customDeviceName |
| setLoginInfoCustomExt(ext) | loginExtensionInfo |

> 若需要兼容旧命名，需在实现方案中明确兼容策略（可选项）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 新增初始化参数均可通过类型检查与运行时校验。
- **SC-002**: `serviceConfig.serverUrls` 提供地址时可固定地址直连；`serviceConfig.dnsConfigUrls` 提供地址时可按指定 DNS_CONFIG 解析。
- **SC-003**: `useFixedDeviceId` 行为与旧工程保持一致。
- **SC-004**: `customOsPlatform` 与 `customDeviceName` 生效逻辑一致且可验证。
