# Quickstart: 语音转文字迁移

## 1. SDK 用法

```ts
import { ChatClient, ChatManager } from 'im-sdk-web';

const client = ChatClient.init({
  appKey: 'easemob-demo#chatdemoui',
}).use(ChatManager);

await client.login({
  userId: 'tst',
  token: 'token',
});
```

### 语音消息转文字

```ts
const result = await client.chatManager.voiceMessageToText(
  {
    type: 'voice',
    filename: 'voice.amr',
    filetype: 'audio/amr',
    duration: 1,
    url: 'https://cdn.example.com/path/voice.amr',
  },
  {
    format: 'amr',
  }
);

console.log(result.text);
```

### 本地文件转文字

```ts
const file = new File(['demo'], 'voice.amr', {
  type: 'audio/amr',
});

const result = await client.chatManager.voiceFileToText(file, {
  format: 'amr',
});

console.log(result.text);
```

## 2. 失败语义

- 成功返回：`{ text: string }`
- 失败抛出：`SDKError`
- `SDKError.code` 使用当前 SDK 实际抛出的兼容编号

示例：

```ts
try {
  await client.chatManager.voiceFileToText(file);
} catch (error) {
  console.error(error.code, error.message, error.details);
}
```

## 3. Demo 验证

### 页面入口

- 打开 demo
- 登录后进入 `语音转文字` tab

### 页面能力

- 从当前消息列表筛选最近语音消息
- 触发 `voiceMessageToText`
- 选择本地文件并触发 `voiceFileToText`
- 页面直接展示：
  - 结果文本
  - 错误信息
  - `audioParams`
  - 调用元信息

## 4. 当前验证结果

已执行：

- `npm run type-check`
- `npm run test:run -- tests/unit/demo/voice-to-text-panel.test.ts tests/unit/rest/speech-helpers.test.ts tests/unit/managers/chat-manager.test.ts tests/integration/chat-manager/voice-to-text.integration.test.ts tests/integration/miniapp-demo/voice-to-text.integration.test.ts`

待补充：

- `npm run lint`
- `npm run test:gate:pr`
- `tests/e2e/voice-to-text.spec.ts` 的真实执行记录

## 5. 风险提示

- `speech/recognitions` 成功/失败 envelope 已有真实样例
- `speech/transcriptions` 仍缺真实成功/失败样例
- 因此当前 `voiceMessageToText` 的 response contract 采用保守假设：
  - 成功 `data.text`
  - 失败 `error.code / error.message`

如后续拿到真实 transcription 样例，需回补：

- `research.md`
- `contracts/voice-to-text.openapi.yaml`
- `speech-helpers` 对应 fixture / integration
