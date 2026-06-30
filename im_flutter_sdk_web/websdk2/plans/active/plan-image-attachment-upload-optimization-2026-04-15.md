# 进行中计划：图片发送压缩、原图开关与附件预检秒传

**Branch**: 待确认（建议：`029-image-attachment-upload-optimization`） | **Date**: 2026-04-15 | **Spec**: 暂无，待后续正式落入 `specs/`  
**Input**: 用户方案“发送图片消息时支持压缩、创建消息增加是否发送原图参数，并在上传链路增加附件预检秒传能力，要求支持小程序”

## Summary

本计划暂存于 `plans/active`，因为它横跨消息创建、上传链路、协议字段与跨平台适配多个 feature 边界，适合先作为进行中跨 feature 方案收敛；待范围稳定后，再正式拆分进入 `specs/`。

推荐方案如下：

1. `createImageMessage` 仅新增同步参数 `sendOriginal?: boolean`，默认 `false`，不在创建阶段执行压缩。
2. 实际压缩、缩略图生成、MD5 计算、预检秒传与最终上传策略统一放到发送前的异步附件预处理链路。
3. 预检能力对所有附件开放，但图片消息额外携带 `imageType` 语义，区分“原图”与“大图”。
4. 小程序能力通过平台适配注入，不在 SDK Core 中硬编码 `wx.*` 或假设存在原生 C++ MD5 能力。

## 为什么单独建 Feature

- `specs/007-file-upload/spec.md` 明确将“文件秒传与哈希去重”列为 `Out of Scope`，直接回填会破坏既有边界。
- `specs/003-message-create/spec.md` 聚焦创建消息，不适合承载发送前异步压缩与上传协商设计。
- `specs/018-cross-platform-adapter/spec.md` 已提供平台能力抽象基础，但尚未覆盖图片压缩与文件摘要能力。

因此，本方案建议以新 feature 承接，后续再补 `spec.md` 与 `tasks.md`。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、vitest、vite、eslint、现有 `RestClient`、`AttachmentUploader`、`UploadAdapter`、MSync protobuf 编解码、现有跨平台适配层  
**Storage**: 不新增持久化；本地附件仍复用 `attachmentFileStore`，图片派生资源仅保持发送会话级内存态  
**Testing**: Vitest 单元测试 + 集成测试；协议映射与上传协商需补契约/集成用例；E2E 仅评估 Web demo 主路径，真实小程序联调作为独立验证  
**Target Platform**: Web、微信小程序、uni-app 小程序/H5；本期重点保证小程序能力可落地  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 创建消息保持同步轻量；发送前预处理全异步；图片仅压缩一次；命中预检时跳过实际上传  
**Constraints**: 不破坏现有公开发送 API；不得将压缩逻辑硬编码为浏览器专属实现；图片 URL/secret 语义需与协议保持一致；禁止 `any`  
**Scale/Scope**: 涉及消息创建、发送前附件预处理、上传协商、协议编解码、跨平台能力注入、测试分层

## Constitution Check

_GATE: Must pass before implementation. Re-check after `spec.md` / `tasks.md` 完成。_

- [x] **性能优先**: 压缩、摘要、预检全部放在发送前异步链路，不阻塞创建消息同步入口
- [x] **类型安全**: 新增 `sendOriginal`、`imageType`、派生图片资源结构均需严格类型定义
- [x] **测试驱动**: 方案显式包含单元、集成、协议契约与平台适配验证
- [x] **可靠性**: 需保留上传超时、回退与错误映射；服务端 3s 阻塞兜底要在客户端建模
- [x] **可扩展性**: 附件预检对所有附件通用，图片压缩能力通过平台适配注入
- [x] **可观测性**: 关键节点需打点日志：压缩决策、预检命中、上传策略、接收端 URL 派生
- [x] **版本管理**: 若实施，需在验证后更新版本号、`CHANGELOG.md` 并提交 commit

## Project Structure

### Documentation (this plan)

```text
plans/active/
└── plan-image-attachment-upload-optimization-2026-04-15.md
```

