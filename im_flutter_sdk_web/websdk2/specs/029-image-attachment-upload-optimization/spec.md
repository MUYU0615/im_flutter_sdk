# 功能规格：图片发送压缩、图片语义与附件预检秒传

**Feature Branch**: `029-image-attachment-upload-optimization`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: 用户需求："发送图片消息时需要支持压缩，创建图片消息时通过 `imageType` 表达发送原图或大图语义；上传链路增加附件预检秒传能力；预检接口改为 `/chatfiles/exists`；图片消息体统一暴露 `localUrl`、`originalImageUrl`、`largeImageUrl`、`thumbnailUrl`；上传图片时 `imagetype` 使用 `origin | large`；接收图片消息时按协议 `imageType=1|2` 判断发送方发送的是原图还是压缩图；对外 `imageType` 使用 `'original' | 'large'`；需要支持小程序。"

**Reference**:
- `plans/active/plan-image-attachment-upload-optimization-2026-04-15.md`
- `specs/003-message-create/spec.md`
- `specs/007-file-upload/spec.md`
- `specs/018-cross-platform-adapter/spec.md`
- `specs/006-protobuf-ws/spec.md`

## Clarifications

### Session 2026-04-15

- Q: GIF 发送策略如何收敛？ → A: GIF 一律按原图发送；即使未显式设置 `imageType='original'`，也自动按原图语义处理。
- Q: 发送原图或大图生成失败时，本地派生资源如何处理？ → A: 选择 `imageType='original'` 时，本地不再生成大图；`imageType='large'` 时若大图生成失败则回退原图并记录日志；缩略图统一由服务端生成，端上不处理。

### Session 2026-04-17

- Q: 图片消息公开字段里，图片 URL 应该如何表达？ → A: 图片消息体统一使用 `localUrl`、`originalImageUrl`、`largeImageUrl`、`thumbnailUrl` 四个字段；其远端 URL 形式固定为 `remotePath`、`remotePath?size=large`、`remotePath?size=small`；接收侧的 `localUrl` 固定为空字符串。
- Q: 业务方使用自有上传时，图片 URL 的自动派生应该如何处理？ → A: SDK 初始化新增 `useCustomAttachmentUpload=true` 后，创建侧与接收侧都不再自动派生 `largeImageUrl` / `thumbnailUrl`，仅保留 `originalImageUrl`，并允许业务显式透传 `thumbnailUrl`。
- Q: 附件预检接口和分片初始化接口如何收敛？ → A: 预检接口改为 `GET /{orgName}/{appName}/chatfiles/exists`，只基于 MD5 查询资源是否已存在；原有上传初始化接口恢复为“仅承担 multipart init 职责”的链路，不再被预检额外复用，单次 multipart 上传仅保留一次 init 调用。
- Q: 附件预检命中应如何判定？ → A: 以 `entities[0].exists=true` 作为命中条件；`share-secret` 作为可选访问密钥返回值，而不是唯一命中条件。
- Q: 上传图片时的 `imagetype` 字段如何收敛？ → A: 图片上传相关请求中的 `imagetype` 字段改为必填，取值仅允许 `origin` 或 `large`；原有 `big` 语义废弃。
- Q: 接收侧 `imageType` 字段应表达什么？ → A: MSync `Content.imageType=26` 继续用于表达协议中的发送语义，其中 `1` 表示原图，`2` 表示压缩图；SDK 对外消息对象统一映射为 `imageType='original' | 'large'`，客户端是否展示三种 URL，不再通过字段缺失来推断。

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 默认发送图片时自动生成压缩大图并回写固定 URL 语义（Priority: P1）

作为 SDK 使用者，我希望在创建并发送图片消息时，默认以“压缩大图发送”语义处理原始图片；同时在业务使用自有上传时，可以关闭 SDK 的图片 URL 自动派生逻辑，仅透传我明确给出的远端地址。

**Why this priority**: 这是图片消息的默认主路径，直接决定新能力是否能在不增加业务复杂度的前提下落地。

**Independent Test**: 创建一条未显式设置 `imageType` 的图片消息并执行发送，验证发送前生成压缩大图、上传侧 `imagetype=large`、协议侧 `imageType=2`、对外消息对象 `imageType='large'`，且消息体稳定包含三条图片 URL。

