# 功能规格：语音转文字迁移

**Feature Branch**: `036-voice-to-text`  
**Created**: 2026-05-07  
**Status**: Draft  
**Input**: 用户需求："在旧 websdk 项目中有语音转文字功能，需要迁移到 WEBSDK2，保留原先错误码，对外与对内 API 名称不变，实现方式适配 websdk2 技术并兼容小程序等，且在 demo 页面添加对应标签与功能。"

**Reference**:

- 旧 SDK 语音转文字实现：`/Users/wangmeng/IdeaProjects/easemob-font/websdk/packages/IM/sdk/src/apis/index.ts`
- 旧 SDK 语音转文字类型声明：`/Users/wangmeng/IdeaProjects/easemob-font/websdk/packages/IM/sdk/templates/contact/contact.d.ts`
- 旧 SDK 设计文档：`/Users/wangmeng/IdeaProjects/easemob-font/websdk/packages/IM/docs/voice_to_text_hld.md`
- 旧 SDK demo：`/Users/wangmeng/IdeaProjects/easemob-font/websdk/packages/IM/demo/sample-demo/src/components/voiceToText/index.tsx`
- 当前跨端文件类型：`src/types/index.ts`
- 当前平台上传适配：`src/platform/upload/*`
- 当前 ChatManager：`src/managers/chat-manager.ts`
- 当前 demo 主入口：`demo/src/App.tsx`
- 当前错误码体系：`src/utils/error-codes.ts`
- 当前 REST 错误映射约束：`.specify/memory/constitution.md`

## 设计决策

- 本特性只要求保留旧方法名 `voiceMessageToText` / `voiceFileToText`，不要求保留旧版 `conn.contact.*` 调用路径。
- 新能力公开归属收敛到 `ChatManager`，由 `client.chatManager.voiceMessageToText(...)` 与 `client.chatManager.voiceFileToText(...)` 对外暴露。
- 对内方法名也保持 `voiceMessageToText` / `voiceFileToText`，避免迁移后 SDK 内部与对外文档出现双命名。
- 错误码兼容以旧 SDK 当前实现为唯一标准；即使 `WEBSDK2` 已有统一 `SDKError` 风格，本特性仍需对外维持旧版语义与编号。
- `voiceFileToText` 的底层实现优先复用 `WEBSDK2` 当前已有上传能力；若现有能力不能完整承接，可在符合 Constitution 和当前工程架构的前提下扩展实现，但不应原样搬回旧 SDK 的独立上传分叉。
- 本期仅新增 `WEBSDK2/demo` 的 Web demo 标签与面板，不新增小程序 demo 页面；但 SDK 能力本身必须继续兼容小程序文件对象。
- 当前已拿到 `speech/recognitions` 成功样例与至少一份失败样例；`speech/transcriptions` 的真实成功/失败样例尚未补齐，属于实现与测试风险，必须在方案和测试中显式标注。

## Clarifications

### Session 2026-05-07

- Q: “API 名称不变”具体约束到什么层级？ → A: 仅要求保留方法名 `voiceMessageToText` / `voiceFileToText`，不要求保留旧调用路径。
- Q: 错误码兼容的真源是什么？ → A: 以旧 SDK 当前实现为唯一标准，逐条原样保留。
- Q: 服务端接口路径是否变化？ → A: 仍沿用旧版 `speech/transcriptions` 与 `speech/recognitions`。
- Q: demo 范围是否包含小程序 demo？ → A: 不包含，只改当前 `WEBSDK2` Web demo。
- Q: 是否按新功能走分支与 spec/plan 流程？ → A: 是，需新建分支并先出 spec/plan。
- Q: `voiceMessageToText` 的入参语义按哪种形态保留？ → A: 保持旧 SDK 语义，入参使用语音消息体而不是当前 SDK 的完整消息对象。
- Q: `voiceFileToText` 本期明确承诺兼容哪些输入平台对象？ → A: 明确承诺兼容浏览器 `File` 与当前 `WEBSDK2` 的 `MiniAppFile`，RN 文件对象不纳入本期承诺范围。
- Q: 迁移后成功返回和失败返回沿用哪种风格？ → A: 成功使用 `WEBSDK2` 当前业务对象返回值，失败抛出 `SDKError`。
- Q: 本地参数校验失败沿用哪种失败出口？ → A: 本地参数校验失败与服务端失败统一抛出 `SDKError`。
- Q: `PCM` 文件缺少 `audioParams` 时是否新增本地强校验？ → A: 不新增本地强校验，交由服务端决定，SDK 仅负责错误映射。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 转写已存在语音消息 (Priority: P1)

