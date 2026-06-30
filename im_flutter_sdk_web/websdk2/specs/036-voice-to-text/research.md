# Research: 语音转文字迁移

## 1. 旧 SDK 兼容真源

### 公开方法与调用语义

- 旧方法名：`voiceMessageToText`、`voiceFileToText`
- 本期只保留方法名，不保留旧 `conn.contact.*` 调用路径
- `voiceMessageToText` 旧语义是“传语音消息体”，不是当前 SDK 的完整 `Message`
- `voiceFileToText` 本期明确支持：
  - 浏览器 `File`
  - 当前 `WEBSDK2` 的 `MiniAppFile`

### 旧错误码真源

来源：

- 旧 SDK 实现：`websdk/packages/IM/sdk/src/apis/index.ts`
- 旧 HLD：`websdk/packages/IM/docs/voice_to_text_hld.md`

确认的兼容编号：

- `VALIDATION_REQUIRED = 110`
- `SERVICE_LIMIT_EXCEEDED = 4`
- `AUTH_UNAUTHORIZED = 202`
- `UPLOAD_REQUEST_FAILED = 402`
- `FILE_INVALID = 407`
- `FILE_DURATION_TOO_LONG = 408`
- `FILE_VOICE_TO_TEXT_FAILED = 409`
- `FILE_NOT_FOUND = 410`
- `FILE_TOO_LARGE = 411`

### 已确认映射策略

- `4041001 -> 410 File not found`
- `4001002 -> 407 Invalid file`
- `5021001 -> 402 File upload failed`
- `4001003 -> 408 Voice duration exceeds 60 seconds`
- `4031001 -> 505 Service not enabled`
- `4031002 -> 4 Beta service usage limit exceeded`
- `4011001 -> 202 Unauthorized or invalid token`
- `5021003 / 5001003 -> 409 Voice-to-text failed`
- `4001001`：
  - `message` 包含 `uploaded file exceeds` 时映射 `411 File too large`
  - 其余映射 `110 Missing or invalid request parameter`

## 2. 服务端真实样例

### `speech/recognitions` 成功样例

请求：

- `POST /api/sdk/v1/{org}/{app}/speech/recognitions`

响应：

```json
{
  "data": {
    "text": "毛泽东。"
  },
  "meta": {
    "timestamp": 1778133287223,
    "requestId": ""
  }
}
```

### `speech/recognitions` 失败样例

响应：

```json
{
  "error": {
    "code": 4001002,
    "message": "unsupported speech file format"
  },
  "meta": {
    "timestamp": 1778133486462,
    "requestId": ""
  }
}
```

### `speech/transcriptions` 风险

- 当前缺少 `speech/transcriptions` 的真实成功/失败样例
- 现阶段只能基于：
  - 旧 SDK 实现
  - 旧 HLD
  - `speech/recognitions` 的 envelope 形态
- 因此本期实现采用保守假设：
  - 成功体使用 `data.text`
  - 失败体使用 `error.code` / `error.message`

## 3. WEBSDK2 落点选择

### 公开 API

- 新入口放在 `ChatManager`
- 对外调用：
  - `client.chatManager.voiceMessageToText(...)`
  - `client.chatManager.voiceFileToText(...)`

### 共享 helper

- 统一下沉到 `src/rest/speech-helpers.ts`
- 负责：
  - `fileId` 提取
  - 语音消息体 / 文件输入校验
  - speech envelope 解析
  - 旧错误码映射
  - `speech/transcriptions` / `speech/recognitions` 调用收口

### 上传链路

- `voiceFileToText` 复用当前 SDK2 上传适配能力
- 不回退到旧 SDK 的独立 XHR / 小程序上传分叉

## 4. 输入建模结论

- `AudioParams` 继续使用旧语义：
  - `format`
  - `sampleRate`
  - `bitsPerSample`
  - `channels`
- `VoiceMessageSource`：
  - 基于 `VoiceMessageBody`
  - 附加 `type?: 'voice'`
- `VoiceSourceFile`：
  - `File | MiniAppFile`
- `PCM` 缺少 `audioParams`：
  - 不做本地强校验
  - 由服务端决定

## 5. Demo 交互结论

- 本期仅做 Web demo
- 新增独立 tab：`voice-to-text`
- 最近语音消息来源：
  - 直接从当前 demo 的 `messages` 状态筛选
  - 不维护伪造样本
- 本地文件转写：
  - 使用浏览器文件选择器
- 页面展示：
  - 转写结果文本
  - 错误字符串（包含 `SDKError.code`）
  - `audioParams` 与调用元信息

## 6. 实现后验证现状

已完成：

- `npm run type-check`
- `npm run test:run -- tests/unit/demo/voice-to-text-panel.test.ts tests/unit/rest/speech-helpers.test.ts tests/unit/managers/chat-manager.test.ts tests/integration/chat-manager/voice-to-text.integration.test.ts tests/integration/miniapp-demo/voice-to-text.integration.test.ts`

待执行：

- `npm run lint`
- `npm run test:gate:pr`
- 真实环境或本地启动后的 demo / Playwright 进一步验证