**Acceptance Scenarios**:
1. **Given** 调用方创建图片消息且未显式设置 `imageType`，**When** 执行发送，**Then** SDK 按压缩大图语义处理该图片，并在上传请求中写入 `imagetype=large`，在消息协议中写入 `imageType=2`，对外消息对象暴露 `imageType='large'`。
2. **Given** 图片消息按压缩大图语义发送，**When** 发送成功，**Then** 消息对象保留发送前的 `localUrl`，并在默认模式下包含 `originalImageUrl=remotePath`、`largeImageUrl=remotePath?size=large`、`thumbnailUrl=remotePath?size=small`。
3. **Given** 图片消息按压缩大图语义发送但大图生成失败，**When** 发送前完成预处理，**Then** SDK 会回退为原图发送并记录明确日志。
4. **Given** 输入图片为 GIF，**When** 执行发送，**Then** SDK 一律按原图语义处理该消息，不会将其错误压缩为静态图或压缩大图语义。

---

### 用户故事 2 - 显式指定原图语义时保留原图发送（Priority: P1）

作为 SDK 使用者，我希望在创建图片消息时显式指定 `imageType='original'`，这样接收方可以拿到原图语义，而 SDK 不会再额外在端上生成大图。

**Why this priority**: 原图发送是这次改动新增的核心公开能力，直接影响跨端消息语义和产品能力。

**Independent Test**: 创建一条设置 `imageType='original'` 的图片消息并执行发送，验证上传侧 `imagetype=origin`、协议侧 `imageType=1`、对外消息对象 `imageType='original'`、消息体仍固定包含三条图片 URL，且分片上传策略仍保持现有阈值行为不变。

**Acceptance Scenarios**:
1. **Given** 调用方创建图片消息并设置 `imageType='original'`，**When** 执行发送，**Then** SDK 以上传原图候选资源的方式处理，并在消息元数据中标记为原图语义。
2. **Given** 原图消息命中附件预检，**When** `/chatfiles/exists` 返回 `exists=true` 与可复用资源标识，**Then** SDK 不再重复上传，而是直接组装原图消息元数据。
3. **Given** 原图消息未命中附件预检，**When** 继续上传，**Then** SDK 仍按现有大小阈值逻辑决定简单上传还是分片上传，而不是因“发送原图”改变分片规则。
4. **Given** 调用方显式选择 `imageType='original'`，**When** 执行发送，**Then** SDK 不会再在端上额外生成大图，本地仅保留原图发送语义。

---

### 用户故事 3 - 附件预检秒传覆盖图片与普通附件（Priority: P1）

作为 SDK 使用者，我希望 SDK 在上传附件前先进行预检，以便在资源已存在时直接复用远端资源，减少重复上传时间和流量消耗。

**Why this priority**: 预检秒传是本次上传链路改造的主要业务价值，不仅影响图片消息，也影响普通附件效率。

**Independent Test**: 分别准备图片附件与普通附件，模拟 `/chatfiles/exists` “命中预检”和“未命中预检”场景，验证 SDK 能在命中时跳过上传、未命中时继续进入原有上传流程，并确认预检不再额外触发分片 init、multipart 主链路每次上传仅保留一次 init。

**Acceptance Scenarios**:
1. **Given** 附件资源已在服务端存在，**When** 发送前调用 `GET /{orgName}/{appName}/chatfiles/exists?md5=...` 并返回 `entities[0].exists=true`，**Then** SDK 直接复用远端资源并跳过实际上传。
2. **Given** 附件资源在服务端不存在，或预检响应 `entities[0].exists=false`，**When** 发送前预检未命中，**Then** SDK 继续进入原有上传流程，不影响最终发送。
3. **Given** 普通附件需要预检，**When** 发送前执行预检，**Then** SDK 会按统一预检语义处理，且不要求普通附件补充图片特有的 `imagetype` 字段。
4. **Given** 附件未达到预检门槛，**When** 执行发送，**Then** SDK 直接进入现有上传流程，不增加额外远端协商。
5. **Given** 附件达到预检门槛，**When** SDK 进入本次发送链路，**Then** SDK 会在该次发送流程中调用 `chatfiles/exists` 预检接口，而不是复用原有的“获取阈值/初始化”接口。
6. **Given** 附件需要进入分片上传，**When** SDK 获取分片 limit 规则，**Then** 原有初始化接口仅恢复承担 multipart init 职责，且不会再被预检额外复用。