作为 SDK 使用者，我希望对一条已经发送或接收到的语音消息体直接调用 `voiceMessageToText` 并拿到文本结果，这样我可以在消息列表、消息详情或辅助阅读场景中复用旧 SDK 的能力，而不用改变业务层的方法名或入参语义。

**Why this priority**: 这是旧能力的主入口之一，也是“方法名不变”最直接的迁移目标；若该能力缺失，已有接入方无法无缝迁移。

**Independent Test**: 在已登录场景下，传入一条合法语音消息体并调用 `chatManager.voiceMessageToText(...)`，验证成功转写、非法消息体输入、本地 fileId 解析失败和服务端错误映射，即可独立验收。

**Acceptance Scenarios**:

1. **Given** 调用方已登录且传入 `type === 'voice'` 且 `url` 可解析出文件 ID 的语音消息体，**When** 调用 `client.chatManager.voiceMessageToText(messageBody, audioParams)`，**Then** SDK 必须请求 `speech/transcriptions` 并按 `WEBSDK2` 当前风格返回业务对象 `{ text }`。
2. **Given** 调用方传入的对象不是合法语音消息体，**When** 调用 `voiceMessageToText`，**Then** SDK 必须在本地直接抛出带旧版兼容错误码 `407` 与 `Invalid file` 语义的 `SDKError`，且不得发起网络请求。
3. **Given** 调用方传入的语音消息体缺少可用 `url`，**When** 调用 `voiceMessageToText`，**Then** SDK 必须在本地直接抛出带旧版兼容错误码 `410` 与 `File not found` 语义的 `SDKError`。
4. **Given** 服务端返回旧版已知 speech 业务错误码，**When** 调用 `voiceMessageToText`，**Then** SDK 必须抛出带旧兼容错误码与语义的 `SDKError`，而不是返回旧 `AsyncResult` 失败结构。

---

### User Story 2 - 转写本地语音文件 (Priority: P1)

作为 SDK 使用者，我希望把浏览器文件对象或当前 `WEBSDK2` 的小程序文件对象直接传给 `voiceFileToText` 获取识别文本，这样我可以在发消息前预转写、录音识别或非消息型语音场景中继续沿用旧能力。

**Why this priority**: 这是旧能力的第二个主入口，且直接涉及 `WEBSDK2` 的跨端上传体系；如果这里只支持浏览器，不满足“兼容小程序等”的要求。

**Independent Test**: 在已登录场景下，分别传入 H5 `File` 与当前 `MiniAppFile`，验证底层都能通过当前平台上传适配完成请求；同时验证文件格式错误、服务端 `4001002`、`4001001` 等错误映射。

**Acceptance Scenarios**:

1. **Given** 调用方传入合法浏览器音频文件，**When** 调用 `client.chatManager.voiceFileToText(file, audioParams)`，**Then** SDK 必须通过 `WEBSDK2` 当前上传适配链路请求 `speech/recognitions` 并按 `WEBSDK2` 当前风格返回业务对象 `{ text }`。
2. **Given** 调用方传入合法的当前 `WEBSDK2` 小程序文件对象 `MiniAppFile`，**When** 调用 `voiceFileToText`，**Then** SDK 必须通过当前平台上传适配链路完成同样的识别请求，而不是仅在 Web 环境可用。
3. **Given** 调用方传入既不是浏览器文件也不是有效小程序文件对象的参数，**When** 调用 `voiceFileToText`，**Then** SDK 必须在本地直接抛出带旧版兼容错误码 `407` 与 `Invalid file` 语义的 `SDKError`。
4. **Given** 服务端返回 `4001002 unsupported speech file format`，**When** 调用 `voiceFileToText`，**Then** SDK 必须映射为旧版兼容错误码 `407` 与 `Invalid file`。
5. **Given** 服务端返回 `4001001` 且错误消息包含 `uploaded file exceeds`，**When** 调用 `voiceFileToText`，**Then** SDK 必须映射为旧版兼容错误码 `411` 与 `File too large`。

---

### User Story 3 - 在 demo 页面验证语音转文字 (Priority: P2)

作为 SDK 使用者，我希望在 `WEBSDK2` demo 页面中直接看到一个语音转文字标签页，并能参考旧 demo 选择最近语音消息或本地音频文件进行测试，这样我可以快速验证新 SDK 的迁移结果与对外行为。

**Why this priority**: 这是该能力的主要验收入口，但其优先级低于 SDK 本体能力；即使 demo 暂未补齐，SDK 迁移本身仍可独立开发与测试。

**Independent Test**: 打开当前 Web demo，进入新增标签页，执行“最近语音消息转写”和“本地文件转写”两个动作，验证日志、结果与错误展示即可。

**Acceptance Scenarios**:

1. **Given** demo 已登录且消息列表中存在语音消息，**When** 用户进入新标签页并触发 `voiceMessageToText`，**Then** 页面必须展示请求结果或兼容错误码。
2. **Given** 用户在 demo 中选择本地语音文件，**When** 触发 `voiceFileToText`，**Then** 页面必须展示请求结果或兼容错误码。
3. **Given** demo 当前没有可用语音消息或未选择文件，**When** 用户触发对应按钮，**Then** 页面必须给出明确提示，而不是静默失败。

### Edge Cases

- 当语音消息的 `url` 带 query/hash 或使用旧附件地址格式时，是否仍能稳定提取最后一段 `fileId`？
- 当服务端继续使用 `4001001` 复用多个错误子场景时，SDK 如何仅凭 `error.message` 做有限区分并保持旧行为？
- 当底层平台上传适配返回的不是旧 speech 服务错误体，而是平台错误或网络错误时，SDK 是否仍需兜底映射为旧版 `409 FILE_VOICE_TO_TEXT_FAILED` 或保留已有 transport 错误？
- 当传入 PCM 文件但未补 `audioParams` 时，SDK 是否继续完全沿用服务端错误映射而不新增本地校验？
- 当 demo 中的消息记录是当前 `WEBSDK2` `Message` 结构，而旧 demo 使用的是旧消息体结构时，页面如何避免展示层误用旧入参形状？

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 `voiceMessageToText` / `voiceFileToText` 的本地参数校验、消息 URL `fileId` 提取、speech 业务错误码映射、`4001001` 子场景判断、兼容返回结构构造。
- Planned location: `tests/unit/managers/chat-manager-voice-to-text.test.ts`、`tests/unit/rest/speech-recognition.test.ts`、`tests/unit/rest/speech-transcription.test.ts`
- Not applicable rationale: N/A

### Integration Tests

- Coverage goals: 覆盖 `ChatManager` 与 `RestClient` / 平台上传适配协作、浏览器文件与小程序文件对象走向统一上传适配、真实 speech 错误体 `error.code/error.message` 解析、demo 依赖的消息样本筛选。
- Planned location: `tests/integration/chat-manager/voice-to-text.integration.test.ts`、`tests/integration/miniapp-demo/voice-to-text.integration.test.ts`
- Not applicable rationale: N/A

### E2E Tests

