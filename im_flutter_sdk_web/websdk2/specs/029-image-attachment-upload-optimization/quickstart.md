# 029 快速验证指南

## 目标

验证图片发送压缩、原图开关、附件预检秒传、接收侧图片地址派生与小程序能力注入满足 `029 spec` 要求。

## 前置准备

1. 安装依赖：

```bash
npm install
```

2. 确认已有图片消息与附件消息基础回归样例。

3. 准备两类图片资源：

- 普通静态图（JPG/PNG）
- GIF

4. 准备三类附件大小样例：

- 小于预检门槛
- 大于预检门槛但低于现有分片阈值
- 大于现有分片阈值

5. 准备可模拟以下返回的上传测试环境：

- `GET /{orgName}/{appName}/chatfiles/exists?md5=...` 返回 `exists=true + uuid (+ 可选 share-secret)`
- `GET /{orgName}/{appName}/chatfiles/exists?md5=...` 返回 `exists=false`
- 上传成功返回远端资源信息

## 验证步骤

### 步骤 1：029 定向回归

```bash
npm run type-check
npm run lint
npm run test:run -- tests/unit/message/create-image-message.test.ts tests/unit/upload/image-upload-utils.test.ts tests/unit/upload/attachment-uploader.test.ts tests/unit/protocol/image-content-codec.test.ts tests/unit/platform/image-processing-capability.test.ts tests/unit/platform/upload-source-normalize.test.ts tests/integration/image-attachment-upload.integration.test.ts tests/contract/image-attachment-upload.contract.test.ts
```

期望：029 涉及的图片创建、上传策略、预检、协议编解码、平台能力和集成链路全部通过。

### 步骤 2：默认发送大图

- 创建一条未显式设置 `imageType` 的图片消息。
- 执行发送。

期望：

- SDK 尝试生成大图
- 消息最终 `imageType = 'large'`
- 消息对象中的 `url` 仍表示协议原始远端路径
- 默认模式下：`localUrl / originalImageUrl / largeImageUrl / thumbnailUrl` 四个字段语义固定
- `useCustomAttachmentUpload=true` 时：SDK 不再自动派生 `largeImageUrl / thumbnailUrl`

### 步骤 3：默认大图生成失败回退原图

- 创建一条未显式设置 `imageType` 的图片消息。
- 模拟大图生成失败。
- 执行发送。

期望：

- SDK 不阻断发送
- 最终回退为原图发送
- 记录明确日志

### 步骤 4：显式发送原图

- 创建一条 `imageType = 'original'` 的图片消息。
- 执行发送。

期望：

- SDK 不再尝试生成本地大图
- 最终 `imageType = 'original'`
- 保持原图发送语义

### 步骤 5：GIF 强制原图

- 创建一条 GIF 图片消息，`imageType` 分别设置为 `'original'` 与默认值。
- 执行发送。

期望：

- 两种情况下都按原图语义发送
- 不会进入大图压缩语义

### 步骤 6：预检门槛与接口调用时机

- 分别构造：
  - 原图 `<= 200KB`
  - 原图 `> 200KB`
  - 大图 `<= 1MB`
  - 大图 `> 1MB`
  - 普通附件 `<= 1MB`
  - 普通附件 `> 1MB`

期望：

- 仅超过对应门槛时，才会在该次发送流程中调用 `chatfiles/exists`
- 低于门槛时直接进入现有上传流程
- 这套判断与分片上传阈值判断相互独立

### 步骤 7：预检命中

- 模拟 `chatfiles/exists` 返回 `exists=true`、`uuid`，并按需返回 `share-secret`。

期望：

- SDK 视为命中
- 跳过实际上传
- 直接组装消息远端资源信息

### 步骤 8：预检未命中

- 模拟 `chatfiles/exists` 返回 `exists=false`。

期望：

- SDK 视为未命中
- 继续进入现有上传流程

### 步骤 9：接收侧图片语义

- 构造一条协议 `imageType = 1` 的下行图片消息
- 构造一条协议 `imageType = 2` 的下行图片消息

期望：

- 两种场景中 `url` 都保持协议原始远端路径
- 默认模式下两种场景都可得到 `originalImageUrl / largeImageUrl / thumbnailUrl`
- 默认模式下 `largeImageUrl` 固定使用 `?size=large`
- 默认模式下 `thumbnailUrl` 固定使用 `?size=small`

### 步骤 10：小程序能力注入

- 使用小程序文件源执行图片发送
- 模拟注入完整图片处理能力
- 再模拟缺少关键能力

期望：

- 能力完整时，图片发送与 Web 端语义一致
- 小程序文件对象缺少 `name/type` 时，SDK 仍可根据本地 `path` 推导上传源元信息
- 缺少关键能力时，返回明确错误

## 已执行命令记录

### 本轮实现后执行

```bash
npm run type-check
npm run lint
npm run test:run -- tests/unit/upload/image-upload-utils.test.ts tests/unit/upload/attachment-uploader.test.ts tests/unit/upload/simple-upload.test.ts tests/unit/upload/multipart-upload.test.ts tests/unit/protocol/image-content-codec.test.ts tests/integration/image-attachment-upload.integration.test.ts tests/contract/image-attachment-upload.contract.test.ts
```

结果：

- `npm run type-check` 通过
- `npm run lint` 通过
- 029 定向测试通过：7 个文件，48 个用例

### 029 主链路实现阶段已执行

```bash
npm run type-check
npm run lint
npm run test:run -- tests/unit/message/create-image-message.test.ts tests/unit/upload/image-upload-utils.test.ts tests/unit/upload/attachment-uploader.test.ts tests/unit/protocol/image-content-codec.test.ts
npm run test:run -- tests/integration/image-attachment-upload.integration.test.ts tests/contract/image-attachment-upload.contract.test.ts tests/unit/platform/image-processing-capability.test.ts tests/unit/upload/image-upload-utils.test.ts
```

结果：

- 图片发送主链路、协议编解码、平台图片处理能力与集成/契约用例均已通过
- 本轮补充了小程序上传源规范化单测和 miniapp-path 集成测试，验证小程序文件源可沿用 029 发送语义

## 验收清单（对应 spec）

- 默认大图发送通过率：100%
- 显式原图发送通过率：100%
- GIF 强制原图通过率：100%
- 预检门槛判断准确率：100%
- 预检命中判定准确率：100%
- 接收侧图片地址派生准确率：100%
- 小程序能力完整场景通过率：100%
- 历史图片发送回归通过率：100%

## 常见失败定位

- `url` 语义混乱：检查发送回写与接收解码是否把 `url` 当成主展示地址
- 预检误命中：检查是否错误把 `share-secret` 当成唯一命中条件，或未校验 `exists=true`
- 原图错误分片：检查“预检门槛”和“分片阈值”是否被混为一层判断，或预检仍错误复用了分片 init
- GIF 被压缩：检查图片发送策略解析是否优先处理 GIF
- 原图发送仍生成大图：检查 `imageType='original'` 分支是否绕过了大图生成
- 缩略图本地生成：检查端上链路是否仍保留旧的缩略图处理逻辑