---

### 用户故事 4 - 接收图片消息时统一获得原图/大图/缩略图语义（Priority: P1）

作为 SDK 使用者，我希望在收到图片消息时，无论对端发送的是原图还是压缩图，SDK 都能把远端路径、三种图片 URL 和图片类型整理成统一语义，便于业务侧直接展示和下载。

**Why this priority**: 接收侧语义不统一会直接影响消息展示、预览与下载逻辑，是图片消息链路的核心消费入口。

**Independent Test**: 构造协议 `imageType=1` 与 `imageType=2` 两种下行图片消息，分别验证默认模式下会自动派生 `largeImageUrl / thumbnailUrl`，以及 `useCustomAttachmentUpload=true` 时不再自动派生。

**Acceptance Scenarios**:
1. **Given** 接收侧收到协议 `imageType=1` 的图片消息且 SDK 处于默认模式，**When** SDK 解码该消息，**Then** 消息对象中的 `localUrl` 为空字符串，同时稳定提供 `originalImageUrl=remotePath`、`largeImageUrl=remotePath?size=large` 和 `thumbnailUrl=remotePath?size=small`，并将对外 `imageType` 映射为 `'original'`。
2. **Given** 接收侧收到协议图片消息且 SDK 初始化了 `useCustomAttachmentUpload=true`，**When** SDK 解码该消息，**Then** 消息对象只保留 `originalImageUrl=remotePath`，不再自动派生 `largeImageUrl` / `thumbnailUrl`；若协议显式携带缩略图地址，则透传到 `thumbnailUrl`。
3. **Given** 图片消息携带统一的访问密钥，**When** SDK 组装消息对象，**Then** 原图、大图和缩略图语义共享同一密钥语义。
4. **Given** 服务端短时间内尚未生成大图或缩略图，**When** 客户端使用约定地址访问资源，**Then** 资源请求能够按服务端兜底语义继续工作，而不是让消息对象处于无效状态。

---

### 用户故事 5 - 小程序端与 Web 端保持一致的图片发送语义（Priority: P2）

作为 SDK 使用者，我希望同一套图片发送和附件预检能力可以在 Web 与小程序端使用一致的公开 API 和消息语义，这样我不需要针对小程序单独维护一套业务逻辑。

**Why this priority**: 用户已明确要求支持小程序，这决定方案是否具备跨端实际落地价值。

**Independent Test**: 在小程序文件源与 Web 文件源场景下，分别创建并发送图片消息，验证公开 API、消息对象语义、错误语义和预检行为保持一致。

**Acceptance Scenarios**:
1. **Given** 调用方在小程序端创建图片消息，**When** 执行发送，**Then** SDK 使用与 Web 一致的公开参数语义，不要求业务层改写消息结构。
2. **Given** 小程序端具备图片压缩、图片信息读取和摘要计算能力，**When** SDK 执行发送前预处理，**Then** 整个链路可完成并生成与 Web 一致的消息语义。
3. **Given** 小程序端缺失关键图片处理能力，**When** 执行发送，**Then** SDK 返回明确错误而不是静默跳过关键步骤。

### Edge Cases

- 输入图片为 GIF 或其他不适合静态压缩的格式时，如何避免丢失动画语义，以及如何统一降级为原图发送。
- 本地仅有原始图片路径，缺失尺寸、文件类型或文件大小信息时的处理策略。
- `chatfiles/exists` 当前服务端若仍处于占位实现、固定返回 `exists=false` 时，如何在不破坏主链路的前提下接入未来真实秒传能力。
- 附件预检命中时返回 `exists=true` 但未返回 `share-secret` 时的处理策略。
- 原有分片 init 仅保留 multipart 会话初始化职责后，如何避免与单次发送的 MD5 预检职责混淆。
- 未选择发送原图时，如果端上大图生成失败，如何回退为原图发送并保留可诊断日志。
- 接收侧拿到图片消息后，服务端大图或缩略图仍在异步生成中的兜底访问语义。
- 非图片附件执行预检时，如何保持与图片相同的协商流程而不混淆图片特有语义。
- 小程序端缺少图片压缩或摘要能力时，如何明确失败而非部分成功。