### Source Code (planned impact)

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
│   ├── types.ts
│   └── utils.ts
├── platform/
│   ├── types.ts
│   └── upload/
└── protocol/
    └── msync/
        ├── codec.ts
        ├── proto.ts
        └── proto-source.json

tests/
├── unit/
│   ├── message/
│   ├── upload/
│   ├── platform/
│   └── protocol/
└── integration/
```

**Structure Decision**: 保持单项目结构。消息创建、上传链路、协议字段与平台能力分别在既有目录增量扩展，不另起并行实现。

## 设计方案

### 1. 创建消息侧：只新增发送策略，不做重处理

对 `createImageMessage` 增加 `sendOriginal?: boolean` 参数，推荐默认值为 `false`。

建议：

- `createImageMessage` 继续保持同步函数。
- 创建阶段仅记录“发送原图还是发送大图”的意图，不做图片压缩、缩略图生成和 MD5 计算。
- 若业务未显式传入 `thumbnailUrl` / `bigImageUrl` 等本地派生地址，可在发送前异步回填。

原因：

- 当前 `createImageMessage` 为同步 API，若把压缩放进去会迫使公开 API 改为异步，破坏现有使用方式。
- 小程序压缩依赖平台能力，适合在发送链路中统一调度，而不是在创建链路中做分支。

### 2. 消息模型扩展：避免继续复用含糊的 `url`

当前图片消息体只有 `url` 与 `thumbnailUrl`，不足以同时表达“协议 remotePath 原值”“原图 URL”“大图 URL”“缩略图 URL”。

建议新增或明确以下公开字段：

- `sendOriginal?: boolean`
- `imageType?: 1 | 2`
- `originalUrl?: string`
- `bigImageUrl?: string`
- `thumbnailUrl?: string`
- `thumbnailSecret?: string`（如需与当前 `video` 语义对齐，可选）

字段语义建议：

- `url`: 保留为协议 `remotePath` 原值，避免丢失服务端下发语义
- `imageType = 1`: `url/originalUrl` 为原图地址，`bigImageUrl` 和 `thumbnailUrl` 通过约定规则派生
- `imageType = 2`: `url/bigImageUrl` 为大图地址，`originalUrl` 为空，`thumbnailUrl` 通过约定规则派生

额外建议：

- `secret` 与 URL 分离保存，不再把 `share-secret` 拼进 `url` 字段。
- SDK 下载/预览时再根据 `secret` 组装真实访问请求。

原因：

- 当前 `src/upload/utils.ts` 会把 `share-secret` 直接拼进 `url`，这与本次 `?size=big` / `?size=thumbnail` 规则天然冲突。
- 接收侧当前已经是 `remotePath` 与 `secretKey` 分离解码，发送侧也应该统一成同一语义。

### 3. 发送前附件预处理链路

在 `AttachmentUploader.prepareMessage()` 前半段引入统一的异步预处理阶段：

1. 识别附件类型与来源
2. 图片消息根据 `sendOriginal` 判定上传候选资源
3. 如有需要，生成大图与缩略图本地派生资源
4. 计算上传候选资源的 MD5
5. 执行预检协商
6. 命中秒传则直接组装消息体
7. 未命中则按阈值选择简单上传或分片上传
8. 上传成功后回写消息元数据并进入 MSync 编码发送

建议新增内部数据结构：

- `AttachmentPreprocessResult`
- `ImageVariantSet`
- `AttachmentPrecheckPayload`
- `AttachmentRemoteResource`

### 4. 图片压缩策略

按产品要求统一规则：

- 原图：保持原始分辨率
- 大图：等比压缩后短边不超过 `720px`，默认质量 `85%`
- 缩略图：等比压缩后短边不超过 `198px`，默认质量 `35%`

发送规则建议：

- `sendOriginal = false`
  - 上传候选资源为大图
  - `imageType = 2`
- `sendOriginal = true`
  - 上传候选资源为原图
  - `imageType = 1`
  - 若业务未提供本地大图/缩略图，则发送前基于原图异步生成，仅用于本地消息对象补齐预览字段

需要显式排除的场景：

- GIF/动图建议默认跳过压缩，强制走原图语义，或由产品明确“动图压缩后是否允许丢失动画信息”

### 5. 上传预检与秒传

预检能力建议覆盖所有附件，但上传链路要拆成两个独立决策：

1. `sendOriginal` / `imageType` 只决定“上传候选资源是谁”
2. 简单上传还是分片上传继续沿用当前大小阈值逻辑，不因 `sendOriginal` 改变

具体建议如下：

- 非图片附件：
  - `<= 1MB`：跳过预检，直接进入现有上传流程
  - `> 1MB`：先预检；未命中后，继续按现有阈值逻辑决定简单上传或分片上传
- 图片大图（`imageType = 2`）：
  - 上传候选资源为压缩后大图
  - `<= 1MB`：跳过预检，直接进入现有上传流程
  - `> 1MB`：先预检；未命中后，继续按现有阈值逻辑决定简单上传或分片上传
- 图片原图（`imageType = 1`）：
  - 上传候选资源为原图本身
  - `<= 200KB`：跳过预检，直接进入现有上传流程
  - `> 200KB`：先预检；未命中后，继续按现有阈值逻辑决定简单上传或分片上传

这里的“现有阈值逻辑”指当前上传模块的分片判断规则保持不变，例如继续由现有 `MULTIPART_THRESHOLD` 决定是否分片。

预检协商建议：

- 将 MD5 与 `imagetype` 放入分片上传协商请求头
- 非图片附件默认 `imagetype=1`（origin）
- 服务端返回：
  - `uuid`：必带
  - `share-secret`：命中已有资源时返回

客户端处理：

- `share-secret` 有值：视为命中秒传，不再上传，直接组装远端资源信息
- `share-secret` 缺失或为空：继续走上传流程

需要和服务端锁定的契约：

- 预检究竟复用“分片 init”接口还是抽出独立 `/precheck`
- 请求头最终名称是否严格为 `md5` / `imagetype`
- 当命中秒传但未实际上传时，`uuid` 与 `uri` 的组合规则是否与上传完成响应完全一致

### 6. 上传模块改造点

建议改造 `src/upload/attachment-uploader.ts`、`src/upload/simple-upload.ts`、`src/upload/multipart-upload.ts`：

1. 统一接收“预处理后待上传资源”，而不是直接假定使用原始 `File`
2. 简单上传与分片上传共用新的策略选择器
3. 分片 init 请求支持透传：
   - `imagetype`
   - `md5`
   - 资源尺寸/文件大小（如服务端需要）
4. `buildUploadResult()` 不再返回拼接了 `share-secret` 的 URL，而是返回 canonical remote path + secret
5. 图片上传结果需支持回写：
   - `url`
   - `originalUrl`
   - `bigImageUrl`
   - `thumbnailUrl`
   - `secret`
   - `fileLength`
   - `size`
   - `imageType`

补充建议：

- 当前 `thumbnail-width` / `thumbnail-height` 更像旧缩略图生成协议；若服务端已固定生成大图和缩略图，图片上传链路建议停止传该参数，避免新旧语义冲突

### 7. 协议与 MSync 编解码改造

协议改造建议落在 `src/protocol/msync/proto-source.json` 与生成产物中：

- `message Content` 新增 `imageType = 26`

编码侧：

- `imageType` 写入图片内容
- `remotePath` 保持“当前协议原值”
- `secretKey` 与 URL 分离
- 图片 `size` 写入上传候选资源的实际宽高

解码侧：

- 读取 `imageType`
- 根据 `imageType` 派生：
  - `originalUrl`
  - `bigImageUrl`
  - `thumbnailUrl`
- `imageType = 1`
  - `url/originalUrl = remotePath`
  - `bigImageUrl = remotePath + ?size=big`
  - `thumbnailUrl = remotePath + ?size=thumbnail`
- `imageType = 2`
  - `url/bigImageUrl = remotePath`
  - `originalUrl = undefined`
  - `thumbnailUrl = remotePath 基础 uuid + ?size=thumbnail`

注意：

- 需要统一 URL 拼接工具，避免当前 `?em-redirect=true&share-secret=` 与新 `?size=` 规则混用
- 服务端 3 秒阻塞兜底属于下载时语义，SDK 接收解码阶段只负责正确派生 URL，不应额外阻塞

### 8. 小程序支持策略

本方案可以支持小程序，但不建议在 SDK Core 内部直接写死 `wx.compressImage` 或“C++ 层算 MD5”。

推荐做法：

1. 在平台适配层新增图片处理/摘要能力，或新增专门的 `AttachmentProcessorAdapter`
2. SDK Core 只依赖抽象能力：
   - `compressImage`
   - `generateThumbnail`
   - `getImageInfo`
   - `computeMd5`
3. Web 默认实现可使用浏览器能力
4. 小程序由宿主注入适配实现，内部可调用 `wx.compressImage`、`wx.getImageInfo`，以及宿主提供的 MD5 能力

理由：

- 当前跨平台设计已经通过 `UploadAdapter` 处理非 Web 文件源，继续沿用“能力注入”模式最一致
- 小程序并不存在可被 SDK 直接依赖的通用 “C++ 层”，把 MD5 写死为 C++ 依赖不可移植

小程序本期最低能力要求：

- 可读取本地图片路径、尺寸、MIME、文件大小
- 可生成压缩后的临时文件路径
- 可生成缩略图临时文件路径
- 可对待上传文件计算 MD5
- 可上传 `path` 类型文件并携带自定义请求头/表单字段

### 9. 测试分层

单元测试（必须新增）：

- `createImageMessage` 新增 `sendOriginal` 参数的默认值与校验
- 图片压缩策略选择：原图/大图/GIF
- 预检阈值判断：`200KB` / `1MB`
- 上传请求头构造：`md5`、`imagetype`
- URL 派生逻辑：`imageType=1/2`
- `share-secret` 命中秒传时跳过上传

集成测试（必须新增）：

- `AttachmentUploader.prepareMessage()` 串联预处理 + 预检 + 上传回写
- MSync 编码/解码对 `imageType` 的双向映射
- 小程序文件源通过注入适配器完成压缩与上传
- 发送原图但本地缺少大图/缩略图时的本地回填

E2E / 真实环境评估：

- Web demo 主路径可补一个图片发送 smoke，用于验证公开 API 不回归
- 小程序端由于仓库内无现成 E2E 运行基座，本期不强行落仓库级 E2E，但应保留真实环境联调 checklist
- 若服务端异步大图/缩略图生成尚未就绪，需增加联调样例覆盖 3 秒阻塞兜底语义

## 风险与可行性建议

### 建议 1：修正“发送原图”与“上传压缩图”的语义冲突

当前方案文字中有一处冲突：

- 一方面要求 `sendOriginal=true` 时发送原图
- 另一方面又写到“原图 > 200KB 时上传的是平台层压缩过的图，算大图”

这两者不能同时成立。建议统一为：

- `sendOriginal=true`：上传候选资源是原图本身
- `sendOriginal=false`：上传候选资源是压缩后大图
- 是否简单上传或分片上传，继续沿用现有大小阈值逻辑，不由 `sendOriginal` 直接决定

### 建议 2：不要再把 `share-secret` 拼进 `url`

当前实现会把 secret 拼进上传结果 URL，这会和新图片 URL 规则冲突，也会让接收侧与发送侧语义不一致。建议从本 feature 开始统一改为“URL 与 secret 分离存储”。

### 建议 3：GIF 必须先定策略

如果 GIF 被压缩成普通静态图，会直接改变消息语义。建议产品先明确：

- GIF 是否永远按原图发送
- 若 `sendOriginal=false` 且输入是 GIF，SDK 是自动降级为原图还是直接报错

### 建议 4：小程序不要依赖浏览器式压缩实现

不能假设小程序有 `File`、`Blob`、`Canvas`、`crypto.subtle` 的同等能力。应把压缩和 MD5 变成平台能力接口，由宿主注入。

### 建议 5：服务端契约需先锁定再编码

至少需要在实现前确认：

- `imagetype` 的枚举是否固定为 `1=原图, 2=大图`
- 秒传命中时返回结构是否只给 `uuid/share-secret`
- `?size=big` / `?size=thumbnail` 是否总是对同一 uuid 成立
- 下载时 secret 的传递方式是否仍然独立于 URL

## Complexity Tracking

无额外豁免项。