- Coverage goals: 覆盖当前 Web demo 新标签页的主路径，包括选择最近语音消息转写、本地音频文件转写、未选择文件/消息时的 UI 提示与结果展示。
- Planned location: `tests/e2e/voice-to-text.spec.ts`
- Not applicable rationale: N/A

### Gate Impact

- Required gates: `npm run test:run`、`npm run lint`、`npm run type-check`、`npm run test:gate:pr`
- Validation notes: PR gate 至少要覆盖公开 API 的兼容错误码、上传适配协作和 demo 主路径；若 `speech/transcriptions` 真实样例仍未补齐，相关 contract/fixture 必须在 spec 风险中显式记录，不得伪造真实响应。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: SDK MUST 在 `ChatManager` 上新增并公开 `voiceMessageToText` 与 `voiceFileToText` 两个方法，且方法名与旧 SDK 完全一致。
- **FR-002**: SDK MUST NOT 要求调用方沿用旧版 `conn.contact.*` 调用路径；新公开入口以 `client.chatManager.*` 为准。
- **FR-003**: `voiceMessageToText` MUST 保持旧 SDK 的入参语义，接收语音消息体而不是当前 SDK 的完整消息对象，并从该语音消息体的 URL 中提取 `fileId` 请求 `speech/transcriptions`。
- **FR-004**: `voiceMessageToText` MUST 在本地校验“语音消息体存在、消息体类型为语音、存在可用语音 URL、URL 可提取 fileId、audioParams 合法”，不满足时直接抛出带旧版兼容错误码的 `SDKError`，且不得发请求。
- **FR-005**: `voiceFileToText` MUST 接收浏览器 `File` 或当前 `WEBSDK2` 的 `MiniAppFile`，并通过符合当前 SDK2 架构的上传链路请求 `speech/recognitions`。
- **FR-006**: `voiceFileToText` SHOULD 优先复用 `WEBSDK2` 当前已有的上传能力或其同一架构下的可扩展实现；若需要补能力，MUST 与当前 SDK2 架构保持一致，且 MUST NOT 直接回退为旧 SDK 的独立上传分叉实现。
- **FR-007**: SDK MUST 兼容旧 `AudioParams` 语义：`format`、`sampleRate`、`bitsPerSample`、`channels`，并在两条 API 上复用同一参数模型。
- **FR-007A**: 当语音文件格式为 `PCM` 且缺少 `audioParams` 时，SDK MUST NOT 新增本地强校验拦截，而应继续把请求交由服务端处理，并仅对返回错误做兼容映射。
- **FR-008**: SDK MUST 对旧 speech 服务错误码做兼容映射，至少包含：`4041001 -> 410 FILE_NOT_FOUND`、`4001002 -> 407 FILE_INVALID`、`5021001 -> 402 UPLOAD_REQUEST_FAILED`、`4001003 -> 408 FILE_DURATION_TOO_LONG`、`4031001 -> 505 SERVICE_NOT_ENABLED`、`4031002 -> 4 SERVICE_LIMIT_EXCEEDED`、`4001001 -> 110/411`、`5021003 -> 409 FILE_VOICE_TO_TEXT_FAILED`、`5001003 -> 409 FILE_VOICE_TO_TEXT_FAILED`、`4011001 -> 202 AUTH_UNAUTHORIZED`，并把这些错误码挂到抛出的 `SDKError` 上。
- **FR-009**: 对 `4001001`，SDK MUST 当 `error.message` 包含 `uploaded file exceeds` 时映射为 `411 FILE_TOO_LARGE`，其余场景映射为 `110 VALIDATION_REQUIRED`。
- **FR-010**: 当底层已经返回带旧兼容错误码语义的错误且服务端 speech 错误码缺失时，SDK MUST 优先复用该错误码与 message，保持旧实现语义。
- **FR-011**: 两个方法对外 MUST 在成功时按 `WEBSDK2` 当前风格返回业务对象 `{ text: string }`，在本地校验失败和服务端失败两种场景下都抛出带旧兼容错误码与 message 的 `SDKError`。
- **FR-012**: `voiceMessageToText` 与 `voiceFileToText` 的内部实现命名也 MUST 保持原名称，避免公开 API 与内部实现分叉命名。
- **FR-013**: 当前 SDK 的类型导出面 MUST 补齐旧能力所需公开类型，包括 `AudioParams` 与跨端语音文件输入类型，且与现有 `CompatibleFile` / `MiniAppFile` 体系保持一致。
- **FR-014**: 语音文件输入的跨端建模 MUST 兼容当前 `WEBSDK2` 小程序文件对象字段，而不是要求调用方回退到旧 SDK 的独立小程序类型；RN 文件对象不作为本期对外承诺范围。
- **FR-015**: demo MUST 新增独立标签页或等价显式入口，以展示“最近语音消息转写”和“本地文件转写”两个操作。
- **FR-016**: demo 中“最近语音消息转写”的消息选择来源 MUST 基于当前 `WEBSDK2` 已接收/发送的消息列表筛出最近语音消息，而不是维护一套与 SDK 状态脱节的本地伪数据。
- **FR-017**: demo 中“本地文件转写” MUST 至少支持浏览器文件选择；错误展示 MUST 直接反映兼容错误码与 message，便于与旧 SDK 行为对比。
- **FR-018**: 本特性的 REST 映射与测试 MUST 以旧 SDK 当前实现和已确认真实样例为依据；在 `speech/transcriptions` 成功/失败真实样例缺失前，不得伪称已完成该接口的真实结构对齐。
- **FR-019**: 本特性 MUST 保持对小程序等平台的 SDK 能力兼容，但本期不要求新增小程序 demo 页面。
- **FR-020**: 本特性落地后 MUST 更新公开双语注释、版本号、`CHANGELOG.md`，并以中文 commit message 提交。

