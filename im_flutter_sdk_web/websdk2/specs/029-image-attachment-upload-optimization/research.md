# 029 研究记录（Phase 0）

## Decision 1: `createImageMessage` 保持同步，只记录发送策略

- **Decision**: 创建图片消息时仅记录 `imageType` 语义，不在创建阶段执行图片压缩、缩略图生成或 MD5 计算。
- **Rationale**: 当前创建消息 API 为同步接口，若把图片处理前置到创建阶段，会直接破坏既有公开调用方式。
- **Alternatives considered**:
  - 创建阶段直接异步压缩：会把公开 API 改成异步，升级成本高。
  - 创建阶段预生成全部派生资源：会把平台差异和失败分支提前暴露给业务侧。

## Decision 2: GIF 一律按原图发送

- **Decision**: GIF 不参与大图压缩链路；无论是否设置 `imageType`，都按原图语义发送。
- **Rationale**: GIF 若被压缩成静态图或错误的大图语义，会直接改变消息内容语义。
- **Alternatives considered**:
  - `imageType='large'` 时对 GIF 报错：会增加业务分支判断负担。
  - 尝试压缩 GIF 并保留动图：跨平台复杂度高，验收不稳定。

## Decision 3: 只在 `imageType='large'` 时尝试生成大图

- **Decision**: 原图发送时端上不再生成本地大图；`imageType='large'` 时才尝试生成大图，失败则回退原图并写日志。
- **Rationale**: 这与用户澄清完全一致，且能保证“原图发送语义优先”。
- **Alternatives considered**:
  - 原图发送时也补生成本地大图：与澄清冲突，且增加不必要处理成本。
  - 大图生成失败直接阻断发送：会把图片处理失败放大成主链路失败，体验差。

## Decision 4: 缩略图统一由服务端生成

- **Decision**: 端上不生成缩略图；默认模式下 `thumbnailUrl` 由服务端资源地址规则派生；自有上传模式下只透传业务显式提供的缩略图地址。
- **Rationale**: 用户已明确缩略图由服务端生成，端上不处理，可显著降低平台差异和本地缓存复杂度。
- **Alternatives considered**:
  - 端上补生成缩略图：与澄清冲突，且会增加小程序适配复杂度。
  - 原图发送时本地补缩略图兜底：会形成两套缩略图语义，不利于统一验收。

## Decision 5: `url` 固定保留协议原始远端路径

- **Decision**: 图片消息不再暴露 `url`；本地预览统一通过 `localUrl` 表达。默认模式下远端展示语义通过 `originalImageUrl`、`largeImageUrl`、`thumbnailUrl` 表达；自有上传模式下不自动派生 `largeImageUrl` / `thumbnailUrl`。
- **Rationale**: 这样可避免 `url` 在不同图片类型下语义漂移，也便于发送侧和接收侧保持一致建模。
- **Alternatives considered**:
  - `url` 始终表示当前主展示地址：会丢失协议原值，增加兼容风险。
  - `url` 随 `imageType` 切换语义：业务侧更难理解，测试断言也更脆弱。

## Decision 6: `exists=true` 才算预检命中，`share-secret` 仅为可选密钥

- **Decision**: 附件预检以 `chatfiles/exists` 返回 `exists=true` 且携带 `uuid` 为命中条件；`share-secret` 只作为可选访问密钥。
- **Rationale**: 这与 2026-04-17 的接口文档一致，也能兼容“资源已存在但无需密钥”场景。
- **Alternatives considered**:
  - 只要返回 `uuid` 就命中：容易把异常响应误判成秒传成功。
  - 仍以 `share-secret` 是否非空判定：会与新接口契约冲突。

## Decision 7: 预检接口切换为 `chatfiles/exists`

- **Decision**: 附件预检改为 `GET /{orgName}/{appName}/chatfiles/exists?md5=...`，不再复用分片 init 接口。
- **Rationale**: 这是用户最新确认的接口约束，也能把“是否存在”和“分片上传初始化”两类职责重新拆开。
- **Alternatives considered**:
  - 继续复用 init 接口：会把预检和分片初始化耦合在一起，违背新要求。
  - 新增 SDK 私有 `/precheck`：与现有服务端接口文档不一致。

## Decision 8: 分片 init 恢复原职责，预检与分片分离

- **Decision**: `chatfiles/exists` 按单次发送规则触发；`/sdk/chatfiles/part-upload` 恢复为只承担 multipart `init -> parts -> complete` 流程。
- **Rationale**: 这样可以保持原有分片上传行为，同时消除“每次预检都额外打到 init 接口”的副作用。
- **Alternatives considered**:
  - 仍让 init 兼做预检：职责混乱，代码和测试都更难维护。
  - 完全移除 init：会破坏现有 multipart 上传流程。

## Decision 9: 预检门槛与分片门槛分离

- **Decision**: 是否调用预检接口与是否走分片上传属于两层独立决策；分片上传继续沿用当前阈值逻辑。
- **Rationale**: 用户已明确“是否使用分片上传保持原来的逻辑”，因此不能把 `imageType` 或预检门槛直接绑定到分片策略。
- **Alternatives considered**:
  - 预检后直接决定分片：会让新规则入侵现有上传策略。
  - 用原图/大图门槛直接替换分片门槛：与既有行为兼容性冲突。

## Decision 10: 图片处理能力通过平台适配注入

- **Decision**: 平台相关的图片信息读取、大图生成和 MD5 计算通过平台适配层注入，不在 SDK Core 中直接调用 `wx.*` 或绑定浏览器实现。
- **Rationale**: 这与 `018-cross-platform-adapter` 的抽象方向一致，能同时覆盖 Web 和小程序。
- **Alternatives considered**:
  - 在 Core 中直接写浏览器实现：小程序不可用。
  - 在 Core 中直接写 `wx.*`：会破坏当前跨平台分层。
