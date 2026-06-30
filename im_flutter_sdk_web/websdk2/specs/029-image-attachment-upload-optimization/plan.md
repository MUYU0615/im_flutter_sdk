# 实施方案：图片发送压缩、原图开关与附件预检秒传

**Branch**: `029-image-attachment-upload-optimization` | **Date**: 2026-04-15 | **Spec**: `specs/029-image-attachment-upload-optimization/spec.md`  
**Input**: Feature specification from `/specs/029-image-attachment-upload-optimization/spec.md`

## Summary

本特性在现有图片消息创建、附件上传和 MSync 收发链路上补充四类能力：

1. `createImageMessage` 支持 `imageType` 公开输入，默认走大图发送语义。
2. 发送前新增图片预处理链路，仅在 `imageType='large'` 时尝试生成大图；生成失败则回退为原图发送并记录日志；缩略图统一由服务端生成。
3. 附件预检秒传覆盖图片和普通附件，预检接口切换为 `GET /{orgName}/{appName}/chatfiles/exists`；原有“获取阈值/初始化”接口恢复为只承担 multipart init 职责，不再被预检额外复用。
4. 协议与消息模型新增 `imageType` 和统一图片地址视图；默认模式下接收侧稳定表达 `localUrl/originalImageUrl/largeImageUrl/thumbnailUrl` 语义，自有上传模式下不再自动派生 `largeImageUrl / thumbnailUrl`；对外 `imageType` 使用 `'original' | 'large'`，协议字段继续使用 `1 | 2` 表达。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、vitest、vite、eslint、现有 `AttachmentUploader` / `UploadAdapter`、现有 MSync protobuf 编解码、现有平台适配层  
**Storage**: 不新增持久化；本地附件继续复用 `attachmentFileStore`；图片预处理结果保持发送会话级内存态  
**Testing**: Vitest 单元测试 + 集成测试；协议编解码和上传链路需要补充回归用例  
**Target Platform**: Web、微信小程序、uni-app 小程序/H5  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 创建消息保持同步；发送前仅对候选图片做一次大图处理；命中预检时跳过实际上传；不引入主链路明显性能回退  
**Constraints**: 不破坏现有公开发送 API；分片上传阈值逻辑保持现状；缩略图仅由服务端生成；预检命中以 `chatfiles/exists` 返回 `exists=true` 为准；图片上传 `imagetype` 只能使用 `origin | large`；禁止 `any`  
**Scale/Scope**: 涉及图片消息创建参数、上传前预处理、预检接口切换、分片初始化职责恢复、协议字段扩展、跨平台图片处理能力和测试分层

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 创建链路保持同步，图片处理与预检全部放到发送前异步链路，避免主线程出现重复处理
- [x] **类型安全**: `imageType`、图片地址视图、预检结果与平台处理能力全部采用严格类型定义
- [x] **测试驱动**: 计划覆盖创建、预处理、预检、上传、协议收发和小程序适配的单元/集成验证
- [x] **可靠性**: 保留现有上传超时和错误映射；大图生成失败回退原图；服务端资源生成不阻塞消息对象组装
- [x] **可扩展性**: 预检链路对所有附件通用，图片处理能力通过平台适配注入，不把实现锁死在 Web
- [x] **可观测性**: 增加大图生成失败回退、预检命中、预检跳过、协议图片类型映射等日志节点
- [x] **版本管理**: 实施后按仓库规则更新版本号、`CHANGELOG.md` 并提交 commit

Phase 1 设计复检预期：通过。当前 spec 已完成关键澄清，无额外原则冲突。

## Project Structure

### Documentation (this feature)

```text
specs/029-image-attachment-upload-optimization/
├── spec.md
├── plan.md
├── checklists/
│   └── requirements.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
```

### Source Code (repository root)

```text
src/
├── message/
│   └── create-message.ts
├── types/
│   ├── index.ts
│   └── message-create.ts
├── validators/
│   └── message-create.ts
├── upload/
│   ├── attachment-uploader.ts
│   ├── simple-upload.ts
│   ├── multipart-upload.ts
│   ├── constants.ts
│   ├── types.ts
│   └── utils.ts
├── platform/
│   ├── types.ts
│   └── upload/
├── protocol/
│   └── msync/
│       ├── codec.ts
│       ├── proto.ts
│       └── proto-source.json
└── utils/
    └── logger.ts

tests/
├── unit/
│   ├── message/
│   ├── upload/
│   ├── platform/
│   └── protocol/
└── integration/
```

**Structure Decision**: 保持单项目结构，在既有 `message / upload / platform / protocol` 目录内增量扩展，不为图片优化新增平行模块。

## Phase 0: Research

输出：

