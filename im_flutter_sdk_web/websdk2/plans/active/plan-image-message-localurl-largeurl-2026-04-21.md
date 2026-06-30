# 计划：图片消息移除 `url` 并收敛为 `localUrl / originalImageUrl / largeImageUrl`

## 背景

当前图片消息公开字段仍保留：

- `url`：本地创建阶段常为本地可访问地址，发送/接收后又被收敛为远端原始路径
- `originalImageUrl`
- `bigImageUrl`
- `thumbnailUrl`

现计划进一步收敛图片消息模型：

1. 删除公开 `url`
2. 新增 `localUrl`，只承载发送端本地预览语义
3. 将 `bigImageUrl` 全量改名为 `largeImageUrl`
4. 不考虑向后兼容，直接按未正式发布前的模型重构

## 目标

- 让图片消息字段语义单一、稳定
- 本地预览与远端资源彻底分离
- 对外命名统一到 `large`

## 变更范围

### 1. 规格与契约

需要同步更新：

- `specs/029-image-attachment-upload-optimization/spec.md`
- `specs/029-image-attachment-upload-optimization/plan.md`
- `specs/029-image-attachment-upload-optimization/data-model.md`
- `specs/029-image-attachment-upload-optimization/research.md`
- `specs/029-image-attachment-upload-optimization/quickstart.md`
- `specs/029-image-attachment-upload-optimization/tasks.md`
- `specs/029-image-attachment-upload-optimization/contracts/image-attachment-upload.openapi.yaml`

收敛后的图片消息公开模型：

- `localUrl?: string`
- `originalImageUrl?: string`
- `largeImageUrl?: string`
- `thumbnailUrl?: string`

字段语义：

- `localUrl`：仅发送端本地预览地址，不参与协议传输
- `originalImageUrl`：远端原图地址
- `largeImageUrl`：远端大图地址
- `thumbnailUrl`：远端缩略图地址

### 2. SDK 类型与创建消息

需要修改：

- `src/types/index.ts`
- `src/types/message-create.ts`
- `src/validators/message-create.ts`
- `src/message/create-message.ts`

计划：

- 从 `ImageMessageBody` 删除 `url`
- 新增 `localUrl`
- 将 `bigImageUrl` 改为 `largeImageUrl`
- `createImageMessage()` 在有本地文件时把本地可访问地址写入 `localUrl`
- 若调用方显式传入远端图片地址，则写入 `originalImageUrl`

### 3. 上传与发送链路

需要修改：

- `src/upload/utils.ts`
- `src/upload/attachment-uploader.ts`
- `src/upload/types.ts`

计划：

- 上传前候选资源仍基于本地文件和发送语义决定，不依赖公开 `url`
- 上传成功后统一回写：
  - 清空或保留 `localUrl`（待实现时决定，倾向保留，便于发送端继续本地预览）
  - `originalImageUrl = remotePath`
  - `largeImageUrl = remotePath?size=large`
  - `thumbnailUrl = remotePath?size=small`

### 4. 协议编解码

需要修改：

- `src/protocol/msync/codec.ts`

计划：

- 上行编码图片消息时不再读取 `body.url`
- 统一使用 `body.originalImageUrl` 作为 `remotePath`
- 下行解码时不再写 `url`
- 下行统一派生：
  - `originalImageUrl`
  - `largeImageUrl`
  - `thumbnailUrl`

### 5. Demo / 草稿 / 文档

需要修改：

- `miniprogram-demo/utils/message-drafts.ts`
- 公开参考文档和相关 spec 文档中所有 `url` / `bigImageUrl` 的图片语义说明

## 风险

### 风险 1：创建图片消息的显式远端地址输入如何映射

当前 `createImageMessage()` 允许 `url` 入参。

调整后需要明确：

- 是否把 `CreateImageMessageParams.url` 一并删除
- 或保留创建入参 `url`，但内部立即归一化为 `originalImageUrl`

建议：

- 对外创建入参也同步删除 `url`
- 改为 `originalImageUrl?: string`

这会让公开 API 更一致，但改动面更大。

### 风险 2：发送端本地态与发送成功后的字段状态

`localUrl` 是否在发送成功后保留，需要统一。

建议：

- 保留 `localUrl`
- 它仅表示“本地预览地址是否存在”，不影响远端字段

### 风险 3：历史测试和 helper 大量依赖 `body.url`

需要同步修改：

- unit
- integration
- contract
- miniapp demo tests

## 验证计划

- `npm run type-check`
- `npm run lint`
- 定向测试：
  - `tests/unit/upload/image-upload-utils.test.ts`
  - `tests/unit/upload/attachment-uploader.test.ts`
  - `tests/unit/protocol/image-content-codec.test.ts`
  - `tests/integration/image-attachment-upload.integration.test.ts`
  - `tests/unit/miniapp-demo/message-drafts.test.ts`
  - 受当前环境影响的 `create-*message` 用例单独说明

## 待确认决策

### 决策 A

是否一并删除 `CreateImageMessageParams.url`，改为：

- `localUrl?: string` 不开放给业务手填，只由 SDK 内部生成
- `originalImageUrl?: string` 作为显式远端图片输入

推荐：是

### 决策 B

发送成功后是否保留 `localUrl`

推荐：保留

原因：不会污染远端字段，且对发送端预览更稳定
