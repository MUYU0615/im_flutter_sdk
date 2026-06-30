# 计划：029 图片上传评审 follow-up

## 背景

基于当前 `029-image-attachment-upload-optimization` 实现与代码中的现有 TODO，本轮评审提出以下收敛项：

1. 上传图片时增加必填上传参数 `imageType`，取值仅允许：
   - 原图：`origin`
   - 大图：`large`
2. 上传时传递的 `md5` / `width` / `height` 等协商参数从 header 挪到 URL query
3. 对外图片视图字段 `largeImageUrl` 改名为 `bigImageUrl`
4. 图片 URL 拼接不再依赖 `new URL()`，改为对小程序安全的兼容实现
5. 对外消息体移除 `imageType`，改为 `isOriginalImage: boolean`

当前代码里已能直接命中的相关位置：

- `src/upload/attachment-uploader.ts` 中 `//TODO: imageType`
- `src/upload/utils.ts` 中 `// TODO 兼容小程序`

## 目标

- 收敛上传协商参数命名与传递位置，避免 header/query 混用
- 把图片消息公开模型从“枚举语义”改为“布尔语义”
- 修正图片视图字段命名，统一为 `original / big / thumbnail`
- 消除 `new URL()` 在小程序运行时的兼容风险

## 影响范围

### 1. 图片公开类型与创建消息

需要修改：

- `src/types/index.ts`
- `src/types/message-create.ts`
- `src/validators/message-create.ts`
- `src/message/create-message.ts`

计划：

- 删除图片消息对外 `imageType?: 'original' | 'large'`
- 改为 `isOriginalImage?: boolean`
- `largeImageUrl` 全量改为 `bigImageUrl`
- 创建消息时：
  - GIF 强制 `isOriginalImage = true`
  - 未显式指定时默认 `false`，表示默认走大图发送语义

### 2. 上传准备与上传请求

需要修改：

- `src/upload/attachment-uploader.ts`
- `src/upload/simple-upload.ts`
- `src/upload/multipart-upload.ts`
- `src/upload/types.ts`
- `src/upload/utils.ts`

计划：

- 内部仍保留“原图/大图”发送决策，但对外不再暴露 `imageType`
- 上传图片时显式带上必填 query 参数 `imageType=origin|large`
- `md5` / `width` / `height` 从 header 改到 URL query
- 保留 `thumbnail-width` / `thumbnail-height` 现有 query/formData 语义，避免额外混入本轮变更
- 秒传预检仍继续使用原图 md5 语义，除非代码 TODO 或协议约束显示需要同步调整

### 3. 图片 URL 派生与小程序兼容

需要修改：

- `src/upload/utils.ts`
- `src/protocol/msync/codec.ts`
- 可能受影响的 `src/protocol/protobuf/decoder.ts`

计划：

- 把 `deriveImageUrls()` 的返回改为：
  - `originalImageUrl`
  - `bigImageUrl`
  - `thumbnailUrl`
- 去掉对 `new URL()` 的运行时依赖，统一走字符串拼接兼容实现
- 保证带 query 的已有 URL 仍能正确替换/追加 `size=...`

### 4. 协议编解码与消息视图

需要修改：

- `src/protocol/msync/codec.ts`
- 相关测试与 helper

计划：

- 协议内部仍可继续使用 `1 | 2` 区分原图/大图发送语义
- SDK 对外 decode 后不再给 `imageType`
- 改为：
  - `isOriginalImage = true` 表示协议原图
  - `isOriginalImage = false` 表示协议大图

## 测试范围

至少需要更新：

- `tests/unit/upload/attachment-uploader.test.ts`
- `tests/unit/upload/simple-upload.test.ts`
- `tests/unit/upload/multipart-upload.test.ts`
- `tests/unit/upload/image-upload-utils.test.ts`
- `tests/unit/protocol/image-content-codec.test.ts`
- `tests/unit/message/create-image-message.test.ts`
- `tests/integration/image-attachment-upload.integration.test.ts`
- `tests/contract/image-attachment-upload.contract.test.ts`

验证计划：

- `npm run test:run -- tests/unit/upload/attachment-uploader.test.ts tests/unit/upload/simple-upload.test.ts tests/unit/upload/multipart-upload.test.ts tests/unit/upload/image-upload-utils.test.ts tests/unit/protocol/image-content-codec.test.ts tests/unit/message/create-image-message.test.ts tests/integration/image-attachment-upload.integration.test.ts tests/contract/image-attachment-upload.contract.test.ts`
- `npm run lint`

## 风险与待确认点

### 风险 1：这是公开字段 breaking rename

- `largeImageUrl -> bigImageUrl`
- `imageType -> isOriginalImage`

需要同步修改所有类型、测试、文档与 demo，否则会留下双字段并存或断言失真。

### 风险 2：上传 query 改动会影响 simple / multipart / 自定义上传三条路径

- 浏览器 XHR
- 上传适配器 `uploadAdapter`
- 分片 complete 请求

必须保证三条路径对 `imageType / md5 / width / height` 的拼装方式一致。

### 风险 3：协议内部是否保留 `imageType`

当前需求更像是“对外消息体移除 `imageType`”，不是“协议里也去掉”。建议：

- 协议内部继续保留 `imageType=1|2`
- SDK 对外只暴露 `isOriginalImage`

这样风险最低，也不需要改服务端协商契约。

## 建议实施顺序

1. 先改类型与工具函数命名，确定公开语义
2. 再改上传 URL/query 拼装，收敛 simple / multipart / adapter 三条路径
3. 再改协议 decode/encode 和图片回写
4. 最后统一修测试、spec 文档、版本号、CHANGELOG 和提交