- `specs/029-image-attachment-upload-optimization/research.md`

研究与确认项：

1. 明确现有“获取阈值/初始化”接口与 `chatfiles/exists` 接口在上传实现中的职责边界，整理出：
   - 当前仅初始化一次的调用路径
   - 当前分片阈值、文件上限与返回结构
   - `chatfiles/exists` 的 query / header 传参方式、占位返回结构与未来命中返回结构
2. 明确图片消息现有公开字段和 MSync 内容字段的差异，确定：
   - `url` 固定保留协议原始远端路径
   - `localUrl / originalImageUrl / largeImageUrl / thumbnailUrl` 的固定派生规则
3. 明确平台适配层如何承接图片处理能力，至少包含：
   - 大图生成
   - 图片信息读取
   - MD5 计算
4. 明确服务端生成缩略图后的客户端下载语义，确认：
   - 端上无需生成缩略图
   - 服务端异步生成时的兜底访问行为只影响下载层，不影响消息对象建模

## Phase 1: Design & Contracts

输出：

- `specs/029-image-attachment-upload-optimization/data-model.md`
- `specs/029-image-attachment-upload-optimization/quickstart.md`
- `specs/029-image-attachment-upload-optimization/contracts/` 下的协议或协商契约说明

设计要点：

### 1. 创建消息与公开类型

- 在 `src/types/message-create.ts` 增加 `CreateImageMessageParams.imageType?: 'original' | 'large'`
- 在 `src/validators/message-create.ts` 增加对应校验
- 在 `src/message/create-message.ts` 记录并归一 `imageType`，不做图片处理
- 在 `src/types/index.ts` 扩展图片消息体，至少新增：
  - `imageType?: 'original' | 'large'`
  - `originalImageUrl?: string`
  - `localUrl: string`
  - `largeImageUrl?: string`
  - `thumbnailUrl?: string`
- 图片消息公开模型不再暴露 `url`
- 图片消息视图始终回写远端三条图片 URL：
  - `originalImageUrl = remotePath`
  - `largeImageUrl = remotePath + ?size=large`
  - `thumbnailUrl = remotePath + ?size=small`

### 2. 发送前图片预处理

在 `AttachmentUploader.prepareMessage()` 前半段引入内部预处理步骤：

1. 读取消息类型和本地附件源
2. 若为图片消息：
   - `imageType='original'`：直接使用原图作为上传候选资源，不生成本地大图
   - `imageType='large'`：尝试生成大图；若失败，回退原图并记录日志
3. 缩略图不在端上生成
4. 为图片上传协商结果准备必填 `imagetype`：
   - 原图发送：`origin`
   - 压缩大图发送：`large`
5. 读取候选资源元信息并计算 MD5
6. 输出统一的 `AttachmentPreprocessResult`

内部模型建议：

- `AttachmentPreprocessResult`
- `ImageSendVariant`
- `AttachmentPrecheckDecision`
- `AttachmentRemoteResource`

### 3. 预检接口切换与分片初始化职责恢复

这是本次实现的关键约束。

现状：

- `src/upload/multipart-upload.ts` 通过 init 接口获取 `uuid + limit` 并驱动分片上传
- 预检曾额外复用 init 接口，导致职责混淆

改造后：

- 附件预检切换为 `GET /{orgName}/{appName}/chatfiles/exists`
- 预检请求仅基于 MD5 判断资源是否已存在，不再复用 init 接口
- 每次发送附件时：
  - 先根据候选资源类型与大小判断是否达到预检门槛
  - 达到门槛则在本次发送链路中调用 `chatfiles/exists`
  - 未达到门槛则直接进入现有上传流程
- 原有 init 接口恢复为只承担 multipart 会话初始化职责，不再被预检复用
- 若 `chatfiles/exists` 仍返回占位结果 `exists=false`，SDK 需要平滑走未命中分支，不改变现有上传行为

门槛规则：

- 原图候选资源：`> 200KB` 执行预检
- 大图候选资源：`> 1MB` 执行预检
- 非图片附件：`> 1MB` 执行预检

命中规则：

- `entities[0].exists = true` 即命中
- `share-secret` 为可选访问密钥，缺失时按空密钥处理，不影响命中判定
- `entities` 缺失、为空或 `exists = false` 时，视为未命中

上传策略保持不变：

- 是否简单上传或分片上传继续由现有 `MULTIPART_THRESHOLD` 等逻辑决定
- `imageType` 只影响候选资源，不影响分片阈值逻辑

### 3.1 上传图片协商字段

- 图片上传相关请求统一携带必填 `imagetype`
- 取值规则：
  - 原图发送：`origin`
  - 压缩大图发送：`large`
- 旧值 `big` 全量替换为 `large`

