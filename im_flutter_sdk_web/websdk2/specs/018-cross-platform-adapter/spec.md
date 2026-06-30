# 功能规格：SDK 跨平台适配层（小程序 / uni-app / Electron / React Native）

**Feature Branch**: `018-cross-platform-adapter`  
**Created**: 2026-02-13  
**Status**: Draft  
**Input**: 用户需求："按照刚才的讨论和 `docs/architecture/cross-platform-sdk-plan.md`，产出 018 spec，覆盖平台差异、SDK 需兼容 API，以及抹平差异的包装方案。"

**Reference**:

- `docs/architecture/cross-platform-sdk-plan.md`
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/utils/index.ts`（`getEnvInfo` 思路）
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/weichatPb`（小程序 protobuf 兼容历史方案）
- `/Users/zhangdong/code/websdk-new` 提交 `83215967`（HTTP 请求在无 `XMLHttpRequest` 环境下使用 `fetch` 兜底）

## Clarifications

### Session 2026-02-13

- Q: `uni-app` 的验收范围要如何定义？ → A: 选项 C（`uni-app` 全平台，含 H5）
- Q: 跨平台 protobuf 兼容策略要固定成哪一种？ → A: 统一静态 protobuf 方案，代码中不内置回退逻辑；若验证失败，再整体切换方案
- Q: `uni-app H5` 与 `Web` 的验收关系怎么定义？ → A: 选项 B（`uni-app H5` 单独验收，可复用部分 Web 用例）
- Q: 当某平台缺失关键能力时，SDK 行为要怎么定？ → A: 选项 A（fail-fast，初始化失败并返回明确错误）

## 用户场景与测试 _(mandatory)_

### 用户故事 1 - 一套 SDK API 覆盖多端基础消息能力（Priority: P1）

作为业务开发者，我希望使用同一套 SDK API 在 Web、微信小程序、uni-app（小程序 / App / H5）、Electron Renderer、React Native 上完成登录、建连、收发文本消息，而不需要按平台写多套业务逻辑。

**Why this priority**: 这是跨平台改造的核心价值，直接决定业务侧是否能低成本接入。

**Independent Test**: 仅实现该故事即可在目标平台完成“初始化→登录→连接成功→发送文本→收到回调”的闭环，并且业务层调用保持一致。

**Acceptance Scenarios**:

1. **Given** 业务端使用统一初始化参数，**When** 在任一目标平台启动 SDK，**Then** SDK 能完成平台识别并建立可用连接。
2. **Given** 业务端调用统一发送文本消息接口，**When** 在不同目标平台执行，**Then** 对外行为与回调结构保持一致。
3. **Given** 业务端不做平台分支判断，**When** 切换到另一目标平台运行，**Then** 不需要修改消息收发业务代码。

---

### 用户故事 2 - 附件消息上传在多端行为一致（Priority: P1）

作为业务开发者，我希望图片/文件/语音/视频消息在各平台都能按统一流程上传与发送，并拿到一致的进度、成功、失败、取消回调。

**Why this priority**: 附件消息是高频能力，且平台差异最大，若不统一会显著增加接入复杂度。

**Independent Test**: 仅实现该故事即可在各目标平台上传附件并触发统一回调语义。

**Acceptance Scenarios**:

1. **Given** 业务端传入本地附件对象，**When** 调用统一发送附件接口，**Then** SDK 能在对应平台完成上传并返回可发送消息体。
2. **Given** 上传过程中发生中断或失败，**When** SDK 回调错误，**Then** 错误语义与字段结构在各平台保持一致。
3. **Given** 业务端监听上传进度，**When** 上传进行中，**Then** 进度回调的字段语义（已上传量、总量、百分比）一致。

---

### 用户故事 3 - 长连接与生命周期事件跨端一致（Priority: P1）

作为业务开发者，我希望网络变化、前后台切换、重连触发等长连接行为在各平台具有一致语义，便于统一处理在线状态与消息可靠性。

