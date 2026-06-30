# Data Model: 语音转文字迁移

## VoiceMessageSource

用途：

- `voiceMessageToText` 的旧兼容输入

结构：

```ts
type VoiceMessageSource = VoiceMessageBody & {
  readonly type?: 'voice';
};
```

约束：

- 必须可视为语音消息体
- 必须包含：
  - `filename: string`
  - `filetype: string`
  - `duration: number`
- `url` 必须存在且可提取 `fileId`

失败语义：

- 非法语音消息体：`407`
- 缺失 `url`：`410`
- `url` 无法提取 `fileId`：`407`

## VoiceSourceFile

用途：

- `voiceFileToText` 的跨端输入

结构：

```ts
type VoiceSourceFile = File | MiniAppFile;
```

约束：

- 浏览器侧支持原生 `File`
- 小程序侧支持当前 SDK 的 `MiniAppFile`
- 本期不承诺 RN

失败语义：

- 非法文件对象：`407`

## AudioParams

用途：

- 两个语音转文字方法共享的可选音频参数

结构：

```ts
interface AudioParams {
  readonly format?: string;
  readonly sampleRate?: number;
  readonly bitsPerSample?: number;
  readonly channels?: number;
}
```

约束：

- 任一字段存在时必须满足对应基础类型
- `PCM` 缺失 `audioParams` 不做本地强校验

失败语义：

- 字段类型非法：`407`

## VoiceToTextResult

用途：

- 新 SDK 成功返回风格

结构：

```ts
interface VoiceToTextResult {
  readonly text: string;
}
```

说明：

- 成功不复用旧 `AsyncResult`
- 统一返回业务对象 `{ text }`

## SpeechResponseEnvelope

用途：

- speech 服务 envelope 解析

成功结构：

```json
{
  "data": {
    "text": "..."
  },
  "meta": {
    "timestamp": 0,
    "requestId": ""
  }
}
```

失败结构：

```json
{
  "error": {
    "code": 4001002,
    "message": "unsupported speech file format"
  },
  "meta": {
    "timestamp": 0,
    "requestId": ""
  }
}
```

说明：

- 当前已真实确认 `speech/recognitions` 使用该 envelope
- `speech/transcriptions` 暂按同结构保守实现

## Error Mapping Model

统一出口：

- 成功返回 `VoiceToTextResult`
- 失败抛 `SDKError`

兼容常量：

- `UPLOAD_REQUEST_FAILED = 402`
- `VALIDATION_REQUIRED = 110`
- `SERVICE_LIMIT_EXCEEDED = 4`
- `AUTH_UNAUTHORIZED = 202`
- `VOICE_TO_TEXT_FILE_INVALID = 407`
- `VOICE_TO_TEXT_FILE_DURATION_TOO_LONG = 408`
- `VOICE_TO_TEXT_FAILED = 409`
- `VOICE_TO_TEXT_FILE_NOT_FOUND = 410`
- `VOICE_TO_TEXT_FILE_TOO_LARGE = 411`

附带信息：

- `details.serviceCode`
- `details.serviceMessage`
- 必要时附带 `rawResponse`