### 4. 上传结果与消息回写

改造 `src/upload/utils.ts`、`src/upload/attachment-uploader.ts`：

- `buildUploadResult()` 不再拼接 `share-secret` 到 `url`
- 上传结果改为返回 canonical remote path + secret + fileLength
- 图片消息回写时根据 `imageType` 组装：
  - `localUrl`
  - `originalImageUrl`
  - `largeImageUrl`
  - `thumbnailUrl`
  - `secret`
  - `fileLength`

回写规则：

- 对外 `imageType = 'original'`
  - `localUrl` 保留发送前本地地址
  - `originalImageUrl = remotePath`
  - `largeImageUrl = remotePath + ?size=large`
- 对外 `imageType = 'large'`
  - `localUrl` 保留发送前本地地址
  - `originalImageUrl = remotePath`
  - `largeImageUrl = remotePath + ?size=large`
- `thumbnailUrl = remotePath + ?size=small`
- 三条图片 URL 始终回写，不再通过字段缺失表达“发送原图/发送压缩图”

### 5. MSync 协议与编解码

更新 `src/protocol/msync/proto-source.json` 与生成产物：

- `Content` 新增 `imageType = 26`
- `imageType = 1` 表示发送原图
- `imageType = 2` 表示发送压缩图

编码：

- 图片消息上行写入：
  - `imageType`
  - `remotePath`
  - `secretKey`
  - `size`

解码：

- 读取 `imageType`
- 稳定派生：
  - `localUrl`
  - `originalImageUrl`
  - `largeImageUrl`
  - `thumbnailUrl`

派生规则：

- `imageType = 1`
  - `localUrl = ''`
  - `originalImageUrl = remotePath`
  - `largeImageUrl = remotePath + ?size=large`
  - `thumbnailUrl = remotePath + ?size=small`
- `imageType = 2`
  - `localUrl = ''`
  - `originalImageUrl = remotePath`
  - `largeImageUrl = remotePath + ?size=large`
  - `thumbnailUrl = remotePath + ?size=small`
- 客户端通过 `imageType` 区分发送方发送的是原图还是压缩图，而不是通过 URL 字段是否缺失推断

### 6. 跨平台图片处理能力

在 `src/platform/types.ts` 扩展平台能力，建议增加独立图片处理能力而不是把逻辑塞进 `UploadAdapter`：

- `getImageInfo`
- `generateBigImage`
- `computeMd5`

策略：

- Web 端提供默认实现
- 小程序/uni-app 通过平台适配注入实现
- 缺少关键能力时 fail-fast，返回明确错误

不做的事：

- 不在 SDK Core 直接调用 `wx.*`
- 不要求端上生成缩略图

### 7. 日志与错误语义

新增或强化以下日志点：

- 图片发送策略决策（原图 / 大图 / GIF）
- 大图生成失败并回退原图
- 预检跳过
- 预检命中
- 预检未命中
- 分片 init 不再被预检额外复用
- 协议 `imageType` 编码 / 解码异常

错误语义要求：

- 图片处理能力缺失：明确平台能力错误
- 图片处理失败但可回退：不抛错，写日志并继续原图发送
- 预检请求失败：沿用上传错误语义或映射为统一上传失败

## Test Strategy

### Unit

- `createImageMessage` 的 `imageType` 默认值与校验
- GIF 强制原图语义
- `imageType='large'` 时大图生成成功 / 失败回退
- 预检门槛判定
- `chatfiles/exists` 命中判定依赖 `exists=true`
- 上传 `imagetype=origin|large` 的映射规则
- `localUrl / originalImageUrl / largeImageUrl / thumbnailUrl` 的派生规则
- “是否调预检接口”与“是否初始化分片 limit”的决策分离

### Integration

- 发送前预处理 + 预检 + 上传回写串联
- 达到门槛时调用 `chatfiles/exists`
- 原有 init 接口恢复为只初始化一次分片 limit
- 原图 / 大图上行编码与下行解码一致
- Web 与小程序文件源在同一公开 API 下的语义一致性

### E2E / Real Env

- Web demo 主路径补图片发送 smoke（如当前仓库适合）
- 小程序保留真实环境联调验收，不强行纳入当前仓库自动化 E2E

## Phase 2 Outputs

在进入 `/speckit.tasks` 前，Phase 2 需要至少产出：

- `research.md`
- `data-model.md`
- `quickstart.md`
- `contracts/` 下的上传协商与消息语义契约说明

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=029-image-attachment-upload-optimization .specify/scripts/bash/update-agent-context.sh codex
```

预期：把 029 的技术上下文同步到仓库 agent 上下文，便于后续 `tasks` 与实现阶段继续使用。

## Complexity Tracking

无额外豁免项。