**Why this priority**: 连接稳定性直接影响消息实时性与用户体验。

**Independent Test**: 仅实现该故事即可验证网络切换与前后台切换时，连接状态事件和重连策略行为一致。

**Acceptance Scenarios**:

1. **Given** 设备网络从离线恢复在线，**When** SDK 监听到网络变化，**Then** 连接恢复与事件回调语义一致。
2. **Given** 应用从后台回到前台，**When** SDK 执行连接健康检查，**Then** 能按统一规则维持连接或触发重连。
3. **Given** 连接异常断开，**When** SDK 自动重连，**Then** 各平台对外状态事件序列保持一致语义。

---

### 用户故事 4 - 小程序 protobuf 兼容与消息编解码一致（Priority: P2）

作为业务开发者，我希望在小程序等受限环境中，消息编解码能力可用且结果与其他平台一致，避免因运行时限制导致消息功能不可用。

**Why this priority**: 编解码是消息链路基础能力，兼容失败会导致核心能力不可用。

**Independent Test**: 仅实现该故事即可在小程序与 Web 等平台对同一消息样本得到一致编解码结果。

**Acceptance Scenarios**:

1. **Given** 同一消息样本在不同平台执行编码，**When** 再解码回消息对象，**Then** 关键字段语义保持一致。
2. **Given** 小程序运行环境存在动态代码限制，**When** SDK 初始化编解码能力，**Then** 不因运行时限制导致初始化失败。

---

### 用户故事 5 - 平台能力可扩展与可注入（Priority: P2）

作为 SDK 维护者，我希望平台差异被封装在适配层，并支持后续新增平台或自定义适配实现，以降低长期维护成本。

**Why this priority**: 该能力决定后续扩展效率，避免跨端逻辑继续分散在业务核心模块。

**Independent Test**: 仅实现该故事即可在不改业务 API 的前提下替换/扩展平台适配实现。

**Acceptance Scenarios**:

1. **Given** 维护者提供自定义平台适配实现，**When** SDK 初始化时注入该实现，**Then** SDK 使用注入能力完成运行。
2. **Given** 运行于未默认支持的平台，**When** 缺少必需能力，**Then** SDK 返回明确错误并提供可扩展接入路径。

### Edge Cases

- 平台识别结果不明确或识别冲突时，默认行为与错误提示策略。
- 附件对象仅包含本地路径、缺少文件大小/类型等元数据时的处理规则。
- 上传中途网络切换、应用切后台再恢复时，进度与最终状态一致性。
- 长连接收到非业务消息（如内部控制帧）时，不应污染业务消息回调。
- 同一功能在不同平台能力不完全一致时，如何定义最小可用行为与降级策略。
- Service Worker / Worker 运行时缺失 `XMLHttpRequest` 时，请求层如何自动切换到 `fetch` 且保持统一错误语义。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: SDK MUST 提供统一的平台适配抽象层，用于承载网络请求、文件上传、长连接、生命周期监听、编解码等跨端能力。
- **FR-002**: SDK MUST 在 Web、微信小程序、uni-app（小程序 / App / H5）、Electron Renderer、React Native 上提供一致的基础消息闭环能力（初始化、连接、发送、接收）。
- **FR-002A**: SDK MUST 将 `uni-app H5` 作为独立验收维度执行兼容验证，不得以 Web 验收结果直接替代。
- **FR-003**: 业务端 MUST 能通过同一套公开 SDK API 完成核心消息流程，且不需要为目标平台编写不同的业务调用分支。
- **FR-004**: SDK MUST 为附件上传提供统一的输入语义与回调语义（进度、完成、失败、取消），并在各目标平台保持一致。
- **FR-005**: SDK MUST 在网络状态变化、前后台切换、连接断开场景下，输出一致语义的连接状态事件。
- **FR-006**: SDK MUST 在受限运行环境中提供可用的消息编解码能力，并确保与其他平台的消息语义一致。
- **FR-006A**: SDK MUST 在同一版本中保持单一编解码实现，不在运行时内置多套编解码回退逻辑。
- **FR-007**: SDK MUST 支持平台能力的显式注入与替换，以便后续扩展新平台或覆盖默认实现。
- **FR-008**: 当平台能力缺失或初始化失败时，SDK MUST 返回可识别且可追踪的错误信息，不得静默失败。
- **FR-008A**: 当平台缺失关键能力（例如连接或上传能力）时，SDK MUST 在初始化阶段立即失败，并返回明确错误。
- **FR-009**: 对于当前已稳定运行的 Web 场景，SDK MUST 保持向后兼容；未使用跨端新能力时，不改变既有业务行为。
- **FR-010**: SDK MUST 明确平台支持边界：Electron 默认支持 Renderer 进程；Main 进程通过自定义能力注入方式接入。
- **FR-011**: SDK MUST 定义并公开跨平台兼容验证基线，至少覆盖文本消息、附件消息、连接恢复、编解码一致性四类场景。
- **FR-012**: 规格与后续计划文档 MUST 明确记录平台差异与适配范围，确保研发、测试、业务方对能力边界认知一致。
- **FR-013**: SDK MUST 支持在 Service Worker 环境运行；当运行时不存在 `XMLHttpRequest` 时，请求层 MUST 自动使用 `fetch` 兜底，并保持与其他平台一致的请求成功/失败语义。