### Key Entities _(include if feature involves data)_

- **VoiceToTextAudioParams**: 语音转文字可选音频参数实体，描述 `format`、采样率、位深和声道数。
- **VoiceMessageSource**: 旧 SDK 兼容语音消息体实体，表示可从消息体 URL 提取服务端 `fileId` 的语音消息体输入。
- **VoiceSourceFile**: 语音文件输入实体，表示浏览器 `File` 或当前 `WEBSDK2` 的 `MiniAppFile` 语音文件来源。
- **VoiceToTextResult**: 语音转文字业务结果实体，成功时返回 `{ text: string }`；失败时通过带旧兼容错误码与 message 的 `SDKError` 表达。
- **SpeechServiceErrorEnvelope**: speech 服务错误响应实体，关键字段为 `error.code` 与 `error.message`，用于旧错误码映射。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 旧 SDK 的 `voiceMessageToText` / `voiceFileToText` 两个主能力在 `WEBSDK2` 中都可用，方法名兼容率达到 100%。
- **SC-002**: 对旧 speech 服务已知错误码的兼容映射正确率达到 100%，尤其是 `4001001`、`4001002`、`4011001`、`4031001`、`4031002`、`5001003`、`5021001`、`5021003`。
- **SC-003**: 在浏览器 `File` 与当前 `MiniAppFile` 两类输入场景下，`voiceFileToText` 都能走通符合当前 SDK2 架构的上传链路，跨端输入兼容率达到 100%。
- **SC-004**: 当前 Web demo 中可直接完成“最近语音消息转写”和“本地文件转写”两条主路径，且结果或错误可见率达到 100%。
- **SC-005**: 本地参数错误场景下，SDK 不发起多余网络请求，前置校验拦截率达到 100%。
- **SC-006**: 本次迁移不引入脱离当前 SDK2 架构的旧式上传分叉实现，新增上传逻辑若存在也必须与现有能力保持统一抽象，架构分叉数量保持为 0。