## Test Layer Requirements *(mandatory)*

### Unit Tests

- Coverage goals: 覆盖图片消息创建参数校验、`imageType` 默认值、图片类型选择、附件预检门槛判断、`chatfiles/exists` 命中/未命中分支、图片上传 `imagetype=origin|large`、接收侧三条图片 URL 派生、GIF 特殊处理、大图生成失败回退原图与日志分支、以及预检不再复用分片 init 的边界。
- Planned location: `tests/unit/message/`、`tests/unit/upload/`、`tests/unit/platform/`、`tests/unit/protocol/`
- Not applicable rationale: N/A

### Integration Tests

- Coverage goals: 覆盖创建消息、发送前图片预处理、`chatfiles/exists` 预检、上传回写、MSync 编码/解码之间的协作链路；覆盖 Web 文件源与小程序文件源在统一公开 API 下的结果一致性，以及“大图生成失败回退原图发送”“上传 `imagetype` 改为 `large`”和“预检不再复用分片 init”的链路行为。
- Planned location: `tests/integration/`
- Not applicable rationale: N/A

### E2E Tests

- Coverage goals: 评估 Web demo 主路径中的图片发送 smoke，验证升级后公开 API 不回归；小程序真实环境联调作为独立验收记录，不强制落仓库级自动化 E2E。
- Planned location: 复用现有 `tests/e2e/`（仅 Web smoke 如需新增）；小程序联调记录放过程文档或任务说明中
- Not applicable rationale: 小程序端当前仓库没有现成可运行的自动化 E2E 基座，因此不把小程序自动化 E2E 作为本 spec 的必需交付，但必须保留真实环境验收要求

### Gate Impact