### Key Entities _(include if feature involves data)_

- **PlatformAdapterProfile**: 平台能力画像，描述当前运行环境具备的请求、上传、连接、生命周期与编解码能力。
- **UnifiedTransportContract**: 统一传输契约，定义请求、上传、连接、错误、回调在各平台应保持一致的语义。
- **AttachmentUploadContext**: 附件上传上下文，包含上传源、进度状态、最终资源描述与失败原因。
- **CodecCapabilityProfile**: 编解码能力画像，描述平台是否满足消息编解码所需约束及其兼容策略。

### Assumptions

- Electron 本期默认以 Renderer 进程为内置支持边界，Main 进程通过可注入适配能力扩展。
- 目标平台均以“同一业务 API、统一语义”为优先；平台特有能力不直接暴露到通用业务 API。
- `uni-app` 本期验收范围包含小程序端、App 端与 H5 端。
- `uni-app H5` 与 Web 可复用部分验证用例，但必须保留独立验收记录。
- 本期编解码采用单一静态方案；若方案验证失败，后续版本整体替换，不在同一版本内共存回退实现。
- 对关键能力缺失平台采用 fail-fast 策略，在初始化阶段返回明确错误，不进入部分可用运行态。
- Service Worker 环境默认可用 `fetch`，但可能不存在 `XMLHttpRequest`；请求能力以 `fetch` 作为可接受等价实现。
- 该规格阶段不要求立即覆盖所有边缘平台，仅聚焦五类目标平台的最小可用闭环。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 在目标平台兼容基线验收中（含 `uni-app` 小程序 / App / H5），文本消息闭环场景通过率达到 100%。
- **SC-001A**: `uni-app H5` 兼容基线用例需独立执行与记录，通过率达到 100%。
- **SC-002**: 在五类目标平台中，附件上传场景（成功/失败/取消/进度）契约一致性用例通过率达到 100%。
- **SC-003**: 连接恢复相关场景（离线恢复、前后台切换、异常断开）跨平台语义一致性用例通过率达到 100%。
- **SC-004**: 编解码一致性样本集在受支持平台的关键字段语义比对准确率达到 100%。
- **SC-005**: 历史 Web 集成样例在不改业务调用代码前提下通过回归验证，通过率达到 100%。
- **SC-006**: 在关键能力缺失模拟场景中，初始化阶段错误识别率达到 100%，且无静默成功实例。
- **SC-007**: 在 Service Worker 环境兼容基线中，无 `XMLHttpRequest` 条件下 HTTP 请求仍可通过 `fetch` 完成，核心请求场景通过率达到 100%。
