# 029 数据模型（Phase 1）

## 1) ImageSendPolicy

- **描述**: 图片发送策略对象，定义当前图片消息按原图还是大图语义发送。
- **关键字段**:
  - `imageType`: 调用侧输入的图片发送语义，`'original' | 'large'`
  - `resolvedImageType`: 最终发送语义，`'original' | 'large'`
  - `reason`: 语义决策原因，如 `explicit-original`、`default-large`、`gif-force-origin`、`large-fallback-origin`
- **校验规则**:
  - GIF 输入时，`resolvedImageType` 必须为 `'original'`
  - `imageType='original'` 时，`resolvedImageType` 必须为 `'original'`

## 2) ImageLocalCandidate

- **描述**: 发送前参与预处理的本地图片候选资源。
- **关键字段**:
  - `sourceKind`: `origin | big`
  - `localPathOrUrl`: 本地文件路径或本地 URL
  - `mimeType`
  - `fileSize`
  - `width`
  - `height`
  - `md5`
- **校验规则**:
  - `sourceKind=origin` 时，必须对应原始资源
  - `sourceKind=big` 时，短边不得超过 `720px`
  - `md5` 缺失时不得进入预检协商

## 3) AttachmentPrecheckDecision

- **描述**: 单次发送时，对附件是否需要预检的判定结果。
- **关键字段**:
  - `shouldPrecheck`
  - `thresholdType`: `image-origin | image-big | attachment`
  - `thresholdBytes`
  - `actualBytes`
  - `reason`
- **校验规则**:
  - 原图候选资源使用 `200KB` 预检门槛
  - 大图候选资源与普通附件使用 `1MB` 预检门槛
  - `shouldPrecheck=false` 时，不应触发 `chatfiles/exists` 接口

## 4) AttachmentPrecheckResult

- **描述**: 调用 `GET /{orgName}/{appName}/chatfiles/exists` 后得到的预检结果。
- **关键字段**:
  - `exists`
  - `uuid`
  - `shareSecret`
  - `hit`
- **命中规则**:
  - `exists=true` 且 `uuid` 存在时，`hit = true`
  - `shareSecret` 为可选值，不参与命中判定
- **约束**:
  - `hit = true` 时可直接组装远端资源
  - `hit = false` 时继续进入现有上传流程

## 5) AttachmentRemoteResource

- **描述**: 上传成功或预检命中后写回消息的远端资源信息。
- **关键字段**:
  - `remotePath`
  - `secret`
  - `fileLength`
  - `imageType`
  - `width`
  - `height`
- **校验规则**:
  - `remotePath` 缺失视为无效资源
  - `secret` 与 `remotePath` 分离保存
  - 图片资源必须带 `imageType`

## 6) ImageMessageView

- **描述**: 对外暴露的图片消息视图。
- **关键字段**:
  - `imageType`: `'original' | 'large'`
  - `localUrl`
  - `originalImageUrl`
  - `largeImageUrl`
  - `thumbnailUrl`
  - `secret`
  - `fileLength`
- **约束**:
  - 本地创建消息时 `localUrl` 为本地可访问地址；远端消息固定为空字符串
  - 默认模式下 `originalImageUrl`、`largeImageUrl`、`thumbnailUrl` 都有值
  - `useCustomAttachmentUpload=true` 时只保证 `originalImageUrl`；`largeImageUrl` 不自动派生，`thumbnailUrl` 仅在业务显式传入或协议显式携带时有值
  - 默认模式下 `largeImageUrl = remotePath?size=large`
  - 默认模式下 `thumbnailUrl = remotePath?size=small`

## 7) PlatformImageProcessingCapability

- **描述**: 平台图片处理能力画像。
- **关键字段**:
  - `getImageInfo`
  - `generateBigImage`
  - `computeMd5`
- **约束**:
  - 缺少 `getImageInfo` 或 `computeMd5` 时，不能完成完整图片发送预处理
  - `imageType='large'` 且缺少 `generateBigImage` 时，可回退为原图发送，但必须记日志

## 关系说明

- `ImageSendPolicy` 决定 `ImageLocalCandidate`
- `ImageLocalCandidate` 进入 `AttachmentPrecheckDecision`
- `AttachmentPrecheckDecision` 为 `true` 时，触发 `AttachmentPrecheckResult`
- `AttachmentPrecheckResult` 命中后直接生成 `AttachmentRemoteResource`
- `AttachmentRemoteResource` 最终映射为 `ImageMessageView`
- `PlatformImageProcessingCapability` 为 `ImageLocalCandidate` 的构建提供支持

## 状态流转

### 图片发送状态

- `draft` -> `policy_resolved`
- `policy_resolved` -> `preprocessing`
- `preprocessing` -> `precheck_deciding`
- `precheck_deciding` -> `prechecking`
- `precheck_deciding` -> `uploading`
- `prechecking` -> `uploading`
- `prechecking` -> `resource_reused`
- `uploading|resource_reused` -> `sending`
- `sending` -> `sent`

### 大图失败回退状态

- `preprocessing(big)` -> `big_failed`
- `big_failed` -> `fallback_origin`
- `fallback_origin` -> `precheck_deciding`

### 接收侧图片解析状态

- `decoded_remote_path` -> `image_type_resolved`
- `image_type_resolved` -> `view_assembled`