- Required gates: `test:gate:pr`、`test:gate:nightly`；若补充 Web demo smoke，则纳入 `test:gate:release` 评估
- Validation notes: 单元与集成用例必须进入 PR 门禁；跨协议和上传链路的回归必须进入 Nightly；涉及 Web demo 主路径时需要评估 Release gate

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: SDK MUST 在创建图片消息时支持 `imageType` 公开输入语义；当调用方未显式设置时，默认按 `imageType='large'` 处理。
- **FR-002**: SDK MUST 在发送图片消息前根据 `imageType` 输入语义，明确当前上传候选资源是原图还是压缩后大图。
- **FR-003**: SDK MUST 在不改变创建消息同步调用方式的前提下完成图片发送策略记录；图片压缩、摘要计算和预检协商不得要求调用方改用异步创建 API。
- **FR-004**: 当图片按非原图发送时，SDK MUST 将上传候选资源处理为大图语义，并保证该大图满足“等比缩放后短边不超过 720px”的产品约束。
- **FR-005**: 当图片按原图发送时，SDK MUST 保留原图分辨率语义，不得因为 `imageType='original'` 而自动将候选资源替换为大图。
- **FR-005A**: 当调用方显式选择 `imageType='original'` 时，SDK MUST 不再在端上额外生成本地大图资源。
- **FR-006**: 图片消息的缩略图语义 MUST 由服务端生成并返回；SDK 不得要求端上生成或维护本地缩略图资源作为发送前必需步骤。
- **FR-007**: 当图片按非原图发送且端上大图生成成功时，SDK MUST 按大图语义继续发送。
- **FR-007A**: 当图片按非原图发送但端上大图生成失败时，SDK MUST 自动回退为原图发送，并记录明确的可诊断日志。
- **FR-008**: GIF MUST 一律按原图语义发送；即使调用方未显式开启原图发送，SDK 也不得将 GIF 转成大图语义或静态压缩图。
- **FR-008A**: 其他不适合静态压缩的图片类型 MUST 保持原有消息语义，不得被错误地转成静态压缩图。
- **FR-009**: SDK MUST 在附件上传前支持统一的附件预检能力，并覆盖图片附件与普通附件。
- **FR-009A**: 附件预检 MUST 使用 `GET /{orgName}/{appName}/chatfiles/exists` 接口，并基于附件 MD5 查询服务端是否已存在对应资源。
- **FR-009B**: 原有上传“获取阈值/初始化”接口 MUST 恢复为仅承担分片 limit 规则初始化职责，不得再兼任附件预检接口。
- **FR-009C**: 原有上传“获取阈值/初始化”接口 MUST 恢复为 multipart init 专用链路；附件预检与分片初始化 MUST 分离，且预检不得额外触发该 init。
- **FR-010**: 图片附件的预检门槛 MUST 支持分层语义：原图使用 200KB 门槛，大图使用 1MB 门槛；普通附件使用 1MB 门槛。
- **FR-010A**: SDK MUST 在每次发送附件时，根据当前上传候选资源的类型与大小判断是否需要执行预检；当达到预检门槛时，SDK MUST 在该次发送流程中调用 `chatfiles/exists` 完成预检协商。
- **FR-011**: 当附件预检命中已存在资源时，SDK MUST 复用服务端返回的远端资源信息并跳过实际上传。
- **FR-012**: 当附件预检未命中时，SDK MUST 继续进入现有上传流程，且不得改变既有发送成功/失败语义。
- **FR-012A**: 附件预检 MUST 以 `entities[0].exists=true` 作为“命中可复用资源”的判定条件；`share-secret` 仅作为可选访问密钥参与回写，不得作为唯一命中条件。
- **FR-013**: 原图发送与大图发送 MUST 只影响“上传候选资源是谁”；是否进入简单上传或分片上传 MUST 继续沿用当前大小阈值逻辑，不得因为“是否发送原图”而改变现有分片判断规则。
- **FR-014**: SDK MUST 在图片消息元数据中携带可区分“发送原图”与“发送压缩图”的图片类型语义，且该语义对发送侧和接收侧一致可见。
- **FR-015**: SDK MUST 在发送成功后回写远端图片资源信息，并让消息对象保留原有 `localUrl`；默认模式下回写 `originalImageUrl`、`largeImageUrl`、`thumbnailUrl`，自有上传模式下不得额外派生 `largeImageUrl` / `thumbnailUrl`。
- **FR-016**: SDK MUST 将访问密钥与图片远端路径分离存储，不得把密钥直接拼接进默认公开的图片地址字段。
- **FR-016A**: 图片消息中的 `url` MUST 固定表示协议原始远端路径语义，不得在不同图片类型下切换成“当前主展示地址”语义。
- **FR-016B**: SDK MUST 通过独立字段表达展示语义；默认模式下提供 `localUrl`、`originalImageUrl`、`largeImageUrl` 与 `thumbnailUrl`，自有上传模式下仅强制提供 `localUrl` 与 `originalImageUrl`，并允许调用方显式透传 `thumbnailUrl`。
- **FR-017**: SDK MUST 在接收图片消息时解析图片类型语义，并将当前消息整理成统一的原图/大图/缩略图地址视图。
- **FR-018**: 当接收侧拿到协议 `imageType=1` 的图片消息且 SDK 处于默认模式时，SDK MUST 同时提供 `localUrl=''`、`originalImageUrl=remotePath`、`largeImageUrl=remotePath?size=large` 和 `thumbnailUrl=remotePath?size=small`，并将对外 `imageType` 标记为 `'original'`。
- **FR-019**: 当接收侧拿到协议 `imageType=2` 的图片消息且 SDK 处于默认模式时，SDK MUST 同时提供 `localUrl=''`、`originalImageUrl=remotePath`、`largeImageUrl=remotePath?size=large` 和 `thumbnailUrl=remotePath?size=small`，并将对外 `imageType` 标记为 `'large'`。
- **FR-019A**: 当 SDK 初始化了 `useCustomAttachmentUpload=true` 时，创建侧与接收侧都 MUST 不再自动派生 `largeImageUrl` / `thumbnailUrl`；若调用方显式传入或协议显式携带 `thumbnailUrl`，则允许透传。
- **FR-020**: 原图、大图与缩略图的访问密钥 MUST 共享同一密钥语义，以保持接收侧下载与展示行为一致。
- **FR-021**: SDK MUST 在图片消息协议中支持传递图片类型语义，以便发送侧与接收侧对“发送原图/发送压缩图”达成一致；协议 `imageType=1` 表示原图，协议 `imageType=2` 表示压缩图，对外统一映射为 `imageType='original' | 'large'`。
- **FR-022**: SDK MUST 在预检协商时向服务端传递附件 MD5，使服务端能够判定是否复用已有资源。
- **FR-022A**: SDK MUST 在图片上传相关请求中始终传递必填 `imagetype` 字段；其取值仅允许 `origin` 或 `large`，不得继续使用 `big`。
- **FR-023**: 非图片附件执行预检时 MUST 使用统一的附件预检链路，不得因为缺少图片属性而无法参与预检。
- **FR-024**: SDK MUST 对图片发送前预处理、预检命中、预检未命中、上传回写和接收侧地址派生等关键节点提供可诊断的错误与日志语义。
- **FR-024A**: 当端上大图生成失败并回退为原图发送时，SDK MUST 输出明确日志，以便调用方区分“按预期发送原图”和“因大图生成失败回退为原图”。
- **FR-025**: 小程序端 MUST 使用与 Web 端一致的公开图片消息创建与发送语义，不得要求业务层传入不同结构的图片消息参数。
- **FR-026**: 小程序端在具备关键图片处理能力时 MUST 能完成图片压缩、图片信息读取、摘要计算、预检协商与上传发送完整链路。
- **FR-027**: 当小程序端缺失关键图片处理能力时，SDK MUST 返回明确错误，不得静默跳过压缩、摘要或预检步骤。
- **FR-028**: 本次改造 MUST 保持历史未使用该能力的图片发送与普通附件发送行为向后兼容；未设置 `imageType` 时，旧业务代码无需改动即可继续运行。
- **FR-029**: SDK MUST 提供初始化参数 `useCustomAttachmentUpload?: boolean` 作为图片 URL 派生策略开关；未显式开启时默认关闭。

### Key Entities *(include if feature involves data)*

- **ImageSendPolicy**: 图片发送策略，描述当前图片消息按原图还是大图语义发送。
- **ImageVariantSet**: 同一张图片在发送和接收语义中对应的原图、大图、缩略图视图集合。
- **AttachmentPrecheckResult**: 附件预检结果，描述资源是否可复用，以及服务端返回的远端资源标识与访问密钥语义。
- **AttachmentPrecheckHitRule**: 附件预检命中规则，定义 `chatfiles/exists` 返回 `entities[0].exists=true` 时资源可被直接复用。
- **AttachmentRemoteResource**: 上传成功或预检命中后回写到消息中的远端资源信息，包含远端路径、访问密钥、文件大小与图片类型语义。
- **ImageMessageView**: 对外暴露的图片消息视图，统一表达 `localUrl`、图片类型、`originalImageUrl`、`largeImageUrl`、`thumbnailUrl` 与预览相关语义。

### Assumptions

- 默认发送图片时以“大图发送”作为主路径，只有显式设置 `imageType='original'` 时才保留原图上传候选资源；若大图生成失败，则自动回退为原图发送。
- 现有分片上传判断阈值继续由当前上传模块负责，本次规格不改变既有分片门槛常量。
- `chatfiles/exists` 当前文档声明服务端仍可能处于占位实现、固定返回 `exists=false`；SDK 需要先完成接口接入与未命中兼容路径，并通过契约测试覆盖未来 `exists=true` 的命中形态。
- 原有“获取阈值/初始化”接口继续承担 multipart init 职责，不再被附件预检复用；单次 multipart 上传流程仅保留一次 init 调用。
- 服务端会基于统一资源标识提供大图与缩略图访问语义；缩略图统一由服务端生成，若异步生成尚未完成，服务端会负责兜底返回可用资源。
- 小程序端通过宿主提供或平台适配层注入的能力完成图片处理与摘要计算；SDK 对外保持统一公开语义。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 图片消息在“默认发送大图”和“显式发送原图”两条主路径下，相关单元与集成用例通过率达到 100%。
- **SC-002**: 附件预检命中场景下，SDK 对重复资源的重复上传次数降为 0。
- **SC-003**: 图片接收侧对原图语义与大图语义的地址派生准确率达到 100%（以协议契约用例为准）。
- **SC-004**: 未使用该新能力的历史图片消息与普通附件发送样例可无改造运行，回归用例通过率达到 100%。
- **SC-005**: 在具备所需能力的小程序环境中，图片发送与附件预检主路径可与 Web 端保持一致的公开 API 和消息语义，验收通过率达到 100%。
